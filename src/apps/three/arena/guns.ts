// Weapon models for Arena 3D. Every gun is built from real parts and points along +z with the grip
// at the origin (where the hand holds it). Returns the muzzle point and any part that spins.
import * as THREE from 'three';
import { glow, matte, metal, plastic } from '../engine';
import { rbox, starGeo } from '../models';

export interface Gun {
  group: THREE.Group;
  muzzle: THREE.Object3D;
  spin?: THREE.Object3D;
  len: number;
}

const M = {
  gun: metal('#2b2f36', 0.38),
  dark: matte('#1b1e23', 0.55),
  steel: metal('#a9b2bc', 0.25),
  chrome: metal('#dfe6ee', 0.12),
  wood: matte('#7a4a26', 0.5),
  olive: matte('#4f5a34', 0.6),
  glass: new THREE.MeshPhysicalMaterial({ color: '#7fd0ff', roughness: 0.05, metalness: 0, transmission: 0, clearcoat: 1, emissive: '#1a5a8a', emissiveIntensity: 0.6 }),
  white: plastic('#f2f6fb', 0.25),
  red: plastic('#d63a2b', 0.35),
  yellow: plastic('#ffc21f', 0.35),
  tan: matte('#b9935a', 0.55),
};

type V = [number, number, number];
const add = (g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, p: V, r: V = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p);
  m.rotation.set(...r);
  m.castShadow = true;
  g.add(m);
  return m;
};
/** Cylinder along z. */
const cz = (r: number, len: number, seg = 18, r2 = r) => new THREE.CylinderGeometry(r2, r, len, seg).rotateX(Math.PI / 2);
const bx = (w: number, h: number, d: number, r = 0.008) => rbox(w, h, d, r, 2);

function grip(g: THREE.Group, mat: THREE.Material = M.dark, z = -0.02, h = 0.11) {
  add(g, bx(0.038, h, 0.055, 0.012), mat, [0, -h / 2 + 0.005, z], [0.28, 0, 0]);
  const guard = new THREE.TorusGeometry(0.022, 0.0045, 8, 14, Math.PI);
  add(g, guard, M.gun, [0, -0.012, z + 0.045], [0, Math.PI / 2, Math.PI]);
  add(g, bx(0.008, 0.022, 0.01, 0.003), M.steel, [0, -0.014, z + 0.04], [0.3, 0, 0]);
}
function scope(g: THREE.Group, z: number, y: number, len = 0.2, r = 0.022) {
  add(g, cz(r, len, 20), M.dark, [0, y, z]);
  add(g, cz(r * 1.25, 0.045, 20, r), M.dark, [0, y, z + len / 2]);
  add(g, cz(r * 1.15, 0.035, 20, r), M.dark, [0, y, z - len / 2]);
  add(g, new THREE.CircleGeometry(r * 1.1, 20), M.glass, [0, y, z + len / 2 + 0.024]);
  add(g, bx(0.012, y - 0.04, 0.02), M.gun, [0, (y + 0.04) / 2, z - len * 0.25]);
  add(g, bx(0.012, y - 0.04, 0.02), M.gun, [0, (y + 0.04) / 2, z + len * 0.25]);
}
function mag(g: THREE.Group, z: number, h = 0.12, curve = 0.25, mat: THREE.Material = M.gun) {
  add(g, bx(0.03, h, 0.045, 0.006), mat, [0, -h / 2 + 0.01, z], [-curve, 0, 0]);
}
function stock(g: THREE.Group, mat: THREE.Material, len = 0.2, h = 0.08) {
  add(g, bx(0.04, h, len, 0.015), mat, [0, -0.01, -0.06 - len / 2]);
  add(g, bx(0.044, h + 0.02, 0.02, 0.008), M.dark, [0, -0.01, -0.07 - len]);
}

