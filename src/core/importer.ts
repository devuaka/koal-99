// Import files from the real computer into the pretend hard drive (pictures, text, small audio).
import * as fs from './fs';
import { notify } from './notify';
import { TEXT_EXT } from './launcher';

const MAX_AUDIO = 8 * 1024 * 1024;
const TEXTY = [...TEXT_EXT, 'py', 'lxo', 'htm', 'html', 'xml', 'svg', 'ts', 'tsx', 'yml', 'yaml', 'toml'];

function readAs(f: File, how: 'text' | 'url'): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('Could not read ' + f.name));
    if (how === 'text') r.readAsText(f);
    else r.readAsDataURL(f);
  });
}

async function shrinkImage(f: File, url: string): Promise<{ url: string; ext: string }> {
  const im = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(f.name + ' is not a picture KOAL-99 can open.'));
    i.src = url;
  });
  let ext = fs.ext(f.name) || 'png';
  if (f.size <= 1_500_000 && im.width <= 2400 && im.height <= 2400) return { url, ext };
  const k = Math.min(1, 1600 / Math.max(im.width, im.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(im.width * k));
  c.height = Math.max(1, Math.round(im.height * k));
  const g = c.getContext('2d')!;
  if (f.type !== 'image/png') {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
  }
  g.drawImage(im, 0, 0, c.width, c.height);
  if (f.type === 'image/png' && c.width * c.height < 1_300_000) return { url: c.toDataURL('image/png'), ext: 'png' };
  ext = 'jpg';
  return { url: c.toDataURL('image/jpeg', 0.88), ext };
}

export async function importFileList(files: File[], dirId: string): Promise<fs.FSNode[]> {
  const made: fs.FSNode[] = [];
  for (const f of files) {
    try {
      const e = fs.ext(f.name);
      let name = f.name.replace(/[\\/:*?"<>|]/g, '_') || 'file';
      let content: string;
      if (f.type.startsWith('image/')) {
        const r = await shrinkImage(f, await readAs(f, 'url'));
        if (r.ext !== e) name = name.replace(/\.[^.]+$/, '') + '.' + r.ext;
        content = r.url;
      } else if (f.type.startsWith('text/') || TEXTY.includes(e)) {
        if (f.size > 2_000_000) throw new Error(f.name + ' is too big (text files up to 2 MB).');
        content = await readAs(f, 'text');
      } else if (f.type.startsWith('audio/')) {
        if (f.size > MAX_AUDIO) throw new Error(f.name + ' is too big (audio up to 8 MB).');
        content = await readAs(f, 'url');
      } else throw new Error(f.name + ': KOAL-99 can import pictures, text files and small audio files.');
      made.push(fs.create(dirId, fs.uniqueName(dirId, name), 'file', content));
    } catch (err) {
      notify('Import', (err as Error).message, { icon: 'error' });
    }
  }
  if (made.length) notify('Import complete', `${made.length} file(s) copied to ${fs.pathOf(dirId)}.`, { icon: 'documents', silent: true });
  return made;
}

/** Opens the real file picker and imports the chosen files into a folder. */
export function pickAndImport(dirId: string, accept = 'image/*,text/*,audio/*,.py,.lxo,.md,.json,.csv,.htm,.html'): Promise<fs.FSNode[]> {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = accept;
    inp.onchange = async () => resolve(await importFileList([...(inp.files ?? [])], dirId));
    inp.click();
  });
}
