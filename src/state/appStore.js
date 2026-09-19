import { createStore } from "./createStore.js";
import { storesById } from "../data/stores.js";
import { cartTotals, DEFAULT_TIP } from "../lib/pricing.js";
import { planTopUp } from "../lib/staples.js";

const STORAGE_KEY = "basketful:v1";
export const MAX_QUANTITY = 24;
export const REPLACEMENT_OPTIONS = ["Best match", "Contact me", "Refund item"];

const SHOPPERS = ["Maya", "Dev", "Priya", "Marcus", "Lucía", "Noor"];

const emptyState = () => ({
  storeId: null,
  carts: {}, // { [storeId]: { [productId]: quantity } }
  staples: {}, // { [productId]: usual quantity }, shared by every store
  // What to do when a staple is out of stock:
  // { [productId]: { type: "swap", with: productId } | { type: "skip" } }
  substitutions: {},
  stapleOffers: {}, // { [orderId]: "saved" | "dismissed" }, the post-order prompt
  dismissedSuggestions: [], // product ids the shopper said "no thanks" to
  address: { street: "", unit: "", city: "", zip: "", instructions: "" },
  checkout: { windowId: null, tip: null, replacements: REPLACEMENT_OPTIONS[0] },
  orders: [],
  nextOrderNumber: 1001,
});

const parse = (json) => {
  try {
    const saved = JSON.parse(json ?? "null");
    return saved ? { ...emptyState(), ...saved } : emptyState();
  } catch {
    return emptyState();
  }
};

export function createAppStore({ storage } = {}) {
  const store = createStore(parse(storage?.getItem(STORAGE_KEY)));

  // Set while a change from another tab is being applied, so it isn't written
  // straight back. An echo like that races the other tab's newer writes and
  // can roll its cart back.
  let applyingRemote = false;

  store.subscribe(() => {
    if (applyingRemote) return;
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(store.getState()));
    } catch {
      // Storage can be full or blocked; the app still works for this session.
    }
  });

  // Follow other tabs, so a cart an agent fills in one tab shows up in the
  // tab the shopper is looking at. `storage` fires only in the tabs that
  // didn't make the change, in order, and carries the exact snapshot.
  if (storage && typeof window !== "undefined") {
    // One live listener per page, even when hot reload re-creates the store.
    window.__basketfulSync?.abort();
    const controller = (window.__basketfulSync = new AbortController());
    window.addEventListener(
      "storage",
      (event) => {
        if (event.key !== STORAGE_KEY || event.newValue == null) return;
        applyingRemote = true;
        try {
          store.setState(parse(event.newValue));
        } finally {
          applyingRemote = false;
        }
      },
      { signal: controller.signal }
    );
  }
  return store;
}

export const isAddressComplete = (address) =>
  Boolean(address.street.trim() && address.city.trim() && address.zip.trim());

export function formatAddress(address) {
  if (!isAddressComplete(address)) return "";
  const line1 = [address.street, address.unit].filter(Boolean).join(", ");
  return `${line1}, ${address.city} ${address.zip}`;
}

export function selectStore(store, storeId) {
  store.setState((s) => (s.storeId === storeId ? s : { ...s, storeId }));
}

const clampQuantity = (quantity) => Math.max(0, Math.min(MAX_QUANTITY, Math.round(quantity)));

export function setQuantity(store, storeId, productId, quantity) {
  const clamped = clampQuantity(quantity);
  store.setState((s) => {
    const cart = { ...(s.carts[storeId] ?? {}) };
    if (clamped === 0) delete cart[productId];
    else cart[productId] = clamped;
    return { ...s, carts: { ...s.carts, [storeId]: cart } };
  });
  return clamped;
}

export function addItem(store, storeId, productId, quantity = 1) {
  const current = store.getState().carts[storeId]?.[productId] ?? 0;
  return setQuantity(store, storeId, productId, current + quantity);
}

export function clearCart(store, storeId) {
  store.setState((s) => ({ ...s, carts: { ...s.carts, [storeId]: {} } }));
}

const without = (object, key) => {
  const { [key]: _removed, ...rest } = object;
  return rest;
};

/** Save a product to the staples list with its usual quantity; 0 removes it. */
export function setStaple(store, productId, quantity) {
  const clamped = clampQuantity(quantity);
  store.setState((s) =>
    clamped === 0
      ? { ...s, staples: without(s.staples, productId), substitutions: without(s.substitutions, productId) }
      : { ...s, staples: { ...s.staples, [productId]: clamped } }
  );
  return clamped;
}

