// The text side of a Gemini Live turn, kept apart from the socket so it can
// be tested.
//
// Gemini sometimes collapses: instead of words or a function call it emits a
// run of tokenizer control tokens (`<ctrl46><ctrl46>…`) and ends the turn, so
// the shopper sees junk and nothing happens. The tracker strips the tokens
// from what is shown and says, at the end of a turn, whether the turn was such
// a collapse and whether asking once more is due.

const CONTROL = /<ctrl\d+>/g;

/** What the model said, without tokenizer control tokens. */
export const stripControl = (s) => s.replace(CONTROL, "");

/**
 * How a turn went, from `complete()`:
 * "fine" (words or a tool call), "empty" (nothing, and no sign of a collapse),
 * "retry" (only control tokens: ask the same thing again), or "give-up"
 * (collapsed again right after a retry: leave it to the person).
 */
export class TurnTracker {
  control = false;
  tool = false;
  words = false;
  retried = false;

  /** Note a piece of the model's text; returns what is fit to show. */
  note(raw) {
    if (/<ctrl\d+>/.test(raw)) this.control = true;
    const text = stripControl(raw);
    if (text.trim()) this.words = true;
    return text;
  }

  toolCalled() {
    this.tool = true;
  }

  /** The turn was cut off: forget it without judging it. */
  reset() {
    this.control = this.tool = this.words = false;
  }

  complete() {
    const productive = this.tool || this.words;
    const collapsed = this.control && !productive;
    this.reset();
    if (!collapsed) {
      if (productive) this.retried = false;
      return productive ? "fine" : "empty";
    }
    if (this.retried) return "give-up";
    this.retried = true;
    return "retry";
  }
}

/**
 * A tool description short enough not to weigh on the session: cut at the last
 * full sentence within the budget. Basketful's own descriptions already fit
 * (tests/definitions.test.js holds them to 500), so this is a guard for
 * whatever gets registered later.
 */
export function briefDescription(text, max = 500) {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const stop = Math.max(head.lastIndexOf(". "), head.lastIndexOf(".\n"));
  // A sentence break too early would leave almost nothing; then a plain cut says more.
  return stop >= max / 4 ? head.slice(0, stop + 1) : `${head.trimEnd()}…`;
}
