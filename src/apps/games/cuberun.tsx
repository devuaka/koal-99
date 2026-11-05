// Cube Run: a Geometry Dash style auto-runner with 4 levels and a level editor whose levels can be
// saved as .lxo files or shared as codes (same format as koalOS).
import * as fs from '../../core/fs';
import { desktopDir } from '../../core/session';
import { Ctx, GameDef, gloss, hsGet, hsSet, jellyCube, label, sky } from './kit';

const LEVELS = [
  { name: 'Warm Up', len: 55, speed: 260, seed: 11, spike: 0.11, block: 0.05, gap: 5 },
  { name: 'Block Party', len: 75, speed: 290, seed: 22, spike: 0.09, block: 0.17, gap: 4 },
  { name: 'Spike Storm', len: 95, speed: 315, seed: 33, spike: 0.23, block: 0.07, gap: 3 },
  { name: 'The Gauntlet', len: 125, speed: 340, seed: 44, spike: 0.18, block: 0.17, gap: 2 },
];
type Cfg = (typeof LEVELS)[number];

const genLevel = (cfg: Cfg) => {
  let seed = cfg.seed * 7919 + 13;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const L: number[] = new Array(cfg.len).fill(0);
  let last = -99;
  for (let i = 6; i < cfg.len - 4; i++) {
    if (i - last < cfg.gap) continue;
    const r = rnd();
    if (r < cfg.spike) (L[i] = 1), (last = i);
    else if (r < cfg.spike + cfg.block) (L[i] = 2), (last = i);
  }
  return L;
};
export const packLevel = (data: number[], name: string, spd: number) => '#cuberun-level\n#name: ' + name.replace(/[\r\n]/g, ' ') + '\n#speed: ' + spd + '\n' + data.join('');
export function parseLevel(txt0: unknown) {
  let txt = String(txt0 || '').trim();
  if (!/^#cuberun-level/.test(txt)) {
    try {
      const d = decodeURIComponent(escape(atob(txt.replace(/\s/g, ''))));
      if (/^#cuberun-level/.test(d)) txt = d;
    } catch {
      /* not a code */
    }
  }
  if (!/^#cuberun-level/.test(txt)) return null;
  const ls = txt.split('\n');
  let name = 'Level', spd = 280, i = 1;
  if (/^#name:/.test(ls[i] || '')) (name = ls[i].slice(6).trim() || name), i++;
  if (/^#speed:/.test(ls[i] || '')) (spd = +ls[i].slice(7).trim() || 280), i++;
  const data = ls.slice(i).join('').replace(/[^012]/g, '').split('').map(Number);
  return data.length ? { data, name, speed: spd } : null;
}

const spike = (c: Ctx, x: number, base: number, w: number, h: number) => {
  c.beginPath();
  c.moveTo(x + 2, base);
  c.lineTo(x + w / 2, base - h);
  c.lineTo(x + w - 2, base);
  c.closePath();
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#ff8a8a');
  g.addColorStop(0.5, '#ff3b4f');
  g.addColorStop(1, '#b0102a');
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,.7)';
  c.lineWidth = 1.2;
  c.stroke();
};

export const cuberun: GameDef = {
  id: 'cuberun',
  name: 'Cube Run',
  w: 700,
  h: 380,
  blurb: 'A Geometry Dash style runner: jump the spikes and blocks. 4 levels, plus a level editor you can share.',
  help: 'Space, Up or click to jump. Clear the spikes and blocks without touching them. Try the Level Editor to build your own and share the code.',
  make(a) {
    const GY = 300, CW = 40, PX = 140, SZ = 26, GRAV = 2000, JUMPV = 680;
    let mode: 'menu' | 'play' | 'edit' = 'menu';
    let L: number[] = [], levelName = '', levelKey = '', speed = 280, worldX = 0, py = 0, vy = 0, grounded = true, dead = false, attempts = 0, bestPct = 0, t = 0, fromEditor = false;
    let editL: number[] | null = null, editScroll = 0, editName = 'My Level', head = 'Pick a level', editMsg = 'Left / Right arrows scroll the editor.';
    const editSpeed = 280;
    let respawnT = 0;
    const pct = () => Math.min(100, Math.floor((worldX / (CW * L.length)) * 100));
    const respawn = () => {
      worldX = 0;
      py = 0;
      vy = 0;
      grounded = true;
      dead = false;
    };
    const start = (lv: number[], name: string, spd: number, key = '', fromEd = false) => {
      L = lv.slice();
      levelName = name;
      speed = spd;
      levelKey = key;
      fromEditor = fromEd;
      bestPct = key ? hsGet(key) : 0;
      respawn();
      attempts = 1;
      mode = 'play';
      a.refresh();
    };
    const toMenu = (msg = 'Pick a level') => {
      clearTimeout(respawnT);
      mode = 'menu';
      head = msg;
      a.info('');
      a.refresh();
    };
    const toEditor = () => {
      clearTimeout(respawnT);
      if (!editL) editL = new Array(50).fill(0);
      mode = 'edit';
      a.info('');
      a.refresh();
    };
    const jump = () => {
      if (mode === 'play' && grounded && !dead) {
        vy = -JUMPV;
        grounded = false;
      }
    };
    // a level file or share code opened from the desktop
    const opened = parseLevel(a.opts.level);
    if (opened) start(opened.data, opened.name, opened.speed);

    const menuUI = () => (
      <div className="kgh-dlg wide">
        <div className="kgh-dt">Cube Run</div>
        <div className="kgh-db">
          <p>{head}</p>
          <div className="kgh-grid">
            {LEVELS.map((cfg, i) => (
              <button key={cfg.name} className="k-btn" onClick={() => start(genLevel(cfg), cfg.name, cfg.speed, 'cuberun_lvl' + i)}>
                {cfg.name} ({hsGet('cuberun_lvl' + i)}%)
              </button>
            ))}
          </div>
          <button className="k-btn default" onClick={toEditor}>Open Level Editor</button>
          <div className="kgh-join">
            <input className="k-input" maxLength={4000} placeholder="Paste a shared level code" spellCheck={false} />
            <button
              className="k-btn"
              onClick={(e) => {
                const v = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement).value;
                const p = parseLevel(v);
                if (!p) return ((head = 'That does not look like a valid level code.'), a.refresh());
                start(p.data, p.name, p.speed);
              }}
            >
              Play it
            </button>
          </div>
          <small>Build your own in the Level Editor, then share the code with a friend.</small>
        </div>
      </div>
    );
    const editUI = () => (
      <div className="kgh-dlg top wide">
        <div className="kgh-dt">Level Editor</div>
        <div className="kgh-db">
          <p>Click a column below to cycle empty, spike, block.</p>
          <label className="kgh-row">
            Name <input className="k-input" maxLength={24} defaultValue={editName} onChange={(e) => (editName = e.target.value)} />
          </label>
          <div className="kgh-row">
            <button className="k-btn" onClick={() => ((editL = editL!.concat(new Array(10).fill(0))), a.refresh())}>+10 columns</button>
            <button className="k-btn" onClick={() => (editL!.length > 20 && (editL = editL!.slice(0, -10)), (editScroll = Math.min(editScroll, Math.max(0, editL!.length - 24))), a.refresh())}>-10 columns</button>
            <button className="k-btn default" onClick={() => start(editL!, editName || 'Test', editSpeed, '', true)}>Test play</button>
          </div>
          <div className="kgh-row">
            <button
              className="k-btn"
              onClick={() => {
                const d = desktopDir();
                const n = fs.create(d.id, fs.uniqueName(d.id, (editName || 'My Level') + '.lxo'), 'file', packLevel(editL!, editName || 'My Level', editSpeed));
                editMsg = `Saved ${n.name} on your desktop.`;
                a.refresh();
              }}
            >
              Save to desktop
            </button>
            <button
              className="k-btn"
              onClick={async () => {
                const code = btoa(unescape(encodeURIComponent(packLevel(editL!, editName || 'My Level', editSpeed))));
                try {
                  await navigator.clipboard.writeText(code);
                  editMsg = "Share code copied! Paste it into a friend's Cube Run menu.";
                } catch {
                  editMsg = 'Could not copy. Your share code: ' + code;
                }
                a.refresh();
              }}
            >
              Copy share code
            </button>
            <button className="k-btn" onClick={() => toMenu()}>Back to menu</button>
          </div>
          <small>{editMsg}</small>
        </div>
      </div>
    );
    const playUI = () => (
      <button className="k-btn kgh-corner" onClick={() => (fromEditor ? toEditor() : toMenu())}>
        {fromEditor ? 'Back to editor' : 'Exit level'}
      </button>
    );

    return {
      destroy: () => clearTimeout(respawnT),
      overlay: () => (mode === 'menu' ? menuUI() : mode === 'edit' ? editUI() : playUI()),
      key(k, down) {
        if (!down) return;
        if (mode === 'play' && (k === ' ' || k === 'ArrowUp' || k === 'w')) jump();
        else if (mode === 'edit' && editL) {
          if (k === 'ArrowRight') editScroll = Math.min(Math.max(0, editL.length - 24), editScroll + 3);
          else if (k === 'ArrowLeft') editScroll = Math.max(0, editScroll - 3);
        }
      },
      pointer(type, x, y) {
        if (type !== 'down') return;
        if (mode === 'play') return jump();
        if (mode === 'edit' && editL) {
          const cs = 28, baseY = 300;
          if (y < baseY - cs || y > baseY) return;
          const i = Math.floor(editScroll) + Math.floor((x - 10) / cs);
          if (i >= 0 && i < editL.length) editL[i] = (editL[i] + 1) % 3;
        }
      },
      update(dt) {
        t += dt;
        if (mode !== 'play' || dead) return;
        worldX += speed * dt;
        vy += GRAV * dt;
        py += vy * dt;
        if (py >= 0) (py = 0), (vy = 0), (grounded = true);
        const col = Math.floor(worldX / CW), hz = L[col];
        if ((hz === 1 && py > -18) || (hz === 2 && py > -32)) {
          dead = true;
          const p = pct();
          if (p > bestPct) {
            bestPct = p;
            if (levelKey) hsSet(levelKey, p);
          }
          a.setScore(bestPct);
          respawnT = window.setTimeout(() => (attempts++, respawn()), 420);
        }
        if (col >= L.length) {
          if (levelKey) hsSet(levelKey, 100);
          a.setScore(100);
          if (fromEditor) {
            editMsg = 'You beat your level!';
            return toEditor();
          }
          return toMenu(`You beat ${levelName}! Pick another level.`);
        }
        a.info(`${levelName}   ·   ${pct()}%   ·   Attempt ${attempts}`);
      },
      draw(c) {
        if (mode === 'edit' && editL) {
          sky(c, 700, 380, '#16305e', '#081631');
          label(c, `Editing: ${editName || 'My Level'}   (${editL.length} columns)`, 10, 248, 13, '#cfe4ff', 'left', false);
          const cs = 28, baseY = 300, s0 = Math.floor(editScroll);
          for (let i = 0; i < 24; i++) {
            const idx = s0 + i;
            if (idx >= editL.length) break;
            const x = 10 + i * cs, tt = editL[idx];
            c.strokeStyle = 'rgba(160,200,255,.35)';
            c.strokeRect(x + 0.5, baseY - cs + 0.5, cs - 1, cs - 1);
            if (tt === 1) spike(c, x, baseY, cs, cs - 2);
            else if (tt === 2) gloss(c, x + 2, baseY - cs + 2, cs - 4, cs - 4, 4, '#ffa726');
            c.fillStyle = '#7d93c4';
            c.font = '9px Consolas';
            c.textAlign = 'center';
            c.fillText(String(idx), x + cs / 2, baseY + 12);
          }
          label(c, 'Click a column above to edit it', 350, 340, 12, '#cfe4ff', 'center', false);
          return;
        }
        sky(c, 700, 380, '#5b5fe8', '#39c6f0');
        const off = mode === 'play' ? worldX : t * 60;
        for (let i = 0; i < 7; i++) {
          const x = i * 140 - ((off * 0.3) % 140);
          c.fillStyle = 'rgba(255,255,255,.12)';
          c.fillRect(x, 40 + (i % 3) * 30, 70, 300);
        }
        const gg = c.createLinearGradient(0, GY, 0, 380);
        gg.addColorStop(0, '#9be8ff');
        gg.addColorStop(0.08, '#2a5fc4');
        gg.addColorStop(1, '#13306e');
        c.fillStyle = gg;
        c.fillRect(0, GY, 700, 380 - GY);
        if (mode === 'menu') {
          label(c, 'CUBE RUN', 350, 70, 40);
          jellyCube(c, 350, GY - 24, 34, '#ffd21f');
          return;
        }
        const camX = worldX - PX, c0 = Math.floor(camX / CW), c1 = Math.floor((camX + 700) / CW);
        for (let i = Math.max(0, c0); i <= c1 && i < L.length; i++) {
          const x = i * CW - camX;
          if (L[i] === 1) spike(c, x, GY, CW, 30);
          else if (L[i] === 2) gloss(c, x + 2, GY - 34, CW - 4, 34, 6, '#ffa726', 'rgba(120,60,0,.6)');
        }
        if (c1 + 1 >= L.length) {
          const x = L.length * CW - camX;
          c.shadowColor = '#7cf27c';
          c.shadowBlur = 16;
          gloss(c, x, GY - 80, 8, 80, 4, '#7cf27c');
          c.shadowBlur = 0;
        }
        c.save();
        c.translate(PX + SZ / 2, GY + py - SZ / 2);
        c.rotate(grounded ? 0 : (worldX / 40) % (Math.PI * 2));
        jellyCube(c, 0, 0, SZ, dead ? '#9aa6b8' : '#ffd21f', dead);
        c.restore();
      },
    };
  },
};
