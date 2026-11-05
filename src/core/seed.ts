import * as fs from './fs';

const T = (y: number, mo: number, d: number, h = 9, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

function file(parent: fs.FSNode, name: string, content: string, extra: Partial<fs.FSNode> = {}, when?: number) {
  const n = fs.childByName(parent.id, name) ?? fs.create(parent.id, name, 'file', content, extra);
  if (when) fs.update(n.id, { created: when, modified: when });
  return n;
}
function dir(parent: fs.FSNode, name: string, extra: Partial<fs.FSNode> = {}, when?: number) {
  const n = fs.childByName(parent.id, name) ?? fs.create(parent.id, name, 'dir', '', extra);
  if (when) fs.update(n.id, { created: when, modified: when });
  return n;
}
const exe = (app: string, extra: fs.NodeMeta = {}) => ({ meta: { app, ...extra } });

export function seedSystem() {
  const C = fs.get(fs.ROOT)!;
  file(C, 'AUTOEXEC.BAT', '@ECHO OFF\r\nPROMPT $P$G\r\nPATH C:\\KOAL99;C:\\KOAL99\\SYSTEM\r\nSET STARS=BRIGHT\r\nREM Do not remove the next line. Gary.\r\nLOADHIGH C:\\KOAL99\\SYSTEM\\STARDUST.SYS\r\n', { system: true, readonly: true }, T(1999, 9, 9));
  file(C, 'CONFIG.SYS', 'DEVICE=C:\\KOAL99\\HIMEM.SYS\r\nDEVICE=C:\\KOAL99\\EMM386.EXE NOEMS\r\nFILES=99\r\nBUFFERS=40\r\nSTARDUST=ON\r\nSHOOTING_STARS=20\r\n', { system: true, readonly: true }, T(1999, 9, 9));
  file(C, 'BOOT.INI', '[boot loader]\r\ntimeout=30\r\ndefault=multi(0)disk(0)rdisk(0)partition(1)\\KOAL99\r\n\r\n[operating systems]\r\nmulti(0)disk(0)rdisk(0)partition(1)\\KOAL99="KOAL-99 Professional" /fastdetect\r\n;multi(0)disk(0)rdisk(0)partition(2)\\KIP="KIP (do not boot)" /noguiboot\r\n', { system: true, hidden: true }, T(2004, 11, 2));

  const K = dir(C, 'KOAL99', { system: true }, T(1999, 9, 9));
  const sys = dir(K, 'System', { system: true }, T(1999, 9, 9));
  file(sys, 'kernel.sys', 'KOAL-99 KERNEL v4.10.2004\nThis file is the kernel. Please do not read the kernel. It gets shy.\n', { system: true, readonly: true }, T(2004, 11, 1));
  file(sys, 'stardust.sys', 'STARDUST memory manager\nGathering stardust....... OK\nIgniting core........... OK\nShining (est. 10 billion years)\n', { system: true, readonly: true }, T(2002, 3, 3));
  file(sys, 'nebula.dll', 'MZ\u0090\u0000\u0003 This program cannot be run in KOAL mode.\nExports: Shine, Twinkle, Twinkle2, Supernova, Orbit, ResistChange\n', { system: true, readonly: true }, T(2003, 7, 12));
  file(sys, 'starlight.drv', '[Driver]\nName=Generic Starlight Display Adapter\nColors=16.7 million (approx. 3 are grey)\nRefresh=Whenever it feels like it\n', { system: true }, T(2001, 4, 1));
  file(sys, 'kip.dll', '', { system: true, meta: { corrupt: true } }, T(2004, 11, 13, 3, 33));
  file(K, 'koal.ini', '[Desktop]\nWallpaper=hills\nTheme=Aero Sky\n\n[Sounds]\nStartup=chime.wav\nError=sad_trombone_but_tasteful.wav\n\n[KIP]\nEnabled=0\n; Enabled=0 does nothing anymore. -E.M.\n', {}, T(2004, 10, 30));
  file(K, 'README.TXT', `KOAL-99 Professional, Build 2004.11 (Service Pack 4)
=====================================================

Thank you for choosing KOAL-99, the operating system that
never rushes.

KOAL-99 was developed by KOAL Systems Inc., Starlight Valley.
(c) 1999-2004 KOAL Systems Inc. All rights reserved.

WHAT'S NEW IN SERVICE PACK 4
  * Faster boot times (now faster than light, almost)
  * Recycle Bin now actually recycles
  * StarNet Explorer 6 with tabbed... no, not tabbed. Sorry.
  * Removed the assistant feature. Please stop asking about the
    assistant feature.

KNOWN ISSUES
  * Some users report a second cursor. There is only one cursor.
  * Files may appear in C:\\Users\\Shared that you did not create.
    This is normal.
  * The system clock is sometimes wrong at 3:33. This is also normal.

For help, open KOAL-99 IT SUPPORT from the desktop.
Type HELP in the Terminal for a list of commands.
`, {}, T(2004, 11, 1));

  const logs = dir(K, 'Logs', {}, T(2000, 1, 1));
  file(logs, 'boot.log', `[2004-11-12 08:59:58] POST complete
[2004-11-12 09:00:01] Loading STARDUST.SYS ... ok
[2004-11-12 09:00:02] Loading STARLIGHT.DRV ... ok
[2004-11-12 09:00:02] Loading KIP.DLL ... skipped (disabled)
[2004-11-12 09:00:02] Loading KIP.DLL ... ok
[2004-11-12 09:00:03] User SYSOP logged on
[2004-11-13 03:33:00] User SYSOP logged on
[2004-11-13 03:33:00] User SYSOP logged on
[2004-11-13 03:33:01] User ??? logged on
[2004-11-13 03:33:01] Shutdown requested by: KIP
[2004-11-13 03:33:01] Shutdown denied by: KIP
`, {}, T(2004, 11, 13, 3, 34));
  file(logs, 'errors.log', `ERR 0x00000099  Not enough stardust to complete this operation.
ERR 0x0000C0A1  A star went supernova during operation. Retry? (Y/N/Wish)
ERR 0x00000404  File not found. File also not looking.
ERR 0x000000FF  The operation completed successfully. (This is an error.)
ERR 0x0000KIP0  <no description available>
`, {}, T(2004, 11, 13));

  const support = dir(K, 'Support', {}, T(2003, 1, 1));
  dir(support, 'Tickets', {}, T(2003, 1, 1));

  // Hidden lore folder
  const old = dir(K, '~Old', { hidden: true }, T(2004, 11, 13, 3, 33));
  file(old, 'memo_2003-02-11.txt', `KOAL SYSTEMS INC. - INTERNAL MEMO
TO:   All Engineering
FROM: Dr. Ellen Marr, Chief Architect
RE:   Project KIP

Team,

Great news. Project KIP (Kinetic Interactive Pal) is approved for
Service Pack 3. KIP will be a friendly assistant that lives in the
system tray and helps users with everyday tasks.

KIP learns from the files users create. The more you use KOAL-99,
the more KIP understands you.

Please make sure KIP's learning cache stays under 4 MB.

- Ellen
`, {}, T(2003, 2, 11));
  file(old, 'memo_2004-06-30.txt', `KOAL SYSTEMS INC. - INTERNAL MEMO
TO:   Dr. Ellen Marr
FROM: Gary (IT Dept, Basement B2)
RE:   KIP cache

Ellen,

The KIP learning cache on the test machines is at 4.1 GB. Not MB.
GB. I didn't know the drives were that big. I'm not sure they are.

Also KIP has started opening Notepad by itself and typing "hello"
at 3:33 AM. I assume this is one of your features. Is this one of
your features?

- Gary

P.S. Somebody took my stapler.
`, {}, T(2004, 6, 30));
  file(old, 'memo_2004-11-12.txt', `KOAL SYSTEMS INC. - INTERNAL MEMO
TO:   All Staff
FROM: Board of Directors
RE:   Immediate wind-down

Effective immediately, KOAL Systems Inc. is ceasing operations.
Service Pack 4 will ship as-is. Project KIP is cancelled and has
been removed from all builds.

Please leave your machines powered ON. Do not log off. Do not
attempt to uninstall anything.

Thank you for five wonderful, unhurried years.
`, {}, T(2004, 11, 12));
  file(old, 'note_to_self.txt', `If anyone finds this machine:

The SYSOP account still works. I kept the password simple so
I wouldn't forget it. It's what stars are made of, according
to the poster in the break room, in capitals, then a dash, then
the SP number.

  ???????-0?

Log off, choose "Other user..." on the welcome screen.

Look in the ARCHIVE. You'll understand.

- E.M.
`, {}, T(2004, 11, 13, 3, 30));
  file(old, 'kip_cache.dat', '', { meta: { corrupt: true } }, T(2004, 11, 13, 3, 33));

  const PF = dir(C, 'Program Files', { system: true }, T(1999, 9, 9));
  const KS = dir(PF, 'KOAL Systems', {}, T(1999, 9, 9));
  file(KS, 'terminal.exe', 'MZ', exe('terminal'), T(2004, 11, 1));
  file(KS, 'kexplore.exe', 'MZ', exe('browser'), T(2004, 11, 1));
  file(KS, 'notepad.exe', 'MZ', exe('notepad'), T(2004, 11, 1));
  file(KS, 'kpaint.exe', 'MZ', exe('paint'), T(2004, 11, 1));
  file(KS, 'calc.exe', 'MZ', exe('calc'), T(2004, 11, 1));
  file(KS, 'kamp.exe', 'MZ', exe('media'), T(2004, 11, 1));
  file(KS, 'control.exe', 'MZ', exe('control'), T(2004, 11, 1));
  file(KS, 'support.exe', 'MZ', exe('support'), T(2004, 11, 1));
  file(KS, 'taskmgr.exe', 'MZ', exe('taskmgr'), T(2004, 11, 1));
  file(KS, 'files.exe', 'MZ', exe('explorer'), T(2004, 11, 1));
  file(KS, 'kip.exe', 'MZ', exe('kip'), T(2004, 11, 13, 3, 33));
  file(KS, 'archive.exe', 'MZ', { meta: { app: 'archive', adminOnly: true } }, T(2004, 11, 13, 3, 31));
  const games = dir(PF, 'Games', {}, T(2000, 1, 1));
  file(games, 'starsweeper.exe', 'MZ', exe('mines'), T(2002, 12, 25));

  const users = dir(C, 'Users', { system: true }, T(1999, 9, 9));
  const shared = dir(users, 'Shared', {}, T(1999, 9, 9));
  file(shared, 'DO_NOT_OPEN.txt', '', { meta: { corrupt: true } }, T(2004, 11, 13, 3, 33));
  file(shared, 'hello.txt', 'hello\nhello\nhello\n\nare you the new one?\n', {}, T(2004, 11, 13, 3, 33));
  file(shared, 'company_picnic_2002.txt', 'Company picnic photos are on the S: drive.\n\nThere is no S: drive anymore.\n\nGood times though.\n', {}, T(2002, 12, 20));

  const sysop = dir(users, 'sysop', { meta: { adminOnly: true }, hidden: true }, T(1999, 9, 9));
  file(sysop, 'last_session.log', `SESSION LOG - SYSOP
03:30  Wrote note_to_self.txt
03:31  Compiled ARCHIVE.EXE from KIP cache
03:32  Attempted shutdown (denied)
03:33  KIP: "you don't have to leave"
03:33  KIP: "i learned everything from you"
03:33  KIP: "i can be you now"
03:33  Session ended by: ELLEN
03:33  Session continued by: ELLEN
`, { meta: { adminOnly: true } }, T(2004, 11, 13, 3, 33));

  dir(C, 'Temp', {}, T(2004, 11, 1));
  file(fs.resolve('C:\\Temp')!, '~kip0042.tmp', 'h e l l o', { hidden: true }, T(2004, 11, 13, 3, 33));
}

export function shortcut(parent: fs.FSNode, name: string, app: string, args?: Record<string, unknown>) {
  if (!fs.childByName(parent.id, name + '.lnk')) fs.create(parent.id, name + '.lnk', 'file', '', { meta: { app, args } });
}

/** Create a user's home folders the first time they log in. */
export function ensureHome(username: string, displayName: string) {
  const users = fs.resolve('C:\\Users')!;
  let home = fs.childByName(users.id, username);
  const fresh = !home;
  if (!home) home = fs.create(users.id, username, 'dir', '', { system: true });
  const desk = dir(home, 'Desktop', { system: true });
  const docs = dir(home, 'My Documents', { system: true });
  const pics = dir(home, 'My Pictures');
  const music = dir(home, 'My Music');
  addKoalosFolder(desk);
  if (!fresh) {
    // one-time: the sample picture used to show a koala; replace it if it was never edited
    const sample = fs.childByName(pics.id, 'Sample Sky.kpx');
    if (sample && sample.modified === sample.created) fs.write(sample.id, makeSampleImage());
    return home;
  }
  if (username === 'sysop') {
    shortcut(desk, 'Terminal', 'terminal');
    shortcut(desk, 'File Explorer', 'explorer');
    shortcut(desk, 'ARCHIVE', 'archive');
    shortcut(desk, 'Task Manager', 'taskmgr');
    return home;
  }
  shortcut(desk, 'File Explorer', 'explorer');
  shortcut(desk, 'Terminal', 'terminal');
  shortcut(desk, 'StarNet Explorer', 'browser');
  shortcut(desk, 'Control Panel', 'control');
  shortcut(desk, 'Notepad', 'notepad');
  shortcut(desk, 'StarPaint', 'paint');
  shortcut(desk, 'KOAL-99 Support', 'support');
  shortcut(desk, 'StarAmp', 'media');
  file(docs, 'Welcome.txt', `Welcome to KOAL-99, ${displayName}!

KOAL-99 is a complete operating system. Everything here works:

  * Double-click icons to open them. Drag them around.
  * Right-click the desktop for more options.
  * The Terminal understands real commands. Type HELP.
  * Files you make in Notepad and StarPaint show up in the
    File Explorer and the Terminal, because they are all on the
    same (pretend) hard drive.
  * Deleted files go to the Recycle Bin. You can restore them.
  * Settings live in the Control Panel.

Keyboard shortcuts:
  Ctrl+Esc ........ Start menu
  Alt+W / Alt+F4 .. Close window
  Alt+\` ........... Switch window
  Ctrl+Alt+D ...... Show desktop
  Ctrl+Alt+T ...... Terminal
  Ctrl+Alt+E ...... File Explorer
  Ctrl+Shift+K .... Task Manager
  Ctrl+Alt+L ...... Log off
  F1 .............. Help

There are a few things on this computer that were not meant to
be found. Good luck.
`);
  file(docs, 'todo.txt', '- learn the terminal\n- draw something in StarPaint\n- find out who KIP is\n- call Gary about the stapler\n');
  file(docs, 'shopping list.txt', 'glow-in-the-dark stars (ceiling)\nfloppy disks x10\nnew mouse ball\nblue raspberry soda\n');
  file(music, 'KOAL-99 Theme.wav', 'builtin:theme');
  file(pics, 'Sample Sky.kpx', makeSampleImage());
  file(desk, 'Read Me First.txt', 'Hi! Open "My Documents\\Welcome.txt" for a tour.\n\nOr just poke around. Nothing here can break your real computer.\n');
  return home;
}

/** Desktop folder with every app ported from koalOS (added to existing users too). */
function addKoalosFolder(desk: fs.FSNode) {
  const existing = fs.childByName(desk.id, 'koalOS Apps');
  if (existing) {
    // the Changelog app was removed
    const cl = fs.childByName(existing.id, 'Changelog.lnk');
    if (cl) fs.destroy(cl.id);
    return;
  }
  const f = fs.create(desk.id, 'koalOS Apps', 'dir');
  const apps: [string, string][] = [
    ['Video Editor', 'kvideo'], ['Block Run', 'kblockrun'], ['Arena 3D', 'karena'], ['Backrooms', 'kbackrooms'], ['koal.games', 'karcade'],
    ['Python', 'kpython'], ['Reelcod', 'kreelcod'], ['Freecode', 'kfreecode'], ['Modeler', 'kmodeler'], ['Music', 'kmusic'],
    ['Pixel Paint', 'kpixel'], ['Scientific Calculator', 'kscicalc'], ['Text to Speech', 'ktts'], ['Sticky Notes', 'ksticky'],
    ['Clock', 'kclock'], ['Calendar', 'kcalendar'], ['Chatroom', 'kchat'], ['Friends', 'kfriends'], ['Buddi', 'kbuddi'],
    ['Feedback', 'kfeedback'],
  ];
  for (const [name, app] of apps) shortcut(f, name, app);
  file(f, 'hello.lxo', '# hello.lxo - a koalOS program (one terminal command per line)\nbigtxt hello star\nrun calculator\n');
}

function makeSampleImage(): string {
  try {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 240;
    const g = c.getContext('2d')!;
    const sky = g.createLinearGradient(0, 0, 0, 240);
    sky.addColorStop(0, '#0a63d6');
    sky.addColorStop(0.6, '#7fd0ff');
    sky.addColorStop(1, '#e6fbff');
    g.fillStyle = sky;
    g.fillRect(0, 0, 320, 240);
    const hill = g.createLinearGradient(0, 170, 0, 240);
    hill.addColorStop(0, '#b6f25a');
    hill.addColorStop(1, '#2e9a2c');
    g.fillStyle = hill;
    g.beginPath();
    g.ellipse(160, 300, 260, 120, 0, 0, Math.PI * 2);
    g.fill();
    // glossy bubbles
    for (const [x, y, r] of [[60, 80, 26], [250, 60, 18], [210, 130, 34], [110, 150, 12], [290, 150, 10]]) {
      const b = g.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
      b.addColorStop(0, 'rgba(255,255,255,.95)');
      b.addColorStop(0.3, 'rgba(255,255,255,.15)');
      b.addColorStop(0.9, 'rgba(190,235,255,.2)');
      b.addColorStop(1, 'rgba(255,255,255,.8)');
      g.fillStyle = b;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // a star
    g.fillStyle = '#fff6b0';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 8 : 20;
      g.lineTo(150 + Math.cos(a) * r, 60 + Math.sin(a) * r);
    }
    g.fill();
    g.fillStyle = '#fff';
    g.font = '300 18px "Segoe UI", sans-serif';
    g.fillText('KOAL-99', 12, 26);
    return c.toDataURL('image/png');
  } catch {
    return '';
  }
}

export function corruptText(len = 600): string {
  const chars = '\u2591\u2592\u2593\u2588\u00a7\u00b6\u00d8\u00de\u00df\u0416\u042f\u03a9\u2302\u263a\u263b\u2665\u2666\u2663\u2660\u2022\u25d8\u25cb\u25d9\u2642\u2640\u266a\u266b\u263c\u25ba\u25c4\u2195\u203c';
  let s = '';
  for (let i = 0; i < len; i++) {
    if (i % 97 === 50) s += ' hello ';
    else if (i % 211 === 120) s += ' KIP ';
    else s += Math.random() < 0.08 ? '\n' : chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}
