// koalOS browser features for StarNet Explorer: YouTube links, itch.io games, GitHub browsing,
// help.com, koal:// sites (koal.games, 3D Platformer) and the joke virus sites.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';
import { GamesSite } from './GamesSite';
import { Platformer } from '../lazy';
import { startIdiot, startVirus } from '../../ui/Pranks';
import { BLOCKED, DEFAULT_SITES, EXT, ITCH, KOAL_SITES, SITES } from './sites';
import { GAME_SLUG, GAMES } from '../games';

/** YouTube watch/short/youtu.be/playlist links -> privacy-friendly embed URL. 'yt' = YouTube but not a video. */
export function ytEmbed(u: string): string | null {
  let x: URL;
  try {
    x = new URL(u);
  } catch {
    return null;
  }
  const h = x.hostname.replace(/^(www\.|m\.|music\.)/, '');
  if (!['youtu.be', 'youtube.com', 'youtube-nocookie.com'].includes(h)) return null;
  const list = x.searchParams.get('list');
  const t = parseInt(x.searchParams.get('t') || x.searchParams.get('start') || '', 10) || 0;
  const emb = (id: string) => {
    const p = new URLSearchParams({ autoplay: '1', rel: '0' });
    if (list) p.set('list', list);
    if (t) p.set('start', String(t));
    return 'https://www.youtube-nocookie.com/embed/' + id + '?' + p;
  };
  if (h === 'youtu.be') {
    const id = x.pathname.slice(1).split('/')[0];
    return id ? emb(id) : 'yt';
  }
  const m = x.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{6,})/);
  if (m && m[1] !== 'videoseries') return emb(m[1]);
  if (x.pathname === '/watch' && x.searchParams.get('v')) return emb(x.searchParams.get('v')!);
  if (list && (x.pathname === '/playlist' || m)) return 'https://www.youtube-nocookie.com/embed/videoseries?' + new URLSearchParams({ list, autoplay: '1' });
  return 'yt';
}

const KOAL_SITE_IDS = ['3d-platformer', 'games'];

