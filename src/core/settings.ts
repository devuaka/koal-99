import { createStore } from './store';

export type ThemeId = 'aero' | 'leaf' | 'graphite' | 'classic' | 'sysop';
export type Wallpaper = { kind: 'preset'; value: string } | { kind: 'color'; value: string } | { kind: 'image'; value: string; fit: 'cover' | 'center' | 'tile' };
export type ScreensaverKind = 'none' | 'starfield' | 'logo' | 'matrix' | 'pipes';

export interface Bookmark {
  title: string;
  url: string;
}

export interface Settings {
  theme: ThemeId;
  wallpaper: Wallpaper;
  iconPositions: Record<string, { x: number; y: number }>;
  muted: boolean;
  volume: number; // 0..1
  screensaver: ScreensaverKind;
  screensaverMinutes: number;
  clock24: boolean;
  uiScale: number;
  showHidden: boolean;
  showExtensions: boolean;
  terminalTheme: string;
  explorerView: 'icons' | 'tiles' | 'list' | 'details';
  bookmarks: Bookmark[];
  history: { url: string; title: string; at: number }[];
  homepage: string;
  fontSmoothing: boolean;
  animations: boolean;
  doubleClickMs: number;
}

export interface Profile {
  username: string;
  displayName: string;
  avatar: string; // avatar id
  password?: string;
  hidden?: boolean;
  created: number;
}

export const defaultSettings = (): Settings => ({
  theme: 'aero',
  wallpaper: { kind: 'preset', value: 'hills' },
  iconPositions: {},
  muted: false,
  volume: 0.6,
  screensaver: 'starfield',
  screensaverMinutes: 5,
  clock24: false,
  uiScale: 1,
  showHidden: false,
  showExtensions: true,
  terminalTheme: 'classic',
  explorerView: 'icons',
  bookmarks: [
    { title: 'KOAL-99 Home', url: 'koal://home' },
    { title: 'KOAL Systems Inc.', url: 'http://www.koal-systems.com' },
    { title: 'Constellation Web Directory', url: 'http://www.constellation-dir.net' },
    { title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Frutiger_Aero' },
    { title: 'The Web in 2004 (Wayback)', url: 'https://web.archive.org/web/2004/http://www.yahoo.com/' },
  ],
  history: [],
  homepage: 'koal://home',
  fontSmoothing: true,
  animations: true,
  doubleClickMs: 450,
});

const PROFILES_KEY = 'koal99.profiles';
const settingsKey = (u: string) => 'koal99.settings.' + u.toLowerCase();

function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function saveJSON(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* quota: custom wallpapers can be large */
  }
}

export const SYSOP: Profile = { username: 'sysop', displayName: 'SYSOP', avatar: 'terminal', password: 'STARDUST-04', hidden: true, created: 1072915200000 };

function defaultProfiles(): Profile[] {
  return [
    { username: 'nova', displayName: 'Nova', avatar: 'star', created: Date.now() },
    { username: 'guest', displayName: 'Guest', avatar: 'duck', created: Date.now() },
  ];
}

interface SettingsState {
  profiles: Profile[];
  settings: Settings;
  user: string | null;
}

export const settingsStore = createStore<SettingsState>({
  profiles: loadJSON<Profile[]>(PROFILES_KEY) ?? defaultProfiles(),
  settings: defaultSettings(),
  user: null,
});

export function profiles(includeHidden = false): Profile[] {
  const list = settingsStore.get().profiles;
  return includeHidden ? [...list, SYSOP] : list.filter((p) => !p.hidden);
}

export function findProfile(username: string): Profile | undefined {
  const u = username.trim().toLowerCase();
  if (u === 'sysop' || u === 'administrator' || u === 'admin') return SYSOP;
  return settingsStore.get().profiles.find((p) => p.username === u || p.displayName.toLowerCase() === u);
}

export function saveProfiles(list: Profile[]) {
  settingsStore.set({ profiles: list });
  saveJSON(PROFILES_KEY, list);
}

export function addProfile(displayName: string, avatar: string, password?: string): Profile {
  const username = displayName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'user';
  let name = username;
  let i = 2;
  while (findProfile(name)) name = username + i++;
  const p: Profile = { username: name, displayName: displayName.trim() || name, avatar, password: password || undefined, created: Date.now() };
  saveProfiles([...settingsStore.get().profiles, p]);
  return p;
}

export function updateProfile(username: string, patch: Partial<Profile>) {
  if (username === 'sysop') return;
  saveProfiles(settingsStore.get().profiles.map((p) => (p.username === username ? { ...p, ...patch } : p)));
}

export function deleteProfile(username: string) {
  saveProfiles(settingsStore.get().profiles.filter((p) => p.username !== username));
  try {
    localStorage.removeItem(settingsKey(username));
  } catch {
    /* ignore */
  }
}

export function currentProfile(): Profile | undefined {
  const u = settingsStore.get().user;
  return u ? findProfile(u) : undefined;
}

export function loadUserSettings(username: string) {
  const saved = loadJSON<Partial<Settings>>(settingsKey(username));
  const base = defaultSettings();
  if (username === 'sysop') {
    base.theme = 'sysop';
    base.wallpaper = { kind: 'preset', value: 'void' };
    base.terminalTheme = 'amber';
    base.showHidden = true;
  }
  const merged = { ...base, ...(saved ?? {}) };
  if (!['aero', 'leaf', 'graphite', 'classic', 'sysop'].includes(merged.theme)) merged.theme = base.theme;
  settingsStore.set({ user: username, settings: merged });
}

export function setSettings(patch: Partial<Settings>) {
  const st = settingsStore.get();
  const settings = { ...st.settings, ...patch };
  settingsStore.set({ settings });
  if (st.user) saveJSON(settingsKey(st.user), settings);
}

export function S(): Settings {
  return settingsStore.get().settings;
}

export function useSettings(): Settings {
  return settingsStore.use((s) => s.settings);
}
