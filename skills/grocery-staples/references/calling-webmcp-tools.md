# Calling a page's WebMCP tools from Claude Code

Claude Code has no built-in WebMCP client. It does have the Chrome extension's `javascript_tool`,
which runs JavaScript in the page, and the page has `document.modelContext`. That's the whole
trick: the agent side of WebMCP, done from inside the page. Verified against Chrome 152.

## The raw API

```js
const tools = await document.modelContext.getTools();   // async; array of tool objects
// { name, description, inputSchema, annotations: { readOnlyHint, ... } }

const tool = tools.find((t) => t.name === "add_to_cart");
const raw = await document.modelContext.executeTool(tool, JSON.stringify({ items: [...] }));
// raw is a JSON *string*: {"content":[{"type":"text","text":"..."}],"isError":true?}
```

Three things that bite:

- `executeTool` wants the **tool object** from `getTools()`, not its name
  (`TypeError: not of type 'RegisteredTool'`).
- Arguments are a **JSON string**, not an object (`UnknownError: Failed to parse input arguments`).
- The result is a JSON string too, and failures arrive as `isError: true`, not as a rejection.
  A rejection means something broke (or the tool was unregistered mid-call).

`scripts/webmcp-bridge.js` wraps all three: `__webmcp.call(name, args)` takes a plain object and
hands back plain text, prefixed `ERROR:` when the tool reported a failure.

## Traps

- **`javascript_tool` truncates long return values** (roughly 1,000 characters) and blocks output
  that looks like cookies or a query string (`a=1; b=2`). The bridge pages every result at 900
  characters; when you see `Next page: __webmcp.more(900)`, call it.
- **The bridge lives on `window`.** Client-side navigation keeps it; a full page load drops it.
  If `__webmcp` is undefined, run the file again.
- **Tools appear and disappear with page state.** Basketful registers `set_delivery_address`,
  `set_delivery_options`, and `place_order` only while the checkout page is showing an orderable
  cart. Re-run `__webmcp.list()` after anything that changes the page. The bridge re-reads the
  tool list on every call for the same reason; never cache a tool object.
- **`executeTool` resolves `null` when the tool navigates to a new document.** The bridge says so.
  Re-install it on the new page and check state with a read-only tool.
- **Declarative tools** (a `<form toolname>`) are called exactly like imperative ones. The browser
  fills the form; you still get text back.
- **Read the hints.** `read-only` tools are safe to call freely. `CONSEQUENTIAL` means stop and get
  the user's yes first. Note that Chrome 152 doesn't reflect `consequentialHint` back through
  `getTools()`, so also read the description: if it says it buys, books, pays, sends, or deletes,
  treat it as consequential.
- **Errors are written for you.** Good WebMCP tools say what to do next ("No store is open yet.
  Call choose_store first with one of: ..."). Do that, rather than retrying the same call.

## Shape of a session

```js
// 1. once per page load: run scripts/webmcp-bridge.js   → "webmcp bridge ready: 10 tools"
await __webmcp.list()
await __webmcp.describe("add_staples_to_cart")
await __webmcp.call("choose_store", { store: "Greenleaf Market" })
await __webmcp.call("add_staples_to_cart", { skip: ["Large Eggs"] })
await __webmcp.call("get_cart")
```

One `javascript_tool` call per tool call keeps each result readable. If you batch several in one
script, return them joined with a separator and expect to page.