/** Map typed addresses to koal:// pages. Returns null when it is an ordinary address. */
export function routeKoal(t: string): string | null {
  const s = t.trim();
  if (/^youtube(\.com)?\/?$/i.test(s)) return 'koal://youtube';
  if (/^itch(\.io)?\/?$/i.test(s)) return 'koal://itch';
  if (/^github(\.com)?\/?$/i.test(s)) return 'koal://github';
  if (/^help(\.com)?\/?$/i.test(s)) return 'koal://help';
  if (/^virus(\.com)?\/?$/i.test(s)) return 'koal://virus';
  if (/^youareanidiot(\.(org|com))?\/?$/i.test(s)) return 'koal://idiot';
  const gm = s.match(/^(?:koal\.games|koal:\/\/games)(?:\/([\w-]+))?\/?$/i);
  if (gm) return 'koal://games' + (gm[1] ? '/' + gm[1].toLowerCase() : '');
  const km = s.match(/^koal:\/*([\w-]+)\/?$/i) ?? s.match(/^koal:\/*([\w-]+)/i);
  if (km && KOAL_SITE_IDS.includes(km[1].toLowerCase())) return s;
  // koal://snake, koal://pong ... are the games' own addresses
  if (km && GAME_SLUG[km[1].toLowerCase()]) return 'koal://games/' + km[1].toLowerCase();
  let u: URL | null = null;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
  } catch {
    return null;
  }
  if (!/^https?:\/\//i.test(s) && !/^[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(s)) return null;
  const h = u.hostname.replace(/^www\./, '');
  if (h === 'itch.io' || h.endsWith('.itch.io')) return 'koal://itch';
  if (h === 'help.com') return 'koal://help';
  if (h === 'virus.com') return 'koal://virus';
  if (h === 'youareanidiot.org' || h === 'youareanidiot.com') return 'koal://idiot';
  if (h === 'github.com') {
    const p = u.pathname.split('/').filter(Boolean);
    return p.length >= 2 ? `koal://github/${p[0]}/${p[1]}` : 'koal://github';
  }
  const y = ytEmbed(u.href);
  if (y === 'yt') return 'koal://youtube';
  if (y) return y;
  return null;
}

export function koalTitle(url: string): string | null {
  const r = url.replace(/^koal:\/\//, '');
  if (!url.startsWith('koal://')) return url.includes('youtube-nocookie.com/embed') ? 'YouTube' : url.includes('itch.io/embed-upload') ? 'itch.io' : null;
  if (r.startsWith('youtube')) return 'YouTube';
  if (r.startsWith('itch')) return 'itch.io - HTML5 games';
  if (r.startsWith('github')) return 'GitHub' + (r.length > 7 ? ' - ' + r.slice(7) : '');
  if (r.startsWith('help')) return 'help.com';
  if (r.startsWith('virus')) return 'virus.com';
  if (r.startsWith('idiot')) return 'youareanidiot.org';
  if (r.startsWith('games')) {
    const g = GAMES[GAME_SLUG[r.slice(6).toLowerCase()]];
    return g ? g.name + ' - koal.games' : 'koal.games';
  }
  if (r.startsWith('3d-platformer')) return '3D Platformer';
  return null;
}

export function KoalPage({ url, nav }: { url: string; nav: (u: string) => void }) {
  const r = url.replace(/^koal:\/\//, '');
  if (r.startsWith('youtube')) return <YouTubePage nav={nav} />;
  if (r.startsWith('itch')) return <ItchPage nav={nav} />;
  if (r.startsWith('github')) return <GitHubPage repoPath={r.slice(7)} nav={nav} />;
  if (r.startsWith('help')) return <HelpPage nav={nav} />;
  if (r.startsWith('virus')) return <VirusPage />;
  if (r.startsWith('idiot')) return <IdiotPage />;
  const [site, ...sub] = r.split('/');
  if (site === 'games') return <GamesSite sub={sub.join('/')} nav={nav} />;
  if (site === '3d-platformer') return <Platformer />;
  return null;
}

function YouTubePage({ nav }: { nav: (u: string) => void }) {
  const [v, setV] = useState('');
  const go = () => {
    const e = ytEmbed(v.trim());
    if (e && e !== 'yt') nav(e);
  };
  return (
    <div className="kp-page kp-yt">
      <div className="kp-yt-logo"><span>{'▶'}</span> YouTube</div>
      <input className="k-input" autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} placeholder="Paste a YouTube video or playlist link" />
      <button className="k-btn default" onClick={go}>Watch</button>
      <p>Paste a link (youtube.com/watch, youtu.be, shorts or playlist) and press Enter to watch it right here.<br />YouTube search and its home page can't be shown inside other pages. Use Tools &gt; Open in my real browser for those.</p>
    </div>
  );
}

function ItchPage({ nav }: { nav: (u: string) => void }) {
  const [q, setQ] = useState('');
  const list = ITCH.filter((g) => !q || (g[0] + ' ' + g[1] + ' ' + g[2]).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="kp-page">
      <div className="kp-head"><b>itch.io</b><span>HTML5 games you can play right here</span><input className="k-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter games" /></div>
      <div className="kp-grid">
        {list.map((g) => (
          <button key={g[4]} className="kp-card" onClick={() => nav('https://itch.io/embed-upload/' + g[4] + '?color=333333')}>
            {g[3] ? <img src={g[3]} alt="" loading="lazy" /> : <div className="kp-ph"><Icon name="game" size={48} /></div>}
            <b>{g[0]}</b>
            <span>{g[2] ? g[2] + ' · ' + g[1] : g[1]}</span>
          </button>
        ))}
        {!list.length && <p>No games match.</p>}
      </div>
    </div>
  );
}

const TEXTLESS = /\.(png|jpe?g|gif|webp|ico|bmp|zip|gz|tar|7z|exe|dll|so|pdf|woff2?|ttf|mp[34]|wav|ogg|mov|bin)$/i;
async function gapi(p: string, html = false) {
  const r = await fetch('https://api.github.com' + p, { headers: { Accept: html ? 'application/vnd.github.html' : 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(r.status === 403 || r.status === 429 ? 'GitHub is limiting requests (60 per hour without signing in). Try again later.' : r.status === 404 ? 'Not found.' : 'GitHub error ' + r.status);
  return html ? r.text() : r.json();
}

function GitHubPage({ repoPath, nav }: { repoPath: string; nav: (u: string) => void }) {
  const parts = repoPath.split('/').filter(Boolean);
  const repo = parts.length >= 2 ? parts[0] + '/' + parts[1] : '';
  const path = parts.slice(2).join('/');
  const [q, setQ] = useState('');
  const [state, setState] = useState<{ msg?: string; results?: any[]; info?: any; items?: any; code?: string; readme?: string }>({});
  useEffect(() => {
    if (!repo) {
      setState({ msg: 'Search for a repository above, or type owner/repo (for example torvalds/linux).' });
      return;
    }
    let live = true;
    setState({ msg: 'Loading ' + repo + '...' });
    (async () => {
      try {
        const [info, items] = await Promise.all([gapi('/repos/' + repo), gapi('/repos/' + repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/'))]);
        if (!live) return;
        if (Array.isArray(items)) {
          items.sort((a: any, b: any) => (a.type === 'dir' ? 0 : 1) - (b.type === 'dir' ? 0 : 1) || a.name.localeCompare(b.name));
          setState({ info, items });
          if (!path) {
            try {
              const readme = await gapi('/repos/' + repo + '/readme', true);
              if (live) setState({ info, items, readme });
            } catch {
              /* no readme */
            }
          }
        } else if (items.size > 400000 || TEXTLESS.test(items.name)) setState({ info, msg: `This file can't be previewed here (${Math.round(items.size / 1024)} KB).` });
        else {
          const txt = await (await fetch(items.download_url)).text();
          if (live) setState({ info, code: txt });
        }
      } catch (e) {
        if (live) setState({ msg: (e as Error).message });
      }
    })();
    return () => {
      live = false;
    };
  }, [repo, path]);
  const search = async () => {
    const v = q.trim();
    if (!v) return;
    if (/^[\w.-]+\/[\w.-]+$/.test(v)) return nav('koal://github/' + v);
    setState({ msg: 'Searching...' });
    try {
      const j = await gapi('/search/repositories?per_page=25&q=' + encodeURIComponent(v));
      setState(j.items.length ? { results: j.items } : { msg: 'No repositories found.' });
    } catch (e) {
      setState({ msg: (e as Error).message });
    }
  };
  const crumbs = path ? path.split('/') : [];
  return (
    <div className="kp-page">
      <div className="kp-head"><b>GitHub</b><span>Browse repositories and code</span><input className="k-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search, or type owner/repo" /></div>
      <div className="kp-gh">
        {state.results?.map((r) => (
          <button key={r.full_name} className="kp-ghrow" onClick={() => nav('koal://github/' + r.full_name)}>
            <b>{r.full_name}</b>
            <span>{r.description || 'No description'}</span>
            <small>{'★'} {r.stargazers_count.toLocaleString()}{r.language ? '  ·  ' + r.language : ''}</small>
          </button>
        ))}
        {state.info && (
          <div className="kp-ghinfo">
            <h3>{state.info.full_name}</h3>
            <p>{state.info.description}</p>
            <small>{'★'} {state.info.stargazers_count.toLocaleString()}   Forks {state.info.forks_count.toLocaleString()}   {state.info.language ?? ''}</small>
            <div className="kp-crumbs">
              <span className="k-link" onClick={() => nav('koal://github/' + repo)}>{state.info.name}</span>
              {crumbs.map((c, i) => (
                <span key={i}> / <span className="k-link" onClick={() => nav('koal://github/' + repo + '/' + crumbs.slice(0, i + 1).join('/'))}>{c}</span></span>
              ))}
            </div>
          </div>
        )}
        {Array.isArray(state.items) &&
          state.items.map((it: any) => (
            <div key={it.path} className="kp-ghfile" onClick={() => nav('koal://github/' + repo + '/' + it.path)}>
              <Icon name={it.type === 'dir' ? 'folder' : 'text'} size={16} /> {it.name}
            </div>
          ))}
        {state.code !== undefined && <pre className="kp-code">{state.code}</pre>}
        {state.readme && (
          <>
            <div className="kp-rt">README</div>
            <iframe className="kp-readme" sandbox="allow-popups" referrerPolicy="no-referrer" title="readme" srcDoc={`<base href="https://raw.githubusercontent.com/${repo}/HEAD/" target="_blank"><style>body{font:14px Segoe UI,Tahoma,sans-serif;padding:14px;color:#222;line-height:1.5}img{max-width:100%}pre{background:#f4f4f4;padding:8px;overflow:auto}code{background:#f4f4f4}a{color:#0969da}</style>${state.readme}`} />
          </>
        )}
        {state.msg && <div className="kp-msg">{state.msg}</div>}
      </div>
    </div>
  );
}

