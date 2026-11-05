// koal.games: the arcade website inside StarNet Explorer. Lists every game, plays them in the page,
// and "downloads" them to the desktop as .lxo programs.
import { useState } from 'react';
import { Icon } from '../../ui/Icon';
import { GAME_LIST, GAME_SLUG, GAMES, downloadAll, downloadLxo, gameIcon, gameSlug, openGame } from '../games';
import { GameHost } from '../games/GameHost';
import { hsAll } from '../games/kit';

function DlButton({ id }: { id: string }) {
  const [t, setT] = useState('');
  return (
    <button
      className="k-btn"
      onClick={() => {
        setT(downloadLxo(id) === 'exists' ? 'Already on your desktop' : 'Downloaded ✓');
        window.setTimeout(() => setT(''), 2500);
      }}
    >
      {t || 'Download .lxo'}
    </button>
  );
}

export function GamesSite({ sub, nav }: { sub: string; nav: (u: string) => void }) {
  const id = GAME_SLUG[sub.toLowerCase()];
  const [allMsg, setAllMsg] = useState('');
  if (id) {
    const g = GAMES[id];
    return (
      <div className="kgs">
        <div className="kgs-head">
          <Icon name={gameIcon(id)} size={40} />
          <div>
            <b>{g.name}</b>
            <small>koal.games</small>
          </div>
          <span className="k-spacer" />
          <button className="k-btn" onClick={() => nav('koal://games')}>{'←'} All games</button>
          <button className="k-btn" onClick={() => openGame(id)}>Open in a window</button>
          <DlButton id={id} />
        </div>
        <div className="kgs-game">
          <div className="kgs-frame" style={{ width: g.w + 16, height: `min(78vh, ${g.h + 70}px)` }}>
            <GameHost key={id} def={g} />
          </div>
        </div>
      </div>
    );
  }
  const hs = hsAll();
  return (
    <div className="kgs">
      <div className="kgs-head">
        <Icon name="game" size={40} />
        <div>
          <b>koal.games</b>
          <small>All the games in one place. Play them here, or download them to your desktop.</small>
        </div>
        <span className="k-spacer" />
        <button
          className="k-btn"
          onClick={() => {
            const n = downloadAll();
            setAllMsg(n ? `Downloaded ${n} games to a folder on your desktop ✓` : 'They are already in your koal.games folder');
            window.setTimeout(() => setAllMsg(''), 3500);
          }}
        >
          {allMsg || `Download all ${GAME_LIST.length} games`}
        </button>
      </div>
      <div className="kgs-grid">
        {GAME_LIST.map((g) => (
          <div key={g.id} className="kgs-card">
            <Icon name={gameIcon(g.id)} size={48} />
            <b>{g.name}</b>
            {g.badge && <span className="kgs-badge">{g.badge}</span>}
            <p>{g.blurb}</p>
            <small>{hs[g.id] ? 'Your best: ' + hs[g.id] : 'Not played yet'}</small>
            <div className="kgs-row">
              <button className="k-btn default" onClick={() => nav('koal://games/' + gameSlug(g.id))}>Play</button>
              <DlButton id={g.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
