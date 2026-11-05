// Pong and Chess: play the computer, or a friend online with a room code (same rooms as koalOS).
import { KoalRoom } from '../../core/net';
import { GameApi, GameDef, gloss, label, orb, sky } from './kit';

const TAU = Math.PI * 2;

/** The "how do you want to play" box shared by Pong and Chess. */
function lobbyUI(o: { title: string; note: string; msg: string; busy: boolean; onCpu(): void; onHost(): void; onJoin(code: string): void }) {
  // read the code from the box itself, so a re-render never loses what was typed
  const codeOf = (el: HTMLElement) => (el.closest('.kgh-join')?.querySelector('input') as HTMLInputElement | null)?.value ?? '';
  return (
    <div className="kgh-dlg">
      <div className="kgh-dt">{o.title}</div>
      <div className="kgh-db">
        <p>Choose how to play</p>
        <button className="k-btn default" disabled={o.busy} onClick={o.onCpu}>Play the computer</button>
        <button className="k-btn" disabled={o.busy} onClick={o.onHost}>Host an online game</button>
        <div className="kgh-join">
          <input className="k-input" maxLength={10} placeholder="Room code" spellCheck={false} onKeyDown={(e) => e.key === 'Enter' && o.onJoin(e.currentTarget.value)} />
          <button className="k-btn" disabled={o.busy} onClick={(e) => o.onJoin(codeOf(e.currentTarget))}>Join a friend</button>
        </div>
        <small>{o.msg || o.note}</small>
      </div>
    </div>
  );
}

/** Connects a 2-player room. Resolves once hosting (code ready) or joined. */
async function connect(kind: string, host: boolean, code: string, a: GameApi, onMsg: (d: any) => void, onJoin: () => void, onLeave: () => void) {
  const room = new KoalRoom(kind, { name: host ? 'Host' : 'Guest' });
  room.max = 2;
  room.on('msg', (_id: string, d: any) => onMsg(d)).on('leave', onLeave).on('full', () => a.over('That game is full'));
  if (host) {
    const c = await room.host();
    room.on('join', onJoin);
    return { room, code: c };
  }
  await room.join(code);
  return { room, code: code.toUpperCase() };
}

