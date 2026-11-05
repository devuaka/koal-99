// Arena 3D data, carried over from koalOS so matches and saved profiles stay compatible:
// maps (6 built in + your own from the map editor), 28 weapons and the skill tree that unlocks them.
export type RGB = [number, number, number];
export interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
  y: number;
  top: number;
  col: RGB;
}
export interface Weapon {
  n: string;
  dmg: number;
  rate: number;
  spread: number;
  mag: number;
  reload: number;
  pellets: number;
  auto: boolean;
  melee: boolean;
  price: number;
  range?: number;
  splash?: number;
  pierce?: boolean;
  laser?: boolean;
}
export const PROFILE_KEY = 'koalos.arena', CUSTOM_KEY = 'koalos.arena.custommaps';
export const MAP_NAMES = ['Hallways', 'Open Field', 'Cross Court', 'Corner Towers', 'Tight 2-Floor Maze', 'Lava Platforms'];
export const LAVA = 5, WIN_KILLS = 10, S = 22.5;
export const SPAWNS: number[][] = [[0, -20], [0, 20], [20, 0], [-20, 0], [0, -9], [0, 9], [9, 0], [-9, 0]];
const BUILTIN_SPAWNS: Record<number, number[][]> = { 4: [[-6.4, -6.4], [6.4, -6.4], [-6.4, 6.4], [6.4, 6.4], [-6.4, 0], [6.4, 0]], 5: [[9, 0, 2.0], [-9, 0, 1.8], [0, 9, 2.2], [0, -9, 1.6], [6.4, 6.4, 1.8], [-6.4, -6.4, 2.2]] };
export interface CustomMap {
  name: string;
  boxes: Box[];
  spawns: number[][];
}
export const customMaps = (): CustomMap[] => {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]') || [];
  } catch {
    return [];
  }
};
export const saveCustomMaps = (l: CustomMap[]) => {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(l));
  } catch {
    /* storage full */
  }
};
export const allMapNames = () => MAP_NAMES.concat(customMaps().map((m) => m.name));
export function spawnsFor(v: number) {
  if (v >= MAP_NAMES.length) {
    const cm = customMaps()[v - MAP_NAMES.length];
    return cm?.spawns?.length ? cm.spawns : SPAWNS;
  }
  return BUILTIN_SPAWNS[v] || SPAWNS;
}
const MAZE: Box[] = [{x:-6.4,z:-4.8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:-1.6,z:-6.4,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:0,z:-4.8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:3.2,z:-4.8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:8,z:-6.4,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:-1.6,z:-3.2,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:-3.2,z:-1.6,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:3.2,z:-1.6,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:8,z:-3.2,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:-6.4,z:1.6,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:-3.2,z:1.6,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:1.6,z:0,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:0,z:1.6,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:8,z:0,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:6.4,z:1.6,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:-3.2,z:4.8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:1.6,z:3.2,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:3.2,z:4.8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:8,z:3.2,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:-6.4,z:8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:-1.6,z:6.4,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:-3.2,z:8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:0,z:8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:3.2,z:8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:8,z:6.4,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:6.4,z:8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:-8,z:-6.4,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:-8,z:-3.2,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:-8,z:0,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:-8,z:3.2,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:-8,z:6.4,w:.35,d:3.55,y:0,top:2.4,col:[.45,.5,.62]},{x:-6.4,z:-8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:-3.2,z:-8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:0,z:-8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:3.2,z:-8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:6.4,z:-8,w:3.55,d:.35,y:0,top:2.4,col:[.45,.5,.62]},{x:-4.8,z:-6.4,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:-3.2,z:-4.8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:3.2,z:-4.8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:8,z:-6.4,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:-6.4,z:-1.6,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:-1.6,z:-3.2,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:1.6,z:-3.2,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:8,z:-3.2,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:6.4,z:-1.6,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:-4.8,z:0,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:-3.2,z:1.6,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:1.6,z:0,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:0,z:1.6,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:3.2,z:1.6,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:8,z:0,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:1.6,z:3.2,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:0,z:4.8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:8,z:3.2,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:6.4,z:4.8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:-4.8,z:6.4,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:-6.4,z:8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:-3.2,z:8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:0,z:8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:3.2,z:8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:8,z:6.4,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:6.4,z:8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:-8,z:-6.4,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:-8,z:-3.2,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:-8,z:0,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:-8,z:3.2,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:-8,z:6.4,w:.35,d:3.55,y:4,top:6.4,col:[.5,.4,.55]},{x:-6.4,z:-8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:-3.2,z:-8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:0,z:-8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:3.2,z:-8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:6.4,z:-8,w:3.55,d:.35,y:4,top:6.4,col:[.5,.4,.55]},{x:-6.4,z:-6.4,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:-3.2,z:-6.4,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:0,z:-6.4,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:3.2,z:-6.4,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:6.4,z:-6.4,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:-6.4,z:-3.2,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:-3.2,z:-3.2,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:0,z:-3.2,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:3.2,z:-3.2,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:6.4,z:-3.2,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:-6.4,z:0,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:-3.2,z:0,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:3.2,z:0,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:6.4,z:0,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:-6.4,z:3.2,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:-3.2,z:3.2,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:0,z:3.2,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:3.2,z:3.2,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:6.4,z:3.2,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:-6.4,z:6.4,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:-3.2,z:6.4,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:0,z:6.4,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:3.2,z:6.4,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:6.4,z:6.4,w:3.1,d:3.1,y:3.7,top:4,col:[.3,.32,.4]},{x:-1.22,z:0,w:.81,d:2.6,y:0,top:1,col:[.55,.5,.35]},{x:-.46,z:0,w:.81,d:2.6,y:0,top:2,col:[.55,.5,.35]},{x:.3,z:0,w:.81,d:2.6,y:0,top:3,col:[.55,.5,.35]},{x:1.07,z:0,w:.81,d:2.6,y:0,top:4,col:[.55,.5,.35]}];
export const WEAPONS: Record<string, Weapon> = {
  pistol:{n:'Pistol',dmg:24,rate:.28,spread:.010,mag:12,reload:1.0,pellets:1,auto:false,melee:false,price:0},
  revolver:{n:'Revolver',dmg:38,rate:.5,spread:.012,mag:6,reload:1.3,pellets:1,auto:false,melee:false,price:10},
  smg:{n:'SMG',dmg:11,rate:.09,spread:.03,mag:26,reload:1.6,pellets:1,auto:true,melee:false,price:25},
  shotgun:{n:'Shotgun',dmg:9,rate:.8,spread:.12,mag:6,reload:2.0,pellets:7,auto:false,melee:false,price:40},
  rifle:{n:'Rifle',dmg:16,rate:.13,spread:.018,mag:30,reload:1.7,pellets:1,auto:true,melee:false,price:40},
  crossbow:{n:'Crossbow',dmg:70,rate:1.0,spread:.002,mag:1,reload:1.6,pellets:1,auto:false,melee:false,price:45},
  burst:{n:'Burst Rifle',dmg:14,rate:.4,spread:.014,mag:24,reload:1.6,pellets:3,auto:false,melee:false,price:65},
  sniper:{n:'Sniper',dmg:92,rate:1.15,spread:.0015,mag:5,reload:1.8,pellets:1,auto:false,melee:false,price:55},
  grenade:{n:'Grenade Launcher',dmg:45,rate:1.0,spread:.02,mag:3,reload:2.2,pellets:1,auto:false,melee:false,splash:3,price:90},
  minigun:{n:'Minigun',dmg:7,rate:.06,spread:.05,mag:60,reload:3.2,pellets:1,auto:true,melee:false,price:100},
  railgun:{n:'Railgun',dmg:55,rate:.9,spread:.003,mag:4,reload:2.0,pellets:1,auto:false,melee:false,pierce:true,price:120},
  deathlaser:{n:'Death Laser',dmg:9999,rate:1.4,spread:.004,mag:2,reload:2.5,pellets:1,auto:false,melee:false,laser:true,price:500},
  machete:{n:'Machete',dmg:65,rate:.45,spread:0,mag:Infinity,reload:0,pellets:1,auto:false,melee:true,range:2.4,price:5},
  akimbo:{n:'Akimbo Pistols',dmg:18,rate:.1,spread:.022,mag:24,reload:1.4,pellets:1,auto:true,melee:false,price:20},
  tacsmg:{n:'Tactical SMG',dmg:9,rate:.07,spread:.032,mag:32,reload:1.5,pellets:1,auto:true,melee:false,price:45},
  combatshotgun:{n:'Combat Shotgun',dmg:8,rate:.65,spread:.13,mag:8,reload:2.1,pellets:9,auto:false,melee:false,price:60},
  marksman:{n:'Marksman Rifle',dmg:34,rate:.35,spread:.01,mag:15,reload:1.6,pellets:1,auto:false,melee:false,price:65},
  handcrossbow:{n:'Hand Crossbow',dmg:45,rate:.55,spread:.004,mag:2,reload:1.0,pellets:1,auto:false,melee:false,price:50},
  autosniper:{n:'Auto Sniper',dmg:48,rate:.3,spread:.006,mag:8,reload:2.0,pellets:1,auto:true,melee:false,price:95},
  flamethrower:{n:'Flamethrower',dmg:4,rate:.04,spread:.2,mag:100,reload:2.5,pellets:1,auto:true,melee:false,price:90},
  boltcarbine:{n:'Bolt Carbine',dmg:13,rate:.45,spread:.016,mag:20,reload:1.5,pellets:4,auto:false,melee:false,price:80},
  plasmarifle:{n:'Plasma Rifle',dmg:60,rate:.5,spread:.006,mag:8,reload:2.2,pellets:1,auto:false,melee:false,pierce:true,price:150},
  rocketlauncher:{n:'Rocket Launcher',dmg:70,rate:1.3,spread:.02,mag:2,reload:2.6,pellets:1,auto:false,melee:false,splash:5,price:170},
  chaingun:{n:'Chain Gun',dmg:9,rate:.045,spread:.055,mag:90,reload:3.6,pellets:1,auto:true,melee:false,price:190},
  ioncannon:{n:'Ion Cannon',dmg:9999,rate:1.0,spread:.003,mag:3,reload:2.2,pellets:1,auto:false,melee:false,laser:true,price:650},
  voidripper:{n:'Void Ripper',dmg:80,rate:.8,spread:.01,mag:5,reload:2.4,pellets:1,auto:false,melee:false,pierce:true,splash:3,price:240},
  nukelauncher:{n:'Nuke Launcher',dmg:110,rate:1.8,spread:.02,mag:1,reload:3.2,pellets:1,auto:false,melee:false,splash:7,price:320},
  singularity:{n:'Singularity Blaster',dmg:9999,rate:1.6,spread:.005,mag:2,reload:3.0,pellets:1,auto:false,melee:false,laser:true,pierce:true,price:450}
};
export const SKILL_TREE: Record<string, { req: string | null; tier: number }> = {
  revolver:{req:null,tier:1},smg:{req:null,tier:1},machete:{req:null,tier:1},akimbo:{req:null,tier:1},
  crossbow:{req:'revolver',tier:2},shotgun:{req:'smg',tier:2},rifle:{req:'smg',tier:2},
  tacsmg:{req:'smg',tier:2},combatshotgun:{req:'shotgun',tier:2},marksman:{req:'rifle',tier:2},handcrossbow:{req:'crossbow',tier:2},
  burst:{req:'rifle',tier:3},sniper:{req:'rifle',tier:3},grenade:{req:'shotgun',tier:3},railgun:{req:'crossbow',tier:3},
  autosniper:{req:'sniper',tier:3},flamethrower:{req:'combatshotgun',tier:3},boltcarbine:{req:'burst',tier:3},
  minigun:{req:'grenade',tier:4},deathlaser:{req:'railgun',tier:4},
  plasmarifle:{req:'railgun',tier:4},rocketlauncher:{req:'grenade',tier:4},chaingun:{req:'minigun',tier:4},
  ioncannon:{req:'deathlaser',tier:5},voidripper:{req:'plasmarifle',tier:5},nukelauncher:{req:'rocketlauncher',tier:5},
  singularity:{req:'voidripper',tier:6}
};

