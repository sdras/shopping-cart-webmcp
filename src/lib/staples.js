import { productsById } from "../data/products.js";
import { inStockAt, priceAt, similarProducts } from "./catalog.js";
import { roundCents } from "./format.js";

/**
 * Work out what topping a cart up to "the usual" would do, without doing it.
 *
 * Each staple wants its usual quantity in the cart. One that's out of stock
 * follows its saved rule: swap in another product, or skip it. With no rule
 * it is reported as unavailable, along with close matches to offer.
 * Wants are summed per product first, so a substitute that is also a staple
 * in its own right gets both quantities.
 */
export function planTopUp(shop, { staples = {}, substitutions = {}, cart = {} }, { skip = [] } = {}) {
  const report = { added: [], already: [], substituted: [], skipped: [], skippedOut: [], unavailable: [] };
  const wanted = new Map(); // productId → quantity

  for (const [id, usual] of Object.entries(staples)) {
    const product = productsById[id];
    if (!product) continue;
    if (skip.includes(id)) {
      report.skipped.push({ product });
      continue;
    }

    let goesInCart = product;
    if (!inStockAt(shop, product)) {
      const rule = substitutions[id];
      const substitute = rule?.type === "swap" ? productsById[rule.with] : null;
      if (substitute && inStockAt(shop, substitute)) {
        report.substituted.push({ product, substitute, usual });
        goesInCart = substitute;
      } else if (rule?.type === "skip") {
        report.skippedOut.push({ product });
        continue;
      } else {
        report.unavailable.push({ product, usual, suggestions: similarProducts(shop, product) });
        continue;
      }
    }
    wanted.set(goesInCart.id, (wanted.get(goesInCart.id) ?? 0) + usual);
  }

  const next = { ...cart };
  let cost = 0;
  for (const [id, quantity] of wanted) {
    const product = productsById[id];
    const inCart = cart[id] ?? 0;
    if (inCart >= quantity) {
      report.already.push({ product, inCart });
    } else {
      next[id] = quantity;
      cost += (quantity - inCart) * priceAt(shop, product);
      report.added.push({ product, added: quantity - inCart, total: quantity });
    }
  }

  return { next, report, cost: roundCents(cost), changed: report.added.length > 0 };
}

/**
 * Products that keep turning up in orders but aren't staples yet, most
 * frequent first, each with the quantity from its latest order.
 */
export function repeatPurchases(orders, { staples = {}, dismissed = [] } = {}, { minOrders = 2 } = {}) {
  const seen = new Map(); // productId → { count, quantity }
  for (const order of orders) {
    for (const item of order.items) {
      const entry = seen.get(item.id);
      // Orders are newest first, so the first sighting carries the latest quantity.
      if (entry) entry.count += 1;
      else seen.set(item.id, { count: 1, quantity: item.quantity });
    }
  }
  return [...seen]
    .filter(([id, { count }]) => count >= minOrders && !staples[id] && !dismissed.includes(id) && productsById[id])
    .sort((a, b) => b[1].count - a[1].count)
    .map(([id, { count, quantity }]) => ({ product: productsById[id], count, quantity }));
}
