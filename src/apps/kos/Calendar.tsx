// Calendar: month view with per-day events (kept per user).
import { useEffect, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import { userName } from '../../core/session';

type Events = Record<string, { id: string; text: string; time?: string }[]>;
const key = () => 'koal99.calendar.' + userName();
const load = (): Events => {
  try {
    return JSON.parse(localStorage.getItem(key()) ?? '{}') as Events;
  } catch {
    return {};
  }
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function CalendarApp({ win }: { win: WinCtx }) {
  const today = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [sel, setSel] = useState(ymd(today));
  const [ev, setEv] = useState<Events>(load);
  const [text, setText] = useState('');
  const [time, setTime] = useState('');
  useEffect(() => {
    try {
      localStorage.setItem(key(), JSON.stringify(ev));
    } catch {
      /* ignore */
    }
  }, [ev]);

  const first = view.getDay();
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));
  const list = (ev[sel] ?? []).slice().sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const add = () => {
    if (!text.trim()) return;
    setEv({ ...ev, [sel]: [...(ev[sel] ?? []), { id: Date.now().toString(36), text: text.trim(), time: time || undefined }] });
    setText('');
    setTime('');
  };
  const selDate = new Date(sel + 'T00:00:00');

  return (
    <div className="cal">
      <div className="cal-month">
        <div className="cal-head">
          <button className="k-btn small" onClick={() => shift(-1)}>{'◀'}</button>
          <b>{view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b>
          <button className="k-btn small" onClick={() => shift(1)}>{'▶'}</button>
          <button className="k-btn small" onClick={() => { setView(new Date(today.getFullYear(), today.getMonth(), 1)); setSel(ymd(today)); }}>Today</button>
        </div>
        <div className="cal-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="cal-wd">{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const k = ymd(new Date(view.getFullYear(), view.getMonth(), d));
            const isToday = k === ymd(today);
            return (
              <div key={i} className={`cal-d ${isToday ? 'today' : ''} ${k === sel ? 'sel' : ''}`} onClick={() => setSel(k)}>
                {d}
                {!!ev[k]?.length && <span className="cal-dot">{ev[k].length}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="cal-side">
        <b>{selDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</b>
        <div className="cal-list">
          {!list.length && <div className="cal-empty">Nothing planned.</div>}
          {list.map((e) => (
            <div key={e.id} className="cal-ev">
              {e.time && <small>{e.time}</small>}
              <span>{e.text}</span>
              <b title="Delete" onClick={() => setEv({ ...ev, [sel]: (ev[sel] ?? []).filter((x) => x.id !== e.id) })}>{'✕'}</b>
            </div>
          ))}
        </div>
        <input className="k-input" placeholder="New event..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <div className="k-row">
          <input className="k-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <button className="k-btn default" onClick={add}>Add</button>
        </div>
      </div>
    </div>
  );
}
