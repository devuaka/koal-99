// Block Run world: block types, the 32px texture atlas, terrain generation (identical to koalOS so worlds
// and multiplayer match) and chunk meshing with ambient occlusion.
export const CH = 16, H = 64, SEA = 20;
export const BLOCKS: Record<number, { n: string; t: [number, number, number] }> = {
  1: { n: 'Grass', t: [0, 2, 1] },
  2: { n: 'Dirt', t: [2, 2, 2] },
  3: { n: 'Stone', t: [3, 3, 3] },
  4: { n: 'Sand', t: [4, 4, 4] },
  5: { n: 'Log', t: [6, 6, 5] },
  6: { n: 'Leaves', t: [7, 7, 7] },
  7: { n: 'Planks', t: [8, 8, 8] },
  8: { n: 'Brick', t: [9, 9, 9] },
  9: { n: 'Glass', t: [10, 10, 10] },
  10: { n: 'Water', t: [11, 11, 11] },
  11: { n: 'Glow', t: [12, 12, 12] },
  12: { n: 'Custom', t: [13, 14, 15] },
};
export const HOT = [1, 2, 3, 4, 5, 7, 8, 9, 11, 12];
/** Opaque blocks hide the faces next to them (leaves count, glass and water do not). */
export const OPQ = [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1];
export const SOLID = (id: number) => id !== 0 && id !== 10;

