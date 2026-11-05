// Shared bits for the koal.games arcade: the game contract, high scores and glossy Aero drawing helpers.
import type { ReactNode } from 'react';

export type Ctx = CanvasRenderingContext2D;

export interface GameApi {
  id: string;
  ctx: Ctx;
  w: number;
  h: number;
  keys: Record<string, boolean>;
  readonly score: number;
  setScore(n: number): void;
  addScore(n: number): void;
  /** Text on the right of the status bar. */
  info(t?: string): void;
  /** Ends the round and shows the Game Over box. */
  over(msg?: string): void;
  /** Re-renders the game's React overlay (lobbies, editors). */
  refresh(): void;
  rnd(a: number, b: number): number;
  ri(a: number, b: number): number;
  /** Start options, e.g. { level } when a Cube Run level file is opened. */
  opts: Record<string, unknown>;
}

export interface GameInst {
  key?(k: string, down: boolean, e: KeyboardEvent): void;
  pointer?(type: 'down' | 'move' | 'up', x: number, y: number, e: PointerEvent): void;
  update?(dt: number): void;
  draw(c: Ctx): void;
  destroy?(): void;
  /** Optional React UI drawn over the canvas (menus, lobbies, editors). */
  overlay?(): ReactNode;
  dbg?(): unknown;
}

export interface GameDef {
  id: string;
  name: string;
  w: number;
  h: number;
  help: string;
  blurb: string;
  badge?: string;
  make(a: GameApi): GameInst;
}

// ---------- high scores (same key as koalOS, so old bests carry over) ----------
export const HS_KEY = 'koalos.hs';
export const hsAll = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(HS_KEY) || '{}') || {};
  } catch {
    return {};
  }
};
export const hsGet = (id: string) => hsAll()[id] || 0;
export const hsSet = (id: string, v: number) => {
  try {
    const o = hsAll();
    if (v > (o[id] || 0)) {
      o[id] = v;
      localStorage.setItem(HS_KEY, JSON.stringify(o));
    }
  } catch {
    /* storage full or blocked */
  }
};

// ---------- drawing ----------
export function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** A glossy "jelly" rounded rectangle in any CSS colour: shade, top shine, soft rim. */
export function gloss(c: Ctx, x: number, y: number, w: number, h: number, r: number, col: string, rim = 'rgba(0,0,0,.35)') {
  rr(c, x, y, w, h, r);
  c.fillStyle = col;
  c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,255,255,.35)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(0.51, 'rgba(0,0,0,.04)');
  g.addColorStop(1, 'rgba(0,0,0,.24)');
  c.fillStyle = g;
  c.fill();
  if (h > 6 && w > 6) {
    const s = c.createLinearGradient(0, y, 0, y + h * 0.5);
    s.addColorStop(0, 'rgba(255,255,255,.75)');
    s.addColorStop(1, 'rgba(255,255,255,.05)');
    c.fillStyle = s;
    rr(c, x + Math.min(3, w * 0.08), y + 1.5, w - Math.min(6, w * 0.16), h * 0.46, Math.max(1, r - 1.5));
    c.fill();
  }
  c.strokeStyle = rim;
  c.lineWidth = 1;
  rr(c, x + 0.5, y + 0.5, w - 1, h - 1, r);
  c.stroke();
}

/** A shiny marble / bubble. */
export function orb(c: Ctx, x: number, y: number, r: number, col: string, rim = 'rgba(0,0,0,.3)') {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = col;
  c.fill();
  const g = c.createRadialGradient(x, y + r * 0.2, r * 0.2, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,.12)');
  g.addColorStop(0.75, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.3)');
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = rim;
  c.lineWidth = Math.max(1, r * 0.06);
  c.stroke();
  const s = c.createLinearGradient(0, y - r, 0, y);
  s.addColorStop(0, 'rgba(255,255,255,.9)');
  s.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = s;
  c.beginPath();
  c.ellipse(x, y - r * 0.45, r * 0.62, r * 0.42, 0, 0, Math.PI * 2);
  c.fill();
}

