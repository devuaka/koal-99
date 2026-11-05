// Video Editor: video / text / audio tracks, trims, splits, filters, fades, speed, and WebM export.
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import * as fs from '../../core/fs';
import { MenuBar } from '../../ui/MenuBar';
import { FileDialog } from '../../ui/FileDialog';
import { alertBox } from '../../core/dialog';
import { homePath } from '../../core/session';

type MType = 'video' | 'audio' | 'image';
interface Media {
  id: number;
  type: MType;
  name: string;
  url: string;
  dur: number;
  thumb?: string;
  el?: HTMLVideoElement | HTMLAudioElement | HTMLImageElement;
  wired?: boolean;
  blob?: boolean;
}
interface Clip {
  id: number;
  mid: number | null;
  tr: 0 | 1 | 2;
  s: number;
  d: number;
  in: number;
  speed: number;
  vol: number;
  op: number;
  fi: number;
  fo: number;
  filt: string;
  br: number;
  co: number;
  sa: number;
  text?: string;
  size?: number;
  color?: string;
  x?: number;
  y?: number;
  bold?: boolean;
}

const PRESETS: Record<string, string> = { none: '', bw: 'grayscale(1)', sepia: 'sepia(.9)', vivid: 'saturate(1.7) contrast(1.1)', cool: 'hue-rotate(-25deg) saturate(1.15)', warm: 'sepia(.35) saturate(1.3)', vintage: 'sepia(.5) contrast(.9) brightness(1.1)', blur: 'blur(4px)', invert: 'invert(1)' };
const KIND = ['clv', 'clt', 'cla'];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const fmt = (t0: number) => {
  const t = Math.max(0, t0);
  const m = Math.floor(t / 60);
  return String(m).padStart(2, '0') + ':' + (t - m * 60).toFixed(1).padStart(4, '0');
};

