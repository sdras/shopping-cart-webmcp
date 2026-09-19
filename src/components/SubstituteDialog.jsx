import { useEffect, useState } from "react";
import Dialog from "./Dialog.jsx";
import Price from "./Price.jsx";
import { ProductTile } from "./ProductCard.jsx";
import { CloseIcon } from "./icons.jsx";
import { storesById } from "../data/stores.js";
import { productsById } from "../data/products.js";
import { similarProducts, priceAt } from "../lib/catalog.js";
import { appStore } from "../state/app.js";
import { setQuantity, setSubstitution } from "../state/appStore.js";
import { uiStore, askAboutSubstitutes, toast } from "../state/uiStore.js";
import { useStore } from "../state/createStore.js";

/**
 * Asked at the moment it matters: one of your usuals is out today. The answer
 * can be a one-off, or become the rule ("always" / "skip it when it's out"),
 * so nobody has to write out-of-stock preferences in advance.
 */
export default function SubstituteDialog() {
  const prompt = useStore(uiStore, (s) => s.substitutePrompt);
  const shop = storesById[prompt?.storeId];
  const current = prompt?.items[0];
  const product = productsById[current?.productId];
  const open = Boolean(shop && product);

  const options = open ? similarProducts(shop, product) : [];
  const [chosenId, setChosenId] = useState(null);
  useEffect(() => setChosenId(null), [current?.productId]);
  const chosen = options.find((p) => p.id === chosenId) ?? options[0];

  const next = () => askAboutSubstitutes(prompt.storeId, prompt.items.slice(1));
  const closeAll = () => askAboutSubstitutes(null, []);

  function swap({ always }) {
    // Top up rather than add, the same as a saved rule would: asking twice in
    // one day never doubles the stand-in.
    const inCart = appStore.getState().carts[shop.id]?.[chosen.id] ?? 0;
    setQuantity(appStore, shop.id, chosen.id, Math.max(inCart, current.usual));
    if (always) setSubstitution(appStore, product.id, { type: "swap", with: chosen.id });
    toast(always ? `Got it. ${chosen.name} whenever ${product.name} is out.` : `Swapped in ${chosen.name} for today`);
    next();
  }

  function skipWhenOut() {
    setSubstitution(appStore, product.id, { type: "skip" });
    toast(`Got it. We'll leave ${product.name} out when there isn't any.`);
    next();
  }

  return (
    <Dialog open={open} onClose={closeAll} className="substitute-dialog" labelledBy="substitute-title">
      {open && (
        <div className="substitute-body">
          <button type="button" className="icon-button dialog-close" onClick={closeAll} aria-label="Close">
            <CloseIcon />
          </button>
          <p className="eyebrow">
            One of your usuals is out{prompt.items.length > 1 ? ` · ${prompt.items.length} to go` : ""}
          </p>
          <h2 id="substitute-title">{product.name} is out of stock today</h2>

          {options.length > 0 ? (
            <>
              <fieldset className="substitute-options">
                <legend>Swap it for</legend>
                {options.map((option) => (
                  <label key={option.id} className="option">
                    <input
                      type="radio"
                      name="substitute"
                      checked={chosen.id === option.id}
                      onChange={() => setChosenId(option.id)}
                    />
                    <span className="substitute-option">
                      <ProductTile product={option} />
                      <span>
                        <span className="option-label">{option.name}</span>
                        <span className="product-size">{option.size}</span>
                      </span>
                    </span>
                    <Price amount={priceAt(shop, option)} />
                  </label>
                ))}
              </fieldset>
              <div className="substitute-actions">
                <button type="button" className="button" onClick={() => swap({ always: false })}>
                  Just today
                </button>
                <button type="button" className="button secondary" onClick={() => swap({ always: true })}>
                  Always swap
                </button>
                <button type="button" className="button secondary" onClick={skipWhenOut}>
                  Skip it when it's out
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted">Nothing similar is in stock at {shop.name} right now.</p>
              <div className="substitute-actions">
                <button type="button" className="button" onClick={next}>
                  OK, leave it out today
                </button>
                <button type="button" className="button secondary" onClick={skipWhenOut}>
                  Always skip it when it's out
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
