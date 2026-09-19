import { useState } from "react";
import Dialog from "../components/Dialog.jsx";
import { CloseIcon } from "../components/icons.jsx";
import { useStore } from "../state/createStore.js";
import { assistantStore, setGeminiKey } from "./assistantStore.js";

function KeyForm({ onClose }) {
  const geminiKey = useStore(assistantStore, (s) => s.geminiKey);
  const [keyInput, setKeyInput] = useState(geminiKey ?? "");

  function save(event) {
    event.preventDefault();
    setGeminiKey(keyInput);
    onClose();
  }

  return (
    <form className="assistant-settings-body" onSubmit={save}>
      <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Close">
        <CloseIcon />
      </button>
      <h2 id="assistant-settings-title">Voice &amp; chat</h2>
      <p className="muted">
        Talk or type to Basketful. It hears, speaks and shops through the same tools the page
        offers agents.
      </p>

      <div className="field">
        <label htmlFor="gemini-key">Gemini API key</label>
        <input
          id="gemini-key"
          type="password"
          value={keyInput}
          placeholder="AIzaSy..."
          autoComplete="off"
          autoFocus
          onChange={(event) => setKeyInput(event.target.value)}
        />
        <p className="assistant-field-help">
          Get a key from{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
            Google AI Studio
          </a>
          . It is stored in this browser only, apart from your cart, and goes nowhere but Google.
        </p>
      </div>

      <div className="assistant-settings-actions">
        {geminiKey && (
          <button
            type="button"
            className="button secondary assistant-disconnect"
            onClick={() => {
              setGeminiKey(null);
              onClose();
            }}
          >
            Disconnect
          </button>
        )}
        <button type="button" className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="button" disabled={!keyInput.trim()}>
          Save key
        </button>
      </div>
    </form>
  );
}

/** Voice & chat setup: the model behind it is Gemini, so its key goes here and stays on this device. */
export default function AssistantSettings({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} className="assistant-settings" labelledBy="assistant-settings-title">
      <KeyForm onClose={onClose} />
    </Dialog>
  );
}
