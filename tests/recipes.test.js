import { describe, it, expect } from "vitest";
import {
  createAppStore,
  loadSampleHistory,
  selectStore,
  setQuantity,
  applyRecipePlan,
  removeRecipeFromCart,
  notePantry,
} from "../src/state/appStore.js";
import { storesById } from "../src/data/stores.js";
import { productsById } from "../src/data/products.js";
import { recipesById } from "../src/data/recipes.js";
import { planRecipe, pantryVerdict, matchIngredient, parseIngredientLine, buildCustomRecipe } from "../src/lib/recipes.js";
import * as tools from "../src/tools/handlers.js";

const NOW = new Date(2026, 8, 19, 12).getTime();
const DAY = 24 * 60 * 60 * 1000;
const shop = storesById.greenleaf;
const pasta = recipesById["tomato-pasta"];
const tacos = recipesById["beef-tacos"];
const guac = recipesById.guacamole;

// A kitchen with a past: spices two months ago, tomatoes two weeks ago,
// eggs and parmesan last week.
function kitchen() {
  const store = createAppStore();
  loadSampleHistory(store, NOW);
  selectStore(store, shop.id);
  return store;
}
const statuses = (plan) => Object.fromEntries(plan.lines.map((l) => [l.product?.id ?? l.label, l.status]));
const cartOf = (store) => store.getState().carts[shop.id] ?? {};

describe("pantryVerdict", () => {
  const tomato = productsById["tomato-vine"];
  const oregano = productsById.oregano;

  it("never bought → need", () => {
    expect(pantryVerdict(tomato, { now: NOW }).status).toBe("need");
  });

  it("a perishable past its shelf life → expired, and says why", () => {
    const verdict = pantryVerdict(tomato, { lastBought: NOW - 14 * DAY, now: NOW });
    expect(verdict.status).toBe("expired");
    expect(verdict.reason).toBe("last bought 2 weeks ago, keeps about 7 days: assuming it's gone");
  });

  it("a perishable bought recently → ask", () => {
    expect(pantryVerdict(tomato, { lastBought: NOW - 3 * DAY, now: NOW })).toMatchObject({ status: "ask", reason: "bought 3 days ago" });
  });

  it("a cupboard item within its shelf life → have", () => {
    expect(pantryVerdict(oregano, { lastBought: NOW - 62 * DAY, now: NOW })).toMatchObject({
      status: "have",
      reason: "bought 2 months ago, keeps about 2 years",
    });
    expect(pantryVerdict(oregano, { lastBought: NOW - 900 * DAY, now: NOW }).status).toBe("expired");
  });

  it("the shopper's word beats the guess, until they buy it again", () => {
    const out = { have: false, at: NOW - DAY };
    expect(pantryVerdict(oregano, { lastBought: NOW - 62 * DAY, note: out, now: NOW })).toMatchObject({ status: "need", reason: "you said you're out" });
    expect(pantryVerdict(oregano, { lastBought: NOW, note: out, now: NOW }).status).toBe("have");

    const stillGood = { have: true, at: NOW - 2 * DAY };
    expect(pantryVerdict(tomato, { lastBought: NOW - 14 * DAY, note: stillGood, now: NOW }).status).toBe("have");
    // ...but "I have tomatoes" from three weeks ago has gone off too.
    expect(pantryVerdict(tomato, { lastBought: NOW - 40 * DAY, note: { have: true, at: NOW - 21 * DAY }, now: NOW }).status).toBe("expired");
  });
});

