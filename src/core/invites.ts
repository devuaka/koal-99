// Game invites between friends. Every invitable game opens with { joinCode } to join a friend's room,
// or { autoHost } to host one and report its code back through hostRequests.
import { presence, Invite } from './net';
import { openApp, wmStore, focus } from './wm';
import { choiceBox } from './dialog';
import { play } from './sound';

export const INVITE_GAMES: Record<string, string> = { chat: 'Chatroom', arena: 'Arena 3D', blockrun: 'Block Run', backrooms: 'Backrooms' };
const APP: Record<string, string> = { chat: 'kchat', arena: 'karena', blockrun: 'kblockrun', backrooms: 'kbackrooms' };

/** Pending "host a room, then tell me the code" requests, keyed by app id. */
export const hostRequests = new Map<string, (code: string) => void>();
/** Called by a game once it has hosted a room because of an invite. */
export function reportHosted(appId: string, code: string) {
  const f = hostRequests.get(appId);
  hostRequests.delete(appId);
  f?.(code);
}

export function acceptInvite(d: Invite) {
  const app = APP[d.game];
  if (!app) return;
  if (d.game === 'chat') {
    const w = wmStore.get().wins.find((x) => x.app === app);
    if (w) focus(w.id);
  }
  openApp(app, { joinCode: d.code, _nonce: Date.now() });
}

export async function inviteFriend(friendId: string, game: string, fromName: string): Promise<{ ok: boolean; msg: string }> {
  const app = APP[game];
  if (!app) return { ok: false, msg: 'Unknown game' };
  const code = await new Promise<string>((res) => {
    const t = window.setTimeout(() => (hostRequests.delete(app), res('')), 20000);
    hostRequests.set(app, (c) => {
      window.clearTimeout(t);
      res(c);
    });
    openApp(app, { autoHost: true, _nonce: Date.now() });
  });
  if (!code) return { ok: false, msg: 'Could not host a room to invite them to.' };
  const ok = await presence.invite(friendId, { from: fromName, game, code });
  return ok ? { ok: true, msg: 'Invite sent! Room code ' + code } : { ok: false, msg: friendId + ' is not online right now.' };
}

let listening = false;
/** Go online so friends can invite you (only if you have friends saved, or force). */
export function startPresence(force = false) {
  let has = false;
  try {
    has = (JSON.parse(localStorage.getItem('koalos.friends') ?? '{}').list ?? []).length > 0;
  } catch {
    /* ignore */
  }
  if (!force && !has) return;
  if (!listening) {
    listening = true;
    presence.on('invite', async (d: Invite) => {
      if (!INVITE_GAMES[d.game]) return;
      play('notify');
      const r = await choiceBox(`${d.from || 'A friend'} invited you to their ${INVITE_GAMES[d.game]} game.\n\nRoom code: ${d.code}`, ['Join', 'Dismiss'], 'Game Invite', 'friends');
      if (r === 0) acceptInvite(d);
    });
  }
  presence.start().catch(() => {});
}
