import { products, productsById, departments } from "../data/products.js";
import { roundCents } from "./format.js";

export function priceAt(store, product) {
  return roundCents(product.price * store.priceFactor);
}

export function inStockAt(store, product) {
  return !store.outOfStock.includes(product.id);
}

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // jalapeño → jalapeno
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

// Crude singularization so "tortillas" matches "tortilla chips" and
// "tomatoes" matches "tomato".
function stem(word) {
  if (word.length > 4 && word.endsWith("oes")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export const tokens = (text) => normalize(text).split(" ").filter(Boolean).map(stem);

export const index = products.map((product) => ({
  product,
  name: normalize(product.name),
  nameTokens: tokens(product.name),
  extraTokens: tokens(
    `${product.keywords} ${product.tags.join(" ")} ${product.department}`
  ),
}));

function scoreEntry(entry, query, queryTokens) {
  if (entry.name === query) return 100;
  let score = 0;
  for (const token of queryTokens) {
    if (entry.nameTokens.includes(token)) score += 10;
    else if (entry.nameTokens.some((t) => t.startsWith(token))) score += 6;
    else if (entry.extraTokens.includes(token)) score += 3;
    else return 0; // every word in the query has to land somewhere
  }
  // Prefer tighter names: "Bananas" over "Organic Bananas" for "banana".
  return score - entry.nameTokens.length * 0.1;
}

/**
 * Search the catalog. All filters are optional; with no query the results
 * keep catalog order.
 */
export function searchProducts({ query = "", department, dietary = [], maxPrice, store } = {}) {
  const q = normalize(query);
  const qTokens = tokens(query);

  return index
    .map((entry) => ({ entry, score: q ? scoreEntry(entry, q, qTokens) : 1 }))
    .filter(({ entry, score }) => {
      const { product } = entry;
      if (score <= 0) return false;
      if (department && product.department !== department) return false;
      if (!dietary.every((tag) => product.tags.includes(tag))) return false;
      if (maxPrice != null && store && priceAt(store, product) > maxPrice) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry.product);
}

/**
 * Resolve the product an agent (or person) named. Returns
 * `{ product }`, `{ candidates }` when it's a toss-up, or `{}` when nothing fits.
 */
export function resolveProduct(nameOrId) {
  const raw = String(nameOrId ?? "").trim();
  if (!raw) return {};
  if (productsById[raw]) return { product: productsById[raw] };

  const q = normalize(raw);
  const qTokens = tokens(raw);
  const scored = index
    .map((entry) => ({ product: entry.product, score: scoreEntry(entry, q, qTokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return {};
  const [best, next] = scored;
  // A clear winner: an exact name, the only hit, or comfortably ahead.
  if (best.score >= 100 || !next || best.score - next.score >= 2) {
    return { product: best.product };
  }
  return { candidates: scored.slice(0, 5).map((s) => s.product) };
}

export function findDepartment(nameOrId) {
  if (!nameOrId) return null;
  const needle = normalize(nameOrId);
  return (
    departments.find((d) => d.id === needle || normalize(d.name) === needle) ||
    departments.find((d) => normalize(d.name).includes(needle)) ||
    null
  );
}

/**
 * In-stock stand-ins for a product, best first. A candidate has to be the same
 * kind of thing: it shares a word of the name, or a leading keyword (the first
 * keyword says what a product *is*; later ones only say what it goes with, and
 * nobody wants limes because they're out of avocados).
 */
export function similarProducts(store, product, limit = 3) {
  const nameTokens = tokens(product.name);
  const keywordTokens = tokens(product.keywords);

  return index
    .filter(({ product: other }) => other.id !== product.id && other.department === product.department && inStockAt(store, other))
    .map(({ product: other, nameTokens: otherName }) => {
      const otherKeywords = tokens(other.keywords);
      const sharedNames = otherName.filter((t) => nameTokens.includes(t)).length;
      const sharedKeywords = otherKeywords.filter((t) => keywordTokens.includes(t) || nameTokens.includes(t)).length;
      const leading =
        (keywordTokens[0] && [...otherKeywords, ...otherName].includes(keywordTokens[0])) ||
        (otherKeywords[0] && [...keywordTokens, ...nameTokens].includes(otherKeywords[0]));
      if (!sharedNames && !leading) return null;

      const sharedTags = other.tags.filter((t) => product.tags.includes(t)).length;
      const priceGap = Math.abs(other.price - product.price) / Math.max(other.price, product.price);
      return { product: other, score: sharedNames * 3 + sharedKeywords * 2 + sharedTags * 0.5 - priceGap };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.product);
}
