// Glossy vector icons in a Frutiger Aero style. Each icon is an SVG string on a 48x48 grid.
// They are rendered as data-URL images, so gradient ids never clash between icons.

type Stop = [number, string, number?];
const S = (...cs: Stop[]) => cs.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('');
const L = (id: string, stops: string, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
const R = (id: string, stops: string, cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops}</radialGradient>`;

const COMMON =
  R('sh', S([0, '#000', 0.38], [1, '#000', 0])) +
  L('gl', S([0, '#fff', 0.95], [0.6, '#fff', 0.25], [1, '#fff', 0])) +
  L('gls', S([0, '#fff', 0.6], [1, '#fff', 0]));

const shadow = (cx = 24, cy = 44.5, rx = 17, ry = 2.6) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#sh)"/>`;

function starPts(cx: number, cy: number, ro: number, ri: number, n = 5, rot = -90) {
  const p: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    p.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return p.join(' ');
}

/** A chubby five-point star path with soft rounded tips (kt) and inner corners (ki). */
export function roundStar(cx: number, cy: number, ro: number, ri: number, kt = 0.3, ki = 0.2) {
  const pts: number[][] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  const f = (p: number[]) => p[0].toFixed(2) + ' ' + p[1].toFixed(2);
  let d = '';
  pts.forEach((p, i) => {
    const pv = pts[(i + 9) % 10];
    const nx = pts[(i + 1) % 10];
    const k = i % 2 ? ki : kt;
    d += (i ? 'L' : 'M') + f([p[0] + (pv[0] - p[0]) * k, p[1] + (pv[1] - p[1]) * k]) + 'Q' + f(p) + ' ' + f([p[0] + (nx[0] - p[0]) * k, p[1] + (nx[1] - p[1]) * k]);
  });
  return d + 'Z';
}

/** Glossy sphere. Colors: highlight, mid, dark. */
function orb(id: string, c1: string, c2: string, c3: string, cx = 24, cy = 23, r = 19) {
  return {
    defs: R(id, S([0, c1], [0.55, c2], [1, c3]), 0.45, 0.32, 0.72, 0.4, 0.22) + R(id + 'b', S([0, c1, 0.9], [1, c1, 0]), 0.5, 1, 0.6),
    body:
      shadow(cx, cy + r + 2.5, r * 0.85, 2.4) +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>` +
      `<ellipse cx="${cx}" cy="${cy + r * 0.62}" rx="${r * 0.7}" ry="${r * 0.32}" fill="url(#${id}b)" opacity=".7"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r - 0.5}" fill="none" stroke="${c3}" stroke-opacity=".55"/>`,
    gloss: `<ellipse cx="${cx}" cy="${cy - r * 0.48}" rx="${r * 0.72}" ry="${r * 0.44}" fill="url(#gl)"/>`,
  };
}

const goldStar = (cx: number, cy: number, ro: number, ri: number, id = 'gs') => ({
  defs: L(id, S([0, '#fffbe0'], [0.45, '#ffd34d'], [1, '#f08a00'])),
  body: `<polygon points="${starPts(cx, cy, ro, ri)}" fill="url(#${id})" stroke="#b76200" stroke-width=".8" stroke-linejoin="round"/>` + `<polygon points="${starPts(cx, cy - ro * 0.18, ro * 0.55, ri * 0.55)}" fill="#fff" opacity=".45"/>`,
});

// ---------- shared shapes ----------
function folder(badge = '', badgeDefs = '', open = false) {
  const defs =
    L('fb', S([0, '#f9cf6e'], [1, '#dc9a26'])) +
    L('ff', S([0, '#fff3c8'], [0.35, '#ffe08a'], [1, '#f3ad2e'])) +
    L('fp', S([0, '#ffffff'], [1, '#dfe8f3'])) +
    badgeDefs;
  const front = open
    ? `<path d="M7 20.5a2 2 0 0 1 2-1.5h36a1.4 1.4 0 0 1 1.4 1.8l-4.6 17.6a2 2 0 0 1-2 1.6H4.6a1.3 1.3 0 0 1-1.3-1.7z" fill="url(#ff)" stroke="#c98a1c" stroke-width=".8"/><path d="M8.5 20.6h36" stroke="#fff" stroke-opacity=".9"/>`
    : `<path d="M2.5 19.5a2 2 0 0 1 2-2h39a2 2 0 0 1 2 2.2l-1.7 17.6a2.2 2.2 0 0 1-2.2 2H6.4a2.2 2.2 0 0 1-2.2-2z" fill="url(#ff)" stroke="#c98a1c" stroke-width=".8"/><path d="M4 18.8h40" stroke="#fff" stroke-opacity=".9"/>`;
  return (
    `<defs>${defs}</defs>` +
    shadow(24, 41.5, 20, 2.4) +
    `<path d="M5 8.5h12.5a2 2 0 0 1 1.6.8l2.4 3.2h21a2 2 0 0 1 2 2V36H3V10.5a2 2 0 0 1 2-2z" fill="url(#fb)" stroke="#b97b12" stroke-width=".8"/>` +
    `<rect x="7" y="13.5" width="34" height="${open ? 14 : 16}" rx="1" fill="url(#fp)" stroke="#b7c3d0" stroke-width=".5" transform="${open ? 'rotate(-6 24 20)' : ''}"/>` +
    front +
    `<path d="M5 20h38l-.6 6C30 23 16 23 4.6 26z" fill="#fff" opacity=".35"/>` +
    badge
  );
}

function page(content = '', defs = '', tint = '#ffffff') {
  return (
    `<defs>${L('pg', S([0, tint], [1, '#e3eaf3']))}${L('fd', S([0, '#ffffff'], [1, '#c3cfdd']), 0, 0, 1, 1)}${defs}</defs>` +
    shadow(24, 44.5, 14, 2.2) +
    `<path d="M11 3.5h18.5l10 10V42a2 2 0 0 1-2 2h-26.5a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2z" fill="url(#pg)" stroke="#8d9db2" stroke-width=".9"/>` +
    `<path d="M29.5 3.5v8a2 2 0 0 0 2 2h8z" fill="url(#fd)" stroke="#8d9db2" stroke-width=".9" stroke-linejoin="round"/>` +
    content
  );
}

const lines = (y0: number, n: number, x1 = 14, x2 = 34, gap = 4) =>
  Array.from({ length: n }, (_, i) => `<rect x="${x1}" y="${y0 + i * gap}" width="${i === n - 1 ? (x2 - x1) * 0.6 : x2 - x1}" height="1.6" rx=".8" fill="#9fb3cc"/>`).join('');

function screen(inner: string, innerDefs = '', bezel: [string, string] = ['#7286a0', '#202b38']) {
  return (
    `<defs>${L('bz', S([0, bezel[0]], [1, bezel[1]]))}${L('st', S([0, '#f5f7fa'], [1, '#9aa5b3']))}${innerDefs}</defs>` +
    shadow(24, 44.5, 15, 2) +
    `<path d="M20 34h8l1.5 6h-11z" fill="url(#st)"/><ellipse cx="24" cy="41" rx="10" ry="2.4" fill="url(#st)" stroke="#7d8896" stroke-width=".5"/>` +
    `<rect x="3" y="5" width="42" height="30" rx="3.5" fill="url(#bz)" stroke="#141b24" stroke-width=".8"/>` +
    `<rect x="6" y="8" width="36" height="23.5" rx="1.5" fill="#000"/>` +
    inner +
    `<path d="M6 8h36v9C30 13 18 20 6 22z" fill="#fff" opacity=".22"/>`
  );
}

const sky =
  L('sk', S([0, '#1e88e5'], [0.6, '#7fd0ff'], [1, '#d8f4ff'])) + L('gr', S([0, '#9be15d'], [1, '#2e9a2c']));
const skyScene = `<rect x="6" y="8" width="36" height="23.5" rx="1.5" fill="url(#sk)"/><path d="M6 25c8-5 18-6 36-2v8.5H6z" fill="url(#gr)"/><polygon points="${starPts(33, 14, 3.4, 1.4)}" fill="#fff8c0"/>`;

function badge(x: number, y: number, inner: string) {
  return `<g transform="translate(${x} ${y})">${inner}</g>`;
}

// ---------- icon definitions ----------
const I: Record<string, string> = {};

{
  const o = orb('o', '#c8f4ff', '#2aa1f0', '#0a3c8c');
  const st = goldStar(24, 24, 13, 5.4);
  I.logo = `<defs>${o.defs}${st.defs}</defs>${o.body}${st.body}${o.gloss}`;
}
{
  const st = goldStar(24, 23, 20, 8.5);
  I.star = `<defs>${st.defs}</defs>${shadow(24, 44, 16, 2.4)}${st.body}<ellipse cx="22" cy="15" rx="9" ry="5" fill="url(#gls)"/>`;
}
I.computer = screen(skyScene, sky);
I.monitor = I.computer;
I.mycomputer = I.computer;
I.taskmgr = screen(
  `<rect x="6" y="8" width="36" height="23.5" rx="1.5" fill="#031a0c"/>` +
    Array.from({ length: 6 }, (_, i) => `<line x1="${6 + i * 6}" y1="8" x2="${6 + i * 6}" y2="31.5" stroke="#0b5a2a" stroke-width=".5"/>`).join('') +
    `<polyline points="7,27 12,24 16,26 20,17 24,21 28,13 32,19 36,15 41,18" fill="none" stroke="#3dff7a" stroke-width="1.8" stroke-linejoin="round"/>`,
);

