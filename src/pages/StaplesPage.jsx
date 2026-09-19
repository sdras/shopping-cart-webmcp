import { useMemo } from "react";
import { Link } from "react-router-dom";
import QuantityControl from "../components/QuantityControl.jsx";
import Price from "../components/Price.jsx";
import { ProductTile, StockNote } from "../components/ProductCard.jsx";
import { CloseIcon } from "../components/icons.jsx";
import { productsById } from "../data/products.js";
import { priceAt, inStockAt } from "../lib/catalog.js";
import { repeatPurchases } from "../lib/staples.js";
import { appStore, useApp, useOpenStore, useCart } from "../state/app.js";
import { setStaple, setSubstitution, dismissSuggestion } from "../state/appStore.js";
import { addAllStaples } from "../state/stapleActions.js";
import { showProduct } from "../state/uiStore.js";
import { plural } from "../lib/format.js";

// Things that keep showing up in orders, offered as one-tap usuals.
function Suggestions() {
  const orders = useApp((s) => s.orders);
  const staples = useApp((s) => s.staples);
  const dismissed = useApp((s) => s.dismissedSuggestions);
  const suggestions = useMemo(
    () => repeatPurchases(orders, { staples, dismissed }).slice(0, 6),
    [orders, staples, dismissed]
  );
  if (suggestions.length === 0) return null;

  return (
    <section className="suggestions" aria-labelledby="suggestions-title">
      <h2 id="suggestions-title">You keep buying these</h2>
      <ul>
        {suggestions.map(({ product, count, quantity }) => (
          <li key={product.id} className="suggestion">
            <span aria-hidden="true">{product.emoji}</span>
            <span>
              <strong>{product.name}</strong>
              <span className="muted"> · in {count} orders</span>
            </span>
            <button type="button" className="button small" onClick={() => setStaple(appStore, product.id, quantity)}>
              Make it a usual
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => dismissSuggestion(appStore, product.id)}
              aria-label={`Don't suggest ${product.name}`}
            >
              <CloseIcon size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OutOfStockRule({ product }) {
  const rule = useApp((s) => s.substitutions[product.id]);
  if (!rule) return null;
  const text = rule.type === "skip" ? "Skipped when it's out" : `When it's out: ${productsById[rule.with]?.name}`;
  return (
    <span className="staple-rule">
      {text} ·{" "}
      <button type="button" className="link-button" onClick={() => setSubstitution(appStore, product.id, null)}>
        ask me instead
      </button>
    </span>
  );
}

export default function StaplesPage() {
  const shop = useOpenStore();
  const staples = useApp((s) => s.staples);
  const cart = useCart(shop?.id);
  const entries = Object.entries(staples)
    .map(([id, usual]) => ({ product: productsById[id], usual }))
    .filter((entry) => entry.product);

  return (
    <main id="main" className="page narrow">
      <header className="staples-header">
        <div>
          <h1>Your usuals</h1>
          <p className="muted">
            The things you buy every time, and how many. One tap tops your cart up to the usual,
            without doubling anything that's already in it.
          </p>
        </div>
        {shop && entries.length > 0 && (
          <button type="button" className="button" onClick={() => addAllStaples(shop)}>
            Add my usuals
          </button>
        )}
      </header>

      <Suggestions />

      {entries.length === 0 ? (
        <div className="empty-state">
          <p className="empty-emoji" aria-hidden="true">⭐</p>
          <p>
            Nothing here yet, and you don't have to build a list. After your next order we'll ask
            which things you buy every time.
          </p>
          <p><Link to={shop ? `/store/${shop.id}` : "/"} className="button">Start shopping</Link></p>
        </div>
      ) : (
        <>
          {!shop && (
            <p className="notice">
              <Link to="/">Choose a store</Link> to see prices and add your usuals to a cart.
            </p>
          )}
          <p className="muted" role="status">{plural(entries.length, "product")} on your list</p>
          <ul className="staple-lines">
            {entries.map(({ product, usual }) => (
              <li key={product.id} className="staple-line">
                <ProductTile product={product} />
                <div className="cart-line-info">
                  {shop ? (
                    <button type="button" className="link-button product-name" onClick={() => showProduct(product.id)}>
                      {product.name}
                    </button>
                  ) : (
                    <span className="product-name">{product.name}</span>
                  )}
                  <span className="product-size">{product.size}</span>
                  {shop && <StockNote inStock={inStockAt(shop, product)} />}
                  <OutOfStockRule product={product} />
                </div>
                {shop && <Price amount={priceAt(shop, product)} />}
                <div className="staple-usual">
                  <span className="muted">Usually</span>
                  <QuantityControl
                    product={product}
                    quantity={usual}
                    noun="your usuals"
                    onChange={(next) => setStaple(appStore, product.id, next)}
                  />
                  <span className="muted staple-in-cart">
                    {shop && cart[product.id] ? `${cart[product.id]} in cart` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
