# KOAL-99

A browser-based retro operating system (2004-era, Frutiger Aero look). React + TypeScript + Vite, no backend.

```
npm install
npm run dev      # http://localhost:8813
npm run build    # static site in dist/ (relative paths, host anywhere)
```

## Layout

- `src/core/` filesystem (`fs.ts`, IndexedDB, cross-tab sync), window manager (`wm.ts`), settings and profiles, sounds (WebAudio, no files), seed data and lore (`seed.ts`)
- `src/ui/` shell: desktop, taskbar, start menu, windows, context menus, vector icons (`icons.ts`), SVG wallpapers (`wallpaper.ts`)
- `src/boot/` BIOS, boot logo, login, shutdown, BSOD
- `src/apps/` Terminal (`terminal/commands.ts`), Explorer, Notepad, StarPaint, StarNet Explorer, Calculator, StarAmp, Control Panel, IT Support, system dialogs, Task Manager, KIP, ARCHIVE, Starsweeper
- `src/apps/kos/` the koalOS suite, remade: Video Editor, Modeler, Reelcod, Freecode, Python (Pyodide), Music, Text to Speech, Sticky Notes, Clock, Calendar, Scientific Calculator, Chatroom, Friends, Buddi chat, Feedback
- `src/apps/games/` koal.games: 17 arcade games (Snake, Pong, Chess, Cube Run with a level editor...), high scores, online Pong and Chess
- `src/apps/three/` 3D games: Backrooms, Block Run, Arena 3D (+ map editor) on Three.js with hand-built models (`models.ts`, `arena/guns.ts`), and the 3D Platformer (`r3.ts`). Loaded on first open.
- Multiplayer and friend invites use PeerJS's free public broker (`src/core/net.ts`); there is no server of our own.
- AI features ask for your own OpenRouter key (stored in your browser only).

All user data stays in the browser. Bumping `SCHEMA` in `src/core/fs.ts` reseeds every pretend disk.

## Secrets (spoilers)

Hidden folder `C:\KOAL99\~Old` (`dir /a`), SYSOP password `STARDUST-04` ("Other user..." on login), terminal: `kip`, `hello`, `xyzzy`, `stapler`, `gary`, `bsod`, `rm -rf /`, `taskkill kernel`. Konami code on the desktop. Calculator: 1987.
