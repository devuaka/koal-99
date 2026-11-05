import { createStore } from './store';

interface ShellState {
  start: boolean;
  popup: null | 'notifications' | 'calendar' | 'volume';
}

export const shellStore = createStore<ShellState>({ start: false, popup: null });

export function toggleStart(v?: boolean) {
  const open = v ?? !shellStore.get().start;
  shellStore.set({ start: open, popup: null });
}
