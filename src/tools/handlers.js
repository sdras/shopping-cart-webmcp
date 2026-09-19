// Tool logic, free of React so it can be unit tested. Every handler takes
// `(input, ctx)` where ctx is `{ app, navigate, notify, openCart, now }` and
// returns a short string for the model. Failures throw ToolError with a
// message that tells the agent what to do next; the hook turns those into
// `isError` results.
import { stores, storesById, findStore } from "../data/stores.js";
import { departments, productsById } from "../data/products.js";
import {
  searchProducts as searchCatalog,
  resolveProduct,
  findDepartment,
  priceAt,
  inStockAt,
} from "../lib/catalog.js";
import { cartTotals, parseTip, DEFAULT_TIP } from "../lib/pricing.js";
import { getDeliveryWindows, findDeliveryWindow } from "../lib/deliveryWindows.js";
import { repeatPurchases } from "../lib/staples.js";
import { recipes } from "../data/recipes.js";
import { planRecipe, buildCustomRecipe, ingredientWords } from "../lib/recipes.js";
import { money, plural } from "../lib/format.js";
import {
  MAX_QUANTITY,
  REPLACEMENT_OPTIONS,
  selectStore,
  addItem,
  setQuantity,
  setCheckout,
  setStaple,
  replaceStaples,
  setSubstitution,
  topUpStaples,
  notePantry,
  applyRecipePlan,
  saveCustomRecipe,
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

  const shoppingFor = Object.values(ctx.app.getState().cartRecipes[shop.id] ?? {}).map((r) => r.name);

  return [
    `${shop.name} cart (${plural(totals.itemCount, "item")}):`,
    ...lines,
    shoppingFor.length && `Shopping for these recipes: ${shoppingFor.join(", ")}.`,
    `Subtotal ${money(totals.subtotal)}. Delivery ${money(totals.deliveryFee + totals.priorityFee)}, service fee ${money(totals.serviceFee)}, tax ${money(totals.tax)}, tip ${money(totals.tip)}. Estimated total ${money(totals.total)}.`,
    `${minimum} ${free}`,
  ].filter(Boolean).join("\n");
}

const stapleEntries = (ctx) =>
  Object.entries(ctx.app.getState().staples)
    .map(([id, usual]) => ({ product: productsById[id], usual }))
    .filter((entry) => entry.product);

const NO_STAPLES =
  "No staples are saved yet. Save some with update_staples, or the shopper can star products on the page.";

function ruleText(ctx, product) {
  const rule = ctx.app.getState().substitutions[product.id];
  if (rule?.type === "skip") return " — if out: skip";
  if (rule?.type === "swap" && productsById[rule.with]) return ` — if out: ${productsById[rule.with].name}`;
  return "";
}

// "skip", a product to swap in, or "ask" (clear the rule). Returns a problem string or null.
function saveOutOfStockRule(ctx, product, text) {
  const wish = String(text).trim().toLowerCase();
  if (["ask", "ask me", ""].includes(wish)) {
    setSubstitution(ctx.app, product.id, null);
    return null;
  }
  if (["skip", "skip it", "none", "nothing", "no substitute"].includes(wish)) {
    setSubstitution(ctx.app, product.id, { type: "skip" });
    return null;
  }
  const { product: substitute, candidates } = resolveProduct(text);
  if (candidates) {
    return `The out-of-stock swap "${text}" for ${product.name} matches several products: ${candidateList(candidates)}. Save it again with the exact name.`;
  }
  if (!substitute || substitute.id === product.id) {
    return `The out-of-stock swap "${text}" for ${product.name} was not found. Use a product name from search_products, or "skip".`;
  }
  setSubstitution(ctx.app, product.id, { type: "swap", with: substitute.id });
  return null;
}

