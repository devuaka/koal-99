import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../core/registry';
import * as fs from '../core/fs';
import { MenuBar } from '../ui/MenuBar';
import { FileDialog } from '../ui/FileDialog';
import { onBeforeClose, openApp } from '../core/wm';
import { choiceBox, errorBox, alertBox } from '../core/dialog';
import { notifySaved } from '../core/launcher';
import { corruptText } from '../core/seed';
import { isAdmin } from '../core/system';
import { uid } from '../core/store';
import { Icon } from '../ui/Icon';

interface Doc {
  id: string;
  fileId: string | null;
  name: string;
  text: string;
  saved: string;
  readonly?: boolean;
  corrupt?: boolean;
}

function docFromFile(n: fs.FSNode): Doc {
  if (n.meta?.corrupt) {
    const t = corruptText(1400);
    return { id: uid('d'), fileId: n.id, name: n.name, text: t, saved: t, readonly: true, corrupt: true };
  }
  const isBinary = n.content.startsWith('data:') || n.content === 'builtin:theme';
  const text = isBinary ? n.content.slice(0, 2000) : n.content;
  return { id: uid('d'), fileId: n.id, name: n.name, text, saved: text, readonly: isBinary || (n.readonly && !isAdmin()) };
}

const blank = (): Doc => ({ id: uid('d'), fileId: null, name: 'Untitled', text: '', saved: '' });

