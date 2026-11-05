// koal.games, part 2: Alien Blaster, Block Stack, Rock Blaster, Cube Jump, Whack-a-Cube, Connect Four, Simon Says.
import { sfx } from '../../core/sfx';
import { Ctx, GameDef, eyes, gloss, jellyCube, label, orb, rr, sky } from './kit';

const TAU = Math.PI * 2;

function space(c: Ctx, w: number, h: number, n: number, t = 0) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#020818');
  g.addColorStop(1, '#0c2a5c');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const r = c.createRadialGradient(w * 0.75, h * 0.2, 0, w * 0.75, h * 0.2, w * 0.6);
  r.addColorStop(0, 'rgba(80,160,255,.22)');
  r.addColorStop(1, 'rgba(80,160,255,0)');
  c.fillStyle = r;
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + i);
    c.fillStyle = '#fff';
    c.fillRect((i * 97) % w, (i * 53) % h, 1.6, 1.6);
  }
  c.globalAlpha = 1;
}

export const aliens: GameDef = {
  id: 'aliens',
  name: 'Alien Blaster',
  w: 480,
  h: 520,
  blurb: 'Shoot down waves of aliens before they land.',
  help: 'Move with the arrow keys or A / D, shoot with Space. Stop the aliens before they land.',
  make(a) {
    let px = 220, lives = 3, dir = 1, speed = 30, wave = 1, inv = 0, cool = 0, t = 0;
    let bullet: { x: number; y: number } | null = null;
    let ab: { x: number; y: number }[] = [];
    let al: { x: number; y: number; r: number; alive: boolean }[] = [];
    const build = () => {
      al = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) al.push({ x: 50 + c * 48, y: 60 + r * 38, r, alive: true });
      dir = 1;
      speed = 26 + wave * 8;
    };
    build();
    const fire = () => !bullet && ((bullet = { x: px + 15, y: 480 }), sfx.zap({ vol: 0.6 }));
    const COL = ['#ff5c7a', '#ffb84d', '#6ee86e', '#5fc8ff'];
    return {
      key(k, d) {
        if (d && k === ' ') fire();
      },
      pointer(type, x) {
        px = Math.max(0, Math.min(450, x - 15));
        if (type === 'down') fire();
      },
      update(dt) {
        t += dt;
        const k = a.keys;
        if (k.ArrowLeft || k.a) px -= 280 * dt;
        if (k.ArrowRight || k.d) px += 280 * dt;
        px = Math.max(0, Math.min(450, px));
        a.info('Lives: ' + lives + '   Wave ' + wave);
        const live = al.filter((x) => x.alive);
        if (!live.length) {
          wave++;
          return build();
        }
        let edge = false;
        for (const x of live) {
          x.x += dir * speed * dt * (1 + (32 - live.length) / 20);
          if (x.x < 8 || x.x > 442) edge = true;
        }
        if (edge) {
          dir *= -1;
          live.forEach((x) => ((x.y += 16), (x.x += dir * 4)));
        }
        if (live.some((x) => x.y > 440)) return a.over('They landed!');
        if (bullet) {
          bullet.y -= 520 * dt;
          if (bullet.y < 0) bullet = null;
          else {
            const b = bullet;
            const h = live.find((x) => Math.abs(x.x + 15 - b.x) < 16 && Math.abs(x.y + 10 - b.y) < 14);
            if (h) {
              h.alive = false;
              sfx.crunch({ pitch: 1.2 + h.r * 0.15, vol: 0.7 });
              bullet = null;
              a.addScore(10 + (3 - h.r) * 5);
            }
          }
        }
        cool -= dt;
        if (cool <= 0 && live.length) {
          cool = Math.max(0.35, 1.1 - wave * 0.08);
          const s = live[a.ri(0, live.length - 1)];
          ab.push({ x: s.x + 15, y: s.y + 20 });
        }
        ab.forEach((b) => (b.y += 200 * dt));
        ab = ab.filter((b) => b.y < 530);
        inv -= dt;
        if (inv <= 0)
          for (const b of ab)
            if (b.y > 484 && b.y < 510 && Math.abs(b.x - (px + 15)) < 18) {
              b.y = 999;
              lives--;
              inv = 1.2;
              sfx.hurt();
              if (lives <= 0) a.over('Game over');
            }
      },
      draw(c) {
        space(c, 480, 520, 50, t);
        for (const x of al) {
          if (!x.alive) continue;
          const wob = Math.sin(t * 6 + x.x * 0.1) * 1.5;
          gloss(c, x.x + 2, x.y + wob, 26, 18, 9, COL[x.r], 'rgba(0,0,0,.45)');
          c.fillStyle = COL[x.r];
          c.fillRect(x.x + 6, x.y + 15 + wob, 4, 6);
          c.fillRect(x.x + 20, x.y + 15 + wob, 4, 6);
          eyes(c, x.x + 15, x.y + 8 + wob, 26);
        }
        if (inv <= 0 || Math.floor(inv * 10) % 2) {
          c.beginPath();
          c.moveTo(px + 15, 478);
          c.quadraticCurveTo(px + 33, 506, px + 30, 512);
          c.lineTo(px, 512);
          c.quadraticCurveTo(px - 3, 506, px + 15, 478);
          const g = c.createLinearGradient(px, 478, px + 30, 512);
          g.addColorStop(0, '#e6f6ff');
          g.addColorStop(1, '#2a8fe0');
          c.fillStyle = g;
          c.fill();
          c.strokeStyle = 'rgba(0,40,90,.6)';
          c.stroke();
          orb(c, px + 15, 497, 5, '#9fe8ff');
        }
        if (bullet) {
          c.shadowColor = '#ffe14d';
          c.shadowBlur = 8;
          c.fillStyle = '#fff6a0';
          c.fillRect(bullet.x - 1.5, bullet.y, 3, 12);
          c.shadowBlur = 0;
        }
        c.fillStyle = '#ff6b8a';
        for (const b of ab) {
          c.beginPath();
          c.ellipse(b.x, b.y + 5, 2.5, 5, 0, 0, TAU);
          c.fill();
        }
      },
    };
  },
};

