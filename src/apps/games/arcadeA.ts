// koal.games, part 1: Snake, Brick Bash, Flappy Cube, Tile Merge, Minesweeper, Memory Match, Tic-Tac-Toe.
import { Ctx, GameDef, bubbles, gloss, jellyCube, label, orb, rr, sky, starPath } from './kit';

const TAU = Math.PI * 2;

export const snake: GameDef = {
  id: 'snake',
  name: 'Snake',
  w: 480,
  h: 480,
  blurb: 'Guide the snake, eat apples and grow long.',
  help: 'Steer with the arrow keys or W A S D. Eat apples to grow. Do not hit the walls or your own tail.',
  make(a) {
    const N = 20, C = 24;
    let s = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    let dir = { x: 1, y: 0 }, nd = { x: 1, y: 0 }, acc = 0, step = 0.11, eaten = 0, t = 0;
    let food = { x: 0, y: 0 };
    const place = () => {
      do food = { x: a.ri(0, N - 1), y: a.ri(0, N - 1) };
      while (s.some((p) => p.x === food.x && p.y === food.y));
    };
    place();
    const M: Record<string, number[]> = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
    return {
      key(k, d) {
        const m = d && M[k];
        if (m && !(m[0] === -dir.x && m[1] === -dir.y)) nd = { x: m[0], y: m[1] };
      },
      update(dt) {
        t += dt;
        acc += dt;
        while (acc >= step) {
          acc -= step;
          dir = nd;
          const h = { x: s[0].x + dir.x, y: s[0].y + dir.y };
          if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || s.some((p) => p.x === h.x && p.y === h.y)) return a.over('Ouch!');
          s.unshift(h);
          if (h.x === food.x && h.y === food.y) {
            a.addScore(10);
            if (++eaten % 5 === 0) step = Math.max(0.05, step - 0.01);
            place();
          } else s.pop();
        }
        a.info('Length ' + s.length);
      },
      draw(c) {
        sky(c, 480, 480, '#9be36b', '#3f9d2f');
        c.fillStyle = 'rgba(255,255,255,.09)';
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 2) c.fillRect(x * C, y * C, C, C);
        // apple
        const fx = food.x * C + C / 2, fy = food.y * C + C / 2 + 1, bob = Math.sin(t * 5) * 1.2;
        orb(c, fx, fy + bob, C / 2 - 2.5, '#ef3b3b', 'rgba(110,0,0,.5)');
        c.fillStyle = '#3fae35';
        c.beginPath();
        c.ellipse(fx + 4, fy - 9 + bob, 4.5, 2.2, -0.6, 0, TAU);
        c.fill();
        // snake, tail first so the head sits on top
        for (let i = s.length - 1; i >= 0; i--) {
          const p = s[i];
          const l = Math.max(30, 52 - i * 0.6);
          gloss(c, p.x * C + 1, p.y * C + 1, C - 2, C - 2, 8, i ? `hsl(${130 - Math.min(30, i)},70%,${l}%)` : '#5fe03a', 'rgba(0,60,0,.45)');
        }
        const hd = s[0];
        const ex = hd.x * C + C / 2, ey = hd.y * C + C / 2;
        c.fillStyle = '#fff';
        for (const sgn of [-1, 1]) {
          const ox = dir.y ? sgn * 5 : dir.x * 3, oy = dir.x ? sgn * 5 : dir.y * 3;
          c.beginPath();
          c.arc(ex + ox, ey + oy, 3.6, 0, TAU);
          c.fillStyle = '#fff';
          c.fill();
          c.beginPath();
          c.arc(ex + ox + dir.x * 1.3, ey + oy + dir.y * 1.3, 2, 0, TAU);
          c.fillStyle = '#10264a';
          c.fill();
        }
      },
    };
  },
};

