import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { menuStore, closeMenu, MenuItem } from '../core/menu';
import { dragStore } from '../core/drag';
import { notifyStore, dismissToast } from '../core/notify';
import { Icon } from './Icon';

function MenuList({ items, x, y, onDone, level = 0 }: { items: MenuItem[]; x: number; y: number; onDone: () => void; level?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [sub, setSub] = useState<{ i: number; x: number; y: number } | null>(null);
  const timer = useRef<number>();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (nx + r.width > window.innerWidth) nx = level ? x - r.width - (ref.current?.parentElement ? 0 : 0) - 190 : window.innerWidth - r.width - 2;
    if (ny + r.height > window.innerHeight) ny = Math.max(0, window.innerHeight - r.height - 2);
    if (nx < 0) nx = 0;
    setPos({ x: nx, y: ny });
  }, [x, y, level]);

  return (
    <>
      <div className="ctx" ref={ref} style={{ left: pos.x, top: pos.y }} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
        {items.map((it, i) =>
          it.sep ? (
            <div key={i} className="ctx-sep" />
          ) : (
            <div
              key={i}
              className={`ctx-item ${it.disabled ? 'dis' : ''} ${it.bold ? 'bold' : ''} ${sub?.i === i ? 'open' : ''}`}
              onPointerEnter={(e) => {
                window.clearTimeout(timer.current);
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                if (it.items && !it.disabled) timer.current = window.setTimeout(() => setSub({ i, x: r.right - 3, y: r.top - 3 }), 150);
                else timer.current = window.setTimeout(() => setSub(null), 150);
              }}
              onClick={() => {
                if (it.disabled) return;
                if (it.items) {
                  const r = ref.current!.children[i].getBoundingClientRect();
                  setSub({ i, x: r.right - 3, y: r.top - 3 });
                  return;
                }
                onDone();
                it.onClick?.();
              }}
            >
              <span className="ic">{it.checked ? '✓' : it.icon ? <Icon name={it.icon} size={16} /> : null}</span>
              <span className="lb">{it.label}</span>
              {it.shortcut && <span className="sc">{it.shortcut}</span>}
              {it.items && <span>{'▶'}</span>}
            </div>
          ),
        )}
      </div>
      {sub && items[sub.i]?.items && <MenuList items={items[sub.i].items!} x={sub.x} y={sub.y} onDone={onDone} level={level + 1} />}
    </>
  );
}

export function ContextMenu() {
  const menu = menuStore.use((s) => s.menu);
  useEffect(() => {
    if (!menu) return;
    const close = () => closeMenu();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu();
    const t = window.setTimeout(() => {
      window.addEventListener('pointerdown', close);
      window.addEventListener('blur', close);
    }, 0);
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', key);
    };
  }, [menu]);
  if (!menu) return null;
  return <MenuList key={menu.x + ',' + menu.y + menu.items.length} items={menu.items} x={menu.x} y={menu.y} onDone={closeMenu} />;
}

export function DragGhost() {
  const d = dragStore.use((s) => s);
  if (!d.active) return null;
  return (
    <div className="drag-ghost" style={{ left: d.x - 37, top: d.y - 20 }}>
      <Icon name={d.icon} />
      <div className="lbl">{d.label}</div>
      {d.copy && <div className="badge">+</div>}
    </div>
  );
}

export function Toast() {
  const t = notifyStore.use((s) => s.toast);
  if (!t) return null;
  return (
    <div
      className="toast"
      onClick={() => {
        dismissToast();
        t.onClick?.();
      }}
    >
      <div className="th">
        <Icon name={t.icon} size={16} />
        {t.title}
      </div>
      <div
        className="tx"
        onClick={(e) => {
          e.stopPropagation();
          dismissToast();
        }}
      >
        x
      </div>
      <div className="tb">{t.body}</div>
    </div>
  );
}