export const stack: GameDef = {
  id: 'stack',
  name: 'Block Stack',
  w: 400,
  h: 520,
  blurb: 'Stack falling blocks and clear the rows.',
  help: 'Left / Right move, Up rotates, Down drops faster, Space drops instantly. Complete rows to clear them.',
  make(a) {
    const W = 10, H = 20, C = 26;
    const P: Record<string, number[][]> = { I: [[1, 1, 1, 1]], O: [[1, 1], [1, 1]], T: [[0, 1, 0], [1, 1, 1]], S: [[0, 1, 1], [1, 1, 0]], Z: [[1, 1, 0], [0, 1, 1]], J: [[1, 0, 0], [1, 1, 1]], L: [[0, 0, 1], [1, 1, 1]] };
    const COL: Record<string, string> = { I: '#2fd8f0', O: '#ffd83a', T: '#b46bff', S: '#4cd964', Z: '#ff4f5e', J: '#3d7bff', L: '#ff9a1f' };
    let g: string[][] = Array.from({ length: H }, () => Array(W).fill(''));
    let cur = { t: 'I', m: P.I, x: 3, y: -1 };
    let next = 'I', acc = 0, lines = 0, level = 1;
    const bag: string[] = [];
    const rnd = () => {
      if (!bag.length) bag.push(...Object.keys(P).sort(() => Math.random() - 0.5));
      return bag.pop()!;
    };
    next = rnd();
    const rot = (m: number[][]) => m[0].map((_, i) => m.map((r) => r[i]).reverse());
    const fits = (m: number[][], x: number, y: number) => m.every((r, j) => r.every((v, i) => !v || (x + i >= 0 && x + i < W && y + j < H && (y + j < 0 || !g[y + j][x + i]))));
    const spawn = () => {
      const t = next;
      next = rnd();
      cur = { t, m: P[t].map((r) => r.slice()), x: 3, y: -1 };
      if (!fits(cur.m, cur.x, cur.y)) a.over('Stack overflow!');
    };
    spawn();
    const lock = () => {
      cur.m.forEach((r, j) => r.forEach((v, i) => v && cur.y + j >= 0 && (g[cur.y + j][cur.x + i] = cur.t)));
      let n = 0;
      g = g.filter((r) => (r.every((v) => v) ? (n++, false) : true));
      while (g.length < H) g.unshift(Array(W).fill(''));
      if (n) {
        lines += n;
        level = 1 + Math.floor(lines / 8);
        a.addScore([0, 100, 300, 500, 800][n] * level);
        for (let k = 0; k < n + 1; k++) window.setTimeout(() => sfx.marimba(k * 2 + 3), k * 70);
      }
      if (!n) sfx.knock({ pitch: 0.7, vol: 0.6 });
      spawn();
    };
    const drop = () => (fits(cur.m, cur.x, cur.y + 1) ? cur.y++ : lock());
    const cell = (c: Ctx, x: number, y: number, col: string, al = 1) => {
      c.globalAlpha = al;
      gloss(c, x + 1, y + 1, C - 2, C - 2, 5, col, 'rgba(0,0,0,.4)');
      c.globalAlpha = 1;
    };
    return {
      key(k, d) {
        if (!d) return;
        if (k === 'ArrowLeft' || k === 'a') fits(cur.m, cur.x - 1, cur.y) && (cur.x--, sfx.click({ vol: 0.5 }));
        else if (k === 'ArrowRight' || k === 'd') fits(cur.m, cur.x + 1, cur.y) && (cur.x++, sfx.click({ vol: 0.5 }));
        else if (k === 'ArrowDown' || k === 's') {
          drop();
          a.addScore(1);
        } else if (k === 'ArrowUp' || k === 'w') {
          const r = rot(cur.m);
          for (const o of [0, -1, 1, -2, 2])
            if (fits(r, cur.x + o, cur.y)) {
              cur.m = r;
              cur.x += o;
              sfx.flip({ vol: 0.6 });
              break;
            }
        } else if (k === ' ') {
          while (fits(cur.m, cur.x, cur.y + 1)) {
            cur.y++;
            a.addScore(2);
          }
          sfx.whoosh(false, { vol: 0.35 });
          lock();
        }
      },
      update(dt) {
        acc += dt;
        if (acc >= Math.max(0.07, 0.7 - (level - 1) * 0.06)) {
          acc = 0;
          drop();
        }
        a.info('Level ' + level + '   Lines ' + lines);
      },
      draw(c) {
        sky(c, 400, 520, '#123c86', '#061a40');
        rr(c, 0, 0, 260, 520, 0);
        c.fillStyle = 'rgba(255,255,255,.07)';
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,.05)';
        for (let x = 1; x < W; x++) {
          c.beginPath();
          c.moveTo(x * C, 0);
          c.lineTo(x * C, 520);
          c.stroke();
        }
        g.forEach((r, y) => r.forEach((v, x) => v && cell(c, x * C, y * C, COL[v])));
        let gy = cur.y;
        while (fits(cur.m, cur.x, gy + 1)) gy++;
        cur.m.forEach((r, j) => r.forEach((v, i) => v && cell(c, (cur.x + i) * C, (gy + j) * C, COL[cur.t], 0.22)));
        cur.m.forEach((r, j) => r.forEach((v, i) => v && cur.y + j >= 0 && cell(c, (cur.x + i) * C, (cur.y + j) * C, COL[cur.t])));
        c.fillStyle = 'rgba(160,210,255,.5)';
        c.fillRect(260, 0, 1, 520);
        label(c, 'Next', 330, 44, 17);
        P[next].forEach((r, j) => r.forEach((v, i) => v && gloss(c, 290 + i * 24, 66 + j * 24, 22, 22, 5, COL[next])));
        c.font = '13px "Segoe UI", Tahoma';
        c.textAlign = 'left';
        c.fillStyle = '#cfe4ff';
        ['Arrows: move / rotate', 'Down: soft drop', 'Space: hard drop', 'P: pause'].forEach((t, i) => c.fillText(t, 272, 200 + i * 22));
      },
    };
  },
};

