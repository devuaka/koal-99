// The joke pranks from koalOS, remade: virus.com, youareanidiot and catbomb.
// They only pretend. Nothing is deleted or changed; Esc reboots (catbomb: P stops it).
import { useEffect, useRef } from 'react';
import { createStore } from '../core/store';
import { TASKBAR_H } from '../core/wm';
import { bsod, shutdown } from '../core/system';
import { notify } from '../core/notify';

type Kind = 'virus' | 'del' | 'idiot' | 'cat';
interface Pop {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  title: string;
  msg?: string;
}
interface PrankState {
  virus: boolean;
  idiot: boolean;
  cats: boolean;
  end: boolean;
  pops: Pop[];
  delPct: number;
  delName: string;
}
const EMPTY: PrankState = { virus: false, idiot: false, cats: false, end: false, pops: [], delPct: 0, delName: '' };
export const prankStore = createStore<PrankState>({ ...EMPTY });

const asset = (f: string) => import.meta.env.BASE_URL + 'koalos/' + f;
const rand = (n: number) => Math.random() * Math.max(1, n);
const spd = (a: number, b: number) => (Math.random() < 0.5 ? -1 : 1) * (a + Math.random() * (b - a));
const W = () => innerWidth;
const H = () => innerHeight - TASKBAR_H;

let nid = 1, raf = 0;
let timers: number[] = [];
let audio: HTMLAudioElement | null = null;
let onVirusOk: () => void = () => {};
let onIdiotX: () => void = () => {};

const later = (f: () => void, ms: number) => timers.push(window.setTimeout(f, ms));
const every = (f: () => void, ms: number) => timers.push(window.setInterval(f, ms));

function addPop(p: Omit<Pop, 'id'>) {
  const id = nid++;
  prankStore.set((s) => ({ pops: [...s.pops, { ...p, id }] }));
  mover();
  return id;
}
function removePop(id: number) {
  prankStore.set((s) => ({ pops: s.pops.filter((p) => p.id !== id) }));
}
/** Moves the bouncing windows straight in the DOM (no re-render per frame). */
function mover() {
  if (raf) return;
  let last = performance.now();
  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let any = false;
    for (const p of prankStore.get().pops) {
      if (!p.vx && !p.vy) continue;
      any = true;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const mw = Math.max(0, W() - p.w), mh = Math.max(0, H() - p.h);
      if (p.x < 0 || p.x > mw) (p.vx *= -1), (p.x = Math.max(0, Math.min(mw, p.x)));
      if (p.y < 0 || p.y > mh) (p.vy *= -1), (p.y = Math.max(0, Math.min(mh, p.y)));
      const el = document.getElementById('prank-' + p.id);
      if (el) {
        el.style.left = p.x + 'px';
        el.style.top = p.y + 'px';
      }
    }
    raf = any ? requestAnimationFrame(step) : 0;
  };
  raf = requestAnimationFrame(step);
}
function playLoop(file: string) {
  audio?.pause();
  audio = new Audio(asset(file));
  audio.loop = true;
  audio.volume = 0.85;
  const a = audio;
  a.play().catch(() => addEventListener('pointerdown', () => a === audio && a.play().catch(() => {}), { once: true }));
}
function onKey(e: KeyboardEvent) {
  const s = prankStore.get();
  if (e.key === 'Escape' && (s.virus || s.idiot || s.end)) {
    stopPranks();
    shutdown(true);
  } else if (s.end) {
    stopPranks();
    shutdown(true);
  } else if (e.key.toLowerCase() === 'p' && s.cats && !s.virus && !s.idiot) stopCatBomb();
}
function arm() {
  removeEventListener('keydown', onKey, true);
  addEventListener('keydown', onKey, true);
}

/** Stops everything (no reboot). */
export function stopPranks() {
  timers.forEach((t) => (clearTimeout(t), clearInterval(t)));
  timers = [];
  cancelAnimationFrame(raf);
  raf = 0;
  audio?.pause();
  audio = null;
  removeEventListener('keydown', onKey, true);
  prankStore.set({ ...EMPTY, pops: [] });
}

// ---------- virus.com ----------
const VMSG = [
  ['Error', 'Your computer is infected!!!'],
  ['Warning', 'koal99.exe has stopped working'],
  ['Congratulations!', 'You won a FREE PRIZE! Click OK to claim it'],
  ['System', 'Deleting C:\\KOAL99\\core.dll ... (just pretending)'],
  ['Alert', 'A wizard has been detected on your computer'],
  ['Virus Alert', 'virus.com is now running on your computer'],
  ['Error 404', 'Your fake files went on vacation'],
  ['Notice', 'Please do not turn off your fake computer'],
];
export function startVirus() {
  const s = prankStore.get();
  if (s.virus || s.idiot) return;
  prankStore.set({ virus: true });
  arm();
  let n = 0;
  const pop = () => {
    if (!prankStore.get().virus || n >= 18) return;
    const [title, msg] = VMSG[n++ % VMSG.length];
    addPop({ kind: 'virus', title, msg, x: rand(W() - 320), y: rand(H() - 170), vx: 0, vy: 0, w: 300, h: 140 });
  };
  onVirusOk = () => (pop(), pop());
  [0, 700, 1500].forEach((t) => later(pop, t));
  every(pop, 1200);
  later(() => {
    addPop({ kind: 'del', title: 'Deleting files...', x: W() / 2 - 190, y: H() / 2 - 75, vx: 0, vy: 0, w: 380, h: 150 });
    const names = ['core.dll', 'desktop.sys', 'clock.exe', 'wallpaper.bmp', 'taskbar.dll', 'fun.sys', 'starsweeper.exe', 'star.ico'];
    every(() => {
      const st = prankStore.get();
      if (st.delPct < 100) prankStore.set({ delPct: Math.min(100, st.delPct + 4), delName: names[Math.floor(Math.random() * names.length)] });
    }, 250);
  }, 8000);
  later(() => {
    stopPranks();
    bsod('VIRUS_DOT_COM_HAS_TAKEN_OVER', 'Just kidding! virus.com was an easter egg. Nothing was deleted or changed.');
  }, 28000);
}

