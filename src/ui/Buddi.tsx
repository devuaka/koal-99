// The Buddi character that lives on the desktop.
import { useEffect, useId, useRef, useState } from 'react';
import { roundStar } from './icons';
import { buddiStore, say, anim, sleep, wake, hideBuddi, saveBuddi, pick, JOKES, FACTS, TIPS, APPSAY, BuddiState } from '../core/buddi';
import { openMenu } from '../core/menu';
import { openApp, wmStore } from '../core/wm';
import * as fs from '../core/fs';
import { desktopDir } from '../core/session';

// Buddi is a chubby glossy star, drawn in the same Aero style as the rest of KOAL-99.
const STAR = roundStar(60, 67, 57, 32);
const SPARK = 'M0-6Q1-1 6 0 1 1 0 6-1 1-6 0-1-1 0-6Z';

export function BuddiArt({ asleep = false }: { asleep?: boolean }) {
  const u = 'bd' + useId().replace(/\W/g, '');
  const url = (n: string) => `url(#${u}${n})`;
  return (
    <svg viewBox="0 0 120 132" className="bd-svg">
      <defs>
        <radialGradient id={u + 'f'} cx=".4" cy=".28" r=".8">
          <stop offset="0" stopColor="#fffbe0" /><stop offset=".35" stopColor="#ffe066" /><stop offset=".75" stopColor="#ffb51f" /><stop offset="1" stopColor="#f08400" />
        </radialGradient>
        <linearGradient id={u + 'g'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".7" stopColor="#fff" stopOpacity=".3" /><stop offset="1" stopColor="#fff" stopOpacity=".05" /></linearGradient>
        <radialGradient id={u + 'b'} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff8c8" stopOpacity=".9" /><stop offset="1" stopColor="#fff8c8" stopOpacity="0" /></radialGradient>
        <radialGradient id={u + 'e'} cx=".5" cy=".3" r=".75"><stop offset="0" stopColor="#4a7fcc" /><stop offset=".6" stopColor="#173463" /><stop offset="1" stopColor="#0a1530" /></radialGradient>
        <radialGradient id={u + 's'} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#0a2a50" stopOpacity=".4" /><stop offset="1" stopColor="#0a2a50" stopOpacity="0" /></radialGradient>
        <clipPath id={u + 'c'}><path d={STAR} /></clipPath>
      </defs>
      <ellipse className="bd-shadow" cx="60" cy="124" rx="32" ry="5" fill={url('s')} />
      <g className="bd-body">
        <path d={STAR} fill={url('f')} stroke="#c46a00" strokeWidth="2.2" strokeLinejoin="round" />
        <g clipPath={url('c')}>
          <ellipse cx="60" cy="112" rx="40" ry="16" fill={url('b')} />
          <path d={STAR} fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3" />
          <path d="M0 0H120V47C98 37 76 33 52 36 32 39 15 45 0 52Z" fill={url('g')} opacity=".9" />
        </g>
        <ellipse cx="47" cy="22" rx="5" ry="2.6" fill="#fff" transform="rotate(-38 47 22)" />
        <ellipse className="bd-cheek" cx="34" cy="76" rx="6.5" ry="3.8" fill="#ff6f5e" opacity=".45" />
        <ellipse className="bd-cheek" cx="86" cy="76" rx="6.5" ry="3.8" fill="#ff6f5e" opacity=".45" />
        {asleep ? (
          <path d="M39 64q7.5 6 15 0M66 64q7.5 6 15 0" fill="none" stroke="#173463" strokeWidth="3.4" strokeLinecap="round" />
        ) : (
          <g className="bd-eyes">
            <ellipse cx="47" cy="63" rx="7.2" ry="9.8" fill={url('e')} />
            <ellipse cx="73" cy="63" rx="7.2" ry="9.8" fill={url('e')} />
            <ellipse cx="49.3" cy="58.6" rx="2.9" ry="3.5" fill="#fff" />
            <ellipse cx="75.3" cy="58.6" rx="2.9" ry="3.5" fill="#fff" />
            <circle cx="44.6" cy="67.6" r="1.4" fill="#bfe3ff" opacity=".9" />
            <circle cx="70.6" cy="67.6" r="1.4" fill="#bfe3ff" opacity=".9" />
          </g>
        )}
        <path className="bd-mouth" d={asleep ? 'M56 80q4 2 8 0' : 'M51 77Q60 86 69 77'} fill="none" stroke="#5a2a00" strokeWidth="3.2" strokeLinecap="round" />
        <g className="bd-mouth2">
          <path d="M50 76Q60 92 70 76Q60 80 50 76Z" fill="#7a1f12" stroke="#5a2a00" strokeWidth="2.4" strokeLinejoin="round" />
          <ellipse cx="60" cy="84" rx="4.6" ry="2.2" fill="#ff7a8a" />
        </g>
      </g>
      {asleep ? (
        <>
          <text className="bd-zzz" x="98" y="26" fontSize="16" fontWeight="bold">z</text>
          <text className="bd-zzz z2" x="108" y="13" fontSize="12" fontWeight="bold">z</text>
        </>
      ) : (
        <>
          <path className="bd-spark" d={SPARK} transform="translate(106 26)" />
          <path className="bd-spark s2" d={SPARK} transform="translate(12 34) scale(.7)" />
          <path className="bd-spark s3" d={SPARK} transform="translate(108 100) scale(.55)" />
        </>
      )}
    </svg>
  );
}

function Bubble({ b, below, onClose }: { b: NonNullable<BuddiState['bubble']>; below: boolean; onClose: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const t = window.setInterval(() => setN((x) => (x >= b.text.length ? (window.clearInterval(t), x) : x + 2)), 30);
    const h = window.setTimeout(onClose, b.ms);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.id]);
  return (
    <div className={`bd-bubble ${below ? 'below' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
      <span>{b.text.slice(0, n)}</span>
      <b className="bd-x" onClick={onClose}>{'×'}</b>
    </div>
  );
}

export function Buddi() {
  const st = buddiStore.use((s) => s);
  const lastAct = useRef(Date.now());
  const lastNote = useRef(0);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const talking = !!st.bubble;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const x = Math.max(0, Math.min(W - 110, st.x ?? W - 160));
  const y = Math.max(0, Math.min(H - 40 - 130, st.y ?? H - 220));

  // activity, idle sleep, random fidgets and tips
  useEffect(() => {
    if (!st.on) return;
    const act = () => {
      lastAct.current = Date.now();
      if (buddiStore.get().asleep) wake();
    };
    window.addEventListener('pointerdown', act, true);
    window.addEventListener('keydown', act, true);
    const t = window.setInterval(() => {
      const s = buddiStore.get();
      const idle = Date.now() - lastAct.current;
      if (idle > 120000 && !s.asleep) return sleep();
      if (s.asleep) return;
      const r = Math.random();
      if (r < 0.1) anim('look', 1400);
      else if (r < 0.13) anim('wave', 1600);
      if (r > 0.985 && idle > 15000) say(pick([...TIPS.map((x) => 'Tip: ' + x), ...FACTS, ...JOKES]));
    }, 1000);
    return () => {
      window.removeEventListener('pointerdown', act, true);
      window.removeEventListener('keydown', act, true);
      window.clearInterval(t);
    };
  }, [st.on]);

  // comment on apps being opened and on files coming and going
  useEffect(() => {
    if (!st.on) return;
    let wins = wmStore.get().wins.map((w) => w.id);
    let count = fs.children(desktopDir().id).length;
    const ok = (cool: number, chance: number) => !buddiStore.get().asleep && Date.now() - lastNote.current > cool && Math.random() < chance;
    const u1 = wmStore.subscribe(() => {
      const now = wmStore.get().wins;
      const added = now.filter((w) => !wins.includes(w.id));
      wins = now.map((w) => w.id);
      for (const w of added)
        if (APPSAY[w.app] && ok(25000, 0.5)) {
          lastNote.current = Date.now();
          window.setTimeout(() => say(APPSAY[w.app], 4500), 700);
        }
    });
    const u2 = fs.fsStore.subscribe(() => {
      const c = fs.children(desktopDir().id).length;
      if (c === count) return;
      const grew = c > count;
      count = c;
      if (ok(20000, 0.45)) {
        lastNote.current = Date.now();
        say(grew ? pick(['A brand new thing! Give it a name.', 'Ooh, what is in it?', 'Fresh and clean!']) : pick(['Whoosh! Gone.', 'Bye bye, file!', 'Tidying up? Nice.']), 3500);
      }
    });
    return () => {
      u1();
      u2();
    };
  }, [st.on]);

  if (!st.on) return null;

  const menu = (e: React.MouseEvent) =>
    openMenu(e, [
      { label: 'Talk to Buddi', bold: true, onClick: () => openApp('kbuddi') },
      { sep: true },
      { label: 'Tell me a joke', onClick: () => say(pick(JOKES)) },
      { label: 'Fun fact', onClick: () => say(pick(FACTS)) },
      { label: 'Give me a tip', onClick: () => say(pick(TIPS)) },
      { label: 'Dance!', onClick: () => (anim('dance', 2400), say('La la la~ Watch this!')) },
      { label: st.asleep ? 'Wake up' : 'Go to sleep', onClick: () => (st.asleep ? wake() : sleep()) },
      { sep: true },
      { label: 'Hide Buddi', onClick: hideBuddi },
    ]);

  return (
    <div
      className={`buddi ${st.asleep ? 'sleep' : ''} ${st.anim ?? ''} ${talking ? 'talk' : ''} ${drag.current?.moved ? 'grab' : ''}`}
      style={{ left: x, top: y }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        lastAct.current = Date.now();
        wake();
        drag.current = { sx: e.clientX, sy: e.clientY, ox: x, oy: y, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.sx;
        const dy = e.clientY - d.sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
        if (d.moved) buddiStore.set({ x: d.ox + dx, y: d.oy + dy });
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (d.moved) {
          saveBuddi();
          say(pick(['Wheee!', 'Put me down gently!', 'Nice spot!', 'Ooh, new view!']), 2500);
        } else {
          anim('jump', 600);
          const n = buddiStore.get().name;
          say(pick([`Hi${n ? ' ' + n : ''}! Double-click me to chat.`, 'Hehe, that tickles!', 'Need something? Double-click me!', 'I am Buddi, your desktop buddy!']), 3500);
        }
      }}
      onDoubleClick={() => openApp('kbuddi')}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        menu(e);
      }}
    >
      <BuddiArt asleep={st.asleep} />
      {st.bubble && <Bubble b={st.bubble} below={y < 150} onClose={() => buddiStore.set({ bubble: null })} />}
    </div>
  );
}
