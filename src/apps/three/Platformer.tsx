// 3D Platformer (koal://3d-platformer): 10 generated levels from Easy to SUPER HARD, with coins,
// moving lifts, vanishing tiles, checkpoints and best times (saved in 'koalos.plat').
import { useEffect, useRef, useState } from 'react';
import { createR3, hexRgb, V3 } from './r3';

const LEVELS = [
  { name: 'Meadow Steps', diff: 'Easy', ratio: 0.25, segs: 8, size: [4, 5.5], lat: 1, rise: [0, 0.3], mv: 0, lift: 0, van: 0, cp: 0, per: 9, travel: 3, sky: '#6fb7ff', fog: '#d5eeff', pal: ['#5cb85c', '#8bc34a', '#f0ad4e', '#66bb6a'], dec: ['#a5d6a7', '#c5e1a5', '#ffe082'] },
  { name: 'Sunny Hops', diff: 'Easy', ratio: 0.34, segs: 9, size: [3.5, 5], lat: 2, rise: [0, 0.6], mv: 0, lift: 0, van: 0, cp: 0, per: 9, travel: 3, sky: '#4fa3ff', fog: '#cfe9ff', pal: ['#42a5f5', '#ffca28', '#66bb6a', '#ef5350'], dec: ['#90caf9', '#ffe082', '#a5d6a7'] },
  { name: 'Cloud Bridge', diff: 'Normal', ratio: 0.44, segs: 10, size: [3, 4], lat: 2.5, rise: [-0.3, 0.8], mv: 0.16, lift: 0, van: 0, cp: 0, per: 8, travel: 4, sky: '#7d9cff', fog: '#e4ecff', pal: ['#ffffff', '#b3c7ff', '#ffd180', '#a5d6ff'], dec: ['#ffffff', '#dbe4ff', '#ffe9c7'] },
  { name: 'Sunset Ridge', diff: 'Normal', ratio: 0.52, segs: 11, size: [2.6, 3.6], lat: 3, rise: [-0.3, 1], mv: 0.16, lift: 0, van: 0, cp: 6, per: 7, travel: 5, sky: '#ff8f6b', fog: '#ffd9bd', pal: ['#ff7043', '#ffa726', '#ec407a', '#8d6e63'], dec: ['#ffccbc', '#f8bbd0', '#ffe0b2'] },
  { name: 'Crystal Caves', diff: 'Medium', ratio: 0.6, segs: 12, size: [2.2, 3.2], lat: 3, rise: [-0.5, 1.2], mv: 0.18, lift: 0, van: 0.16, vnOn: [3.4, 4.4], vnOff: [1.2, 1.6], cp: 5, per: 6.5, travel: 5.5, sky: '#7e57c2', fog: '#d7c8f7', pal: ['#ab47bc', '#5c6bc0', '#26c6da', '#ec407a'], dec: ['#b39ddb', '#9fa8da', '#80deea'] },
  { name: 'Neon Night', diff: 'Hard', ratio: 0.68, segs: 13, size: [1.8, 2.6], lat: 3.4, rise: [-0.5, 1.4], mv: 0.2, lift: 0, van: 0.2, vnOn: [3, 3.8], vnOff: [1.4, 1.8], cp: 5, per: 6, travel: 6, sky: '#161c55', fog: '#2c3390', pal: ['#00e5ff', '#ff4081', '#76ff03', '#ffea00'], dec: ['#283593', '#4a148c', '#006064'] },
  { name: 'Lava Run', diff: 'Hard', ratio: 0.74, segs: 14, size: [1.6, 2.2], lat: 3.6, rise: [-0.5, 1.5], mv: 0.2, lift: 0.1, van: 0.24, vnOn: [2.8, 3.4], vnOff: [1.5, 2], cp: 5, per: 5.5, travel: 6.5, sky: '#4a0f0a', fog: '#9c3a24', pal: ['#ffb300', '#ff7043', '#ffe082', '#bcaaa4'], dec: ['#6d1a10', '#8d2c1a', '#b34a22'] },
  { name: 'Frozen Spire', diff: 'Very Hard', ratio: 0.8, segs: 15, size: [1.3, 1.9], lat: 3.8, rise: [-0.6, 1.6], mv: 0.22, lift: 0.12, van: 0.26, vnOn: [2.5, 3.1], vnOff: [1.6, 2.1], cp: 4, per: 5, travel: 7, sky: '#8fd3ff', fog: '#eaf8ff', pal: ['#e1f5fe', '#80deea', '#b3e5fc', '#ffffff'], dec: ['#b3e5fc', '#e0f7fa', '#cfd8dc'] },
  { name: 'Void Circuit', diff: 'Extreme', ratio: 0.74, segs: 16, size: [1.3, 1.7], lat: 3.6, rise: [-0.6, 1.6], mv: 0.22, lift: 0.12, van: 0.26, vnOn: [2.6, 3.2], vnOff: [1.4, 1.8], cp: 4, per: 5.2, travel: 7, sky: '#05060f', fog: '#0a0f2e', pal: ['#00ff9c', '#00b8ff', '#c6ff00', '#ff2bd6'], dec: ['#0d1b4c', '#12124a', '#1b3a4b'] },
  { name: 'The Gauntlet', diff: 'SUPER HARD', ratio: 0.78, segs: 18, size: [1.1, 1.4], lat: 3.8, rise: [-0.7, 1.7], mv: 0.25, lift: 0.14, van: 0.28, vnOn: [2.4, 3], vnOff: [1.5, 1.9], cp: 4, per: 4.6, travel: 7.5, sky: '#1a0000', fog: '#420b0b', pal: ['#ff1744', '#ffffff', '#ff9100', '#f50057'], dec: ['#3b0a0a', '#5a1212', '#2b0000'] },
];
type Lvl = (typeof LEVELS)[number];
interface Plat {
  x: number;
  z: number;
  w: number;
  d: number;
  top: number;
  c: string;
  lift?: boolean;
  mover?: boolean;
  cp?: boolean;
  mv?: { axis: string; c: number; a: number; per: number; ph: number; w?: number };
  vn?: { on: number; off: number; ph: number };
}
const DIFFC: Record<string, string> = { Easy: '#2e9e3e', Normal: '#3b78d8', Medium: '#d9a400', Hard: '#e07a1f', 'Very Hard': '#d63a2b', Extreme: '#a8129c', 'SUPER HARD': '#111' };
const SAVE = 'koalos.plat';