/** Merge several staples in one write: { [productId]: quantity }. */
export function saveStaples(store, staples) {
  store.setState((s) => ({ ...s, staples: { ...s.staples, ...staples } }));
}

/** Make `staples` the whole list, keeping out-of-stock rules only for what's left. */
export function replaceStaples(store, staples) {
  store.setState((s) => ({
    ...s,
    staples: { ...staples },
    substitutions: Object.fromEntries(Object.entries(s.substitutions).filter(([id]) => staples[id])),
  }));
}

/** `rule` is { type: "swap", with: productId }, { type: "skip" }, or null to ask each time. */
export function setSubstitution(store, productId, rule) {
  store.setState((s) => ({
    ...s,
    substitutions: rule ? { ...s.substitutions, [productId]: rule } : without(s.substitutions, productId),
  }));
}

export function resolveStapleOffer(store, orderId, outcome) {
  store.setState((s) => ({ ...s, stapleOffers: { ...s.stapleOffers, [orderId]: outcome } }));
}

export function dismissSuggestion(store, productId) {
  store.setState((s) =>
    s.dismissedSuggestions.includes(productId)
      ? s
      : { ...s, dismissedSuggestions: [...s.dismissedSuggestions, productId] }
  );
}

/**
 * Top the cart up to the usual quantity of every staple. Idempotent: a staple
 * already in the cart at (or above) its usual quantity is left alone, so
 * running this twice never doubles an order.
 */
export function topUpStaples(store, shop, options) {
  const { staples, substitutions, carts } = store.getState();
  const plan = planTopUp(shop, { staples, substitutions, cart: carts[shop.id] }, options);

  // One write for the whole top-up: one render, one save.
  if (plan.changed) restoreCart(store, shop.id, plan.next);
  return plan.report;
}

/** Put a whole cart back, as "Undo" does after a top-up. */
export function restoreCart(store, storeId, cart) {
  store.setState((s) => ({ ...s, carts: { ...s.carts, [storeId]: { ...cart } } }));
}

export function saveAddress(store, address) {
  store.setState((s) => ({ ...s, address: { ...s.address, ...address } }));
}

export function setCheckout(store, partial) {
  store.setState((s) => ({ ...s, checkout: { ...s.checkout, ...partial } }));
}

/** Turns the current store's cart into an order. Callers validate first. */
export function placeOrder(store, { deliveryWindow, now = new Date() }) {
  const state = store.getState();
  const shop = storesById[state.storeId];
  const totals = cartTotals(shop, state.carts[shop.id], {
    tip: state.checkout.tip ?? DEFAULT_TIP,
    windowFee: deliveryWindow.fee,
  });
  const { lines, ...amounts } = totals;

  const order = {
    id: `BF-${state.nextOrderNumber}`,
    storeId: shop.id,
    storeName: shop.name,
    placedAt: now.getTime(),
    shopper: SHOPPERS[state.nextOrderNumber % SHOPPERS.length],
    window: { label: deliveryWindow.label, priority: deliveryWindow.priority },
    replacements: state.checkout.replacements,
    address: { ...state.address },
    items: lines.map((l) => ({
      id: l.product.id,
      name: l.product.name,
      emoji: l.product.emoji,
      size: l.product.size,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    totals: amounts,
  };

  store.setState((s) => ({
    ...s,
    orders: [order, ...s.orders],
    nextOrderNumber: s.nextOrderNumber + 1,
    carts: { ...s.carts, [shop.id]: {} },
    checkout: { ...s.checkout, windowId: null, tip: null },
  }));
  return order;
}

// Orders move through their stages on a demo-friendly clock so the whole
// journey can be watched in about a minute and a half.
export const ORDER_STAGES = [
  { key: "placed", label: "Order placed", after: 0 },
  { key: "shopping", label: "Shopping", after: 15_000 },
  { key: "delivering", label: "Out for delivery", after: 45_000 },
  { key: "delivered", label: "Delivered", after: 90_000 },
];

export function orderProgress(order, now = Date.now()) {
  const elapsed = now - order.placedAt;
  let stageIndex = 0;
  ORDER_STAGES.forEach((stage, i) => {
    if (elapsed >= stage.after) stageIndex = i;
  });
  const last = ORDER_STAGES[ORDER_STAGES.length - 1];
  return {
    stageIndex,
    stage: ORDER_STAGES[stageIndex],
    delivered: stageIndex === ORDER_STAGES.length - 1,
    fraction: Math.min(1, Math.max(0, elapsed / last.after)),
  };
}
