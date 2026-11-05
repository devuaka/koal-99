import { useState } from 'react';
import * as fs from '../core/fs';
import { Icon } from './Icon';
import { nodeIcon } from './nodeIcon';
import { documentsDir, desktopDir, homeDir } from '../core/session';
import { confirmBox, errorBox } from '../core/dialog';

export interface FileDialogProps {
  mode: 'open' | 'save';
  title?: string;
  exts?: string[]; // without dots; empty = all
  filterLabel?: string;
  defaultName?: string;
  startDir?: string;
  onDone: (result: { dirId: string; name: string; node?: fs.FSNode } | null) => void;
}

export function FileDialog({ mode, title, exts = [], filterLabel, defaultName = '', startDir, onDone }: FileDialogProps) {
  const [dir, setDir] = useState(startDir && fs.get(startDir)?.type === 'dir' ? startDir : documentsDir().id);
  const [name, setName] = useState(defaultName);
  const [sel, setSel] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  fs.fsStore.use((s) => s.version);
  const items = fs.children(dir).filter((n) => n.id !== fs.RECYCLER && (n.type === 'dir' || all || !exts.length || exts.includes(fs.ext(n.name))));

  const crumbs: fs.FSNode[] = [];
  let c = fs.get(dir);
  while (c) {
    crumbs.unshift(c);
    c = fs.get(c.parent);
  }

  const accept = async () => {
    if (mode === 'open') {
      const n = sel ? fs.get(sel) : name ? fs.resolve(name, dir) : undefined;
      if (!n) return errorBox(`${name || 'File'}\nFile not found.\nPlease verify the correct file name was given.`, title ?? 'Open');
      if (n.type === 'dir') return setDir(n.id), setSel(null);
      return onDone({ dirId: n.parent!, name: n.name, node: n });
    }
    let nm = name.trim();
    if (!nm) return;
    if (/[\\/]/.test(nm)) {
      const [p, base] = fs.resolveParent(nm, dir);
      if (!p) return errorBox('The folder does not exist.', title ?? 'Save As');
      return finishSave(p.id, base);
    }
    finishSave(dir, nm);
  };

  const finishSave = async (dirId: string, nm: string) => {
    if (exts.length && !fs.ext(nm)) nm += '.' + exts[0];
    const err = fs.validName(nm);
    if (err) return errorBox(err, title ?? 'Save As');
    const existing = fs.childByName(dirId, nm);
    if (existing) {
      if (existing.type === 'dir') return setDir(existing.id);
      if (!(await confirmBox(`${nm} already exists.\nDo you want to replace it?`, 'Confirm Save As', 'warning'))) return;
    }
    onDone({ dirId, name: nm, node: existing });
  };

  const places = [
    { label: 'Desktop', icon: 'monitor', id: desktopDir().id },
    { label: 'My Documents', icon: 'documents', id: documentsDir().id },
    { label: 'Home', icon: 'user', id: homeDir().id },
    { label: 'My Computer', icon: 'computer', id: fs.ROOT },
  ];

  return (
    <div className="modal-shade" onPointerDown={(e) => e.stopPropagation()}>
      <div className="modal" style={{ width: 520, height: 360 }}>
        <div className="mh">
          {title ?? (mode === 'open' ? 'Open' : 'Save As')}
          <button className="wb close" onClick={() => onDone(null)} style={{ width: 18, height: 18, color: '#fff' }}>x</button>
        </div>
        <div className="file-dlg" style={{ flex: 1, minHeight: 0 }}>
          <div className="k-row">
            <label>Look in:</label>
            <select className="k-input" style={{ flex: 1 }} value={dir} onChange={(e) => setDir(e.target.value)}>
              {crumbs.map((n, i) => (
                <option key={n.id} value={n.id}>{' '.repeat(i * 2) + (n.id === fs.ROOT ? 'Local Disk (C:)' : n.name)}</option>
              ))}
            </select>
            <button className="k-btn small" title="Up One Level" onClick={() => fs.get(dir)?.parent && setDir(fs.get(dir)!.parent!)}>{'↑'}</button>
            <button
              className="k-btn small"
              title="Create New Folder"
              onClick={() => {
                try {
                  const n = fs.create(dir, fs.uniqueName(dir, 'New Folder'), 'dir');
                  setSel(n.id);
                } catch (e) {
                  errorBox((e as Error).message);
                }
              }}
            >
              <Icon name="folder" size={16} />
            </button>
          </div>
          <div className="k-row" style={{ flex: 1, minHeight: 0, alignItems: 'stretch' }}>
            <div style={{ width: 86, background: '#7d9be0', display: 'flex', flexDirection: 'column', gap: 4, padding: 4, borderRadius: 2 }}>
              {places.map((p) => (
                <div key={p.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff', padding: 4, borderRadius: 3, background: dir === p.id ? 'rgba(255,255,255,.25)' : undefined, textAlign: 'center' }} onClick={() => setDir(p.id)}>
                  <Icon name={p.icon} />
                  {p.label}
                </div>
              ))}
            </div>
            <div className="fd-list" style={{ flex: 1 }}>
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`fd-item ${sel === n.id ? 'sel' : ''}`}
                  onClick={() => {
                    setSel(n.id);
                    if (n.type === 'file') setName(n.name);
                  }}
                  onDoubleClick={() => {
                    if (n.type === 'dir') {
                      setDir(n.id);
                      setSel(null);
                    } else if (mode === 'open') onDone({ dirId: n.parent!, name: n.name, node: n });
                    else finishSave(dir, n.name);
                  }}
                >
                  <Icon name={nodeIcon(n).icon} size={16} shortcut={nodeIcon(n).shortcut} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
                </div>
              ))}
              {!items.length && <div style={{ color: '#888', padding: 6 }}>(This folder is empty)</div>}
            </div>
          </div>
          <div className="k-row">
            <label>File name:</label>
            <input className="k-input" style={{ flex: 1 }} value={name} autoFocus={mode === 'save'} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && accept()} />
            <button className="k-btn default" onClick={accept}>{mode === 'open' ? 'Open' : 'Save'}</button>
          </div>
          <div className="k-row">
            <label>Files of type:</label>
            <select className="k-input" style={{ flex: 1 }} value={all ? 'all' : 'f'} onChange={(e) => setAll(e.target.value === 'all')}>
              <option value="f">{filterLabel ?? (exts.length ? exts.map((e) => '*.' + e).join(';') : 'All Files (*.*)')}</option>
              <option value="all">All Files (*.*)</option>
            </select>
            <button className="k-btn" onClick={() => onDone(null)}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
