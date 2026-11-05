// Hand-built 3D models for the remakes: the "Starling" player character (fully jointed and animated),
// the Backrooms entity, and small shared shapes. Characters stand on y = 0 and face +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { glow, matte, plastic } from './engine';

export const rbox = (w: number, h: number, d: number, r = 0.05, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 14);
const ball = (r: number, ws = 24, hs = 16) => new THREE.SphereGeometry(r, ws, hs);

export function starShape(ro: number, ri: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro, a = Math.PI / 2 + (i * Math.PI) / 5;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}
export function starGeo(ro: number, depth = ro * 0.3) {
  const g = new THREE.ExtrudeGeometry(starShape(ro, ro * 0.45), { depth, bevelEnabled: true, bevelThickness: depth * 0.5, bevelSize: ro * 0.12, bevelSegments: 3 });
  g.center();
  return g;
}

const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
};
const pivot = (x: number, y: number, z = 0) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
};

export interface CharLook {
  body: string;
  accent?: string;
  face?: string;
  glove?: string;
  /** Plain look: no antenna star, no chest star, no shorts (legs and hips in the body colour). */
  plain?: boolean;
}

/** The Starling: a glossy toy-like player character with Buddi's eyes and a star antenna. */
export class Character {
  root = new THREE.Group();
  body = new THREE.Group();
  head = new THREE.Group();
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  shL: THREE.Group;
  shR: THREE.Group;
  elL: THREE.Group;
  elR: THREE.Group;
  /** Attach a held item (a gun) here; it points along +z. */
  handR = new THREE.Group();
  private phase = Math.random() * 6;
  private mats: THREE.MeshPhysicalMaterial[] = [];
  private t = Math.random() * 10;
  hurt = 0;

