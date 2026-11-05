// Three.js stage for the big 3D remakes (Backrooms, Block Run, Arena 3D): renderer with soft shadows,
// ACES tone mapping, glossy reflections from a room environment, optional bloom, and texture helpers.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export { THREE };

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Matches the drawing buffer to the canvas's laid-out size. Cheap to call every frame. */
  fit(): void;
  render(): void;
  /** World point -> CSS pixels inside the canvas, or null when behind the camera. */
  project(p: THREE.Vector3): [number, number] | null;
  dispose(): void;
}

export function createStage(cv: HTMLCanvasElement, o: { shadows?: boolean; bloom?: number; fov?: number; near?: number; far?: number; env?: number; maxDpr?: number } = {}): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = !!o.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.fov ?? 75, 1, o.near ?? 0.05, o.far ?? 220);
  if (o.env !== 0) {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = o.env ?? 1;
    pm.dispose();
  }
  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  if (o.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), o.bloom, 0.5, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  let lw = 0, lh = 0;
  const v = new THREE.Vector3();
  const stage: Stage = {
    renderer,
    scene,
    camera,
    fit() {
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h || (w === lw && h === lh)) return;
      lw = w;
      lh = h;
      renderer.setPixelRatio(Math.min(o.maxDpr ?? 1.5, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      composer?.setPixelRatio(Math.min(o.maxDpr ?? 1.5, window.devicePixelRatio || 1));
      composer?.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    render() {
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
    project(p) {
      v.copy(p).applyMatrix4(camera.matrixWorldInverse);
      if (v.z > -0.05) return null;
      v.copy(p).project(camera);
      return [(v.x * 0.5 + 0.5) * cv.clientWidth, (1 - (v.y * 0.5 + 0.5)) * cv.clientHeight];
    },
    dispose() {
      scene.traverse((ob) => {
        const m = ob as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mt) => {
          Object.values(mt).forEach((x) => x instanceof THREE.Texture && x.dispose());
          mt.dispose();
        });
      });
      scene.environment?.dispose();
      composer?.dispose();
      renderer.dispose();
    },
  };
  return stage;
}

/** A canvas-drawn texture that tiles. */
export function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat: [number, number] = [1, 1], color = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Deterministic noise for textures. */
export function noise(g: CanvasRenderingContext2D, s: number, n: number, alpha: number, light = false, size = 1) {
  let seed = 1234567;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    g.fillStyle = light ? `rgba(255,255,255,${rnd() * alpha})` : `rgba(0,0,0,${rnd() * alpha})`;
    g.fillRect(rnd() * s, rnd() * s, size + rnd() * size, size + rnd() * size);
  }
}

/** Glossy toy plastic (clearcoat), the Aero look. */
export const plastic = (color: string | number, rough = 0.32, o: THREE.MeshPhysicalMaterialParameters = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, ...o });
export const matte = (color: string | number, rough = 0.85, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...o });
export const metal = (color: string | number, rough = 0.35, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.9, ...o });
export const glow = (color: string | number, strength = 2) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: strength, roughness: 1 });

export function shadowAll(ob: THREE.Object3D, cast = true, receive = true) {
  ob.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
  return ob;
}
