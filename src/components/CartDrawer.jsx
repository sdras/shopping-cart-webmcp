import { useNavigate } from "react-router-dom";
import Dialog from "./Dialog.jsx";
import QuantityControl from "./QuantityControl.jsx";
import { ProductTile } from "./ProductCard.jsx";
import { useOpenStore, useCartTotals } from "../state/app.js";
import { uiStore, closeCart } from "../state/uiStore.js";
import { useStore } from "../state/createStore.js";
import { money, plural } from "../lib/format.js";

function Progress({ totals, shop }) {
  const goal = shop.freeDeliveryOver;
  const fraction = Math.min(1, totals.subtotal / goal);
  let message = `You've unlocked free delivery 🎉`;
  if (totals.belowMinimumBy > 0) {
    message = `Add ${money(totals.belowMinimumBy)} to reach the ${money(shop.minimumOrder)} minimum`;
  } else if (!totals.freeDelivery) {
    message = `Add ${money(totals.toFreeDelivery)} for free delivery`;
  }
  return (
    <div className="cart-progress">
      <p>{message}</p>
      <div className="meter" role="presentation">
        <span style={{ inlineSize: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}

export default function CartDrawer() {
  const shop = useOpenStore();
  const open = useStore(uiStore, (s) => s.cartOpen) && Boolean(shop);
  const totals = useCartTotals(shop);
  const navigate = useNavigate();

  function checkout() {
    closeCart();
    navigate(`/store/${shop.id}/checkout`);
  }

  return (
    <Dialog open={open} onClose={closeCart} className="cart-drawer" labelledBy="cart-title">
      {shop && totals && (
        <div className="cart-drawer-body">
          <header className="cart-header">
            <div>
              <h2 id="cart-title">Your cart</h2>
              <p className="muted">
                <span className="emoji" aria-hidden="true">{shop.emoji}</span>
                {shop.name} · {plural(totals.itemCount, "item")}
              </p>
            </div>
            <button type="button" className="icon-button" onClick={closeCart} aria-label="Close cart">
              ✕
            </button>
          </header>

          {totals.lines.length === 0 ? (
            <div className="empty-state">
              <p className="empty-emoji" aria-hidden="true">🧺</p>
              <p>Your cart is empty. The bananas are right there.</p>
            </div>
          ) : (
            <>
              <Progress totals={totals} shop={shop} />
              <ul className="cart-lines">
                {totals.lines.map(({ product, quantity, lineTotal }) => (
                  <li key={product.id} className="cart-line">
                    <ProductTile product={product} />
                    <div className="cart-line-info">
                      <span className="product-name">{product.name}</span>
                      <span className="product-size">{product.size}</span>
                    </div>
                    <QuantityControl shop={shop} product={product} quantity={quantity} />
                    <span className="cart-line-total">{money(lineTotal)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <footer className="cart-footer">
            <button
              type="button"
              className="button wide"
              disabled={totals.lines.length === 0 || totals.belowMinimumBy > 0}
              onClick={checkout}
            >
              <span>Go to checkout</span>
              <span className="button-amount">{money(totals.subtotal)}</span>
            </button>
          </footer>
        </div>
      )}
    </Dialog>
  );
}
