import { clock } from "./format.js";

export const PRIORITY_FEE = 2;

const OPEN_HOUR = 8;
const CLOSE_HOUR = 22;
const SLOT_HOURS = 2;
const MAX_WINDOWS = 8;

const dayStart = (date, offsetDays) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays);

/**
 * Delivery windows for a store as of `now`. Labels ("Today 4pm–6pm") double
 * as ids so agents and people refer to a window the same way.
 */
export function getDeliveryWindows(store, now = new Date()) {
  const windows = [];
  const hour = now.getHours();

  if (hour >= OPEN_HOUR && hour < CLOSE_HOUR - 1) {
    windows.push({
      id: "Priority",
      label: `Priority (within ${store.eta})`,
      day: "Today",
      fee: PRIORITY_FEE,
      priority: true,
    });
  }

  for (const [offset, day] of [[0, "Today"], [1, "Tomorrow"]]) {
    const base = dayStart(now, offset);
    for (let h = OPEN_HOUR; h + SLOT_HOURS <= CLOSE_HOUR; h += SLOT_HOURS) {
      const start = new Date(base.getTime());
      start.setHours(h);
      // Shoppers need at least an hour of lead time before a window opens.
      if (start.getTime() - now.getTime() < 60 * 60 * 1000) continue;
      const end = new Date(base.getTime());
      end.setHours(h + SLOT_HOURS);
      const label = `${day} ${clock(start)}–${clock(end)}`;
      windows.push({ id: label, label, day, fee: 0, priority: false });
      if (windows.length >= MAX_WINDOWS) return windows;
    }
  }
  return windows;
}

const squash = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/[‒-―-]|\bto\b/g, "-")
    .replace(/\s+/g, "")
    .replace(/:00/g, "");

// Forgiving lookup: "today 4pm-6pm", "Today 4:00pm to 6:00pm", "priority".
export function findDeliveryWindow(windows, text) {
  const needle = squash(text);
  if (!needle) return null;
  return (
    windows.find((w) => squash(w.id) === needle || squash(w.label) === needle) ||
    windows.find((w) => squash(w.label).startsWith(needle)) ||
    null
  );
}