I.folder = folder();
I.folderopen = folder('', '', true);
I.explorer = I.folderopen;
I.documents = folder(badge(13, 20, `<rect x="2" y="0" width="18" height="17" rx="1.5" fill="#fff" stroke="#8d9db2" stroke-width=".7"/>${lines(4, 3, 5, 17, 4)}`));
I.pictures = folder(badge(12, 20, `<rect x="1" y="0" width="22" height="16" rx="1.5" fill="#fff" stroke="#8d9db2" stroke-width=".7"/><rect x="3" y="2" width="18" height="12" fill="url(#sk)"/><path d="M3 11c5-3 10-3 18-1v4H3z" fill="url(#gr)"/>`), sky);
I.music = folder(badge(16, 18, `<circle cx="4" cy="15" r="4" fill="url(#nt)"/><circle cx="14" cy="13" r="4" fill="url(#nt)"/><path d="M7.5 15V3l10-2v12" fill="none" stroke="#5a2a9a" stroke-width="2"/>`), L('nt', S([0, '#d9b8ff'], [1, '#6a2fc0'])));

I.text = page(lines(18, 6));
I.notepad_page = I.text;
I.image = page(`<rect x="12" y="18" width="24" height="18" rx="1" fill="url(#sk)" stroke="#7d93ad" stroke-width=".6"/><path d="M12 31c6-4 13-4 24-1v6H12z" fill="url(#gr)"/><polygon points="${starPts(30, 23, 3, 1.2)}" fill="#fff8c0"/>`, sky);
I.audio = page(`<circle cx="18" cy="33" r="5" fill="url(#nt)"/><circle cx="30" cy="30" r="5" fill="url(#nt)"/><path d="M22.5 33V19l12-3v14" fill="none" stroke="#5a2a9a" stroke-width="2.4" stroke-linejoin="round"/>`, L('nt', S([0, '#e2c8ff'], [1, '#6a2fc0'])));
{
  const g = R('gb', S([0, '#c8f4ff'], [0.6, '#2aa1f0'], [1, '#0a3c8c']), 0.4, 0.3, 0.7);
  I.web = page(`<circle cx="24" cy="29" r="9" fill="url(#gb)"/><path d="M19 25c3 1 4 3 2 5s1 4 3 4M27 22c-1 3 2 4 4 3" fill="none" stroke="#6fd26a" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="24" cy="25" rx="6" ry="3" fill="url(#gls)"/>`, g);
}
I.corrupt = page(
  `<rect x="13" y="18" width="20" height="2" fill="#e23b2e"/><rect x="16" y="22" width="14" height="2" fill="#2f6fe0"/><rect x="12" y="26" width="9" height="2" fill="#9fb3cc"/><rect x="23" y="26" width="12" height="2" fill="#22c55e"/><rect x="14" y="30" width="18" height="2" fill="#e23b2e" opacity=".6"/><rect x="18" y="34" width="10" height="2" fill="#9b5de5"/><path d="M8 24h32" stroke="#000" stroke-width=".8" opacity=".5"/>`,
  '',
  '#ffe8e8',
);

{
  const d = L('tb', S([0, '#8fd0ff'], [0.5, '#3a8ee6'], [1, '#1b5fc0'])) + L('wb', S([0, '#ffffff'], [1, '#e4ecf6']));
  const win = (extra = '') =>
    `<defs>${d}</defs>${shadow(24, 43.5, 18, 2.2)}<rect x="4" y="7" width="40" height="33" rx="3" fill="url(#wb)" stroke="#3a6aa8" stroke-width=".9"/><path d="M4 10a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v5H4z" fill="url(#tb)"/><rect x="35" y="9" width="6" height="4" rx="1" fill="#e5533d" stroke="#fff" stroke-width=".5"/><path d="M5 8h38v3H5z" fill="#fff" opacity=".35"/>${extra}`;
  I.exe = win(`<rect x="8" y="19" width="14" height="2" rx="1" fill="#9fb3cc"/><rect x="8" y="24" width="22" height="2" rx="1" fill="#9fb3cc"/><rect x="8" y="29" width="18" height="2" rx="1" fill="#9fb3cc"/>`);
  I.lnk = I.exe;
  I.run = win(`<path d="M12 30h14v-5l9 8-9 8v-5H12z" fill="#3bbf3b" stroke="#1d7a1d" stroke-width=".8" stroke-linejoin="round" transform="translate(0 -8)"/>`);
}

I.terminal =
  `<defs>${L('tb', S([0, '#4b5d72'], [1, '#0d141c']))}${L('ts', S([0, '#0f3322'], [1, '#020a05']))}</defs>` +
  shadow(24, 44, 18, 2.2) +
  `<rect x="4" y="6" width="40" height="34" rx="4" fill="url(#tb)" stroke="#05080c" stroke-width=".8"/>` +
  `<rect x="7" y="9" width="34" height="27" rx="2" fill="url(#ts)"/>` +
  `<path d="M12 16l7 5-7 5" fill="none" stroke="#45ff8a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<rect x="21" y="25" width="10" height="2.6" rx="1" fill="#45ff8a"/>` +
  `<path d="M7 9h34v10C28 15 18 18 7 21z" fill="#fff" opacity=".16"/>`;

{
  const o = orb('o', '#bff0ff', '#2593e8', '#0a3a8a');
  I.browser =
    `<defs>${o.defs}${L('cn', S([0, '#b8f08a'], [1, '#2f9e2c']))}${L('rg', S([0, '#fff6b0'], [0.5, '#ffb52e'], [1, '#e07000']), 0, 0, 1, 0)}</defs>` +
    o.body +
    `<path d="M12 15c4-1 7 1 6 4s-5 2-5 6 4 4 3 8c-3-1-7-6-7-11 0-3 1-5 3-7zM27 9c4 0 9 3 11 7-3 0-5-2-7 0s2 5-1 7-4-1-6-1c-2-4 3-6 0-8-1-2 0-4 3-5zM30 31c2-2 6-2 7 0-1 3-4 5-6 5-2-1-2-3-1-5z" fill="url(#cn)" opacity=".95"/>` +
    o.gloss +
    `<ellipse cx="24" cy="24" rx="23" ry="8" fill="none" stroke="url(#rg)" stroke-width="2.6" transform="rotate(-22 24 24)"/>` +
    `<polygon points="${starPts(42.5, 16, 4.6, 1.9)}" fill="#fff8c8" stroke="#e08a00" stroke-width=".6"/>`;
}

I.control =
  `<defs>${L('cp', S([0, '#f6fbff'], [1, '#a7c6ea']))}${R('k1', S([0, '#ffd0c8'], [0.6, '#e8402c'], [1, '#8f1d10']), 0.4, 0.3, 0.7)}${R('k2', S([0, '#d8ffc8'], [0.6, '#3cb83a'], [1, '#1a6a18']), 0.4, 0.3, 0.7)}${R('k3', S([0, '#d0ecff'], [0.6, '#2f7fe8'], [1, '#0c3a9a']), 0.4, 0.3, 0.7)}</defs>` +
  shadow(24, 44, 17, 2.3) +
  `<rect x="5" y="5" width="38" height="37" rx="8" fill="url(#cp)" stroke="#6a8fbe" stroke-width=".9"/>` +
  [15, 24, 33].map((x) => `<rect x="${x - 1.2}" y="11" width="2.4" height="25" rx="1.2" fill="#6b84a5"/>`).join('') +
  `<circle cx="15" cy="19" r="4.4" fill="url(#k1)"/><circle cx="24" cy="29" r="4.4" fill="url(#k2)"/><circle cx="33" cy="15" r="4.4" fill="url(#k3)"/>` +
  `<path d="M5 13a8 8 0 0 1 8-8h22a8 8 0 0 1 8 8v4C30 13 18 14 5 19z" fill="#fff" opacity=".45"/>`;

I.notepad =
  `<defs>${L('pg', S([0, '#ffffff'], [1, '#e8eef6']))}${L('bd', S([0, '#7cc4ff'], [1, '#1c64c8']))}${L('pc', S([0, '#ffe680'], [1, '#e8a400']), 0, 0, 1, 0)}</defs>` +
  shadow(24, 44.5, 14, 2.2) +
  `<rect x="9" y="7" width="28" height="37" rx="2" fill="url(#pg)" stroke="#8d9db2" stroke-width=".9"/>` +
  `<rect x="9" y="7" width="28" height="7" rx="2" fill="url(#bd)"/>` +
  [13, 18, 23, 28, 33].map((x) => `<rect x="${x - 1}" y="3.5" width="2" height="6.5" rx="1" fill="#c7ced8" stroke="#69778a" stroke-width=".5"/>`).join('') +
  lines(19, 5, 13, 32, 4.6) +
  `<g transform="rotate(40 34 30)"><rect x="31" y="12" width="6" height="24" rx="1" fill="url(#pc)" stroke="#a66b00" stroke-width=".6"/><path d="M31 36h6l-3 6z" fill="#f2d2a8" stroke="#a66b00" stroke-width=".6"/><path d="M33.2 40.5h1.6l-.8 1.5z" fill="#333"/><rect x="31" y="9" width="6" height="4" rx="1" fill="#ff8fa3"/></g>`;

