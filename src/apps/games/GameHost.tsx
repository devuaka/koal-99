// Runs one koal.games game: canvas, Game/Help menus, Game Over / Paused / Help boxes and the score bar.
// Used both in its own window and embedded in a koal.games page in StarNet Explorer.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import { MenuBar } from '../../ui/MenuBar';
import { GameApi, GameDef, GameInst, hsGet, hsSet } from './kit';
import { sfx } from '../../core/sfx';

const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];

export function GameHost({ def, win, opts }: { def: GameDef; win?: WinCtx; opts?: Record<string, unknown> }) {
  const firstOpts = useRef(opts ?? {});
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const inst = useRef<GameInst | null>(null);
  const st = useRef({ score: 0, dead: false, paused: false, keys: {} as Record<string, boolean> });
  const [score, setScoreS] = useState(0);
  const [best, setBest] = useState(() => hsGet(def.id));
  const [info, setInfo] = useState('');
  const [over, setOver] = useState<string | null>(null);
  const [paused, setPausedS] = useState(false);
  const [help, setHelp] = useState<{ t: string; x: string } | null>(null);
  const [, setV] = useState(0);

  const start = useCallback(() => {
    try {
      inst.current?.destroy?.();
    } catch {
      /* ignore */
    }
    const s = st.current;
    s.score = 0;
    s.dead = false;
    s.paused = false;
    for (const k in s.keys) delete s.keys[k];
    setOver(null);
    setPausedS(false);
    setHelp(null);
    setScoreS(0);
    setInfo('');
    const api: GameApi = {
      id: def.id,
      ctx: cv.current!.getContext('2d')!,
      w: def.w,
      h: def.h,
      keys: s.keys,
      get score() {
        return s.score;
      },
      setScore(n) {
        s.score = n;
        setScoreS(n);
        hsSet(def.id, n);
        setBest(hsGet(def.id));
      },
      addScore(n) {
        api.setScore(s.score + n);
      },
      info: (t = '') => setInfo(t),
      over(msg) {
        if (s.dead) return;
        s.dead = true;
        setOver(msg || 'Game over');
        if (/win|cleared|matched|beat/i.test(msg || '') && !/computer wins|friend wins/i.test(msg || '')) sfx.win();
        else sfx.lose();
      },
      refresh: () => setV((v) => v + 1),
      rnd: (a, b) => a + Math.random() * (b - a),
      ri: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
      opts: firstOpts.current,
    };
    inst.current = def.make(api);
    cv.current?.focus({ preventScroll: true });
    setV((v) => v + 1);
  }, [def]);

  const setPaused = (p: boolean) => {
    if (st.current.dead) return;
    st.current.paused = p;
    setPausedS(p);
  };

  // game loop: only runs the game while it can be seen
  useEffect(() => {
    start();
    let alive = true;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = inst.current;
      const s = st.current;
      const c = cv.current;
      if (g && c && c.offsetParent) {
        if (!s.paused && !s.dead) g.update?.(dt);
        g.draw(c.getContext('2d')!);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      try {
        inst.current?.destroy?.();
      } catch {
        /* ignore */
      }
      inst.current = null;
    };
  }, [start]);

  // keys go to the game only while its window is the active one
  useEffect(() => {
    const active = () => {
      const el = wrap.current;
      if (!el || !el.offsetParent) return false;
      const w = el.closest('.win');
      return !w || !w.classList.contains('inactive');
    };
    const kd = (e: KeyboardEvent) => {
      if (!active() || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '')) return;
      const down = e.type === 'keydown';
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const s = st.current;
      if (down && k === 'F2') {
        e.preventDefault();
        return start();
      }
      if (down && (k === 'p' || k === 'Escape') && !s.dead) {
        e.preventDefault();
        return setPaused(!s.paused);
      }
      if (down && k === 'r' && s.dead) return start();
      if (ARROWS.includes(k)) e.preventDefault();
      s.keys[k] = down;
      if (!s.paused) inst.current?.key?.(k, down, e);
    };
    addEventListener('keydown', kd);
    addEventListener('keyup', kd);
    return () => {
      removeEventListener('keydown', kd);
      removeEventListener('keyup', kd);
    };
  }, [start]);

  const ptr = (type: 'down' | 'move' | 'up') => (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = inst.current;
    if (st.current.paused || !g?.pointer) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (type === 'down') {
      e.currentTarget.focus({ preventScroll: true });
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    g.pointer(type, ((e.clientX - r.left) * def.w) / r.width, ((e.clientY - r.top) * def.h) / r.height, e.nativeEvent);
  };

  const showHelp = () => setHelp({ t: 'How to play', x: def.help });

  return (
    <div className="kgh">
      <MenuBar
        menus={[
          {
            label: 'Game',
            items: [
              { label: 'New game', shortcut: 'F2', onClick: start },
              { label: paused ? 'Resume' : 'Pause', shortcut: 'P', disabled: !!over, onClick: () => setPaused(!st.current.paused) },
              { label: 'Best score...', onClick: () => setHelp({ t: 'Best score', x: `${def.name}: ${hsGet(def.id)}` }) },
              ...(win ? [{ sep: true }, { label: 'Exit', onClick: () => win.close() }] : []),
            ],
          },
          {
            label: 'Help',
            items: [
              { label: 'How to play', onClick: showHelp },
              { label: 'About ' + def.name, onClick: () => setHelp({ t: 'About ' + def.name, x: `${def.name} is one of the koal.games arcade games built into KOAL-99.\n\n${def.blurb}` }) },
            ],
          },
        ]}
      />
      <div className="kgh-wrap" ref={wrap}>
        <div className="kgh-stage" style={{ aspectRatio: `${def.w} / ${def.h}`, width: `min(100cqw, calc(100cqh * ${(def.w / def.h).toFixed(4)}), ${def.w}px)` }}>
          <canvas
            ref={cv}
            width={def.w}
            height={def.h}
            tabIndex={0}
            onPointerDown={ptr('down')}
            onPointerMove={ptr('move')}
            onPointerUp={ptr('up')}
            onContextMenu={(e) => e.preventDefault()}
          />
          {inst.current?.overlay?.()}
          {over !== null && (
            <div className="kgh-dlg">
              <div className="kgh-dt">Game Over</div>
              <div className="kgh-db">
                <p>{over}</p>
                <small>Score {score} {'·'} Best {best}</small>
                <button className="k-btn default" autoFocus onClick={start}>Play again</button>
              </div>
            </div>
          )}
          {paused && over === null && (
            <div className="kgh-dlg">
              <div className="kgh-dt">Paused</div>
              <div className="kgh-db">
                <p>The game is paused.</p>
                <button className="k-btn default" autoFocus onClick={() => (setPaused(false), cv.current?.focus())}>Resume</button>
              </div>
            </div>
          )}
          {help && (
            <div className="kgh-dlg">
              <div className="kgh-dt">{help.t}<i onClick={() => setHelp(null)}>{'×'}</i></div>
              <div className="kgh-db">
                <p style={{ whiteSpace: 'pre-wrap' }}>{help.x}</p>
                <button className="k-btn default" autoFocus onClick={() => (setHelp(null), cv.current?.focus())}>OK</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="k-status">
        <div>Score: {score}</div>
        <div>Best: {best}</div>
        <div style={{ flex: 1 }}>{info}</div>
      </div>
    </div>
  );
}
