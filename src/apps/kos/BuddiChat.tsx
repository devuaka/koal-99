// Chat with Buddi.
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import { registry } from '../../core/registry';
import { buddiStore, reply, say, anim, wake, showBuddi } from '../../core/buddi';
import { findApp } from '../terminal/commands';
import { launchApp } from '../../core/launcher';
import { BuddiArt } from '../../ui/Buddi';

const appNames = () => Object.values(registry).filter((d) => !d.hidden && d.id !== 'kbuddi').map((d) => d.name);

export function BuddiChat({ win }: { win: WinCtx }) {
  const name = buddiStore.use((s) => s.name);
  const [log, setLog] = useState<{ who: string; t: string }[]>(() => [{ who: 'Buddi', t: buddiStore.get().name ? `Hi ${buddiStore.get().name}! What would you like to do today?` : 'Hi! I am Buddi, your desktop buddy. What is your name? (Say "my name is ...")' }]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!buddiStore.get().on) showBuddi(false);
  }, []);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log, typing]);

  const send = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    wake();
    setLog((l) => [...l, { who: buddiStore.get().name || 'You', t }]);
    setText('');
    setTyping(true);
    window.setTimeout(() => {
      const r = reply(t, (q) => {
        const id = findApp(q);
        return id ? { id, name: registry[id]?.name ?? q } : null;
      }, appNames, (id) => launchApp(id));
      setTyping(false);
      setLog((l) => [...l, { who: 'Buddi', t: r.t }]);
      if (r.a) anim(r.a, r.a === 'dance' ? 2400 : 900);
      r.run?.();
      say(r.t.length > 90 ? r.t.slice(0, 87) + '...' : r.t, 3500);
    }, 350 + Math.random() * 450);
  };

  return (
    <div className="bch">
      <div className="bch-head">
        <div className="bch-av"><BuddiArt /></div>
        <div><b>Buddi</b><small>{typing ? 'Buddi is typing...' : 'Online'}</small></div>
      </div>
      <div className="bch-log" ref={ref}>
        {log.map((m, i) => (
          <div key={i} className={`bch-m ${m.who === 'Buddi' ? 'bud' : 'you'}`}>
            <b>{m.who === 'Buddi' ? 'Buddi' : name || 'You'}</b>
            <span>{m.t}</span>
          </div>
        ))}
      </div>
      <div className="bch-chips">
        {['Joke', 'Fun fact', 'Tip', 'What can you do?', 'Dance'].map((c) => <button key={c} className="k-btn small" onClick={() => send(c)}>{c}</button>)}
      </div>
      <div className="bch-in">
        <input className="k-input" autoFocus value={text} placeholder="Type a message and press Enter..." onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send(text)} />
        <button className="k-btn default" onClick={() => send(text)}>Send</button>
      </div>
    </div>
  );
}
