import { describe, it, expect, beforeEach } from "vitest";
import { createAppStore } from "../src/state/appStore.js";
import * as tools from "../src/tools/handlers.js";

// A Tuesday afternoon: priority delivery and several same-day windows exist.
const NOW = new Date(2026, 8, 15, 14, 30);

function setup() {
  const navigated = [];
  const notices = [];
  const ctx = {
    app: createAppStore(),
    now: () => NOW,
    navigate: (to) => navigated.push(to),
    notify: (message) => notices.push(message),
    openCart: () => notices.push("cart opened"),
  };
  return { ctx, navigated, notices };
}

function fillCart(ctx) {
  tools.chooseStore({ store: "Greenleaf Market" }, ctx);
  tools.addToCart(
    { items: [{ product: "Corn Tortillas", quantity: 2 }, { product: "Ground Beef 85% Lean" }, { product: "Medium Salsa" }] },
    ctx
  );
}

const ADDRESS = { street: "742 Evergreen Terrace", city: "Springfield", zip: "97403" };

describe("choose_store", () => {
  it("opens the store and navigates to it", () => {
    const { ctx, navigated } = setup();
    const output = tools.chooseStore({ store: "Penny Pantry" }, ctx);
    expect(ctx.app.getState().storeId).toBe("penny");
    expect(navigated).toEqual(["/store/penny"]);
    expect(output).toContain("Opened Penny Pantry");
    expect(output).toContain("Order minimum $10.00");
  });

  it("lists the real stores when the name is wrong", () => {
    const { ctx } = setup();
    expect(() => tools.chooseStore({ store: "Whole Paycheck" }, ctx)).toThrow(/Greenleaf Market, Harbor Foods Co-op, Penny Pantry/);
  });
});

describe("search_products", () => {
  it("points the agent at choose_store when no store is open", () => {
    const { ctx } = setup();
    expect(() => tools.searchProducts({ query: "milk" }, ctx)).toThrow(/choose_store/);
  });

  it("returns exact names, prices, and stock, and mirrors the search in the URL", () => {
    const { ctx, navigated } = setup();
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    const output = tools.searchProducts({ query: "tortillas", dietary: ["gluten-free"] }, ctx);
    expect(output).toContain("- Corn Tortillas — $2.79 (30 ct) — in stock");
    expect(output).not.toContain("Flour Tortillas");
    expect(navigated.at(-1)).toBe("/store/greenleaf?q=tortillas&diet=gluten-free");
  });

  it("finds products by what they're for, not just their name", () => {
    const { ctx } = setup();
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    expect(tools.searchProducts({ query: "soda" }, ctx)).toContain("Cola");
  });

  it("flags out-of-stock items and applies the store's prices", () => {
    const { ctx } = setup();
    tools.chooseStore({ store: "Penny Pantry" }, ctx);
    const output = tools.searchProducts({ query: "avocado" }, ctx);
    expect(output).toContain("Hass Avocados — $1.54 (each) — OUT OF STOCK");
  });

  it("stays within the 1.5K output budget for a whole department", () => {
    const { ctx } = setup();
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    const output = tools.searchProducts({ department: "Produce" }, ctx);
    expect(output).toContain("Showing 8 of 27 results");
    expect(output.length).toBeLessThan(1500);
  });

  it("suggests what to try when nothing matches", () => {
    const { ctx } = setup();
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    expect(tools.searchProducts({ query: "dragonfruit" }, ctx)).toMatch(/No products found.*simpler/);
  });

  it("rejects an unknown department with the valid ones", () => {
    const { ctx } = setup();
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    expect(() => tools.searchProducts({ department: "Electronics" }, ctx)).toThrow(/Produce, Dairy & Eggs/);
  });
});

