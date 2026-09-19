import { useTool, useToolContext } from "./useTool.js";
import * as definitions from "./definitions.js";
import * as handlers from "./handlers.js";

/**
 * The tools that make sense on every page: pick a store, search, manage the
 * cart and the staples list, begin checkout, and track orders. Renders nothing.
 */
export default function ShoppingTools() {
  const ctx = useToolContext();
  useTool(definitions.chooseStore, handlers.chooseStore, ctx);
  useTool(definitions.searchProductsTool, handlers.searchProducts, ctx);
  useTool(definitions.addToCart, handlers.addToCart, ctx);
  useTool(definitions.updateCartItem, handlers.updateCartItem, ctx);
  useTool(definitions.getCart, handlers.getCart, ctx);
  useTool(definitions.getStaples, handlers.getStaples, ctx);
  useTool(definitions.updateStaples, handlers.updateStaples, ctx);
  useTool(definitions.addStaplesToCart, handlers.addStaplesToCart, ctx);
  useTool(definitions.addRecipeToCart, handlers.addRecipeToCart, ctx);
  useTool(definitions.startCheckout, handlers.startCheckout, ctx);
  useTool(definitions.getOrderStatus, handlers.getOrderStatus, ctx);
  return null;
}