describe("planRecipe", () => {
  it("sorts a recipe into add, have, ask, and already in the cart", () => {
    const store = kitchen();
    setQuantity(store, shop.id, "garlic", 1);
    const plan = planRecipe(shop, store.getState(), pasta, { now: NOW });

    expect(statuses(plan)).toEqual({
      spaghetti: "ask", // a box from two months ago: eaten? who knows
      "tomato-vine": "add", // two weeks old, assumed gone
      garlic: "in_cart",
      "olive-oil": "have",
      oregano: "have",
      "chili-flakes": "add", // never bought
      basil: "add",
      parmesan: "ask", // bought 5 days ago
      "sea-salt": "have",
    });
    expect(plan.itemCount).toBe(4);
    expect(plan.questions.map((q) => q.label)).toEqual(["Spaghetti", "Parmesan Wedge"]);
  });

  it("applying is a sync: doing it twice, or changing answers, never doubles", () => {
    const store = kitchen();
    const apply = (options) => applyRecipePlan(store, shop, pasta, planRecipe(shop, store.getState(), pasta, { now: NOW, ...options }));

    apply();
    expect(cartOf(store)).toEqual({ "tomato-vine": 2, "chili-flakes": 1, basil: 1 });
    const first = { ...cartOf(store) };
    apply();
    expect(cartOf(store)).toEqual(first);
    expect(planRecipe(shop, store.getState(), pasta, { now: NOW }).applied).toBe(true);

    // "I'm out of spaghetti, and my tomatoes are actually fine."
    apply({ need: ["spaghetti"], have: ["tomato-vine"] });
    expect(cartOf(store).spaghetti).toBe(1);
    expect(cartOf(store)["tomato-vine"]).toBeUndefined();
  });

  it("shares a bag between recipes but counts things sold one at a time", () => {
    const store = kitchen();
    setQuantity(store, shop.id, "avocado", 3); // from the usuals, say

    applyRecipePlan(store, shop, guac, planRecipe(shop, store.getState(), guac, { now: NOW, need: ["lime"] }));
    expect(cartOf(store).avocado).toBe(3); // the guac uses the three that were there
    expect(cartOf(store).lime).toBe(2);

    const plan = planRecipe(shop, store.getState(), tacos, { now: NOW, need: ["lime", "onion-yellow"] });
    const line = (id) => plan.lines.find((l) => l.product.id === id);
    expect(line("avocado")).toMatchObject({ status: "add", add: 2 }); // the guac has dibs on the first three
    expect(line("lime")).toMatchObject({ status: "add", add: 2 });
    expect(line("cilantro").status).toBe("in_cart"); // one bunch does both

    applyRecipePlan(store, shop, tacos, plan);
    expect(cartOf(store)).toMatchObject({ avocado: 5, lime: 4, cilantro: 1 });
  });

  it("taking a recipe out removes what it added, but not what another recipe shares", () => {
    const store = kitchen();
    applyRecipePlan(store, shop, guac, planRecipe(shop, store.getState(), guac, { now: NOW }));
    applyRecipePlan(store, shop, tacos, planRecipe(shop, store.getState(), tacos, { now: NOW }));
    expect(cartOf(store).cilantro).toBe(1);

    removeRecipeFromCart(store, shop.id, "guacamole");
    expect(cartOf(store).cilantro).toBe(1); // the tacos still want it
    expect(cartOf(store)["tortilla-chips"]).toBeUndefined();
    expect(cartOf(store).avocado).toBe(2); // the tacos' two
    expect(Object.keys(store.getState().cartRecipes[shop.id])).toEqual(["beef-tacos"]);
  });

  it("remembers what the shopper said about their kitchen", () => {
    const store = kitchen();
    notePantry(store, { have: ["parmesan"], need: ["oregano"] }, NOW);
    const plan = planRecipe(shop, store.getState(), pasta, { now: NOW + DAY });
    expect(plan.lines.find((l) => l.product.id === "parmesan")).toMatchObject({ status: "have", reason: "you said you have it (yesterday)" });
    expect(plan.lines.find((l) => l.product.id === "oregano")).toMatchObject({ status: "add", reason: "you said you're out" });
  });

  it("reports what's out of stock with stand-ins", () => {
    const store = kitchen();
    const scramble = recipesById["breakfast-scramble"];
    const harbor = storesById.harbor; // nothing in the scramble is out there
    expect(planRecipe(harbor, store.getState(), scramble, { now: NOW }).lines.some((l) => l.status === "out_of_stock")).toBe(false);
    const penny = storesById.penny; // salmon is out at Penny Pantry
    const plan = planRecipe(penny, store.getState(), recipesById["sheet-pan-salmon"], { now: NOW });
    expect(plan.lines.find((l) => l.product.id === "salmon").status).toBe("out_of_stock");
  });
});

