// Minimal IndexedDB key/value wrapper. Falls back to localStorage, then to memory.
const DB = 'koal99';
const STORE = 'kv';
let dbp: Promise<IDBDatabase | null> | null = null;
const mem = new Map<string, unknown>();

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  if (!db) {
    try {
      const raw = localStorage.getItem('koal99.kv.' + key);
      return raw ? (JSON.parse(raw) as T) : (mem.get(key) as T | undefined);
    } catch {
      return mem.get(key) as T | undefined;
    }
  }
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await open();
  if (!db) {
    mem.set(key, value);
    try {
      localStorage.setItem('koal99.kv.' + key, JSON.stringify(value));
    } catch {
      /* quota or blocked */
    }
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbDel(key: string): Promise<void> {
  const db = await open();
  if (!db) {
    mem.delete(key);
    try {
      localStorage.removeItem('koal99.kv.' + key);
    } catch {
      /* ignore */
    }
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
