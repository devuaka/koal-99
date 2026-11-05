import * as fs from './fs';
import { openApp } from './wm';
import { alertBox, choiceBox, errorBox } from './dialog';
import { isAdmin } from './system';
import { registry } from './registry';
import { clipStore } from './menu';
import { play } from './sound';
import { notify } from './notify';

export const TEXT_EXT = ['txt', 'log', 'ini', 'bat', 'cfg', 'md', 'nfo', 'csv', 'json', 'sys', 'diz', 'me', 'js', 'css', 'reg', 'tkt'];
export const IMAGE_EXT = ['bmp', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'kpx', 'pice'];
/** Photos open in the Picture Viewer; .kpx drawings open in StarPaint. */
export const PHOTO_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];

/** koalOS .lxo programs: a Reelcod app, a list of run/play lines, or terminal commands. */
export function runLxo(node: fs.FSNode) {
  Promise.all([import('./reelcod'), import('../apps/kos/Reelcod'), import('../apps/games')]).then(async ([rc, ui, games]) => {
    const text = node.content ?? '';
    const reel = rc.rcParse(text);
    if (reel) return ui.runReel(reel);
    if (/^\s*#cuberun-level/.test(text)) return games.openGame('cuberun', { level: text });
    const lines = text.split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('#'));
    if (lines.length && lines.every((l) => /^(run|start|play)\s+\S/i.test(l))) {
      const { findApp } = await import('../apps/terminal/commands');
      const bad: string[] = [];
      for (const l of lines) {
        const verb = l.split(/\s+/)[0].toLowerCase();
        const n = l.replace(/^\S+\s+/, '').toLowerCase();
        if (verb === 'play') {
          const gid = games.GAME_SLUG[n.replace(/\s+/g, '-')];
          if (gid) games.openGame(gid);
          else bad.push(n);
          continue;
        }
        const id = findApp(n);
        if (id) launchApp(id);
        else bad.push(n);
      }
      if (bad.length) notify('lxo', 'Unknown app: ' + bad.join(', '), { icon: 'warning' });
      return;
    }
    openApp('terminal', { script: text, label: node.name, cwd: node.parent ?? undefined });
  });
}
export const AUDIO_EXT = ['wav', 'mp3', 'ogg', 'mid'];
export const WEB_EXT = ['htm', 'html', 'url'];

export function launchApp(appId: string, args: Record<string, unknown> = {}): boolean {
  const def = registry[appId];
  if (!def) {
    errorBox(`Windows... er, KOAL-99 cannot find '${appId}'. Make sure you typed the name correctly, and then try again.`, appId);
    return false;
  }
  if (def.adminOnly && !isAdmin()) {
    errorBox(`${def.name} requires SYSOP privileges.\n\nYour access attempt has been logged and will be reviewed by nobody.`, 'Access Denied');
    return false;
  }
  if (def.run) {
    def.run(args);
    return true;
  }
  openApp(appId, args);
  return true;
}

export function openNode(node: fs.FSNode | undefined, opts: { with?: string } = {}) {
  if (!node) return;
  if (fs.inRecycler(node.id)) {
    alertBox(`"${node.meta?.origName ?? node.name}" is in the Recycle Bin. Restore it before opening it.`, 'Recycle Bin', 'warning');
    return;
  }
  if (node.type === 'dir') {
    openApp('explorer', { path: node.id });
    return;
  }
  if (node.meta?.adminOnly && !isAdmin()) {
    errorBox('Access is denied.\n\nThis file belongs to SYSOP.', node.name);
    return;
  }
  if (node.meta?.corrupt) {
    openCorrupt(node);
    return;
  }
  const e = fs.ext(node.name);
  if (opts.with) {
    openApp(opts.with, { fileId: node.id });
    return;
  }
  if (e === 'lnk') {
    if (node.meta?.app) launchApp(node.meta.app, node.meta.args ?? {});
    else if (node.meta?.target) {
      const t = fs.resolve(node.meta.target);
      if (!t) errorBox(`The item '${node.meta.target}' that this shortcut refers to has been changed or moved, so this shortcut will no longer work properly.`, 'Problem with Shortcut', );
      else openNode(t);
    }
    return;
  }
  if (e === 'exe' || e === 'com') {
    if (node.meta?.app) launchApp(node.meta.app, node.meta.args ?? {});
    else errorBox(`${node.name} is not a valid KOAL-99 application.`, node.name);
    return;
  }
  if (e === 'lxo') return void runLxo(node);
  if (e === 'py') return void openApp('kpython', { fileId: node.id });
  if (e === 'k3d') return void openApp('kmodeler', { fileId: node.id });
  if (e === 'pice') return void openApp('paint', { fileId: node.id, pixel: true });
  if (PHOTO_EXT.includes(e) && node.content.startsWith('data:image')) return void openApp('imageviewer', { fileId: node.id });
  if (TEXT_EXT.includes(e)) return void openApp('notepad', { fileId: node.id });
  if (IMAGE_EXT.includes(e)) return void openApp('paint', { fileId: node.id });
  if (AUDIO_EXT.includes(e)) return void openApp('media', { fileId: node.id });
  if (e === 'url') return void openApp('browser', { url: node.content.replace(/^\[InternetShortcut\]\s*URL=/i, '').trim() });
  if (e === 'htm' || e === 'html') return void openApp('browser', { url: 'file:' + fs.pathOf(node.id) });
  choiceBox(`KOAL-99 cannot open this file:\n\nFile: ${node.name}\n\nTo open this file, KOAL-99 needs to know what program created it.`, ['Open with Notepad', 'Open with Paint', 'Cancel'], 'Open With', 'question').then((i) => {
    if (i === 0) openApp('notepad', { fileId: node.id });
    if (i === 1) openApp('paint', { fileId: node.id });
  });
}