/** Builds the 3D model of a weapon by its key. */
export function buildGun(key: string): Gun {
  const g = new THREE.Group();
  const muzzle = new THREE.Object3D();
  let spin: THREE.Object3D | undefined;
  let len = 0.3;
  const barrel = (r: number, from: number, to: number, mat: THREE.Material = M.gun, y = 0.035) => add(g, cz(r, to - from), mat, [0, y, (from + to) / 2]);
  const energy = (color: string, l: number, rings: number, big = 1) => {
    len = l;
    const gl = glow(color, 3);
    add(g, bx(0.06 * big, 0.085 * big, l * 0.55, 0.025), M.white, [0, 0.04, l * 0.2]);
    add(g, bx(0.05 * big, 0.05 * big, l * 0.3, 0.02), plastic(color, 0.3), [0, 0.095 * big, l * 0.12]);
    add(g, cz(0.022 * big, l * 0.55), M.white, [0, 0.04, l * 0.62]);
    for (let i = 0; i < rings; i++) add(g, new THREE.TorusGeometry(0.03 * big, 0.007, 8, 20), gl, [0, 0.04, l * 0.4 + (i / Math.max(1, rings - 1)) * l * 0.45]);
    add(g, bx(0.012, 0.012, l * 0.5, 0.004), gl, [0.032 * big, 0.04, l * 0.2]);
    add(g, bx(0.012, 0.012, l * 0.5, 0.004), gl, [-0.032 * big, 0.04, l * 0.2]);
    add(g, new THREE.SphereGeometry(0.018 * big, 12, 10), gl, [0, 0.04, l * 0.9]);
    grip(g, M.white);
    stock(g, M.white, 0.12, 0.07);
    muzzle.position.set(0, 0.04, l * 0.92);
  };

  switch (key) {
    case 'pistol':
    case 'akimbo': {
      len = 0.22;
      const slide = key === 'akimbo' ? M.chrome : M.gun;
      add(g, bx(0.04, 0.045, 0.2, 0.01), slide, [0, 0.04, 0.06]);
      add(g, bx(0.036, 0.028, 0.17, 0.008), M.dark, [0, 0.008, 0.05]);
      for (let i = 0; i < 5; i++) add(g, bx(0.042, 0.03, 0.004, 0.001), M.dark, [0, 0.045, -0.02 + i * 0.008]);
      barrel(0.009, 0.15, 0.175, M.steel, 0.045);
      add(g, bx(0.006, 0.01, 0.01, 0.002), M.dark, [0, 0.066, 0.15]);
      add(g, bx(0.02, 0.01, 0.01, 0.002), M.dark, [0, 0.066, -0.025]);
      grip(g, key === 'akimbo' ? M.wood : M.dark, -0.015, 0.1);
      muzzle.position.set(0, 0.045, 0.18);
      break;
    }
    case 'revolver': {
      len = 0.28;
      add(g, bx(0.032, 0.05, 0.1, 0.01), M.steel, [0, 0.035, 0.02]);
      const cyl = add(g, cz(0.03, 0.055, 6), M.chrome, [0, 0.03, 0.04]);
      cyl.rotation.z = Math.PI / 6;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(g, cz(0.007, 0.002, 8), M.dark, [Math.cos(a) * 0.018, 0.03 + Math.sin(a) * 0.018, 0.068]);
      }
      barrel(0.012, 0.07, 0.25, M.steel, 0.045);
      add(g, bx(0.01, 0.018, 0.17, 0.004), M.steel, [0, 0.062, 0.16]);
      add(g, bx(0.012, 0.03, 0.02, 0.004), M.gun, [0, 0.07, -0.03], [-0.5, 0, 0]);
      grip(g, M.wood, -0.035, 0.11);
      muzzle.position.set(0, 0.045, 0.26);
      break;
    }
    case 'smg':
    case 'tacsmg': {
      len = 0.36;
      add(g, bx(0.05, 0.075, 0.26, 0.012), M.gun, [0, 0.035, 0.08]);
      add(g, cz(0.022, 0.12), M.dark, [0, 0.035, 0.26]);
      for (let i = 0; i < 4; i++) add(g, cz(0.0235, 0.01), M.steel, [0, 0.035, 0.22 + i * 0.025]);
      barrel(0.008, 0.31, 0.35, M.steel);
      mag(g, 0.11, 0.15, 0.1);
      grip(g, M.dark, -0.01);
      add(g, bx(0.01, 0.01, 0.2, 0.003), M.steel, [0.018, 0.0, -0.13]);
      add(g, bx(0.01, 0.01, 0.2, 0.003), M.steel, [-0.018, 0.0, -0.13]);
      add(g, bx(0.045, 0.06, 0.015, 0.005), M.dark, [0, -0.01, -0.235]);
      if (key === 'tacsmg') {
        add(g, bx(0.025, 0.07, 0.03, 0.008), M.dark, [0, -0.04, 0.24]);
        add(g, bx(0.03, 0.035, 0.05, 0.008), M.dark, [0, 0.09, 0.06]);
        add(g, new THREE.CircleGeometry(0.011, 14), glow('#ff2a2a', 2), [0, 0.092, 0.087]);
      }
      muzzle.position.set(0, 0.035, 0.36);
      break;
    }
    case 'rifle':
    case 'burst':
    case 'boltcarbine': {
      len = key === 'boltcarbine' ? 0.5 : 0.56;
      const wood = key === 'boltcarbine';
      add(g, bx(0.05, 0.08, 0.3, 0.012), M.gun, [0, 0.035, 0.08]);
      add(g, bx(0.052, 0.065, 0.2, 0.015), wood ? M.wood : M.dark, [0, 0.035, 0.33]);
      for (let i = 0; i < 5; i++) add(g, bx(0.054, 0.012, 0.018, 0.004), M.gun, [0, 0.035, 0.26 + i * 0.035]);
      barrel(0.01, 0.42, len, M.steel);
      add(g, cz(0.016, 0.04, 8), M.gun, [0, 0.035, len - 0.01]);
      mag(g, 0.1, 0.17, 0.32);
      grip(g, M.dark, -0.01);
      stock(g, wood ? M.wood : M.dark, 0.22, 0.085);
      if (key === 'rifle') {
        add(g, bx(0.02, 0.02, 0.14, 0.006), M.gun, [0, 0.105, 0.06]);
        add(g, bx(0.012, 0.04, 0.012, 0.004), M.gun, [0, 0.09, 0.0]);
        add(g, bx(0.012, 0.04, 0.012, 0.004), M.gun, [0, 0.09, 0.12]);
      } else if (key === 'burst') {
        add(g, bx(0.04, 0.03, 0.08, 0.008), M.dark, [0, 0.095, 0.08]);
        add(g, new THREE.CircleGeometry(0.012, 14), glow('#3dd0ff', 2), [0, 0.096, 0.121]);
        add(g, bx(0.056, 0.02, 0.3, 0.006), plastic('#3d8fe8', 0.3), [0, 0.0, 0.08]);
      } else add(g, cz(0.008, 0.06), M.steel, [0.04, 0.05, 0.02], [0, Math.PI / 2, 0]);
      muzzle.position.set(0, 0.035, len);
      break;
    }
    case 'marksman':
    case 'sniper':
    case 'autosniper': {
      len = key === 'marksman' ? 0.62 : 0.78;
      const body = key === 'sniper' ? M.olive : key === 'autosniper' ? M.tan : M.gun;
      add(g, bx(0.05, 0.075, 0.3, 0.012), body, [0, 0.035, 0.08]);
      add(g, bx(0.05, 0.06, 0.18, 0.015), body, [0, 0.03, 0.31]);
      barrel(0.011, 0.38, len, M.gun);
      add(g, cz(0.018, 0.06, 10), M.gun, [0, 0.035, len - 0.02]);
      scope(g, 0.1, 0.105, key === 'marksman' ? 0.16 : 0.24, key === 'marksman' ? 0.018 : 0.024);
      mag(g, 0.1, key === 'autosniper' ? 0.12 : 0.08, 0.05);
      grip(g, M.dark, -0.01);
      stock(g, body, 0.24, 0.1);
      add(g, bx(0.035, 0.03, 0.12, 0.01), body, [0, 0.055, -0.15]);
      if (key === 'sniper')
        for (const s of [-1, 1]) add(g, cz(0.006, 0.16), M.steel, [s * 0.03, -0.04, 0.4], [-1.25, 0, s * 0.3]);
      muzzle.position.set(0, 0.035, len + 0.02);
      break;
    }
    case 'shotgun':
    case 'combatshotgun': {
      len = 0.66;
      const combat = key === 'combatshotgun';
      add(g, bx(0.05, 0.07, 0.22, 0.012), combat ? M.dark : M.gun, [0, 0.035, 0.04]);
      barrel(0.017, 0.14, len, M.gun, 0.045);
      add(g, cz(0.014, 0.45), M.gun, [0, 0.012, 0.36]);
      add(g, bx(0.05, 0.05, 0.14, 0.018), combat ? M.dark : M.wood, [0, 0.015, 0.3]);
      for (let i = 0; i < 6; i++) add(g, bx(0.052, 0.006, 0.006, 0.002), M.dark, [0, 0.015, 0.25 + i * 0.02]);
      grip(g, combat ? M.dark : M.wood, -0.03);
      stock(g, combat ? M.dark : M.wood, 0.24, 0.09);
      if (combat) {
        add(g, cz(0.055, 0.05, 20).rotateY(Math.PI / 2), M.dark, [0, -0.05, 0.08]);
        add(g, bx(0.01, 0.025, 0.01, 0.003), M.steel, [0, 0.08, 0.6]);
      } else add(g, new THREE.SphereGeometry(0.006, 8, 6), M.chrome, [0, 0.065, len - 0.02]);
      muzzle.position.set(0, 0.045, len);
      break;
    }
    case 'grenade': {
      len = 0.5;
      const drum = new THREE.Group();
      drum.position.set(0, 0.03, 0.12);
      add(drum, cz(0.07, 0.12, 6), M.olive, [0, 0, 0]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(drum, cz(0.016, 0.125, 10), M.dark, [Math.cos(a) * 0.042, Math.sin(a) * 0.042, 0]);
      }
      g.add(drum);
      add(g, cz(0.03, 0.3), M.olive, [0, 0.05, 0.33]);
      add(g, cz(0.036, 0.03), M.dark, [0, 0.05, len - 0.01]);
      add(g, bx(0.03, 0.03, 0.4, 0.01), M.dark, [0, 0.11, 0.2]);
      grip(g, M.dark, -0.03);
      add(g, bx(0.025, 0.08, 0.035, 0.01), M.dark, [0, -0.02, 0.32]);
      stock(g, M.olive, 0.18, 0.08);
      muzzle.position.set(0, 0.05, len);
      break;
    }
    case 'rocketlauncher':
    case 'nukelauncher': {
      const nuke = key === 'nukelauncher';
      len = nuke ? 0.9 : 0.84;
      const r = nuke ? 0.075 : 0.058;
      add(g, cz(r, len * 0.95, 24), nuke ? M.gun : M.olive, [0, 0.07, len * 0.3]);
      add(g, cz(r * 1.25, 0.08, 24, r), M.dark, [0, 0.07, len * 0.3 + len * 0.5]);
      add(g, cz(r, 0.1, 24, r * 1.35), M.dark, [0, 0.07, len * 0.3 - len * 0.5]);
      if (nuke) for (let i = 0; i < 6; i++) add(g, cz(r + 0.002, 0.04, 24), i % 2 ? M.dark : M.yellow, [0, 0.07, 0.05 + i * 0.05]);
      const tip = new THREE.Group();
      tip.position.set(0, 0.07, len * 0.3 + len * 0.47);
      add(tip, new THREE.ConeGeometry(r * 0.8, 0.12, 20).rotateX(Math.PI / 2), nuke ? M.yellow : M.red, [0, 0, 0.06]);
      if (nuke) add(tip, new THREE.SphereGeometry(r * 0.35, 12, 10), glow('#7dff4a', 2.5), [0, 0, 0.1]);
      g.add(tip);
      add(g, bx(0.03, 0.05, 0.08, 0.01), M.dark, [-r - 0.02, 0.11, 0.18]);
      add(g, new THREE.CircleGeometry(0.012, 12), M.glass, [-r - 0.02, 0.11, 0.221]);
      grip(g, M.dark, 0.0);
      add(g, bx(0.03, 0.09, 0.04, 0.01), M.dark, [0, -0.0, 0.28], [0.2, 0, 0]);
      muzzle.position.set(0, 0.07, len * 0.85);
      break;
    }
    case 'minigun':
    case 'chaingun': {
      len = 0.66;
      const chain = key === 'chaingun';
      add(g, bx(0.12, 0.12, 0.24, 0.025), chain ? M.red : M.gun, [0, 0.05, 0.02]);
      add(g, cz(0.07, 0.04, 20), M.dark, [0, 0.05, 0.16]);
      spin = new THREE.Group();
      spin.position.set(0, 0.05, 0.4);
      const n = chain ? 3 : 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, rr = chain ? 0.03 : 0.035;
        add(spin, cz(chain ? 0.017 : 0.011, 0.48), M.gun, [Math.cos(a) * rr, Math.sin(a) * rr, 0]);
      }
      for (const z of [-0.1, 0.12, 0.23]) add(spin, cz(chain ? 0.055 : 0.05, 0.02, 20), M.steel, [0, 0, z]);
      g.add(spin);
      add(g, bx(0.025, 0.025, 0.2, 0.008), M.dark, [0, 0.135, 0.02]);
      add(g, bx(0.02, 0.06, 0.02, 0.006), M.dark, [0, 0.1, -0.06]);
      add(g, bx(0.02, 0.06, 0.02, 0.006), M.dark, [0, 0.1, 0.1]);
      add(g, bx(0.09, 0.1, 0.12, 0.012), M.olive, [0.1, -0.02, -0.02]);
      grip(g, M.dark, -0.09);
      muzzle.position.set(0, 0.05, len);
      break;
    }
    case 'crossbow':
    case 'handcrossbow': {
      const small = key === 'handcrossbow';
      len = small ? 0.32 : 0.52;
      const span = small ? 0.16 : 0.28;
      add(g, bx(0.04, 0.045, len * 0.9, 0.012), M.wood, [0, 0.03, len * 0.35]);
      add(g, bx(0.012, 0.01, len * 0.85, 0.003), M.steel, [0, 0.057, len * 0.38]);
      for (const s of [-1, 1]) {
        const limb = new THREE.TorusGeometry(span * 0.6, 0.008, 8, 16, 1.0);
        add(g, limb, M.dark, [s * span * 0.04, 0.05, len * 0.78 - span * 0.55], [Math.PI / 2, 0, s > 0 ? -0.5 : Math.PI - 0.5 + 1]);
      }
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, span * 1.1, 4).rotateZ(Math.PI / 2), matte('#e8e2d0'));
      string.position.set(0, 0.06, len * 0.42);
      g.add(string);
      add(g, cz(0.004, len * 0.6), M.wood, [0, 0.066, len * 0.55]);
      add(g, new THREE.ConeGeometry(0.009, 0.03, 8).rotateX(Math.PI / 2), M.steel, [0, 0.066, len * 0.86]);
      grip(g, M.wood, -0.01, small ? 0.09 : 0.1);
      if (!small) stock(g, M.wood, 0.18, 0.07);
      muzzle.position.set(0, 0.066, len * 0.88);
      break;
    }
    case 'flamethrower': {
      len = 0.58;
      add(g, cz(0.026, 0.42), M.gun, [0, 0.05, 0.25]);
      add(g, cz(0.04, 0.07, 18, 0.03), M.steel, [0, 0.05, 0.49]);
      for (let i = 0; i < 6; i++) add(g, cz(0.03, 0.012), M.dark, [0, 0.05, 0.12 + i * 0.05]);
      for (const s of [-1, 1]) {
        const tank = add(g, new THREE.CapsuleGeometry(0.035, 0.18, 6, 16), M.red, [s * 0.04, -0.03, 0.02]);
        tank.rotation.x = Math.PI / 2;
      }
      add(g, new THREE.SphereGeometry(0.012, 10, 8), glow('#ffb03a', 4), [0, 0.02, 0.53]);
      grip(g, M.dark, -0.04);
      add(g, bx(0.025, 0.08, 0.035, 0.01), M.dark, [0, 0.0, 0.3]);
      muzzle.position.set(0, 0.05, len);
      break;
    }
    case 'machete': {
      len = 0.6;
      add(g, cz(0.017, 0.13, 12), M.dark, [0, 0, -0.02]);
      for (let i = 0; i < 5; i++) add(g, cz(0.019, 0.008, 12), M.wood, [0, 0, -0.07 + i * 0.025]);
      add(g, bx(0.06, 0.016, 0.012, 0.004), M.steel, [0, 0, 0.05]);
      const s = new THREE.Shape();
      s.moveTo(0, -0.012);
      s.lineTo(0.5, -0.03);
      s.quadraticCurveTo(0.56, -0.02, 0.55, 0.03);
      s.lineTo(0.0, 0.035);
      s.closePath();
      const blade = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
      blade.rotateY(-Math.PI / 2);
      add(g, blade, M.chrome, [0.002, 0, 0.05]);
      muzzle.position.set(0, 0, 0.55);
      break;
    }
    case 'railgun':
      energy('#30d0ff', 0.72, 5);
      break;
    case 'deathlaser':
      energy('#ff2a2a', 0.62, 4);
      break;
    case 'plasmarifle':
      energy('#38ff7a', 0.6, 3);
      break;
    case 'ioncannon':
      energy('#3d7bff', 0.7, 6, 1.2);
      break;
    case 'voidripper':
      energy('#b04bff', 0.64, 4, 1.1);
      break;
    case 'singularity': {
      energy('#ffffff', 0.68, 3, 1.15);
      spin = new THREE.Group();
      spin.position.set(0, 0.04, 0.76);
      add(spin, new THREE.SphereGeometry(0.03, 16, 12), glow('#e0b0ff', 4), [0, 0, 0]);
      add(spin, new THREE.TorusGeometry(0.05, 0.004, 8, 24), glow('#b04bff', 3), [0, 0, 0], [0.6, 0, 0]);
      add(spin, new THREE.TorusGeometry(0.05, 0.004, 8, 24), glow('#b04bff', 3), [0, 0, 0], [-0.6, 0.8, 0]);
      g.add(spin);
      add(g, starGeo(0.025, 0.008), M.yellow, [0, 0.13, 0.1]);
      muzzle.position.set(0, 0.04, 0.8);
      break;
    }
    default:
      return buildGun('pistol');
  }
  g.add(muzzle);
  return { group: g, muzzle, spin, len };
}
