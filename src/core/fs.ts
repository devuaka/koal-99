import { createStore, uid } from './store';
import { idbGet, idbSet } from './idb';

export type NodeType = 'dir' | 'file';

export interface NodeMeta {
  app?: string; // .exe / .lnk launching an app
  target?: string; // .lnk pointing at a path
  args?: Record<string, unknown>;
  icon?: string;
  origParent?: string;
  origPath?: string;
  origName?: string;
  deletedAt?: number;
  corrupt?: boolean;
  adminOnly?: boolean;
}

export interface FSNode {
  id: string;
  name: string;
  type: NodeType;
  parent: string | null;
  content: string;
  created: number;
  modified: number;
  hidden?: boolean;
  system?: boolean;
  readonly?: boolean;
  meta?: NodeMeta;
}

export class FSError extends Error {}

export const ROOT = 'root';
export const RECYCLER = 'recycler';
const SCHEMA = 4;

interface FSState {
  nodes: Record<string, FSNode>;
  version: number;
  ready: boolean;
}

export const fsStore = createStore<FSState>({ nodes: {}, version: 0, ready: false });

let isAdmin: () => boolean = () => false;
export function setAdminCheck(fn: () => boolean) {
  isAdmin = fn;
}
let homeResolver: () => string = () => 'C:\\';
export function setHomeResolver(fn: () => string) {
  homeResolver = fn;
}

// ---------- index ----------
let childIndex: Map<string, string[]> | null = null;
let indexVersion = -1;
function index(): Map<string, string[]> {
  const st = fsStore.get();
  if (childIndex && indexVersion === st.version) return childIndex;
  const m = new Map<string, string[]>();
  for (const n of Object.values(st.nodes)) {
    if (n.parent == null) continue;
    let arr = m.get(n.parent);
    if (!arr) m.set(n.parent, (arr = []));
    arr.push(n.id);
  }
  childIndex = m;
  indexVersion = st.version;
  return m;
}

export function get(id: string | null | undefined): FSNode | undefined {
  if (!id) return undefined;
  return fsStore.get().nodes[id];
}

export function children(id: string, opts: { hidden?: boolean } = {}): FSNode[] {
  const ids = index().get(id) ?? [];
  const nodes = fsStore.get().nodes;
  return ids
    .map((i) => nodes[i])
    .filter((n) => n && (opts.hidden || !n.hidden) && (!n.meta?.adminOnly || isAdmin() || opts.hidden))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) : a.type === 'dir' ? -1 : 1));
}

export function childByName(parentId: string, name: string): FSNode | undefined {
  const ids = index().get(parentId) ?? [];
  const nodes = fsStore.get().nodes;
  const lower = name.toLowerCase();
  for (const i of ids) if (nodes[i]?.name.toLowerCase() === lower) return nodes[i];
  return undefined;
}

export function pathOf(id: string): string {
  const parts: string[] = [];
  let n = get(id);
  while (n && n.parent != null) {
    parts.unshift(n.name);
    n = get(n.parent);
  }
  return 'C:\\' + parts.join('\\');
}

export function isAncestor(ancestorId: string, id: string): boolean {
  let n = get(id);
  while (n) {
    if (n.id === ancestorId) return true;
    n = get(n.parent);
  }
  return false;
}

export function inRecycler(id: string): boolean {
  const n = get(id);
  return !!n && n.id !== RECYCLER && isAncestor(RECYCLER, id);
}

/** Resolve a DOS/unix style path. cwd is a node id. */
export function resolve(path: string, cwd: string = ROOT): FSNode | undefined {
  let p = path.trim().replace(/^"|"$/g, '');
  if (!p) return get(cwd);
  let cur: FSNode | undefined;
  if (/^~/.test(p)) {
    cur = resolve(homeResolver());
    p = p.slice(1);
  } else if (/^%userprofile%/i.test(p)) {
    cur = resolve(homeResolver());
    p = p.slice('%userprofile%'.length);
  } else if (/^[a-z]:/i.test(p)) {
    if (p[0].toLowerCase() !== 'c') return undefined;
    cur = get(ROOT);
    p = p.slice(2);
  } else if (/^[\\/]/.test(p)) {
    cur = get(ROOT);
  } else {
    cur = get(cwd);
  }
  for (const seg of p.split(/[\\/]+/)) {
    if (!cur) return undefined;
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      cur = cur.parent ? get(cur.parent) : cur;
      continue;
    }
    if (cur.type !== 'dir') return undefined;
    cur = childByName(cur.id, seg);
  }
  return cur;
}

