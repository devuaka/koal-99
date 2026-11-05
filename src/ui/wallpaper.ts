import type { Wallpaper } from '../core/settings';

export const WALLPAPERS: { id: string; name: string }[] = [
  { id: 'hills', name: 'Aurora Meadow' },
  { id: 'ocean', name: 'Ocean Bubbles' },
  { id: 'ribbons', name: 'Green Ribbons' },
  { id: 'azure', name: 'Aqua Glass' },
  { id: 'sunrise', name: 'Sunrise Orbs' },
  { id: 'stars', name: 'Starlight' },
  { id: 'teal', name: 'Teal (Classic)' },
  { id: 'void', name: 'Void' },
];

// Deterministic random so wallpapers look the same every boot.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const W = 1600;
const H = 900;

const BUBBLE_DEF =
  '<radialGradient id="bub" cx=".38" cy=".32" r=".62"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".25" stop-color="#fff" stop-opacity=".15"/><stop offset=".85" stop-color="#bfeaff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity=".75"/></radialGradient>';

function bubbles(seed: number, n: number, yMin = 0, yMax = H, rMin = 8, rMax = 70) {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    const rad = rMin + Math.pow(r(), 2.2) * (rMax - rMin);
    const x = r() * W;
    const y = yMin + r() * (yMax - yMin);
    s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(1)}" fill="url(#bub)" stroke="#fff" stroke-opacity=".55" stroke-width="${Math.max(0.8, rad / 30).toFixed(1)}"/>`;
    s += `<ellipse cx="${(x - rad * 0.32).toFixed(0)}" cy="${(y - rad * 0.42).toFixed(0)}" rx="${(rad * 0.34).toFixed(1)}" ry="${(rad * 0.17).toFixed(1)}" fill="#fff" opacity=".8" transform="rotate(-28 ${(x - rad * 0.32).toFixed(0)} ${(y - rad * 0.42).toFixed(0)})"/>`;
  }
  return s;
}

function sparkles(seed: number, n: number, yMax = H * 0.6, color = '#fff') {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = r() * yMax;
    const k = 3 + r() * 9;
    s += `<path d="M${x} ${y - k}L${x + k * 0.22} ${y - k * 0.22}L${x + k} ${y}L${x + k * 0.22} ${y + k * 0.22}L${x} ${y + k}L${x - k * 0.22} ${y + k * 0.22}L${x - k} ${y}L${x - k * 0.22} ${y - k * 0.22}z" fill="${color}" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  }
  return s;
}

function swoosh(id: string, d: string, c1: string, c2: string, op = 0.6) {
  return {
    def: `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c1}" stop-opacity="0"/><stop offset=".45" stop-color="${c1}" stop-opacity="${op}"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></linearGradient>`,
    el: `<path d="${d}" fill="url(#${id})"/>`,
  };
}

