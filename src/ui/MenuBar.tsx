import { useRef, useState } from 'react';
import { MenuItem, menuStore, openMenu } from '../core/menu';

export function MenuBar({ menus }: { menus: { label: string; items: MenuItem[] }[] }) {
  const menu = menuStore.use((s) => s.menu);
  const [openIdx, setOpenIdx] = useState(-1);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const active = menu && openIdx >= 0 ? openIdx : -1;

  const show = (i: number) => {
    const el = refs.current[i];
    if (!el) return;
    const r = el.getBoundingClientRect();
    setOpenIdx(i);
    openMenu({ clientX: r.left, clientY: r.bottom }, menus[i].items);
  };

  return (
    <div className="k-menubar">
      {menus.map((m, i) => (
        <div
          key={m.label}
          ref={(el) => (refs.current[i] = el)}
          className={active === i ? 'open' : ''}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (active === i) {
              menuStore.set({ menu: null });
              setOpenIdx(-1);
            } else show(i);
          }}
          onPointerEnter={() => active >= 0 && active !== i && show(i)}
        >
          {m.label}
        </div>
      ))}
    </div>
  );
}
