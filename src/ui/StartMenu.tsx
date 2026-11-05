import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { shellStore, toggleStart } from '../core/shell';
import { currentProfile } from '../core/settings';
import { registry } from '../core/registry';
import { launchApp, openNode } from '../core/launcher';
import { openApp } from '../core/wm';
import { homePath, homeDir } from '../core/session';
import * as fs from '../core/fs';
import { logoff, isAdmin } from '../core/system';
import { Icon } from './Icon';
import { nodeIcon } from './nodeIcon';

interface Fly {
  key: string;
  x: number;
  y: number;
  items: { label: string; icon: string; run: () => void; sub?: string }[];
}

export function StartMenu() {
  const open = shellStore.use((s) => s.start);
  if (!open) return null;
  return <StartMenuInner />;
}

function StartMenuInner() {
  const [fly, setFly] = useState<Fly | null>(null);
  const [fly2, setFly2] = useState<Fly | null>(null);
  const [q, setQ] = useState('');
  const t = useRef<number>();
  const prof = currentProfile();
  const close = () => {
    toggleStart(false);
    setFly(null);
    setFly2(null);
  };
  const run = (fn: () => void) => () => {
    close();
    fn();
  };
  const app = (id: string, props?: Record<string, unknown>) => run(() => launchApp(id, props));
  const path = (p: string) => run(() => openApp('explorer', { path: fs.resolve(p)?.id ?? fs.ROOT }));

  const programs = Object.values(registry).filter((d) => !d.hidden && (!d.adminOnly || isAdmin()));
  const group = (cat: string) => programs.filter((d) => (d.category ?? 'main') === cat).map((d) => ({ label: d.name, icon: d.icon, run: app(d.id) }));

  const openFly = (key: string, el: HTMLElement, items: Fly['items'], level = 1) => {
    window.clearTimeout(t.current);
    const r = el.getBoundingClientRect();
    const f = { key, x: r.right + 2, y: Math.max(4, Math.min(r.top - 2, window.innerHeight - 50 - items.length * 28)), items };
    if (level === 1) {
      setFly(f);
      setFly2(null);
    } else setFly2(f);
  };

  const allPrograms = (): Fly['items'] => [
    { label: 'Accessories', icon: 'folder', run: () => {}, sub: 'accessories' },
    { label: 'Games', icon: 'folder', run: () => {}, sub: 'games' },
    { label: 'System Tools', icon: 'folder', run: () => {}, sub: 'system' },
    { label: 'koalOS Apps', icon: 'logo', run: () => {}, sub: 'koalos' },
    ...group('main'),
    ...group('koal'),
  ];

  const pinned = [
    { id: 'browser', sub: 'Browse the web' },
    { id: 'terminal', sub: 'Command line' },
  ];
  const recent = ['explorer', 'notepad', 'paint', 'media', 'calc', 'support'];

  // search: programs + files in the home folder
  const query = q.trim().toLowerCase();
  const progHits = query ? programs.filter((p) => p.name.toLowerCase().includes(query) || p.id.includes(query)) : [];
  const fileHits = query.length >= 2 ? fs.search(homeDir().id, query).slice(0, 8) : [];

  return (
    <div className="startmenu" onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <div className="sm-top">
        <div className="sm-avatar"><Icon name={prof?.avatar ?? 'user'} size={40} /></div>
        {prof?.displayName ?? 'User'}
      </div>
      <div className="sm-mid">
        <div className="sm-left" onPointerEnter={() => { setFly(null); setFly2(null); }}>
          {query ? (
            <>
              <div style={{ padding: '2px 12px', color: '#1c4f96', fontWeight: 600 }}>Programs</div>
              {progHits.map((p) => (
                <div key={p.id} className="sm-item" onClick={app(p.id)}><Icon name={p.icon} size={24} />{p.name}</div>
              ))}
              {!progHits.length && <div style={{ padding: '2px 14px', color: '#888' }}>No programs found</div>}
              <div style={{ padding: '8px 12px 2px', color: '#1c4f96', fontWeight: 600 }}>Files</div>
              {fileHits.map((n) => (
                <div key={n.id} className="sm-item" onClick={run(() => openNode(n))} title={fs.pathOf(n.id)}>
                  <Icon name={nodeIcon(n).icon} size={24} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
                </div>
              ))}
              {!fileHits.length && <div style={{ padding: '2px 14px', color: '#888' }}>{query.length < 2 ? 'Keep typing...' : 'No files found'}</div>}
            </>
          ) : (
            <>
              {pinned.map((l) => registry[l.id] && (
                <div key={l.id} className="sm-item" onClick={app(l.id)}>
                  <Icon name={registry[l.id].icon} size={36} />
                  <div><b>{registry[l.id].name}</b><div className="sub">{l.sub}</div></div>
                </div>
              ))}
              <div className="sm-sep" />
              {recent.map((id) => registry[id] && (
                <div key={id} className="sm-item" onClick={app(id)}>
                  <Icon name={registry[id].icon} size={30} />
                  {registry[id].name}
                </div>
              ))}
              <div className="sm-sep" />
              <div
                className={`sm-item sm-all ${fly?.key === 'all' ? 'open' : ''}`}
                onPointerEnter={(e) => { const el = e.currentTarget; t.current = window.setTimeout(() => openFly('all', el, allPrograms()), 220); }}
                onPointerLeave={() => window.clearTimeout(t.current)}
                onClick={(e) => openFly('all', e.currentTarget, allPrograms())}
              >
                <span style={{ color: '#2a9a2a' }}>{'\u25B6'}</span> All Programs
              </div>
            </>
          )}
          <div className="sm-search">
            <Icon name="search" size={16} />
            <input autoFocus placeholder="Search programs and files" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (progHits[0]) app(progHits[0].id)();
                else if (fileHits[0]) run(() => openNode(fileHits[0]))();
              }
              if (e.key === 'Escape') close();
            }} />
          </div>
        </div>
        <div className="sm-right" onPointerEnter={() => { setFly(null); setFly2(null); }}>
          <div className="sm-item" onClick={path(homePath() + '\\My Documents')}><Icon name="documents" size={24} />My Documents</div>
          <div className="sm-item" onClick={path(homePath() + '\\My Pictures')}><Icon name="pictures" size={24} />My Pictures</div>
          <div className="sm-item" onClick={path(homePath() + '\\My Music')}><Icon name="music" size={24} />My Music</div>
          <div className="sm-item" onClick={run(() => openApp('explorer', { path: 'mycomputer' }))}><Icon name="computer" size={24} />My Computer</div>
          <div className="sm-sep" />
          <div className="sm-item" onClick={app('control')}><Icon name="control" size={24} />Control Panel</div>
          <div className="sm-item" onClick={app('sysprops')}><Icon name="monitor" size={24} />System Properties</div>
          <div className="sm-item" onClick={app('taskmgr')}><Icon name="taskmgr" size={24} />Task Manager</div>
          <div className="sm-sep" />
          <div className="sm-item" onClick={app('support', { tab: 'kb' })}><Icon name="help" size={24} />Help and Support</div>
          <div className="sm-item" onClick={run(() => openApp('explorer', { path: fs.ROOT, search: true }))}><Icon name="search" size={24} />Search</div>
          <div className="sm-item" onClick={app('run')}><Icon name="run" size={24} />Run...</div>
        </div>
      </div>
      <div className="sm-bottom">
        <div className="sm-pbtn" onClick={run(logoff)}><Icon name="logoff" size={22} />Log Off</div>
        <div className="sm-pbtn red" onClick={app('turnoff')}><Icon name="power" size={22} />Turn Off</div>
      </div>
      {fly && createPortal(
        <div className="sm-flyout" style={{ left: fly.x, top: fly.y }} onPointerDown={(e) => e.stopPropagation()}>
          {fly.items.map((it, i) => (
            <div
              key={i}
              className={`sm-item ${fly2?.key === it.sub ? 'open' : ''}`}
              onPointerEnter={(e) => {
                const el = e.currentTarget;
                if (it.sub) openFly(it.sub, el, group(it.sub), 2);
                else setFly2(null);
              }}
              onClick={(e) => (it.sub ? openFly(it.sub, e.currentTarget, group(it.sub), 2) : it.run())}
            >
              <Icon name={it.icon} size={20} />
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.sub && '\u25B6'}
            </div>
          ))}
        </div>, document.body
      )}
      {fly2 && createPortal(
        <div className="sm-flyout" style={{ left: fly2.x, top: fly2.y }} onPointerDown={(e) => e.stopPropagation()}>
          {fly2.items.length === 0 && <div className="sm-item" style={{ color: '#888' }}>(Empty)</div>}
          {fly2.items.map((it, i) => (
            <div key={i} className="sm-item" onClick={it.run}>
              <Icon name={it.icon} size={20} />
              {it.label}
            </div>
          ))}
        </div>, document.body
      )}
    </div>
  );
}