export const brick: GameDef = {
  id: 'brick',
  name: 'Brick Bash',
  w: 480,
  h: 520,
  blurb: 'Smash every brick with a bouncing ball.',
  help: 'Move the paddle with the mouse or the arrow keys. Click or press Space to launch the ball. Clear all the bricks.',
  make(a) {
    const PW = 84;
    let px = 200, lives = 3, level = 1, t = 0;
    const ball = { x: 240, y: 470, vx: 0, vy: 0, on: true };
    let bricks: { x: number; y: number; w: number; h: number; c: string; alive: boolean }[] = [];
    const build = () => {
      bricks = [];
      for (let r = 0; r < 5 + Math.min(3, level); r++) for (let c = 0; c < 8; c++) bricks.push({ x: 14 + c * 57, y: 50 + r * 24, w: 52, h: 18, c: `hsl(${(r * 42 + level * 20) % 360},80%,56%)`, alive: true });
    };
    build();
    const launch = () => {
      if (!ball.on) return;
      ball.on = false;
      ball.vx = a.rnd(-120, 120);
      ball.vy = -(300 + level * 20);
    };
    return {
      pointer(type, x) {
        px = Math.max(0, Math.min(480 - PW, x - PW / 2));
        if (type === 'down') launch();
      },
      key(k, d) {
        if (d && k === ' ') launch();
      },
      update(dt) {
        t += dt;
        const k = a.keys;
        if (k.ArrowLeft || k.a) px -= 460 * dt;
        if (k.ArrowRight || k.d) px += 460 * dt;
        px = Math.max(0, Math.min(480 - PW, px));
        a.info('Lives: ' + lives + '   Level ' + level);
        if (ball.on) {
          ball.x = px + PW / 2;
          ball.y = 490;
          return;
        }
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        if (ball.x < 7) (ball.x = 7), (ball.vx = Math.abs(ball.vx));
        if (ball.x > 473) (ball.x = 473), (ball.vx = -Math.abs(ball.vx));
        if (ball.y < 7) (ball.y = 7), (ball.vy = Math.abs(ball.vy));
        if (ball.vy > 0 && ball.y > 492 && ball.y < 510 && ball.x > px - 4 && ball.x < px + PW + 4) {
          ball.vy = -Math.abs(ball.vy);
          ball.vx = ((ball.x - (px + PW / 2)) / (PW / 2)) * 260;
        }
        for (const b of bricks)
          if (b.alive && ball.x > b.x - 6 && ball.x < b.x + b.w + 6 && ball.y > b.y - 6 && ball.y < b.y + b.h + 6) {
            b.alive = false;
            a.addScore(10);
            const ox = Math.min(ball.x - b.x + 6, b.x + b.w + 6 - ball.x), oy = Math.min(ball.y - b.y + 6, b.y + b.h + 6 - ball.y);
            if (ox < oy) ball.vx *= -1;
            else ball.vy *= -1;
            break;
          }
        if (!bricks.some((b) => b.alive)) {
          level++;
          build();
          ball.on = true;
        }
        if (ball.y > 530) {
          lives--;
          ball.on = true;
          if (lives <= 0) a.over('Game over');
        }
      },
      draw(c) {
        sky(c, 480, 520, '#0d3f8f', '#2fb6e8');
        bubbles(c, 480, 520, t, 6, 0.35);
        for (const b of bricks) if (b.alive) gloss(c, b.x, b.y, b.w, b.h, 6, b.c);
        gloss(c, px, 498, PW, 13, 6.5, '#cfe6ff', 'rgba(0,40,90,.5)');
        orb(c, ball.x, ball.y, 7, '#f4fbff', 'rgba(0,50,110,.45)');
        if (ball.on) label(c, 'Click or press Space to launch', 240, 320, 16);
      },
    };
  },
};

