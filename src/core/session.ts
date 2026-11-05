import * as fs from './fs';
import { settingsStore, S, setSettings } from './settings';

export function userName(): string {
  return settingsStore.get().user ?? 'guest';
}

export function homePath(): string {
  return 'C:\\Users\\' + userName();
}

export function homeDir(): fs.FSNode {
  return fs.resolve(homePath()) ?? fs.get(fs.ROOT)!;
}

export function desktopDir(): fs.FSNode {
  return fs.resolve(homePath() + '\\Desktop') ?? homeDir();
}

export function documentsDir(): fs.FSNode {
  return fs.resolve(homePath() + '\\My Documents') ?? homeDir();
}

export function setIconPos(key: string, x: number, y: number) {
  setSettings({ iconPositions: { ...S().iconPositions, [key]: { x, y } } });
}

fs.setHomeResolver(homePath);