describe("add_to_cart", () => {
  it("adds a whole list and reports the subtotal", () => {
    const { ctx, notices } = setup();
    fillCart(ctx);
    expect(ctx.app.getState().carts.greenleaf).toEqual({ "tortillas-corn": 2, "ground-beef": 1, salsa: 1 });
    expect(notices).toContain("Added 3 products to your cart");
  });

  it("reports partial success: ambiguous, missing, and out-of-stock items", () => {
    const { ctx } = setup();
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    const output = tools.addToCart(
      { items: [{ product: "Limes", quantity: 3 }, { product: "milk" }, { product: "unicorn steaks" }, { product: "Sourdough Loaf" }] },
      ctx
    );
    expect(output).toContain("3 × Limes (now 3 in cart)");
    expect(output).toMatch(/"milk" matches several products: .*"Whole Milk"/);
    expect(output).toContain('"unicorn steaks" was not found');
    expect(output).toContain("Sourdough Loaf is out of stock at Greenleaf Market");
    expect(output).toContain("Cart subtotal is now $1.50 for 3 items");
  });

  it("is an error when nothing could be added", () => {
    const { ctx } = setup();
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    expect(() => tools.addToCart({ items: [{ product: "unicorn steaks" }] }, ctx)).toThrow(/Nothing was added/);
  });

  it("validates quantities in code", () => {
    const { ctx } = setup();
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    expect(() => tools.addToCart({ items: [{ product: "Limes", quantity: 2.5 }] }, ctx)).toThrow(/whole number from 1 to 24/);
    expect(() => tools.addToCart({}, ctx)).toThrow(/Provide "items"/);
  });
});

describe("update_cart_item", () => {
  it("sets an exact quantity and removes at zero", () => {
    const { ctx } = setup();
    fillCart(ctx);
    expect(tools.updateCartItem({ product: "Corn Tortillas", quantity: 1 }, ctx)).toContain("quantity is now 1");
    expect(tools.updateCartItem({ product: "Medium Salsa", quantity: 0 }, ctx)).toContain("Removed Medium Salsa");
    expect(ctx.app.getState().carts.greenleaf).toEqual({ "tortillas-corn": 1, "ground-beef": 1 });
  });

  it("accepts a loose name when only one match is in the cart", () => {
    const { ctx } = setup();
    fillCart(ctx);
    tools.updateCartItem({ product: "tortillas", quantity: 4 }, ctx);
    expect(ctx.app.getState().carts.greenleaf["tortillas-corn"]).toBe(4);
  });

  it("explains when the product isn't in the cart", () => {
    const { ctx } = setup();
    fillCart(ctx);
    expect(() => tools.updateCartItem({ product: "Bananas", quantity: 2 }, ctx)).toThrow(/not in the Greenleaf Market cart/);
  });
});

describe("get_cart", () => {
  it("itemizes the cart with fees and the minimum", () => {
    const { ctx, notices } = setup();
    fillCart(ctx);
    const output = tools.getCart({}, ctx);
    expect(output).toContain("- 2 × Corn Tortillas (30 ct) — $5.58");
    expect(output).toContain("Subtotal $15.86");
    expect(output).toContain("Order minimum $10.00: met.");
    expect(output).toContain("Add $19.14 more for free delivery.");
    expect(notices).toContain("cart opened");
  });

  it("handles an empty cart", () => {
    const { ctx } = setup();
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    expect(tools.getCart({}, ctx)).toMatch(/cart is empty/);
  });
});