export const flappy: GameDef = {
  id: 'flappy',
  name: 'Flappy Cube',
  w: 400,
  h: 560,
  blurb: 'Flap a cube through the gaps in the pipes.',
  help: 'Press Space, the up arrow or click to flap. Fly through the gaps in the pipes.',
  make(a) {
    let y = 260, vy = 0, t = 1, started = false, bg = 0;
    let pipes: { x: number; gap: number; passed: boolean }[] = [];
    const flap = () => {
      started = true;
      vy = -330;
    };
    const pipe = (c: Ctx, x: number, y0: number, h: number) => {
      const g = c.createLinearGradient(x, 0, x + 52, 0);
      g.addColorStop(0, '#2f9a2a');
      g.addColorStop(0.3, '#9be86f');
      g.addColorStop(0.55, '#4cc23a');
      g.addColorStop(1, '#1f7a1d');
      c.fillStyle = g;
      c.fillRect(x, y0, 52, h);
      c.strokeStyle = 'rgba(0,60,0,.5)';
      c.strokeRect(x + 0.5, y0 + 0.5, 51, h - 1);
    };
    return {
      key(k, d) {
        if (d && (k === ' ' || k === 'ArrowUp' || k === 'w')) flap();
      },
      pointer(type) {
        if (type === 'down') flap();
      },
      update(dt) {
        bg += dt * 40;
        if (!started) return;
        vy += 1000 * dt;
        y += vy * dt;
        t -= dt;
        if (t <= 0) {
          t = 1.55;
          pipes.push({ x: 420, gap: a.rnd(150, 400), passed: false });
        }
        for (const p of pipes) {
          p.x -= 170 * dt;
          if (!p.passed && p.x + 26 < 90) {
            p.passed = true;
            a.addScore(1);
          }
          if (90 + 14 > p.x && 90 - 14 < p.x + 52 && (y - 14 < p.gap - 75 || y + 14 > p.gap + 75)) a.over('Splat!');
        }
        pipes = pipes.filter((p) => p.x > -60);
        if (y > 506 || y < -20) a.over('Splat!');
      },
      draw(c) {
        sky(c, 400, 560, '#3d9ff0', '#d8f2ff');
        c.fillStyle = 'rgba(255,255,255,.9)';
        for (const [x, yy] of [[60, 90], [220, 60], [330, 140]]) {
          const xx = (((x - bg) % 460) + 460) % 460 - 30;
          c.beginPath();
          c.arc(xx, yy, 22, 0, TAU);
          c.arc(xx + 24, yy + 4, 18, 0, TAU);
          c.arc(xx - 22, yy + 6, 16, 0, TAU);
          c.fill();
        }
        for (const p of pipes) {
          pipe(c, p.x, 0, p.gap - 75);
          pipe(c, p.x, p.gap + 75, 560);
          gloss(c, p.x - 5, p.gap - 97, 62, 22, 6, '#46c23a', 'rgba(0,60,0,.55)');
          gloss(c, p.x - 5, p.gap + 75, 62, 22, 6, '#46c23a', 'rgba(0,60,0,.55)');
        }
        const gg = c.createLinearGradient(0, 520, 0, 560);
        gg.addColorStop(0, '#8be05a');
        gg.addColorStop(0.25, '#3fa32e');
        gg.addColorStop(1, '#2a7a20');
        c.fillStyle = gg;
        c.fillRect(0, 520, 400, 40);
        c.save();
        c.translate(90, y);
        c.rotate(Math.max(-0.5, Math.min(1, vy / 600)));
        jellyCube(c, 0, 0, 30, '#3aa0ff');
        c.restore();
        if (!started) label(c, 'Click or press Space to flap', 200, 220, 19);
        label(c, a.score, 200, 66, 44);
      },
    };
  },
};

