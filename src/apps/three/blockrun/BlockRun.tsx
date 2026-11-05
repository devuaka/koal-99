// Block Run, remade: a voxel sandbox with real lighting (sun + soft shadows), a sky with clouds,
// detailed blocks, a held-block viewmodel, break particles, Starling players and shared multiplayer worlds.
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../../core/registry';
import { KoalRoom, RoomDirectory, RoomInfo } from '../../../core/net';
import { createStage, THREE } from '../engine';
import { Character, blobShadow } from '../models';
import { Look } from '../r3';
import { reportHosted } from '../../../core/invites';
import { BLOCKS, CH, H, HOT, OPQ, SEA, SOLID, isoIcon, makeAtlas, meshChunk, paintTile, terrain, tileColor, MeshData } from './world';

const SAVE_KEY = 'koalos.blockrun', PIX_KEY = 'koalos.blockrun.custompix', NAME_KEY = 'koalos.brname';
const FACES = ['top', 'side', 'bottom'] as const;
type Face = (typeof FACES)[number];
type Pix = Record<Face, string[]>;
const R = 5;
const PLAYER_COLORS = ['#e84a4a', '#3d8fe8', '#38c172', '#f2b33a'];

const unpackPix = (v: any): string[] | null => (Array.isArray(v) ? v : v?.p && v?.i ? v.i.split(',').map((s: string) => v.p[parseInt(s, 36)]) : null);
const packPix = (a: string[]) => {
  const pal = [...new Set(a)];
  return { p: pal, i: a.map((c) => pal.indexOf(c).toString(36)).join(',') };
};
function loadPix(): Pix {
  const out = { top: [], side: [], bottom: [] } as unknown as Pix;
  let s: any = null;
  try {
    s = JSON.parse(localStorage.getItem(PIX_KEY) || 'null');
  } catch {
    /* ignore */
  }
  FACES.forEach((f) => {
    const u = unpackPix(s?.[f]);
    out[f] = u && u.length === 256 ? u : Array(256).fill('#8a5a3c');
  });
  return out;
}