function openCorrupt(node: fs.FSNode) {
  play('error');
  const lines = [
    `The file or directory ${node.name} is corrupted and unreadable.\n\nPlease run Chkdsk.`,
    `${node.name}\n\nThis file was last modified by a user who does not exist.`,
    `Cannot open ${node.name}: the file is already open by another program.\n\nProgram: KIP.EXE`,
  ];
  const msg = lines[Math.floor(Math.random() * lines.length)];
  errorBox(msg, 'Corrupted File').then(() => {
    if (Math.random() < 0.5) openApp('notepad', { fileId: node.id, _forceOpen: true });
  });
}

/** Paste the clipboard into a folder. Returns created nodes. */
export function pasteInto(dirId: string): fs.FSNode[] {
  const { ids, mode } = clipStore.get();
  const out: fs.FSNode[] = [];
  const errs: string[] = [];
  for (const id of ids) {
    try {
      if (!fs.get(id)) continue;
      if (mode === 'cut') out.push(fs.move(id, dirId));
      else out.push(fs.copy(id, dirId));
    } catch (e) {
      errs.push((e as Error).message);
    }
  }
  if (mode === 'cut') clipStore.set({ ids: [] });
  if (errs.length) errorBox(errs.join('\n'), 'Error Copying File or Folder');
  return out;
}

export function deleteNodes(ids: string[], permanent = false) {
  const errs: string[] = [];
  let n = 0;
  for (const id of ids) {
    try {
      if (permanent) fs.destroy(id);
      else fs.remove(id);
      n++;
    } catch (e) {
      errs.push((e as Error).message);
    }
  }
  if (n) play('recycle');
  if (errs.length) errorBox(errs.join('\n'), 'Error Deleting File or Folder');
}

export function dropNodes(ids: string[], dirId: string, copy: boolean) {
  const errs: string[] = [];
  for (const id of ids) {
    if (id === dirId) continue;
    try {
      const n = fs.get(id);
      if (!n) continue;
      if (copy) fs.copy(id, dirId);
      else if (fs.inRecycler(id)) {
        fs.restore(id);
        fs.move(id, dirId);
      } else fs.move(id, dirId);
    } catch (e) {
      errs.push((e as Error).message);
    }
  }
  if (errs.length) errorBox(errs.join('\n'), copy ? 'Error Copying File or Folder' : 'Error Moving File or Folder');
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' bytes';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

export function displayName(node: fs.FSNode, showExt = true): string {
  const e = fs.ext(node.name);
  if (node.type === 'file' && (e === 'lnk' || e === 'url')) return node.name.slice(0, -(e.length + 1));
  if (!showExt && node.type === 'file' && e) return node.name.slice(0, -(e.length + 1));
  return node.name;
}

export function typeName(node: fs.FSNode): string {
  if (node.type === 'dir') return 'File Folder';
  const e = fs.ext(node.name);
  const map: Record<string, string> = {
    txt: 'Text Document', log: 'Log File', ini: 'Configuration Settings', bat: 'MS-DOS Batch File', exe: 'Application', lnk: 'Shortcut', url: 'Internet Shortcut',
    bmp: 'Bitmap Image', png: 'PNG Image', kpx: 'StarPaint Image', wav: 'Wave Sound', mp3: 'MP3 Audio', htm: 'HTML Document', html: 'HTML Document', sys: 'System File',
    dll: 'Application Extension', md: 'Markdown Document', nfo: 'System Information File', tkt: 'Support Ticket', cor: 'Corrupted File', lxo: 'koalOS Program', py: 'Python Script', pice: 'koalOS Painting', jpg: 'JPEG Image', jpeg: 'JPEG Image', gif: 'GIF Image', webp: 'WebP Image', dat: 'DAT File', reg: 'Registration Entries',
  };
  return map[e] ?? (e ? e.toUpperCase() + ' File' : 'File');
}

export function notifySaved(name: string) {
  notify('File saved', `${name} was saved successfully.`, { icon: 'save', silent: true });
}
