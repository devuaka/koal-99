import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../core/registry';
import { useSettings, setSettings, settingsStore, currentProfile, updateProfile, addProfile, deleteProfile, profiles, ThemeId, ScreensaverKind } from '../core/settings';
import { WALLPAPERS, wallpaperProps } from '../ui/wallpaper';
import { SaverCanvas, startScreensaver } from '../ui/Screensaver';
import { Icon } from '../ui/Icon';
import { play, SoundName } from '../core/sound';
import { confirmBox, errorBox, alertBox, promptBox } from '../core/dialog';
import { launchApp } from '../core/launcher';
import * as fs from '../core/fs';
import { seedSystem } from '../core/seed';
import { shutdown, isAdmin } from '../core/system';
import { registry } from '../core/registry';
import { TERM_THEMES } from './terminal/commands';

type Page = 'home' | 'display' | 'sound' | 'users' | 'datetime' | 'folders' | 'programs' | 'system' | 'terminal';

const CATS: { id: Page; label: string; icon: string; desc: string }[] = [
  { id: 'display', label: 'Appearance and Themes', icon: 'palette', desc: 'Change the wallpaper, screen saver, or theme' },
  { id: 'sound', label: 'Sounds and Audio', icon: 'sound', desc: 'Change volume, mute, test system sounds' },
  { id: 'users', label: 'User Accounts', icon: 'user', desc: 'Change your picture, name, or password' },
  { id: 'datetime', label: 'Date and Time', icon: 'clock', desc: 'Clock format and calendar' },
  { id: 'folders', label: 'Folder Options', icon: 'folder', desc: 'Hidden files, extensions, views' },
  { id: 'terminal', label: 'Terminal', icon: 'terminal', desc: 'Terminal colors and theme' },
  { id: 'programs', label: 'Add or Remove Programs', icon: 'exe', desc: 'See installed programs' },
  { id: 'system', label: 'Performance and Maintenance', icon: 'monitor', desc: 'System information, reset KOAL-99' },
];

export function ControlPanel({ win }: { win: WinCtx }) {
  const [page, setPage] = useState<Page>((win.props.page as Page) ?? 'home');
  useEffect(() => {
    if (win.props._nonce && win.props.page) setPage(win.props.page);
  }, [win.props._nonce]);
  useEffect(() => {
    win.setTitle(page === 'home' ? 'Control Panel' : CATS.find((c) => c.id === page)?.label ?? 'Control Panel');
  }, [page]);

  return (
    <div className="cp">
      <div className="ex-main" style={{ flex: 1 }}>
        <div className="ex-side">
          <div className="ex-box">
            <div className="ex-box-h">Control Panel</div>
            <div className="ex-box-b">
              <div className="ex-task" onClick={() => setPage('home')}><Icon name="control" size={16} /> {page === 'home' ? 'Pick a category' : 'Back to categories'}</div>
            </div>
          </div>
          <div className="ex-box">
            <div className="ex-box-h">See Also</div>
            <div className="ex-box-b">
              <div className="ex-task" onClick={() => launchApp('sysprops')}><Icon name="monitor" size={16} /> System Properties</div>
              <div className="ex-task" onClick={() => launchApp('taskmgr')}><Icon name="taskmgr" size={16} /> Task Manager</div>
              <div className="ex-task" onClick={() => launchApp('support', { tab: 'kb' })}><Icon name="help" size={16} /> Help and Support</div>
            </div>
          </div>
        </div>
        <div className="cp-body">
          {page === 'home' && (
            <>
              <h2 className="cp-h">Pick a category</h2>
              <div className="cp-cats">
                {CATS.map((c) => (
                  <div key={c.id} className="cp-cat" onClick={() => setPage(c.id)}>
                    <Icon name={c.icon} size={32} />
                    <div><b className="k-link" style={{ textDecoration: 'none' }}>{c.label}</b><div>{c.desc}</div></div>
                  </div>
                ))}
              </div>
            </>
          )}
          {page === 'display' && <DisplayPage initialTab={win.props.tab} />}
          {page === 'sound' && <SoundPage />}
          {page === 'users' && <UsersPage />}
          {page === 'datetime' && <DateTimePage />}
          {page === 'folders' && <FolderPage />}
          {page === 'terminal' && <TerminalPage />}
          {page === 'programs' && <ProgramsPage />}
          {page === 'system' && <SystemPage />}
        </div>
      </div>
    </div>
  );
}

