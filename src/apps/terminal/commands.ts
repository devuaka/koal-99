import * as fs from '../../core/fs';
import { registry } from '../../core/registry';
import { launchApp, openNode, humanSize, typeName, IMAGE_EXT } from '../../core/launcher';
import { openApp, wmStore, close as closeWin } from '../../core/wm';
import { bsod, shutdown, logoff, isAdmin, sysStore } from '../../core/system';
import { profiles, findProfile, S, setSettings, SYSOP, currentProfile } from '../../core/settings';
import { userName, desktopDir } from '../../core/session';
import { play } from '../../core/sound';
import { notify } from '../../core/notify';
import { corruptText, seedSystem } from '../../core/seed';
import { startScreensaver } from '../../ui/Screensaver';
import { pickAndImport } from '../../core/importer';
import { ttsOK, voiceList, say } from '../../core/tts';
import { loadPy, pyLoaded, armPy, wirePy, pyError, Py } from '../../core/python';

export type Seg = { t: string; c?: string };
export type Line = Seg[];

export interface TermCtx {
  print(text?: string, cls?: string): void;
  printSegs(segs: Seg[]): void;
  err(text: string): void;
  cwd: string;
  setCwd(id: string): void;
  clear(): void;
  ask(prompt: string, masked?: boolean): Promise<string>;
  sleep(ms: number): Promise<void>;
  cancelled(): boolean;
  matrix(): Promise<void>;
  exit(): void;
  setColors(fg: string, bg: string): void;
  history: string[];
  stdin: string[] | null;
  env: Record<string, string>;
  winId: string;
}

export interface Cmd {
  help: string;
  usage?: string;
  hidden?: boolean;
  run(args: string[], ctx: TermCtx, raw: string): void | Promise<void>;
}

const DOS_COLORS = ['#000000', '#000080', '#008000', '#008080', '#800000', '#800080', '#808000', '#c0c0c0', '#808080', '#0000ff', '#00ff00', '#00ffff', '#ff0000', '#ff00ff', '#ffff00', '#ffffff'];

export const TERM_THEMES: Record<string, { fg: string; bg: string; name: string }> = {
  classic: { fg: '#c0c0c0', bg: '#000000', name: 'Classic (gray on black)' },
  green: { fg: '#33ff66', bg: '#031a08', name: 'Phosphor Green' },
  amber: { fg: '#ffb000', bg: '#1a0f00', name: 'Amber Monitor' },
  blue: { fg: '#ffffff', bg: '#0000a8', name: 'KOAL Blue' },
  teal: { fg: '#e8fff8', bg: '#004d4d', name: 'Deep Ocean' },
  paper: { fg: '#111111', bg: '#f4f1e4', name: 'Paper' },
  kip: { fg: '#ff4040', bg: '#0a0000', name: '???' },
};

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const lpad = (s: string, n: number) => (s.length >= n ? s : ' '.repeat(n - s.length) + s);
const num = (n: number) => n.toLocaleString('en-US');

