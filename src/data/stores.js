// Fictional stores. Every store carries the shared catalog; `priceFactor`
// scales the base prices and `outOfStock` lists product ids that store is
// currently missing (handy for exercising "out of stock" tool errors).
export const stores = [
  {
    id: "greenleaf",
    name: "Greenleaf Market",
    tagline: "Everyday groceries, big produce aisle",
    emoji: "🥬",
    hue: 148,
    eta: "45 min",
    deliveryFee: 3.99,
    freeDeliveryOver: 35,
    minimumOrder: 10,
    priceFactor: 1,
    outOfStock: ["raspberries", "sourdough", "oat-milk-barista"],
  },
  {
    id: "harbor",
    name: "Harbor Foods Co-op",
    tagline: "Organic, local, and bulk pantry staples",
    emoji: "⚓",
    hue: 205,
    eta: "60 min",
    deliveryFee: 5.99,
    freeDeliveryOver: 50,
    minimumOrder: 15,
    priceFactor: 1.18,
    outOfStock: ["hot-dogs", "cola", "frozen-pizza-pepperoni"],
  },
  {
    id: "penny",
    name: "Penny Pantry",
    tagline: "Low prices on the basics",
    emoji: "🪙",
    hue: 38,
    eta: "75 min",
    deliveryFee: 1.99,
    freeDeliveryOver: 25,
    minimumOrder: 10,
    priceFactor: 0.86,
    outOfStock: ["salmon", "avocado", "kombucha", "goat-cheese", "shrimp"],
  },
];

export const storesById = Object.fromEntries(stores.map((s) => [s.id, s]));

export function findStore(nameOrId) {
  if (!nameOrId) return null;
  const needle = String(nameOrId).trim().toLowerCase();
  return (
    stores.find((s) => s.id === needle || s.name.toLowerCase() === needle) ||
    stores.find((s) => s.name.toLowerCase().includes(needle)) ||
    null
  );
}