export function genMap(v: number): Box[] {
  const T = 1.2, o: Box[] = [];
  const add = (l: number[][], col: RGB) => l.forEach(([x, z, w, d, h]) => o.push({ x, z, w, d, y: 0, top: h, col }));
  if (v >= MAP_NAMES.length) customMaps()[v - MAP_NAMES.length]?.boxes.forEach((b) => o.push({ x: b.x, z: b.z, w: b.w, d: b.d, y: b.y || 0, top: b.top, col: b.col || [0.55, 0.62, 0.78] }));
  else if (v === 4) MAZE.forEach((b) => o.push({ ...b }));
  else if (v === LAVA)
    add([[0, 0, 7, 7, 2.4], [9, 0, 3, 3, 2.0], [-9, 0, 3, 3, 1.8], [0, 9, 3, 3, 2.2], [0, -9, 3, 3, 1.6], [6.4, 6.4, 3, 3, 1.8], [-6.4, 6.4, 3, 3, 2.0], [6.4, -6.4, 3, 3, 1.6], [-6.4, -6.4, 3, 3, 2.2], [16, 4, 2.6, 2.6, 1.4], [-16, 4, 2.6, 2.6, 1.2], [4, 16, 2.6, 2.6, 1.6], [-4, 16, 2.6, 2.6, 1.3], [4, -16, 2.6, 2.6, 1.5], [-4, -16, 2.6, 2.6, 1.2], [16, -4, 2.6, 2.6, 1.4], [-16, -4, 2.6, 2.6, 1.3]], [0.3, 0.27, 0.24]);
  else if (v === 1)
    add([[0, 0, 6, 6, 1.2], [0, 0, 2, 2, 3.4], [-10, -10, 4, 1, 2.4], [10, 10, 4, 1, 2.4], [-10, 10, 1, 4, 2.4], [10, -10, 1, 4, 2.4], [-6, 0, 1.2, 5, 2.4], [6, 0, 1.2, 5, 2.4], [0, -8, 5, 1.2, 2.4], [0, 8, 5, 1.2, 2.4], [-15, -3, 3, 3, 1.6], [15, 3, 3, 3, 1.6], [-15, 15, 3, 3, 3], [15, -15, 3, 3, 3], [-4, -15, 2, 2, 1.2], [4, 15, 2, 2, 1.2]], [0.55, 0.62, 0.78]);
  else if (v === 2) {
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => o.push({ x: sx * 13.5, z: sz * 13.5, w: 17, d: 17, y: 0, top: 2.6, col: [0.5, 0.56, 0.68] }));
    add([[0, 0, 2, 2, 3], [8, 8, 1.6, 1.6, 1], [-8, -8, 1.6, 1.6, 1], [8, -8, 1.6, 1.6, 1], [-8, 8, 1.6, 1.6, 1]], [0.62, 0.48, 0.32]);
  } else if (v === 3) {
    [[-14, -14], [14, 14], [-14, 14], [14, -14]].forEach(([x, z]) => {
      o.push({ x, z, w: 4, d: 4, y: 0, top: 1.4, col: [0.5, 0.56, 0.7] });
      o.push({ x: x * 0.6, z: z * 0.6, w: 3, d: 3, y: 0, top: 2.8, col: [0.5, 0.56, 0.7] });
    });
    add([[0, 0, 3, 3, 1.2], [6, 0, 1.5, 1.5, 1], [-6, 0, 1.5, 1.5, 1], [0, 6, 1.5, 1.5, 1], [0, -6, 1.5, 1.5, 1]], [0.62, 0.48, 0.32]);
  } else {
    const CH = 3.5, OUT = S - 1.5, H = 2.8, W: RGB = [0.5, 0.56, 0.68];
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
      const az0 = CH, az1 = OUT, ax0 = CH, ax1 = CH + 7, bx0 = CH + 9, bx1 = OUT;
      o.push({ x: (sx * (ax0 + ax1)) / 2, z: (sz * (az0 + az1)) / 2, w: ax1 - ax0, d: az1 - az0, y: 0, top: H, col: W });
      o.push({ x: (sx * (bx0 + bx1)) / 2, z: (sz * (az0 + az1)) / 2, w: bx1 - bx0, d: az1 - az0, y: 0, top: H, col: W });
    });
    o.push({ x: 0, z: 0, w: 2.2, d: 2.2, y: 0, top: 3.2, col: [0.55, 0.62, 0.78] });
    add([[0, -6, 1.6, 1.6, 1], [0, 6, 1.6, 1.6, 1], [6, 0, 1.6, 1.6, 1], [-6, 0, 1.6, 1.6, 1], [11.5, -9, 1.4, 1.4, 0.9], [-11.5, 9, 1.4, 1.4, 0.9], [11.5, 9, 1.4, 1.4, 0.9], [-11.5, -9, 1.4, 1.4, 0.9]], [0.62, 0.48, 0.32]);
  }
  [[0, -S, 2 * S + 2 * T, T], [0, S, 2 * S + 2 * T, T], [-S, 0, T, 2 * S], [S, 0, T, 2 * S]].forEach(([x, z, w, d]) => o.push({ x, z, w, d, y: 0, top: 8, col: [0.3, 0.34, 0.5] }));
  return o;
}
export const WEAPON_KEYS = Object.keys(WEAPONS);
export const SCOPE_FOV: Record<string, number> = { pistol: 62, smg: 65, shotgun: 68, sniper: 32, marksman: 45, autosniper: 40, railgun: 42 };
export const SCOPED = new Set(['sniper', 'marksman', 'autosniper', 'railgun']);