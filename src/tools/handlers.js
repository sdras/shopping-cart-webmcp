// Tool logic, free of React so it can be unit tested. Every handler takes
// `(input, ctx)` where ctx is `{ app, navigate, notify, openCart, now }` and
// returns a short string for the model. Failures throw ToolError with a
// message that tells the agent what to do next; the hook turns those into
// `isError` results.
import { stores, storesById, findStore } from "../data/stores.js";
import { departments } from "../data/products.js";
import {
  searchProducts as searchCatalog,
  resolveProduct,
  findDepartment,
  priceAt,
  inStockAt,
} from "../lib/catalog.js";
import { cartTotals, parseTip, DEFAULT_TIP } from "../lib/pricing.js";
import { getDeliveryWindows, findDeliveryWindow } from "../lib/deliveryWindows.js";
import { money, plural } from "../lib/format.js";
import {
  MAX_QUANTITY,
  REPLACEMENT_OPTIONS,
  selectStore,
  addItem,
  setQuantity,
  setCheckout,
  saveAddress,
  placeOrder as commitOrder,
  isAddressComplete,
  formatAddress,
  orderProgress,
} from "../state/appStore.js";

export class ToolError extends Error {}

const MAX_RESULTS = 8;
const MAX_CART_LINES = 20;
const storeNames = stores.map((s) => s.name).join(", ");

function openStore(ctx) {
  const shop = storesById[ctx.app.getState().storeId];
  if (!shop) {
    throw new ToolError(`No store is open yet. Call choose_store first with one of: ${storeNames}.`);
  }
  return shop;
}

const cartOf = (ctx, shop) => ctx.app.getState().carts[shop.id] ?? {};

function checkoutTotals(ctx, shop, now) {
  const { checkout, carts } = ctx.app.getState();
  const chosen = findDeliveryWindow(getDeliveryWindows(shop, now), checkout.windowId);
  return cartTotals(shop, carts[shop.id], {
    tip: checkout.tip ?? DEFAULT_TIP,
    windowFee: chosen?.fee ?? 0,
  });
}

function parseQuantity(value, { min, fallback }) {
  if (value == null && fallback != null) return fallback;
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < min || quantity > MAX_QUANTITY) {
    throw new ToolError(
      `Invalid quantity "${value}". Provide a whole number from ${min} to ${MAX_QUANTITY}.`
    );
  }
  return quantity;
}

const candidateList = (candidates) => candidates.map((p) => `"${p.name}"`).join(", ");

export function chooseStore({ store } = {}, ctx) {
  const shop = findStore(store);
  if (!shop) {
    throw new ToolError(`There is no store called "${store}". Choose one of: ${storeNames}.`);
  }
  selectStore(ctx.app, shop.id);
  ctx.navigate(`/store/${shop.id}`);

  const count = cartTotals(shop, cartOf(ctx, shop)).itemCount;
  return [
    `Opened ${shop.name} (${shop.tagline}).`,
    `Delivery in about ${shop.eta}. Delivery fee ${money(shop.deliveryFee)}, free over ${money(shop.freeDeliveryOver)}. Order minimum ${money(shop.minimumOrder)}.`,
    `Departments: ${departments.map((d) => d.name).join(", ")}.`,
    count ? `The cart here already has ${plural(count, "item")}.` : "The cart here is empty.",
  ].join("\n");
}

export function searchProducts({ query, department, dietary, max_price } = {}, ctx) {
  const shop = openStore(ctx);

  let dept = null;
  if (department) {
    dept = findDepartment(department);
    if (!dept) {
      throw new ToolError(
        `Unknown department "${department}". Use one of: ${departments.map((d) => d.name).join(", ")}.`
      );
    }
  }
  const diet = Array.isArray(dietary) ? dietary : dietary ? [dietary] : [];
  if (max_price != null && !(Number(max_price) > 0)) {
    throw new ToolError(`Invalid max_price "${max_price}". Provide a dollar amount such as 5.`);
  }

  const results = searchCatalog({
    query,
    department: dept?.id,
    dietary: diet,
    maxPrice: max_price == null ? undefined : Number(max_price),
    store: shop,
  });

  // Show the shopper the same results the agent is reading.
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (dept) params.set("dept", dept.id);
  if (diet.length) params.set("diet", diet.join(","));
  if (max_price != null) params.set("max", String(max_price));
  ctx.navigate(`/store/${shop.id}?${params}`);

  const filters = [
    query && `"${query}"`,
    dept && `in ${dept.name}`,
    diet.length && diet.join(" + "),
    max_price != null && `under ${money(Number(max_price))}`,
  ].filter(Boolean);
  const what = filters.length ? ` for ${filters.join(", ")}` : "";

  if (results.length === 0) {
    return `No products found at ${shop.name}${what}. Try a simpler or more general query (one product type, like "tortillas"), or remove a filter.`;
  }

  const lines = results.slice(0, MAX_RESULTS).map((p) => {
    const stock = inStockAt(shop, p) ? "in stock" : "OUT OF STOCK";
    const tags = p.tags.length ? ` — ${p.tags.join(", ")}` : "";
    return `- ${p.name} — ${money(priceAt(shop, p))} (${p.size}) — ${stock}${tags}`;
  });
  const shown = Math.min(results.length, MAX_RESULTS);
  return [
    `Showing ${shown} of ${plural(results.length, "result")} at ${shop.name}${what}:`,
    ...lines,
  ].join("\n");
}

