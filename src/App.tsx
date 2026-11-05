import { useEffect, useState } from 'react';
import { sysStore, isAdmin } from './core/system';
import { fsStore, loadFS, setAdminCheck, flushSave } from './core/fs';
import { seedSystem } from './core/seed';
import { settingsStore } from './core/settings';
import { Bios, BootLogo, Login, WelcomeScreen, ShutdownScreen, OffScreen, Bsod } from './boot/Boot';
import { Shell } from './ui/Shell';

setAdminCheck(isAdmin);

export function App() {
  const phase = sysStore.use((s) => s.phase);
  const ready = fsStore.use((s) => s.ready);
  const user = settingsStore.use((s) => s.user);
  const theme = settingsStore.use((s) => s.settings.theme);
  const smooth = settingsStore.use((s) => s.settings.fontSmoothing);
  const [, force] = useState(0);

  useEffect(() => {
    loadFS(seedSystem).then(() => force((x) => x + 1));
    const save = () => flushSave();
    window.addEventListener('beforeunload', save);
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('beforeunload', save);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = user ? theme : 'aero';
    document.body.classList.toggle('no-smooth', !smooth);
  }, [theme, user, smooth]);

  if (phase === 'bios') return <Bios />;
  if (!ready) return <div style={{ position: 'fixed', inset: 0, background: '#000' }} />;
  switch (phase) {
    case 'boot':
      return <BootLogo />;
    case 'login':
      return <Login />;
    case 'welcome':
      return <WelcomeScreen />;
    case 'loggingoff':
      return <WelcomeScreen text="logging off..." sub="Saving your settings..." />;
    case 'desktop':
      return <Shell />;
    case 'shutdown':
      return <ShutdownScreen />;
    case 'off':
      return <OffScreen />;
    case 'bsod':
      return <Bsod />;
  }
  return null;
}