{
  const blob = (cx: number, cy: number, r: number, c1: string, c2: string, id: string) => ({ d: R(id, S([0, c1], [1, c2]), 0.35, 0.3, 0.7), b: `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/><ellipse cx="${cx - r * 0.25}" cy="${cy - r * 0.35}" rx="${r * 0.45}" ry="${r * 0.28}" fill="#fff" opacity=".7"/>` });
  const bs = [blob(14, 17, 4.2, '#ffb3a8', '#e02a16', 'b1'), blob(24, 12, 4.2, '#fff4a8', '#f2b800', 'b2'), blob(34, 16, 4.2, '#c8ffb0', '#2aa02a', 'b3'), blob(12, 28, 4.2, '#bfe4ff', '#1e6ae0', 'b4'), blob(23, 34, 3.6, '#ecc8ff', '#8a2fd0', 'b5')];
  const pal =
    `<path d="M24 5c11.5 0 21 7 21 16.5 0 5.5-4 7.5-8.5 6.4-3.4-.8-5.5 1.2-4.4 4.6 1.4 4.4-2 8.5-8.6 8.5C12.5 41 3 33.5 3 23S12.5 5 24 5z" fill="url(#pl)" stroke="#b08a55" stroke-width=".9"/><ellipse cx="33.5" cy="31" rx="3.2" ry="2.6" fill="#fff" stroke="#b08a55" stroke-width=".7"/>`;
  const defs = L('pl', S([0, '#fffaf0'], [1, '#e3c99b'])) + bs.map((b) => b.d).join('') + L('br', S([0, '#c08a50'], [1, '#6b3d12']), 0, 0, 1, 0);
  I.palette = `<defs>${defs}</defs>${shadow(24, 44, 18, 2.3)}${pal}${bs.map((b) => b.b).join('')}<path d="M6 16C9 9 16 6 24 6c-8 3-13 7-17 13z" fill="#fff" opacity=".6"/>`;
  I.paint = I.palette.replace('</svg>', '') + `<g transform="rotate(-40 38 34)"><rect x="36" y="22" width="4" height="22" rx="2" fill="url(#br)"/><rect x="35.5" y="19" width="5" height="4" fill="#c8ccd2"/><path d="M35.5 19c0-4 1.5-7 2.5-8 1 1 2.5 4 2.5 8z" fill="#e02a16"/></g>`;
}

{
  const bin = (full: boolean) =>
    `<defs>${L('bn', S([0, '#f2fdff', 0.95], [0.5, '#bfeaf5', 0.9], [1, '#7cc6dc', 0.95]), 0, 0, 1, 0)}${L('ld', S([0, '#ffffff'], [1, '#a9d8e8']))}${L('ar', S([0, '#8fe873'], [1, '#1f9a2a']))}</defs>` +
    shadow(24, 45, 13, 2.2) +
    (full
      ? `<path d="M14 11c-2-4 3-7 6-5 2-3 7-2 7 1 3-2 8 0 7 4z" fill="#fff" stroke="#9aa8ba" stroke-width=".7"/><path d="M27 4l7 1-2 6-6-1z" fill="#ffe9a0" stroke="#c9a040" stroke-width=".6"/><path d="M16 5l6 2-3 5-5-2z" fill="#dff1ff" stroke="#8d9db2" stroke-width=".6"/>`
      : '') +
    `<path d="M11 13h26l-3 29.5a2 2 0 0 1-2 1.8H16a2 2 0 0 1-2-1.8z" fill="url(#bn)" stroke="#4f9bb5" stroke-width=".9"/>` +
    [18, 24, 30].map((x) => `<path d="M${x} 16l${x === 24 ? 0 : x < 24 ? 0.6 : -0.6} 25" stroke="#fff" stroke-width="1.4" opacity=".7"/>`).join('') +
    `<rect x="9" y="${full ? 10 : 9}" width="30" height="5" rx="2.2" fill="url(#ld)" stroke="#4f9bb5" stroke-width=".9" transform="${full ? 'rotate(-6 24 12)' : ''}"/>` +
    `<path d="M18.5 31a6 6 0 0 1 8.7-6.4" fill="none" stroke="url(#ar)" stroke-width="2.6" stroke-linecap="round"/><path d="M26 21.5l3.6 3.4-4.8 1.3z" fill="#2aa83a"/>` +
    `<path d="M29.5 26a6 6 0 0 1-6.6 8.2" fill="none" stroke="url(#ar)" stroke-width="2.6" stroke-linecap="round"/><path d="M24.6 37.4l-3.8-3 4.6-1.6z" fill="#2aa83a"/>` +
    `<path d="M12 14h24l-.4 5C28 16 19 17 12.4 20z" fill="#fff" opacity=".5"/>`;
  I.recycle = bin(false);
  I.recyclefull = bin(true);
}

I.support =
  `<defs>${R('lr', S([0, '#fff'], [1, '#e3e9f0']), 0.4, 0.3, 0.7)}</defs>` +
  shadow(24, 44, 16, 2.4) +
  `<circle cx="24" cy="23" r="15" fill="none" stroke="#e8e8ea" stroke-width="9"/>` +
  `<circle cx="24" cy="23" r="15" fill="none" stroke="#e5352a" stroke-width="9" stroke-dasharray="11.78 11.78" transform="rotate(-22 24 23)"/>` +
  `<circle cx="24" cy="23" r="19.5" fill="none" stroke="#8f1d16" stroke-opacity=".5"/><circle cx="24" cy="23" r="10.5" fill="none" stroke="#8f1d16" stroke-opacity=".5"/>` +
  `<path d="M24 23m-19 0a19 19 0 0 1 38 0" fill="none" stroke="#fff" stroke-width="1" stroke-opacity=".0"/>` +
  `<ellipse cx="24" cy="12" rx="14" ry="7" fill="url(#gl)" opacity=".8"/>`;

I.calc =
  `<defs>${L('cb', S([0, '#6b7a8c'], [1, '#1f2731']))}${L('cs', S([0, '#e6fff0'], [1, '#9ed9b6']))}${L('k', S([0, '#ffffff'], [1, '#c5ced9']))}${L('ko', S([0, '#ffd59a'], [1, '#f28a1a']))}</defs>` +
  shadow(24, 45, 13, 2.2) +
  `<rect x="10" y="3.5" width="28" height="40" rx="4" fill="url(#cb)" stroke="#0e141a" stroke-width=".8"/>` +
  `<rect x="13" y="7" width="22" height="9" rx="1.5" fill="url(#cs)"/><rect x="24" y="9.5" width="9" height="4" rx=".6" fill="#2a4a3a" opacity=".7"/>` +
  Array.from({ length: 12 }, (_, i) => `<rect x="${13 + (i % 3) * 7.6}" y="${19 + Math.floor(i / 3) * 6}" width="6" height="4.6" rx="1.2" fill="url(#${i % 3 === 2 ? 'ko' : 'k'})"/>`).join('') +
  `<path d="M10 7a4 4 0 0 1 4-3.5h20A4 4 0 0 1 38 7v6C29 9 19 11 10 15z" fill="#fff" opacity=".18"/>`;

{
  const o = orb('o', '#ffe7b0', '#ff9a1f', '#b04a00');
  I.media = `<defs>${o.defs}</defs>${o.body}<path d="M19 13.5l14 9.5-14 9.5z" fill="#fff" stroke="#c25a00" stroke-width=".6" stroke-linejoin="round"/>${o.gloss}`;
}
{
  const o = orb('o', '#7a1818', '#2a0505', '#000');
  I.kip = `<defs>${o.defs}${R('ey', S([0, '#fff2f2'], [0.3, '#ff3b3b'], [1, '#600', 0]), 0.5, 0.5, 0.5)}</defs>${o.body}<ellipse cx="24" cy="23" rx="11" ry="7" fill="url(#ey)"/><circle cx="24" cy="23" r="3.2" fill="#100"/><circle cx="25.2" cy="21.8" r="1" fill="#fff"/>${o.gloss.replace('url(#gl)', 'url(#gls)')}`;
}

I.drive =
  `<defs>${L('dv', S([0, '#fbfcfd'], [0.5, '#d5dbe2'], [1, '#9aa5b2']))}${L('dt', S([0, '#ffffff'], [1, '#e0e5ea']))}${R('led', S([0, '#d8ffd8'], [0.5, '#2ee35a'], [1, '#2ee35a', 0]))}</defs>` +
  shadow(24, 39, 20, 2.4) +
  `<path d="M8 12h32l5 8H3z" fill="url(#dt)" stroke="#8792a0" stroke-width=".8" stroke-linejoin="round"/>` +
  `<rect x="3" y="20" width="42" height="15" rx="2.5" fill="url(#dv)" stroke="#7a8592" stroke-width=".8"/>` +
  `<rect x="7" y="26" width="22" height="2" rx="1" fill="#7a8592" opacity=".6"/><circle cx="38" cy="27.5" r="4" fill="url(#led)"/><circle cx="38" cy="27.5" r="1.4" fill="#e8ffe8"/>` +
  `<path d="M4 21h40v4C30 23 16 23 4 26z" fill="#fff" opacity=".6"/>`;

{
  const fl =
    `<defs>${L('fl', S([0, '#6aa8ff'], [1, '#1546a0']))}${L('sh2', S([0, '#f4f6f8'], [1, '#9aa5b0']), 0, 0, 1, 0)}</defs>` +
    shadow(24, 45, 16, 2.2) +
    `<path d="M7 5h31l4 4v32a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1z" fill="url(#fl)" stroke="#0e3270" stroke-width=".9"/>` +
    `<rect x="14" y="5" width="19" height="12" rx="1" fill="url(#sh2)" stroke="#6c7783" stroke-width=".6"/><rect x="26" y="7" width="4" height="8" rx=".5" fill="#2a3644"/>` +
    `<rect x="11" y="23" width="26" height="18" rx="1.5" fill="#fff"/>${lines(27, 3, 14, 34, 4)}` +
    `<path d="M7 6h31l3 3v4C28 9 17 12 7 15z" fill="#fff" opacity=".3"/>`;
  I.floppy = fl;
  I.save = fl;
}

