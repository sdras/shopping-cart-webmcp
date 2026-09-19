import { describe, it, expect, afterEach } from "vitest";
import { createAppStore, addItem, selectStore } from "../src/state/appStore.js";
import { storesById } from "../src/data/stores.js";
import { getDeliveryWindows } from "../src/lib/deliveryWindows.js";
import * as definitions from "../src/tools/definitions.js";
import * as handlers from "../src/tools/handlers.js";
import { registerLocalTool, localTools } from "../src/tools/registry.js";
import { toolDefinitions, functionDeclarations, geminiSchema, runTool, canUndo, applyUndo } from "../src/assistant/tools.js";
import { systemInstruction } from "../src/assistant/geminiLive.js";
import { TurnTracker, briefDescription, stripControl } from "../src/assistant/geminiText.js";
import { createVoiceMeter } from "../src/assistant/voiceLevel.js";

const NOW = new Date(2026, 8, 15, 14, 30);

// The page registers tools through useTool; here the same pairs go in by hand.
const registered = [];
function setup() {
  const app = createAppStore();
  const ctx = { app, now: () => NOW, navigate() {}, notify() {}, openCart() {} };
  const mount = (definition, handler) =>
    registered.push(registerLocalTool(definition, (input) => handler(input, ctx)));
  mount(definitions.chooseStore, handlers.chooseStore);
  mount(definitions.addToCart, handlers.addToCart);
  mount(definitions.getCart, handlers.getCart);
  return { app, ctx, mount };
}

afterEach(() => {
  registered.splice(0).forEach((unregister) => unregister());
});

describe("the tools the assistant declares", () => {
  it("are whatever is live on the page, plus the checkout tools that come and go", () => {
    setup();
    const names = toolDefinitions().map((d) => d.name);
    expect(names).toEqual([
      "choose_store", "add_to_cart", "get_cart",
      "set_delivery_address", "set_delivery_options", "place_order",
    ]);
  });

  it("prefers the live checkout tool, with its real delivery windows, over the stand-in", () => {
    const { mount } = setup();
    const live = definitions.setDeliveryOptions(["Today, 4pm - 5pm"]);
    mount(live, handlers.setDeliveryOptions);
    const declared = toolDefinitions().filter((d) => d.name === "set_delivery_options");
    expect(declared).toEqual([live]);
  });

  it("drops the delivery window enum from the stand-in, since a session outlasts the clock", () => {
    setup();
    const options = functionDeclarations().find((d) => d.name === "set_delivery_options");
    expect(options.parameters.properties.delivery_window.enum).toBeUndefined();
    expect(options.parameters.properties.replacements.enum).toEqual(["Best match", "Contact me", "Refund item"]);
  });

  it("forgets a tool once it is unregistered", () => {
    const unregister = registerLocalTool({ name: "here_briefly" }, () => "ok");
    expect(localTools().map((t) => t.definition.name)).toContain("here_briefly");
    unregister();
    expect(localTools().map((t) => t.definition.name)).not.toContain("here_briefly");
  });

  it("keeps a newer registration when an older one under the same name lets go", () => {
    const first = registerLocalTool({ name: "twice" }, () => "first");
    const second = registerLocalTool({ name: "twice" }, () => "second");
    first();
    expect(localTools().filter((t) => t.definition.name === "twice")).toHaveLength(1);
    second();
  });
});

describe("function declarations for Gemini", () => {
  it("spells types Gemini's way and keeps only the schema keys it accepts", () => {
    const schema = geminiSchema({
      type: "object",
      additionalProperties: false,
      properties: { items: { type: "array", minItems: 1, items: { type: "string", examples: ["x"] } } },
      required: ["items"],
    });
    expect(schema).toEqual({
      type: "OBJECT",
      properties: { items: { type: "ARRAY", minItems: 1, items: { type: "STRING" } } },
      required: ["items"],
    });
  });

  it("declares no parameters for a tool that takes none", () => {
    const [cart] = functionDeclarations([definitions.getCart]);
    expect(cart).toEqual({ name: "get_cart", description: definitions.getCart.description });
  });
});