export const tiles: GameDef = {
  id: 'tiles',
  name: 'Tile Merge',
  w: 440,
  h: 440,
  blurb: 'Slide and merge tiles all the way to 2048.',
  help: 'Use the arrow keys (or swipe) to slide the tiles. Matching tiles merge. Reach 2048!',
  make(a) {
    let g = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    let won = false;
    let drag: number[] | null = null;
    const add = () => {
      const e: number[][] = [];
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!g[y][x]) e.push([x, y]);
      if (!e.length) return;
      const [x, y] = e[a.ri(0, e.length - 1)];
      g[y][x] = Math.random() < 0.9 ? 2 : 4;
    };
    add();
    add();
    const slide = (row: number[]): [number[], number] => {
      const r = row.filter((v) => v);
      let sc = 0;
      for (let i = 0; i < r.length - 1; i++)
        if (r[i] === r[i + 1]) {
          r[i] *= 2;
          sc += r[i];
          r.splice(i + 1, 1);
        }
      while (r.length < 4) r.push(0);
      return [r, sc];
    };
    const can = () => {
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          if (!g[y][x]) return true;
          if (x < 3 && g[y][x] === g[y][x + 1]) return true;
          if (y < 3 && g[y][x] === g[y + 1][x]) return true;
        }
      return false;
    };
    const move = (d: string) => {
      let gain = 0;
      const ng = g.map((r) => r.slice());
      for (let i = 0; i < 4; i++) {
        const line: number[] = [];
        for (let j = 0; j < 4; j++) line.push(d === 'L' ? ng[i][j] : d === 'R' ? ng[i][3 - j] : d === 'U' ? ng[j][i] : ng[3 - j][i]);
        const [r, sc] = slide(line);
        gain += sc;
        for (let j = 0; j < 4; j++) {
          if (d === 'L') ng[i][j] = r[j];
          else if (d === 'R') ng[i][3 - j] = r[j];
          else if (d === 'U') ng[j][i] = r[j];
          else ng[3 - j][i] = r[j];
        }
      }
      if (JSON.stringify(ng) === JSON.stringify(g)) return;
      g = ng;
      a.addScore(gain);
      add();
      if (!won && g.some((r) => r.includes(2048))) {
        won = true;
        a.info('2048! Keep going!');
      }
      if (!can()) a.over('No more moves');
    };
    const HUE: Record<number, string> = { 2: '#e9f6ff', 4: '#d3efff', 8: '#7fd3ff', 16: '#3fb4f2', 32: '#33c98a', 64: '#1fae4d', 128: '#b8e04a', 256: '#f5d33a', 512: '#ffab2e', 1024: '#ff7a3d', 2048: '#ff4f8a' };
    const KEYS: Record<string, string> = { ArrowLeft: 'L', a: 'L', ArrowRight: 'R', d: 'R', ArrowUp: 'U', w: 'U', ArrowDown: 'D', s: 'D' };
    return {
      key(k, d) {
        if (d && KEYS[k]) move(KEYS[k]);
      },
      pointer(type, x, y) {
        if (type === 'down') drag = [x, y];
        else if (type === 'up' && drag) {
          const dx = x - drag[0], dy = y - drag[1];
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 25) move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U');
          drag = null;
        }
      },
      draw(c) {
        sky(c, 440, 440, '#1f6fc4', '#0b2f66');
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++) {
            const v = g[y][x], px = 12 + x * 104, py = 12 + y * 104;
            if (!v) {
              rr(c, px, py, 96, 96, 14);
              c.fillStyle = 'rgba(255,255,255,.12)';
              c.fill();
              c.strokeStyle = 'rgba(255,255,255,.22)';
              c.stroke();
              continue;
            }
            gloss(c, px, py, 96, 96, 14, HUE[v] ?? '#b04bff', 'rgba(0,30,70,.45)');
            label(c, v, px + 48, py + 52, v < 100 ? 42 : v < 1000 ? 36 : 28, v <= 4 ? '#1d4a7a' : '#fff');
          }
      },
    };
  },
};