describe("staples", () => {
  const LIST = [
    { product: "Organic Bananas", quantity: 6 },
    { product: "Large Eggs" },
    { product: "Oat Milk", quantity: 2 },
    { product: "Sourdough Loaf" },
  ];

  it("saves a whole list in one call and reads it back without a store", () => {
    const { ctx } = setup();
    const output = tools.updateStaples({ items: LIST }, ctx);
    expect(ctx.app.getState().staples).toEqual({ "banana-organic": 6, "eggs-large": 1, "oat-milk": 2, sourdough: 1 });
    expect(output).toContain("Saved as staples: 6 × Organic Bananas, 1 × Large Eggs, 2 × Oat Milk, 1 × Sourdough Loaf.");
    expect(output).toContain("now has 4 products");
    expect(tools.getStaples({}, ctx)).toMatch(/4 staples saved \(open a store/);
  });

  it("reports ambiguous and unknown names, changes quantities, and removes at zero", () => {
    const { ctx } = setup();
    tools.updateStaples({ items: LIST }, ctx);
    const output = tools.updateStaples(
      { items: [{ product: "milk" }, { product: "moon cheese" }, { product: "Large Eggs", quantity: 2 }, { product: "Oat Milk", quantity: 0 }] },
      ctx
    );
    expect(output).toContain("Saved as staples: 2 × Large Eggs.");
    expect(output).toContain("Removed from staples: Oat Milk.");
    expect(output).toMatch(/"milk" matches several products/);
    expect(output).toContain('"moon cheese" was not found');
    expect(ctx.app.getState().staples).toEqual({ "banana-organic": 6, "eggs-large": 2, sourdough: 1 });
    expect(() => tools.updateStaples({ items: [{ product: "moon cheese" }] }, ctx)).toThrow(/Nothing was saved/);
  });

  it("replace_list makes the given items the whole list", () => {
    const { ctx } = setup();
    tools.updateStaples({ items: LIST }, ctx);
    tools.updateStaples({ items: [{ product: "Bananas", quantity: 4 }], replace_list: true }, ctx);
    expect(ctx.app.getState().staples).toEqual({ banana: 4 });
  });

  it("tops the cart up to the usual quantity and is safe to call twice", () => {
    const { ctx } = setup();
    tools.updateStaples({ items: LIST }, ctx);
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    tools.addToCart({ items: [{ product: "Organic Bananas", quantity: 2 }, { product: "Oat Milk", quantity: 3 }] }, ctx);

    const first = tools.addStaplesToCart({}, ctx);
    expect(first).toContain("Added to the Greenleaf Market cart: 4 × Organic Bananas, 1 × Large Eggs.");
    expect(first).toContain("Already in the cart: Oat Milk.");
    expect(first).toContain("Out of stock with no saved rule: Sourdough Loaf (usually 1). Closest in stock: French Baguette $2.99, Whole Wheat Sandwich Bread $3.79.");
    expect(first).toMatch(/Ask the shopper whether to swap.*update_staples with if_out_of_stock/);
    expect(ctx.app.getState().carts.greenleaf).toEqual({ "banana-organic": 6, "oat-milk": 3, "eggs-large": 1 });

    const second = tools.addStaplesToCart({}, ctx);
    expect(second).toContain("Nothing needed adding.");
    expect(ctx.app.getState().carts.greenleaf).toEqual({ "banana-organic": 6, "oat-milk": 3, "eggs-large": 1 });
  });

  it("saves out-of-stock rules and follows them on the next top-up", () => {
    const { ctx } = setup();
    const saved = tools.updateStaples(
      {
        items: [
          { product: "Sourdough Loaf", if_out_of_stock: "French Baguette" },
          { product: "Raspberries", quantity: 2, if_out_of_stock: "skip" },
          { product: "Barista Oat Milk", if_out_of_stock: "milk" },
          { product: "Large Eggs" },
        ],
      },
      ctx
    );
    expect(saved).toContain("1 × Sourdough Loaf (if out: French Baguette), 2 × Raspberries (if out: skip), 1 × Barista Oat Milk, 1 × Large Eggs");
    expect(saved).toMatch(/swap "milk" for Barista Oat Milk matches several products/);
    expect(ctx.app.getState().substitutions).toEqual({
      sourdough: { type: "swap", with: "baguette" },
      raspberries: { type: "skip" },
    });

    // All three are out of stock at Greenleaf.
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    const output = tools.addStaplesToCart({}, ctx);
    expect(output).toContain("swapped by the shopper's saved rule: French Baguette for Sourdough Loaf.");
    expect(output).toContain("left out by the shopper's saved rule: Raspberries.");
    expect(output).toContain("Out of stock with no saved rule: Barista Oat Milk (usually 1). Closest in stock: Oat Milk");
    expect(ctx.app.getState().carts.greenleaf).toEqual({ baguette: 1, "eggs-large": 1 });
    expect(tools.getStaples({}, ctx)).toContain("OUT OF STOCK — if out: French Baguette");

    // "ask" clears a rule; removing a staple drops its rule with it.
    tools.updateStaples({ items: [{ product: "Sourdough Loaf", if_out_of_stock: "ask" }, { product: "Raspberries", quantity: 0 }] }, ctx);
    expect(ctx.app.getState().substitutions).toEqual({});
  });

  it("a substitute that is also a staple gets both quantities", () => {
    const { ctx } = setup();
    // Avocados are out at Penny Pantry. (Nobody should do this. It proves the math.)
    tools.updateStaples({ items: [{ product: "Hass Avocados", quantity: 3, if_out_of_stock: "Limes" }, { product: "Limes", quantity: 2 }] }, ctx);
    tools.chooseStore({ store: "Penny Pantry" }, ctx);
    tools.addStaplesToCart({}, ctx);
    expect(ctx.app.getState().carts.penny).toEqual({ lime: 5 });
    tools.addStaplesToCart({}, ctx);
    expect(ctx.app.getState().carts.penny).toEqual({ lime: 5 });
  });

  it("only suggests stand-ins that are the same kind of thing", () => {
    const { ctx } = setup();
    tools.updateStaples({ items: [{ product: "Hass Avocados" }] }, ctx);
    tools.chooseStore({ store: "Penny Pantry" }, ctx);
    expect(tools.addStaplesToCart({}, ctx)).toContain("Hass Avocados (usually 1). Nothing similar is in stock.");
  });

  it("can skip staples by a loose name", () => {
    const { ctx } = setup();
    tools.updateStaples({ items: LIST }, ctx);
    tools.chooseStore({ store: "Harbor Foods Co-op" }, ctx);
    const output = tools.addStaplesToCart({ skip: ["eggs"] }, ctx);
    expect(output).toContain("Skipped this time: Large Eggs.");
    expect(ctx.app.getState().carts.harbor).toEqual({ "banana-organic": 6, "oat-milk": 2, sourdough: 1 });
    expect(() => tools.addStaplesToCart({ skip: ["bacon"] }, ctx)).toThrow(/not on the staples list/);
  });

  it("shows price, stock, and cart state per staple once a store is open", () => {
    const { ctx } = setup();
    tools.updateStaples({ items: LIST }, ctx);
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    tools.addStaplesToCart({}, ctx);
    const output = tools.getStaples({}, ctx);
    expect(output).toContain("- 6 × Organic Bananas (each) — $0.39 each — in stock — 6 in cart");
    expect(output).toContain("- 1 × Sourdough Loaf (24 oz) — $5.99 each — OUT OF STOCK");
  });

  it("guides the agent when there are no staples or no store", () => {
    const { ctx } = setup();
    expect(tools.getStaples({}, ctx)).toMatch(/No staples are saved yet/);
    expect(() => tools.addStaplesToCart({}, ctx)).toThrow(/choose_store/);
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    expect(() => tools.addStaplesToCart({}, ctx)).toThrow(/update_staples/);
  });
});

describe("checkout journey", () => {
  it("won't start with an empty cart or below the minimum", () => {
    const { ctx } = setup();
    tools.chooseStore({ store: "Greenleaf Market" }, ctx);
    expect(() => tools.startCheckout({}, ctx)).toThrow(/cart is empty/);
    tools.addToCart({ items: [{ product: "Limes" }] }, ctx);
    expect(() => tools.startCheckout({}, ctx)).toThrow(/Add \$9\.50 more/);
  });

  it("start_checkout lists windows and what's still needed", () => {
    const { ctx, navigated } = setup();
    fillCart(ctx);
    const output = tools.startCheckout({}, ctx);
    expect(navigated.at(-1)).toBe("/store/greenleaf/checkout");
    expect(output).toContain("Priority (within 45 min) (+$2.00)");
    expect(output).toContain("Today 4pm–6pm");
    expect(output).toContain("Still needed before place_order: a delivery address (set_delivery_address) and a delivery window (set_delivery_options).");
  });

  it("place_order refuses until address and window are set", () => {
    const { ctx } = setup();
    fillCart(ctx);
    expect(() => tools.placeOrder({}, ctx)).toThrow(/Still needed: a delivery address/);
    tools.setDeliveryAddress(ADDRESS, ctx);
    expect(() => tools.placeOrder({}, ctx)).toThrow(/Still needed: a delivery window/);
  });

  it("validates the address", () => {
    const { ctx } = setup();
    expect(() => tools.setDeliveryAddress({ street: "1 Main St" }, ctx)).toThrow(/missing: city, zip/);
    expect(() => tools.setDeliveryAddress({ ...ADDRESS, zip: "9740" }, ctx)).toThrow(/not a valid ZIP/);
  });

  it("set_delivery_options takes the tip the way people say it", () => {
    const { ctx } = setup();
    fillCart(ctx);
    const output = tools.setDeliveryOptions({ delivery_window: "today 4pm-6pm", tip: "15%", replacements: "Contact me" }, ctx);
    expect(ctx.app.getState().checkout).toEqual({ windowId: "Today 4pm–6pm", tip: 2.38, replacements: "Contact me" });
    expect(output).toContain("Tip: $2.38.");
    expect(() => tools.setDeliveryOptions({ tip: "a lot" }, ctx)).toThrow(/"\$5", "15%", or "none"/);
    expect(() => tools.setDeliveryOptions({ delivery_window: "Today 3am–5am" }, ctx)).toThrow(/Choose one of: Priority/);
    expect(() => tools.setDeliveryOptions({}, ctx)).toThrow(/at least one/);
  });

  it("places the order, empties the cart, and can report its status", () => {
    const { ctx, navigated } = setup();
    fillCart(ctx);
    tools.setDeliveryAddress(ADDRESS, ctx);
    tools.setDeliveryOptions({ delivery_window: "Priority (within 45 min)", tip: "$5" }, ctx);
    const output = tools.placeOrder({}, ctx);

    // 15.86 subtotal + 3.99 delivery + 2.00 priority + 2.00 service + 5.00 tip
    expect(output).toContain("Order BF-1001 is placed with Greenleaf Market: 4 items, total $28.85.");
    expect(navigated.at(-1)).toBe("/orders/BF-1001");
    expect(ctx.app.getState().carts.greenleaf).toEqual({});

    expect(tools.getOrderStatus({}, ctx)).toContain("Order BF-1001 from Greenleaf Market: Order placed.");
    ctx.now = () => new Date(NOW.getTime() + 60_000);
    expect(tools.getOrderStatus({ order_number: "1001" }, ctx)).toContain("Out for delivery");
    expect(() => tools.getOrderStatus({ order_number: "BF-9" }, ctx)).toThrow(/Recent orders: BF-1001/);
  });

  it("after an order, nudges the agent toward saving repeat purchases as staples", () => {
    const { ctx } = setup();
    const order = () => {
      fillCart(ctx);
      tools.setDeliveryAddress(ADDRESS, ctx);
      tools.setDeliveryOptions({ delivery_window: "Priority (within 45 min)" }, ctx);
      return tools.placeOrder({}, ctx);
    };
    expect(order()).toContain("The shopper has no staples saved.");
    expect(order()).toContain("The shopper keeps buying Corn Tortillas, Ground Beef 85% Lean, Medium Salsa but has not saved them as staples.");

    tools.updateStaples({ items: [{ product: "Corn Tortillas" }, { product: "Ground Beef 85% Lean" }, { product: "Medium Salsa" }] }, ctx);
    expect(order()).not.toMatch(/staples/);
  });

  it("get_order_status is calm when there are no orders", () => {
    const { ctx } = setup();
    expect(tools.getOrderStatus({}, ctx)).toMatch(/no orders yet/);
  });
});
