import { useEffect, useRef } from 'react';
import { useSettings, ScreensaverKind } from '../core/settings';
import { sysStore } from '../core/system';
import { iconUrl } from './Icon';

type Draw = (g: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

function makeSaver(kind: ScreensaverKind, w: number, h: number): Draw {
  if (kind === 'starfield') {
    const stars = Array.from({ length: 400 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
    return (g, W, H) => {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, 0, W, H);
      for (const s of stars) {
        s.z -= 0.006;
        if (s.z <= 0.01) {
          s.x = Math.random() * 2 - 1;
          s.y = Math.random() * 2 - 1;
          s.z = 1;
        }
        const px = W / 2 + (s.x / s.z) * W * 0.5;
        const py = H / 2 + (s.y / s.z) * H * 0.5;
        const r = Math.max(0.5, (1 - s.z) * 2.5);
        const c = Math.floor((1 - s.z) * 255);
        g.fillStyle = `rgb(${c},${c},${Math.min(255, c + 30)})`;
        g.fillRect(px, py, r, r);
      }
    };
  }
  if (kind === 'matrix') {
    const size = Math.max(10, Math.round(w / 90));
    const cols = Math.ceil(w / size);
    const drops = Array.from({ length: cols }, () => Math.random() * -50);
    const glyphs = 'アカサタナハマヤラワ0123456789KOAL99';
    return (g, W, H) => {
      g.fillStyle = 'rgba(0,0,0,0.08)';
      g.fillRect(0, 0, W, H);
      g.font = `${size}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
        g.fillStyle = Math.random() < 0.05 ? '#cfc' : '#2f2';
        g.fillText(ch, i * size, drops[i] * size);
        if (drops[i] * size > H && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.5;
      }
    };
  }
  if (kind === 'pipes') {
    const cell = Math.max(8, Math.round(w / 60));
    let pipes: { x: number; y: number; dx: number; dy: number; c: string; life: number }[] = [];
    let frames = 0;
    const colors = ['#e23b2e', '#2f6fe0', '#4cb848', '#ffd84a', '#9b5de5', '#f39a2b', '#c0c0c0'];
    const spawn = () => ({ x: Math.floor(Math.random() * (w / cell)), y: Math.floor(Math.random() * (h / cell)), dx: 1, dy: 0, c: colors[Math.floor(Math.random() * colors.length)], life: 400 });
    return (g, W, H) => {
      frames++;
      if (frames % 1800 === 1) {
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, H);
        pipes = [spawn(), spawn(), spawn()];
      }
      for (const p of pipes) {
        if (Math.random() < 0.15) {
          const dirs = p.dx ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
          const d = dirs[Math.floor(Math.random() * 2)];
          g.fillStyle = '#fff';
          g.beginPath();
          g.arc(p.x * cell + cell / 2, p.y * cell + cell / 2, cell * 0.55, 0, Math.PI * 2);
          g.fillStyle = p.c;
          g.fill();
          p.dx = d[0];
          p.dy = d[1];
        }
        const grad = g.createLinearGradient(p.x * cell, p.y * cell, p.x * cell + (p.dy ? cell : 0), p.y * cell + (p.dx ? cell : 0));
        grad.addColorStop(0, p.c);
        grad.addColorStop(0.5, '#fff');
        grad.addColorStop(1, p.c);
        g.fillStyle = grad;
        g.fillRect(p.x * cell + cell * 0.2, p.y * cell + cell * 0.2, cell * 0.6 + Math.abs(p.dx) * cell * 0.6, cell * 0.6 + Math.abs(p.dy) * cell * 0.6);
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.y < 0 || p.x > W / cell || p.y > H / cell || --p.life <= 0) Object.assign(p, spawn());
      }
    };
  }
  // logo
  const img = new Image();
  img.src = iconUrl('logo');
  let x = Math.random() * (w - 200);
  let y = Math.random() * (h - 100);
  let vx = 1.6;
  let vy = 1.2;
  let hue = 0;
  return (g, W, H) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const s = Math.max(0.5, W / 1400);
    const bw = 300 * s;
    const bh = 90 * s;
    x += vx * s * 1.5;
    y += vy * s * 1.5;
    if (x < 0 || x + bw > W) (vx = -vx, (hue += 70));
    if (y < 0 || y + bh > H) (vy = -vy, (hue += 70));
    x = Math.max(0, Math.min(W - bw, x));
    y = Math.max(0, Math.min(H - bh, y));
    g.imageSmoothingEnabled = false;
    g.drawImage(img, x, y, bh, bh);
    g.fillStyle = `hsl(${hue % 360},90%,60%)`;
    g.font = `italic bold ${Math.round(52 * s)}px "Trebuchet MS", sans-serif`;
    g.fillText('KOAL-99', x + bh + 10 * s, y + bh * 0.68);
  };
}

export function SaverCanvas({ kind, preview = false }: { kind: ScreensaverKind; preview?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || kind === 'none') return;
    const w = (c.width = preview ? 152 : window.innerWidth);
    const h = (c.height = preview ? 112 : window.innerHeight);
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    const draw = makeSaver(kind, w, h);
    let raf = 0;
    const loop = (t: number) => {
      draw(g, w, h, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [kind, preview]);
  if (kind === 'none') return <div style={{ width: '100%', height: '100%', background: '#000' }} />;
  return <canvas ref={ref} style={preview ? { width: '100%', height: '100%', display: 'block' } : undefined} />;
}

/** Watches for idle and shows the configured screensaver. */
export function ScreensaverHost() {
  const s = useSettings();
  const active = sysStore.use((x) => x.screensaverActive);
  const last = useRef(Date.now());
  useEffect(() => {
    const bump = () => {
      last.current = Date.now();
      if (sysStore.get().screensaverActive && Date.now() - startedAt.current > 400) sysStore.set({ screensaverActive: false });
    };
    const startedAt = { current: 0 };
    const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel'];
    evs.forEach((e) => window.addEventListener(e, bump, true));
    const t = window.setInterval(() => {
      if (s.screensaver === 'none' || sysStore.get().screensaverActive) return;
      if (Date.now() - last.current > s.screensaverMinutes * 60000) {
        startedAt.current = Date.now();
        sysStore.set({ screensaverActive: true });
      }
    }, 2000);
    (window as unknown as { __koalSaverStart: () => void }).__koalSaverStart = () => {
      startedAt.current = Date.now();
      sysStore.set({ screensaverActive: true });
    };
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump, true));
      window.clearInterval(t);
    };
  }, [s.screensaver, s.screensaverMinutes]);
  if (!active) return null;
  return (
    <div className="screensaver">
      <SaverCanvas kind={s.screensaver === 'none' ? 'starfield' : s.screensaver} />
    </div>
  );
}

export function startScreensaver() {
  (window as unknown as { __koalSaverStart?: () => void }).__koalSaverStart?.();
}
