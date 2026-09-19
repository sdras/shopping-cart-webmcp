import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import OrderSummary from "../components/OrderSummary.jsx";
import { BoltIcon } from "../components/icons.jsx";
import { useToolContext } from "../tools/useTool.js";
import { deliveryAddressForm } from "../tools/definitions.js";
import * as handlers from "../tools/handlers.js";
import { storesById } from "../data/stores.js";
import { getDeliveryWindows, findDeliveryWindow } from "../lib/deliveryWindows.js";
import { useNow } from "../lib/useNow.js";
import { appStore, useApp, useCartTotals } from "../state/app.js";
import { selectStore, setCheckout, isAddressComplete, formatAddress, REPLACEMENT_OPTIONS } from "../state/appStore.js";
import { logToolCall, toast } from "../state/uiStore.js";
import { DEFAULT_TIP } from "../lib/pricing.js";
import { money, plural } from "../lib/format.js";

const TIP_CHOICES = [0, 2, 4, 6, 10];

// The delivery address is a declarative WebMCP tool: an ordinary form whose
// `toolname` / `tooldescription` attributes let the browser build the schema
// from its fields. People and agents go through the same submit handler.
function AddressForm({ ctx }) {
  const address = useApp((s) => s.address);
  const [status, setStatus] = useState(null);

  function submit(event) {
    event.preventDefault();
    const native = event.nativeEvent;
    const fields = Object.fromEntries(new FormData(event.currentTarget));

    let result;
    try {
      result = { ok: true, message: handlers.setDeliveryAddress(fields, ctx) };
    } catch (error) {
      result = { ok: false, message: error.message };
    }
    setStatus(result);

    if (native.agentInvoked) {
      logToolCall({ name: deliveryAddressForm.name, input: fields, output: result.message, ok: result.ok });
      native.respondWith?.(Promise.resolve(result.message));
    }
  }

  // The form stays on the page after saving so the tool stays registered and
  // an agent can correct the address later.
  return (
    <form
      className="address-form"
      onSubmit={submit}
      toolname={deliveryAddressForm.name}
      tooldescription={deliveryAddressForm.description}
      toolautosubmit=""
    >
      <div className="field span-2">
        <label htmlFor="street">Street address</label>
        <input id="street" name="street" required autoComplete="address-line1" defaultValue={address.street}
          toolparamdescription="Street number and name, e.g. '742 Evergreen Terrace'." />
      </div>
      <div className="field">
        <label htmlFor="unit">Apt or unit <span className="muted">(optional)</span></label>
        <input id="unit" name="unit" autoComplete="address-line2" defaultValue={address.unit}
          toolparamdescription="Apartment, suite, or unit number. Leave empty for a house." />
      </div>
      <div className="field">
        <label htmlFor="city">City</label>
        <input id="city" name="city" required autoComplete="address-level2" defaultValue={address.city}
          toolparamdescription="City name." />
      </div>
      <div className="field">
        <label htmlFor="zip">ZIP code</label>
        <input id="zip" name="zip" required inputMode="numeric" autoComplete="postal-code" defaultValue={address.zip}
          toolparamdescription="5-digit US ZIP code, e.g. '94110'." />
      </div>
      <div className="field span-2">
        <label htmlFor="instructions">Delivery instructions <span className="muted">(optional)</span></label>
        <input id="instructions" name="instructions" defaultValue={address.instructions}
          toolparamdescription="Notes for the driver, such as a gate code or where to leave the bags." />
      </div>
      <div className="form-actions span-2">
        <button type="submit" className="button">Save address</button>
        {status && !status.ok && <p className="form-error" role="alert">{status.message}</p>}
        {isAddressComplete(address) && (!status || status.ok) && (
          <p className="form-saved" role="status">✓ Delivering to {formatAddress(address)}</p>
        )}
      </div>
    </form>
  );
}

