// webmcp-bridge.js
//
// Turns Claude Code into a WebMCP client. Run this whole file once per page
// load with the Chrome extension's javascript_tool; it installs
// `window.__webmcp` and answers "webmcp bridge ready: N tools" (or NO_WEBMCP).
//
//   await __webmcp.list()                     names + one-line summaries
//   await __webmcp.describe("add_to_cart")    full description + input schema
//   await __webmcp.call("add_to_cart", {...}) run a tool, get its text back
//   __webmcp.more(900)                        next page of a long result
//
// Why a bridge at all: the real API wants the tool *object* from getTools()
// and a JSON *string* of arguments, and answers with a JSON string. And
// javascript_tool truncates long return values, so results are paged.
await (async () => {
  const context = document.modelContext;
  if (!context || typeof context.getTools !== "function") return "NO_WEBMCP";

  const PAGE = 900;
  let last = "";

  const page = (from = 0) => {
    const chunk = last.slice(from, from + PAGE);
    const left = last.length - (from + chunk.length);
    return left > 0 ? `${chunk}\n[${left} more characters. Next page: __webmcp.more(${from + PAGE})]` : chunk;
  };

  const readResult = (raw) => {
    if (raw == null) return "(No result: the tool navigated to a new page. Run the bridge again there.)";
    let result = raw;
    if (typeof raw === "string") {
      try {
        result = JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    if (typeof result === "string") return result;
    const text = (result.content ?? []).map((block) => block.text ?? "").join("\n") || JSON.stringify(result);
    return result.isError ? `ERROR: ${text}` : text;
  };

  const hints = (tool) =>
    [tool.annotations?.readOnlyHint && "read-only", tool.annotations?.consequentialHint && "CONSEQUENTIAL"]
      .filter(Boolean)
      .join(", ");

  const schemaOf = (tool) =>
    typeof tool.inputSchema === "string" ? tool.inputSchema : JSON.stringify(tool.inputSchema ?? {});

  window.__webmcp = {
    // Tools come and go with page state (checkout-only tools, for one), so
    // every call re-reads the list instead of caching tool objects.
    async list() {
      const tools = await context.getTools();
      last = tools
        .map((tool) => {
          const summary = (tool.description ?? "").split(/(?<=\.)\s/)[0];
          return `${tool.name}${hints(tool) ? ` [${hints(tool)}]` : ""}: ${summary}`;
        })
        .join("\n");
      return page();
    },

    async describe(name) {
      const tool = (await context.getTools()).find((t) => t.name === name);
      if (!tool) return `ERROR: no tool named "${name}" on this page right now.`;
      last = `${tool.name}${hints(tool) ? ` [${hints(tool)}]` : ""}\n${tool.description}\nInput schema: ${schemaOf(tool)}`;
      return page();
    },

    async call(name, args = {}) {
      const tools = await context.getTools();
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        return `ERROR: no tool named "${name}" on this page right now. Available: ${tools.map((t) => t.name).join(", ")}`;
      }
      try {
        last = readResult(await context.executeTool(tool, JSON.stringify(args)));
      } catch (error) {
        last = `ERROR: ${error.name}: ${error.message}`;
      }
      return page();
    },

    more: (from) => page(from),
  };

  return `webmcp bridge ready: ${(await context.getTools()).length} tools`;
})()
