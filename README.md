# shopping-cart-webmcp

**Basketful** is a grocery delivery demo (think Instacart, with made-up stores) where the whole
shopping journey is exposed to browser agents through [WebMCP](https://github.com/webmachinelearning/webmcp).
A person can click through it like any shop. An agent can do the same trip with thirteen tools and
never touch the DOM.

Pick a store → search → fill a cart → choose a delivery window → place the order → watch it arrive.

Nothing is charged and nobody is coming with your groceries.

## Run it

```bash
npm install
npm run dev
```

To let an agent drive, use Chrome 149+ with `chrome://flags/#enable-webmcp-testing` (add
`#devtools-webmcp-support` for the DevTools pane). Without WebMCP the site still works; the tools
are a progressive enhancement.

The 🤖 **Agent tools** pill in the bottom corner lists what's registered on the current page and
logs every call with its input and output.

## The tools

| Tool | Where | What it does | Hint |
| --- | --- | --- | --- |
| `choose_store` | everywhere | Open a store; each has its own cart, prices, fees | |
| `search_products` | everywhere | Query, department, dietary, and price filters; mirrors results on the page | read-only |
| `add_to_cart` | everywhere | Add a whole list by product name in one call | |
| `update_cart_item` | everywhere | Set an exact quantity, or 0 to remove | |
| `get_cart` | everywhere | Items, fees, total, order minimum; opens the cart drawer | read-only |
| `get_staples` | everywhere | The saved staples list, with stock and cart state at the open store | read-only |
| `update_staples` | everywhere | Save, change, or remove staples and their out-of-stock rule; a whole list in one call | |
| `add_staples_to_cart` | everywhere | Top the cart up to the usual quantity of every staple, applying swap/skip rules | |
| `start_checkout` | everywhere | Go to checkout; returns windows and what's still missing | |
| `get_order_status` | everywhere | Stage, shopper, items, total; opens the tracking page | read-only |
| `set_delivery_address` | checkout | **Declarative**: a plain `<form toolname>` | |
| `set_delivery_options` | checkout | Delivery window, tip (`"$5"`, `"15%"`, `"none"`), replacements | |
| `place_order` | checkout | Places the order | consequential |

A few choices worth knowing about:

- **Names, not ids.** Agents refer to products by the names `search_products` returns. An
  ambiguous name ("milk") comes back with the candidates so the agent can ask the shopper.
- **Errors tell the agent what to do next.** "No store is open yet. Call choose_store first with
  one of: …", "Add $3.50 more before checking out."
- **Partial success is reported, not hidden.** `add_to_cart` says what went in and why the rest
  didn't (out of stock, not found, ambiguous).
- **Checkout tools are dynamic.** `set_delivery_options` and `place_order` only exist while the
  checkout page is showing an orderable cart. The delivery window `enum` is rebuilt as the clock moves.
- **The page shows what the agent is doing.** Searches navigate, `get_cart` opens the drawer,
  adds raise a toast, and a tool only reports back after the page has painted.
- **"The usual" is idempotent.** `add_staples_to_cart` tops the cart up to each staple's usual
  quantity instead of adding it again, so an agent that retries, or a person who taps "Add all"
  twice, doesn't end up with twelve bananas. It reports what it added, what was already there, and
  what's out of stock with a nudge toward `search_products` for a substitute.
- **A tool must outlive its own call.** `place_order` empties the cart, which is exactly what
  disables it. Unregistering mid-call loses the result (Chrome < 153), so `useTool` keeps a tool
  registered until its call has reported back, and the checkout tools mount at the app root.

## Usuals: staples nobody has to author

Tools call them staples; the page calls them "Your usuals". The flow is built so a person never
sits down to make a list:

1. **After an order**, the confirmation page asks "Buy any of these every time?" with the items
   as tappable chips, quantities as bought, things ordered before already selected. The cart they
   just built is the list.
2. **Once there's history**, `/usuals` offers "You keep buying these" with a one-tap yes and a no
   that stays no.
3. **The payoff**: an empty cart opens with "Start with your usual? 20 items, about $85" and one
   button. The toast says what happened and offers Undo.
4. **Out-of-stock rules accrue from decisions, not forms.** When a usual is out: swap it for the
   closest match *just today*, *always*, or *skip it when it's out*. "Always" and "skip" become
   rules the next top-up follows on its own. Stand-ins have to be the same kind of thing
   (`similarProducts`); when nothing is, it says so instead of offering limes for avocados.

The site nudges an agent at the same moments it nudges a person: `place_order` mentions repeat
purchases that aren't staples yet, and `add_staples_to_cart` reports a rule-less out-of-stock item
with its closest matches and how to save the answer (`update_staples` → `if_out_of_stock`).

## Skills + WebMCP: your list, the site's tools

`skills/grocery-staples/` is an [Agent Skill](https://docs.claude.com/en/docs/claude-code/skills)
that pairs with the site. The split is the point:

- **The list belongs to the person.** `staples.md` holds what they buy, how many, and what to do
  when something's out ("Oat Milk ×2. Barista is fine. Never almond."). It travels with them, not
  with one store's localStorage.
- **The capabilities belong to the site.** The skill never clicks through the shop. It calls
  `choose_store` → `update_staples` (sync the list, with each row's out-of-stock note as a rule)
  → `add_staples_to_cart` (swaps and skips happen here) → `get_cart`, and stops at the cart.

Claude Code has no built-in WebMCP client, so the skill ships a small bridge,
`scripts/webmcp-bridge.js`. Run it in the page with the Chrome extension's `javascript_tool` and
you get `__webmcp.list()`, `.describe(name)`, and `.call(name, args)` over `document.modelContext`,
with long results paged. `references/calling-webmcp-tools.md` has the API details and the traps.

Install it, edit the list, then say "add my staples":

```bash
cp -R skills/grocery-staples ~/.claude/skills/
$EDITOR ~/.claude/skills/grocery-staples/staples.md
```

Because the list is synced into the site, the person can also hit **Add all to cart** on the
"Your staples" shelf, and any other agent can call `add_staples_to_cart` without the skill.

## How it's put together

```
src/
  data/          stores and the product catalog
  lib/           search, pricing, delivery windows (pure functions)
  state/         a tiny external store + localStorage persistence
  tools/
    definitions.js   names, descriptions, schemas, annotations
    handlers.js      tool logic, no React, returns strings / throws ToolError
    useTool.js       wraps use-webmcp-tool: paint-then-report, logging, in-flight guard
    ShoppingTools.jsx, CheckoutTools.jsx
  components/, pages/
skills/          the grocery-staples agent skill and its WebMCP bridge
tests/           handler, definition, and cross-tab tests (Vitest, no browser needed)
evals/           tool-selection evals for webmcp-evals
```

State lives outside React (`useSyncExternalStore`) so a handler can change the cart and read the
new totals in the same tick. It's saved to localStorage and follows other tabs through `storage`
events, so a cart an agent fills in one tab appears in the tab you're watching. A tab applies the
other tab's snapshot and never writes it back; echoing it races newer writes and rolls the cart back. People and agents share code paths: the checkout button calls the same
`placeOrder` handler the tool does, and the address form has one submit handler for both.

Tools are registered with [`use-webmcp-tool`](https://github.com/GoogleChromeLabs/use-webmcp-tool).

## Test it

```bash
npm test                 # tool logic + description/schema budgets
npm run evals:schema     # regenerate evals/schema.json from the live definitions
```

Then, from a checkout of [webmcp-tools](https://github.com/GoogleChromeLabs/webmcp-tools)' `evals-cli`:

```bash
npx webmcp-evals local -t path/to/evals/schema.json -e path/to/evals/evals.json
```

`tests/definitions.test.js` enforces Chrome's recommended budgets: tool names ≤ 30 characters,
descriptions ≤ 500, parameter descriptions ≤ 150.

To poke a tool by hand without a model:

```js
const tools = await document.modelContext.getTools();
const search = tools.find((t) => t.name === "search_products");
await document.modelContext.executeTool(search, JSON.stringify({ query: "tortillas" }));
```

Orders move through their stages on a demo clock: placed → shopping (15s) → out for delivery (45s)
→ delivered (90s).

Requires Node 20+.
