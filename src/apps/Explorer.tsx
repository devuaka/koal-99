import { useEffect, useMemo, useRef, useState } from 'react';
import type { WinCtx } from '../core/registry';
import * as fs from '../core/fs';
import { useSettings, setSettings } from '../core/settings';
import { openMenu, MenuItem, clipStore } from '../core/menu';
import { armDrag, dragStore } from '../core/drag';
import { openNode, pasteInto, deleteNodes, displayName, typeName, humanSize, launchApp } from '../core/launcher';
import { confirmBox, errorBox, alertBox } from '../core/dialog';
import { openApp } from '../core/wm';
import { homeDir, documentsDir, desktopDir, homePath } from '../core/session';
import { isAdmin } from '../core/system';
import { play } from '../core/sound';
import { Icon } from '../ui/Icon';
import { nodeIcon } from '../ui/nodeIcon';
import { MenuBar } from '../ui/MenuBar';
import { pickAndImport, importFileList } from '../core/importer';

const MYCOMP = 'mycomputer';
type View = 'icons' | 'tiles' | 'list' | 'details';

function locName(id: string) {
  if (id === MYCOMP) return 'My Computer';
  if (id === fs.RECYCLER) return 'Recycle Bin';
  if (id === fs.ROOT) return 'Local Disk (C:)';
  return fs.get(id)?.name ?? '?';
}

function locIcon(id: string) {
  if (id === MYCOMP) return 'computer';
  if (id === fs.ROOT) return 'drive';
  const n = fs.get(id);
  return n ? (n.id === fs.RECYCLER ? nodeIcon(n).icon : nodeIcon(n).icon === 'folder' ? 'folderopen' : nodeIcon(n).icon) : 'folder';
}

function addrOf(id: string) {
  if (id === MYCOMP) return 'My Computer';
  if (id === fs.RECYCLER) return 'Recycle Bin';
  return fs.pathOf(id);
}

