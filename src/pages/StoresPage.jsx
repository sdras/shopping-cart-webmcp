import { Link } from "react-router-dom";
import { stores } from "../data/stores.js";
import { useApp } from "../state/app.js";
import { cartCount } from "../lib/pricing.js";
import { money, plural } from "../lib/format.js";

export default function StoresPage() {
  const carts = useApp((s) => s.carts);

  return (
    <main id="main" className="page">
      <section className="hero">
        <div>
          <h1>Groceries at your door in under an hour.</h1>
          <p>
            Pick a store, fill a cart, and choose a delivery window. Or hand the list to your
            browser's agent: every step here is a WebMCP tool.
          </p>
        </div>
        <p className="hero-art" aria-hidden="true">
          <span>🥑</span><span>🍞</span><span>🧀</span><span>🍓</span><span>🥕</span>
        </p>
      </section>

      <section aria-labelledby="stores-title">
        <h2 id="stores-title">Choose a store</h2>
        <ul className="store-grid">
          {stores.map((shop) => {
            const inCart = cartCount(carts[shop.id]);
            return (
              <li key={shop.id}>
                <Link to={`/store/${shop.id}`} className="store-card" style={{ "--hue": shop.hue }}>
                  <span className="store-logo" aria-hidden="true">{shop.emoji}</span>
                  <span className="store-card-text">
                    <span className="store-name">{shop.name}</span>
                    <span className="muted">{shop.tagline}</span>
                    <span className="store-meta">
                      <span><span className="emoji" aria-hidden="true">⚡</span>{shop.eta}</span>
                      <span>{money(shop.deliveryFee)} delivery</span>
                      <span>Free over {money(shop.freeDeliveryOver)}</span>
                    </span>
                    {inCart > 0 && <span className="badge">{plural(inCart, "item")} in cart</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