export function addToCart({ items } = {}, ctx) {
  const shop = openStore(ctx);
  if (!Array.isArray(items) || items.length === 0) {
    throw new ToolError(
      'Provide "items": a list like [{ "product": "Corn Tortillas", "quantity": 2 }].'
    );
  }

  const added = [];
  const problems = [];
  let lastAdded = "";
  for (const item of items) {
    const name = item?.product;
    try {
      const quantity = parseQuantity(item?.quantity, { min: 1, fallback: 1 });
      const { product, candidates } = resolveProduct(name);
      if (candidates) {
        problems.push(`"${name}" matches several products: ${candidateList(candidates)}. Ask the shopper which one, then add it by exact name.`);
      } else if (!product) {
        problems.push(`"${name}" was not found. Call search_products to find the exact product name.`);
      } else if (!inStockAt(shop, product)) {
        problems.push(`${product.name} is out of stock at ${shop.name}. Call search_products to offer a similar item.`);
      } else {
        const total = addItem(ctx.app, shop.id, product.id, quantity);
        const capped = total === MAX_QUANTITY ? ` (limit of ${MAX_QUANTITY} per item reached)` : "";
        added.push(`${quantity} × ${product.name} (now ${total} in cart)${capped}`);
        lastAdded = `${quantity} × ${product.name}`;
      }
    } catch (error) {
      if (!(error instanceof ToolError)) throw error;
      problems.push(`"${name}": ${error.message}`);
    }
  }

  if (added.length === 0) {
    throw new ToolError(`Nothing was added.\n${problems.map((p) => `- ${p}`).join("\n")}`);
  }

  ctx.notify(`Added ${added.length === 1 ? lastAdded : plural(added.length, "product")} to your cart`);
  const totals = cartTotals(shop, cartOf(ctx, shop));
  return [
    `Added to the ${shop.name} cart:`,
    ...added.map((a) => `- ${a}`),
    ...(problems.length ? ["Not added:", ...problems.map((p) => `- ${p}`)] : []),
    `Cart subtotal is now ${money(totals.subtotal)} for ${plural(totals.itemCount, "item")}.`,
  ].join("\n");
}

export function updateCartItem({ product: name, quantity: rawQuantity } = {}, ctx) {
  const shop = openStore(ctx);
  const quantity = parseQuantity(rawQuantity, { min: 0 });
  const cart = cartOf(ctx, shop);

  const { product, candidates } = resolveProduct(name);
  // An ambiguous name is fine when only one of the candidates is in the cart.
  const inCart = candidates?.filter((p) => cart[p.id]) ?? [];
  const target = product ?? (inCart.length === 1 ? inCart[0] : null);

  if (!target && inCart.length > 1) {
    throw new ToolError(`"${name}" matches several items in the cart: ${candidateList(inCart)}. Use the exact name.`);
  }
  if (!target || !cart[target.id]) {
    throw new ToolError(
      `"${name}" is not in the ${shop.name} cart. Call get_cart to see what is, or add_to_cart to add it.`
    );
  }

  setQuantity(ctx.app, shop.id, target.id, quantity);
  const totals = cartTotals(shop, cartOf(ctx, shop));
  const change = quantity === 0 ? `Removed ${target.name}.` : `${target.name} quantity is now ${quantity}.`;
  ctx.notify(change);
  return `${change} Cart subtotal is now ${money(totals.subtotal)} for ${plural(totals.itemCount, "item")}.`;
}

