import { useMemo } from "react";
import { createAppStore } from "./appStore.js";
import { useStore } from "./createStore.js";
import { storesById } from "../data/stores.js";
import { cartTotals, DEFAULT_TIP } from "../lib/pricing.js";

export const appStore = createAppStore({
  storage: typeof window === "undefined" ? undefined : window.localStorage,
});

// The store is a singleton wired to window and localStorage. Hot-swapping it
// would leave the old copy alive inside memoized hooks, saving stale state over
// the new one's, so an edit anywhere under this module reloads the page instead.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}

export const useApp = (selector) => useStore(appStore, selector);

/** The store the shopper last opened, or null on a first visit. */
export function useOpenStore() {
  const storeId = useApp((s) => s.storeId);
  return storesById[storeId] ?? null;
}

const EMPTY_CART = {};

export function useCart(storeId) {
  return useApp((s) => s.carts[storeId]) ?? EMPTY_CART;
}

export function useCartTotals(shop, { windowFee = 0 } = {}) {
  const cart = useCart(shop?.id);
  const tip = useApp((s) => s.checkout.tip) ?? DEFAULT_TIP;
  return useMemo(
    () => (shop ? cartTotals(shop, cart, { tip, windowFee }) : null),
    [shop, cart, tip, windowFee]
  );
}