  constructor(look: CharLook) {
    const bodyM = plastic(look.body, 0.3), accM = plastic(look.accent ?? '#26344f', 0.4), faceM = plastic(look.face ?? '#fff6ea', 0.35), gloveM = plastic(look.glove ?? '#ffffff', 0.35);
    const eyeM = plastic('#0d2a5a', 0.15), whiteM = new THREE.MeshBasicMaterial({ color: '#ffffff' }), goldM = plastic('#ffc21f', 0.25, { emissive: '#ff9a00', emissiveIntensity: 0.25 });
    this.mats.push(bodyM, accM);
    const { root, body } = this;
    root.add(body);

    // legs: hip -> thigh -> knee -> shin -> shoe
    const leg = (side: number) => {
      const hip = pivot(side * 0.14, 0.9);
      hip.add(mesh(cap(0.1, 0.24), look.plain ? bodyM : accM, 0, -0.19));
      const knee = pivot(0, -0.42);
      knee.add(mesh(cap(0.088, 0.24), bodyM, 0, -0.18));
      const shoe = mesh(rbox(0.21, 0.13, 0.34, 0.06), accM, 0, -0.41, 0.05);
      knee.add(shoe);
      knee.add(mesh(rbox(0.19, 0.03, 0.31, 0.015), gloveM, 0, -0.475, 0.05));
      hip.add(knee);
      body.add(hip);
      return [hip, knee];
    };
    [this.hipL, this.kneeL] = leg(-1);
    [this.hipR, this.kneeR] = leg(1);
    // shorts, torso, emblem, neck
    // hips: shorts in the accent colour, or plain body colour
    body.add(mesh(rbox(0.5, 0.24, 0.31, 0.1), look.plain ? bodyM : accM, 0, 0.95));
    body.add(mesh(rbox(0.56, 0.6, 0.33, 0.14), bodyM, 0, 1.31));
    if (!look.plain) {
      body.add(mesh(rbox(0.52, 0.08, 0.34, 0.04), accM, 0, 1.06));
      body.add(mesh(starGeo(0.075, 0.025), goldM, 0, 1.36, 0.175));
    }
    body.add(mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 14), faceM, 0, 1.64));
    // arms: shoulder -> upper -> elbow -> forearm -> glove
    const arm = (side: number) => {
      const sh = pivot(side * 0.36, 1.53);
      sh.add(mesh(ball(0.105), bodyM));
      sh.add(mesh(cap(0.075, 0.2), bodyM, 0, -0.15));
      const el = pivot(0, -0.3);
      el.add(mesh(cap(0.07, 0.18), faceM, 0, -0.12));
      el.add(mesh(ball(0.09), gloveM, 0, -0.29));
      sh.add(el);
      body.add(sh);
      return [sh, el];
    };
    [this.shL, this.elL] = arm(-1);
    [this.shR, this.elR] = arm(1);
    this.handR.position.set(0, -0.3, 0.02);
    this.elR.add(this.handR);
    // head: helmet, face plate, Buddi eyes, cheeks, smile, antenna star
    const head = this.head;
    head.position.y = 1.93;
    head.add(mesh(ball(0.3, 32, 24), bodyM));
    const face = mesh(ball(0.27, 32, 24), faceM, 0, -0.02, 0.07);
    face.scale.set(0.95, 0.85, 0.85);
    head.add(face);
    for (const sx of [-1, 1]) {
      const eye = mesh(ball(0.06, 20, 14), eyeM, sx * 0.095, 0.02, 0.27);
      eye.scale.set(0.85, 1.25, 0.55);
      head.add(eye);
      const hl = new THREE.Mesh(ball(0.018, 10, 8), whiteM);
      hl.position.set(sx * 0.095 + 0.022, 0.06, 0.3);
      head.add(hl);
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: '#ff8f84', transparent: true, opacity: 0.55 }));
      cheek.position.set(sx * 0.17, -0.07, 0.262);
      cheek.lookAt(sx * 0.6, -0.2, 1.2);
      head.add(cheek);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 8, 16, Math.PI), new THREE.MeshBasicMaterial({ color: '#4a2410' }));
    smile.position.set(0, -0.085, 0.285);
    smile.rotation.z = Math.PI;
    head.add(smile);
    if (!look.plain) {
      head.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), accM, 0, 0.36));
      head.add(mesh(starGeo(0.07, 0.025), goldM, 0, 0.47));
    }
    body.add(head);
  }

  /** speed in m/s; aim = look pitch while holding a gun; air = not on the ground. */
  update(dt: number, speed: number, o: { aim?: number | null; air?: boolean; dead?: boolean } = {}) {
    this.t += dt;
    const s = Math.min(1, speed / 4);
    this.phase += dt * (3 + speed * 2.4);
    const sw = Math.sin(this.phase) * 0.75 * s;
    const lerp = (a: number, b: number, k = Math.min(1, dt * 14)) => a + (b - a) * k;
    if (o.dead) {
      this.body.rotation.x = lerp(this.body.rotation.x, -Math.PI / 2, Math.min(1, dt * 6));
      this.body.position.y = lerp(this.body.position.y, 0.3, Math.min(1, dt * 6));
      return;
    }
    this.body.rotation.x = lerp(this.body.rotation.x, 0);
    if (o.air) {
      this.hipL.rotation.x = lerp(this.hipL.rotation.x, -0.6);
      this.hipR.rotation.x = lerp(this.hipR.rotation.x, 0.2);
      this.kneeL.rotation.x = lerp(this.kneeL.rotation.x, 1.1);
      this.kneeR.rotation.x = lerp(this.kneeR.rotation.x, 0.5);
    } else {
      this.hipL.rotation.x = lerp(this.hipL.rotation.x, sw);
      this.hipR.rotation.x = lerp(this.hipR.rotation.x, -sw);
      this.kneeL.rotation.x = lerp(this.kneeL.rotation.x, Math.max(0, Math.sin(this.phase - 1.2)) * 1.1 * s);
      this.kneeR.rotation.x = lerp(this.kneeR.rotation.x, Math.max(0, Math.sin(this.phase + Math.PI - 1.2)) * 1.1 * s);
    }
    const bob = Math.abs(Math.sin(this.phase)) * 0.05 * s + Math.sin(this.t * 2) * 0.008;
    this.body.position.y = lerp(this.body.position.y, bob);
    if (o.aim != null) {
      this.shR.rotation.x = lerp(this.shR.rotation.x, -Math.PI / 2 - o.aim);
      this.shR.rotation.z = lerp(this.shR.rotation.z, 0.08);
      this.elR.rotation.x = lerp(this.elR.rotation.x, 0);
      this.shL.rotation.x = lerp(this.shL.rotation.x, -Math.PI / 2 - o.aim + 0.25);
      this.shL.rotation.z = lerp(this.shL.rotation.z, -0.55);
      this.elL.rotation.x = lerp(this.elL.rotation.x, -0.35);
      this.head.rotation.x = lerp(this.head.rotation.x, -o.aim * 0.6);
    } else {
      this.shL.rotation.x = lerp(this.shL.rotation.x, -sw * 0.9);
      this.shR.rotation.x = lerp(this.shR.rotation.x, sw * 0.9);
      this.shL.rotation.z = lerp(this.shL.rotation.z, -0.08);
      this.shR.rotation.z = lerp(this.shR.rotation.z, 0.08);
      this.elL.rotation.x = lerp(this.elL.rotation.x, -0.35 - s * 0.4);
      this.elR.rotation.x = lerp(this.elR.rotation.x, -0.35 - s * 0.4);
      this.head.rotation.x = lerp(this.head.rotation.x, 0);
    }
    // flash red when hit
    if (this.hurt > 0) this.hurt -= dt;
    for (const m of this.mats) m.emissive.setRGB(this.hurt > 0 ? 0.6 : 0, 0, 0);
  }
  setColor(body: string) {
    this.mats[0].color.set(body);
  }
}