export const rocks: GameDef = {
  id: 'rocks',
  name: 'Rock Blaster',
  w: 560,
  h: 520,
  blurb: 'Fly a ship and blast the rocks to bits.',
  help: 'Left / Right turn, Up thrusts, Space shoots. Break the rocks and do not crash into them.',
  make(a) {
    const W = 560, H = 520;
    type Rock = { x: number; y: number; s: number; vx: number; vy: number; sh: number[]; r: number; rot: number; vr: number; dead?: boolean };
    let ship = { x: 280, y: 260, vx: 0, vy: 0, a: -Math.PI / 2 };
    let bullets: { x: number; y: number; vx: number; vy: number; t: number }[] = [];
    let rocksL: Rock[] = [];
    let parts: { x: number; y: number; vx: number; vy: number; t: number }[] = [];
    let lives = 3, inv = 2, cool = 0, wave = 0, t = 0;
    const rock = (x: number, y: number, s: number): Rock => {
      const n = a.ri(8, 11), sh: number[] = [];
      for (let i = 0; i < n; i++) sh.push(a.rnd(0.75, 1.15));
      const an = a.rnd(0, TAU), sp = a.rnd(30, 80) * (4 - s) * 0.6 + 20;
      return { x, y, s, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, sh, r: s * 14, rot: a.rnd(0, 6), vr: a.rnd(-1, 1) };
    };
    const newWave = () => {
      wave++;
      for (let i = 0; i < 3 + wave; i++) {
        let x: number, y: number;
        do {
          x = a.rnd(0, W);
          y = a.rnd(0, H);
        } while (Math.hypot(x - ship.x, y - ship.y) < 130);
        rocksL.push(rock(x, y, 3));
      }
    };
    newWave();
    const wrap = (o: { x: number; y: number }) => {
      o.x = (o.x + W) % W;
      o.y = (o.y + H) % H;
    };
    return {
      update(dt) {
        t += dt;
        const k = a.keys;
        if (k.ArrowLeft || k.a) ship.a -= 4 * dt;
        if (k.ArrowRight || k.d) ship.a += 4 * dt;
        if (k.ArrowUp || k.w) {
          ship.vx += Math.cos(ship.a) * 260 * dt;
          ship.vy += Math.sin(ship.a) * 260 * dt;
        }
        ship.vx *= 0.995;
        ship.vy *= 0.995;
        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;
        wrap(ship);
        cool -= dt;
        if (k[' '] && cool <= 0) {
          cool = 0.22;
          sfx.zap({ pitch: 1.3, vol: 0.5 });
          bullets.push({ x: ship.x + Math.cos(ship.a) * 14, y: ship.y + Math.sin(ship.a) * 14, vx: Math.cos(ship.a) * 440 + ship.vx, vy: Math.sin(ship.a) * 440 + ship.vy, t: 1.1 });
        }
        bullets.forEach((b) => ((b.x += b.vx * dt), (b.y += b.vy * dt), (b.t -= dt), wrap(b)));
        bullets = bullets.filter((b) => b.t > 0);
        rocksL.forEach((r) => ((r.x += r.vx * dt), (r.y += r.vy * dt), (r.rot += r.vr * dt), wrap(r)));
        for (const b of bullets)
          for (const r of rocksL)
            if (!r.dead && Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
              r.dead = true;
              r.s > 1 ? sfx.crunch({ pitch: 0.6 + (3 - r.s) * 0.3 }) : sfx.boom(0.3, { vol: 0.5 });
              b.t = 0;
              a.addScore((4 - r.s) * 20);
              for (let i = 0; i < 10; i++) parts.push({ x: r.x, y: r.y, vx: a.rnd(-90, 90), vy: a.rnd(-90, 90), t: 0.6 });
              if (r.s > 1) for (let i = 0; i < 2; i++) rocksL.push(rock(r.x, r.y, r.s - 1));
            }
        rocksL = rocksL.filter((r) => !r.dead);
        parts.forEach((p) => ((p.x += p.vx * dt), (p.y += p.vy * dt), (p.t -= dt)));
        parts = parts.filter((p) => p.t > 0);
        inv -= dt;
        if (inv <= 0)
          for (const r of rocksL)
            if (Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + 8) {
              lives--;
              inv = 2.5;
              sfx.boom(0.8);
              ship = { x: 280, y: 260, vx: 0, vy: 0, a: -Math.PI / 2 };
              if (lives <= 0) a.over('Game over');
              break;
            }
        if (!rocksL.length) newWave();
        a.info('Lives: ' + lives + '   Wave ' + wave);
      },
      draw(c) {
        space(c, W, H, 60, t);
        for (const r of rocksL) {
          c.beginPath();
          r.sh.forEach((m, i) => {
            const an = r.rot + (i / r.sh.length) * TAU, x = r.x + Math.cos(an) * r.r * m, y = r.y + Math.sin(an) * r.r * m;
            i ? c.lineTo(x, y) : c.moveTo(x, y);
          });
          c.closePath();
          const g = c.createRadialGradient(r.x - r.r * 0.4, r.y - r.r * 0.4, 0, r.x, r.y, r.r * 1.2);
          g.addColorStop(0, '#b9c8e0');
          g.addColorStop(1, '#3d4c6a');
          c.fillStyle = g;
          c.fill();
          c.strokeStyle = 'rgba(200,225,255,.7)';
          c.lineWidth = 1.5;
          c.stroke();
        }
        c.shadowColor = '#ffe14d';
        c.shadowBlur = 6;
        c.fillStyle = '#fff6a0';
        bullets.forEach((b) => c.fillRect(b.x - 2, b.y - 2, 4, 4));
        c.shadowBlur = 0;
        for (const p of parts) {
          c.globalAlpha = p.t / 0.6;
          c.fillStyle = '#ffab4d';
          c.fillRect(p.x, p.y, 3, 3);
        }
        c.globalAlpha = 1;
        if (inv <= 0 || Math.floor(inv * 8) % 2) {
          c.save();
          c.translate(ship.x, ship.y);
          c.rotate(ship.a);
          if (a.keys.ArrowUp || a.keys.w) {
            c.fillStyle = '#ffab4d';
            c.beginPath();
            c.moveTo(-7, -5);
            c.lineTo(-18 - Math.random() * 5, 0);
            c.lineTo(-7, 5);
            c.fill();
          }
          c.beginPath();
          c.moveTo(15, 0);
          c.lineTo(-10, -10);
          c.lineTo(-5, 0);
          c.lineTo(-10, 10);
          c.closePath();
          const g = c.createLinearGradient(0, -10, 0, 10);
          g.addColorStop(0, '#d6ffd0');
          g.addColorStop(1, '#2ea83a');
          c.fillStyle = g;
          c.fill();
          c.strokeStyle = '#eaffea';
          c.lineWidth = 1.2;
          c.stroke();
          c.restore();
        }
      },
    };
  },
};

