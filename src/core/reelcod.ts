// Reelcod: a tiny block language that compiles to JavaScript, plus the shareable .lxo app format.
// Same format as koalOS, so apps made in either open in both.
export interface Block {
  t: string;
  c?: Block[];
  [k: string]: unknown;
}
type Field = [string, 'text' | 'var' | 'op', string];
interface Def {
  f: Field[];
  c?: boolean;
  end?: string;
  g: (a: Block, body: string) => string;
}

const T = (s: unknown) => '`' + String(s).replace(/[`\\]/g, '\\$&').replace(/\$\{/g, '\\${').replace(/\{(\w+)\}/g, (_m, n) => '${' + V(n) + '}') + '`';
const V = (n: unknown) => 'v_' + String(n).replace(/\W/g, '_');
const X = (s0: unknown) => {
  const s = String(s0).trim();
  return /^-?\d+(\.\d+)?$/.test(s) ? s : /^\{\w+\}$/.test(s) ? V(s.slice(1, -1)) : T(s);
};

export const RC_DEFS: Record<string, Def> = {
  title: { f: [['set window title to ', 'text', 'My App']], g: (a) => `app.title(${T(a.a0)});` },
  show: { f: [['show text ', 'text', 'Hello!']], g: (a) => `app.print(${T(a.a0)});` },
  clear: { f: [], g: () => 'app.clear();' },
  alert: { f: [['pop up ', 'text', 'Hi there!']], g: (a) => `alert(${T(a.a0)});` },
  say: { f: [['say out loud ', 'text', 'Hello!']], g: (a) => `say(${T(a.a0)});` },
  setv: { f: [['set ', 'var', 'x'], [' to ', 'text', '0']], g: (a) => `${V(a.a0)}=${X(a.a1)};` },
  chg: { f: [['change ', 'var', 'x'], [' by ', 'text', '1']], g: (a) => `${V(a.a0)}=Number(${V(a.a0)})+Number(${X(a.a1)});` },
  ask: { f: [['ask ', 'text', 'Your name?'], [' and save in ', 'var', 'name']], g: (a) => `${V(a.a1)}=prompt(${T(a.a0)})||'';` },
  rep: { c: true, end: ' times', f: [['repeat ', 'text', '3']], g: (a, b) => `for(let i_=0;i_<Number(${X(a.a0)});i_++){\n${b}}` },
  btn: { c: true, end: ' is clicked', f: [['when button ', 'text', 'Click me']], g: (a, b) => `app.button(${T(a.a0)},()=>{\n${b}});` },
  iff: { c: true, end: '', f: [['if ', 'var', 'x'], ['', 'op', '='], ['', 'text', '0']], g: (a, b) => `if(${V(a.a0)}${({ '=': '==', '≠': '!=', '<': '<', '>': '>' } as Record<string, string>)[String(a.a1)] ?? '=='}${X(a.a2)}){\n${b}}` },
};
export const RC_NAMES: Record<string, string> = { title: 'Set window title', show: 'Show text', clear: 'Clear screen', alert: 'Pop-up message', say: 'Say out loud', setv: 'Set variable', chg: 'Change variable', ask: 'Ask a question', rep: 'Repeat', btn: 'When button clicked', iff: 'If' };

export function rcGen(blocks: Block[]): string {
  const vars = new Set<string>();
  const walk = (l: Block[]) =>
    l.forEach((b) => {
      const d = RC_DEFS[b.t];
      if (!d) return;
      d.f.forEach((f, i) => f[1] === 'var' && vars.add(V(b['a' + i])));
      if (b.c) walk(b.c);
    });
  walk(blocks);
  const out = (list: Block[]): string => list.map((b) => (RC_DEFS[b.t] ? RC_DEFS[b.t].g(b, RC_DEFS[b.t].c ? out(b.c ?? []) : '') + '\n' : '')).join('');
  return (vars.size ? 'let ' + [...vars].map((v) => v + '=0').join(',') + ';\n' : '') + out(blocks);
}

export function rcNew(t: string): Block {
  const d = RC_DEFS[t];
  const b: Block = { t };
  d.f.forEach((f, i) => (b['a' + i] = f[2]));
  if (d.c) b.c = [];
  return b;
}

export type Mode = 'blocks' | 'code' | 'html';
export function rcPack(name: string, mode: Mode, blocks: Block[], code: string): string {
  return '#reelcod-app\n#name: ' + name.replace(/[\r\n]/g, ' ') + '\n' + (mode === 'blocks' ? '#blocks: ' + JSON.stringify(blocks) + '\n' : mode === 'html' ? '#blocks: html\n' : '#blocks: none\n') + code;
}

export interface ReelApp {
  name: string;
  blocks: Block[] | null;
  html: boolean;
  code: string;
}

/** Parses a .lxo Reelcod app, or a base64 share code. Returns null if it is not one. */
export function rcParse(text0: string): ReelApp | null {
  let text = String(text0 || '').trim();
  if (!/^#reelcod-app/.test(text)) {
    try {
      const d = decodeURIComponent(escape(atob(text.replace(/\s/g, ''))));
      if (/^#reelcod-app/.test(d)) text = d;
    } catch {
      /* not base64 */
    }
  }
  if (!/^#reelcod-app/.test(text)) return null;
  const ls = text.split('\n');
  let name = 'My App';
  let blocks: Block[] | null = null;
  let html = false;
  let i = 1;
  if (/^#name:/.test(ls[i] ?? '')) (name = ls[i].slice(6).trim() || name), i++;
  if (/^#blocks:/.test(ls[i] ?? '')) {
    if (ls[i].slice(8).trim() === 'html') html = true;
    try {
      const j = JSON.parse(ls[i].slice(8));
      if (Array.isArray(j)) blocks = j;
    } catch {
      /* none */
    }
    i++;
  }
  return { name, blocks, html, code: ls.slice(i).join('\n') };
}

export const shareCode = (packed: string) => btoa(unescape(encodeURIComponent(packed)));