export const pong: GameDef = {
  id: 'pong',
  name: 'Pong',
  w: 600,
  h: 400,
  badge: 'Online multiplayer',
  blurb: 'Play the computer, or a friend online with a room code.',
  help: 'Move your paddle with the mouse, or W / S or the arrow keys. First to 7 points wins. Online: one player hosts and shares the code, the other joins with it.',
  make(a) {
    const H = 60;
    let mode: 'menu' | 'wait' | 'cpu' | 'online' = 'menu', role: 'host' | 'guest' = 'host', code = '', msg = '', busy = false, ended = false;
    let room: KoalRoom | null = null;
    let py = 170, ay = 170, bx = 300, by = 200, vx = 0, vy = 0, ps = 0, as = 0, cd = 0, tx = 300, ty = 200, lastSend = 0, t = 0;
    const serve = (d: number) => {
      bx = 300;
      by = 200;
      vx = 260 * d;
      vy = a.rnd(-160, 160);
      cd = 0.9;
    };
    const setMine = (y: number) => {
      y = Math.max(0, Math.min(400 - H, y));
      if (role === 'host') py = y;
      else ay = y;
    };
    const begin = (m: typeof mode) => {
      mode = m;
      ps = as = 0;
      py = ay = 170;
      ended = false;
      serve(Math.random() < 0.5 ? 1 : -1);
      a.refresh();
    };
    const finish = () => {
      ended = true;
      if (mode === 'cpu') a.over(ps >= 7 ? 'You win!' : 'The computer wins');
      else a.over((role === 'host' ? ps >= 7 : as >= 7) ? 'You win!' : 'Your friend wins');
    };
    const physics = (dt: number) => {
      if (cd > 0) return void (cd -= dt);
      bx += vx * dt;
      by += vy * dt;
      if (by < 6) (by = 6), (vy = Math.abs(vy));
      if (by > 394) (by = 394), (vy = -Math.abs(vy));
      if (vx < 0 && bx < 28 && bx > 14 && by > py - 4 && by < py + H + 4) {
        vx = Math.abs(vx) * 1.06;
        vy += ((by - (py + H / 2)) / (H / 2)) * 180;
        bx = 28;
      }
      if (vx > 0 && bx > 572 && bx < 586 && by > ay - 4 && by < ay + H + 4) {
        vx = -Math.abs(vx) * 1.06;
        vy += ((by - (ay + H / 2)) / (H / 2)) * 180;
        bx = 572;
      }
      if (bx < -10) {
        as++;
        serve(1);
        if (as >= 7) finish();
      }
      if (bx > 610) {
        ps++;
        if (mode === 'cpu' || role === 'host') a.addScore(10);
        serve(-1);
        if (ps >= 7) finish();
      }
    };
    const onMsg = (d: any) => {
      if (!d) return;
      if (role === 'host' && d.t === 'p') ay = Math.max(0, Math.min(400 - H, d.y));
      else if (role === 'guest' && d.t === 's') {
        tx = d.bx;
        ty = d.by;
        py = d.py;
        cd = d.cd || 0;
        if (d.as > as) a.addScore(10 * (d.as - as));
        ps = d.ps;
        as = d.as;
        if (d.end && !ended) {
          ended = true;
          a.over(as >= 7 ? 'You win!' : 'Your friend wins');
        }
      }
    };
    const onLeave = () => {
      if (!ended && (mode === 'online' || mode === 'wait')) {
        ended = true;
        a.over('Your friend left the game');
      }
    };
    const net = async (host: boolean, codeIn = '') => {
      if (!host && !codeIn.trim()) return ((msg = 'Type the room code first.'), a.refresh());
      busy = true;
      msg = host ? 'Creating your room...' : 'Joining...';
      a.refresh();
      try {
        const r = await connect('pong', host, codeIn.trim(), a, onMsg, () => mode === 'wait' && begin('online'), onLeave);
        room = r.room;
        code = r.code;
        role = host ? 'host' : 'guest';
        if (host) mode = 'wait';
        else begin('online');
      } catch (e: any) {
        msg = e?.message || 'Something went wrong.';
      }
      busy = false;
      a.refresh();
    };
    const paddle = (x: number, y: number, col: string) => gloss(a.ctx, x, y, 11, H, 5.5, col, 'rgba(255,255,255,.5)');
    return {
      destroy() {
        room?.leave();
        room = null;
      },
      dbg: () => ({ mode, code, ps, as, bx, by, py, ay, role, ended }),
      overlay: () => (mode === 'menu' ? lobbyUI({ title: 'Pong', note: 'Online: one player hosts and shares the code, the other joins with it.', msg, busy, onCpu: () => ((role = 'host'), begin('cpu')), onHost: () => net(true), onJoin: (c) => net(false, c) }) : null),
      pointer(_t, _x, y) {
        if (mode === 'cpu' || mode === 'online') setMine(y - H / 2);
      },
      update(dt) {
        t += dt;
        if (mode === 'menu' || mode === 'wait') return;
        const k = a.keys;
        let dy = 0;
        if (k.w || k.ArrowUp) dy -= 360 * dt;
        if (k.s || k.ArrowDown) dy += 360 * dt;
        if (dy) setMine((role === 'host' ? py : ay) + dy);
        if (mode === 'cpu') {
          ay += Math.max(-230 * dt, Math.min(230 * dt, by - H / 2 - ay));
          ay = Math.max(0, Math.min(400 - H, ay));
          physics(dt);
          return a.info(ps + ' : ' + as);
        }
        const now = performance.now();
        if (role === 'host') {
          physics(dt);
          if (now - lastSend > 33) (lastSend = now), room?.send({ t: 's', bx, by, py, ps, as, cd: Math.max(0, cd), end: ended });
        } else {
          bx += (tx - bx) * Math.min(1, dt * 22);
          by += (ty - by) * Math.min(1, dt * 22);
          if (now - lastSend > 33) (lastSend = now), room?.send({ t: 'p', y: ay });
        }
        a.info(ps + ' : ' + as + '   ·   Room ' + code);
      },
      draw(c) {
        sky(c, 600, 400, '#0f3d8c', '#062048');
        c.strokeStyle = 'rgba(255,255,255,.25)';
        c.setLineDash([8, 10]);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(300, 0);
        c.lineTo(300, 400);
        c.stroke();
        c.setLineDash([]);
        if (mode === 'menu') return label(c, 'PONG', 300, 110, 64, '#bfe6ff');
        if (mode === 'wait') {
          label(c, 'Waiting for a friend...', 300, 140, 22);
          label(c, code, 300, 205, 46, '#ffe14d');
          label(c, 'Tell your friend to open koal.games/pong and join with this code.', 300, 250, 13, '#cfe4ff', 'center', false);
          return;
        }
        paddle(13, py, '#5fc0ff');
        paddle(576, ay, '#ff9d6a');
        orb(c, bx, by, 8, '#ffffff', 'rgba(0,60,140,.5)');
        c.globalAlpha = 0.45;
        label(c, ps, 230, 52, 40);
        label(c, as, 370, 52, 40);
        c.globalAlpha = 1;
        const me = mode === 'cpu' ? ['You', 'Computer'] : [role === 'host' ? 'You' : 'Friend', role === 'guest' ? 'You' : 'Friend'];
        label(c, me[0], 60, 386, 12, '#d6ecff', 'center', false);
        label(c, me[1], 540, 386, 12, '#d6ecff', 'center', false);
        if (cd > 0.05) label(c, 'Get ready', 300, 330, 28);
      },
    };
  },
};

