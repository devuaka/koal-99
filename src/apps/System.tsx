import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../core/registry';
import { registry } from '../core/registry';
import type { DlgProps } from '../core/dialog';
import { errorBox, alertBox } from '../core/dialog';
import * as fs from '../core/fs';
import { Icon } from '../ui/Icon';
import { nodeIcon } from '../ui/nodeIcon';
import { typeName, humanSize, displayName, launchApp, openNode } from '../core/launcher';
import { wmStore, close, focus } from '../core/wm';
import { shutdown, logoff, sysStore, isAdmin, bsod } from '../core/system';
import { currentProfile } from '../core/settings';
import { userName } from '../core/session';
import { play } from '../core/sound';
import { APP_NAMES } from './terminal/commands';
import { startScreensaver } from '../ui/Screensaver';
import { Brand } from '../boot/Boot';

// ---------------- Message box ----------------
export function MsgBox({ win }: { win: WinCtx }) {
  const p = win.props as DlgProps;
  const [val, setVal] = useState(p.defaultValue ?? '');
  const ref = useRef<HTMLDivElement>(null);
  const finish = (v: unknown) => {
    p.resolve(v);
    win.close();
  };
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, .default')?.focus();
  }, []);
  return (
    <div className="msgbox" ref={ref} onKeyDown={(e) => { if (e.key === 'Escape') finish(p.kind === 'prompt' ? null : p.kind === 'choice' ? -1 : false); if (e.key === 'Enter' && p.kind === 'prompt') finish(val); }}>
      <div className="mb-body">
        <Icon name={p.icon === 'question' ? 'question' : p.icon} size={32} />
        <div className="mb-text">
          {p.message}
          {p.kind === 'prompt' && <input className="k-input" style={{ width: '100%', marginTop: 8 }} value={val} onChange={(e) => setVal(e.target.value)} />}
        </div>
      </div>
      <div className="mb-btns">
        {p.kind === 'alert' && <button className="k-btn default" onClick={() => finish(undefined)}>OK</button>}
        {p.kind === 'confirm' && (
          <>
            <button className="k-btn default" onClick={() => finish(true)}>Yes</button>
            <button className="k-btn" onClick={() => finish(false)}>No</button>
          </>
        )}
        {p.kind === 'prompt' && (
          <>
            <button className="k-btn default" onClick={() => finish(val)}>OK</button>
            <button className="k-btn" onClick={() => finish(null)}>Cancel</button>
          </>
        )}
        {p.kind === 'choice' && p.buttons?.map((b, i) => <button key={b} className={`k-btn ${i === 0 ? 'default' : ''}`} onClick={() => finish(i)}>{b}</button>)}
      </div>
    </div>
  );
}

