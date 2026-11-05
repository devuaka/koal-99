import { useEffect, useMemo, useRef, useState } from 'react';
import * as fs from '../core/fs';
import { useSettings, setSettings, S } from '../core/settings';
import { desktopDir, setIconPos } from '../core/session';
import { openApp, blurAll, wmStore } from '../core/wm';
import { openMenu, MenuItem, clipStore } from '../core/menu';
import { armDrag, dragStore } from '../core/drag';
import { openNode, pasteInto, deleteNodes, displayName, launchApp } from '../core/launcher';
import { confirmBox, errorBox } from '../core/dialog';
import { Icon } from './Icon';
import { nodeIcon } from './nodeIcon';
import { wallpaperProps } from './wallpaper';
import { play } from '../core/sound';
import { pickAndImport, importFileList } from '../core/importer';

const GX = 86;
const GY = 92;

interface DIcon {
  key: string;
  label: string;
  icon: string;
  shortcut: boolean;
  node?: fs.FSNode;
  special?: 'mycomputer' | 'recycle';
}

export function Desktop() {
  const settings = useSettings();
  const version = fs.fsStore.use((s) => s.version);
  const clip = clipStore.use((s) => s);
  const dragOver = dragStore.use((s) => s.over);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [dragPos, setDragPos] = useState<Record<string, { x: number; y: number }> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [vh, setVh] = useState(window.innerHeight);

  useEffect(() => {
    const r = () => setVh(window.innerHeight);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  const desk = desktopDir();
  const icons: DIcon[] = useMemo(() => {
    const recycleFull = fs.children(fs.RECYCLER, { hidden: true }).length > 0;
    const list: DIcon[] = [
      { key: 'sp:mycomputer', label: 'My Computer', icon: 'computer', shortcut: false, special: 'mycomputer' },
      { key: 'sp:recycle', label: 'Recycle Bin', icon: recycleFull ? 'recyclefull' : 'recycle', shortcut: false, special: 'recycle' },
    ];
    for (const n of fs.children(desk.id, { hidden: settings.showHidden })) {
      const ni = nodeIcon(n);
      list.push({ key: n.id, label: displayName(n, settings.showExtensions), icon: ni.icon, shortcut: ni.shortcut, node: n });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, desk.id, settings.showHidden, settings.showExtensions]);

  // layout: saved positions, else column-major auto placement into free cells
  const positions = useMemo(() => {
    const rows = Math.max(1, Math.floor((vh - 40 - 10) / GY));
    const out: Record<string, { x: number; y: number }> = {};
    const taken = new Set<string>();
    for (const ic of icons) {
      const p = settings.iconPositions[ic.key];
      if (p) {
        out[ic.key] = p;
        taken.add(Math.round(p.x / GX) + ',' + Math.round(p.y / GY));
      }
    }
    let cell = 0;
    for (const ic of icons) {
      if (out[ic.key]) continue;
      while (taken.has(Math.floor(cell / rows) + ',' + (cell % rows))) cell++;
      out[ic.key] = { x: 6 + Math.floor(cell / rows) * GX, y: 6 + (cell % rows) * GY };
      taken.add(Math.floor(cell / rows) + ',' + (cell % rows));
      cell++;
    }
    return out;
  }, [icons, settings.iconPositions, vh]);

  const nodeIdsOf = (keys: Iterable<string>) => [...keys].filter((k) => !k.startsWith('sp:') && fs.get(k));

  const open = (ic: DIcon) => {
    if (ic.special === 'mycomputer') openApp('explorer', { path: 'mycomputer' });
    else if (ic.special === 'recycle') openApp('explorer', { path: fs.RECYCLER });
    else openNode(ic.node);
  };

  const onIconDown = (ic: DIcon) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    blurAll();
    rootRef.current?.focus();
    let current = sel;
    if (e.ctrlKey) {
      current = new Set(sel);
      current.has(ic.key) ? current.delete(ic.key) : current.add(ic.key);
      setSel(current);
    } else if (!sel.has(ic.key)) {
      current = new Set([ic.key]);
      setSel(current);
    }
    const keys = [...current].filter((k) => positions[k]);
    const ids = nodeIdsOf(keys);
    const sx = e.clientX;
    const sy = e.clientY;
    const track = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (Math.hypot(dx, dy) < 6) return;
      const p: Record<string, { x: number; y: number }> = {};
      keys.forEach((k) => (p[k] = { x: positions[k].x + dx, y: positions[k].y + dy }));
      setDragPos(p);
    };
    window.addEventListener('pointermove', track);
    armDrag(e, ids, {
      label: ic.label + (keys.length > 1 ? ` (+${keys.length - 1})` : ''),
      icon: ic.icon,
      noGhost: true,
      onDrop: (info) => {
        if (info.target === 'desktop' && !info.copy) {
          const dx = info.x - sx;
          const dy = info.y - sy;
          const pos = { ...S().iconPositions };
          const maxX = window.innerWidth - GX;
          const maxY = window.innerHeight - 40 - GY;
          keys.forEach((k) => {
            const nx = Math.max(0, Math.min(maxX, positions[k].x + dx));
            const ny = Math.max(0, Math.min(maxY, positions[k].y + dy));
            pos[k] = { x: Math.round(nx / GX) * GX + 6, y: Math.round(ny / GY) * GY + 6 };
          });
          setSettings({ iconPositions: pos });
          return true;
        }
        if (!ids.length) return true; // special icons only move
        if (info.target === 'dir:' + desk.id) return true;
        return false;
      },
      onEnd: () => {
        window.removeEventListener('pointermove', track);
        setDragPos(null);
      },
    });
  };

  const onBgDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    blurAll();
    rootRef.current?.focus();
    if (!e.ctrlKey) setSel(new Set());
    const x0 = e.clientX;
    const y0 = e.clientY;
    const base = e.ctrlKey ? new Set(sel) : new Set<string>();
    const move = (ev: PointerEvent) => {
      const m = { x0, y0, x1: ev.clientX, y1: ev.clientY };
      setMarquee(m);
      const l = Math.min(x0, ev.clientX);
      const r = Math.max(x0, ev.clientX);
      const t = Math.min(y0, ev.clientY);
      const b = Math.max(y0, ev.clientY);
      const s = new Set(base);
      for (const ic of icons) {
        const p = positions[ic.key];
        if (p.x + 60 > l && p.x + 14 < r && p.y + 50 > t && p.y + 2 < b) s.add(ic.key);
      }
      setSel(s);
    };
    const up = () => {
      setMarquee(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const newItem = (kind: 'dir' | 'txt' | 'kpx' | 'htm') => {
    try {
      const base = kind === 'dir' ? 'New Folder' : kind === 'txt' ? 'New Text Document.txt' : kind === 'kpx' ? 'New Bitmap Image.kpx' : 'New Web Page.htm';
      const name = fs.uniqueName(desk.id, base);
      const content = kind === 'htm' ? '<html>\n<head><title>My Home Page</title></head>\n<body bgcolor="#ffffcc">\n<h1>Welcome to my homepage!</h1>\n<marquee>Under construction</marquee>\n</body>\n</html>\n' : '';
      const n = fs.create(desk.id, name, kind === 'dir' ? 'dir' : 'file', content);
      setSel(new Set([n.id]));
      setRenaming(n.id);
    } catch (err) {
      errorBox((err as Error).message);
    }
  };

  const arrange = (by: 'name' | 'type' | 'size' | 'date') => {
    const nodes = icons.filter((i) => i.node).map((i) => i.node!);
    const sorted = [...nodes].sort((a, b) => {
      if (by === 'name') return a.name.localeCompare(b.name);
      if (by === 'type') return (a.type === b.type ? fs.ext(a.name).localeCompare(fs.ext(b.name)) : a.type === 'dir' ? -1 : 1) || a.name.localeCompare(b.name);
      if (by === 'size') return fs.size(b.id) - fs.size(a.id);
      return b.modified - a.modified;
    });
    const rows = Math.max(1, Math.floor((vh - 40) / GY));
    const pos: Record<string, { x: number; y: number }> = {};
    ['sp:mycomputer', 'sp:recycle', ...sorted.map((n) => n.id)].forEach((k, i) => (pos[k] = { x: 6 + Math.floor(i / rows) * GX, y: 6 + (i % rows) * GY }));
    setSettings({ iconPositions: pos });
  };

  const bgMenu = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    const items: MenuItem[] = [
      { label: 'Arrange Icons By', items: [
        { label: 'Name', onClick: () => arrange('name') },
        { label: 'Type', onClick: () => arrange('type') },
        { label: 'Size', onClick: () => arrange('size') },
        { label: 'Modified', onClick: () => arrange('date') },
        { sep: true },
        { label: 'Reset Layout', onClick: () => setSettings({ iconPositions: {} }) },
      ] },
      { label: 'Refresh', onClick: () => { setSel(new Set()); fs.fsStore.set((s) => ({ version: s.version + 1 })); } },
      { sep: true },
      { label: 'Paste', disabled: !clip.ids.length, onClick: () => pasteInto(desk.id) },
      { label: 'Open Terminal Here', icon: 'terminal', onClick: () => launchApp('terminal', { cwd: desk.id }) },
      { label: 'Import Files from Computer...', icon: 'documents', onClick: () => pickAndImport(desk.id) },
      { sep: true },
      { label: 'New', items: [
        { label: 'Folder', icon: 'folder', onClick: () => newItem('dir') },
        { sep: true },
        { label: 'Text Document', icon: 'text', onClick: () => newItem('txt') },
        { label: 'Bitmap Image', icon: 'image', onClick: () => newItem('kpx') },
        { label: 'Web Page', icon: 'web', onClick: () => newItem('htm') },
      ] },
      { sep: true },
      { label: 'Change Wallpaper...', icon: 'palette', onClick: () => openApp('control', { page: 'display' }) },
      { label: 'Properties', onClick: () => openApp('control', { page: 'display' }) },
    ];
    openMenu(e, items);
  };

  const iconMenu = (ic: DIcon) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!sel.has(ic.key)) setSel(new Set([ic.key]));
    const keys = sel.has(ic.key) ? [...sel] : [ic.key];
    const ids = nodeIdsOf(keys);
    if (ic.special === 'mycomputer')
      return openMenu(e, [
        { label: 'Open', bold: true, onClick: () => open(ic) },
        { label: 'Explore', onClick: () => openApp('explorer', { path: fs.ROOT }) },
        { label: 'Search...', onClick: () => openApp('explorer', { path: fs.ROOT, search: true }) },
        { sep: true },
        { label: 'Properties', onClick: () => openApp('sysprops') },
      ]);
    if (ic.special === 'recycle')
      return openMenu(e, [
        { label: 'Open', bold: true, onClick: () => open(ic) },
        { label: 'Empty Recycle Bin', disabled: !fs.children(fs.RECYCLER, { hidden: true }).length, onClick: emptyBin },
        { sep: true },
        { label: 'Properties', onClick: () => openApp('properties', { id: fs.RECYCLER }) },
      ]);
    const n = ic.node!;
    const isFile = n.type === 'file';
    openMenu(e, [
      { label: 'Open', bold: true, onClick: () => keys.forEach((k) => openNode(fs.get(k))) },
      ...(isFile && !['lnk', 'exe'].includes(fs.ext(n.name)) ? [{ label: 'Open With', items: [
        { label: 'Notepad', icon: 'notepad', onClick: () => openNode(n, { with: 'notepad' }) },
        { label: 'StarPaint', icon: 'paint', onClick: () => openNode(n, { with: 'paint' }) },
        { label: 'StarNet Explorer', icon: 'browser', onClick: () => openApp('browser', { url: 'file:' + fs.pathOf(n.id) }) },
        { label: 'Picture Viewer', icon: 'image', onClick: () => openApp('imageviewer', { fileId: n.id }) },
      ] }] : []),
      ...(n.content.startsWith('data:image') ? [{ label: 'Set as Desktop Background', icon: 'palette', onClick: () => setSettings({ wallpaper: { kind: 'image', value: n.content, fit: 'cover' } }) }] : []),
      ...(n.type === 'dir' ? [{ label: 'Open Terminal Here', icon: 'terminal', onClick: () => launchApp('terminal', { cwd: n.id }) }] : []),
      { sep: true },
      { label: 'Cut', onClick: () => clipStore.set({ ids, mode: 'cut' }) },
      { label: 'Copy', onClick: () => clipStore.set({ ids, mode: 'copy' }) },
      ...(n.type === 'dir' ? [{ label: 'Paste', disabled: !clip.ids.length, onClick: () => pasteInto(n.id) }] : []),
      { sep: true },
      { label: 'Delete', onClick: () => askDelete(ids) },
      { label: 'Rename', disabled: keys.length > 1, onClick: () => setRenaming(n.id) },
      { sep: true },
      { label: 'Properties', onClick: () => openApp('properties', { id: n.id }) },
    ]);
  };

  const emptyBin = async () => {
    const count = fs.children(fs.RECYCLER, { hidden: true }).length;
    if (!count) return;
    if (await confirmBox(`Are you sure you want to permanently delete ${count === 1 ? 'this item' : `these ${count} items`}?`, 'Confirm Multiple File Delete', 'warning')) {
      fs.emptyRecycler();
      play('recycle');
    }
  };

  const askDelete = async (ids: string[]) => {
    if (!ids.length) return;
    const first = fs.get(ids[0]);
    const msg = ids.length === 1 ? `Are you sure you want to send '${first ? displayName(first) : 'this item'}' to the Recycle Bin?` : `Are you sure you want to send these ${ids.length} items to the Recycle Bin?`;
    if (await confirmBox(msg, ids.length === 1 ? 'Confirm File Delete' : 'Confirm Multiple File Delete', 'warning')) {
      deleteNodes(ids);
      setSel(new Set());
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (renaming) return;
    if (wmStore.get().focused) return;
    const ids = nodeIdsOf(sel);
    if (e.key === 'Delete') askDelete(ids);
    else if (e.key === 'F2' && ids.length === 1) setRenaming(ids[0]);
    else if (e.key === 'Enter' && (e.preventDefault(), true)) [...sel].forEach((k) => { const ic = icons.find((i) => i.key === k); if (ic) open(ic); });
    else if (e.ctrlKey && e.key.toLowerCase() === 'a') (e.preventDefault(), setSel(new Set(icons.map((i) => i.key))));
    else if (e.ctrlKey && e.key.toLowerCase() === 'c' && ids.length) clipStore.set({ ids, mode: 'copy' });
    else if (e.ctrlKey && e.key.toLowerCase() === 'x' && ids.length) clipStore.set({ ids, mode: 'cut' });
    else if (e.ctrlKey && e.key.toLowerCase() === 'v') pasteInto(desk.id);
  };

  const commitRename = (id: string, value: string) => {
    setRenaming(null);
    const n = fs.get(id);
    if (!n) return;
    let name = value.trim();
    const e = fs.ext(n.name);
    if ((e === 'lnk' || e === 'url') && !name.toLowerCase().endsWith('.' + e)) name += '.' + e;
    if (!settings.showExtensions && n.type === 'file' && e && !name.includes('.')) name += '.' + e;
    if (!name || name === n.name) return;
    try {
      fs.rename(id, name);
    } catch (err) {
      errorBox((err as Error).message, 'Error Renaming File or Folder');
    }
  };

  const wp = wallpaperProps(settings.wallpaper);

  return (
    <div ref={rootRef} className="desktop" tabIndex={-1} onKeyDown={onKey} style={{ outline: 'none' }} onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()} onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); importFileList([...e.dataTransfer.files], desk.id); }}>
      <div className={wp.className} style={wp.style} />
      <div style={{ position: 'absolute', inset: 0 }} data-drop="desktop" onPointerDown={onBgDown} onContextMenu={bgMenu} onDoubleClick={(e) => e.target === e.currentTarget && setSel(new Set())}>
        {icons.map((ic) => {
          const p = dragPos?.[ic.key] ?? positions[ic.key];
          const drop = ic.special === 'recycle' ? 'recycle' : ic.node?.type === 'dir' ? 'dir:' + ic.node.id : undefined;
          const isOver = drop && dragOver === drop;
          return (
            <div
              key={ic.key}
              className={`d-icon ${sel.has(ic.key) ? 'sel' : ''} ${isOver ? 'drop-over' : ''} ${clip.mode === 'cut' && clip.ids.includes(ic.key) ? 'cut' : ''}`}
              style={{ left: p.x, top: p.y, opacity: dragPos?.[ic.key] ? 0.6 : undefined, zIndex: dragPos?.[ic.key] ? 2 : undefined, pointerEvents: dragPos?.[ic.key] ? 'none' : undefined }}
              data-drop={drop}
              onPointerDown={onIconDown(ic)}
              onDoubleClick={() => open(ic)}
              onContextMenu={iconMenu(ic)}
              title={ic.node ? fs.pathOf(ic.node.id) : undefined}
            >
              <Icon name={ic.icon} shortcut={ic.shortcut} size={44} />
              {renaming === ic.key ? (
                <input
                  autoFocus
                  defaultValue={ic.node && fs.ext(ic.node.name) === 'lnk' ? ic.label : ic.node?.name}
                  onFocus={(e) => {
                    const v = e.currentTarget.value;
                    const dot = v.lastIndexOf('.');
                    e.currentTarget.setSelectionRange(0, ic.node?.type === 'file' && dot > 0 ? dot : v.length);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') commitRename(ic.key, e.currentTarget.value);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  onBlur={(e) => commitRename(ic.key, e.currentTarget.value)}
                />
              ) : (
                <div className="lbl">{ic.label}</div>
              )}
            </div>
          );
        })}
        {marquee && (
          <div className="marquee" style={{ left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0) }} />
        )}
      </div>
    </div>
  );
}
