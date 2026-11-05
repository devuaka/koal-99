import { useEffect, useState } from 'react';
import { wmStore, taskbarClick, showDesktop, minimize, close, focus, toggleMax } from '../core/wm';
import { registry } from '../core/registry';
import { shellStore, toggleStart } from '../core/shell';
import { notifyStore, markAllRead, clearNotifs } from '../core/notify';
import { useSettings, setSettings } from '../core/settings';
import { openMenu } from '../core/menu';
import { launchApp } from '../core/launcher';
import { openApp } from '../core/wm';
import { play } from '../core/sound';
import { Icon } from './Icon';
import { toggleBuddi } from '../core/buddi';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export function fmtTime(d: Date, h24: boolean) {
  if (h24) return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  const h = d.getHours() % 12 || 12;
  return `${h}:${d.getMinutes().toString().padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export function Taskbar() {
  const wins = wmStore.use((s) => s.wins);
  const focused = wmStore.use((s) => s.focused);
  const start = shellStore.use((s) => s.start);
  const popup = shellStore.use((s) => s.popup);
  const notifs = notifyStore.use((s) => s.items);
  const settings = useSettings();
  const now = useClock();
  const unread = notifs.filter((n) => !n.read).length;
  const glitch = now.getHours() % 12 === 3 && now.getMinutes() === 33;
  const tasks = [...wins].filter((w) => !registry[w.app]?.noTaskbar).sort((a, b) => a.opened - b.opened);

  const setPopup = (p: typeof popup) => shellStore.set({ popup: popup === p ? null : p, start: false });

  return (
    <>
      <div className="taskbar" onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('.task-btn')) return;
        openMenu(e, [
          { label: 'Cascade Windows', onClick: () => cascade() },
          { label: 'Tile Windows', onClick: () => tile() },
          { label: 'Show the Desktop', onClick: showDesktop },
          { sep: true },
          { label: 'Task Manager', icon: 'taskmgr', onClick: () => launchApp('taskmgr') },
          { sep: true },
          { label: 'Properties', onClick: () => openApp('control', { page: 'display' }) },
        ]);
      }}>
        <div
          className={`start-btn ${start ? 'open' : ''}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            play('click');
            toggleStart();
          }}
        >
          <Icon name="logo" size={46} />
        </div>
        <div className="quick">
          <div title="StarNet Explorer" onClick={() => launchApp('browser')}><Icon name="browser" size={22} /></div>
          <div title="Terminal" onClick={() => launchApp('terminal')}><Icon name="terminal" size={22} /></div>
          <div title="File Explorer" onClick={() => launchApp('explorer')}><Icon name="folderopen" size={22} /></div>
        </div>
        <div className="tasks">
          {tasks.map((w) => (
            <div
              key={w.id}
              className={`task-btn ${focused === w.id && !w.minimized ? 'active' : ''}`}
              title={w.title}
              onClick={() => taskbarClick(w.id)}
              onContextMenu={(e) =>
                openMenu(e, [
                  { label: 'Restore', disabled: !w.minimized && !w.maximized, onClick: () => (w.maximized ? toggleMax(w.id) : focus(w.id)) },
                  { label: 'Minimize', disabled: w.minimized, onClick: () => minimize(w.id) },
                  { label: 'Maximize', disabled: w.maximized, onClick: () => (focus(w.id), toggleMax(w.id)) },
                  { sep: true },
                  { label: 'Close', bold: true, onClick: () => close(w.id) },
                ])
              }
            >
              <Icon name={w.icon} size={22} />
              <span>{w.title}</span>
            </div>
          ))}
        </div>
        <div className="tray">
          <div className="ti kos-tray" title="Buddi (click to show or hide)" onClick={toggleBuddi}>
            <Icon name="buddi" size={18} />
          </div>
          <div className="ti" title="Notifications" onClick={() => { setPopup('notifications'); markAllRead(); }}>
            <Icon name="bell" size={16} />
            {unread > 0 && <span className="badge">{unread}</span>}
          </div>
          <div className="ti" title="Network: STARNET (connected, 56.6 Kbps)" onClick={() => launchApp('browser')}>
            <Icon name="network" size={16} />
          </div>
          <div className="ti" title={settings.muted ? 'Volume: muted' : `Volume: ${Math.round(settings.volume * 100)}%`} onClick={() => setPopup('volume')} onContextMenu={(e) => openMenu(e, [{ label: settings.muted ? 'Unmute' : 'Mute', onClick: () => setSettings({ muted: !settings.muted }) }, { label: 'Sound Settings...', onClick: () => openApp('control', { page: 'sound' }) }])}>
            <Icon name={settings.muted ? 'mute' : 'sound'} size={16} />
          </div>
          <div className={`clock ${glitch ? 'glitch' : ''}`} title={now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} onClick={() => setPopup('calendar')}>
            {glitch ? '3:33 ░▒' : fmtTime(now, settings.clock24)}
            <small>{now.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })}</small>
          </div>
        </div>
        <div className="show-desk" title="Show Desktop" onClick={showDesktop} />
      </div>
      {popup === 'notifications' && <NotifCenter />}
      {popup === 'calendar' && <Calendar now={now} />}
      {popup === 'volume' && <VolumePop />}
    </>
  );
}