export const jump: GameDef = {
  id: 'jump',
  name: 'Cube Jump',
  w: 360,
  h: 560,
  blurb: 'Bounce a cube up forever on floating platforms.',
  help: 'Left / Right (or move the mouse) to steer. You bounce by yourself. Climb as high as you can.',
  make(a) {
    const W = 360;
    let x = 180, y = 480, vy = -620, cam = 0, best = 0;
    let tx: number | null = null;
    type Plat = { x: number; y: number; w: number; mv: number };
    const mk = (yy: number, first = false): Plat => ({ x: first ? 150 : a.rnd(0, W - 70), y: yy, w: 70, mv: Math.random() < 0.18 ? a.rnd(40, 80) * (Math.random() < 0.5 ? 1 : -1) : 0 });
    let plats: Plat[] = [mk(520, true)];
    for (let i = 1; i < 14; i++) plats.push(mk(520 - i * 45));
    return {
      pointer(_t, px) {
        tx = px;
      },
      update(dt) {
        const k = a.keys;
        let d = 0;
        if (k.ArrowLeft || k.a) d -= 1;
        if (k.ArrowRight || k.d) d += 1;
        if (tx !== null && !d) d = Math.abs(tx - x) > 6 ? Math.sign(tx - x) * 0.8 : 0;
        x += d * 300 * dt;
        if (x < -10) x = W + 10;
        if (x > W + 10) x = -10;
        vy += 1500 * dt;
        y += vy * dt;
        for (const p of plats)
          if (p.mv) {
            p.x += p.mv * dt;
            if (p.x < 0 || p.x + p.w > W) p.mv *= -1;
          }
        if (vy > 0)
          for (const p of plats)
            if (y > p.y - 4 && y < p.y + 16 && x > p.x - 10 && x < p.x + p.w + 10 && y - vy * dt <= p.y + 6) {
              vy = -720;
              y = p.y;
              sfx.pop({ pitch: p.mv ? 0.9 : 0.7, vol: 0.6 });
            }
        if (y < cam + 260) cam = y - 260;
        for (let n = 0; n < 40 && (plats.length < 16 || Math.min(...plats.map((p) => p.y)) - 45 > cam - 40); n++) plats.push(mk(Math.min(...plats.map((p) => p.y)) - a.rnd(40, 90)));
        plats = plats.filter((p) => p.y < cam + 620);
        const h = Math.max(0, Math.floor((480 - cam) / 10));
        if (h > best) {
          best = h;
          a.setScore(h);
        }
        if (y > cam + 600) a.over('You fell!');
      },
      draw(c) {
        sky(c, W, 560, '#4fb0f5', '#d9f2ff');
        c.fillStyle = 'rgba(255,255,255,.75)';
        for (const [cx, cy] of [[50, 60], [200, 140], [300, 40], [120, 330]]) {
          const yy = (((cy - cam * 0.1) % 600) + 600) % 600 - 20;
          c.beginPath();
          c.arc(cx, yy, 20, 0, TAU);
          c.arc(cx + 22, yy + 4, 16, 0, TAU);
          c.arc(cx - 18, yy + 5, 13, 0, TAU);
          c.fill();
        }
        for (const p of plats) gloss(c, p.x, p.y - cam, p.w, 13, 6.5, p.mv ? '#ffb13d' : '#56c943', 'rgba(0,60,0,.45)');
        const py = y - cam;
        jellyCube(c, x, py - 15, 28, '#ff8f1f');
      },
    };
  },
};