function genLevel(n: number) {
  const L = LEVELS[n - 1] as Lvl & { vnOn?: number[]; vnOff?: number[] };
  let seed = n * 7919 + 13;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (a: number, b: number) => a + (b - a) * rnd(), ri = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const T = (d: number) => (11 + Math.sqrt(Math.max(0, 121 - 56 * d))) / 28, spd = n >= 7 ? 8.5 : 6, reach = (d: number) => spd * T(d);
  const cl = (v: number, m: number) => Math.max(-m, Math.min(m, v)), col = () => ri(L.pal);
  const plats: Plat[] = [{ x: 0, z: 0, w: 6, d: 6, top: 0, c: L.pal[0] }];
  let cur = plats[0];
  const rectGap = (a: Plat, b: Plat) => Math.hypot(Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2), Math.max(0, Math.abs(a.z - b.z) - (a.d + b.d) / 2));
  const nextTop = (t: number, d: number) => Math.min(t + d < 0 ? t + Math.abs(d) : t + d, 26);
  let segs = 0, guard = 0;
  while (segs < L.segs && guard++ < 500) {
    segs++;
    const last = segs === L.segs, r = rnd();
    if (!last && L.lift && segs > 2 && r < L.lift) {
      const H = pick(3.2, 4.4), sl = 2.6, lz = cur.z + cur.d / 2 + 1 + sl / 2, sB = pick(L.size[0], L.size[1]) + 0.5;
      const lift: Plat = { x: cur.x, z: lz, w: sl, d: sl, top: cur.top, c: '#26c6da', lift: true, mv: { axis: 'y', c: cur.top + H / 2, a: H / 2, per: pick(6, 8), ph: -Math.PI / 2 } };
      const B: Plat = { x: cl(cur.x + pick(-1, 1), 16), z: lz + sl / 2 + 1 + sB / 2, w: sB, d: sB, top: cur.top + H, c: col() };
      plats.push(lift, B);
      cur = B;
      continue;
    }
    if (!last && L.mv && segs > 1 && r < (L.lift || 0) + L.mv) {
      const sm = Math.max(2.2, Math.min(3, L.size[1] + 0.5)), sB = pick(L.size[0], L.size[1]), d2 = pick(0, Math.min(0.8, L.rise[1])), topB = nextTop(cur.top, d2);
      const gA = Math.max(1, L.ratio * reach(0) * 0.6), gB = Math.max(1, L.ratio * reach(d2) * 0.6), tr = L.travel;
      const zmin = cur.z + cur.d / 2 + gA + sm / 2, zmax = zmin + tr, mx = cl(cur.x + pick(-1, 1), 16);
      const mover: Plat = { x: mx, z: (zmin + zmax) / 2, w: sm, d: sm, top: cur.top, c: '#ff9800', mover: true, mv: { axis: 'z', c: (zmin + zmax) / 2, a: tr / 2, per: L.per * pick(0.9, 1.1), ph: pick(0, 6.28) } };
      const B: Plat = { x: cl(mx + pick(-1, 1), 16), z: zmax + sm / 2 + gB + sB / 2, w: sB, d: sB, top: topB, c: col() };
      plats.push(mover, B);
      cur = B;
      continue;
    }
    const s = last ? 5 : pick(L.size[0], L.size[1]);
    let placed: Plat | null = null;
    for (let tries = 0; tries < 120 && !placed; tries++) {
      const d = last ? pick(0, 0.4) : pick(L.rise[0], L.rise[1]), top = nextTop(cur.top, d), allowed = L.ratio * reach(top - cur.top);
      const cand: Plat = { x: cl(cur.x + pick(-L.lat, L.lat), 16), z: cur.z + cur.d / 2 + pick(0.5, 1) * allowed + s / 2, w: s, d: s, top, c: col() };
      if (rectGap(cur, cand) <= allowed) placed = cand;
    }
    if (!placed) placed = { x: cur.x, z: cur.z + cur.d / 2 + 0.5 * L.ratio * reach(0) + s / 2, w: s, d: s, top: cur.top, c: col() };
    if (!last) {
      if (L.van && rnd() < L.van) placed.vn = { on: pick(L.vnOn![0], L.vnOn![1]), off: pick(L.vnOff![0], L.vnOff![1]), ph: pick(0, 4) };
      else if (L.cp && plats.length % L.cp === 0) placed.cp = true;
    } else placed.cp = true;
    plats.push(placed);
    cur = placed;
  }
  const coins: V3[] = [];
  plats.forEach((b, i) => i > 0 && i % 2 === 0 && !b.mover && !b.lift && coins.length < 12 && coins.push([b.x, b.top + 1, b.z]));
  const end = plats[plats.length - 1];
  const dec: { c: V3; s: V3; col: string }[] = [];
  for (let i = 0; i < 46; i++) {
    const w = 3 + rnd() * 9, d = 3 + rnd() * 9, h = 2 + rnd() * 6, x = -55 + rnd() * 110, z = -30 + rnd() * (end.z + 60), top = -9 - rnd() * 24;
    dec.push({ c: [x, top - h / 2, z], s: [w, h, d], col: ri(L.dec) });
  }
  return { L, plats, coins, goal: { x: end.x, y: end.top + 1.6, z: end.z }, start: { x: 0, y: 0, z: -1.2 }, dec };
}

