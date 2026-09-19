// Writes evals/schema.json from the live tool definitions so `webmcp-evals
// local` always tests the same names, descriptions, and schemas the page
// registers. Run with `npm run evals:schema`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { stores } from "../src/data/stores.js";
import { getDeliveryWindows } from "../src/lib/deliveryWindows.js";
import { staticTools, setDeliveryOptions, placeOrderTool } from "../src/tools/definitions.js";
import { deliveryAddressTool } from "../src/tools/addressTool.js";

// A fixed mid-afternoon clock keeps the delivery window enum stable.
const windows = getDeliveryWindows(stores[0], new Date(2026, 8, 15, 14, 30));

const tools = [
  ...staticTools,
  deliveryAddressTool,
  setDeliveryOptions(windows.map((w) => w.label)),
  placeOrderTool,
].map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

const out = fileURLToPath(new URL("../evals/schema.json", import.meta.url));
writeFileSync(out, `${JSON.stringify({ tools }, null, 2)}\n`);
console.log(`Wrote ${tools.length} tools to evals/schema.json`);
