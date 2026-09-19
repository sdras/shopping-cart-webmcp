import QuantityControl from "./QuantityControl.jsx";
import Price from "./Price.jsx";
import { StockIcon, StarIcon } from "./icons.jsx";
import { useApp } from "../state/app.js";
import { priceAt, inStockAt } from "../lib/catalog.js";
import { showProduct } from "../state/uiStore.js";

export function ProductTile({ product, large = false }) {
  return (
    <span className={`product-tile${large ? " large" : ""}`} aria-hidden="true">
      {product.emoji}
    </span>
  );
}

export function StockNote({ inStock }) {
  return inStock ? (
    <span className="stock"><StockIcon />Many in stock</span>
  ) : (
    <span className="stock out">Out of stock</span>
  );
}

export default function ProductCard({ shop, product, quantity }) {
  const inStock = inStockAt(shop, product);
  const usual = useApp((s) => s.staples[product.id]);
  return (
    <article className={`product-card${inStock ? "" : " out-of-stock"}`}>
      <button type="button" className="product-open" onClick={() => showProduct(product.id)}>
        <ProductTile product={product} />
        {usual > 0 && (
          <span className="staple-mark">
            <StarIcon filled size={12} />
            <span>Usually {usual}</span>
          </span>
        )}
        <Price amount={priceAt(shop, product)} />
        <span className="product-name">{product.name}</span>
        <span className="product-size">{product.size}</span>
        {product.tags.includes("organic") && <span className="product-attr">Organic</span>}
        <StockNote inStock={inStock} />
      </button>
      <div className="product-qty">
        <QuantityControl shop={shop} product={product} quantity={quantity} disabled={!inStock} />
      </div>
    </article>
  );
}
