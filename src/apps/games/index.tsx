// The koal.games arcade: every game, their slugs (for "play snake" and koal.games/snake) and helpers.
import type { WinCtx } from '../../core/registry';
import { openApp } from '../../core/wm';
import * as fs from '../../core/fs';
import { desktopDir } from '../../core/session';
import { GameDef } from './kit';
import { GameHost } from './GameHost';
import { snake, brick, flappy, tiles, mines, memory, ttt } from './arcadeA';
import { aliens, stack, rocks, jump, whack, four, simon } from './arcadeB';
import { pong, chess } from './online';
import { cuberun } from './cuberun';

export const GAME_LIST: GameDef[] = [snake, pong, brick, flappy, tiles, mines, memory, ttt, aliens, stack, rocks, jump, whack, four, simon, chess, cuberun];
export const GAMES: Record<string, GameDef> = Object.fromEntries(GAME_LIST.map((g) => [g.id, g]));

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** "snake" -> "snake", "flappy-cube" -> "flappy" ... */
export const GAME_SLUG: Record<string, string> = Object.fromEntries(GAME_LIST.map((g) => [slugOf(g.name), g.id]));
export const gameSlug = (id: string) => slugOf(GAMES[id]?.name ?? id);

/** Finds a game by slug, id or a piece of its name. */
export function findGame(q: string): string | undefined {
  const s = q.trim().toLowerCase().replace(/\s+/g, '-');
  if (!s) return undefined;
  return GAME_SLUG[s] ?? (GAMES[s] ? s : undefined) ?? Object.entries(GAME_SLUG).find(([k]) => k.includes(s))?.[1];
}

export const gameIcon = (id: string) => 'g_' + id;

export function openGame(id: string, opts: Record<string, unknown> = {}) {
  const g = GAMES[id];
  if (!g) return false;
  openApp('kgame', { game: id, opts, _title: g.name, _icon: gameIcon(id), _w: g.w + 24, _h: g.h + 100 });
  return true;
}

/** The window app that hosts one game. */
export function GameWindow({ win }: { win: WinCtx }) {
  const g = GAMES[win.props.game as string];
  if (!g) return <div className="k-pad">That game does not exist.</div>;
  return <GameHost def={g} win={win} opts={win.props.opts as Record<string, unknown>} />;
}

/** "Downloads" a game: an .lxo program that plays it, like koalOS. */
export function downloadLxo(id: string, dirId = desktopDir().id): 'ok' | 'exists' {
  const g = GAMES[id], slug = gameSlug(id);
  if (fs.children(dirId).some((n) => n.type === 'file' && n.name.startsWith(g.name) && n.content.includes('play ' + slug + '\n'))) return 'exists';
  fs.create(dirId, fs.uniqueName(dirId, g.name + '.lxo'), 'file', `# ${g.name} - downloaded from koal.games\nplay ${slug}\n`);
  return 'ok';
}

/** Puts every game in a "koal.games" folder on the desktop. Returns how many were new. */
export function downloadAll(): number {
  const d = desktopDir();
  const found = fs.childByName(d.id, 'koal.games');
  const folder = found?.type === 'dir' ? found : fs.create(d.id, fs.uniqueName(d.id, 'koal.games'), 'dir');
  return GAME_LIST.filter((g) => downloadLxo(g.id, folder.id) === 'ok').length;
}
