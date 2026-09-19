import { appStore } from "../state/app.js";
import { addItem, setQuantity, MAX_QUANTITY } from "../state/appStore.js";

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The round "+" that grows into a − 2 + stepper once the product is in the cart.
 */
export default function QuantityControl({ shop, product, quantity, disabled, size = "small" }) {
  if (quantity === 0) {
    return (
      <button
        type="button"
        className={`qty-add ${size}`}
        disabled={disabled}
        onClick={() => addItem(appStore, shop.id, product.id, 1)}
        aria-label={`Add ${product.name} to cart`}
      >
        <span aria-hidden="true">+</span>
        {size === "large" && <span>Add to cart</span>}
      </button>
    );
  }

  return (
    <div className={`qty-stepper ${size}`} role="group" aria-label={`${product.name} quantity`}>
      <button
        type="button"
        onClick={() => setQuantity(appStore, shop.id, product.id, quantity - 1)}
        aria-label={quantity === 1 ? `Remove ${product.name} from cart` : `Decrease ${product.name} quantity`}
      >
        {quantity === 1 ? <TrashIcon /> : <span aria-hidden="true">−</span>}
      </button>
      <output aria-live="polite">{quantity}</output>
      <button
        type="button"
        disabled={quantity >= MAX_QUANTITY}
        onClick={() => setQuantity(appStore, shop.id, product.id, quantity + 1)}
        aria-label={`Increase ${product.name} quantity`}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