export const mines: GameDef = {
  id: 'mines',
  name: 'Minesweeper',
  w: 384,
  h: 416,
  blurb: 'Clear the field without stepping on a mine.',
  help: 'Left click opens a square, right click plants a flag. Numbers show how many mines touch a square. Clear all the safe squares.',
  make(a) {
    const N = 12, C = 32, M = 20;
    type Cell = { m: boolean; r: boolean; f: boolean; n: number };
    const cells: Cell[][] = Array.from({ length: N }, () => Array.from({ length: N }, () => ({ m: false, r: false, f: false, n: 0 })));
    let first = true, lost = false, flags = 0, time = 0, done = false;
    const nb = (x: number, y: number, f: (X: number, Y: number, c: Cell) => void) => {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const X = x + dx, Y = y + dy;
          if (X >= 0 && Y >= 0 && X < N && Y < N) f(X, Y, cells[Y][X]);
        }
    };
    const plant = (sx: number, sy: number) => {
      let n = 0;
      while (n < M) {
        const x = a.ri(0, N - 1), y = a.ri(0, N - 1);
        if (cells[y][x].m || (Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1)) continue;
        cells[y][x].m = true;
        n++;
      }
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          let k = 0;
          nb(x, y, (_X, _Y, c) => c.m && k++);
          cells[y][x].n = k;
        }
    };
    const reveal = (x: number, y: number) => {
      const c = cells[y][x];
      if (c.r || c.f) return;
      c.r = true;
      if (c.m) {
        lost = true;
        return a.over('Boom!');
      }
      if (!c.n) nb(x, y, (X, Y) => reveal(X, Y));
    };
    const check = () => {
      if (lost || done) return;
      let left = 0;
      cells.forEach((r) => r.forEach((c) => !c.r && !c.m && left++));
      if (!left) {
        done = true;
        a.setScore(Math.max(100, 1000 - Math.floor(time) * 5));
        a.over('You cleared it!');
      }
    };
    const NC = ['', '#1d6fe0', '#2a9a36', '#e0352e', '#7b2fbf', '#ef8a00', '#0097a7', '#222', '#666'];
    const mine = (c: Ctx, x: number, y: number) => {
      c.strokeStyle = '#1a1a2a';
      c.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const an = (i * Math.PI) / 4;
        c.beginPath();
        c.moveTo(x - Math.cos(an) * 11, y - Math.sin(an) * 11);
        c.lineTo(x + Math.cos(an) * 11, y + Math.sin(an) * 11);
        c.stroke();
      }
      orb(c, x, y, 7.5, '#2a2f45', 'rgba(0,0,0,.6)');
    };
    return {
      update(dt) {
        if (!first && !lost && !done) time += dt;
        a.info('Mines ' + (M - flags) + '   Time ' + Math.floor(time) + 's');
      },
      pointer(type, x, y, e) {
        if (type !== 'down' || lost || done) return;
        const X = Math.floor(x / C), Y = Math.floor((y - 32) / C);
        if (X < 0 || Y < 0 || X >= N || Y >= N) return;
        const c = cells[Y][X];
        if (e.button === 2) {
          if (!c.r) {
            c.f = !c.f;
            flags += c.f ? 1 : -1;
          }
          return;
        }
        if (first) {
          plant(X, Y);
          first = false;
        }
        if (c.r && c.n) {
          let f = 0;
          nb(X, Y, (_x, _y, cc) => cc.f && f++);
          if (f === c.n) nb(X, Y, (x2, y2, cc) => !cc.f && reveal(x2, y2));
        } else reveal(X, Y);
        check();
      },
      draw(c) {
        sky(c, 384, 416, '#e9f4ff', '#c4dcf3');
        label(c, 'Left click: open    Right click: flag', 192, 16, 13, '#13314f');
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++) {
            const q = cells[y][x], px = x * C, py = 32 + y * C;
            if (q.r) {
              c.fillStyle = q.m ? '#ffb3ad' : 'rgba(255,255,255,.75)';
              c.fillRect(px, py, C, C);
              c.strokeStyle = 'rgba(80,120,170,.35)';
              c.strokeRect(px + 0.5, py + 0.5, C - 1, C - 1);
              if (q.m) mine(c, px + 16, py + 16);
              else if (q.n) {
                c.font = 'bold 19px "Segoe UI", Tahoma';
                c.textAlign = 'center';
                c.textBaseline = 'middle';
                c.fillStyle = NC[q.n];
                c.fillText(String(q.n), px + 16, py + 17);
                c.textBaseline = 'alphabetic';
              }
            } else {
              gloss(c, px + 1, py + 1, C - 2, C - 2, 5, '#5aa9ee', 'rgba(0,50,110,.45)');
              if (q.f) {
                c.fillStyle = '#3a2a10';
                c.fillRect(px + 10, py + 8, 2, 17);
                c.beginPath();
                c.moveTo(px + 12, py + 8);
                c.lineTo(px + 25, py + 13);
                c.lineTo(px + 12, py + 19);
                c.fillStyle = '#ff3b30';
                c.fill();
              }
              if (lost && q.m) mine(c, px + 16, py + 16);
            }
          }
      },
    };
  },
};