export const whack: GameDef = {
  id: 'whack',
  name: 'Whack-a-Cube',
  w: 480,
  h: 440,
  blurb: 'Whack the cubes that pop out of the holes.',
  help: 'Click the cubes as they pop out of the holes. You have 30 seconds.',
  make(a) {
    const holes = Array.from({ length: 9 }, (_, i) => ({ x: 80 + (i % 3) * 160, y: 140 + Math.floor(i / 3) * 120, t: 0, life: 0, hit: 0, col: '#4cd964' }));
    const COLS = ['#4cd964', '#3aa0ff', '#ff8f1f', '#c86bff'];
    let timeLeft = 30, spawn = 0;
    return {
      update(dt) {
        timeLeft -= dt;
        if (timeLeft <= 0) return a.over('Time is up!');
        spawn -= dt;
        if (spawn <= 0) {
          spawn = Math.max(0.3, 0.8 - (30 - timeLeft) * 0.015);
          const h = holes[a.ri(0, 8)];
          if (h.life <= 0) {
            h.life = a.rnd(0.7, 1.3);
            h.t = 0;
            h.hit = 0;
            h.col = COLS[a.ri(0, 3)];
          }
        }
        for (const h of holes) {
          if (h.life > 0) (h.t += dt), (h.life -= dt);
          if (h.hit > 0) h.hit -= dt;
        }
        a.info('Time: ' + Math.ceil(timeLeft));
      },
      pointer(type, x, y) {
        if (type !== 'down') return;
        for (const h of holes)
          if (h.life > 0 && h.hit <= 0 && Math.hypot(x - h.x, y - (h.y - 22)) < 46) {
            h.life = 0;
            h.hit = 0.35;
            sfx.thud();
            sfx.pop({ pitch: 1.3, vol: 0.5 });
            a.addScore(10);
          }
      },
      draw(c) {
        sky(c, 480, 440, '#a8ec6c', '#3f9d2f');
        c.fillStyle = 'rgba(255,255,255,.12)';
        for (let i = 0; i < 24; i++) c.fillRect((i * 67) % 480, (i * 41) % 440, 26, 3);
        for (const h of holes) {
          const hg = c.createRadialGradient(h.x, h.y, 4, h.x, h.y, 54);
          hg.addColorStop(0, '#1d1206');
          hg.addColorStop(1, '#5a3a17');
          c.fillStyle = hg;
          c.beginPath();
          c.ellipse(h.x, h.y, 52, 18, 0, 0, TAU);
          c.fill();
          if (h.life > 0 || h.hit > 0) {
            const up = h.hit > 0 ? 1 : Math.min(1, h.t * 6) * Math.min(1, Math.max(0, h.life) * 6 + 0.3);
            c.save();
            c.beginPath();
            c.rect(h.x - 60, h.y - 100, 120, 100);
            c.clip();
            jellyCube(c, h.x, h.y - 46 * up - 8 + 30, 56, h.col, h.hit > 0);
            c.restore();
          }
          c.fillStyle = '#6fd04a';
          c.beginPath();
          c.ellipse(h.x, h.y + 3, 54, 14, 0, 0, Math.PI);
          c.fill();
        }
      },
    };
  },
};

