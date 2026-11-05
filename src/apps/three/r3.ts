// A tiny WebGL renderer shared by the 3D games (Backrooms, 3D Platformer, Block Run, Arena 3D):
// lit boxes, capsules and spheres, a first-person camera, screen projection, and mouse-look input.
export type V3 = [number, number, number];
export interface DrawOpts {
  rot?: number; // yaw, radians
  tilt?: number; // roll around z before the yaw
  alpha?: number;
  lit?: number; // 1 = shaded, 0 = flat colour
  tex?: number; // game-specific surface pattern id
  grid?: number; // 1 = edge lines + checker on top faces
  basis?: [V3, V3, V3]; // full orientation (x, y, z axes); overrides rot/tilt
}
interface Mesh {
  buf: WebGLBuffer;
  n: number;
}

const VS = `attribute vec3 aP;attribute vec3 aN;uniform mat4 uVP;uniform vec3 uC;uniform vec3 uS;uniform float uRot;uniform float uTilt;
uniform vec3 uBX;uniform vec3 uBY;uniform vec3 uBZ;uniform float uUseBasis;varying vec3 vN;varying vec3 vW;varying vec3 vL;varying vec3 vS;
void main(){vec3 p=aP*uS;vec3 n=aN;
if(uUseBasis>.5){p=p.x*uBX+p.y*uBY+p.z*uBZ;n=normalize(aN.x*uBX+aN.y*uBY+aN.z*uBZ);}
else{float ct=cos(uTilt),st=sin(uTilt);p=vec3(ct*p.x-st*p.y,st*p.x+ct*p.y,p.z);n=vec3(ct*n.x-st*n.y,st*n.x+ct*n.y,n.z);
float c=cos(uRot),s=sin(uRot);p=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);n=vec3(c*n.x+s*n.z,n.y,-s*n.x+c*n.z);}
vec3 w=p+uC;vW=w;vN=n;vL=aP;vS=uS;gl_Position=uVP*vec4(w,1.0);}`;

/** Common fragment-shader header. The game's body sets gl_FragColor; helpers: hash(), shade(), edges(). */
const FS_HEAD = `precision mediump float;varying vec3 vN;varying vec3 vW;varying vec3 vL;varying vec3 vS;
uniform vec3 uCol;uniform vec3 uEye;uniform float uAlpha;uniform float uLit;uniform float uTex;uniform float uGrid;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float shade(vec3 n){return .5+.5*max(dot(n,normalize(vec3(.35,.9,.25))),0.);}
float edges(vec3 n){vec3 dd=(.5-abs(vL))*vS;return min(min(mix(9.,dd.x,1.-abs(n.x)),mix(9.,dd.y,1.-abs(n.y))),mix(9.,dd.z,1.-abs(n.z)));}
`;

function cubeVerts() {
  const v: number[] = [];
  for (let a = 0; a < 3; a++)
    for (const s of [-1, 1]) {
      const u = (a + 1) % 3, w = (a + 2) % 3, n = [0, 0, 0];
      n[a] = s;
      for (const [cu, cw] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
        const p = [0, 0, 0];
        p[a] = s * 0.5;
        p[u] = cu;
        p[w] = cw;
        v.push(...p, ...n);
      }
    }
  return v;
}
/** Capsule (cyl > 0) or sphere (cyl = 0) of radius r. */
export function capsuleVerts(segs: number, rings: number, r: number, cyl: number) {
  const rows: number[][][] = [];
  for (const top of [true, false])
    for (let i = 0; i <= rings; i++) {
      const phi = (top ? 0 : Math.PI / 2) + (i / rings) * (Math.PI / 2);
      const y = (top ? cyl : -cyl) + r * Math.cos(phi), rad = r * Math.sin(phi), row: number[][] = [];
      for (let j = 0; j <= segs; j++) {
        const th = (j / segs) * Math.PI * 2;
        row.push([rad * Math.cos(th), y, rad * Math.sin(th), Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)]);
      }
      rows.push(row);
    }
  const out: number[] = [];
  for (let i = 0; i < rows.length - 1; i++)
    for (let j = 0; j < segs; j++) {
      const a0 = rows[i][j], a1 = rows[i][j + 1], b0 = rows[i + 1][j], b1 = rows[i + 1][j + 1];
      out.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
    }
  return out;
}

const mul = (a: number[], b: number[]) => {
  const o = new Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
};

