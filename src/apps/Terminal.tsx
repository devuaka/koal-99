import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { WinCtx } from '../core/registry';
import * as fs from '../core/fs';
import { COMMANDS, ALIASES, APP_NAMES, TERM_THEMES, allCommandNames, Line, Seg, TermCtx } from './terminal/commands';
import { useSettings, settingsStore } from '../core/settings';
import { homeDir, userName } from '../core/session';
import { launchApp, openNode } from '../core/launcher';
import { close } from '../core/wm';
import { isAdmin } from '../core/system';

type Tok = { v: string; op?: boolean; quoted?: boolean; raw?: string };

function tokenize(line: string): Tok[] {
  const out: Tok[] = [];
  let cur = '';
  let raw = '';
  let q = false;
  let had = false;
  let quoted = false;
  const push = () => {
    if (cur || had) out.push({ v: cur, quoted, raw });
    cur = '';
    raw = '';
    had = false;
    quoted = false;
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      q = !q;
      had = true;
      quoted = true;
      raw += ch;
      continue;
    }
    if (!q && !/\s/.test(ch) && ch !== '|' && ch !== '>' && !(ch === '&' && line[i + 1] === '&')) raw += ch;
    else if (q) raw += ch;
    if (!q) {
      if (/\s/.test(ch)) {
        push();
        continue;
      }
      if (ch === '|' || ch === '>' || (ch === '&' && line[i + 1] === '&')) {
        push();
        if (ch === '>' && line[i + 1] === '>') (out.push({ v: '>>', op: true }), i++);
        else if (ch === '&') (out.push({ v: '&&', op: true }), i++);
        else out.push({ v: ch, op: true });
        continue;
      }
    }
    cur += ch;
  }
  push();
  return out;
}

function histKey() {
  return 'koal99.termhist.' + userName();
}

function themeColors(t: string): { fg: string; bg: string } {
  if (t.startsWith('dos:')) {
    const [, fg, bg] = t.split(':');
    return { fg, bg };
  }
  return TERM_THEMES[t] ?? TERM_THEMES.classic;
}

const BANNER: Line[] = [
  [{ t: 'KOAL-99 [Version 4.10.2004 SP4]', c: 'hi' }],
  [{ t: '(C) Copyright 1999-2004 KOAL Systems Inc.' }],
  [{ t: 'Type HELP for a list of commands.', c: 'dim' }],
  [],
];

