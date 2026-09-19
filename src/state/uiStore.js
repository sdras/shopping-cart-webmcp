import { createStore } from "./createStore.js";

// Ephemeral interface state: nothing here is persisted.
export const uiStore = createStore({
  cartOpen: false,
  productId: null, // product shown in the detail dialog
  substitutePrompt: null, // { storeId, items: [{ productId, usual }] } while asking about swaps
  toasts: [],
  toolLog: [], // most recent first
});

let nextId = 1;

export const openCart = () => uiStore.setState((s) => ({ ...s, cartOpen: true }));
export const closeCart = () => uiStore.setState((s) => ({ ...s, cartOpen: false }));
export const showProduct = (productId) => uiStore.setState((s) => ({ ...s, productId }));

export const askAboutSubstitutes = (storeId, items) =>
  uiStore.setState((s) => ({ ...s, substitutePrompt: items.length ? { storeId, items } : null }));

export function dismissToast(id) {
  uiStore.setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
}

/** `action` is an optional { label, run } button, like Undo. Those toasts stay long enough to reach for. */
export function toast(message, { agent = false, action } = {}) {
  const id = nextId++;
  uiStore.setState((s) => ({ ...s, toasts: [...s.toasts, { id, message, agent, action }] }));
  setTimeout(() => dismissToast(id), action ? 9000 : 3500);
}

export function logToolCall(entry) {
  uiStore.setState((s) => ({
    ...s,
    toolLog: [{ id: nextId++, at: Date.now(), ...entry }, ...s.toolLog].slice(0, 30),
  }));
}
