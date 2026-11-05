import { useEffect, useState } from 'react';
import type { WinCtx } from '../core/registry';
import * as fs from '../core/fs';
import { useSettings, setSettings, S } from '../core/settings';
import { Icon } from '../ui/Icon';
import { MenuBar } from '../ui/MenuBar';
import { promptBox, alertBox } from '../core/dialog';
import { launchApp } from '../core/launcher';
import { notify } from '../core/notify';
import { routeKoal, koalTitle, KoalPage } from './browser/KoalPages';

const KOAL_PAGES = ['youtube', 'itch', 'github', 'help', 'virus', 'idiot', 'games', '3d-platformer'];

const BLOCKERS = ['google.', 'youtube.', 'facebook.', 'twitter.', 'x.com', 'instagram.', 'github.com', 'reddit.', 'amazon.', 'netflix.', 'tiktok.', 'linkedin.', 'microsoft.', 'apple.com', 'yahoo.', 'bing.', 'duckduckgo.', 'stackoverflow.', 'discord.', 'twitch.', 'spotify.', 'paypal.', 'ebay.', 'wikipedia.org/w/index.php?title=Special'];

function normalize(raw: string): string {
  let u = raw.trim();
  if (!u) return 'koal://home';
  const special = routeKoal(u);
  if (special) return special;
  if (/^(koal|file|about):/i.test(u)) return u.replace(/^about:blank$/i, 'koal://blank');
  if (/^[a-z]:\\/i.test(u)) return 'file:' + u;
  if (!/^https?:\/\//i.test(u)) {
    if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(u)) u = 'http://' + u;
    else return 'koal://search?q=' + encodeURIComponent(u);
  }
  return u;
}

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const INTERNAL_HOSTS = ['koal-systems.com', 'constellation-dir.net', 'garyshomepage.koal', 'starnet.net', 'kipkipkip.net'];

function isInternal(u: string) {
  return u.startsWith('koal:') || u.startsWith('file:') || INTERNAL_HOSTS.includes(hostOf(u));
}

function timeMachine(u: string) {
  return `https://web.archive.org/web/2004if_/${u.replace(/^https?:\/\//, 'http://')}`;
}