export function Terminal({ win }: { win: WinCtx }) {
  const settings = useSettings();
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [cwd, setCwdState] = useState<string>(() => (win.props.cwd && fs.get(win.props.cwd) ? win.props.cwd : homeDir().id));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<{ prompt: string; masked: boolean; resolve: (s: string) => void } | null>(null);
  const [matrixOn, setMatrixOn] = useState<null | (() => void)>(null);
  const history = useRef<string[]>((() => { try { return JSON.parse(localStorage.getItem(histKey()) ?? '[]'); } catch { return []; } })());
  const hIdx = useRef(-1);
  const cancel = useRef(false);
  const cwdRef = useRef(cwd);
  const env = useRef<Record<string, string>>({ USERNAME: userName(), COMPUTERNAME: 'KOAL-PC-99', OS: 'KOAL-99', PROMPT: '$P$G', PATH: 'C:\\KOAL99;C:\\Program Files\\KOAL Systems', STARS: 'BRIGHT' });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  fs.fsStore.use((s) => s.version);

  const setCwd = (id: string) => {
    cwdRef.current = id;
    setCwdState(id);
  };

  useEffect(() => {
    if (!fs.get(cwd)) setCwd(homeDir().id);
  });

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, busy, asking]);

  useEffect(() => {
    if (win.focused) inputRef.current?.focus();
  }, [win.focused, busy, asking]);

  const pathStr = fs.pathOf(cwd);
  useEffect(() => {
    win.setTitle(isAdmin() ? `SYSOP - ${pathStr}` : `Terminal - ${pathStr}`);
  }, [pathStr]);

  const append = (ls: Line[]) => setLines((prev) => {
    const next = [...prev, ...ls];
    return next.length > 1500 ? next.slice(next.length - 1500) : next;
  });

  const makeCtx = (capture: string[] | null, stdin: string[] | null): TermCtx => ({
    print(text = '', cls) {
      const parts = String(text).split('\n');
      if (capture) capture.push(...parts);
      else append(parts.map((p) => [{ t: p, c: cls }]));
    },
    printSegs(segs: Seg[]) {
      if (capture) capture.push(segs.map((s) => s.t).join(''));
      else append([segs]);
    },
    err(text: string) {
      append(String(text).split('\n').map((p) => [{ t: p, c: 'err' }]));
    },
    get cwd() {
      return cwdRef.current;
    },
    setCwd,
    clear: () => setLines([]),
    ask: (prompt, masked = false) => new Promise<string>((resolve) => setAsking({ prompt, masked, resolve })),
    sleep: (ms) => new Promise((r) => window.setTimeout(r, ms)),
    cancelled: () => cancel.current,
    matrix: () => new Promise<void>((resolve) => setMatrixOn(() => resolve)),
    exit: () => close(win.id),
    setColors: () => {},
    history: history.current,
    stdin,
    env: env.current,
    winId: win.id,
  });

  async function runSimple(toks: Tok[], capture: string[] | null, stdin: string[] | null, depth = 0): Promise<void> {
    if (!toks.length) return;
    const name = toks[0].v;
    const args = toks.slice(1).map((t) => t.v);
    const raw = toks.map((t) => t.raw ?? t.v).join(' ');
    const lower = name.toLowerCase();
    const ctx = makeCtx(capture, stdin);
    // cd.. and cd\ shortcuts
    if (/^cd(\.\.|\\)$/i.test(name)) return COMMANDS.cd.run([name.slice(2)], ctx, raw);
    if (/^[a-z]:$/i.test(name)) {
      if (lower !== 'c:') return ctx.err('The device is not ready.' + (lower === 'a:' ? ' (Please insert a disk into drive A:)' : ''));
      return setCwd(fs.ROOT);
    }
    const cmd = COMMANDS[lower] ?? COMMANDS[ALIASES[lower] ?? ''];
    if (cmd) {
      if (ALIASES[lower] === 'start' && lower === 'iexplore') return void launchApp('browser', { url: args[0] });
      if (ALIASES[lower] === 'edit' && !args.length && lower === 'notepad') return void launchApp('notepad');
      return cmd.run(args, ctx, raw);
    }
    if (APP_NAMES[lower.replace(/\.exe$/, '')]) {
      launchApp(APP_NAMES[lower.replace(/\.exe$/, '')], args[0] ? { url: args[0] } : {});
      return;
    }
    // run a file from the cwd or PATH
    const candidates = [name, name + '.exe', name + '.bat', name + '.lnk'];
    for (const c of candidates) {
      const n = fs.resolve(c, cwdRef.current) ?? fs.resolve('C:\\Program Files\\KOAL Systems\\' + c);
      if (n && n.type === 'file') {
        if (fs.ext(n.name) === 'bat') {
          if (depth > 4) return ctx.err('Batch nesting too deep.');
          for (const l of n.content.split(/\r?\n/)) {
            const t = l.trim();
            if (!t || /^(rem|::)/i.test(t) || /^@?echo off$/i.test(t)) continue;
            if (cancel.current) return;
            await runLine(t.replace(/^@/, ''), true, depth + 1);
          }
          return;
        }
        openNode(n);
        return;
      }
    }
    ctx.err(`'${name}' is not recognized as an internal or external command,\noperable program or batch file.`);
  }

  async function runLine(line: string, quiet = false, depth = 0) {
    const expanded = line.replace(/%([A-Za-z_]+)%/g, (m, k) => env.current[k.toUpperCase()] ?? m);
    const toks = tokenize(expanded);
    const chains: Tok[][] = [[]];
    for (const t of toks) {
      if (t.op && t.v === '&&') chains.push([]);
      else chains[chains.length - 1].push(t);
    }
    for (const chain of chains) {
      if (cancel.current) return;
      const stages: Tok[][] = [[]];
      let redirect: { file: string; append: boolean } | null = null;
      for (let i = 0; i < chain.length; i++) {
        const t = chain[i];
        if (t.op && t.v === '|') stages.push([]);
        else if (t.op && (t.v === '>' || t.v === '>>')) {
          const f = chain[i + 1];
          if (!f) {
            append([[{ t: 'The syntax of the command is incorrect.', c: 'err' }]]);
            return;
          }
          redirect = { file: f.v, append: t.v === '>>' };
          i++;
        } else stages[stages.length - 1].push(t);
      }
      let stdin: string[] | null = null;
      try {
        for (let s = 0; s < stages.length; s++) {
          const last = s === stages.length - 1;
          const cap = !last || redirect ? [] : null;
          await runSimple(stages[s], cap, stdin, depth);
          stdin = cap;
        }
        if (redirect && stdin) {
          const text = stdin.join('\r\n') + (stdin.length ? '\r\n' : '');
          const existing = fs.resolve(redirect.file, cwdRef.current);
          if (existing && existing.type === 'dir') throw new fs.FSError('Access is denied.');
          fs.writePath(redirect.file, redirect.append && existing ? existing.content + text : text, cwdRef.current);
        }
      } catch (e) {
        append([[{ t: (e as Error).message || String(e), c: 'err' }]]);
        if (!quiet) return;
      }
    }
  }

  const submit = async () => {
    const line = input;
    setInput('');
    hIdx.current = -1;
    append([[{ t: fs.pathOf(cwdRef.current) + '>', c: 'prompt' }, { t: line }]]);
    if (!line.trim()) return;
    if (history.current[history.current.length - 1] !== line) {
      history.current.push(line);
      if (history.current.length > 200) history.current.shift();
      try {
        localStorage.setItem(histKey(), JSON.stringify(history.current));
      } catch {
        /* ignore */
      }
    }
    cancel.current = false;
    setBusy(true);
    try {
      await runLine(line);
    } finally {
      setBusy(false);
      append([[]]);
    }
  };

  const complete = () => {
    const hidden = settingsStore.get().settings.showHidden;
    const pathOptions = (partial: string) => {
      const i = Math.max(partial.lastIndexOf('\\'), partial.lastIndexOf('/'));
      const b = i >= 0 ? partial.slice(0, i + 1) : '';
      const pre = (i >= 0 ? partial.slice(i + 1) : partial).toLowerCase();
      const dir = fs.resolve(b || '.', cwdRef.current);
      if (!dir || dir.type !== 'dir') return null;
      const opts = fs.children(dir.id, { hidden }).filter((n) => n.name.toLowerCase().startsWith(pre)).map((n) => n.name + (n.type === 'dir' ? '\\' : ''));
      return opts.length ? { base: b, opts } : null;
    };
    let before = '';
    let partial = '';
    let options: string[] = [];
    let base = '';
    const isFirst = !/\s/.test(input.trimStart());
    if (isFirst && !/[\\/]/.test(input)) {
      partial = input.trimStart();
      options = [...new Set([...allCommandNames(), ...Object.keys(APP_NAMES)].filter((c) => c.startsWith(partial.toLowerCase())))];
    } else {
      // Paths may contain spaces ("My Documents"), so try every split point after the command,
      // leftmost first, and use the first one that matches something on disk.
      const quoteAt = (input.match(/"/g) ?? []).length % 2 === 1 ? input.lastIndexOf('"') : -1;
      const starts: number[] = [];
      if (quoteAt >= 0) starts.push(quoteAt + 1);
      else for (let i = input.indexOf(' ') + 1; i > 0 && i <= input.length; i++) if (input[i - 1] === ' ' && input[i] !== ' ') starts.push(i);
      if (!starts.length) starts.push(input.length);
      for (const s of starts) {
        const r = pathOptions(input.slice(s));
        if (r) {
          before = input.slice(0, quoteAt >= 0 ? quoteAt : s);
          partial = input.slice(s);
          options = r.opts;
          base = r.base;
          break;
        }
      }
    }
    if (!options.length) return;
    const quote = (s: string) => (/\s/.test(s) ? `"${s}` + (s.endsWith('\\') ? '' : '"') : s);
    if (options.length === 1) {
      const full = base + options[0];
      setInput(before + quote(full) + (full.endsWith('\\') || !isFirst ? '' : ' '));
      return;
    }
    let common = options[0];
    for (const o of options) while (!o.toLowerCase().startsWith(common.toLowerCase())) common = common.slice(0, -1);
    if (common.length > (partial.length - base.length)) setInput(before + quote(base + common));
    append([[{ t: fs.pathOf(cwdRef.current) + '>', c: 'prompt' }, { t: input }], [{ t: options.join('   '), c: 'dim' }]]);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      if (busy || asking) {
        cancel.current = true;
        if (asking) {
          asking.resolve('');
          setAsking(null);
        }
        append([[{ t: '^C', c: 'dim' }]]);
        e.preventDefault();
      } else if (!window.getSelection()?.toString()) {
        append([[{ t: fs.pathOf(cwdRef.current) + '>', c: 'prompt' }, { t: input + '^C' }]]);
        setInput('');
      }
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setLines([]);
      return;
    }
    if (asking) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = input;
        setInput('');
        append([[{ t: asking.prompt }, { t: asking.masked ? '*'.repeat(v.length) : v }]]);
        asking.resolve(v);
        setAsking(null);
      }
      return;
    }
    if (busy) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    else if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const h = history.current;
      if (!h.length) return;
      hIdx.current = hIdx.current < 0 ? h.length - 1 : Math.max(0, hIdx.current - 1);
      setInput(h[hIdx.current]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const h = history.current;
      if (hIdx.current < 0) return;
      hIdx.current++;
      if (hIdx.current >= h.length) {
        hIdx.current = -1;
        setInput('');
      } else setInput(h[hIdx.current]);
    } else if (e.key === 'Escape') setInput('');
  };

  // .lxo programs: run each line as a command, then hand the prompt back
  const scriptRan = useRef(false);
  useEffect(() => {
    const script = win.props.script as string | undefined;
    if (scriptRan.current || script === undefined) return;
    scriptRan.current = true;
    (async () => {
      setBusy(true);
      append([[{ t: `[lxo] running ${win.props.label ?? 'script'}`, c: 'dim' }], []]);
      for (const l of script.split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('#'))) {
        if (cancel.current) break;
        append([[{ t: fs.pathOf(cwdRef.current) + '>', c: 'prompt' }, { t: l }]]);
        await runLine(l, true);
      }
      append([[{ t: '[lxo] finished.', c: 'dim' }], []]);
      setBusy(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { fg, bg } = themeColors(settings.terminalTheme);

  return (
    <div className={`term term-${settings.terminalTheme.startsWith('dos:') ? 'dos' : settings.terminalTheme}`} style={{ color: fg, background: bg }} onMouseUp={() => !window.getSelection()?.toString() && inputRef.current?.focus()}>
      <div className="term-scroll" ref={scrollRef}>
        {lines.map((l, i) => (
          <div key={i} className="term-line">
            {l.length ? l.map((s, j) => (s.c?.startsWith('bg:') ? <span key={j} style={{ background: s.c.slice(3) }}>{s.t}</span> : <span key={j} className={s.c ? 't-' + s.c : undefined}>{s.t}</span>)) : '\u00a0'}
          </div>
        ))}
        {(!busy || asking) && (
          <div className="term-line term-input">
            <span className="t-prompt">{asking ? asking.prompt : pathStr + '>'}</span>
            <input
              ref={inputRef}
              className="term-input-el"
              style={{ color: fg, caretColor: fg }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              spellCheck={false}
              autoComplete="off"
              type={asking?.masked ? 'password' : 'text'}
            />
          </div>
        )}
        {busy && !asking && (
          <input ref={inputRef} className="term-hidden-input" value="" onChange={() => {}} onKeyDown={onKey} />
        )}
      </div>
      {matrixOn && <MatrixRain onDone={() => { const r = matrixOn; setMatrixOn(null); r(); }} />}
    </div>
  );
}

function MatrixRain({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width;
    c.height = r.height;
    const g = c.getContext('2d')!;
    const size = 14;
    const drops = Array.from({ length: Math.ceil(c.width / size) }, () => Math.random() * -40);
    const glyphs = '\u30A2\u30A4\u30A6\u30A8\u30AA\u30AB\u30AD\u30AF\u30B1\u30B3\u30B5\u30B7\u30B9\u30BB\u30BD0123456789KOAL';
    const msg = 'FOLLOW THE STAR...';
    let frame = 0;
    let raf = 0;
    const loop = () => {
      frame++;
      g.fillStyle = 'rgba(0,0,0,0.07)';
      g.fillRect(0, 0, c.width, c.height);
      g.font = size + 'px monospace';
      drops.forEach((d, i) => {
        g.fillStyle = Math.random() < 0.04 ? '#dfd' : '#1f1';
        g.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], i * size, d * size);
        if (d * size > c.height && Math.random() > 0.97) drops[i] = 0;
        drops[i] += 0.6;
      });
      if (frame > 120) {
        g.fillStyle = '#000';
        g.fillRect(c.width / 2 - 110, c.height / 2 - 18, 220, 30);
        g.fillStyle = '#5f5';
        g.font = 'bold 16px monospace';
        g.fillText(msg.slice(0, Math.floor((frame - 120) / 4)), c.width / 2 - 95, c.height / 2 + 3);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const stop = () => onDone();
    const t = window.setTimeout(() => {
      window.addEventListener('keydown', stop, { once: true });
      window.addEventListener('pointerdown', stop, { once: true });
    }, 300);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      window.removeEventListener('keydown', stop);
      window.removeEventListener('pointerdown', stop);
    };
  }, [onDone]);
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000' }} title="Press any key" />;
}
