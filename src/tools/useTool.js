import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useWebMCP } from "use-webmcp-tool";
import { appStore } from "../state/app.js";
import { openCart, closeCart, showProduct, toast, logToolCall } from "../state/uiStore.js";
import { ToolError } from "./handlers.js";
import { registerLocalTool } from "./registry.js";

// Agents plan from what's on screen, so a tool reports back only once the
// page has painted its result. The timeout covers background tabs, where
// requestAnimationFrame doesn't fire.
const nextPaint = () =>
  new Promise((resolve) => {
    const fallback = setTimeout(resolve, 150);
    requestAnimationFrame(() => {
      clearTimeout(fallback);
      setTimeout(resolve, 0);
    });
  });

/** Everything a handler needs from the running app. */
export function useToolContext() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      app: appStore,
      now: () => new Date(),
      openCart,
      notify: (message) => toast(message, { agent: true }),
      navigate(to) {
        // Clear overlays so the shopper can see where the agent went.
        closeCart();
        showProduct(null);
        navigate(to);
      },
    }),
    [navigate]
  );
}

const UNEXPECTED =
  "Something went wrong on the page while running this tool. It is safe to try once more; if it fails again, ask the shopper to finish this step by hand.";

/**
 * Registers one WebMCP tool while the calling component is mounted and
 * `enabled` is true.
 *
 * A call can change the very state that enables its tool (place_order empties
 * the cart). Unregistering mid-call loses the result in Chrome before 153, so
 * the tool stays registered until shortly after the call has reported back.
 *
 * The same tool, under the same conditions, also goes in the page's own
 * registry, which is how the built-in assistant works in browsers that have
 * no WebMCP at all.
 */
export function useTool(definition, handler, ctx, { enabled = true } = {}) {
  const [inFlight, setInFlight] = useState(0);
  const active = enabled || inFlight > 0;

  async function execute(input) {
    const args = input ?? {};
    // Committed before the handler runs so no state change it makes can
    // render with the tool disabled.
    flushSync(() => setInFlight((n) => n + 1));
    try {
      const output = await handler(args, ctx);
      await nextPaint();
      logToolCall({ name: definition.name, input: args, output, ok: true });
      return output;
    } catch (error) {
      const expected = error instanceof ToolError;
      if (!expected) console.error(`[${definition.name}]`, error);
      const message = expected ? error.message : UNEXPECTED;
      logToolCall({ name: definition.name, input: args, output: message, ok: false });
      throw new Error(message);
    } finally {
      setTimeout(() => setInFlight((n) => n - 1), 300);
    }
  }

  // Read through a ref, as useWebMCP does, so a new closure every render
  // doesn't mean a new registration every render.
  const latest = useRef(execute);
  useEffect(() => {
    latest.current = execute;
  });
  useEffect(() => {
    if (!active) return;
    return registerLocalTool(definition, (input) => latest.current(input));
  }, [active, definition]);

  return useWebMCP({
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema,
    annotations: definition.annotations,
    enabled: active,
    execute,
  });
}
