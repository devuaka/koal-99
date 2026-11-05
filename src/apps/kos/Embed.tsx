// A window that shows one web page (used by terminal commands such as rundombetaembed).
import type { WinCtx } from '../../core/registry';
import { openApp } from '../../core/wm';

export function EmbedApp({ win }: { win: WinCtx }) {
  return (
    <div className="kemb">
      <iframe
        title={String(win.props._title ?? 'Web page')}
        src={String(win.props.url ?? 'about:blank')}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock allow-presentation"
        allow="autoplay; fullscreen; gamepad; clipboard-write"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

export function openEmbed(title: string, url: string, w: number, h: number) {
  openApp('kembed', { url, _title: title, _w: w + 8, _h: h + 42 });
}