describe("recipes from anywhere", () => {
  it("reads ingredient lines the way recipes write them", () => {
    expect(parseIngredientLine("2 large tomatoes, diced")).toEqual({ name: "large tomatoes", amount: "2", count: 2 });
    expect(parseIngredientLine("- 1.5 cups flour")).toEqual({ name: "flour", amount: "1.5 cups", count: null });
    expect(parseIngredientLine("1 (15 oz) can black beans, drained")).toMatchObject({ name: "black beans", amount: "1 can" });
    expect(parseIngredientLine("juice of 1 lime")).toMatchObject({ name: "lime", count: 1 });
    expect(parseIngredientLine("a pinch of saffron")).toMatchObject({ name: "saffron", amount: "1 pinch" });
    expect(parseIngredientLine("3. ½ cup olive oil")).toMatchObject({ name: "olive oil", amount: "½ cup" });
  });

  it("matches ingredients to the thing a cook means", () => {
    const name = (text) => matchIngredient(text).product?.name;
    expect(name("tomatoes")).toBe("Tomatoes on the Vine");
    expect(name("diced tomatoes")).toBe("Diced Tomatoes");
    expect(name("flour")).toBe("All-Purpose Flour");
    expect(name("fresh basil leaves")).toBe("Fresh Basil");
    expect(name("dried oregano")).toBe("Dried Oregano");
    expect(name("extra virgin olive oil")).toBe("Extra Virgin Olive Oil");
    expect(name("parmigiano")).toBe("Parmesan Wedge");
    expect(name("saffron")).toBeUndefined();
    expect(matchIngredient("tomatoes").alternatives.map((p) => p.name)).toContain("Diced Tomatoes");
  });

  it("buys countable things by the count and everything else by the package", () => {
    const recipe = buildCustomRecipe("Salsa", ["4 ripe tomatoes", "3 limes", "2 cups cilantro", "saffron"]);
    expect(recipe.id).toBe("custom-salsa");
    expect(recipe.ingredients.map((i) => [i.productId, i.quantity])).toEqual([
      ["tomato-vine", 1], // sold by the pound, so one pack
      ["lime", 3],
      ["cilantro", 1],
      [null, 1],
    ]);
  });
});

