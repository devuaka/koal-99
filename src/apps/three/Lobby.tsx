// The "host / join / play alone" lobby shared by the multiplayer 3D games, with a live list of open rooms.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { KoalRoom, RoomDirectory, RoomInfo } from '../../core/net';

export interface LobbyResult {
  room: KoalRoom | null;
  name: string;
  dir: RoomDirectory | null;
}

export function RoomLobby(props: {
  kind: string;
  title: string;
  blurb: string;
  nameKey: string;
  max: number;
  info: () => Record<string, unknown>;
  soloLabel: string;
  hint: ReactNode;
  children?: ReactNode;
  /** From a friend's invite: join this room straight away. */
  autoJoin?: string;
  /** Inviting a friend: host straight away and report the code. */
  autoHost?: boolean;
  onHosted?(code: string): void;
  onStart(r: LobbyResult): void;
}) {
  const [name, setName] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(props.nameKey) || '{}').name || '';
    } catch {
      return '';
    }
  });
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ t: string; err?: boolean }>({ t: '' });
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const dir = useRef<RoomDirectory | null>(null);
  const handed = useRef(false);

  useEffect(() => {
    const d = new RoomDirectory(props.kind);
    dir.current = d;
    d.on('update', () => setRooms([...d.rooms.values()]));
    d.connect()
      .then(() => setRooms([...d.rooms.values()]))
      .catch(() => setRooms([]));
    if (props.autoJoin) (setCode(props.autoJoin), go('join', props.autoJoin));
    else if (props.autoHost) go('host');
    return () => {
      if (!handed.current) d.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myName = () => (name.trim() || 'Player').slice(0, 16);
  const saveName = (v: string) => {
    setName(v);
    try {
      const o = JSON.parse(localStorage.getItem(props.nameKey) || '{}');
      localStorage.setItem(props.nameKey, JSON.stringify({ ...o, name: v }));
    } catch {
      /* ignore */
    }
  };
  const finish = (room: KoalRoom | null) => {
    handed.current = true;
    props.onStart({ room, name: myName(), dir: dir.current });
  };
  const go = async (mode: 'host' | 'join', c = code) => {
    if (busy) return;
    if (mode === 'join' && !c.trim()) return setMsg({ t: 'Type the room code your friend sent you.', err: true });
    setBusy(true);
    setMsg({ t: mode === 'host' ? 'Creating your room...' : 'Joining...' });
    const room = new KoalRoom(props.kind, { name: myName(), ...props.info() });
    room.max = props.max;
    try {
      if (mode === 'host') {
        await room.host();
        const reg = () => dir.current?.register({ code: room.code, name: myName(), count: room.count });
        reg();
        room.on('join', reg).on('leave', reg);
        props.onHosted?.(room.code);
      } else {
        room.on('full', () => setMsg({ t: `That room is full (${props.max} players max).`, err: true }));
        await room.join(c.trim());
      }
      finish(room);
    } catch (e: any) {
      room.leave();
      setMsg({ t: e?.message || 'Something went wrong.', err: true });
    }
    setBusy(false);
  };

  return (
    <div className="r3-lobby">
      <h2>{props.title}</h2>
      <p>{props.blurb}</p>
      <label className="r3-row">
        Your name <input className="k-input" maxLength={16} placeholder="Your name" value={name} onChange={(e) => saveName(e.target.value)} />
      </label>
      {props.children}
      <div className="r3-btns">
        <button className="k-btn default" disabled={busy} onClick={() => go('host')}>Host a room</button>
        <span>or</span>
        <input className="k-input" maxLength={10} placeholder="Room code" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go('join')} />
        <button className="k-btn" disabled={busy} onClick={() => go('join')}>Join</button>
      </div>
      <button className="k-btn" disabled={busy} onClick={() => finish(null)}>{props.soloLabel}</button>
      <div className={'r3-msg' + (msg.err ? ' err' : '')}>{msg.t}</div>
      <div className="r3-rooms">
        <b>Open rooms</b>
        {rooms === null && <small>Looking for rooms...</small>}
        {rooms?.length === 0 && <small>No open rooms right now. Host one!</small>}
        {rooms?.map((r) => (
          <div key={r.id} className="r3-room">
            <b>{r.name || 'Room'}</b>
            <span>{(r.count || 1) + ' / ' + props.max}</span>
            <button className="k-btn" disabled={busy} onClick={() => (setCode(r.code), go('join', r.code))}>Join</button>
          </div>
        ))}
      </div>
      <small className="r3-hint">{props.hint}</small>
    </div>
  );
}