export const four: GameDef = {
  id: 'four',
  name: 'Connect Four',
  w: 420,
  h: 470,
  blurb: 'Connect four discs in a row before the computer does.',
  help: 'Click a column to drop a red disc. Connect four in a row before the computer does.',
  make(a) {
    const R = 6, Cc = 7;
    const empty = () => Array.from({ length: R }, () => Array(Cc).fill(0) as number[]);
    let b = empty(), res = '', turn = 1, hover = 3, busy = false, timer = 0;
    const drop = (bd: number[][], c: number, p: number) => {
      for (let r = R - 1; r >= 0; r--)
        if (!bd[r][c]) {
          bd[r][c] = p;
          return r;
        }
      return -1;
    };
    const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
    const fourIn = (bd: number[][], p: number) => {
      for (let r = 0; r < R; r++)
        for (let c = 0; c < Cc; c++)
          for (const [dr, dc] of DIRS) {
            let k = 0;
            for (; k < 4; k++) {
              const y = r + dr * k, x = c + dc * k;
              if (y < 0 || y >= R || x < 0 || x >= Cc || bd[y][x] !== p) break;
            }
            if (k === 4) return true;
          }
      return false;
    };
    const full = (bd: number[][]) => bd[0].every((v) => v);
    const score = (bd: number[][]) => {
      let s = 0;
      for (let r = 0; r < R; r++)
        for (let c = 0; c < Cc; c++)
          for (const [dr, dc] of DIRS) {
            let me = 0, op = 0;
            for (let k = 0; k < 4; k++) {
              const y = r + dr * k, x = c + dc * k;
              if (y < 0 || y >= R || x < 0 || x >= Cc) {
                me = op = -9;
                break;
              }
              if (bd[y][x] === 2) me++;
              else if (bd[y][x] === 1) op++;
            }
            if (me >= 0 && !op) s += me * me;
            if (op >= 0 && !me) s -= op * op * 1.2;
          }
      for (let r = 0; r < R; r++) if (bd[r][3] === 2) s += 2;
      return s;
    };
    const ORDER = [3, 2, 4, 1, 5, 0, 6];
    const mm = (bd: number[][], d: number, al: number, be: number, max: boolean): number => {
      if (fourIn(bd, 2)) return 1000 + d;
      if (fourIn(bd, 1)) return -1000 - d;
      if (!d || full(bd)) return score(bd);
      let v = max ? -1e9 : 1e9;
      for (const c of ORDER) {
        const r = drop(bd, c, max ? 2 : 1);
        if (r < 0) continue;
        const x = mm(bd, d - 1, al, be, !max);
        bd[r][c] = 0;
        if (max) (v = Math.max(v, x)), (al = Math.max(al, v));
        else (v = Math.min(v, x)), (be = Math.min(be, v));
        if (al >= be) break;
      }
      return v;
    };
    const aiMove = () => {
      let best = -1e9, bc = 3;
      for (const c of ORDER) {
        const r = drop(b, c, 2);
        if (r < 0) continue;
        const v = mm(b, 4, -1e9, 1e9, false) + Math.random() * 0.5;
        b[r][c] = 0;
        if (v > best) (best = v), (bc = c);
      }
      drop(b, bc, 2);
      sfx.knock({ pitch: 0.75 });
      if (fourIn(b, 2)) (res = 'The computer wins. Click to play again'), sfx.lose();
      else if (full(b)) res = 'Draw. Click to play again';
      turn = 1;
      busy = false;
    };
    return {
      destroy: () => clearTimeout(timer),
      pointer(type, x) {
        hover = Math.max(0, Math.min(6, Math.floor((x - 10) / 57)));
        if (type !== 'down') return;
        if (res) {
          b = empty();
          res = '';
          turn = 1;
          return;
        }
        if (busy || turn !== 1 || drop(b, hover, 1) < 0) return;
        sfx.knock({ pitch: 0.9 });
        if (fourIn(b, 1)) {
          res = 'You win! Click to play again';
          sfx.win();
          return a.addScore(10);
        }
        if (full(b)) return void (res = 'Draw. Click to play again');
        turn = 2;
        busy = true;
        timer = window.setTimeout(aiMove, 300);
      },
      draw(c) {
        sky(c, 420, 470, '#eef7ff', '#bcd9f5');
        if (!res && turn === 1) orb(c, 38 + hover * 57, 32, 22, '#ef3b3b');
        gloss(c, 5, 60, 410, 400, 18, '#2a74d8', 'rgba(0,30,90,.6)');
        for (let r = 0; r < R; r++)
          for (let cc = 0; cc < Cc; cc++) {
            const v = b[r][cc], x = 38 + cc * 57, y = 100 + r * 62;
            if (v) orb(c, x, y, 24, v === 1 ? '#ef3b3b' : '#ffd21f');
            else {
              const g = c.createLinearGradient(0, y - 24, 0, y + 24);
              g.addColorStop(0, '#9fc3e8');
              g.addColorStop(1, '#e9f4ff');
              c.fillStyle = g;
              c.beginPath();
              c.arc(x, y, 24, 0, TAU);
              c.fill();
            }
          }
        if (res) {
          rr(c, 20, 200, 380, 70, 14);
          c.fillStyle = 'rgba(0,30,70,.75)';
          c.fill();
          label(c, res, 210, 236, 18);
        }
      },
    };
  },
};