// ---------- youareanidiot ----------
export function startIdiot() {
  const s = prankStore.get();
  if (s.virus || s.idiot) return;
  prankStore.set({ idiot: true });
  arm();
  playLoop('idiot.mp3');
  let n = 0;
  const pop = () => {
    if (!prankStore.get().idiot || n >= 60) return;
    n++;
    addPop({ kind: 'idiot', title: 'You are an idiot!', x: rand(W() - 240), y: rand(H() - 190), vx: spd(90, 260), vy: spd(90, 260), w: 240, h: 212 });
  };
  onIdiotX = () => (pop(), pop());
  [0, 250, 500, 750].forEach((t) => later(pop, t));
  every(pop, 500);
  later(() => {
    stopPranks();
    prankStore.set({ end: true });
    later(arm, 700);
  }, 45000);
}

// ---------- catbomb ----------
export const isCatBomb = () => prankStore.get().cats;
export function startCatBomb() {
  if (prankStore.get().cats) return;
  prankStore.set({ cats: true });
  arm();
  playLoop('catsong.mp3');
  const spawn = () => {
    if (!prankStore.get().cats) return;
    const pops = prankStore.get().pops.filter((p) => p.kind === 'cat');
    if (pops.length >= 40) removePop(pops[0].id);
    addPop({ kind: 'cat', title: 'Meow', x: rand(W() - 140), y: rand(H() - 140), vx: spd(60, 150), vy: spd(60, 150), w: 140, h: 140 });
  };
  every(spawn, 150);
  spawn();
}
export function stopCatBomb() {
  if (!prankStore.get().cats) return;
  stopPranks();
  notify('catbomb', 'Stopped. (Meow.)', { icon: 'info' });
}

/** Falling green "code" behind the virus popups. */
function VirusRain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    let drops: number[] = [];
    const fit = () => {
      cv.width = innerWidth;
      cv.height = innerHeight;
      drops = Array.from({ length: Math.ceil(innerWidth / 16) }, () => Math.random() * -40);
    };
    fit();
    addEventListener('resize', fit);
    const chars = '01VIRUS$#%&@<>';
    let r = 0;
    const rain = () => {
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = 'rgba(0,0,0,.09)';
      g.fillRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#39ff14';
      g.font = '14px Consolas, monospace';
      drops.forEach((y, i) => {
        g.fillText(chars[Math.floor(Math.random() * chars.length)], i * 16, y * 16);
        drops[i] = y * 16 > cv.height && Math.random() > 0.97 ? 0 : y + 1;
      });
      r = requestAnimationFrame(rain);
    };
    rain();
    return () => {
      cancelAnimationFrame(r);
      removeEventListener('resize', fit);
    };
  }, []);
  return <canvas ref={ref} className="prank-rain" />;
}

export function Pranks() {
  const s = prankStore.use((x) => x);
  if (!s.virus && !s.idiot && !s.cats && !s.end) return null;
  return (
    <div className="prank-layer">
      {s.virus && <VirusRain />}
      {s.virus && <div className="prank-tint" />}
      {(s.virus || s.idiot) && <div className="prank-bar">{s.virus ? '\u2620  VIRUS.COM HAS INFECTED YOUR COMPUTER  \u2620   (press Esc to reboot)' : '(press Esc to reboot)'}</div>}
      {s.pops.map((p) => (
        <div key={p.id} id={'prank-' + p.id} className={'prank-win ' + p.kind} style={{ left: p.x, top: p.y, width: p.w }}>
          {p.kind !== 'cat' && (
            <div className="prank-tb">
              <span>{p.title}</span>
              {p.kind === 'idiot' && <b onClick={() => (removePop(p.id), onIdiotX())}>{'\u00D7'}</b>}
            </div>
          )}
          {p.kind === 'virus' && (
            <div className="prank-body">
              <i className="prank-warn">!</i>
              <p>{p.msg}</p>
              <button className="k-btn" onClick={() => (removePop(p.id), onVirusOk())}>OK</button>
            </div>
          )}
          {p.kind === 'del' && (
            <div className="prank-body col">
              <span className="prank-file">C:\KOAL99\{s.delName || '...'}</span>
              <div className="k-progress"><div style={{ width: s.delPct + '%' }} /></div>
              <small>(This is fake. Nothing is really being deleted.)</small>
            </div>
          )}
          {p.kind === 'idiot' && <img src={asset('idiot.gif')} alt="you are an idiot" draggable={false} />}
          {p.kind === 'cat' && <img src={asset('cat.gif')} alt="" draggable={false} />}
        </div>
      ))}
      {s.end && (
        <div className="prank-end" onPointerDown={() => (stopPranks(), shutdown(true))}>
          <img src={asset('idiot.gif')} alt="" />
          <b>Just kidding, you are not an idiot!</b>
          <span>This was an easter egg. Nothing was deleted or changed.</span>
          <small>Press any key to reboot KOAL-99.</small>
        </div>
      )}
    </div>
  );
}
