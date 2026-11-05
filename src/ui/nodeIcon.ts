import * as fs from '../core/fs';
import { registry } from '../core/registry';
import { AUDIO_EXT, IMAGE_EXT, TEXT_EXT } from '../core/launcher';

export function nodeIcon(node: fs.FSNode): { icon: string; shortcut: boolean } {
  if (node.meta?.icon) return { icon: node.meta.icon, shortcut: false };
  if (node.type === 'dir') {
    if (node.id === fs.RECYCLER) return { icon: fs.children(fs.RECYCLER, { hidden: true }).length ? 'recyclefull' : 'recycle', shortcut: false };
    const map: Record<string, string> = { 'my documents': 'documents', 'my pictures': 'pictures', 'my music': 'music' };
    return { icon: map[node.name.toLowerCase()] ?? 'folder', shortcut: false };
  }
  if (node.meta?.corrupt) return { icon: 'corrupt', shortcut: false };
  const e = fs.ext(node.name);
  if (e === 'lnk') {
    if (node.meta?.app) return { icon: registry[node.meta.app]?.icon ?? 'exe', shortcut: true };
    const t = node.meta?.target ? fs.resolve(node.meta.target) : undefined;
    return { icon: t ? nodeIcon(t).icon : 'exe', shortcut: true };
  }
  if (e === 'exe' || e === 'com') return { icon: registry[node.meta?.app ?? '']?.icon ?? 'exe', shortcut: false };
  if (e === 'url') return { icon: 'web', shortcut: true };
  if (e === 'htm' || e === 'html') return { icon: 'web', shortcut: false };
  if (IMAGE_EXT.includes(e)) return { icon: 'image', shortcut: false };
  if (AUDIO_EXT.includes(e)) return { icon: 'audio', shortcut: false };
  if (e === 'tkt') return { icon: 'support', shortcut: false };
  if (e === 'lxo') return { icon: 'lxo', shortcut: false };
  if (e === 'py') return { icon: 'python', shortcut: false };
  if (TEXT_EXT.includes(e)) return { icon: 'text', shortcut: false };
  if (e === 'sys' || e === 'dll' || e === 'drv' || e === 'dat') return { icon: 'exe', shortcut: false };
  return { icon: 'text', shortcut: false };
}
