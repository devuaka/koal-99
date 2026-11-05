import { ICONS, ICON_COMMON } from './icons';

const cache = new Map<string, string>();

function build(name: string): string {
  const body = ICONS[name] ?? ICONS.exe;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs>${ICON_COMMON}</defs>${body}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function iconUrl(name: string): string {
  let u = cache.get(name);
  if (!u) {
    u = build(name);
    cache.set(name, u);
  }
  return u;
}

const ARROW =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#dfe8f3"/></linearGradient></defs><rect x=".5" y=".5" width="15" height="15" rx="3" fill="url(#a)" stroke="#5a7fae"/><path d="M5 12c0-4 2-6 6-6" fill="none" stroke="#1c64c8" stroke-width="2" stroke-linecap="round"/><path d="M9 3.5l3.5 2.6L9 8.6z" fill="#1c64c8"/></svg>',
  );

export function Icon({ name, size = 32, shortcut = false, className = '', style }: { name: string; size?: number; shortcut?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={'k-icon ' + className} style={{ width: size, height: size, ...style }}>
      <img src={iconUrl(name)} width={size} height={size} alt="" draggable={false} />
      {shortcut && <img className="k-icon-arrow" src={ARROW} width={Math.max(9, Math.round(size * 0.38))} height={Math.max(9, Math.round(size * 0.38))} alt="" draggable={false} />}
    </span>
  );
}
