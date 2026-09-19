import { Link } from "react-router-dom";
import { useApp } from "../state/app.js";
import { orderProgress } from "../state/appStore.js";
import { useNow } from "../lib/useNow.js";
import { money, plural } from "../lib/format.js";

const placedOn = (timestamp) =>
  new Date(timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function OrdersPage() {
  const orders = useApp((s) => s.orders);
  const now = useNow(5000);

  return (
    <main id="main" className="page narrow">
      <h1>Your orders</h1>
      {orders.length === 0 ? (
        <div className="empty-state">
          <p className="empty-emoji" aria-hidden="true">📦</p>
          <p>No orders yet. Your fridge is counting on you.</p>
          <p><Link to="/" className="button">Start shopping</Link></p>
        </div>
      ) : (
        <ul className="order-list">
          {orders.map((order) => {
            const { stage, delivered } = orderProgress(order, now.getTime());
            return (
              <li key={order.id}>
                <Link to={`/orders/${order.id}`} className="order-card">
                  <span className="order-emojis" aria-hidden="true">
                    {order.items.slice(0, 4).map((i) => i.emoji).join(" ")}
                  </span>
                  <span className="order-card-text">
                    <strong>{order.storeName}</strong>
                    <span className="muted">
                      {order.id} · {placedOn(order.placedAt)} · {plural(order.totals.itemCount, "item")} · {money(order.totals.total)}
                    </span>
                  </span>
                  <span className={`badge${delivered ? " muted" : ""}`}>{stage.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
