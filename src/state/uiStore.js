import { createStore } from "./createStore.js";

// Ephemeral interface state: nothing here is persisted.
export const uiStore = createStore({
  cartOpen: false,
  productId: null, // product shown in the detail dialog
  toasts: [],
  toolLog: [], // most recent first
});

let nextId = 1;

export const openCart = () => uiStore.setState((s) => ({ ...s, cartOpen: true }));
export const closeCart = () => uiStore.setState((s) => ({ ...s, cartOpen: false }));
export const showProduct = (productId) => uiStore.setState((s) => ({ ...s, productId }));

export function toast(message, { agent = false } = {}) {
  const id = nextId++;
  uiStore.setState((s) => ({ ...s, toasts: [...s.toasts, { id, message, agent }] }));
  setTimeout(() => {
    uiStore.setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
  }, 3500);
}

export function logToolCall(entry) {
  uiStore.setState((s) => ({
    ...s,
    toolLog: [{ id: nextId++, at: Date.now(), ...entry }, ...s.toolLog].slice(0, 30),
  }));
}
