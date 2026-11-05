// Arena 3D, remade: deathmatch for up to 4 players (or practice against smart training bots) on six
// modelled maps or your own. 28 modelled weapons, a skill tree bought with coins, map voting.
// Network messages match koalOS, so both versions can share a room.
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../../core/registry';
import { openApp } from '../../../core/wm';
import { canvasTex, createStage, glow, matte, noise, THREE } from '../engine';
import { Character, blobShadow } from '../models';
import { Look } from '../r3';
import { LobbyResult, RoomLobby } from '../Lobby';
import { reportHosted } from '../../../core/invites';
import { sfx, spatial } from '../../../core/sfx';

type GunKind = Parameters<typeof sfx.gun>[0];
/** Which gunshot sound each weapon makes. */
const GUN_SOUND: Record<string, GunKind> = { pistol: 'pistol', akimbo: 'pistol', revolver: 'pistol', handcrossbow: 'crossbow', crossbow: 'crossbow', smg: 'smg', tacsmg: 'smg', rifle: 'rifle', burst: 'rifle', boltcarbine: 'rifle', marksman: 'rifle', autosniper: 'sniper', sniper: 'sniper', shotgun: 'shotgun', combatshotgun: 'shotgun', minigun: 'heavy', chaingun: 'heavy', grenade: 'launcher', rocketlauncher: 'launcher', nukelauncher: 'launcher', flamethrower: 'flame', machete: 'melee', railgun: 'laser', deathlaser: 'laser', plasmarifle: 'laser', ioncannon: 'laser', voidripper: 'laser', singularity: 'laser' };
import { buildGun, Gun } from './guns';
import { Box, LAVA, MAP_NAMES, PROFILE_KEY, RGB, S, SCOPED, SCOPE_FOV, SKILL_TREE, WEAPONS, WEAPON_KEYS, WIN_KILLS, allMapNames, genMap, spawnsFor } from './data';

interface Profile {
  name: string;
  coins: number;
  owned: string[];
}
const loadProfile = (): Profile => {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    return { name: p.name || '', coins: p.coins || 0, owned: p.owned?.length ? p.owned : ['pistol'] };
  } catch {
    return { name: '', coins: 0, owned: ['pistol'] };
  }
};
const saveProfile = (p: Profile) => {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
};
const hex = (c: RGB) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
const randCol = (): RGB => {
  const h = Math.random() * 360, s = 0.65 + Math.random() * 0.25, l = 0.5;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
};

export function Arena({ win }: { win: WinCtx }) {
  const myCol = useRef(randCol()).current;
  const [s, setS] = useState<LobbyResult | null>(() => (win.props.practice ? { room: null, name: loadProfile().name || 'Player', dir: null } : null));
  const [dev, setDev] = useState(false);
  const [prof, setProf] = useState(loadProfile);
  useEffect(() => {
    const keys = new Set<string>();
    const h = (e: KeyboardEvent) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '')) return;
      const k = e.key.toLowerCase();
      if (k !== 'o' && k !== 'p') return;
      if (e.type === 'keyup') return void keys.delete(k);
      if (e.repeat) return;
      const before = keys.has('o') && keys.has('p');
      keys.add(k);
      if (!before && keys.has('o') && keys.has('p') && win.focused) setDev((d) => !d);
    };
    addEventListener('keydown', h);
    addEventListener('keyup', h);
    return () => (removeEventListener('keydown', h), removeEventListener('keyup', h));
  }, [win.focused]);
  const allOwned = WEAPON_KEYS.every((k) => prof.owned.includes(k));
  return (
    <div className="r3 arn">
      {!s ? (
        <RoomLobby
          kind="arena"
          title="Arena 3D"
          blurb={`Multiplayer deathmatch for up to 4 players. First to ${WIN_KILLS} kills wins. Earn coins for kills and unlock new guns between matches.`}
          nameKey={PROFILE_KEY}
          max={4}
          info={() => ({ col: myCol })}
          soloLabel="Practice alone (with training bots)"
          hint={<>W A S D move {'·'} Space jump {'·'} Shift sprint {'·'} Click shoot {'·'} Right-click aim {'·'} R reload {'·'} 1-9 or wheel switch gun {'·'} Tab scores</>}
          autoJoin={win.props.joinCode}
          autoHost={!!win.props.autoHost}
          onHosted={(code) => reportHosted('karena', code)}
          onStart={setS}
        >
          <div className="arn-prof">
            {prof.coins} coins {'·'} {prof.owned.length} of {WEAPON_KEYS.length} guns unlocked
          </div>
        </RoomLobby>
      ) : (
        <Game s={s} col={myCol} forceMap={typeof win.props.forceMap === 'number' ? win.props.forceMap : null} onExit={() => (setS(null), setProf(loadProfile()))} />
      )}
      {dev && (
        <div className="arn-dev">
          <b>Dev Panel</b>
          <button className="k-btn" onClick={() => openApp('karenamap')}>Open Map Editor</button>
          <button
            className="k-btn"
            onClick={() => {
              const p = loadProfile();
              p.owned = allOwned ? ['pistol'] : WEAPON_KEYS.slice();
              saveProfile(p);
              setProf(p);
              window.dispatchEvent(new CustomEvent('arena-owned'));
            }}
          >
            {allOwned ? 'Lock All Guns' : 'Unlock All Guns'}
          </button>
          <small>O + P to close</small>
        </div>
      )}
    </div>
  );
}

// ---------- surfaces ----------
const panelTex = () =>
  canvasTex(256, (g, s) => {
    g.fillStyle = '#d8dde6';
    g.fillRect(0, 0, s, s);
    noise(g, s, 3000, 0.06);
    g.fillStyle = 'rgba(60,70,90,.45)';
    g.fillRect(0, 0, s, 3);
    g.fillRect(0, 0, 3, s);
    g.fillRect(0, s / 2, s, 2);
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.fillRect(3, 3, s - 3, 2);
    g.fillStyle = 'rgba(70,80,100,.5)';
    for (const [x, y] of [[14, 14], [s - 14, 14], [14, s / 2 - 10], [s - 14, s / 2 - 10], [14, s / 2 + 12], [s - 14, s / 2 + 12], [14, s - 14], [s - 14, s - 14]]) g.fillRect(x - 2, y - 2, 4, 4);
  });
const crateTex = () =>
  canvasTex(128, (g, s) => {
    g.fillStyle = '#b07a44';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 16) {
      g.fillStyle = 'rgba(70,40,15,.35)';
      g.fillRect(0, y, s, 2);
      for (let x = 0; x < s; x += 2) {
        g.fillStyle = `rgba(90,55,20,${0.05 + Math.abs(Math.sin(x * 0.3 + y)) * 0.08})`;
        g.fillRect(x, y + 2, 2, 14);
      }
    }
    g.strokeStyle = '#6a4220';
    g.lineWidth = 12;
    g.strokeRect(6, 6, s - 12, s - 12);
    g.beginPath();
    g.moveTo(10, 10);
    g.lineTo(s - 10, s - 10);
    g.stroke();
    noise(g, s, 1500, 0.1);
  });