/** The eight picture cards in Memory Match. */
function symbol(c: Ctx, i: number, x: number, y: number, s: number) {
  const fillG = (top: string, bot: string) => {
    const g = c.createLinearGradient(0, y - s, 0, y + s);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.3)';
    c.lineWidth = 1.5;
    c.stroke();
  };
  c.beginPath();
  if (i === 0) {
    starPath(c, x, y + 2, s, s * 0.45);
    fillG('#fff6b0', '#f5a000');
  } else if (i === 1) {
    c.moveTo(x, y + s * 0.85);
    c.bezierCurveTo(x - s * 1.2, y, x - s * 0.7, y - s * 0.95, x, y - s * 0.4);
    c.bezierCurveTo(x + s * 0.7, y - s * 0.95, x + s * 1.2, y, x, y + s * 0.85);
    fillG('#ff9db0', '#e0203f');
  } else if (i === 2) {
    c.arc(x, y, s * 0.85, Math.PI * 0.3, Math.PI * 1.7);
    c.arc(x + s * 0.35, y - s * 0.1, s * 0.62, Math.PI * 1.55, Math.PI * 0.45, true);
    fillG('#fff3a6', '#e7b400');
  } else if (i === 3) {
    c.moveTo(x, y - s);
    c.bezierCurveTo(x + s * 0.2, y - s * 0.5, x + s * 0.8, y, x + s * 0.8, y + s * 0.3);
    c.arc(x, y + s * 0.3, s * 0.8, 0, Math.PI);
    c.bezierCurveTo(x - s * 0.8, y, x - s * 0.2, y - s * 0.5, x, y - s);
    fillG('#bfe9ff', '#1f8fe0');
  } else if (i === 4) {
    c.ellipse(x, y, s * 0.5, s * 0.95, 0.7, 0, TAU);
    fillG('#c4f59a', '#2e9e2a');
    c.strokeStyle = 'rgba(255,255,255,.7)';
    c.beginPath();
    c.moveTo(x - s * 0.5, y + s * 0.55);
    c.lineTo(x + s * 0.45, y - s * 0.5);
    c.stroke();
  } else if (i === 5) {
    c.moveTo(x + s * 0.2, y - s);
    c.lineTo(x - s * 0.6, y + s * 0.1);
    c.lineTo(x - s * 0.05, y + s * 0.1);
    c.lineTo(x - s * 0.25, y + s);
    c.lineTo(x + s * 0.6, y - s * 0.15);
    c.lineTo(x + s * 0.05, y - s * 0.15);
    c.closePath();
    fillG('#fff59a', '#ff9800');
  } else if (i === 6) {
    c.ellipse(x - s * 0.35, y + s * 0.55, s * 0.36, s * 0.27, -0.4, 0, TAU);
    fillG('#e2b6ff', '#8c43cc');
    c.fillStyle = '#8c43cc';
    c.fillRect(x - s * 0.06, y - s * 0.9, s * 0.13, s * 1.45);
    c.beginPath();
    c.moveTo(x + s * 0.06, y - s * 0.9);
    c.quadraticCurveTo(x + s * 0.7, y - s * 0.6, x + s * 0.5, y - s * 0.1);
    c.quadraticCurveTo(x + s * 0.5, y - s * 0.45, x + s * 0.06, y - s * 0.5);
    c.fill();
  } else {
    c.moveTo(x, y - s);
    c.lineTo(x + s * 0.75, y);
    c.lineTo(x, y + s);
    c.lineTo(x - s * 0.75, y);
    c.closePath();
    fillG('#c9fbff', '#00a8c6');
  }
}

export const memory: GameDef = {
  id: 'memory',
  name: 'Memory Match',
  w: 400,
  h: 440,
  blurb: 'Flip cards and find all the matching pairs.',
  help: 'Click two cards to flip them. Find all 8 matching pairs in as few moves as you can.',
  make(a) {
    const deck = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5).map((s) => ({ s, up: false, ok: false }));
    let first = -1, lock = 0, moves = 0, pairs = 0;
    return {
      update(dt) {
        if (lock > 0) {
          lock -= dt;
          if (lock <= 0) {
            deck.forEach((d) => !d.ok && (d.up = false));
            first = -1;
          }
        }
        a.info('Moves: ' + moves);
      },
      pointer(type, x, y) {
        if (type !== 'down' || lock > 0) return;
        const X = Math.floor((x - 10) / 95), Y = Math.floor((y - 10) / 105);
        if (X < 0 || X > 3 || Y < 0 || Y > 3) return;
        const i = Y * 4 + X, d = deck[i];
        if (d.up || d.ok) return;
        d.up = true;
        if (first < 0) return void (first = i);
        moves++;
        if (deck[first].s === d.s) {
          deck[first].ok = d.ok = true;
          first = -1;
          a.addScore(100);
          if (++pairs === 8) {
            a.setScore(Math.max(100, 1000 - moves * 30));
            a.over('You matched them all!');
          }
        } else lock = 0.75;
      },
      draw(c) {
        sky(c, 400, 440, '#2b6fd0', '#0d2a63');
        deck.forEach((d, i) => {
          const px = 10 + (i % 4) * 95, py = 10 + Math.floor(i / 4) * 105;
          if (d.up || d.ok) {
            gloss(c, px, py, 88, 98, 12, d.ok ? '#c8f7c0' : '#ffffff', d.ok ? 'rgba(20,110,30,.6)' : 'rgba(0,40,90,.4)');
            symbol(c, d.s, px + 44, py + 50, 26);
          } else {
            gloss(c, px, py, 88, 98, 12, '#3a8de8', 'rgba(0,30,80,.55)');
            c.fillStyle = 'rgba(255,255,255,.55)';
            starPath(c, px + 44, py + 52, 20);
            c.fill();
          }
        });
      },
    };
  },
};

