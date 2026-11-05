// Peer-to-peer networking with PeerJS's free public broker. No server of our own.
// Peer ids match koalOS ("koalos-<kind>-<code>", "koalos-dir-<kind>", "koalos-user-<id>") so the two can meet.
/* eslint-disable @typescript-eslint/no-explicit-any */
const PEERJS_URL = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
let peerJs: Promise<void> | null = null;

export function loadPeerJS(): Promise<void> {
  if ((window as any).Peer) return Promise.resolve();
  if (!peerJs)
    peerJs = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = PEERJS_URL;
      s.onload = () => res();
      s.onerror = () => {
        peerJs = null;
        rej(new Error('Could not load the connection library. Are you online?'));
      };
      document.head.appendChild(s);
    });
  return peerJs;
}

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const roomCode = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

function newPeer(id?: string, timeout = 12000): Promise<any> {
  return new Promise((res, rej) => {
    const Peer = (window as any).Peer;
    const p = id ? new Peer(id) : new Peer();
    let done = false;
    p.on('open', () => ((done = true), res(p)));
    p.on('error', (e: any) => {
      if (!done) (done = true), rej(e);
    });
    setTimeout(() => {
      if (!done) (done = true), rej(new Error('timeout'));
    }, timeout);
  });
}

type Handler = (...a: any[]) => void;
class Emitter {
  private h: Record<string, Handler[]> = {};
  on(e: string, f: Handler) {
    (this.h[e] ??= []).push(f);
    return this;
  }
  protected emit(e: string, ...a: any[]) {
    for (const f of this.h[e] ?? []) {
      try {
        f(...a);
      } catch (err) {
        console.error(err);
      }
    }
  }
}

export interface Player {
  id: string;
  name?: string;
  [k: string]: unknown;
}

