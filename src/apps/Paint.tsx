import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../core/registry';
import * as fs from '../core/fs';
import { MenuBar } from '../ui/MenuBar';
import { FileDialog } from '../ui/FileDialog';
import { onBeforeClose } from '../core/wm';
import { choiceBox, errorBox, promptBox, alertBox } from '../core/dialog';
import { notifySaved } from '../core/launcher';
import { setSettings } from '../core/settings';
import { notify } from '../core/notify';

type Tool = 'pencil' | 'brush' | 'marker' | 'eraser' | 'fill' | 'line' | 'rect' | 'ellipse' | 'spray' | 'picker' | 'text';
const TOOLS: { id: Tool; label: string; glyph: string }[] = [
  { id: 'pencil', label: 'Pencil', glyph: '✏' },
  { id: 'brush', label: 'Brush', glyph: '\u{1F58C}' },
  { id: 'marker', label: 'Marker (see-through)', glyph: '\u{1F58D}' },
  { id: 'eraser', label: 'Eraser', glyph: '▭' },
  { id: 'fill', label: 'Fill With Color', glyph: '\u{1FAA3}' },
  { id: 'spray', label: 'Airbrush', glyph: '∴' },
  { id: 'picker', label: 'Pick Color', glyph: '⌖' },
  { id: 'line', label: 'Line', glyph: '╱' },
  { id: 'rect', label: 'Rectangle', glyph: '□' },
  { id: 'ellipse', label: 'Ellipse', glyph: '◯' },
  { id: 'text', label: 'Text', glyph: 'A' },
];
const PALETTES: Record<string, string[]> = {
  Standard: ['#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040'],
  'Pixel 16': ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'],
  'Game Boy': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  Grays: Array.from({ length: 16 }, (_, i) => '#' + Math.round(i * 17).toString(16).padStart(2, '0').repeat(3)),
  Earth: ['#2d1b0e', '#5a3a1e', '#8b5a2b', '#c68e4a', '#e8c07a', '#f6e7b4', '#2f4f2f', '#4f7942', '#8fbc5a', '#c5e08a', '#1e3a5f', '#2e6da4', '#6fb1e8', '#c9e6ff'],
  Aero: ['#0b2440', '#1c5fc0', '#2f8ae6', '#7fd0ff', '#d6f3ff', '#ffffff', '#2e9a2c', '#6fcf3a', '#c6f76a', '#f39a2b', '#ffd34d', '#e5352a', '#f05a9a', '#9b5de5'],
};
const PIXEL_SIZES = [4, 6, 8, 10, 12, 16, 20, 32];
const PIXEL_TOOLS: Tool[] = ['pencil', 'brush', 'eraser', 'line', 'rect', 'ellipse', 'fill', 'picker'];