export function Explorer({ win }: { win: WinCtx }) {
  const settings = useSettings();
  const version = fs.fsStore.use((s) => s.version);
  const clip = clipStore.use((s) => s);
  const dragOver = dragStore.use((s) => s.over);
  const initial = win.props.path === MYCOMP ? MYCOMP : win.props.path && fs.get(win.props.path) ? win.props.path : documentsDir().id;
  const [cur, setCur] = useState<string>(initial);
  const [back, setBack] = useState<string[]>([]);
  const [fwd, setFwd] = useState<string[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<number>(-1);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [pane, setPane] = useState<'tasks' | 'folders' | 'search'>(win.props.search ? 'search' : 'tasks');
  const [query, setQuery] = useState('');
  const [searchIn, setSearchIn] = useState<string>(fs.ROOT);
  const [results, setResults] = useState<string[] | null>(null);
  const [searchContent, setSearchContent] = useState(false);
  const [addr, setAddr] = useState(addrOf(initial));
  const [sort, setSort] = useState<{ by: 'name' | 'size' | 'type' | 'date'; asc: boolean }>({ by: 'name', asc: true });
  const view = settings.explorerView as View;
  const bodyRef = useRef<HTMLDivElement>(null);

  // re-navigate when reopened with new props (singleton-ish reuse)
  useEffect(() => {
    if (win.props._nonce && win.props.path) navigate(win.props.path === MYCOMP ? MYCOMP : win.props.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props._nonce]);

  useEffect(() => {
    if (cur !== MYCOMP && !fs.get(cur)) navigate(fs.ROOT, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    setAddr(results ? `Search Results in ${locName(searchIn)}` : addrOf(cur));
    win.setTitle(results ? 'Search Results' : locName(cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, results, version]);

  const navigate = (id: string, push = true) => {
    if (id !== MYCOMP) {
      const n = fs.get(id);
      if (!n) return;
      if (n.type !== 'dir') return openNode(n);
      if (n.meta?.adminOnly && !isAdmin()) {
        errorBox(`${fs.pathOf(id)} is not accessible.\n\nAccess is denied.`, locName(id));
        return;
      }
    }
    if (push && id !== cur) {
      setBack((b) => [...b, cur]);
      setFwd([]);
    }
    setCur(id);
    setSel([]);
    setResults(null);
    setRenaming(null);
  };

  const goBack = () => {
    if (!back.length) return;
    const prev = back[back.length - 1];
    setBack(back.slice(0, -1));
    setFwd([cur, ...fwd]);
    setCur(prev);
    setSel([]);
    setResults(null);
  };
  const goFwd = () => {
    if (!fwd.length) return;
    const next = fwd[0];
    setFwd(fwd.slice(1));
    setBack([...back, cur]);
    setCur(next);
    setSel([]);
    setResults(null);
  };
  const goUp = () => {
    if (results) return setResults(null);
    if (cur === MYCOMP) return;
    const n = fs.get(cur);
    if (cur === fs.ROOT || !n?.parent) navigate(MYCOMP);
    else navigate(n.parent === fs.RECYCLER ? fs.RECYCLER : n.parent);
  };

  const inBin = cur === fs.RECYCLER && !results;

  const items: fs.FSNode[] = useMemo(() => {
    if (cur === MYCOMP && !results) return [];
    const list = results ? results.map((id) => fs.get(id)).filter(Boolean) as fs.FSNode[] : fs.children(cur, { hidden: settings.showHidden || inBin });
    const dirFirst = (a: fs.FSNode, b: fs.FSNode) => (a.type === b.type ? 0 : a.type === 'dir' ? -1 : 1);
    const cmp = (a: fs.FSNode, b: fs.FSNode) => {
      let r = 0;
      if (sort.by === 'name') r = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      if (sort.by === 'size') r = fs.size(a.id) - fs.size(b.id);
      if (sort.by === 'type') r = typeName(a).localeCompare(typeName(b));
      if (sort.by === 'date') r = (inBin ? (a.meta?.deletedAt ?? 0) - (b.meta?.deletedAt ?? 0) : a.modified - b.modified);
      return dirFirst(a, b) || (sort.asc ? r : -r);
    };
    return [...list].sort(cmp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, version, settings.showHidden, results, sort, inBin]);

  const selNodes = sel.map((id) => fs.get(id)).filter(Boolean) as fs.FSNode[];
  const target = cur === MYCOMP ? null : cur;

  const doSearch = () => {
    if (!query.trim()) return;
    const r = fs.search(searchIn, query.trim(), { hidden: settings.showHidden, content: searchContent }).filter((n) => !n.meta?.adminOnly || isAdmin());
    setResults(r.map((n) => n.id));
    setSel([]);
  };

  const newItem = (kind: 'dir' | 'txt' | 'kpx') => {
    if (!target || inBin) return;
    try {
      const base = kind === 'dir' ? 'New Folder' : kind === 'txt' ? 'New Text Document.txt' : 'New Bitmap Image.kpx';
      const n = fs.create(target, fs.uniqueName(target, base), kind === 'dir' ? 'dir' : 'file', '');
      setSel([n.id]);
      setRenaming(n.id);
    } catch (e) {
      errorBox((e as Error).message);
    }
  };

  const askDelete = async (ids: string[], permanent = false) => {
    if (!ids.length) return;
    const first = fs.get(ids[0]);
    const perm = permanent || inBin;
    const msg = ids.length === 1
      ? perm ? `Are you sure you want to permanently delete '${first?.meta?.origName ?? first?.name}'?` : `Are you sure you want to send '${first ? displayName(first) : ''}' to the Recycle Bin?`
      : perm ? `Are you sure you want to permanently delete these ${ids.length} items?` : `Are you sure you want to send these ${ids.length} items to the Recycle Bin?`;
    if (await confirmBox(msg, ids.length > 1 ? 'Confirm Multiple File Delete' : 'Confirm File Delete', 'warning')) {
      deleteNodes(ids, perm);
      setSel([]);
    }
  };

  const restoreSel = (ids: string[]) => {
    const errs: string[] = [];
    ids.forEach((id) => {
      try {
        fs.restore(id);
      } catch (e) {
        errs.push((e as Error).message);
      }
    });
    if (errs.length) errorBox(errs.join('\n'));
    setSel([]);
    play('ding');
  };

  const emptyBin = async () => {
    const n = fs.children(fs.RECYCLER, { hidden: true }).length;
    if (!n) return;
    if (await confirmBox(`Are you sure you want to permanently delete all ${n} item(s) in the Recycle Bin?`, 'Confirm Multiple File Delete', 'warning')) {
      fs.emptyRecycler();
      play('recycle');
      setSel([]);
    }
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

  const copy = (ids = sel) => ids.length && clipStore.set({ ids, mode: 'copy' });
  const cut = (ids = sel) => ids.length && clipStore.set({ ids, mode: 'cut' });
  const paste = (into = target) => {
    if (!into || inBin) return;
    const made = pasteInto(into);
    if (made.length) setSel(made.map((m) => m.id));
  };

  const clickItem = (e: React.PointerEvent | React.MouseEvent, n: fs.FSNode, i: number) => {
    if (e.shiftKey && anchor >= 0) {
      const [a, b] = [Math.min(anchor, i), Math.max(anchor, i)];
      setSel(items.slice(a, b + 1).map((x) => x.id));
    } else if (e.ctrlKey) {
      setSel(sel.includes(n.id) ? sel.filter((x) => x !== n.id) : [...sel, n.id]);
      setAnchor(i);
    } else {
      if (!sel.includes(n.id)) setSel([n.id]);
      setAnchor(i);
    }
  };

  const onItemDown = (n: fs.FSNode, i: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    bodyRef.current?.focus();
    clickItem(e, n, i);
    const ids = sel.includes(n.id) && !e.ctrlKey && !e.shiftKey ? sel : [n.id];
    const ni = nodeIcon(n);
    armDrag(e, ids, { label: displayName(n) + (ids.length > 1 ? ` (+${ids.length - 1})` : ''), icon: ni.icon });
  };

  const openItem = (n: fs.FSNode) => {
    if (inBin) return openApp('properties', { id: n.id });
    if (n.type === 'dir') navigate(n.id);
    else openNode(n);
  };

  const itemMenu = (n: fs.FSNode) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ids = sel.includes(n.id) ? sel : [n.id];
    if (!sel.includes(n.id)) setSel([n.id]);
    if (inBin)
      return openMenu(e, [
        { label: 'Restore', bold: true, onClick: () => restoreSel(ids) },
        { sep: true },
        { label: 'Cut', onClick: () => cut(ids) },
        { label: 'Delete', onClick: () => askDelete(ids, true) },
        { sep: true },
        { label: 'Properties', onClick: () => openApp('properties', { id: n.id }) },
      ]);
    const items: MenuItem[] = [
      { label: n.type === 'dir' ? 'Open' : 'Open', bold: true, onClick: () => ids.forEach((id) => { const x = fs.get(id); if (x) (x.type === 'dir' && ids.length === 1 ? navigate(x.id) : openNode(x)); }) },
      ...(n.type === 'dir' ? [
        { label: 'Open in New Window', onClick: () => openApp('explorer', { path: n.id }) },
        { label: 'Open Terminal Here', icon: 'terminal', onClick: () => launchApp('terminal', { cwd: n.id }) },
      ] : [{ label: 'Open With', items: [
        { label: 'Notepad', icon: 'notepad', onClick: () => openNode(n, { with: 'notepad' }) },
        { label: 'StarPaint', icon: 'paint', onClick: () => openNode(n, { with: 'paint' }) },
        { label: 'StarAmp', icon: 'media', onClick: () => openNode(n, { with: 'media' }) },
        { label: 'StarNet Explorer', icon: 'browser', onClick: () => openApp('browser', { url: 'file:' + fs.pathOf(n.id) }) },
        { label: 'Picture Viewer', icon: 'image', onClick: () => openApp('imageviewer', { fileId: n.id }) },
      ] }]),
      ...(results ? [{ label: 'Open Containing Folder', onClick: () => n.parent && navigate(n.parent) }] : []),
      { sep: true },
      { label: 'Send To', items: [
        { label: 'Desktop (create shortcut)', icon: 'monitor', onClick: () => ids.forEach((id) => { const x = fs.get(id)!; try { fs.create(desktopDir().id, fs.uniqueName(desktopDir().id, displayName(x).replace(/\.[^.]+$/, '') + '.lnk'), 'file', '', { meta: x.meta?.app && fs.ext(x.name) === 'exe' ? { app: x.meta.app } : { target: fs.pathOf(x.id) } }); } catch (err) { errorBox((err as Error).message); } }) },
        { label: 'My Documents', icon: 'documents', onClick: () => ids.forEach((id) => { try { fs.copy(id, documentsDir().id); } catch (err) { errorBox((err as Error).message); } }) },
        { label: 'Recycle Bin', icon: 'recycle', onClick: () => deleteNodes(ids) },
      ] },
      { sep: true },
      { label: 'Cut', shortcut: 'Ctrl+X', onClick: () => cut(ids) },
      { label: 'Copy', shortcut: 'Ctrl+C', onClick: () => copy(ids) },
      ...(n.type === 'dir' ? [{ label: 'Paste', disabled: !clip.ids.length, onClick: () => paste(n.id) }] : []),
      { sep: true },
      { label: 'Create Shortcut', onClick: () => { try { const x = n; fs.create(x.parent!, fs.uniqueName(x.parent!, 'Shortcut to ' + displayName(x).replace(/\.[^.]+$/, '') + '.lnk'), 'file', '', { meta: x.meta?.app && fs.ext(x.name) === 'exe' ? { app: x.meta.app } : { target: fs.pathOf(x.id) } }); } catch (err) { errorBox((err as Error).message); } } },
      { label: 'Delete', shortcut: 'Del', onClick: () => askDelete(ids) },
      { label: 'Rename', shortcut: 'F2', disabled: ids.length > 1, onClick: () => setRenaming(n.id) },
      ...(n.content.startsWith('data:image') ? [{ label: 'Set as Desktop Background', icon: 'palette', onClick: () => setSettings({ wallpaper: { kind: 'image', value: n.content, fit: 'cover' } }) }] : []),
      { sep: true },
      { label: 'Properties', onClick: () => openApp('properties', { id: n.id }) },
    ];
    openMenu(e, items);
  };

  const bgMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (cur === MYCOMP) return;
    setSel([]);
    if (inBin)
      return openMenu(e, [
        { label: 'Empty Recycle Bin', disabled: !items.length, onClick: emptyBin },
        { label: 'Restore All', disabled: !items.length, onClick: () => restoreSel(items.map((i) => i.id)) },
        { sep: true },
        { label: 'Refresh', onClick: () => fs.fsStore.set((s) => ({ version: s.version + 1 })) },
      ]);
    openMenu(e, [
      { label: 'View', items: (['icons', 'tiles', 'list', 'details'] as View[]).map((v) => ({ label: v[0].toUpperCase() + v.slice(1), checked: view === v, onClick: () => setSettings({ explorerView: v }) })) },
      { label: 'Arrange Icons By', items: (['name', 'size', 'type', 'date'] as const).map((b) => ({ label: b === 'date' ? 'Modified' : b[0].toUpperCase() + b.slice(1), checked: sort.by === b, onClick: () => setSort({ by: b, asc: true }) })) },
      { label: 'Refresh', shortcut: 'F5', onClick: () => fs.fsStore.set((s) => ({ version: s.version + 1 })) },
      { sep: true },
      { label: 'Paste', shortcut: 'Ctrl+V', disabled: !clip.ids.length, onClick: () => paste() },
      { label: 'Open Terminal Here', icon: 'terminal', onClick: () => launchApp('terminal', { cwd: cur }) },
      { label: 'Import Files from Computer...', icon: 'documents', onClick: () => pickAndImport(cur) },
      { sep: true },
      { label: 'New', items: [
        { label: 'Folder', icon: 'folder', onClick: () => newItem('dir') },
        { sep: true },
        { label: 'Text Document', icon: 'text', onClick: () => newItem('txt') },
        { label: 'Bitmap Image', icon: 'image', onClick: () => newItem('kpx') },
      ] },
      { sep: true },
      { label: 'Properties', onClick: () => openApp('properties', { id: cur }) },
    ]);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (renaming || (e.target as HTMLElement).tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (e.key === 'Delete') askDelete(sel, e.shiftKey);
    else if (e.key === 'F2' && sel.length === 1 && !inBin) setRenaming(sel[0]);
    else if (e.key === 'Enter') (e.preventDefault(), selNodes.forEach((n) => openItem(n)));
    else if (e.key === 'Backspace') goUp();
    else if (e.key === 'F5') (e.preventDefault(), fs.fsStore.set((s) => ({ version: s.version + 1 })));
    else if (e.ctrlKey && k === 'a') (e.preventDefault(), setSel(items.map((i) => i.id)));
    else if (e.ctrlKey && k === 'c') copy();
    else if (e.ctrlKey && k === 'x') cut();
    else if (e.ctrlKey && k === 'v') paste();
    else if (e.altKey && e.key === 'ArrowLeft') goBack();
    else if (e.altKey && e.key === 'ArrowRight') goFwd();
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = items.findIndex((x) => x.id === sel[sel.length - 1]);
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const ni = Math.max(0, Math.min(items.length - 1, i < 0 ? 0 : i + step));
      if (items[ni]) setSel([items[ni].id]);
      setAnchor(ni);
    }
  };

  const goAddress = () => {
    const t = addr.trim();
    if (/^my computer$/i.test(t)) return navigate(MYCOMP);
    if (/^recycle bin$/i.test(t)) return navigate(fs.RECYCLER);
    if (/^(https?:|www\.|koal:)/i.test(t)) return void launchApp('browser', { url: t });
    const n = fs.resolve(t, target ?? fs.ROOT);
    if (!n) {
      errorBox(`KOAL-99 cannot find '${t}'. Check the spelling and try again.`, locName(cur));
      setAddr(addrOf(cur));
      return;
    }
    if (n.type === 'dir') navigate(n.id);
    else openNode(n);
  };

  const totalSel = selNodes.reduce((s, n) => s + fs.size(n.id), 0);
  const binCount = fs.children(fs.RECYCLER, { hidden: true }).length;

  const menus: { label: string; items: MenuItem[] }[] = [
    { label: 'File', items: [
      { label: 'New', disabled: !target || inBin, items: [
        { label: 'Folder', icon: 'folder', onClick: () => newItem('dir') },
        { label: 'Text Document', icon: 'text', onClick: () => newItem('txt') },
        { label: 'Bitmap Image', icon: 'image', onClick: () => newItem('kpx') },
      ] },
      { sep: true },
      { label: 'Delete', disabled: !sel.length, onClick: () => askDelete(sel) },
      { label: 'Rename', disabled: sel.length !== 1 || inBin, onClick: () => setRenaming(sel[0]) },
      { label: 'Properties', onClick: () => openApp('properties', { id: sel[0] ?? (target || fs.ROOT) }) },
      { sep: true },
      { label: 'Close', onClick: () => win.close() },
    ] },
    { label: 'Edit', items: [
      { label: 'Cut', shortcut: 'Ctrl+X', disabled: !sel.length, onClick: () => cut() },
      { label: 'Copy', shortcut: 'Ctrl+C', disabled: !sel.length, onClick: () => copy() },
      { label: 'Paste', shortcut: 'Ctrl+V', disabled: !clip.ids.length || !target, onClick: () => paste() },
      { sep: true },
      { label: 'Select All', shortcut: 'Ctrl+A', onClick: () => setSel(items.map((i) => i.id)) },
      { label: 'Invert Selection', onClick: () => setSel(items.filter((i) => !sel.includes(i.id)).map((i) => i.id)) },
    ] },
    { label: 'View', items: [
      ...(['icons', 'tiles', 'list', 'details'] as View[]).map((v) => ({ label: v[0].toUpperCase() + v.slice(1), checked: view === v, onClick: () => setSettings({ explorerView: v }) })),
      { sep: true },
      { label: 'Explorer Bar', items: [
        { label: 'Tasks', checked: pane === 'tasks', onClick: () => setPane('tasks') },
        { label: 'Folders', checked: pane === 'folders', onClick: () => setPane('folders') },
        { label: 'Search', checked: pane === 'search', onClick: () => setPane('search') },
      ] },
      { label: 'Show Hidden Files', checked: settings.showHidden, onClick: () => setSettings({ showHidden: !settings.showHidden }) },
      { label: 'Show File Extensions', checked: settings.showExtensions, onClick: () => setSettings({ showExtensions: !settings.showExtensions }) },
      { sep: true },
      { label: 'Refresh', shortcut: 'F5', onClick: () => fs.fsStore.set((s) => ({ version: s.version + 1 })) },
    ] },
    { label: 'Go', items: [
      { label: 'Back', disabled: !back.length, onClick: goBack },
      { label: 'Forward', disabled: !fwd.length, onClick: goFwd },
      { label: 'Up One Level', onClick: goUp },
      { sep: true },
      { label: 'Home Folder', onClick: () => navigate(homeDir().id) },
      { label: 'My Documents', onClick: () => navigate(documentsDir().id) },
      { label: 'Desktop', onClick: () => navigate(desktopDir().id) },
      { label: 'My Computer', onClick: () => navigate(MYCOMP) },
      { label: 'Recycle Bin', onClick: () => navigate(fs.RECYCLER) },
    ] },
    { label: 'Help', items: [{ label: 'About File Explorer', onClick: () => alertBox('KOAL File Explorer 6.0\n(c) 1999-2004 KOAL Systems Inc.\n\nTip: drag files between windows and onto the desktop. Hold Ctrl while dropping to copy.', 'About File Explorer', 'logo') }] },
  ];

  const renderName = (n: fs.FSNode) =>
    renaming === n.id ? (
      <input
        className="ex-rename"
        autoFocus
        defaultValue={fs.ext(n.name) === 'lnk' ? displayName(n) : n.name}
        onFocus={(e) => {
          const v = e.currentTarget.value;
          const dot = v.lastIndexOf('.');
          e.currentTarget.setSelectionRange(0, n.type === 'file' && dot > 0 ? dot : v.length);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commitRename(n.id, e.currentTarget.value);
          if (e.key === 'Escape') setRenaming(null);
        }}
        onBlur={(e) => commitRename(n.id, e.currentTarget.value)}
      />
    ) : (
      <span className="ex-name">{inBin ? n.meta?.origName ?? n.name : displayName(n, settings.showExtensions)}</span>
    );

  const myComputer = (
    <div className="ex-mycomp">
      <div className="ex-group">Files Stored on This Computer</div>
      <div className="ex-tiles">
        <div className="ex-tile" onDoubleClick={() => navigate(fs.resolve('C:\\Users\\Shared')!.id)}><Icon name="folder" /><div><b>Shared Documents</b><small>File Folder</small></div></div>
        <div className="ex-tile" onDoubleClick={() => navigate(documentsDir().id)}><Icon name="documents" /><div><b>{homeDir().name}'s Documents</b><small>File Folder</small></div></div>
      </div>
      <div className="ex-group">Hard Disk Drives</div>
      <div className="ex-tiles">
        <div className="ex-tile" onDoubleClick={() => navigate(fs.ROOT)} onContextMenu={(e) => openMenu(e, [{ label: 'Open', bold: true, onClick: () => navigate(fs.ROOT) }, { label: 'Open Terminal Here', onClick: () => launchApp('terminal', { cwd: fs.ROOT }) }, { sep: true }, { label: 'Properties', onClick: () => openApp('properties', { id: fs.ROOT }) }])}>
          <Icon name="drive" />
          <div>
            <b>Local Disk (C:)</b>
            <div className="ex-bar"><div style={{ width: Math.max(2, (fs.totalBytes() / (40 * 1024 ** 3)) * 100 + 18) + '%' }} /></div>
            <small>{(40 - 7.3 - fs.totalBytes() / 1024 ** 3).toFixed(1)} GB free of 40.0 GB</small>
          </div>
        </div>
      </div>
      <div className="ex-group">Devices with Removable Storage</div>
      <div className="ex-tiles">
        <div className="ex-tile" onDoubleClick={() => { play('error'); errorBox('A:\\ is not accessible.\n\nThe device is not ready.', 'Removable Disk (A:)'); }}><Icon name="floppy" /><div><b>3{'\u00BD'} Floppy (A:)</b><small>No disk</small></div></div>
        <div className="ex-tile" onDoubleClick={() => errorBox('Please insert a disc into drive D:.\n\n(The last disc anyone put in was "KOAL-99 SP4 RECOVERY". It was never returned.)', 'CD Drive (D:)')}><Icon name="cdrom" /><div><b>CD Drive (D:)</b><small>No disc</small></div></div>
      </div>
      <div className="ex-group">Other</div>
      <div className="ex-tiles">
        <div className="ex-tile" onDoubleClick={() => navigate(fs.RECYCLER)}><Icon name={binCount ? 'recyclefull' : 'recycle'} /><div><b>Recycle Bin</b><small>{binCount} item(s)</small></div></div>
        <div className="ex-tile" onDoubleClick={() => launchApp('control')}><Icon name="control" /><div><b>Control Panel</b><small>System Folder</small></div></div>
      </div>
    </div>
  );

  const header = (label: string, by: typeof sort.by, w: number | string) => (
    <div style={{ width: w }} onClick={() => setSort({ by, asc: sort.by === by ? !sort.asc : true })}>
      {label} {sort.by === by ? (sort.asc ? '\u25B2' : '\u25BC') : ''}
    </div>
  );

  return (
    <div className="ex" onKeyDown={onKey}>
      <MenuBar menus={menus} />
      <div className="k-toolbar">
        <button className="k-tool" disabled={!back.length} onClick={goBack}><span className="ex-arrow back">{'\u25C0'}</span> Back</button>
        <button className="k-tool" disabled={!fwd.length} onClick={goFwd}><span className="ex-arrow">{'\u25B6'}</span></button>
        <button className="k-tool" disabled={cur === MYCOMP && !results} onClick={goUp} title="Up"><Icon name="folder" size={16} />{'\u2191'}</button>
        <div className="k-tool-sep" />
        <button className={`k-tool ${pane === 'search' ? 'on' : ''}`} onClick={() => setPane(pane === 'search' ? 'tasks' : 'search')}><Icon name="search" size={16} /> Search</button>
        <button className={`k-tool ${pane === 'folders' ? 'on' : ''}`} onClick={() => setPane(pane === 'folders' ? 'tasks' : 'folders')}><Icon name="folderopen" size={16} /> Folders</button>
        <div className="k-tool-sep" />
        <button className="k-tool" disabled={!target || inBin} onClick={() => newItem('dir')} title="New Folder"><Icon name="folder" size={16} /> New</button>
        <button className="k-tool" disabled={!sel.length} onClick={() => cut()} title="Cut">{'\u2702'}</button>
        <button className="k-tool" disabled={!sel.length} onClick={() => copy()} title="Copy">{'\u2750'}</button>
        <button className="k-tool" disabled={!clip.ids.length || !target || inBin} onClick={() => paste()} title="Paste">{'\u{1F4CB}'}</button>
        <button className="k-tool" disabled={!sel.length} onClick={() => askDelete(sel)} title="Delete" style={{ color: '#c00', fontWeight: 'bold' }}>{'\u2715'}</button>
        <div className="k-tool-sep" />
        <select className="k-input" value={view} onChange={(e) => setSettings({ explorerView: e.target.value as View })} title="Views">
          <option value="icons">Icons</option>
          <option value="tiles">Tiles</option>
          <option value="list">List</option>
          <option value="details">Details</option>
        </select>
      </div>
      <div className="ex-addr">
        <span style={{ color: '#666' }}>Address</span>
        <div className="ex-addr-box">
          <Icon name={results ? 'search' : locIcon(cur)} size={16} />
          <input value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && goAddress()} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <button className="k-tool" onClick={goAddress}><span style={{ color: '#2a9a2a', fontWeight: 'bold' }}>{'\u279C'}</span> Go</button>
      </div>
      <div className="ex-main">
        <div className="ex-side">
          {pane === 'tasks' && (
            <>
              {inBin ? (
                <div className="ex-box">
                  <div className="ex-box-h">Recycle Bin Tasks</div>
                  <div className="ex-box-b">
                    <div className="ex-task" onClick={emptyBin}><Icon name="recycle" size={16} /> Empty the Recycle Bin</div>
                    <div className="ex-task" onClick={() => restoreSel(sel.length ? sel : items.map((i) => i.id))}><Icon name="recyclefull" size={16} /> {sel.length ? 'Restore the selected items' : 'Restore all items'}</div>
                  </div>
                </div>
              ) : cur === MYCOMP ? (
                <div className="ex-box">
                  <div className="ex-box-h">System Tasks</div>
                  <div className="ex-box-b">
                    <div className="ex-task" onClick={() => launchApp('sysprops')}><Icon name="monitor" size={16} /> View system information</div>
                    <div className="ex-task" onClick={() => launchApp('control')}><Icon name="control" size={16} /> Change a setting</div>
                    <div className="ex-task" onClick={() => setPane('search')}><Icon name="search" size={16} /> Search for files</div>
                  </div>
                </div>
              ) : (
                <div className="ex-box">
                  <div className="ex-box-h">File and Folder Tasks</div>
                  <div className="ex-box-b">
                    {!sel.length && <div className="ex-task" onClick={() => newItem('dir')}><Icon name="folder" size={16} /> Make a new folder</div>}
                    {!sel.length && <div className="ex-task" onClick={() => newItem('txt')}><Icon name="text" size={16} /> Make a new text file</div>}
                    {sel.length === 1 && <div className="ex-task" onClick={() => setRenaming(sel[0])}><Icon name="text" size={16} /> Rename this {selNodes[0]?.type === 'dir' ? 'folder' : 'file'}</div>}
                    {sel.length > 0 && <div className="ex-task" onClick={() => cut()}><Icon name="exe" size={16} /> Move the selected items</div>}
                    {sel.length > 0 && <div className="ex-task" onClick={() => copy()}><Icon name="documents" size={16} /> Copy the selected items</div>}
                    {clip.ids.length > 0 && <div className="ex-task" onClick={() => paste()}><Icon name="folderopen" size={16} /> Paste {clip.ids.length} item(s) here</div>}
                    {sel.length > 0 && <div className="ex-task" onClick={() => askDelete(sel)}><Icon name="error" size={16} /> Delete the selected items</div>}
                    <div className="ex-task" onClick={() => launchApp('terminal', { cwd: cur })}><Icon name="terminal" size={16} /> Open Terminal here</div>
                  </div>
                </div>
              )}
              <div className="ex-box">
                <div className="ex-box-h">Other Places</div>
                <div className="ex-box-b">
                  {cur !== MYCOMP && <div className="ex-task" onClick={() => navigate(MYCOMP)}><Icon name="computer" size={16} /> My Computer</div>}
                  <div className="ex-task" onClick={() => navigate(desktopDir().id)}><Icon name="monitor" size={16} /> Desktop</div>
                  <div className="ex-task" onClick={() => navigate(documentsDir().id)}><Icon name="documents" size={16} /> My Documents</div>
                  <div className="ex-task" onClick={() => navigate(fs.resolve(homePath() + '\\My Pictures')?.id ?? fs.ROOT)}><Icon name="pictures" size={16} /> My Pictures</div>
                  {!inBin && <div className="ex-task" onClick={() => navigate(fs.RECYCLER)}><Icon name={binCount ? 'recyclefull' : 'recycle'} size={16} /> Recycle Bin</div>}
                </div>
              </div>
              <div className="ex-box">
                <div className="ex-box-h">Details</div>
                <div className="ex-box-b ex-details">
                  {selNodes.length === 1 ? (
                    <>
                      <b>{inBin ? selNodes[0].meta?.origName : displayName(selNodes[0])}</b>
                      <div>{typeName(selNodes[0])}</div>
                      {selNodes[0].type === 'file' && <div>Size: {humanSize(fs.size(selNodes[0].id))}</div>}
                      <div>Modified: {new Date(selNodes[0].modified).toLocaleString()}</div>
                      {inBin && <div>From: {selNodes[0].meta?.origPath}</div>}
                    </>
                  ) : selNodes.length > 1 ? (
                    <div>{selNodes.length} items selected.<br />Total size: {humanSize(totalSel)}</div>
                  ) : (
                    <>
                      <b>{locName(cur)}</b>
                      <div>{cur === MYCOMP ? 'System Folder' : 'File Folder'}</div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
          {pane === 'search' && (
            <div className="ex-search">
              <div className="ex-search-dog"><Icon name="logo" size={48} /><div className="bubble">What do you want to search for?</div></div>
              <label>All or part of the file name:</label>
              <input className="k-input" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} placeholder="e.g. *.txt or memo" />
              <label className="k-check"><input type="checkbox" checked={searchContent} onChange={(e) => setSearchContent(e.target.checked)} /> Also search inside files</label>
              <label>Look in:</label>
              <select className="k-input" value={searchIn} onChange={(e) => setSearchIn(e.target.value)}>
                <option value={fs.ROOT}>Local Disk (C:)</option>
                <option value={homeDir().id}>My home folder</option>
                <option value={documentsDir().id}>My Documents</option>
                {target && target !== fs.ROOT && <option value={target}>{locName(target)} (current)</option>}
              </select>
              <div className="k-row" style={{ marginTop: 6 }}>
                <button className="k-btn" onClick={doSearch}>Search</button>
                {results && <button className="k-btn" onClick={() => setResults(null)}>Back</button>}
              </div>
              {results && <div style={{ marginTop: 8 }}>Found {results.length} item(s).</div>}
            </div>
          )}
          {pane === 'folders' && (
            <div className="ex-tree">
              <TreeNode id={MYCOMP} cur={cur} onPick={navigate} depth={0} showHidden={settings.showHidden} />
            </div>
          )}
        </div>
        <div className="ex-body" ref={bodyRef} tabIndex={0} data-drop={target && !inBin && !results ? 'dir:' + target : inBin ? 'recycle' : undefined} onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('ex-items')) setSel([]); }} onContextMenu={bgMenu} onDragOver={(e) => target && !inBin && e.dataTransfer.types.includes('Files') && e.preventDefault()} onDrop={(e) => { if (!target || inBin || !e.dataTransfer.files.length) return; e.preventDefault(); importFileList([...e.dataTransfer.files], target); }}>
          {cur === MYCOMP && !results ? myComputer : (
            <>
              {view === 'details' && (
                <div className="ex-dhead">
                  {header('Name', 'name', '40%')}
                  {inBin ? <div style={{ width: '30%' }}>Original Location</div> : results ? <div style={{ width: '30%' }}>In Folder</div> : header('Size', 'size', '15%')}
                  {header('Type', 'type', '20%')}
                  {header(inBin ? 'Date Deleted' : 'Date Modified', 'date', '25%')}
                </div>
              )}
              <div className={`ex-items v-${view}`}>
                {items.map((n, i) => {
                  const ni = nodeIcon(n);
                  const isSel = sel.includes(n.id);
                  const drop = n.type === 'dir' && !inBin ? 'dir:' + n.id : undefined;
                  const cls = `ex-item ${isSel ? 'sel' : ''} ${drop && dragOver === drop ? 'drop-over' : ''} ${clip.mode === 'cut' && clip.ids.includes(n.id) ? 'cut' : ''} ${n.hidden ? 'hid' : ''}`;
                  const big = view === 'icons' || view === 'tiles';
                  return (
                    <div key={n.id} className={cls} data-drop={drop} onPointerDown={onItemDown(n, i)} onDoubleClick={() => openItem(n)} onContextMenu={itemMenu(n)} title={view === 'icons' ? `${typeName(n)}\n${n.type === 'file' ? 'Size: ' + humanSize(fs.size(n.id)) : ''}` : undefined}>
                      <Icon name={ni.icon} size={big ? (view === 'tiles' ? 48 : 32) : 16} shortcut={ni.shortcut} />
                      {view === 'details' ? (
                        <>
                          <div style={{ width: 'calc(40% - 20px)' }}>{renderName(n)}</div>
                          {inBin ? <div style={{ width: '30%' }}>{n.meta?.origPath}</div> : results ? <div style={{ width: '30%' }}>{n.parent ? fs.pathOf(n.parent) : ''}</div> : <div style={{ width: '15%', textAlign: 'right', paddingRight: 10 }}>{n.type === 'file' ? humanSize(fs.size(n.id)) : ''}</div>}
                          <div style={{ width: '20%' }}>{typeName(n)}</div>
                          <div style={{ width: '25%' }}>{new Date(inBin ? n.meta?.deletedAt ?? n.modified : n.modified).toLocaleString()}</div>
                        </>
                      ) : view === 'tiles' ? (
                        <div className="ex-tile-txt">
                          {renderName(n)}
                          <small>{typeName(n)}</small>
                          <small>{n.type === 'file' ? humanSize(fs.size(n.id)) : results ? fs.pathOf(n.parent!) : ''}</small>
                        </div>
                      ) : (
                        renderName(n)
                      )}
                    </div>
                  );
                })}
                {!items.length && <div className="ex-empty">{results ? 'Search is complete. There are no results to display.' : inBin ? 'The Recycle Bin is empty.' : 'This folder is empty.'}</div>}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="k-status">
        <div style={{ flex: 1 }}>{sel.length ? `${sel.length} object(s) selected` : cur === MYCOMP && !results ? '6 objects' : `${items.length} object(s)`}{sel.length && totalSel ? `    ${humanSize(totalSel)}` : ''}</div>
        <div style={{ width: 160 }}><Icon name="computer" size={16} />&nbsp;My Computer</div>
      </div>
    </div>
  );
}

function TreeNode({ id, cur, onPick, depth, showHidden }: { id: string; cur: string; onPick: (id: string) => void; depth: number; showHidden: boolean }) {
  const isAncestorOfCur = id === MYCOMP || (cur !== MYCOMP && fs.isAncestor(id, cur));
  const [open, setOpen] = useState(isAncestorOfCur || depth < 1);
  useEffect(() => {
    if (isAncestorOfCur) setOpen(true);
  }, [isAncestorOfCur]);
  const kids = id === MYCOMP ? [fs.get(fs.ROOT)!] : fs.children(id, { hidden: showHidden }).filter((k) => k.type === 'dir' && k.id !== fs.RECYCLER && (!k.meta?.adminOnly || isAdmin()));
  const hasKids = kids.length > 0;
  return (
    <div>
      <div className={`ex-tnode ${cur === id ? 'sel' : ''}`} style={{ paddingLeft: depth * 14 }} onClick={() => onPick(id)} data-drop={id !== MYCOMP ? 'dir:' + id : undefined}>
        <span className="ex-tog" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{hasKids ? (open ? '\u2212' : '+') : ''}</span>
        <Icon name={locIcon(id)} size={16} />
        <span>{locName(id)}</span>
      </div>
      {open && kids.map((k) => <TreeNode key={k.id} id={k.id} cur={cur} onPick={onPick} depth={depth + 1} showHidden={showHidden} />)}
    </div>
  );
}
