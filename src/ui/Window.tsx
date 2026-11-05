import React, { memo, useCallback, useMemo } from 'react';
import * as wm from '../core/wm';
import { registry, WinCtx } from '../core/registry';
import { Icon } from './Icon';
import { openMenu } from '../core/menu';
import { useSettings } from '../core/settings';

class Boundary extends React.Component<{ name: string; onClose: () => void; children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  render() {
    if (this.state.err)
      return (
        <div className="msgbox">
          <div className="mb-body">
            <Icon name="error" />
            <div className="mb-text">
              <b>{this.props.name} has performed an illegal operation and will be shut down.</b>
              {'\n\n'}If the problem persists, contact the program vendor.{'\n\n'}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{String(this.state.err.message).slice(0, 300)}</span>
            </div>
          </div>
          <div className="mb-btns">
            <button className="k-btn" onClick={() => this.setState({ err: null })}>Retry</button>
            <button className="k-btn default" onClick={this.props.onClose}>Close</button>
          </div>
        </div>
      );
    return this.props.children;
  }
}

const MinIcon = () => (
  <svg width="9" height="9" viewBox="0 0 9 9"><rect x="1" y="6" width="6" height="2" fill="#fff" /></svg>
);
const MaxIcon = () => (
  <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1 1h9v9H1z M1 1h9v2H1z" fill="none" stroke="#fff" strokeWidth="1.5" /><rect x="1" y="1" width="9" height="2.5" fill="#fff" /></svg>
);
const RestoreIcon = () => (
  <svg width="11" height="11" viewBox="0 0 11 11"><path d="M3.5 1h6.5v6.5M1 3.5h6.5v6.5H1z" fill="none" stroke="#fff" strokeWidth="1.4" /><rect x="1" y="3.5" width="6.5" height="2" fill="#fff" /></svg>
);
const CloseIcon = () => (
  <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="#fff" strokeWidth="2" /></svg>
);

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function WindowImpl({ win, focused }: { win: wm.Win; focused: boolean }) {
  const def = registry[win.app];
  const settings = useSettings();
  const resizable = def?.resizable !== false;
  const maximizable = resizable && def?.maximizable !== false;

  const ctx: WinCtx = useMemo(
    () => ({ id: win.id, props: win.props, setTitle: (t: string) => wm.setTitle(win.id, t), close: () => wm.close(win.id), focused }),
    [win.id, win.props, focused],
  );

  const onTitleDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('.wb')) return;
      wm.focus(win.id);
      const sx = e.clientX;
      const sy = e.clientY;
      const start = { x: win.x, y: win.y, w: win.w };
      let restored = !win.maximized;
      let offsetX = sx - win.x;
      document.body.classList.add('wm-dragging');
      const move = (ev: PointerEvent) => {
        const ds = wm.desktopSize();
        if (!restored) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
          restored = true;
          offsetX = Math.min(start.w - 80, Math.max(80, (sx / ds.w) * start.w));
          wm.updateWin(win.id, { maximized: false });
          start.x = sx - offsetX;
          start.y = 0;
        }
        let x = start.x + (ev.clientX - sx);
        let y = start.y + (ev.clientY - sy);
        y = Math.max(0, Math.min(ds.h - 29, y));
        x = Math.max(-start.w + 80, Math.min(ds.w - 80, x));
        wm.updateWin(win.id, { x, y });
      };
      const up = () => {
        document.body.classList.remove('wm-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [win.id, win.x, win.y, win.w, win.maximized],
  );

  const onResizeDown = (dir: Dir) => (e: React.PointerEvent) => {
    if (e.button !== 0 || win.maximized) return;
    e.stopPropagation();
    wm.focus(win.id);
    const sx = e.clientX;
    const sy = e.clientY;
    const s = { x: win.x, y: win.y, w: win.w, h: win.h };
    const minW = def?.minW ?? 200;
    const minH = def?.minH ?? 120;
    document.body.classList.add('wm-dragging');
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      let { x, y, w, h } = s;
      if (dir.includes('e')) w = Math.max(minW, s.w + dx);
      if (dir.includes('s')) h = Math.max(minH, s.h + dy);
      if (dir.includes('w')) {
        w = Math.max(minW, s.w - dx);
        x = s.x + (s.w - w);
      }
      if (dir.includes('n')) {
        h = Math.max(minH, s.h - dy);
        y = Math.max(0, s.y + (s.h - h));
        if (y === 0) h = s.y + s.h;
      }
      wm.updateWin(win.id, { x, y, w, h });
    };
    const up = () => {
      document.body.classList.remove('wm-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const sysMenu = (e: React.MouseEvent) => {
    openMenu(e, [
      { label: 'Restore', disabled: !win.maximized, onClick: () => wm.toggleMax(win.id) },
      { label: 'Minimize', disabled: def?.noTaskbar, onClick: () => wm.minimize(win.id) },
      { label: 'Maximize', disabled: win.maximized || !maximizable, onClick: () => wm.toggleMax(win.id) },
      { sep: true },
      { label: 'Close', bold: true, shortcut: 'Alt+F4', onClick: () => wm.close(win.id) },
    ]);
  };

  if (!def?.component) return null;
  const Comp = def.component;
  const style: React.CSSProperties = win.maximized
    ? { left: 0, top: 0, width: '100%', height: '100%', zIndex: win.z, display: win.minimized ? 'none' : undefined }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z, display: win.minimized ? 'none' : undefined };

  return (
    <div
      className={`win ${focused ? '' : 'inactive'} ${win.maximized ? 'max' : ''} ${settings.animations ? 'anim-open' : ''}`}
      style={style}
      onPointerDownCapture={() => wm.focus(win.id)}
      data-win={win.id}
    >
      <div className="win-title" onPointerDown={onTitleDown} onDoubleClick={(e) => !(e.target as HTMLElement).closest('.wb') && maximizable && wm.toggleMax(win.id)} onContextMenu={sysMenu}>
        <span onClick={sysMenu} onDoubleClick={(e) => (e.stopPropagation(), wm.close(win.id))}>
          <Icon name={win.icon} size={16} />
        </span>
        <div className="t">{win.title}</div>
        <div className="win-btns">
          {!def.noTaskbar && (
            <button className="wb" title="Minimize" onClick={() => wm.minimize(win.id)}>
              <MinIcon />
            </button>
          )}
          {maximizable && (
            <button className="wb" title={win.maximized ? 'Restore Down' : 'Maximize'} onClick={() => wm.toggleMax(win.id)}>
              {win.maximized ? <RestoreIcon /> : <MaxIcon />}
            </button>
          )}
          <button className="wb close" title="Close" onClick={() => wm.close(win.id)}>
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className="win-body">
        <Boundary name={def.name} onClose={() => wm.close(win.id, true)}>
          <Comp win={ctx} />
        </Boundary>
        {!focused && win.app === 'browser' && <div className="win-shield" />}
      </div>
      {resizable && !win.maximized && (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as Dir[]).map((d) => <div key={d} className={`win-rz rz-${d}`} onPointerDown={onResizeDown(d)} />)}
    </div>
  );
}

export const Window = memo(WindowImpl);
