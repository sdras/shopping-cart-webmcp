import { createStore } from "./createStore.js";
import { storesById } from "../data/stores.js";
import { cartTotals, DEFAULT_TIP } from "../lib/pricing.js";

const STORAGE_KEY = "basketful:v1";
export const MAX_QUANTITY = 24;
export const REPLACEMENT_OPTIONS = ["Best match", "Contact me", "Refund item"];

const SHOPPERS = ["Maya", "Dev", "Priya", "Marcus", "Lucía", "Noor"];

const emptyState = () => ({
  storeId: null,
  carts: {}, // { [storeId]: { [productId]: quantity } }
  address: { street: "", unit: "", city: "", zip: "", instructions: "" },
  checkout: { windowId: null, tip: null, replacements: REPLACEMENT_OPTIONS[0] },
  orders: [],
  nextOrderNumber: 1001,
});

function load(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
    return saved ? { ...emptyState(), ...saved } : emptyState();
  } catch {
    return emptyState();
  }
}

export function createAppStore({ storage } = {}) {
  const store = createStore(load(storage));
  store.subscribe(() => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(store.getState()));
    } catch {
      // Storage can be full or blocked; the app still works for this session.
    }
  });
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

export function setQuantity(store, storeId, productId, quantity) {
  const clamped = Math.max(0, Math.min(MAX_QUANTITY, Math.round(quantity)));
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