export function getCart(_input, ctx) {
  const shop = openStore(ctx);
  const totals = checkoutTotals(ctx, shop, ctx.now());
  ctx.openCart(); // let the shopper look at what the agent is reading
  if (totals.lines.length === 0) {
    return `The ${shop.name} cart is empty. Use search_products and add_to_cart to fill it.`;
  }

  const lines = totals.lines
    .slice(0, MAX_CART_LINES)
    .map((l) => `- ${l.quantity} × ${l.product.name} (${l.product.size}) — ${money(l.lineTotal)}`);
  if (totals.lines.length > MAX_CART_LINES) {
    lines.push(`- …and ${totals.lines.length - MAX_CART_LINES} more products`);
  }

  const minimum = totals.belowMinimumBy
    ? `Order minimum ${money(totals.minimumOrder)}: add ${money(totals.belowMinimumBy)} more to check out.`
    : `Order minimum ${money(totals.minimumOrder)}: met.`;
  const free = totals.freeDelivery
    ? "Free delivery unlocked."
    : `Add ${money(totals.toFreeDelivery)} more for free delivery.`;

  return [
    `${shop.name} cart (${plural(totals.itemCount, "item")}):`,
    ...lines,
    `Subtotal ${money(totals.subtotal)}. Delivery ${money(totals.deliveryFee + totals.priorityFee)}, service fee ${money(totals.serviceFee)}, tax ${money(totals.tax)}, tip ${money(totals.tip)}. Estimated total ${money(totals.total)}.`,
    `${minimum} ${free}`,
  ].join("\n");
}

function requireCheckoutReadyCart(ctx, shop) {
  const totals = cartTotals(shop, cartOf(ctx, shop));
  if (totals.lines.length === 0) {
    throw new ToolError(`The ${shop.name} cart is empty. Add products with add_to_cart before checking out.`);
  }
  if (totals.belowMinimumBy > 0) {
    throw new ToolError(
      `The cart subtotal is ${money(totals.subtotal)} and ${shop.name} has a ${money(shop.minimumOrder)} minimum. Add ${money(totals.belowMinimumBy)} more before checking out.`
    );
  }
}

function missingForOrder(ctx) {
  const { address, checkout } = ctx.app.getState();
  return [
    !isAddressComplete(address) && "a delivery address (set_delivery_address)",
    !checkout.windowId && "a delivery window (set_delivery_options)",
  ].filter(Boolean);
}

export function startCheckout(_input, ctx) {
  const shop = openStore(ctx);
  requireCheckoutReadyCart(ctx, shop);
  ctx.navigate(`/store/${shop.id}/checkout`);

  const { address, checkout } = ctx.app.getState();
  const windows = getDeliveryWindows(shop, ctx.now());
  const totals = checkoutTotals(ctx, shop, ctx.now());
  const missing = missingForOrder(ctx);

  return [
    `Checkout is open for ${shop.name}. Nothing has been purchased yet.`,
    `Delivery windows: ${windows.map((w) => (w.fee ? `${w.label} (+${money(w.fee)})` : w.label)).join("; ")}.`,
    isAddressComplete(address)
      ? `Saved delivery address: ${formatAddress(address)}.`
      : "No delivery address saved yet.",
    `Tip ${money(totals.tip)}. If an item is out of stock: ${checkout.replacements}. Estimated total ${money(totals.total)}.`,
    missing.length
      ? `Still needed before place_order: ${missing.join(" and ")}.`
      : "Everything needed is set. Review the order with the shopper, then call place_order.",
  ].join("\n");
}

export function setDeliveryOptions({ delivery_window, tip, replacements } = {}, ctx) {
  const shop = openStore(ctx);
  if (delivery_window == null && tip == null && replacements == null) {
    throw new ToolError("Provide at least one of: delivery_window, tip, replacements.");
  }

  const update = {};
  const changes = [];

  if (delivery_window != null) {
    const windows = getDeliveryWindows(shop, ctx.now());
    const chosen = findDeliveryWindow(windows, delivery_window);
    if (!chosen) {
      throw new ToolError(
        `"${delivery_window}" is not an available delivery window. Choose one of: ${windows.map((w) => w.label).join("; ")}.`
      );
    }
    update.windowId = chosen.id;
    changes.push(`Delivery window: ${chosen.label}${chosen.fee ? ` (+${money(chosen.fee)})` : ""}.`);
  }

  if (tip != null) {
    const subtotal = cartTotals(shop, cartOf(ctx, shop)).subtotal;
    const amount = parseTip(tip, subtotal);
    if (amount == null || amount > 200) {
      throw new ToolError(`Could not read the tip "${tip}". Provide it like "$5", "15%", or "none" (up to $200).`);
    }
    update.tip = amount;
    changes.push(`Tip: ${money(amount)}.`);
  }

  if (replacements != null) {
    const option = REPLACEMENT_OPTIONS.find((o) => o.toLowerCase() === String(replacements).toLowerCase());
    if (!option) {
      throw new ToolError(`Unknown replacements option "${replacements}". Use one of: ${REPLACEMENT_OPTIONS.join(", ")}.`);
    }
    update.replacements = option;
    changes.push(`If an item is out of stock: ${option}.`);
  }

  setCheckout(ctx.app, update);
  const totals = checkoutTotals(ctx, shop, ctx.now());
  const missing = missingForOrder(ctx);
  return [
    ...changes,
    `Order total is now ${money(totals.total)}.`,
    missing.length ? `Still needed before place_order: ${missing.join(" and ")}.` : "Ready for place_order once the shopper confirms.",
  ].join("\n");
}

