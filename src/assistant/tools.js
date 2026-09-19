// How the built-in assistant sees and runs the page's tools. It has no tools
// of its own: it reads the same registry `useTool` fills for WebMCP, so
// whatever a browser agent could do on this page right now, it can do, and
// nothing more. Free of React and of the app singleton so it can be tested.
import { getLocalTool, localTools } from "../tools/registry.js";
import { setDeliveryOptions, placeOrderTool } from "../tools/definitions.js";
import { deliveryAddressTool } from "../tools/addressTool.js";
import { briefDescription } from "./geminiText.js";

// A Live session declares its functions once, when it opens, but the checkout
// tools only exist while the checkout page shows a cart that can be ordered.
// So they are always declared, and calling one from anywhere else comes back
// as an error that says how to get there. The delivery window loses its enum:
// the windows move with the clock and a session can outlast them; the handler
// checks the label and start_checkout lists the live ones.
function checkoutTools() {
  const options = setDeliveryOptions([]);
  const { enum: _movesWithTheClock, ...deliveryWindow } = options.inputSchema.properties.delivery_window;
  return [
    deliveryAddressTool,
    {
      ...options,
      inputSchema: {
        ...options.inputSchema,
        properties: {
          ...options.inputSchema.properties,
          delivery_window: {
            ...deliveryWindow,
            description: `${deliveryWindow.description} Use a window exactly as start_checkout lists it.`,
          },
        },
      },
    },
    placeOrderTool,
  ];
}

const CHECKOUT_ONLY = new Set(checkoutTools().map((tool) => tool.name));

/** Every tool the assistant should know about: what is live now, plus the checkout tools. */
export function toolDefinitions() {
  const live = localTools().map((tool) => tool.definition);
  const names = new Set(live.map((definition) => definition.name));
  return [...live, ...checkoutTools().filter((tool) => !names.has(tool.name))];
}

/* ————— schemas ————— */

/** The subset of JSON Schema the Gemini API accepts in function parameters. */
const SCHEMA_KEYS = new Set([
  "type", "description", "enum", "properties", "required", "items", "nullable", "format",
  "minItems", "maxItems", "minimum", "maximum", "minLength", "maxLength", "pattern", "anyOf", "default",
]);

/** Keep the keys Gemini knows and spell types the way its Schema type does. */
export function geminiSchema(schema) {
  if (!schema || typeof schema !== "object") return undefined;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!SCHEMA_KEYS.has(key)) continue;
    if (key === "type" && typeof value === "string") out.type = value.toUpperCase();
    else if (key === "properties" && value && typeof value === "object") {
      out.properties = Object.fromEntries(Object.entries(value).map(([name, s]) => [name, geminiSchema(s)]));
    } else if (key === "items") out.items = geminiSchema(value);
    else if (key === "anyOf" && Array.isArray(value)) out.anyOf = value.map(geminiSchema);
    else out[key] = value;
  }
  return out;
}

/** Tool definitions as Gemini function declarations; a tool without inputs declares no parameters. */
export function functionDeclarations(definitions = toolDefinitions()) {
  return definitions.map((definition) => {
    const parameters = geminiSchema(definition.inputSchema);
    const hasInputs = parameters?.properties && Object.keys(parameters.properties).length > 0;
    return {
      name: definition.name,
      description: briefDescription(definition.description),
      ...(hasInputs ? { parameters } : {}),
    };
  });
}

/* ————— running ————— */

const MAX_OUTPUT = 4000;

const clipOutput = (text) =>
  text.length <= MAX_OUTPUT ? text : `${text.slice(0, MAX_OUTPUT - 12).replace(/\s+\S*$/, "")} … (more)`;

/**
 * What a receipt needs to take a call back: the shopping state on either side
 * of it. Which store is open doesn't count as a change worth undoing, and an
 * order that was placed stays placed.
 */
function undoFor(definition, before, after) {
  if (definition?.annotations?.consequentialHint) return null;
  const changed = Object.keys(after).some((key) => key !== "storeId" && after[key] !== before[key]);
  return changed ? { before, after } : null;
}

/**
 * Run one tool by name against the live registry. Never throws: a failure is
 * a result with `error: true` whose text tells the model what to do next, the
 * same text a WebMCP agent would get.
 */
export async function runTool(name, args, app) {
  const tool = getLocalTool(name);
  const before = app.getState();
  let text;
  let error = false;
  if (!tool) {
    error = true;
    text = CHECKOUT_ONLY.has(name)
      ? `${name} only works on the checkout page, with a cart that can be ordered. Call start_checkout first.`
      : `No tool called "${name}".`;
  } else {
    try {
      text = clipOutput(String((await tool.execute(args ?? {})) ?? "Done."));
    } catch (problem) {
      error = true;
      text = problem?.message || String(problem);
    }
  }
  return { text, error, undo: error ? null : undoFor(tool?.definition, before, app.getState()) };
}

/** A call can be taken back only while nothing has changed since it ran. */
export const canUndo = (undo, app) => Boolean(undo) && app.getState() === undo.after;

export function applyUndo(undo, app) {
  if (!canUndo(undo, app)) return false;
  app.setState((s) => ({ ...undo.before, storeId: s.storeId }));
  return true;
}
