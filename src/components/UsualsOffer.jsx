import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StarIcon } from "./icons.jsx";
import { appStore, useApp } from "../state/app.js";
import { resolveStapleOffer } from "../state/appStore.js";
import { saveUsualsFromOrder } from "../state/stapleActions.js";
import { plural } from "../lib/format.js";

/**
 * Shown on an order: "Buy any of these every time?" The cart they just built
 * is the list, so making usuals is a few taps and no typing. Things they've
 * ordered before start out selected.
 */
export default function UsualsOffer({ order }) {
  const staples = useApp((s) => s.staples);
  const outcome = useApp((s) => s.stapleOffers[order.id]);
  const orders = useApp((s) => s.orders);

  const candidates = useMemo(() => order.items.filter((item) => !staples[item.id]), [order, staples]);
  const boughtBefore = useMemo(() => {
    const earlier = orders.filter((o) => o.id !== order.id).flatMap((o) => o.items.map((i) => i.id));
    return candidates.filter((item) => earlier.includes(item.id)).map((item) => item.id);
  }, [orders, order, candidates]);

  const [picked, setPicked] = useState(null);
  const selected = picked ?? boughtBefore;

  if (outcome === "saved") {
    return (
      <p className="usuals-saved">
        <StarIcon filled />
        <span>Saved to your usuals. <Link to="/usuals">See the list</Link></span>
      </p>
    );
  }
  if (outcome === "dismissed" || candidates.length === 0) return null;

  const toggle = (id) => setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <section className="usuals-offer" aria-labelledby="usuals-offer-title">
      <h2 id="usuals-offer-title">Buy any of these every time?</h2>
      <p>Tap the ones you always get. Next time they go in your cart with one tap.</p>
      <div className="chips" role="group" aria-label="Items from this order">
        {candidates.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip"
            aria-pressed={selected.includes(item.id)}
            onClick={() => toggle(item.id)}
          >
            <span aria-hidden="true">{item.emoji}</span>
            {item.name}
            {item.quantity > 1 && <span className="chip-qty">× {item.quantity}</span>}
          </button>
        ))}
      </div>
      <div className="usuals-offer-actions">
        <button
          type="button"
          className="button"
          disabled={selected.length === 0}
          onClick={() => saveUsualsFromOrder(order, selected)}
        >
          {selected.length ? `Save ${plural(selected.length, "usual")}` : "Save as my usuals"}
        </button>
        {selected.length < candidates.length && (
          <button type="button" className="button secondary" onClick={() => setPicked(candidates.map((i) => i.id))}>
            Select all
          </button>
        )}
        <button type="button" className="link-button muted" onClick={() => resolveStapleOffer(appStore, order.id, "dismissed")}>
          Not now
        </button>
      </div>
    </section>
  );
}
