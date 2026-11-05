// Text to Speech: type (or open a file) and hear it read aloud, word by word highlighting.
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import { ttsOK, voiceList, pickVoice, chunks, loadTtsSettings, saveTtsSettings, TtsSettings } from '../../core/tts';
import { FileDialog } from '../../ui/FileDialog';

const TEXT_KEY = 'koal99.tts.text';

export function TextToSpeech({ win }: { win: WinCtx }) {
  const [st, setSt] = useState<TtsSettings>(loadTtsSettings);
  const [text, setText] = useState(() => localStorage.getItem(TEXT_KEY) ?? 'Hello! I am KOAL-99. Type anything here and press Speak, and I will read it out loud.');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(voiceList);
  const [status, setStatus] = useState('Ready. Tip: select some text first to read just that part.');
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dlg, setDlg] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const stopped = useRef(true);

  useEffect(() => saveTtsSettings(st), [st]);
  useEffect(() => {
    try {
      localStorage.setItem(TEXT_KEY, text);
    } catch {
      /* ignore */
    }
  }, [text]);
  useEffect(() => {
    if (!ttsOK()) return;
    const fill = () => setVoices(voiceList());
    speechSynthesis.addEventListener('voiceschanged', fill);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', fill);
      stopped.current = true;
      speechSynthesis.cancel();
    };
  }, []);

  if (!ttsOK()) return <div className="msgbox">Sorry, this browser does not support text to speech.</div>;

  const stop = (msg = 'Stopped.') => {
    stopped.current = true;
    speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
    setStatus(msg);
  };

  const speak = () => {
    const el = ta.current!;
    const hasSel = el.selectionStart !== el.selectionEnd && document.activeElement === el;
    const src = hasSel ? text.slice(el.selectionStart, el.selectionEnd) : text;
    if (!src.trim()) return setStatus('Type something first.');
    speechSynthesis.cancel();
    const base = hasSel ? el.selectionStart : 0;
    const parts = chunks(src);
    let i = 0;
    stopped.current = false;
    setSpeaking(true);
    setStatus('Speaking...');
    const next = () => {
      if (stopped.current) return;
      if (i >= parts.length) return stop('Finished.');
      const c = parts[i];
      const u = new SpeechSynthesisUtterance(c.t);
      const v = pickVoice(st.voice);
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      }
      u.rate = st.rate;
      u.pitch = st.pitch;
      u.volume = st.vol;
      u.onboundary = (e) => {
        if (e.name && e.name !== 'word') return;
        const s = base + c.o + e.charIndex;
        const len = e.charLength || (/^\S+/.exec(c.t.slice(e.charIndex))?.[0].length ?? 1);
        try {
          el.setSelectionRange(s, s + len);
        } catch {
          /* ignore */
        }
        setStatus('Speaking: ' + c.t.substr(e.charIndex, len));
      };
      u.onend = () => {
        i++;
        next();
      };
      u.onerror = (e) => {
        if (stopped.current || e.error === 'canceled' || e.error === 'interrupted') return;
        stop('Could not speak: ' + e.error);
      };
      speechSynthesis.speak(u);
    };
    window.setTimeout(next, 80);
  };

  const togglePause = () => {
    if (!speaking) return;
    if (paused) {
      speechSynthesis.resume();
      setStatus('Speaking...');
    } else {
      speechSynthesis.pause();
      setStatus('Paused.');
    }
    setPaused(!paused);
  };

  const groups: Record<string, SpeechSynthesisVoice[]> = {};
  voices.forEach((v) => (groups[v.lang.split('-')[0].toUpperCase()] ??= []).push(v));
  const current = pickVoice(st.voice)?.voiceURI ?? '';

  return (
    <div className="tts" onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); speak(); } }}>
      <div className="tts-head"><b>Text to Speech</b><small>Type something and hear it read out loud. Ctrl+Enter speaks.</small></div>
      <textarea ref={ta} className="tts-text" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="tts-opts">
        <label>Voice
          <select className="k-input" value={current} onChange={(e) => setSt({ ...st, voice: e.target.value })}>
            {!voices.length && <option>(no voices found)</option>}
            {Object.keys(groups).sort((a, b) => (a === 'EN' ? -1 : b === 'EN' ? 1 : a.localeCompare(b))).map((g) => (
              <optgroup key={g} label={g}>
                {groups[g].map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label>Speed <input type="range" min={0.5} max={2} step={0.1} value={st.rate} onChange={(e) => setSt({ ...st, rate: +e.target.value })} /><em>{st.rate.toFixed(1)}x</em></label>
        <label>Pitch <input type="range" min={0.5} max={2} step={0.1} value={st.pitch} onChange={(e) => setSt({ ...st, pitch: +e.target.value })} /><em>{st.pitch.toFixed(1)}</em></label>
        <label>Volume <input type="range" min={0} max={1} step={0.05} value={st.vol} onChange={(e) => setSt({ ...st, vol: +e.target.value })} /><em>{Math.round(st.vol * 100)}%</em></label>
      </div>
      <div className="k-row tts-btns">
        <button className="k-btn default" disabled={speaking} onClick={speak}>{'▶'} Speak</button>
        <button className="k-btn" disabled={!speaking} onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
        <button className="k-btn" disabled={!speaking} onClick={() => stop()}>Stop</button>
        <span className="k-spacer" />
        <button className="k-btn" onClick={() => setDlg(true)}>Open text file...</button>
        <button className="k-btn" onClick={() => { stop('Ready.'); setText(''); ta.current?.focus(); }}>Clear</button>
      </div>
      <div className="k-status"><div style={{ flex: 1 }}>{status}</div></div>
      {dlg && (
        <FileDialog
          mode="open"
          exts={['txt', 'md', 'log', 'nfo', 'csv', 'htm', 'html', 'py', 'lxo']}
          filterLabel="Text files"
          onDone={(r) => {
            setDlg(false);
            if (r?.node && !r.node.content.startsWith('data:')) {
              setText(r.node.content);
              setStatus('Loaded ' + r.node.name + '.');
              win.setTitle(r.node.name + ' - Text to Speech');
            }
          }}
        />
      )}
    </div>
  );
}

