// Recipe → cart, with a memory of the shopper's kitchen.
//
// For every ingredient the planner decides one of:
//   in_cart  it's already in the basket (and no other recipe has dibs on it)
//   have     a cupboard item bought within its shelf life: assume it's there
//   ask      bought recently enough that it might be there: a question
//   add      never bought, or bought so long ago it must be gone, or they said they're out
//   out_of_stock / unmatched
// and says why, in words fit for a person or an agent.
import { productsById } from "../data/products.js";
import { index, tokens, inStockAt, priceAt, similarProducts } from "./catalog.js";
import { roundCents, plural } from "./format.js";

const DAY = 24 * 60 * 60 * 1000;

// Calendar days, the way people count them: last night's order was "yesterday",
// not "today", even though it's been under 24 hours.
const startOfDay = (time) => new Date(time).setHours(0, 0, 0, 0);
const daysBetween = (then, now) => Math.max(0, Math.round((startOfDay(now) - startOfDay(then)) / DAY));

/** { [productId]: timestamp } of the latest order containing each product. */
export function lastPurchases(orders) {
  const latest = {};
  for (const order of orders) {
    for (const item of order.items) {
      if (!(latest[item.id] > order.placedAt)) latest[item.id] = order.placedAt;
    }
  }
  return latest;
}

