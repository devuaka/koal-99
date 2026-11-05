import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../core/registry';
import * as fs from '../core/fs';
import { makeDemoTrack } from '../core/sound';
import { useSettings } from '../core/settings';
import { FileDialog } from '../ui/FileDialog';
import { errorBox, alertBox } from '../core/dialog';
import { notify } from '../core/notify';
import { homePath } from '../core/session';

interface Track {
  name: string;
  url: string;
  fileId?: string;
  local?: File;
}

let demoUrl: string | null = null;
function demo() {
  if (!demoUrl) demoUrl = makeDemoTrack();
  return demoUrl;
}

function trackFromNode(n: fs.FSNode): Track | null {
  if (n.content === 'builtin:theme') return { name: n.name.replace(/\.[^.]+$/, ''), url: demo(), fileId: n.id };
  if (n.content.startsWith('data:audio') || n.content.startsWith('data:application/octet-stream')) return { name: n.name.replace(/\.[^.]+$/, ''), url: n.content, fileId: n.id };
  return null;
}

const t2s = (t: number) => (isFinite(t) ? `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}` : '0:00');

export function MediaPlayer({ win }: { win: WinCtx }) {
  const settings = useSettings();
  const [tracks, setTracks] = useState<Track[]>(() => {
    const n = win.props.fileId ? fs.get(win.props.fileId) : undefined;
    const t = n ? trackFromNode(n) : null;
    return t ? [t] : [{ name: 'KOAL-99 Theme', url: demo() }];
  });
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(true);
  const [dialog, setDialog] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const graph = useRef<{ ctx: AudioContext; an: AnalyserNode } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const track = tracks[cur];

  useEffect(() => {
    win.setTitle(track ? `${track.name} - StarAmp` : 'StarAmp');
  }, [track]);

  useEffect(() => {
    if (!win.props._nonce || !win.props.fileId) return;
    const n = fs.get(win.props.fileId);
    const t = n ? trackFromNode(n) : null;
    if (!t) return void errorBox('StarAmp cannot play this file. It does not contain audio data.', 'StarAmp');
    setTracks((ts) => [...ts, t]);
    setCur(tracks.length);
    setTimeout(() => play(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props._nonce]);

  useEffect(() => {
    if (win.props.fileId && !trackFromNode(fs.get(win.props.fileId)!)) errorBox('StarAmp cannot play this file. It does not contain audio data.', 'StarAmp');
    const a = audio.current;
    return () => {
      a?.pause();
      tracks.forEach((t) => t.local && URL.revokeObjectURL(t.url));
      graph.current?.ctx.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audio.current) audio.current.volume = settings.muted ? 0 : vol * Math.max(0.2, settings.volume);
  }, [vol, settings.muted, settings.volume]);

  const ensureGraph = () => {
    if (graph.current || !audio.current) return;
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(audio.current);
      const an = ctx.createAnalyser();
      an.fftSize = 64;
      src.connect(an);
      an.connect(ctx.destination);
      graph.current = { ctx, an };
    } catch {
      /* visualizer optional */
    }
  };

  const play = async () => {
    const a = audio.current;
    if (!a) return;
    ensureGraph();
    graph.current?.ctx.resume();
    try {
      await a.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };
  const pause = () => {
    audio.current?.pause();
    setPlaying(false);
  };
  const stop = () => {
    const a = audio.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setPlaying(false);
  };
  const go = (d: number) => {
    if (!tracks.length) return;
    let n = shuffle ? Math.floor(Math.random() * tracks.length) : cur + d;
    if (n < 0) n = tracks.length - 1;
    if (n >= tracks.length) {
      if (!repeat) return stop();
      n = 0;
    }
    setCur(n);
    setTimeout(play, 30);
  };

  // visualizer
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = canvas.current;
      if (c) {
        const g = c.getContext('2d')!;
        g.fillStyle = '#000';
        g.fillRect(0, 0, c.width, c.height);
        const an = graph.current?.an;
        const bars = 19;
        const data = new Uint8Array(32);
        if (an && playing) an.getByteFrequencyData(data);
        for (let i = 0; i < bars; i++) {
          const v = an && playing ? data[i + 1] / 255 : 0.02;
          const h = Math.max(1, v * c.height);
          for (let y = 0; y < h; y += 2) {
            const p = y / c.height;
            g.fillStyle = p > 0.75 ? '#ff4030' : p > 0.5 ? '#ffd040' : '#30e060';
            g.fillRect(i * 4 + 1, c.height - y - 1, 3, 1);
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const addLocal = (files: FileList | null) => {
    if (!files?.length) return;
    const add: Track[] = [...files].filter((f) => f.type.startsWith('audio') || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)).map((f) => ({ name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f), local: f }));
    if (!add.length) return errorBox('None of those files look like audio.', 'StarAmp');
    const first = tracks.length;
    setTracks((t) => [...t, ...add]);
    setCur(first);
    setTimeout(play, 50);
  };

  const importToMusic = async () => {
    const t = track;
    if (!t?.local) return;
    if (t.local.size > 8 * 1024 * 1024) return errorBox('That file is larger than 8 MB. The pretend hard drive is small and old. Try a shorter song.', 'StarAmp');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dir = fs.resolve(homePath() + '\\My Music') ?? fs.mkdirp(homePath() + '\\My Music');
        const name = fs.uniqueName(dir.id, t.local!.name.replace(/[\\/:*?"<>|]/g, '_'));
        const n = fs.create(dir.id, name, 'file', String(reader.result));
        setTracks((ts) => ts.map((x) => (x === t ? { ...x, fileId: n.id } : x)));
        notify('StarAmp', `"${name}" was copied to My Music.`, { icon: 'music' });
      } catch (e) {
        errorBox((e as Error).message, 'StarAmp');
      }
    };
    reader.readAsDataURL(t.local);
  };

  return (
    <div className="ka">
      <audio
        ref={audio}
        src={track?.url}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => go(1)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onError={() => track && errorBox(`StarAmp cannot play "${track.name}". The file may be damaged or in an unsupported format.`, 'StarAmp')}
      />
      <div className="ka-top">
        <div className="ka-lcd">
          <div className="ka-time">{playing ? '▶' : '■'} {t2s(time)}</div>
          <canvas ref={canvas} width={78} height={30} className="ka-vis" />
        </div>
        <div className="ka-info">
          <div className="ka-marquee"><span>{cur + 1}. {track?.name ?? 'No track'} ({t2s(dur)}) *** </span></div>
          <div className="ka-meta">{track?.local ? Math.round(track.local.size / 1024) + ' KB' : '22 kHz'}  stereo  KOAL</div>
          <div className="k-row" style={{ gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 9, color: '#9c9' }}>VOL</span>
            <input type="range" min={0} max={1} step={0.01} value={vol} onChange={(e) => setVol(+e.target.value)} className="ka-range" style={{ width: 90 }} />
          </div>
        </div>
      </div>
      <input type="range" className="ka-range ka-seek" min={0} max={dur || 0} step={0.1} value={time} onChange={(e) => { if (audio.current) audio.current.currentTime = +e.target.value; setTime(+e.target.value); }} />
      <div className="ka-ctrl">
        <button onClick={() => go(-1)} title="Previous">{'⏮'}</button>
        <button onClick={play} title="Play" className={playing ? 'on' : ''}>{'▶'}</button>
        <button onClick={pause} title="Pause">{'⏸'}</button>
        <button onClick={stop} title="Stop">{'⏹'}</button>
        <button onClick={() => go(1)} title="Next">{'⏭'}</button>
        <button onClick={() => fileInput.current?.click()} title="Open files from your real computer">{'⏏'}</button>
        <span className="k-spacer" />
        <button className={shuffle ? 'on' : ''} onClick={() => setShuffle(!shuffle)} title="Shuffle">SHUF</button>
        <button className={repeat ? 'on' : ''} onClick={() => setRepeat(!repeat)} title="Repeat">REP</button>
      </div>
      <input ref={fileInput} type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={(e) => { addLocal(e.target.files); e.target.value = ''; }} />
      <div className="ka-pl-head">PLAYLIST</div>
      <div className="ka-pl" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addLocal(e.dataTransfer.files); }}>
        {tracks.map((t, i) => (
          <div key={i} className={`ka-item ${i === cur ? 'cur' : ''}`} onDoubleClick={() => { setCur(i); setTimeout(play, 30); }}>
            <span>{i + 1}. {t.name}</span>
            <b title="Remove" onClick={(e) => { e.stopPropagation(); setTracks(tracks.filter((_, j) => j !== i)); if (i <= cur && cur > 0) setCur(cur - 1); }}>x</b>
          </div>
        ))}
        {!tracks.length && <div style={{ color: '#5a5', padding: 6 }}>Drop audio files here or press {'⏏'}</div>}
      </div>
      <div className="ka-bot">
        <button onClick={() => fileInput.current?.click()}>+ FILE</button>
        <button onClick={() => setDialog(true)}>+ MY MUSIC</button>
        <button disabled={!track?.local || !!track.fileId} onClick={importToMusic} title="Save a copy into the pretend hard drive">SAVE TO MY MUSIC</button>
        <button onClick={() => alertBox('StarAmp 2.91\n\nPlays audio files from your real computer (they stay on your computer) and sounds saved inside KOAL-99.\nDrag and drop files onto the playlist, or use the eject button.', 'About StarAmp', 'media')}>?</button>
      </div>
      {dialog && (
        <FileDialog
          mode="open"
          exts={['wav', 'mp3', 'ogg']}
          filterLabel="Audio (*.wav, *.mp3, *.ogg)"
          startDir={fs.resolve(homePath() + '\\My Music')?.id}
          onDone={(r) => {
            setDialog(false);
            const t = r?.node ? trackFromNode(r.node) : null;
            if (r && !t) return void errorBox('That file does not contain audio data.', 'StarAmp');
            if (t) {
              setTracks((ts) => [...ts, t]);
              setCur(tracks.length);
              setTimeout(play, 50);
            }
          }}
        />
      )}
    </div>
  );
}
