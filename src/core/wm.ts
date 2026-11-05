import { createStore, uid } from './store';
import { registry } from './registry';
import { play } from './sound';

export interface Win {
  id: string;
  app: string;
  title: string;
  icon: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minimized: boolean;
  maximized: boolean;
  z: number;
  props: Record<string, any>;
  opened: number;
}

interface WMState {
  wins: Win[];
  focused: string | null;
  z: number;
}

export const wmStore = createStore<WMState>({ wins: [], focused: null, z: 10 });

let cascade = 0;

export const TASKBAR_H = 40;

export function desktopSize() {
  return { w: window.innerWidth, h: window.innerHeight - TASKBAR_H };
}

export function openApp(appId: string, props: Record<string, any> = {}): string | null {
  const def = registry[appId];
  if (!def) return null;
  const st = wmStore.get();
  if (def.singleton) {
    const existing = st.wins.find((w) => w.app === appId);
    if (existing) {
      if (Object.keys(props).length) updateWin(existing.id, { props: { ...existing.props, ...props, _nonce: Date.now() } });
      focus(existing.id);
      return existing.id;
    }
  }
  const ds = desktopSize();
  const w = Math.min(props._w ?? def.w, ds.w - 20);
  const h = Math.min(props._h ?? def.h, ds.h - 20);
  const off = (cascade++ % 8) * 26;
  const x = props._x ?? Math.max(4, Math.round((ds.w - w) / 2 - 120 + off));
  const y = props._y ?? Math.max(4, Math.round((ds.h - h) / 2 - 90 + off));
  const z = st.z + 1;
  const win: Win = { id: uid('w'), app: appId, title: props._title ?? def.name, icon: props._icon ?? def.icon, x, y, w, h, minimized: false, maximized: !!props._max, z, props, opened: Date.now() };
  wmStore.set({ wins: [...st.wins, win], focused: win.id, z });
  if (!def.noTaskbar) play('open');
  return win.id;
}

export function updateWin(id: string, patch: Partial<Win>) {
  wmStore.set((s) => ({ wins: s.wins.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
}

const closeHooks = new Map<string, () => boolean | Promise<boolean>>();
/** A window can veto closing (e.g. unsaved Notepad). Return false to cancel. */
export function onBeforeClose(id: string, fn: (() => boolean | Promise<boolean>) | null) {
  if (fn) closeHooks.set(id, fn);
  else closeHooks.delete(id);
}

export async function close(id: string, force = false) {
  const hook = closeHooks.get(id);
  if (hook && !force) {
    const ok = await hook();
    if (!ok) return;
  }
  closeHooks.delete(id);
  const st = wmStore.get();
  const win = st.wins.find((w) => w.id === id);
  if (!win) return;
  win.props._onClose?.();
  const wins = st.wins.filter((w) => w.id !== id);
  const top = [...wins].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];
  wmStore.set({ wins, focused: st.focused === id ? top?.id ?? null : st.focused });
  if (!registry[win.app]?.noTaskbar) play('close');
}

export function closeAll() {
  closeHooks.clear();
  wmStore.set({ wins: [], focused: null });
}

export function focus(id: string) {
  const st = wmStore.get();
  const win = st.wins.find((w) => w.id === id);
  if (!win) return;
  if (st.focused === id && !win.minimized && win.z === st.z) return;
  const z = st.z + 1;
  wmStore.set({ wins: st.wins.map((w) => (w.id === id ? { ...w, z, minimized: false } : w)), focused: id, z });
}

export function blurAll() {
  wmStore.set({ focused: null });
}

export function minimize(id: string) {
  const st = wmStore.get();
  const wins = st.wins.map((w) => (w.id === id ? { ...w, minimized: true } : w));
  const top = wins.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];
  wmStore.set({ wins, focused: top?.id ?? null });
  play('minimize');
}

export function toggleMax(id: string) {
  const win = wmStore.get().wins.find((w) => w.id === id);
  if (!win) return;
  const def = registry[win.app];
  if (def && (def.resizable === false || def.maximizable === false)) return;
  updateWin(id, { maximized: !win.maximized });
  play(win.maximized ? 'minimize' : 'maximize');
}

/** Taskbar click: focus, or minimize if already focused. */
export function taskbarClick(id: string) {
  const st = wmStore.get();
  const win = st.wins.find((w) => w.id === id);
  if (!win) return;
  if (st.focused === id && !win.minimized) minimize(id);
  else focus(id);
}

export function showDesktop() {
  const st = wmStore.get();
  const allMin = st.wins.every((w) => w.minimized);
  if (allMin) {
    wmStore.set({ wins: st.wins.map((w) => ({ ...w, minimized: false })) });
  } else {
    wmStore.set({ wins: st.wins.map((w) => ({ ...w, minimized: true })), focused: null });
  }
}

export function cycleWindows() {
  const st = wmStore.get();
  const list = st.wins.filter((w) => !registry[w.app]?.noTaskbar).sort((a, b) => a.opened - b.opened);
  if (!list.length) return;
  const i = list.findIndex((w) => w.id === st.focused);
  focus(list[(i + 1) % list.length].id);
}

export function setTitle(id: string, title: string) {
  const win = wmStore.get().wins.find((w) => w.id === id);
  if (win && win.title !== title) updateWin(id, { title });
}

export function windowsOf(app: string): Win[] {
  return wmStore.get().wins.filter((w) => w.app === app);
}
