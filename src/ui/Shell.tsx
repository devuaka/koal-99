import { useEffect, useState } from 'react';
import { wmStore, close, cycleWindows, showDesktop } from '../core/wm';
import { Window } from './Window';
import { Desktop } from './Desktop';
import { Taskbar } from './Taskbar';
import { StartMenu } from './StartMenu';
import { ContextMenu, DragGhost, Toast } from './Overlays';
import { ScreensaverHost } from './Screensaver';
import { shellStore, toggleStart } from '../core/shell';
import { launchApp } from '../core/launcher';
import { logoff, sysStore } from '../core/system';
import { notify } from '../core/notify';
import { play } from '../core/sound';
import { iconUrl } from './Icon';
import { loadBuddi } from '../core/buddi';
import { startPresence } from '../core/invites';
import { Buddi } from './Buddi';
import { Pranks, stopPranks } from './Pranks';

const STRANGE = [
  ['System Notice', 'A shooting star has been detected in your system tray. Make a wish.', 'star'],
  ['Disk Cleanup', 'You are running low on stardust. Click here to see how to free space on this drive.', 'drive'],
  ['STARNET', 'Connection speed: 56.6 Kbps. Someone picked up the phone.', 'network'],
  ['Security Center', 'Your computer might be at risk. Then again, it might not. Hard to say.', 'shield'],
  ['New user detected', 'A second user is logged on to this computer.\n\nUser: (blank)', 'user'],
  ['KOAL Update', 'Updates are available for your computer. KOAL Systems Inc. no longer exists, so they will not be installed.', 'info'],
  ['Hardware', 'Your mouse ball needs cleaning.', 'mouse'],
  ['Reminder', 'Gary would like his stapler back.', 'warning'],
  ['KIP', 'hello', 'kip'],
] as const;

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

function StarRain({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 7000);
    return () => window.clearTimeout(t);
  }, [onDone]);
  const drops = Array.from({ length: 40 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 3, dur: 2 + Math.random() * 3, size: 24 + Math.random() * 40, i }));
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 99400, overflow: 'hidden' }}>
      <style>{'@keyframes krain{from{transform:translateY(-80px) rotate(0)}to{transform:translateY(110vh) rotate(720deg)}}'}</style>
      {drops.map((d) => (
        <img key={d.i} src={iconUrl('logo')} width={d.size} style={{ position: 'absolute', left: d.left + '%', top: 0, imageRendering: 'pixelated', animation: `krain ${d.dur}s linear ${d.delay}s both` }} alt="" />
      ))}
    </div>
  );
}

export function Shell() {
  const wins = wmStore.use((s) => s.wins);
  const focused = wmStore.use((s) => s.focused);
  const [rain, setRain] = useState(false);

  useEffect(() => {
    let konami: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      if (sysStore.get().phase !== 'desktop') return;
      const k = e.key;
      konami = [...konami, k.length === 1 ? k.toLowerCase() : k].slice(-KONAMI.length);
      if (konami.join(',') === KONAMI.join(',')) {
        konami = [];
        play('secret');
        setRain(true);
        notify('Secret unlocked', 'STAR MODE ACTIVATED. +30 lives. Everything is shiny now.', { icon: 'star' });
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && k === 'Escape') {
        e.preventDefault();
        toggleStart();
      } else if (k === 'Escape' && (shellStore.get().start || shellStore.get().popup)) {
        shellStore.set({ start: false, popup: null });
      } else if (e.altKey && (k === 'F4' || k.toLowerCase() === 'w') && !ctrl) {
        e.preventDefault();
        const f = wmStore.get().focused;
        if (f) close(f);
      } else if (e.altKey && (k === '`' || k === '~')) {
        e.preventDefault();
        cycleWindows();
      } else if (ctrl && e.altKey && k.toLowerCase() === 'd') {
        e.preventDefault();
        showDesktop();
      } else if (ctrl && e.altKey && k.toLowerCase() === 't') {
        e.preventDefault();
        launchApp('terminal');
      } else if (ctrl && e.altKey && k.toLowerCase() === 'e') {
        e.preventDefault();
        launchApp('explorer');
      } else if (ctrl && e.altKey && k.toLowerCase() === 'r') {
        e.preventDefault();
        launchApp('run');
      } else if (ctrl && e.shiftKey && k.toLowerCase() === 'k') {
        e.preventDefault();
        launchApp('taskmgr');
      } else if (ctrl && e.altKey && k.toLowerCase() === 'l') {
        e.preventDefault();
        logoff();
      } else if (k === 'F1') {
        e.preventDefault();
        launchApp('support', { tab: 'kb' });
      }
    };
    const onDown = () => {
      if (shellStore.get().start || shellStore.get().popup) shellStore.set({ start: false, popup: null });
    };
    window.addEventListener('keydown', onKey);
    // Buddi comes back if it was on, and friends can reach you if you have any.
    loadBuddi();
    const buddiT = window.setTimeout(() => startPresence(), 2500);
    window.addEventListener('pointerdown', onDown);

    // Strange system messages, now and then.
    let fired333 = false;
    const t = window.setInterval(() => {
      const now = new Date();
      if (now.getHours() % 12 === 3 && now.getMinutes() === 33 && !fired333) {
        fired333 = true;
        notify('KIP', 'hello. it is 3:33 again.', { icon: 'kip', onClick: () => launchApp('kip') });
        return;
      }
      if (Date.now() - sysStore.get().loggedInAt < 120000) return;
      if (Math.random() < 0.06) {
        const [title, body, icon] = STRANGE[Math.floor(Math.random() * STRANGE.length)];
        notify(title, body, { icon, onClick: icon === 'kip' ? () => launchApp('kip') : undefined });
      }
    }, 20000);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      window.clearInterval(t);
      window.clearTimeout(buddiT);
      stopPranks(); // logging off or a BSOD ends any running prank
    };
  }, []);

  return (
    <div className="os-root" onContextMenu={(e) => e.preventDefault()}>
      <Desktop />
      <div style={{ position: 'absolute', inset: '0 0 40px 0', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} className="win-layer">
          {wins.map((w) => (
            <Window key={w.id} win={w} focused={focused === w.id} />
          ))}
        </div>
      </div>
      <Buddi />
      <Pranks />
      <Taskbar />
      <StartMenu />
      <Toast />
      <ContextMenu />
      <DragGhost />
      {rain && <StarRain onDone={() => setRain(false)} />}
      <ScreensaverHost />
    </div>
  );
}