I.cdrom =
  `<defs>${R('cd', S([0, '#ffffff'], [0.5, '#dfe5ec'], [1, '#a9b3bf']))}${L('rb', S([0, '#ff5ea8', 0.35], [0.25, '#ffd23a', 0.35], [0.5, '#4cf07a', 0.35], [0.75, '#3ac8ff', 0.35], [1, '#a05cff', 0.35]), 0, 0, 1, 1)}</defs>` +
  shadow(24, 45, 15, 2) +
  `<circle cx="24" cy="23" r="20" fill="url(#cd)" stroke="#8a95a3" stroke-width=".8"/><circle cx="24" cy="23" r="20" fill="url(#rb)"/>` +
  `<circle cx="24" cy="23" r="8" fill="#eef2f6" stroke="#9aa5b2" stroke-width=".8"/><circle cx="24" cy="23" r="3.5" fill="#fff" stroke="#8a95a3" stroke-width=".8"/>` +
  `<path d="M10 12a20 20 0 0 1 14-9v12a8 8 0 0 0-6 3z" fill="#fff" opacity=".55"/>`;

{
  const o = orb('o', '#d2f0ff', '#2f8ae6', '#0b3a8a');
  I.info = `<defs>${o.defs}</defs>${o.body}<circle cx="24" cy="13.5" r="3" fill="#fff"/><rect x="21.4" y="19" width="5.2" height="15" rx="2" fill="#fff"/>${o.gloss}`;
  I.question = `<defs>${o.defs}</defs>${o.body}<text x="24" y="33" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="25" fill="#fff">?</text>${o.gloss}`;
}
{
  const o = orb('o', '#ffd0c8', '#e8402c', '#7a120a');
  I.error = `<defs>${o.defs}</defs>${o.body}<path d="M17 16l14 14M31 16L17 30" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/>${o.gloss}`;
  I.power = `<defs>${o.defs}</defs>${o.body}<path d="M18.2 16.5a9 9 0 1 0 11.6 0" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M24 12.5v10" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>${o.gloss}`;
}
{
  const o = orb('o', '#fff3c0', '#ffb21e', '#b06a00');
  I.logoff = `<defs>${o.defs}</defs>${o.body}<path d="M22 14h-6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M21 23h13m-4-5l5 5-5 5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${o.gloss}`;
}
I.warning =
  `<defs>${L('wy', S([0, '#fff6b8'], [0.5, '#ffd21e'], [1, '#f09400']))}</defs>` +
  shadow(24, 44, 18, 2.2) +
  `<path d="M24 4.5c1.2 0 2.2.6 2.8 1.6l17 30.5c1.2 2.2-.4 4.9-2.9 4.9H7.1c-2.5 0-4.1-2.7-2.9-4.9l17-30.5c.6-1 1.6-1.6 2.8-1.6z" fill="url(#wy)" stroke="#b47300" stroke-width=".9"/>` +
  `<rect x="21.6" y="14" width="4.8" height="15" rx="2.2" fill="#3a2a00"/><circle cx="24" cy="34.5" r="2.8" fill="#3a2a00"/>` +
  `<path d="M21.5 7L8 31c9-6 20-8 32-6L26.5 7c-1-1.8-4-1.8-5 0z" fill="#fff" opacity=".4"/>`;

I.user =
  `<defs>${L('uf', S([0, '#e8f6ff'], [1, '#8fc6ec']))}${L('up', S([0, '#7cc4ff'], [1, '#1859b8']))}${R('uh', S([0, '#cfeaff'], [1, '#2a78d4']), 0.4, 0.3, 0.7)}</defs>` +
  shadow(24, 45, 16, 2.2) +
  `<rect x="4" y="4" width="40" height="40" rx="8" fill="url(#uf)" stroke="#5a8fc4" stroke-width=".9"/>` +
  `<circle cx="24" cy="18" r="7.5" fill="url(#uh)"/><path d="M10 40c0-8 6-13 14-13s14 5 14 13z" fill="url(#up)"/>` +
  `<path d="M4 12a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v3C31 11 17 12 4 18z" fill="#fff" opacity=".5"/>`;

I.help =
  `<defs>${L('hb', S([0, '#7cc4ff'], [1, '#1546a0']), 0, 0, 1, 0)}${L('hp', S([0, '#ffffff'], [1, '#dfe6ee']))}</defs>` +
  shadow(24, 45, 15, 2.2) +
  `<path d="M10 6h26a2 2 0 0 1 2 2v34H12a3 3 0 0 1-3-3V7a1 1 0 0 1 1-1z" fill="url(#hb)" stroke="#0e3270" stroke-width=".9"/>` +
  `<path d="M12 36h26v6H12a3 3 0 0 1 0-6z" fill="url(#hp)" stroke="#0e3270" stroke-width=".7"/>` +
  `<text x="24.5" y="29" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="20" fill="#fff">?</text>` +
  `<path d="M10 7h27v8C27 11 18 13 10 16z" fill="#fff" opacity=".3"/>`;

I.archive =
  `<defs>${L('ab', S([0, '#f7dca5'], [1, '#c48a3a']))}${L('al', S([0, '#fff0cf'], [1, '#d9a050']))}${L('ag', S([0, '#fff6b0'], [1, '#d08a00']))}</defs>` +
  shadow(24, 44.5, 19, 2.3) +
  `<rect x="6" y="18" width="36" height="24" rx="2" fill="url(#ab)" stroke="#8e5d1e" stroke-width=".9"/>` +
  `<rect x="4" y="10" width="40" height="10" rx="2" fill="url(#al)" stroke="#8e5d1e" stroke-width=".9"/>` +
  `<rect x="20" y="17" width="8" height="8" rx="1.5" fill="url(#ag)" stroke="#8a5a00" stroke-width=".7"/>` +
  `<path d="M5 11h38v4C30 13 18 13 5 17z" fill="#fff" opacity=".5"/>`;

I.lock =
  `<defs>${L('lb', S([0, '#fff1a8'], [0.5, '#f8c51c'], [1, '#c48400']))}${L('ls', S([0, '#f4f6f8'], [1, '#8a96a3']), 0, 0, 1, 0)}</defs>` +
  shadow(24, 45, 14, 2.2) +
  `<path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="url(#ls)" stroke-width="4.4"/>` +
  `<rect x="10" y="20" width="28" height="22" rx="4" fill="url(#lb)" stroke="#9a6800" stroke-width=".9"/>` +
  `<circle cx="24" cy="29" r="3" fill="#4a3200"/><rect x="22.8" y="30" width="2.4" height="6" rx="1" fill="#4a3200"/>` +
  `<path d="M11 24a4 4 0 0 1 4-3h18a4 4 0 0 1 4 3v3C28 24 19 25 11 29z" fill="#fff" opacity=".45"/>`;

I.search =
  `<defs>${R('lz', S([0, '#ffffff', 0.95], [0.7, '#bfe6ff', 0.7], [1, '#6fb5e8', 0.8]), 0.4, 0.35, 0.65)}${L('hd', S([0, '#5a6a7c'], [1, '#1c242e']))}</defs>` +
  shadow(26, 44, 16, 2.2) +
  `<path d="M29 29l11 11" stroke="url(#hd)" stroke-width="7" stroke-linecap="round"/>` +
  `<circle cx="20" cy="19" r="13" fill="url(#lz)" stroke="#8a96a5" stroke-width="3.4"/>` +
  `<ellipse cx="16.5" cy="14" rx="7" ry="4.2" fill="#fff" opacity=".75" transform="rotate(-25 16.5 14)"/>`;

{
  const spk = (extra: string) =>
    `<defs>${L('sp', S([0, '#f4f6f8'], [1, '#7f8b98']))}${L('wv', S([0, '#9fe0ff'], [1, '#1c78d8']))}</defs>` +
    shadow(22, 44, 15, 2) +
    `<path d="M6 17h7l10-9v32l-10-9H6a2 2 0 0 1-2-2V19a2 2 0 0 1 2-2z" fill="url(#sp)" stroke="#5a6674" stroke-width=".9" stroke-linejoin="round"/>` +
    `<path d="M5 18h8l9-8v6C15 17 10 20 5 24z" fill="#fff" opacity=".55"/>` +
    extra;
  I.sound = spk(`<path d="M28 17a9 9 0 0 1 0 14M32 12a15 15 0 0 1 0 24" fill="none" stroke="url(#wv)" stroke-width="3.2" stroke-linecap="round"/>`);
  I.mute = spk(`<path d="M29 18l12 12M41 18L29 30" stroke="#e5352a" stroke-width="3.6" stroke-linecap="round"/>`);
}

I.bell =
  `<defs>${L('bl', S([0, '#fff3b0'], [0.5, '#ffc21e'], [1, '#c27c00']), 0, 0, 1, 0)}</defs>` +
  shadow(24, 44.5, 13, 2) +
  `<circle cx="24" cy="39" r="4" fill="#9a6200"/>` +
  `<path d="M24 5c1.6 0 3 1.2 3 2.8C33 9.5 36 15 36 21v8l4 5H8l4-5v-8c0-6 3-11.5 9-13.2C21 6.2 22.4 5 24 5z" fill="url(#bl)" stroke="#9a6200" stroke-width=".9" stroke-linejoin="round"/>` +
  `<path d="M16 15c1-3 3-5 6-6-2 4-3 8-3 14l-3 2z" fill="#fff" opacity=".6"/>`;

