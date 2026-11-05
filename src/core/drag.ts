import { createStore } from './store';
import * as fs from './fs';
import { deleteNodes, dropNodes } from './launcher';
import { desktopDir } from './session';
import { S, setSettings } from './settings';

// Pointer-based file drag & drop shared by the Desktop and Explorer windows.
// Drop targets mark themselves with data-drop="dir:<id>" | "recycle" | "desktop".

interface DragState {
  active: boolean;
  ids: string[];
  x: number;
  y: number;
  label: string;
  icon: string;
  copy: boolean;
  over: string | null;
}

export const dragStore = createStore<DragState>({ active: false, ids: [], x: 0, y: 0, label: '', icon: 'file', copy: false, over: null });

export interface DropInfo {
  target: string; // raw data-drop value
  x: number;
  y: number;
  copy: boolean;
}

export interface ArmOptions {
  label: string;
  icon: string;
  /** Return true if the drop was handled by the caller. */
  onDrop?: (info: DropInfo) => boolean;
  onEnd?: (dragged: boolean) => void;
  noGhost?: boolean;
}

function targetAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const t = el?.closest('[data-drop]') as HTMLElement | null;
  return t?.dataset.drop ?? null;
}

export function armDrag(e: React.PointerEvent | PointerEvent, ids: string[], opts: ArmOptions) {
  if ((e as PointerEvent).button !== 0) return;
  const sx = e.clientX;
  const sy = e.clientY;
  let active = false;
  const move = (ev: PointerEvent) => {
    if (!active && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
    if (!active) {
      active = true;
      document.body.classList.add('dragging-files');
    }
    const over = targetAt(ev.clientX, ev.clientY);
    dragStore.set({ active: !opts.noGhost || !!over?.startsWith('dir:') || over === 'recycle', ids, x: ev.clientX, y: ev.clientY, label: opts.label, icon: opts.icon, copy: ev.ctrlKey, over });
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    document.body.classList.remove('dragging-files');
    dragStore.set({ active: false, over: null });
    if (active) {
      const target = targetAt(ev.clientX, ev.clientY);
      if (target) {
        const info: DropInfo = { target, x: ev.clientX, y: ev.clientY, copy: ev.ctrlKey };
        if (!opts.onDrop?.(info)) defaultDrop(ids, info);
      }
    }
    opts.onEnd?.(active);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

export function defaultDrop(ids: string[], info: DropInfo) {
  if (info.target === 'recycle') {
    deleteNodes(ids);
    return;
  }
  if (info.target === 'desktop') {
    const desk = desktopDir();
    const moving = ids.filter((id) => fs.get(id)?.parent !== desk.id || info.copy);
    const before = new Set(fs.children(desk.id, { hidden: true }).map((n) => n.id));
    dropNodes(moving, desk.id, info.copy);
    const after = fs.children(desk.id, { hidden: true }).filter((n) => !before.has(n.id) || ids.includes(n.id));
    const pos = { ...S().iconPositions };
    after.forEach((n, i) => (pos[n.id] = { x: Math.max(0, info.x - 37 + i * 12), y: Math.max(0, info.y - 24 + i * 12) }));
    setSettings({ iconPositions: pos });
    return;
  }
  if (info.target.startsWith('dir:')) {
    const dirId = info.target.slice(4);
    if (ids.includes(dirId)) return;
    const n = fs.get(ids[0]);
    if (n && n.parent === dirId && !info.copy) return;
    dropNodes(ids, dirId, info.copy);
  }
}
