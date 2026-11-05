import { createStore, uid } from './store';
import { play } from './sound';

export interface Notif {
  id: string;
  title: string;
  body: string;
  icon: string;
  at: number;
  read: boolean;
  onClick?: () => void;
}

interface NotifState {
  items: Notif[];
  toast: Notif | null;
  centerOpen: boolean;
}

export const notifyStore = createStore<NotifState>({ items: [], toast: null, centerOpen: false });

let toastTimer: number | undefined;

export function notify(title: string, body: string, opts: { icon?: string; onClick?: () => void; silent?: boolean } = {}) {
  const n: Notif = { id: uid('nt'), title, body, icon: opts.icon ?? 'info', at: Date.now(), read: false, onClick: opts.onClick };
  notifyStore.set((s) => ({ items: [n, ...s.items].slice(0, 60), toast: n }));
  if (!opts.silent) play('notify');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => notifyStore.set({ toast: null }), 6500);
}

export function dismissToast() {
  window.clearTimeout(toastTimer);
  notifyStore.set({ toast: null });
}

export function markAllRead() {
  notifyStore.set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) }));
}

export function clearNotifs() {
  notifyStore.set({ items: [] });
}
