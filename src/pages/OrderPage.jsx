import { Link, useNavigate, useParams } from "react-router-dom";
import OrderSummary from "../components/OrderSummary.jsx";
import { storesById } from "../data/stores.js";
import { productsById } from "../data/products.js";
import { inStockAt } from "../lib/catalog.js";
import { appStore, useApp } from "../state/app.js";
import { addItem, selectStore, orderProgress, formatAddress, ORDER_STAGES } from "../state/appStore.js";
import { openCart } from "../state/uiStore.js";
import { useNow } from "../lib/useNow.js";
import { money } from "../lib/format.js";

const STAGE_ART = { placed: "🧾", shopping: "🛒", delivering: "🚗", delivered: "🏡" };

function headline(order, stage) {
  switch (stage.key) {
    case "placed":
      return `We've got it. ${order.shopper} is about to start shopping.`;
    case "shopping":
      return `${order.shopper} is picking out your groceries.`;
    case "delivering":
      return `${order.shopper} is on the way.`;
    default:
      return "Delivered. Enjoy!";
  }
}

export default function OrderPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const order = useApp((s) => s.orders).find((o) => o.id === orderId);
  const now = useNow(1000);

  if (!order) {
    return (
      <main id="main" className="page narrow empty-state">
        <h1>We couldn't find that order</h1>
        <p><Link to="/orders" className="button">See your orders</Link></p>
      </main>
    );
  }

  const { stage, stageIndex, fraction, delivered } = orderProgress(order, now.getTime());
  const shop = storesById[order.storeId];

  function reorder() {
    selectStore(appStore, shop.id);
    for (const item of order.items) {
      const product = productsById[item.id];
      if (product && inStockAt(shop, product)) addItem(appStore, shop.id, item.id, item.quantity);
    }
    navigate(`/store/${shop.id}`);
    openCart();
  }

  return (
    <main id="main" className="page narrow">
      <p><Link to="/orders">← All orders</Link></p>
      <section className="tracker" aria-labelledby="tracker-title">
        <p className="eyebrow">Order {order.id} · {order.storeName}</p>
        <h1 id="tracker-title" aria-live="polite">{headline(order, stage)}</h1>
        <p className="muted">
          {delivered ? "Delivered to" : `Arriving ${order.window.label} at`} {formatAddress(order.address)}
        </p>

        <div className="tracker-track" role="presentation">
          <span className="tracker-fill" style={{ inlineSize: `${fraction * 100}%` }} />
          <span className="tracker-car" style={{ insetInlineStart: `${fraction * 100}%` }} aria-hidden="true">
            {STAGE_ART[stage.key]}
          </span>
        </div>
        <ol className="tracker-stages">
          {ORDER_STAGES.map((s, i) => (
            <li key={s.key} className={i <= stageIndex ? "reached" : ""} aria-current={i === stageIndex ? "step" : undefined}>
              {s.label}
            </li>
          ))}
        </ol>
      </section>

      <section className="panel" aria-labelledby="items-title">
        <header className="panel-header">
          <h2 id="items-title">Items</h2>
          <button type="button" className="button secondary small" onClick={reorder}>
            Order again
          </button>
        </header>
        <ul className="summary-lines">
          {order.items.map((item) => (
            <li key={item.id}>
              <span aria-hidden="true">{item.emoji}</span>
              <span>{item.quantity} × {item.name} <span className="muted">({item.size})</span></span>
              <span>{money(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <p className="muted">If something is out of stock: {order.replacements}.</p>
        <OrderSummary totals={order.totals} totalLabel="Total" />
      </section>
    </main>
  );
}