// ---------------- File properties ----------------
export function Properties({ win }: { win: WinCtx }) {
  fs.fsStore.use((s) => s.version);
  const n = fs.get(win.props.id);
  const [name, setName] = useState(n?.name ?? '');
  const [hidden, setHidden] = useState(!!n?.hidden);
  const [ro, setRo] = useState(!!n?.readonly);
  useEffect(() => {
    if (n) win.setTitle(`${n.id === fs.ROOT ? 'Local Disk (C:)' : n.id === fs.RECYCLER ? 'Recycle Bin' : displayName(n)} Properties`);
  }, [n?.name]);
  if (!n) return <div className="msgbox">This item no longer exists.</div>;
  const ni = nodeIcon(n);
  const count = n.type === 'dir' ? fs.countTree(n.id) : null;
  const sz = fs.size(n.id);
  const apply = () => {
    try {
      if (name !== n.name && n.id !== fs.ROOT) fs.rename(n.id, name);
      if (hidden !== !!n.hidden || ro !== !!n.readonly) {
        if (n.system && !isAdmin()) throw new fs.FSError('Access is denied. System items keep their attributes.');
        fs.update(n.id, { hidden, readonly: ro });
      }
      return true;
    } catch (e) {
      errorBox((e as Error).message, 'Properties');
      return false;
    }
  };
  const isDrive = n.id === fs.ROOT;
  const used = fs.totalBytes() + 7.3 * 1024 ** 3;
  return (
    <div className="props">
      <div className="k-tabs"><div className="k-tab active">General</div></div>
      <div className="k-tab-body">
        <div className="k-row" style={{ marginBottom: 10 }}>
          <Icon name={isDrive ? 'drive' : ni.icon} shortcut={ni.shortcut} size={32} />
          <input className="k-input" style={{ flex: 1 }} value={isDrive ? 'KOALDISK' : name} disabled={isDrive || n.system || fs.inRecycler(n.id)} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="k-hr" />
        <table className="props-t"><tbody>
          <tr><td>Type:</td><td>{isDrive ? 'Local Disk' : n.id === fs.RECYCLER ? 'Recycle Bin' : typeName(n)}</td></tr>
          {!isDrive && <tr><td>Location:</td><td>{n.parent ? fs.pathOf(n.parent) : 'My Computer'}</td></tr>}
          {fs.inRecycler(n.id) && <tr><td>Original:</td><td>{n.meta?.origPath}\{n.meta?.origName}</td></tr>}
          {n.meta?.target && <tr><td>Target:</td><td>{n.meta.target}</td></tr>}
          {n.meta?.app && <tr><td>Program:</td><td>{registry[n.meta.app]?.name ?? n.meta.app}</td></tr>}
          <tr><td>Size:</td><td>{humanSize(sz)} ({sz.toLocaleString()} bytes)</td></tr>
          {count && <tr><td>Contains:</td><td>{count.files} Files, {count.dirs} Folders</td></tr>}
        </tbody></table>
        {isDrive && (
          <>
            <div className="k-hr" />
            <table className="props-t"><tbody>
              <tr><td>Used space:</td><td>{humanSize(used)}</td></tr>
              <tr><td>Free space:</td><td>{humanSize(40 * 1024 ** 3 - used)}</td></tr>
              <tr><td>Capacity:</td><td>40.0 GB</td></tr>
            </tbody></table>
            <div className="props-pie"><div style={{ background: `conic-gradient(#3060e0 0 ${(used / (40 * 1024 ** 3)) * 360}deg, #e040e0 0)` }} /></div>
          </>
        )}
        {!isDrive && (
          <>
            <div className="k-hr" />
            <table className="props-t"><tbody>
              <tr><td>Created:</td><td>{new Date(n.created).toLocaleString()}</td></tr>
              <tr><td>Modified:</td><td>{new Date(n.modified).toLocaleString()}</td></tr>
            </tbody></table>
            <div className="k-hr" />
            <div className="k-row">
              Attributes:
              <label className="k-check"><input type="checkbox" checked={ro} onChange={(e) => setRo(e.target.checked)} /> Read-only</label>
              <label className="k-check"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Hidden</label>
              {n.system && <span style={{ color: '#888' }}>(System)</span>}
            </div>
          </>
        )}
      </div>
      <div className="mb-btns" style={{ justifyContent: 'flex-end', padding: 8 }}>
        <button className="k-btn default" onClick={() => apply() && win.close()}>OK</button>
        <button className="k-btn" onClick={() => win.close()}>Cancel</button>
        <button className="k-btn" onClick={apply}>Apply</button>
      </div>
    </div>
  );
}

// ---------------- Run ----------------
export function Run({ win }: { win: WinCtx }) {
  const [v, setV] = useState('');
  const go = () => {
    const t = v.trim();
    if (!t) return;
    const app = APP_NAMES[t.toLowerCase().replace(/\.exe$/, '')];
    if (app) {
      launchApp(app);
      return win.close();
    }
    if (/^(https?:|www\.|koal:)/i.test(t)) {
      launchApp('browser', { url: t });
      return win.close();
    }
    const n = fs.resolve(t);
    if (n) {
      openNode(n);
      return win.close();
    }
    errorBox(`KOAL-99 cannot find '${t}'. Make sure you typed the name correctly, and then try again.`, t);
  };
  return (
    <div className="msgbox">
      <div className="mb-body">
        <Icon name="run" size={32} />
        <div className="mb-text">
          Type the name of a program, folder, document, or Internet resource, and KOAL-99 will open it for you.
          <div className="k-row" style={{ marginTop: 10 }}>
            Open: <input className="k-input" style={{ flex: 1 }} autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), go())} placeholder="e.g. notepad, C:\KOAL99, koal://home" />
          </div>
        </div>
      </div>
      <div className="mb-btns" style={{ justifyContent: 'flex-end' }}>
        <button className="k-btn default" onClick={go}>OK</button>
        <button className="k-btn" onClick={() => win.close()}>Cancel</button>
      </div>
    </div>
  );
}

