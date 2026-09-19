import { describe, it, expect } from "vitest";
import { storesById } from "../src/data/stores.js";
import { productsById } from "../src/data/products.js";
import { similarProducts } from "../src/lib/catalog.js";
import { repeatPurchases, planTopUp } from "../src/lib/staples.js";

const names = (list) => list.map((p) => p.name);
const order = (id, items) => ({ id, items: Object.entries(items).map(([pid, quantity]) => ({ id: pid, quantity })) });

describe("similarProducts", () => {
  it("offers the same kind of thing, in stock, closest first", () => {
    const greenleaf = storesById.greenleaf;
    expect(names(similarProducts(greenleaf, productsById.sourdough))).toEqual([
      "French Baguette",
      "Whole Wheat Sandwich Bread",
    ]);
    expect(names(similarProducts(greenleaf, productsById["oat-milk-barista"]))[0]).toBe("Oat Milk");
    // Strawberries and blueberries first; raspberries' own shelf-mates after.
    expect(names(similarProducts(greenleaf, productsById.raspberries)).slice(0, 2).sort()).toEqual([
      "Organic Blueberries",
      "Strawberries",
    ]);
  });

  it("offers nothing rather than something silly", () => {
    // Limes go with tacos too. That doesn't make them avocados.
    expect(similarProducts(storesById.penny, productsById.avocado)).toEqual([]);
    expect(similarProducts(storesById.penny, productsById.kombucha)).toEqual([]);
  });

  it("never offers something that's also out of stock", () => {
    const penny = storesById.penny; // salmon and shrimp are both out here
    expect(names(similarProducts(penny, productsById.salmon))).not.toContain("Large Raw Shrimp");
  });
});

describe("repeatPurchases", () => {
  // Newest first, the way the app stores them.
  const orders = [
    order("BF-3", { "oat-milk": 3, banana: 6, salsa: 1 }),
    order("BF-2", { "oat-milk": 2, banana: 4 }),
    order("BF-1", { "oat-milk": 2, cookies: 1 }),
  ];

  it("finds what keeps coming back, most frequent first, at the latest quantity", () => {
    expect(repeatPurchases(orders).map((r) => [r.product.name, r.count, r.quantity])).toEqual([
      ["Oat Milk", 3, 3],
      ["Bananas", 2, 6],
    ]);
  });

  it("leaves out what's already a usual and what was declined", () => {
    const result = repeatPurchases(orders, { staples: { "oat-milk": 2 }, dismissed: ["banana"] });
    expect(result).toEqual([]);
  });
});

describe("planTopUp", () => {
  it("prices what it would add without touching anything", () => {
    const cart = { banana: 2 };
    const plan = planTopUp(storesById.greenleaf, { staples: { banana: 6, "eggs-large": 1 }, cart });
    expect(plan.changed).toBe(true);
    expect(plan.cost).toBe(5.15); // 4 × $0.29 + $3.99
    expect(plan.next).toEqual({ banana: 6, "eggs-large": 1 });
    expect(cart).toEqual({ banana: 2 });
  });
});
