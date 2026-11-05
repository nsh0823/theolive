import { useSyncExternalStore } from 'react';

/** Minimal observable store. Stands in for the server cache until packages/api is wired. */
export type Store<T> = {
  get: () => T;
  set: (updater: (previous: T) => T) => void;
  reset: () => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T>(createInitial: () => T): Store<T> {
  let value = createInitial();
  const listeners = new Set<() => void>();

  function notify(): void {
    listeners.forEach((listener) => listener());
  }

  return {
    get: () => value,
    set: (updater) => {
      value = updater(value);
      notify();
    },
    reset: () => {
      value = createInitial();
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useStoreValue<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}