export function brHash(x: number, y: number, z: number, s: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2246822519) ^ Math.imul(s | 0, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------- the atlas: 4 x 4 tiles of 32 px ----------
export const T = 32;
type Px = (x: number, y: number, r: number, r2: number) => number[];
export function makeAtlas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = T * 4;
  const g = c.getContext('2d')!;
  const j = (v: number, a: number) => Math.max(0, Math.min(255, Math.round(v + a)));
  const put = (i: number, fn: Px) => {
    const id = g.createImageData(T, T);
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const p = fn(x, y, brHash(x, y, i, 99), brHash(x >> 1, y >> 1, i, 7)), k = (y * T + x) * 4;
        id.data[k] = p[0];
        id.data[k + 1] = p[1];
        id.data[k + 2] = p[2];
        id.data[k + 3] = p.length > 3 ? p[3] : 255;
      }
    g.putImageData(id, (i % 4) * T, Math.floor(i / 4) * T);
  };
  const grass = (x: number, y: number, r: number, r2: number) => {
    const blade = brHash(x, y >> 2, 11, 3) > 0.82 ? 18 : 0, dark = r2 > 0.86 ? -22 : 0;
    return [j(92, r * 22 - 11 + dark - blade * 0.5), j(170, r * 30 - 15 + dark + blade), j(64, r * 18 - 9 + dark)];
  };
  const dirt = (x: number, y: number, r: number, r2: number) => {
    const peb = brHash(x >> 1, y >> 1, 5, 41) > 0.93 ? 34 : 0, d = r2 > 0.9 ? -24 : 0;
    return [j(134, r * 22 - 11 + d + peb), j(88, r * 16 - 8 + d + peb), j(46, r * 12 - 6 + d + peb * 0.8)];
  };
  put(0, grass);
  put(2, dirt);
  put(1, (x, y, r, r2) => {
    const edge = 5 + Math.floor(brHash(x, 0, 1, 13) * 5);
    return y < edge ? grass(x, y, r, r2) : y === edge ? [j(70, r * 10), j(120, r * 14), j(48, r * 8)] : dirt(x, y, r, r2);
  });
  put(3, (x, y, r, r2) => {
    const crack = Math.abs(((x * 0.7 + y * 1.3 + brHash(x >> 3, y >> 3, 3, 5) * 9) % 11) - 5.5) < 0.45 ? -40 : 0;
    const d = r2 < 0.08 ? -30 : r2 > 0.93 ? 22 : 0;
    return [j(132, r * 24 - 12 + d + crack), j(134, r * 24 - 12 + d + crack), j(140, r * 24 - 12 + d + crack)];
  });
  put(4, (_x, _y, r, r2) => [j(232, r * 18 - 9 - (r2 > 0.9 ? 18 : 0)), j(216, r * 16 - 8 - (r2 > 0.9 ? 16 : 0)), j(160, r * 22 - 11)]);
  put(5, (x, _y, r) => {
    const s = x % 6 === 0 ? -30 : x % 6 === 3 ? 10 : 0;
    return [j(106, r * 16 - 8 + s), j(76, r * 12 - 6 + s), j(44, r * 10 - 5 + s)];
  });
  put(6, (x, y, r) => {
    const d = Math.hypot(x - 15.5, y - 15.5), bark = d > 14;
    return bark ? [j(96, r * 12), j(66, r * 10), j(38, r * 8)] : Math.floor(d / 2.2) % 2 ? [j(176, r * 10), j(134, r * 8), j(80, r * 6)] : [j(148, r * 10), j(108, r * 8), j(62, r * 6)];
  });
  put(7, (x, y, r, r2) => {
    const hole = brHash(x >> 1, y >> 1, 7, 77) > 0.86;
    const d = r2 > 0.75 ? -26 : r2 < 0.15 ? 18 : 0;
    // gaps between the leaves are deep shade, not see-through (holes read as white specks against the sky)
    return hole ? [j(22, r * 8), j(62, r * 12), j(24, r * 8)] : [j(50, r * 24 - 12 + d), j(126, r * 34 - 17 + d), j(46, r * 20 - 10 + d)];
  });
  put(8, (x, y, r) => {
    const board = Math.floor(y / 8), line = y % 8 === 7 ? -38 : 0, end = (x + board * 13) % 32 === 0 ? -30 : 0;
    const grain = Math.sin((x + board * 7) * 0.9 + Math.sin(y * 1.7) * 1.4) * 7, nail = (x === 2 || x === 29) && y % 8 === 3 ? -50 : 0;
    return [j(186, r * 12 - 6 + line + end + grain + nail), j(140, r * 10 - 5 + line + end + grain + nail), j(82, r * 8 - 4 + line + end + grain + nail)];
  });
  put(9, (x, y, r) => {
    const row = Math.floor(y / 8), mortar = y % 8 >= 6 || (x + (row % 2) * 8) % 16 >= 14;
    return mortar ? [j(214, r * 12), j(204, r * 12), j(190, r * 12)] : [j(170, r * 22 - 11 - (y % 8 === 0 ? -14 : 0)), j(64, r * 14 - 7), j(52, r * 10 - 5)];
  });
  put(10, (x, y) => {
    const edge = x < 2 || y < 2 || x > 29 || y > 29, glint = (x + y > 16 && x + y < 20 && x > 4 && x < 14) || (x + y > 22 && x + y < 24 && x > 8 && x < 16);
    return edge ? [214, 238, 246, 235] : glint ? [245, 252, 255, 170] : [200, 230, 244, 45];
  });
  put(11, (x, y, r) => {
    const w = Math.sin(x * 0.45 + Math.sin(y * 0.3) * 2) * 0.5 + 0.5;
    return [j(34 + w * 30, r * 10), j(104 + w * 40, r * 14), j(200 + w * 30, r * 10), 175];
  });
  put(12, (x, y, r) => {
    const grid = x % 16 === 0 || y % 16 === 0 || x % 16 === 15 || y % 16 === 15;
    const d = Math.hypot((x % 16) - 7.5, (y % 16) - 7.5);
    return grid ? [196, 132, 40] : [j(255, -r * 10 - d * 2), j(236, -r * 16 - d * 5), j(150, -r * 24 - d * 8)];
  });
  return c;
}
/** Paints a 16 x 16 custom face (hex colours) into one atlas tile, doubled to 32 px. */
export function paintTile(c: HTMLCanvasElement, tile: number, px: string[]) {
  const g = c.getContext('2d')!;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      g.fillStyle = px[y * 16 + x] || '#8a5a3c';
      g.fillRect((tile % 4) * T + x * 2, Math.floor(tile / 4) * T + y * 2, 2, 2);
    }
}
/** Average colour of a tile, for break particles. */
export function tileColor(c: HTMLCanvasElement, tile: number): [number, number, number] {
  const d = c.getContext('2d')!.getImageData((tile % 4) * T, Math.floor(tile / 4) * T, T, T).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4)
    if (d[i + 3] > 100) (r += d[i]), (g += d[i + 1]), (b += d[i + 2]), n++;
  n = Math.max(1, n);
  return [r / n / 255, g / n / 255, b / n / 255];
}
/** A little isometric block picture for the hotbar. */
export function isoIcon(atlas: HTMLCanvasElement, id: number, size = 40) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const [top, , side] = BLOCKS[id].t;
  const tx = (t: number) => [(t % 4) * T, Math.floor(t / 4) * T] as const;
  const s = size / 2, h = size * 0.29;
  const face = (t: number, m: [number, number, number, number, number, number], shade: number) => {
    g.save();
    g.setTransform(...m);
    const [sx, sy] = tx(t);
    g.drawImage(atlas, sx, sy, T, T, 0, 0, 1, 1);
    g.fillStyle = `rgba(0,0,0,${shade})`;
    g.fillRect(0, 0, 1, 1);
    g.restore();
  };
  face(top, [s, h * 0.5, -s, h * 0.5, s, size * 0.04], 0);
  face(side, [s, h * 0.5, 0, s * 1.05, 0, size * 0.04 + h * 0.5], 0.18);
  face(side, [s, -h * 0.5, 0, s * 1.05, s, size * 0.04 + h], 0.34);
  return c.toDataURL();
}