function Step({ number, title, done, children }) {
  return (
    <section className="checkout-step" aria-labelledby={`step-${number}`}>
      <h2 id={`step-${number}`}>
        <span className={`step-number${done ? " done" : ""}`} aria-hidden="true">{done ? "✓" : number}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function CheckoutPage() {
  const { storeId } = useParams();
  const shop = storesById[storeId];
  const ctx = useToolContext();
  const now = useNow(60_000);
  const address = useApp((s) => s.address);
  const checkout = useApp((s) => s.checkout);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (shop) selectStore(appStore, shop.id);
  }, [shop]);

  const windows = shop ? getDeliveryWindows(shop, now) : [];
  const chosen = findDeliveryWindow(windows, checkout.windowId);
  const totals = useCartTotals(shop, { windowFee: chosen?.fee ?? 0 });

  useEffect(() => {
    const onActivated = (event) => {
      if (event.toolName === deliveryAddressForm.name) {
        toast("Filling in the delivery address", { agent: true });
      }
    };
    window.addEventListener("toolactivated", onActivated);
    return () => window.removeEventListener("toolactivated", onActivated);
  }, []);

  if (!shop) {
    return (
      <main id="main" className="page narrow empty-state">
        <h1>We couldn't find that store</h1>
        <p><Link to="/" className="button">See all stores</Link></p>
      </main>
    );
  }

  if (totals.lines.length === 0 || totals.belowMinimumBy > 0) {
    return (
      <main id="main" className="page narrow empty-state">
        <p className="empty-emoji" aria-hidden="true">🧺</p>
        <h1>{totals.lines.length === 0 ? "Your cart is empty" : "Almost there"}</h1>
        <p>
          {totals.lines.length === 0
            ? `Add a few things from ${shop.name} and come back.`
            : `${shop.name} has a ${money(shop.minimumOrder)} minimum. Add ${money(totals.belowMinimumBy)} more to check out.`}
        </p>
        <p><Link to={`/store/${shop.id}`} className="button">Keep shopping</Link></p>
      </main>
    );
  }

  const tip = checkout.tip ?? DEFAULT_TIP;
  const customTip = !TIP_CHOICES.includes(tip);

  function submitOrder() {
    try {
      handlers.placeOrder({}, ctx);
    } catch (problem) {
      setError(problem.message);
    }
  }

  return (
    <div className="checkout-bg">
      <main id="main" className="page checkout">
        <div className="checkout-steps">
          <p><Link to={`/store/${shop.id}`}>← Back to {shop.name}</Link></p>
          <h1>Checkout</h1>

          <Step number={1} title="Delivery address" done={isAddressComplete(address)}>
            <AddressForm ctx={ctx} />
          </Step>

          <Step number={2} title="Delivery time" done={Boolean(chosen)}>
            <fieldset className="option-grid">
              <legend className="visually-hidden">Choose a delivery window</legend>
              {windows.map((w) => (
                <label key={w.id} className="option">
                  <input
                    type="radio"
                    name="delivery-window"
                    checked={chosen?.id === w.id}
                    onChange={() => setCheckout(appStore, { windowId: w.id })}
                  />
                  <span className="option-label">
                    {w.priority && <span className="eta"><BoltIcon /></span>}
                    {w.label}
                  </span>
                  <span className="muted">{w.fee ? `+${money(w.fee)}` : "Free"}</span>
                </label>
              ))}
            </fieldset>
          </Step>

          <Step number={3} title="If something is out of stock" done>
            <fieldset className="option-grid three">
              <legend className="visually-hidden">Replacement preference</legend>
              {REPLACEMENT_OPTIONS.map((option) => (
                <label key={option} className="option">
                  <input
                    type="radio"
                    name="replacements"
                    checked={checkout.replacements === option}
                    onChange={() => setCheckout(appStore, { replacements: option })}
                  />
                  <span className="option-label">{option}</span>
                </label>
              ))}
            </fieldset>
          </Step>

          <Step number={4} title="Tip your shopper" done>
            <p className="muted">100% of the tip goes to the person shopping your order.</p>
            <div className="chips" role="group" aria-label="Tip amount">
              {TIP_CHOICES.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="chip"
                  aria-pressed={tip === amount}
                  onClick={() => setCheckout(appStore, { tip: amount })}
                >
                  {amount === 0 ? "No tip" : money(amount)}
                </button>
              ))}
              <label className={`chip chip-input${customTip ? " active" : ""}`}>
                <span>Other $</span>
                <input
                  type="number"
                  min="0"
                  max="200"
                  step="0.5"
                  aria-label="Custom tip in dollars"
                  value={customTip ? tip : ""}
                  onChange={(e) => {
                    const amount = Number(e.target.value);
                    if (e.target.value !== "" && amount >= 0 && amount <= 200) {
                      setCheckout(appStore, { tip: amount });
                    }
                  }}
                />
              </label>
            </div>
          </Step>

          <Step number={5} title="Payment" done>
            <div className="saved-row">
              <p><strong><span className="emoji" aria-hidden="true">💳</span>Demo card ending in 4242</strong></p>
              <span className="badge muted">Nothing is charged</span>
            </div>
          </Step>
        </div>

        <aside className="checkout-summary" aria-labelledby="summary-title">
          <button type="button" className="button wide" onClick={submitOrder}>
            <span>Place order</span>
            <span className="button-amount">{money(totals.total)}</span>
          </button>
          {error && <p className="form-error" role="alert">{humanize(error)}</p>}
          <p className="fine-print">This is a demo. Placing the order charges nothing and delivers nothing.</p>

          <div className="cart-store" style={{ "--hue": shop.hue }}>
            <span className="store-logo small" aria-hidden="true">{shop.emoji}</span>
            <div>
              <h2 id="summary-title">{shop.name}</h2>
              <p className="muted">{plural(totals.itemCount, "item")}</p>
            </div>
          </div>
          <ul className="summary-lines">
            {totals.lines.map(({ product, quantity, lineTotal }) => (
              <li key={product.id}>
                <span aria-hidden="true">{product.emoji}</span>
                <span>{quantity} × {product.name}</span>
                <span>{money(lineTotal)}</span>
              </li>
            ))}
          </ul>
          <OrderSummary totals={totals} />
        </aside>
      </main>
    </div>
  );
}

// Handler errors name tools for the agent's benefit; people just need the gist.
function humanize(message) {
  return message.replace(/\s*\((set_delivery_address|set_delivery_options)\)/g, "");
}