I.network =
  `<defs>${L('nb', S([0, '#7286a0'], [1, '#202b38']))}${L('ns', S([0, '#3aa4ff'], [1, '#bfeaff']))}</defs>` +
  shadow(24, 45, 18, 2) +
  `<path d="M14 24v8h20v-8" fill="none" stroke="#3a4a5c" stroke-width="2"/><circle cx="24" cy="32" r="2.4" fill="#2ee35a" stroke="#1a7a2a" stroke-width=".6"/>` +
  `<rect x="2" y="6" width="22" height="16" rx="2" fill="url(#nb)"/><rect x="4" y="8" width="18" height="12" rx="1" fill="url(#ns)"/>` +
  `<rect x="24" y="26" width="22" height="16" rx="2" fill="url(#nb)"/><rect x="26" y="28" width="18" height="12" rx="1" fill="url(#ns)"/>` +
  `<path d="M4 8h18v5C15 11 9 13 4 15z M26 28h18v5C37 31 31 33 26 35z" fill="#fff" opacity=".35"/>`;

I.clock =
  `<defs>${R('cf', S([0, '#ffffff'], [1, '#dbe6f3']), 0.45, 0.35, 0.7)}${L('cr', S([0, '#9fd8ff'], [1, '#1c5fc0']))}</defs>` +
  shadow(24, 45, 15, 2.2) +
  `<circle cx="24" cy="23" r="19.5" fill="url(#cr)"/><circle cx="24" cy="23" r="16" fill="url(#cf)"/>` +
  Array.from({ length: 12 }, (_, i) => { const a = (i * 30 * Math.PI) / 180; return `<circle cx="${(24 + Math.sin(a) * 13).toFixed(2)}" cy="${(23 - Math.cos(a) * 13).toFixed(2)}" r="${i % 3 ? 0.9 : 1.5}" fill="#2a4a7a"/>`; }).join('') +
  `<path d="M24 23V13" stroke="#1a2a40" stroke-width="2.4" stroke-linecap="round"/><path d="M24 23l7 4" stroke="#1a2a40" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="23" r="1.8" fill="#e5352a"/>` +
  `<ellipse cx="24" cy="13" rx="13" ry="7" fill="url(#gl)" opacity=".7"/>`;

I.mouse =
  `<defs>${L('ms', S([0, '#ffffff'], [1, '#c3ccd8']), 0, 0, 1, 1)}${L('mw', S([0, '#9fd8ff'], [1, '#1c5fc0']))}</defs>` +
  shadow(26, 45, 12, 2) +
  `<path d="M24 3c0 3 3 3 3 6" fill="none" stroke="#5a6674" stroke-width="1.4"/>` +
  `<rect x="14" y="9" width="22" height="34" rx="11" fill="url(#ms)" stroke="#7a8696" stroke-width=".9"/>` +
  `<path d="M25 9v12M14 21h22" stroke="#9aa5b2" stroke-width=".8"/><rect x="23" y="13" width="4" height="7" rx="2" fill="url(#mw)"/>` +
  `<path d="M15 19c0-5 4-9 9-9.5v10C20 19 17 19.5 15 21z" fill="#fff" opacity=".7"/>`;

{
  const st = goldStar(24, 22, 8, 3.4);
  I.shield =
    `<defs>${L('sd', S([0, '#7cc4ff'], [0.5, '#2a7ae0'], [1, '#0c3a9a']))}${st.defs}</defs>` +
    shadow(24, 45, 14, 2.2) +
    `<path d="M24 3l17 6v12c0 11-7 18.5-17 23C14 39.5 7 32 7 21V9z" fill="url(#sd)" stroke="#0a2a70" stroke-width=".9"/>` +
    st.body +
    `<path d="M24 4.5l15.5 5.5v6C30 12 18 14 8.5 20V10z" fill="#fff" opacity=".35"/>`;
}

{
  const st = goldStar(24, 23, 11, 4.6);
  I.minesweeper =
    `<defs>${L('mt', S([0, '#3a4a6a'], [1, '#0a1020']))}${st.defs}</defs>` +
    shadow(24, 45, 17, 2) +
    `<rect x="5" y="4" width="38" height="38" rx="7" fill="url(#mt)" stroke="#000" stroke-width=".8"/>` +
    `<circle cx="24" cy="23" r="15" fill="none" stroke="#3ac8ff" stroke-opacity=".35"/><circle cx="24" cy="23" r="9" fill="none" stroke="#3ac8ff" stroke-opacity=".5"/>` +
    st.body +
    `<path d="M5 11a7 7 0 0 1 7-7h24a7 7 0 0 1 7 7v3C30 10 17 11 5 17z" fill="#fff" opacity=".22"/>`;
}

I.eye =
  `<defs>${R('ir', S([0, '#bff0ff'], [0.6, '#2a8ae6'], [1, '#0a2a6a']))}</defs>` +
  `<path d="M3 24C9 14 16 10 24 10s15 4 21 14c-6 10-13 14-21 14S9 34 3 24z" fill="#fff" stroke="#5a6674" stroke-width="1"/>` +
  `<circle cx="24" cy="24" r="9" fill="url(#ir)"/><circle cx="24" cy="24" r="4" fill="#000"/><circle cx="21" cy="21" r="2" fill="#fff"/>`;

// ---------- avatars ----------
I.duck =
  `<defs>${R('dk', S([0, '#fff6b0'], [0.6, '#ffd21e'], [1, '#e09000']), 0.4, 0.3, 0.7)}</defs>` +
  shadow(24, 45, 17, 2) +
  `<ellipse cx="26" cy="33" rx="17" ry="10" fill="url(#dk)" stroke="#b47300" stroke-width=".8"/>` +
  `<circle cx="18" cy="17" r="10" fill="url(#dk)" stroke="#b47300" stroke-width=".8"/>` +
  `<path d="M7 18c-4 0-5 3-4 4s5 1 7-1z" fill="#ff8a1e" stroke="#b44a00" stroke-width=".6"/>` +
  `<circle cx="15" cy="14.5" r="1.9" fill="#1a1a1a"/><circle cx="15.6" cy="13.9" r=".6" fill="#fff"/>` +
  `<ellipse cx="17" cy="11" rx="6" ry="3" fill="#fff" opacity=".6"/><ellipse cx="28" cy="27" rx="9" ry="3" fill="#fff" opacity=".45"/>`;

I.robot =
  `<defs>${L('rb', S([0, '#ffffff'], [1, '#9aa7b6']))}${R('re', S([0, '#e0ffff'], [0.5, '#3ae0ff'], [1, '#0a6aa0']))}${R('ra', S([0, '#ffd0c8'], [1, '#d0201a']), 0.4, 0.3, 0.7)}</defs>` +
  shadow(24, 45, 15, 2) +
  `<path d="M24 10V5" stroke="#5a6674" stroke-width="1.6"/><circle cx="24" cy="4.5" r="2.6" fill="url(#ra)"/>` +
  `<rect x="8" y="10" width="32" height="28" rx="8" fill="url(#rb)" stroke="#5a6674" stroke-width=".9"/>` +
  `<circle cx="17" cy="22" r="4.4" fill="url(#re)"/><circle cx="31" cy="22" r="4.4" fill="url(#re)"/>` +
  `<rect x="15" y="30" width="18" height="3.4" rx="1.7" fill="#3a4654"/>` +
  `<path d="M8 18a8 8 0 0 1 8-8h16a8 8 0 0 1 8 8v1C30 15 18 16 8 21z" fill="#fff" opacity=".7"/>`;

I.flower =
  `<defs>${R('pt', S([0, '#ffe0ec'], [1, '#f05a9a']), 0.4, 0.3, 0.7)}${R('fc', S([0, '#fff6b0'], [1, '#f0a000']), 0.4, 0.3, 0.7)}${L('lf', S([0, '#b8f08a'], [1, '#2f9e2c']))}</defs>` +
  shadow(24, 45, 12, 2) +
  `<path d="M24 26v18" stroke="#2f9e2c" stroke-width="2.4"/><path d="M24 38c-6-1-10-5-10-9 5 0 9 4 10 9z" fill="url(#lf)"/><path d="M24 35c5-1 9-5 9-8-5 0-8 3-9 8z" fill="url(#lf)"/>` +
  Array.from({ length: 5 }, (_, i) => { const a = ((i * 72 - 90) * Math.PI) / 180; return `<circle cx="${(24 + Math.cos(a) * 8).toFixed(2)}" cy="${(17 + Math.sin(a) * 8).toFixed(2)}" r="6.4" fill="url(#pt)"/>`; }).join('') +
  `<circle cx="24" cy="17" r="5" fill="url(#fc)"/><ellipse cx="22.5" cy="15.5" rx="2" ry="1.2" fill="#fff" opacity=".7"/>`;

I.guitar =
  `<defs>${R('gt', S([0, '#ffd59a'], [0.6, '#f07a1a'], [1, '#9a3a00']), 0.4, 0.3, 0.7)}${L('nk', S([0, '#a0703a'], [1, '#5a3410']), 0, 0, 1, 0)}</defs>` +
  shadow(20, 45, 14, 2) +
  `<g transform="rotate(35 24 24)"><rect x="22" y="1" width="4.4" height="24" rx="1" fill="url(#nk)"/><rect x="21" y="0" width="6.4" height="5" rx="1.2" fill="#3a2410"/>` +
  `<circle cx="24.2" cy="27" r="8" fill="url(#gt)" stroke="#6a2a00" stroke-width=".7"/><circle cx="24.2" cy="37" r="10" fill="url(#gt)" stroke="#6a2a00" stroke-width=".7"/>` +
  `<circle cx="24.2" cy="31" r="3" fill="#2a1408"/><rect x="21" y="38" width="6.4" height="2" rx="1" fill="#2a1408"/><ellipse cx="21" cy="30" rx="3" ry="5" fill="#fff" opacity=".35"/></g>`;

