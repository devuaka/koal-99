// Game sound effects, synthesized live with WebAudio (no files). The aim is natural sounds rather than
// chiptune: plucked strings, marimba and bells for music, filtered noise for impacts, footsteps, guns
// and explosions, all through a soft room reverb. Follows the system volume and mute (Control Panel).
import { S } from './settings';

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let verb: ConvolverNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function setup(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      bus = ctx.createGain();
      bus.connect(comp);
      // a small synthetic room for everything to sit in
      verb = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      verb.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      verb.connect(wet).connect(comp);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    bus!.gain.value = Math.max(0, Math.min(1, S().volume)) * 0.9;
    return ctx;
  } catch {
    return null;
  }
}

export interface SfxOpts {
  /** 0..1 loudness for this sound (e.g. by distance). */
  vol?: number;
  /** -1 left .. 1 right. */
  pan?: number;
  /** Multiplies the pitch. */
  pitch?: number;
  /** 0..1 how much room reverb. */
  wet?: number;
}

const last: Record<string, number> = {};
/** Starts a sound: returns the context, an output node and the start time, or null when muted or throttled. */
function begin(name: string, o: SfxOpts = {}, minGapMs = 0) {
  if (S().muted || (o.vol ?? 1) <= 0.01) return null;
  const now = performance.now();
  if (minGapMs && now - (last[name] ?? 0) < minGapMs) return null;
  last[name] = now;
  const c = setup();
  if (!c) return null;
  const g = c.createGain();
  g.gain.value = o.vol ?? 1;
  let out: AudioNode = g;
  if (o.pan) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    g.connect(p);
    out = p;
  }
  out.connect(bus!);
  const send = c.createGain();
  send.gain.value = o.wet ?? 0.5;
  out.connect(send).connect(verb!);
  return { c, out: g, t: c.currentTime + 0.005, p: o.pitch ?? 1 };
}

// ---------- building blocks ----------
type B = NonNullable<ReturnType<typeof begin>>;
function env(b: B, peak: number, a: number, d: number, at = b.t) {
  const g = b.c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + a);
  g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
  g.connect(b.out);
  return g;
}
function osc(b: B, type: OscillatorType, f: number, to: number | null, dur: number, peak: number, a = 0.004, at = b.t) {
  const o = b.c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(10, to), at + dur);
  o.connect(env(b, peak, a, dur, at));
  o.start(at);
  o.stop(at + a + dur + 0.05);
  return o;
}
function nz(b: B, dur: number, peak: number, filter: BiquadFilterType, f: number, to: number | null = null, q = 1, a = 0.003, at = b.t) {
  const s = b.c.createBufferSource();
  s.buffer = noiseBuf;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = b.c.createBiquadFilter();
  fl.type = filter;
  fl.frequency.setValueAtTime(f, at);
  if (to) fl.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + a + dur);
  fl.Q.value = q;
  s.connect(fl).connect(env(b, peak, a, dur, at));
  const off = Math.random() * 1.5;
  s.start(at, off, a + dur + 0.05);
}
/** Karplus-Strong plucked string. */
function pluckAt(b: B, f: number, dur: number, peak: number, at = b.t, bright = 0.5) {
  const sr = b.c.sampleRate, n = Math.floor(sr * dur), buf = b.c.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const N = Math.max(2, Math.round(sr / f)), line = new Float32Array(N);
  for (let i = 0; i < N; i++) line[i] = Math.random() * 2 - 1;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const k = i % N, v = line[k];
    d[i] = v;
    const nv = (v * (0.5 + bright * 0.5) + prev * (0.5 - bright * 0.5)) * 0.996;
    prev = v;
    line[k] = (nv + line[(k + 1) % N]) * 0.5;
  }
  const s = b.c.createBufferSource();
  s.buffer = buf;
  const g = b.c.createGain();
  g.gain.value = peak;
  s.connect(g).connect(b.out);
  s.start(at);
}
function marimbaAt(b: B, f: number, peak: number, at = b.t, len = 0.6) {
  osc(b, 'sine', f, null, len, peak, 0.002, at);
  osc(b, 'sine', f * 3.93, null, len * 0.18, peak * 0.35, 0.001, at);
  osc(b, 'sine', f * 9.2, null, 0.05, peak * 0.12, 0.001, at);
}
function bellAt(b: B, f: number, peak: number, at = b.t, len = 1.2) {
  const car = b.c.createOscillator(), mod = b.c.createOscillator(), mg = b.c.createGain();
  car.frequency.value = f;
  mod.frequency.value = f * 3.5;
  mg.gain.setValueAtTime(f * 2.2, at);
  mg.gain.exponentialRampToValueAtTime(f * 0.05, at + len);
  mod.connect(mg).connect(car.frequency);
  car.connect(env(b, peak, 0.002, len, at));
  car.start(at);
  mod.start(at);
  car.stop(at + len + 0.1);
  mod.stop(at + len + 0.1);
}
const NOTE = (semi: number) => 261.63 * Math.pow(2, semi / 12);
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