export function getStaples(_input, ctx) {
  const staples = stapleEntries(ctx);
  if (staples.length === 0) return NO_STAPLES;

  // Read-only and unobtrusive: no navigation, so it is safe mid-checkout.
  const shop = storesById[ctx.app.getState().storeId];
  if (!shop) {
    return [
      `${plural(staples.length, "staple")} saved (open a store with choose_store to see prices and stock):`,
      ...staples.map(({ product, usual }) => `- ${usual} × ${product.name} (${product.size})${ruleText(ctx, product)}`),
    ].join("\n");
  }

  const cart = cartOf(ctx, shop);
  return [
    `${plural(staples.length, "staple")} saved. At ${shop.name}:`,
    ...staples.map(({ product, usual }) => {
      const stock = inStockAt(shop, product) ? "in stock" : "OUT OF STOCK";
      const inCart = cart[product.id] ? ` — ${cart[product.id]} in cart` : "";
      return `- ${usual} × ${product.name} (${product.size}) — ${money(priceAt(shop, product))} each — ${stock}${inCart}${ruleText(ctx, product)}`;
    }),
  ].join("\n");
}

export function updateStaples({ items, replace_list } = {}, ctx) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ToolError('Provide "items": a list like [{ "product": "Large Eggs", "quantity": 1 }].');
  }

  const resolved = [];
  const problems = [];
  for (const item of items) {
    const name = item?.product;
    try {
      const quantity = parseQuantity(item?.quantity, { min: 0, fallback: 1 });
      const { product, candidates } = resolveProduct(name);
      if (candidates) {
        problems.push(`"${name}" matches several products: ${candidateList(candidates)}. Ask the shopper which one, then save it by exact name.`);
      } else if (!product) {
        problems.push(`"${name}" was not found. Call search_products to find the exact product name.`);
      } else {
        resolved.push({ product, quantity, rule: item?.if_out_of_stock });
      }
    } catch (error) {
      if (!(error instanceof ToolError)) throw error;
      problems.push(`"${name}": ${error.message}`);
    }
  }

  if (resolved.length === 0) {
    throw new ToolError(`Nothing was saved.\n${problems.map((p) => `- ${p}`).join("\n")}`);
  }

  if (replace_list) {
    replaceStaples(ctx.app, Object.fromEntries(resolved.filter((r) => r.quantity > 0).map((r) => [r.product.id, r.quantity])));
  } else {
    for (const { product, quantity } of resolved) setStaple(ctx.app, product.id, quantity);
  }
  for (const { product, quantity, rule } of resolved) {
    if (quantity === 0 || rule == null) continue;
    const problem = saveOutOfStockRule(ctx, product, rule);
    if (problem) problems.push(problem);
  }

  const saved = resolved
    .filter((r) => r.quantity > 0)
    .map((r) => {
      const rule = ruleText(ctx, r.product).replace(" — ", ""); // "if out: skip"
      return `${r.quantity} × ${r.product.name}${rule ? ` (${rule})` : ""}`;
    });
  const removed = resolved.filter((r) => r.quantity === 0).map((r) => r.product.name);
  const count = stapleEntries(ctx).length;
  ctx.notify(`Staples updated: ${plural(count, "product")} on your list`);
  return [
    saved.length && `Saved as staples: ${saved.join(", ")}.`,
    removed.length && `Removed from staples: ${removed.join(", ")}.`,
    ...(problems.length ? ["Not saved:", ...problems.map((p) => `- ${p}`)] : []),
    `The staples list now has ${plural(count, "product")}.`,
  ].filter(Boolean).join("\n");
}

