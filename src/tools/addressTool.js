// The delivery address tool with its schema spelled out. Chrome derives this
// from the declarative form on the checkout page (its field names, `required`,
// and `toolparamdescription` attributes); anything that can't read the form,
// like the evals export and the built-in assistant, reads it here. Keep the
// two in step.
import { deliveryAddressForm } from "./definitions.js";

export const deliveryAddressTool = {
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