// ---------------- Chess ----------------
type Board = (string | null)[][];
interface Move {
  fr: number;
  fc: number;
  tr: number;
  tc: number;
  flag?: string;
  promo?: boolean;
}
interface St {
  castle: Record<string, boolean>;
  ep: number[] | null;
}
const DIRS: Record<string, number[][]> = { r: [[1, 0], [-1, 0], [0, 1], [0, -1]], b: [[1, 1], [1, -1], [-1, 1], [-1, -1]] };
DIRS.q = DIRS.r.concat(DIRS.b);
DIRS.k = DIRS.q;
const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const inb = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const opp = (c: string) => (c === 'w' ? 'b' : 'w');
const initBoard = (): Board => {
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const bd: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    bd[0][c] = 'b' + back[c];
    bd[1][c] = 'bp';
    bd[6][c] = 'wp';
    bd[7][c] = 'w' + back[c];
  }
  return bd;
};
function attacks(bd: Board, color: string) {
  const set = new Set<string>();
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = bd[r][c];
      if (!p || p[0] !== color) continue;
      const t = p[1];
      const one = (ds: number[][]) => ds.forEach(([dr, dc]) => inb(r + dr, c + dc) && set.add(r + dr + ',' + (c + dc)));
      if (t === 'p') one(color === 'w' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
      else if (t === 'n') one(KN);
      else if (t === 'k') one(DIRS.k);
      else
        DIRS[t].forEach(([dr, dc]) => {
          let rr2 = r + dr, cc = c + dc;
          while (inb(rr2, cc)) {
            set.add(rr2 + ',' + cc);
            if (bd[rr2][cc]) break;
            rr2 += dr;
            cc += dc;
          }
        });
    }
  return set;
}
function pseudoMoves(bd: Board, r: number, c: number, st: St): Move[] {
  const p = bd[r][c];
  if (!p) return [];
  const color = p[0], t = p[1], out: Move[] = [];
  const add = (tr: number, tc: number, flag?: string) => out.push({ fr: r, fc: c, tr, tc, flag });
  if (t === 'p') {
    const dr = color === 'w' ? -1 : 1, start = color === 'w' ? 6 : 1, last = color === 'w' ? 0 : 7;
    if (inb(r + dr, c) && !bd[r + dr][c]) {
      add(r + dr, c);
      if (r === start && !bd[r + 2 * dr][c]) add(r + 2 * dr, c, 'double');
    }
    for (const dc of [-1, 1]) {
      const tr = r + dr, tc = c + dc;
      if (!inb(tr, tc)) continue;
      if (bd[tr][tc] && bd[tr][tc]![0] !== color) add(tr, tc, 'cap');
      else if (st.ep && st.ep[0] === tr && st.ep[1] === tc) add(tr, tc, 'ep');
    }
    out.forEach((m) => m.tr === last && (m.promo = true));
    return out;
  }
  if (t === 'n' || t === 'k') {
    (t === 'n' ? KN : DIRS.k).forEach(([dr, dc]) => {
      const tr = r + dr, tc = c + dc;
      if (inb(tr, tc) && (!bd[tr][tc] || bd[tr][tc]![0] !== color)) add(tr, tc);
    });
    const rr2 = color === 'w' ? 7 : 0;
    if (t === 'k' && r === rr2 && c === 4) {
      const at = () => attacks(bd, opp(color));
      if (st.castle[color + 'k'] && !bd[rr2][5] && !bd[rr2][6] && bd[rr2][7] === color + 'r') {
        const s = at();
        if (![4, 5, 6].some((x) => s.has(rr2 + ',' + x))) add(rr2, 6, 'O-O');
      }
      if (st.castle[color + 'q'] && !bd[rr2][1] && !bd[rr2][2] && !bd[rr2][3] && bd[rr2][0] === color + 'r') {
        const s = at();
        if (![4, 3, 2].some((x) => s.has(rr2 + ',' + x))) add(rr2, 2, 'O-O-O');
      }
    }
    return out;
  }
  DIRS[t].forEach(([dr, dc]) => {
    let tr = r + dr, tc = c + dc;
    while (inb(tr, tc)) {
      if (!bd[tr][tc]) add(tr, tc);
      else {
        if (bd[tr][tc]![0] !== color) add(tr, tc, 'cap');
        break;
      }
      tr += dr;
      tc += dc;
    }
  });
  return out;
}
function applyMove(bd: Board, st: St, m: Move): { board: Board; castle: Record<string, boolean>; ep: number[] | null } {
  const nb = bd.map((r) => r.slice()), p = nb[m.fr][m.fc]!, color = p[0];
  if (m.flag === 'ep') nb[m.fr][m.tc] = null;
  nb[m.tr][m.tc] = m.promo ? color + 'q' : p;
  nb[m.fr][m.fc] = null;
  const castle = { ...st.castle };
  if (p[1] === 'k') {
    castle[color + 'k'] = castle[color + 'q'] = false;
    if (m.flag === 'O-O') (nb[m.tr][5] = color + 'r'), (nb[m.tr][7] = null);
    if (m.flag === 'O-O-O') (nb[m.tr][3] = color + 'r'), (nb[m.tr][0] = null);
  }
  if (p[1] === 'r') {
    if (m.fc === 0) castle[color + 'q'] = false;
    if (m.fc === 7) castle[color + 'k'] = false;
  }
  if (m.tr === 0 && m.tc === 0) castle.bq = false;
  if (m.tr === 0 && m.tc === 7) castle.bk = false;
  if (m.tr === 7 && m.tc === 0) castle.wq = false;
  if (m.tr === 7 && m.tc === 7) castle.wk = false;
  return { board: nb, castle, ep: m.flag === 'double' ? [(m.fr + m.tr) / 2, m.fc] : null };
}
const kingPos = (bd: Board, color: string) => {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (bd[r][c] === color + 'k') return [r, c];
  return [0, 0];
};
function legalMoves(bd: Board, st: St, color: string) {
  const out: Move[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = bd[r][c];
      if (!p || p[0] !== color) continue;
      for (const m of pseudoMoves(bd, r, c, st)) {
        const nb = applyMove(bd, st, m).board, kp = kingPos(nb, color);
        if (!attacks(nb, opp(color)).has(kp[0] + ',' + kp[1])) out.push(m);
      }
    }
  return out;
}
const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const evalBoard = (bd: Board) => {
  let s = 0;
  for (const row of bd) for (const p of row) if (p) s += (p[0] === 'w' ? 1 : -1) * VAL[p[1]];
  return s;
};
function negamax(bd: Board, st: St, color: string, depth: number, al: number, be: number): number {
  const moves = legalMoves(bd, st, color);
  if (!moves.length) {
    const kp = kingPos(bd, color);
    return attacks(bd, opp(color)).has(kp[0] + ',' + kp[1]) ? -9999 - depth : 0;
  }
  if (!depth) return (color === 'w' ? 1 : -1) * evalBoard(bd);
  let best = -1e9;
  for (const m of moves) {
    const n = applyMove(bd, st, m);
    best = Math.max(best, -negamax(n.board, { castle: n.castle, ep: n.ep }, opp(color), depth - 1, -be, -al));
    al = Math.max(al, best);
    if (al >= be) break;
  }
  return best;
}
const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