const floorTex = () =>
  canvasTex(256, (g, s) => {
    g.fillStyle = '#7d8798';
    g.fillRect(0, 0, s, s);
    noise(g, s, 6000, 0.08);
    noise(g, s, 3000, 0.06, true);
    g.fillStyle = 'rgba(40,46,60,.55)';
    for (let i = 0; i <= 2; i++) g.fillRect(0, (i * s) / 2 - 1, s, 2), g.fillRect((i * s) / 2 - 1, 0, 2, s);
    g.fillStyle = 'rgba(255,210,40,.55)';
    g.fillRect(s / 2 - 30, s / 4 - 2, 60, 4);
  });
const rockTex = () =>
  canvasTex(128, (g, s) => {
    g.fillStyle = '#4a403a';
    g.fillRect(0, 0, s, s);
    noise(g, s, 4000, 0.25, false, 2);
    noise(g, s, 2000, 0.12, true, 2);
    g.strokeStyle = 'rgba(20,14,10,.6)';
    g.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo((i * 37) % s, 0);
      g.lineTo((i * 53 + 30) % s, s);
      g.stroke();
    }
  });
const lavaTex = () =>
  canvasTex(256, (g, s) => {
    const gr = g.createLinearGradient(0, 0, s, s);
    gr.addColorStop(0, '#ff5a00');
    gr.addColorStop(0.5, '#ffb000');
    gr.addColorStop(1, '#ff3a00');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(90,10,0,${0.25 + (i % 5) * 0.08})`;
      g.beginPath();
      g.ellipse((i * 67) % s, (i * 131) % s, 10 + (i % 7) * 4, 6 + (i % 5) * 3, i, 0, Math.PI * 2);
      g.fill();
    }
  });
function boxGeo(w: number, h: number, d: number, per: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) uv.setXY(f * 4 + k, (uv.getX(f * 4 + k) * dims[f][0]) / per, (uv.getY(f * 4 + k) * dims[f][1]) / per);
  return g;
}
const flashTex = () =>
  canvasTex(
    128,
    (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,230,1)');
      gr.addColorStop(0.3, 'rgba(255,200,80,.9)');
      gr.addColorStop(1, 'rgba(255,120,0,0)');
      g.fillStyle = gr;
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 ? s * 0.18 : s / 2, a = (i * Math.PI) / 8;
        i ? g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r) : g.moveTo(s / 2 + r, s / 2);
      }
      g.fill();
    },
    [1, 1],
  );

interface Intermission {
  winner: string;
  votes: number[];
  myVote: number;
  coins: number;
  owned: string[];
  endsAt: number;
  host: boolean;
  solo: boolean;
}

function Game({ s, col, forceMap, onExit }: { s: LobbyResult; col: RGB; forceMap: number | null; onExit(): void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const ui = {
    hud: useRef<HTMLDivElement>(null),
    hp: useRef<HTMLDivElement>(null),
    ammo: useRef<HTMLDivElement>(null),
    feed: useRef<HTMLDivElement>(null),
    board: useRef<HTMLDivElement>(null),
    tags: useRef<HTMLDivElement>(null),
    center: useRef<HTMLDivElement>(null),
    hit: useRef<HTMLDivElement>(null),
    dmg: useRef<HTMLDivElement>(null),
    scope: useRef<HTMLDivElement>(null),
    cross: useRef<HTMLDivElement>(null),
  };
  const [paused, setPaused] = useState(true);
  const [inter, setInter] = useState<Intermission | null>(null);
  const [err, setErr] = useState('');
  const api = useRef<any>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const c = cv.current!;
    const room = s.room;
    const cleanup = () => {
      s.dir?.unregister();
      s.dir?.leave();
      room?.leave();
    };
    const st = createStage(c, { shadows: true, bloom: 0.45, fov: 75, near: 0.05, far: 300, env: 0.8 });
    if (!st) {
      setErr('Arena 3D needs WebGL, which your browser has turned off.');
      return cleanup;
    }
    const { scene, camera } = st;
    scene.add(camera);
    const prof = loadProfile();
    const myId = room ? room.id : 'me', myName = s.name || 'Player', HS = 0.35, PH = 1.8, EYE = 1.62;
    let mapVariant = forceMap ?? Math.floor(Math.random() * allMapNames().length);
    let BOXES: Box[] = [], SPAWN_PTS: number[][] = [];

    // ---- sky + lights ----
    const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU, vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform vec3 top;uniform vec3 hor;varying vec3 vP;void main(){gl_FragColor=vec4(mix(hor,top,pow(clamp(vP.y*1.4,0.,1.),.7)),1.);}' }));
    scene.add(sky);
    const hemi = new THREE.HemisphereLight('#d6ecff', '#4a4f60', 1.1);
    const sun = new THREE.DirectionalLight('#fff2dc', 2.3);
    sun.position.set(18, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 90 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    const lavaLights = [new THREE.PointLight('#ff6a10', 30, 26, 1.6), new THREE.PointLight('#ff6a10', 30, 26, 1.6), new THREE.PointLight('#ff6a10', 30, 26, 1.6)];
    lavaLights.forEach((l, i) => l.position.set(Math.cos(i * 2.1) * 10, 1.2, Math.sin(i * 2.1) * 10));
    scene.add(hemi, sun, ...lavaLights);

    // ---- the map ----
    const mapG = new THREE.Group();
    scene.add(mapG);
    const T = { panel: panelTex(), crate: crateTex(), floor: floorTex(), rock: rockTex(), lava: lavaTex() };
    T.lava.repeat.set(1, 1);
    const matCache = new Map<string, THREE.Material>();
    const boxMat = (b: Box) => {
      const [r, g2, bl] = b.col, key = b.col.join(',');
      const kind = Math.abs(r - 0.62) < 0.02 && Math.abs(g2 - 0.48) < 0.02 ? 'crate' : Math.abs(r - 0.3) < 0.02 && Math.abs(g2 - 0.27) < 0.02 ? 'rock' : 'panel';
      const k2 = kind + key;
      if (!matCache.has(k2)) matCache.set(k2, new THREE.MeshStandardMaterial({ map: T[kind as 'panel'], color: kind === 'panel' ? new THREE.Color(r * 1.35, g2 * 1.35, bl * 1.35) : '#ffffff', roughness: kind === 'panel' ? 0.55 : 0.85, metalness: kind === 'panel' ? 0.1 : 0 }));
      return { m: matCache.get(k2)!, per: kind === 'panel' ? 2 : kind === 'crate' ? 1.2 : 1.5 };
    };
    let lavaMat: THREE.MeshStandardMaterial | null = null;
    const buildMap = () => {
      mapG.children.forEach((m) => (m as THREE.Mesh).geometry?.dispose());
      mapG.clear();
      BOXES = genMap(mapVariant);
      SPAWN_PTS = spawnsFor(mapVariant);
      const lava = mapVariant === LAVA;
      const F = 2 * S + 4;
      if (lava) {
        lavaMat = new THREE.MeshStandardMaterial({ color: '#331000', emissive: '#ffffff', emissiveMap: T.lava, emissiveIntensity: 1.6, roughness: 0.6 });
        T.lava.repeat.set(F / 8, F / 8);
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(F, F, 1, 1), lavaMat);
        fl.rotation.x = -Math.PI / 2;
        mapG.add(fl);
      } else {
        T.floor.repeat.set(F / 4, F / 4);
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(F, F), new THREE.MeshStandardMaterial({ map: T.floor, roughness: 0.75, metalness: 0.05 }));
        fl.rotation.x = -Math.PI / 2;
        fl.receiveShadow = true;
        mapG.add(fl);
      }
      for (const b of BOXES) {
        const { m, per } = boxMat(b);
        const mesh = new THREE.Mesh(boxGeo(b.w, b.top - b.y, b.d, per), m);
        mesh.position.set(b.x, (b.y + b.top) / 2, b.z);
        mesh.castShadow = mesh.receiveShadow = true;
        mapG.add(mesh);
        if (b.top - b.y > 2 && b.top < 7 && !lava) {
          const trim = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.04, 0.08, b.d + 0.04), glow('#5fc0ff', 1.4));
          trim.position.set(b.x, b.top - 0.04, b.z);
          mapG.add(trim);
        }
      }
      skyU.top.value.set(lava ? '#2a0a06' : '#2a6fd0');
      skyU.hor.value.set(lava ? '#a8401a' : '#cfe8ff');
      scene.fog = new THREE.Fog(lava ? '#6a2410' : '#cfe8ff', 40, 120);
      hemi.color.set(lava ? '#ffb080' : '#d6ecff');
      hemi.intensity = lava ? 0.7 : 1.1;
      sun.intensity = lava ? 0.9 : 2.3;
      lavaLights.forEach((l) => (l.visible = lava));
    };
    buildMap();

    // ---- effects: tracers, flashes, explosions ----
    const tracerGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    const tracers: { m: THREE.Mesh; at: number; life: number }[] = [];
    const addTracer = (a: number[], b: number[], color: RGB, big: boolean) => {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
      if (len < 0.01) return;
      const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color[0] * 2, color[1] * 2, color[2] * 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.position.copy(A).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      const r = big ? 0.06 : 0.012;
      m.scale.set(r, len, r);
      scene.add(m);
      tracers.push({ m, at: performance.now(), life: big ? 320 : 110 });
    };
    const fxs: { m: THREE.Object3D; at: number; life: number; kind: 'boom' | 'spark' | 'flash'; light?: THREE.PointLight; size: number }[] = [];
    const boomM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, 0.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const addFx = (p: number[], kind: 'boom' | 'spark' | 'flash', size = 1) => {
      const g = new THREE.Group();
      g.position.set(p[0], p[1], p[2]);
      const m = new THREE.Mesh(new THREE.SphereGeometry(kind === 'boom' ? 1 : 0.12, 16, 12), boomM.clone());
      g.add(m);
      const light = new THREE.PointLight(kind === 'boom' ? '#ff8a20' : '#ffd080', kind === 'boom' ? 60 * size : 6, kind === 'boom' ? 10 * size : 4, 2);
      g.add(light);
      scene.add(g);
      fxs.push({ m: g, at: performance.now(), life: kind === 'boom' ? 450 : 90, kind, light, size });
    };

    // ---- people ----
    type Person = { id: string; name: string; col: RGB; ch: Character; gun?: Gun; wpn: string; x: number; y: number; z: number; tx: number; ty: number; tz: number; yaw: number; pitch: number; hp: number; alive: boolean; kills: number; deaths: number; spd: number; inited: boolean; dummy?: boolean; respawn?: number; fireCool?: number; goal?: [number, number] };
    const others = new Map<string, Person>(), dummies: Person[] = [];
    const makePerson = (id: string, name: string, pcol: RGB, dummy = false): Person => {
      const ch = new Character(dummy ? { body: '#a9b4c6', face: '#dfe6f0', plain: true } : { body: hex(pcol), plain: true });
      ch.root.add(blobShadow());
      scene.add(ch.root);
      const p: Person = { id, name, col: pcol, ch, wpn: '', x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, yaw: 0, pitch: 0, hp: 100, alive: true, kills: 0, deaths: 0, spd: 0, inited: false, dummy };
      setPersonGun(p, 'pistol');
      return p;
    };
    const setPersonGun = (p: Person, key: string) => {
      if (p.wpn === key) return;
      if (p.gun) p.ch.handR.remove(p.gun.group);
      p.gun = buildGun(key);
      p.gun.group.rotation.x = Math.PI / 2;
      p.gun.group.position.set(0, -0.06, 0.02);
      p.gun.group.traverse((o) => (o.castShadow = true));
      p.ch.handR.add(p.gun.group);
      p.wpn = key;
    };
    const removePerson = (p: Person) => scene.remove(p.ch.root);

    // ---- me ----
    const me = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ground: false, hp: 100, alive: true, respawnAt: 0, kills: 0, deaths: 0, streak: 0, weapon: 'pistol', ammo: 12, reloading: false, reloadEndAt: 0, coins: prof.coins, owned: new Set(prof.owned), ammoBy: {} as Record<string, number> };
    WEAPON_KEYS.forEach((k) => (me.ammoBy[k] = WEAPONS[k].mag));
    const look = new Look(c, { sens: 0.0024, maxPitch: 1.5, onUnlock: () => setP(true) });
    const persist = () => {
      const p = loadProfile();
      p.coins = me.coins;
      p.owned = [...me.owned];
      saveProfile(p);
    };
    const onOwned = () => {
      me.owned = new Set(loadProfile().owned);
      if (!me.owned.has(me.weapon)) switchWeapon('pistol', true);
    };
    window.addEventListener('arena-owned', onOwned);
    const addCoins = (n: number) => ((me.coins += n), persist());
    const addKillCoins = () => (addCoins(1 + Math.floor(me.streak / 3)), me.streak++);
    const spawn = () => {
      const sp = SPAWN_PTS[Math.floor(Math.random() * SPAWN_PTS.length)];
      me.x = sp[0] + (Math.random() - 0.5);
      me.z = sp[1] + (Math.random() - 0.5);
      me.y = sp[2] || 0;
      me.vx = me.vy = me.vz = 0;
      me.hp = 100;
      me.alive = true;
      if (!me.owned.has(me.weapon)) me.weapon = 'pistol';
      me.ammo = me.ammoBy[me.weapon];
      me.reloading = false;
      look.yaw = Math.PI - Math.atan2(-me.x, -me.z);
      look.pitch = 0;
      center('');
    };
    const makeDummies = () => {
      dummies.forEach(removePerson);
      dummies.length = 0;
      if (room) return;
      for (let i = 0; i < 3; i++) {
        const sp = SPAWN_PTS[(i * 2) % SPAWN_PTS.length];
        const d = makePerson('dummy' + i, 'Bot ' + (i + 1), [0.6, 0.6, 0.6], true);
        Object.assign(d, { x: sp[0], y: sp[2] || 0, z: sp[1], tx: sp[0], tz: sp[1], inited: true, fireCool: Math.random(), goal: [sp[0], sp[1]] });
        dummies.push(d);
      }
    };
    spawn();
    makeDummies();

    // ---- feed, scores ----
    const feed: { t: string; at: number }[] = [];
    const addFeed = (t: string) => {
      feed.push({ t, at: performance.now() });
      if (feed.length > 5) feed.shift();
    };
    const colorOf = (id: string): RGB => (id === myId ? col : others.get(id)?.col || [0.7, 0.7, 0.7]);
    const nameOf = (id: string) => (id === myId ? myName : room?.players.get(id)?.name || others.get(id)?.name || dummies.find((d) => d.id === id)?.name || 'Player');
    const scoreOf = (id: string) => (id === myId ? me : others.get(id) || dummies.find((d) => d.id === id) || { kills: 0, deaths: 0 });
    let winner: string | null = null, voteCounts: number[] = [], myVote = -1, interOpen = false, interEnd = 0;
    function center(t: string) {
      if (ui.center.current) ui.center.current.textContent = t;
    }
    const declareWinner = (id: string) => {
      if (winner) return;
      winner = id;
      center(nameOf(id) + ' wins the match!');
      if (id === myId) addCoins(3), sfx.win();
      else sfx.lose();
    };
    const killed = (by: string, victim: string) => {
      const k = scoreOf(by) as { kills: number };
      if (by !== victim) {
        k.kills++;
        if (by === myId) addKillCoins();
      }
      addFeed(nameOf(by) + ' eliminated ' + nameOf(victim));
      if (k.kills >= WIN_KILLS && !winner) declareWinner(by);
    };
    const refreshInter = () => setInter((o) => (o ? { ...o, votes: [...voteCounts], myVote, coins: me.coins, owned: [...me.owned] } : o));
    const openInter = () => {
      if (interOpen) return;
      interOpen = true;
      setP(true);
      look.unlock();
      interEnd = performance.now() + 15000;
      voteCounts = allMapNames().map(() => 0);
      myVote = -1;
      setInter({ winner: winner ? nameOf(winner) : '', votes: [...voteCounts], myVote, coins: me.coins, owned: [...me.owned], endsAt: Date.now() + 15000, host: !room || room.isHost, solo: !room });
    };
    const finishInter = (mapIdx: number) => {
      if (!interOpen) return;
      interOpen = false;
      setInter(null);
      mapVariant = mapIdx;
      buildMap();
      me.kills = me.deaths = me.streak = 0;
      others.forEach((o) => (o.kills = o.deaths = 0));
      winner = null;
      center('');
      spawn();
      makeDummies();
      setP(false);
      look.lock();
    };
    const tally = () => {
      let best = -1, bi = Math.floor(Math.random() * allMapNames().length);
      voteCounts.forEach((v, i) => v > best && ((best = v), (bi = i)));
      return bi;
    };

    // ---- network ----
    if (room) {
      room
        .on('join', (p: any) => {
          if (!others.has(p.id)) others.set(p.id, makePerson(p.id, p.name || 'Player', Array.isArray(p.col) ? p.col : randCol()));
          addFeed((p.name || 'Someone') + ' joined');
        })
        .on('leave', (id: string) => {
          const o = others.get(id);
          if (o) addFeed(o.name + ' left'), removePerson(o);
          others.delete(id);
        })
        .on('msg', (id: string, d: any) => {
          const o = others.get(id);
          if (!o || !d) return;
          if (d.t === 's') {
            Object.assign(o, { tx: d.x, ty: d.y, tz: d.z, yaw: d.yaw, pitch: d.pitch, hp: d.hp, alive: d.alive });
            setPersonGun(o, WEAPONS[d.wpn] ? d.wpn : 'pistol');
            if (!o.inited) Object.assign(o, { x: d.x, y: d.y, z: d.z, inited: true });
          } else if (d.t === 'shot') {
            addTracer(d.a, d.b, d.big ? [1, 0.15, 0.15] : colorOf(id), !!d.big);
            addFx(d.a, 'flash', 0.6);
            sfx.gun(GUN_SOUND[o.wpn] ?? (d.big ? 'laser' : 'rifle'), spatial(d.a[0], d.a[2], me.x, me.z, look.yaw, 45));
          } else if (d.t === 'hit' && d.to === myId && me.alive) {
            me.hp -= d.dmg;
            dmgAt = performance.now();
            sfx.hurt();
            if (me.hp <= 0) {
              me.alive = false;
              me.hp = 0;
              me.deaths++;
              me.streak = 0;
              me.respawnAt = performance.now() + 3000;
              room.send({ t: 'dead', by: id });
              killed(id, myId);
            }
          } else if (d.t === 'dead') {
            o.deaths++;
            killed(d.by, id);
          } else if (d.t === 'vote') {
            voteCounts[d.map] = (voteCounts[d.map] || 0) + 1;
            refreshInter();
          } else if (d.t === 'nextmap') finishInter(d.map);
        })
        .on('error', (e: any) => center('Connection problem: ' + (e?.type || e?.message || 'unknown')));
    }

    // ---- physics ----
    const overl = (x: number, y: number, z: number, b: Box) => Math.abs(x - b.x) < b.w / 2 + HS && Math.abs(z - b.z) < b.d / 2 + HS && y < b.top - 0.001 && y + PH > b.y;
    let keys: Record<string, boolean> = {};
    const step = (dt: number) => {
      if (!me.alive) return;
      const cy = Math.cos(look.yaw), sy = Math.sin(look.yaw), ix = (keys.d ? 1 : 0) - (keys.a ? 1 : 0), iz = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
      let dx = ix * cy + iz * sy, dz = ix * sy - iz * cy;
      const l = Math.hypot(dx, dz);
      if (l > 1) (dx /= l), (dz /= l);
      const spd = keys.shift ? 8.6 : 6, k = Math.min(1, dt * (me.ground ? 14 : 5));
      me.vx += (dx * spd - me.vx) * k;
      me.vz += (dz * spd - me.vz) * k;
      if (keys.space && me.ground) (me.vy = 9.2), (me.ground = false), sfx.whoosh(true, { vol: 0.25, pitch: 1.3 });
      me.vy -= 26 * dt;
      const py = me.y;
      me.x += me.vx * dt;
      for (const b of BOXES) if (overl(me.x, me.y, me.z, b) && me.y < b.top - 0.15) (me.x = me.vx > 0 || me.x < b.x ? b.x - b.w / 2 - HS - 0.001 : b.x + b.w / 2 + HS + 0.001), (me.vx = 0);
      me.z += me.vz * dt;
      for (const b of BOXES) if (overl(me.x, me.y, me.z, b) && me.y < b.top - 0.15) (me.z = me.vz > 0 || me.z < b.z ? b.z - b.d / 2 - HS - 0.001 : b.z + b.d / 2 + HS + 0.001), (me.vz = 0);
      me.y += me.vy * dt;
      me.ground = false;
      if (me.y <= 0) (me.y = 0), (me.vy = 0), (me.ground = true);
      for (const b of BOXES) {
        if (!overl(me.x, me.y, me.z, b)) continue;
        if (me.vy <= 0 && py >= b.top - 0.06) (me.y = b.top), (me.vy = 0), (me.ground = true);
        else if (me.vy > 0 && py + PH <= b.y + 0.06) (me.y = b.y - PH), (me.vy = 0);
      }
      if (l > 0.1 && me.ground) {
        bobT += dt * (keys.shift ? 12 : 9);
        stepAcc += dt * (keys.shift ? 12 : 9);
        if (stepAcc > Math.PI) (stepAcc -= Math.PI), sfx.step(mapVariant === LAVA ? 'stone' : 'concrete', { vol: keys.shift ? 0.6 : 0.4 });
      }
    };

    // ---- shooting ----
    const rayBox = (o: number[], d: number[], cx: number, cz: number, y0: number, y1: number, hw: number, hd: number) => {
      let tmin = 0, tmax = 1e9;
      const lo = [cx - hw, y0, cz - hd], hi = [cx + hw, y1, cz + hd];
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-8) {
          if (o[i] < lo[i] || o[i] > hi[i]) return -1;
          continue;
        }
        let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i];
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return -1;
      }
      return tmin;
    };
    const canSee = (tx: number, ty: number, tz: number, from = [me.x, me.y + EYE, me.z]) => {
      const dx = tx - from[0], dy = ty - from[1], dz = tz - from[2], dist = Math.hypot(dx, dy, dz);
      if (dist < 0.001) return true;
      const d = [dx / dist, dy / dist, dz / dist];
      return !BOXES.some((b) => {
        const t = rayBox(from, d, b.x, b.z, b.y, b.top, b.w / 2, b.d / 2);
        return t >= 0 && t < dist - 0.15;
      });
    };
    const startReload = () => {
      const wp = WEAPONS[me.weapon];
      if (me.reloading || !isFinite(wp.mag) || me.ammo >= wp.mag) return;
      me.reloading = true;
      me.reloadEndAt = performance.now() + wp.reload * 1000;
      sfx.reload();
    };
    let hitAt = 0, dmgAt = 0, kickAt = 0, swingAt = 0, bobT = 0, stepAcc = 0, aim = 0, scoped = false, mouseL = false, fireCool = 0, isPaused = true;
    const fire = () => {
      if (!me.alive || winner || me.reloading) return;
      const wp = WEAPONS[me.weapon];
      if (!wp.melee && me.ammo <= 0) return sfx.dry(), startReload();
      sfx.gun(GUN_SOUND[me.weapon] ?? 'pistol', { vol: 0.85 });
      if (!wp.melee) me.ammo--;
      const o = [me.x, me.y + EYE, me.z], cp = Math.cos(look.pitch), sp = Math.sin(look.pitch);
      const moveMul = Math.hypot(me.vx, me.vz) > 2 ? 1.7 : 1, aimMul = 1 - aim * 0.6, maxDist = wp.melee ? wp.range! : 80;
      const hitOne = (p: Person) => {
        hitAt = performance.now();
        sfx.hitmark();
        p.ch.hurt = 0.15;
        if (p.dummy) {
          p.hp -= wp.dmg;
          if (p.hp <= 0 && p.alive) {
            p.alive = false;
            p.respawn = performance.now() + 3000;
            me.kills++;
            addKillCoins();
            addFeed('You eliminated ' + p.name);
            sfx.coin();
            if (me.kills >= WIN_KILLS && !winner) declareWinner(myId);
          }
        } else room?.send({ t: 'hit', to: p.id, dmg: wp.dmg });
      };
      const fwd = [Math.sin(look.yaw), 0, -Math.cos(look.yaw)], rt = [Math.cos(look.yaw), 0, Math.sin(look.yaw)];
      for (let pel = 0; pel < wp.pellets; pel++) {
        const spread = wp.spread * moveMul * aimMul;
        const d = [Math.sin(look.yaw) * cp + (Math.random() - 0.5) * spread, sp + (Math.random() - 0.5) * spread, -Math.cos(look.yaw) * cp + (Math.random() - 0.5) * spread];
        const dl = Math.hypot(d[0], d[1], d[2]);
        d.forEach((_, i) => (d[i] /= dl));
        let dist = maxDist;
        for (const b of BOXES) {
          const t = rayBox(o, d, b.x, b.z, b.y, b.top, b.w / 2, b.d / 2);
          if (t >= 0 && t < dist) dist = t;
        }
        if (d[1] < -1e-6) dist = Math.min(dist, -o[1] / d[1]);
        const targets = [...others.values(), ...dummies], along: { p: Person; t: number }[] = [];
        for (const p of targets) {
          if (!p.alive) continue;
          const t = rayBox(o, d, p.x, p.z, p.y, p.y + PH + 0.3, HS + 0.08, HS + 0.08);
          if (t >= 0 && t < dist) along.push({ p, t });
        }
        along.sort((a, b) => a.t - b.t);
        const hd = along.length ? along[0].t : dist;
        const end = [o[0] + d[0] * hd, o[1] + d[1] * hd, o[2] + d[2] * hd];
        const start = [o[0] + rt[0] * 0.22 + fwd[0] * 0.7, o[1] - 0.18, o[2] + rt[2] * 0.22 + fwd[2] * 0.7];
        if (!wp.melee) {
          addTracer(start, end, wp.laser ? [1, 0.15, 0.15] : col, !!wp.laser);
          room?.send({ t: 'shot', a: start, b: end, big: !!wp.laser });
          if (!along.length) addFx(end, 'spark');
        }
        if (along.length) wp.pierce ? along.forEach((h) => hitOne(h.p)) : hitOne(along[0].p);
        if (wp.splash) {
          addFx(end, 'boom', wp.splash / 3);
          sfx.boom(Math.min(2, wp.splash / 3), spatial(end[0], end[2], me.x, me.z, look.yaw, 60));
          const already = new Set(along.length && !wp.pierce ? [along[0].p] : along.map((h) => h.p));
          for (const p of targets) if (p.alive && !already.has(p) && Math.hypot(p.x - end[0], p.y + PH / 2 - end[1], p.z - end[2]) <= wp.splash) hitOne(p);
        }
      }
      if (wp.melee) swingAt = performance.now();
      else kickAt = performance.now();
      if (!wp.melee && me.ammo <= 0) startReload();
    };
    const switchWeapon = (key: string, force = false) => {
      if (!WEAPONS[key] || (!force && (!me.alive || me.weapon === key || !me.owned.has(key)))) return;
      me.ammoBy[me.weapon] = me.ammo;
      me.weapon = key;
      me.ammo = me.ammoBy[key];
      me.reloading = false;
      setViewGun(key);
    };

    // ---- viewmodel (drawn over the world) ----
    const vm = new THREE.Group();
    camera.add(vm);
    const clearer = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true }));
    clearer.position.z = -0.2;
    clearer.renderOrder = 999;
    clearer.onBeforeRender = (r) => r.clearDepth();
    camera.add(clearer);
    let vGun: Gun | null = null, vGun2: Gun | null = null;
    const flashM = new THREE.MeshBasicMaterial({ map: flashTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(2, 1.7, 1.2) });
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), flashM);
    const flashLight = new THREE.PointLight('#ffcf7a', 0, 6, 2);
    const onTop = (o: THREE.Object3D) =>
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = (mesh.material as THREE.Material).clone();
        (mesh.material as THREE.Material).transparent = true;
        mesh.renderOrder = 1000;
        mesh.castShadow = false;
      });
    const handMesh = (glove = true) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 12), new THREE.MeshStandardMaterial({ color: glove ? '#e8ecf2' : hex(col), roughness: 0.55 })));
      const sl = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.2, 4, 12), new THREE.MeshStandardMaterial({ color: new THREE.Color(hex(col)).multiplyScalar(0.7), roughness: 0.6 }));
      sl.rotation.x = Math.PI / 2;
      sl.position.set(0, -0.015, 0.15);
      g.add(sl);
      return g;
    };
    function setViewGun(key: string) {
      if (vGun) vm.remove(vGun.group);
      if (vGun2) vm.remove(vGun2.group);
      vGun = buildGun(key);
      vGun.group.rotation.y = Math.PI;
      const rh = handMesh();
      rh.position.set(0, -0.03, 0.02);
      rh.rotation.y = Math.PI;
      vGun.group.add(rh);
      // a support hand on the forend of long guns (short guns are held one-handed)
      if (vGun.len >= 0.35 && key !== 'machete') {
        const lh = handMesh();
        lh.position.set(-0.035, -0.005, Math.min(0.34, vGun.len * 0.5));
        lh.rotation.set(0.15, Math.PI - 1.0, 0);
        vGun.group.add(lh);
      }
      vGun.muzzle.add(flash, flashLight);
      flash.rotation.y = Math.PI;
      onTop(vGun.group);
      vm.add(vGun.group);
      vGun2 = null;
      if (key === 'akimbo') {
        vGun2 = buildGun('akimbo');
        vGun2.group.rotation.y = Math.PI;
        const h2 = handMesh();
        h2.position.set(0, -0.03, 0.02);
        h2.rotation.y = Math.PI;
        vGun2.group.add(h2);
        onTop(vGun2.group);
        vm.add(vGun2.group);
      }
    }
    setViewGun(me.weapon);

    // ---- input ----
    const setP = (p: boolean) => {
      isPaused = p;
      setPaused(p);
      if (p) (keys = {}), (mouseL = false), (scoped = false);
    };
    const active = () => !!c.offsetParent && !c.closest('.win')?.classList.contains('inactive');
    const KM: Record<string, string> = { w: 'w', a: 'a', s: 's', d: 'd', ' ': 'space', Shift: 'shift', Tab: 'tab' };
    const ownedList = () => WEAPON_KEYS.filter((k) => me.owned.has(k));
    const kd = (e: KeyboardEvent) => {
      if (!active() || isPaused || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) return;
      const down = e.type === 'keydown', nm = e.key.length === 1 ? e.key.toLowerCase() : e.key, k = KM[nm];
      if (down && nm === 'Escape') return setP(true);
      if (down && nm === 'r') return startReload();
      if (down && nm >= '1' && nm <= '9') {
        const l = ownedList();
        return switchWeapon(l[+nm - 1] ?? me.weapon);
      }
      if (k) (keys[k] = down), e.preventDefault();
    };
    const md = (e: MouseEvent) => {
      if (isPaused) return;
      c.focus();
      e.preventDefault();
      if (e.button === 0) {
        mouseL = true;
        if (fireCool <= 0) fire(), (fireCool = WEAPONS[me.weapon].rate);
      } else if (e.button === 2) scoped = true;
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0) mouseL = false;
      if (e.button === 2) scoped = false;
    };
    const wheel = (e: WheelEvent) => {
      if (isPaused) return;
      e.preventDefault();
      const l = ownedList();
      if (l.length < 2) return;
      switchWeapon(l[(l.indexOf(me.weapon) + (e.deltaY > 0 ? 1 : -1) + l.length) % l.length]);
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
      vote: (i: number) => {
        myVote = i;
        if (room) room.send({ t: 'vote', map: i });
        else (voteCounts = allMapNames().map(() => 0)), (voteCounts[i] = 1);
        refreshInter();
      },
      buy: (k: string) => {
        const wp = WEAPONS[k], node = SKILL_TREE[k];
        if (!wp || me.owned.has(k) || me.coins < wp.price || (node.req && !me.owned.has(node.req))) return;
        me.coins -= wp.price;
        me.owned.add(k);
        persist();
        refreshInter();
      },
      go: () => finishInter(myVote >= 0 ? myVote : Math.floor(Math.random() * allMapNames().length)),
    };

    // ---- loop ----
    const tagPool: HTMLDivElement[] = [];
    let alive = true, prev = performance.now(), acc = 0, lastSend = 0, fov = 75;
    const tmp = new THREE.Vector3();
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      if (c.offsetParent) {
        st.fit();
        acc += dt;
        if (!isPaused) {
          const sens = scoped && SCOPED.has(me.weapon) ? 0.35 : 1;
          const y0 = look.yaw, p0 = look.pitch;
          look.tick(dt);
          look.yaw = y0 + (look.yaw - y0) * sens;
          look.pitch = p0 + (look.pitch - p0) * sens;
          while (acc >= 1 / 60) step(1 / 60), (acc -= 1 / 60);
        } else acc = 0;
        if (me.reloading && now >= me.reloadEndAt) (me.reloading = false), (me.ammo = WEAPONS[me.weapon].mag);
        aim += ((scoped && me.alive && !isPaused ? 1 : 0) - aim) * Math.min(1, dt * 10);
        const tf = 75 - aim * (75 - (SCOPE_FOV[me.weapon] || 60));
        fov += (tf - fov) * Math.min(1, dt * 9);
        if (Math.abs(camera.fov - fov) > 0.01) (camera.fov = fov), camera.updateProjectionMatrix();
        fireCool -= dt;
        if (mouseL && !isPaused && fireCool <= 0 && WEAPONS[me.weapon].auto) fire(), (fireCool = WEAPONS[me.weapon].rate);
        if (!me.alive && now >= me.respawnAt && !winner) spawn();
        if (mapVariant === LAVA && me.alive && me.y <= 0.05) {
          me.hp -= 55 * dt;
          if (now - dmgAt > 400) sfx.hurt(), sfx.gun('flame', { vol: 0.5, pitch: 0.7 });
          dmgAt = now;
          if (me.hp <= 0) {
            me.hp = 0;
            me.alive = false;
            me.deaths++;
            me.streak = 0;
            me.respawnAt = now + 3000;
            addFeed(myName + ' fell into the lava');
            room?.send({ t: 'dead', by: myId });
          }
        }
        if (winner && !interOpen) openInter();
        if (interOpen && now >= interEnd) {
          if (!room) api.current.go();
          else if (room.isHost) {
            const m = tally();
            room.send({ t: 'nextmap', map: m });
            finishInter(m);
          } else if (now >= interEnd + 5000) api.current.go();
        }
        // training bots: chase, keep range, strafe and shoot back
        for (const d of dummies) {
          if (!d.alive) {
            if (now >= (d.respawn ?? 0)) (d.alive = true), (d.hp = 100);
            d.ch.update(dt, 0, { dead: true });
            continue;
          }
          const toX = me.x - d.x, toZ = me.z - d.z, dist = Math.hypot(toX, toZ), ox = d.x, oz = d.z;
          const blocked = (nx: number, nz: number) => BOXES.some((b) => Math.abs(nx - b.x) < b.w / 2 + 0.4 && Math.abs(nz - b.z) < b.d / 2 + 0.4 && b.top > d.y + 0.5 && b.y < d.y + 1.5);
          if (me.alive && dist < 24 && canSee(d.x, d.y + EYE, d.z)) {
            d.yaw = Math.atan2(toX, toZ);
            const side = d.yaw + Math.PI / 2, sway = Math.sin(now * 0.0011 + d.x), pull = dist > 11 ? 1 : dist < 7 ? -1 : 0;
            const nx = d.x + (toX / (dist || 1)) * pull * 2.6 * dt + Math.sin(side) * sway * dt * 1.5, nz = d.z + (toZ / (dist || 1)) * pull * 2.6 * dt + Math.cos(side) * sway * dt * 1.5;
            if (!blocked(nx, nz)) (d.x = nx), (d.z = nz);
            d.fireCool = (d.fireCool ?? 0) - dt;
            if (d.fireCool <= 0) {
              d.fireCool = 0.55 + Math.random() * 0.5;
              const a2 = Math.max(0.15, 1 - dist / 28), dmg = Math.round((10 + Math.random() * 8) * a2);
              const from = d.gun ? d.gun.muzzle.getWorldPosition(tmp).toArray() : [d.x, d.y + 1.4, d.z];
              const hitMe = Math.random() < 0.75 * a2 + 0.1;
              sfx.gun('pistol', spatial(d.x, d.z, me.x, me.z, look.yaw, 45));
              addTracer(from, hitMe ? [me.x, me.y + 1.3, me.z] : [me.x + (Math.random() - 0.5) * 2, me.y + 1 + Math.random(), me.z + (Math.random() - 0.5) * 2], [1, 0.6, 0.2], false);
              if (hitMe) {
                me.hp -= dmg;
                dmgAt = now;
                sfx.hurt();
                if (me.hp <= 0 && me.alive) {
                  me.alive = false;
                  me.hp = 0;
                  me.deaths++;
                  me.streak = 0;
                  me.respawnAt = now + 3000;
                  d.kills++;
                  addFeed(d.name + ' eliminated you');
                }
              }
            }
          } else {
            const g = d.goal!, gx = g[0] - d.x, gz = g[1] - d.z, l = Math.hypot(gx, gz);
            if (l < 0.5 || Math.random() < 0.004) d.goal = [(Math.random() - 0.5) * 32, (Math.random() - 0.5) * 32];
            else {
              const nx = d.x + (gx / l) * 2.4 * dt, nz = d.z + (gz / l) * 2.4 * dt;
              if (!blocked(nx, nz)) (d.x = nx), (d.z = nz), (d.yaw = Math.atan2(gx, gz));
              else d.goal = [(Math.random() - 0.5) * 32, (Math.random() - 0.5) * 32];
            }
          }
          const spd = Math.hypot(d.x - ox, d.z - oz) / Math.max(dt, 1e-3);
          d.spd += (spd - d.spd) * Math.min(1, dt * 8);
          d.ch.root.position.set(d.x, d.y, d.z);
          d.ch.root.rotation.y = d.yaw;
          d.ch.update(dt, d.spd, { aim: 0 });
        }
        for (const o of others.values()) {
          if (!o.inited) continue;
          const px = o.x, pz = o.z;
          o.x += (o.tx - o.x) * Math.min(1, dt * 14);
          o.y += (o.ty - o.y) * Math.min(1, dt * 14);
          o.z += (o.tz - o.z) * Math.min(1, dt * 14);
          o.spd += (Math.hypot(o.x - px, o.z - pz) / Math.max(dt, 1e-3) - o.spd) * Math.min(1, dt * 8);
          o.ch.root.position.set(o.x, o.y, o.z);
          o.ch.root.rotation.y = o.yaw;
          o.ch.update(dt, o.spd, { aim: o.pitch, dead: !o.alive, air: o.y > 0.05 && !BOXES.some((b) => Math.abs(o.x - b.x) < b.w / 2 + 0.4 && Math.abs(o.z - b.z) < b.d / 2 + 0.4 && Math.abs(o.y - b.top) < 0.1) });
        }
        for (const p of [...others.values(), ...dummies]) if (p.gun?.spin) p.gun.spin.rotation.z += dt * 6;
        if (room && now - lastSend > 50) {
          lastSend = now;
          room.send({ t: 's', x: me.x, y: me.y, z: me.z, yaw: Math.PI - look.yaw, pitch: look.pitch, hp: me.hp, alive: me.alive, wpn: me.weapon });
        }
        // camera + viewmodel
        const bob = Math.sin(bobT) * 0.035 * (1 - aim);
        camera.position.set(me.x, me.y + EYE + (me.alive ? Math.abs(bob) * 0.5 : -1.2), me.z);
        camera.rotation.set(look.pitch, -look.yaw, me.alive ? 0 : 0.5, 'YXZ');
        sky.position.copy(camera.position);
        const wp = WEAPONS[me.weapon];
        const kick = Math.max(0, 1 - (now - kickAt) / 90), swing = Math.max(0, 1 - (now - swingAt) / 280);
        const rp = me.reloading ? Math.max(0, Math.min(1, 1 - (me.reloadEndAt - now) / (wp.reload * 1000))) : 0, dip = Math.sin(rp * Math.PI) * 0.24;
        const scopedHide = aim > 0.85 && SCOPED.has(me.weapon);
        vm.visible = me.alive && !scopedHide;
        if (vGun) {
          vGun.group.position.set(0.2 * (1 - aim) + Math.sin(bobT * 0.5) * 0.012, -0.19 + aim * 0.13 - dip - Math.abs(bob) * 0.4, -0.5 + kick * 0.06 + aim * 0.1);
          vGun.group.rotation.set(kick * 0.18 - swing * 1.4 + dip * 1.5, Math.PI - swing * 0.6, rp * 0.6);
          if (vGun.spin) vGun.spin.rotation.z += dt * (mouseL ? 30 : 4);
        }
        if (vGun2) {
          vGun2.group.position.set(-0.2 + Math.sin(bobT * 0.5) * 0.012, -0.19 - dip - Math.abs(bob) * 0.4, -0.5 + kick * 0.06);
          vGun2.group.rotation.set(kick * 0.18 + dip * 1.5, Math.PI, -rp * 0.6);
        }
        flash.visible = kick > 0.4;
        flash.scale.setScalar(0.6 + Math.random() * 0.6);
        flash.rotation.z = Math.random() * 6;
        flashLight.intensity = kick * 8;
        if (lavaMat) T.lava.offset.set((now / 9000) % 1, (now / 13000) % 1);
        if (mapVariant === LAVA) lavaLights.forEach((l, i) => (l.intensity = 26 + Math.sin(now / 300 + i * 2) * 6));
        // effects
        for (let i = tracers.length - 1; i >= 0; i--) {
          const t = tracers[i], age = now - t.at;
          if (age > t.life) {
            scene.remove(t.m);
            (t.m.material as THREE.Material).dispose();
            tracers.splice(i, 1);
          } else (t.m.material as THREE.MeshBasicMaterial).opacity = 1 - age / t.life;
        }
        for (let i = fxs.length - 1; i >= 0; i--) {
          const f = fxs[i], k = (now - f.at) / f.life;
          if (k >= 1) {
            scene.remove(f.m);
            fxs.splice(i, 1);
            continue;
          }
          const sph = f.m.children[0] as THREE.Mesh;
          sph.scale.setScalar(f.kind === 'boom' ? f.size * (0.4 + k * 2.6) : 1 + k * 2);
          (sph.material as THREE.MeshBasicMaterial).opacity = 1 - k;
          if (f.light) f.light.intensity *= 0.85;
        }
        st.render();
        // tags, hud
        const list = [...others.values(), ...dummies].filter((p) => p.alive && p.inited);
        while (tagPool.length < list.length) {
          const d = document.createElement('div');
          d.className = 'r3-tag';
          ui.tags.current?.appendChild(d);
          tagPool.push(d);
        }
        tagPool.forEach((d, i) => {
          const p = list[i];
          const pos = p && st.project(tmp.set(p.x, p.y + 2.75, p.z));
          if (!pos || !canSee(p.x, p.y + 1, p.z)) return void (d.style.display = 'none');
          d.style.display = 'block';
          d.style.left = pos[0] + 'px';
          d.style.top = pos[1] + 'px';
          d.textContent = p.name + '  ' + Math.max(0, Math.round(p.hp));
        });
        if (ui.hp.current) {
          const bar = ui.hp.current.firstElementChild as HTMLElement;
          bar.style.width = Math.max(0, me.hp) + '%';
          bar.style.background = me.hp > 50 ? 'linear-gradient(#8ff07a,#2fb52a)' : me.hp > 25 ? 'linear-gradient(#ffe17a,#e0a800)' : 'linear-gradient(#ff8a7a,#d63a2b)';
          (ui.hp.current.lastElementChild as HTMLElement).textContent = String(Math.max(0, Math.ceil(me.hp)));
        }
        if (ui.ammo.current) ui.ammo.current.innerHTML = `<b>${wp.n}</b><span>${me.reloading ? 'Reloading...' : wp.melee ? 'Melee' : (isFinite(wp.mag) ? me.ammo : '∞') + ' / ' + wp.mag}</span>`;
        if (ui.hud.current) ui.hud.current.textContent = (room ? `Room ${room.code}   ·   ${room.count} / 4 players` : 'Practice') + `   ·   ${MAP_NAMES[mapVariant] ?? allMapNames()[mapVariant]}   ·   Kills ${me.kills} / ${WIN_KILLS}   ·   ${me.coins} coins` + (me.streak >= 3 ? `   ·   Streak +${Math.floor(me.streak / 3)}/kill` : '');
        if (ui.feed.current) ui.feed.current.innerHTML = feed.filter((f) => now - f.at < 6000).map((f) => `<div>${f.t.replace(/</g, '&lt;')}</div>`).join('');
        if (ui.hit.current) ui.hit.current.style.opacity = String(Math.max(0, 1 - (now - hitAt) / 180));
        if (ui.dmg.current) ui.dmg.current.style.opacity = String(Math.max(0, 0.6 - (now - dmgAt) / 500) * (me.alive ? 1 : 0.4));
        if (ui.scope.current) ui.scope.current.style.opacity = scopedHide ? '1' : '0';
        if (ui.cross.current) ui.cross.current.style.opacity = scopedHide ? '0' : String(1 - aim * 0.5);
        if (!me.alive && !winner) center('You were eliminated. Respawning in ' + Math.max(0, Math.ceil((me.respawnAt - now) / 1000)) + '...');
        if (ui.board.current) {
          ui.board.current.style.display = keys.tab ? 'block' : 'none';
          if (keys.tab)
            ui.board.current.innerHTML =
              '<div class="arn-bh">Scoreboard</div>' +
              [myId, ...others.keys(), ...dummies.map((d) => d.id)]
                .map((id) => ({ id, n: nameOf(id), k: (scoreOf(id) as any).kills, d: (scoreOf(id) as any).deaths }))
                .sort((a, b) => b.k - a.k)
                .map((r) => `<div class="arn-br"><span>${r.n.replace(/</g, '&lt;')}${r.id === myId ? ' (you)' : ''}</span><b>${r.k} kills</b><i>${r.d} deaths</i></div>`)
                .join('');
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    (c as any)._arena = { me, look, others, dummies, fire, switchWeapon, buildMap: (v: number) => ((mapVariant = v), buildMap(), spawn(), makeDummies()) };
    const tickT = window.setInterval(() => interOpen && tick((x) => x + 1), 500);
    return () => {
      alive = false;
      window.clearInterval(tickT);
      window.removeEventListener('arena-owned', onOwned);
      removeEventListener('keydown', kd);
      removeEventListener('keyup', kd);
      removeEventListener('mouseup', mu);
      c.removeEventListener('mousedown', md);
      c.removeEventListener('wheel', wheel);
      document.removeEventListener('pointerdown', away);
      look.dispose();
      tagPool.forEach((d) => d.remove());
      st.dispose();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tiers = [1, 2, 3, 4, 5, 6].map((t) => WEAPON_KEYS.filter((k) => SKILL_TREE[k]?.tier === t));
  return (
    <div className="r3-game arn-game">
      <canvas ref={cv} tabIndex={0} onContextMenu={(e) => e.preventDefault()} />
      <div className="arn-cross" ref={ui.cross} />
      <div className="arn-hit" ref={ui.hit} />
      <div className="arn-dmg" ref={ui.dmg} />
      <div className="arn-scope" ref={ui.scope} />
      <div className="r3-hud" ref={ui.hud} />
      <div className="arn-hp" ref={ui.hp}>
        <i />
        <span />
      </div>
      <div className="arn-ammo" ref={ui.ammo} />
      <div className="arn-feed" ref={ui.feed} />
      <div className="arn-board" ref={ui.board} />
      <div className="r3-tags" ref={ui.tags} />
      <div className="arn-center" ref={ui.center} />
      {err && <div className="r3-big">{err}</div>}
      {paused && !inter && !err && (
        <div className="r3-pause" onMouseDown={(e) => e.target === e.currentTarget && api.current?.play()}>
          <b onMouseDown={() => api.current?.play()}>Click to play</b>
          <small>Esc pauses. In a room, the game keeps running for your friends.</small>
          <button className="k-btn" onMouseDown={(e) => e.stopPropagation()} onClick={onExit}>{s.room ? 'Leave the room' : 'Back to the lobby'}</button>
        </div>
      )}
      {inter && (
        <div className="arn-int">
          <div className="arn-intbox">
            <h3>{inter.winner} won! Vote for the next map.</h3>
            <div className="arn-maps">
              {allMapNames().map((nm, i) => (
                <button key={nm + i} className={'k-btn' + (inter.myVote === i ? ' default' : '')} onClick={() => api.current?.vote(i)}>
                  {nm}
                  {inter.votes[i] ? ` (${inter.votes[i]})` : ''}
                </button>
              ))}
            </div>
            <b>Skill tree: you have {inter.coins} coins</b>
            <div className="arn-tree">
              {tiers.map((keys, t) => (
                <div key={t} className="arn-tier">
                  {keys.map((k) => {
                    const wp = WEAPONS[k], node = SKILL_TREE[k], owned = inter.owned.includes(k), reqOk = !node.req || inter.owned.includes(node.req);
                    return (
                      <div key={k} className={'arn-node' + (owned ? ' owned' : '') + (!reqOk ? ' locked' : '')}>
                        <b>{wp.n}</b>
                        <span>{owned ? 'Unlocked' : !reqOk ? 'Needs ' + WEAPONS[node.req!].n : wp.price + ' coins'}</span>
                        <button className="k-btn" disabled={owned || !reqOk || inter.coins < wp.price} onClick={() => api.current?.buy(k)}>
                          {owned ? 'Owned' : !reqOk ? 'Locked' : 'Unlock'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="arn-foot">
              <span>Next map in {Math.max(0, Math.ceil((inter.endsAt - Date.now()) / 1000))}s</span>
              {inter.solo ? <button className="k-btn default" onClick={() => api.current?.go()}>Continue now</button> : <small>{inter.host ? 'You are the host.' : 'Waiting on the host...'}</small>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
