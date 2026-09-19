import { Link } from "react-router-dom";
import { BoltIcon } from "../components/icons.jsx";
import { stores } from "../data/stores.js";
import { useApp } from "../state/app.js";
import { cartCount } from "../lib/pricing.js";
import { money, plural } from "../lib/format.js";

const fastest = stores.reduce((a, b) => (parseInt(a.eta) <= parseInt(b.eta) ? a : b));
const cheapestFreeDelivery = stores.reduce((a, b) => (a.freeDeliveryOver <= b.freeDeliveryOver ? a : b));

export default function StoresPage() {
  const carts = useApp((s) => s.carts);

  return (
    <main id="main" className="page">
      <section className="promos" aria-label="What's on Basketful">
        <article className="promo kale">
          <h1>Groceries delivered in as fast as {fastest.eta}</h1>
          <p>Pick a store, fill a cart, and choose a delivery window that works for you.</p>
          <p className="promo-art" aria-hidden="true">🥑🍞🧀</p>
        </article>
        <article className="promo cashew">
          <h2>Let your agent do the shopping</h2>
          <p>Every step here is a WebMCP tool: search, cart, checkout, and order tracking.</p>
          <p className="promo-art" aria-hidden="true">🤖🛒</p>
        </article>
        <article className="promo carrot">
          <h2>Free delivery over {money(cheapestFreeDelivery.freeDeliveryOver)}</h2>
          <p>At {cheapestFreeDelivery.name}. Every store has its own free delivery threshold.</p>
          <p className="promo-art" aria-hidden="true">🚗💨</p>
        </article>
      </section>

      <section aria-labelledby="stores-title">
        <h2 id="stores-title" className="section-title">Choose your store</h2>
        <ul className="store-grid">
          {stores.map((shop) => {
            const inCart = cartCount(carts[shop.id]);
            return (
              <li key={shop.id}>
                <Link to={`/store/${shop.id}`} className="store-card" style={{ "--hue": shop.hue }}>
                  <span className="store-logo" aria-hidden="true">{shop.emoji}</span>
                  <span className="store-card-text">
                    <span className="store-name">{shop.name}</span>
                    <span className="eta"><BoltIcon />Delivery in about {shop.eta}</span>
                    <span className="muted">{shop.tagline}</span>
                    <span className="store-tags">
                      <span className="badge muted">{money(shop.deliveryFee)} delivery</span>
                      <span className="badge muted">Free over {money(shop.freeDeliveryOver)}</span>
                      {inCart > 0 && <span className="badge">{plural(inCart, "item")} in cart</span>}
                    </span>
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