export const ttt: GameDef = {
  id: 'ttt',
  name: 'Tic-Tac-Toe',
  w: 330,
  h: 360,
  blurb: 'Tic-Tac-Toe against an unbeatable computer.',
  help: 'Click a square to place your X. Get three in a row before the computer does.',
  make(a) {
    let b: string[] = Array(9).fill('');
    let res = '', turnP = true;
    const L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const win = (bd: string[], p: string) => L.some((l) => l.every((i) => bd[i] === p));
    const mm = (bd: string[], pl: string): number => {
      if (win(bd, 'O')) return 10;
      if (win(bd, 'X')) return -10;
      if (bd.every((x) => x)) return 0;
      let best = pl === 'O' ? -99 : 99;
      for (let i = 0; i < 9; i++)
        if (!bd[i]) {
          bd[i] = pl;
          const v = mm(bd, pl === 'O' ? 'X' : 'O');
          bd[i] = '';
          best = pl === 'O' ? Math.max(best, v) : Math.min(best, v);
        }
      return best;
    };
    const fin = () => {
      if (win(b, 'X')) {
        res = 'You win! Click to play again';
        a.addScore(10);
      } else if (win(b, 'O')) res = 'The computer wins. Click to play again';
      else if (b.every((x) => x)) res = 'Draw. Click to play again';
      turnP = true;
    };
    const ai = () => {
      let bi = -1, bv = -99;
      for (let i = 0; i < 9; i++)
        if (!b[i]) {
          b[i] = 'O';
          const v = mm(b, 'X');
          b[i] = '';
          if (v > bv || (v === bv && Math.random() < 0.3)) (bv = v), (bi = i);
        }
      if (bi >= 0) b[bi] = 'O';
      fin();
    };
    let timer = 0;
    return {
      destroy: () => clearTimeout(timer),
      pointer(type, x, y) {
        if (type !== 'down') return;
        if (res) {
          b = Array(9).fill('');
          res = '';
          return;
        }
        const X = Math.floor((x - 15) / 100), Y = Math.floor((y - 15) / 100);
        if (X < 0 || X > 2 || Y < 0 || Y > 2 || y > 315) return;
        const i = Y * 3 + X;
        if (b[i] || !turnP) return;
        b[i] = 'X';
        fin();
        if (!res) {
          turnP = false;
          timer = window.setTimeout(() => !res && ai(), 250);
        }
      },
      draw(c) {
        sky(c, 330, 360, '#eef7ff', '#bcd9f5');
        rr(c, 10, 10, 310, 310, 18);
        c.fillStyle = 'rgba(255,255,255,.55)';
        c.fill();
        c.strokeStyle = 'rgba(40,110,190,.35)';
        c.stroke();
        c.lineCap = 'round';
        for (const [x1, y1, x2, y2] of [[115, 25, 115, 305], [215, 25, 215, 305], [25, 115, 305, 115], [25, 215, 305, 215]]) {
          c.strokeStyle = '#4c97e6';
          c.lineWidth = 7;
          c.beginPath();
          c.moveTo(x1, y1);
          c.lineTo(x2, y2);
          c.stroke();
          c.strokeStyle = 'rgba(255,255,255,.6)';
          c.lineWidth = 2;
          c.stroke();
        }
        b.forEach((v, i) => {
          const cx = 65 + (i % 3) * 100, cy = 65 + Math.floor(i / 3) * 100;
          if (!v) return;
          c.lineWidth = 12;
          c.strokeStyle = v === 'X' ? '#e8344a' : '#20b45a';
          c.beginPath();
          if (v === 'X') {
            c.moveTo(cx - 24, cy - 24);
            c.lineTo(cx + 24, cy + 24);
            c.moveTo(cx + 24, cy - 24);
            c.lineTo(cx - 24, cy + 24);
          } else c.arc(cx, cy, 26, 0, TAU);
          c.stroke();
          c.lineWidth = 3;
          c.strokeStyle = 'rgba(255,255,255,.65)';
          c.stroke();
        });
        label(c, res || 'Your move (you are X)', 165, 341, 15, '#13314f');
      },
    };
  },
};
