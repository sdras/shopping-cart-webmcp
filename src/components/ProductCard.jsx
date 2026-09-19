import QuantityControl from "./QuantityControl.jsx";
import { departmentsById } from "../data/products.js";
import { priceAt, inStockAt } from "../lib/catalog.js";
import { showProduct } from "../state/uiStore.js";
import { money } from "../lib/format.js";

export function ProductTile({ product, large = false }) {
  const hue = departmentsById[product.department].hue;
  return (
    <span className={`product-tile${large ? " large" : ""}`} style={{ "--hue": hue }} aria-hidden="true">
      {product.emoji}
    </span>
  );
}

export default function ProductCard({ shop, product, quantity }) {
  const inStock = inStockAt(shop, product);
  return (
    <article className={`product-card${inStock ? "" : " out-of-stock"}`}>
      <button type="button" className="product-open" onClick={() => showProduct(product.id)}>
        <ProductTile product={product} />
        <span className="product-price">{money(priceAt(shop, product))}</span>
        <span className="product-name">{product.name}</span>
        <span className="product-size">{product.size}</span>
        {!inStock && <span className="badge muted">Out of stock</span>}
        {inStock && product.tags.includes("organic") && <span className="badge">Organic</span>}
      </button>
      <div className="product-qty">
        <QuantityControl shop={shop} product={product} quantity={quantity} disabled={!inStock} />
      </div>
    </article>
  );
}
