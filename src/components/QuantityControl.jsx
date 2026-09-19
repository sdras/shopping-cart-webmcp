import { TrashIcon } from "./icons.jsx";
import { appStore } from "../state/app.js";
import { setQuantity, MAX_QUANTITY } from "../state/appStore.js";

/**
 * The "+ Add" pill that turns into a − 2 + stepper once the product is in
 * the cart. Pass `onChange` (and a `noun`) to point it at something other
 * than the cart, like the usual quantity of a staple.
 */
export default function QuantityControl({ shop, product, quantity, disabled, size = "small", onChange, noun = "cart" }) {
  const change = onChange ?? ((next) => setQuantity(appStore, shop.id, product.id, next));

  if (quantity === 0) {
    return (
      <button
        type="button"
        className={`qty-add ${size}`}
        disabled={disabled}
        onClick={() => change(1)}
        aria-label={`Add ${product.name} to ${noun}`}
      >
        <span className="qty-plus" aria-hidden="true">+</span>
        <span>{size === "large" ? "Add to cart" : "Add"}</span>
      </button>
    );
  }

  return (
    <div className={`qty-stepper ${size}`} role="group" aria-label={`${product.name} quantity`}>
      <button
        type="button"
        onClick={() => change(quantity - 1)}
        aria-label={quantity === 1 ? `Remove ${product.name} from ${noun}` : `Decrease ${product.name} quantity`}
      >
        {quantity === 1 ? <TrashIcon /> : <span aria-hidden="true">−</span>}
      </button>
      <output aria-live="polite">{quantity}</output>
      <button
        type="button"
        disabled={quantity >= MAX_QUANTITY}
        onClick={() => change(quantity + 1)}
        aria-label={`Increase ${product.name} quantity`}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