export function BlockRun({ win }: { win: WinCtx }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const water = useRef<HTMLDivElement>(null);
  const tags = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(true);
  const [editor, setEditor] = useState(false);
  const [sel, setSel] = useState(0);
  const [icons, setIcons] = useState<string[]>([]);
  const [mp, setMp] = useState({ msg: 'Play together: host shares a room code, your friend joins with it. Hosting shares your current world.', inRoom: false, code: '' });
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [armed, setArmed] = useState(false);
  const [err, setErr] = useState('');
  const api = useRef<any>(null);
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    const c = cv.current!;
    const st = createStage(c, { shadows: true, bloom: 0.3, fov: 70, near: 0.08, far: 420, env: 0.45 });
    if (!st) return void setErr('Block Run needs WebGL, which your browser has turned off.');
    const { scene, camera } = st;
    scene.add(camera);

    // ---- sky, sun, clouds ----
    const SKY_TOP = new THREE.Color('#2f7fe0'), SKY_H = new THREE.Color('#cfe8ff');
    scene.fog = new THREE.Fog(SKY_H, R * CH * 0.55, R * CH * 0.95);
    scene.background = SKY_H;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(380, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: SKY_TOP }, hor: { value: SKY_H } },
        vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: 'uniform vec3 top;uniform vec3 hor;varying vec3 vP;void main(){float t=clamp(vP.y*1.6,0.,1.);gl_FragColor=vec4(mix(hor,top,pow(t,.8)),1.);}',
      }),
    );
    sky.renderOrder = -10;
    scene.add(sky);
    const sunDir = new THREE.Vector3(0.45, 0.8, 0.3).normalize();
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 1.7), toneMapped: false, fog: false, depthWrite: false }));
    scene.add(sunDisc);
    scene.add(new THREE.HemisphereLight('#cfe9ff', '#6b5a3a', 1.0));
    scene.add(new THREE.AmbientLight('#ffffff', 0.25));
    const sun = new THREE.DirectionalLight('#fff3d6', 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 220 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.05;
    scene.add(sun, sun.target);
    const clouds = new THREE.Group();
    const cloudM = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, fog: false });
    for (let i = 0; i < 26; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 3 + (i % 3); k++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(10 + ((i * 7 + k * 5) % 14), 3, 8 + ((i * 3 + k * 11) % 10)), cloudM);
        m.position.set(k * 7 - 7, (k % 2) * 1.2, ((k * 13) % 9) - 4);
        g.add(m);
      }
      g.position.set(((i * 97) % 400) - 200, 92 + (i % 4) * 3, ((i * 61) % 400) - 200);
      clouds.add(g);
    }
    scene.add(clouds);

    // ---- atlas + materials ----
    const atlas = makeAtlas();
    let pix = loadPix();
    const applyPix = () => {
      paintTile(atlas, 13, pix.top);
      paintTile(atlas, 14, pix.bottom);
      paintTile(atlas, 15, pix.side);
      atlasTex.needsUpdate = true;
      setIcons(HOT.map((id) => isoIcon(atlas, id)));
      tileCols = Array.from({ length: 16 }, (_, i) => tileColor(atlas, i));
    };
    const atlasTex = new THREE.CanvasTexture(atlas);
    atlasTex.colorSpace = THREE.SRGBColorSpace;
    atlasTex.magFilter = THREE.NearestFilter;
    atlasTex.minFilter = THREE.NearestMipmapLinearFilter;
    atlasTex.anisotropy = 4;
    let tileCols: [number, number, number][] = [];
    const opaqueM = new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5 });
    const glowM = new THREE.MeshBasicMaterial({ map: atlasTex, color: new THREE.Color(1.7, 1.55, 1.3), toneMapped: false });
    const transM = new THREE.MeshPhongMaterial({ map: atlasTex, vertexColors: true, transparent: true, depthWrite: false, shininess: 90, specular: new THREE.Color('#ffffff') });
    applyPix();

    // ---- world state ----
    let save: any = {};
    try {
      save = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {};
    } catch {
      /* ignore */
    }
    let seed: number = save.seed || 1 + Math.floor(Math.random() * 1e6);
    let gen = terrain(seed);
    const edits = new Map<string, number>(), editsByChunk = new Map<number, Map<number, number>>();
    const ckey = (cx: number, cz: number) => (cx & 0xffff) * 65536 + (cz & 0xffff);
    const addEdit = (x: number, y: number, z: number, id: number, record = true) => {
      if (record) edits.set(x + ',' + y + ',' + z, id);
      const k = ckey(x >> 4, z >> 4);
      let m = editsByChunk.get(k);
      if (!m) editsByChunk.set(k, (m = new Map()));
      m.set((y * 16 + (z & 15)) * 16 + (x & 15), id);
    };
    const decodeEdits = (e: any): number[][] => (!e ? [] : typeof e === 'string' ? e.split(';').filter(Boolean).map((s) => s.split(',').map(Number)) : e);
    decodeEdits(save.edits).forEach(([x, y, z, id]) => addEdit(x, y, z, id));
    interface Chunk {
      cx: number;
      cz: number;
      d: Uint8Array;
      group: THREE.Group;
      dirty: boolean;
      meshed: boolean;
    }
    const chunks = new Map<number, Chunk>();
    const getChunk = (cx: number, cz: number) => {
      const k = ckey(cx, cz);
      let ch = chunks.get(k);
      if (!ch) {
        const group = new THREE.Group();
        group.position.set(cx * CH, 0, cz * CH);
        scene.add(group);
        chunks.set(k, (ch = { cx, cz, d: gen.genChunk(cx, cz, editsByChunk.get(k)), group, dirty: true, meshed: false }));
      }
      return ch;
    };
    const getB = (x: number, y: number, z: number) => (y < 0 ? 3 : y >= H ? 0 : getChunk(x >> 4, z >> 4).d[(y * CH + (z & 15)) * CH + (x & 15)]);
    const toGeo = (m: MeshData) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(m.nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(m.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(m.col, 3));
      return g;
    };
    const clearGroup = (g: THREE.Group) => {
      g.children.forEach((m) => (m as THREE.Mesh).geometry.dispose());
      g.clear();
    };
    const buildMesh = (ch: Chunk) => {
      const { S, G, Tr } = meshChunk(ch.d, ch.cx, ch.cz, getB);
      clearGroup(ch.group);
      if (S.pos.length) {
        const m = new THREE.Mesh(toGeo(S), opaqueM);
        m.castShadow = m.receiveShadow = true;
        ch.group.add(m);
      }
      if (G.pos.length) ch.group.add(new THREE.Mesh(toGeo(G), glowM));
      if (Tr.pos.length) {
        const m = new THREE.Mesh(toGeo(Tr), transM);
        m.receiveShadow = true;
        m.renderOrder = 1;
        ch.group.add(m);
      }
      ch.dirty = false;
      ch.meshed = true;
    };
    let edited = false;
    let room: KoalRoom | null = null, isGuest = false, dir: RoomDirectory | null = null;
    const setB = (x: number, y: number, z: number, id: number, net = false) => {
      if (y < 0 || y >= H) return;
      const ch = getChunk(x >> 4, z >> 4);
      ch.d[(y * CH + (z & 15)) * CH + (x & 15)] = id;
      addEdit(x, y, z, id);
      edited = true;
      ch.dirty = true;
      if ((x & 15) === 0) getChunk((x >> 4) - 1, z >> 4).dirty = true;
      if ((x & 15) === 15) getChunk((x >> 4) + 1, z >> 4).dirty = true;
      if ((z & 15) === 0) getChunk(x >> 4, (z >> 4) - 1).dirty = true;
      if ((z & 15) === 15) getChunk(x >> 4, (z >> 4) + 1).dirty = true;
      if (!net) room?.send({ t: 'edit', x, y, z, id });
    };

    // ---- player ----
    const PW = 0.3, PH = 1.8, EYE = 1.62;
    let P = { x: 0.5, y: 40, z: 0.5, vx: 0, vy: 0, vz: 0, ground: false };
    let fly = false, keys: Record<string, boolean> = {}, lastSpace = 0, isPaused = true, selI = 0;
    const look = new Look(c, { sens: 0.0024, maxPitch: 1.55, onUnlock: () => setP(true) });
    const spawn = () => {
      let sx = 0, sz = 0, found = false;
      for (let r = 0; r < 400 && !found; r += 4) {
        const n = r ? 12 : 1;
        for (let i = 0; i < n && !found; i++) {
          const a = (i / n) * Math.PI * 2, x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
          if (gen.heightAt(x, z) >= SEA + 2 && !gen.treeAt(x, z) && !gen.treeAt(x + 1, z) && !gen.treeAt(x, z + 1) && !gen.treeAt(x - 1, z) && !gen.treeAt(x, z - 1)) (sx = x), (sz = z), (found = true);
        }
      }
      P.x = sx + 0.5;
      P.z = sz + 0.5;
      let y = H - 1;
      while (y > 0 && !SOLID(getB(sx, y, sz))) y--;
      P.y = y + 1.01;
      P.vx = P.vy = P.vz = 0;
    };
    if (save.p) {
      [P.x, P.y, P.z] = save.p;
      look.yaw = Math.PI - (save.yaw || 0);
      look.pitch = save.pitch || 0;
      selI = save.sel || 0;
      fly = !!save.fly;
    } else spawn();
    setSel(selI);
    const hits = (x: number, y: number, z: number) => {
      for (let by = Math.floor(y); by <= Math.floor(y + PH - 0.001); by++)
        for (let bz = Math.floor(z - PW); bz <= Math.floor(z + PW); bz++) for (let bx = Math.floor(x - PW); bx <= Math.floor(x + PW); bx++) if (SOLID(getB(bx, by, bz))) return true;
      return false;
    };
    const moveAxis = (ax: 'x' | 'y' | 'z', d: number) => {
      const stp = 0.05, n = Math.ceil(Math.abs(d) / stp) || 0;
      for (let i = 0; i < n; i++) {
        const s = Math.min(stp, Math.abs(d) - i * stp) * Math.sign(d), o = P[ax];
        P[ax] += s;
        if (hits(P.x, P.y, P.z)) {
          P[ax] = o;
          if (ax === 'y' && d < 0) P.ground = true;
          (P as any)['v' + ax] = 0;
          return;
        }
      }
    };
    const inWater = () => getB(Math.floor(P.x), Math.floor(P.y + 0.6), Math.floor(P.z)) === 10;
    let walkT = 0;
    const stepPlayer = (dt: number) => {
      const cy = Math.cos(look.yaw), sy = Math.sin(look.yaw), ix = (keys.d ? 1 : 0) - (keys.a ? 1 : 0), iz = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
      let dx = ix * cy + iz * sy, dz = ix * sy - iz * cy;
      const len = Math.hypot(dx, dz);
      if (len > 1) (dx /= len), (dz /= len);
      const wet = inWater(), spd = fly ? (keys.shift ? 18 : 11) : keys.shift ? 7.2 : 4.6, k = Math.min(1, dt * (P.ground || fly ? 14 : 5)), sp = wet && !fly ? spd * 0.6 : spd;
      P.vx += (dx * sp - P.vx) * k;
      P.vz += (dz * sp - P.vz) * k;
      if (fly) P.vy += (((keys.space ? 1 : 0) - (keys.ctrl ? 1 : 0)) * sp - P.vy) * k;
      else if (wet) P.vy = Math.max(-3, Math.min(3.2, P.vy + (keys.space ? 3 : -6) * dt * 3));
      else {
        P.vy = Math.max(-40, P.vy - 26 * dt);
        if (keys.space && P.ground) (P.vy = 8.6), (P.ground = false);
      }
      P.ground = false;
      moveAxis('x', P.vx * dt);
      moveAxis('z', P.vz * dt);
      moveAxis('y', P.vy * dt);
      if (P.y < -20) (P.y = 60), (P.vy = 0);
      if (len > 0.1 && (P.ground || fly)) walkT += dt * (keys.shift ? 12 : 8.5);
    };

    // ---- interaction ----
    const dirVec = (): [number, number, number] => {
      const cp = Math.cos(look.pitch);
      return [Math.sin(look.yaw) * cp, Math.sin(look.pitch), -Math.cos(look.yaw) * cp];
    };
    const cast = (o: number[], d: number[], maxD: number) => {
      let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
      const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
      const td = [Math.abs(1 / (d[0] || 1e-9)), Math.abs(1 / (d[1] || 1e-9)), Math.abs(1 / (d[2] || 1e-9))];
      const tm = [sx > 0 ? (x + 1 - o[0]) * td[0] : (o[0] - x) * td[0], sy > 0 ? (y + 1 - o[1]) * td[1] : (o[1] - y) * td[1], sz > 0 ? (z + 1 - o[2]) * td[2] : (o[2] - z) * td[2]];
      let n = [0, 0, 0], t = 0;
      while (t <= maxD) {
        if (SOLID(getB(x, y, z))) return { x, y, z, n };
        if (tm[0] < tm[1] && tm[0] < tm[2]) (x += sx), (t = tm[0]), (tm[0] += td[0]), (n = [-sx, 0, 0]);
        else if (tm[1] < tm[2]) (y += sy), (t = tm[1]), (tm[1] += td[1]), (n = [0, -sy, 0]);
        else (z += sz), (t = tm[2]), (tm[2] += td[2]), (n = [0, 0, -sz]);
      }
      return null;
    };
    let target: { x: number; y: number; z: number; n: number[] } | null = null;
    let mouseL = false, mouseR = false, cool = 0, swing = 0;
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)), new THREE.LineBasicMaterial({ color: '#0b1a33', transparent: true, opacity: 0.75 }));
    outline.visible = false;
    scene.add(outline);
    // break particles
    const PN = 120;
    const parts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), new THREE.MeshLambertMaterial(), PN);
    parts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PN * 3), 3);
    parts.count = 0;
    scene.add(parts);
    let pl: { p: THREE.Vector3; v: THREE.Vector3; life: number; col: number[] }[] = [];
    const burst = (x: number, y: number, z: number, id: number) => {
      const col = tileCols[BLOCKS[id]?.t[2] ?? 2] ?? [0.5, 0.5, 0.5];
      for (let i = 0; i < 14; i++) pl.push({ p: new THREE.Vector3(x + Math.random(), y + Math.random(), z + Math.random()), v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4), life: 0.6 + Math.random() * 0.4, col });
      if (pl.length > PN) pl = pl.slice(pl.length - PN);
    };
    const canPlace = (x: number, y: number, z: number) => !(x + 1 > P.x - PW && x < P.x + PW && z + 1 > P.z - PW && z < P.z + PW && y + 1 > P.y && y < P.y + PH);
    const doBreak = () => {
      if (!target || target.y <= 0) return;
      const id = getB(target.x, target.y, target.z);
      burst(target.x, target.y, target.z, id);
      setB(target.x, target.y, target.z, 0);
      swing = 1;
    };
    const doPlace = () => {
      if (!target) return;
      const x = target.x + target.n[0], y = target.y + target.n[1], z = target.z + target.n[2];
      if (y < 0 || y >= H || !canPlace(x, y, z)) return;
      const cur = getB(x, y, z);
      if (cur === 0 || cur === 10) (setB(x, y, z, HOT[selI]), (swing = 1));
    };
    let flashT = 0;
    const showFlash = (t: string) => {
      if (flash.current) (flash.current.textContent = t), (flash.current.style.opacity = '1');
      flashT = 1.4;
    };
    const select = (i: number) => {
      selI = (i + HOT.length) % HOT.length;
      setSel(selI);
      showFlash(BLOCKS[HOT[selI]].n);
      edited = true;
      setHeld();
    };
    const pick = () => {
      if (!target) return;
      const i = HOT.indexOf(getB(target.x, target.y, target.z));
      if (i >= 0) select(i);
    };

    // ---- first-person hand + held block (drawn on top of the world) ----
    const hand = new THREE.Group();
    camera.add(hand);
    const vmMat = (m: THREE.Material) => Object.assign(m, { transparent: true, depthWrite: true });
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), vmMat(new THREE.MeshLambertMaterial({ color: '#f4f6fa' })));
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.3, 4, 12), vmMat(new THREE.MeshLambertMaterial({ color: '#3d8fe8' })));
    sleeve.rotation.x = Math.PI / 2.4;
    sleeve.position.set(0.05, -0.1, 0.2);
    glove.position.set(0.035, -0.05, 0.04);
    const heldGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const held = new THREE.Mesh(heldGeo, vmMat(new THREE.MeshLambertMaterial({ map: atlasTex, alphaTest: 0.5 })));
    held.position.set(-0.02, 0.05, -0.04);
    held.rotation.set(0.25, 0.7, 0);
    hand.add(sleeve, glove, held);
    hand.position.set(0.36, -0.32, -0.6);
    [sleeve, glove, held].forEach((m, i) => (m.renderOrder = 1000 + i));
    sleeve.onBeforeRender = (r) => r.clearDepth();
    // the box's own 0/1 corner UVs, kept so every block choice maps from the same corners
    const uv0 = (heldGeo.getAttribute('uv') as THREE.BufferAttribute).array.slice();
    function setHeld() {
      const id = HOT[selI], [top, bot, side] = BLOCKS[id].t, uv = heldGeo.getAttribute('uv') as THREE.BufferAttribute;
      const HALF = 0.5 / 128, ts = 0.25 - 2 * HALF;
      [side, side, top, bot, side, side].forEach((tile, f) => {
        const tu = (tile % 4) / 4 + HALF, tv = 1 - (Math.floor(tile / 4) / 4 + HALF) - ts;
        for (let k = 0; k < 4; k++) {
          const i = f * 4 + k;
          uv.setXY(i, tu + uv0[i * 2] * ts, tv + uv0[i * 2 + 1] * ts);
        }
      });
      uv.needsUpdate = true;
      (held.material as THREE.MeshLambertMaterial).emissive.set(id === 11 ? '#ffcf6a' : '#000000');
    }
    setHeld();

    // ---- other players ----
    type Other = { name: string; ch: Character; x: number; y: number; z: number; yaw: number; sx: number; sy: number; sz: number; inited: boolean; spd: number };
    const others = new Map<string, Other>();
    const colorFor = (id: string) => {
      const ids = [room ? room.id : 'me', ...others.keys()].sort();
      return PLAYER_COLORS[Math.max(0, ids.indexOf(id)) % 4];
    };
    const tagPool: HTMLDivElement[] = [];

    // ---- streaming ----
    let queue: number[][] = [], lastPc: number[] | null = null;
    const pcOf = () => [Math.floor(P.x) >> 4, Math.floor(P.z) >> 4];
    const refreshQueue = () => {
      const [pcx, pcz] = pcOf();
      lastPc = [pcx, pcz];
      queue = [];
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dz * dz > R * R + 1) continue;
          const ch = chunks.get(ckey(pcx + dx, pcz + dz));
          if (!ch || !ch.meshed) queue.push([dx * dx + dz * dz, pcx + dx, pcz + dz]);
        }
      queue.sort((a, b) => a[0] - b[0]);
      for (const [k, ch] of chunks)
        if (Math.abs(ch.cx - pcx) > R + 2 || Math.abs(ch.cz - pcz) > R + 2) {
          clearGroup(ch.group);
          scene.remove(ch.group);
          chunks.delete(k);
        }
    };
    const work = (budget: number) => {
      const t0 = performance.now();
      while (performance.now() - t0 < budget) {
        const q = queue.shift();
        if (!q) break;
        buildMesh(getChunk(q[1], q[2]));
      }
    };
    const editRemesh = () => {
      for (const ch of chunks.values()) if (ch.dirty && ch.meshed) buildMesh(ch);
    };
    const clearChunks = () => {
      for (const ch of chunks.values()) clearGroup(ch.group), scene.remove(ch.group);
      chunks.clear();
    };
    const initialBuild = () => {
      const [a, b] = pcOf();
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) buildMesh(getChunk(a + dx, b + dz));
    };
    const saveWorld = () => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ seed, edits: [...edits].map(([k, id]) => k + ',' + id).join(';'), p: [P.x, P.y, P.z], yaw: Math.PI - look.yaw, pitch: look.pitch, sel: selI, fly }));
      } catch {
        /* storage full */
      }
      edited = false;
    };
    const newWorld = () => {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {
        /* ignore */
      }
      clearChunks();
      edits.clear();
      editsByChunk.clear();
      seed = 1 + Math.floor(Math.random() * 1e6);
      gen = terrain(seed);
      P = { x: 0.5, y: 40, z: 0.5, vx: 0, vy: 0, vz: 0, ground: false };
      spawn();
      look.yaw = Math.PI;
      look.pitch = 0;
      fly = false;
      select(0);
      initialBuild();
      refreshQueue();
      saveWorld();
      showFlash('New world!');
    };

    // ---- multiplayer ----
    const say = (msg: string, extra: Partial<typeof mp> = {}) => setMp((m) => ({ ...m, msg, ...extra }));
    const wire = () => {
      const r = room!;
      r.on('join', (p: any) => {
        const ch = new Character({ body: colorFor(p.id) });
        ch.root.add(blobShadow());
        ch.root.visible = false;
        scene.add(ch.root);
        others.set(p.id, { name: (p.name || 'Player').slice(0, 16), ch, x: 0, y: 0, z: 0, yaw: 0, sx: 0, sy: 0, sz: 0, inited: false, spd: 0 });
        if (r.isHost)
          try {
            r.conns.get(p.id)?.send({ t: 'init', seed, edits: [...edits].map(([k, id]) => [...k.split(',').map(Number), id]), pix });
          } catch {
            /* ignore */
          }
        say((p.name || 'Someone') + ' joined your world.');
      });
      r.on('leave', (id: string) => {
        const o = others.get(id);
        if (o) scene.remove(o.ch.root), say(o.name + ' left.');
        others.delete(id);
      });
      r.on('msg', (id: string, d: any) => {
        if (!d) return;
        if (d.t === 'init' && isGuest) {
          seed = d.seed;
          gen = terrain(seed);
          edits.clear();
          editsByChunk.clear();
          (d.edits || []).forEach(([x, y, z, eid]: number[]) => addEdit(x, y, z, eid));
          if (d.pix) (pix = { ...d.pix }), applyPix();
          clearChunks();
          spawn();
          initialBuild();
          refreshQueue();
          say("Joined! You are in your friend's world.");
        } else if (d.t === 'edit') {
          const prevId = getB(d.x, d.y, d.z);
          if (!d.id && prevId) burst(d.x, d.y, d.z, prevId);
          setB(d.x, d.y, d.z, d.id, true);
        } else if (d.t === 'block') (pix = { ...d.pix }), applyPix();
        else if (d.t === 'p') {
          const o = others.get(id);
          if (!o) return;
          Object.assign(o, { name: d.name || o.name, x: d.x, y: d.y, z: d.z, yaw: d.yaw });
          if (!o.inited) Object.assign(o, { sx: d.x, sy: d.y, sz: d.z, inited: true });
        }
      });
      r.on('error', (e: any) => say('Connection problem: ' + (e?.type || e?.message || 'unknown')));
    };
    const myName = () => (nameRef.current || 'Player').trim().slice(0, 16) || 'Player';
    dir = new RoomDirectory('blockrun');
    dir.on('update', () => setRooms([...dir!.rooms.values()]));
    dir.connect().then(() => setRooms([...dir!.rooms.values()])).catch(() => setRooms([]));

    // ---- input ----
    const setP = (p: boolean) => {
      isPaused = p;
      setPaused(p);
      if (p) (keys = {}), (mouseL = mouseR = false);
    };
    const active = () => !!c.offsetParent && !c.closest('.win')?.classList.contains('inactive');
    const KM: Record<string, string> = { w: 'w', a: 'a', s: 's', d: 'd', ' ': 'space', Shift: 'shift', Control: 'ctrl', c: 'ctrl', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown' };
    const kd = (e: KeyboardEvent) => {
      if (!active() || isPaused || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) return;
      const down = e.type === 'keydown', nm = e.key.length === 1 ? e.key.toLowerCase() : e.key, k = KM[nm];
      if (down && nm === 'Escape') return setP(true);
      if (down && nm >= '1' && nm <= '9') return select(+nm - 1);
      if (down && nm === '0') return api.current.openEditor();
      if (down && nm === 'f') return (fly = !fly), (P.vy = 0), (edited = true), showFlash(fly ? 'Flying' : 'Walking');
      if (!k) return;
      if (down && k === 'space' && !keys.space) {
        const now = performance.now();
        if (now - lastSpace < 300) (fly = !fly), (P.vy = 0), (edited = true), showFlash(fly ? 'Flying' : 'Walking');
        lastSpace = now;
      }
      keys[k] = down;
      e.preventDefault();
    };
    const md = (e: MouseEvent) => {
      if (isPaused) return;
      c.focus();
      e.preventDefault();
      if (e.button === 0) (mouseL = true), doBreak(), (cool = 0.25);
      else if (e.button === 2) (mouseR = true), doPlace(), (cool = 0.25);
      else if (e.button === 1) pick();
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0) mouseL = false;
      if (e.button === 2) mouseR = false;
    };
    const wheel = (e: WheelEvent) => {
      if (isPaused) return;
      e.preventDefault();
      select(selI + (e.deltaY > 0 ? 1 : -1));
    };
    const away = (e: PointerEvent) => !isPaused && !look.locked && !c.closest('.win')?.contains(e.target as Node) && setP(true);
    addEventListener('keydown', kd);
    addEventListener('keyup', kd);
    c.addEventListener('mousedown', md);
    addEventListener('mouseup', mu);
    c.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('pointerdown', away);

    api.current = {
      play: () => (setP(false), c.focus(), look.lock()),
      select,
      newWorld,
      pix: () => pix,
      openEditor: () => (look.unlock(), setP(true), setEditor(true)),
      saveBlock: (p: Pix) => {
        pix = p;
        applyPix();
        setHeld();
        try {
          localStorage.setItem(PIX_KEY, JSON.stringify({ top: packPix(p.top), side: packPix(p.side), bottom: packPix(p.bottom) }));
        } catch {
          /* ignore */
        }
        room?.send({ t: 'block', pix: p });
      },
      host: async () => {
        if (room) return;
        say('Creating your room...');
        try {
          room = new KoalRoom('blockrun', { name: myName() });
          await room.host();
          isGuest = false;
          wire();
          const reg = () => dir?.register({ code: room!.code, name: myName() + "'s world", count: room!.count });
          reg();
          room.on('join', reg).on('leave', reg);
          say(`Room code: ${room.code}. Share it with a friend.`, { inRoom: true, code: room.code });
        } catch (e: any) {
          room = null;
          say(e?.message || 'Something went wrong.');
        }
      },
      join: async (code: string) => {
        if (room) return;
        if (!code.trim()) return say('Type the room code first.');
        say('Joining...');
        try {
          room = new KoalRoom('blockrun', { name: myName() });
          isGuest = true;
          wire();
          await room.join(code.trim());
          say('Connected. Waiting for the world...', { inRoom: true, code: code.trim().toUpperCase() });
        } catch (e: any) {
          room?.leave();
          room = null;
          isGuest = false;
          say(e?.message || 'Something went wrong.');
        }
      },
      leave: () => {
        dir?.unregister();
        room?.leave();
        room = null;
        others.forEach((o) => scene.remove(o.ch.root));
        others.clear();
        if (isGuest) {
          isGuest = false;
          // back to your own saved world
          try {
            const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
            seed = s.seed || seed;
            gen = terrain(seed);
            edits.clear();
            editsByChunk.clear();
            decodeEdits(s.edits).forEach(([x, y, z, id]) => addEdit(x, y, z, id));
            if (s.p) [P.x, P.y, P.z] = s.p;
            else spawn();
          } catch {
            spawn();
          }
          clearChunks();
          initialBuild();
          refreshQueue();
        }
        say('You left the room.', { inRoom: false, code: '' });
      },
    };

    // a friend's invite: join their world, or host one for them
    if (win.props.joinCode) api.current.join(String(win.props.joinCode));
    else if (win.props.autoHost) api.current.host().then(() => room && reportHosted('kblockrun', room.code));


    // ---- loop ----
    initialBuild();
    refreshQueue();
    let alive = true, prev = performance.now(), acc = 0, saveT = 0, fps = 0, fc = 0, ft = 0, sendT = 0, fov = 70;
    const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3();
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      if (c.offsetParent) {
        st.fit();
        acc += dt;
        if (!isPaused) {
          look.tick(dt);
          const lk = 1.9 * dt;
          if (keys.ArrowLeft) look.yaw -= lk;
          if (keys.ArrowRight) look.yaw += lk;
          if (keys.ArrowUp) look.pitch = Math.min(1.55, look.pitch + lk * 0.75);
          if (keys.ArrowDown) look.pitch = Math.max(-1.55, look.pitch - lk * 0.75);
          while (acc >= 1 / 60) stepPlayer(1 / 60), (acc -= 1 / 60);
        } else acc = 0;
        const pc = pcOf();
        if (!lastPc || pc[0] !== lastPc[0] || pc[1] !== lastPc[1]) refreshQueue();
        const sprint = keys.shift && (keys.w || keys.a || keys.s || keys.d);
        fov += ((sprint ? 80 : 70) - fov) * Math.min(1, dt * 8);
        if (Math.abs(camera.fov - fov) > 0.01) (camera.fov = fov), camera.updateProjectionMatrix();
        const eye: [number, number, number] = [P.x, P.y + EYE, P.z];
        target = isPaused ? null : cast(eye, dirVec(), 6);
        outline.visible = !!target;
        if (target) outline.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
        cool -= dt;
        if (cool <= 0 && !isPaused) {
          if (mouseL) doBreak(), (cool = 0.2);
          else if (mouseR) doPlace(), (cool = 0.22);
        }
        editRemesh();
        work(6);
        // camera + hand
        const bob = Math.sin(walkT) * 0.04;
        camera.position.set(P.x, P.y + EYE + Math.abs(bob) * 0.6, P.z);
        camera.rotation.set(look.pitch, -look.yaw, 0, 'YXZ');
        swing = Math.max(0, swing - dt * 5);
        hand.position.set(0.36 + Math.sin(walkT * 0.5) * 0.015, -0.32 - Math.abs(bob) * 0.5 - swing * 0.08, -0.6 + swing * 0.06);
        hand.rotation.set(-swing * 0.9, 0, 0);
        hand.visible = !isPaused;
        // sun, sky, clouds follow you
        sky.position.copy(camera.position);
        sunDisc.position.copy(camera.position).addScaledVector(sunDir, 300);
        sunDisc.lookAt(camera.position);
        const sx = Math.round(P.x), sz = Math.round(P.z);
        sun.position.set(sx + sunDir.x * 90, sunDir.y * 90 + 20, sz + sunDir.z * 90);
        sun.target.position.set(sx, 20, sz);
        clouds.children.forEach((g) => {
          g.position.x += dt * 1.5;
          if (g.position.x - P.x > 200) g.position.x -= 400;
          if (g.position.x - P.x < -200) g.position.x += 400;
          if (g.position.z - P.z > 200) g.position.z -= 400;
          if (g.position.z - P.z < -200) g.position.z += 400;
        });
        // underwater
        const under = getB(Math.floor(P.x), Math.floor(P.y + EYE), Math.floor(P.z)) === 10;
        if (water.current) water.current.style.display = under ? 'block' : 'none';
        (scene.fog as THREE.Fog).near = under ? 1 : R * CH * 0.55;
        (scene.fog as THREE.Fog).far = under ? 18 : R * CH * 0.95;
        (scene.fog as THREE.Fog).color.set(under ? '#1d5aa8' : SKY_H);
        // particles
        let n = 0;
        pl = pl.filter((p) => (p.life -= dt) > 0);
        for (const p of pl) {
          p.v.y -= 14 * dt;
          p.p.addScaledVector(p.v, dt);
          if (SOLID(getB(Math.floor(p.p.x), Math.floor(p.p.y), Math.floor(p.p.z)))) p.v.multiplyScalar(0.3), (p.p.y = Math.floor(p.p.y) + 1.05);
          parts.setMatrixAt(n, tmpM.makeScale(p.life, p.life, p.life).setPosition(p.p));
          parts.setColorAt(n, new THREE.Color(p.col[0], p.col[1], p.col[2]));
          n++;
        }
        parts.count = n;
        parts.instanceMatrix.needsUpdate = true;
        if (parts.instanceColor) parts.instanceColor.needsUpdate = true;
        // others
        const list: Other[] = [];
        for (const o of others.values()) {
          if (!o.inited) continue;
          const px = o.sx, pz = o.sz;
          o.sx += (o.x - o.sx) * Math.min(1, dt * 10);
          o.sy += (o.y - o.sy) * Math.min(1, dt * 10);
          o.sz += (o.z - o.sz) * Math.min(1, dt * 10);
          o.spd += (Math.hypot(o.sx - px, o.sz - pz) / Math.max(dt, 1e-3) - o.spd) * Math.min(1, dt * 8);
          o.ch.root.visible = true;
          o.ch.root.position.set(o.sx, o.sy, o.sz);
          o.ch.root.rotation.y = o.yaw;
          o.ch.update(dt, o.spd, { air: !SOLID(getB(Math.floor(o.sx), Math.floor(o.sy - 0.1), Math.floor(o.sz))) });
          list.push(o);
        }
        while (tagPool.length < list.length) {
          const d = document.createElement('div');
          d.className = 'r3-tag';
          tags.current?.appendChild(d);
          tagPool.push(d);
        }
        st.render();
        tagPool.forEach((d, i) => {
          const o = list[i];
          const pos = o && st.project(tmpV.set(o.sx, o.sy + 2.7, o.sz));
          if (!pos) return void (d.style.display = 'none');
          d.style.display = 'block';
          d.style.left = pos[0] + 'px';
          d.style.top = pos[1] + 'px';
          d.textContent = o.name;
        });
        if (flashT > 0) {
          flashT -= dt;
          if (flashT < 0.5 && flash.current) flash.current.style.opacity = String(Math.max(0, flashT / 0.5));
        }
        fc++;
        ft += dt;
        if (ft >= 0.5) {
          fps = Math.round(fc / ft);
          fc = ft = 0;
          if (hud.current) hud.current.textContent = `${Math.floor(P.x)}, ${Math.floor(P.y)}, ${Math.floor(P.z)}   ·   ${fps} fps${fly ? '   ·   flying' : ''}${look.mode === 'follow' && !isPaused ? '   ·   camera follows the mouse' : ''}${room ? '   ·   room ' + room.code : ''}`;
        }
        saveT += dt;
        if (saveT > 5 && (saveT = 0, edited && !isGuest)) saveWorld();
        if (room && (sendT += dt) >= 0.12) {
          sendT = 0;
          room.send({ t: 'p', x: P.x, y: P.y, z: P.z, yaw: Math.PI - look.yaw, name: myName() });
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    (c as any)._br = { P: () => P, look, getB, setB, others: () => others, room: () => room, chunks };
    return () => {
      alive = false;
      if (!isGuest) saveWorld();
      removeEventListener('keydown', kd);
      removeEventListener('keyup', kd);
      removeEventListener('mouseup', mu);
      c.removeEventListener('mousedown', md);
      c.removeEventListener('wheel', wheel);
      document.removeEventListener('pointerdown', away);
      look.dispose();
      tagPool.forEach((d) => d.remove());
      dir?.unregister();
      dir?.leave();
      room?.leave();
      st.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="r3 brun">
      <div className="r3-game">
        <canvas ref={cv} tabIndex={0} onContextMenu={(e) => e.preventDefault()} />
        <div className="brun-water" ref={water} />
        <div className="r3-cross" />
        <div className="r3-hud" ref={hud} />
        <div className="r3-tags" ref={tags} />
        <div className="brun-flash" ref={flash} />
        <div className="brun-hot">
          {icons.map((src, i) => (
            <div key={i} className={'brun-slot' + (i === sel ? ' on' : '')} title={BLOCKS[HOT[i]].n} onClick={() => api.current?.select(i)}>
              <img src={src} alt="" draggable={false} />
              <em>{i + 1}</em>
            </div>
          ))}
        </div>
        {err && <div className="r3-big">{err}</div>}
        {paused && !editor && !err && (
          <div className="brun-menu" onMouseDown={(e) => e.target === e.currentTarget && api.current?.play()}>
            <h2>Block Run</h2>
            <b className="brun-play" onMouseDown={() => api.current?.play()}>Click to play</b>
            <small>
              W A S D move {'·'} Space jump {'·'} Shift run {'·'} Mouse or arrow keys look
              <br />
              Left click break {'·'} Right click place {'·'} Middle click pick {'·'} 1-9 / wheel choose a block
              <br />
              F or double Space fly {'·'} 0 paint a custom block {'·'} Esc releases the mouse {'·'} your world saves itself
            </small>
            <button
              className="k-btn"
              onClick={() => {
                if (!armed) {
                  setArmed(true);
                  window.setTimeout(() => setArmed(false), 4000);
                  return;
                }
                setArmed(false);
                api.current?.newWorld();
              }}
            >
              {armed ? 'Click again to erase this world' : 'New world'}
            </button>
            <button className="k-btn" onClick={() => api.current?.openEditor()}>Paint the custom block</button>
            <div className="brun-mp">
              <input className="k-input" maxLength={16} placeholder="Your name" spellCheck={false} value={name} onChange={(e) => (setName(e.target.value), localStorage.setItem(NAME_KEY, e.target.value))} />
              {mp.inRoom ? (
                <div className="r3-btns">
                  <b>Room {mp.code}</b>
                  <button className="k-btn" onClick={() => api.current?.leave()}>Leave the room</button>
                </div>
              ) : (
                <JoinRow onHost={() => api.current?.host()} onJoin={(code) => api.current?.join(code)} />
              )}
              <small>{mp.msg}</small>
              <div className="r3-rooms">
                <b>Open worlds</b>
                {rooms === null && <small>Looking for worlds...</small>}
                {rooms?.length === 0 && <small>No open worlds right now. Host one!</small>}
                {rooms?.map((r) => (
                  <div key={r.id} className="r3-room">
                    <b>{r.name || 'World'}</b>
                    <span>{(r.count || 1) + ' player' + (r.count === 1 ? '' : 's')}</span>
                    {!mp.inRoom && <button className="k-btn" onClick={() => api.current?.join(r.code)}>Join</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {editor && <BlockEditor start={api.current?.pix()} onSave={(p) => (api.current?.saveBlock(p), setEditor(false))} onCancel={() => setEditor(false)} />}
      </div>
    </div>
  );
}

function JoinRow({ onHost, onJoin }: { onHost(): void; onJoin(code: string): void }) {
  const [code, setCode] = useState('');
  return (
    <div className="r3-btns">
      <button className="k-btn default" onClick={onHost}>Host multiplayer</button>
      <span>or</span>
      <input className="k-input" maxLength={10} placeholder="Room code" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onJoin(code)} />
      <button className="k-btn" onClick={() => onJoin(code)}>Join</button>
    </div>
  );
}

/** Paint the custom block: three 16 x 16 faces. */
function BlockEditor({ start, onSave, onCancel }: { start?: Pix; onSave(p: Pix): void; onCancel(): void }) {
  const [p, setP] = useState<Pix>(() => ({ top: [...(start?.top ?? Array(256).fill('#8a5a3c'))], side: [...(start?.side ?? Array(256).fill('#8a5a3c'))], bottom: [...(start?.bottom ?? Array(256).fill('#8a5a3c'))] }));
  const [color, setColor] = useState('#8a5a3c');
  const [face, setFace] = useState<Face>('top');
  const refs = { top: useRef<HTMLCanvasElement>(null), side: useRef<HTMLCanvasElement>(null), bottom: useRef<HTMLCanvasElement>(null) };
  const painting = useRef(false);
  useEffect(() => {
    FACES.forEach((f) => {
      const g = refs[f].current?.getContext('2d');
      if (!g) return;
      p[f].forEach((col, i) => ((g.fillStyle = col), g.fillRect((i % 16) * 8, Math.floor(i / 16) * 8, 8, 8)));
    });
  });
  const paint = (f: Face, e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * 16), y = Math.floor(((e.clientY - r.top) / r.height) * 16);
    if (x < 0 || x > 15 || y < 0 || y > 15) return;
    setP((o) => {
      const n = [...o[f]];
      n[y * 16 + x] = color;
      return { ...o, [f]: n };
    });
  };
  return (
    <div className="brun-editor">
      <div className="brun-edlg">
        <div className="kgh-dt">Paint a custom block</div>
        <div className="brun-faces">
          {FACES.map((f) => (
            <div key={f} className={'brun-face' + (f === face ? ' on' : '')}>
              <b>{f[0].toUpperCase() + f.slice(1)}</b>
              <canvas
                ref={refs[f]}
                width={128}
                height={128}
                onPointerDown={(e) => {
                  painting.current = true;
                  setFace(f);
                  e.currentTarget.setPointerCapture(e.pointerId);
                  paint(f, e);
                }}
                onPointerMove={(e) => painting.current && paint(f, e)}
                onPointerUp={() => (painting.current = false)}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          ))}
        </div>
        <div className="r3-btns">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          <button className="k-btn" onClick={() => setP((o) => ({ ...o, [face]: Array(256).fill(color) }))}>Fill this face</button>
          <button className="k-btn" onClick={() => setP((o) => ({ top: [...o[face]], side: [...o[face]], bottom: [...o[face]] }))}>Same on every side</button>
          <button className="k-btn" onClick={() => setP((o) => ({ ...o, [face]: Array(256).fill('#8a5a3c') }))}>Clear</button>
        </div>
        <small>Click or drag to paint. This block is shared with anyone in your room.</small>
        <div className="r3-btns">
          <button className="k-btn default" onClick={() => onSave(p)}>Save block</button>
          <button className="k-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