export function ago(days) {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export function keepsFor(days) {
  if (days < 14) return `about ${plural(days, "day")}`;
  if (days < 60) return `about ${plural(Math.round(days / 7), "week")}`;
  if (days < 365) return `about ${plural(Math.round(days / 30), "month")}`;
  return days < 730 ? "about a year" : `about ${Math.round(days / 365)} years`;
}

/**
 * What the order history (and anything the shopper has told us) says about
 * one product: { status: "need" | "expired" | "have" | "ask", reason, daysAgo }.
 */
export function pantryVerdict(product, { lastBought, note, now }) {
  // Their word beats our guess, until they buy it again. "I have it" also
  // lapses once the thing would have gone off.
  if (note && !(lastBought > note.at)) {
    const noteAge = daysBetween(note.at, now);
    if (!note.have) return { status: "need", reason: "you said you're out" };
    if (noteAge <= product.keeps) return { status: "have", reason: `you said you have it (${ago(noteAge)})` };
  }

  if (lastBought == null) return { status: "need", reason: "not in your order history" };

  const daysAgo = daysBetween(lastBought, now);
  if (daysAgo > product.keeps) {
    return {
      status: "expired",
      daysAgo,
      reason: `last bought ${ago(daysAgo)}, keeps ${keepsFor(product.keeps)}: assuming it's gone`,
    };
  }
  if (product.lastsManyUses) {
    return { status: "have", daysAgo, reason: `bought ${ago(daysAgo)}, keeps ${keepsFor(product.keeps)}` };
  }
  return { status: "ask", daysAgo, reason: `bought ${ago(daysAgo)}` };
}

// Sold one at a time, so two recipes that each want two limes want four.
// Anything sold by the bag, jar, or bottle is shared between recipes.
export const countable = (product) => product.size === "each";

/**
 * Plan a recipe against the open store, the cart, and the shopper's history.
 * `have` / `need` are product ids the shopper has just answered about.
 * Pure: `applyRecipePlan` in the store is what acts on the result.
 */
export function planRecipe(shop, state, recipe, { now = Date.now(), have = [], need = [] } = {}) {
  const cart = state.carts?.[shop.id] ?? {};
  const records = state.cartRecipes?.[shop.id] ?? {};
  const own = records[recipe.id]?.items ?? {};
  const bought = lastPurchases(state.orders ?? []);

  const lines = recipe.ingredients.map((ingredient) => {
    const product = productsById[ingredient.productId];
    const base = { ingredient, product, label: product?.name ?? ingredient.label, needed: ingredient.quantity ?? 1 };
    if (!product) return { ...base, status: "unmatched", add: 0, uses: 0, reason: "nothing like it is sold here" };

    // What's in the cart that isn't this recipe's doing, minus what other
    // recipes are counting on (for things sold one at a time).
    const cartWithoutMine = Math.max(0, (cart[product.id] ?? 0) - (own[product.id]?.added ?? 0));
    const othersUse = Object.entries(records)
      .filter(([id]) => id !== recipe.id)
      .reduce((sum, [, record]) => sum + (record.items[product.id]?.uses ?? 0), 0);
    const free = countable(product) ? Math.max(0, cartWithoutMine - othersUse) : cartWithoutMine;

    if (free >= base.needed) {
      return { ...base, status: "in_cart", add: 0, uses: base.needed, reason: "already in your cart" };
    }

    let verdict;
    if (need.includes(product.id)) verdict = { status: "need", reason: "you said you're out" };
    else if (have.includes(product.id)) verdict = { status: "have", reason: "you said you have it" };
    else verdict = pantryVerdict(product, { lastBought: bought[product.id], note: state.pantryNotes?.[product.id], now });

    if (verdict.status === "have" || verdict.status === "ask") {
      return { ...base, ...verdict, add: 0, uses: 0 };
    }
    if (!inStockAt(shop, product)) {
      return { ...base, status: "out_of_stock", add: 0, uses: 0, reason: `out of stock at ${shop.name}`, suggestions: similarProducts(shop, product) };
    }
    const add = base.needed - free;
    const partly = free > 0 ? `${free} already in your cart; ` : "";
    return { ...base, status: "add", why: verdict.status, daysAgo: verdict.daysAgo, add, uses: base.needed, reason: partly + verdict.reason };
  });

  const adding = lines.filter((line) => line.add > 0);
  const target = Object.fromEntries(
    lines.filter((line) => line.uses > 0).map((line) => [line.product.id, { uses: line.uses, added: line.add }])
  );
  const applied =
    Boolean(records[recipe.id]) &&
    [...new Set([...Object.keys(own), ...Object.keys(target)])].every(
      (id) => (own[id]?.added ?? 0) === (target[id]?.added ?? 0)
    );

  return {
    lines,
    target,
    applied,
    itemCount: adding.reduce((sum, line) => sum + line.add, 0),
    cost: roundCents(adding.reduce((sum, line) => sum + line.add * priceAt(shop, line.product), 0)),
    questions: lines.filter((line) => line.status === "ask"),
  };
}

// ---------------------------------------------------------------------------
// Recipes from anywhere: match free-text ingredients to the catalog.

const FILLER = new Set([
  "a", "an", "and", "or", "of", "for", "the", "to", "taste", "fresh", "freshly", "chopped", "minced", "sliced",
  "grated", "large", "small", "medium", "ripe", "whole", "finely", "roughly", "peeled", "optional", "plus",
  "more", "serving", "about", "good", "quality", "your", "favorite", "leaf", "leave", "sprig", "handful",
]);

/** The words of an ingredient that say what it is: no "the", "fresh", or "2". */
export const ingredientWords = (text) => tokens(text).filter((t) => !FILLER.has(t) && !/^\d/.test(t));

/** Best catalog match for an ingredient as a recipe writes it, plus close runners-up. */
export function matchIngredient(text) {
  const wanted = ingredientWords(text);
  if (wanted.length === 0) return { product: null, alternatives: [] };
  const canned = wanted.includes("can") || wanted.includes("canned");

  const scored = index
    .map((entry) => {
      const nameHits = wanted.filter((t) => entry.nameTokens.includes(t)).length;
      const keywordHits = wanted.filter((t) => !entry.nameTokens.includes(t) && entry.extraTokens.includes(t)).length;
      const hits = nameHits + keywordHits;
      if (hits === 0 || hits < Math.ceil(wanted.length / 2)) return null;
      const extra = entry.nameTokens.length - nameHits;
      // A recipe that says "tomatoes" means the fresh ones, and one that says
      // "flour" means the thing called flour, not flour tortillas.
      const fresh = entry.product.department === "produce" && !canned ? 1 : 0;
      const isTheNoun = wanted.includes(entry.nameTokens.at(-1)) ? 0.4 : 0;
      const score = nameHits * 3 + keywordHits - (wanted.length - hits) * 0.5 - extra * 0.1 + fresh + isTheNoun;
      return { product: entry.product, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { product: null, alternatives: [] };
  const [best, ...rest] = scored;
  return {
    product: best.product,
    alternatives: rest.filter((r) => best.score - r.score <= 1).slice(0, 3).map((r) => r.product),
  };
}

const FRACTIONS = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 0.33, "⅔": 0.67 };
const UNIT =
  /^(cups?|tbsps?|tsps?|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|cloves?|cans?|jars?|bunch(?:es)?|pinch(?:es)?|dash(?:es)?|heads?|sticks?|slices?|packages?|pkgs?|g|kg|ml|l)\b\.?/i;

/** "2 large tomatoes, diced" → { name: "large tomatoes", amount: "2", count: 2 } */
export function parseIngredientLine(line) {
  // Drop bullets and "1." / "2)" list markers (but not "1.5 cups"), then asides in parentheses.
  let rest = String(line)
    .replace(/^[\s\-*•]+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/^(?:the\s+)?(?:juice|zest)\s+of\s+/i, "")
    .replace(/^(?:a|an|one)\s+(?=\S)/i, "1 ")
    .trim();

  const number = rest.match(/^((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?|[½¼¾⅓⅔])\s*/);
  let count = null;
  let amount = "";
  if (number) {
    const raw = number[1];
    count = FRACTIONS[raw] ?? raw.split(/\s+/).reduce((sum, part) => {
      const [top, bottom] = part.split("/");
      return sum + (bottom ? Number(top) / Number(bottom) : Number(top));
    }, 0);
    amount = raw;
    rest = rest.slice(number[0].length);
  }
  const unit = rest.match(UNIT);
  if (unit) {
    amount = `${amount} ${unit[0]}`.trim();
    rest = rest.slice(unit[0].length).replace(/^\s*of\s+/i, "");
  }
  const name = rest.split(",")[0].trim();
  // Only a bare count ("3 avocados") says how many to buy. "2 cups" doesn't.
  return { name, amount, count: unit ? null : count };
}

const slug = (text) => tokens(text).join("-").slice(0, 40) || "recipe";

/**
 * Build a recipe from ingredients written however the source wrote them.
 * `inputs` are strings, or { name, quantity } from an agent.
 */
export function buildCustomRecipe(name, inputs, { source = "pasted" } = {}) {
  const ingredients = inputs
    .map((input) => (typeof input === "string" ? { text: input } : { text: input?.name ?? "", quantity: input?.quantity }))
    .filter((input) => input.text.trim())
    .map(({ text, quantity }) => {
      const parsed = parseIngredientLine(text);
      const { product, alternatives } = matchIngredient(parsed.name);
      const counted = product && countable(product) && parsed.count ? Math.min(12, Math.max(1, Math.ceil(parsed.count))) : 1;
      return {
        productId: product?.id ?? null,
        label: parsed.name || text.trim(),
        amount: parsed.amount,
        quantity: Number.isInteger(quantity) && quantity > 0 ? Math.min(12, quantity) : counted,
        alternatives: alternatives.map((p) => p.id),
      };
    });

  const title = String(name ?? "").trim() || "My recipe";
  return { id: `custom-${slug(title)}`, name: title, emoji: "📝", custom: true, source, ingredients };
}
