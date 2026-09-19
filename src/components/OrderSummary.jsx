import { money } from "../lib/format.js";

/** The fee breakdown shown at checkout and on a placed order. */
export default function OrderSummary({ totals, totalLabel = "Total" }) {
  const delivery = totals.deliveryFee + totals.priorityFee;
  return (
    <dl className="summary">
      <div>
        <dt>Subtotal</dt>
        <dd>{money(totals.subtotal)}</dd>
      </div>
      <div>
        <dt>Delivery{totals.priorityFee > 0 && " (priority)"}</dt>
        <dd>{delivery === 0 ? "Free" : money(delivery)}</dd>
      </div>
      <div>
        <dt>Service fee</dt>
        <dd>{money(totals.serviceFee)}</dd>
      </div>
      {totals.tax > 0 && (
        <div>
          <dt>Estimated tax</dt>
          <dd>{money(totals.tax)}</dd>
        </div>
      )}
      <div>
        <dt>Shopper tip</dt>
        <dd>{money(totals.tip)}</dd>
      </div>
      <div className="summary-total">
        <dt>{totalLabel}</dt>
        <dd>{money(totals.total)}</dd>
      </div>
    </dl>
  );
}
