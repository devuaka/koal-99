// Clock: analog + digital clock, stopwatch with laps, and a countdown timer with an alarm.
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import { play } from '../../core/sound';
import { notify } from '../../core/notify';

const two = (n: number) => String(Math.floor(n)).padStart(2, '0');
function fmtMs(ms: number) {
  const s = ms / 1000;
  return `${two(s / 3600)}:${two((s / 60) % 60)}:${two(s % 60)}.${two((ms % 1000) / 10)}`;
}

function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

function Analog() {
  const now = new Date(useNow(200));
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const hand = (deg: number, len: number, w: number, c: string) => <line x1="100" y1="100" x2="100" y2={100 - len} stroke={c} strokeWidth={w} strokeLinecap="round" transform={`rotate(${deg} 100 100)`} />;
  return (
    <div className="clk-face">
      <svg viewBox="0 0 200 200">
        <defs>
          <radialGradient id="cf" cx=".45" cy=".35" r=".7"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#dbe6f3" /></radialGradient>
          <linearGradient id="cr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fd8ff" /><stop offset="1" stopColor="#1c5fc0" /></linearGradient>
          <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        </defs>
        <circle cx="100" cy="100" r="96" fill="url(#cr)" />
        <circle cx="100" cy="100" r="86" fill="url(#cf)" />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i * 6 * Math.PI) / 180;
          const r1 = i % 5 ? 78 : 72;
          return <line key={i} x1={100 + Math.sin(a) * r1} y1={100 - Math.cos(a) * r1} x2={100 + Math.sin(a) * 82} y2={100 - Math.cos(a) * 82} stroke="#2a4a7a" strokeWidth={i % 5 ? 1 : 3} />;
        })}
        {[12, 3, 6, 9].map((n, i) => (
          <text key={n} x={100 + Math.sin((i * Math.PI) / 2) * 60} y={106 - Math.cos((i * Math.PI) / 2) * 60} textAnchor="middle" fontSize="16" fontFamily="Segoe UI" fill="#2a4a7a">{n}</text>
        ))}
        {hand(h * 30 + m * 0.5, 44, 7, '#1a2a40')}
        {hand(m * 6 + s * 0.1, 66, 4.5, '#1a2a40')}
        {hand(s * 6, 72, 2, '#e5352a')}
        <circle cx="100" cy="100" r="5" fill="#e5352a" />
        <ellipse cx="100" cy="55" rx="66" ry="36" fill="url(#gl)" opacity=".7" />
      </svg>
      <div className="clk-digital">{now.toLocaleTimeString()}</div>
      <div className="clk-date">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>
  );
}

function Stopwatch() {
  const [start, setStart] = useState<number | null>(null);
  const [acc, setAcc] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  useNow(start ? 30 : 1000);
  const elapsed = acc + (start ? Date.now() - start : 0);
  return (
    <div className="clk-pane">
      <div className="clk-big">{fmtMs(elapsed)}</div>
      <div className="k-row" style={{ justifyContent: 'center' }}>
        {start ? <button className="k-btn" onClick={() => { setAcc(elapsed); setStart(null); }}>Stop</button> : <button className="k-btn default" onClick={() => setStart(Date.now())}>Start</button>}
        <button className="k-btn" disabled={!start} onClick={() => setLaps([elapsed, ...laps])}>Lap</button>
        <button className="k-btn" onClick={() => { setStart(null); setAcc(0); setLaps([]); }}>Reset</button>
      </div>
      <div className="clk-laps">
        {laps.map((l, i) => (
          <div key={i}><span>Lap {laps.length - i}</span><b>{fmtMs(l)}</b><small>+{fmtMs(l - (laps[i + 1] ?? 0))}</small></div>
        ))}
      </div>
    </div>
  );
}

function Timer() {
  const [mins, setMins] = useState(5);
  const [secs, setSecs] = useState(0);
  const [end, setEnd] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const rang = useRef(false);
  const now = useNow(end ? 100 : 1000);
  const remain = end ? Math.max(0, end - now) : left ?? (mins * 60 + secs) * 1000;
  useEffect(() => {
    if (end && remain <= 0 && !rang.current) {
      rang.current = true;
      setEnd(null);
      setLeft(null);
      play('exclaim', true);
      window.setTimeout(() => play('exclaim', true), 700);
      notify('Timer', "Time's up!", { icon: 'clock' });
    }
  }, [end, remain]);
  const total = (mins * 60 + secs) * 1000 || 1;
  return (
    <div className="clk-pane">
      <div className="clk-big">{fmtMs(remain).slice(0, 8)}</div>
      <div className="k-progress" style={{ margin: '0 20px' }}><div style={{ width: `${100 - (remain / total) * 100}%` }} /></div>
      {!end && left === null && (
        <div className="k-row" style={{ justifyContent: 'center' }}>
          <input className="k-input" type="number" min={0} max={999} value={mins} onChange={(e) => setMins(Math.max(0, +e.target.value || 0))} style={{ width: 60 }} /> min
          <input className="k-input" type="number" min={0} max={59} value={secs} onChange={(e) => setSecs(Math.min(59, Math.max(0, +e.target.value || 0)))} style={{ width: 60 }} /> sec
        </div>
      )}
      <div className="k-row" style={{ justifyContent: 'center' }}>
        {end ? (
          <button className="k-btn" onClick={() => { setLeft(remain); setEnd(null); }}>Pause</button>
        ) : (
          <button className="k-btn default" onClick={() => { rang.current = false; setEnd(Date.now() + (left ?? total)); setLeft(null); }}>{left !== null ? 'Resume' : 'Start'}</button>
        )}
        <button className="k-btn" onClick={() => { setEnd(null); setLeft(null); }}>Reset</button>
      </div>
      <div className="k-row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        {[1, 3, 5, 10, 25, 60].map((m) => (
          <button key={m} className="k-btn small" disabled={!!end} onClick={() => { setMins(m); setSecs(0); setLeft(null); }}>{m} min</button>
        ))}
      </div>
    </div>
  );
}

export function ClockApp({ win }: { win: WinCtx }) {
  const [tab, setTab] = useState<'Clock' | 'Stopwatch' | 'Timer'>('Clock');
  return (
    <div className="clk">
      <div className="k-tabs" style={{ paddingTop: 6 }}>
        {(['Clock', 'Stopwatch', 'Timer'] as const).map((t) => (
          <div key={t} className={`k-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>
      <div className="k-tab-body" style={{ margin: '0 6px 6px' }}>
        <div style={{ display: tab === 'Clock' ? 'block' : 'none' }}><Analog /></div>
        <div style={{ display: tab === 'Stopwatch' ? 'block' : 'none' }}><Stopwatch /></div>
        <div style={{ display: tab === 'Timer' ? 'block' : 'none' }}><Timer /></div>
      </div>
    </div>
  );
}
