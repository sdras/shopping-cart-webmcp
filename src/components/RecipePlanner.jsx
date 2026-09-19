import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Price from "./Price.jsx";
import { ProductTile } from "./ProductCard.jsx";
import SampleHistory from "./SampleHistory.jsx";
import { planRecipe } from "../lib/recipes.js";
import { priceAt } from "../lib/catalog.js";
import { useNow } from "../lib/useNow.js";
import { appStore, useApp } from "../state/app.js";
import { applyRecipePlan, removeRecipeFromCart, notePantry } from "../state/appStore.js";
import { toast } from "../state/uiStore.js";
import { money, plural } from "../lib/format.js";

const sentence = (text) => text.charAt(0).toUpperCase() + text.slice(1) + (/[.?!]$/.test(text) ? "" : ".");

function Line({ line, shop, children }) {
  return (
    <li className={`plan-line ${line.why === "expired" ? "expired" : ""}`}>
      {line.product ? <ProductTile product={line.product} /> : <span className="product-tile" aria-hidden="true">❓</span>}
      <div className="plan-line-text">
        <span className="product-name">
          {line.add > 1 && <strong>{line.add} × </strong>}
          {line.label}
        </span>
        <span className="plan-reason">{sentence(line.reason)}</span>
        {children}
      </div>
      {line.product && line.add > 0 && <Price amount={priceAt(shop, line.product) * line.add} />}
    </li>
  );
}

/**
 * The review sheet for a recipe: what goes in the cart and, for everything
 * that doesn't, why not. Every guess can be corrected with one tap, and the
 * correction is remembered.
 */
export default function RecipePlanner({ recipe, shop }) {
  const state = useApp((s) => s);
  const now = useNow(60_000);
  const [answers, setAnswers] = useState({}); // productId → "have" | "need"

  const plan = useMemo(() => {
    const ids = (answer) => Object.keys(answers).filter((id) => answers[id] === answer);
    return planRecipe(shop, state, recipe, { now: now.getTime(), have: ids("have"), need: ids("need") });
  }, [shop, state, recipe, now, answers]);

  const answer = (id, value) => setAnswers((current) => ({ ...current, [id]: value }));
  const of = (...statuses) => plan.lines.filter((line) => statuses.includes(line.status));
  const inCartForThis = Boolean(state.cartRecipes[shop.id]?.[recipe.id]);

  function confirm() {
    const ids = (value) => Object.keys(answers).filter((id) => answers[id] === value);
    notePantry(appStore, { have: ids("have"), need: ids("need") }, now.getTime());
    applyRecipePlan(appStore, shop, recipe, plan);
    setAnswers({});
    toast(plan.itemCount ? `Added ${plural(plan.itemCount, "item")} for ${recipe.name}` : `You have everything for ${recipe.name}`, {
      action: { label: "Undo", run: () => removeRecipeFromCart(appStore, shop.id, recipe.id) },
    });
  }

  return (
    <section className="planner" aria-labelledby="planner-title">
      <h2 id="planner-title">{plan.applied ? "In your cart" : "What you need to buy"}</h2>
      <p className="muted">
        Checked against your cart and what you've ordered before at Basketful. Shopping at{" "}
        <Link to={`/store/${shop.id}`}>{shop.name}</Link>.
      </p>

      {of("add").length > 0 && (
        <>
          <h3>{plan.applied ? "In your cart for this" : "Adding"} <span className="count">{of("add").length}</span></h3>
          <ul>
            {of("add").map((line) => (
              <Line key={line.product.id} line={line} shop={shop}>
                {!plan.applied && (
                  <button type="button" className="link-button" onClick={() => answer(line.product.id, "have")}>
                    I have this, skip it
                  </button>
                )}
              </Line>
            ))}
          </ul>
        </>
      )}

      {of("ask").length > 0 && (
        <>
          <h3>Quick question <span className="count">{of("ask").length}</span></h3>
          <ul>
            {of("ask").map((line) => (
              <Line key={line.product.id} line={{ ...line, reason: `${line.reason}. Still have it?` }} shop={shop}>
                <span className="plan-answer">
                  <button type="button" className="button secondary small" onClick={() => answer(line.product.id, "have")}>
                    Yes, I have it
                  </button>
                  <button type="button" className="button secondary small" onClick={() => answer(line.product.id, "need")}>
                    No, add it
                  </button>
                </span>
              </Line>
            ))}
          </ul>
        </>
      )}

      {of("have", "in_cart").length > 0 && (
        <>
          <h3>Skipping <span className="count">{of("have", "in_cart").length}</span></h3>
          <ul>
            {of("in_cart", "have").map((line) => (
              <Line key={line.product.id} line={line} shop={shop}>
                {line.status === "have" && (
                  <button type="button" className="link-button" onClick={() => answer(line.product.id, "need")}>
                    I'm out, add it
                  </button>
                )}
              </Line>
            ))}
          </ul>
        </>
      )}

      {of("out_of_stock", "unmatched").length > 0 && (
        <>
          <h3>Can't get here <span className="count">{of("out_of_stock", "unmatched").length}</span></h3>
          <ul>
            {of("out_of_stock", "unmatched").map((line) => (
              <Line key={line.product?.id ?? line.label} line={line} shop={shop}>
                {line.suggestions?.length > 0 && (
                  <span className="plan-reason">Closest in stock: {line.suggestions.map((p) => p.name).join(", ")}.</span>
                )}
              </Line>
            ))}
          </ul>
        </>
      )}

      <div className="planner-actions">
        {plan.applied ? (
          <>
            <p className="form-saved">✓ {plan.itemCount ? `${plural(plan.itemCount, "item")} in your cart for this recipe` : "You have everything for this"}</p>
            <button type="button" className="button secondary" onClick={() => removeRecipeFromCart(appStore, shop.id, recipe.id)}>
              Take it out of my cart
            </button>
          </>
        ) : (
          <button type="button" className="button wide" onClick={confirm}>
            <span>
              {plan.itemCount
                ? `${inCartForThis ? "Update cart" : "Add"} ${plural(plan.itemCount, "item")}`
                : "I have everything"}
            </span>
            {plan.itemCount > 0 && <span className="button-amount">{money(plan.cost)}</span>}
          </button>
        )}
        {!plan.applied && plan.questions.length > 0 && (
          <p className="fine-print">
            {plural(plan.questions.length, "question")} unanswered. We'll leave those out unless you say otherwise.
          </p>
        )}
      </div>

      <SampleHistory />
    </section>
  );
}