describe("add_recipe_to_cart", () => {
  function setup() {
    const notices = [];
    const navigated = [];
    const ctx = {
      app: kitchen(),
      now: () => new Date(NOW),
      navigate: (to) => navigated.push(to),
      notify: (message) => notices.push(message),
      openCart: () => {},
    };
    return { ctx, notices, navigated };
  }

  it("adds what's certain, explains its assumptions, and hands back the questions", () => {
    const { ctx, navigated, notices } = setup();
    setQuantity(ctx.app, shop.id, "garlic", 1);
    const output = tools.addRecipeToCart({ recipe: "Simple Tomato Pasta" }, ctx);

    expect(output).toContain("2 × Tomatoes on the Vine (last bought 2 weeks ago, keeps about 7 days: assuming it's gone)");
    expect(output).toContain("1 × Fresh Basil (not in their order history)");
    expect(output).toContain("Already in the cart: Garlic.");
    expect(output).toContain("Dried Oregano (bought 2 months ago, keeps about 2 years)");
    expect(output).toContain("Not added yet, ask if they still have: Spaghetti (bought 2 months ago); Parmesan Wedge (bought 5 days ago).");
    expect(output).toContain("Cart subtotal is now");
    expect(output.length).toBeLessThan(1500);
    expect(ctx.app.getState().carts.greenleaf).toEqual({ garlic: 1, "tomato-vine": 2, "chili-flakes": 1, basil: 1 });
    expect(navigated).toEqual(["/recipes/tomato-pasta"]);
    expect(notices).toEqual(["Added 4 items for Simple Tomato Pasta"]);
  });

  it("takes the shopper's answers on a second call without doubling, and remembers them", () => {
    const { ctx } = setup();
    tools.addRecipeToCart({ recipe: "Simple Tomato Pasta" }, ctx);
    const output = tools.addRecipeToCart(
      { recipe: "Simple Tomato Pasta", already_have: ["the parmesan", "tomatoes"], need: ["spaghetti", "oregano"] },
      ctx
    );
    expect(output).toContain("1 × Spaghetti (they said they're out)");
    expect(output).toContain("1 × Dried Oregano (they said they're out)");
    expect(output).toMatch(/assuming they still have it: .*Tomatoes on the Vine \(they said they have it\)/);
    expect(ctx.app.getState().carts.greenleaf).toEqual({ "chili-flakes": 1, basil: 1, spaghetti: 1, oregano: 1 });
    expect(ctx.app.getState().pantryNotes.parmesan).toEqual({ have: true, at: NOW });
    expect(ctx.app.getState().pantryNotes.oregano).toEqual({ have: false, at: NOW });
  });

  it("preview changes nothing", () => {
    const { ctx, navigated } = setup();
    const output = tools.addRecipeToCart({ recipe: "Weeknight Beef Tacos", preview: true }, ctx);
    expect(output).toContain("(preview, nothing changed)");
    expect(output).toContain("Would add:");
    expect(output.length).toBeLessThan(1500);
    expect(ctx.app.getState().carts.greenleaf).toBeUndefined();
    expect(navigated).toEqual([]);
  });

  it("takes a recipe from anywhere, saves it, and is honest about loose matches", () => {
    const { ctx, navigated } = setup();
    const output = tools.addRecipeToCart(
      {
        recipe_name: "Grandma's salsa",
        ingredients: [{ name: "4 ripe tomatoes, diced" }, { name: "limes", quantity: 3 }, { name: "1 tsp salt" }, { name: "a pinch of saffron" }],
      },
      ctx
    );
    expect(output).toContain("Grandma's salsa at Greenleaf Market:");
    expect(output).toContain("Not sold here: saffron.");
    expect(output).toContain("Left out, assuming they still have it: Sea Salt");
    expect(output).toMatch(/Loose matches: ripe tomatoes → Tomatoes on the Vine \(or Diced Tomatoes\)/);
    expect(output).toContain("Not added yet, ask if they still have: Limes (bought 2 weeks ago)");
    expect(ctx.app.getState().customRecipes[0]).toMatchObject({ id: "custom-grandma-s-salsa", source: "agent" });
    expect(navigated).toEqual(["/recipes/custom-grandma-s-salsa"]);
  });

  it("guides the agent when the recipe is unknown or nothing is given", () => {
    const { ctx } = setup();
    expect(() => tools.addRecipeToCart({ recipe: "Beef Wellington" }, ctx)).toThrow(/Basketful's recipes: Simple Tomato Pasta.*pass its ingredients/);
    expect(() => tools.addRecipeToCart({}, ctx)).toThrow(/Provide "recipe"/);
    expect(tools.addRecipeToCart({ recipe: "Simple Tomato Pasta", already_have: ["anchovies"] }, ctx)).toContain('"anchovies" is not an ingredient of Simple Tomato Pasta.');
  });

  it("get_cart says which recipes the cart is shopping for", () => {
    const { ctx } = setup();
    tools.addRecipeToCart({ recipe: "Guacamole & Chips" }, ctx);
    expect(tools.getCart({}, ctx)).toContain("Shopping for these recipes: Guacamole & Chips.");
  });
});