/** Split "a\b\c.txt" into [parentNode, "c.txt"]. */
export function resolveParent(path: string, cwd: string): [FSNode | undefined, string] {
  const p = path.trim().replace(/^"|"$/g, '').replace(/[\\/]+$/, '');
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  if (i < 0) {
    if (/^[a-z]:$/i.test(p)) return [undefined, ''];
    return [get(cwd), p];
  }
  const dir = p.slice(0, i) || (p[0] === '/' || p[0] === '\\' ? '\\' : '');
  const dirPath = /^[a-z]:$/i.test(dir) ? dir + '\\' : dir;
  return [resolve(dirPath, cwd), p.slice(i + 1)];
}

// ---------- validation ----------
const BAD = /[\\/:*?"<>|]/;
export function validName(name: string): string | null {
  if (!name || !name.trim()) return 'A file name cannot be blank.';
  if (BAD.test(name)) return 'A file name cannot contain any of the following characters: \\ / : * ? " < > |';
  if (name.length > 128) return 'The file name is too long.';
  if (/^\.+$/.test(name)) return 'That name is reserved by the system.';
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(name)) return 'That name is reserved by the system. (It has been since 1981. Nobody remembers why.)';
  return null;
}

export function uniqueName(parentId: string, base: string): string {
  if (!childByName(parentId, base)) return base;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  for (let i = 2; i < 999; i++) {
    const cand = `${stem} (${i})${ext}`;
    if (!childByName(parentId, cand)) return cand;
  }
  return stem + ' ' + uid('') + ext;
}

function guard(n: FSNode, action: string) {
  if ((n.system || n.readonly) && !isAdmin()) throw new FSError(`Access is denied. "${n.name}" is a protected system item and cannot be ${action}.`);
}

// ---------- mutations ----------
function commit(mut: (nodes: Record<string, FSNode>) => void) {
  const st = fsStore.get();
  const nodes = { ...st.nodes };
  mut(nodes);
  fsStore.set({ nodes, version: st.version + 1 });
  scheduleSave();
}

export function create(parentId: string, name: string, type: NodeType, content = '', extra: Partial<FSNode> = {}): FSNode {
  const parent = get(parentId);
  if (!parent || parent.type !== 'dir') throw new FSError('The system cannot find the path specified.');
  const err = validName(name);
  if (err) throw new FSError(err);
  if (childByName(parentId, name)) throw new FSError(`A file or folder named "${name}" already exists.`);
  if (parent.readonly && !isAdmin()) throw new FSError('Access is denied. This folder is read-only.');
  const now = Date.now();
  const node: FSNode = { id: uid(), name, type, parent: parentId, content: type === 'file' ? content : '', created: now, modified: now, ...extra };
  commit((nodes) => {
    nodes[node.id] = node;
  });
  return node;
}

export function mkdirp(path: string): FSNode {
  const parts = path.replace(/^c:/i, '').split(/[\\/]+/).filter(Boolean);
  let cur = get(ROOT)!;
  for (const part of parts) {
    const next = childByName(cur.id, part);
    if (next) {
      if (next.type !== 'dir') throw new FSError(`"${part}" is a file, not a folder.`);
      cur = next;
    } else cur = create(cur.id, part, 'dir');
  }
  return cur;
}

export function write(id: string, content: string) {
  const n = get(id);
  if (!n) throw new FSError('The file no longer exists.');
  if (n.type !== 'file') throw new FSError('Cannot write to a folder.');
  if (n.readonly && !isAdmin()) throw new FSError(`"${n.name}" is read-only.`);
  commit((nodes) => {
    nodes[id] = { ...n, content, modified: Date.now() };
  });
}

/** Write to a path, creating the file if needed. */
export function writePath(path: string, content: string, cwd = ROOT): FSNode {
  const existing = resolve(path, cwd);
  if (existing) {
    write(existing.id, content);
    return get(existing.id)!;
  }
  const [parent, name] = resolveParent(path, cwd);
  if (!parent) throw new FSError('The system cannot find the path specified.');
  return create(parent.id, name, 'file', content);
}

export function update(id: string, patch: Partial<FSNode>) {
  const n = get(id);
  if (!n) return;
  commit((nodes) => {
    nodes[id] = { ...n, ...patch };
  });
}