/** A soft round shadow to put under characters (cheaper than real shadows). */
export function blobShadow(r = 0.45, opacity = 0.45) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  return m;
}

/** The thing in the Backrooms: very tall, thin, faceless except for two glowing eyes. */
export class Entity {
  root = new THREE.Group();
  private arms: THREE.Group[] = [];
  private headG = new THREE.Group();
  private t = 0;
  light: THREE.PointLight;
  constructor() {
    const skin = matte('#07070a', 0.55, { metalness: 0.2 }), eyeM = glow('#ff1a1a', 6);
    const r = this.root;
    for (const sx of [-1, 1]) {
      const leg = pivot(sx * 0.12, 1.25);
      leg.add(mesh(cap(0.06, 1.1), skin, 0, -0.62));
      leg.rotation.z = sx * 0.05;
      r.add(leg);
    }
    r.add(mesh(cap(0.14, 0.9), skin, 0, 1.75));
    const chest = mesh(ball(0.2), skin, 0, 2.15);
    chest.scale.set(1.25, 0.9, 0.7);
    r.add(chest);
    for (const sx of [-1, 1]) {
      const a = pivot(sx * 0.27, 2.2);
      a.add(mesh(cap(0.045, 0.75), skin, 0, -0.45));
      const fore = pivot(0, -0.85);
      fore.add(mesh(cap(0.04, 0.7), skin, 0, -0.4));
      for (let f = -1; f <= 1; f++) {
        const fin = mesh(cap(0.012, 0.22), skin, f * 0.03, -0.86);
        fin.rotation.z = f * 0.15;
        fore.add(fin);
      }
      a.add(fore);
      a.rotation.z = sx * 0.12;
      r.add(a);
      this.arms.push(a);
    }
    this.headG.position.y = 2.55;
    const hd = mesh(ball(0.17), skin);
    hd.scale.set(0.9, 1.35, 0.95);
    this.headG.add(hd);
    for (const sx of [-1, 1]) this.headG.add(mesh(ball(0.032, 12, 10), eyeM, sx * 0.06, 0.04, 0.14));
    r.add(this.headG);
    this.light = new THREE.PointLight('#ff2020', 2.2, 6, 2);
    this.light.position.set(0, 2.55, 0.4);
    r.add(this.light);
  }
  update(dt: number) {
    this.t += dt;
    const j = Math.sin(this.t * 31) * 0.04 * (Math.sin(this.t * 3) > 0.6 ? 1 : 0);
    this.headG.rotation.z = Math.sin(this.t * 0.9) * 0.25 + j;
    this.headG.rotation.y = j * 3;
    this.arms.forEach((a, i) => (a.rotation.x = Math.sin(this.t * 1.3 + i) * 0.12));
    this.light.intensity = 1.8 + Math.sin(this.t * 13) * 0.4;
  }
}