// ---------- the sounds ----------
export const sfx = {
  /** Soft UI click / menu tick. */
  click(o?: SfxOpts) {
    const b = begin('click', o, 30);
    if (b) nz(b, 0.025, 0.25, 'bandpass', 3200 * b.p, null, 2);
  },
  /** Wooden knock (chess piece, paddle hit, tile tap). */
  knock(o?: SfxOpts) {
    const b = begin('knock', o, 25);
    if (!b) return;
    osc(b, 'sine', 520 * b.p, 300 * b.p, 0.09, 0.5);
    nz(b, 0.03, 0.25, 'bandpass', 1800 * b.p, null, 3);
  },
  /** Bubbly pop (eat, collect, flap). */
  pop(o?: SfxOpts) {
    const b = begin('pop', o, 20);
    if (b) osc(b, 'sine', 380 * b.p, 1100 * b.p, 0.08, 0.45, 0.002);
  },
  /** Plucked string note, step 0.. on a pentatonic scale. */
  pluck(step = 0, o?: SfxOpts) {
    const b = begin('pluck' + step, o, 15);
    if (b) pluckAt(b, NOTE(SCALE[Math.max(0, step) % SCALE.length] + 12 * Math.floor(Math.max(0, step) / SCALE.length)) * b.p, 1.2, 0.5);
  },
  /** Marimba note, step 0.. on a pentatonic scale. */
  marimba(step = 0, o?: SfxOpts) {
    const b = begin('mar' + step, o, 15);
    if (b) marimbaAt(b, NOTE(SCALE[Math.max(0, step) % SCALE.length] + 12 * Math.floor(Math.max(0, step) / SCALE.length)) * b.p, 0.42);
  },
  /** Bright two-note bell (coin, point, match). */
  coin(o?: SfxOpts) {
    const b = begin('coin', o, 40);
    if (!b) return;
    bellAt(b, 1318 * b.p, 0.22, b.t, 0.5);
    bellAt(b, 1976 * b.p, 0.2, b.t + 0.07, 0.7);
  },
  /** Rising marimba arpeggio for a win. */
  win(o?: SfxOpts) {
    const b = begin('win', o, 300);
    if (!b) return;
    [0, 4, 7, 12, 16].forEach((s, i) => marimbaAt(b, NOTE(s) * b.p, 0.38, b.t + i * 0.09, 0.9));
    bellAt(b, NOTE(24) * b.p, 0.12, b.t + 0.45, 1.6);
  },
  /** Soft falling plucks for game over. */
  lose(o?: SfxOpts) {
    const b = begin('lose', o, 300);
    if (!b) return;
    [7, 4, 0, -5].forEach((s, i) => pluckAt(b, NOTE(s) * 0.5 * b.p, 1.4, 0.45, b.t + i * 0.18, 0.2));
  },
  /** Low thud (landing, wall bump, cube hit). */
  thud(o?: SfxOpts) {
    const b = begin('thud', o, 30);
    if (!b) return;
    osc(b, 'sine', 120 * b.p, 45, 0.18, 0.7, 0.002);
    nz(b, 0.06, 0.3, 'lowpass', 600, null, 0.7);
  },
  /** Air whoosh (swipe, jump, swing). up = rising. */
  whoosh(up = true, o?: SfxOpts) {
    const b = begin('whoosh', o, 40);
    if (b) nz(b, 0.22, 0.35, 'bandpass', (up ? 500 : 2400) * b.p, (up ? 2400 : 500) * b.p, 1.6, 0.04);
  },
  /** Crunchy break (brick, rock, block). */
  crunch(o?: SfxOpts) {
    const b = begin('crunch', o, 25);
    if (!b) return;
    for (let i = 0; i < 4; i++) nz(b, 0.05 + Math.random() * 0.05, 0.35, 'bandpass', (700 + Math.random() * 1600) * b.p, null, 2.5, 0.002, b.t + i * 0.025);
    osc(b, 'sine', 160 * b.p, 70, 0.12, 0.35);
  },
  /** Glassy shatter. */
  glass(o?: SfxOpts) {
    const b = begin('glass', o, 40);
    if (!b) return;
    for (let i = 0; i < 6; i++) bellAt(b, (2400 + Math.random() * 2600) * b.p, 0.06, b.t + i * 0.018, 0.25);
    nz(b, 0.2, 0.25, 'highpass', 4000);
  },
  /** Water splash. */
  splash(o?: SfxOpts) {
    const b = begin('splash', o, 120);
    if (!b) return;
    nz(b, 0.35, 0.45, 'lowpass', 2600, 500, 0.8, 0.01);
    for (let i = 0; i < 5; i++) osc(b, 'sine', 600 + Math.random() * 900, 1400 + Math.random() * 600, 0.04, 0.1, 0.002, b.t + 0.05 + Math.random() * 0.2);
  },
  /** Footstep. surface: carpet, concrete, grass, wood, stone. */
  step(surface: 'carpet' | 'concrete' | 'grass' | 'wood' | 'stone' = 'concrete', o?: SfxOpts) {
    const b = begin('step', o, 90);
    if (!b) return;
    const v = 0.9 + Math.random() * 0.2;
    if (surface === 'carpet') nz(b, 0.07, 0.22, 'lowpass', 700 * v, null, 0.7, 0.01);
    else if (surface === 'grass') nz(b, 0.1, 0.22, 'bandpass', 2400 * v, 1200, 0.8, 0.012);
    else if (surface === 'wood') (osc(b, 'sine', 180 * v, 110, 0.07, 0.3), nz(b, 0.04, 0.2, 'bandpass', 1400 * v, null, 2));
    else nz(b, 0.05, 0.3, 'bandpass', (surface === 'stone' ? 1700 : 2300) * v, null, 1.4, 0.002), osc(b, 'sine', 140 * v, 80, 0.05, 0.2);
  },
  /** Body hit (you or someone got hit). */
  hurt(o?: SfxOpts) {
    const b = begin('hurt', o, 60);
    if (!b) return;
    osc(b, 'sine', 180, 60, 0.15, 0.6, 0.002);
    nz(b, 0.08, 0.35, 'lowpass', 1200, 300, 0.7);
  },
  /** Crisp hit-marker tick. */
  hitmark(o?: SfxOpts) {
    const b = begin('hitmark', o, 40);
    if (b) (nz(b, 0.03, 0.3, 'bandpass', 5200, null, 4), osc(b, 'sine', 2600, null, 0.04, 0.12));
  },
  /** Gunshot by weapon type. */
  gun(kind: 'pistol' | 'heavy' | 'smg' | 'rifle' | 'shotgun' | 'sniper' | 'laser' | 'launcher' | 'crossbow' | 'flame' | 'melee', o?: SfxOpts) {
    const b = begin('gun' + kind, o, kind === 'flame' ? 70 : 20);
    if (!b) return;
    const p = b.p;
    switch (kind) {
      case 'laser':
        osc(b, 'sawtooth', 1800 * p, 160 * p, 0.35, 0.25, 0.003);
        osc(b, 'sine', 900 * p, 80 * p, 0.4, 0.3, 0.003);
        nz(b, 0.3, 0.15, 'bandpass', 3000, 400, 2, 0.003);
        break;
      case 'crossbow':
        pluckAt(b, 110 * p, 0.4, 0.5, b.t, 0.9);
        nz(b, 0.15, 0.25, 'bandpass', 1800, 4000, 2, 0.002);
        break;
      case 'flame':
        nz(b, 0.18, 0.3, 'lowpass', 1400, 600, 0.6, 0.02);
        nz(b, 0.12, 0.12, 'bandpass', 300, null, 1, 0.02);
        break;
      case 'melee':
        nz(b, 0.18, 0.4, 'bandpass', 900, 3500, 2.2, 0.03);
        break;
      case 'launcher':
        osc(b, 'sine', 90 * p, 40, 0.3, 0.8, 0.002);
        nz(b, 0.6, 0.4, 'bandpass', 600, 2400, 1.2, 0.01);
        break;
      default: {
        // crack + body + tail; bigger guns are lower and longer
        const s = { pistol: [1, 0.9, 0.22], smg: [1.15, 0.6, 0.12], rifle: [0.9, 0.9, 0.25], heavy: [0.75, 0.75, 0.16], shotgun: [0.6, 1.2, 0.45], sniper: [0.55, 1.4, 0.8] }[kind];
        nz(b, 0.02, 1.0 * s[1], 'highpass', 2500 * s[0] * p, null, 0.7, 0.001);
        nz(b, s[2], 0.75 * s[1], 'lowpass', 3200 * s[0] * p, 300, 0.7, 0.002);
        osc(b, 'sine', 150 * s[0] * p, 45, s[2] * 0.6, 0.9 * s[1], 0.001);
        if (kind === 'sniper' || kind === 'shotgun') nz(b, s[2] * 1.6, 0.25, 'lowpass', 700, 120, 0.7, 0.02, b.t + 0.05);
      }
    }
  },
  /** Reload: magazine out, magazine in, slide. */
  reload(o?: SfxOpts) {
    const b = begin('reload', o, 200);
    if (!b) return;
    [0, 0.22, 0.42].forEach((d, i) => (nz(b, 0.04, 0.35, 'bandpass', [1500, 2200, 3200][i], null, 3, 0.002, b.t + d), osc(b, 'sine', [300, 420, 600][i], null, 0.04, 0.15, 0.002, b.t + d)));
  },
  /** Empty-gun click. */
  dry(o?: SfxOpts) {
    const b = begin('dry', o, 120);
    if (b) nz(b, 0.02, 0.3, 'bandpass', 4200, null, 5);
  },
  /** Explosion; size 1 = grenade. */
  boom(size = 1, o?: SfxOpts) {
    const b = begin('boom', o, 60);
    if (!b) return;
    nz(b, 0.9 * size, 0.9, 'lowpass', 2600, 90, 0.5, 0.004);
    osc(b, 'sine', 70, 28, 0.8 * size, 1.0, 0.004);
    nz(b, 0.25, 0.4, 'highpass', 1500, null, 0.7, 0.002);
  },
  /** Sci-fi zap for lasers/aliens (smooth, not 8-bit). */
  zap(o?: SfxOpts) {
    const b = begin('zap', o, 30);
    if (!b) return;
    osc(b, 'sine', 1400 * b.p, 300 * b.p, 0.14, 0.3, 0.002);
    osc(b, 'triangle', 2100 * b.p, 450 * b.p, 0.1, 0.1, 0.002);
  },
  /** Card flip / page turn. */
  flip(o?: SfxOpts) {
    const b = begin('flip', o, 30);
    if (b) nz(b, 0.08, 0.3, 'bandpass', 2600 * b.p, 5000 * b.p, 1.5, 0.01);
  },
  /** Heartbeat, for scares. */
  heartbeat(o?: SfxOpts) {
    const b = begin('heart', o, 500);
    if (!b) return;
    osc(b, 'sine', 60, 40, 0.14, 0.9, 0.006);
    osc(b, 'sine', 55, 38, 0.16, 0.7, 0.006, b.t + 0.22);
  },
  /** Deep dread sting. */
  sting(o?: SfxOpts) {
    const b = begin('sting', o, 1000);
    if (!b) return;
    [55, 58.3, 82.4].forEach((f) => osc(b, 'sawtooth', f, f * 0.94, 2.6, 0.12, 0.05));
    nz(b, 2.2, 0.2, 'bandpass', 300, 1800, 3, 0.4);
  },
};