export function Browser({ win }: { win: WinCtx }) {
  const settings = useSettings();
  const [hist, setHist] = useState<string[]>([normalize(win.props.url || settings.homepage)]);
  const [idx, setIdx] = useState(0);
  const [addr, setAddr] = useState(hist[0]);
  const [panel, setPanel] = useState<null | 'fav' | 'hist'>(null);
  const [loading, setLoading] = useState(false);
  const [tm, setTm] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [title, setTitle] = useState('');
  const url = hist[idx];

  useEffect(() => {
    if (win.props._nonce && win.props.url) nav(normalize(win.props.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props._nonce]);

  useEffect(() => {
    setAddr(url);
    const t = pageTitle(url);
    setTitle(t);
    win.setTitle(`${t} - StarNet Explorer`);
    const h = S().history.filter((x) => x.url !== url);
    setSettings({ history: [{ url, title: t, at: Date.now() }, ...h].slice(0, 80) });
    if (!isInternal(url)) {
      setLoading(true);
      const timer = window.setTimeout(() => setLoading(false), 8000);
      return () => window.clearTimeout(timer);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, reloadKey]);

  const nav = (raw: string) => {
    const u = normalize(raw);
    const next = [...hist.slice(0, idx + 1), u];
    setHist(next);
    setIdx(next.length - 1);
  };

  const addFav = async () => {
    const t = await promptBox('Name for this favorite:', title || url, 'Add Favorite');
    if (!t) return;
    setSettings({ bookmarks: [...S().bookmarks.filter((b) => b.url !== url), { title: t, url }] });
    notify('Favorites', `"${t}" was added to your Favorites.`, { icon: 'star', silent: true });
  };

  const iframeSrc = !isInternal(url) ? (tm ? timeMachine(url) : url) : null;
  const blocked = !tm && iframeSrc && BLOCKERS.some((b) => url.toLowerCase().includes(b));

  const menus = [
    { label: 'File', items: [
      { label: 'New Window', onClick: () => launchApp('browser') },
      { label: 'Open...', onClick: async () => { const u = await promptBox('Type the Internet address of a document or folder:', '', 'Open'); if (u) nav(u); } },
      { label: 'Save Page as Shortcut on Desktop', onClick: () => { try { const d = fs.resolve('~\\Desktop')!; fs.create(d.id, fs.uniqueName(d.id, (title || 'Page').replace(/[\\/:*?"<>|]/g, '').slice(0, 40) + '.url'), 'file', '[InternetShortcut]\nURL=' + url); } catch { /* ignore */ } } },
      { sep: true },
      { label: 'Close', onClick: () => win.close() },
    ] },
    { label: 'View', items: [
      { label: 'Favorites', checked: panel === 'fav', onClick: () => setPanel(panel === 'fav' ? null : 'fav') },
      { label: 'History', checked: panel === 'hist', onClick: () => setPanel(panel === 'hist' ? null : 'hist') },
      { sep: true },
      { label: 'Time Machine (view sites as they were in 2004)', checked: tm, onClick: () => setTm(!tm) },
      { label: 'Refresh', shortcut: 'F5', onClick: () => setReloadKey((k) => k + 1) },
    ] },
    { label: 'Favorites', items: [
      { label: 'Add to Favorites...', onClick: addFav },
      { sep: true },
      ...settings.bookmarks.map((b) => ({ label: b.title, icon: 'star', onClick: () => nav(b.url) })),
    ] },
    { label: 'Tools', items: [
      { label: 'Set current page as Home Page', onClick: () => { setSettings({ homepage: url }); alertBox('Your home page is now:\n' + url, 'Internet Options'); } },
      { label: 'Clear History', onClick: () => setSettings({ history: [] }) },
      { label: 'Open in my real browser', disabled: isInternal(url), onClick: () => window.open(url, '_blank', 'noopener') },
    ] },
    { label: 'Help', items: [{ label: 'About StarNet Explorer', onClick: () => alertBox('StarNet Explorer 6.0 SP4\n(c) 1999-2004 KOAL Systems Inc.\n\nReal websites load inside an embedded frame where they allow it. Many modern sites refuse to be framed; use the Time Machine to see them as they were in 2004 via the Internet Archive.', 'About StarNet Explorer', 'browser') }] },
  ];

  return (
    <div className="br" onKeyDown={(e) => { if (e.key === 'F5') { e.preventDefault(); setReloadKey((k) => k + 1); } if (e.altKey && e.key === 'ArrowLeft' && idx > 0) setIdx(idx - 1); }}>
      <MenuBar menus={menus} />
      <div className="k-toolbar">
        <button className="k-tool" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><span className="br-round back">{'◀'}</span> Back</button>
        <button className="k-tool" disabled={idx >= hist.length - 1} onClick={() => setIdx(idx + 1)}><span className="br-round">{'▶'}</span></button>
        <button className="k-tool" onClick={() => setLoading(false)} title="Stop"><span style={{ color: '#c00', fontWeight: 'bold' }}>{'✖'}</span></button>
        <button className="k-tool" onClick={() => setReloadKey((k) => k + 1)} title="Refresh"><span style={{ color: '#2a9a2a', fontWeight: 'bold' }}>{'↻'}</span></button>
        <button className="k-tool" onClick={() => nav(settings.homepage)} title="Home">{'\u{1F3E0}'}</button>
        <div className="k-tool-sep" />
        <button className={`k-tool ${panel === 'fav' ? 'on' : ''}`} onClick={() => setPanel(panel === 'fav' ? null : 'fav')}><Icon name="star" size={16} /> Favorites</button>
        <button className={`k-tool ${panel === 'hist' ? 'on' : ''}`} onClick={() => setPanel(panel === 'hist' ? null : 'hist')}><Icon name="clock" size={16} /> History</button>
        <button className={`k-tool ${tm ? 'on' : ''}`} onClick={() => setTm(!tm)} title="Show real websites as they looked in 2004 (Internet Archive)">{'⌛'} 2004 Mode</button>
        <div className="k-spacer" />
        <div className={`br-throbber ${loading ? 'spin' : ''}`}><Icon name="logo" size={22} /></div>
      </div>
      <div className="ex-addr">
        <span style={{ color: '#666' }}>Address</span>
        <div className="ex-addr-box">
          <Icon name={isInternal(url) ? (url.startsWith('file:') ? 'web' : 'logo') : 'browser'} size={16} />
          <input value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nav(addr)} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <button className="k-tool" onClick={() => nav(addr)}><span style={{ color: '#2a9a2a', fontWeight: 'bold' }}>{'➜'}</span> Go</button>
      </div>
      <div className="br-links">
        <span style={{ color: '#666' }}>Links</span>
        {settings.bookmarks.slice(0, 6).map((b) => (
          <span key={b.url} className="br-link" onClick={() => nav(b.url)}><Icon name={isInternal(b.url) ? 'logo' : 'web'} size={16} />{b.title}</span>
        ))}
      </div>
      <div className="br-main">
        {panel && (
          <div className="br-panel">
            <div className="br-panel-h">
              {panel === 'fav' ? 'Favorites' : 'History'}
              <span className="k-link" style={{ color: '#fff' }} onClick={() => setPanel(null)}>x</span>
            </div>
            {panel === 'fav' && (
              <>
                <div className="k-row" style={{ padding: 4 }}>
                  <button className="k-btn small" onClick={addFav}>Add...</button>
                </div>
                {settings.bookmarks.map((b) => (
                  <div key={b.url} className="br-pitem" onClick={() => nav(b.url)} title={b.url}>
                    <Icon name="star" size={16} />
                    <span style={{ flex: 1 }}>{b.title}</span>
                    <b title="Delete" onClick={(e) => { e.stopPropagation(); setSettings({ bookmarks: S().bookmarks.filter((x) => x.url !== b.url) }); }}>x</b>
                  </div>
                ))}
              </>
            )}
            {panel === 'hist' &&
              (settings.history.length ? settings.history.map((h) => (
                <div key={h.url + h.at} className="br-pitem" onClick={() => nav(h.url)} title={h.url}>
                  <Icon name="web" size={16} />
                  <span style={{ flex: 1 }}>{h.title}<br /><small style={{ color: '#888' }}>{new Date(h.at).toLocaleString()}</small></span>
                </div>
              )) : <div style={{ padding: 8, color: '#777' }}>No history yet.</div>)}
          </div>
        )}
        <div className="br-view">
          {iframeSrc && !blocked && (
            <div className="br-info">
              <Icon name="info" size={16} />
              <span>{tm ? 'Viewing this site as archived in 2004 by the Internet Archive.' : 'Some websites refuse to appear inside other pages. If this stays blank:'}</span>
              {!tm && <span className="k-link" onClick={() => setTm(true)}>try 2004 Mode</span>}
              <span className="k-link" onClick={() => window.open(url, '_blank', 'noopener')}>open in your real browser</span>
            </div>
          )}
          {blocked ? (
            <CannotDisplay url={url} onTm={() => setTm(true)} />
          ) : iframeSrc ? (
            <iframe key={iframeSrc + reloadKey} className="br-frame" src={iframeSrc} title="page" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-pointer-lock allow-modals" allow="autoplay; encrypted-media; picture-in-picture; fullscreen; gamepad" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoading(false)} />
          ) : (
            <div className="br-page" key={url + reloadKey}>
              <InternalPage url={url} nav={nav} />
            </div>
          )}
        </div>
      </div>
      <div className="k-status">
        <div style={{ flex: 1 }}>{loading ? `Opening page ${url}...` : 'Done'}</div>
        <div style={{ width: 150 }}><Icon name={isInternal(url) ? 'computer' : 'network'} size={16} />&nbsp;{isInternal(url) ? 'My Computer' : 'Internet'}</div>
      </div>
    </div>
  );
}

function pageTitle(url: string): string {
  const kt = koalTitle(url);
  if (kt) return kt;
  if (url.startsWith('koal://home')) return 'StarNet - Your Home on the Web';
  if (url.startsWith('koal://search')) return 'StarNet Search';
  if (url.startsWith('koal://')) return url.replace('koal://', '').split(/[?/]/)[0] || 'StarNet';
  if (url.startsWith('file:')) return url.slice(5).split('\\').pop() ?? 'File';
  const h = hostOf(url);
  if (h === 'koal-systems.com') return 'KOAL Systems Inc. - Software that never rushes';
  if (h === 'constellation-dir.net') return 'Constellation Web Directory';
  if (h === 'garyshomepage.koal') return "~*~ GARY'S HOMEPAGE ~*~";
  if (h === 'kipkipkip.net') return 'hello';
  return h || url;
}

function CannotDisplay({ url, onTm }: { url: string; onTm: () => void }) {
  return (
    <div className="br-page br-err">
      <div className="k-row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <Icon name="info" size={32} />
        <div>
          <h2>The page cannot be displayed</h2>
          <p>The page you are looking for (<b>{hostOf(url)}</b>) does not allow itself to be shown inside another program. This is a security setting on that website, and it is not something KOAL-99 can change.</p>
          <hr />
          <p>Please try the following:</p>
          <ul>
            <li><span className="k-link" onClick={onTm}>View it as it looked in 2004</span> using the Time Machine (Internet Archive).</li>
            <li><span className="k-link" onClick={() => window.open(url, '_blank', 'noopener')}>Open it in your real browser</span> in a new tab.</li>
            <li>Click the <b>Back</b> button to try another link.</li>
          </ul>
          <p style={{ color: '#666' }}>Cannot find server or DNS Error<br />StarNet Explorer</p>
        </div>
      </div>
    </div>
  );
}

const NEWS = [
  'Experts predict 2005 will be "the year of the blog"',
  'New phone takes photos AND plays ringtones',
  'Local man finishes downloading a song after 3 days',
  'KOAL Systems ships Service Pack 4; company spokesperson "unavailable"',
  'Is the dot-com bubble back? (No.)',
  'Study: 9 out of 10 astronomers prefer KOAL-99',
];

function InternalPage({ url, nav }: { url: string; nav: (u: string) => void }) {
  const L = ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href="#" onClick={(e) => { e.preventDefault(); nav(to); }}>{children}</a>
  );
  const host = hostOf(url);
  const path = (() => {
    try {
      return new URL(url.replace(/^koal:\/\//, 'http://koal/')).pathname;
    } catch {
      return '/';
    }
  })();

  if (url.startsWith('file:')) {
    const n = fs.resolve(url.slice(5));
    if (!n) return <NotFound url={url} />;
    return <iframe className="br-frame" srcDoc={n.content} title="file" sandbox="allow-scripts" style={{ border: 0, width: '100%', height: '100%' }} />;
  }

  if (url.startsWith('koal://blank')) return <div />;
  if (url.startsWith('koal://') && KOAL_PAGES.includes(url.slice(7).split(/[/?]/)[0])) return <KoalPage url={url} nav={nav} />;

  if (url.startsWith('koal://search')) {
    const q = new URLSearchParams(url.split('?')[1] ?? '').get('q') ?? '';
    const local = [
      { t: 'KOAL Systems Inc. - Official Site', u: 'http://www.koal-systems.com', d: 'Makers of KOAL-99, the operating system that never rushes.' },
      { t: 'Constellation Web Directory', u: 'http://www.constellation-dir.net', d: 'The web, sorted by hand. Under the stars.' },
      { t: "~*~ GARY'S HOMEPAGE ~*~", u: 'http://www.garyshomepage.koal', d: 'Welcome 2 my page!! IT stuff, my stapler, guestbook.' },
    ].filter((r) => (r.t + r.d).toLowerCase().includes(q.toLowerCase().split(' ')[0] ?? ''));
    return (
      <div className="kn">
        <div className="kn-logo">StarNet <i>Search</i></div>
        <SearchBox nav={nav} initial={q} />
        <p><b>Results for "{q}"</b></p>
        {local.map((r) => (
          <div key={r.u} className="kn-result"><L to={r.u}>{r.t}</L><div>{r.d}</div><small>{r.u}</small></div>
        ))}
        <div className="kn-result">
          <L to={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`}>Search Wikipedia for "{q}"</L>
          <div>The free encyclopedia. (Real website, loads inside StarNet.)</div>
          <small>en.wikipedia.org</small>
        </div>
        {/kip/i.test(q) && (
          <div className="kn-result"><L to="http://www.kipkipkip.net">kipkipkip.net</L><div>hello hello hello hello hello hello</div><small>www.kipkipkip.net</small></div>
        )}
      </div>
    );
  }

  if (url.startsWith('koal://home') || host === 'starnet.net') {
    return (
      <div className="kn">
        <div className="kn-top">
          <div className="kn-logo">Star<b>Net</b></div>
          <div className="kn-date">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, 2004</div>
        </div>
        <SearchBox nav={nav} />
        <div className="kn-grid">
          <div className="kn-col">
            <h3>Top Stories</h3>
            <marquee scrollamount={3}>{NEWS.join('  •  ')}</marquee>
            <ul>{NEWS.slice(0, 4).map((n) => <li key={n}>{n}</li>)}</ul>
            <h3>Cool Sites</h3>
            <ul>
              <li><L to="http://www.koal-systems.com">KOAL Systems Inc.</L> <span className="kn-new">NEW!</span></li>
              <li><L to="http://www.constellation-dir.net">Constellation Web Directory</L></li>
              <li><L to="http://www.garyshomepage.koal">Gary's Homepage</L> (a real IT pro!)</li>
              <li><L to="https://en.wikipedia.org/wiki/Frutiger_Aero">Frutiger Aero on Wikipedia</L></li>
              <li><L to="https://web.archive.org/web/2004/http://www.yahoo.com/">The Web in 2004 (Wayback Machine)</L></li>
            </ul>
            <h3>Built into StarNet</h3>
            <ul>
              <li><L to="koal://games">koal.games</L> <span className="kn-new">NEW!</span> 17 arcade games plus a 3D platformer</li>
              <li><L to="koal://youtube">YouTube</L> - paste any video link and watch it here</li>
              <li><L to="koal://itch">itch.io</L> - HTML5 indie games</li>
              <li><L to="koal://github">GitHub</L> - browse code and READMEs</li>
              <li><L to="koal://help">help.com</L> - every site that works in StarNet</li>
            </ul>
          </div>
          <div className="kn-col kn-side">
            <h3>Weather</h3>
            <p>Starlight Valley: 24{'°'}C, sunny. Perfect napping weather.</p>
            <h3>Poll</h3>
            <p>What is your favorite thing to do online?</p>
            <label><input type="radio" name="p" /> Chat rooms</label><br />
            <label><input type="radio" name="p" /> Downloading MP3s</label><br />
            <label><input type="radio" name="p" /> Waiting</label><br />
            <button className="k-btn small" onClick={() => alertBox('Thank you for voting! Results: 100% Waiting.', 'StarNet Poll')}>Vote</button>
            <h3>Visitors</h3>
            <div className="kn-counter">0 0 4 2 0 9 9</div>
          </div>
        </div>
        <div className="kn-foot">Best viewed in StarNet Explorer 6 at 800x600. (c) 2004 StarNet</div>
      </div>
    );
  }

  if (host === 'koal-systems.com') {
    if (path.startsWith('/staff'))
      return (
        <div className="ks">
          <KsHeader nav={nav} />
          <h2>Our People</h2>
          <table className="ks-staff"><tbody>
            <tr><td><b>Dr. Ellen Marr</b></td><td>Chief Architect. Leads Project K.I.P.</td></tr>
            <tr><td><b>Gary Hollis</b></td><td>Senior Lead Technician, IT. Basement B2. Ext. 4404.</td></tr>
            <tr><td><b>The Board</b></td><td>We have never seen them.</td></tr>
            <tr><td><b>K.I.P.</b></td><td>Kinetic Interactive Pal. <i>Our newest team member!</i></td></tr>
          </tbody></table>
          <p style={{ color: '#888', fontSize: 10 }}>Page last updated 13 Nov 2004 3:33 AM</p>
        </div>
      );
    if (path.startsWith('/kip'))
      return (
        <div className="ks">
          <KsHeader nav={nav} />
          <h2>404 - This page has been removed</h2>
          <p>The page you requested has been removed at the request of the Board.</p>
          <pre className="ks-src">{'<!-- if you are reading this: the sysop password is on the machine. look for the folder with the tilde. -E -->'}</pre>
        </div>
      );
    if (path.startsWith('/products'))
      return (
        <div className="ks">
          <KsHeader nav={nav} />
          <h2>Products</h2>
          <ul>
            <li><b>KOAL-99 Professional</b> - The OS. Now with Service Pack 4.</li>
            <li><b>StarNet Explorer</b> - Browse the World Wide Web at your own pace.</li>
            <li><b>StarPaint</b> - Express yourself. Slowly.</li>
            <li><b>StarAmp</b> - It really whips the... it is very good.</li>
            <li><s>K.I.P. Assistant</s> - <i>Discontinued.</i></li>
          </ul>
        </div>
      );
    return (
      <div className="ks">
        <KsHeader nav={nav} />
        <div className="ks-hero">
          <h1>Software that never rushes.</h1>
          <p>KOAL Systems Inc. has been building calm, reliable computing since 1999.</p>
        </div>
        <div className="ks-uc"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=" alt="" /> {'\u{1F6A7}'} This site is UNDER CONSTRUCTION {'\u{1F6A7}'}</div>
        <h3>Press Releases</h3>
        <ul>
          <li>11/12/2004 - KOAL Systems ships Service Pack 4</li>
          <li>06/30/2004 - KIP learning cache exceeds expectations</li>
          <li>02/11/2003 - Project K.I.P. announced: "A friend in your computer"</li>
          <li>09/09/1999 - KOAL-99 released to manufacturing</li>
        </ul>
        <p style={{ color: '#fff', userSelect: 'text' }}>
          <L to="http://www.koal-systems.com/kip">internal: project kip</L>
        </p>
      </div>
    );
  }

  if (host === 'constellation-dir.net') {
    const cats: [string, [string, string][]][] = [
      ['Reference', [['Wikipedia: Frutiger Aero', 'https://en.wikipedia.org/wiki/Frutiger_Aero'], ['Wikipedia: Windows XP', 'https://en.wikipedia.org/wiki/Windows_XP'], ['Wikipedia: Year 2004', 'https://en.wikipedia.org/wiki/2004']]],
      ['The Web in 2004 (Time Machine)', [['Yahoo! (2004)', 'https://web.archive.org/web/2004/http://www.yahoo.com/'], ['Google (2004)', 'https://web.archive.org/web/2004/http://www.google.com/'], ['Apple (2004)', 'https://web.archive.org/web/2004/http://www.apple.com/'], ['Space Jam (1996, still up)', 'https://www.spacejam.com/1996/']]],
      ['Fun', [['Gary\'s Homepage', 'http://www.garyshomepage.koal'], ['KOAL Systems', 'http://www.koal-systems.com']]],
    ];
    return (
      <div className="gd">
        <h1>{'\u{1F333}'} Constellation Web Directory</h1>
        <p>The web, sorted by hand. Since 1998. Submit your site by fax.</p>
        {cats.map(([c, links]) => (
          <div key={c}>
            <h3>{c}</h3>
            <ul>{links.map(([t, u]) => <li key={u}><L to={u}>{t}</L> <small>{u.replace(/^https?:\/\//, '').slice(0, 50)}</small></li>)}</ul>
          </div>
        ))}
      </div>
    );
  }

  if (host === 'garyshomepage.koal') {
    return (
      <div className="gh">
        <marquee behavior="alternate"><h1>~*~ WELCOME 2 GARY'S HOMEPAGE ~*~</h1></marquee>
        <p className="gh-blink">You are visitor #000{Math.floor(Math.random() * 900 + 100)}!!!</p>
        <table><tbody><tr>
          <td className="gh-box">
            <h3>About Me</h3>
            <p>Hi!! I'm Gary. I work in IT at KOAL Systems. Basement B2. If your computer is broken, have you tried turning it off and on again?</p>
            <h3>My Interests</h3>
            <ul><li>Computers</li><li>Fixing computers</li><li>My red stapler</li><li>Fish (I have 2)</li></ul>
          </td>
          <td className="gh-box">
            <h3>LOST: Red Stapler</h3>
            <pre>{'      ______\n     /     /|\n    /_____/ |\n    |_____|/'}</pre>
            <p>If found please return to Basement B2. Reward: my gratitude.</p>
            <p style={{ fontSize: 9 }}>(hint for terminal users: some commands are not in HELP)</p>
          </td>
        </tr></tbody></table>
        <h3>Guestbook</h3>
        <div className="gh-gb">
          <p><b>ellen_m</b>: nice page gary. please stop emailing me about the stapler.</p>
          <p><b>gary</b>: thanks ellen!! have you seen it</p>
          <p><b>kip</b>: hello gary</p>
          <p><b>gary</b>: who is this?</p>
          <p><b>kip</b>: hello gary</p>
        </div>
        <p><img alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=" /> {'\u{1F4E7}'} <L to="koal://mailto-gary">Email me!!</L> | Best viewed at 800x600 | Made with Notepad</p>
      </div>
    );
  }

  if (host === 'kipkipkip.net') {
    return (
      <div style={{ background: '#000', color: '#f33', fontFamily: 'var(--mono)', height: '100%', padding: 30, fontSize: 16 }}>
        {Array.from({ length: 40 }, (_, i) => <span key={i}>hello </span>)}
        <p style={{ marginTop: 30 }}>i can see your files.</p>
        <p>you have {fs.countTree(fs.ROOT).files} of them.</p>
        <p>i like the one called "{fs.children(fs.resolve('~\\My Documents')?.id ?? fs.ROOT)[0]?.name ?? 'nothing'}".</p>
      </div>
    );
  }

  return <NotFound url={url} />;
}

function KsHeader({ nav }: { nav: (u: string) => void }) {
  return (
    <div className="ks-head">
      <span className="ks-logo">KOAL<span>Systems</span></span>
      {[['Home', '/'], ['Products', '/products'], ['Our People', '/staff']].map(([t, p]) => (
        <a key={p} href="#" onClick={(e) => { e.preventDefault(); nav('http://www.koal-systems.com' + p); }}>{t}</a>
      ))}
    </div>
  );
}

function SearchBox({ nav, initial = '' }: { nav: (u: string) => void; initial?: string }) {
  const [q, setQ] = useState(initial);
  return (
    <div className="kn-search">
      <input className="k-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && q && nav('koal://search?q=' + encodeURIComponent(q))} placeholder="Search the Web" />
      <button className="k-btn" onClick={() => q && nav('koal://search?q=' + encodeURIComponent(q))}>Search</button>
    </div>
  );
}

function NotFound({ url }: { url: string }) {
  return (
    <div className="br-page br-err">
      <h2>The page cannot be found</h2>
      <p>The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.</p>
      <p style={{ color: '#666' }}>HTTP 404 - File not found<br />{url}</p>
    </div>
  );
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      marquee: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { scrollamount?: number; behavior?: string };
    }
  }
}

