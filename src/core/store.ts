import { useSyncExternalStore } from 'react';

// Tiny external store. Selectors must return stable references (a slice of state
// or a primitive); never build new objects inside a selector.
export interface Store<T> {
  get(): T;
  set(patch: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(fn: () => void): () => void;
  use<U>(sel: (s: T) => U): U;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<() => void>();
  const subscribe = (fn: () => void) => {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  };
  return {
    get: () => state,
    set(patch) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p };
      subs.forEach((f) => f());
    },
    subscribe,
    use<U>(sel: (s: T) => U): U {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useSyncExternalStore(subscribe, () => sel(state));
    },
  };
}

let uidCounter = 0;
export function uid(prefix = 'n'): string {
  uidCounter++;
  return prefix + Date.now().toString(36) + uidCounter.toString(36) + Math.random().toString(36).slice(2, 6);
}
