import { useEffect, useRef, useState } from 'react';
import { sysStore, setPhase, bootFromOff } from '../core/system';
import { profiles, findProfile, loadUserSettings, addProfile, Profile, SYSOP } from '../core/settings';
import { ensureHome } from '../core/seed';
import { play } from '../core/sound';
import { Icon } from '../ui/Icon';
import { notify } from '../core/notify';
import { launchApp } from '../core/launcher';

function useKeyAny(fn: (e: KeyboardEvent) => void, deps: unknown[] = []) {
  useEffect(() => {
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? 'small' : ''}`}>
      <Icon name="logo" size={small ? 60 : 96} className="brand-orb" />
      <div>
        <div className="copy">KOAL Systems{'®'}</div>
        <div className="name">
          KOAL<span className="dash">-</span>99<sup>SP4</sup>
        </div>
        <div className="ed">Professional</div>
      </div>
    </div>
  );
}

// ---------------- BIOS ----------------
export function Bios() {
  const [lines, setLines] = useState<string[]>([]);
  const [mem, setMem] = useState(0);
  const [setup, setSetup] = useState(false);
  const done = useRef(false);
  const total = 524288;

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setPhase('boot');
  };

  useEffect(() => {
    if (setup) return;
    const script = [
      'STELLAR Modular BIOS v4.04PG, A Starpower Ally',
      'Copyright (C) 1998-2004, KOAL Systems Inc.',
      '',
      'KOAL-99 BIOS Rev. 2004.11 (nova-k7)',
      '',
      'Main Processor : Stellar Pentium(R) III 866MHz',
      '@MEM',
      '',
      'Award Plug and Play BIOS Extension v1.0A',
      'Initialize Plug and Play Cards...',
      'PNP Init Completed',
      '',
      'Detecting IDE Primary Master   ... KOALDISK 40GB',
      'Detecting IDE Primary Slave    ... None',
      'Detecting IDE Secondary Master ... KOAL CD-ROM 52X',
      'Detecting IDE Secondary Slave  ... None',
      '',
      'Floppy disk(s) fail (40) ... ignored, it is 2004',
      'Keyboard ............ OK',
      'Mouse ball .......... dusty, OK',
      'Stardust reserve ... 97%',
      '',
      'Verifying DMI Pool Data ........ Update Success',
      'Boot from KOALDISK...',
    ];
    let i = 0;
    let m = 0;
    const memTimer = window.setInterval(() => {
      m = Math.min(total, m + 16384 + Math.floor(Math.random() * 8192));
      setMem(m);
      if (m >= total) window.clearInterval(memTimer);
    }, 30);
    const t = window.setInterval(() => {
      if (i >= script.length) {
        window.clearInterval(t);
        window.setTimeout(finish, 600);
        return;
      }
      const l = script[i++];
      setLines((x) => [...x, l]);
    }, 110);
    return () => {
      window.clearInterval(t);
      window.clearInterval(memTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup]);

  useKeyAny(
    (e) => {
      if (setup) {
        if (e.key === 'Escape' || e.key === 'F10') {
          setSetup(false);
          setLines([]);
        }
        return;
      }
      if (e.key === 'Delete') setSetup(true);
      else if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    },
    [setup],
  );

  if (setup) return <BiosSetup />;
  return (
    <div className="bios" onClick={finish}>
      <div className="logo">
        {'        .\n       / \\\n  ____/   \\____\n  \\           /\n   \\_       _/\n   /    _    \\\n  /__.-\' \'-.__\\\n'}
        <span className="g">  STARPOWER</span>
      </div>
      {lines.map((l, i) =>
        l === '@MEM' ? (
          <div key={i}>
            Memory Testing : <span className="w">{mem}K</span> {mem >= total ? <span className="g">OK</span> : ''}
          </div>
        ) : (
          <div key={i} className={i < 2 ? 'w' : l.includes('...') && l.includes('KOAL') ? 'c' : ''}>
            {l || ' '}
          </div>
        ),
      )}
      <div className="foot">
        Press <span className="y">DEL</span> to enter SETUP, <span className="y">ESC</span> to skip{'\n'}11/12/2004-i815EP-KOAL-6A69KK4EC-00
      </div>
    </div>
  );
}

function BiosSetup() {
  return (
    <div className="bios-setup">
      <div className="box">
        <div style={{ textAlign: 'center' }}>STELLAR CMOS SETUP UTILITY</div>
        <div style={{ textAlign: 'center' }}>Copyright (C) 1998-2004 KOAL Systems Inc.</div>
        <div className="cols">
          <div className="hl">{'►'} Standard CMOS Features</div>
          <div>{'►'} Frequency/Voltage Control</div>
          <div>{'►'} Advanced BIOS Features</div>
          <div>Load Fail-Safe Defaults</div>
          <div>{'►'} Integrated Peripherals</div>
          <div>Load Optimized Defaults</div>
          <div>{'►'} Power Management Setup</div>
          <div>Set Supervisor Password</div>
          <div>{'►'} PnP/PCI Configurations</div>
          <div>Set User Password</div>
          <div>{'►'} PC Health Status</div>
          <div>Save & Exit Setup</div>
          <div>{'►'} KIP Configuration <span style={{ color: '#f55' }}>[LOCKED]</span></div>
          <div>Exit Without Saving</div>
        </div>
        <div className="ft">Esc : Quit {'   '} F10 : Save & Exit Setup {'   '} {'↑↓→←'} : Select Item</div>
        <div style={{ textAlign: 'center', marginTop: 8 }}>CPU Temp: 38{'°'}C {'  '} Star Temp: 5,778 K (nominal)</div>
      </div>
    </div>
  );
}

// ---------------- Boot logo ----------------
export function BootLogo() {
  useEffect(() => {
    const t = window.setTimeout(() => setPhase('login'), 3200);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setPhase('login');
    window.addEventListener('keydown', k);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', k);
    };
  }, []);
  return (
    <div className="bootlogo" onClick={() => setPhase('login')}>
      <Brand />
      <div className="bootbar">
        {[0, 1, 2].map((i) => (
          <div key={i} className="blk" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <div className="bl">Copyright {'©'} 1999-2004 KOAL Systems Inc.</div>
      <div className="br">KOAL Systems</div>
    </div>
  );
}

// ---------------- Login ----------------
const AVATARS = ['star', 'fish', 'flower', 'robot', 'guitar', 'duck', 'user'];

export function doLogin(p: Profile) {
  loadUserSettings(p.username);
  ensureHome(p.username, p.displayName);
  sysStore.set({ phase: 'welcome', loggedInAt: Date.now() });
  play('startup');
  window.setTimeout(() => {
    setPhase('desktop');
    window.setTimeout(() => {
      if (p.username === 'sysop') {
        notify('SYSOP session restored', 'Last logon: 13/11/2004 03:33 AM\nYou have 1 unread message from KIP.', { icon: 'kip', onClick: () => launchApp('kip') });
      } else {
        notify(`Welcome to KOAL-99, ${p.displayName}`, 'Take a tour: open "Read Me First" on your desktop, or type HELP in the Terminal.', { icon: 'logo' });
      }
    }, 1400);
  }, 1700);
}

export function Login() {
  const list = profiles();
  const [sel, setSel] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<'pick' | 'other' | 'new'>('pick');
  const [other, setOther] = useState({ user: '', pass: '' });
  const [nu, setNu] = useState({ name: '', avatar: 'star', pass: '' });

  const tryLogin = (p: Profile, pass: string) => {
    if (p.password && p.password.toLowerCase() !== pass.trim().toLowerCase()) {
      play('error');
      setErr(p.username === 'sysop' ? 'Incorrect password. Hint: what stars are made of (SP#).' : 'Did you forget your password? Please type your password again. Be sure to use the correct uppercase and lowercase letters.');
      return;
    }
    doLogin(p);
  };

  return (
    <div className="login">
      <Bubbles />
      <div className="band-top" />
      <div className="mid">
        <div className="lside">
          <Brand small />
          <div className="hint">{mode === 'new' ? 'Create a new account' : mode === 'other' ? 'Log on to KOAL-99' : 'To begin, click your user name'}</div>
        </div>
        <div className="sep" />
        <div className="rside">
          {mode === 'pick' && (
            <>
              {list.map((p) => (
                <div
                  key={p.username}
                  className={`utile ${sel === p.username ? 'sel' : ''}`}
                  onClick={() => {
                    setErr('');
                    if (!p.password) tryLogin(p, '');
                    else setSel(p.username);
                  }}
                >
                  <div className="av"><Icon name={p.avatar} size={48} /></div>
                  <div>
                    <div className="nm">{p.displayName}</div>
                    {p.password && sel !== p.username && <div style={{ fontSize: 11, color: '#dfe9fb' }}>Password protected</div>}
                    {sel === p.username && (
                      <>
                        <div style={{ fontSize: 11, marginTop: 4 }}>Type your password</div>
                        <div className="pw" onClick={(e) => e.stopPropagation()}>
                          <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tryLogin(p, pw)} />
                          <div className="go" onClick={() => tryLogin(p, pw)}>{'→'}</div>
                        </div>
                        {err && <div className="err">{err}</div>}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div className="utile" onClick={() => { setMode('other'); setErr(''); }}>
                <div className="av"><Icon name="question" size={48} /></div>
                <div className="nm" style={{ fontSize: 15 }}>Other user...</div>
              </div>
            </>
          )}
          {mode === 'other' && (
            <div style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: 8, width: 300 }}>
              <label>User name:<br /><input className="k-input" style={{ width: 220 }} autoFocus value={other.user} onChange={(e) => setOther({ ...other, user: e.target.value })} /></label>
              <label>Password:<br /><input className="k-input" style={{ width: 220 }} type="password" value={other.pass} onChange={(e) => setOther({ ...other, pass: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (document.getElementById('other-ok') as HTMLButtonElement)?.click()} /></label>
              {err && <div className="err">{err}</div>}
              <div className="k-row">
                <button
                  id="other-ok"
                  className="k-btn default"
                  onClick={() => {
                    const p = findProfile(other.user);
                    if (!p) {
                      play('error');
                      setErr(`The system could not log you on. Make sure your User name and domain are correct. ("${other.user}" is not a known user.)`);
                      return;
                    }
                    if (p.username === 'sysop' && other.pass.trim().toUpperCase() !== SYSOP.password) {
                      play('error');
                      setErr('Access denied. Hint: what stars are made of, in capitals, dash, SP number.');
                      return;
                    }
                    tryLogin(p, other.pass);
                  }}
                >
                  OK
                </button>
                <button className="k-btn" onClick={() => { setMode('pick'); setErr(''); }}>Cancel</button>
              </div>
            </div>
          )}
          {mode === 'new' && (
            <div style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: 8, width: 320 }}>
              <label>Name for the new account:<br /><input className="k-input" style={{ width: 220 }} autoFocus maxLength={20} value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></label>
              <div>Pick a picture:</div>
              <div className="k-row" style={{ flexWrap: 'wrap' }}>
                {AVATARS.map((a) => (
                  <div key={a} onClick={() => setNu({ ...nu, avatar: a })} style={{ padding: 3, borderRadius: 4, background: nu.avatar === a ? '#003399' : 'transparent', border: '2px solid ' + (nu.avatar === a ? '#fff' : 'transparent'), cursor: 'pointer' }}>
                    <Icon name={a} size={40} />
                  </div>
                ))}
              </div>
              <label>Password (optional):<br /><input className="k-input" style={{ width: 220 }} type="password" value={nu.pass} onChange={(e) => setNu({ ...nu, pass: e.target.value })} /></label>
              <div style={{ fontSize: 11, color: '#cdd9f7' }}>Passwords stay in this browser only. Don't reuse a real one.</div>
              {err && <div className="err">{err}</div>}
              <div className="k-row">
                <button
                  className="k-btn default"
                  onClick={() => {
                    if (!nu.name.trim()) return setErr('Type a name for the account.');
                    if (findProfile(nu.name)) return setErr('That account name is already taken.');
                    const p = addProfile(nu.name, nu.avatar, nu.pass);
                    play('ding');
                    setMode('pick');
                    setSel(p.password ? p.username : null);
                    setNu({ name: '', avatar: 'star', pass: '' });
                    setErr('');
                  }}
                >
                  Create Account
                </button>
                <button className="k-btn" onClick={() => { setMode('pick'); setErr(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="band-bot">
        <div className="power" onClick={() => sysStore.set({ phase: 'shutdown', restartAfter: false })}>
          <Icon name="power" size={28} /> Turn off computer
        </div>
        <div className="note">
          <span className="k-link" style={{ color: '#fff' }} onClick={() => { setMode('new'); setErr(''); }}>Create a new account</span>
          <br />After you log on, you can add or change accounts. Just go to Control Panel and click User Accounts.
        </div>
      </div>
    </div>
  );
}

export function WelcomeScreen({ text = 'welcome', sub = 'Loading your personal settings...' }: { text?: string; sub?: string }) {
  return (
    <div className="welcome-screen login">
      <Bubbles />
      <div className="band-top" />
      <div className="mid" style={{ flexDirection: 'column' }}>
        <div>{text}</div>
        <div className="msg"><span className="spinner" />{sub}</div>
      </div>
      <div className="band-bot" />
    </div>
  );
}

const BUBBLES = Array.from({ length: 18 }, (_, i) => ({ left: (i * 53) % 100, size: 14 + ((i * 37) % 60), dur: 9 + ((i * 7) % 12), delay: -((i * 13) % 20) }));
export function Bubbles() {
  return (
    <div className="bubbles">
      {BUBBLES.map((b, i) => (
        <span key={i} style={{ left: b.left + '%', width: b.size, height: b.size, animationDuration: b.dur + 's', animationDelay: b.delay + 's' }} />
      ))}
    </div>
  );
}

export function ShutdownScreen() {
  const restart = sysStore.use((s) => s.restartAfter);
  useEffect(() => {
    const t = window.setTimeout(() => (restart ? bootFromOff() : setPhase('off')), 2600);
    return () => window.clearTimeout(t);
  }, [restart]);
  return (
    <div className="shutdown-screen">
      <Brand />
      <div style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 }}><span className="spinner" />{restart ? 'Restarting...' : 'Shutting down...'}</div>
      <div style={{ fontSize: 12, color: '#9fc4e8' }}>Saving your settings. Please do not unplug the stars.</div>
    </div>
  );
}

export function OffScreen() {
  useKeyAny((e) => e.key === 'Enter' && bootFromOff());
  return (
    <div className="off-screen">
      <div>It is now safe to turn off<br />your computer.</div>
      <div className="pbtn" title="Power" onClick={bootFromOff}>{'⏻'}</div>
      <small>Press the power button (or Enter) to start KOAL-99 again.</small>
    </div>
  );
}

export function Bsod() {
  const b = sysStore.use((s) => s.bsod);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setArmed(true), 900);
    return () => window.clearTimeout(t);
  }, []);
  useKeyAny(() => armed && bootFromOff(), [armed]);
  return (
    <div className="bsod" onClick={() => armed && bootFromOff()}>
      <div className="inner">
        <div className="tag">KOAL-99</div>
        <p>A fatal exception has occurred. KOAL-99 has stopped to prevent damage to your stardust.</p>
        <p>
          *** STOP: 0x0000009F ({b?.code ?? 'UNKNOWN'})
          <br />
          {b?.message}
        </p>
        <p>
          * Press any key to restart your computer. You will lose any unsaved information in all applications.
          <br />* If this keeps happening, contact Gary in IT. Gary is in the basement. Gary is always in the basement.
        </p>
        <p style={{ textAlign: 'center' }}>
          Press any key to continue <span className="blink">_</span>
        </p>
      </div>
    </div>
  );
}