I.fish =
  `<defs>${L('fs', S([0, '#fff0a0'], [0.5, '#ffa21e'], [1, '#e0500a']))}${R('bb', S([0, '#ffffff', 0.9], [0.7, '#bfeaff', 0.3], [1, '#5ab8f0', 0.6]), 0.35, 0.3, 0.7)}</defs>` +
  `<path d="M6 25c6-10 22-12 30-2-8 10-24 9-30 2z" fill="url(#fs)" stroke="#b04a00" stroke-width=".8"/>` +
  `<path d="M34 23l9-7v16z" fill="url(#fs)" stroke="#b04a00" stroke-width=".8" stroke-linejoin="round"/>` +
  `<path d="M18 17c3-4 8-4 10-2z" fill="#ff8a1e"/><circle cx="13" cy="23" r="2" fill="#1a1a1a"/><circle cx="13.6" cy="22.4" r=".6" fill="#fff"/>` +
  `<path d="M10 22c4-5 14-7 20-3-6-1-14 0-20 4z" fill="#fff" opacity=".55"/>` +
  `<circle cx="8" cy="10" r="4" fill="url(#bb)"/><circle cx="15" cy="5" r="2.4" fill="url(#bb)"/><circle cx="38" cy="40" r="3" fill="url(#bb)"/>`;

// ---------- koalOS suite ----------
const glossTop = (x: number, y: number, w: number, r: number, h = 10) => `<path d="M${x} ${y + r}a${r} ${r} 0 0 1 ${r}-${r}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h * 0.5}C${x + w * 0.7} ${y + h * 0.7} ${x + w * 0.3} ${y + h * 0.8} ${x} ${y + h * 1.3}z" fill="#fff" opacity=".45"/>`;

I.video =
  `<defs>${L('vb', S([0, '#4a5a72'], [1, '#121a26']))}${L('vp', S([0, '#fff3a8'], [1, '#f2a400']))}</defs>` +
  shadow(24, 44, 18, 2.2) +
  `<rect x="4" y="8" width="40" height="32" rx="4" fill="url(#vb)" stroke="#05080c" stroke-width=".8"/>` +
  [11, 18, 25, 32].map((y) => `<rect x="6.5" y="${y}" width="3.5" height="3.5" rx=".8" fill="#9db4e3"/><rect x="38" y="${y}" width="3.5" height="3.5" rx=".8" fill="#9db4e3"/>`).join('') +
  `<path d="M19 15.5l12 8.5-12 8.5z" fill="url(#vp)" stroke="#9a6200" stroke-width=".8" stroke-linejoin="round"/>` +
  glossTop(4, 8, 40, 4, 12);

I.block =
  `<defs>${L('bt', S([0, '#a8f07a'], [1, '#4aa82a']))}${L('bl', S([0, '#b07a44'], [1, '#6b4422']))}${L('br2', S([0, '#8a5a2e'], [1, '#4a2c12']))}</defs>` +
  shadow(24, 45, 17, 2.2) +
  `<path d="M24 4l18 10v20L24 44 6 34V14z" fill="url(#bl)" stroke="#3a2410" stroke-width=".9" stroke-linejoin="round"/>` +
  `<path d="M24 4l18 10-18 10L6 14z" fill="url(#bt)" stroke="#2a6a18" stroke-width=".9" stroke-linejoin="round"/>` +
  `<path d="M24 24v20l18-10V14z" fill="url(#br2)" opacity=".9"/>` +
  `<path d="M6 14l18 10v4L6 18z" fill="#5fbf3a"/><path d="M24 24l18-10v4L24 28z" fill="#4a9f2c"/>` +
  `<path d="M10 13l14-7 12 6.5C26 10 17 11 10 13z" fill="#fff" opacity=".55"/>`;

I.python =
  `<defs>${L('pb', S([0, '#5aa0e6'], [1, '#1f4f8a']))}${L('py', S([0, '#fff2a0'], [1, '#f2c200']))}</defs>` +
  shadow(24, 44, 18, 2.2) +
  `<rect x="4" y="6" width="40" height="34" rx="5" fill="#16243a" stroke="#05080c" stroke-width=".8"/>` +
  `<path d="M4 11a5 5 0 0 1 5-5h30a5 5 0 0 1 5 5v2H4z" fill="url(#pb)"/>` +
  `<path d="M10 20l6 4.5-6 4.5M18 20l6 4.5-6 4.5" fill="none" stroke="url(#py)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<rect x="27" y="28" width="9" height="2.8" rx="1.4" fill="#ffd43b"/>` +
  glossTop(4, 6, 40, 5, 12);

{
  // Buddi: a chubby glossy star with a face.
  const sp = roundStar(24, 25.5, 22.5, 12.5);
  I.buddi =
    `<defs>${R('bdf', S([0, '#fffbe0'], [0.35, '#ffe066'], [0.75, '#ffb51f'], [1, '#f08400']), 0.4, 0.3, 0.8)}${R('bde', S([0, '#4a7fcc'], [0.6, '#173463'], [1, '#0a1530']), 0.5, 0.3, 0.75)}<clipPath id="bdc"><path d="${sp}"/></clipPath></defs>` +
    shadow(24, 45.5, 14, 1.8) +
    `<path d="${sp}" fill="url(#bdf)" stroke="#c46a00" stroke-width=".9" stroke-linejoin="round"/>` +
    `<path clip-path="url(#bdc)" d="M0 0H48V19C38 14 28 13 19 15 12 16 6 18 0 21Z" fill="url(#gl)" opacity=".85"/>` +
    `<ellipse cx="14.2" cy="29.6" rx="2.4" ry="1.4" fill="#ff6f5e" opacity=".5"/><ellipse cx="33.8" cy="29.6" rx="2.4" ry="1.4" fill="#ff6f5e" opacity=".5"/>` +
    `<ellipse cx="19" cy="25" rx="2.9" ry="3.9" fill="url(#bde)"/><ellipse cx="29" cy="25" rx="2.9" ry="3.9" fill="url(#bde)"/>` +
    `<circle cx="19.9" cy="23.3" r="1.2" fill="#fff"/><circle cx="29.9" cy="23.3" r="1.2" fill="#fff"/>` +
    `<path d="M21 30q3 3 6 0" fill="none" stroke="#5a2a00" stroke-width="1.5" stroke-linecap="round"/>`;
}

I.feedback =
  `<defs>${L('fbk', S([0, '#fff6b8'], [1, '#f2c21e']))}</defs>` +
  shadow(24, 45, 16, 2) +
  `<path d="M7 6h34a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H21l-10 9v-9H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="url(#fbk)" stroke="#a67300" stroke-width=".9" stroke-linejoin="round"/>` +
  `<path d="M11 14h26M11 20h26M11 26h16" stroke="#a67300" stroke-width="2.2" stroke-linecap="round"/>` +
  `<path d="M7 7h34a2 2 0 0 1 2 2v4C30 10 18 12 5 16V9a2 2 0 0 1 2-2z" fill="#fff" opacity=".5"/>`;

{
  const o = orb('o', '#ffd6cf', '#e8402c', '#7a120a');
  I.arena = `<defs>${o.defs}</defs>${o.body}<circle cx="24" cy="23" r="12" fill="#fff"/><circle cx="24" cy="23" r="8" fill="#e8402c"/><circle cx="24" cy="23" r="3.6" fill="#fff"/><path d="M24 2v9M24 35v9M3 23h9M36 23h9" stroke="#1a1a1a" stroke-width="2.4" stroke-linecap="round"/>${o.gloss}`;
}

I.speak =
  `<defs>${L('sp', S([0, '#f4f6f8'], [1, '#7f8b98']))}${L('wv', S([0, '#9fe0ff'], [1, '#1c78d8']))}${L('bb2', S([0, '#ffffff'], [1, '#dbe8f6']))}</defs>` +
  shadow(22, 45, 15, 2) +
  `<path d="M24 3h18a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-8l-5 4v-4h-5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" fill="url(#bb2)" stroke="#5a7aa0" stroke-width=".8"/><path d="M26 9h14M26 13h9" stroke="#5a7aa0" stroke-width="1.6" stroke-linecap="round"/>` +
  `<path d="M5 24h6l8-7v24l-8-7H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" fill="url(#sp)" stroke="#5a6674" stroke-width=".9" stroke-linejoin="round"/>` +
  `<path d="M23 25a7 7 0 0 1 0 8M27 21a12 12 0 0 1 0 16" fill="none" stroke="url(#wv)" stroke-width="2.8" stroke-linecap="round"/>`;

I.code =
  `<defs>${L('c1', S([0, '#ffd27a'], [1, '#f0920f']))}${L('c2', S([0, '#8ec2ff'], [1, '#2f76e0']))}${L('c3', S([0, '#c49bff'], [1, '#7a3fd8']))}</defs>` +
  shadow(24, 45, 17, 2) +
  `<path d="M5 6h26a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H19l-2 2-2-2H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="url(#c1)" stroke="#b06a00" stroke-width=".8"/>` +
  `<path d="M13 20h29a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H27l-2 2-2-2H13a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z" fill="url(#c2)" stroke="#1a4fa0" stroke-width=".8"/>` +
  `<path d="M7 34h22a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3z" fill="url(#c3)" stroke="#4a1fa0" stroke-width=".8"/>` +
  `<circle cx="9" cy="12" r="2" fill="#fff"/><circle cx="17" cy="26" r="2" fill="#fff"/><path d="M5 7h26v4C20 9 12 10 4 13V9z" fill="#fff" opacity=".45"/>`;

