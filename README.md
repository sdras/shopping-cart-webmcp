# shopping-cart-webmcp

**Basketful** is a grocery delivery demo (think Instacart, with made-up stores) where the whole
shopping journey is exposed to browser agents through [WebMCP](https://github.com/webmachinelearning/webmcp).
A person can click through it like any shop. An agent can do the same trip with ten tools and never
touch the DOM.

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
- **A tool must outlive its own call.** `place_order` empties the cart, which is exactly what
  disables it. Unregistering mid-call loses the result (Chrome < 153), so `useTool` keeps a tool
  registered until its call has reported back, and the checkout tools mount at the app root.

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
tests/           handler + definition tests (Vitest, no browser needed)
evals/           tool-selection evals for webmcp-evals
```

State lives outside React (`useSyncExternalStore`) so a handler can change the cart and read the
new totals in the same tick. People and agents share code paths: the checkout button calls the same
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
