import { useEffect, useRef, useState } from 'react';
import type { WinCtx } from '../core/registry';
import { MenuBar } from '../ui/MenuBar';
import { alertBox } from '../core/dialog';
import { play } from '../core/sound';
import { openApp } from '../core/wm';

function fmt(n: number, group: boolean): string {
  if (!isFinite(n)) return 'Error';
  let s = String(parseFloat(n.toPrecision(14)));
  if (s.includes('e')) return s;
  if (group) {
    const [i, d] = s.split('.');
    s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d !== undefined ? '.' + d : '');
  }
  return s;
}

export function Calculator({ win }: { win: WinCtx }) {
  const [display, setDisplay] = useState('0');
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);
  const [mem, setMem] = useState(0);
  const [group, setGroup] = useState(false);
  const [msg, setMsg] = useState('');
  const lastOp = useRef<{ op: string; v: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const val = () => parseFloat(display.replace(/,/g, '')) || 0;
  const show = (n: number) => {
    setMsg('');
    setDisplay(fmt(n, false));
  };

  const compute = (a: number, b: number, o: string): number | null => {
    switch (o) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/':
        if (b === 0) {
          setMsg('Cannot divide by zero.');
          play('error');
          return null;
        }
        return a / b;
    }
    return b;
  };

  const digit = (d: string) => {
    setMsg('');
    if (fresh) {
      setDisplay(d === '.' ? '0.' : d);
      setFresh(false);
      return;
    }
    if (d === '.' && display.includes('.')) return;
    if (display.replace(/[^0-9]/g, '').length >= 16) return;
    setDisplay(display === '0' && d !== '.' ? d : display + d);
  };

  const operator = (o: string) => {
    const v = val();
    if (acc !== null && op && !fresh) {
      const r = compute(acc, v, op);
      if (r === null) return clearAll(true);
      setAcc(r);
      show(r);
    } else setAcc(v);
    setOp(o);
    setFresh(true);
    lastOp.current = null;
  };

  const equals = () => {
    let v = val();
    if (op && acc !== null) {
      const r = compute(acc, v, op);
      if (r === null) return clearAll(true);
      lastOp.current = { op, v };
      if (Math.round(r) === 1987 && op) setTimeout(() => setMsg('K O A L'), 50);
      show(r);
      setAcc(null);
      setOp(null);
    } else if (lastOp.current) {
      const r = compute(v, lastOp.current.v, lastOp.current.op);
      if (r !== null) show(r);
    } else {
      v = val();
      if (v === 1987) setMsg('K O A L');
      if (v === 333) setMsg('hello');
    }
    setFresh(true);
  };

  const clearAll = (keepMsg = false) => {
    setDisplay('0');
    setAcc(null);
    setOp(null);
    setFresh(true);
    if (!keepMsg) setMsg('');
    lastOp.current = null;
  };

  const unary = (f: 'sqrt' | 'inv' | 'neg' | 'pct') => {
    const v = val();
    if (f === 'neg') return setDisplay(display.startsWith('-') ? display.slice(1) : display === '0' ? '0' : '-' + display);
    if (f === 'sqrt') {
      if (v < 0) return setMsg('Invalid input for function.');
      show(Math.sqrt(v));
    }
    if (f === 'inv') {
      if (v === 0) return setMsg('Cannot divide by zero.');
      show(1 / v);
    }
    if (f === 'pct') show(acc !== null ? (acc * v) / 100 : 0);
    setFresh(true);
  };

  const back = () => {
    if (fresh) return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  };

  useEffect(() => {
    if (win.focused) rootRef.current?.focus();
  }, [win.focused]);

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (/^[0-9]$/.test(k) || k === '.') digit(k);
    else if (k === ',' ) digit('.');
    else if (['+', '-', '*', '/'].includes(k)) operator(k);
    else if (k === 'Enter' || k === '=') (e.preventDefault(), equals());
    else if (k === 'Backspace') back();
    else if (k === 'Escape') clearAll();
    else if (k === 'Delete') setDisplay('0');
    else if (k === '%') unary('pct');
    else if (k === '@') unary('sqrt');
    else if (k.toLowerCase() === 'r') unary('inv');
    else if (e.ctrlKey && k.toLowerCase() === 'c') navigator.clipboard?.writeText(display).catch(() => {});
    else return;
    play('click');
  };

  const B = ({ l, on, cls = '' }: { l: string; on: () => void; cls?: string }) => (
    <button className={`calc-b ${cls}`} onClick={() => { play('click'); on(); rootRef.current?.focus(); }}>{l}</button>
  );

  const shown = group ? fmt(val(), true) + (display.endsWith('.') ? '.' : '') : display;

  return (
    <div className="calc" ref={rootRef} tabIndex={0} onKeyDown={onKey}>
      <MenuBar menus={[
        { label: 'Edit', items: [
          { label: 'Copy', shortcut: 'Ctrl+C', onClick: () => navigator.clipboard?.writeText(display).catch(() => {}) },
          { label: 'Paste', shortcut: 'Ctrl+V', onClick: async () => { try { const t = await navigator.clipboard.readText(); const n = parseFloat(t); if (!isNaN(n)) { show(n); setFresh(false); } } catch { /* ignore */ } } },
        ] },
        { label: 'View', items: [{ label: 'Digit grouping', checked: group, onClick: () => setGroup(!group) }, { sep: true }, { label: 'Scientific...', onClick: () => openApp('kscicalc') }] },
        { label: 'Help', items: [{ label: 'About Calculator', onClick: () => alertBox('KOAL Calculator 5.1\nKeyboard works too: digits, + - * /, Enter, Esc, Backspace.\n\nTry 1987.', 'About Calculator', 'calc') }] },
      ]} />
      <div className="calc-body">
        <div className="calc-display">{msg || shown}</div>
        <div className="calc-row">
          <div className="calc-mem">{mem !== 0 ? 'M' : ''}</div>
          <B l="Backspace" on={back} cls="red wide" />
          <B l="CE" on={() => { setDisplay('0'); setFresh(true); setMsg(''); }} cls="red wide" />
          <B l="C" on={() => clearAll()} cls="red wide" />
        </div>
        <div className="calc-grid">
          <B l="MC" on={() => setMem(0)} cls="red" />
          <B l="7" on={() => digit('7')} cls="blue" />
          <B l="8" on={() => digit('8')} cls="blue" />
          <B l="9" on={() => digit('9')} cls="blue" />
          <B l="/" on={() => operator('/')} cls="red" />
          <B l="sqrt" on={() => unary('sqrt')} cls="blue" />

          <B l="MR" on={() => { show(mem); setFresh(true); }} cls="red" />
          <B l="4" on={() => digit('4')} cls="blue" />
          <B l="5" on={() => digit('5')} cls="blue" />
          <B l="6" on={() => digit('6')} cls="blue" />
          <B l="*" on={() => operator('*')} cls="red" />
          <B l="%" on={() => unary('pct')} cls="blue" />

          <B l="MS" on={() => setMem(val())} cls="red" />
          <B l="1" on={() => digit('1')} cls="blue" />
          <B l="2" on={() => digit('2')} cls="blue" />
          <B l="3" on={() => digit('3')} cls="blue" />
          <B l="-" on={() => operator('-')} cls="red" />
          <B l="1/x" on={() => unary('inv')} cls="blue" />

          <B l="M+" on={() => setMem(mem + val())} cls="red" />
          <B l="0" on={() => digit('0')} cls="blue" />
          <B l="+/-" on={() => unary('neg')} cls="blue" />
          <B l="." on={() => digit('.')} cls="blue" />
          <B l="+" on={() => operator('+')} cls="red" />
          <B l="=" on={equals} cls="red" />
        </div>
      </div>
    </div>
  );
}