I.model =
  `<defs>${L('m1', S([0, '#e6f2ff'], [1, '#9fc6f5']))}${L('m2', S([0, '#7cb2f0'], [1, '#2a62c0']))}${L('m3', S([0, '#4f8ae0'], [1, '#163f8a']))}</defs>` +
  shadow(24, 45, 16, 2.2) +
  `<path d="M24 4l18 10-18 10L6 14z" fill="url(#m1)" stroke="#1c3f9e" stroke-width=".9" stroke-linejoin="round"/>` +
  `<path d="M6 14l18 10v20L6 34z" fill="url(#m2)" stroke="#1c3f9e" stroke-width=".9" stroke-linejoin="round"/>` +
  `<path d="M42 14L24 24v20l18-10z" fill="url(#m3)" stroke="#1c3f9e" stroke-width=".9" stroke-linejoin="round"/>` +
  `<path d="M10 13l14-7 12 6.6C26 10 17 11 10 13z" fill="#fff" opacity=".7"/>`;

I.chat =
  `<defs>${L('ch1', S([0, '#ffffff'], [1, '#cfe2f6']))}${L('ch2', S([0, '#9fdc7a'], [1, '#3a9e2a']))}</defs>` +
  shadow(24, 45, 17, 2) +
  `<path d="M7 5h24a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H17l-7 6v-6H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" fill="url(#ch1)" stroke="#5a7aa0" stroke-width=".9"/>` +
  `<path d="M20 18h21a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-3v6l-7-6H20a3 3 0 0 1-3-3V21a3 3 0 0 1 3-3z" fill="url(#ch2)" stroke="#2a6a18" stroke-width=".9"/>` +
  `<circle cx="25" cy="27" r="1.8" fill="#fff"/><circle cx="31" cy="27" r="1.8" fill="#fff"/><circle cx="37" cy="27" r="1.8" fill="#fff"/>` +
  `<path d="M7 6h24a2 2 0 0 1 2 2v3C23 9 13 10 5 13V8a2 2 0 0 1 2-2z" fill="#fff" opacity=".6"/>`;

I.friends =
  `<defs>${R('fh', S([0, '#ffe6c8'], [1, '#e0a060']), 0.4, 0.3, 0.7)}${L('fb1', S([0, '#7cc4ff'], [1, '#1859b8']))}${L('fb2', S([0, '#a8f07a'], [1, '#3a9e2a']))}${R('fh2', S([0, '#d6f0ff'], [1, '#7aa8d8']), 0.4, 0.3, 0.7)}</defs>` +
  shadow(24, 45, 18, 2) +
  `<circle cx="31" cy="15" r="6.5" fill="url(#fh2)"/><path d="M20 42c0-8 5-13 11-13s12 5 12 13z" fill="url(#fb2)"/>` +
  `<circle cx="17" cy="17" r="7.5" fill="url(#fh)"/><path d="M4 43c0-9 6-14 13-14s13 5 13 14z" fill="url(#fb1)"/>` +
  `<ellipse cx="15" cy="13.5" rx="4" ry="2.4" fill="#fff" opacity=".55"/>`;

I.sticky =
  `<defs>${L('st1', S([0, '#fffbc8'], [1, '#ffe14d']))}</defs>` +
  shadow(24, 45, 16, 2) +
  `<path d="M7 5h34a2 2 0 0 1 2 2v25L32 43H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="url(#st1)" stroke="#b89a00" stroke-width=".9" stroke-linejoin="round"/>` +
  `<path d="M32 43V34a2 2 0 0 1 2-2h9z" fill="#f2d23a" stroke="#b89a00" stroke-width=".9" stroke-linejoin="round"/>` +
  `<path d="M11 14h26M11 20h26M11 26h16" stroke="#a89000" stroke-width="2" stroke-linecap="round" opacity=".7"/>` +
  `<path d="M7 6h34a1 1 0 0 1 1 1v4C30 8 18 9 6 12V7a1 1 0 0 1 1-1z" fill="#fff" opacity=".6"/>`;

I.calendar =
  `<defs>${L('cl1', S([0, '#ffffff'], [1, '#dfe8f3']))}${L('cl2', S([0, '#ff8a7a'], [1, '#d0301a']))}</defs>` +
  shadow(24, 45, 17, 2) +
  `<rect x="5" y="8" width="38" height="35" rx="4" fill="url(#cl1)" stroke="#7d8da3" stroke-width=".9"/>` +
  `<path d="M5 12a4 4 0 0 1 4-4h30a4 4 0 0 1 4 4v6H5z" fill="url(#cl2)"/>` +
  `<rect x="13" y="4" width="3.4" height="9" rx="1.7" fill="#5a6674"/><rect x="31.6" y="4" width="3.4" height="9" rx="1.7" fill="#5a6674"/>` +
  `<text x="24" y="37" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="16" fill="#2a3f5c">31</text>` +
  `<path d="M6 12a3 3 0 0 1 3-3h30a3 3 0 0 1 3 3v2C30 12 18 13 6 16z" fill="#fff" opacity=".45"/>`;

I.game =
  `<defs>${L('gp', S([0, '#f6f8fb'], [1, '#a7b2c2']))}</defs>` +
  shadow(24, 42, 19, 2.2) +
  `<path d="M13 13h22a8 8 0 0 1 8 7l2 11a5 5 0 0 1-9 4l-4-4H16l-4 4a5 5 0 0 1-9-4l2-11a8 8 0 0 1 8-7z" fill="url(#gp)" stroke="#5a6674" stroke-width=".9"/>` +
  `<path d="M14 18v8M10 22h8" stroke="#2f6fe0" stroke-width="3" stroke-linecap="round"/>` +
  `<circle cx="32" cy="20" r="2.4" fill="#e5352a"/><circle cx="36.5" cy="24.5" r="2.4" fill="#3cb83a"/><circle cx="27.5" cy="24.5" r="2.4" fill="#f2c200"/><circle cx="32" cy="29" r="2.4" fill="#2f76e0"/>` +
  `<path d="M13 14h22a7 7 0 0 1 6 4C30 15 18 16 6 21a7 7 0 0 1 7-7z" fill="#fff" opacity=".6"/>`;

I.backrooms =
  `<defs>${L('bk1', S([0, '#efdc78'], [1, '#bfa338']))}${R('bkl', S([0, '#fffbe0'], [1, '#fff6c0', 0]))}</defs>` +
  shadow(24, 45, 18, 2) +
  `<rect x="4" y="4" width="40" height="40" rx="3" fill="url(#bk1)" stroke="#6b5c1e" stroke-width=".9"/>` +
  `<path d="M4 14h40M4 26h40M17 4v40M31 4v40" stroke="#a68f2e" stroke-width=".7" opacity=".7"/>` +
  `<rect x="14" y="18" width="8" height="20" fill="#1a1a1a" opacity=".85"/>` +
  `<circle cx="33" cy="12" r="5" fill="url(#bkl)"/><rect x="29" y="11" width="8" height="2" rx="1" fill="#fffbe0"/>`;

I.reel =
  `<defs>${L('rf', S([0, '#f6f8fb'], [1, '#b3bccb']))}${L('rt', S([0, '#7cc4ff'], [1, '#1c5fc0']))}</defs>` +
  shadow(24, 45, 18, 2) +
  `<rect x="3" y="5" width="42" height="38" rx="4" fill="url(#rf)" stroke="#5a6674" stroke-width=".9"/>` +
  `<path d="M3 9a4 4 0 0 1 4-4h34a4 4 0 0 1 4 4v4H3z" fill="url(#rt)"/>` +
  `<rect x="8" y="17" width="14" height="7" rx="2" fill="#ffb74d" stroke="#8a5300" stroke-width=".8"/><rect x="15" y="27" width="16" height="7" rx="2" fill="#81c784" stroke="#1b5e20" stroke-width=".8"/><rect x="26" y="17" width="14" height="7" rx="2" fill="#64b5f6" stroke="#1c3f9e" stroke-width=".8"/>` +
  glossTop(3, 5, 42, 4, 12);

{
  const st = goldStar(24, 28, 9, 3.8, 'ls');
  I.lxo = I.exe.replace('</defs>', st.defs + '</defs>').replace(/<rect x="8" y="19"[\s\S]*$/, '') + st.body;
}

// Legacy names
I.koala = I.logo;
I.sun = I.star;

