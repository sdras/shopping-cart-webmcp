import { money } from "../lib/format.js";

/**
 * Grocery-flyer pricing: big dollars, raised cents. Screen readers get the
 * plain "$3.99".
 */
export default function Price({ amount, size = "" }) {
  const [dollars, cents] = amount.toFixed(2).split(".");
  return (
    <span className={`price ${size}`.trim()}>
      <span className="visually-hidden">{money(amount)}</span>
      <span aria-hidden="true">
        <sup>$</sup>
        {dollars}
        <sup>{cents}</sup>
      </span>
    </span>
  );
}
