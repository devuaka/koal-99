// Feedback: the koalOS feedback form (a Google Form), with a fallback for when it won't load inside a window.
import { useState } from 'react';
import type { WinCtx } from '../../core/registry';

const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScvRAw3TCrmI10Xun-VQEj9ZRfbTmHD2n2Vntqy29Vsa2Ta3w/viewform?embedded=true';

export function FeedbackApp({ win }: { win: WinCtx }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="fbk">
      <div className="fbk-bar">
        <span>{loaded ? 'Thanks for helping make KOAL-99 better!' : 'Loading the feedback form...'}</span>
        <span className="k-spacer" />
        <button className="k-btn small" onClick={() => window.open(FEEDBACK_URL.replace('?embedded=true', ''), '_blank', 'noopener')}>Open in my real browser</button>
      </div>
      <iframe title="Feedback form" src={FEEDBACK_URL} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoaded(true)} />
    </div>
  );
}