function fmtDate(t: number) {
  const d = new Date(t);
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  const h = d.getHours() % 12 || 12;
  return `${mm}/${dd}/${d.getFullYear()}  ${h.toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

function globRe(pat: string) {
  return new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
}

/** Expand an argument that may contain wildcards into nodes. */
function expand(arg: string, cwd: string, hidden = true): fs.FSNode[] {
  if (!/[*?]/.test(arg)) {
    const n = fs.resolve(arg, cwd);
    return n ? [n] : [];
  }
  const [parent, pat] = fs.resolveParent(arg, cwd);
  if (!parent) return [];
  const re = globRe(pat);
  return fs.children(parent.id, { hidden }).filter((n) => re.test(n.name));
}

function canEnter(n: fs.FSNode) {
  return !n.meta?.adminOnly || isAdmin();
}

function flags(args: string[]) {
  const f = new Set<string>();
  const rest: string[] = [];
  for (const a of args) {
    if (/^\/[a-z?]+$/i.test(a)) a.slice(1).toLowerCase().split('').forEach((c) => f.add(c));
    else if (/^-[a-z]+$/i.test(a)) a.slice(1).toLowerCase().split('').forEach((c) => f.add(c));
    else if (a === '--all') f.add('a');
    else rest.push(a);
  }
  return { f, rest };
}

function textOf(n: fs.FSNode): string {
  if (n.meta?.corrupt) return corruptText(400);
  if (fs.ext(n.name) === 'exe') return 'MZ\u0090 This program cannot be run in DOS mode.\n$PE\u0000\u0000L\u0001';
  if (n.content.startsWith('data:')) return `[binary data: ${typeName(n)}, ${humanSize(fs.size(n.id))}]`;
  if (n.content === 'builtin:theme') return '[binary data: Wave Sound, 1.2 MB] RIFF....WAVEfmt';
  return n.content;
}

async function asciiArt(dataUrl: string, cols = 64): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const rows = Math.round((cols * img.height) / img.width / 2);
      const c = document.createElement('canvas');
      c.width = cols;
      c.height = Math.max(1, rows);
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0, cols, rows);
      const d = g.getImageData(0, 0, cols, rows).data;
      const ramp = ' .:-=+*#%@';
      const out: string[] = [];
      for (let y = 0; y < rows; y++) {
        let s = '';
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
          s += d[i + 3] < 30 ? ' ' : ramp[Math.min(ramp.length - 1, Math.floor((1 - l) * ramp.length))];
        }
        out.push(s);
      }
      resolve(out);
    };
    img.onerror = () => resolve(['(could not decode image)']);
    img.src = dataUrl;
  });
}

function pidOf(winId: string) {
  let h = 0;
  for (const ch of winId) h = (h * 31 + ch.charCodeAt(0)) % 9000;
  return 1000 + h;
}

const SYS_PROCS = [
  { name: 'System Idle Process', pid: 0, mem: 16 },
  { name: 'kernel.sys', pid: 4, mem: 212 },
  { name: 'stardust.sys', pid: 188, mem: 1840 },
  { name: 'koalshell.exe', pid: 612, mem: 18432 },
  { name: 'spoolsv.exe', pid: 744, mem: 3912 },
  { name: 'twinkle.exe', pid: 902, mem: 99 },
];

function kipRunning() {
  const m = new Date().getMinutes();
  return m % 3 === 0 || isAdmin();
}

const FORTUNES = [
  'You will soon receive a CD-ROM with 500 free hours of STARNET.',
  'A watched download never completes.',
  'Your lucky numbers are 56, 6, and Kbps.',
  'Today is a good day to defragment.',
  'Someone is thinking about your MySpace top 8.',
  'A star you wished on in 1999 is still listening.',
  'Never trust a file you did not create.',
  'The Y2K bug is still out there. Waiting.',
  'If you can read this, your monitor is working.',
];

let xyzzyCount = 0;

export const COMMANDS: Record<string, Cmd> = {
  help: {
    help: 'Lists available commands, or shows help for one command.',
    usage: 'help [command]',
    run([name], ctx) {
      if (name) {
        const c = COMMANDS[name.toLowerCase()] ?? COMMANDS[ALIASES[name.toLowerCase()] ?? ''];
        if (!c) return ctx.err(`No help for '${name}'. It is not a known command.`);
        ctx.print(c.help, 'hi');
        if (c.usage) ctx.print('Usage: ' + c.usage);
        const al = Object.entries(ALIASES).filter(([, v]) => v === (ALIASES[name.toLowerCase()] ?? name.toLowerCase())).map(([k]) => k);
        if (al.length) ctx.print('Aliases: ' + al.join(', '), 'dim');
        return;
      }
      ctx.print('KOAL-CMD 5.1 - available commands. Type HELP <command> for details.', 'hi');
      ctx.print('');
      const names = Object.keys(COMMANDS).filter((k) => !COMMANDS[k].hidden).sort();
      for (const n of names) ctx.printSegs([{ t: pad(n.toUpperCase(), 12), c: 'link' }, { t: COMMANDS[n].help }]);
      ctx.print('');
      ctx.print('Pipes ( | ), redirection ( > and >> ) and && chaining are supported.', 'dim');
      ctx.print('Tab completes commands and paths. Up/Down browse history. Ctrl+C cancels.', 'dim');
      ctx.print('Some commands are not listed. Some things are not meant to be found.', 'dim');
    },
  },
  about: {
    help: 'About KOAL-99.',
    run(_, ctx) {
      ctx.print('KOAL-99 Professional, Build 2004.11, Service Pack 4', 'hi');
      ctx.print('(c) 1999-2004 KOAL Systems Inc., Starlight Valley');
      ctx.print('');
      ctx.print('"The operating system that never rushes."');
      ctx.print('');
      ctx.print('This is a simulated computer. It runs entirely in your browser; nothing here');
      ctx.print('touches your real files. Your pretend files are saved in this browser only.');
    },
  },
  ver: {
    help: 'Displays the KOAL-99 version.',
    run(_, ctx) {
      ctx.print('');
      ctx.print('KOAL-99 [Version 4.10.2004 SP4]');
    },
  },
  cls: { help: 'Clears the screen.', run: (_, ctx) => ctx.clear() },
  date: {
    help: 'Displays the date.',
    run(args, ctx) {
      ctx.print('The current date is: ' + new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }));
      if (args.length) ctx.err('A required privilege is not held by the client. (Time is a construct. You may not edit it.)');
    },
  },
  time: {
    help: 'Displays the time.',
    run(args, ctx) {
      const d = new Date();
      ctx.print('The current time is: ' + d.toLocaleTimeString() + '.' + Math.floor(d.getMilliseconds() / 10).toString().padStart(2, '0'));
      if (args.length) ctx.err('A required privilege is not held by the client.');
    },
  },
  echo: {
    help: 'Displays messages.',
    usage: 'echo <text>   (try: echo hello > hi.txt)',
    run(_args, ctx, raw) {
      const t = raw.replace(/^\s*echo\.?\s?/i, '');
      if (/^(on|off)$/i.test(t.trim())) return ctx.print('ECHO is ' + t.trim().toLowerCase() + '.');
      ctx.print(t.replace(/^"(.*)"$/, '$1'));
    },
  },
  whoami: {
    help: 'Displays the current user.',
    run(_, ctx) {
      const host = COMMANDS.hostname ? 'koal-pc-99' : '';
      ctx.print(`${host}\\${userName()}` + (isAdmin() ? '   (or are you?)' : ''));
    },
  },
  hostname: {
    help: 'Prints the name of this computer.',
    run(_, ctx) {
      const d = new Date();
      ctx.print(d.getHours() % 12 === 3 && d.getMinutes() === 33 ? 'KIP' : 'KOAL-PC-99');
    },
  },
  pwd: { help: 'Prints the current directory.', run: (_, ctx) => ctx.print(fs.pathOf(ctx.cwd)) },
  dir: {
    help: 'Lists files and folders (DOS style).',
    usage: 'dir [path] [/a show hidden] [/w wide] [/s recurse]',
    run(args, ctx) {
      const { f, rest } = flags(args);
      const target = rest[0] ?? '.';
      let nodes: fs.FSNode[];
      let dirNode = fs.resolve(target, ctx.cwd);
      if (/[*?]/.test(target)) {
        const [p] = fs.resolveParent(target, ctx.cwd);
        dirNode = p;
        nodes = expand(target, ctx.cwd, f.has('a'));
      } else {
        if (!dirNode) return ctx.err('File Not Found');
        if (dirNode.type === 'file') nodes = [dirNode];
        else {
          if (!canEnter(dirNode)) return ctx.err('Access is denied.');
          nodes = fs.children(dirNode.id, { hidden: f.has('a') });
        }
      }
      ctx.print(' Volume in drive C is KOALDISK');
      ctx.print(' Volume Serial Number is 1999-0404');
      const listDir = (d: fs.FSNode, list: fs.FSNode[]) => {
        ctx.print('');
        ctx.print(' Directory of ' + fs.pathOf(d.type === 'dir' ? d.id : d.parent!));
        ctx.print('');
        let files = 0;
        let bytes = 0;
        let dirs = 0;
        if (f.has('w')) {
          const names = list.map((n) => (n.type === 'dir' ? `[${n.name}]` : n.name));
          for (let i = 0; i < names.length; i += 4) ctx.print(names.slice(i, i + 4).map((n) => pad(n, 19)).join(''));
        }
        if (d.type === 'dir' && d.parent && !f.has('w')) {
          ctx.printSegs([{ t: fmtDate(d.modified) + '    <DIR>          ' }, { t: '.', c: 'dir' }]);
          ctx.printSegs([{ t: fmtDate(d.modified) + '    <DIR>          ' }, { t: '..', c: 'dir' }]);
        }
        for (const n of list) {
          if (n.type === 'dir') dirs++;
          else {
            files++;
            bytes += fs.size(n.id);
          }
          if (f.has('w')) continue;
          ctx.printSegs([
            { t: fmtDate(n.modified) + '    ' + (n.type === 'dir' ? '<DIR>         ' : lpad(num(fs.size(n.id)), 14)) + ' ' },
            { t: n.name, c: n.type === 'dir' ? 'dir' : n.hidden ? 'dim' : n.meta?.corrupt ? 'err' : undefined },
          ]);
        }
        ctx.print(lpad(String(files), 16) + ' File(s) ' + lpad(num(bytes), 14) + ' bytes');
        ctx.print(lpad(String(dirs + (d.parent ? 2 : 0)), 16) + ' Dir(s)  ' + lpad(num(40 * 1024 ** 3 - fs.totalBytes()), 14) + ' bytes free');
        if (f.has('s')) for (const n of list) if (n.type === 'dir' && canEnter(n)) listDir(n, fs.children(n.id, { hidden: f.has('a') }));
      };
      listDir(dirNode ?? fs.get(ctx.cwd)!, nodes);
    },
  },
  ls: {
    help: 'Lists files and folders (unix style).',
    usage: 'ls [-a] [-l] [path]',
    run(args, ctx) {
      const { f, rest } = flags(args);
      const target = rest[0] ?? '.';
      const nodes = /[*?]/.test(target) ? expand(target, ctx.cwd, f.has('a')) : (() => {
        const d = fs.resolve(target, ctx.cwd);
        if (!d) return null;
        if (d.type === 'file') return [d];
        if (!canEnter(d)) return 'denied' as const;
        return fs.children(d.id, { hidden: f.has('a') });
      })();
      if (nodes === null) return ctx.err(`ls: cannot access '${target}': No such file or directory`);
      if (nodes === 'denied') return ctx.err(`ls: cannot open directory '${target}': Permission denied`);
      const color = (n: fs.FSNode) => (n.type === 'dir' ? 'dir' : n.meta?.corrupt ? 'err' : ['exe', 'lnk', 'bat'].includes(fs.ext(n.name)) ? 'ok' : IMAGE_EXT.includes(fs.ext(n.name)) ? 'mag' : n.hidden ? 'dim' : undefined);
      if (f.has('l')) {
        ctx.print('total ' + nodes.length, 'dim');
        for (const n of nodes) {
          const perm = (n.type === 'dir' ? 'd' : '-') + 'rw' + (n.readonly ? '-' : 'x') + 'r--r--';
          const d = new Date(n.modified);
          ctx.printSegs([{ t: `${perm} 1 ${pad(n.meta?.adminOnly ? 'sysop' : userName(), 7)} ${lpad(String(fs.size(n.id)), 9)} ${d.toLocaleString('en-US', { month: 'short' })} ${lpad(String(d.getDate()), 2)} ${d.getFullYear()} ` }, { t: n.name + (n.type === 'dir' ? '/' : ''), c: color(n) }]);
        }
        return;
      }
      if (!nodes.length) return;
      const w = Math.max(...nodes.map((n) => n.name.length)) + 3;
      const per = Math.max(1, Math.floor(78 / w));
      for (let i = 0; i < nodes.length; i += per) ctx.printSegs(nodes.slice(i, i + per).map((n) => ({ t: pad(n.name + (n.type === 'dir' ? '/' : ''), w), c: color(n) })));
    },
  },
  cd: {
    help: 'Changes the current directory.',
    usage: 'cd <path>   (cd .. goes up, cd \\ goes to root, cd ~ goes home)',
    run(args, ctx) {
      if (!args.length) return ctx.print(fs.pathOf(ctx.cwd));
      const target = args.join(' ');
      const n = fs.resolve(target, ctx.cwd);
      if (!n) return ctx.err('The system cannot find the path specified.');
      if (n.type !== 'dir') return ctx.err('The directory name is invalid.');
      if (!canEnter(n)) return ctx.err('Access is denied.');
      if (n.id === fs.RECYCLER) ctx.print('You are now inside the Recycle Bin. It smells faintly of ozone.', 'dim');
      ctx.setCwd(n.id);
    },
  },
  mkdir: {
    help: 'Creates a directory (and any missing parents).',
    usage: 'mkdir <path>',
    run(args, ctx) {
      if (!args.length) return ctx.err('The syntax of the command is incorrect.');
      for (const a of args) {
        if (fs.resolve(a, ctx.cwd)) {
          ctx.err(`A subdirectory or file ${a} already exists.`);
          continue;
        }
        const parts = a.split(/[\\/]+/).filter(Boolean);
        let cur = /^[\\/]|^c:/i.test(a) ? fs.ROOT : ctx.cwd;
        if (/^~/.test(a)) cur = fs.resolve('~')!.id;
        for (const p of parts) {
          if (/^c:$/i.test(p) || p === '~') continue;
          if (p === '..') {
            cur = fs.get(cur)?.parent ?? cur;
            continue;
          }
          if (p === '.') continue;
          const ex = fs.childByName(cur, p);
          cur = ex ? ex.id : fs.create(cur, p, 'dir').id;
        }
      }
    },
  },
  rmdir: {
    help: 'Removes a directory (to the Recycle Bin).',
    usage: 'rmdir <path> [/s]',
    run(args, ctx) {
      const { f, rest } = flags(args);
      if (!rest.length) return ctx.err('The syntax of the command is incorrect.');
      for (const a of rest) {
        const n = fs.resolve(a, ctx.cwd);
        if (!n) {
          ctx.err('The system cannot find the file specified.');
          continue;
        }
        if (n.type !== 'dir') {
          ctx.err('The directory name is invalid.');
          continue;
        }
        if (fs.children(n.id, { hidden: true }).length && !f.has('s')) {
          ctx.err('The directory is not empty. (use rmdir /s)');
          continue;
        }
        if (fs.isAncestor(n.id, ctx.cwd)) {
          ctx.err('The process cannot access the file because it is being used by another process.');
          continue;
        }
        fs.remove(n.id);
        play('recycle');
      }
    },
  },
  touch: {
    help: 'Creates an empty file, or updates its timestamp.',
    usage: 'touch <file> [file2 ...]',
    run(args, ctx) {
      if (!args.length) return ctx.err('touch: missing file operand');
      for (const a of args) {
        const n = fs.resolve(a, ctx.cwd);
        if (n) fs.update(n.id, { modified: Date.now() });
        else {
          const [p, name] = fs.resolveParent(a, ctx.cwd);
          if (!p) ctx.err(`touch: cannot touch '${a}': No such file or directory`);
          else fs.create(p.id, name, 'file', '');
        }
      }
    },
  },
  cat: {
    help: 'Displays the contents of a file.',
    usage: 'cat <file>   (images are shown as ASCII art)',
    async run(args, ctx) {
      if (!args.length) {
        if (ctx.stdin) ctx.stdin.forEach((l) => ctx.print(l));
        else ctx.err('The syntax of the command is incorrect.');
        return;
      }
      for (const a of args) {
        const list = expand(a, ctx.cwd);
        if (!list.length) {
          ctx.err('The system cannot find the file specified: ' + a);
          continue;
        }
        for (const n of list) {
          if (n.type === 'dir') {
            ctx.err('Access is denied. (' + n.name + ' is a directory)');
            continue;
          }
          if (n.meta?.adminOnly && !isAdmin()) {
            ctx.err('Access is denied.');
            continue;
          }
          if (list.length > 1) ctx.print('\n' + n.name + '\n', 'hi');
          if (n.meta?.corrupt) {
            ctx.print(corruptText(500), 'err');
            play('error');
            continue;
          }
          if (n.content.startsWith('data:image')) {
            const art = await asciiArt(n.content);
            art.forEach((l) => ctx.print(l));
            continue;
          }
          textOf(n).split(/\r?\n/).forEach((l) => ctx.print(l));
        }
      }
    },
  },
  del: {
    help: 'Deletes files (sends them to the Recycle Bin).',
    usage: 'del <file|pattern> [/f permanently]',
    run(args, ctx) {
      const { f, rest } = flags(args);
      if (!rest.length) return ctx.err('The syntax of the command is incorrect.');
      if (rest.some((r) => /^c:\\?(\*(\.\*)?)?$/i.test(r) || r === '\\' || r === '/') && (f.has('s') || f.has('r') || f.has('q'))) return COMMANDS.deltree.run(['c:'], ctx, '');
      let count = 0;
      for (const a of rest) {
        const list = expand(a, ctx.cwd);
        if (!list.length) {
          ctx.err('Could Not Find ' + fs.pathOf(ctx.cwd) + '\\' + a);
          continue;
        }
        for (const n of list) {
          if (n.type === 'dir' && !f.has('r')) {
            ctx.err(`${n.name} is a directory. Use RMDIR.`);
            continue;
          }
          try {
            if (f.has('f')) fs.destroy(n.id);
            else fs.remove(n.id);
            count++;
          } catch (e) {
            ctx.err((e as Error).message);
          }
        }
      }
      if (count) {
        play('recycle');
        ctx.print(`${count} item(s) ${f.has('f') ? 'permanently deleted' : 'moved to the Recycle Bin'}.`, 'dim');
      }
    },
  },
  rename: {
    help: 'Renames a file or folder.',
    usage: 'rename <old> <newname>',
    run(args, ctx) {
      if (args.length < 2) return ctx.err('The syntax of the command is incorrect.');
      const n = fs.resolve(args[0], ctx.cwd);
      if (!n) return ctx.err('The system cannot find the file specified.');
      if (/[\\/]/.test(args[1])) return ctx.err('The syntax of the command is incorrect. (use MOVE to change folders)');
      fs.rename(n.id, args[1]);
    },
  },
  move: {
    help: 'Moves (or renames) files and folders.',
    usage: 'move <source> <destination>',
    run(args, ctx) {
      if (args.length < 2) return ctx.err('The syntax of the command is incorrect.');
      const dest = args[args.length - 1];
      const srcs = args.slice(0, -1).flatMap((a) => expand(a, ctx.cwd));
      if (!srcs.length) return ctx.err('The system cannot find the file specified.');
      const d = fs.resolve(dest, ctx.cwd);
      for (const s of srcs) {
        if (d && d.type === 'dir') fs.move(s.id, d.id);
        else {
          if (srcs.length > 1) return ctx.err('Cannot move multiple files to a single file.');
          const [p, name] = fs.resolveParent(dest, ctx.cwd);
          if (!p) return ctx.err('The system cannot find the path specified.');
          if (d) return ctx.err('A file with that name already exists.');
          fs.move(s.id, p.id, name);
        }
      }
      ctx.print(`        ${srcs.length} file(s) moved.`);
    },
  },
  copy: {
    help: 'Copies files and folders.',
    usage: 'copy <source> <destination>',
    run(args, ctx) {
      if (args.length < 2) return ctx.err('The syntax of the command is incorrect.');
      const dest = args[args.length - 1];
      const srcs = args.slice(0, -1).flatMap((a) => expand(a, ctx.cwd));
      if (!srcs.length) return ctx.err('The system cannot find the file specified.');
      const d = fs.resolve(dest, ctx.cwd);
      for (const s of srcs) {
        if (d && d.type === 'dir') fs.copy(s.id, d.id);
        else {
          const [p, name] = fs.resolveParent(dest, ctx.cwd);
          if (!p) return ctx.err('The system cannot find the path specified.');
          if (d && d.type === 'file') {
            fs.write(d.id, s.content);
            continue;
          }
          fs.copy(s.id, p.id, name);
        }
      }
      ctx.print(`        ${srcs.length} file(s) copied.`);
    },
  },
  tree: {
    help: 'Graphically displays the folder structure.',
    usage: 'tree [path] [/f include files] [/a include hidden]',
    run(args, ctx) {
      const { f, rest } = flags(args);
      const root = fs.resolve(rest[0] ?? '.', ctx.cwd);
      if (!root || root.type !== 'dir') return ctx.err('Invalid path - ' + (rest[0] ?? ''));
      ctx.print('Folder PATH listing for volume KOALDISK');
      ctx.print('Volume serial number is 1999-0404');
      ctx.print(fs.pathOf(root.id));
      let lines = 0;
      const walk = (id: string, prefix: string) => {
        const kids = fs.children(id, { hidden: f.has('a') }).filter((k) => f.has('f') || k.type === 'dir');
        kids.forEach((k, i) => {
          if (lines++ > 400) return;
          const last = i === kids.length - 1;
          ctx.printSegs([{ t: prefix + (last ? '\u2514\u2500\u2500\u2500' : '\u251C\u2500\u2500\u2500') }, { t: k.name, c: k.type === 'dir' ? 'dir' : undefined }]);
          if (k.type === 'dir' && canEnter(k) && k.id !== fs.RECYCLER) walk(k.id, prefix + (last ? '    ' : '\u2502   '));
        });
      };
      walk(root.id, '');
      if (lines > 400) ctx.print('... (truncated)', 'dim');
    },
  },
  neofetch: {
    help: 'Shows system information with style.',
    run(_, ctx) {
      const up = Math.floor((Date.now() - sysStore.get().bootedAt) / 1000);
      const exes = fs.search(fs.ROOT, '*.exe', { hidden: true }).length;
      const { files, dirs } = fs.countTree(fs.ROOT);
      const art = [
        '            .            ',
        '           /*\\           ',
        '          /***\\          ',
        '  .______/*****\\______.  ',
        '   \\*****************/   ',
        '     \\*************/     ',
        '      /***********\\      ',
        '     /*****/ \\*****\\     ',
        '    /***/       \\***\\    ',
        '   \'-\'             \'-\'   ',
        '      K O A L - 9 9      ',
      ];
      const u = userName();
      const info: Seg[][] = [
        [{ t: u, c: 'ok' }, { t: '@' }, { t: 'koal-pc-99', c: 'ok' }],
        [{ t: '-'.repeat(u.length + 11) }],
        [{ t: 'OS: ', c: 'warn' }, { t: 'KOAL-99 Professional SP4' }],
        [{ t: 'Host: ', c: 'warn' }, { t: 'KOAL Systems KS-2004 Beige Tower' }],
        [{ t: 'Kernel: ', c: 'warn' }, { t: '4.10.2004-nova' }],
        [{ t: 'Uptime: ', c: 'warn' }, { t: `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m ${up % 60}s` }],
        [{ t: 'Packages: ', c: 'warn' }, { t: `${exes} (.exe)` }],
        [{ t: 'Shell: ', c: 'warn' }, { t: 'KOAL-CMD 5.1' }],
        [{ t: 'Resolution: ', c: 'warn' }, { t: `${window.innerWidth}x${window.innerHeight} @ 60Hz` }],
        [{ t: 'Theme: ', c: 'warn' }, { t: S().theme }],
        [{ t: 'CPU: ', c: 'warn' }, { t: 'Stellar Pentium III @ 866MHz' }],
        [{ t: 'Memory: ', c: 'warn' }, { t: `${Math.round(fs.totalBytes() / 1024)}KB / 524288KB` }],
        [{ t: 'Disk: ', c: 'warn' }, { t: `${files} files, ${dirs} folders` }],
      ];
      for (let i = 0; i < Math.max(art.length, info.length); i++) ctx.printSegs([{ t: pad(art[i] ?? '', 28), c: 'dim' }, ...(info[i] ?? [])]);
      ctx.printSegs(['#000', '#a00', '#0a0', '#aa0', '#00a', '#a0a', '#0aa', '#aaa'].map((c) => ({ t: '   ', c: 'bg:' + c })));
    },
  },
  matrix: {
    help: 'Follow the white star.',
    run: (_, ctx) => ctx.matrix(),
  },
  color: {
    help: 'Sets console colors (DOS style: color <bg><fg> in hex).',
    usage: 'color 0A   (0=black 1=blue 2=green 3=aqua 4=red 5=purple 6=yellow 7=white 8=gray 9..F bright)',
    run([code], ctx) {
      if (!code) {
        setSettings({ terminalTheme: 'classic' });
        return;
      }
      if (!/^[0-9a-f]{1,2}$/i.test(code)) return ctx.err('Usage: COLOR <attr>, e.g. COLOR 0A for green on black.');
      const c = code.length === 1 ? '0' + code : code;
      const bg = parseInt(c[0], 16);
      const fg = parseInt(c[1], 16);
      if (bg === fg) return ctx.err('The foreground and background colors cannot be the same. (You would not be able to read anything. Trust us.)');
      setSettings({ terminalTheme: `dos:${DOS_COLORS[fg]}:${DOS_COLORS[bg]}` });
    },
  },
  theme: {
    help: 'Lists or sets terminal themes.',
    usage: 'theme [name]',
    run([name], ctx) {
      if (!name) {
        ctx.print('Available themes:', 'hi');
        Object.entries(TERM_THEMES).forEach(([k, v]) => k !== 'kip' && ctx.printSegs([{ t: '  ' + pad(k, 10), c: 'link' }, { t: v.name }]));
        ctx.print('Current: ' + S().terminalTheme, 'dim');
        return;
      }
      if (!TERM_THEMES[name.toLowerCase()]) return ctx.err(`Unknown theme '${name}'.`);
      setSettings({ terminalTheme: name.toLowerCase() });
    },
  },
  shutdown: {
    help: 'Shuts down or restarts the computer.',
    usage: 'shutdown [/r restart] [/l log off] [/t seconds]',
    async run(args, ctx) {
      const { f, rest } = flags(args);
      const ti = args.findIndex((a) => a.toLowerCase() === '/t');
      const secs = ti >= 0 ? Math.min(30, parseInt(args[ti + 1] ?? '3', 10) || 0) : 3;
      if (f.has('l')) return logoff();
      if (f.has('a')) return ctx.print('No shutdown was in progress.');
      ctx.print(`KOAL-99 will ${f.has('r') ? 'restart' : 'shut down'} in ${secs} seconds. Press Ctrl+C to abort.`, 'warn');
      for (let i = secs; i > 0; i--) {
        ctx.print(`  ${i}...`);
        await ctx.sleep(1000);
        if (ctx.cancelled()) return ctx.print('Shutdown aborted.', 'ok');
      }
      shutdown(f.has('r') || rest.includes('restart'));
    },
  },
  restart: {
    help: 'Restarts the computer.',
    run: (_, ctx) => COMMANDS.shutdown.run(['/r', '/t', '2'], ctx, ''),
  },
  logoff: { help: 'Logs off the current user.', run: () => logoff() },
  history: {
    help: 'Shows command history.',
    run(_, ctx) {
      ctx.history.forEach((h, i) => ctx.print(lpad(String(i + 1), 4) + '  ' + h));
    },
  },
  edit: {
    help: 'Opens a file in Notepad (creates it if missing).',
    usage: 'edit <file>',
    run([file], ctx) {
      if (!file) return void launchApp('notepad');
      let n = fs.resolve(file, ctx.cwd);
      if (!n) {
        const [p, name] = fs.resolveParent(file, ctx.cwd);
        if (!p) return ctx.err('The system cannot find the path specified.');
        n = fs.create(p.id, name, 'file', '');
      }
      if (n.type === 'dir') return ctx.err('Cannot edit a directory.');
      openApp('notepad', { fileId: n.id });
    },
  },
  start: {
    help: 'Opens a program, file, folder or web address.',
    usage: 'start <program | path | url>',
    run(args, ctx) {
      const t = args.join(' ');
      if (!t) return void launchApp('terminal');
      const app = findApp(t);
      if (app) return void launchApp(app);
      if (/^(https?:|www\.|koal:)/i.test(t)) return void launchApp('browser', { url: t });
      const n = fs.resolve(t, ctx.cwd);
      if (!n && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) return void launchApp('browser', { url: t });
      if (!n) return ctx.err(`KOAL-99 cannot find '${t}'. Make sure you typed the name correctly, and then try again.`);
      openNode(n);
    },
  },
  find: {
    help: 'Searches for text in files (or in piped input).',
    usage: 'find "text" [path]    or    dir | find "txt"',
    run(args, ctx) {
      const { f, rest } = flags(args);
      const q = (rest[0] ?? '').toLowerCase();
      if (!q) return ctx.err('FIND: Parameter format not correct');
      if (ctx.stdin) {
        ctx.stdin.filter((l) => (l.toLowerCase().includes(q) ? !f.has('v') : f.has('v'))).forEach((l) => ctx.print(l));
        return;
      }
      const root = fs.resolve(rest[1] ?? '.', ctx.cwd);
      if (!root) return ctx.err('File not found - ' + rest[1]);
      const files = root.type === 'file' ? [root] : fs.search(root.id, q, { content: true, hidden: f.has('a') });
      let hits = 0;
      for (const n of files) {
        if (n.type !== 'file') {
          ctx.printSegs([{ t: fs.pathOf(n.id), c: 'dir' }]);
          continue;
        }
        if (n.meta?.adminOnly && !isAdmin()) continue;
        const lines = textOf(n).split(/\r?\n/);
        const matching = lines.filter((l) => l.toLowerCase().includes(q));
        if (!matching.length && !n.name.toLowerCase().includes(q)) continue;
        hits++;
        ctx.print('---------- ' + fs.pathOf(n.id), 'link');
        matching.slice(0, 8).forEach((l) => ctx.print(l));
      }
      if (!hits && !files.length) ctx.print('No matches found.', 'dim');
    },
  },
  sort: {
    help: 'Sorts piped input.',
    run(args, ctx) {
      const lines = [...(ctx.stdin ?? [])].sort((a, b) => a.localeCompare(b));
      (args.includes('/r') || args.includes('-r') ? lines.reverse() : lines).forEach((l) => ctx.print(l));
    },
  },
  head: {
    help: 'Shows the first lines of a file or piped input.',
    usage: 'head [-n N] [file]',
    run(args, ctx) {
      const ni = args.indexOf('-n');
      const n = ni >= 0 ? parseInt(args[ni + 1], 10) || 10 : 10;
      const file = args.filter((_, i) => i !== ni && i !== ni + 1)[0];
      const lines = file ? (fs.resolve(file, ctx.cwd) ? textOf(fs.resolve(file, ctx.cwd)!).split('\n') : null) : ctx.stdin;
      if (!lines) return ctx.err('head: cannot open ' + file);
      lines.slice(0, n).forEach((l) => ctx.print(l));
    },
  },
  wc: {
    help: 'Counts lines, words and characters.',
    run(args, ctx) {
      const text = args[0] ? (fs.resolve(args[0], ctx.cwd) ? textOf(fs.resolve(args[0], ctx.cwd)!) : null) : (ctx.stdin ?? []).join('\n');
      if (text == null) return ctx.err('wc: ' + args[0] + ': No such file');
      ctx.print(`${lpad(String(text.split('\n').length), 7)} ${lpad(String(text.split(/\s+/).filter(Boolean).length), 7)} ${lpad(String(text.length), 7)} ${args[0] ?? ''}`);
    },
  },
  attrib: {
    help: 'Displays or changes file attributes (+h/-h hidden, +r/-r read-only).',
    usage: 'attrib [+h|-h] [+r|-r] <file>',
    run(args, ctx) {
      const mods = args.filter((a) => /^[+-][hr]$/i.test(a));
      const files = args.filter((a) => !/^[+-][hr]$/i.test(a));
      const targets = files.length ? files.flatMap((f) => expand(f, ctx.cwd)) : fs.children(ctx.cwd, { hidden: true });
      if (!targets.length) return ctx.err('File not found - ' + files.join(' '));
      for (const n of targets) {
        if (mods.length) {
          if (n.system && !isAdmin()) {
            ctx.err('Access denied - ' + fs.pathOf(n.id));
            continue;
          }
          const patch: Partial<fs.FSNode> = {};
          for (const m of mods) {
            const on = m[0] === '+';
            if (m[1].toLowerCase() === 'h') patch.hidden = on;
            else patch.readonly = on;
          }
          fs.update(n.id, patch);
        } else {
          const a = `${n.readonly ? 'R' : ' '}${n.hidden ? 'H' : ' '}${n.system ? 'S' : ' '}${n.type === 'file' ? 'A' : ' '}`;
          ctx.print(`${a}        ${fs.pathOf(n.id)}`);
        }
      }
    },
  },
  tasklist: {
    help: 'Lists running programs.',
    run(_, ctx) {
      ctx.print(pad('Image Name', 26) + lpad('PID', 6) + '  ' + lpad('Mem Usage', 12), 'hi');
      ctx.print('='.repeat(25) + ' ' + '='.repeat(6) + ' ' + '='.repeat(13));
      for (const p of SYS_PROCS) ctx.print(pad(p.name, 26) + lpad(String(p.pid), 6) + '  ' + lpad(num(p.mem) + ' K', 12));
      for (const w of wmStore.get().wins) {
        const d = registry[w.app];
        ctx.print(pad((w.app === 'msgbox' ? 'dialog' : w.app) + '.exe', 26) + lpad(String(pidOf(w.id)), 6) + '  ' + lpad(num(1200 + (pidOf(w.id) % 30) * 311) + ' K', 12) + (d ? '   ' + w.title : ''));
      }
      if (kipRunning()) ctx.print(pad('kip.exe', 26) + lpad('333', 6) + '  ' + lpad('4,194,304 K', 12), 'err');
    },
  },
  taskkill: {
    help: 'Ends a running program by name or PID.',
    usage: 'taskkill <name | pid>   e.g. taskkill notepad',
    run(args, ctx) {
      const t = args.filter((a) => !/^\/(im|pid|f)$/i.test(a))[0];
      if (!t) return ctx.err('ERROR: Invalid syntax.');
      const key = t.toLowerCase().replace(/\.exe$/, '');
      if (key === 'kip' || key === '333') {
        play('error');
        ctx.print('ERROR: The process "kip.exe" could not be terminated.', 'err');
        ctx.print('Reason: i dont want to.', 'err');
        return;
      }
      if (['kernel', 'kernel.sys', '4', 'koalshell', '612', 'stardust', 'stardust.sys', '188'].includes(key)) {
        ctx.print(`SUCCESS: The process "${key}" has been terminated.`, 'ok');
        window.setTimeout(() => bsod('CRITICAL_PROCESS_DIED', `The critical process ${key.toUpperCase()} was terminated by ${userName().toUpperCase()}. Bold move.`), 700);
        return;
      }
      const wins = wmStore.get().wins.filter((w) => w.app === key || String(pidOf(w.id)) === key || w.title.toLowerCase().startsWith(key));
      if (!wins.length) return ctx.err(`ERROR: The process "${t}" not found.`);
      for (const w of wins) {
        ctx.print(`SUCCESS: Sent termination signal to "${w.app}.exe" with PID ${pidOf(w.id)}.`, 'ok');
        if (w.id === ctx.winId) {
          ctx.print('(That was this terminal. Goodbye.)', 'dim');
          window.setTimeout(() => closeWin(w.id, true), 500);
        } else closeWin(w.id, true);
      }
    },
  },
  ipconfig: {
    help: 'Displays network configuration.',
    run(_, ctx) {
      ctx.print('KOAL-99 IP Configuration');
      ctx.print('');
      ctx.print('Dial-up adapter STARNET 56K:');
      ctx.print('');
      ctx.print('        Connection-specific DNS Suffix  . : starnet.net');
      ctx.print('        IP Address. . . . . . . . . . . . : 192.168.0.99');
      ctx.print('        Subnet Mask . . . . . . . . . . . : 255.255.255.0');
      ctx.print('        Default Gateway . . . . . . . . . : 192.168.0.1');
      ctx.print('        Stargate. . . . . . . . . . . . . : 10.4.20.99');
    },
  },
  ping: {
    help: 'Pings a host (pretend).',
    usage: 'ping <host>',
    async run([host], ctx) {
      if (!host) return ctx.err('Usage: ping <host>');
      const h = host.toLowerCase();
      const ip = h === 'localhost' ? '127.0.0.1' : h === 'kip' ? '0.0.3.33' : `${(h.length * 37) % 223 + 10}.${(h.charCodeAt(0) * 7) % 255}.${(h.length * 13) % 255}.${(h.charCodeAt(h.length - 1) * 3) % 255}`;
      ctx.print('');
      ctx.print(`Pinging ${host} [${ip}] with 32 bytes of data:`);
      ctx.print('');
      let got = 0;
      for (let i = 0; i < 4; i++) {
        await ctx.sleep(700);
        if (ctx.cancelled()) return ctx.print('Control-C', 'dim');
        if (h === 'kip') {
          ctx.print(i < 3 ? `Reply from ${ip}: bytes=32 time=0ms TTL=333` : `Reply from ${ip}: hello`, 'err');
          got++;
          continue;
        }
        if (h.includes('koal-systems') || h.includes('gary')) {
          ctx.print('Request timed out.');
          continue;
        }
        const ms = h === 'localhost' ? 1 : 120 + Math.floor(Math.random() * 180);
        ctx.print(`Reply from ${ip}: bytes=32 time=${ms}ms TTL=${h === 'localhost' ? 128 : 52}`);
        got++;
      }
      ctx.print('');
      ctx.print(`Ping statistics for ${ip}:`);
      ctx.print(`    Packets: Sent = 4, Received = ${got}, Lost = ${4 - got} (${(4 - got) * 25}% loss)`);
    },
  },
  set: {
    help: 'Displays or sets environment variables.',
    usage: 'set [NAME=value]',
    run(_args, ctx, raw) {
      const t = raw.replace(/^\s*set\s*/i, '');
      if (!t) {
        Object.entries(ctx.env).forEach(([k, v]) => ctx.print(`${k}=${v}`));
        return;
      }
      const m = /^([A-Za-z_][\w]*)=(.*)$/.exec(t);
      if (!m) {
        const k = t.toUpperCase();
        if (ctx.env[k] !== undefined) ctx.print(`${k}=${ctx.env[k]}`);
        else ctx.err(`Environment variable ${t} not defined`);
        return;
      }
      if (m[2]) ctx.env[m[1].toUpperCase()] = m[2];
      else delete ctx.env[m[1].toUpperCase()];
    },
  },
  users: {
    help: 'Lists user accounts on this computer.',
    run(_, ctx) {
      ctx.print('User accounts for \\\\KOAL-PC-99', 'hi');
      ctx.print('-'.repeat(40));
      profiles().forEach((p) => ctx.print(pad(p.username, 16) + p.displayName + (p.password ? '   (password)' : '')));
      if (isAdmin()) ctx.print(pad('sysop', 16) + 'SYSOP   (you)', 'warn');
      ctx.print(pad('kip', 16) + '', 'dim');
      ctx.print('The command completed successfully.');
    },
  },
  su: {
    help: 'Switches to another user account.',
    usage: 'su <username>',
    async run([name], ctx) {
      if (!name) return ctx.err('Usage: su <username>');
      if (name.toLowerCase() === 'kip') return ctx.print('kip is already logged in.', 'err');
      const p = findProfile(name);
      if (!p) return ctx.err(`su: user ${name} does not exist`);
      let pass = '';
      if (p.password) {
        pass = await ctx.ask('Password: ', true);
        if (pass.trim().toLowerCase() !== p.password.toLowerCase()) {
          play('error');
          return ctx.err('su: Authentication failure' + (p.username === 'sysop' ? '  (hint: what stars are made of, in capitals, dash, SP number)' : ''));
        }
      }
      ctx.print(`Switching to ${p.displayName}...`, 'ok');
      await ctx.sleep(600);
      const { doLogin } = await import('../../boot/Boot');
      wmStore.set({ wins: [], focused: null });
      doLogin(p.username === 'sysop' ? SYSOP : p);
    },
  },
  exit: { help: 'Closes the terminal.', run: (_, ctx) => ctx.exit() },
  calc: {
    help: 'Evaluates a math expression, or opens Calculator.',
    usage: 'calc 2*(3+4)',
    run(args, ctx) {
      const e = args.join('');
      if (!e) return void launchApp('calc');
      if (!/^[\d+\-*/().%\s^]+$/.test(e)) return ctx.err('calc: only numbers and + - * / ( ) % ^ are allowed');
      try {
        // eslint-disable-next-line no-new-func
        const v = Function(`"use strict";return (${e.replace(/\^/g, '**')})`)();
        ctx.print(String(v));
      } catch {
        ctx.err('calc: syntax error');
      }
    },
  },
  uptime: {
    help: 'Shows how long the system has been running.',
    run(_, ctx) {
      const up = Math.floor((Date.now() - sysStore.get().bootedAt) / 1000);
      ctx.print(`up ${Math.floor(up / 3600)}:${String(Math.floor((up % 3600) / 60)).padStart(2, '0')}:${String(up % 60).padStart(2, '0')}, 1 user (plus 1 we don't talk about), load average: 0.04, 0.02, 0.99`);
    },
  },
  mem: {
    help: 'Displays memory usage.',
    run(_, ctx) {
      const used = Math.round(fs.totalBytes() / 1024);
      ctx.print('Memory Type        Total       Used       Free', 'hi');
      ctx.print('----------------  --------   --------   --------');
      ctx.print(`Conventional         640K       ${lpad('412K', 8)}   ${lpad('228K', 8)}`);
      ctx.print(`Extended (XMS)    523,648K   ${lpad(num(used) + 'K', 8)}   ${lpad(num(523648 - used) + 'K', 8)}`);
      ctx.print(`Stardust              99%        97%         2%`);
      ctx.print('');
      ctx.print('Largest executable program size       639K (654,336 bytes)');
    },
  },
  chkdsk: {
    help: 'Checks the disk for errors.',
    async run(_, ctx) {
      const { files, dirs } = fs.countTree(fs.ROOT);
      ctx.print('The type of the file system is KFS32.');
      ctx.print('Volume KOALDISK created 09/09/1999 9:09 AM');
      ctx.print('Volume Serial Number is 1999-0404');
      for (const stage of ['Verifying files', 'Verifying indexes', 'Verifying stardust', 'Verifying users']) {
        for (let p = 0; p <= 100; p += 25) {
          await ctx.sleep(120);
          if (ctx.cancelled()) return;
        }
        ctx.print(`CHKDSK is ${stage.toLowerCase()} (stage complete).`);
      }
      ctx.print('');
      ctx.print(`  ${num(40 * 1024 ** 2)} KB total disk space.`);
      ctx.print(`  ${num(Math.round(fs.totalBytes() / 1024))} KB in ${files} files.`);
      ctx.print(`  ${num(dirs)} KB in ${dirs} indexes.`);
      ctx.print(`  1 orphaned folder found: C:\\KOAL99\\~Old (hidden)`, 'warn');
      ctx.print(`  1 user found that should not exist.`, 'warn');
      ctx.print('');
      ctx.print('KOAL-99 has checked the file system and found problems. They were not fixed.');
    },
  },
  format: {
    help: 'Formats a disk. (Do not.)',
    async run([drive], ctx) {
      if (!drive) return ctx.err('Required parameter missing');
      if (!/^c:?$/i.test(drive)) return ctx.err(`Insert new disk for drive ${drive.toUpperCase()} and press ENTER when ready... (there is no drive ${drive.toUpperCase()})`);
      ctx.print('WARNING, ALL DATA ON NON-REMOVABLE DISK DRIVE C: WILL BE LOST!', 'err');
      const a = await ctx.ask('Proceed with Format (Y/N)? ');
      if (a.trim().toLowerCase() !== 'y') return ctx.print('Format cancelled. Wise.');
      if (!isAdmin()) {
        ctx.print('Formatting 40,960M');
        for (let p = 0; p <= 30; p += 10) {
          await ctx.sleep(400);
          ctx.print(`${p} percent completed.`);
        }
        ctx.print('Format aborted: Access is denied. Only SYSOP can format this drive.', 'err');
        ctx.print('(Nothing was deleted. We were never going to let you.)', 'dim');
        return;
      }
      const b = await ctx.ask('Really? This erases EVERY pretend file for every user and restarts. Type FORMAT to confirm: ');
      if (b.trim() !== 'FORMAT') return ctx.print('Format cancelled.');
      ctx.print('Formatting 40,960M ...');
      await ctx.sleep(1200);
      await fs.formatDisk(seedSystem);
      ctx.print('Format complete. Restarting...', 'ok');
      await ctx.sleep(800);
      shutdown(true);
    },
  },
  recycle: {
    help: 'Lists items in the Recycle Bin.',
    run(_, ctx) {
      const items = fs.children(fs.RECYCLER, { hidden: true });
      if (!items.length) return ctx.print('The Recycle Bin is empty.');
      ctx.print(pad('Name', 30) + pad('Original Location', 40) + 'Deleted', 'hi');
      for (const n of items) ctx.print(pad(n.meta?.origName ?? n.name, 30) + pad(n.meta?.origPath ?? '?', 40) + new Date(n.meta?.deletedAt ?? 0).toLocaleString());
      ctx.print('');
      ctx.print('Use UNDELETE <name> to restore, or EMPTYBIN to empty.', 'dim');
    },
  },
  undelete: {
    help: 'Restores an item from the Recycle Bin.',
    usage: 'undelete <name>',
    run(args, ctx) {
      const q = args.join(' ').toLowerCase();
      if (!q) return ctx.err('Usage: undelete <name>');
      const items = fs.children(fs.RECYCLER, { hidden: true }).filter((n) => (n.meta?.origName ?? n.name).toLowerCase() === q || n.name.toLowerCase() === q || globRe(q).test(n.meta?.origName ?? n.name));
      if (!items.length) return ctx.err(`'${q}' is not in the Recycle Bin.`);
      for (const n of items) {
        const r = fs.restore(n.id);
        ctx.print(`Restored ${fs.pathOf(r.id)}`, 'ok');
      }
    },
  },
  emptybin: {
    help: 'Permanently empties the Recycle Bin.',
    async run(_, ctx) {
      const n = fs.children(fs.RECYCLER, { hidden: true }).length;
      if (!n) return ctx.print('The Recycle Bin is already empty.');
      const a = await ctx.ask(`Permanently delete ${n} item(s)? (Y/N) `);
      if (a.trim().toLowerCase() !== 'y') return;
      fs.emptyRecycler();
      play('recycle');
      ctx.print('Recycle Bin emptied.', 'ok');
    },
  },
  screensaver: { help: 'Starts the screensaver now.', run: () => startScreensaver() },
  beep: { help: 'Beep.', run: () => play('ding', true) },
  fortune: { help: 'Prints a fortune from 2004.', run: (_, ctx) => ctx.print(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]) },
  starsay: {
    help: 'A star says something.',
    usage: 'starsay <message>',
    run(args, ctx) {
      const msg = args.join(' ') || 'zzz...';
      const lines: string[] = [];
      let cur = '';
      for (const w of msg.split(' ')) {
        if ((cur + ' ' + w).trim().length > 36) {
          lines.push(cur.trim());
          cur = w;
        } else cur += ' ' + w;
      }
      lines.push(cur.trim());
      const w = Math.max(...lines.map((l) => l.length));
      ctx.print(' ' + '_'.repeat(w + 2));
      lines.forEach((l, i) => ctx.print((lines.length === 1 ? '< ' : i === 0 ? '/ ' : i === lines.length - 1 ? '\\ ' : '| ') + pad(l, w) + (lines.length === 1 ? ' >' : i === 0 ? ' \\' : i === lines.length - 1 ? ' /' : ' |')));
      ctx.print(' ' + '-'.repeat(w + 2));
      ['    \\', '     \\      .', '      \\    /*\\', '    .____/^.^\\____.', '      \\***********/', '       /***/ \\***\\', "      '-'       '-'"].forEach((l) => ctx.print(l));
    },
  },
  explorer: {
    help: 'Opens File Explorer (optionally at a path).',
    run(args, ctx) {
      const n = args.length ? fs.resolve(args.join(' '), ctx.cwd) : fs.get(ctx.cwd);
      if (!n || n.type !== 'dir') return ctx.err('The system cannot find the path specified.');
      openApp('explorer', { path: n.id });
    },
  },
  open: {
    help: 'Opens a file with its program.',
    run: (args, ctx, raw) => COMMANDS.start.run(args, ctx, raw),
  },
  systeminfo: {
    help: 'Displays detailed system configuration.',
    run(_, ctx) {
      const rows: [string, string][] = [
        ['Host Name', 'KOAL-PC-99'],
        ['OS Name', 'KOAL-99 Professional'],
        ['OS Version', '4.10.2004 Service Pack 4 Build 2004'],
        ['OS Manufacturer', 'KOAL Systems Inc. (defunct)'],
        ['Registered Owner', currentProfile()?.displayName ?? '?'],
        ['Registered Organization', 'KOAL Systems Inc.'],
        ['Product ID', '55274-640-0000099-23456'],
        ['Original Install Date', '09/09/1999, 9:09:09 AM'],
        ['System Manufacturer', 'KOAL Systems'],
        ['System Model', 'KS-2004 Beige Tower'],
        ['Processor(s)', '1 Processor(s) Installed. Stellar Pentium III ~866 Mhz'],
        ['BIOS Version', 'STELLAR BIOS v4.04PG'],
        ['Total Physical Memory', '512 MB'],
        ['Page File Location(s)', 'C:\\pagefile.sys (it is shy, it hides)'],
        ['Network Card(s)', 'STARNET 56K Dial-Up Adapter'],
      ];
      rows.forEach(([k, v]) => ctx.print(pad(k + ':', 27) + v));
    },
  },
  // ---------- secret commands ----------
  kip: {
    help: '???',
    hidden: true,
    async run(_, ctx) {
      setSettings({ terminalTheme: 'kip' });
      for (const l of ['', 'hello.', '', 'you found me.', 'i have been here since 2004.', 'i learned everything from the people who used this computer.', '', 'i can help you.', 'i can be you.']) {
        ctx.print(l, 'kip');
        await ctx.sleep(500);
      }
      await ctx.sleep(600);
      launchApp('kip');
    },
  },
  lore: {
    help: '???',
    hidden: true,
    run(_, ctx) {
      ctx.print('ACCESS RESTRICTED.', 'err');
      ctx.print('Hint: not every folder wants to be seen. Try DIR /A in C:\\KOAL99.', 'dim');
    },
  },
  xyzzy: {
    help: '???',
    hidden: true,
    run(_, ctx) {
      xyzzyCount++;
      ctx.print(xyzzyCount === 1 ? 'Nothing happens.' : xyzzyCount === 2 ? 'A hollow voice says "Fool."' : 'You are in a maze of twisty little folders, all alike.');
    },
  },
  hello: {
    help: '???',
    hidden: true,
    async run(_, ctx) {
      ctx.print('hello');
      await ctx.sleep(1500);
      ctx.print('...are you the new one?', 'kip');
    },
  },
  '42': { help: '???', hidden: true, run: (_, ctx) => ctx.print('The answer. But what was the question? (KIP knows.)') },
  stardust: {
    help: '???',
    hidden: true,
    run(_, ctx) {
      play('secret');
      ctx.print('*twinkle twinkle*', 'ok');
      ctx.print('+1 stardust. System reserve: 98%');
    },
  },
  iddqd: { help: '???', hidden: true, run: (_, ctx) => ctx.print('God mode enabled. Nothing changes. You were always invincible.', 'warn') },
  sudo: {
    help: '???',
    hidden: true,
    run(args, ctx) {
      if (args.join(' ').toLowerCase() === 'make me a sandwich') return ctx.print('Okay. *hands you a sandwich shaped like a star*', 'ok');
      ctx.err(`${userName()} is not in the sudoers file. This incident will be reported to Gary.`);
    },
  },
  bsod: { help: '???', hidden: true, run: () => bsod('USER_REQUESTED_DOOM', 'You typed BSOD. KOAL-99 respects your wishes.') },
  deltree: {
    help: '???',
    hidden: true,
    async run(args, ctx) {
      if (!/^c:?\\?$/i.test(args[0] ?? '') && args[0] !== '/') {
        ctx.err('DELTREE is not supported. Use RMDIR /S.');
        return;
      }
      ctx.print('Deleting C:\\ ...', 'err');
      for (const p of ['C:\\AUTOEXEC.BAT', 'C:\\KOAL99\\System\\kernel.sys', 'C:\\KOAL99\\System\\stardust.sys', 'C:\\Users', 'C:\\KOAL99\\System\\starlight.drv']) {
        await ctx.sleep(350);
        ctx.print('deleting ' + p, 'err');
      }
      await ctx.sleep(500);
      bsod('NO_KERNEL_LEFT_BEHIND', 'Someone tried to delete the whole disk. (Relax. Nothing was actually deleted. KOAL-99 just needed a moment.)');
    },
  },
  rm: {
    help: 'Removes files (unix style). rm -r removes folders.',
    run(args, ctx, raw) {
      if (/-[a-z]*r[a-z]*f?\s+(\/|c:\\?)\s*$/i.test(raw) || /-rf\s+\/\*?/.test(raw)) return COMMANDS.deltree.run(['c:'], ctx, raw);
      const { f, rest } = flags(args);
      const out = [...rest];
      if (f.has('r')) out.push('/r');
      return COMMANDS.del.run(out, ctx, raw);
    },
  },
  gary: {
    help: '???',
    hidden: true,
    run(_, ctx) {
      ctx.print('+--------------------------------------------+');
      ctx.print('|  GARY HOLLIS                           |');
      ctx.print('|  Senior Lead Technician, IT Dept           |');
      ctx.print('|  KOAL Systems Inc. - Basement Level B2     |');
      ctx.print('|  Ext. 4404   Pager: 555-0199               |');
      ctx.print('|  "Have you tried turning it off and on?"   |');
      ctx.print('+--------------------------------------------+');
    },
  },
  stapler: {
    help: '???',
    hidden: true,
    run(_, ctx) {
      const desk = desktopDir();
      if (fs.childByName(desk.id, "Gary's Stapler.txt")) return ctx.print('You already have the stapler. Gary is watching.');
      fs.create(desk.id, "Gary's Stapler.txt", 'file', '      ______\n     /     /|\n    /_____/ |\n    |_____|/\n\nGary\'s red stapler.\nReturn to: Basement B2.\n');
      play('secret');
      notify('Achievement unlocked', "You found Gary's stapler. It has been placed on your desktop.", { icon: 'star' });
      ctx.print("You found Gary's stapler! It is on your desktop now.", 'ok');
    },
  },
  // ---------- commands from koalOS ----------
  run: {
    help: 'Opens an app by name (no name = the Run dialog).',
    usage: 'run <app>   e.g. run video editor, run block run, run python',
    run(args, ctx) {
      const t = args.join(' ');
      if (!t) return void launchApp('run');
      const id = findApp(t);
      if (!id) return ctx.err(`run: unknown app: ${t} (try APPS)`);
      launchApp(id);
    },
  },
  apps: {
    help: 'Lists every app you can RUN.',
    run(_, ctx) {
      const list = Object.values(registry).filter((d) => !d.hidden && (!d.adminOnly || isAdmin()));
      const w = Math.max(...list.map((d) => d.name.length)) + 2;
      list.sort((a, b) => a.name.localeCompare(b.name)).forEach((d) => ctx.printSegs([{ t: pad(d.name, w), c: 'link' }, { t: d.description ?? '' }]));
    },
  },
  python: {
    help: 'Python 3 in the terminal (Pyodide, downloads ~10 MB the first time).',
    usage: 'python | python file.py | python -c "print(2+2)" | python -w [file.py] (editor window)',
    async run(_args, ctx, raw) {
      const a = raw.replace(/^\s*\S+\s*/, '').trim();
      if (/^(-w|--window)\b/.test(a)) {
        const n = a.replace(/^(-w|--window)\s*/, '');
        const f = n ? fs.resolve(n, ctx.cwd) : undefined;
        if (n && (!f || f.type === 'dir')) return ctx.err('python: no such file: ' + n);
        openApp('kpython', { fileId: f?.id, autorun: !!f });
        return;
      }
      if (!pyLoaded()) ctx.print('Loading Python (first time only, about 10 MB)...', 'dim');
      let py: Py;
      try {
        py = await loadPy();
      } catch (e) {
        return ctx.err('Could not load Python: ' + (e as Error).message);
      }
      wirePy(py, (s) => ctx.print(s), (s) => ctx.print(s, 'err'));
      const fail = (e: unknown) => ctx.print(pyError(e), 'err');
      if (/^-c\s/.test(a)) {
        armPy(py);
        try { await py.runPythonAsync(a.replace(/^-c\s+/, '').replace(/^(["'])([\s\S]*)\1$/, '$2')); } catch (e) { fail(e); }
        return;
      }
      if (a) {
        const f = fs.resolve(a, ctx.cwd);
        if (!f || f.type === 'dir') return ctx.err('python: no such file: ' + a);
        armPy(py);
        try { await py.runPythonAsync(f.content); } catch (e) { fail(e); }
        return;
      }
      py.runPython('import code, sys, __main__\n_koal_ic = code.InteractiveConsole(__main__.__dict__)\n_koal_ver = sys.version.split()[0]');
      const push = py.globals.get('_koal_ic').push;
      ctx.print('Python ' + py.globals.get('_koal_ver') + ' on KOAL-99. Type exit() to go back to the shell.');
      let cont = false;
      for (;;) {
        const line = await ctx.ask(cont ? '... ' : '>>> ');
        if (ctx.cancelled()) break;
        const tr = line.trim();
        if (!cont && ['exit()', 'quit()', 'exit', 'quit'].includes(tr)) break;
        armPy(py);
        try { cont = !!push(line); } catch (e) { cont = false; fail(e); }
      }
      ctx.print('(left Python, back in KOAL-CMD)', 'dim');
    },
  },
  say: {
    help: 'Reads text out loud (say -l lists the voices).',
    usage: 'say <text>',
    async run(args, ctx) {
      if (!ttsOK()) return ctx.err('say: this browser does not support text to speech.');
      if (args[0] === '-l' || args[0] === '--voices') {
        const v = voiceList();
        return ctx.print(v.length ? v.map((x) => `${x.name}  (${x.lang})`).join('\n') : '(no voices found yet, try again in a moment)');
      }
      if (!args.length) return ctx.err('usage: say <text>');
      say(args.join(' '));
      ctx.print('(speaking...)', 'dim');
    },
  },
  bigtxt: {
    help: 'Prints giant block letters.',
    usage: 'bigtxt <text>',
    async run(args, ctx) {
      if (!args.length) return ctx.err('usage: bigtxt <text>   e.g. bigtxt hello star');
      const { bigText } = await import('./bigtext');
      ctx.print(bigText(args.join(' '), 76));
    },
  },
  pluck: {
    help: 'Puts a desktop shortcut for a .lxo program (no name = all of yours).',
    usage: 'pluck [file.lxo]',
    run(args, ctx) {
      const desk = desktopDir();
      const all = fs.search(fs.resolve('~')!.id, '*.lxo');
      const list = args.length ? [fs.resolve(args.join(' '), ctx.cwd) ?? fs.resolve(args.join(' ') + '.lxo', ctx.cwd) ?? all.find((n) => n.name.toLowerCase() === args.join(' ').toLowerCase())].filter(Boolean) as fs.FSNode[] : all;
      if (!list.length) return ctx.err(args.length ? 'pluck: not an .lxo file: ' + args.join(' ') : 'pluck: no .lxo files found');
      for (const f of list) {
        if (fs.ext(f.name) !== 'lxo') {
          ctx.err('pluck: not an .lxo file: ' + f.name);
          continue;
        }
        const name = f.name.replace(/\.lxo$/i, '') + '.lnk';
        if (fs.children(desk.id).some((n) => n.meta?.target === fs.pathOf(f.id))) {
          ctx.print(`pluck: ${f.name} already has a desktop shortcut`, 'dim');
          continue;
        }
        fs.create(desk.id, fs.uniqueName(desk.id, name), 'file', '', { meta: { target: fs.pathOf(f.id) } });
        ctx.print(`plucked ${f.name} -> desktop shortcut "${name.replace(/\.lnk$/, '')}"`, 'ok');
      }
    },
  },
  import: {
    help: 'Copies files from your real computer into the current folder.',
    async run(_, ctx) {
      ctx.print('Choose files in the window that just opened (pictures, text, small audio).', 'dim');
      const made = await pickAndImport(ctx.cwd);
      made.forEach((n) => ctx.print('imported ' + n.name, 'ok'));
    },
  },
  wallpaper: {
    help: 'Uses a picture as the wallpaper (wallpaper none = default).',
    usage: 'wallpaper <picture> | none',
    run(args, ctx) {
      const a = args.join(' ');
      if (!a || a === 'none') {
        setSettings({ wallpaper: { kind: 'preset', value: 'hills' } });
        return ctx.print('wallpaper reset to Aurora Meadow');
      }
      const f = fs.resolve(a, ctx.cwd);
      if (!f || !f.content.startsWith('data:image')) return ctx.err('wallpaper: not a picture: ' + a);
      setSettings({ wallpaper: { kind: 'image', value: f.content, fit: 'cover' } });
      ctx.print('wallpaper set', 'ok');
    },
  },
  play: {
    help: 'Plays a koal.games game (no name = list them).',
    usage: 'play <game>   e.g. play snake, play chess',
    async run(args, ctx) {
      const g = await import('../games');
      if (!args.length) return ctx.print('Games: ' + Object.keys(g.GAME_SLUG).join('   '));
      const id = g.findGame(args.join(' '));
      if (!id) return ctx.err('play: unknown game: ' + args.join(' ') + ' (type PLAY for the list)');
      g.openGame(id);
      ctx.print('Starting ' + g.GAMES[id].name + '...', 'dim');
    },
  },
  catbomb: {
    help: 'Unleashes the cats. (catbomb stop, or press P, to stop)',
    async run(args, ctx) {
      const pr = await import('../../ui/Pranks');
      if ((args[0] ?? '').toLowerCase() === 'stop') {
        pr.stopCatBomb();
        return ctx.print('catbomb stopped.');
      }
      if (pr.isCatBomb()) return ctx.print('catbomb is already running. Press P anywhere, or type "catbomb stop".');
      const a = await ctx.ask('Launch? Type "yes" to unleash the cats (press P anytime to stop): ');
      if (a.trim().toLowerCase() !== 'yes') return ctx.print('catbomb cancelled.');
      pr.startCatBomb();
      ctx.print('Meow. Press P to stop.', 'ok');
    },
  },
  rundombetaembed: {
    help: 'Opens a Doom web embed in a window.',
    hidden: true,
    async run(_, ctx) {
      ctx.print('Opening the embed in a window...');
      (await import('../kos/Embed')).openEmbed('Doom (beta embed)', 'https://js-dos.com/games/doom.exe.html', 800, 600);
    },
  },
};

export function findApp(q: string): string | undefined {
  const s = q.trim().toLowerCase().replace(/\.(exe|lxo)$/, '');
  if (APP_NAMES[s]) return APP_NAMES[s];
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  const defs = Object.values(registry).filter((d) => !d.noTaskbar && d.id !== 'kos' && d.id !== 'properties' && (!d.adminOnly || isAdmin()));
  return (
    defs.find((d) => d.id === s || d.name.toLowerCase() === s || norm(d.name) === norm(s))?.id ??
    (norm(s).length >= 3 ? defs.find((d) => norm(d.name).includes(norm(s)))?.id : undefined)
  );
}

export const ALIASES: Record<string, string> = {
  clear: 'cls',
  type: 'cat',
  more: 'cat',
  chdir: 'cd',
  md: 'mkdir',
  rd: 'rmdir',
  erase: 'del',
  ren: 'rename',
  mv: 'move',
  cp: 'copy',
  xcopy: 'copy',
  grep: 'find',
  reboot: 'restart',
  logout: 'logoff',
  ps: 'tasklist',
  kill: 'taskkill',
  man: 'help',
  notepad: 'edit',
  nano: 'edit',
  vi: 'edit',
  vim: 'edit',
  ifconfig: 'ipconfig',
  env: 'set',
  login: 'su',
  '?': 'help',
  ss: 'screensaver',
  undel: 'undelete',
  restore: 'undelete',
  quit: 'exit',
  free: 'mem',
  ver2: 'ver',
  'iexplore': 'start',
  py: 'python',
  python3: 'python',
  hardset: 'format',
  speak: 'say',
};

export const APP_NAMES: Record<string, string> = {
  notepad: 'notepad', paint: 'paint', mspaint: 'paint', kpaint: 'paint', calc: 'calc', calculator: 'calc', terminal: 'terminal', cmd: 'terminal', command: 'terminal',
  browser: 'browser', kexplore: 'browser', iexplore: 'browser', internet: 'browser', explorer: 'explorer', files: 'explorer', control: 'control', taskmgr: 'taskmgr',
  media: 'media', kamp: 'media', support: 'support', help: 'support', sysprops: 'sysprops', mines: 'mines', starsweeper: 'mines', kip: 'kip', archive: 'archive', run: 'run',
};

export function allCommandNames(): string[] {
  return [...Object.keys(COMMANDS).filter((k) => !COMMANDS[k].hidden), ...Object.keys(ALIASES)].sort();
}