export const simon: GameDef = {
  id: 'simon',
  name: 'Simon Says',
  w: 400,
  h: 420,
  blurb: 'Watch the colours, then repeat the pattern.',
  help: 'Watch the colours light up, then repeat the pattern. Click the colours or use the number keys 1 to 4.',
  make(a) {
    const cols = [['#1f9a3a', '#7dffa8'], ['#d32f2f', '#ff9d94'], ['#f2a900', '#fff59d'], ['#1565c0', '#8fc0ff']];
    const seq: number[] = [];
    let idx = 0, phase = 'show', t = 0, lit = -1, pi = 0;
    const add = () => {
      seq.push(a.ri(0, 3));
      idx = 0;
      phase = 'show';
      t = 0.8;
      pi = 0;
    };
    add();
    const press = (i: number) => {
      if (phase !== 'in') return;
      lit = i;
      t = 0.25;
      sfx.marimba([0, 2, 4, 6][i] + 2);
      if (seq[idx] === i) {
        if (++idx === seq.length) {
          a.addScore(seq.length * 10);
          phase = 'wait';
          t = 0.8;
        }
      } else a.over('Wrong! You reached round ' + seq.length);
    };
    const KEYS: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, q: 0, w: 1, s: 2, a: 3 };
    return {
      update(dt) {
        a.info('Round ' + seq.length);
        t -= dt;
        if (t > 0) return;
        if (phase === 'wait') {
          lit = -1;
          return add();
        }
        if (phase === 'show') {
          if (lit >= 0) (lit = -1), (t = 0.2);
          else if (pi < seq.length) (lit = seq[pi++]), (t = 0.45), sfx.marimba([0, 2, 4, 6][lit] + 2);
          else phase = 'in';
        } else lit = -1;
      },
      pointer(type, x, y) {
        if (type !== 'down') return;
        const dx = x - 200, dy = y - 210, d = Math.hypot(dx, dy);
        if (d > 190 || d < 46) return;
        press(dx < 0 ? (dy < 0 ? 0 : 3) : dy < 0 ? 1 : 2);
      },
      key(k, d) {
        if (d && KEYS[k] !== undefined) press(KEYS[k]);
      },
      draw(c) {
        sky(c, 400, 420, '#16305e', '#081631');
        const arcs = [[Math.PI, 1.5 * Math.PI], [1.5 * Math.PI, 2 * Math.PI], [0, 0.5 * Math.PI], [0.5 * Math.PI, Math.PI]];
        arcs.forEach(([s0, s1], i) => {
          c.beginPath();
          c.arc(200, 210, 185, s0 + 0.03, s1 - 0.03);
          c.arc(200, 210, 52, s1 - 0.08, s0 + 0.08, true);
          c.closePath();
          const on = lit === i;
          const g = c.createRadialGradient(200, 150, 20, 200, 210, 190);
          g.addColorStop(0, on ? '#fff' : cols[i][1]);
          g.addColorStop(0.5, on ? cols[i][1] : cols[i][0]);
          g.addColorStop(1, cols[i][0]);
          c.fillStyle = g;
          if (on) (c.shadowColor = cols[i][1]), (c.shadowBlur = 30);
          c.fill();
          c.shadowBlur = 0;
          c.strokeStyle = 'rgba(255,255,255,.45)';
          c.lineWidth = 2;
          c.stroke();
        });
        const sg = c.createLinearGradient(0, 25, 0, 210);
        sg.addColorStop(0, 'rgba(255,255,255,.4)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = sg;
        c.beginPath();
        c.ellipse(200, 110, 150, 80, 0, Math.PI, 0);
        c.fill();
        orb(c, 200, 210, 46, '#1d3f78', 'rgba(255,255,255,.4)');
        label(c, phase === 'in' ? 'Your turn' : phase === 'show' ? 'Watch' : 'Nice!', 200, 212, 15);
      },
    };
  },
};