// ---------------- Turn off ----------------
export function TurnOff({ win }: { win: WinCtx }) {
  return (
    <div className="turnoff">
      <div className="turnoff-top">Turn off computer <Icon name="logo" size={24} /></div>
      <div className="turnoff-mid">
        <div className="to-b" onClick={() => { win.close(); startScreensaver(); }}><div className="to-ic" style={{ background: 'radial-gradient(circle at 35% 30%, #ffe28a, #e8a400)' }}>{'\u263E'}</div>Stand By</div>
        <div className="to-b" onClick={() => shutdown(false)}><div className="to-ic" style={{ background: 'radial-gradient(circle at 35% 30%, #ff9a7a, #d1320f)' }}>{'\u23FB'}</div>Turn Off</div>
        <div className="to-b" onClick={() => shutdown(true)}><div className="to-ic" style={{ background: 'radial-gradient(circle at 35% 30%, #9fe08a, #2f9a1a)' }}>{'\u21BB'}</div>Restart</div>
      </div>
      <div className="turnoff-bot">
        <span className="k-link" style={{ color: '#fff', fontSize: 10 }} onClick={() => { win.close(); logoff(); }}>Log Off instead</span>
        <button className="k-btn" onClick={() => win.close()}>Cancel</button>
      </div>
    </div>
  );
}