export function Notepad({ win }: { win: WinCtx }) {
  const [docs, setDocs] = useState<Doc[]>(() => {
    const n = win.props.fileId ? fs.get(win.props.fileId) : undefined;
    return [n ? docFromFile(n) : blank()];
  });
  const [active, setActive] = useState(docs[0].id);
  const [wrap, setWrap] = useState(true);
  const [fontSize, setFontSize] = useState(13);
  const [font, setFont] = useState('Lucida Console');
  const [status, setStatus] = useState(true);
  const [dialog, setDialog] = useState<null | { mode: 'open' | 'save'; docId?: string; then?: () => void }>(null);
  const [find, setFind] = useState<null | { q: string; r: string; replace: boolean; matchCase: boolean }>(null);
  const [pos, setPos] = useState({ ln: 1, col: 1 });
  const ta = useRef<HTMLTextAreaElement>(null);
  const version = fs.fsStore.use((s) => s.version);
  const doc = docs.find((d) => d.id === active) ?? docs[0];
  const docsRef = useRef(docs);
  docsRef.current = docs;

  const patch = (id: string, p: Partial<Doc>) => setDocs((ds) => ds.map((d) => (d.id === id ? { ...d, ...p } : d)));

  // open a file passed in later (reuse window)
  useEffect(() => {
    if (!win.props._nonce || !win.props.fileId) return;
    openFile(win.props.fileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props._nonce]);

  // reload clean docs when the file changes on disk (e.g. from the Terminal)
  useEffect(() => {
    setDocs((ds) =>
      ds.map((d) => {
        if (!d.fileId || d.corrupt) return d;
        const n = fs.get(d.fileId);
        if (!n) return { ...d, fileId: null, saved: '\u0000' };
        if (d.text === d.saved && n.content !== d.saved && !n.content.startsWith('data:')) return { ...d, text: n.content, saved: n.content, name: n.name };
        if (n.name !== d.name) return { ...d, name: n.name };
        return d;
      }),
    );
  }, [version]);

  const dirty = (d: Doc) => d.text !== d.saved && !d.readonly;

  useEffect(() => {
    win.setTitle(`${dirty(doc) ? '*' : ''}${doc.name} - Notepad`);
  });

  // glitchy title for corrupt files
  useEffect(() => {
    if (!doc.corrupt) return;
    const t = window.setInterval(() => win.setTitle(Math.random() < 0.5 ? '░▒▓ - Notepad' : 'hello - Notepad'), 400);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.corrupt]);

  // unsaved-changes guard
  useEffect(() => {
    onBeforeClose(win.id, async () => {
      for (const d of docsRef.current) {
        if (!dirty(d)) continue;
        setActive(d.id);
        const r = await choiceBox(`The text in the ${d.name} file has changed.\n\nDo you want to save the changes?`, ['Yes', 'No', 'Cancel'], 'Notepad', 'warning');
        if (r === 0) {
          const ok = await saveDocAsync(d);
          if (!ok) return false;
        } else if (r !== 1) return false;
      }
      return true;
    });
    return () => onBeforeClose(win.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openFile = (id: string) => {
    const n = fs.get(id);
    if (!n) return;
    const existing = docsRef.current.find((d) => d.fileId === id);
    if (existing) return setActive(existing.id);
    const d = docFromFile(n);
    setDocs((ds) => (ds.length === 1 && !ds[0].fileId && !ds[0].text ? [d] : [...ds, d]));
    setActive(d.id);
  };

  const saveDocAsync = (d: Doc): Promise<boolean> =>
    new Promise((resolve) => {
      if (d.readonly) {
        errorBox(`Cannot save ${d.name}.\n\nThe file is read-only.`, 'Notepad');
        return resolve(false);
      }
      if (d.fileId && fs.get(d.fileId)) {
        try {
          fs.write(d.fileId, d.text);
          patch(d.id, { saved: d.text });
          notifySaved(d.name);
          resolve(true);
        } catch (e) {
          errorBox((e as Error).message, 'Notepad');
          resolve(false);
        }
        return;
      }
      setDialog({ mode: 'save', docId: d.id, then: () => resolve(true) });
      // if the dialog is cancelled we resolve false via onDone(null)
      cancelResolver.current = () => resolve(false);
    });
  const cancelResolver = useRef<(() => void) | null>(null);

  const newDoc = () => {
    const d = blank();
    setDocs((ds) => [...ds, d]);
    setActive(d.id);
  };

  const closeDoc = async (id: string) => {
    const d = docsRef.current.find((x) => x.id === id);
    if (!d) return;
    if (dirty(d)) {
      setActive(d.id);
      const r = await choiceBox(`Do you want to save changes to ${d.name}?`, ['Yes', 'No', 'Cancel'], 'Notepad', 'warning');
      if (r === 0 && !(await saveDocAsync(d))) return;
      if (r !== 0 && r !== 1) return;
    }
    const rest = docsRef.current.filter((x) => x.id !== id);
    if (!rest.length) {
      const b = blank();
      setDocs([b]);
      setActive(b.id);
    } else {
      setDocs(rest);
      if (active === id) setActive(rest[rest.length - 1].id);
    }
  };

  const exec = (cmd: string) => {
    ta.current?.focus();
    document.execCommand(cmd);
  };

  const pasteText = async () => {
    ta.current?.focus();
    try {
      const t = await navigator.clipboard.readText();
      document.execCommand('insertText', false, t);
    } catch {
      alertBox('Use Ctrl+V to paste. (Your browser keeps its clipboard private.)', 'Notepad');
    }
  };

  const insertDate = () => {
    ta.current?.focus();
    const d = new Date();
    document.execCommand('insertText', false, `${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} ${d.toLocaleDateString()}`);
  };

  const findNext = (q = find?.q ?? '', matchCase = find?.matchCase ?? false) => {
    const el = ta.current;
    if (!el || !q) return false;
    const hay = matchCase ? el.value : el.value.toLowerCase();
    const needle = matchCase ? q : q.toLowerCase();
    let i = hay.indexOf(needle, el.selectionEnd);
    if (i < 0) i = hay.indexOf(needle);
    if (i < 0) {
      alertBox(`Cannot find "${q}"`, 'Notepad');
      return false;
    }
    el.focus();
    el.setSelectionRange(i, i + q.length);
    const line = el.value.slice(0, i).split('\n').length;
    el.scrollTop = Math.max(0, (line - 5) * fontSize * 1.3);
    return true;
  };

  const replaceOne = () => {
    const el = ta.current;
    if (!el || !find || doc.readonly) return;
    const s = el.value.slice(el.selectionStart, el.selectionEnd);
    if ((find.matchCase ? s : s.toLowerCase()) === (find.matchCase ? find.q : find.q.toLowerCase()) && s) {
      document.execCommand('insertText', false, find.r);
    }
    findNext();
  };

  const replaceAll = () => {
    if (!find?.q || doc.readonly) return;
    const re = new RegExp(find.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), find.matchCase ? 'g' : 'gi');
    const count = (doc.text.match(re) ?? []).length;
    patch(doc.id, { text: doc.text.replace(re, find.r) });
    alertBox(`Replaced ${count} occurrence(s).`, 'Notepad');
  };

  const updatePos = () => {
    const el = ta.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart).split('\n');
    setPos({ ln: before.length, col: before[before.length - 1].length + 1 });
  };

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === 's') (e.preventDefault(), e.shiftKey ? setDialog({ mode: 'save', docId: doc.id }) : saveDocAsync(doc));
    else if (e.ctrlKey && k === 'o') (e.preventDefault(), setDialog({ mode: 'open' }));
    else if (e.ctrlKey && k === 'n') (e.preventDefault(), newDoc());
    else if (e.ctrlKey && k === 'f') (e.preventDefault(), setFind({ q: find?.q ?? '', r: find?.r ?? '', replace: false, matchCase: find?.matchCase ?? false }));
    else if (e.ctrlKey && k === 'h') (e.preventDefault(), setFind({ q: find?.q ?? '', r: find?.r ?? '', replace: true, matchCase: find?.matchCase ?? false }));
    else if (e.key === 'F3') (e.preventDefault(), findNext());
    else if (e.key === 'F5') (e.preventDefault(), insertDate());
    else if (e.ctrlKey && k === 'w') (e.preventDefault(), closeDoc(doc.id));
    else if (e.key === 'Tab' && (e.target as HTMLElement).tagName === 'TEXTAREA') {
      e.preventDefault();
      document.execCommand('insertText', false, '\t');
    }
  };

  const menus = [
    { label: 'File', items: [
      { label: 'New Tab', shortcut: 'Ctrl+N', onClick: newDoc },
      { label: 'New Window', onClick: () => openApp('notepad') },
      { label: 'Open...', shortcut: 'Ctrl+O', onClick: () => setDialog({ mode: 'open' }) },
      { label: 'Save', shortcut: 'Ctrl+S', disabled: doc.readonly, onClick: () => saveDocAsync(doc) },
      { label: 'Save As...', disabled: doc.corrupt, onClick: () => setDialog({ mode: 'save', docId: doc.id }) },
      { sep: true },
      { label: 'Close Tab', shortcut: 'Ctrl+W', onClick: () => closeDoc(doc.id) },
      { label: 'Exit', onClick: () => win.close() },
    ] },
    { label: 'Edit', items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', onClick: () => exec('undo') },
      { label: 'Redo', shortcut: 'Ctrl+Y', onClick: () => exec('redo') },
      { sep: true },
      { label: 'Cut', shortcut: 'Ctrl+X', disabled: doc.readonly, onClick: () => exec('cut') },
      { label: 'Copy', shortcut: 'Ctrl+C', onClick: () => exec('copy') },
      { label: 'Paste', shortcut: 'Ctrl+V', disabled: doc.readonly, onClick: pasteText },
      { label: 'Delete', shortcut: 'Del', disabled: doc.readonly, onClick: () => exec('delete') },
      { sep: true },
      { label: 'Find...', shortcut: 'Ctrl+F', onClick: () => setFind({ q: find?.q ?? '', r: '', replace: false, matchCase: false }) },
      { label: 'Find Next', shortcut: 'F3', onClick: () => findNext() },
      { label: 'Replace...', shortcut: 'Ctrl+H', disabled: doc.readonly, onClick: () => setFind({ q: find?.q ?? '', r: '', replace: true, matchCase: false }) },
      { sep: true },
      { label: 'Select All', shortcut: 'Ctrl+A', onClick: () => (ta.current?.focus(), ta.current?.select()) },
      { label: 'Time/Date', shortcut: 'F5', disabled: doc.readonly, onClick: insertDate },
    ] },
    { label: 'Format', items: [
      { label: 'Word Wrap', checked: wrap, onClick: () => setWrap(!wrap) },
      { label: 'Font', items: ['Lucida Console', 'Courier New', 'Tahoma', 'Times New Roman', 'Comic Sans MS'].map((f) => ({ label: f, checked: font === f, onClick: () => setFont(f) })) },
      { label: 'Size', items: [10, 12, 13, 16, 20, 28].map((s) => ({ label: s + ' pt', checked: fontSize === s, onClick: () => setFontSize(s) })) },
    ] },
    { label: 'View', items: [{ label: 'Status Bar', checked: status, onClick: () => setStatus(!status) }] },
    { label: 'Help', items: [{ label: 'About Notepad', onClick: () => alertBox('KOAL Notepad 5.1\n(c) 1999-2004 KOAL Systems Inc.\n\nNow with tabs, which nobody asked for.', 'About Notepad', 'logo') }] },
  ];

  return (
    <div className="np" onKeyDown={onKey}>
      <MenuBar menus={menus} />
      {docs.length > 1 && (
        <div className="np-tabs">
          {docs.map((d) => (
            <div key={d.id} className={`np-tab ${d.id === active ? 'active' : ''}`} onClick={() => setActive(d.id)} onAuxClick={(e) => e.button === 1 && closeDoc(d.id)}>
              <Icon name="text" size={16} />
              <span>{dirty(d) ? '*' : ''}{d.name}</span>
              <b onClick={(e) => { e.stopPropagation(); closeDoc(d.id); }}>x</b>
            </div>
          ))}
          <div className="np-tab np-plus" onClick={newDoc} title="New tab">+</div>
        </div>
      )}
      {find && (
        <div className="np-find">
          <span>Find:</span>
          <input className="k-input" autoFocus value={find.q} onChange={(e) => setFind({ ...find, q: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), findNext())} />
          {find.replace && (
            <>
              <span>Replace:</span>
              <input className="k-input" value={find.r} onChange={(e) => setFind({ ...find, r: e.target.value })} />
            </>
          )}
          <label className="k-check"><input type="checkbox" checked={find.matchCase} onChange={(e) => setFind({ ...find, matchCase: e.target.checked })} />Match case</label>
          <button className="k-btn small" onClick={() => findNext()}>Find Next</button>
          {find.replace && <button className="k-btn small" onClick={replaceOne}>Replace</button>}
          {find.replace && <button className="k-btn small" onClick={replaceAll}>Replace All</button>}
          <button className="k-btn small" onClick={() => setFind(null)}>x</button>
        </div>
      )}
      <textarea
        key={doc.id}
        ref={ta}
        className={`np-text ${doc.corrupt ? 'np-corrupt' : ''}`}
        value={doc.text}
        readOnly={doc.readonly}
        spellCheck={false}
        wrap={wrap ? 'soft' : 'off'}
        style={{ fontFamily: `'${font}', monospace`, fontSize, whiteSpace: wrap ? 'pre-wrap' : 'pre', overflowX: wrap ? 'hidden' : 'auto' }}
        onChange={(e) => patch(doc.id, { text: e.target.value })}
        onKeyUp={updatePos}
        onClick={updatePos}
        autoFocus
      />
      {status && (
        <div className="k-status">
          <div style={{ flex: 1 }}>{doc.readonly ? 'Read-only' : doc.fileId ? fs.pathOf(doc.fileId) : 'Not saved yet'}</div>
          <div style={{ width: 120 }}>Ln {pos.ln}, Col {pos.col}</div>
          <div style={{ width: 100 }}>{doc.text.length} chars</div>
        </div>
      )}
      {dialog && (
        <FileDialog
          mode={dialog.mode}
          exts={['txt', 'log', 'ini', 'bat', 'md', 'htm', 'html', 'csv']}
          filterLabel="Text Documents (*.txt, *.bat, *.htm ...)"
          defaultName={dialog.mode === 'save' ? (docs.find((d) => d.id === dialog.docId)?.name ?? 'Untitled') + (docs.find((d) => d.id === dialog.docId)?.name.includes('.') ? '' : '.txt') : ''}
          startDir={doc.fileId ? fs.get(doc.fileId)?.parent ?? undefined : undefined}
          onDone={(r) => {
            const dlg = dialog;
            setDialog(null);
            if (!r) {
              cancelResolver.current?.();
              cancelResolver.current = null;
              return;
            }
            if (dlg.mode === 'open') return r.node && openFile(r.node.id);
            const d = docsRef.current.find((x) => x.id === dlg.docId);
            if (!d) return;
            try {
              let node = r.node;
              if (node) fs.write(node.id, d.text);
              else node = fs.create(r.dirId, r.name, 'file', d.text);
              patch(d.id, { fileId: node.id, name: node.name, saved: d.text, readonly: false });
              notifySaved(node.name);
              cancelResolver.current = null;
              dlg.then?.();
            } catch (e) {
              errorBox((e as Error).message, 'Save As');
              cancelResolver.current?.();
            }
          }}
        />
      )}
    </div>
  );
}
