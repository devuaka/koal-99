// Music: a streaming playlist for SoundCloud links, YouTube links, direct audio URLs and dropped audio files.
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import { userName } from '../../core/session';
import { ytEmbed } from '../browser/KoalPages';
import { Icon } from '../../ui/Icon';

interface Track {
  kind: 'sc' | 'yt' | 'audio' | 'file';
  url: string;
  title?: string;
}

const key = () => 'koal99.music.' + userName();
function loadTracks(): Track[] {
  try {
    const v = JSON.parse(localStorage.getItem(key()) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parseLink(s: string): Track | null {
  try {
    const u = new URL(s.trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    const h = u.hostname.replace(/^(www\.|m\.)/, '');
    if (['soundcloud.com', 'on.soundcloud.com', 'snd.sc'].includes(h) && u.pathname.length > 1) return { kind: 'sc', url: 'https://' + h + u.pathname };
    const y = ytEmbed(u.href);
    if (y && y !== 'yt') return { kind: 'yt', url: u.href };
    if (/\.(mp3|m4a|ogg|wav|aac|flac|opus)$/i.test(u.pathname)) return { kind: 'audio', url: u.href };
  } catch {
    /* not a URL */
  }
  return null;
}

const slugTitle = (u: string) => {
  try {
    return decodeURIComponent(new URL(u).pathname.split('/').filter(Boolean).join(' / ').replace(/-/g, ' '));
  } catch {
    return u;
  }
};

declare global {
  interface Window {
    SC?: { Widget: ((el: HTMLIFrameElement) => { bind: (ev: string, fn: () => void) => void; toggle: () => void }) & { Events: { FINISH: string } } };
  }
}
let scApi: Promise<void> | null = null;
function loadSc() {
  if (window.SC) return Promise.resolve();
  if (!scApi)
    scApi = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://w.soundcloud.com/player/api.js';
      s.onload = () => res();
      s.onerror = () => {
        scApi = null;
        rej(new Error('SoundCloud player could not load'));
      };
      document.head.appendChild(s);
    });
  return scApi;
}

export function MusicApp({ win }: { win: WinCtx }) {
  const [tracks, setTracks] = useState<Track[]>(loadTracks);
  const [cur, setCur] = useState(-1);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('Paste or drop a SoundCloud, YouTube or audio link');
  const [over, setOver] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const widget = useRef<{ toggle: () => void } | null>(null);
  const track = tracks[cur];

  useEffect(() => {
    try {
      localStorage.setItem(key(), JSON.stringify(tracks.filter((t) => t.kind !== 'file')));
    } catch {
      /* ignore */
    }
  }, [tracks]);
  useEffect(() => {
    win.setTitle(track ? `${track.title ?? slugTitle(track.url)} - Music` : 'Music');
  }, [track?.url, track?.title]);

  const next = () => setCur((c) => (c + 1 < tracks.length ? c + 1 : (setMsg('End of playlist'), c)));
  const prev = () => setCur((c) => Math.max(0, c - 1));

  // hook the SoundCloud widget so the playlist moves on by itself
  useEffect(() => {
    widget.current = null;
    if (track?.kind !== 'sc' || !frame.current) return;
    const fr = frame.current;
    let live = true;
    loadSc()
      .then(() => {
        if (!live || !window.SC) return;
        const w = window.SC.Widget(fr);
        widget.current = w;
        w.bind(window.SC.Widget.Events.FINISH, () => next());
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, track?.url]);

  const addTrack = (t: Track, list: Track[]): [Track[], number] => {
    const at = list.findIndex((x) => x.url === t.url);
    if (at >= 0) return [list, at];
    const out = [...list, t];
    if (t.kind === 'sc' || t.kind === 'yt') {
      const ep = t.kind === 'sc' ? 'https://soundcloud.com/oembed?format=json&url=' : 'https://www.youtube.com/oembed?format=json&url=';
      fetch(ep + encodeURIComponent(t.url))
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.title && setTracks((ts) => ts.map((x) => (x.url === t.url ? { ...x, title: j.title } : x))))
        .catch(() => {});
    }
    return [out, out.length - 1];
  };

  const addLinks = (text: string) => {
    let list = tracks;
    let first = -1;
    let bad = 0;
    for (const s of text.split(/[\s\r\n]+/).filter((x) => x && !x.startsWith('#'))) {
      const p = parseLink(s);
      if (!p) {
        if (/^https?:/i.test(s)) bad++;
        continue;
      }
      const [l, i] = addTrack(p, list);
      list = l;
      if (first < 0) first = i;
    }
    setTracks(list);
    if (first >= 0 && cur < 0) setCur(first);
    else if (first >= 0) setMsg('Added to your playlist');
    else if (bad) setMsg("That doesn't look like a SoundCloud, YouTube or audio link.");
  };

  const toggle = () => {
    if (!track) return tracks.length && setCur(0);
    if (widget.current) widget.current.toggle();
    else if (audio.current) audio.current.paused ? audio.current.play() : audio.current.pause();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('audio/'));
    if (files.length) {
      let list = tracks;
      let first = -1;
      for (const f of files) {
        const [l, i] = addTrack({ kind: 'file', url: URL.createObjectURL(f), title: f.name }, list);
        list = l;
        if (first < 0) first = i;
      }
      setTracks(list);
      if (cur < 0) setCur(first);
    }
    const txt = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (txt) addLinks(txt);
  };

  return (
    <div className={`mus ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)} onDrop={onDrop}>
      <div className="mus-head">
        <Icon name="music" size={40} />
        <div>
          <b>{track ? track.title ?? slugTitle(track.url) : 'Nothing playing'}</b>
          <small>{track ? { sc: 'SoundCloud', yt: 'YouTube', audio: 'Audio link', file: 'Local file (this session only)' }[track.kind] : msg}</small>
        </div>
      </div>
      <div className="mus-stage">
        {!track && <div className="mus-empty">Drop a link or an audio file here<br /><small>or paste one below</small></div>}
        {track?.kind === 'sc' && (
          <iframe key={track.url} ref={frame} title="SoundCloud" allow="autoplay" src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&color=%232a8ae6&auto_play=true&hide_related=true&show_comments=false&show_reposts=false&visual=false`} />
        )}
        {track?.kind === 'yt' && <iframe key={track.url} title="YouTube" allow="autoplay; encrypted-media" src={ytEmbed(track.url) ?? ''} />}
        {(track?.kind === 'audio' || track?.kind === 'file') && <audio key={track.url} ref={audio} controls autoPlay src={track.url} onEnded={next} />}
      </div>
      <div className="mus-ctl">
        <button className="pv-b" title="Previous" onClick={prev}>{'⏮'}</button>
        <button className="pv-b big" title="Play / pause" onClick={toggle}>{'⏯'}</button>
        <button className="pv-b" title="Next" onClick={next}>{'⏭'}</button>
        <input className="k-input" value={input} placeholder="Paste a SoundCloud, YouTube or audio link" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && input.trim()) { addLinks(input); setInput(''); } }} />
        <button className="k-btn" onClick={() => { if (input.trim()) { addLinks(input); setInput(''); } }}>Add</button>
      </div>
      <div className="mus-list">
        {!tracks.length && <div className="mus-none">Your playlist is empty.</div>}
        {tracks.map((t, i) => (
          <div key={t.url} className={`mus-row ${i === cur ? 'on' : ''}`} onClick={() => setCur(i)}>
            <span className="n">{i + 1}</span>
            <span className="t">{t.title ?? slugTitle(t.url)}</span>
            <span className="k">{t.kind === 'sc' ? 'SC' : t.kind === 'yt' ? 'YT' : t.kind === 'file' ? 'FILE' : 'URL'}</span>
            <b title="Remove" onClick={(e) => { e.stopPropagation(); setTracks(tracks.filter((_, j) => j !== i)); if (cur === i) setCur(-1); else if (cur > i) setCur(cur - 1); }}>{'✕'}</b>
          </div>
        ))}
      </div>
      <div className="mus-hint"><b>How to add a song:</b> find it on soundcloud.com or YouTube in your real browser, then drag its link here or paste it above. Some artists don't allow their songs to play outside SoundCloud.</div>
    </div>
  );
}