/** A room: one host plus up to max-1 guests, all connected to each other (full mesh). */
export class KoalRoom extends Emitter {
  peer: any = null;
  conns = new Map<string, any>();
  players = new Map<string, Player>();
  max = 4;
  code = '';
  isHost = false;
  dead = false;
  constructor(public kind: string, public info: Record<string, unknown> = {}) {
    super();
  }
  get id(): string {
    return this.peer ? this.peer.id : 'me';
  }
  get count() {
    return this.conns.size + 1;
  }
  async host(): Promise<string> {
    await loadPeerJS();
    for (let i = 0; i < 5 && !this.peer; i++) {
      const code = roomCode();
      try {
        this.peer = await newPeer(`koalos-${this.kind}-${code}`);
        this.code = code;
      } catch (e: any) {
        if (e?.type === 'unavailable-id') continue;
        throw new Error('Could not reach the connection server. Are you online?');
      }
    }
    if (!this.peer) throw new Error('Could not create a room. Please try again.');
    this.isHost = true;
    this.wire();
    return this.code;
  }
  async join(code: string): Promise<void> {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(code)) throw new Error('That does not look like a room code.');
    await loadPeerJS();
    try {
      this.peer = await newPeer();
    } catch {
      throw new Error('Could not reach the connection server. Are you online?');
    }
    this.wire();
    this.code = code;
    await new Promise<void>((res, rej) => {
      const c = this.peer.connect(`koalos-${this.kind}-${code}`, { reliable: true, serialization: 'json' });
      c.initiator = true;
      let fin = false;
      const fail = (m: string) => {
        if (fin) return;
        fin = true;
        clearTimeout(to);
        rej(new Error(m));
      };
      const to = setTimeout(() => fail('Could not find a room with that code.'), 12000);
      this.peer.on('error', (e: any) => e?.type === 'peer-unavailable' && fail('Could not find a room with that code.'));
      c.on('error', () => fail('Could not find a room with that code.'));
      c.on('open', () => {
        if (fin) return;
        fin = true;
        clearTimeout(to);
        this.addConn(c);
        res();
      });
    });
  }
  private wire() {
    this.peer.on('connection', (c: any) =>
      c.on('open', () => {
        if (this.isHost && this.conns.size >= this.max - 1) {
          try {
            c.send({ _: 'full' });
          } catch {
            /* ignore */
          }
          setTimeout(() => c.close(), 400);
          return;
        }
        this.addConn(c);
      }),
    );
    this.peer.on('error', (e: any) => e?.type !== 'peer-unavailable' && this.emit('error', e));
    this.peer.on('disconnected', () => {
      if (!this.dead)
        try {
          this.peer.reconnect();
        } catch {
          /* ignore */
        }
    });
  }
  private addConn(c: any) {
    if (this.conns.has(c.peer)) return void c.close();
    this.conns.set(c.peer, c);
    c.on('data', (d: any) => this.recv(c, d));
    c.on('close', () => this.drop(c.peer));
    c.on('error', () => this.drop(c.peer));
    try {
      c.send({ _: 'hello', info: this.info });
    } catch {
      /* ignore */
    }
  }
  private recv(c: any, d: any) {
    if (d?._) {
      if (d._ === 'full') return this.emit('full');
      if (d._ === 'hello') {
        const p = { id: c.peer, ...(d.info ?? {}) };
        this.players.set(c.peer, p);
        if (this.isHost)
          try {
            c.send({ _: 'roster', peers: [...this.conns.keys()].filter((k) => k !== c.peer) });
          } catch {
            /* ignore */
          }
        this.emit('join', p);
        return;
      }
      if (d._ === 'roster')
        for (const id of d.peers ?? []) {
          if (this.conns.has(id) || id === this.peer.id) continue;
          const cc = this.peer.connect(id, { reliable: true, serialization: 'json' });
          cc.initiator = true;
          cc.on('open', () => this.addConn(cc));
        }
      return;
    }
    this.emit('msg', c.peer, d);
  }
  send(o: unknown) {
    for (const c of this.conns.values())
      if (c.open)
        try {
          c.send(o);
        } catch {
          /* ignore */
        }
  }
  private drop(id: string) {
    if (!this.conns.has(id)) return;
    this.conns.delete(id);
    const p = this.players.get(id);
    this.players.delete(id);
    this.emit('leave', id, p);
  }
  leave() {
    this.dead = true;
    for (const c of this.conns.values())
      try {
        c.close();
      } catch {
        /* ignore */
      }
    this.conns.clear();
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
  }
}

export interface RoomInfo {
  id: string;
  code: string;
  name?: string;
  count?: number;
}

