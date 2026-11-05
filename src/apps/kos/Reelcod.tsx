// Reelcod: make little apps with blocks, JavaScript or HTML; save them as .lxo programs and share them.
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import * as fs from '../../core/fs';
import { RC_DEFS, RC_NAMES, rcGen, rcNew, rcPack, rcParse, shareCode, Block, Mode, ReelApp } from '../../core/reelcod';
import { desktopDir } from '../../core/session';
import { openApp } from '../../core/wm';
import { confirmBox, promptBox, errorBox, choiceBox } from '../../core/dialog';
import { notify } from '../../core/notify';
import { say } from '../../core/tts';

const DEFAULT_HTML = '<h1>Hello!</h1>\n<p>Edit this page, then press Run.</p>\n<button onclick="alert(\'Hi!\')">Click me</button>\n';
const AI_MODEL_KEY = 'koal99.reelcod.model';
const AI_KEY = 'koal99.openrouterKey';

// ---------- the window a Reelcod app runs in ----------
export function ReelRunner({ win }: { win: WinCtx }) {
  const app = win.props.app as ReelApp;
  const [lines, setLines] = useState<{ t: string; err?: boolean; btn?: () => void }[]>([]);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || app.html) {
      if (app.html) {
        const m = /<title[^>]*>([^<]*)<\/title>/i.exec(app.code);
        if (m?.[1].trim()) win.setTitle(m[1].trim());
      }
      return;
    }
    ran.current = true;
    const print = (s: unknown) => setLines((l) => [...l, { t: String(s) }]);
    const err = (e: unknown) => setLines((l) => [...l, { t: 'Error: ' + (e as Error).message, err: true }]);
    const api = {
      print,
      clear: () => setLines([]),
      button: (label: unknown, fn: () => void) => setLines((l) => [...l, { t: String(label), btn: () => { try { fn(); } catch (e) { err(e); } } }]),
      title: (s: unknown) => win.setTitle(String(s)),
    };
    try {
      // eslint-disable-next-line no-new-func
      new Function('app', 'alert', 'prompt', 'say', app.code)(api, (s: unknown) => window.alert(String(s)), (s: unknown) => window.prompt(String(s)), (s: unknown) => say(String(s)));
    } catch (e) {
      err(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (app.html) return <iframe className="rc-frame" title={app.name} sandbox="allow-scripts allow-modals allow-forms allow-popups" srcDoc={app.code} />;
  return (
    <div className="rc-out">
      {lines.map((l, i) => (l.btn ? <button key={i} className="k-btn" onClick={l.btn}>{l.t}</button> : <div key={i} className={l.err ? 'err' : ''}>{l.t}</div>))}
    </div>
  );
}

export function runReel(app: ReelApp) {
  openApp('kreelrun', { app, _title: app.name, _w: app.html ? 580 : 460, _h: app.html ? 440 : 380 });
}

// ---------- block editor ----------
function Blocks({ list, onChange }: { list: Block[]; onChange: () => void }) {
  return (
    <>
      {list.map((blk, idx) => {
        const d = RC_DEFS[blk.t];
        if (!d) return null;
        return (
          <div key={idx} className={`rc-b rc-b-${blk.t}`}>
            <div className="rc-row">
              {d.f.map((f, i) => (
                <span key={i}>
                  {f[0] && <span>{f[0]}</span>}
                  {f[1] === 'op' ? (
                    <select value={String(blk['a' + i] ?? '=')} onChange={(e) => ((blk['a' + i] = e.target.value), onChange())}>
                      {['=', '≠', '<', '>'].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className={f[1] === 'var' ? 'var' : ''} spellCheck={false} value={String(blk['a' + i] ?? '')} onChange={(e) => ((blk['a' + i] = e.target.value), onChange())} />
                  )}
                </span>
              ))}
              {d.end && <span>{d.end}</span>}
              <span className="rc-ctl">
                <button title="Up" onClick={() => { if (idx > 0) { [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]; onChange(); } }}>{'↑'}</button>
                <button title="Down" onClick={() => { if (idx < list.length - 1) { [list[idx + 1], list[idx]] = [list[idx], list[idx + 1]]; onChange(); } }}>{'↓'}</button>
                <button title="Delete" onClick={() => { list.splice(idx, 1); onChange(); }}>{'✕'}</button>
              </span>
            </div>
            {d.c && (
              <div className="rc-inner">
                <Blocks list={(blk.c ??= [])} onChange={onChange} />
                <AddBlock list={blk.c} onChange={onChange} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function AddBlock({ list, onChange }: { list: Block[]; onChange: () => void }) {
  return (
    <select className="rc-add" value="" onChange={(e) => { if (e.target.value) { list.push(rcNew(e.target.value)); onChange(); } }}>
      <option value="">+ Add a block...</option>
      {Object.keys(RC_NAMES).map((k) => <option key={k} value={k}>{RC_NAMES[k]}</option>)}
    </select>
  );
}

export function Reelcod({ win }: { win: WinCtx }) {
  const [name, setName] = useState('My App');
  const [mode, setMode] = useState<Mode>('blocks');
  const [blocks, setBlocks] = useState<Block[]>(() => [rcNew('title'), rcNew('show'), { t: 'btn', a0: 'Click me', c: [{ t: 'show', a0: 'You clicked it!' }] }]);
  const [code, setCode] = useState('');
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [, bump] = useState(0);
  const [status, setStatus] = useState('Make an app, then Save or Share it. Anyone can Import it into KOAL-99 or koalOS.');
  const [ai, setAi] = useState(false);

  const apply = (p: ReelApp) => {
    setName(p.name);
    if (p.html) (setMode('html'), setHtml(p.code));
    else if (p.blocks) (setMode('blocks'), setBlocks(p.blocks), setCode(rcGen(p.blocks)));
    else (setMode('code'), setCode(p.code));
  };
  useEffect(() => {
    const n = win.props.fileId ? fs.get(win.props.fileId) : undefined;
    const p = n ? rcParse(n.content) : (win.props.app as ReelApp | undefined);
    if (p) apply(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const src = () => (mode === 'blocks' ? rcGen(blocks) : mode === 'html' ? html : code);
  const pack = () => rcPack(name.trim() || 'My App', mode, blocks, src());

  const switchMode = async (m: Mode) => {
    if (m === mode) return;
    if (m === 'code' && mode === 'blocks') setCode(rcGen(blocks));
    if (m === 'blocks' && mode === 'code' && code !== rcGen(blocks) && !(await confirmBox('Switching back to blocks will discard your code edits. Continue?', 'Reelcod', 'warning'))) return;
    setMode(m);
  };

  const saveToDesktop = (packed = pack(), nm = name.trim() || 'My App') => {
    const d = desktopDir();
    const n = fs.create(d.id, fs.uniqueName(d.id, nm.replace(/[\\/:*?"<>|]/g, '') + '.lxo'), 'file', packed);
    setStatus(`Saved ${n.name} on your desktop. Double-click it to run.`);
    return n;
  };

  const doImport = async (txt: string) => {
    const p = rcParse(txt);
    if (!p) return errorBox('That is not a Reelcod app.', 'Reelcod');
    if (!(await confirmBox(`Import "${p.name}"? Only import apps from people you trust: they can run code on this computer.`, 'Reelcod', 'warning'))) return;
    apply(p);
    saveToDesktop(rcPack(p.name, p.html ? 'html' : p.blocks ? 'blocks' : 'code', p.blocks ?? [], p.code), p.name);
    setStatus(`Imported "${p.name}". It is on your desktop and open in the editor.`);
  };

  const importDialog = async () => {
    const r = await choiceBox('Import a Reelcod app from a file, or paste a share code?', ['From a file...', 'Paste a share code', 'Cancel'], 'Import');
    if (r === 0) {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.lxo,.txt';
      inp.onchange = async () => inp.files?.[0] && doImport(await inp.files[0].text());
      inp.click();
    } else if (r === 1) {
      const t = await promptBox('Paste the share code:', '', 'Import');
      if (t) doImport(t);
    }
  };

  return (
    <div className="rc">
      <div className="rc-tb">
        <b>Reelcod</b>
        <input className="k-input" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="rc-modes">
          {(['blocks', 'code', 'html'] as Mode[]).map((m) => <button key={m} className={`sci-chip ${mode === m ? 'on' : ''}`} onClick={() => switchMode(m)}>{m === 'blocks' ? 'Blocks' : m === 'code' ? 'Code' : 'HTML'}</button>)}
        </div>
        <span className="k-spacer" />
        <button className="k-btn default" onClick={() => runReel({ name: name.trim() || 'My App', code: src(), html: mode === 'html', blocks: null })}>{'▶'} Run</button>
        <button className="k-btn" onClick={() => saveToDesktop()}>Save to desktop</button>
        <button className="k-btn" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([pack()], { type: 'text/plain' })); a.download = (name.trim() || 'My App') + '.lxo'; a.click(); setStatus('Exported. Send the file to a friend: they use Import to add it.'); }}>Export .lxo</button>
        <button className="k-btn" onClick={async () => { const c = shareCode(pack()); try { await navigator.clipboard.writeText(c); setStatus('Share code copied! Your friend pastes it into Import.'); } catch { promptBox('Copy this share code:', c, 'Share'); } }}>Copy share code</button>
        <button className="k-btn" onClick={importDialog}>Import...</button>
        <button className={`k-btn ${ai ? 'default' : ''}`} onClick={() => setAi(!ai)}>AI Helper</button>
      </div>
      <div className="rc-main">
        {mode === 'blocks' ? (
          <div className="rc-blocks">
            <Blocks list={blocks} onChange={() => bump((x) => x + 1)} />
            <AddBlock list={blocks} onChange={() => bump((x) => x + 1)} />
          </div>
        ) : (
          <textarea className="rc-code" spellCheck={false} value={mode === 'html' ? html : code} onChange={(e) => (mode === 'html' ? setHtml(e.target.value) : setCode(e.target.value))} onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); } }} />
        )}
        {ai && <AiHelper mode={mode} code={src} onInsert={(c) => { if (mode === 'html' || /^\s*<(!doctype|html|head|body|div|h\d|p|button|style|script|canvas)/i.test(c)) { setHtml(c); setMode('html'); } else { setCode(c); setMode('code'); } setStatus('Inserted the AI code. Press Run to try it.'); }} />}
      </div>
      <div className="k-status"><div style={{ flex: 1 }}>{status}</div></div>
    </div>
  );
}

function AiHelper({ mode, code, onInsert }: { mode: Mode; code: () => string; onInsert: (c: string) => void }) {
  const [log, setLog] = useState<{ who: 'me' | 'bot'; text: string }[]>([{ who: 'bot', text: 'Hi! I can explain code, fix bugs, or write a whole app for you. Try: "make a counter app".' }]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const hist = useRef<{ role: string; content: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 1e9;
  }, [log]);

  const getKey = async (): Promise<string | null> => {
    let k = localStorage.getItem(AI_KEY) ?? '';
    if (k) return k;
    k = (await promptBox('The AI helper uses OpenRouter, which needs an API key.\n\nPaste your own OpenRouter key (free at openrouter.ai/keys). It is stored only in this browser.', '', 'AI helper'))?.trim() ?? '';
    if (!k) return null;
    localStorage.setItem(AI_KEY, k);
    return k;
  };

  const send = async () => {
    const text = q.trim();
    if (!text || busy) return;
    setQ('');
    setLog((l) => [...l, { who: 'me', text }, { who: 'bot', text: 'Thinking...' }]);
    setBusy(true);
    try {
      const key = await getKey();
      if (!key) throw new Error('no API key set. Get a free one at openrouter.ai/keys and try again.');
      const model = localStorage.getItem(AI_MODEL_KEY) || 'openrouter/auto';
      const sys =
        (mode === 'html' ? 'The user is in HTML mode: apps are a single self-contained HTML page (inline CSS and JavaScript) shown in a sandboxed frame. Give one complete page in a single ```html block. Otherwise: ' : '') +
        'You are the AI helper inside Reelcod, a code editor in a retro OS called KOAL-99. Apps are plain JavaScript run with these globals: app.print(text) shows a line, app.button(label,fn) adds a button, app.title(text) sets the window title, app.clear() clears the screen, alert(text), prompt(question) returns a string, say(text) speaks out loud. Keep answers short and friendly. When you write code, give one complete app in a single ```js code block.';
      hist.current.push({ role: 'user', content: 'My current code:\n```' + (mode === 'html' ? 'html' : 'js') + '\n' + code() + '\n```\n\n' + text });
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'X-Title': 'KOAL-99 Reelcod' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: sys }, ...hist.current.slice(-6)] }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message ?? 'Error ' + res.status);
      const reply = j?.choices?.[0]?.message?.content ?? '(no answer)';
      hist.current.push({ role: 'assistant', content: reply });
      setLog((l) => [...l.slice(0, -1), { who: 'bot', text: reply }]);
    } catch (e) {
      hist.current.pop();
      setLog((l) => [...l.slice(0, -1), { who: 'bot', text: 'Sorry, the helper had a problem: ' + (e as Error).message }]);
    }
    setBusy(false);
  };

  return (
    <div className="rc-ai">
      <div className="rc-ai-h">
        AI Code Helper
        <span className="k-spacer" />
        <span className="k-link" title="Change the OpenRouter model or key" onClick={async () => {
          const m = await promptBox('OpenRouter model id (blank = openrouter/auto):', localStorage.getItem(AI_MODEL_KEY) ?? '', 'AI helper');
          if (m !== null) localStorage.setItem(AI_MODEL_KEY, m.trim());
          if (await confirmBox('Forget the saved API key?', 'AI helper')) { localStorage.removeItem(AI_KEY); notify('AI helper', 'Your OpenRouter key was removed from this browser.', { silent: true }); }
        }}>Settings</span>
      </div>
      <div className="rc-ai-log" ref={ref}>
        {log.map((m, i) => (
          <div key={i} className={`rc-ai-m ${m.who}`}>
            {m.text.split(/```(?:\w+)?\n?/).map((part, k) =>
              !part.trim() ? null : k % 2 ? (
                <div key={k}>
                  <pre>{part.replace(/\n$/, '')}</pre>
                  <button className="k-btn small" onClick={() => onInsert(part.replace(/\n$/, ''))}>Insert into Code</button>
                </div>
              ) : (
                <div key={k}>{part.trim()}</div>
              ),
            )}
          </div>
        ))}
      </div>
      <div className="rc-ai-in">
        <textarea className="k-input" rows={2} value={q} placeholder="Ask for help or describe an app to make..." onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="k-btn default" disabled={busy} onClick={send}>Send</button>
      </div>
    </div>
  );
}