function svg(defs: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${BUBBLE_DEF}<filter id="blur"><feGaussianBlur stdDeviation="18"/></filter><filter id="blur2"><feGaussianBlur stdDeviation="5"/></filter>${defs}</defs>${body}</svg>`;
}

const BUILD: Record<string, () => string> = {
  hills: () => {
    const s1 = swoosh('s1', 'M-100 520C300 300 700 260 1700 120L1700 210C900 320 400 380 -100 600z', '#ffffff', '#b8ffef', 0.7);
    const s2 = swoosh('s2', 'M-100 600C400 380 900 360 1700 300L1700 340C900 410 450 450 -100 650z', '#d9ffb0', '#ffffff', 0.55);
    const s3 = swoosh('s3', 'M200 0C500 200 1000 240 1700 40L1700 0z', '#ffffff', '#9fe7ff', 0.35);
    return svg(
      `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0757c9"/><stop offset=".45" stop-color="#3fa8f5"/><stop offset=".75" stop-color="#b8e8ff"/><stop offset="1" stop-color="#e8fbff"/></linearGradient>` +
        `<radialGradient id="sun" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1180 230) scale(420)"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".12" stop-color="#fffbe0" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
        `<linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6f76a"/><stop offset=".4" stop-color="#6fcf3a"/><stop offset="1" stop-color="#1f7a24"/></linearGradient>` +
        `<linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6ee55"/><stop offset="1" stop-color="#2c8f2a"/></linearGradient>` +
        `<linearGradient id="rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
        s1.def + s2.def + s3.def,
      `<rect width="${W}" height="${H}" fill="url(#sky)"/><rect width="${W}" height="${H}" fill="url(#sun)"/>` +
        s3.el + s1.el + s2.el +
        `<ellipse cx="420" cy="230" rx="260" ry="40" fill="#fff" opacity=".55" filter="url(#blur)"/><ellipse cx="1350" cy="420" rx="300" ry="35" fill="#fff" opacity=".5" filter="url(#blur)"/>` +
        sparkles(7, 26, H * 0.55) +
        `<path d="M-50 760C250 610 600 600 900 680S1450 740 1650 640V900H-50z" fill="url(#h2)"/>` +
        `<path d="M-50 820C300 690 700 670 1050 760S1500 820 1650 760V900H-50z" fill="url(#h1)"/>` +
        `<path d="M-50 820C300 690 700 670 1050 760S1500 820 1650 760" fill="none" stroke="url(#rim)" stroke-width="4" opacity=".8"/>` +
        bubbles(11, 18, 120, 700, 10, 85),
    );
  },
  ocean: () => {
    const r = rng(5);
    let rays = '';
    for (let i = 0; i < 9; i++) {
      const x = r() * W;
      const w = 40 + r() * 140;
      rays += `<polygon points="${x},0 ${x + w},0 ${x + w * 3 - 200},${H} ${x - 200},${H}" fill="#fff" opacity="${(0.05 + r() * 0.08).toFixed(2)}"/>`;
    }
    return svg(
      `<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe3ff"/><stop offset=".35" stop-color="#1aa7d8"/><stop offset=".8" stop-color="#0a5a9a"/><stop offset="1" stop-color="#062e5a"/></linearGradient>` +
        `<linearGradient id="sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a8"/><stop offset="1" stop-color="#c79a4a"/></linearGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#sea)"/>${rays}<path d="M0 60C400 0 1200 120 1600 40V0H0z" fill="#fff" opacity=".35"/>` +
        `<path d="M-50 850C300 790 800 800 1650 830V900H-50z" fill="url(#sand)" opacity=".85"/>` +
        bubbles(21, 55, 40, 860, 6, 95),
    );
  },
  ribbons: () => {
    const rb = (id: string, d: string, c1: string, c2: string) =>
      `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient><path id="p${id}" d="${d}"/>`;
    const defs =
      `<radialGradient id="bg" cx=".3" cy=".25" r="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d9f6c4"/><stop offset="1" stop-color="#4fb84a"/></radialGradient>` +
      rb('a', 'M-100 700C300 380 700 820 1100 520S1500 260 1700 320V420C1500 360 1300 560 1100 640S400 560 -100 860z', '#c9ff7a', '#2f9e2c') +
      rb('b', 'M-100 560C400 340 800 700 1200 460S1600 300 1700 260V310C1500 330 1300 560 1150 590S500 480 -100 640z', '#ffffff', '#7fe0ff') +
      rb('c', 'M-100 800C500 560 900 900 1300 700S1600 600 1700 620V900H-100z', '#7ad33a', '#0f6a1c');
    return svg(
      defs,
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>` +
        `<use href="#pa" fill="url(#a)" opacity=".9"/><use href="#pb" fill="url(#b)" opacity=".85"/><use href="#pc" fill="url(#c)"/>` +
        `<path d="M-100 700C300 380 700 820 1100 520S1500 260 1700 320" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>` +
        sparkles(3, 18, H * 0.5, '#ffffff') +
        bubbles(31, 12, 60, 500, 10, 60),
    );
  },
  azure: () =>
    svg(
      `<linearGradient id="az" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#003a8c"/><stop offset=".5" stop-color="#0a8fe0"/><stop offset="1" stop-color="#8ff0ff"/></linearGradient>` +
        `<radialGradient id="orb" cx=".4" cy=".3" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".3" stop-color="#bff6ff" stop-opacity=".35"/><stop offset="1" stop-color="#0a8fe0" stop-opacity=".1"/></radialGradient>` +
        swoosh('w1', 'M-100 300C400 520 900 120 1700 420V520C900 260 400 640 -100 420z', '#ffffff', '#bff6ff', 0.5).def,
      `<rect width="${W}" height="${H}" fill="url(#az)"/>` +
        swoosh('w1', 'M-100 300C400 520 900 120 1700 420V520C900 260 400 640 -100 420z', '#ffffff', '#bff6ff', 0.5).el +
        `<circle cx="1220" cy="560" r="230" fill="url(#orb)" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><ellipse cx="1150" cy="430" rx="120" ry="55" fill="#fff" opacity=".55" transform="rotate(-25 1150 430)"/>` +
        `<circle cx="380" cy="250" r="110" fill="url(#orb)" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><ellipse cx="345" cy="190" rx="55" ry="26" fill="#fff" opacity=".55" transform="rotate(-25 345 190)"/>` +
        sparkles(13, 30, H) +
        bubbles(41, 22, 0, H, 6, 40),
    ),
  sunrise: () =>
    svg(
      `<linearGradient id="sr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1c8f"/><stop offset=".45" stop-color="#e0559a"/><stop offset=".75" stop-color="#ffb35a"/><stop offset="1" stop-color="#fff2b0"/></linearGradient>` +
        `<radialGradient id="sun" cx=".5" cy=".92" r=".5"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".2" stop-color="#fff6c0" stop-opacity=".8"/><stop offset="1" stop-color="#ffb35a" stop-opacity="0"/></radialGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#sr)"/><rect width="${W}" height="${H}" fill="url(#sun)"/>` +
        `<path d="M-100 700C400 520 1000 520 1700 640V900H-100z" fill="#2a1048" opacity=".55"/>` +
        sparkles(17, 40, H * 0.5) +
        bubbles(51, 26, 60, 760, 8, 90),
    ),
  stars: () => {
    const r = rng(77);
    let st = '';
    for (let i = 0; i < 260; i++) st += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(0.4 + r() * 1.6).toFixed(1)}" fill="#fff" opacity="${(0.3 + r() * 0.7).toFixed(2)}"/>`;
    const a = swoosh('au', 'M-100 520C300 300 800 460 1700 200V300C900 520 400 420 -100 640z', '#5affc8', '#7aa8ff', 0.45);
    return svg(
      `<radialGradient id="ns" cx=".5" cy="1.1" r="1.2"><stop offset="0" stop-color="#3a2a8a"/><stop offset=".5" stop-color="#0b1a4a"/><stop offset="1" stop-color="#02040f"/></radialGradient>` +
        `<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".15" stop-color="#bfe6ff" stop-opacity=".8"/><stop offset="1" stop-color="#2a6aff" stop-opacity="0"/></radialGradient>` +
        a.def,
      `<rect width="${W}" height="${H}" fill="url(#ns)"/>${st}${a.el}<g filter="url(#blur2)">${a.el}</g>` +
        `<circle cx="1180" cy="260" r="160" fill="url(#glow)"/>` +
        `<path d="M1180 180L1196 244L1260 260L1196 276L1180 340L1164 276L1100 260L1164 244z" fill="#fff"/>` +
        sparkles(9, 40, H, '#dff1ff'),
    );
  },
  void: () =>
    svg(
      `<radialGradient id="v" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#4a0808"/><stop offset=".6" stop-color="#120000"/><stop offset="1" stop-color="#000"/></radialGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#v)"/><circle cx="800" cy="400" r="40" fill="#ff2a2a" opacity=".15" filter="url(#blur)"/>`,
    ),
};

const cache = new Map<string, string>();
export function wallpaperUrl(id: string): string | null {
  const b = BUILD[id];
  if (!b) return null;
  let u = cache.get(id);
  if (!u) {
    u = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(b())}")`;
    cache.set(id, u);
  }
  return u;
}

export function wallpaperProps(wp: Wallpaper): { className: string; style: React.CSSProperties } {
  if (wp.kind === 'preset') {
    if (wp.value === 'teal') return { className: 'wallpaper', style: { background: '#008080' } };
    const u = wallpaperUrl(wp.value) ?? wallpaperUrl('hills')!;
    return { className: 'wallpaper', style: { backgroundImage: u, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#3fa8f5' } };
  }
  if (wp.kind === 'color') return { className: 'wallpaper', style: { background: wp.value } };
  const fit = wp.fit ?? 'cover';
  return {
    className: 'wallpaper',
    style: {
      backgroundColor: '#3a6ea5',
      backgroundImage: `url(${wp.value})`,
      backgroundSize: fit === 'cover' ? 'cover' : 'auto',
      backgroundRepeat: fit === 'tile' ? 'repeat' : 'no-repeat',
      backgroundPosition: 'center',
    },
  };
}
