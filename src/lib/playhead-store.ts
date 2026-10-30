import * as React from "react";

export interface PlayheadStore {
  getPlayhead: () => number;
  setPlayhead: (time: number) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createPlayheadStore(initialTime: number = 0): PlayheadStore {
  let currentTime = Number.isFinite(initialTime) && initialTime >= 0 ? initialTime : 0;
  const listeners = new Set<() => void>();

  return {
    getPlayhead() {
      return currentTime;
    },
    setPlayhead(time: number) {
      const safeTime = Number.isFinite(time) && time >= 0 ? time : 0;
      if (currentTime === safeTime) return;
      currentTime = safeTime;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function usePlayheadFromStore(store: PlayheadStore | null): number {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (!store) return () => {};
      return store.subscribe(onStoreChange);
    },
    [store]
  );

  const getSnapshot = React.useCallback(() => {
    return store ? store.getPlayhead() : 0;
  }, [store]);

  const getServerSnapshot = React.useCallback(() => 0, []);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
