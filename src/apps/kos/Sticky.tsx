// Sticky Notes: every note is its own small window; notes are kept per user.
import { useEffect, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import { openApp, wmStore, focus, close } from '../../core/wm';
import { userName } from '../../core/session';
import { confirmBox } from '../../core/dialog';

export const STICKY_COLORS = ['#fff685', '#ffd6e8', '#c8f7c8', '#c8e4ff', '#ffd8a8', '#e4d4ff'];

interface Note {
  id: string;
  text: string;
  color: string;
}

const key = () => 'koal99.stickies.' + userName();
function load(): Note[] {
  try {
    const v = JSON.parse(localStorage.getItem(key()) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function store(list: Note[]) {
  try {
    localStorage.setItem(key(), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function openNote(n: Note, offset = 0) {
  const w = wmStore.get().wins.find((x) => x.app === 'stickynote' && x.props.noteId === n.id);
  if (w) return focus(w.id);
  openApp('stickynote', { noteId: n.id, _x: window.innerWidth - 270 - (offset % 5) * 26, _y: 20 + (offset % 5) * 30 + Math.floor(offset / 5) * 10 });
}

/** Start menu entry: show every note (or make the first one). */
export function openStickies() {
  let list = load();
  if (!list.length) {
    list = [{ id: 'n' + Date.now(), text: '', color: STICKY_COLORS[0] }];
    store(list);
  }
  list.forEach((n, i) => openNote(n, i));
}

export function StickyNote({ win }: { win: WinCtx }) {
  const id = win.props.noteId as string;
  const [note, setNote] = useState<Note>(() => load().find((n) => n.id === id) ?? { id, text: '', color: STICKY_COLORS[0] });
  useEffect(() => {
    const list = load();
    const i = list.findIndex((n) => n.id === id);
    if (i >= 0) list[i] = note;
    else list.push(note);
    store(list);
    const first = note.text.split('\n')[0].trim();
    win.setTitle(first ? first.slice(0, 30) : 'Sticky Note');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  const add = () => {
    const n: Note = { id: 'n' + Date.now() + Math.random().toString(36).slice(2, 5), text: '', color: STICKY_COLORS[(STICKY_COLORS.indexOf(note.color) + 1) % STICKY_COLORS.length] };
    store([...load(), n]);
    openNote(n, load().length);
  };
  const del = async () => {
    if (note.text.trim() && !(await confirmBox('Delete this note?', 'Sticky Notes', 'question'))) return;
    store(load().filter((n) => n.id !== id));
    close(win.id, true);
  };

  return (
    <div className="sticky" style={{ background: note.color }}>
      <div className="sticky-bar">
        <button className="sticky-btn" title="New note" onClick={add}>+</button>
        <div className="sticky-cols">
          {STICKY_COLORS.map((c) => (
            <span key={c} className={`sticky-sw ${c === note.color ? 'on' : ''}`} style={{ background: c }} onClick={() => setNote({ ...note, color: c })} />
          ))}
        </div>
        <button className="sticky-btn" title="Delete note" onClick={del}>{'✕'}</button>
      </div>
      <textarea autoFocus spellCheck={false} placeholder="Type a note..." value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} />
    </div>
  );
}
