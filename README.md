# Shopping Cart WebMCP Demo

**Basketful** is a grocery delivery demo, where the shopping journey is exposed to browser agents through [WebMCP](https://github.com/webmachinelearning/webmcp), ([explainer](https://webmcp-demo-sdras.netlify.app/)).
A person can click through it like any shop. An agent can do the same trip with voice activation, and tools that activate actions and flows in the shop.

It's just a demo, nothing is charged and nobody's coming with your groceries. Created for education and inspiration.

## Run it

```bash
npm install
npm run dev
```

To let an agent drive, use Chrome 149+ with `chrome://flags/#enable-webmcp-testing` (add
`#devtools-webmcp-support` for the DevTools pane). Without WebMCP the site still works, you can think of the tools
like a progressive enhancement.

Then pop open the "Ask or Say" in the bottom left corner and put in a Gemini API key.

You can also test this out with Jev! I made a [Chrome Extension](https://github.com/sdras/jev-webmcp-extension) so you can see how Jev and WebMCP interact, it's a slightly different mental model!

The 🤖 **Agent tools** pill in the bottom corner lists what's registered on the current page and
logs each call with its input and output.

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
| `add_recipe_to_cart` | everywhere | A site recipe or any ingredient list → only what's missing, with its reasoning and the questions to ask | |
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

## Recipes, with a memory of what's in the users pantry

Adding a recipe isn't "add nine things". For each ingredient the planner (`src/lib/recipes.js`)
decides, and says why:

| Verdict | When | What it says |
| --- | --- | --- |
| already in the cart | it's in the basket and no other recipe has dibs on it | "Already in your cart." |
| have it | a cupboard item (oregano, oil, salt) bought within its shelf life | "Bought 2 months ago, keeps about 2 years." |
| ask | bought recently enough that it might still be there | "Bought 5 days ago. Still have it?" |
| add | never bought, **or bought so long ago it must be gone** | "Last bought 2 weeks ago, keeps about 7 days: assuming it's gone." |

Every guess takes a tap to correct ("I have this", "I'm out"), and corrections are remembered
until the thing is bought again. Shelf lives and "lasts many uses" live with the products.

**Dedup is included.** Each recipe records what it *uses* and what it *added*. Applying
a recipe takes its old additions out before putting the new plan in, so applying twice, or again
with different answers, never doubles anything. Bags and jars are shared between recipes (one
bunch of cilantro does tacos and guacamole); things sold one at a time are counted (two recipes
that each want 2 limes want 4). Taking a recipe out of the cart removes what it added, except a
shared bag another recipe still needs.

For agents it's one tool, `add_recipe_to_cart`: pass `recipe` (an enum of the site's recipes) or
`ingredients` exactly as any recipe writes them ("2 large tomatoes, diced"). It adds what's
certain, states its assumptions, and returns the questions. The agent relays them and calls again
with `already_have` / `need`; `preview: true` answers "what would I need?" without touching the
cart. Loose ingredient matches are reported ("tomatoes → Tomatoes on the Vine (or Diced
Tomatoes)") so the agent can correct them.

Pantry memory needs a past, so the recipe pages offer a one-click **sample order history**
(spices two months ago, tomatoes two weeks ago, eggs last week) and a one-click way to remove it.

## Skills + WebMCP: your list, the site's tools

`skills/grocery-staples/` is an Agent Skill that pairs with the site. The split is the point:

- **The list belongs to the person.** `staples.md` holds what they buy, how many, and what to do
  when something's out ("Oat Milk ×2. Barista is fine. Never almond."). It travels with them, not
  with one store's localStorage.
- **The capabilities belong to the site.** The skill never clicks through the shop. It calls
  `choose_store` → `update_staples` (sync the list, with each row's out-of-stock note as a rule)
  → `add_staples_to_cart` (swaps and skips happen here) → `get_cart`, and stops at the cart.

Install it, edit the list, then say "add my staples" (example):

```bash
cp -R skills/grocery-staples ~/.claude/skills/
$EDITOR ~/.claude/skills/grocery-staples/staples.md
```

Because the list is synced into the site, the person can also hit **Add all to cart** on the
"Your staples" shelf, and any other agent can call `add_staples_to_cart` without the skill.

## The assistant that lives on the page

Not everyone shows up with an agent, so the site also brings one. **Ask or say…** in the bottom-left
corner (or ⌘J) opens voice and chat: a [Gemini Live](https://ai.google.dev/gemini-api/docs/live)
session that hears, speaks, types, and shops. It needs a Gemini API key, which stays in this
browser under its own localStorage entry, apart from the cart, where no tool can read it.

It has no tools of its own by design.

The voice visualizer is one three.js quad with everything in the fragment shader: four
translucent layers of mirrored wave, tapering to a centre line, in greens through to carrot. It
responds to voice. An `AnalyserNode` on the microphone or the speaker is cut into eight voice
bands, low in the middle and high at the tips, so a vowel swells the centre and an "s" flickers
at the ends; with nothing to hear it breathes (idle) or ripples outward (thinking). three.js only
loads when the panel first opens. The launcher is the same picture as plain SVG, which also
stands in wherever WebGL is missing. With reduced motion the layers hold still and only a real
voice moves them.

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
    registry.js      the same live tools, by name, for the built-in assistant
    addressTool.js   the address form's schema, for whoever can't read the form
    ShoppingTools.jsx, CheckoutTools.jsx
  assistant/     voice and chat: Gemini Live client, tool runner + undo, panel, voice visualizer
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

Requires Node 20+.
