import { useSyncExternalStore } from "react";

// A tiny external store. It lives outside React so WebMCP tool handlers can
// read the state they just changed synchronously, without waiting on a render.
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState: () => state,
    setState(updater) {
      const next = typeof updater === "function" ? updater(state) : updater;
      if (next === state) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// Selectors must return a stable reference for unchanged state: select a
// slice, then derive from it with useMemo.
export function useStore(store, selector = (s) => s) {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  );
}