export function rename(id: string, newName: string) {
  const n = get(id);
  if (!n) throw new FSError('The file no longer exists.');
  if (n.name === newName) return;
  guard(n, 'renamed');
  const err = validName(newName);
  if (err) throw new FSError(err);
  const clash = n.parent ? childByName(n.parent, newName) : undefined;
  if (clash && clash.id !== id) throw new FSError(`A file or folder named "${newName}" already exists.`);
  commit((nodes) => {
    nodes[id] = { ...n, name: newName, modified: Date.now() };
  });
}

export function move(id: string, newParentId: string, newName?: string): FSNode {
  const n = get(id);
  const dest = get(newParentId);
  if (!n || !dest) throw new FSError('The system cannot find the path specified.');
  if (dest.type !== 'dir') throw new FSError('The destination is not a folder.');
  if (n.parent === newParentId && !newName) return n;
  guard(n, 'moved');
  if (isAncestor(id, newParentId)) throw new FSError('Cannot move a folder into itself. That way lies madness.');
  const name = newName ?? n.name;
  const clash = childByName(newParentId, name);
  if (clash && clash.id !== id) throw new FSError(`A file or folder named "${name}" already exists in the destination.`);
  commit((nodes) => {
    nodes[id] = { ...n, parent: newParentId, name, modified: Date.now() };
  });
  return get(id)!;
}

export function copy(id: string, newParentId: string, newName?: string): FSNode {
  const src = get(id);
  const dest = get(newParentId);
  if (!src || !dest) throw new FSError('The system cannot find the path specified.');
  if (dest.type !== 'dir') throw new FSError('The destination is not a folder.');
  if (isAncestor(id, newParentId)) throw new FSError('Cannot copy a folder into itself.');
  let name = newName ?? src.name;
  if (childByName(newParentId, name)) {
    name = newName ? uniqueName(newParentId, name) : src.parent === newParentId ? uniqueName(newParentId, 'Copy of ' + src.name) : uniqueName(newParentId, src.name);
  }
  const all = fsStore.get().nodes;
  const now = Date.now();
  const rootCopy: FSNode = { ...src, id: uid(), parent: newParentId, name, created: now, modified: now, system: false, meta: src.meta ? { ...src.meta } : undefined };
  commit((nodes) => {
    nodes[rootCopy.id] = rootCopy;
    const walk = (oldId: string, newId: string) => {
      for (const c of Object.values(all)) {
        if (c.parent !== oldId) continue;
        const cc: FSNode = { ...c, id: uid(), parent: newId, created: now, system: false };
        nodes[cc.id] = cc;
        if (c.type === 'dir') walk(c.id, cc.id);
      }
    };
    if (src.type === 'dir') walk(src.id, rootCopy.id);
  });
  return rootCopy;
}

/** Permanently delete (recursive). */
export function destroy(id: string) {
  const n = get(id);
  if (!n) return;
  if (id === ROOT || id === RECYCLER) throw new FSError('Access is denied.');
  guard(n, 'deleted');
  const all = fsStore.get().nodes;
  const doomed = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of Object.values(all)) if (c.parent && doomed.has(c.parent) && !doomed.has(c.id)) (doomed.add(c.id), (grew = true));
  }
  commit((nodes) => {
    doomed.forEach((d) => delete nodes[d]);
  });
}

/** Send to the Recycle Bin (or destroy if already inside it). */
export function remove(id: string) {
  const n = get(id);
  if (!n) throw new FSError('The file no longer exists.');
  if (id === ROOT || id === RECYCLER) throw new FSError('Access is denied.');
  if (inRecycler(id)) return destroy(id);
  guard(n, 'deleted');
  const name = uniqueName(RECYCLER, n.name);
  commit((nodes) => {
    nodes[id] = {
      ...n,
      parent: RECYCLER,
      name,
      meta: { ...(n.meta ?? {}), origParent: n.parent ?? ROOT, origPath: pathOf(n.parent ?? ROOT), origName: n.name, deletedAt: Date.now() },
    };
  });
}

export function restore(id: string): FSNode {
  const n = get(id);
  if (!n || n.parent !== RECYCLER) throw new FSError('That item is not in the Recycle Bin.');
  const meta = n.meta ?? {};
  let parent = meta.origParent ? get(meta.origParent) : undefined;
  if (!parent || inRecycler(parent.id)) parent = mkdirp(meta.origPath ?? 'C:\\');
  const name = uniqueName(parent.id, meta.origName ?? n.name);
  const { origParent, origPath, origName, deletedAt, ...rest } = meta;
  commit((nodes) => {
    nodes[id] = { ...n, parent: parent!.id, name, meta: Object.keys(rest).length ? rest : undefined };
  });
  return get(id)!;
}

