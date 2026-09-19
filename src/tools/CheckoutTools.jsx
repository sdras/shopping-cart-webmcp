import { useMemo } from "react";
import { useMatch } from "react-router-dom";
import { useTool, useToolContext } from "./useTool.js";
import * as definitions from "./definitions.js";
import * as handlers from "./handlers.js";
import { storesById } from "../data/stores.js";
import { getDeliveryWindows } from "../lib/deliveryWindows.js";
import { useNow } from "../lib/useNow.js";
import { useCartTotals } from "../state/app.js";

/**
 * Tools that are only registered while the checkout page is showing a cart
 * that can be ordered, so agents can't place an order from anywhere else.
 *
 * This lives at the app root rather than inside the checkout page on purpose:
 * place_order empties the cart and navigates away, and a tool that unmounts
 * in the middle of its own call never gets to report back.
 */
export default function CheckoutTools() {
  const ctx = useToolContext();
  const match = useMatch("/store/:storeId/checkout");
  const shop = storesById[match?.params.storeId] ?? null;
  const totals = useCartTotals(shop);
  const enabled = Boolean(shop && totals.lines.length > 0 && totals.belowMinimumBy === 0);

  const now = useNow(60_000);
  const labels = shop ? getDeliveryWindows(shop, now).map((w) => w.label).join("|") : "";
  const optionsTool = useMemo(() => definitions.setDeliveryOptions(labels.split("|")), [labels]);

  useTool(optionsTool, handlers.setDeliveryOptions, ctx, { enabled });
  useTool(definitions.placeOrderTool, handlers.placeOrder, ctx, { enabled });
  return null;
}