// ---------- terrain (same maths as koalOS) ----------
const smooth = (t: number) => t * t * (3 - 2 * t), lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function terrain(seed: number) {
  const vn2 = (x: number, z: number, s: number) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(x - ix), fz = smooth(z - iz);
    return lerp(lerp(brHash(ix, 0, iz, s), brHash(ix + 1, 0, iz, s), fx), lerp(brHash(ix, 0, iz + 1, s), brHash(ix + 1, 0, iz + 1, s), fx), fz);
  };
  const vn3 = (x: number, y: number, z: number, s: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
    const l = (a: number, b: number, d: number) => lerp(brHash(ix + a, iy + b, iz + d, s), brHash(ix + a + 1, iy + b, iz + d, s), fx);
    return lerp(lerp(l(0, 0, 0), l(0, 1, 0), fy), lerp(l(0, 0, 1), l(0, 1, 1), fy), fz);
  };
  const fbm = (x: number, z: number, o: number, s: number) => {
    let a = 1, f = 1, t = 0, n = 0;
    for (let i = 0; i < o; i++) (t += a * vn2(x * f, z * f, s + i * 17)), (n += a), (a *= 0.5), (f *= 2);
    return t / n;
  };
  const heightAt = (x: number, z: number) => Math.max(3, Math.min(56, Math.floor(14 + fbm(x * 0.006, z * 0.006, 3, seed) * 30 + (fbm(x * 0.03, z * 0.03, 3, seed + 5) - 0.5) * 9)));
  const treeAt = (x: number, z: number) => {
    if (brHash(x, 3, z, seed + 41) > 0.012) return 0;
    const h = heightAt(x, z);
    if (h <= SEA + 1 || h > 44) return 0;
    return 4 + Math.floor(brHash(x, 9, z, seed + 43) * 3);
  };
  const genChunk = (cx: number, cz: number, edits?: Map<number, number>) => {
    const d = new Uint8Array(CH * H * CH), x0 = cx * CH, z0 = cz * CH;
    for (let z = 0; z < CH; z++)
      for (let x = 0; x < CH; x++) {
        const wx = x0 + x, wz = z0 + z, h = heightAt(wx, wz), beach = h <= SEA + 1;
        for (let y = 0; y <= Math.max(h, SEA); y++) {
          let id = 0;
          if (y <= h) {
            id = y === h ? (beach ? 4 : 1) : y > h - 4 ? (beach ? 4 : 2) : 3;
            if (y > 2 && y < h - 4 && vn3(wx * 0.06, y * 0.09, wz * 0.06, seed + 90) > 0.74) id = 0;
          } else if (y <= SEA) id = 10;
          d[(y * CH + z) * CH + x] = id;
        }
      }
    for (let z = -2; z < CH + 2; z++)
      for (let x = -2; x < CH + 2; x++) {
        const wx = x0 + x, wz = z0 + z, th = treeAt(wx, wz);
        if (!th) continue;
        const base = heightAt(wx, wz) + 1;
        const put = (px: number, py: number, pz: number, id: number) => {
          if (px >= 0 && px < CH && pz >= 0 && pz < CH && py >= 0 && py < H && (id === 5 || !d[(py * CH + pz) * CH + px])) d[(py * CH + pz) * CH + px] = id;
        };
        for (let k = 0; k < th; k++) put(x, base + k, z, 5);
        for (let dy = -2; dy <= 1; dy++) {
          const r = dy <= -1 ? 2 : 1;
          for (let dz = -r; dz <= r; dz++)
            for (let dx = -r; dx <= r; dx++) {
              if (Math.abs(dx) === r && Math.abs(dz) === r && brHash(wx + dx, dy, wz + dz, seed + 7) > 0.5) continue;
              put(x + dx, base + th + dy, z + dz, 6);
            }
        }
      }
    edits?.forEach((id, i) => (d[i] = id));
    return d;
  };
  return { heightAt, treeAt, genChunk };
}

