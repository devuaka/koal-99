// Freecode: Scratch-style block coding (the official Scratch 3.0 editor).
import { useState } from 'react';
import type { WinCtx } from '../../core/registry';

export function Freecode({ win }: { win: WinCtx }) {
  const [loaded, setLoaded] = useState(false);
  const [hide, setHide] = useState(false);
  return (
    <div className="fc">
      {!hide && (
        <div className="fc-note">
          <b>Freecode</b>: snap blocks together and press the green flag. Use File &gt; Save to your computer to keep a project.
          <span className="k-spacer" />
          <span className="k-link" onClick={() => setHide(true)}>Hide</span>
        </div>
      )}
      {!loaded && <div className="kp-loading"><span className="spinner dark" /> Loading the Scratch editor (about 5 MB)...</div>}
      <iframe
        title="Freecode"
        style={{ display: loaded ? 'block' : 'none' }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-pointer-lock allow-presentation"
        allow="autoplay; fullscreen; clipboard-read; clipboard-write; microphone; camera; gamepad"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        src="https://scratchfoundation.github.io/scratch-gui/"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