export function addStaplesToCart({ skip } = {}, ctx) {
  const shop = openStore(ctx);
  if (stapleEntries(ctx).length === 0) throw new ToolError(NO_STAPLES);

  // A skipped name only has to identify one staple, so loose names are fine.
  const stapleIds = Object.keys(ctx.app.getState().staples);
  const skipIds = [];
  for (const name of Array.isArray(skip) ? skip : skip ? [skip] : []) {
    const { product, candidates } = resolveProduct(name);
    const matches = (product ? [product] : candidates ?? []).filter((p) => stapleIds.includes(p.id));
    if (matches.length === 0) {
      throw new ToolError(`"${name}" is not on the staples list, so it can't be skipped. Call get_staples to see the list.`);
    }
    skipIds.push(...matches.map((p) => p.id));
  }

  const report = topUpStaples(ctx.app, shop, { skip: skipIds });
  const totals = cartTotals(shop, cartOf(ctx, shop));
  ctx.notify(
    report.added.length
      ? `Added ${plural(report.added.length, "staple")} to your cart`
      : "Your staples are already in the cart"
  );

  return [
    report.added.length
      ? `Added to the ${shop.name} cart: ${report.added.map((a) => `${a.added} × ${a.product.name}`).join(", ")}.`
      : "Nothing needed adding.",
    report.already.length && `Already in the cart: ${report.already.map((a) => a.product.name).join(", ")}.`,
    report.substituted.length &&
      `Out of stock, swapped by the shopper's saved rule: ${report.substituted.map((a) => `${a.substitute.name} for ${a.product.name}`).join(", ")}.`,
    report.skippedOut.length &&
      `Out of stock, left out by the shopper's saved rule: ${report.skippedOut.map((a) => a.product.name).join(", ")}.`,
    report.skipped.length && `Skipped this time: ${report.skipped.map((a) => a.product.name).join(", ")}.`,
    ...report.unavailable.map((a) =>
      a.suggestions.length
        ? `Out of stock with no saved rule: ${a.product.name} (usually ${a.usual}). Closest in stock: ${a.suggestions.map((p) => `${p.name} ${money(priceAt(shop, p))}`).join(", ")}.`
        : `Out of stock with no saved rule: ${a.product.name} (usually ${a.usual}). Nothing similar is in stock.`
    ),
    report.unavailable.length &&
      "Ask the shopper whether to swap, and whether to do that every time. add_to_cart covers a one-time swap; update_staples with if_out_of_stock saves it as a rule.",
    `Cart subtotal is now ${money(totals.subtotal)} for ${plural(totals.itemCount, "item")}.`,
  ].filter(Boolean).join("\n");
}

