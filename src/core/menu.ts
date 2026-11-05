import { createStore } from './store';

export interface MenuItem {
  label?: string;
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
  bold?: boolean;
  checked?: boolean;
  sep?: boolean;
  items?: MenuItem[];
  shortcut?: string;
}

interface MenuState {
  menu: { x: number; y: number; items: MenuItem[] } | null;
}

export const menuStore = createStore<MenuState>({ menu: null });

export function openMenu(e: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void }, items: MenuItem[]) {
  e.preventDefault?.();
  e.stopPropagation?.();
  menuStore.set({ menu: { x: e.clientX, y: e.clientY, items } });
}

export function closeMenu() {
  if (menuStore.get().menu) menuStore.set({ menu: null });
}

// Shared file clipboard (Explorer, Desktop, Terminal-agnostic)
interface ClipState {
  ids: string[];
  mode: 'copy' | 'cut';
}
export const clipStore = createStore<ClipState>({ ids: [], mode: 'copy' });