/** Big glossy eyes, the same look as Buddi's. */
export function eyes(c: Ctx, cx: number, cy: number, s: number, dizzy = false, look = 0) {
  const dx = s * 0.2;
  for (const sx of [-1, 1]) {
    const ex = cx + sx * dx;
    if (dizzy) {
      c.strokeStyle = '#173463';
      c.lineWidth = Math.max(1.5, s * 0.06);
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(ex - s * 0.07, cy - s * 0.07);
      c.lineTo(ex + s * 0.07, cy + s * 0.07);
      c.moveTo(ex + s * 0.07, cy - s * 0.07);
      c.lineTo(ex - s * 0.07, cy + s * 0.07);
      c.stroke();
      continue;
    }
    const g = c.createRadialGradient(ex, cy - s * 0.05, 0, ex, cy, s * 0.14);
    g.addColorStop(0, '#4a7fcc');
    g.addColorStop(0.6, '#173463');
    g.addColorStop(1, '#0a1530');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(ex + look * s * 0.03, cy, s * 0.085, s * 0.12, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.ellipse(ex + s * 0.03 + look * s * 0.03, cy - s * 0.05, s * 0.032, s * 0.04, 0, 0, Math.PI * 2);
    c.fill();
  }
}

/** The arcade's mascot: a glossy jelly cube with a happy face (it replaces koalOS's flat cube). */
export function jellyCube(c: Ctx, cx: number, cy: number, s: number, col: string, dizzy = false) {
  gloss(c, cx - s / 2, cy - s / 2, s, s, s * 0.24, col);
  eyes(c, cx, cy - s * 0.04, s, dizzy);
  c.fillStyle = 'rgba(255,111,94,.45)';
  c.beginPath();
  c.ellipse(cx - s * 0.32, cy + s * 0.13, s * 0.08, s * 0.05, 0, 0, Math.PI * 2);
  c.ellipse(cx + s * 0.32, cy + s * 0.13, s * 0.08, s * 0.05, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(40,20,0,.75)';
  c.lineWidth = Math.max(1.5, s * 0.06);
  c.lineCap = 'round';
  c.beginPath();
  if (dizzy) c.arc(cx, cy + s * 0.26, s * 0.08, Math.PI * 1.1, Math.PI * 1.9);
  else c.arc(cx, cy + s * 0.12, s * 0.11, Math.PI * 0.15, Math.PI * 0.85);
  c.stroke();
}

/** Aero sky: a vertical gradient with soft light from the top. */
export function sky(c: Ctx, w: number, h: number, top: string, bottom: string) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const r = c.createRadialGradient(w * 0.3, -h * 0.1, 0, w * 0.3, -h * 0.1, h * 0.9);
  r.addColorStop(0, 'rgba(255,255,255,.35)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = r;
  c.fillRect(0, 0, w, h);
}

/** Drifting see-through bubbles for backgrounds. */
export function bubbles(c: Ctx, w: number, h: number, t: number, n = 7, alpha = 0.5) {
  for (let i = 0; i < n; i++) {
    const r = 6 + ((i * 37) % 22);
    const x = ((i * 131 + Math.sin(t * 0.4 + i) * 20) % w + w) % w;
    const y = h - (((t * (10 + (i % 4) * 6) + i * 97) % (h + 60)) - 30);
    c.globalAlpha = alpha;
    c.strokeStyle = 'rgba(255,255,255,.8)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,.6)';
    c.beginPath();
    c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.18, -0.6, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }
}

/** A five-point star path (filled by the caller). */
export function starPath(c: Ctx, x: number, y: number, ro: number, ri = ro * 0.45, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro;
    const a = rot + (i * Math.PI) / 5;
    i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}

/** Text with a soft dark outline, readable on any background. */
export function label(c: Ctx, t: string | number, x: number, y: number, size: number, col = '#fff', align: CanvasTextAlign = 'center', bold = true) {
  c.font = (bold ? 'bold ' : '') + size + 'px "Segoe UI", Tahoma, sans-serif';
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(2, size / 7);
  // dark text gets a light halo, light text a dark one
  c.strokeStyle = /^#[0-4]/.test(col) ? 'rgba(255,255,255,.85)' : 'rgba(0,30,70,.55)';
  c.strokeText(String(t), x, y);
  c.fillStyle = col;
  c.fillText(String(t), x, y);
  c.textBaseline = 'alphabetic';
}