export const chess: GameDef = {
  id: 'chess',
  name: 'Chess',
  w: 480,
  h: 560,
  badge: 'Online multiplayer',
  blurb: 'Play the computer, or a friend online with a room code.',
  help: 'Click one of your pieces, then click a highlighted square to move it. Online: you play White when you host, Black when you join.',
  make(a) {
    const SQ = 50, OX = (480 - SQ * 8) / 2, OY = 52;
    let mode: 'menu' | 'wait' | 'cpu' | 'online' = 'menu', role = 'w', turn = 'w', msg = '', busy = false, code = '';
    let board = initBoard(), castle: Record<string, boolean> = {}, ep: number[] | null = null, sel: number[] | null = null, legal: Move[] = [], ended = false, lastMove: Move | null = null, checkSq: number[] | null = null;
    let room: KoalRoom | null = null, timer = 0;
    const reset = () => {
      board = initBoard();
      castle = { wk: true, wq: true, bk: true, bq: true };
      ep = null;
      turn = 'w';
      sel = null;
      legal = [];
      ended = false;
      lastMove = null;
      checkSq = null;
    };
    reset();
    const checkState = () => {
      const mv = legalMoves(board, { castle, ep }, turn), kp = kingPos(board, turn), inCheck = attacks(board, opp(turn)).has(kp[0] + ',' + kp[1]);
      checkSq = inCheck ? kp : null;
      if (mv.length) return false;
      ended = true;
      if (!inCheck) a.over('Stalemate: a draw');
      else if (mode === 'online') a.over(opp(turn) === role ? 'Checkmate! You win' : 'Checkmate. You lose');
      else {
        if (opp(turn) === 'w') a.addScore(50);
        a.over(opp(turn) === 'w' ? 'Checkmate! You win' : 'Checkmate. The computer wins');
      }
      return true;
    };
    const play = (m: Move, remote = false) => {
      const n = applyMove(board, { castle, ep }, m);
      board = n.board;
      castle = n.castle;
      ep = n.ep;
      lastMove = m;
      turn = opp(turn);
      sel = null;
      legal = [];
      if (!remote && mode === 'online') room?.send({ t: 'm', m });
      if (!checkState() && mode === 'cpu' && turn === 'b') timer = window.setTimeout(() => !ended && aiMove(), 350);
    };
    const aiMove = () => {
      const moves = legalMoves(board, { castle, ep }, turn);
      if (!moves.length) return;
      let best = -1e9, bm = moves[0];
      for (const m of moves) {
        const n = applyMove(board, { castle, ep }, m);
        const v = -negamax(n.board, { castle: n.castle, ep: n.ep }, opp(turn), 1, -1e9, 1e9) + Math.random() * 0.2;
        if (v > best) (best = v), (bm = m);
      }
      play(bm);
    };
    const onLeave = () => {
      if (!ended && mode === 'online') {
        ended = true;
        a.over('Your friend left the game');
      }
    };
    const net = async (host: boolean, codeIn = '') => {
      if (!host && !codeIn.trim()) return ((msg = 'Type the room code first.'), a.refresh());
      busy = true;
      msg = host ? 'Creating your room...' : 'Joining...';
      a.refresh();
      try {
        const r = await connect('chess', host, codeIn.trim(), a, (d) => d?.t === 'm' && play(d.m, true), () => mode === 'wait' && (reset(), (mode = 'online'), a.refresh()), onLeave);
        room = r.room;
        code = r.code;
        role = host ? 'w' : 'b';
        reset();
        mode = host ? 'wait' : 'online';
      } catch (e: any) {
        msg = e?.message || 'Something went wrong.';
      }
      busy = false;
      a.refresh();
    };
    return {
      destroy() {
        clearTimeout(timer);
        room?.leave();
        room = null;
      },
      overlay: () => (mode === 'menu' ? lobbyUI({ title: 'Chess', note: 'You play White when you host, Black when you join.', msg, busy, onCpu: () => ((mode = 'cpu'), (role = 'w'), reset(), a.refresh()), onHost: () => net(true), onJoin: (c) => net(false, c) }) : null),
      pointer(type, x, y) {
        if (type !== 'down' || mode === 'menu' || mode === 'wait' || ended) return;
        if (turn !== role) return;
        const c = Math.floor((x - OX) / SQ), r = Math.floor((y - OY) / SQ);
        if (r < 0 || r > 7 || c < 0 || c > 7) return;
        const m = sel && legal.find((mv) => mv.tr === r && mv.tc === c);
        if (m) return play(m);
        const p = board[r][c];
        if (p && p[0] === turn) {
          sel = [r, c];
          legal = legalMoves(board, { castle, ep }, turn).filter((mv) => mv.fr === r && mv.fc === c);
        } else (sel = null), (legal = []);
      },
      draw(c) {
        sky(c, 480, 560, '#eef7ff', '#bcd9f5');
        const status = ended || mode === 'menu' ? '' : mode === 'wait' ? 'Waiting for a friend...   Room ' + code : mode === 'online' ? (turn === role ? 'Your move' : 'Waiting for your friend') + '   ·   Room ' + code : turn === 'w' ? 'Your move (White)' : 'The computer is thinking...';
        label(c, status, 240, 26, 15, '#13314f');
        gloss(c, OX - 8, OY - 8, SQ * 8 + 16, SQ * 8 + 16, 12, '#2a5ea8', 'rgba(0,30,80,.6)');
        for (let r = 0; r < 8; r++)
          for (let cc = 0; cc < 8; cc++) {
            c.fillStyle = (r + cc) % 2 ? '#6f9fd6' : '#eaf4ff';
            c.fillRect(OX + cc * SQ, OY + r * SQ, SQ, SQ);
          }
        const hi = (sq: number[], col: string) => {
          c.fillStyle = col;
          c.fillRect(OX + sq[1] * SQ, OY + sq[0] * SQ, SQ, SQ);
        };
        if (lastMove) hi([lastMove.fr, lastMove.fc], 'rgba(255,214,40,.45)'), hi([lastMove.tr, lastMove.tc], 'rgba(255,214,40,.45)');
        if (checkSq) hi(checkSq, 'rgba(230,40,40,.55)');
        if (sel) hi(sel, 'rgba(60,200,90,.55)');
        for (const m of legal) {
          c.fillStyle = 'rgba(30,160,60,.7)';
          c.beginPath();
          c.arc(OX + m.tc * SQ + SQ / 2, OY + m.tr * SQ + SQ / 2, 7, 0, TAU);
          c.fill();
        }
        const g = c.createLinearGradient(0, OY, 0, OY + SQ * 8);
        g.addColorStop(0, 'rgba(255,255,255,.28)');
        g.addColorStop(0.5, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(OX, OY, SQ * 8, SQ * 4);
        c.font = SQ * 0.74 + 'px "Segoe UI Symbol", "Segoe UI", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineJoin = 'round';
        for (let r = 0; r < 8; r++)
          for (let cc = 0; cc < 8; cc++) {
            const p = board[r][cc];
            if (!p) continue;
            const x = OX + cc * SQ + SQ / 2, y = OY + r * SQ + SQ / 2 + 2;
            const pg = c.createLinearGradient(0, y - SQ * 0.35, 0, y + SQ * 0.35);
            if (p[0] === 'w') pg.addColorStop(0, '#ffffff'), pg.addColorStop(1, '#bcd6f2');
            else pg.addColorStop(0, '#5a6e8f'), pg.addColorStop(1, '#0d1a30');
            c.lineWidth = 3;
            c.strokeStyle = p[0] === 'w' ? '#1d3a63' : '#e8f2ff';
            c.strokeText(GLYPH[p[1]], x, y);
            c.fillStyle = pg;
            c.fillText(GLYPH[p[1]], x, y);
          }
        c.textBaseline = 'alphabetic';
      },
    };
  },
};
