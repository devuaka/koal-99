// Picture Viewer: browse the pictures in a folder, zoom, rotate, set as wallpaper.
import { useEffect, useMemo, useState } from 'react';
import type { WinCtx } from '../../core/registry';
import * as fs from '../../core/fs';
import { PHOTO_EXT, IMAGE_EXT } from '../../core/launcher';
import { setSettings } from '../../core/settings';
import { openApp } from '../../core/wm';
import { notify } from '../../core/notify';
import { Icon } from '../../ui/Icon';

export function PictureViewer({ win }: { win: WinCtx }) {
  const [id, setId] = useState<string>(win.props.fileId);
  const [fit, setFit] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [dims, setDims] = useState('');
  const version = fs.fsStore.use((s) => s.version);
  const node = fs.get(id);

  useEffect(() => {
    if (win.props._nonce && win.props.fileId) setId(win.props.fileId);
  }, [win.props._nonce, win.props.fileId]);

  const siblings = useMemo(
    () => (node?.parent ? fs.children(node.parent).filter((n) => n.type === 'file' && [...PHOTO_EXT, ...IMAGE_EXT].includes(fs.ext(n.name)) && n.content.startsWith('data:image')) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node?.parent, version],
  );
  const idx = siblings.findIndex((n) => n.id === id);
  const go = (d: number) => {
    if (!siblings.length) return;
    setId(siblings[(idx + d + siblings.length) % siblings.length].id);
    setRot(0);
    setZoom(1);
  };

  useEffect(() => {
    win.setTitle(node ? `${node.name} - Picture Viewer` : 'Picture Viewer');
  }, [node?.name]);

  if (!node) return <div className="msgbox">This picture no longer exists.</div>;
  const scale = fit ? undefined : zoom;

  return (
    <div className="pv" tabIndex={0} onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); if (e.key === '+') { setFit(false); setZoom(zoom * 1.25); } if (e.key === '-') { setFit(false); setZoom(zoom / 1.25); } }}>
      <div className={`pv-stage ${fit ? 'fit' : ''}`}>
        <img src={node.content} alt={node.name} style={{ transform: `rotate(${rot}deg)${scale ? ` scale(${scale})` : ''}` }} onLoad={(e) => setDims(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`)} />
      </div>
      <div className="pv-bar">
        <button className="pv-b" title="Previous (Left arrow)" onClick={() => go(-1)}>{'◀'}</button>
        <button className="pv-b" title="Next (Right arrow)" onClick={() => go(1)}>{'▶'}</button>
        <span className="pv-sep" />
        <button className="pv-b" title="Fit to window" onClick={() => { setFit(!fit); setZoom(1); }}>{fit ? '1:1' : '⤢'}</button>
        <button className="pv-b" title="Zoom in" onClick={() => { setFit(false); setZoom(zoom * 1.25); }}>+</button>
        <button className="pv-b" title="Zoom out" onClick={() => { setFit(false); setZoom(zoom / 1.25); }}>{'−'}</button>
        <button className="pv-b" title="Rotate" onClick={() => setRot((rot + 90) % 360)}>{'↻'}</button>
        <span className="pv-sep" />
        <button className="pv-b wide" onClick={() => { setSettings({ wallpaper: { kind: 'image', value: node.content, fit: 'cover' } }); notify('Wallpaper', node.name + ' is your new desktop background.', { icon: 'palette', silent: true }); }}>
          <Icon name="palette" size={16} /> Wallpaper
        </button>
        <button className="pv-b wide" onClick={() => openApp('paint', { fileId: node.id })}><Icon name="paint" size={16} /> Edit</button>
        <span className="pv-info">{dims}{siblings.length > 1 ? `   ${idx + 1} of ${siblings.length}` : ''}</span>
      </div>
    </div>
  );
}