// ---------- meshing ----------
const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], a: 0 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], a: 0 },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], a: 1 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], a: 1 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], a: 2 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], a: 2 },
];
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const AOT = [0.42, 0.62, 0.82, 1];
export interface MeshData {
  pos: number[];
  nrm: number[];
  uv: number[];
  col: number[];
}
const md = (): MeshData => ({ pos: [], nrm: [], uv: [], col: [] });
/** Builds opaque, glowing and see-through geometry for one chunk. getB reads any world block. */
export function meshChunk(d: Uint8Array, cx: number, cz: number, getB: (x: number, y: number, z: number) => number) {
  const S = md(), G = md(), Tr = md(), x0 = cx * CH, z0 = cz * CH;
  const HALF = 0.5 / (T * 4), ts = 0.25 - 2 * HALF;
  for (let y = 0; y < H; y++)
    for (let z = 0; z < CH; z++)
      for (let x = 0; x < CH; x++) {
        const id = d[(y * CH + z) * CH + x];
        if (!id) continue;
        const trans = id === 9 || id === 10, out = trans ? Tr : id === 11 ? G : S, def = BLOCKS[id];
        const wx = x0 + x, wz = z0 + z;
        const waterTop = id === 10 && getB(wx, y + 1, wz) !== 10;
        for (let f = 0; f < 6; f++) {
          const F = FACES[f], nb = getB(wx + F.n[0], y + F.n[1], wz + F.n[2]);
          if (trans ? nb === id || OPQ[nb] : OPQ[nb]) continue;
          const tile = f === 2 ? def.t[0] : f === 3 ? def.t[1] : def.t[2];
          const tu = (tile % 4) / 4 + HALF, tv = Math.floor(tile / 4) / 4 + HALF;
          const t1 = (F.a + 1) % 3, t2 = (F.a + 2) % 3, ao: number[] = [];
          for (let i = 0; i < 4; i++) {
            const v = F.v[i], s1 = v[t1] * 2 - 1, s2 = v[t2] * 2 - 1, b = [wx + F.n[0], y + F.n[1], wz + F.n[2]];
            const p = [...b], q = [...b], r = [...b];
            p[t1] += s1;
            q[t2] += s2;
            r[t1] += s1;
            r[t2] += s2;
            const o1 = OPQ[getB(p[0], p[1], p[2])], o2 = OPQ[getB(q[0], q[1], q[2])], oc = OPQ[getB(r[0], r[1], r[2])];
            ao.push(trans || id === 11 ? 3 : o1 && o2 ? 0 : 3 - (o1 + o2 + oc));
          }
          const order = ao[0] + ao[2] < ao[1] + ao[3] ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
          for (const i of order) {
            const v = F.v[i], a = AOT[ao[i]];
            const vy = waterTop && v[1] === 1 ? 0.88 : v[1];
            out.pos.push(x + v[0], y + vy, z + v[2]);
            out.nrm.push(F.n[0], F.n[1], F.n[2]);
            out.uv.push(tu + ts * UVS[i][0], 1 - (tv + ts * (1 - UVS[i][1])));
            out.col.push(a, a, a);
          }
        }
      }
  return { S, G, Tr };
}
