// Python editor: write a .py file on the KOAL-99 drive and run it with Pyodide.
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import * as fs from '../../core/fs';
import { loadPy, pyLoaded, armPy, wirePy, pyError } from '../../core/python';
import { FileDialog } from '../../ui/FileDialog';
import { MenuBar } from '../../ui/MenuBar';
import { errorBox, alertBox } from '../../core/dialog';
import { notifySaved } from '../../core/launcher';
import { documentsDir } from '../../core/session';
import { openApp } from '../../core/wm';

const SAMPLE = '# Welcome to Python inside KOAL-99!\nfor i in range(1, 6):\n    print("KOAL-99 says hello", i)\n\nsquares = [n * n for n in range(10)]\nprint(squares)\nprint("Sum:", sum(squares))\n';

export function PythonApp({ win }: { win: WinCtx }) {
  const [fileId, setFileId] = useState<string | null>(win.props.fileId ?? null);
  const [code, setCode] = useState(() => (win.props.fileId ? fs.get(win.props.fileId)?.content ?? '' : SAMPLE));
  const [saved, setSaved] = useState(code);
  const [out, setOut] = useState<{ t: string; err?: boolean }[]>([]);
  const [status, setStatus] = useState(pyLoaded() ? 'Ready.' : 'Python loads the first time you press Run (about 10 MB, then it is fast).');
  const [running, setRunning] = useState(false);
  const [dlg, setDlg] = useState<null | 'open' | 'save'>(null);
  const ed = useRef<HTMLTextAreaElement>(null);
  const outRef = useRef<HTMLPreElement>(null);
  const node = fileId ? fs.get(fileId) : undefined;
  const dirty = code !== saved;

  useEffect(() => {
    win.setTitle(`${dirty ? '*' : ''}${node?.name ?? 'untitled.py'} - Python`);
  });
  useEffect(() => {
    if (win.props.autorun) window.setTimeout(run, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
  }, [out]);

  const print = (t: string, err = false) => setOut((o) => [...o, { t, err }]);

  async function run() {
    if (running) return;
    setRunning(true);
    try {
      setStatus(pyLoaded() ? 'Running...' : 'Loading Python... (first time only)');
      const py = await loadPy();
      wirePy(py, (s) => print(s), (s) => print(s, true));
      setStatus('Running...');
      armPy(py);
      await py.runPythonAsync(ed.current?.value ?? code);
      setStatus('Finished.');
    } catch (e) {
      print(pyError(e), true);
      setStatus('Finished with an error.');
    }
    setRunning(false);
  }

  const save = () => {
    if (!node) return setDlg('save');
    try {
      fs.write(node.id, code);
      setSaved(code);
      notifySaved(node.name);
    } catch (e) {
      errorBox((e as Error).message, 'Python');
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '    ');
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      run();
    } else if (e.key === 's' && e.ctrlKey) {
      e.preventDefault();
      save();
    } else if (e.key === 'Enter') {
      // keep the indentation of the line above, and indent after a colon
      const t = e.currentTarget;
      const before = t.value.slice(0, t.selectionStart);
      const line = before.split('\n').pop() ?? '';
      const ind = (/^\s*/.exec(line)?.[0] ?? '') + (/:\s*$/.test(line) ? '    ' : '');
      if (ind) {
        e.preventDefault();
        document.execCommand('insertText', false, '\n' + ind);
      }
    }
  };

  const lines = code.split('\n').length;

  return (
    <div className="py">
      <MenuBar menus={[
        { label: 'File', items: [
          { label: 'New', onClick: () => { setFileId(null); setCode(SAMPLE); setSaved(''); } },
          { label: 'Open...', onClick: () => setDlg('open') },
          { label: 'Save', shortcut: 'Ctrl+S', onClick: save },
          { label: 'Save As...', onClick: () => setDlg('save') },
          { sep: true },
          { label: 'Python in the Terminal', onClick: () => openApp('terminal', { script: 'python' }) },
          { sep: true },
          { label: 'Close', onClick: () => win.close() },
        ] },
        { label: 'Run', items: [
          { label: 'Run', shortcut: 'Ctrl+Enter', onClick: run },
          { label: 'Clear Output', onClick: () => setOut([]) },
        ] },
        { label: 'Help', items: [{ label: 'About Python', onClick: () => alertBox('Python 3.12 (Pyodide) running in your browser.\n\ninput() works through a pop-up box. Programs are stopped after 10 seconds so a never-ending loop cannot freeze KOAL-99.', 'About Python', 'python') }] },
      ]} />
      <div className="k-toolbar">
        <button className="k-tool" disabled={running} onClick={run}><span style={{ color: '#2a9a2a' }}>{'▶'}</span> Run</button>
        <button className="k-tool" onClick={save}>{node ? 'Save' : 'Save As...'}</button>
        <button className="k-tool" onClick={() => setOut([])}>Clear output</button>
        <span className="k-spacer" />
        <span className="py-st">{status}</span>
      </div>
      <div className="py-split">
        <div className="py-ed">
          <div className="py-gutter">{Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}</div>
          <textarea ref={ed} spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onKey} onScroll={(e) => { const g = e.currentTarget.previousElementSibling as HTMLElement; g.scrollTop = e.currentTarget.scrollTop; }} />
        </div>
        <pre className="py-out" ref={outRef}>
          {!out.length && <span className="py-hint">Output appears here.</span>}
          {out.map((o, i) => <div key={i} className={o.err ? 'err' : ''}>{o.t}</div>)}
        </pre>
      </div>
      {dlg && (
        <FileDialog
          mode={dlg}
          exts={['py']}
          filterLabel="Python files (*.py)"
          defaultName={dlg === 'save' ? node?.name ?? 'script.py' : ''}
          startDir={node?.parent ?? documentsDir().id}
          onDone={(r) => {
            const mode = dlg;
            setDlg(null);
            if (!r) return;
            if (mode === 'open') {
              if (r.node) {
                setFileId(r.node.id);
                setCode(r.node.content);
                setSaved(r.node.content);
              }
              return;
            }
            try {
              const n = r.node ?? fs.create(r.dirId, r.name, 'file', '');
              fs.write(n.id, code);
              setFileId(n.id);
              setSaved(code);
              notifySaved(n.name);
            } catch (e) {
              errorBox((e as Error).message, 'Save As');
            }
          }}
        />
      )}
    </div>
  );
}
