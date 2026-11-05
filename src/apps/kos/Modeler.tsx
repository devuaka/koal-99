// Modeler: build simple 3D scenes from shapes. Software-rendered on a canvas (painter's algorithm).
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import * as fs from '../../core/fs';
import { MenuBar } from '../../ui/MenuBar';
import { FileDialog } from '../../ui/FileDialog';
import { confirmBox, errorBox, alertBox } from '../../core/dialog';
import { notifySaved } from '../../core/launcher';
import { documentsDir } from '../../core/session';

type V3 = [number, number, number];
type Kind = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'torus';
interface Obj {
  id: number;
  k: Kind;
  p: V3;
  r: V3;
  s: V3;
  c: string;
}
interface Scene {
  next: number;
  objs: Obj[];
}

const AUTOSAVE = 'koalos.model';
const KINDS: [Kind, string, number][] = [['cube', 'Cube', 1], ['sphere', 'Sphere', 1], ['cylinder', 'Cylinder', 1], ['cone', 'Cone', 1], ['pyramid', 'Pyramid', 1], ['torus', 'Torus', 0.4]];
const D = Math.PI / 180;

const meshCache: Partial<Record<Kind, { v: V3[]; f: number[][] }>> = {};
function meshFor(k: Kind) {
  if (meshCache[k]) return meshCache[k]!;
  const v: V3[] = [];
  const f: number[][] = [];
  const n = 20;
  if (k === 'cube') {
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
    f.push([0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]);
  } else if (k === 'pyramid') {
    v.push([-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [0, 1, 0]);
    f.push([0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]);
  } else if (k === 'cylinder') {
    for (const y of [-1, 1]) for (let i = 0; i < n; i++) v.push([Math.cos((2 * Math.PI * i) / n), y, Math.sin((2 * Math.PI * i) / n)]);
    for (let i = 0; i < n; i++) f.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
    f.push([...Array(n).keys()], [...Array(n).keys()].map((i) => n + i));
  } else if (k === 'cone') {
    for (let i = 0; i < n; i++) v.push([Math.cos((2 * Math.PI * i) / n), -1, Math.sin((2 * Math.PI * i) / n)]);
    v.push([0, 1, 0]);
    for (let i = 0; i < n; i++) f.push([i, (i + 1) % n, n]);
    f.push([...Array(n).keys()]);
  } else if (k === 'sphere') {
    const lat = 10, lon = 16;
    for (let i = 0; i <= lat; i++)
      for (let j = 0; j < lon; j++) {
        const th = (Math.PI * i) / lat, ph = (2 * Math.PI * j) / lon;
        v.push([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]);
      }
    for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) f.push([i * lon + j, i * lon + ((j + 1) % lon), (i + 1) * lon + ((j + 1) % lon), (i + 1) * lon + j]);
  } else {
    const U = 24, Vn = 12, R = 1, r = 0.4;
    for (let i = 0; i < U; i++)
      for (let j = 0; j < Vn; j++) {
        const u = (2 * Math.PI * i) / U, t = (2 * Math.PI * j) / Vn;
        v.push([(R + r * Math.cos(t)) * Math.cos(u), r * Math.sin(t), (R + r * Math.cos(t)) * Math.sin(u)]);
      }
    for (let i = 0; i < U; i++) for (let j = 0; j < Vn; j++) f.push([i * Vn + j, ((i + 1) % U) * Vn + j, ((i + 1) % U) * Vn + ((j + 1) % Vn), i * Vn + ((j + 1) % Vn)]);
  }
  return (meshCache[k] = { v, f });
}

function xf(o: Obj, p: V3): V3 {
  let x = p[0] * o.s[0], y = p[1] * o.s[1], z = p[2] * o.s[2], c: number, s: number;
  (c = Math.cos(o.r[0] * D)), (s = Math.sin(o.r[0] * D));
  [y, z] = [y * c - z * s, y * s + z * c];
  (c = Math.cos(o.r[1] * D)), (s = Math.sin(o.r[1] * D));
  [x, z] = [x * c + z * s, -x * s + z * c];
  (c = Math.cos(o.r[2] * D)), (s = Math.sin(o.r[2] * D));
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x + o.p[0], y + o.p[1], z + o.p[2]];
}

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
const defaultScene = (): Scene => ({ next: 2, objs: [{ id: 1, k: 'cube', p: [0, 1, 0], r: [0, 25, 0], s: [1, 1, 1], c: '#2f8ae6' }] });

