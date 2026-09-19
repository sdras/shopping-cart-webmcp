import { describe, it, expect } from "vitest";
import {
  staticTools,
  setDeliveryOptions,
  placeOrderTool,
  deliveryAddressForm,
} from "../src/tools/definitions.js";

const allTools = [...staticTools, setDeliveryOptions(["Today 4pm–6pm"]), placeOrderTool];

// Every `description` nested anywhere under a schema's properties.
function paramDescriptions(schema, path = "") {
  const found = [];
  for (const [name, prop] of Object.entries(schema?.properties ?? {})) {
    const here = path ? `${path}.${name}` : name;
    found.push({ path: here, name, description: prop.description });
    found.push(...paramDescriptions(prop, here));
    if (prop.items) found.push(...paramDescriptions(prop.items, `${here}[]`));
  }
  return found;
}

describe("tool definitions stay inside Chrome's recommended budgets", () => {
  it.each(allTools.map((t) => [t.name, t]))("%s", (_name, tool) => {
    expect(tool.name).toMatch(/^[a-z]+(_[a-z]+)*$/);
    expect(tool.name.length).toBeLessThanOrEqual(30);
    expect(tool.description.length).toBeLessThanOrEqual(500);
    expect(tool.inputSchema.type).toBe("object");

    for (const param of paramDescriptions(tool.inputSchema)) {
      expect(param.name.length, param.path).toBeLessThanOrEqual(30);
      expect(param.description, `${param.path} needs a description`).toBeTruthy();
      expect(param.description.length, param.path).toBeLessThanOrEqual(150);
    }
    for (const required of tool.inputSchema.required ?? []) {
      expect(tool.inputSchema.properties).toHaveProperty(required);
    }
  });

  it("names are unique", () => {
    const names = [...allTools.map((t) => t.name), deliveryAddressForm.name];
    expect(new Set(names).size).toBe(names.length);
  });

  it("labels read-only and consequential tools", () => {
    const hints = Object.fromEntries(allTools.map((t) => [t.name, t.annotations]));
    expect(hints.search_products.readOnlyHint).toBe(true);
    expect(hints.get_cart.readOnlyHint).toBe(true);
    expect(hints.get_order_status.readOnlyHint).toBe(true);
    expect(hints.place_order.consequentialHint).toBe(true);
    expect(hints.add_to_cart.readOnlyHint).toBe(false);
  });

  it("keeps the declarative form description in budget", () => {
    expect(deliveryAddressForm.name.length).toBeLessThanOrEqual(30);
    expect(deliveryAddressForm.description.length).toBeLessThanOrEqual(500);
  });
});
