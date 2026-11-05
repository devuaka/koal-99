// Scientific Calculator: types whole expressions (sin, cos, powers, factorials), live preview, history.
import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import { play } from '../../core/sound';

const HIST_KEY = 'koal99.scicalc';

/** Recursive-descent evaluator: + - * / ^ % ! ( ), sin cos tan ln log sqrt, pi e. */
export function calcEval(src: string, deg: boolean): number {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, '(pi)').replace(/√/g, 'sqrt');
  const tk = s.match(/\d*\.?\d+(?:e[+-]?\d+)?|[a-z]+|[-+*/^()%!]/gi) ?? [];
  let i = 0;
  const peek = () => tk[i];
  const eat = () => tk[i++];
  const rad = (x: number) => (deg ? (x * Math.PI) / 180 : x);
  const fn: Record<string, (x: number) => number> = { sin: (x) => Math.sin(rad(x)), cos: (x) => Math.cos(rad(x)), tan: (x) => Math.tan(rad(x)), ln: Math.log, log: Math.log10, sqrt: Math.sqrt };
  const cst: Record<string, number> = { pi: Math.PI, e: Math.E };
  const fact = (n: number) => {
    if (n < 0 || n > 170 || n !== Math.floor(n)) return NaN;
    let r = 1;
    for (let k = 2; k <= n; k++) r *= k;
    return r;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === '+' || peek() === '-') v = eat() === '+' ? v + term() : v - term();
    return v;
  };
  const term = (): number => {
    let v = unary();
    while (peek() === '*' || peek() === '/') v = eat() === '*' ? v * unary() : v / unary();
    return v;
  };
  const unary = (): number => {
    if (peek() === '-') return eat(), -unary();
    if (peek() === '+') return eat(), unary();
    return power();
  };
  const power = (): number => {
    const v = post();
    if (peek() === '^') return eat(), Math.pow(v, unary());
    return v;
  };
  const post = (): number => {
    let v = atom();
    for (;;) {
      if (peek() === '%') (eat(), (v /= 100));
      else if (peek() === '!') (eat(), (v = fact(v)));
      else break;
    }
    return v;
  };
  const atom = (): number => {
    const t = eat();
    if (t === undefined) throw new Error('end');
    if (t === '(') {
      const v = expr();
      if (peek() === ')') eat();
      return v;
    }
    if (/^[\d.]/.test(t)) return parseFloat(t);
    const l = t.toLowerCase();
    if (l in cst) return cst[l];
    if (l in fn) {
      if (peek() !== '(') throw new Error('fn');
      eat();
      const v = expr();
      if (peek() === ')') eat();
      return fn[l](v);
    }
    throw new Error('tok');
  };
  const v = expr();
  if (i < tk.length) throw new Error('extra');
  return v;
}

const fmt = (v: number) => {
  if (!isFinite(v)) throw new Error('nan');
  const s = String(+v.toPrecision(12));
  return s.startsWith('-') ? '−' + s.slice(1) : s;
};

