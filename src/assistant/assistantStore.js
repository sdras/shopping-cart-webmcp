import { createStore } from "../state/createStore.js";

// The Gemini API key lives under its own localStorage entry, apart from the
// shopping state. Tools and agents read that state; nothing they can reach
// should ever hold a credential.
const KEY_STORAGE = "basketful:gemini-key";

function readKey() {
  try {
    return window.localStorage.getItem(KEY_STORAGE) || null;
  } catch {
    return null;
  }
}

export const assistantStore = createStore({
  open: false,
  geminiKey: typeof window === "undefined" ? null : readKey(),
});

export const setAssistantOpen = (open) => assistantStore.setState((s) => ({ ...s, open }));
export const toggleAssistant = () => assistantStore.setState((s) => ({ ...s, open: !s.open }));

/** Save the key in this browser, or forget it with null. */
export function setGeminiKey(key) {
  const geminiKey = key?.trim() || null;
  try {
    if (geminiKey) window.localStorage.setItem(KEY_STORAGE, geminiKey);
    else window.localStorage.removeItem(KEY_STORAGE);
  } catch {
    // Storage can be blocked; the key still works until the tab closes.
  }
  assistantStore.setState((s) => ({ ...s, geminiKey }));
}