function hexToRgb(h: string) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function Paint({ win }: { win: WinCtx }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [size, setSize] = useState(3);
  const [fg, setFg] = useState('#000000');
  const [bg, setBg] = useState('#ffffff');
  const [shapeFill, setShapeFill] = useState<'outline' | 'fill' | 'both'>('outline');
  const [zoom, setZoom] = useState(1);
  const [fileId, setFileId] = useState<string | null>(win.props.fileId ?? null);
  const [name, setName] = useState('untitled');
  const [dirty, setDirty] = useState(false);
  const [dims, setDims] = useState({ w: 640, h: 440 });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [dialog, setDialog] = useState<null | 'open' | 'save'>(null);
  const [palName, setPalName] = useState('Standard');
  const [px, setPx] = useState<{ on: boolean; cell: number; grid: boolean }>({ on: !!win.props.pixel, cell: 16, grid: true });
  const gridRef = useRef<HTMLCanvasElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const undo = useRef<ImageData[]>([]);
  const redo = useRef<ImageData[]>([]);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const afterSave = useRef<((ok: boolean) => void) | null>(null);

  const ctx = () => canvasRef.current!.getContext('2d', { willReadFrequently: true })!;

  const resetCanvas = (w: number, h: number, fill = '#ffffff') => {
    const c = canvasRef.current!;
    c.width = w;
    c.height = h;
    overlayRef.current!.width = w;
    overlayRef.current!.height = h;
    gridRef.current!.width = w;
    gridRef.current!.height = h;
    const g = ctx();
    g.fillStyle = fill;
    g.fillRect(0, 0, w, h);
    setDims({ w, h });
  };

  const loadFile = (id: string) => {
    const n = fs.get(id);
    if (!n) return;
    if (n.meta?.corrupt) {
      resetCanvas(320, 240);
      const g = ctx();
      const img = g.createImageData(320, 240);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = v;
        img.data[i + 1] = v * 0.4;
        img.data[i + 2] = v * 0.4;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      g.fillStyle = '#f00';
      g.font = 'bold 28px monospace';
      g.fillText('hello', 120, 130);
      setName(n.name);
      setFileId(null);
      return;
    }
    if (!n.content.startsWith('data:image')) {
      if (n.content) {
        errorBox(`Paint cannot read this file.\n\n${n.name} is not a valid bitmap file, or its format is not currently supported.`, 'StarPaint');
        return;
      }
      resetCanvas(640, 440);
      setFileId(n.id);
      setName(n.name);
      setDirty(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      resetCanvas(img.width, img.height);
      ctx().drawImage(img, 0, 0);
      setFileId(n.id);
      setName(n.name);
      setDirty(false);
      undo.current = [];
      redo.current = [];
    };
    img.src = n.content;
  };

  useEffect(() => {
    resetCanvas(640, 440);
    if (win.props.fileId) loadFile(win.props.fileId);
    onBeforeClose(win.id, async () => {
      if (!dirtyRef.current) return true;
      const r = await choiceBox(`Save changes to ${nameRef.current}?`, ['Yes', 'No', 'Cancel'], 'StarPaint', 'warning');
      if (r === 1) return true;
      if (r !== 0) return false;
      return new Promise<boolean>((resolve) => {
        afterSave.current = resolve;
        save();
      });
    });
    return () => onBeforeClose(win.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    win.setTitle(`${dirty ? '*' : ''}${name} - StarPaint`);
  });

  // ---- pixel art mode (from koalOS Paint) ----
  useEffect(() => {
    const gc = gridRef.current;
    if (!gc) return;
    const gg = gc.getContext('2d')!;
    gg.clearRect(0, 0, gc.width, gc.height);
    if (!px.on || !px.grid) return;
    gg.strokeStyle = 'rgba(0,0,0,.18)';
    gg.lineWidth = 1;
    gg.beginPath();
    for (let x = 0; x <= gc.width; x += px.cell) (gg.moveTo(x + 0.5, 0), gg.lineTo(x + 0.5, gc.height));
    for (let y = 0; y <= gc.height; y += px.cell) (gg.moveTo(0, y + 0.5), gg.lineTo(gc.width, y + 0.5));
    gg.stroke();
  }, [px, dims]);
  useEffect(() => {
    if (px.on && !PIXEL_TOOLS.includes(tool)) setTool('pencil');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px.on]);

  type Pt = { x: number; y: number };
  const cellOf = (p: Pt): Pt => ({ x: Math.floor(p.x / px.cell), y: Math.floor(p.y / px.cell) });
  const plot = (g: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    const c = canvasRef.current!;
    if (x < 0 || y < 0 || x * px.cell >= c.width || y * px.cell >= c.height) return;
    g.fillStyle = color;
    g.fillRect(x * px.cell, y * px.cell, px.cell, px.cell);
  };
  const stamp = (g: CanvasRenderingContext2D, x: number, y: number, color: string, n: number) => {
    const o = Math.floor((n - 1) / 2);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) plot(g, x - o + i, y - o + j, color);
  };
  const bres = (a: Pt, b: Pt, fn: (x: number, y: number) => void) => {
    let x0 = a.x;
    let y0 = a.y;
    const dx = Math.abs(b.x - x0);
    const dy = -Math.abs(b.y - y0);
    const sx = x0 < b.x ? 1 : -1;
    const sy = y0 < b.y ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      fn(x0, y0);
      if (x0 === b.x && y0 === b.y) break;
      const e2 = 2 * err;
      if (e2 >= dy) (err += dy), (x0 += sx);
      if (e2 <= dx) (err += dx), (y0 += sy);
    }
  };
  const pxShape = (g: CanvasRenderingContext2D, t: Tool, a: Pt, b: Pt, color: string, filled: boolean, n: number) => {
    if (t === 'line') return bres(a, b, (x, y) => stamp(g, x, y, color, n));
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    if (t === 'rect') {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (filled || x === x0 || x === x1 || y === y0 || y === y1) plot(g, x, y, color);
      return;
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0 + 1) / 2, ry = (y1 - y0 + 1) / 2;
    const inside = (x: number, y: number) => ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry) <= 1;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) if (inside(x, y) && (filled || !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1))) plot(g, x, y, color);
  };
  const pixFill = (cc: Pt, color: string) => {
    const c = canvasRef.current!;
    const g = ctx();
    const nx = Math.ceil(c.width / px.cell), ny = Math.ceil(c.height / px.cell);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const at = (x: number, y: number) => {
      const i = (Math.min(c.height - 1, y * px.cell + 1) * c.width + Math.min(c.width - 1, x * px.cell + 1)) * 4;
      return (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    };
    const target = at(cc.x, cc.y);
    const [r, gg, b] = hexToRgb(color);
    if (target === ((r << 16) | (gg << 8) | b)) return;
    const seen = new Uint8Array(nx * ny);
    const stack: Pt[] = [cc];
    while (stack.length) {
      const { x, y } = stack.pop()!;
      if (x < 0 || y < 0 || x >= nx || y >= ny || seen[y * nx + x] || at(x, y) !== target) continue;
      seen[y * nx + x] = 1;
      plot(g, x, y, color);
      stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
    }
  };
  const pixelate = () => {
    snapshot();
    const c = canvasRef.current!;
    const g = ctx();
    const d = g.getImageData(0, 0, c.width, c.height).data;
    for (let y = 0; y < c.height; y += px.cell)
      for (let x = 0; x < c.width; x += px.cell) {
        let r = 0, gg = 0, b = 0, n = 0;
        for (let j = 0; j < px.cell && y + j < c.height; j++)
          for (let i = 0; i < px.cell && x + i < c.width; i++) {
            const k = ((y + j) * c.width + x + i) * 4;
            r += d[k];
            gg += d[k + 1];
            b += d[k + 2];
            n++;
          }
        g.fillStyle = `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`;
        g.fillRect(x, y, px.cell, px.cell);
      }
    setPx({ ...px, on: true });
    setDirty(true);
  };
  const saveTiny = () => {
    const c = canvasRef.current!;
    const g = ctx();
    const nx = Math.floor(c.width / px.cell), ny = Math.floor(c.height / px.cell);
    const t = document.createElement('canvas');
    t.width = nx;
    t.height = ny;
    const tg = t.getContext('2d')!;
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const d = g.getImageData(x * px.cell + (px.cell >> 1), y * px.cell + (px.cell >> 1), 1, 1).data;
        tg.fillStyle = `rgb(${d[0]},${d[1]},${d[2]})`;
        tg.fillRect(x, y, 1, 1);
      }
    const a = document.createElement('a');
    a.href = t.toDataURL();
    a.download = `pixel-art-${nx}x${ny}.png`;
    a.click();
  };
  const drawImageFile = (f: File | undefined) => {
    if (!f || !f.type.startsWith('image/')) return;
    const im = new Image();
    im.onload = () => {
      snapshot();
      const c = canvasRef.current!;
      const k = Math.min(c.width / im.width, c.height / im.height, 1);
      ctx().drawImage(im, 0, 0, im.width * k, im.height * k);
      URL.revokeObjectURL(im.src);
      setDirty(true);
    };
    im.src = URL.createObjectURL(f);
  };

  const snapshot = () => {
    const c = canvasRef.current!;
    undo.current.push(ctx().getImageData(0, 0, c.width, c.height));
    if (undo.current.length > 30) undo.current.shift();
    redo.current = [];
  };
  const doUndo = () => {
    const c = canvasRef.current!;
    const s = undo.current.pop();
    if (!s) return;
    redo.current.push(ctx().getImageData(0, 0, c.width, c.height));
    if (s.width !== c.width || s.height !== c.height) resetCanvas(s.width, s.height);
    ctx().putImageData(s, 0, 0);
    setDirty(true);
  };
  const doRedo = () => {
    const c = canvasRef.current!;
    const s = redo.current.pop();
    if (!s) return;
    undo.current.push(ctx().getImageData(0, 0, c.width, c.height));
    if (s.width !== c.width || s.height !== c.height) resetCanvas(s.width, s.height);
    ctx().putImageData(s, 0, 0);
    setDirty(true);
  };

  const pt = (e: React.PointerEvent | PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / zoom), y: Math.floor((e.clientY - r.top) / zoom) };
  };

  const floodFill = (x: number, y: number, color: string) => {
    const c = canvasRef.current!;
    const g = ctx();
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const W = c.width;
    const H = c.height;
    const i0 = (y * W + x) * 4;
    const [tr, tg, tb, ta] = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
    const [r, gg, b] = hexToRgb(color);
    if (tr === r && tg === gg && tb === b && ta === 255) return;
    const match = (i: number) => Math.abs(d[i] - tr) < 8 && Math.abs(d[i + 1] - tg) < 8 && Math.abs(d[i + 2] - tb) < 8 && Math.abs(d[i + 3] - ta) < 8;
    const stack = [[x, y]];
    while (stack.length) {
      const [sx, sy] = stack.pop()!;
      let lx = sx;
      while (lx >= 0 && match((sy * W + lx) * 4)) lx--;
      lx++;
      let up = false;
      let down = false;
      for (let cx = lx; cx < W && match((sy * W + cx) * 4); cx++) {
        const i = (sy * W + cx) * 4;
        d[i] = r;
        d[i + 1] = gg;
        d[i + 2] = b;
        d[i + 3] = 255;
        if (sy > 0) {
          const m = match(((sy - 1) * W + cx) * 4);
          if (m && !up) stack.push([cx, sy - 1]);
          up = m;
        }
        if (sy < H - 1) {
          const m = match(((sy + 1) * W + cx) * 4);
          if (m && !down) stack.push([cx, sy + 1]);
          down = m;
        }
      }
    }
    g.putImageData(img, 0, 0);
  };

  const drawShape = (g: CanvasRenderingContext2D, t: Tool, a: { x: number; y: number }, b: { x: number; y: number }, stroke: string, fill: string, shift: boolean) => {
    g.lineWidth = Math.max(1, size);
    g.strokeStyle = stroke;
    g.fillStyle = fill;
    g.lineCap = 'round';
    let w = b.x - a.x;
    let h = b.y - a.y;
    if (shift && t !== 'line') {
      const s = Math.max(Math.abs(w), Math.abs(h));
      w = Math.sign(w || 1) * s;
      h = Math.sign(h || 1) * s;
    }
    g.beginPath();
    if (t === 'line') {
      g.moveTo(a.x + 0.5, a.y + 0.5);
      g.lineTo(b.x + 0.5, b.y + 0.5);
      g.stroke();
      return;
    }
    if (t === 'rect') g.rect(a.x + 0.5, a.y + 0.5, w, h);
    else g.ellipse(a.x + w / 2, a.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    if (shapeFill !== 'outline') g.fill();
    if (shapeFill !== 'fill') g.stroke();
  };

  const onDown = async (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    const right = e.button === 2;
    const stroke = right ? bg : fg;
    const other = right ? fg : bg;
    const p = pt(e);
    const g = ctx();
    if (px.on) {
      const cc = cellOf(p);
      if (tool === 'picker') {
        const d = g.getImageData(cc.x * px.cell + 1, cc.y * px.cell + 1, 1, 1).data;
        const hex = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
        right ? setBg(hex) : setFg(hex);
        return;
      }
      if (tool === 'fill') {
        snapshot();
        pixFill(cc, stroke);
        setDirty(true);
        return;
      }
      snapshot();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const c = canvasRef.current!;
      const color = tool === 'eraser' ? bg : stroke;
      const n = tool === 'pencil' ? 1 : Math.max(1, Math.round(size / 2));
      const shapeTool = tool === 'line' || tool === 'rect' || tool === 'ellipse';
      const base = shapeTool ? g.getImageData(0, 0, c.width, c.height) : null;
      let last = cc;
      if (!shapeTool) stamp(g, cc.x, cc.y, color, n);
      const move = (ev: PointerEvent) => {
        const q = cellOf(pt(ev));
        setCursor(q);
        if (!shapeTool) {
          bres(last, q, (x, y) => stamp(g, x, y, color, n));
          last = q;
        } else {
          g.putImageData(base!, 0, 0);
          pxShape(g, tool, cc, q, color, shapeFill !== 'outline', n);
        }
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        setDirty(true);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    if (tool === 'marker') {
      snapshot();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const c = canvasRef.current!;
      const base = g.getImageData(0, 0, c.width, c.height);
      const pts = [p];
      const draw = () => {
        g.putImageData(base, 0, 0);
        g.save();
        g.globalAlpha = 0.4;
        g.strokeStyle = stroke;
        g.lineWidth = size * 4;
        g.lineCap = g.lineJoin = 'round';
        g.beginPath();
        pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
        if (pts.length === 1) g.lineTo(p.x + 0.01, p.y);
        g.stroke();
        g.restore();
      };
      draw();
      const move = (ev: PointerEvent) => {
        pts.push(pt(ev));
        draw();
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        setDirty(true);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    if (tool === 'picker') {
      const d = g.getImageData(p.x, p.y, 1, 1).data;
      const hex = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      right ? setBg(hex) : setFg(hex);
      return;
    }
    if (tool === 'fill') {
      snapshot();
      floodFill(p.x, p.y, stroke);
      setDirty(true);
      return;
    }
    if (tool === 'text') {
      const t = await promptBox('Enter text to place on the canvas:', '', 'StarPaint Text');
      if (!t) return;
      snapshot();
      g.fillStyle = stroke;
      g.font = `${8 + size * 3}px Tahoma, sans-serif`;
      g.textBaseline = 'top';
      t.split('\n').forEach((l, i) => g.fillText(l, p.x, p.y + i * (10 + size * 3)));
      setDirty(true);
      return;
    }
    snapshot();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    let last = p;
    const start = p;
    const ov = overlayRef.current!.getContext('2d')!;
    const paintAt = (q: { x: number; y: number }) => {
      if (tool === 'spray') {
        g.fillStyle = stroke;
        const r = size * 3 + 4;
        for (let i = 0; i < r * 2; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * r;
          g.fillRect(Math.round(q.x + Math.cos(a) * d), Math.round(q.y + Math.sin(a) * d), 1, 1);
        }
        return;
      }
      g.strokeStyle = tool === 'eraser' ? bg : stroke;
      g.lineWidth = tool === 'pencil' ? 1 : tool === 'eraser' ? size * 3 + 4 : size * 2;
      g.lineCap = tool === 'eraser' ? 'square' : 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(last.x + 0.5, last.y + 0.5);
      g.lineTo(q.x + 0.5, q.y + 0.5);
      g.stroke();
      last = q;
    };
    const shape = tool === 'line' || tool === 'rect' || tool === 'ellipse';
    if (!shape) paintAt(p);
    const move = (ev: PointerEvent) => {
      const q = pt(ev);
      setCursor(q);
      if (shape) {
        ov.clearRect(0, 0, ov.canvas.width, ov.canvas.height);
        drawShape(ov, tool, start, q, stroke, other, ev.shiftKey);
      } else paintAt(q);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (shape) {
        ov.clearRect(0, 0, ov.canvas.width, ov.canvas.height);
        drawShape(g, tool, start, pt(ev), stroke, other, ev.shiftKey);
      }
      setDirty(true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const writeTo = (id: string) => {
    const url = canvasRef.current!.toDataURL('image/png');
    fs.write(id, url);
  };

  const save = () => {
    if (fileId && fs.get(fileId)) {
      try {
        writeTo(fileId);
        setDirty(false);
        notifySaved(name);
        afterSave.current?.(true);
        afterSave.current = null;
      } catch (e) {
        errorBox((e as Error).message, 'StarPaint');
        afterSave.current?.(false);
        afterSave.current = null;
      }
    } else setDialog('save');
  };

  const resize = async () => {
    const v = await promptBox('New canvas size (width x height):', `${dims.w}x${dims.h}`, 'Attributes');
    if (!v) return;
    const m = /^(\d+)\s*[x,* ]\s*(\d+)$/.exec(v.trim());
    if (!m) return errorBox('Please enter a size like 800x600.', 'Attributes');
    const w = Math.min(2400, Math.max(8, +m[1]));
    const h = Math.min(2400, Math.max(8, +m[2]));
    snapshot();
    const old = ctx().getImageData(0, 0, dims.w, dims.h);
    resetCanvas(w, h, bg);
    ctx().putImageData(old, 0, 0);
    setDirty(true);
  };

  const transform = (kind: 'fliph' | 'flipv' | 'invert' | 'rotate') => {
    snapshot();
    const c = canvasRef.current!;
    const tmp = document.createElement('canvas');
    tmp.width = c.width;
    tmp.height = c.height;
    tmp.getContext('2d')!.drawImage(c, 0, 0);
    const g = ctx();
    if (kind === 'invert') {
      const img = g.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = 255 - img.data[i];
        img.data[i + 1] = 255 - img.data[i + 1];
        img.data[i + 2] = 255 - img.data[i + 2];
      }
      g.putImageData(img, 0, 0);
    } else if (kind === 'rotate') {
      resetCanvas(tmp.height, tmp.width);
      const g2 = ctx();
      g2.save();
      g2.translate(tmp.height, 0);
      g2.rotate(Math.PI / 2);
      g2.drawImage(tmp, 0, 0);
      g2.restore();
    } else {
      g.save();
      if (kind === 'fliph') {
        g.translate(c.width, 0);
        g.scale(-1, 1);
      } else {
        g.translate(0, c.height);
        g.scale(1, -1);
      }
      g.drawImage(tmp, 0, 0);
      g.restore();
    }
    setDirty(true);
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = canvasRef.current!.toDataURL('image/png');
    a.download = name.replace(/\.[^.]+$/, '') + '.png';
    a.click();
  };

  const newImage = async () => {
    if (dirty) {
      const r = await choiceBox(`Save changes to ${name}?`, ['Yes', 'No', 'Cancel'], 'StarPaint', 'warning');
      if (r === 0) return save();
      if (r !== 1) return;
    }
    resetCanvas(640, 440);
    setFileId(null);
    setName('untitled');
    setDirty(false);
    undo.current = [];
  };

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === 'z') (e.preventDefault(), doUndo());
    else if (e.ctrlKey && k === 'y') (e.preventDefault(), doRedo());
    else if (e.ctrlKey && k === 's') (e.preventDefault(), save());
    else if (e.ctrlKey && k === 'o') (e.preventDefault(), setDialog('open'));
    else if (e.ctrlKey && k === 'n') (e.preventDefault(), newImage());
  };

  const menus = [
    { label: 'File', items: [
      { label: 'New', shortcut: 'Ctrl+N', onClick: newImage },
      { label: 'Open...', shortcut: 'Ctrl+O', onClick: () => setDialog('open') },
      { label: 'Save', shortcut: 'Ctrl+S', onClick: save },
      { label: 'Save As...', onClick: () => setDialog('save') },
      { sep: true },
      { label: 'Import Picture onto Canvas...', onClick: () => importRef.current?.click() },
      { label: 'Export to real computer (.png)...', onClick: download },
      { label: 'Set as Desktop Background', onClick: () => { setSettings({ wallpaper: { kind: 'image', value: canvasRef.current!.toDataURL('image/png'), fit: 'cover' } }); notify('Wallpaper', 'Your painting is the new desktop background.', { icon: 'palette', silent: true }); } },
      { sep: true },
      { label: 'Exit', onClick: () => win.close() },
    ] },
    { label: 'Edit', items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', onClick: doUndo },
      { label: 'Redo', shortcut: 'Ctrl+Y', onClick: doRedo },
      { sep: true },
      { label: 'Clear Image', onClick: () => { snapshot(); const g = ctx(); g.fillStyle = bg; g.fillRect(0, 0, dims.w, dims.h); setDirty(true); } },
    ] },
    { label: 'View', items: [1, 2, 4].map((z) => ({ label: `Zoom ${z * 100}%`, checked: zoom === z, onClick: () => setZoom(z) })) },
    { label: 'Image', items: [
      { label: 'Flip Horizontal', onClick: () => transform('fliph') },
      { label: 'Flip Vertical', onClick: () => transform('flipv') },
      { label: 'Rotate 90°', onClick: () => transform('rotate') },
      { label: 'Invert Colors', onClick: () => transform('invert') },
      { sep: true },
      { label: 'Attributes (canvas size)...', onClick: resize },
    ] },
    { label: 'Pixel Art', items: [
      { label: 'Pixel Art Mode', checked: px.on, onClick: () => setPx({ ...px, on: !px.on }) },
      { label: 'Pixel Size', items: PIXEL_SIZES.map((s) => ({ label: `${s} px  (${Math.floor(dims.w / s)}×${Math.floor(dims.h / s)})`, checked: px.cell === s, onClick: () => setPx({ ...px, cell: s }) })) },
      { label: 'Show Grid', checked: px.grid, onClick: () => setPx({ ...px, grid: !px.grid }) },
      { sep: true },
      { label: 'Pixelate Picture', onClick: pixelate },
      { label: 'Save Tiny PNG (one pixel per square)...', onClick: saveTiny },
    ] },
    { label: 'Colors', items: [
      { label: 'Edit Primary Color...', onClick: () => (document.getElementById('kp-fg-' + win.id) as HTMLInputElement)?.click() },
      { label: 'Swap Colors', onClick: () => (setFg(bg), setBg(fg)) },
      { sep: true },
      { label: 'Palette', items: Object.keys(PALETTES).map((p) => ({ label: p, checked: palName === p, onClick: () => setPalName(p) })) },
    ] },
    { label: 'Help', items: [{ label: 'About StarPaint', onClick: () => alertBox('StarPaint 2004\nLeft-click paints with the primary color, right-click with the secondary.\nHold Shift for perfect squares and circles.', 'About StarPaint', 'logo') }] },
  ];

  return (
    <div className="kp" onKeyDown={onKey} tabIndex={-1}>
      <MenuBar menus={menus} />
      <div className="kp-main">
        <div className="kp-tools">
          <div className="kp-toolgrid">
            {TOOLS.map((t) => (
              <button key={t.id} className={`kp-tool ${tool === t.id ? 'on' : ''}`} title={t.label} disabled={px.on && !PIXEL_TOOLS.includes(t.id)} onClick={() => setTool(t.id)}>{t.glyph}</button>
            ))}
            <button className={`kp-tool kp-pxbtn ${px.on ? 'on' : ''}`} title="Pixel Art Mode" onClick={() => setPx({ ...px, on: !px.on })}>{'▦'}</button>
          </div>
          <div className="kp-opts">
            {(tool === 'rect' || tool === 'ellipse') ? (
              (['outline', 'both', 'fill'] as const).map((f) => (
                <div key={f} className={`kp-opt ${shapeFill === f ? 'on' : ''}`} onClick={() => setShapeFill(f)} title={f}>
                  <div style={{ width: 28, height: 12, border: f !== 'fill' ? '1px solid #000' : 'none', background: f === 'outline' ? 'transparent' : '#888' }} />
                </div>
              ))
            ) : (
              [1, 2, 3, 5, 8].map((s) => (
                <div key={s} className={`kp-opt ${size === s ? 'on' : ''}`} onClick={() => setSize(s)} title={`Size ${s}`}>
                  <div style={{ width: 28, height: Math.min(10, s * 1.5), background: '#000', borderRadius: tool === 'brush' ? 5 : 0 }} />
                </div>
              ))
            )}
          </div>
        </div>
        <div className="kp-canvas-wrap" onContextMenu={(e) => e.preventDefault()} onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()} onDrop={(e) => { e.preventDefault(); drawImageFile([...e.dataTransfer.files].find((f) => f.type.startsWith('image/'))); }}>
          <div style={{ position: 'relative', width: dims.w * zoom, height: dims.h * zoom }} className="kp-canvas-box">
            <canvas ref={canvasRef} style={{ width: dims.w * zoom, height: dims.h * zoom }} onPointerDown={onDown} onPointerMove={(e) => setCursor(px.on ? cellOf(pt(e)) : pt(e))} onPointerLeave={() => setCursor(null)} className={`kp-canvas kp-c-${tool}`} />
            <canvas ref={overlayRef} style={{ position: 'absolute', left: 0, top: 0, width: dims.w * zoom, height: dims.h * zoom, pointerEvents: 'none' }} />
            <canvas ref={gridRef} style={{ position: 'absolute', left: 0, top: 0, width: dims.w * zoom, height: dims.h * zoom, pointerEvents: 'none' }} />
          </div>
          <input ref={importRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { drawImageFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>
      <div className="kp-palette">
        <div className="kp-current">
          <div className="kp-bg" style={{ background: bg }} title="Secondary (right-click)" onClick={() => (document.getElementById('kp-bg-' + win.id) as HTMLInputElement)?.click()} />
          <div className="kp-fg" style={{ background: fg }} title="Primary (left-click)" onClick={() => (document.getElementById('kp-fg-' + win.id) as HTMLInputElement)?.click()} />
          <input id={'kp-fg-' + win.id} type="color" value={fg} onChange={(e) => setFg(e.target.value)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          <input id={'kp-bg-' + win.id} type="color" value={bg} onChange={(e) => setBg(e.target.value)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
        </div>
        <div className="kp-swatches">
          {PALETTES[palName].map((c) => (
            <div key={c} className="kp-sw" style={{ background: c }} onPointerDown={(e) => (e.button === 2 ? setBg(c) : setFg(c))} onContextMenu={(e) => e.preventDefault()} />
          ))}
        </div>
      </div>
      <div className="k-status">
        <div style={{ flex: 1 }}>{TOOLS.find((t) => t.id === tool)?.label}. Left-click: primary color, right-click: secondary.</div>
        <div style={{ width: 90 }}>{cursor ? `${cursor.x},${cursor.y}` : ''}</div>
        <div style={{ width: 90 }}>{dims.w}x{dims.h}</div>
      </div>
      {dialog && (
        <FileDialog
          mode={dialog}
          exts={['kpx', 'png', 'bmp', 'jpg', 'jpeg', 'gif', 'webp', 'pice']}
          filterLabel="Pictures (*.kpx, *.png, *.jpg, *.gif ...)"
          defaultName={dialog === 'save' ? (name === 'untitled' ? 'untitled.kpx' : name) : ''}
          startDir={fileId ? fs.get(fileId)?.parent ?? undefined : fs.resolve('~\\My Pictures')?.id}
          onDone={(r) => {
            const mode = dialog;
            setDialog(null);
            if (!r) {
              afterSave.current?.(false);
              afterSave.current = null;
              return;
            }
            if (mode === 'open') return r.node && loadFile(r.node.id);
            try {
              const node = r.node ?? fs.create(r.dirId, r.name, 'file', '');
              writeTo(node.id);
              setFileId(node.id);
              setName(node.name);
              setDirty(false);
              notifySaved(node.name);
              afterSave.current?.(true);
            } catch (e) {
              errorBox((e as Error).message, 'Save As');
              afterSave.current?.(false);
            }
            afterSave.current = null;
          }}
        />
      )}
    </div>
  );
}
