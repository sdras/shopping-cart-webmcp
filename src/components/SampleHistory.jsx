import { appStore, useApp } from "../state/app.js";
import { loadSampleHistory, removeSampleHistory } from "../state/appStore.js";

/**
 * Pantry memory needs a past, and a fresh demo doesn't have one. This offers
 * to load one: spices from two months ago, tomatoes from two weeks ago, eggs
 * from last week.
 */
export default function SampleHistory() {
  const orders = useApp((s) => s.orders);
  const loaded = orders.some((order) => order.sample);

  if (loaded) {
    return (
      <p className="sample-history">
        Using a sample order history (spices 2 months ago, tomatoes 2 weeks ago, eggs last week).{" "}
        <button type="button" className="link-button" onClick={() => removeSampleHistory(appStore)}>
          Remove it
        </button>
      </p>
    );
  }
  return (
    <p className="sample-history">
      Basketful guesses what's in your kitchen from your order history. New here?{" "}
      <button type="button" className="link-button" onClick={() => loadSampleHistory(appStore)}>
        Load a sample history
      </button>{" "}
      to see it work.
    </p>
  );
}
