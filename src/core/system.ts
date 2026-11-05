import { createStore } from './store';
import { closeAll } from './wm';
import { flushSave } from './fs';
import { play } from './sound';
import { settingsStore } from './settings';

export type Phase = 'bios' | 'boot' | 'login' | 'welcome' | 'desktop' | 'loggingoff' | 'shutdown' | 'off' | 'bsod';

interface SysState {
  phase: Phase;
  restartAfter: boolean;
  bsod: { code: string; message: string } | null;
  bootedAt: number;
  loggedInAt: number;
  screensaverActive: boolean;
}

export const sysStore = createStore<SysState>({ phase: 'bios', restartAfter: false, bsod: null, bootedAt: Date.now(), loggedInAt: 0, screensaverActive: false });

export function setPhase(phase: Phase) {
  sysStore.set({ phase });
}

export function isAdmin() {
  return settingsStore.get().user === 'sysop';
}

export function logoff() {
  flushSave();
  play('shutdown');
  closeAll();
  sysStore.set({ phase: 'loggingoff' });
  window.setTimeout(() => {
    settingsStore.set({ user: null });
    sysStore.set({ phase: 'login' });
  }, 1600);
}

export function shutdown(restart = false) {
  flushSave();
  play('shutdown');
  closeAll();
  sysStore.set({ phase: 'shutdown', restartAfter: restart });
}

export function bootFromOff() {
  sysStore.set({ phase: 'bios', bootedAt: Date.now(), bsod: null });
}

export function bsod(code = 'STARDUST_DEFICIENCY', message = 'A fatal exception 0E has occurred at 0028:C0011E36 in VXD STARLITE(01) + 00010E36.') {
  flushSave();
  play('bsod');
  closeAll();
  sysStore.set({ phase: 'bsod', bsod: { code, message } });
}
