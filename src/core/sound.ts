import { S } from './settings';

// Every sound is synthesized with WebAudio. No audio files, no network.
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export type SoundName = 'startup' | 'shutdown' | 'logon' | 'click' | 'error' | 'notify' | 'open' | 'close' | 'minimize' | 'maximize' | 'recycle' | 'ding' | 'exclaim' | 'bsod' | 'secret' | 'key';

function tone(c: AudioContext, out: AudioNode, freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.3, slideTo?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.02, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(out);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function noise(c: AudioContext, out: AudioNode, start: number, dur: number, gain = 0.2, hp = 800) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(out);
  src.start(start);
}

export function play(name: SoundName, force = false) {
  const st = S();
  if (st.muted && !force) return;
  const c = ac();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = Math.max(0, Math.min(1, st.volume));
  master.connect(c.destination);
  const t = c.currentTime + 0.01;
  switch (name) {
    case 'startup': {
      // warm pad + rising arpeggio, the KOAL-99 chime
      const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
      notes.forEach((f, i) => tone(c, master, f, t + i * 0.16, 1.8 - i * 0.12, 'triangle', 0.16));
      [130.81, 196.0].forEach((f) => tone(c, master, f, t, 2.6, 'sine', 0.12));
      tone(c, master, 1046.5, t + 1.0, 1.6, 'sine', 0.08);
      break;
    }
    case 'shutdown': {
      [783.99, 659.25, 523.25, 392.0, 261.63].forEach((f, i) => tone(c, master, f, t + i * 0.18, 1.2, 'triangle', 0.15));
      tone(c, master, 130.81, t, 2.2, 'sine', 0.12);
      break;
    }
    case 'logon':
      [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(c, master, f, t + i * 0.09, 0.7, 'triangle', 0.14));
      break;
    case 'click':
      tone(c, master, 1800, t, 0.03, 'square', 0.05);
      break;
    case 'key':
      tone(c, master, 2400 + Math.random() * 400, t, 0.015, 'square', 0.02);
      break;
    case 'error':
      tone(c, master, 220, t, 0.25, 'square', 0.12);
      tone(c, master, 165, t + 0.12, 0.3, 'square', 0.1);
      break;
    case 'exclaim':
      tone(c, master, 880, t, 0.18, 'triangle', 0.18);
      tone(c, master, 660, t + 0.12, 0.3, 'triangle', 0.16);
      break;
    case 'ding':
      tone(c, master, 1318.5, t, 0.6, 'sine', 0.2);
      tone(c, master, 2637, t, 0.3, 'sine', 0.05);
      break;
    case 'notify':
      tone(c, master, 987.77, t, 0.18, 'sine', 0.16);
      tone(c, master, 1318.5, t + 0.1, 0.35, 'sine', 0.16);
      break;
    case 'open':
      tone(c, master, 500, t, 0.08, 'sine', 0.08, 900);
      break;
    case 'close':
      tone(c, master, 700, t, 0.08, 'sine', 0.08, 380);
      break;
    case 'minimize':
      tone(c, master, 900, t, 0.12, 'sine', 0.07, 300);
      break;
    case 'maximize':
      tone(c, master, 300, t, 0.12, 'sine', 0.07, 900);
      break;
    case 'recycle':
      noise(c, master, t, 0.12, 0.25, 1500);
      noise(c, master, t + 0.1, 0.18, 0.2, 900);
      noise(c, master, t + 0.25, 0.1, 0.15, 2500);
      break;
    case 'bsod':
      tone(c, master, 110, t, 1.2, 'sawtooth', 0.15);
      noise(c, master, t, 0.6, 0.15, 200);
      break;
    case 'secret':
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(c, master, f, t + i * 0.07, 0.25, 'square', 0.06));
      break;
  }
}

/** Generate a short chiptune WAV so the Media Player has something to play out of the box. */
export function makeDemoTrack(): string {
  const rate = 22050;
  const bpm = 132;
  const beat = 60 / bpm;
  const lead = 'E5 G5 A5 B5 A5 G5 E5 D5 E5 G5 A5 G5 E5 - D5 - C5 E5 G5 A5 G5 E5 C5 D5 E5 - G5 - A5 B5 C6 -'.split(' ');
  const bass = 'A2 A2 E3 E3 F2 F2 C3 C3 G2 G2 D3 D3 E2 E2 B2 B2'.split(' ');
  const freq = (n: string) => {
    if (n === '-') return 0;
    const m = /^([A-G])(#?)(\d)$/.exec(n)!;
    const semis: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
    const s = semis[m[1]] + (m[2] ? 1 : 0) + (parseInt(m[3], 10) - 4) * 12;
    return 440 * Math.pow(2, s / 12);
  };
  const loops = 3;
  const stepDur = beat / 2;
  const totalSteps = lead.length * loops;
  const len = Math.floor(totalSteps * stepDur * rate);
  const data = new Float32Array(len);
  for (let s = 0; s < totalSteps; s++) {
    const f = freq(lead[s % lead.length]);
    const bf = freq(bass[Math.floor(s / 2) % bass.length]);
    const start = Math.floor(s * stepDur * rate);
    const n = Math.floor(stepDur * rate);
    for (let i = 0; i < n && start + i < len; i++) {
      const tt = i / rate;
      const env = Math.max(0, 1 - i / n) ** 1.5;
      let v = 0;
      if (f) v += (Math.sin(2 * Math.PI * f * tt) > 0 ? 1 : -1) * 0.12 * env;
      v += ((((tt * bf) % 1) * 2 - 1) * 0.1) * Math.min(1, (n - i) / 200);
      if (s % 4 === 0 && i < 1500) v += (Math.random() * 2 - 1) * 0.15 * (1 - i / 1500);
      if (s % 4 === 2 && i < 800) v += Math.sin(i / 6) * 0.2 * (1 - i / 800);
      data[start + i] += v;
    }
  }
  const buf = new ArrayBuffer(44 + len * 2);
  const dv = new DataView(buf);
  const w = (o: number, str: string) => [...str].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF');
  dv.setUint32(4, 36 + len * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  w(36, 'data');
  dv.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