export function emptyRecycler() {
  const kids = children(RECYCLER, { hidden: true });
  const all = fsStore.get().nodes;
  const doomed = new Set(kids.map((k) => k.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of Object.values(all)) if (c.parent && doomed.has(c.parent) && !doomed.has(c.id)) (doomed.add(c.id), (grew = true));
  }
  commit((nodes) => doomed.forEach((d) => delete nodes[d]));
}

// ---------- queries ----------
export function size(id: string): number {
  const n = get(id);
  if (!n) return 0;
  if (n.type === 'file') {
    if (n.content.startsWith('data:')) return Math.round((n.content.length - n.content.indexOf(',')) * 0.75);
    return new Blob([n.content]).size;
  }
  return children(id, { hidden: true }).reduce((s, c) => s + size(c.id), 0);
}

export function countTree(id: string): { files: number; dirs: number } {
  let files = 0;
  let dirs = 0;
  for (const c of children(id, { hidden: true })) {
    if (c.type === 'dir') {
      dirs++;
      const r = countTree(c.id);
      files += r.files;
      dirs += r.dirs;
    } else files++;
  }
  return { files, dirs };
}

export function search(rootId: string, query: string, opts: { hidden?: boolean; content?: boolean } = {}): FSNode[] {
  const q = query.toLowerCase();
  const re = q.includes('*') || q.includes('?') ? new RegExp('^' + q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$') : null;
  const out: FSNode[] = [];
  const walk = (id: string) => {
    for (const c of children(id, { hidden: opts.hidden })) {
      if (c.id === RECYCLER) continue;
      const name = c.name.toLowerCase();
      const hit = re ? re.test(name) : name.includes(q) || (opts.content && c.type === 'file' && !c.content.startsWith('data:') && c.content.toLowerCase().includes(q));
      if (hit) out.push(c);
      if (c.type === 'dir') walk(c.id);
    }
  };
  walk(rootId);
  return out;
}

export function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function totalBytes(): number {
  return size(ROOT);
}

// ---------- persistence ----------
// Several browser tabs can run KOAL-99 at once. They share one IndexedDB, so after
// each save we tell the other tabs to reload, instead of letting the last writer win.
const TAB = Math.random().toString(36).slice(2);
let chan: BroadcastChannel | null = null;
try {
  chan = new BroadcastChannel('koal99-fs');
  chan.onmessage = async (ev) => {
    if (ev.data?.from === TAB || saveTimer !== undefined) return;
    const saved = await idbGet<{ schema: number; nodes: Record<string, FSNode> }>('fs');
    if (saved?.nodes?.[ROOT]) fsStore.set((s) => ({ nodes: saved.nodes, version: s.version + 1 }));
  };
} catch {
  /* no BroadcastChannel: single-tab only */
}

let saveTimer: number | undefined;
function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined;
    idbSet('fs', { schema: SCHEMA, nodes: fsStore.get().nodes }).then(() => chan?.postMessage({ from: TAB }));
  }, 300);
}

export function flushSave() {
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
  return idbSet('fs', { schema: SCHEMA, nodes: fsStore.get().nodes }).then(() => chan?.postMessage({ from: TAB }));
}

export async function loadFS(seed: () => void): Promise<void> {
  const saved = await idbGet<{ schema: number; nodes: Record<string, FSNode> }>('fs');
  if (saved && saved.schema === SCHEMA && saved.nodes?.[ROOT]) {
    fsStore.set({ nodes: saved.nodes, version: 1, ready: true });
    return;
  }
  const now = Date.now();
  fsStore.set({
    nodes: {
      [ROOT]: { id: ROOT, name: 'C:', type: 'dir', parent: null, content: '', created: now, modified: now, system: true },
      [RECYCLER]: { id: RECYCLER, name: 'RECYCLER', type: 'dir', parent: ROOT, content: '', created: now, modified: now, system: true, hidden: true },
    },
    version: 1,
    ready: false,
  });
  seed();
  fsStore.set({ ready: true });
  await flushSave();
}

export async function formatDisk(seed: () => void) {
  await idbSet('fs', null);
  await loadFS(seed);
}