// glossy plastic: checker on top faces, darker edges, a bright specular highlight, fog
const FS = `void main(){vec3 n=normalize(vN);vec3 col=uCol*mix(1.,shade(n),uLit);
if(uGrid>.5&&n.y>.5){float t=mod(floor(vW.x*.5)+floor(vW.z*.5),2.);col*=.94+.06*t;}
col*=1.-.28*(1.-smoothstep(0.,.07,edges(n)))*step(.5,uGrid);
vec3 V=normalize(uEye-vW);vec3 H=normalize(V+normalize(vec3(.35,.9,.25)));col+=uLit*vec3(.32)*pow(max(dot(n,H),0.),28.);
float d=length(vW-uEye);col=mix(col,uFog,clamp((d-30.)/70.,0.,1.));gl_FragColor=vec4(col,uAlpha);}`;

interface SaveData {
  best: Record<number, number>;
  coins: Record<number, number>;
}
const loadSave = (): SaveData => {
  try {
    return JSON.parse(localStorage.getItem(SAVE) || '') || { best: {}, coins: {} };
  } catch {
    return { best: {}, coins: {} };
  }
};

export function Platformer() {
  const root = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const hudS = useRef<HTMLSpanElement>(null);
  const hudT = useRef<HTMLSpanElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const [save, setSave] = useState(loadSave);
  const [menu, setMenu] = useState(true);
  const [intro, setIntro] = useState<{ n: number; L: Lvl } | null>(null);
  const [won, setWon] = useState<null | { n: number; t: number; newBest: boolean; got: number; of: number; falls: number }>(null);
  const [lvlInfo, setLvlInfo] = useState('');
  const [err, setErr] = useState('');
  const api = useRef<{ open(n: number): void; retry(): void; menu(): void } | null>(null);

  useEffect(() => {
    const c = cv.current!, rootEl = root.current!;
    const r = createR3(c, FS, ['vec3 uFog'], { alpha: true, premultipliedAlpha: false });
    if (!r) return void setErr('This game needs WebGL, which your browser has turned off.');
    const HS = 0.4, PH = 1.2, EYE = 1.05;
    type B = Plat & { y: number; h: number; col: V3; dx: number; dz: number; dy: number; vis: boolean; px: number; pz: number; ptop: number };
    let lvl = 1, Lv = genLevel(1), Bs: B[] = [], DEC: { c: V3; s: V3; col: V3 }[] = [], coins: { x: number; y: number; z: number; got: boolean }[] = [], fogC: V3 = [0.8, 0.9, 1];
    let p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ground: false, ride: null as B | null }, pp = { x: 0, y: 0, z: 0 };
    let yaw = 0, pitch = -0.12, tt = 0, isWon = false, clock = 0, keys: Record<string, boolean> = {}, coyote = 0, buf = 0, paused = true, respawn = { x: 0, y: 0, z: 0 }, falls = 0, flashT = 0, dragging = false;
    const doFlash = (t: string) => {
      if (flash.current) (flash.current.textContent = t), (flash.current.style.opacity = '1');
      flashT = 1.6;
    };
    const updatePlats = () => {
      for (const b of Bs) {
        b.px = b.x;
        b.pz = b.z;
        b.ptop = b.top;
        b.dx = b.dz = b.dy = 0;
        if (b.mv) {
          const o = b.mv, v = o.c + o.a * Math.sin(o.w! * tt + o.ph);
          if (o.axis === 'x') (b.dx = v - b.x), (b.x = v);
          else if (o.axis === 'z') (b.dz = v - b.z), (b.z = v);
          else (b.dy = v - b.top), (b.top = v), (b.y = v - 1);
        }
        b.vis = !b.vn || (tt + b.vn.ph) % (b.vn.on + b.vn.off) < b.vn.on;
      }
    };
    const reset = () => {
      const s = Lv.start;
      p = { x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, ground: false, ride: null };
      pp = { x: p.x, y: p.y, z: p.z };
      respawn = { ...s };
      coins = Lv.coins.map(([x, y, z]) => ({ x, y, z, got: false }));
      yaw = 0;
      pitch = -0.12;
      tt = 0;
      isWon = false;
      clock = 0;
      coyote = 0;
      buf = 0;
      falls = 0;
      setWon(null);
      if (flash.current) flash.current.style.opacity = '0';
      updatePlats();
    };
    const loadLevel = (n: number) => {
      lvl = n;
      Lv = genLevel(n);
      Bs = Lv.plats.map((o) => ({ ...o, y: o.top - 1, h: 1, col: hexRgb(o.c), dx: 0, dz: 0, dy: 0, vis: true, px: o.x, pz: o.z, ptop: o.top, mv: o.mv && { ...o.mv, w: (2 * Math.PI) / o.mv.per } }));
      DEC = Lv.dec.map((d) => ({ c: d.c, s: d.s, col: hexRgb(d.col) }));
      fogC = hexRgb(Lv.L.fog);
      rootEl.style.background = `linear-gradient(${Lv.L.sky}, ${Lv.L.fog})`;
      setLvlInfo(`Level ${n} · ${Lv.L.name} · ${Lv.L.diff}`);
      reset();
    };
    const overlapXZ = (b: B) => Math.abs(p.x - b.x) < b.w / 2 + HS && Math.abs(p.z - b.z) < b.d / 2 + HS;
    const win = () => {
      isWon = true;
      const got = coins.filter((c) => c.got).length, t = clock, sv = loadSave();
      const prevBest = sv.best[lvl], newBest = prevBest == null || t < prevBest;
      if (newBest) sv.best[lvl] = +t.toFixed(1);
      sv.coins[lvl] = Math.max(sv.coins[lvl] || 0, got);
      try {
        localStorage.setItem(SAVE, JSON.stringify(sv));
      } catch {
        /* ignore */
      }
      setSave(sv);
      try {
        document.exitPointerLock();
      } catch {
        /* ignore */
      }
      setWon({ n: lvl, t, newBest, got, of: coins.length, falls });
    };
    const step = (dt: number) => {
      pp = { x: p.x, y: p.y, z: p.z };
      tt += dt;
      updatePlats();
      if (!isWon) clock += dt;
      if (keys.ArrowLeft) yaw -= 1.9 * dt;
      if (keys.ArrowRight) yaw += 1.9 * dt;
      if (keys.ArrowUp) pitch = Math.min(1.45, pitch + 1.4 * dt);
      if (keys.ArrowDown) pitch = Math.max(-1.45, pitch - 1.4 * dt);
      const ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), iz = (keys.up ? 1 : 0) - (keys.down ? 1 : 0), cy = Math.cos(yaw), sy = Math.sin(yaw);
      let dx = ix * cy + iz * sy, dz = -ix * sy + iz * cy;
      const len = Math.hypot(dx, dz);
      if (len > 1) (dx /= len), (dz /= len);
      const spd = keys.shift ? 8.5 : 6, k = Math.min(1, dt * (p.ground ? 14 : 5));
      if (!isWon) (p.vx += (dx * spd - p.vx) * k), (p.vz += (dz * spd - p.vz) * k);
      else (p.vx *= 0.9), (p.vz *= 0.9);
      buf -= dt;
      coyote = p.ground ? 0.1 : coyote - dt;
      if ((buf > 0 || keys.space) && coyote > 0 && !isWon) {
        p.vy = 11;
        p.ground = false;
        coyote = 0;
        buf = 0;
      }
      p.vy -= 28 * dt;
      if (p.ride?.mv) (p.x += p.ride.dx), (p.z += p.ride.dz), (p.y += p.ride.dy);
      const prevY = p.y;
      p.x += p.vx * dt;
      for (const b of Bs) if (b.vis && overlapXZ(b) && p.y < b.top - 0.15 && p.y + PH > b.y) (p.x = p.vx > 0 || p.x < b.x ? b.x - b.w / 2 - HS - 0.001 : b.x + b.w / 2 + HS + 0.001), (p.vx = 0);
      p.z += p.vz * dt;
      for (const b of Bs) if (b.vis && overlapXZ(b) && p.y < b.top - 0.15 && p.y + PH > b.y) (p.z = p.vz > 0 || p.z < b.z ? b.z - b.d / 2 - HS - 0.001 : b.z + b.d / 2 + HS + 0.001), (p.vz = 0);
      p.y += p.vy * dt;
      p.ground = false;
      p.ride = null;
      for (const b of Bs) {
        if (!b.vis || !overlapXZ(b) || !(p.y < b.top && p.y + PH > b.y)) continue;
        if (p.vy <= 0 && prevY >= b.top - 0.05) {
          p.y = b.top;
          p.vy = 0;
          p.ground = true;
          p.ride = b;
          if (b.cp && (respawn.x !== b.x || respawn.z !== b.z)) {
            respawn = { x: b.x, y: b.top, z: b.z };
            doFlash('Checkpoint!');
          }
        } else if (p.vy > 0 && prevY + PH <= b.y + 0.05) (p.y = b.y - PH), (p.vy = 0);
      }
      if (p.y < -16) {
        Object.assign(p, respawn, { vx: 0, vy: 0, vz: 0 });
        pp = { x: p.x, y: p.y, z: p.z };
        falls++;
        doFlash('Fell! Try again');
      }
      for (const c of coins) if (!c.got && Math.hypot(c.x - p.x, c.y - (p.y + 0.6), c.z - p.z) < 1.1) c.got = true;
      const g = Lv.goal;
      if (!isWon && Math.hypot(g.x - p.x, g.y - (p.y + 0.6), g.z - p.z) < 1.6) win();
      if (flashT > 0) {
        flashT -= dt;
        if (flashT < 0.5 && flash.current) flash.current.style.opacity = String(Math.max(0, flashT / 0.5));
      }
    };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const render = (al: number) => {
      r.u3('uFog', fogC);
      r.frame([lerp(pp.x, p.x, al), lerp(pp.y, p.y, al) + EYE, lerp(pp.z, p.z, al)], yaw, pitch, 75, 0.1, 260, [0, 0, 0, 0]);
      for (const d of DEC) r.box(d.c, d.s, d.col);
      const ghosts: [V3, B][] = [];
      for (const b of Bs) {
        const c: V3 = [lerp(b.px, b.x, al), lerp(b.ptop, b.top, al) - 0.5, lerp(b.pz, b.z, al)];
        if (!b.vis) {
          ghosts.push([c, b]);
          continue;
        }
        let col = b.col;
        if (b.vn) {
          const remain = b.vn.on - ((tt + b.vn.ph) % (b.vn.on + b.vn.off));
          if (remain < 0.9 && Math.floor(tt * 9) % 2) col = [1, 1, 1];
        }
        r.box(c, [b.w, b.h, b.d], col, { grid: 1 });
        if (b.cp) {
          r.box([b.x, b.top + 0.9, b.z], [0.12, 1.8, 0.12], [0.9, 0.9, 0.9], { lit: 0.6 });
          r.box([b.x + 0.35, b.top + 1.5, b.z], [0.7, 0.4, 0.06], [0.15, 0.9, 0.35], { lit: 0.6 });
        }
      }
      for (const c of coins) if (!c.got) r.sph([c.x, c.y + Math.sin(tt * 3 + c.x) * 0.15, c.z], [0.62, 0.62, 0.16], [1, 0.8, 0.12], { rot: tt * 2.6 });
      const g = Lv.goal, gy = g.y + Math.sin(tt * 2) * 0.2;
      for (let i = 0; i < 5; i++) r.box([g.x, gy, g.z], [0.34, 1.5, 0.2], [1, 0.86, 0.22], { rot: tt * 1.6, tilt: (i * Math.PI * 2) / 5, lit: 0.5 });
      r.sph([g.x, gy, g.z], [0.7, 0.7, 0.3], [1, 0.95, 0.5], { rot: tt * 1.6, lit: 0.3 });
      r.blend(true);
      for (const [c, b] of ghosts) r.box(c, [b.w, b.h, b.d], b.col, { alpha: 0.13, lit: 0 });
      let sup: B | null = null;
      for (const b of Bs) if (b.vis && overlapXZ(b) && b.top <= p.y + 0.3 && (!sup || b.top > sup.top)) sup = b;
      if (sup) r.box([lerp(pp.x, p.x, al), sup.top + 0.012, lerp(pp.z, p.z, al)], [0.9, 0.02, 0.9], [0, 0, 0], { alpha: 0.32, lit: 0 });
      r.box([g.x, g.y + 20, g.z], [0.6, 40, 0.6], [1, 0.9, 0.3], { alpha: 0.22, lit: 0 });
      r.sph([g.x, gy, g.z], [2.4, 2.4, 2.4], [1, 0.9, 0.4], { alpha: 0.12, lit: 0 });
      if (hudS.current) hudS.current.textContent = `Coins ${coins.filter((c) => c.got).length} / ${coins.length}` + (falls ? `  ·  Falls ${falls}` : '');
      if (hudT.current) hudT.current.textContent = clock.toFixed(1) + 's';
    };

    const showIntro = () => setIntro({ n: lvl, L: Lv.L });
    const openLevel = (n: number) => {
      loadLevel(n);
      setMenu(false);
      paused = false;
      showIntro();
    };
    const openMenu = () => {
      try {
        document.exitPointerLock();
      } catch {
        /* ignore */
      }
      paused = true;
      setMenu(true);
      setIntro(null);
    };
    api.current = { open: openLevel, retry: () => (reset(), showIntro()), menu: openMenu };

    const KM: Record<string, string> = { w: 'up', s: 'down', a: 'left', d: 'right', ' ': 'space', Shift: 'shift', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' };
    const active = () => !!rootEl.offsetParent && !rootEl.closest('.win')?.classList.contains('inactive');
    const kd = (e: KeyboardEvent) => {
      if (!active() || /^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement).tagName)) return;
      const down = e.type === 'keydown', name = e.key.length === 1 ? e.key.toLowerCase() : e.key, k = KM[name];
      if (down && name === 'm') return openMenu();
      if (paused) return;
      if (down && name === 'r') return reset(), showIntro();
      if (down && name === 'n' && isWon && lvl < 10) return openLevel(lvl + 1);
      if (!k) return;
      if (down && k === 'space' && !keys.space) buf = 0.12;
      keys[k] = down;
      setIntro(null);
      e.preventDefault();
    };
    const locked = () => document.pointerLockElement === c;
    const mm = (e: MouseEvent) => {
      if (!active() || paused || !(locked() || dragging)) return;
      yaw += (e.movementX || 0) * 0.0022;
      pitch = Math.max(-1.45, Math.min(1.45, pitch - (e.movementY || 0) * 0.0022));
    };
    const pu = () => (dragging = false);
    const pd = () => {
      dragging = true;
      setIntro(null);
    };
    const click = () => {
      if (!locked() && !paused && !isWon)
        try {
          (c.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(() => {});
        } catch {
          /* drag to look instead */
        }
    };
    addEventListener('keydown', kd);
    addEventListener('keyup', kd);
    document.addEventListener('mousemove', mm);
    document.addEventListener('pointerup', pu);
    c.addEventListener('pointerdown', pd);
    c.addEventListener('click', click);

    loadLevel(1);
    let alive = true, prev = performance.now(), acc = 0;
    const loop = (now: number) => {
      if (!alive) return;
      if (rootEl.offsetParent) {
        r.fit(2);
        acc += Math.min(0.1, (now - prev) / 1000);
        if (!paused) while (acc >= 1 / 60) step(1 / 60), (acc -= 1 / 60);
        else acc = 0;
        render(paused ? 1 : acc * 60);
      } else keys = {};
      prev = now;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    (rootEl as any)._dbg = () => ({ p, Bs, coins, isWon, keys, lvl, openLevel, paused });
    return () => {
      alive = false;
      removeEventListener('keydown', kd);
      removeEventListener('keyup', kd);
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('pointerup', pu);
      try {
        if (locked()) document.exitPointerLock();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return (
    <div className="r3 kplat" ref={root}>
      <div className="r3-game">
        <canvas ref={cv} />
        <div className="r3-cross" />
        <div className="kplat-hud">
          <span ref={hudS} />
          <span>{lvlInfo}</span>
          <span ref={hudT} />
        </div>
        <div className="kplat-flash" ref={flash} />
        {err && <div className="r3-big">{err}</div>}
        {intro && !menu && !won && (
          <div className="kplat-intro">
            Level {intro.n}: {intro.L.name}
            <small>
              {intro.L.diff}
              {intro.n >= 7 ? ' · Hold Shift to sprint' : ''}
              <br />
              Click to play {'·'} WASD move {'·'} Space jump {'·'} Mouse look {'·'} M levels {'·'} R restart
            </small>
          </div>
        )}
        {won && (
          <div className="kplat-msg">
            <b>Level {won.n} complete!</b>
            <div>
              Time {won.t.toFixed(1)}s {won.newBest && <span className="kplat-new">NEW BEST</span>} {'·'} Coins {won.got}/{won.of} {'·'} Falls {won.falls}
            </div>
            <div className="kplat-btns">
              {won.n < 10 && <button className="k-btn default" onClick={() => api.current?.open(won.n + 1)}>Next level (N)</button>}
              <button className="k-btn" onClick={() => api.current?.retry()}>Retry (R)</button>
              <button className="k-btn" onClick={() => api.current?.menu()}>Levels (M)</button>
            </div>
            {won.n === 10 && <small>You beat the whole game. Legend.</small>}
          </div>
        )}
        {menu && !err && (
          <div className="kplat-menu">
            <h2>3D Platformer</h2>
            <div className="kplat-grid">
              {LEVELS.map((L, i) => (
                <button key={L.name} className="kplat-lv" onClick={() => api.current?.open(i + 1)}>
                  <span className="kplat-n">{i + 1}</span>
                  <b>{L.name}</b>
                  <em style={{ background: DIFFC[L.diff] }}>{L.diff}</em>
                  <small>{save.best[i + 1] != null ? `★ ${save.best[i + 1]}s · ${save.coins[i + 1] || 0} coins` : 'not played'}</small>
                </button>
              ))}
            </div>
            <small>Pick any level. Levels get harder as you go. Hold <b>Shift</b> to sprint (you will need it later). Press <b>M</b> in a level to come back here.</small>
          </div>
        )}
      </div>
    </div>
  );
}