/** A looping ambience (Backrooms fluorescent hum). Returns controls; stop() fades it out. */
export function hum() {
  if (S().muted) return { set() {}, stop() {} };
  const c = setup();
  if (!c) return { set() {}, stop() {} };
  const g = c.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.11, c.currentTime + 1.5);
  g.connect(bus!);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.connect(g);
  const os = [60, 120, 180, 240].map((f, i) => {
    const o = c.createOscillator();
    o.type = i ? 'sine' : 'sawtooth';
    o.frequency.value = f;
    const og = c.createGain();
    og.gain.value = [0.25, 0.5, 0.18, 0.12][i];
    o.connect(og).connect(lp);
    o.start();
    return o;
  });
  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  const nf = c.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 7000;
  nf.Q.value = 2;
  const ng = c.createGain();
  ng.gain.value = 0.05;
  n.connect(nf).connect(ng).connect(g);
  n.start();
  return {
    /** level 0..1 (flicker). */
    set(level: number) {
      g.gain.setTargetAtTime(0.11 * level, c.currentTime, 0.03);
    },
    stop() {
      g.gain.setTargetAtTime(0, c.currentTime, 0.2);
      window.setTimeout(() => (os.forEach((o) => o.stop()), n.stop()), 1200);
    },
  };
}

/** Volume and pan for a sound at (x, z) heard from (lx, lz) facing yaw (forward = sin yaw, -cos yaw). */
export function spatial(x: number, z: number, lx: number, lz: number, yaw: number, range = 30): SfxOpts {
  const dx = x - lx, dz = z - lz, d = Math.hypot(dx, dz);
  const right = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / Math.max(1, d);
  return { vol: Math.max(0, 1 - d / range) ** 1.4, pan: right * 0.8 };
}