function cascade() {
  const wins = wmStore.get().wins.filter((w) => !w.minimized && !registry[w.app]?.noTaskbar).sort((a, b) => a.z - b.z);
  wmStore.set((s) => ({ wins: s.wins.map((w) => { const i = wins.findIndex((x) => x.id === w.id); return i < 0 ? w : { ...w, maximized: false, x: 20 + i * 28, y: 20 + i * 28 }; }) }));
}

function tile() {
  const wins = wmStore.get().wins.filter((w) => !w.minimized && !registry[w.app]?.noTaskbar);
  if (!wins.length) return;
  const W = window.innerWidth;
  const H = window.innerHeight - 40;
  const cols = Math.ceil(Math.sqrt(wins.length));
  const rows = Math.ceil(wins.length / cols);
  wmStore.set((s) => ({ wins: s.wins.map((w) => { const i = wins.findIndex((x) => x.id === w.id); if (i < 0) return w; return { ...w, maximized: false, x: (i % cols) * (W / cols), y: Math.floor(i / cols) * (H / rows), w: W / cols, h: H / rows }; }) }));
}

function NotifCenter() {
  const items = notifyStore.use((s) => s.items);
  return (
    <div className="ncenter" onPointerDown={(e) => e.stopPropagation()}>
      <div className="nh">
        <Icon name="bell" size={16} /> Notification Center
        <span className="k-spacer" />
        <button className="k-btn small" onClick={clearNotifs}>Clear all</button>
      </div>
      <div className="nl">
        {!items.length && <div style={{ padding: 16, color: '#666', textAlign: 'center' }}>No new notifications.<br />Everything is fine.</div>}
        {items.map((n) => (
          <div key={n.id} className={`ni ${n.read ? '' : 'unread'}`} onClick={() => { n.onClick?.(); shellStore.set({ popup: null }); }}>
            <Icon name={n.icon} size={16} />
            <div style={{ flex: 1 }}>
              <b>{n.title}</b>
              <div style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
              <small>{new Date(n.at).toLocaleTimeString()}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Calendar({ now }: { now: Date }) {
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const settings = useSettings();
  return (
    <div className="calendar-pop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="big">{fmtTime(now, settings.clock24)}<span style={{ fontSize: 12 }}>:{now.getSeconds().toString().padStart(2, '0')}</span></div>
      <div className="k-row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <button className="k-btn small" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>{'<'}</button>
        <b>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b>
        <button className="k-btn small" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>{'>'}</button>
      </div>
      <table>
        <thead><tr>{'SMTWTFS'.split('').map((d, i) => <th key={i}>{d}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, r) => (
            <tr key={r}>{cells.slice(r * 7, r * 7 + 7).map((d, i) => <td key={i} className={d && month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear() && d === now.getDate() ? 'today' : ''}>{d ?? ''}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 6, textAlign: 'right' }}>
        <span className="k-link" onClick={() => openApp('control', { page: 'datetime' })}>Date and Time settings...</span>
      </div>
    </div>
  );
}

function VolumePop() {
  const s = useSettings();
  return (
    <div className="calendar-pop" style={{ width: 120, right: 70 }} onPointerDown={(e) => e.stopPropagation()}>
      <div style={{ textAlign: 'center', marginBottom: 6 }}>Volume</div>
      <div style={{ display: 'flex', justifyContent: 'center', height: 110 }}>
        <input type="range" min={0} max={100} value={Math.round(s.volume * 100)} onChange={(e) => setSettings({ volume: +e.target.value / 100 })} onPointerUp={() => play('ding')} style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 100 } as React.CSSProperties} />
      </div>
      <label className="k-check" style={{ justifyContent: 'center', marginTop: 6 }}>
        <input type="checkbox" checked={s.muted} onChange={(e) => setSettings({ muted: e.target.checked })} /> Mute
      </label>
    </div>
  );
}
