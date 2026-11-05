// Backrooms, remade: an endless, modelled maze of yellow rooms (wallpaper, baseboards, damp carpet,
// ceiling tiles, humming fluorescent fixtures, outlets and vents), explored alone or with up to 3 friends.
// Something else walks here too.
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import { createStage, canvasTex, noise, THREE, matte } from './engine';
import { Character, Entity, blobShadow, rbox } from './models';
import { Look } from './r3';
import { LobbyResult, RoomLobby } from './Lobby';
import { reportHosted } from '../../core/invites';
import { hum, sfx, spatial } from '../../core/sfx';

export function bkHash(x: number, z: number, s: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const COLORS = ['#3d8fe8', '#e84a6a', '#38c172', '#f2a13a', '#9b5de5', '#22c3d6', '#ff7ab8', '#f5d33a'];

// ---------- textures ----------
const wallpaperTex = (rx: number, ry: number) =>
  canvasTex(
    256,
    (g, s) => {
      g.fillStyle = '#c9b25a';
      g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 32) {
        g.fillStyle = 'rgba(255,240,170,.18)';
        g.fillRect(x, 0, 12, s);
        g.fillStyle = 'rgba(90,70,10,.10)';
        g.fillRect(x + 14, 0, 2, s);
      }
      g.strokeStyle = 'rgba(110,90,20,.22)';
      g.lineWidth = 2;
      for (let y = 16; y < s; y += 32)
        for (let x = 16; x < s; x += 32) {
          g.beginPath();
          g.moveTo(x, y - 6);
          g.lineTo(x + 5, y);
          g.lineTo(x, y + 6);
          g.lineTo(x - 5, y);
          g.closePath();
          g.stroke();
        }
      noise(g, s, 5000, 0.08);
      noise(g, s, 1500, 0.07, true);
      const st = g.createRadialGradient(190, 200, 4, 190, 200, 60);
      st.addColorStop(0, 'rgba(110,80,10,.22)');
      st.addColorStop(1, 'rgba(110,80,10,0)');
      g.fillStyle = st;
      g.fillRect(0, 0, s, s);
    },
    [rx, ry],
  );