const ZIP = /^\d{5}(-\d{4})?$/;

// Shared by the declarative address form for both people and agents.
export function setDeliveryAddress(fields, ctx) {
  const address = {
    street: String(fields.street ?? "").trim(),
    unit: String(fields.unit ?? "").trim(),
    city: String(fields.city ?? "").trim(),
    zip: String(fields.zip ?? "").trim(),
    instructions: String(fields.instructions ?? "").trim(),
  };
  const missing = ["street", "city", "zip"].filter((key) => !address[key]);
  if (missing.length) {
    throw new ToolError(`The delivery address is missing: ${missing.join(", ")}. Ask the shopper for it.`);
  }
  if (!ZIP.test(address.zip)) {
    throw new ToolError(`"${address.zip}" is not a valid ZIP code. Provide 5 digits, such as 94110.`);
  }
  saveAddress(ctx.app, address);
  return `Delivery address saved: ${formatAddress(address)}.${address.instructions ? ` Driver instructions: ${address.instructions}.` : ""}`;
}

export function placeOrder(_input, ctx) {
  const shop = openStore(ctx);
  requireCheckoutReadyCart(ctx, shop);

  const missing = missingForOrder(ctx);
  if (missing.length) {
    throw new ToolError(`The order can't be placed yet. Still needed: ${missing.join(" and ")}.`);
  }

  const now = ctx.now();
  const windows = getDeliveryWindows(shop, now);
  const chosen = findDeliveryWindow(windows, ctx.app.getState().checkout.windowId);
  if (!chosen) {
    setCheckout(ctx.app, { windowId: null });
    throw new ToolError(
      `The chosen delivery window is no longer available. Pick a new one with set_delivery_options: ${windows.map((w) => w.label).join("; ")}.`
    );
  }

  const order = commitOrder(ctx.app, { deliveryWindow: chosen, now });
  ctx.navigate(`/orders/${order.id}`);
  return [
    `Order ${order.id} is placed with ${shop.name}: ${plural(order.totals.itemCount, "item")}, total ${money(order.totals.total)}.`,
    `Arriving ${order.window.label} at ${formatAddress(order.address)}. ${order.shopper} will shop the order.`,
    "Track it with get_order_status.",
  ].join("\n");
}

export function getOrderStatus({ order_number } = {}, ctx) {
  const { orders } = ctx.app.getState();
  if (orders.length === 0) {
    return "There are no orders yet. An order appears here after place_order.";
  }

  let order = orders[0];
  if (order_number) {
    const needle = String(order_number).trim().toUpperCase().replace(/^#/, "");
    order = orders.find((o) => o.id === needle || o.id === `BF-${needle}`);
    if (!order) {
      throw new ToolError(
        `No order "${order_number}" was found. Recent orders: ${orders.slice(0, 5).map((o) => o.id).join(", ")}.`
      );
    }
  }

  ctx.navigate(`/orders/${order.id}`);
  const { stage, delivered } = orderProgress(order, ctx.now().getTime());
  const items = order.items.slice(0, 12).map((i) => `${i.quantity} × ${i.name}`).join(", ");
  const more = order.items.length > 12 ? `, and ${order.items.length - 12} more` : "";
  return [
    `Order ${order.id} from ${order.storeName}: ${stage.label}.`,
    delivered
      ? `Delivered to ${formatAddress(order.address)}.`
      : `Arriving ${order.window.label} at ${formatAddress(order.address)}. Shopper: ${order.shopper}.`,
    `Items: ${items}${more}.`,
    `Total ${money(order.totals.total)}. If out of stock: ${order.replacements}.`,
  ].join("\n");
}
