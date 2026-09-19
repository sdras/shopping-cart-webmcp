import { productsById } from "../data/products.js";
import { priceAt } from "./catalog.js";
import { roundCents } from "./format.js";

export const SERVICE_FEE_RATE = 0.05;
export const SERVICE_FEE_MIN = 2;
export const TAX_RATE = 0.085;
export const DEFAULT_TIP = 4;

// Cart lines for a store: [{ product, quantity, unitPrice, lineTotal }]
export function cartLines(store, cart = {}) {
  return Object.entries(cart)
    .filter(([id, quantity]) => productsById[id] && quantity > 0)
    .map(([id, quantity]) => {
      const product = productsById[id];
      const unitPrice = priceAt(store, product);
      return { product, quantity, unitPrice, lineTotal: roundCents(unitPrice * quantity) };
    });
}

export function cartCount(cart = {}) {
  return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
}

export function cartTotals(store, cart = {}, { tip = DEFAULT_TIP, windowFee = 0 } = {}) {
  const lines = cartLines(store, cart);
  const subtotal = roundCents(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const taxable = lines.filter((l) => l.product.taxable).reduce((sum, l) => sum + l.lineTotal, 0);

  const freeDelivery = subtotal >= store.freeDeliveryOver;
  const deliveryFee = lines.length === 0 || freeDelivery ? 0 : store.deliveryFee;
  const serviceFee =
    lines.length === 0 ? 0 : roundCents(Math.max(SERVICE_FEE_MIN, subtotal * SERVICE_FEE_RATE));
  const tax = roundCents(taxable * TAX_RATE);
  const total = roundCents(subtotal + deliveryFee + windowFee + serviceFee + tax + tip);

  return {
    lines,
    itemCount: cartCount(cart),
    subtotal,
    deliveryFee,
    freeDelivery,
    priorityFee: windowFee,
    serviceFee,
    tax,
    tip,
    total,
    minimumOrder: store.minimumOrder,
    belowMinimumBy: roundCents(Math.max(0, store.minimumOrder - subtotal)),
    toFreeDelivery: roundCents(Math.max(0, store.freeDeliveryOver - subtotal)),
  };
}

/**
 * Parse a tip the way someone would say it: "$5", "5", "15%", "none".
 * Returns a dollar amount, or null when it can't be understood.
 */
export function parseTip(input, subtotal) {
  if (typeof input === "number") return input >= 0 ? roundCents(input) : null;
  const text = String(input ?? "").trim().toLowerCase();
  if (!text) return null;
  if (["none", "no tip", "no", "zero", "nothing"].includes(text)) return 0;
  const percent = text.match(/^(\d+(?:\.\d+)?)\s*(%|percent)$/);
  if (percent) return roundCents((subtotal * Number(percent[1])) / 100);
  const dollars = text.match(/^\$?\s*(\d+(?:\.\d{1,2})?)\s*(dollars|bucks|usd)?$/);
  if (dollars) return roundCents(Number(dollars[1]));
  return null;
}
