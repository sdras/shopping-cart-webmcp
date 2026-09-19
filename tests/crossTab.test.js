import { describe, it, expect, afterEach } from "vitest";
import { createAppStore, setQuantity, selectStore } from "../src/state/appStore.js";

// A browser's localStorage as two tabs see it: each tab reads its own copy,
// which only catches up with another tab's writes as the `storage` events
// arrive, later and in order. Every setItem goes through, even one that
// repeats what that tab already sees (reproduced in Chrome 152), so a tab
// that writes a change straight back is replaying an old snapshot over the
// other tab's newer ones.
function twoTabs() {
  const pending = [];
  const tabs = [0, 1].map(() => ({ window: new EventTarget(), view: new Map() }));

  tabs.forEach((tab, index) => {
    tab.storage = {
      getItem: (key) => tab.view.get(key) ?? null,
      setItem(key, value) {
        tab.view.set(key, value);
        const other = tabs[1 - index];
        pending.push(() => {
          other.view.set(key, value);
          other.window.dispatchEvent(Object.assign(new Event("storage"), { key, newValue: value }));
        });
      },
    };
    globalThis.window = tab.window; // createAppStore binds to the current window
    tab.store = createAppStore({ storage: tab.storage });
  });

  // Echoing tabs would ping-pong forever; a healthy pair goes quiet fast.
  const deliver = () => {
    let budget = 200;
    while (pending.length && budget-- > 0) pending.shift()();
    expect(pending.length, "tabs kept writing back and forth").toBe(0);
  };
  return { a: tabs[0], b: tabs[1], deliver };
}

afterEach(() => {
  delete globalThis.window;
});

describe("two tabs sharing a cart", () => {
  it("a burst of writes in one tab lands intact in the other, with no echo rolling it back", () => {
    const { a, b, deliver } = twoTabs();
    selectStore(a.store, "greenleaf");
    for (const id of ["banana", "avocado", "spinach", "oat-milk", "coffee-beans"]) {
      setQuantity(a.store, "greenleaf", id, 2);
    }
    const expected = { banana: 2, avocado: 2, spinach: 2, "oat-milk": 2, "coffee-beans": 2 };

    deliver();
    expect(b.store.getState().carts.greenleaf).toEqual(expected);
    expect(a.store.getState().carts.greenleaf).toEqual(expected);
    expect(JSON.parse(a.storage.getItem("basketful:v1")).carts.greenleaf).toEqual(expected);
  });

  it("changes made in each tab in turn both survive", () => {
    const { a, b, deliver } = twoTabs();
    setQuantity(a.store, "greenleaf", "banana", 6);
    deliver();
    setQuantity(b.store, "greenleaf", "croissants", 1);
    deliver();
    expect(a.store.getState().carts.greenleaf).toEqual({ banana: 6, croissants: 1 });
    expect(b.store.getState().carts.greenleaf).toEqual({ banana: 6, croissants: 1 });
  });
});
