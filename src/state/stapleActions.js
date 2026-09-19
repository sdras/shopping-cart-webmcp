import { appStore } from "./app.js";
import { topUpStaples, restoreCart, saveStaples, resolveStapleOffer } from "./appStore.js";
import { toast, askAboutSubstitutes } from "./uiStore.js";
import { plural } from "../lib/format.js";

/**
 * "Add my usuals": the same top-up the agent tool does. Says what happened,
 * offers Undo, and asks about any usual that's out of stock with no rule yet.
 */
export function addAllStaples(shop) {
  const before = appStore.getState().carts[shop.id] ?? {};
  const report = topUpStaples(appStore, shop);

  const added = report.added.reduce((sum, entry) => sum + entry.added, 0);
  const parts = [
    added ? `Added ${plural(added, "item")} from your usuals` : "Your usuals are already in the cart",
    report.substituted.length && `${plural(report.substituted.length, "swap")} made`,
    report.unavailable.length + report.skippedOut.length > 0 &&
      `${report.unavailable.length + report.skippedOut.length} out of stock`,
  ].filter(Boolean);

  toast(parts.join(" · "), {
    action: added ? { label: "Undo", run: () => restoreCart(appStore, shop.id, before) } : undefined,
  });

  askAboutSubstitutes(
    shop.id,
    report.unavailable.map(({ product, usual }) => ({ productId: product.id, usual }))
  );
  return report;
}

/** The post-order prompt: save the chosen items, at the quantity just bought. */
export function saveUsualsFromOrder(order, productIds) {
  const chosen = order.items.filter((item) => productIds.includes(item.id));
  saveStaples(appStore, Object.fromEntries(chosen.map((item) => [item.id, item.quantity])));
  resolveStapleOffer(appStore, order.id, "saved");
  toast(`Saved ${plural(chosen.length, "usual")}. Next time, fill your cart in one tap.`);
}
