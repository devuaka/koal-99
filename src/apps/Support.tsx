import { useEffect, useState } from 'react';
import type { WinCtx } from '../core/registry';
import * as fs from '../core/fs';
import { Icon } from '../ui/Icon';
import { userName, documentsDir, desktopDir } from '../core/session';
import { currentProfile } from '../core/settings';
import { wmStore } from '../core/wm';
import { sysStore } from '../core/system';
import { alertBox, errorBox } from '../core/dialog';
import { notify } from '../core/notify';
import { play } from '../core/sound';
import { launchApp, openNode } from '../core/launcher';

type Tab = 'home' | 'ticket' | 'mine' | 'diag' | 'kb' | 'report' | 'contact';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Welcome', icon: 'support' },
  { id: 'ticket', label: 'Submit a Ticket', icon: 'text' },
  { id: 'mine', label: 'My Tickets', icon: 'documents' },
  { id: 'diag', label: 'System Diagnostics', icon: 'taskmgr' },
  { id: 'kb', label: 'Knowledge Base', icon: 'help' },
  { id: 'report', label: 'Report an Error', icon: 'error' },
  { id: 'contact', label: 'Contact IT', icon: 'user' },
];

interface Ticket {
  no: string;
  subject: string;
  category: string;
  priority: string;
  body: string;
  user: string;
  at: number;
}

const REPLIES: Record<string, string> = {
  Hardware: 'Have you tried turning it off and on again? If that does not work, try turning it off and leaving it off. Computers, like stars, need time to cool down.',
  Software: 'We have reproduced your issue on our test machine. Our test machine is also broken. We have filed a ticket with ourselves.',
  Network: 'Please ensure nobody in your household is using the telephone. Then, wait. STARNET runs at 56.6 Kbps on good days and 0 Kbps on Tuesdays.',
  Printer: 'There is no printer. There has never been a printer. Please stop asking about the printer.',
  'Password Reset': 'Your password has been reset to "password". Please change it immediately to something more secure, like "password2".',
  Other: 'Thank you for your ticket. It has been placed in the queue. The queue is a cardboard box in Basement B2.',
  KIP: 'This ticket category does not exist. Please do not submit tickets about things that do not exist.',
};

function statusOf(t: Ticket) {
  const age = (Date.now() - t.at) / 60000;
  if (age < 1) return { s: 'Received', c: '#666' };
  if (age < 3) return { s: 'Assigned to Gary', c: '#0645ad' };
  if (age < 6) return { s: 'In Progress (Gary is looking for his stapler)', c: '#b36b00' };
  return { s: 'Resolved', c: '#2a8a2a' };
}

function ticketsDir() {
  return fs.resolve('C:\\KOAL99\\Support\\Tickets') ?? fs.mkdirp('C:\\KOAL99\\Support\\Tickets');
}

function loadTickets(): { t: Ticket; id: string }[] {
  return fs
    .children(ticketsDir().id)
    .filter((n) => n.meta?.args && (n.meta.args as unknown as Ticket).user === userName())
    .map((n) => ({ t: n.meta!.args as unknown as Ticket, id: n.id }))
    .sort((a, b) => b.t.at - a.t.at);
}

