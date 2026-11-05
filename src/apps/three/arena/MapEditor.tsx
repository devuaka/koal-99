// Arena 3D map editor: draw walls from above, set their height and colour, place spawn points.
// Saved maps join the random rotation and the vote after each match.
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../../core/registry';
import { openApp } from '../../../core/wm';
import { confirmBox } from '../../../core/dialog';
import { Box, CustomMap, MAP_NAMES, RGB, customMaps, saveCustomMaps } from './data';

const COLORS: RGB[] = [[0.5, 0.56, 0.68], [0.62, 0.48, 0.32], [0.55, 0.62, 0.78], [0.3, 0.34, 0.5], [0.6, 0.3, 0.3], [0.3, 0.55, 0.35], [0.6, 0.55, 0.2], [0.4, 0.4, 0.44]];
const rgb = (c: RGB) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
const WORLD = 23, SIZE = 520;

export function ArenaMapEditor({ win }: { win: WinCtx }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState('');
  const [h, setH] = useState(2);
  const [col, setCol] = useState<RGB>(COLORS[0]);
  const [spawnMode, setSpawnMode] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [spawns, setSpawns] = useState<number[][]>([]);
  const [maps, setMaps] = useState<CustomMap[]>(customMaps);
  const [sel, setSel] = useState('');
  const [msg, setMsg] = useState('');
  const view = useRef({ x: 0, z: 0, zoom: 1 });
  const drag = useRef<{ x0: number; z0: number; x1: number; z1: number } | null>(null);
  const pan = useRef<number[] | null>(null);
  const [, redraw] = useState(0);

  const sc = () => (SIZE / (WORLD * 2)) * view.current.zoom;
  const w2x = (x: number) => SIZE / 2 + (x - view.current.x) * sc(), w2z = (z: number) => SIZE / 2 + (z - view.current.z) * sc();
  const snap = (v: number) => Math.round(v * 2) / 2;
  const evPos = (e: { clientX: number; clientY: number }) => {
    const r = cv.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) * SIZE) / r.width, sy = ((e.clientY - r.top) * SIZE) / r.height;
    return [snap(view.current.x + (sx - SIZE / 2) / sc()), snap(view.current.z + (sy - SIZE / 2) / sc())];
  };

  useEffect(() => {
    const g = cv.current!.getContext('2d')!;
    g.fillStyle = '#16213a';
    g.fillRect(0, 0, SIZE, SIZE);
    g.strokeStyle = 'rgba(160,200,255,.1)';
    for (let v = -WORLD; v <= WORLD; v += 2) {
      g.beginPath();
      g.moveTo(w2x(v), 0);
      g.lineTo(w2x(v), SIZE);
      g.moveTo(0, w2z(v));
      g.lineTo(SIZE, w2z(v));
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,120,120,.6)';
    g.strokeRect(w2x(-21.3), w2z(-21.3), 42.6 * sc(), 42.6 * sc());
    for (const b of boxes) {
      const x0 = w2x(b.x - b.w / 2), z0 = w2z(b.z - b.d / 2);
      g.fillStyle = rgb(b.col);
      g.fillRect(x0, z0, b.w * sc(), b.d * sc());
      g.fillStyle = 'rgba(255,255,255,.25)';
      g.fillRect(x0, z0, b.w * sc(), Math.min(4, b.d * sc()));
      g.strokeStyle = 'rgba(0,0,0,.55)';
      g.strokeRect(x0, z0, b.w * sc(), b.d * sc());
      if (b.w * sc() > 22 && b.d * sc() > 14) {
        g.fillStyle = 'rgba(255,255,255,.85)';
        g.font = '10px Segoe UI';
        g.textAlign = 'center';
        g.fillText(b.top.toFixed(1), w2x(b.x), w2z(b.z) + 3);
      }
    }
    spawns.forEach((s, i) => {
      g.beginPath();
      g.arc(w2x(s[0]), w2z(s[1]), 8, 0, Math.PI * 2);
      g.fillStyle = '#5fd68a';
      g.fill();
      g.strokeStyle = '#0a2a15';
      g.lineWidth = 2;
      g.stroke();
      g.lineWidth = 1;
      g.fillStyle = '#0a2a15';
      g.font = 'bold 10px Segoe UI';
      g.textAlign = 'center';
      g.fillText(String(i + 1), w2x(s[0]), w2z(s[1]) + 3);
    });
    const d = drag.current;
    if (d) {
      g.fillStyle = 'rgba(255,255,255,.28)';
      g.fillRect(Math.min(w2x(d.x0), w2x(d.x1)), Math.min(w2z(d.z0), w2z(d.z1)), Math.abs(w2x(d.x1) - w2x(d.x0)), Math.abs(w2z(d.z1) - w2z(d.z0)));
    }
  });

  useEffect(() => {
    const mv = (e: MouseEvent) => {
      if (pan.current) {
        view.current.x -= (e.clientX - pan.current[0]) / sc();
        view.current.z -= (e.clientY - pan.current[1]) / sc();
        pan.current = [e.clientX, e.clientY];
        return redraw((x) => x + 1);
      }
      if (!drag.current) return;
      const [x, z] = evPos(e);
      drag.current.x1 = x;
      drag.current.z1 = z;
      redraw((x2) => x2 + 1);
    };
    const up = () => {
      if (pan.current) return void (pan.current = null);
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      const w = Math.abs(d.x1 - d.x0), dd = Math.abs(d.z1 - d.z0);
      if (w >= 0.5 && dd >= 0.5) setBoxes((b) => [...b, { x: (d.x0 + d.x1) / 2, z: (d.z0 + d.z1) / 2, w, d: dd, y: 0, top: h, col }]);
      else redraw((x) => x + 1);
    };
    addEventListener('mousemove', mv);
    addEventListener('mouseup', up);
    return () => (removeEventListener('mousemove', mv), removeEventListener('mouseup', up));
  });

  const load = (nm: string) => {
    setSel(nm);
    const m = customMaps().find((x) => x.name === nm);
    setName(m?.name ?? '');
    setBoxes(m ? JSON.parse(JSON.stringify(m.boxes)) : []);
    setSpawns(m ? JSON.parse(JSON.stringify(m.spawns || [])) : []);
  };
  const save = () => {
    const nm = name.trim();
    if (!nm) return setMsg('Type a map name first.'), -1;
    if (!boxes.length) return setMsg('Place at least one wall.'), -1;
    const list = customMaps(), i = list.findIndex((m) => m.name === nm), entry = { name: nm, boxes, spawns };
    if (i >= 0) list[i] = entry;
    else list.push(entry);
    saveCustomMaps(list);
    setMaps(list);
    setSel(nm);
    setMsg('Saved!');
    return list.findIndex((m) => m.name === nm);
  };

  return (
    <div className="arm-ed">
      <div className="arm-side">
        <label>Map name<input className="k-input" maxLength={20} placeholder="My Map" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Wall height <b>{h.toFixed(1)} m</b><input type="range" min={0.5} max={6} step={0.5} value={h} onChange={(e) => setH(+e.target.value)} /></label>
        <div className="arm-cols">{COLORS.map((c, i) => <i key={i} className={c === col ? 'on' : ''} style={{ background: rgb(c) }} onClick={() => setCol(c)} />)}</div>
        <div className="r3-btns">
          <button className={'k-btn' + (!spawnMode ? ' default' : '')} onClick={() => setSpawnMode(false)}>Place walls</button>
          <button className={'k-btn' + (spawnMode ? ' default' : '')} onClick={() => setSpawnMode(true)}>Place spawns</button>
        </div>
        <div className="r3-btns">
          <button className="k-btn" onClick={() => (spawnMode ? setSpawns((s) => s.slice(0, -1)) : setBoxes((b) => b.slice(0, -1)))}>Undo</button>
          <button className="k-btn" onClick={async () => (!boxes.length && !spawns.length) || ((await confirmBox('Clear every wall and spawn point?', 'Map Editor')) && (setBoxes([]), setSpawns([])))}>Clear</button>
          <button className="k-btn" onClick={() => ((view.current = { x: 0, z: 0, zoom: 1 }), redraw((x) => x + 1))}>Reset view</button>
        </div>
        <div className="r3-btns">
          <button className="k-btn default" onClick={save}>Save map</button>
          <button
            className="k-btn"
            onClick={() => {
              const i = save();
              if (i < 0) return;
              openApp('karena', { forceMap: MAP_NAMES.length + i, practice: true });
            }}
          >
            Test play
          </button>
        </div>
        <label>Saved maps
          <select value={sel} onChange={(e) => load(e.target.value)}>
            <option value="">(new map)</option>
            {maps.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </label>
        <button
          className="k-btn"
          disabled={!sel}
          onClick={async () => {
            if (!sel || !(await confirmBox(`Delete "${sel}"?`, 'Map Editor'))) return;
            const l = customMaps().filter((m) => m.name !== sel);
            saveCustomMaps(l);
            setMaps(l);
            load('');
            setMsg('Deleted.');
          }}
        >
          Delete selected
        </button>
        <div className="arm-list">
          <b>Walls</b>
          {!boxes.length && <small>No walls yet.</small>}
          {boxes.map((b, i) => (
            <div key={i} className="arm-row">
              <span>Wall {i + 1} ({b.w.toFixed(1)} x {b.d.toFixed(1)})</span>
              <input type="number" min={0.5} max={12} step={0.5} value={b.top} onChange={(e) => +e.target.value > 0 && setBoxes((bs) => bs.map((x, j) => (j === i ? { ...x, top: +e.target.value } : x)))} />
              <button className="k-btn" onClick={() => setBoxes((bs) => bs.filter((_, j) => j !== i))}>{'×'}</button>
            </div>
          ))}
          <b>Spawn points</b>
          {!spawns.length && <small>None: the built-in spawn points are used.</small>}
          {spawns.map((s, i) => (
            <div key={i} className="arm-row">
              <span>Spawn {i + 1} ({s[0].toFixed(1)}, {s[1].toFixed(1)})</span>
              <button className="k-btn" onClick={() => setSpawns((ss) => ss.filter((_, j) => j !== i))}>{'×'}</button>
            </div>
          ))}
        </div>
        <small className="arm-msg">{msg}</small>
        <small>Drag to draw a wall (or click to add or remove a spawn). Middle-drag pans, scroll zooms. The outer walls are added for you.</small>
      </div>
      <canvas
        ref={cv}
        width={SIZE}
        height={SIZE}
        className="arm-cv"
        onContextMenu={(e) => e.preventDefault()}
        onWheel={(e) => {
          view.current.zoom = Math.max(0.3, Math.min(4, view.current.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
          redraw((x) => x + 1);
        }}
        onMouseDown={(e) => {
          if (e.button === 1) return e.preventDefault(), void (pan.current = [e.clientX, e.clientY]);
          if (e.button !== 0) return;
          const [x, z] = evPos(e);
          if (spawnMode) {
            const i = spawns.findIndex((s) => Math.hypot(s[0] - x, s[1] - z) < 1);
            setSpawns((s) => (i >= 0 ? s.filter((_, j) => j !== i) : [...s, [x, z]]));
            return;
          }
          drag.current = { x0: x, z0: z, x1: x, z1: z };
          redraw((v) => v + 1);
        }}
      />
      <span hidden>{win.id}</span>
    </div>
  );
}
