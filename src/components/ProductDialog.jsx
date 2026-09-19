import Dialog from "./Dialog.jsx";
import QuantityControl from "./QuantityControl.jsx";
import Price from "./Price.jsx";
import ProductCard, { ProductTile, StockNote } from "./ProductCard.jsx";
import { CloseIcon, StarIcon } from "./icons.jsx";
import { products, productsById, departmentsById } from "../data/products.js";
import { priceAt, inStockAt } from "../lib/catalog.js";
import { appStore, useApp, useOpenStore, useCart } from "../state/app.js";
import { setStaple } from "../state/appStore.js";
import { uiStore, showProduct } from "../state/uiStore.js";
import { useStore } from "../state/createStore.js";

export default function ProductDialog() {
  const shop = useOpenStore();
  const productId = useStore(uiStore, (s) => s.productId);
  const cart = useCart(shop?.id);
  const staples = useApp((s) => s.staples);
  const product = productsById[productId];
  const open = Boolean(shop && product);
  const close = () => showProduct(null);

  let body = null;
  if (open) {
    const inStock = inStockAt(shop, product);
    const related = products
      .filter((p) => p.department === product.department && p.id !== product.id && inStockAt(shop, p))
      .slice(0, 4);

    body = (
      <div className="product-dialog-body">
        <button type="button" className="icon-button dialog-close" onClick={close} aria-label="Close">
          <CloseIcon />
        </button>
        <div className="product-detail">
          <ProductTile product={product} large />
          <div className="product-detail-info">
            <p className="eyebrow">{departmentsById[product.department].name}</p>
            <h2 id="product-dialog-title">{product.name}</h2>
            <p className="product-size">{product.size}</p>
            <div className="buy-box">
              <Price amount={priceAt(shop, product)} size="large" />
              <StockNote inStock={inStock} />
              {inStock ? (
                <QuantityControl shop={shop} product={product} quantity={cart[product.id] ?? 0} size="large" />
              ) : (
                <p className="notice">Out of stock at {shop.name} right now.</p>
              )}
              <button
                type="button"
                className="button secondary staple-toggle"
                aria-pressed={Boolean(staples[product.id])}
                onClick={() => setStaple(appStore, product.id, staples[product.id] ? 0 : Math.max(1, cart[product.id] ?? 1))}
              >
                <StarIcon filled={Boolean(staples[product.id])} />
                {staples[product.id] ? `One of your usuals · usually ${staples[product.id]}` : "Make it a usual"}
              </button>
            </div>
            <h3>Details</h3>
            <p>{product.description}</p>
            {product.tags.length > 0 && (
              <ul className="tag-list" aria-label="Dietary information">
                {product.tags.map((tag) => (
                  <li key={tag} className="badge muted">{tag}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {related.length > 0 && (
          <section aria-labelledby="related-title">
            <h3 id="related-title">Related items</h3>
            <div className="product-grid compact">
              {related.map((p) => (
                <ProductCard key={p.id} shop={shop} product={p} quantity={cart[p.id] ?? 0} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onClose={close} className="product-dialog" labelledBy="product-dialog-title">
      {body}
    </Dialog>
  );
}