const carpetTex = () =>
  canvasTex(
    512,
    (g, s) => {
      g.fillStyle = '#8b743a';
      g.fillRect(0, 0, s, s);
      noise(g, s, 60000, 0.18, false, 1);
      noise(g, s, 30000, 0.1, true, 1);
      for (let i = 0; i < 6; i++) {
        const x = (i * 173) % s, y = (i * 311) % s, r = 30 + (i * 37) % 60;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(60,40,10,.35)');
        gr.addColorStop(1, 'rgba(60,40,10,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, s, s);
      }
    },
    [1, 1],
  );
const ceilingTex = () =>
  canvasTex(
    256,
    (g, s) => {
      g.fillStyle = '#dcd8c4';
      g.fillRect(0, 0, s, s);
      noise(g, s, 4000, 0.12);
      g.fillStyle = 'rgba(90,85,70,.5)';
      for (let y = 6; y < s; y += 14) for (let x = 6 + ((y / 14) % 2) * 7; x < s; x += 14) g.fillRect(x, y, 2, 2);
      g.fillStyle = '#9d9a8c';
      g.fillRect(0, 0, s, 5);
      g.fillRect(0, 0, 5, s);
    },
    [1, 1],
  );

export function Backrooms({ win }: { win: WinCtx }) {
  const color = useRef(COLORS[Math.floor(Math.random() * COLORS.length)]).current;
  const [s, setS] = useState<LobbyResult | null>(null);
  return (
    <div className="r3 bkr">
      {!s ? (
        <RoomLobby
          kind="backrooms"
          title="Backrooms"
          blurb="Wander an endless maze of yellow rooms with your friends. No combat, just explore. And try not to look behind you."
          nameKey="koalos.backrooms"
          max={4}
          info={() => ({ color })}
          soloLabel="Explore alone"
          hint={<>W A S D move {'·'} Shift run {'·'} Mouse look {'·'} Esc releases the mouse</>}
          autoJoin={win.props.joinCode}
          autoHost={!!win.props.autoHost}
          onHosted={(code) => reportHosted('kbackrooms', code)}
          onStart={setS}
        />
      ) : (
        <Game s={s} color={color} onExit={() => setS(null)} />
      )}
    </div>
  );
}

function Game({ s, color, onExit }: { s: LobbyResult; color: string; onExit(): void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const tagsEl = useRef<HTMLDivElement>(null);
  const vign = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(true);
  const [err, setErr] = useState('');
  const ctl = useRef<{ play(): void } | null>(null);

  useEffect(() => {
    const c = cv.current!;
    const room = s.room;
    const cleanup = () => {
      s.dir?.unregister();
      s.dir?.leave();
      room?.leave();
    };
    const st = createStage(c, { bloom: 0.42, fov: 78, near: 0.05, far: 60, env: 0.3 });
    if (!st) {
      setErr('Backrooms needs WebGL, which your browser has turned off.');
      return cleanup;
    }
    const { scene, camera } = st;
    let seed = 1 + Math.floor(Math.random() * 1e6);
    const CS = 6, WT = 0.3, WH = 3.2, PR = 0.32, EYE = 1.62, R = 4;
    scene.background = new THREE.Color('#8a7a3a');
    scene.fog = new THREE.Fog('#8a7a3a', 9, 30);
    scene.add(new THREE.AmbientLight('#fff2c0', 0.55));
    const hemi = new THREE.HemisphereLight('#fff6d6', '#6b5520', 1.1);
    scene.add(hemi);
    const lamps = Array.from({ length: 5 }, () => {
      const l = new THREE.PointLight('#fff1c2', 9, 11, 1.6);
      scene.add(l);
      return l;
    });

    // ---- level pieces (instanced, rebuilt as you move) ----
    const N = (2 * R + 1) ** 2;
    const wallM = matte('#ffffff', 0.92, { map: wallpaperTex((CS + WT) / 1.2, WH / 1.2) });
    const wallE = new THREE.InstancedMesh(new THREE.BoxGeometry(WT, WH, CS + WT), wallM, N);
    const wallS = new THREE.InstancedMesh(new THREE.BoxGeometry(CS + WT, WH, WT), wallM, N);
    const baseM = matte('#7a6a33', 0.6);
    const baseE = new THREE.InstancedMesh(new THREE.BoxGeometry(WT + 0.05, 0.14, CS + WT), baseM, N);
    const baseS = new THREE.InstancedMesh(new THREE.BoxGeometry(CS + WT, 0.14, WT + 0.05), baseM, N);
    const frameM = new THREE.MeshStandardMaterial({ color: '#c9c6ba', roughness: 0.4, metalness: 0.6 });
    const frames = new THREE.InstancedMesh(rbox(1.3, 0.07, 0.62, 0.02), frameM, N * 2);
    const panelM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.6, 1.25), toneMapped: false });
    const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(1.18, 0.02, 0.5), panelM, N * 2);
    panels.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 2 * 3), 3);
    const outlets = new THREE.InstancedMesh(rbox(0.09, 0.13, 0.03, 0.01), matte('#efe8d0', 0.5), N);
    const vents = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.22, 0.04), new THREE.MeshStandardMaterial({ color: '#b9b4a0', roughness: 0.5, metalness: 0.5, map: canvasTex(64, (g, sz) => { g.fillStyle = '#b9b4a0'; g.fillRect(0, 0, sz, sz); g.fillStyle = '#4a463a'; for (let y = 6; y < sz; y += 10) g.fillRect(4, y, sz - 8, 4); }) }), N);
    const all = [wallE, wallS, baseE, baseS, frames, panels, outlets, vents];
    all.forEach((m) => scene.add(m));
    const floorSize = (2 * R + 2) * CS;
    const carpet = carpetTex();
    carpet.repeat.set(floorSize / 3, floorSize / 3);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorSize, floorSize), matte('#ffffff', 0.98, { map: carpet }));
    floor.rotation.x = -Math.PI / 2;
    const ceilT = ceilingTex();
    ceilT.repeat.set(floorSize / 0.6, floorSize / 0.6);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(floorSize, floorSize), matte('#ffffff', 0.9, { map: ceilT }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = WH;
    scene.add(floor, ceil);

    const hasE = (cx: number, cz: number) => !(cx === 0 && cz === 0) && bkHash(cx, cz, seed + 1) > 0.62;
    const hasS = (cx: number, cz: number) => !(cx === 0 && cz === 0) && bkHash(cx, cz, seed + 2) > 0.62;
    const lampSpots: THREE.Vector3[] = [];
    let builtFor = '';
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
    const put = (im: THREE.InstancedMesh, i: number, x: number, y: number, z: number, ry = 0) => {
      Q.setFromAxisAngle(V.set(0, 1, 0), ry);
      im.setMatrixAt(i, M4.compose(new THREE.Vector3(x, y, z), Q, ONE));
    };
    const build = (cx0: number, cz0: number) => {
      const key = cx0 + ',' + cz0 + ',' + seed;
      if (key === builtFor) return;
      builtFor = key;
      let ne = 0, ns = 0, nf = 0, no = 0, nv = 0;
      lampSpots.length = 0;
      for (let cz = cz0 - R; cz <= cz0 + R; cz++)
        for (let cx = cx0 - R; cx <= cx0 + R; cx++) {
          const x0 = cx * CS + CS / 2, z0 = cz * CS + CS / 2;
          if (hasE(cx, cz)) {
            put(wallE, ne, x0 + CS / 2, WH / 2, z0);
            put(baseE, ne, x0 + CS / 2, 0.07, z0);
            ne++;
          }
          if (hasS(cx, cz)) {
            put(wallS, ns, x0, WH / 2, z0 + CS / 2);
            put(baseS, ns, x0, 0.07, z0 + CS / 2);
            ns++;
            const h = bkHash(cx, cz, seed + 5);
            if (h > 0.55 && no < N) put(outlets, no++, x0 + (h - 0.75) * 6, 0.32, z0 + CS / 2 - WT / 2 - 0.016);
            if (h < 0.18 && nv < N) put(vents, nv++, x0 + (h - 0.09) * 20, WH - 0.35, z0 + CS / 2 - WT / 2 - 0.02);
          }
          const lights = bkHash(cx, cz, seed + 3) > 0.5 ? 2 : 1;
          for (let k = 0; k < lights; k++) {
            const lx = x0 + (lights === 2 ? (k ? 1.4 : -1.4) : 0), ry = bkHash(cx, cz, seed + 4) > 0.5 ? Math.PI / 2 : 0;
            put(frames, nf, lx, WH - 0.04, z0, ry);
            put(panels, nf, lx, WH - 0.08, z0, ry);
            const dead = bkHash(cx * 3 + k, cz, seed + 6) < 0.07;
            panels.setColorAt(nf, new THREE.Color(dead ? 0.08 : 1, dead ? 0.08 : 1, dead ? 0.07 : 1));
            if (!dead) lampSpots.push(new THREE.Vector3(lx, WH - 0.4, z0));
            nf++;
          }
        }
      wallE.count = baseE.count = ne;
      wallS.count = baseS.count = ns;
      frames.count = panels.count = nf;
      outlets.count = no;
      vents.count = nv;
      all.forEach((m) => (m.instanceMatrix.needsUpdate = true));
      panels.instanceColor!.needsUpdate = true;
      floor.position.set(cx0 * CS + CS / 2, 0, cz0 * CS + CS / 2);
      ceil.position.set(cx0 * CS + CS / 2, WH, cz0 * CS + CS / 2);
    };
    const nearWalls = (px: number, pz: number) => {
      const cx0 = Math.floor(px / CS), cz0 = Math.floor(pz / CS), out: { x: number; z: number; w: number; d: number }[] = [];
      for (let cz = cz0 - 2; cz <= cz0 + 2; cz++)
        for (let cx = cx0 - 2; cx <= cx0 + 2; cx++) {
          if (hasE(cx, cz)) out.push({ x: cx * CS + CS, z: cz * CS + CS / 2, w: WT, d: CS + WT });
          if (hasS(cx, cz)) out.push({ x: cx * CS + CS / 2, z: cz * CS + CS, w: CS + WT, d: WT });
        }
      return out;
    };
    const overl = (x: number, z: number, b: { x: number; z: number; w: number; d: number }) => Math.abs(x - b.x) < b.w / 2 + PR && Math.abs(z - b.z) < b.d / 2 + PR;

    // ---- people ----
    const me = { x: CS / 2, z: CS / 2 };
    type Other = { name: string; ch: Character; x: number; z: number; yaw: number; sx: number; sz: number; inited: boolean; spd: number };
    const others = new Map<string, Other>();
    const addOther = (id: string, name: string, col: string) => {
      const ch = new Character({ body: col || '#e84a6a' });
      ch.root.add(blobShadow());
      ch.root.visible = false;
      scene.add(ch.root);
      others.set(id, { name, ch, x: 0, z: 0, yaw: 0, sx: 0, sz: 0, inited: false, spd: 0 });
    };
    const entity = new Entity();
    entity.root.visible = false;
    scene.add(entity.root);
    let monster: { until: number } | null = null, monsterAt = performance.now() + (10 + Math.random() * 120) * 1000, dreadT = -1e9;
    const showMonster = (x: number, z: number, yaw: number, ms: number) => {
      entity.root.position.set(x, 0, z);
      entity.root.rotation.y = yaw;
      entity.root.visible = true;
      monster = { until: performance.now() + ms };
      dreadT = performance.now();
      sfx.sting();
    };

    let keys: Record<string, boolean> = {}, isPaused = true, lastSend = 0, bobT = 0;
    const setP = (p: boolean) => {
      isPaused = p;
      setPaused(p);
      if (p) keys = {};
    };
    const look = new Look(c, { onUnlock: () => setP(true) });
    const amb = hum();
    let stepAcc = 0, lastBeat = 0;
    if (room) {
      room.on('join', (p: any) => {
        addOther(p.id, p.name || 'Player', p.color);
        if (room.isHost)
          try {
            room.conns.get(p.id)?.send({ t: 'init', seed });
          } catch {
            /* ignore */
          }
      });
      room.on('leave', (id: string) => {
        const o = others.get(id);
        if (o) scene.remove(o.ch.root);
        others.delete(id);
      });
      room.on('msg', (id: string, d: any) => {
        if (!d) return;
        if (d.t === 'init' && !room.isHost) seed = d.seed;
        else if (d.t === 's') {
          const o = others.get(id);
          if (!o) return;
          Object.assign(o, { name: d.name || o.name, x: d.x, z: d.z, yaw: d.yaw });
          if (!o.inited) Object.assign(o, { sx: d.x, sz: d.z, inited: true });
        } else if (d.t === 'monster') showMonster(d.x, d.z, d.yaw, Math.max(0, d.until - Date.now()));
      });
    }

    const step = (dt: number) => {
      const cy = Math.cos(look.yaw), sy = Math.sin(look.yaw), ix = (keys.d ? 1 : 0) - (keys.a ? 1 : 0), iz = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
      // forward = (sin yaw, 0, -cos yaw), right = (cos yaw, 0, sin yaw)
      let dx = ix * cy + iz * sy, dz = ix * sy - iz * cy;
      const l = Math.hypot(dx, dz);
      if (l > 1) (dx /= l), (dz /= l);
      const spd = keys.shift ? 4.6 : 3, walls = nearWalls(me.x, me.z);
      const nx = me.x + dx * spd * dt;
      if (!walls.some((b) => overl(nx, me.z, b))) me.x = nx;
      const nz = me.z + dz * spd * dt;
      if (!walls.some((b) => overl(me.x, nz, b))) me.z = nz;
      if (l > 0.1) {
        bobT += dt * (keys.shift ? 11 : 8);
        stepAcc += dt * (keys.shift ? 11 : 8);
        if (stepAcc > Math.PI) (stepAcc -= Math.PI), sfx.step('carpet', { vol: keys.shift ? 0.8 : 0.55 });
      }
    };

    const pool: HTMLDivElement[] = [];
    const drawTags = () => {
      const list = [...others.values()].filter((o) => o.inited);
      while (pool.length < list.length) {
        const d = document.createElement('div');
        d.className = 'r3-tag';
        tagsEl.current?.appendChild(d);
        pool.push(d);
      }
      pool.forEach((d, i) => {
        const o = list[i];
        const pos = o && st.project(new THREE.Vector3(o.sx, 2.65, o.sz));
        if (!pos) return void (d.style.display = 'none');
        d.style.display = 'block';
        d.style.left = pos[0] + 'px';
        d.style.top = pos[1] + 'px';
        d.textContent = o.name;
      });
    };

    const active = () => !!c.offsetParent && !c.closest('.win')?.classList.contains('inactive');
    const KM: Record<string, string> = { w: 'w', a: 'a', s: 's', d: 'd', Shift: 'shift' };
    const kd = (e: KeyboardEvent) => {
      if (!active() || isPaused || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) return;
      const name = e.key.length === 1 ? e.key.toLowerCase() : e.key, k = KM[name];
      if (e.type === 'keydown' && name === 'Escape') return setP(true);
      if (k) {
        keys[k] = e.type === 'keydown';
        e.preventDefault();
      }
    };
    const away = (e: PointerEvent) => !isPaused && !look.locked && !c.closest('.win')?.contains(e.target as Node) && setP(true);
    addEventListener('keydown', kd);
    addEventListener('keyup', kd);
    document.addEventListener('pointerdown', away);
    ctl.current = {
      play: () => {
        setP(false);
        c.focus();
        look.lock();
      },
    };

    let alive = true, prev = performance.now();
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      if (c.offsetParent) {
        st.fit();
        if (!isPaused) {
          look.tick(dt);
          step(dt);
        }
        build(Math.floor(me.x / CS), Math.floor(me.z / CS));
        // the hum: every light flickers a little together
        const t = now / 1000, fl = 0.86 + 0.12 * Math.sin(t * 6.3) * Math.max(0, Math.sin(t * 0.5)) + 0.02 * Math.sin(t * 41);
        panelM.color.setRGB(1.7 * fl, 1.6 * fl, 1.25 * fl);
        hemi.intensity = 1.1 * fl;
        amb.set(0.6 + fl * 0.4);
        lampSpots.sort((a, b) => (a.x - me.x) ** 2 + (a.z - me.z) ** 2 - ((b.x - me.x) ** 2 + (b.z - me.z) ** 2));
        lamps.forEach((l, i) => {
          const p = lampSpots[i];
          l.visible = !!p;
          if (p) l.position.copy(p), (l.intensity = 9 * fl);
        });
        const bob = Math.sin(bobT) * 0.035;
        camera.position.set(me.x, EYE + bob, me.z);
        camera.rotation.set(look.pitch, -look.yaw, Math.sin(bobT * 0.5) * 0.004, 'YXZ');
        for (const o of others.values()) {
          if (!o.inited) continue;
          const px = o.sx, pz = o.sz;
          o.sx += (o.x - o.sx) * Math.min(1, dt * 10);
          o.sz += (o.z - o.sz) * Math.min(1, dt * 10);
          o.spd += (Math.hypot(o.sx - px, o.sz - pz) / Math.max(dt, 1e-3) - o.spd) * Math.min(1, dt * 8);
          o.ch.root.visible = true;
          o.ch.root.position.set(o.sx, 0, o.sz);
          o.ch.root.rotation.y = Math.PI - o.yaw;
          o.ch.update(dt, o.spd);
          if (o.spd > 1) {
            (o as any).sa = ((o as any).sa ?? 0) + dt * o.spd * 2.4;
            if ((o as any).sa > Math.PI) ((o as any).sa -= Math.PI), sfx.step('carpet', spatial(o.sx, o.sz, me.x, me.z, look.yaw, 18));
          }
        }
        if (room && now - lastSend > 60) {
          lastSend = now;
          room.send({ t: 's', x: me.x, z: me.z, yaw: look.yaw, name: s.name });
        }
        if (!isPaused && (!room || room.isHost) && !monster && now >= monsterAt) {
          const mx = me.x - Math.sin(look.yaw) * 7, mz = me.z + Math.cos(look.yaw) * 7;
          showMonster(mx, mz, Math.PI - look.yaw, 3500);
          room?.send({ t: 'monster', x: mx, z: mz, yaw: Math.PI - look.yaw, until: Date.now() + 3500 });
          monsterAt = now + (10 + Math.random() * 120) * 1000;
        }
        if (monster && now >= monster.until) (monster = null), (entity.root.visible = false);
        if (entity.root.visible) entity.update(dt);
        const scared = now - dreadT < 3500;
        if (scared && now - lastBeat > 850) (lastBeat = now), sfx.heartbeat();
        if (hud.current) {
          hud.current.textContent = (room ? `Room code: ${room.code}   ·   ${room.count} / 4 players` : 'Exploring alone') + '   ·   ' + (scared ? 'Something is behind you...' : 'You feel like you have been here before...');
          hud.current.classList.toggle('scared', scared);
        }
        if (vign.current) vign.current.style.opacity = scared ? String(0.55 + 0.25 * Math.sin(now / 90)) : '0';
        st.render();
        drawTags();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // debug hooks (used by tests): spawn a fake player in front of you, turn the camera, summon the entity
    (c as any)._bk = {
      me: () => me,
      look,
      room: () => room,
      forceMonster: () => (monsterAt = performance.now()),
      testPlayer(dist = 2.5, col = '#3d8fe8') {
        addOther('test' + others.size, 'Test player', col);
        const o = [...others.values()].pop()!;
        const x = me.x + Math.sin(look.yaw) * dist, z = me.z - Math.cos(look.yaw) * dist;
        Object.assign(o, { x, z, sx: x, sz: z, yaw: look.yaw + Math.PI, inited: true });
      },
    };
    return () => {
      alive = false;
      removeEventListener('keydown', kd);
      removeEventListener('keyup', kd);
      document.removeEventListener('pointerdown', away);
      look.dispose();
      amb.stop();
      pool.forEach((d) => d.remove());
      st.dispose();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="r3-game">
      <canvas ref={cv} tabIndex={0} onContextMenu={(e) => e.preventDefault()} />
      <div className="bkr-vign" ref={vign} />
      <div className="r3-cross" />
      <div className="r3-hud" ref={hud} />
      <div className="r3-tags" ref={tagsEl} />
      {err && <div className="r3-big">{err}</div>}
      {paused && !err && (
        <div className="r3-pause" onMouseDown={(e) => e.target === e.currentTarget && ctl.current?.play()}>
          <b onMouseDown={() => ctl.current?.play()}>Click to play</b>
          <small>Esc pauses. In a room, this keeps running for your friends.</small>
          <span className="r3-me" style={{ background: color }} />
          <button className="k-btn" onMouseDown={(e) => e.stopPropagation()} onClick={onExit}>{s.room ? 'Leave the room' : 'Back to the lobby'}</button>
        </div>
      )}
    </div>
  );
}