export function Support({ win }: { win: WinCtx }) {
  const [tab, setTab] = useState<Tab>((win.props.tab as Tab) ?? 'home');
  useEffect(() => {
    if (win.props._nonce && win.props.tab) setTab(win.props.tab);
  }, [win.props._nonce]);
  useEffect(() => {
    win.setTitle('KOAL-99 IT SUPPORT - ' + TABS.find((t) => t.id === tab)!.label);
  }, [tab]);
  return (
    <div className="sup">
      <div className="sup-head">
        <Icon name="support" size={40} />
        <div>
          <div className="sup-title">KOAL-99 IT SUPPORT</div>
          <div className="sup-sub">Department of Computational Wellbeing {'\u2022'} Basement Level B2 {'\u2022'} "We'll get to it."</div>
        </div>
        <div className="k-spacer" />
        <div className="sup-wait">Current wait time:<br /><b>4 business years</b></div>
      </div>
      <div className="sup-main">
        <div className="sup-nav">
          {TABS.map((t) => (
            <div key={t.id} className={`sup-nav-i ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={16} /> {t.label}
            </div>
          ))}
          <div className="sup-badge">
            <b>KOAL CERTIFIED</b>
            <div>ISO 9001-ish</div>
            <div style={{ fontSize: 9 }}>since 1999</div>
          </div>
        </div>
        <div className="sup-body">
          {tab === 'home' && <Home go={setTab} />}
          {tab === 'ticket' && <TicketForm done={() => setTab('mine')} />}
          {tab === 'mine' && <MyTickets go={setTab} />}
          {tab === 'diag' && <Diagnostics />}
          {tab === 'kb' && <KnowledgeBase />}
          {tab === 'report' && <ErrorReport />}
          {tab === 'contact' && <Contact />}
        </div>
      </div>
      <div className="k-status">
        <div style={{ flex: 1 }}>Connected to HELPDESK-B2 (latency: one coffee)</div>
        <div style={{ width: 160 }}>Logged in as {currentProfile()?.displayName}</div>
      </div>
    </div>
  );
}

const TIPS = [
  'Saving your work often prevents losing your work. Losing your work often prevents saving your work.',
  'If the screen is black, check that the monitor is on. Then check that you are awake.',
  'The Recycle Bin is not a filing system. We have checked.',
  'Do not feed the computer after midnight.',
  'Type HELP in the Terminal. It helps.',
];

function Home({ go }: { go: (t: Tab) => void }) {
  const tip = TIPS[new Date().getDate() % TIPS.length];
  return (
    <div>
      <h2 className="sup-h">Welcome to IT Support, {currentProfile()?.displayName}!</h2>
      <p>The KOAL-99 IT Department is here to help you with all your computing needs, between the hours of 9:00 and 9:15 AM, Monday to Friday, excluding lunch.</p>
      <div className="sup-cards">
        <div className="sup-card" onClick={() => go('ticket')}><Icon name="text" size={32} /><b>Submit a Ticket</b><span>Tell us what's wrong. We'll write it down.</span></div>
        <div className="sup-card" onClick={() => go('diag')}><Icon name="taskmgr" size={32} /><b>Run Diagnostics</b><span>Find out what's wrong. Probably.</span></div>
        <div className="sup-card" onClick={() => go('kb')}><Icon name="help" size={32} /><b>Knowledge Base</b><span>Fix it yourself. We believe in you.</span></div>
        <div className="sup-card" onClick={() => go('contact')}><Icon name="user" size={32} /><b>Contact Gary</b><span>Gary is always available. Gary is always in the basement.</span></div>
      </div>
      <fieldset className="k-group">
        <legend>Tip of the Day</legend>
        <div className="k-row"><Icon name="info" /> {tip}</div>
      </fieldset>
      <fieldset className="k-group">
        <legend>Service Status</legend>
        <table className="sup-table"><tbody>
          <tr><td>STARNET Dial-Up</td><td style={{ color: '#2a8a2a' }}>{'\u25CF'} Operational</td></tr>
          <tr><td>Email (StarMail)</td><td style={{ color: '#b36b00' }}>{'\u25CF'} Degraded (Mercury is in retrograde)</td></tr>
          <tr><td>Printer</td><td style={{ color: '#888' }}>{'\u25CF'} There is no printer</td></tr>
          <tr><td>K.I.P.</td><td style={{ color: '#c00' }}>{'\u25CF'} Decommissioned (status: active)</td></tr>
        </tbody></table>
      </fieldset>
    </div>
  );
}

function TicketForm({ done }: { done: () => void }) {
  const [f, setF] = useState({ subject: '', category: 'Hardware', priority: 'Normal', body: '' });
  const [err, setErr] = useState('');
  const submit = () => {
    if (!f.subject.trim() || !f.body.trim()) return setErr('Please fill in both the subject and the description. Gary needs details.');
    const no = 'TKT-' + (Date.now() % 100000).toString().padStart(5, '0');
    const t: Ticket = { ...f, no, user: userName(), at: Date.now() };
    const text = `KOAL-99 IT SUPPORT TICKET ${no}\n${'='.repeat(40)}\nFrom:     ${currentProfile()?.displayName} (${userName()})\nDate:     ${new Date().toLocaleString()}\nCategory: ${f.category}\nPriority: ${f.priority}\nSubject:  ${f.subject}\n\n${f.body}\n\n--- AUTOMATED RESPONSE ---\n${REPLIES[f.category] ?? REPLIES.Other}\n`;
    fs.create(ticketsDir().id, no + '.tkt', 'file', text, { meta: { args: t as unknown as Record<string, unknown> } });
    play('ding');
    notify(`Ticket ${no} received`, 'Your ticket has been placed in the queue. Estimated response: soon-ish.', { icon: 'support' });
    window.setTimeout(() => notify(`Ticket ${no} updated`, 'Status: Assigned to Gary.', { icon: 'support', onClick: () => launchApp('support', { tab: 'mine' }) }), 60000);
    done();
  };
  return (
    <div>
      <h2 className="sup-h">Submit a Support Ticket</h2>
      <p>Please describe your problem in as much detail as possible. Tickets written in ALL CAPS will be read in a loud voice.</p>
      <div className="sup-form">
        <label>Subject:</label>
        <input className="k-input" value={f.subject} maxLength={80} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        <label>Category:</label>
        <select className="k-input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {Object.keys(REPLIES).filter((k) => k !== 'KIP').map((k) => <option key={k}>{k}</option>)}
        </select>
        <label>Priority:</label>
        <select className="k-input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
          <option>Low</option><option>Normal</option><option>High</option><option>Urgent</option><option>Gary, please</option>
        </select>
        <label>Description:</label>
        <textarea className="k-input" rows={7} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <span />
        <div>
          {err && <div style={{ color: '#c00', marginBottom: 6 }}>{err}</div>}
          <button className="k-btn default" onClick={submit}>Submit Ticket</button>
        </div>
      </div>
    </div>
  );
}

function MyTickets({ go }: { go: (t: Tab) => void }) {
  fs.fsStore.use((s) => s.version);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 10000);
    return () => clearInterval(t);
  }, []);
  const list = loadTickets();
  return (
    <div>
      <h2 className="sup-h">My Tickets</h2>
      {!list.length && <p>You have no open tickets. Congratulations, your computer is perfect. <span className="k-link" onClick={() => go('ticket')}>Submit one anyway?</span></p>}
      {list.map(({ t, id }) => {
        const st = statusOf(t);
        return (
          <div key={id} className="sup-ticket">
            <div className="k-row">
              <b>{t.no}</b> <span>{t.subject}</span> <span className="k-spacer" /> <span style={{ color: st.c, fontWeight: 'bold' }}>{st.s}</span>
            </div>
            <small style={{ color: '#666' }}>{t.category} {'\u2022'} {t.priority} {'\u2022'} {new Date(t.at).toLocaleString()}</small>
            <div className="sup-reply"><b>Response:</b> {st.s === 'Resolved' ? 'Have you tried turning it off and on again? Ticket closed.' : REPLIES[t.category] ?? REPLIES.Other}</div>
            <span className="k-link" onClick={() => openNode(fs.get(id))}>Open ticket file</span>
          </div>
        );
      })}
    </div>
  );
}

interface DiagLine {
  label: string;
  value: string;
  level: 'ok' | 'warn' | 'err';
}

function runChecks(): DiagLine[] {
  const { files, dirs } = fs.countTree(fs.ROOT);
  const bin = fs.children(fs.RECYCLER, { hidden: true }).length;
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  const up = Math.floor((Date.now() - sysStore.get().bootedAt) / 60000);
  let ls = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) ls += (localStorage.getItem(localStorage.key(i)!) ?? '').length;
  } catch {
    /* ignore */
  }
  const kip = fs.search(fs.ROOT, 'kip', { hidden: true }).length;
  return [
    { label: 'Hard disk (C:)', value: `${files} files, ${dirs} folders, ${Math.round(fs.totalBytes() / 1024)} KB used`, level: 'ok' },
    { label: 'Recycle Bin', value: bin ? `${bin} item(s). Consider emptying it.` : 'Empty', level: bin > 10 ? 'warn' : 'ok' },
    { label: 'Open programs', value: `${wmStore.get().wins.length} window(s)`, level: wmStore.get().wins.length > 8 ? 'warn' : 'ok' },
    { label: 'Browser memory', value: mem ? `${Math.round(mem.usedJSHeapSize / 1048576)} MB in use` : 'Not reported by this browser', level: 'ok' },
    { label: 'Settings storage', value: `${Math.round(ls / 1024)} KB of local storage`, level: ls > 3_000_000 ? 'warn' : 'ok' },
    { label: 'Display', value: `${window.innerWidth}x${window.innerHeight}, ${window.devicePixelRatio}x scaling`, level: 'ok' },
    { label: 'Uptime', value: `${up} minute(s) since boot`, level: 'ok' },
    { label: 'Stardust reserve', value: '97%', level: 'ok' },
    { label: 'Star alignment', value: 'Slightly off (this is normal)', level: 'warn' },
    { label: 'Mouse ball', value: 'Dusty', level: 'warn' },
    { label: 'Unknown files matching "kip"', value: `${kip} found`, level: kip ? 'err' : 'ok' },
    { label: 'Unregistered process kip.exe', value: '1 instance, 4 GB, cannot terminate', level: 'err' },
  ];
}

function Diagnostics() {
  const [running, setRunning] = useState(false);
  const [pct, setPct] = useState(0);
  const [lines, setLines] = useState<DiagLine[] | null>(null);
  const [stage, setStage] = useState('');
  const run = () => {
    setRunning(true);
    setLines(null);
    setPct(0);
    const stages = ['Checking hard disk...', 'Counting files...', 'Inspecting memory...', 'Measuring stardust...', 'Aligning stars...', 'Looking for things that should not be there...'];
    let p = 0;
    const t = setInterval(() => {
      p += 3 + Math.random() * 6;
      setPct(Math.min(100, p));
      setStage(stages[Math.min(stages.length - 1, Math.floor((p / 100) * stages.length))]);
      if (p >= 100) {
        clearInterval(t);
        setRunning(false);
        setLines(runChecks());
        play('ding');
      }
    }, 180);
  };
  const save = () => {
    if (!lines) return;
    const text = `KOAL-99 SYSTEM DIAGNOSTICS REPORT\n${new Date().toLocaleString()}\n\n` + lines.map((l) => `[${l.level.toUpperCase().padEnd(4)}] ${l.label}: ${l.value}`).join('\n') + '\n';
    const n = fs.writePath(fs.pathOf(documentsDir().id) + '\\diagnostics.log', text);
    notify('Diagnostics saved', `Report saved to ${fs.pathOf(n.id)}`, { icon: 'text', onClick: () => openNode(n) });
  };
  const counts = lines ? { ok: lines.filter((l) => l.level === 'ok').length, warn: lines.filter((l) => l.level === 'warn').length, err: lines.filter((l) => l.level === 'err').length } : null;
  return (
    <div>
      <h2 className="sup-h">System Diagnostics</h2>
      <p>KOAL Diagnostic Wizard will scan your computer for problems. It will not fix them, but it will find them, which is half the battle.</p>
      <div className="k-row">
        <button className="k-btn default" disabled={running} onClick={run}>{lines ? 'Scan Again' : 'Start Scan'}</button>
        {lines && <button className="k-btn" onClick={save}>Save Report</button>}
      </div>
      {running && (
        <div style={{ marginTop: 12 }}>
          <div>{stage}</div>
          <div className="k-progress" style={{ marginTop: 6 }}><div style={{ width: pct + '%' }} /></div>
        </div>
      )}
      {lines && counts && (
        <>
          <p style={{ marginTop: 12 }}><b>Scan complete.</b> {counts.ok} passed, {counts.warn} warning(s), {counts.err} problem(s).</p>
          <table className="sup-table sup-diag"><tbody>
            {lines.map((l) => (
              <tr key={l.label}>
                <td><Icon name={l.level === 'ok' ? 'info' : l.level === 'warn' ? 'warning' : 'error'} size={16} /></td>
                <td>{l.label}</td>
                <td>{l.value}</td>
              </tr>
            ))}
          </tbody></table>
        </>
      )}
    </div>
  );
}

const KB: { id: string; t: string; body: string }[] = [
  { id: 'KB0001', t: 'How do I use the Terminal?', body: 'Open Terminal from the desktop. Type HELP and press Enter for a list of commands. Commands like DIR, CD, MKDIR, TOUCH, CAT, DEL and RENAME work on the same files you see in File Explorer.\n\nTry:\n  mkdir test\n  cd test\n  echo hello > hi.txt\n  type hi.txt\n\nPress Tab to complete file names, and the Up arrow to repeat commands. Pipes work too: dir | find "txt"' },
  { id: 'KB0002', t: 'My files disappeared!', body: 'Deleted files go to the Recycle Bin. Double-click the Recycle Bin on the desktop, select your file, and click "Restore the selected items". In the Terminal you can type RECYCLE to list deleted files and UNDELETE <name> to bring one back.\n\nIf the file is not in the Recycle Bin, it may have been permanently deleted. Or it may be hidden: turn on View > Show Hidden Files.' },
  { id: 'KB0003', t: 'How do I change my wallpaper?', body: 'Right-click the desktop and choose "Change Wallpaper...", or open Control Panel > Appearance and Themes. You can pick a built-in background, a solid color, or a picture from your real computer.' },
  { id: 'KB0004', t: 'A website shows a blank page', body: 'Many modern websites refuse to be displayed inside another program for security reasons. This is normal.\n\nIn StarNet Explorer, click "2004 Mode" to view the site as it looked in 2004 via the Internet Archive, or use Tools > "Open in my real browser".' },
  { id: 'KB0005', t: 'My computer is slow', body: 'KOAL-99 is designed to never rush. If you believe your computer is too slow, it is working as intended. If you believe your computer is too fast, please submit a ticket immediately.' },
  { id: 'KB0006', t: 'Keyboard shortcuts', body: 'Ctrl+Esc ......... Start menu\nAlt+W / Alt+F4 ... Close the active window\nAlt+` ............ Switch between windows\nCtrl+Alt+D ....... Show the desktop\nCtrl+Alt+T ....... Terminal\nCtrl+Alt+E ....... File Explorer\nCtrl+Alt+R ....... Run dialog\nCtrl+Shift+K ..... Task Manager\nCtrl+Alt+L ....... Log off\nF1 ............... Help\nF2 ............... Rename\nDelete ........... Delete selected files\nCtrl+C/X/V ....... Copy, cut, paste files' },
  { id: 'KB0007', t: 'How do I play music?', body: 'Open StarAmp. Click the eject button or "+ FILE" to play audio files from your real computer. They are not uploaded anywhere. Click "SAVE TO MY MUSIC" to copy a song (up to 8 MB) into KOAL-99.' },
  { id: 'KB0008', t: 'Error 0x00000099', body: 'This error means "Not enough stardust to complete this operation." Wait a few minutes and try again.' },
  { id: 'KB0009', t: 'There is a second cursor', body: 'There is only one cursor.' },
  { id: 'KB0010', t: 'What is K.I.P.?', body: 'This article has been removed at the request of the Board.\n\n\n\n\n\n\n\n                                    (try the terminal)' },
  { id: 'KB0011', t: 'How do I reset KOAL-99?', body: 'Control Panel > Performance and Maintenance > "Reset file system..." erases every pretend file and reinstalls KOAL-99. Your accounts and settings are kept.' },
  { id: 'KB0012', t: 'Where is my data stored?', body: 'Everything lives in your web browser (IndexedDB and local storage) on your real computer. Nothing is sent to any server. Clearing your browser data will erase KOAL-99.' },
];

function KnowledgeBase() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const list = KB.filter((k) => (k.t + k.body).toLowerCase().includes(q.toLowerCase()));
  const art = KB.find((k) => k.id === open);
  if (art)
    return (
      <div>
        <span className="k-link" onClick={() => setOpen(null)}>{'\u2190'} Back to articles</span>
        <h2 className="sup-h">{art.t}</h2>
        <small style={{ color: '#666' }}>Article {art.id} {'\u2022'} Applies to: KOAL-99 Professional SP4</small>
        <pre className="sup-article">{art.body}</pre>
        <div className="k-row">Was this article helpful? <button className="k-btn small" onClick={() => alertBox('Thank you for your feedback! It has been ignored.', 'Feedback')}>Yes</button> <button className="k-btn small" onClick={() => alertBox('We are sorry to hear that. Your feedback has been forwarded to Gary.', 'Feedback')}>No</button></div>
      </div>
    );
  return (
    <div>
      <h2 className="sup-h">Knowledge Base &amp; Troubleshooting</h2>
      <div className="k-row"><input className="k-input" style={{ flex: 1 }} placeholder="Search articles..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <ul className="sup-kb">
        {list.map((k) => <li key={k.id}><Icon name="help" size={16} /> <span className="k-link" onClick={() => setOpen(k.id)}>{k.t}</span> <small>{k.id}</small></li>)}
      </ul>
      {!list.length && <p>No articles found. You have discovered a new problem. Congratulations.</p>}
    </div>
  );
}

function ErrorReport() {
  const [what, setWhat] = useState('');
  const [prog, setProg] = useState('KOAL-99 (the whole thing)');
  const [sent, setSent] = useState<string | null>(null);
  const send = () => {
    if (!what.trim()) return errorBox('Please describe what happened. "It broke" is not a description, Kevin.', 'Error Report');
    const id = 'ERR-' + Math.random().toString(16).slice(2, 8).toUpperCase();
    const dump = `DR. NOVA ERROR REPORT ${id}\n${new Date().toLocaleString()}\nProgram: ${prog}\nUser: ${userName()}\n\n${what}\n\n--- MEMORY DUMP ---\n` + Array.from({ length: 8 }, (_, i) => (0x0028c000 + i * 16).toString(16).toUpperCase().padStart(8, '0') + '  ' + Array.from({ length: 8 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(' ')).join('\n') + '\n';
    const dir = fs.resolve('C:\\KOAL99\\Support') ?? fs.mkdirp('C:\\KOAL99\\Support');
    fs.create(dir.id, id + '.log', 'file', dump);
    setSent(id);
    play('ding');
  };
  if (sent)
    return (
      <div>
        <h2 className="sup-h">Report Sent</h2>
        <div className="k-row" style={{ alignItems: 'flex-start' }}>
          <Icon name="info" size={32} />
          <p>Thank you. Your error report <b>{sent}</b> has been sent to KOAL Systems Inc.<br /><br />KOAL Systems Inc. ceased operations in November 2004. Your report has been printed and placed in a box. A copy was saved to C:\KOAL99\Support\{sent}.log.</p>
        </div>
        <button className="k-btn" onClick={() => { setSent(null); setWhat(''); }}>Report another error</button>
      </div>
    );
  return (
    <div>
      <h2 className="sup-h">Report an Error</h2>
      <div className="sup-dr">
        <Icon name="logo" size={48} />
        <div><b>Dr. Nova</b> has detected that you want to report a problem.<br />We have created an error report that you can send to help us improve KOAL-99. We will treat this report as confidential and anonymous, and also as a coaster.</div>
      </div>
      <div className="sup-form">
        <label>Program:</label>
        <select className="k-input" value={prog} onChange={(e) => setProg(e.target.value)}>
          {['KOAL-99 (the whole thing)', 'Terminal', 'File Explorer', 'Notepad', 'StarPaint', 'StarNet Explorer', 'StarAmp', 'Calculator', 'Something else'].map((p) => <option key={p}>{p}</option>)}
        </select>
        <label>What happened?</label>
        <textarea className="k-input" rows={6} value={what} onChange={(e) => setWhat(e.target.value)} />
        <span />
        <div className="k-row">
          <button className="k-btn default" onClick={send}>Send Error Report</button>
          <button className="k-btn" onClick={() => alertBox('Report not sent. Dr. Nova understands.', 'Error Report', 'logo')}>Don't Send</button>
        </div>
      </div>
    </div>
  );
}

function Contact() {
  const save = () => {
    const d = desktopDir();
    const n = fs.writePath(fs.pathOf(d.id) + '\\KOAL IT Department.txt', 'KOAL-99 IT DEPARTMENT\nDepartment of Computational Wellbeing\nBasement Level B2, KOAL Systems Inc., Starlight Valley\n\nHotline: 1-800-KOAL-HELP\nGary (direct): ext. 4404\nPager: 555-0199\nHours: Mon-Fri 9:00-9:15 AM (excluding lunch)\n');
    notify('Contact saved', 'The IT Department contact card is on your desktop.', { icon: 'support', onClick: () => openNode(n) });
  };
  return (
    <div>
      <h2 className="sup-h">Contact the IT Department</h2>
      <div className="sup-vcard">
        <div className="sup-vcard-top">
          <Icon name="logo" size={48} />
          <div>
            <div className="sup-vcard-co">KOAL SYSTEMS INC.</div>
            <div>Information Technology Department</div>
          </div>
        </div>
        <div className="sup-vcard-body">
          <div className="sup-vcard-name">Gary Hollis</div>
          <div className="sup-vcard-role">Senior Lead Technician &amp; Sole Employee, IT</div>
          <table><tbody>
            <tr><td>Location</td><td>Basement Level B2 (past the boiler, left at the fish tank)</td></tr>
            <tr><td>Hotline</td><td>1-800-KOAL-HELP</td></tr>
            <tr><td>Direct</td><td>ext. 4404</td></tr>
            <tr><td>Pager</td><td>555-0199</td></tr>
            <tr><td>Fax</td><td>Please do not fax Gary</td></tr>
            <tr><td>Hours</td><td>Mon-Fri, 9:00 - 9:15 AM</td></tr>
            <tr><td>Motto</td><td><i>"Have you tried turning it off and on again?"</i></td></tr>
          </tbody></table>
        </div>
      </div>
      <div className="k-row" style={{ marginTop: 10 }}>
        <button className="k-btn" onClick={save}>Save contact to Desktop</button>
        <button className="k-btn" onClick={() => { play('ding'); setTimeout(() => alertBox('*ring ring*\n\n"You have reached the KOAL IT Department. All of our technicians are currently looking for a stapler. Please hold."\n\n*smooth jazz*', 'Calling 1-800-KOAL-HELP...', 'support'), 600); }}>Call Hotline</button>
        <button className="k-btn" onClick={() => alertBox('Your page has been sent to Gary.\n\nGary has acknowledged your page.\n\nGary is not coming.', 'Page Gary', 'support')}>Page Gary</button>
      </div>
    </div>
  );
}