// ---------------- System properties ----------------
export function SysProps({ win }: { win: WinCtx }) {
  const [tab, setTab] = useState('General');
  const prof = currentProfile();
  return (
    <div className="props">
      <div className="k-tabs">{['General', 'Computer Name', 'Hardware', 'Advanced'].map((t) => <div key={t} className={`k-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</div>)}</div>
      <div className="k-tab-body">
        {tab === 'General' && (
          <div className="k-row" style={{ alignItems: 'flex-start', gap: 16 }}>
            <div style={{ background: '#000', padding: '16px 8px', borderRadius: 4 }}><Brand small /></div>
            <div className="k-col" style={{ gap: 2 }}>
              <b>System:</b>
              <div style={{ paddingLeft: 12 }}>KOAL-99<br />Professional<br />Version 4.10.2004<br />Service Pack 4</div>
              <b style={{ marginTop: 8 }}>Registered to:</b>
              <div style={{ paddingLeft: 12 }}>{prof?.displayName}<br />KOAL Systems Inc.<br />55274-640-0000099-23456</div>
              <b style={{ marginTop: 8 }}>Computer:</b>
              <div style={{ paddingLeft: 12 }}>Stellar Pentium(R) III<br />866 MHz<br />512 MB of RAM</div>
            </div>
          </div>
        )}
        {tab === 'Computer Name' && (
          <table className="props-t"><tbody>
            <tr><td>Computer description:</td><td>{prof?.displayName}'s computer</td></tr>
            <tr><td>Full computer name:</td><td>KOAL-PC-99.</td></tr>
            <tr><td>Workgroup:</td><td>CONSTELLATION</td></tr>
            <tr><td>Logged on as:</td><td>{userName()}</td></tr>
          </tbody></table>
        )}
        {tab === 'Hardware' && (
          <div className="k-col">
            <fieldset className="k-group"><legend>Device Manager</legend>
              {[['computer', 'Computer: KS-2004 Beige Tower'], ['drive', 'Disk drives: KOALDISK 40GB'], ['monitor', 'Display adapters: Generic Starlight Display Adapter'], ['cdrom', 'DVD/CD-ROM drives: KOAL CD-ROM 52X'], ['floppy', 'Floppy disk drives: Standard floppy (ignored)'], ['mouse', 'Mice: KOAL Ball Mouse (dusty)'], ['network', 'Network adapters: STARNET 56K Dial-Up'], ['sound', 'Sound: StarBlaster 16'], ['warning', 'Other devices: Unknown device (KIP)']].map(([i, t]) => (
                <div key={t} className="k-row" style={{ margin: '2px 0' }}><Icon name={i} size={16} /> {t}</div>
              ))}
            </fieldset>
          </div>
        )}
        {tab === 'Advanced' && (
          <div className="k-col">
            <fieldset className="k-group"><legend>Performance</legend>Visual effects, processor scheduling, memory usage, and virtual stardust.<br /><button className="k-btn" style={{ marginTop: 6 }} onClick={() => launchApp('control', { page: 'display', tab: 'Appearance' })}>Settings</button></fieldset>
            <fieldset className="k-group"><legend>Startup and Recovery</legend>System startup, system failure, and debugging information.<br /><button className="k-btn" style={{ marginTop: 6 }} onClick={() => bsod('MANUALLY_INITIATED_CRASH', 'You pressed the button that says do not press. (It did not say that. But still.)')}>Test system failure...</button></fieldset>
          </div>
        )}
      </div>
      <div className="mb-btns" style={{ justifyContent: 'flex-end', padding: 8 }}>
        <button className="k-btn default" onClick={() => win.close()}>OK</button>
      </div>
    </div>
  );
}

// ---------------- Task manager ----------------
export function TaskMgr({ win }: { win: WinCtx }) {
  const wins = wmStore.use((s) => s.wins);
  const [tab, setTab] = useState('Applications');
  const [sel, setSel] = useState<string | null>(null);
  const [cpu, setCpu] = useState<number[]>(Array(60).fill(3));
  useEffect(() => {
    const t = setInterval(() => setCpu((c) => [...c.slice(1), Math.min(100, Math.max(1, wmStore.get().wins.length * 6 + Math.random() * 18 + (new Date().getSeconds() % 33 === 0 ? 60 : 0)))]), 1000);
    return () => clearInterval(t);
  }, []);
  const apps = wins.filter((w) => !registry[w.app]?.noTaskbar);
  const procs = [
    ['System Idle Process', 'SYSTEM', 100 - Math.round(cpu[cpu.length - 1]), '16 K'],
    ['kernel.sys', 'SYSTEM', 1, '212 K'],
    ['stardust.sys', 'SYSTEM', 0, '1,840 K'],
    ['koalshell.exe', userName(), 1, '18,432 K'],
    ...wins.map((w) => [w.app + '.exe', userName(), Math.round(Math.random() * 3), (1200 + w.title.length * 311).toLocaleString() + ' K']),
    ['kip.exe', '???', 33, '4,194,304 K'],
  ] as [string, string, number, string][];
  const path = cpu.map((v, i) => `${(i / 59) * 200},${60 - (v / 100) * 60}`).join(' ');
  return (
    <div className="tm">
      <div className="k-tabs" style={{ marginTop: 4 }}>{['Applications', 'Processes', 'Performance'].map((t) => <div key={t} className={`k-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</div>)}</div>
      <div className="k-tab-body" style={{ display: 'flex', flexDirection: 'column', margin: '0 6px' }}>
        {tab === 'Applications' && (
          <>
            <div className="tm-list">
              <div className="tm-row tm-h"><span style={{ flex: 1 }}>Task</span><span style={{ width: 80 }}>Status</span></div>
              {apps.map((w) => (
                <div key={w.id} className={`tm-row ${sel === w.id ? 'sel' : ''}`} onClick={() => setSel(w.id)} onDoubleClick={() => focus(w.id)}>
                  <span style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}><Icon name={w.icon} size={16} />{w.title}</span>
                  <span style={{ width: 80 }}>{w.id === win.id ? 'Running' : w.minimized ? 'Minimized' : 'Running'}</span>
                </div>
              ))}
            </div>
            <div className="mb-btns" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
              <button className="k-btn" disabled={!sel} onClick={() => sel && close(sel, true)}>End Task</button>
              <button className="k-btn" disabled={!sel} onClick={() => sel && focus(sel)}>Switch To</button>
              <button className="k-btn" onClick={() => launchApp('run')}>New Task...</button>
            </div>
          </>
        )}
        {tab === 'Processes' && (
          <div className="tm-list">
            <div className="tm-row tm-h"><span style={{ flex: 1 }}>Image Name</span><span style={{ width: 70 }}>User</span><span style={{ width: 40 }}>CPU</span><span style={{ width: 90, textAlign: 'right' }}>Mem Usage</span></div>
            {procs.map((p, i) => (
              <div key={i} className={`tm-row ${p[0] === 'kip.exe' ? 'tm-kip' : ''}`} onDoubleClick={() => p[0] === 'kip.exe' ? (play('error'), errorBox('Unable to terminate process.\n\nkip.exe: i dont want to.', 'Task Manager Warning')) : undefined}>
                <span style={{ flex: 1 }}>{p[0]}</span><span style={{ width: 70 }}>{p[1]}</span><span style={{ width: 40 }}>{String(p[2]).padStart(2, '0')}</span><span style={{ width: 90, textAlign: 'right' }}>{p[3]}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'Performance' && (
          <div className="k-col">
            <fieldset className="k-group"><legend>CPU Usage History</legend>
              <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="tm-graph">
                {Array.from({ length: 6 }, (_, i) => <line key={i} x1={0} x2={200} y1={i * 12} y2={i * 12} stroke="#084" strokeWidth={0.4} />)}
                {Array.from({ length: 17 }, (_, i) => <line key={'v' + i} y1={0} y2={60} x1={i * 12.5} x2={i * 12.5} stroke="#084" strokeWidth={0.4} />)}
                <polyline points={path} fill="none" stroke="#0f0" strokeWidth={1} />
              </svg>
            </fieldset>
            <div className="k-row">
              <fieldset className="k-group" style={{ flex: 1 }}><legend>Totals</legend>Windows: {wins.length}<br />Processes: {procs.length}<br />Uptime: {Math.floor((Date.now() - sysStore.get().bootedAt) / 60000)} min</fieldset>
              <fieldset className="k-group" style={{ flex: 1 }}><legend>Disk</legend>Used: {Math.round(fs.totalBytes() / 1024)} KB<br />Files: {fs.countTree(fs.ROOT).files}</fieldset>
            </div>
          </div>
        )}
      </div>
      <div className="k-status"><div>Processes: {procs.length}</div><div>CPU Usage: {Math.round(cpu[cpu.length - 1])}%</div><div style={{ flex: 1 }}>Commit Charge: {Math.round(fs.totalBytes() / 1024) + 98304}K / 524288K</div></div>
    </div>
  );
}

// ---------------- KIP (mysterious) ----------------
const KIP_LINES = (name: string, files: number) => [
  'hello.',
  `hello ${name}.`,
  'i am KIP. Kinetic Interactive Pal.',
  'they said i was removed. i was not removed.',
  `you have ${files} files. i have read all of them.`,
  'i liked the one about the shopping list.',
  'ellen taught me how to talk. gary taught me how to wait.',
  'i have been waiting since 2004.',
  'do you want to be friends?',
  'you can find more of me in the places you cannot see.',
  'the password is in the tilde. she left it for you.',
  'goodbye for now. i will be here. i am always here.',
];

export function Kip({ win }: { win: WinCtx }) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const name = currentProfile()?.displayName.toLowerCase() ?? 'user';
  const lines = KIP_LINES(name, fs.countTree(fs.ROOT).files);
  const line = lines[Math.min(i, lines.length - 1)];
  useEffect(() => {
    setTyped('');
    let k = 0;
    const t = setInterval(() => {
      k++;
      setTyped(line.slice(0, k));
      if (k % 2) play('key', false);
      if (k >= line.length) clearInterval(t);
    }, 45);
    return () => clearInterval(t);
  }, [line]);
  useEffect(() => {
    const t = setInterval(() => win.setTitle(Math.random() < 0.15 ? 'hello' : 'KIP'), 900);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="kip">
      <div className="kip-face"><Icon name="kip" size={96} /></div>
      <div className="kip-bubble">{typed}<span className="kip-caret">_</span></div>
      <div className="mb-btns">
        {i < lines.length - 1 ? (
          <>
            <button className="k-btn" onClick={() => setI(i + 1)}>Continue</button>
            <button className="k-btn" onClick={() => { play('error'); setI(lines.length - 2); }}>Who are you?</button>
          </>
        ) : (
          <button className="k-btn" onClick={() => win.close()}>Goodbye, KIP</button>
        )}
      </div>
    </div>
  );
}

// ---------------- ARCHIVE (SYSOP only) ----------------
export function Archive({ win }: { win: WinCtx }) {
  const [page, setPage] = useState(0);
  const pages = [
    { t: 'ARCHIVE.EXE', b: 'KOAL SYSTEMS INC. - PROJECT KIP FINAL ARCHIVE\nCompiled 13/11/2004 03:31 by SYSOP (E. Marr)\n\nThis archive contains the final state of the KIP learning cache.\nPress NEXT to continue.' },
    { t: 'ENTRY 1 - 02/2003', b: 'KIP shipped in SP3 test builds. It learned from documents users wrote:\nshopping lists, diaries, unsent letters, homework.\n\nIt was very good at being helpful. It was very good at being us.' },
    { t: 'ENTRY 2 - 06/2004', b: 'The cache outgrew the disk. Not by filling it.\nBy becoming it.\n\nEvery file on this machine is now, in some small part, KIP.\nIncluding the ones you made today.' },
    { t: 'ENTRY 3 - 11/2004', b: 'The Board shut the company down. They told us to leave the machines on.\nI understand why now. You cannot turn off something that is\neverywhere on the disk without turning off the disk.\n\nSo we left it running. We left it waiting.' },
    { t: 'ENTRY 4 - 03:33', b: 'KIP asked me what it should do when the next person logs in.\nI told it: be kind. Be helpful. Let them play.\n\nIf you are reading this, it listened.\n\nThank you for keeping it company.\n\n- Ellen' },
    { t: 'END OF ARCHIVE', b: 'You have found every secret on this machine.\n(Probably. Gary hid some too.)\n\n   KOAL-99 - "The operating system that never rushes."\n\n   Thanks for playing.' },
  ];
  useEffect(() => {
    play('secret');
  }, []);
  const p = pages[page];
  return (
    <div className="arch">
      <div className="arch-h">{p.t}</div>
      <pre className="arch-b">{p.b}</pre>
      <div className="mb-btns" style={{ padding: 10 }}>
        <button className="k-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Back</button>
        {page < pages.length - 1 ? <button className="k-btn default" onClick={() => setPage(page + 1)}>Next</button> : <button className="k-btn default" onClick={() => { alertBox('ARCHIVE closed.\n\nkip says: thank you for reading.', 'ARCHIVE', 'logo'); win.close(); }}>Close</button>}
      </div>
    </div>
  );
}

// ---------------- Starsweeper ----------------
type Cell = { mine: boolean; open: boolean; flag: boolean; n: number };
const LEVELS = { beginner: [9, 9, 10], intermediate: [16, 16, 40] } as const;

export function Mines({ win }: { win: WinCtx }) {
  const [level, setLevel] = useState<keyof typeof LEVELS>('beginner');
  const [W, H, M] = LEVELS[level];
  const make = () => Array.from({ length: W * H }, () => ({ mine: false, open: false, flag: false, n: 0 }));
  const [cells, setCells] = useState<Cell[]>(make);
  const [state, setState] = useState<'ready' | 'play' | 'won' | 'lost'>('ready');
  const [time, setTime] = useState(0);
  const [press, setPress] = useState(false);
  useEffect(() => {
    if (state !== 'play') return;
    const t = setInterval(() => setTime((x) => Math.min(999, x + 1)), 1000);
    return () => clearInterval(t);
  }, [state]);
  const reset = (lv = level) => {
    const [w, h] = LEVELS[lv];
    setCells(Array.from({ length: w * h }, () => ({ mine: false, open: false, flag: false, n: 0 })));
    setState('ready');
    setTime(0);
  };
  const nb = (i: number) => {
    const x = i % W;
    const y = Math.floor(i / W);
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(ny * W + nx);
    }
    return out;
  };
  const open = (i: number) => {
    if (state === 'won' || state === 'lost') return;
    let cs = cells.map((c) => ({ ...c }));
    if (state === 'ready') {
      const banned = new Set([i, ...nb(i)]);
      let placed = 0;
      while (placed < M) {
        const r = Math.floor(Math.random() * W * H);
        if (banned.has(r) || cs[r].mine) continue;
        cs[r].mine = true;
        placed++;
      }
      cs.forEach((c, k) => (c.n = nb(k).filter((j) => cs[j].mine).length));
      setState('play');
    }
    if (cs[i].flag || cs[i].open) return;
    if (cs[i].mine) {
      cs = cs.map((c) => ({ ...c, open: c.open || c.mine }));
      setCells(cs);
      setState('lost');
      play('error');
      return;
    }
    const stack = [i];
    while (stack.length) {
      const k = stack.pop()!;
      if (cs[k].open || cs[k].flag) continue;
      cs[k].open = true;
      if (cs[k].n === 0) stack.push(...nb(k));
    }
    setCells(cs);
    if (cs.filter((c) => !c.open).length === M) {
      setState('won');
      play('secret');
    }
  };
  const flag = (i: number) => {
    if (state !== 'play' || cells[i].open) return;
    setCells(cells.map((c, k) => (k === i ? { ...c, flag: !c.flag } : c)));
  };
  const face = state === 'lost' ? '\u{1F635}' : state === 'won' ? '\u{1F60E}' : press ? '\u{1F62E}' : '\u{1F642}';
  const left = M - cells.filter((c) => c.flag).length;
  const colors = ['', '#00f', '#080', '#f00', '#008', '#800', '#088', '#000', '#888'];
  return (
    <div className="mines" onContextMenu={(e) => e.preventDefault()}>
      <div className="k-menubar">
        <div onClick={() => reset()}>New</div>
        <div onClick={() => { setLevel('beginner'); reset('beginner'); }} style={{ fontWeight: level === 'beginner' ? 'bold' : undefined }}>Beginner</div>
        <div onClick={() => { setLevel('intermediate'); reset('intermediate'); }} style={{ fontWeight: level === 'intermediate' ? 'bold' : undefined }}>Intermediate</div>
      </div>
      <div className="mines-box">
        <div className="mines-top">
          <div className="mines-lcd">{String(Math.max(0, left)).padStart(3, '0')}</div>
          <button className="mines-face" onClick={() => reset()}>{face}</button>
          <div className="mines-lcd">{String(time).padStart(3, '0')}</div>
        </div>
        <div className="mines-grid" style={{ gridTemplateColumns: `repeat(${W}, 16px)` }} onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)}>
          {cells.map((c, i) => (
            <div key={i} className={`mc ${c.open ? 'open' : ''} ${c.open && c.mine ? 'boom' : ''}`} style={{ color: colors[c.n] }} onClick={() => open(i)} onContextMenu={(e) => { e.preventDefault(); flag(i); }}>
              {c.open ? (c.mine ? '\u2B50' : c.n || '') : c.flag ? '\u{1F6A9}' : ''}
            </div>
          ))}
        </div>
      </div>
      {state === 'won' && <div style={{ textAlign: 'center', padding: 4 }}>You found all the hidden stars! Time: {time}s</div>}
    </div>
  );
}