export function VideoEditor({ win }: { win: WinCtx }) {
  const S = useRef({ media: [] as Media[], clips: [] as Clip[], sel: null as number | null, t: 0, zoom: 70, playing: false, nid: 1, exporting: false, binSel: null as number | null, onEnd: null as null | (() => void), vt: null as null | { requestFrame?: () => void } });
  const [, setV] = useState(0);
  const refresh = () => setV((x) => x + 1);
  const [stat, setStat] = useState('Ready. Import a video, or add a color card and some text to try it out.');
  const [prog, setProg] = useState<number | null>(null);
  const [dlg, setDlg] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const headEl = useRef<HTMLDivElement>(null);
  const scrollEl = useRef<HTMLDivElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const audio = useRef<{ ac: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);
  const raf = useRef(0);
  const backup = useRef(0);
  const lastFrame = useRef(0);
  const t0 = useRef(0);
  const tb = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const s = S.current;

  const media = (id: number | null) => s.media.find((m) => m.id === id);
  const clip = (id: number | null) => s.clips.find((c) => c.id === id);
  const total = () => s.clips.reduce((a, c) => Math.max(a, c.s + c.d), 0);

  // ---------- audio graph (export + volume) ----------
  const ensureAudio = () => {
    if (!audio.current) {
      try {
        const ac = new AudioContext();
        audio.current = { ac, dest: ac.createMediaStreamDestination() };
      } catch {
        return;
      }
    }
    const { ac, dest } = audio.current;
    if (ac.state === 'suspended') ac.resume();
    s.media.forEach((m) => {
      if (m.el && m.type !== 'image' && !m.wired) {
        m.wired = true;
        try {
          const src = ac.createMediaElementSource(m.el as HTMLMediaElement);
          src.connect(ac.destination);
          src.connect(dest);
        } catch {
          /* already wired */
        }
      }
    });
  };

  // ---------- media ----------
  const addMedia = (m: Media) => {
    s.media.push(m);
    refresh();
    return m;
  };
  const addUrl = (type: MType, name: string, url: string, blob = false) => {
    const m: Media = { id: s.nid++, type, name, url, dur: type === 'image' ? 5 : 0, blob };
    if (type === 'image') {
      const im = new Image();
      im.onload = () => {
        m.el = im;
        m.thumb = url;
        refresh();
        render();
      };
      im.src = url;
    } else {
      const el = document.createElement(type);
      el.preload = 'auto';
      (el as HTMLVideoElement).playsInline = true;
      el.src = url;
      m.el = el;
      el.onloadedmetadata = () => {
        m.dur = el.duration || 5;
        refresh();
      };
      el.onseeked = () => !s.playing && render();
      if (type === 'video') {
        const tv = document.createElement('video');
        tv.muted = true;
        tv.preload = 'auto';
        tv.src = url;
        tv.onloadeddata = () => (tv.currentTime = Math.min(0.5, (tv.duration || 1) / 3));
        tv.onseeked = () => {
          const c = document.createElement('canvas');
          c.width = 96;
          c.height = 54;
          c.getContext('2d')!.drawImage(tv, 0, 0, 96, 54);
          m.thumb = c.toDataURL('image/jpeg', 0.6);
          refresh();
          tv.removeAttribute('src');
        };
      }
    }
    addMedia(m);
    setStat(`Imported ${name}. Double-click it in the Media list to add it to the timeline.`);
    return m;
  };
  const addFile = (f: File) => {
    const type: MType | null = f.type.startsWith('video') ? 'video' : f.type.startsWith('audio') ? 'audio' : f.type.startsWith('image') ? 'image' : null;
    if (!type) return setStat(`Can't use ${f.name} (not a video, audio or image file).`);
    addUrl(type, f.name, URL.createObjectURL(f), true);
  };
  const cardN = useRef(0);
  const makeCard = () => {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 720;
    const g = c.getContext('2d')!;
    const h = Math.floor(Math.random() * 360);
    const gr = g.createLinearGradient(0, 0, 1280, 720);
    gr.addColorStop(0, `hsl(${h},75%,55%)`);
    gr.addColorStop(1, `hsl(${h + 50},75%,35%)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 1280, 720);
    return addUrl('image', 'Color card ' + ++cardN.current, c.toDataURL('image/png'));
  };

  // ---------- timeline model ----------
  const overlap = (a: number, ad: number, b: number, bd: number) => a < b + bd - 1e-6 && b < a + ad - 1e-6;
  const freeSpot = (tr: number, st: number, d: number, ignore?: number) => {
    if (tr === 1) return st;
    for (let n = 0; n < 200; n++) {
      const hit = s.clips.find((c) => c.tr === tr && c.id !== ignore && overlap(st, d, c.s, c.d));
      if (!hit) break;
      st = hit.s + hit.d;
    }
    return st;
  };
  const newClip = (o: Partial<Clip>): Clip => ({ id: s.nid++, mid: null, tr: 0, s: 0, d: 3, in: 0, speed: 1, vol: 1, op: 1, fi: 0, fo: 0, filt: 'none', br: 100, co: 100, sa: 100, ...o });
  const select = (id: number | null) => {
    s.sel = id;
    refresh();
    render();
  };
  const addToTimeline = (m?: Media) => {
    if (!m) return setStat('Pick something in the Media list first.');
    const tr = m.type === 'audio' ? 2 : 0;
    const d = m.type === 'image' ? 4 : m.dur || 5;
    const c = newClip({ mid: m.id, tr, s: freeSpot(tr, s.t, d), d });
    s.clips.push(c);
    select(c.id);
    setStat(`Added ${m.name} to the ${tr === 2 ? 'audio' : 'video'} track.`);
  };
  const addText = () => {
    const c = newClip({ tr: 1, s: s.t, d: 3, text: 'Your text here', size: 64, color: '#ffffff', x: 0.5, y: 0.5, bold: true, fi: 0.3, fo: 0.3 });
    s.clips.push(c);
    select(c.id);
    setStat('Text added. Drag it in the preview to move it.');
  };
  const split = () => {
    const c = clip(s.sel) ?? s.clips.find((k) => k.tr === 0 && s.t > k.s && s.t < k.s + k.d);
    if (!c || s.t <= c.s + 0.05 || s.t >= c.s + c.d - 0.05) return setStat('Move the playhead inside a clip, then press Split.');
    const at = s.t;
    const c2: Clip = { ...c, id: s.nid++, s: at, d: c.s + c.d - at, in: c.in + (at - c.s) * c.speed, fi: 0 };
    c.d = at - c.s;
    c.fo = 0;
    s.clips.push(c2);
    select(c2.id);
    setStat('Split at ' + fmt(at));
  };
  const del = () => {
    if (!s.sel) return;
    s.clips = s.clips.filter((c) => c.id !== s.sel);
    select(null);
  };
  const dup = () => {
    const c = clip(s.sel);
    if (!c) return;
    const n = { ...c, id: s.nid++, s: freeSpot(c.tr, c.s + c.d, c.d) };
    s.clips.push(n);
    select(n.id);
  };

  // ---------- preview ----------
  const fadeGain = (c: Clip, t: number) => {
    let a = 1;
    const loc = t - c.s, rem = c.s + c.d - t;
    if (c.fi > 0 && loc < c.fi) a *= loc / c.fi;
    if (c.fo > 0 && rem < c.fo) a *= rem / c.fo;
    return clamp(a, 0, 1);
  };
  const filterOf = (c: Clip) => `brightness(${c.br}%) contrast(${c.co}%) saturate(${c.sa}%) ${PRESETS[c.filt] ?? ''}`;
  const activeAt = (tr: number, t: number) => {
    let r: Clip | null = null;
    s.clips.forEach((c) => c.tr === tr && t >= c.s - 1e-6 && t < c.s + c.d && (r = c));
    return r as Clip | null;
  };
  function render() {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height, t = s.t;
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const vc = activeAt(0, t);
    const m = vc && media(vc.mid);
    if (vc && m?.el) {
      const iw = m.type === 'image' ? (m.el as HTMLImageElement).naturalWidth : (m.el as HTMLVideoElement).videoWidth;
      const ih = m.type === 'image' ? (m.el as HTMLImageElement).naturalHeight : (m.el as HTMLVideoElement).videoHeight;
      if (iw && ih && (m.type === 'image' || (m.el as HTMLVideoElement).readyState >= 2)) {
        const k = Math.min(W / iw, H / ih);
        ctx.globalAlpha = vc.op * fadeGain(vc, t);
        ctx.filter = filterOf(vc);
        try {
          ctx.drawImage(m.el as CanvasImageSource, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
        } catch {
          /* not ready */
        }
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
      }
    }
    s.clips.forEach((cl) => {
      if (cl.tr !== 1 || t < cl.s || t >= cl.s + cl.d) return;
      const lines = String(cl.text).split('\n');
      const sz = (cl.size ?? 64) * (H / 720);
      ctx.save();
      // While paused, the selected text ignores its fades so you can see what you are editing.
      ctx.globalAlpha = cl.op * (!s.playing && cl.id === s.sel ? 1 : fadeGain(cl, t));
      ctx.font = (cl.bold ? 'bold ' : '') + sz + 'px "Segoe UI", Tahoma, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, sz / 12);
      ctx.strokeStyle = 'rgba(0,0,0,.65)';
      ctx.fillStyle = cl.color ?? '#fff';
      lines.forEach((ln, i) => {
        const y = (cl.y ?? 0.5) * H + (i - (lines.length - 1) / 2) * sz * 1.2;
        ctx.strokeText(ln, (cl.x ?? 0.5) * W, y);
        ctx.fillText(ln, (cl.x ?? 0.5) * W, y);
      });
      if (!s.exporting && cl.id === s.sel) {
        ctx.globalAlpha = 1;
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffd21f';
        const wd = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20, ht = lines.length * sz * 1.2 + 10;
        ctx.strokeRect((cl.x ?? 0.5) * W - wd / 2, (cl.y ?? 0.5) * H - ht / 2, wd, ht);
      }
      ctx.restore();
    });
    if (timeEl.current) timeEl.current.textContent = `${fmt(t)} / ${fmt(total())}`;
    if (headEl.current) headEl.current.style.left = t * s.zoom + 'px';
  }

  // ---------- playback ----------
  const syncMedia = (t: number, playing: boolean) => {
    const active = new Set<number>();
    s.clips.forEach((c) => {
      if (c.tr === 1) return;
      const m = media(c.mid);
      if (!m?.el || m.type === 'image') return;
      const el = m.el as HTMLMediaElement;
      if (playing && t >= c.s && t < c.s + c.d) {
        active.add(m.id);
        const exp = c.in + (t - c.s) * c.speed;
        el.playbackRate = c.speed;
        el.volume = clamp(c.vol * fadeGain(c, t), 0, 1);
        if (el.paused) {
          el.currentTime = exp;
          el.play().catch(() => {});
        } else if (Math.abs(el.currentTime - exp) > 0.35) el.currentTime = exp;
      }
    });
    s.media.forEach((m) => m.el && m.type !== 'image' && !active.has(m.id) && !(m.el as HTMLMediaElement).paused && (m.el as HTMLMediaElement).pause());
  };
  const seekPreview = (t: number) => {
    const vc = activeAt(0, t);
    const m = vc && media(vc.mid);
    if (vc && m?.type === 'video' && m.el) {
      const exp = vc.in + (t - vc.s) * vc.speed;
      if (Math.abs((m.el as HTMLVideoElement).currentTime - exp) > 0.02) (m.el as HTMLVideoElement).currentTime = exp;
    }
  };
  // One playback frame. rAF drives it normally; a timer takes over when the tab is hidden
  // (browsers pause rAF there), so playback and export keep going instead of stalling.
  const frame = (now: number) => {
    if (!s.playing) return;
    lastFrame.current = now;
    const t = tb.current + (now - t0.current) / 1000;
    const tot = total();
    if (t >= tot) {
      s.t = tot;
      stop();
      render();
      const f = s.onEnd;
      s.onEnd = null;
      f?.();
      return;
    }
    s.t = t;
    syncMedia(t, true);
    render();
    s.vt?.requestFrame?.();
    const sc = scrollEl.current;
    const x = t * s.zoom;
    if (sc && (x < sc.scrollLeft || x > sc.scrollLeft + sc.clientWidth - 30)) sc.scrollLeft = Math.max(0, x - 40);
    if (s.exporting) setProg(Math.min(100, (t / tot) * 100));
  };
  const tick = () => {
    frame(performance.now());
    if (s.playing) raf.current = requestAnimationFrame(tick);
  };
  const play = () => {
    if (s.playing) return;
    const tot = total();
    if (!tot) return setStat('Add something to the timeline first.');
    if (s.t >= tot - 0.05) s.t = 0;
    ensureAudio();
    s.playing = true;
    t0.current = performance.now();
    tb.current = s.t;
    lastFrame.current = t0.current;
    refresh();
    raf.current = requestAnimationFrame(tick);
    window.clearInterval(backup.current);
    backup.current = window.setInterval(() => {
      const now = performance.now();
      if (now - lastFrame.current > 120) frame(now);
    }, 40);
  };
  function stop() {
    s.playing = false;
    cancelAnimationFrame(raf.current);
    window.clearInterval(backup.current);
    syncMedia(s.t, false);
    refresh();
  }
  const setT = (t: number) => {
    s.t = clamp(t, 0, Math.max(total(), 0));
    if (s.playing) {
      t0.current = performance.now();
      tb.current = s.t;
    } else seekPreview(s.t);
    render();
  };

  // ---------- export ----------
  const doExport = async () => {
    if (s.exporting) return;
    const tot = total();
    if (!tot) return setStat('Nothing to export yet.');
    const c = cv.current!;
    if (!window.MediaRecorder || !c.captureStream) return setStat("This browser can't export video.");
    const mt = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((x) => MediaRecorder.isTypeSupported(x));
    if (!mt) return setStat("This browser can't export video.");
    stop();
    ensureAudio();
    const stream = c.captureStream(30);
    s.vt = stream.getVideoTracks()[0] as unknown as { requestFrame?: () => void };
    const hasSound = s.clips.some((cl) => cl.tr !== 1 && media(cl.mid) && media(cl.mid)!.type !== 'image');
    if (audio.current && audio.current.ac.state === 'running' && hasSound) audio.current.dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    const rec = new MediaRecorder(stream, { mimeType: mt, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    s.exporting = true;
    s.t = 0;
    setProg(0);
    setStat(`Exporting... the preview plays in real time (${fmt(tot)}). Please wait.`);
    rec.start(250);
    s.onEnd = () => setTimeout(() => rec.stop(), 300);
    play();
    await done;
    s.exporting = false;
    setProg(null);
    const blob = new Blob(chunks, { type: 'video/webm' });
    if (!blob.size) {
      setStat('The export came out empty. Keep this window visible while it renders and try again.');
      return render();
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'koal99-video.webm';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setStat(`Export finished: koal99-video.webm (${Math.round(blob.size / 1024)} KB) was saved to your downloads.`);
    render();
  };

  // ---------- lifecycle ----------
  useEffect(() => {
    render();
    return () => {
      s.playing = false;
      cancelAnimationFrame(raf.current);
      window.clearInterval(backup.current);
      s.media.forEach((m) => {
        (m.el as HTMLMediaElement | undefined)?.pause?.();
        if (m.blob) URL.revokeObjectURL(m.url);
      });
      audio.current?.ac.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => render());

  const onKey = (e: React.KeyboardEvent) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName) || s.exporting) return;
    const k = e.key;
    if (k === ' ') (e.preventDefault(), s.playing ? stop() : play());
    else if (k === 's' || k === 'S') split();
    else if (k === 'Delete' || k === 'Backspace') (e.preventDefault(), del());
    else if (k === 'ArrowLeft') (e.preventDefault(), setT(s.t - (e.shiftKey ? 1 : 1 / 30)));
    else if (k === 'ArrowRight') (e.preventDefault(), setT(s.t + (e.shiftKey ? 1 : 1 / 30)));
    else if (k === 'Home') setT(0);
    else if (k === 'End') setT(total());
  };

  // ---------- timeline dragging ----------
  const snapTo = (v: number, c: Clip) => {
    const pts = [0, s.t, ...s.clips.filter((k) => k !== c && k.tr === c.tr).flatMap((k) => [k.s, k.s + k.d])];
    const tol = 8 / s.zoom;
    for (const p of pts) if (Math.abs(v - p) < tol) return p;
    return v;
  };
  const startDrag = (e: React.PointerEvent, c: Clip, mode: 'l' | 'r' | 'move') => {
    if (s.exporting) return;
    e.stopPropagation();
    e.preventDefault();
    root.current?.focus();
    select(c.id);
    const sx = e.clientX, o = { s: c.s, d: c.d, in: c.in }, m = media(c.mid), isMedia = c.tr !== 1 && m && m.type !== 'image';
    const mv = (ev: PointerEvent) => {
      const dt = (ev.clientX - sx) / s.zoom;
      if (mode === 'move') {
        const ns = Math.max(0, o.s + dt);
        const a = snapTo(ns, c), e2 = snapTo(ns + c.d, c) - c.d;
        c.s = Math.max(0, a !== ns ? a : e2);
      } else if (mode === 'l') {
        let ds = clamp(dt, -o.s, o.d - 0.2);
        if (isMedia) ds = Math.max(ds, -o.in / c.speed);
        c.s = o.s + ds;
        c.d = o.d - ds;
        if (isMedia) c.in = o.in + ds * c.speed;
      } else {
        let nd = Math.max(0.2, o.d + dt);
        if (isMedia) nd = Math.min(nd, (m!.dur - c.in) / c.speed);
        c.d = nd;
      }
      refresh();
    };
    const up = () => {
      removeEventListener('pointermove', mv);
      removeEventListener('pointerup', up);
      c.s = freeSpot(c.tr, c.s, c.d, c.id);
      refresh();
    };
    addEventListener('pointermove', mv);
    addEventListener('pointerup', up);
  };
  const scrub = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.ve-clip')) return;
    const sc = scrollEl.current!;
    const r = sc.getBoundingClientRect();
    const setFrom = (ev: { clientX: number }) => setT((ev.clientX - r.left + sc.scrollLeft) / s.zoom);
    setFrom(e);
    if ((e.target as HTMLElement).classList.contains('ve-track')) select(null);
    const up = () => {
      removeEventListener('pointermove', setFrom);
      removeEventListener('pointerup', up);
    };
    addEventListener('pointermove', setFrom);
    addEventListener('pointerup', up);
  };

  // text dragging in the preview
  const tdrag = useRef(false);
  const cur = clip(s.sel);
  const m = cur ? media(cur.mid) : undefined;
  const wpx = Math.max(20, total() + 15) * s.zoom;
  const stepS = s.zoom >= 120 ? 1 : s.zoom >= 50 ? 2 : s.zoom >= 30 ? 5 : 10;
  const ticks: number[] = [];
  for (let x = 0; x * s.zoom < wpx; x += stepS) ticks.push(x);

  const set = (fn: (c: Clip) => void) => {
    if (!cur) return;
    fn(cur);
    refresh();
  };
  // A plain function (not a component) so the slider is not remounted mid-drag.
  const rng = (label: string, v: number, min: number, max: number, step: number, on: (x: number) => void) => (
    <label className="ve-row" key={label}><span>{label}</span><input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(() => on(+e.target.value))} /><em>{v.toFixed(step < 1 ? 2 : 0)}</em></label>
  );

  return (
    <div className="ve" ref={root} tabIndex={0} onKeyDown={onKey} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); [...e.dataTransfer.files].forEach(addFile); }}>
      <MenuBar menus={[
        { label: 'File', items: [
          { label: 'Import from my computer...', onClick: () => fileIn.current?.click() },
          { label: 'Import from KOAL-99...', onClick: () => setDlg(true) },
          { sep: true },
          { label: 'Export video (.webm)', onClick: doExport },
          { sep: true },
          { label: 'Close', onClick: () => win.close() },
        ] },
        { label: 'Edit', items: [
          { label: 'Split', shortcut: 'S', onClick: split },
          { label: 'Duplicate', onClick: dup },
          { label: 'Delete', shortcut: 'Del', onClick: del },
        ] },
        { label: 'Insert', items: [
          { label: 'Color card', onClick: () => addToTimeline(makeCard()) },
          { label: 'Text', onClick: addText },
        ] },
        { label: 'Help', items: [{ label: 'Keyboard shortcuts', onClick: () => alertBox('Space  play / pause\nS  split at the playhead\nDelete  delete clip\nLeft / Right  one frame (Shift: one second)\nHome / End  jump to start / end\n\nDrag clip edges to trim. Drag text in the preview to move it.', 'Video Editor', 'video') }] },
      ]} />
      <div className="k-toolbar">
        <button className="k-tool" onClick={() => fileIn.current?.click()}>+ Import</button>
        <button className="k-tool" onClick={() => setDlg(true)}>From KOAL-99</button>
        <button className="k-tool" onClick={() => addToTimeline(makeCard())}>Color card</button>
        <button className="k-tool" onClick={addText}>Text</button>
        <div className="k-tool-sep" />
        <button className="k-tool" onClick={split}>Split</button>
        <button className="k-tool" disabled={!cur} onClick={dup}>Duplicate</button>
        <button className="k-tool" disabled={!cur} onClick={del}>Delete</button>
        <div className="k-tool-sep" />
        <button className="k-tool" disabled={!!prog || !s.clips.length} onClick={doExport}>Export video</button>
        <span className="k-spacer" />
        <label className="ve-zoom">Zoom <input type="range" min={20} max={220} value={s.zoom} onChange={(e) => { s.zoom = +e.target.value; refresh(); }} /></label>
      </div>
      <input ref={fileIn} type="file" multiple accept="video/*,audio/*,image/*" style={{ display: 'none' }} onChange={(e) => { [...(e.target.files ?? [])].forEach(addFile); e.target.value = ''; }} />
      <div className="ve-main">
        <div className="ve-panel">
          <div className="ve-ph">Media <button className="k-btn small" onClick={() => addToTimeline(media(s.binSel) ?? s.media[s.media.length - 1])}>Add to timeline</button></div>
          <div className="ve-bin">
            {!s.media.length && <div className="ve-none">No media yet. Use Import, or add a Color card.</div>}
            {s.media.map((md) => (
              <div key={md.id} className={`ve-item ${s.binSel === md.id ? 'on' : ''}`} onClick={() => { s.binSel = md.id; refresh(); }} onDoubleClick={() => addToTimeline(md)}>
                <div className="ve-th">{md.thumb ? <img src={md.thumb} alt="" /> : md.type === 'audio' ? '♫' : '▶'}</div>
                <div className="ve-inf"><b>{md.name}</b><small>{md.type}{md.dur ? ' · ' + fmt(md.dur) : ''}</small></div>
                <button className="ve-x" title="Remove" onClick={(e) => { e.stopPropagation(); s.clips = s.clips.filter((c) => c.mid !== md.id); s.media = s.media.filter((o) => o !== md); (md.el as HTMLMediaElement | undefined)?.pause?.(); if (s.sel && !clip(s.sel)) s.sel = null; refresh(); }}>{'×'}</button>
              </div>
            ))}
          </div>
          <div className="ve-drop">Drop video, audio or image files anywhere in this window</div>
        </div>
        <div className="ve-prev">
          <div className="ve-stage">
            <canvas
              ref={cv}
              width={1280}
              height={720}
              onPointerDown={(e) => { const c = clip(s.sel); if (!c || c.tr !== 1 || s.t < c.s || s.t >= c.s + c.d || s.exporting) return; e.currentTarget.setPointerCapture(e.pointerId); tdrag.current = true; }}
              onPointerMove={(e) => { if (!tdrag.current) return; const c = clip(s.sel); if (!c) return; const r = e.currentTarget.getBoundingClientRect(); c.x = clamp((e.clientX - r.left) / r.width, 0, 1); c.y = clamp((e.clientY - r.top) / r.height, 0, 1); render(); }}
              onPointerUp={() => { if (tdrag.current) { tdrag.current = false; refresh(); } }}
            />
          </div>
          <div className="ve-transport">
            <button className="pv-b" title="Go to start" onClick={() => setT(0)}>{'⏮'}</button>
            <button className="pv-b big" title="Play / pause (Space)" onClick={() => (s.playing ? stop() : play())}>{s.playing ? '⏸' : '▶'}</button>
            <button className="pv-b" title="Go to end" onClick={() => setT(total())}>{'⏭'}</button>
            <span ref={timeEl} className="ve-time">00:00.0 / 00:00.0</span>
          </div>
        </div>
        <div className="ve-panel ve-props">
          <div className="ve-ph">Properties</div>
          {!cur ? (
            <div className="ve-none">Select a clip on the timeline to edit it.</div>
          ) : (
            <div className="ve-pb">
              <b>{cur.tr === 1 ? 'Text' : m?.name ?? 'Clip'}</b>
              <label className="ve-row"><span>Start (s)</span><input type="number" min={0} step={0.1} value={cur.s.toFixed(2)} onChange={(e) => set((c) => (c.s = freeSpot(c.tr, clamp(+e.target.value || 0, 0, 3600), c.d, c.id)))} /></label>
              <label className="ve-row"><span>Length (s)</span><input type="number" min={0.2} step={0.1} value={cur.d.toFixed(2)} onChange={(e) => set((c) => { let d = Math.max(0.2, +e.target.value || 0.2); if (c.tr !== 1 && m && m.type !== 'image') d = Math.min(d, (m.dur - c.in) / c.speed); c.d = d; })} /></label>
              {cur.tr === 1 && (
                <>
                  <label className="ve-row"><span>Text</span><textarea value={cur.text} onChange={(e) => set((c) => (c.text = e.target.value || ' '))} /></label>
                  {rng('Size', cur.size ?? 64, 16, 200, 1, (x) => (cur.size = x))}
                  <label className="ve-row"><span>Colour</span><input type="color" value={cur.color} onChange={(e) => set((c) => (c.color = e.target.value))} /></label>
                  <label className="ve-row"><span>Bold</span><input type="checkbox" checked={!!cur.bold} onChange={(e) => set((c) => (c.bold = e.target.checked))} /></label>
                  {rng('Position X', cur.x ?? 0.5, 0, 1, 0.01, (x) => (cur.x = x))}
                  {rng('Position Y', cur.y ?? 0.5, 0, 1, 0.01, (x) => (cur.y = x))}
                </>
              )}
              {cur.tr === 0 && (
                <>
                  <label className="ve-row"><span>Filter</span>
                    <select value={cur.filt} onChange={(e) => set((c) => (c.filt = e.target.value))}>
                      {Object.keys(PRESETS).map((k) => <option key={k} value={k}>{k === 'bw' ? 'Black & white' : k[0].toUpperCase() + k.slice(1)}</option>)}
                    </select>
                  </label>
                  {rng('Brightness', cur.br, 20, 220, 1, (x) => (cur.br = x))}
                  {rng('Contrast', cur.co, 20, 220, 1, (x) => (cur.co = x))}
                  {rng('Saturation', cur.sa, 0, 300, 1, (x) => (cur.sa = x))}
                </>
              )}
              {cur.tr === 0 && m?.type === 'video' && (
                <label className="ve-row"><span>Speed</span>
                  <select value={cur.speed} onChange={(e) => set((c) => { c.speed = +e.target.value; c.d = Math.min(c.d, (m.dur - c.in) / c.speed); })}>
                    {[0.25, 0.5, 1, 1.5, 2, 4].map((v) => <option key={v} value={v}>{v}x</option>)}
                  </select>
                </label>
              )}
              {((cur.tr === 0 && m?.type === 'video') || cur.tr === 2) && rng('Volume', cur.vol, 0, 1, 0.01, (x) => (cur.vol = x))}
              {cur.tr !== 2 && rng('Opacity', cur.op, 0, 1, 0.01, (x) => (cur.op = x))}
              {rng('Fade in (s)', cur.fi, 0, 3, 0.1, (x) => (cur.fi = x))}
              {rng('Fade out (s)', cur.fo, 0, 3, 0.1, (x) => (cur.fo = x))}
            </div>
          )}
        </div>
      </div>
      <div className="ve-tl">
        <div className="ve-labels"><div className="ve-lh" /><div>Video</div><div>Text</div><div>Audio</div></div>
        <div className="ve-scroll" ref={scrollEl}>
          <div className="ve-content" style={{ width: wpx }} onPointerDown={scrub}>
            <div className="ve-ruler">{ticks.map((x) => <span key={x} style={{ left: x * s.zoom }}>{fmt(x).slice(0, 5)}</span>)}</div>
            {[0, 1, 2].map((tr) => (
              <div key={tr} className="ve-track">
                {s.clips.filter((c) => c.tr === tr).map((c) => {
                  const md = media(c.mid);
                  const label = tr === 1 ? String(c.text).split('\n')[0] : md?.name ?? '?';
                  return (
                    <div key={c.id} className={`ve-clip ${KIND[tr]} ${c.id === s.sel ? 'on' : ''}`} style={{ left: c.s * s.zoom, width: Math.max(6, c.d * s.zoom) }} title={`${label} (${c.d.toFixed(1)}s)`} onPointerDown={(e) => startDrag(e, c, 'move')}>
                      <i className="ve-h l" onPointerDown={(e) => startDrag(e, c, 'l')} />
                      {label}
                      <i className="ve-h r" onPointerDown={(e) => startDrag(e, c, 'r')} />
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="ve-head" ref={headEl} />
          </div>
        </div>
      </div>
      <div className="k-status">
        <div style={{ flex: 1 }}>{stat}</div>
        {prog !== null && <div style={{ width: 180 }}><div className="k-progress" style={{ width: 160 }}><div style={{ width: prog + '%' }} /></div></div>}
      </div>
      {dlg && (
        <FileDialog
          mode="open"
          exts={['png', 'jpg', 'jpeg', 'gif', 'webp', 'kpx', 'wav', 'mp3', 'ogg']}
          filterLabel="Pictures and sounds"
          startDir={fs.resolve(homePath() + '\\My Pictures')?.id}
          onDone={(r) => {
            setDlg(false);
            const n = r?.node;
            if (!n) return;
            if (n.content.startsWith('data:image')) addUrl('image', n.name, n.content);
            else if (n.content.startsWith('data:audio')) addUrl('audio', n.name, n.content);
            else setStat(`${n.name} has no picture or sound in it.`);
          }}
        />
      )}
    </div>
  );
}