export interface R3 {
  gl: WebGLRenderingContext;
  cube: Mesh;
  capsule: Mesh;
  sphere: Mesh;
  mesh(verts: number[]): Mesh;
  draw(m: Mesh, c: V3, s: V3, col: V3, o?: DrawOpts): void;
  box(c: V3, s: V3, col: V3, o?: DrawOpts): void;
  caps(c: V3, s: V3, col: V3, o?: DrawOpts): void;
  sph(c: V3, s: V3, col: V3, o?: DrawOpts): void;
  /** Starts a frame: viewport, clear, camera. */
  frame(eye: V3, yaw: number, pitch: number, fovDeg: number, near: number, far: number, clear: [number, number, number, number]): void;
  blend(on: boolean): void;
  /** World point -> CSS pixels inside the canvas, or null when behind the camera. */
  project(x: number, y: number, z: number): [number, number] | null;
  u1(name: string, v: number): void;
  u3(name: string, v: V3): void;
  /** Matches the drawing buffer to the canvas's laid-out size (clientWidth ignores open/close animations). */
  fit(maxDpr?: number): void;
}

export function createR3(cv: HTMLCanvasElement, fsBody: string, extraUniforms: string[] = [], attrs: WebGLContextAttributes = {}): R3 | null {
  const gl = cv.getContext('webgl', { antialias: true, alpha: false, ...attrs });
  if (!gl) return null;
  const compile = (t: number, s: string) => {
    const o = gl.createShader(t)!;
    gl.shaderSource(o, s);
    gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(o));
    return o;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS_HEAD + extraUniforms.map((u) => `uniform ${u};`).join('') + fsBody));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const U: Record<string, WebGLUniformLocation | null> = {};
  const loc = (n: string) => (n in U ? U[n] : (U[n] = gl.getUniformLocation(prog, n)));
  const aP = gl.getAttribLocation(prog, 'aP'), aN = gl.getAttribLocation(prog, 'aN');
  gl.enableVertexAttribArray(aP);
  gl.enableVertexAttribArray(aN);
  gl.enable(gl.DEPTH_TEST);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const mesh = (v: number[]): Mesh => {
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    return { buf, n: v.length / 6 };
  };
  let bound: WebGLBuffer | null = null;
  let VP: number[] = [];
  const r: R3 = {
    gl,
    cube: mesh(cubeVerts()),
    capsule: mesh(capsuleVerts(9, 3, 0.5, 0.5)),
    sphere: mesh(capsuleVerts(8, 3, 0.5, 0)),
    mesh,
    draw(m, c, s, col, o = {}) {
      if (bound !== m.buf) {
        gl.bindBuffer(gl.ARRAY_BUFFER, m.buf);
        gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 24, 12);
        bound = m.buf;
      }
      gl.uniform3f(loc('uC'), c[0], c[1], c[2]);
      gl.uniform3f(loc('uS'), s[0], s[1], s[2]);
      gl.uniform3f(loc('uCol'), col[0], col[1], col[2]);
      gl.uniform1f(loc('uRot'), o.rot ?? 0);
      gl.uniform1f(loc('uTilt'), o.tilt ?? 0);
      gl.uniform1f(loc('uAlpha'), o.alpha ?? 1);
      gl.uniform1f(loc('uLit'), o.lit ?? 1);
      gl.uniform1f(loc('uTex'), o.tex ?? 0);
      gl.uniform1f(loc('uGrid'), o.grid ?? 0);
      gl.uniform1f(loc('uUseBasis'), o.basis ? 1 : 0);
      if (o.basis) {
        gl.uniform3fv(loc('uBX'), o.basis[0]);
        gl.uniform3fv(loc('uBY'), o.basis[1]);
        gl.uniform3fv(loc('uBZ'), o.basis[2]);
      }
      gl.drawArrays(gl.TRIANGLES, 0, m.n);
    },
    box: (c, s, col, o) => r.draw(r.cube, c, s, col, o),
    caps: (c, s, col, o) => r.draw(r.capsule, c, s, col, o),
    sph: (c, s, col, o) => r.draw(r.sphere, c, s, col, o),
    frame(E, yaw, pitch, fovDeg, n, fa, clear) {
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(...clear);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      r.blend(false);
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const F = [sy * cp, sp, cy * cp], R = [cy, 0, -sy], Up = [-sy * sp, cp, -cy * sp];
      const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const V = [R[0], Up[0], -F[0], 0, R[1], Up[1], -F[1], 0, R[2], Up[2], -F[2], 0, -dot(R, E), -dot(Up, E), dot(F, E), 1];
      const f = 1 / Math.tan((fovDeg * Math.PI) / 360), asp = cv.width / Math.max(1, cv.height);
      const P = [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0];
      VP = mul(P, V);
      gl.uniformMatrix4fv(loc('uVP'), false, new Float32Array(VP));
      gl.uniform3f(loc('uEye'), E[0], E[1], E[2]);
    },
    blend(on) {
      if (on) gl.enable(gl.BLEND), gl.depthMask(false);
      else gl.disable(gl.BLEND), gl.depthMask(true);
    },
    project(x, y, z) {
      const w = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
      if (w <= 0.05) return null;
      const px = (VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / w, py = (VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / w;
      return [(px * 0.5 + 0.5) * cv.clientWidth, (1 - (py * 0.5 + 0.5)) * cv.clientHeight];
    },
    u1: (n, v) => gl.uniform1f(loc(n), v),
    u3: (n, v) => gl.uniform3f(loc(n), v[0], v[1], v[2]),
    fit(maxDpr = 1.5) {
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
      const w = Math.max(200, Math.floor(cv.clientWidth * dpr)), h = Math.max(150, Math.floor(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) (cv.width = w), (cv.height = h);
    },
  };
  return r;
}

export const hexRgb = (h: string): V3 => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
export const hslRgb = (h: number, s: number, l: number): V3 => {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
};

/**
 * Mouse look for a canvas: pointer lock when the browser allows it, otherwise "follow" mode
 * (the view turns toward the mouse) or click-drag. Call tick(dt) each frame.
 */
export class Look {
  yaw = 0;
  pitch = 0;
  mode: 'lock' | 'follow' | 'drag' = 'lock';
  private mx = 0;
  private my = 0;
  private inside = false;
  private dragging = false;
  private wasLocked = false;
  constructor(private cv: HTMLCanvasElement, private opts: { sens?: number; maxPitch?: number; drag?: boolean; onUnlock?: () => void } = {}) {
    document.addEventListener('mousemove', this.mm);
    document.addEventListener('pointerlockchange', this.plc);
    document.addEventListener('pointerup', this.pu);
    cv.addEventListener('pointerdown', this.pd);
  }
  get locked() {
    return document.pointerLockElement === this.cv;
  }
  lock() {
    this.mode = this.opts.drag ? 'drag' : 'lock';
    try {
      const p = this.cv.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => !this.opts.drag && (this.mode = 'follow'));
    } catch {
      if (!this.opts.drag) this.mode = 'follow';
    }
    window.setTimeout(() => !this.locked && !this.opts.drag && (this.mode = 'follow'), 500);
  }
  unlock() {
    try {
      if (this.locked) document.exitPointerLock();
    } catch {
      /* ignore */
    }
  }
  private clampP() {
    const m = this.opts.maxPitch ?? 1.3;
    this.pitch = Math.max(-m, Math.min(m, this.pitch));
  }
  private mm = (e: MouseEvent) => {
    const s = this.opts.sens ?? 0.0022;
    if (this.locked || this.dragging) {
      this.yaw += (e.movementX || 0) * s;
      this.pitch -= (e.movementY || 0) * s;
      this.clampP();
    } else {
      const r = this.cv.getBoundingClientRect();
      this.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      this.mx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      this.my = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    }
  };
  private plc = () => {
    if (this.locked) (this.wasLocked = true), (this.mode = 'lock');
    else if (this.wasLocked) {
      this.wasLocked = false;
      this.opts.onUnlock?.();
    }
  };
  private pd = () => {
    if (this.opts.drag) this.dragging = true;
  };
  private pu = () => {
    this.dragging = false;
  };
  tick(dt: number) {
    if (this.mode !== 'follow' || this.locked || !this.inside) return;
    const dz = (v: number) => {
      v = Math.max(-1, Math.min(1, v));
      return Math.abs(v) < 0.1 ? 0 : (v - Math.sign(v) * 0.1) / 0.9;
    };
    this.yaw += dz(this.mx) * 2.4 * dt;
    this.pitch -= dz(this.my) * 1.7 * dt;
    this.clampP();
  }
  dispose() {
    document.removeEventListener('mousemove', this.mm);
    document.removeEventListener('pointerlockchange', this.plc);
    document.removeEventListener('pointerup', this.pu);
    this.cv.removeEventListener('pointerdown', this.pd);
    this.unlock();
  }
}