describe("running a tool", () => {
  it("returns what the handler said, and how to take it back", async () => {
    const { app } = setup();
    await runTool("choose_store", { store: "Greenleaf Market" }, app);
    const result = await runTool("add_to_cart", { items: [{ product: "Corn Tortillas", quantity: 2 }] }, app);
    expect(result.error).toBe(false);
    expect(result.text).toContain("2 × Corn Tortillas");
    expect(canUndo(result.undo, app)).toBe(true);

    expect(applyUndo(result.undo, app)).toBe(true);
    expect(app.getState().carts.greenleaf ?? {}).toEqual({});
    expect(canUndo(result.undo, app)).toBe(false);
  });

  it("offers no undo for a read, or for only opening a store", async () => {
    const { app } = setup();
    const opened = await runTool("choose_store", { store: "Greenleaf Market" }, app);
    const read = await runTool("get_cart", {}, app);
    expect(opened.undo).toBeNull();
    expect(read.undo).toBeNull();
  });

  it("withdraws the undo once anything else has changed", async () => {
    const { app } = setup();
    await runTool("choose_store", { store: "Greenleaf Market" }, app);
    const result = await runTool("add_to_cart", { items: [{ product: "Corn Tortillas" }] }, app);
    addItem(app, "greenleaf", "banana", 1);
    expect(canUndo(result.undo, app)).toBe(false);
    expect(applyUndo(result.undo, app)).toBe(false);
    expect(app.getState().carts.greenleaf.banana).toBe(1);
  });

  it("undoes the shopping, not which store is open", async () => {
    const { app } = setup();
    await runTool("choose_store", { store: "Greenleaf Market" }, app);
    const result = await runTool("add_to_cart", { items: [{ product: "Corn Tortillas" }] }, app);
    // The same state object with another store open would not pass canUndo, so rebuild the moment by hand.
    const undo = { before: { ...result.undo.before, storeId: "penny" }, after: app.getState() };
    applyUndo(undo, app);
    expect(app.getState().storeId).toBe("greenleaf");
  });

  it("never offers to take back an order", async () => {
    const { app, mount, ctx } = setup();
    mount(definitions.placeOrderTool, handlers.placeOrder);
    selectStore(app, "greenleaf");
    addItem(app, "greenleaf", "ground-beef", 3);
    handlers.setDeliveryAddress({ street: "742 Evergreen Terrace", city: "Springfield", zip: "97403" }, ctx);
    const windows = getDeliveryWindows(storesById.greenleaf, NOW);
    handlers.setDeliveryOptions({ delivery_window: windows[0].label }, ctx);

    const result = await runTool("place_order", {}, app);
    expect(result.error).toBe(false);
    expect(app.getState().orders).toHaveLength(1);
    expect(result.undo).toBeNull();
  });

  it("turns a handler's error into a result the model can act on", async () => {
    const { app } = setup();
    const result = await runTool("add_to_cart", { items: [{ product: "Corn Tortillas" }] }, app);
    expect(result).toEqual({ error: true, undo: null, text: expect.stringContaining("Call choose_store first") });
  });

  it("says how to reach a checkout tool that isn't live, and owns up to a name it never had", async () => {
    const { app } = setup();
    expect((await runTool("place_order", {}, app)).text).toContain("Call start_checkout first");
    expect((await runTool("teleport_groceries", {}, app)).text).toBe('No tool called "teleport_groceries".');
  });
});

describe("what the session is told up front", () => {
  it("names the stores and says none is open", () => {
    const text = systemInstruction(createAppStore().getState(), NOW);
    expect(text).toContain("Greenleaf Market");
    expect(text).toContain("Penny Pantry");
    expect(text).toContain("No store is open yet");
    expect(text).toContain("They have no staples saved yet.");
  });

  it("says which store is open and what is in its cart", () => {
    const app = createAppStore();
    selectStore(app, "harbor");
    addItem(app, "harbor", "banana", 3);
    expect(systemInstruction(app.getState(), NOW)).toContain("Harbor Foods Co-op is open, with 3 items in its cart.");
  });
});

describe("stripControl", () => {
  it("removes tokenizer control tokens and leaves the words", () => {
    expect(stripControl("<ctrl46><ctrl46>Sure, <ctrl100>done.")).toBe("Sure, done.");
    expect(stripControl("nothing here")).toBe("nothing here");
  });
});

describe("TurnTracker", () => {
  const collapse = (t) => {
    expect(t.note("<ctrl46><ctrl46><ctrl46>")).toBe("");
    return t.complete();
  };

  it("calls a turn of only control tokens a collapse and asks for one retry", () => {
    const t = new TurnTracker();
    expect(collapse(t)).toBe("retry");
    expect(collapse(t)).toBe("give-up");
  });

  it("does not retry a turn that said something or ran a tool", () => {
    const t = new TurnTracker();
    expect(t.note("<ctrl46>Adding it now.")).toBe("Adding it now.");
    expect(t.complete()).toBe("fine");
    t.note("<ctrl46><ctrl46>");
    t.toolCalled();
    expect(t.complete()).toBe("fine");
  });

  it("treats a silent turn as empty, not as a collapse", () => {
    expect(new TurnTracker().complete()).toBe("empty");
  });

  it("allows another retry once a real answer has come through", () => {
    const t = new TurnTracker();
    expect(collapse(t)).toBe("retry");
    t.note("Here you go.");
    expect(t.complete()).toBe("fine");
    expect(collapse(t)).toBe("retry");
  });

  it("forgets an interrupted turn without counting it", () => {
    const t = new TurnTracker();
    t.note("<ctrl46>");
    t.reset();
    expect(t.complete()).toBe("empty");
  });
});

describe("briefDescription", () => {
  it("keeps short text and cuts long text at a sentence", () => {
    expect(briefDescription("Short.")).toBe("Short.");
    const long = `${"A".repeat(300)}. ${"B".repeat(150)}. ${"C".repeat(200)}`;
    expect(briefDescription(long)).toBe(`${"A".repeat(300)}. ${"B".repeat(150)}.`);
  });

  it("falls back to a hard cut when no sentence ends in the budget", () => {
    expect(briefDescription("A".repeat(600))).toBe(`${"A".repeat(500)}…`);
  });
});

describe("voice meter", () => {
  const FRAME = 1 / 60;
  const db = (d) => Math.pow(10, d / 20);
  const run = (readings) => {
    const meter = createVoiceMeter();
    return readings.map((r) => meter.sample(r, FRAME));
  };

  it("stays still on room noise", () => {
    expect(Math.max(...run(Array(120).fill(db(-55))))).toBe(0);
  });

  it("jumps on a word after silence", () => {
    const levels = run([...Array(60).fill(db(-55)), ...Array(6).fill(db(-25))]);
    expect(levels[65]).toBeGreaterThan(0.8);
  });

  it("returns to zero when the talking stops", () => {
    const levels = run([...Array(60).fill(db(-22)), ...Array(60).fill(db(-58))]);
    expect(levels[119]).toBe(0);
  });

  it("never leaves 0–1, even on silence or clipping", () => {
    for (const level of run([0, 0, 1, 1, 0.5, 0, 1e-9, 1])) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });
});