function HelpPage({ nav }: { nav: (u: string) => void }) {
  const L = ({ n, d, to }: { n: string; d: string; to: string }) => (
    <button className="kp-hlink" onClick={() => nav(to)}><b>{n}</b><span>{d}</span></button>
  );
  return (
    <div className="kp-page kp-help">
      <div className="kp-head"><b>help.com</b><span>Websites that work inside this browser</span></div>
      <h3>koalsites</h3>
      <p>Sites built into KOAL-99 itself. They run right here and always work.</p>
      {KOAL_SITES.map((s) => <L key={s.id} n={s.name} d={s.desc} to={'koal://' + s.id} />)}
      <h3>Built into this browser</h3>
      <L n="YouTube" d="Type youtube.com, or paste any video or playlist link" to="koal://youtube" />
      <L n="itch.io games" d="HTML5 games you can play right here" to="koal://itch" />
      <L n="GitHub" d="Search repos, browse code, read READMEs" to="koal://github" />
      <h3>Default sites</h3>
      {DEFAULT_SITES.map(([n, u, d]) => <L key={u} n={n} d={d} to={u} />)}
      <h3>Websites that work here</h3>
      <p>These allowed being shown inside another page when koalOS checked them. A site can change its rules later.</p>
      {SITES.map(([n, u, d]) => <L key={u} n={n} d={d} to={u} />)}
      <h3>One click away (opens in a real tab)</h3>
      {EXT.map(([n, u, d]) => <button key={u} className="kp-hlink" onClick={() => window.open(u, '_blank', 'noopener')}><b>{n}</b><span>{d}</span></button>)}
      <h3>Sites that will NOT work here</h3>
      <p className="kp-bad">{BLOCKED.join('  ·  ')}</p>
      <h3>Virus sites</h3>
      <p>Joke sites that only PRETEND to infect the fake computer. Nothing is deleted or changed, and Esc reboots KOAL-99.</p>
      <L n="virus.com" d="Free wallpapers? What could go wrong" to="koal://virus" />
      <L n="youareanidiot" d="The classic annoying popup site" to="koal://idiot" />
    </div>
  );
}

function VirusPage() {
  return (
    <div className="kp-page kp-virus">
      <div className="vhead1">!!! CONGRATULATIONS !!!</div>
      <div className="vbig">You are visitor #1,000,000</div>
      <p>Claim your <b>FREE WALLPAPERS</b> and a <b>FREE PRIZE</b>. Just one click!</p>
      <button className="vdl" onClick={startVirus}>DOWNLOAD FREE_WALLPAPERS.EXE</button>
      <p className="vfine">Easter egg: this is a joke site. It only <i>pretends</i> to infect the fake computer. Nothing is deleted or changed, and pressing Esc reboots it.</p>
    </div>
  );
}

function IdiotPage() {
  useEffect(() => {
    const t = window.setTimeout(startIdiot, 900);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="kp-page kp-idiot">
      <img src="koalos/idiot.gif" alt="you are an idiot" />
      <p className="vfine">Easter egg: a joke site. It only pretends. Nothing is deleted or changed, and pressing Esc reboots.</p>
    </div>
  );
}
