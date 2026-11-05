// Friends: your permanent ID, a friends list, and invites straight into a game.
import { useEffect, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import { myKoalId } from '../../core/net';
import { INVITE_GAMES, inviteFriend, startPresence } from '../../core/invites';
import { currentProfile } from '../../core/settings';
import { Icon } from '../../ui/Icon';

const KEY = 'koalos.friends';
interface State {
  name: string;
  list: { id: string; name: string }[];
}
const load = (): State => {
  try {
    return { name: currentProfile()?.displayName ?? '', list: [], ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<State>) };
  } catch {
    return { name: '', list: [] };
  }
};

export function Friends({ win }: { win: WinCtx }) {
  const [st, setSt] = useState<State>(load);
  const [addId, setAddId] = useState('');
  const [addName, setAddName] = useState('');
  const [msg, setMsg] = useState('');
  const [game, setGame] = useState<Record<string, string>>({});
  const myId = myKoalId();
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch {
      /* ignore */
    }
  }, [st]);
  useEffect(() => startPresence(true), []);

  const add = () => {
    const id = addId.trim().toUpperCase();
    if (!id) return setMsg("Type your friend's ID first.");
    if (id === myId) return setMsg("That's your own ID!");
    if (st.list.some((f) => f.id === id)) return setMsg('Already on your list.');
    setSt({ ...st, list: [...st.list, { id, name: addName.trim() || id }] });
    setAddId('');
    setAddName('');
    setMsg('Added!');
  };

  return (
    <div className="frn">
      <div className="frn-head"><Icon name="friends" size={40} /><div><b>Friends</b><small>Invite people straight into a game.</small></div></div>
      <div className="frn-card">
        <span>Your ID</span>
        <input className="k-input frn-id" readOnly value={myId} onFocus={(e) => e.currentTarget.select()} />
        <button className="k-btn small" onClick={async () => { try { await navigator.clipboard.writeText(myId); setMsg('Copied! Share it with a friend so they can add you.'); } catch { setMsg('Your ID is ' + myId); } }}>Copy</button>
        <button className="k-btn small" onClick={() => { location.href = 'mailto:?subject=' + encodeURIComponent('Add me on KOAL-99') + '&body=' + encodeURIComponent(`Add me as a friend on KOAL-99 (or koalOS)!\n\nMy ID: ${myId}\n\nOpen the Friends app and type in my ID to add me.`); }}>Email it</button>
      </div>
      <label className="frn-name">Your name <input className="k-input" maxLength={16} value={st.name} onChange={(e) => setSt({ ...st, name: e.target.value })} placeholder="Your name" /></label>
      <div className="frn-add">
        <input className="k-input" maxLength={10} placeholder="Friend's ID" value={addId} onChange={(e) => setAddId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input className="k-input" maxLength={16} placeholder="Nickname" value={addName} onChange={(e) => setAddName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="k-btn default" onClick={add}>Add</button>
      </div>
      <div className="frn-list">
        {!st.list.length && <div className="frn-empty">No friends yet. Add one by their ID above.</div>}
        {st.list.map((f) => (
          <div key={f.id} className="frn-row">
            <Icon name="user" size={28} />
            <div className="frn-who"><b>{f.name}</b><small>{f.id}</small></div>
            <select className="k-input" value={game[f.id] ?? 'chat'} onChange={(e) => setGame({ ...game, [f.id]: e.target.value })}>
              {Object.entries(INVITE_GAMES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
            <button className="k-btn small" onClick={async () => { setMsg(`Inviting ${f.name}...`); const r = await inviteFriend(f.id, game[f.id] ?? 'chat', (st.name || 'Player').trim() || 'Player'); setMsg(r.msg); }}>Invite</button>
            <button className="k-btn small" title="Remove" onClick={() => setSt({ ...st, list: st.list.filter((x) => x.id !== f.id) })}>{'✕'}</button>
          </div>
        ))}
      </div>
      <div className="k-status"><div style={{ flex: 1 }}>{msg || 'You are online, so friends can invite you while KOAL-99 is open.'}</div></div>
    </div>
  );
}