/** A shared "who's hosting" board: the first visitor becomes the well-known directory peer. */
export class RoomDirectory extends Emitter {
  peer: any = null;
  isHost = false;
  conns = new Map<string, any>();
  rooms = new Map<string, RoomInfo>();
  hostConn: any = null;
  dead = false;
  private pending: Omit<RoomInfo, 'id'> | null = null;
  constructor(public kind: string) {
    super();
  }
  async connect() {
    await loadPeerJS();
    const fixed = 'koalos-dir-' + this.kind;
    try {
      this.peer = await newPeer(fixed, 8000);
      this.isHost = true;
      this.peer.on('connection', (c: any) => {
        c.on('open', () => {
          this.conns.set(c.peer, c);
          try {
            c.send({ t: 'list', rooms: [...this.rooms.values()] });
          } catch {
            /* ignore */
          }
        });
        c.on('data', (d: any) => this.onData(c.peer, d));
        c.on('close', () => {
          this.conns.delete(c.peer);
          if (this.rooms.delete(c.peer)) this.broadcast();
          this.emit('update');
        });
      });
    } catch {
      this.peer = await newPeer(undefined, 8000);
      this.isHost = false;
      await new Promise<void>((res, rej) => {
        const c = this.peer.connect(fixed, { reliable: true, serialization: 'json' });
        let fin = false;
        const to = setTimeout(() => !fin && ((fin = true), rej(new Error('timeout'))), 8000);
        c.on('open', () => {
          fin = true;
          clearTimeout(to);
          this.hostConn = c;
          res();
        });
        c.on('data', (d: any) => this.onData(fixed, d));
        c.on('error', () => !fin && ((fin = true), clearTimeout(to), rej(new Error('e'))));
        c.on('close', () => !this.dead && this.emit('update'));
      });
    }
    if (this.pending) this.register();
  }
  private onData(id: string, d: any) {
    if (!d) return;
    if (d.t === 'register') {
      if (d.info) this.rooms.set(id, d.info);
      else this.rooms.delete(id);
      this.broadcast();
      this.emit('update');
    } else if (d.t === 'list') {
      this.rooms = new Map((d.rooms ?? []).map((r: RoomInfo) => [r.id, r]));
      this.emit('update');
    }
  }
  private broadcast() {
    if (!this.isHost) return;
    const rooms = [...this.rooms.values()];
    for (const c of this.conns.values())
      try {
        c.send({ t: 'list', rooms });
      } catch {
        /* ignore */
      }
  }
  register(info?: Omit<RoomInfo, 'id'>) {
    if (info) this.pending = info;
    if (!this.peer || !this.pending) return;
    const mine = { id: this.peer.id, ...this.pending };
    if (this.isHost) {
      this.rooms.set(this.peer.id, mine);
      this.broadcast();
      this.emit('update');
    } else
      try {
        this.hostConn?.send({ t: 'register', info: mine });
      } catch {
        /* ignore */
      }
  }
  /** Takes your room off the board but keeps watching the list. */
  unregister() {
    this.pending = null;
    if (!this.peer) return;
    if (this.isHost) {
      this.rooms.delete(this.peer.id);
      this.broadcast();
      this.emit('update');
    } else
      try {
        this.hostConn?.send({ t: 'register', info: null });
      } catch {
        /* ignore */
      }
  }
  leave() {
    this.dead = true;
    if (this.isHost) {
      this.rooms.delete(this.peer?.id);
      this.broadcast();
      for (const c of this.conns.values())
        try {
          c.close();
        } catch {
          /* ignore */
        }
    } else
      try {
        this.hostConn?.send({ t: 'register', info: null });
      } catch {
        /* ignore */
      }
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
  }
}

// ---------- presence: your permanent KOAL-99 ID, so friends can invite you ----------
const MY_ID_KEY = 'koalos.myid';
export function myKoalId(): string {
  let id = '';
  try {
    id = localStorage.getItem(MY_ID_KEY) ?? '';
  } catch {
    /* ignore */
  }
  if (!id) {
    id = roomCode();
    try {
      localStorage.setItem(MY_ID_KEY, id);
    } catch {
      /* ignore */
    }
  }
  return id;
}

export interface Invite {
  t: 'invite';
  from?: string;
  game: string;
  code: string;
}

class Presence extends Emitter {
  peer: any = null;
  private starting: Promise<any> | null = null;
  async start() {
    if (this.peer) return this.peer;
    if (this.starting) return this.starting;
    this.starting = (async () => {
      await loadPeerJS();
      const p = await newPeer('koalos-user-' + myKoalId(), 8000);
      p.on('connection', (c: any) => c.on('data', (d: any) => d?.t === 'invite' && this.emit('invite', d)));
      this.peer = p;
      return p;
    })();
    try {
      return await this.starting;
    } finally {
      this.starting = null;
    }
  }
  async invite(friendId: string, info: Omit<Invite, 't'>): Promise<boolean> {
    await loadPeerJS();
    let p = this.peer;
    if (!p) {
      try {
        p = await this.start();
      } catch {
        p = await newPeer(undefined, 8000);
      }
    }
    return new Promise((res) => {
      try {
        const c = p.connect('koalos-user-' + friendId, { reliable: true, serialization: 'json' });
        let done = false;
        c.on('open', () => {
          done = true;
          try {
            c.send({ t: 'invite', ...info });
          } catch {
            /* ignore */
          }
          setTimeout(() => c.close(), 600);
          res(true);
        });
        c.on('error', () => !done && ((done = true), res(false)));
        setTimeout(() => !done && ((done = true), res(false)), 7000);
      } catch {
        res(false);
      }
    });
  }
}
export const presence = new Presence();
