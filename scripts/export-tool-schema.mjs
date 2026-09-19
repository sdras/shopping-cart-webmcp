// Writes evals/schema.json from the live tool definitions so `webmcp-evals
// local` always tests the same names, descriptions, and schemas the page
// registers. Run with `npm run evals:schema`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { stores } from "../src/data/stores.js";
import { getDeliveryWindows } from "../src/lib/deliveryWindows.js";
import {
  staticTools,
  setDeliveryOptions,
  placeOrderTool,
  deliveryAddressForm,
} from "../src/tools/definitions.js";

// A fixed mid-afternoon clock keeps the delivery window enum stable.
const windows = getDeliveryWindows(stores[0], new Date(2026, 8, 15, 14, 30));

// What Chrome derives from the declarative address form on the checkout page.
const addressTool = {
  ...deliveryAddressForm,
  inputSchema: {
    type: "object",
    properties: {
      street: { type: "string", description: "Street number and name, e.g. '742 Evergreen Terrace'." },
      unit: { type: "string", description: "Apartment, suite, or unit number. Leave empty for a house." },
      city: { type: "string", description: "City name." },
      zip: { type: "string", description: "5-digit US ZIP code, e.g. '94110'." },
      instructions: { type: "string", description: "Notes for the driver, such as a gate code or where to leave the bags." },
    },
    required: ["street", "city", "zip"],
  },
};

const tools = [
  ...staticTools,
  addressTool,
  setDeliveryOptions(windows.map((w) => w.label)),
  placeOrderTool,
].map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

const out = fileURLToPath(new URL("../evals/schema.json", import.meta.url));
writeFileSync(out, `${JSON.stringify({ tools }, null, 2)}\n`);
console.log(`Wrote ${tools.length} tools to evals/schema.json`);
