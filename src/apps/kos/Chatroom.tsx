// Chatroom: host or join a room by code and chat with everyone in it (peer to peer, up to 12 people).
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import { KoalRoom, RoomDirectory, RoomInfo } from '../../core/net';
import { hostRequests } from '../../core/invites';
import { currentProfile } from '../../core/settings';
import { play } from '../../core/sound';

const PROFILE_KEY = 'koalos.chat';
type Line = { kind: 'sys' | 'me' | 'them'; name?: string; text: string; at: number };

export function Chatroom({ win }: { win: WinCtx }) {
  const [name, setName] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}').name as string) || currentProfile()?.displayName || '';
    } catch {
      return '';
    }
  });
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ t: string; err?: boolean }>({ t: '' });
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [room, setRoom] = useState<KoalRoom | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [count, setCount] = useState(1);
  const [text, setText] = useState('');
  const dir = useRef<RoomDirectory | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<KoalRoom | null>(null);
  roomRef.current = room;

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ name }));
    } catch {
      /* ignore */
    }
  }, [name]);
  useEffect(() => {
    const d = new RoomDirectory('chat');
    dir.current = d;
    d.on('update', () => setRooms([...d.rooms.values()]));
    d.connect().then(() => setRooms([...d.rooms.values()])).catch(() => setRooms([]));
    return () => {
      d.leave();
      roomRef.current?.leave();
    };
  }, []);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);
  useEffect(() => {
    win.setTitle(room ? `Chatroom - ${room.code}` : 'Chatroom');
  }, [room]);
  // invites: auto host (from Friends) or auto join (accepted invite)
  useEffect(() => {
    if (win.props.autoHost && !roomRef.current) go('host');
    else if (win.props.joinCode && !roomRef.current) go('join', win.props.joinCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props._nonce]);

  const myName = () => ((name || 'Player').trim() || 'Player').slice(0, 16);
  const add = (l: Omit<Line, 'at'>) => setLines((ls) => [...ls, { ...l, at: Date.now() }]);

  const wire = (r: KoalRoom) => {
    r.on('join', (p) => {
      add({ kind: 'sys', text: `${p.name ?? 'Someone'} joined the chat.` });
      setCount(r.count);
      play('notify');
    });
    r.on('leave', (_id, p) => {
      add({ kind: 'sys', text: `${p?.name ?? 'Someone'} left the chat.` });
      setCount(r.count);
    });
    r.on('msg', (id, d) => {
      if (d?.t !== 'chat') return;
      add({ kind: 'them', name: r.players.get(id)?.name ?? 'Someone', text: String(d.text).slice(0, 300) });
      if (!win.focused) play('click');
    });
  };

  async function go(mode: 'host' | 'join', joinCode = code) {
    try {
      const r = new KoalRoom('chat', { name: myName() });
      r.max = 12;
      if (mode === 'host') {
        setMsg({ t: 'Creating your room...' });
        await r.host();
        wire(r);
        const reg = () => dir.current?.register({ code: r.code, name: myName() + "'s room", count: r.count });
        reg();
        r.on('join', reg).on('leave', reg);
        hostRequests.get('kchat')?.(r.code);
        hostRequests.delete('kchat');
      } else {
        if (!joinCode.trim()) return setMsg({ t: 'Type the room code first.', err: true });
        setMsg({ t: 'Joining...' });
        r.on('full', () => setMsg({ t: 'That room is full.', err: true }));
        await r.join(joinCode);
        wire(r);
      }
      setLines([{ kind: 'sys', text: mode === 'host' ? `Room ${r.code} is open. Share the code so people can join. Say hi!` : 'You joined. Say hi!', at: Date.now() }]);
      setCount(r.count);
      setRoom(r);
      setMsg({ t: '' });
    } catch (e) {
      setMsg({ t: (e as Error).message || 'Something went wrong.', err: true });
    }
  }

  const leave = () => {
    room?.leave();
    setRoom(null);
    setLines([]);
  };
  const send = () => {
    const t = text.trim();
    if (!t || !room) return;
    setText('');
    add({ kind: 'me', name: myName(), text: t });
    room.send({ t: 'chat', text: t });
  };

  if (!room)
    return (
      <div className="chat-lobby">
        <h2>Chatroom</h2>
        <p>Hop into a room and chat with whoever else is there, old-school style. Rooms are peer to peer: nothing is stored on a server.</p>
        <label>Your name <input className="k-input" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></label>
        <div className="k-row">
          <button className="k-btn default" onClick={() => go('host')}>Host a room</button>
          <span>or</span>
          <input className="k-input" maxLength={10} placeholder="Room code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && go('join')} />
          <button className="k-btn" onClick={() => go('join')}>Join</button>
        </div>
        {msg.t && <div className={`chat-msg ${msg.err ? 'err' : ''}`}>{msg.t}</div>}
        <div className="chat-rooms">
          <b>Open rooms</b>
          {rooms === null && <small>Looking for rooms...</small>}
          {rooms?.length === 0 && <small>No open rooms right now. Host one!</small>}
          {rooms?.map((r) => (
            <div key={r.id} className="chat-room">
              <b>{r.name ?? 'Room'}</b>
              <span>{r.count ?? 1} online</span>
              <button className="k-btn small" onClick={() => go('join', r.code)}>Join</button>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="chat-room-view">
      <div className="chat-head">
        <b>Room {room.code}</b>
        <span>{count} online</span>
        <span className="k-spacer" />
        <button className="k-btn small" onClick={() => navigator.clipboard?.writeText(room.code).catch(() => {})}>Copy code</button>
        <button className="k-btn small" onClick={leave}>Leave</button>
      </div>
      <div className="chat-log" ref={logRef}>
        {lines.map((l, i) =>
          l.kind === 'sys' ? (
            <div key={i} className="chat-line sys">{l.text}</div>
          ) : (
            <div key={i} className={`chat-line ${l.kind}`}>
              <b>{l.name}</b>
              <span>{l.text}</span>
              <small>{new Date(l.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
            </div>
          ),
        )}
      </div>
      <div className="chat-in">
        <input className="k-input" autoFocus maxLength={300} value={text} placeholder="Type a message..." onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="k-btn default" onClick={send}>Send</button>
      </div>
    </div>
  );
}