function Tabs({ tabs, cur, set }: { tabs: string[]; cur: string; set: (t: string) => void }) {
  return (
    <div className="k-tabs">
      {tabs.map((t) => (
        <div key={t} className={`k-tab ${cur === t ? 'active' : ''}`} onClick={() => set(t)}>{t}</div>
      ))}
    </div>
  );
}

const THEMES: { id: ThemeId; name: string }[] = [
  { id: 'aero', name: 'Aero Sky (default)' },
  { id: 'leaf', name: 'Aero Leaf' },
  { id: 'graphite', name: 'Aero Graphite' },
  { id: 'classic', name: 'KOAL Classic (1999)' },
];

function DisplayPage({ initialTab }: { initialTab?: string }) {
  const s = useSettings();
  const [tab, setTab] = useState(initialTab ?? 'Desktop');
  const file = useRef<HTMLInputElement>(null);
  const wp = wallpaperProps(s.wallpaper);
  const pickImage = (f: File | undefined) => {
    if (!f) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      setSettings({ wallpaper: { kind: 'image', value: c.toDataURL('image/jpeg', 0.82), fit: 'cover' } });
    };
    img.onerror = () => errorBox('That file is not a picture KOAL-99 can read.', 'Display Properties');
    img.src = url;
  };
  const themes = isAdmin() ? [...THEMES, { id: 'sysop' as ThemeId, name: 'SYSOP' }] : THEMES;
  return (
    <div className="cp-page">
      <h2 className="cp-h">Display Properties</h2>
      <Tabs tabs={['Themes', 'Desktop', 'Screen Saver', 'Appearance', 'Settings']} cur={tab} set={setTab} />
      <div className="k-tab-body">
        {(tab === 'Desktop' || tab === 'Themes') && (
          <div className="cp-monitor">
            <div className="cp-screen"><div className={wp.className} style={{ ...wp.style, position: 'absolute', inset: 0 }} /></div>
          </div>
        )}
        {tab === 'Themes' && (
          <div className="k-col">
            <label>Theme:</label>
            <select className="k-input" value={s.theme} onChange={(e) => setSettings({ theme: e.target.value as ThemeId })}>
              {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p style={{ color: '#555' }}>A theme changes window colors, the taskbar and the Start menu.</p>
          </div>
        )}
        {tab === 'Desktop' && (
          <div className="k-row" style={{ alignItems: 'flex-start' }}>
            <div className="k-col" style={{ flex: 1 }}>
              <label>Background:</label>
              <div className="cp-list">
                {WALLPAPERS.map((w) => (
                  <div key={w.id} className={`cp-li ${s.wallpaper.kind === 'preset' && s.wallpaper.value === w.id ? 'sel' : ''}`} onClick={() => setSettings({ wallpaper: { kind: 'preset', value: w.id } })}>
                    <Icon name="image" size={16} /> {w.name}
                  </div>
                ))}
                {s.wallpaper.kind === 'image' && <div className="cp-li sel"><Icon name="image" size={16} /> (Your picture)</div>}
                {s.wallpaper.kind === 'color' && <div className="cp-li sel"><Icon name="palette" size={16} /> (Solid color)</div>}
              </div>
            </div>
            <div className="k-col" style={{ width: 150 }}>
              <button className="k-btn" onClick={() => file.current?.click()}>Browse...</button>
              <input ref={file} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ''; }} />
              <small style={{ color: '#666' }}>Pick a picture from your real computer. It is copied into this browser only.</small>
              {s.wallpaper.kind === 'image' && (
                <>
                  <label>Position:</label>
                  <select className="k-input" value={s.wallpaper.fit} onChange={(e) => s.wallpaper.kind === 'image' && setSettings({ wallpaper: { ...s.wallpaper, fit: e.target.value as 'cover' | 'center' | 'tile' } })}>
                    <option value="cover">Stretch</option>
                    <option value="center">Center</option>
                    <option value="tile">Tile</option>
                  </select>
                </>
              )}
              <label>Solid color:</label>
              <input type="color" value={s.wallpaper.kind === 'color' ? s.wallpaper.value : '#3a6ea5'} onChange={(e) => setSettings({ wallpaper: { kind: 'color', value: e.target.value } })} />
            </div>
          </div>
        )}
        {tab === 'Screen Saver' && (
          <div className="k-col">
            <div className="cp-monitor"><div className="cp-screen"><SaverCanvas kind={s.screensaver} preview /></div></div>
            <div className="k-row">
              <select className="k-input" value={s.screensaver} onChange={(e) => setSettings({ screensaver: e.target.value as ScreensaverKind })}>
                <option value="none">(None)</option>
                <option value="starfield">Starfield</option>
                <option value="logo">KOAL-99 Logo</option>
                <option value="matrix">Digital Rain</option>
                <option value="pipes">Pipes</option>
              </select>
              <button className="k-btn" disabled={s.screensaver === 'none'} onClick={() => setTimeout(startScreensaver, 300)}>Preview</button>
            </div>
            <div className="k-row">
              Wait: <input className="k-input" type="number" min={1} max={60} style={{ width: 50 }} value={s.screensaverMinutes} onChange={(e) => setSettings({ screensaverMinutes: Math.max(1, Math.min(60, +e.target.value || 1)) })} /> minutes
            </div>
          </div>
        )}
        {tab === 'Appearance' && (
          <div className="k-col">
            <label>Windows and buttons:</label>
            <select className="k-input" value={s.theme} onChange={(e) => setSettings({ theme: e.target.value as ThemeId })}>
              {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label className="k-check"><input type="checkbox" checked={s.fontSmoothing} onChange={(e) => setSettings({ fontSmoothing: e.target.checked })} /> Smooth edges of screen fonts</label>
            <label className="k-check"><input type="checkbox" checked={s.animations} onChange={(e) => setSettings({ animations: e.target.checked })} /> Animate windows when opening</label>
          </div>
        )}
        {tab === 'Settings' && (
          <div className="k-col">
            <div className="cp-monitor"><div className="cp-screen" style={{ background: '#3a6ea5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 30, fontWeight: 'bold' }}>1</div></div>
            <div>Display: <b>Plug and Play Monitor on Generic Starlight Display Adapter</b></div>
            <div className="k-row">
              <fieldset className="k-group" style={{ flex: 1 }}>
                <legend>Screen resolution</legend>
                <div>{window.innerWidth} by {window.innerHeight} pixels</div>
                <small style={{ color: '#666' }}>Resize your real browser window to change it.</small>
              </fieldset>
              <fieldset className="k-group" style={{ flex: 1 }}>
                <legend>Color quality</legend>
                <select className="k-input" defaultValue="32"><option value="16">Medium (16 bit)</option><option value="32">Highest (32 bit)</option></select>
              </fieldset>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SOUNDS: [SoundName, string][] = [['startup', 'Start KOAL-99'], ['shutdown', 'Exit KOAL-99'], ['logon', 'Logon'], ['ding', 'Default Beep'], ['error', 'Critical Stop'], ['exclaim', 'Exclamation'], ['notify', 'Notification'], ['recycle', 'Empty Recycle Bin'], ['open', 'Open Program'], ['minimize', 'Minimize'], ['maximize', 'Maximize'], ['secret', '???']];

function SoundPage() {
  const s = useSettings();
  return (
    <div className="cp-page">
      <h2 className="cp-h">Sounds and Audio Devices</h2>
      <fieldset className="k-group">
        <legend>Device volume</legend>
        <div className="k-row">
          <Icon name="sound" />
          <span>Low</span>
          <input type="range" min={0} max={100} value={Math.round(s.volume * 100)} onChange={(e) => setSettings({ volume: +e.target.value / 100 })} onPointerUp={() => play('ding')} style={{ flex: 1 }} />
          <span>High</span>
        </div>
        <label className="k-check"><input type="checkbox" checked={s.muted} onChange={(e) => setSettings({ muted: e.target.checked })} /> Mute all system sounds</label>
      </fieldset>
      <fieldset className="k-group">
        <legend>Program events</legend>
        <div className="cp-list" style={{ height: 200 }}>
          {SOUNDS.map(([id, label]) => (
            <div key={id} className="cp-li" onClick={() => play(id, true)}>
              <Icon name="sound" size={16} /> {label} <span className="k-spacer" /> <span className="k-link">{'\u25B6'} Test</span>
            </div>
          ))}
        </div>
        <small style={{ color: '#666' }}>All KOAL-99 sounds are synthesized live. No WAV files were harmed.</small>
      </fieldset>
    </div>
  );
}

const AVATARS = ['star', 'fish', 'flower', 'robot', 'guitar', 'duck', 'user'];

function UsersPage() {
  const prof = currentProfile();
  const [, force] = useState(0);
  settingsStore.use((s) => s.profiles);
  if (!prof) return null;
  const sysop = prof.username === 'sysop';
  return (
    <div className="cp-page">
      <h2 className="cp-h">User Accounts</h2>
      <div className="k-row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div className="sm-avatar" style={{ borderColor: '#7f9db9' }}><Icon name={prof.avatar} size={64} /></div>
        <div className="k-col">
          <b style={{ fontSize: 16 }}>{prof.displayName}</b>
          <div>{sysop ? 'Computer administrator (SYSOP)' : 'Computer user'} {prof.password ? '\u2022 Password protected' : ''}</div>
          {sysop && <div style={{ color: '#900' }}>The SYSOP account cannot be changed. It was built that way.</div>}
        </div>
      </div>
      {!sysop && (
        <>
          <fieldset className="k-group">
            <legend>Change my picture</legend>
            <div className="k-row" style={{ flexWrap: 'wrap' }}>
              {AVATARS.map((a) => (
                <div key={a} onClick={() => { updateProfile(prof.username, { avatar: a }); force((x) => x + 1); }} style={{ padding: 3, border: '2px solid ' + (prof.avatar === a ? '#316ac5' : 'transparent'), borderRadius: 3, cursor: 'pointer' }}>
                  <Icon name={a} size={40} />
                </div>
              ))}
            </div>
          </fieldset>
          <div className="k-row" style={{ flexWrap: 'wrap' }}>
            <button className="k-btn" onClick={async () => { const n = await promptBox('Type a new name for your account:', prof.displayName, 'Change Name'); if (n?.trim()) updateProfile(prof.username, { displayName: n.trim().slice(0, 20) }); }}>Change my name</button>
            <button className="k-btn" onClick={async () => { const p = await promptBox('Type a new password (leave blank to remove it).\nIt is stored in this browser only; do not reuse a real password.', '', 'Change Password'); if (p !== null) { updateProfile(prof.username, { password: p || undefined }); alertBox(p ? 'Your password has been changed.' : 'Your password has been removed.', 'User Accounts'); } }}>{prof.password ? 'Change my password' : 'Create a password'}</button>
          </div>
        </>
      )}
      <fieldset className="k-group">
        <legend>Other accounts</legend>
        {profiles().map((p) => (
          <div key={p.username} className="k-row" style={{ marginBottom: 4 }}>
            <Icon name={p.avatar} size={24} />
            <span style={{ flex: 1 }}>{p.displayName} <small style={{ color: '#777' }}>({p.username})</small></span>
            {p.username !== prof.username && (
              <button className="k-btn small" onClick={async () => { if (await confirmBox(`Delete the account "${p.displayName}"? Their settings are removed. Their files stay in C:\\Users\\${p.username}.`, 'Delete Account', 'warning')) { deleteProfile(p.username); force((x) => x + 1); } }}>Delete</button>
            )}
          </div>
        ))}
        <button className="k-btn" onClick={async () => { const n = await promptBox('Name for the new account:', '', 'Create a new account'); if (n?.trim()) { addProfile(n.trim().slice(0, 20), AVATARS[Math.floor(Math.random() * 5)]); force((x) => x + 1); } }}>Create a new account</button>
      </fieldset>
    </div>
  );
}

function DateTimePage() {
  const s = useSettings();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const a = (deg: number, len: number, w: number, c: string) => <line x1="60" y1="60" x2={60 + Math.sin((deg * Math.PI) / 180) * len} y2={60 - Math.cos((deg * Math.PI) / 180) * len} stroke={c} strokeWidth={w} strokeLinecap="round" />;
  return (
    <div className="cp-page">
      <h2 className="cp-h">Date and Time Properties</h2>
      <div className="k-row" style={{ alignItems: 'flex-start', gap: 20 }}>
        <svg width="140" height="140" viewBox="0 0 120 120" style={{ background: '#fff', borderRadius: '50%', border: '2px solid #7f9db9' }}>
          {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={60 + Math.sin((i * 30 * Math.PI) / 180) * 50} cy={60 - Math.cos((i * 30 * Math.PI) / 180) * 50} r={i % 3 ? 1.5 : 3} fill="#0c3a9a" />)}
          {a(((now.getHours() % 12) + now.getMinutes() / 60) * 30, 28, 4, '#000')}
          {a((now.getMinutes() + now.getSeconds() / 60) * 6, 40, 3, '#000')}
          {a(now.getSeconds() * 6, 44, 1, '#e23b2e')}
        </svg>
        <div className="k-col">
          <div style={{ fontSize: 22, fontWeight: 'bold' }}>{now.toLocaleTimeString([], { hour12: !s.clock24 })}</div>
          <div>{now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <label className="k-check"><input type="checkbox" checked={s.clock24} onChange={(e) => setSettings({ clock24: e.target.checked })} /> Use 24-hour clock</label>
          <div>Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone} (from your real computer)</div>
          <small style={{ color: '#666' }}>KOAL-99 reads the time from your real computer and will not let you change it. Time is a construct.</small>
        </div>
      </div>
    </div>
  );
}

function FolderPage() {
  const s = useSettings();
  return (
    <div className="cp-page">
      <h2 className="cp-h">Folder Options</h2>
      <fieldset className="k-group">
        <legend>Hidden files and folders</legend>
        <label className="k-check"><input type="radio" checked={!s.showHidden} onChange={() => setSettings({ showHidden: false })} /> Do not show hidden files and folders</label>
        <label className="k-check"><input type="radio" checked={s.showHidden} onChange={() => setSettings({ showHidden: true })} /> Show hidden files and folders</label>
      </fieldset>
      <fieldset className="k-group">
        <legend>Advanced</legend>
        <label className="k-check"><input type="checkbox" checked={!s.showExtensions} onChange={(e) => setSettings({ showExtensions: !e.target.checked })} /> Hide extensions for known file types</label>
      </fieldset>
      <fieldset className="k-group">
        <legend>Default view</legend>
        <select className="k-input" value={s.explorerView} onChange={(e) => setSettings({ explorerView: e.target.value as 'icons' })}>
          <option value="icons">Icons</option><option value="tiles">Tiles</option><option value="list">List</option><option value="details">Details</option>
        </select>
      </fieldset>
      <fieldset className="k-group">
        <legend>Desktop</legend>
        <button className="k-btn" onClick={() => setSettings({ iconPositions: {} })}>Reset desktop icon layout</button>
      </fieldset>
    </div>
  );
}

function TerminalPage() {
  const s = useSettings();
  return (
    <div className="cp-page">
      <h2 className="cp-h">Terminal</h2>
      <div className="cp-list" style={{ height: 'auto' }}>
        {Object.entries(TERM_THEMES).filter(([k]) => k !== 'kip').map(([k, t]) => (
          <div key={k} className={`cp-li ${s.terminalTheme === k ? 'sel' : ''}`} onClick={() => setSettings({ terminalTheme: k })}>
            <span style={{ background: t.bg, color: t.fg, fontFamily: 'var(--mono)', padding: '2px 6px', border: '1px solid #888' }}>C:\&gt;_</span> {t.name}
          </div>
        ))}
      </div>
      <p style={{ color: '#555' }}>Tip: the COLOR command also works, DOS style. Try <code>color 0A</code> or <code>color 1F</code>.</p>
    </div>
  );
}

function ProgramsPage() {
  const progs = Object.values(registry).filter((d) => !d.hidden || d.id === 'kip');
  return (
    <div className="cp-page">
      <h2 className="cp-h">Add or Remove Programs</h2>
      <div className="cp-list" style={{ height: 300 }}>
        {progs.map((p) => (
          <div key={p.id} className="cp-li" style={{ padding: 6 }}>
            <Icon name={p.icon} size={24} />
            <div style={{ flex: 1 }}><b>{p.name}</b><br /><small style={{ color: '#666' }}>{p.description ?? 'KOAL Systems Inc.'}</small></div>
            <small style={{ color: '#666', width: 70 }}>Size {((p.name.length * 1.37) % 9 + 0.4).toFixed(2)}MB</small>
            <button className="k-btn small" onClick={() => p.id === 'kip' ? errorBox('KIP cannot be removed.\n\nKIP does not want to be removed.', 'Add or Remove Programs') : errorBox(`${p.name} cannot be removed. It is a load-bearing program.\n\nRemoving it would cause KOAL-99 to become sad.`, 'Add or Remove Programs')}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemPage() {
  const { files, dirs } = fs.countTree(fs.ROOT);
  return (
    <div className="cp-page">
      <h2 className="cp-h">Performance and Maintenance</h2>
      <div className="k-row" style={{ flexWrap: 'wrap' }}>
        <button className="k-btn" onClick={() => launchApp('sysprops')}>System Properties</button>
        <button className="k-btn" onClick={() => launchApp('taskmgr')}>Task Manager</button>
        <button className="k-btn" onClick={() => launchApp('support', { tab: 'diag' })}>Run Diagnostics</button>
      </div>
      <fieldset className="k-group">
        <legend>Pretend hard drive</legend>
        <div>{files} files and {dirs} folders, {Math.round(fs.totalBytes() / 1024)} KB used.</div>
        <div>Stored in this browser's IndexedDB. Nothing leaves your computer.</div>
      </fieldset>
      <fieldset className="k-group">
        <legend>Reset</legend>
        <p>Erase every pretend file for every user and reinstall KOAL-99 from scratch. User accounts and settings are kept.</p>
        <button className="k-btn" onClick={async () => {
          if (!(await confirmBox('This erases ALL files on the pretend C: drive (every user) and restarts KOAL-99.\n\nAre you absolutely sure?', 'Reset KOAL-99', 'warning'))) return;
          await fs.formatDisk(seedSystem);
          shutdown(true);
        }}>Reset file system...</button>
      </fieldset>
    </div>
  );
}