// ---------- koal.games arcade: a glossy tile per game ----------
{
  const tile = (c1: string, c2: string, art: string, defs = '') =>
    `<defs>${L('gt', S([0, c1], [1, c2]))}${R('gb2', S([0, '#fff', 0.9], [1, '#fff', 0]), 0.35, 0.3, 0.6)}${defs}</defs>` +
    shadow(24, 45, 17, 2) +
    `<rect x="4.5" y="4.5" width="39" height="38" rx="9" fill="url(#gt)" stroke="rgba(0,0,0,.35)" stroke-width=".9"/>` +
    art +
    `<path d="M5.5 13.5a8 8 0 0 1 8-8h21a8 8 0 0 1 8 8v4C33 14 16 15 5.5 21z" fill="#fff" opacity=".42"/>`;
  const ball = (x: number, y: number, r: number, col: string) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/><ellipse cx="${x}" cy="${y - r * 0.4}" rx="${r * 0.6}" ry="${r * 0.38}" fill="#fff" opacity=".7"/>`;
  const jelly = (x: number, y: number, s: number, col: string) =>
    `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" rx="${s * 0.25}" fill="${col}" stroke="rgba(0,0,0,.4)" stroke-width=".6"/>` +
    `<rect x="${x - s / 2 + 1}" y="${y - s / 2 + 0.8}" width="${s - 2}" height="${s * 0.42}" rx="${s * 0.2}" fill="#fff" opacity=".45"/>` +
    `<circle cx="${x - s * 0.2}" cy="${y}" r="${s * 0.1}" fill="#14305e"/><circle cx="${x + s * 0.2}" cy="${y}" r="${s * 0.1}" fill="#14305e"/>`;
  I.g_snake = tile('#a6ec74', '#2f9a2a', `<path d="M12 33c0-6 9-6 11-10s-2-9 4-10 8 3 8 3" fill="none" stroke="#0e5a12" stroke-width="7.5" stroke-linecap="round"/><path d="M12 33c0-6 9-6 11-10s-2-9 4-10 8 3 8 3" fill="none" stroke="#69df45" stroke-width="5" stroke-linecap="round"/><circle cx="35" cy="16" r="1.2" fill="#10264a"/>${ball(31, 33, 4, '#ef3b3b')}`);
  I.g_pong = tile('#3f8fe8', '#0b2f66', `<rect x="10" y="14" width="4" height="15" rx="2" fill="#7fd0ff"/><rect x="34" y="20" width="4" height="15" rx="2" fill="#ffab7a"/><path d="M24 10v28" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3"/>${ball(22, 25, 3.3, '#fff')}`);
  I.g_brick = tile('#2a8de0', '#0b3c86', [0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => `<rect x="${9 + c * 7.8}" y="${12 + r * 5.5}" width="7" height="4.5" rx="1.4" fill="hsl(${r * 50 + c * 18},85%,58%)"/>`).join('')).join('') + `<rect x="17" y="35" width="14" height="3.5" rx="1.75" fill="#e8f4ff"/>${ball(26, 30, 2.6, '#fff')}`);
  I.g_flappy = tile('#7cc8ff', '#2a7fd8', `<rect x="30" y="5" width="8" height="12" fill="#3fbf3a"/><rect x="29" y="15" width="10" height="3.5" rx="1" fill="#2e9a2a"/><rect x="30" y="30" width="8" height="13" fill="#3fbf3a"/><rect x="29" y="28" width="10" height="3.5" rx="1" fill="#2e9a2a"/>${jelly(18, 24, 12, '#3aa0ff')}`);
  I.g_tiles = tile('#2a6fd0', '#0b2a63', `<rect x="9" y="10" width="13" height="13" rx="3" fill="#7fd3ff"/><rect x="25" y="10" width="13" height="13" rx="3" fill="#33c98a"/><rect x="9" y="26" width="13" height="13" rx="3" fill="#f5d33a"/><rect x="25" y="26" width="13" height="13" rx="3" fill="#ff4f8a"/><text x="31.5" y="35.5" font-family="Segoe UI,Arial" font-size="7" font-weight="bold" fill="#fff" text-anchor="middle">2048</text>`);
  I.g_mines = tile('#bfe0ff', '#5aa9ee', `<path d="M24 12v24M12 24h24M15.5 15.5l17 17M32.5 15.5l-17 17" stroke="#1a1a2a" stroke-width="2.2" stroke-linecap="round"/>${ball(24, 24, 7.5, '#2a2f45')}`);
  I.g_memory = tile('#3a8de8', '#0d2a63', `<rect x="9" y="11" width="15" height="21" rx="3" fill="#2a74d8" stroke="#fff" stroke-width="1" transform="rotate(-8 16 21)"/><rect x="22" y="13" width="15" height="21" rx="3" fill="#fff" stroke="rgba(0,0,0,.3)" stroke-width=".6" transform="rotate(8 30 23)"/><polygon points="${starPts(30, 24, 5.5, 2.4)}" fill="#ffc21f" stroke="#c07000" stroke-width=".5"/>`);
  I.g_ttt = tile('#eef7ff', '#9cc6ee', `<path d="M19 10v28M29 10v28M10 19h28M10 29h28" stroke="#4c97e6" stroke-width="2.4" stroke-linecap="round"/><path d="M11.5 11.5l5 5M16.5 11.5l-5 5" stroke="#e8344a" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="24" r="3" fill="none" stroke="#20b45a" stroke-width="2.4"/><path d="M31.5 31.5l5 5M36.5 31.5l-5 5" stroke="#e8344a" stroke-width="2.6" stroke-linecap="round"/>`);
  I.g_aliens = tile('#1d3f78', '#020818', `<circle cx="10" cy="12" r=".8" fill="#fff"/><circle cx="37" cy="30" r=".8" fill="#fff"/><rect x="12" y="13" width="24" height="16" rx="8" fill="#6ee86e" stroke="rgba(0,0,0,.4)" stroke-width=".6"/><rect x="13" y="14" width="22" height="6" rx="3" fill="#fff" opacity=".45"/><rect x="15" y="27" width="3" height="6" fill="#6ee86e"/><rect x="30" y="27" width="3" height="6" fill="#6ee86e"/><circle cx="19.5" cy="21" r="2.4" fill="#14305e"/><circle cx="28.5" cy="21" r="2.4" fill="#14305e"/><path d="M22 41l2-4 2 4z" fill="#9fe8ff"/>`);
  I.g_stack = tile('#123c86', '#061a40', `<rect x="10" y="29" width="8" height="8" rx="2" fill="#b46bff"/><rect x="18" y="29" width="8" height="8" rx="2" fill="#b46bff"/><rect x="26" y="29" width="8" height="8" rx="2" fill="#b46bff"/><rect x="18" y="21" width="8" height="8" rx="2" fill="#b46bff"/><rect x="26" y="9" width="8" height="8" rx="2" fill="#ffd83a"/><rect x="26" y="17" width="8" height="8" rx="2" fill="#ffd83a" opacity=".9"/><rect x="34" y="17" width="5" height="8" rx="2" fill="#2fd8f0"/>`);
  I.g_rocks = tile('#1d3f78', '#020818', `<path d="M14 13l7-3 6 3 2 6-4 6-8 0-4-6z" fill="#8a9cbd" stroke="#d6e4ff" stroke-width=".8"/><path d="M30 28l4-1 3 3-1 4-4 1-3-3z" fill="#8a9cbd" stroke="#d6e4ff" stroke-width=".7"/><path d="M15 36l9-4-3 4 3 4z" fill="#3fdc5a" stroke="#eaffea" stroke-width=".6" transform="rotate(-20 19 36)"/>`);
  I.g_jump = tile('#7cc8ff', '#2a7fd8', `<rect x="8" y="34" width="16" height="4" rx="2" fill="#56c943"/><rect x="26" y="20" width="14" height="4" rx="2" fill="#ffb13d"/>${jelly(20, 24, 11, '#ff8f1f')}`);
  I.g_whack = tile('#a8ec6c', '#3f9d2f', `<ellipse cx="24" cy="36" rx="14" ry="4.5" fill="#3a2410"/>${jelly(24, 27, 14, '#4cd964')}<path d="M10 37c0-1 28-1 28 0 0 3-28 3-28 0z" fill="#6fd04a"/><rect x="30" y="7" width="3" height="14" rx="1.5" fill="#9a6a3a" transform="rotate(35 31 14)"/><rect x="31" y="5" width="10" height="6" rx="2" fill="#e04a3a" transform="rotate(35 36 8)"/>`);
  I.g_four = tile('#3f8fe8', '#0d3a8a', [0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => `<circle cx="${12 + c * 8}" cy="${16 + r * 8}" r="3.2" fill="${(r === 2 && c < 3) || (r === 1 && c === 1) ? '#ef3b3b' : r === 2 || (r === 1 && c === 2) ? '#ffd21f' : '#dcecff'}"/>`).join('')).join(''));
  I.g_simon = tile('#16305e', '#081631', `<path d="M24 24V10a14 14 0 0 0-14 14z" fill="#1f9a3a"/><path d="M24 24V10a14 14 0 0 1 14 14z" fill="#ff5c5c"/><path d="M24 24h14a14 14 0 0 1-14 14z" fill="#ffd21f"/><path d="M24 24h-14a14 14 0 0 0 14 14z" fill="#3d8fff"/><circle cx="24" cy="24" r="5" fill="#16305e" stroke="#fff" stroke-opacity=".5"/>`);
  I.g_chess = tile('#eaf4ff', '#6f9fd6', `<text x="24" y="36" font-family="Segoe UI Symbol,Segoe UI,Arial" font-size="30" text-anchor="middle" fill="#14305e" stroke="#fff" stroke-width=".8">♞</text>`);
  I.g_cuberun = tile('#5b5fe8', '#39c6f0', `<rect x="5" y="34" width="38" height="8.5" rx="0" fill="#1d4ab0"/><path d="M27 34l5-9 5 9z" fill="#ff3b4f" stroke="#fff" stroke-width=".6"/>${jelly(15, 28, 11, '#ffd21f')}`);
}

export const ICONS = I;
export const ICON_COMMON = COMMON;

export function hasIcon(name: string) {
  return !!I[name];
}