// Reasons are written to the shopper ("your cart"); an agent reads about them.
const forAgent = (reason) =>
  reason
    .replace(/\byou said you're\b/g, "they said they're")
    .replace(/\byou said you have\b/g, "they said they have")
    .replace(/\byour\b/g, "their");

// Which of this recipe's ingredients does "the parmesan" mean?
function ingredientIds(recipe, names, problems) {
  const ids = [];
  for (const name of Array.isArray(names) ? names : names ? [names] : []) {
    const wanted = ingredientWords(name);
    const best = recipe.ingredients
      .filter((ingredient) => ingredient.productId)
      .map((ingredient) => {
        const words = ingredientWords(`${productsById[ingredient.productId].name} ${ingredient.label ?? ""}`);
        return { id: ingredient.productId, hits: wanted.filter((t) => words.includes(t)).length };
      })
      .sort((a, b) => b.hits - a.hits)[0];
    if (best?.hits) ids.push(best.id);
    else problems.push(`"${name}" is not an ingredient of ${recipe.name}.`);
  }
  return ids;
}

export function addRecipeToCart({ recipe: wantedRecipe, ingredients, recipe_name, already_have, need, preview } = {}, ctx) {
  const shop = openStore(ctx);
  const state = ctx.app.getState();

  let recipe;
  if (Array.isArray(ingredients) && ingredients.length) {
    recipe = buildCustomRecipe(recipe_name ?? wantedRecipe, ingredients, { source: "agent" });
    if (!recipe.ingredients.some((ingredient) => ingredient.productId)) {
      throw new ToolError(`None of those ingredients match anything ${shop.name} sells. Check them with search_products.`);
    }
  } else if (wantedRecipe) {
    const name = String(wantedRecipe).trim().toLowerCase();
    recipe = [...recipes, ...state.customRecipes].find((r) => r.name.toLowerCase() === name);
    if (!recipe) {
      throw new ToolError(`There is no recipe called "${wantedRecipe}". Basketful's recipes: ${recipes.map((r) => r.name).join(", ")}. For any other recipe, pass its ingredients.`);
    }
  } else {
    throw new ToolError(`Provide "recipe" (one of: ${recipes.map((r) => r.name).join(", ")}) or "ingredients" for a recipe from anywhere else.`);
  }

  const problems = [];
  const have = ingredientIds(recipe, already_have, problems);
  const out = ingredientIds(recipe, need, problems);
  const now = ctx.now().getTime();
  const plan = planRecipe(shop, state, recipe, { now, have, need: out });

  if (!preview) {
    if (recipe.custom) saveCustomRecipe(ctx.app, recipe);
    notePantry(ctx.app, { have, need: out }, now);
    applyRecipePlan(ctx.app, shop, recipe, plan);
    ctx.navigate(`/recipes/${recipe.id}`);
    ctx.notify(plan.itemCount ? `Added ${plural(plan.itemCount, "item")} for ${recipe.name}` : `You have everything for ${recipe.name}`);
  }

  const pick = (status) => plan.lines.filter((line) => line.status === status);
  const explained = (lines, withCount) =>
    lines.map((l) => `${withCount ? `${l.add} × ` : ""}${l.label} (${forAgent(l.reason)})`).join("; ");
  const loose = recipe.ingredients.filter((i) => i.productId && i.alternatives?.length);
  const totals = cartTotals(shop, cartOf(ctx, shop));

  return [
    `${recipe.name} at ${shop.name}${preview ? " (preview, nothing changed)" : ""}:`,
    pick("add").length && `${preview ? "Would add" : "Added"}: ${explained(pick("add"), true)}.`,
    pick("in_cart").length && `Already in the cart: ${pick("in_cart").map((l) => l.label).join(", ")}.`,
    pick("have").length && `Left out, assuming they still have it: ${explained(pick("have"))}.`,
    pick("ask").length &&
      `Not added yet, ask if they still have: ${explained(pick("ask"))}.`,
    ...pick("out_of_stock").map((l) =>
      `Out of stock: ${l.label}${l.suggestions.length ? ` (closest in stock: ${l.suggestions.map((p) => p.name).join(", ")})` : ""}.`
    ),
    pick("unmatched").length && `Not sold here: ${pick("unmatched").map((l) => l.label).join(", ")}.`,
    loose.length &&
      `Loose matches: ${loose.map((i) => `${i.label} → ${productsById[i.productId].name} (or ${i.alternatives.map((id) => productsById[id].name).join(", ")})`).join("; ")}. Pass the exact product name as the ingredient to change one.`,
    ...problems,
    !preview && `Cart subtotal is now ${money(totals.subtotal)} for ${plural(totals.itemCount, "item")}.`,
    "Tell the shopper what was assumed. Once they answer, call again with already_have or need: the cart is adjusted, never doubled.",
  ].filter(Boolean).join("\n");
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

// The page asks the shopper "buy any of these every time?" after an order.
// This gives an agent the same opening, at the same moment.
function staplesNudge(ctx, order) {
  const { orders, staples, dismissedSuggestions } = ctx.app.getState();
  const inThisOrder = new Set(order.items.map((item) => item.id));
  const repeats = repeatPurchases(orders, { staples, dismissed: dismissedSuggestions })
    .filter((entry) => inThisOrder.has(entry.product.id))
    .slice(0, 5);
  if (repeats.length) {
    return `The shopper keeps buying ${repeats.map((r) => r.product.name).join(", ")} but has not saved ${repeats.length === 1 ? "it" : "them"} as staples. Offer to save ${repeats.length === 1 ? "it" : "them"} with update_staples so next time is one step.`;
  }
  if (Object.keys(staples).length === 0) {
    return "The shopper has no staples saved. If they buy some of these every time, offer to save them with update_staples.";
  }
  return null;
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
    staplesNudge(ctx, order),
  ].filter(Boolean).join("\n");
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