export function toObj(scene: Scene): string {
  let out = '# KOAL-99 Modeler\n';
  let off = 0;
  scene.objs.forEach((o, i) => {
    const m = meshFor(o.k);
    out += `o ${o.k}${i + 1}\n`;
    m.v.forEach((p) => (out += 'v ' + xf(o, p).map((x) => x.toFixed(4)).join(' ') + '\n'));
    m.f.forEach((f) => (out += 'f ' + f.map((j) => j + 1 + off).join(' ') + '\n'));
    off += m.v.length;
  });
  return out;
}

export function Modeler({ win }: { win: WinCtx }) {
  const [scene, setScene] = useState<Scene>(() => {
    const n = win.props.fileId ? fs.get(win.props.fileId) : undefined;
    try {
      const s = JSON.parse(n ? n.content : localStorage.getItem(AUTOSAVE) ?? '');
      if (Array.isArray(s?.objs)) return s;
    } catch {
      /* fall through */
    }
    return defaultScene();
  });
  const [fileId, setFileId] = useState<string | null>(win.props.fileId ?? null);
  const [sel, setSel] = useState<number | null>(null);
  const [wire, setWire] = useState(false);
  const [dlg, setDlg] = useState<null | 'open' | 'save' | 'obj'>(null);
  const cam = useRef({ yaw: 0.7, pitch: 0.5, dist: 10 });
  const cv = useRef<HTMLCanvasElement>(null);
  const faces = useRef<{ o: number; P: V3[] }[]>([]);
  const size = useRef({ W: 600, H: 400 });
  const cur = scene.objs.find((o) => o.id === sel);

  useEffect(() => {
    try {
      localStorage.setItem(AUTOSAVE, JSON.stringify(scene));
    } catch {
      /* ignore */
    }
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, sel, wire]);
  useEffect(() => {
    win.setTitle(`${fileId ? fs.get(fileId)?.name ?? 'scene' : 'untitled'} - Modeler`);
  }, [fileId]);
  useEffect(() => {
    const el = cv.current!.parentElement!;
    const ro = new ResizeObserver(() => {
      // clientWidth/Height ignore CSS transforms, so the window's zoom-in animation can't shrink the canvas.
      size.current = { W: Math.max(200, el.clientWidth), H: Math.max(150, el.clientHeight) };
      cv.current!.width = size.current.W;
      cv.current!.height = size.current.H;
      draw();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const project = (p: V3): V3 => {
    const { yaw, pitch, dist } = cam.current;
    const { W, H } = size.current;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = cy * p[0] - sy * p[2], z1 = sy * p[0] + cy * p[2], y1 = cp * p[1] + sp * z1, z2 = -sp * p[1] + cp * z1;
    const d = dist + z2, f = Math.min(W, H) * 0.9;
    return [W / 2 + (x1 * f) / d, H / 2 - (y1 * f) / d, d];
  };

  function draw() {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    const { W, H } = size.current;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#bfe0ff');
    gr.addColorStop(1, '#f4faff');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    const line = (a: V3, b: V3, col: string, wd: number) => {
      const p = project(a), q = project(b);
      if (p[2] < 0.3 || q[2] < 0.3) return;
      g.strokeStyle = col;
      g.lineWidth = wd;
      g.beginPath();
      g.moveTo(p[0], p[1]);
      g.lineTo(q[0], q[1]);
      g.stroke();
    };
    for (let i = -6; i <= 6; i++) {
      line([i, 0, -6], [i, 0, 6], i ? '#a9c2e0' : '#e5352a', i ? 1 : 1.5);
      line([-6, 0, i], [6, 0, i], i ? '#a9c2e0' : '#2f76e0', i ? 1 : 1.5);
    }
    const list: { o: number; P: V3[]; d: number; col: string; raw: string }[] = [];
    for (const o of scene.objs) {
      const m = meshFor(o.k);
      const wv = m.v.map((p) => xf(o, p));
      const pv = wv.map(project);
      const rgb = hexRgb(o.c);
      for (const f of m.f) {
        const P = f.map((i) => pv[i]);
        if (P.some((q) => q[2] < 0.3)) continue;
        let nx = 0, ny = 0, nz = 0;
        for (let i = 0; i < f.length; i++) {
          const a = wv[f[i]], cc = wv[f[(i + 1) % f.length]];
          nx += (a[1] - cc[1]) * (a[2] + cc[2]);
          ny += (a[2] - cc[2]) * (a[0] + cc[0]);
          nz += (a[0] - cc[0]) * (a[1] + cc[1]);
        }
        const l = Math.hypot(nx, ny, nz) || 1;
        const k = 0.35 + 0.65 * Math.abs((nx * 0.4 + ny * 0.8 + nz * 0.5) / l / 1.0247);
        list.push({ o: o.id, P, d: P.reduce((s, q) => s + q[2], 0) / P.length, col: `rgb(${rgb.map((x) => Math.round(x * k)).join(',')})`, raw: o.c });
      }
    }
    list.sort((a, b) => b.d - a.d);
    for (const fc of list) {
      g.beginPath();
      fc.P.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
      g.closePath();
      if (!wire) {
        g.fillStyle = fc.col;
        g.fill();
      }
      g.strokeStyle = fc.o === sel ? '#ffb300' : wire ? fc.raw : 'rgba(0,0,0,.28)';
      g.lineWidth = fc.o === sel ? 2 : 1;
      g.stroke();
    }
    faces.current = list;
  }

  const pick = (x: number, y: number) => {
    const inPoly = (P: V3[]) => {
      let c = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (P[i][1] > y !== P[j][1] > y && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
      return c;
    };
    for (let i = faces.current.length - 1; i >= 0; i--) if (inPoly(faces.current[i].P)) return faces.current[i].o;
    return null;
  };

  const update = (fn: (o: Obj) => void) => {
    if (!cur) return;
    setScene((s) => ({ ...s, objs: s.objs.map((o) => (o.id === cur.id ? (() => { const c = JSON.parse(JSON.stringify(o)) as Obj; fn(c); return c; })() : o)) }));
  };
  const add = (k: Kind, y: number) => {
    const o: Obj = { id: scene.next, k, p: [(Math.random() - 0.5) * 3, y, (Math.random() - 0.5) * 3], r: [0, 0, 0], s: [1, 1, 1], c: '#' + [0, 0, 0].map(() => (90 + Math.floor(Math.random() * 140)).toString(16)).join('') };
    setScene({ next: scene.next + 1, objs: [...scene.objs, o] });
    setSel(o.id);
  };
  const del = () => {
    if (!sel) return;
    setScene({ ...scene, objs: scene.objs.filter((o) => o.id !== sel) });
    setSel(null);
  };
  const dup = () => {
    if (!cur) return;
    const c = JSON.parse(JSON.stringify(cur)) as Obj;
    c.id = scene.next;
    c.p[0] += 0.6;
    c.p[2] += 0.6;
    setScene({ next: scene.next + 1, objs: [...scene.objs, c] });
    setSel(c.id);
  };

  const drag = useRef<{ x: number; y: number; moved: boolean; mode: 'orbit' | 'move' } | null>(null);
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const hit = pick(e.clientX - r.left, e.clientY - r.top);
    drag.current = { x: e.clientX, y: e.clientY, moved: false, mode: hit ? 'move' : 'orbit' };
    if (hit) setSel(hit);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    if (dx || dy) d.moved = true;
    const c = cam.current;
    if (d.mode === 'orbit') {
      c.yaw -= dx * 0.01;
      c.pitch = Math.max(-0.1, Math.min(1.45, c.pitch + dy * 0.01));
      draw();
    } else {
      const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), k = c.dist / (Math.min(size.current.W, size.current.H) * 0.9), kf = (-dy * k) / Math.max(0.3, Math.sin(c.pitch));
      update((o) => {
        o.p[0] += dx * k * cy + kf * sy;
        o.p[2] += -dx * k * sy + kf * cy;
      });
    }
  };
  const onUp = () => {
    if (drag.current?.mode === 'orbit' && !drag.current.moved) setSel(null);
    drag.current = null;
  };

  const saveTo = (id: string) => {
    fs.write(id, JSON.stringify(scene));
    notifySaved(fs.get(id)?.name ?? 'scene');
  };

  const ROWS: [string, 'p' | 'r' | 's', number, number, number, number][] = [
    ['Move X', 'p', 0, -6, 6, 0.05], ['Move Y', 'p', 1, -6, 6, 0.05], ['Move Z', 'p', 2, -6, 6, 0.05],
    ['Rotate X', 'r', 0, 0, 360, 1], ['Rotate Y', 'r', 1, 0, 360, 1], ['Rotate Z', 'r', 2, 0, 360, 1],
    ['Scale X', 's', 0, 0.1, 4, 0.05], ['Scale Y', 's', 1, 0.1, 4, 0.05], ['Scale Z', 's', 2, 0.1, 4, 0.05],
  ];

  return (
    <div className="mdl">
      <MenuBar menus={[
        { label: 'File', items: [
          { label: 'New Scene', onClick: async () => { if (await confirmBox('Start a new, empty scene?', 'Modeler')) { setScene({ next: 1, objs: [] }); setFileId(null); setSel(null); } } },
          { label: 'Open...', onClick: () => setDlg('open') },
          { label: 'Save', onClick: () => (fileId && fs.get(fileId) ? saveTo(fileId) : setDlg('save')) },
          { label: 'Save As...', onClick: () => setDlg('save') },
          { sep: true },
          { label: 'Export .obj to KOAL-99...', onClick: () => setDlg('obj') },
          { label: 'Export .obj to my real computer', onClick: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([toObj(scene)], { type: 'text/plain' })); a.download = 'model.obj'; a.click(); } },
          { sep: true },
          { label: 'Close', onClick: () => win.close() },
        ] },
        { label: 'Help', items: [{ label: 'About Modeler', onClick: () => alertBox('Modeler\n\nDrag empty space to orbit, drag an object to move it, scroll to zoom. Delete removes the selected object.', 'Modeler', 'model') }] },
      ]} />
      <div className="k-toolbar">
        <span className="mdl-lab">Add:</span>
        {KINDS.map(([k, n, y]) => <button key={k} className="k-tool" onClick={() => add(k, y)}>{n}</button>)}
        <div className="k-tool-sep" />
        <button className="k-tool" disabled={!cur} onClick={dup}>Duplicate</button>
        <button className="k-tool" disabled={!cur} onClick={del}>Delete</button>
        <div className="k-tool-sep" />
        <button className={`k-tool ${wire ? 'on' : ''}`} onClick={() => setWire(!wire)}>Wireframe</button>
        <button className="k-tool" onClick={() => { cam.current = { yaw: 0.7, pitch: 0.5, dist: 10 }; draw(); }}>Reset view</button>
        <button className="k-tool" onClick={async () => { if (scene.objs.length && (await confirmBox('Remove every object from the scene?', 'Modeler'))) { setScene({ ...scene, objs: [] }); setSel(null); } }}>Clear all</button>
      </div>
      <div className="mdl-main">
        <div className="mdl-cv">
          <canvas ref={cv} tabIndex={0} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={(e) => { cam.current.dist = Math.max(3, Math.min(30, cam.current.dist * (1 + Math.sign(e.deltaY) * 0.1))); draw(); }} onKeyDown={(e) => e.key === 'Delete' && del()} />
        </div>
        <div className="mdl-side">
          {!cur ? (
            <div className="mdl-none">Click an object to edit it.<br />Add shapes with the buttons above.<br /><br />{scene.objs.length} object(s) in the scene.</div>
          ) : (
            <>
              <b>{cur.k[0].toUpperCase() + cur.k.slice(1)} #{cur.id}</b>
              <label className="mdl-row"><span>Colour</span><input type="color" value={cur.c} onChange={(e) => update((o) => (o.c = e.target.value))} /></label>
              {ROWS.map(([name, key, i, min, max, step]) => (
                <label key={name} className="mdl-row">
                  <span>{name}</span>
                  <input type="range" min={min} max={max} step={step} value={cur[key][i]} onChange={(e) => update((o) => (o[key][i] = +e.target.value))} />
                  <em>{cur[key][i].toFixed(key === 'r' ? 0 : 2)}</em>
                </label>
              ))}
            </>
          )}
        </div>
      </div>
      <div className="k-status"><div style={{ flex: 1 }}>Drag empty space: orbit {'·'} drag an object: move it {'·'} wheel: zoom {'·'} saves automatically</div></div>
      {dlg && (
        <FileDialog
          mode={dlg === 'open' ? 'open' : 'save'}
          exts={dlg === 'obj' ? ['obj'] : ['k3d']}
          filterLabel={dlg === 'obj' ? 'Wavefront OBJ (*.obj)' : 'Modeler scenes (*.k3d)'}
          defaultName={dlg === 'obj' ? 'model.obj' : dlg === 'save' ? fs.get(fileId ?? '')?.name ?? 'scene.k3d' : ''}
          startDir={documentsDir().id}
          onDone={(r) => {
            const mode = dlg;
            setDlg(null);
            if (!r) return;
            try {
              if (mode === 'open') {
                const s = JSON.parse(r.node?.content ?? '');
                if (!Array.isArray(s?.objs)) throw new Error('That file is not a Modeler scene.');
                setScene(s);
                setFileId(r.node!.id);
                setSel(null);
                return;
              }
              const n = r.node ?? fs.create(r.dirId, r.name, 'file', '');
              if (mode === 'obj') {
                fs.write(n.id, toObj(scene));
                notifySaved(n.name);
              } else {
                saveTo(n.id);
                setFileId(n.id);
              }
            } catch (e) {
              errorBox((e as Error).message, 'Modeler');
            }
          }}
        />
      )}
    </div>
  );
}
