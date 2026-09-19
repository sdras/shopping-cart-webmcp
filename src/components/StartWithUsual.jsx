import { useMemo } from "react";
import { useApp, useCart } from "../state/app.js";
import { addAllStaples } from "../state/stapleActions.js";
import { planTopUp } from "../lib/staples.js";
import { money, plural } from "../lib/format.js";

/**
 * The payoff: an empty cart and a saved list. One button fills it.
 * Renders nothing unless that's the situation.
 */
export default function StartWithUsual({ shop, compact = false }) {
  const staples = useApp((s) => s.staples);
  const substitutions = useApp((s) => s.substitutions);
  const cart = useCart(shop.id);

  const plan = useMemo(() => planTopUp(shop, { staples, substitutions, cart }), [shop, staples, substitutions, cart]);
  const items = plan.report.added.reduce((sum, entry) => sum + entry.added, 0);
  if (Object.keys(cart).length > 0 || items === 0) return null;

  return (
    <section className={`start-usual${compact ? " compact" : ""}`} aria-labelledby={`start-usual-${compact ? "cart" : "shelf"}`}>
      <div>
        <h2 id={`start-usual-${compact ? "cart" : "shelf"}`}>Start with your usual?</h2>
        <p>{plural(items, "item")}, about {money(plan.cost)}</p>
      </div>
      <button type="button" className="button" onClick={() => addAllStaples(shop)}>
        Add my usuals
      </button>
    </section>
  );
}
