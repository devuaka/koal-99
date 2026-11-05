import { openApp } from './wm';
import { play } from './sound';

// Standard icons, or any icon name from ui/icons.ts
export type DlgIcon = 'info' | 'warning' | 'error' | 'question' | 'logo' | (string & {});

export interface DlgProps {
  kind: 'alert' | 'confirm' | 'prompt' | 'choice';
  message: string;
  icon: DlgIcon;
  defaultValue?: string;
  buttons?: string[];
  resolve: (v: any) => void;
}

function open(title: string, p: Omit<DlgProps, 'resolve'>, w = 380): Promise<any> {
  return new Promise((resolve) => {
    let done = false;
    const res = (v: any) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    play(p.icon === 'error' ? 'error' : p.icon === 'warning' ? 'exclaim' : 'ding');
    openApp('msgbox', { ...p, resolve: res, _title: title, _w: w, _h: p.kind === 'prompt' ? 170 : Math.min(420, 130 + Math.ceil(p.message.length / 52) * 16), _onClose: () => res(p.kind === 'prompt' ? null : p.kind === 'choice' ? -1 : false) });
  });
}

export function alertBox(message: string, title = 'KOAL-99', icon: DlgIcon = 'info'): Promise<void> {
  return open(title, { kind: 'alert', message, icon });
}

export function errorBox(message: string, title = 'Error') {
  return alertBox(message, title, 'error');
}

export function confirmBox(message: string, title = 'Confirm', icon: DlgIcon = 'question'): Promise<boolean> {
  return open(title, { kind: 'confirm', message, icon });
}

export function promptBox(message: string, defaultValue = '', title = 'KOAL-99'): Promise<string | null> {
  return open(title, { kind: 'prompt', message, icon: 'question', defaultValue });
}

/** Returns the index of the clicked button, or -1 if closed. */
export function choiceBox(message: string, buttons: string[], title = 'KOAL-99', icon: DlgIcon = 'question'): Promise<number> {
  return open(title, { kind: 'choice', message, icon, buttons }, Math.max(380, buttons.length * 100));
}