export function SciCalc({ win }: { win: WinCtx }) {
  const [ex, setEx] = useState('');
  const [deg, setDeg] = useState(true);
  const [mem, setMem] = useState(0);
  const [just, setJust] = useState(false);
  const [err, setErr] = useState('');
  const [showHist, setShowHist] = useState(false);
  const [hist, setHist] = useState<{ ex: string; r: string }[]>(() => {
    try {
      const h = JSON.parse(localStorage.getItem(HIST_KEY) ?? '[]');
      return Array.isArray(h) ? h : [];
    } catch {
      return [];
    }
  });
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem(HIST_KEY, JSON.stringify(hist));
    } catch {
      /* ignore */
    }
  }, [hist]);
  useEffect(() => {
    if (win.focused) root.current?.focus();
  }, [win.focused]);

  const val = (e = ex) => {
    try {
      return calcEval(e, deg);
    } catch {
      return NaN;
    }
  };

  const press = (k: string) => {
    play('click');
    setErr('');
    const opers = '+−×÷^';
    let e = ex;
    let j = just;
    if (/^[0-9.]$/.test(k) || k === 'π' || k === 'e' || k === '(') {
      if (j) e = '';
      j = false;
      e += k;
    } else if (k === ')') (e += k), (j = false);
    else if (opers.includes(k)) {
      if (!e) e = k === '−' ? '−' : '0' + k;
      else if (opers.includes(e.slice(-1)) && e.length > 1) e = e.slice(0, -1) + k;
      else e += k;
      j = false;
    } else if (k === '%' || k === '!') {
      if (e) e += k;
      j = false;
    } else if (['sin', 'cos', 'tan', 'ln', 'log', '√'].includes(k)) {
      if (j) e = '';
      j = false;
      e += k + '(';
    } else if (k === 'x²') e && (e += '^2');
    else if (k === 'xʸ') e && (e += '^');
    else if (k === '1/x') e && (e = '1÷(' + e + ')');
    else if (k === '±') e = e.startsWith('−') ? e.slice(1) : e ? '−' + e : '';
    else if (k === 'C') (e = ''), (j = false);
    else if (k === '⌫') e = j ? '' : e.replace(/(?:sin|cos|tan|ln|log|√)\($|.$/, '');
    else if (k === '=') {
      if (!e) return;
      const v = val(e);
      if (!isFinite(v)) return setErr('Error');
      const r = fmt(v);
      setHist([{ ex: e, r }, ...hist].slice(0, 30));
      e = r;
      j = true;
      if (Math.round(v) === 1987) setTimeout(() => setErr('K O A L'), 50);
    } else if (k === 'MC') setMem(0);
    else if (k === 'MR') mem && ((e += fmt(mem)), (j = false));
    else if (k === 'M+') isFinite(val(e)) && setMem(mem + val(e));
    else if (k === 'M−') isFinite(val(e)) && setMem(mem - val(e));
    setEx(e);
    setJust(j);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const m: Record<string, string> = { '*': '×', '/': '÷', '-': '−', '+': '+', Enter: '=', '=': '=', Backspace: '⌫', Escape: 'C', Delete: 'C', s: 'sin', c: 'cos', t: 'tan', l: 'ln', r: '√', p: 'π' };
    const k = m[e.key] ?? e.key;
    if (/^[0-9.^()%!]$/.test(k) || ['×', '÷', '−', '+', '=', '⌫', 'C', 'sin', 'cos', 'tan', 'ln', '√', 'π'].includes(k)) {
      e.preventDefault();
      press(k);
    }
  };

  let preview = '';
  if (ex && /[+\-−×÷^%!(]|sin|cos|tan|ln|log|√|π/.test(ex.replace(/^−/, ''))) {
    const v = val();
    if (isFinite(v)) preview = '= ' + fmt(v);
  }
  const rows = [
    ['sin', 'cos', 'C', '⌫', '%', '÷'],
    ['tan', 'ln', '7', '8', '9', '×'],
    ['log', '√', '4', '5', '6', '−'],
    ['x²', 'xʸ', '1', '2', '3', '+'],
    ['π', 'e', '±', '0', '.', '='],
  ];
  const shown = err || ex || '0';

  return (
    <div className="sci" ref={root} tabIndex={0} onKeyDown={onKey}>
      <div className="sci-bar">
        <button className={`sci-chip ${deg ? 'on' : ''}`} onClick={() => setDeg(!deg)}>{deg ? 'DEG' : 'RAD'}</button>
        {mem !== 0 && <span className="sci-chip on">M</span>}
        <span className="k-spacer" />
        <button className={`sci-chip ${showHist ? 'on' : ''}`} onClick={() => setShowHist(!showHist)}>History</button>
      </div>
      <div className="sci-screen">
        <div className="sci-prev">{preview}</div>
        <div className="sci-disp" style={{ fontSize: shown.length > 16 ? 18 : 28 }}>{shown}</div>
      </div>
      <div className="sci-mini">
        {['MC', 'MR', 'M+', 'M−', '(', ')', '1/x', '!'].map((k) => <button key={k} className="sci-k mini" onClick={() => press(k)}>{k}</button>)}
      </div>
      <div className="sci-keys">
        {rows.flat().map((k, i) => (
          <button key={i} className={`sci-k ${'÷×−+'.includes(k) ? 'op' : ''} ${k === '=' ? 'eq' : ''} ${/^[0-9.]$/.test(k) ? 'num' : ''}`} onClick={() => press(k)}>{k}</button>
        ))}
      </div>
      {showHist && (
        <div className="sci-hist">
          <div className="k-row"><b>History</b><span className="k-spacer" /><button className="k-btn small" onClick={() => setHist([])}>Clear</button></div>
          {!hist.length && <div style={{ color: '#888' }}>No calculations yet.</div>}
          {hist.map((h, i) => (
            <div key={i} className="sci-hrow" onClick={() => { setEx(h.r); setJust(true); setShowHist(false); }}>
              <small>{h.ex} =</small>
              <b>{h.r}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
