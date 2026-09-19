import { useEffect, useRef, useState } from "react";
import Visualizer from "./Visualizer.jsx";
import AssistantSettings from "./AssistantSettings.jsx";
import { GeminiLiveClient } from "./geminiLive.js";
import { applyUndo, canUndo } from "./tools.js";
import { assistantStore, setAssistantOpen, toggleAssistant } from "./assistantStore.js";
import { useDismiss } from "./useDismiss.js";
import { CloseIcon } from "../components/icons.jsx";
import { appStore, useApp } from "../state/app.js";
import { useStore } from "../state/createStore.js";
import "./assistant.css";

/** Things to try, each one a trip through the page's tools. */
const TRY = [
  "Open Greenleaf Market and find me corn tortillas",
  "Add eggs, butter and two avocados to my cart",
  "Put my usuals in the cart",
  "Check out with the earliest delivery window",
];

function Icon({ d, size = 16, weight = 1.5 }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}
const MIC = (
  <>
    <rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" />
    <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2M5.5 14.5h5" />
  </>
);
const RETURN = <path d="M13 3v5a2 2 0 0 1-2 2H4M6.5 7.5 4 10l2.5 2.5" />;
const MORE = (
  <>
    <circle cx="3" cy="8" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="13" cy="8" r="1.4" fill="currentColor" stroke="none" />
  </>
);

/** A small glyph for what a tool did, read off the first word of its report. */
function receiptGlyph(line, error) {
  if (error) return <path d="M8 4.5v4M8 11.2v.3M8 1.5l6.5 12h-13z" />;
  if (/^(Added|Saved|Delivery address saved)/.test(line)) return <path d="M8 3v10M3 8h10" />;
  if (/^(Opened|Checkout|Showing|No products)/.test(line)) return <path d="M2.5 8h11M9.5 4l4 4-4 4" />;
  if (/^Order .* is placed/.test(line))
    return (
      <>
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5.2 8.2 7.2 10.2 10.8 6.2" />
      </>
    );
  if (/^Removed/.test(line))
    return (
      <>
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5 8h6" />
      </>
    );
  if (/(is now|^Delivery window|^Tip|^If an item)/.test(line)) return <path d="M11.5 2.5l2 2-8 8H3.5v-2zM9.5 4.5l2 2" />;
  return <circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none" />;
}

/** What a tool did, as a receipt. The first line is the headline; the rest opens up, since it is what the model read. */
function Receipt({ m, undoable, onUndo }) {
  const [first, ...rest] = m.text.split("\n");
  const head = (
    <>
      <Icon d={receiptGlyph(first, m.tool.error)} size={14} weight={1.7} />
      <span className="assistant-receipt-text">{first.replace(/:$/, "")}</span>
    </>
  );
  const undo = undoable && (
    <button type="button" className="assistant-receipt-undo" onClick={onUndo}>
      Undo
    </button>
  );
  const className = `assistant-receipt${m.tool.error ? " error" : ""}`;
  if (rest.length === 0) {
    return (
      <div className={className}>
        <div className="assistant-receipt-head">{head}</div>
        {undo}
      </div>
    );
  }
  return (
    <div className={className}>
      <details>
        <summary className="assistant-receipt-head">{head}</summary>
        <p className="assistant-receipt-more">
          <code>{m.tool.name}</code>
          {rest.join("\n")}
        </p>
      </details>
      {undo}
    </div>
  );
}

function Message({ m, undoable, onUndo }) {
  if (m.role === "system") return <p className="assistant-msg system">{m.text}</p>;
  if (m.role === "tool") return <Receipt m={m} undoable={undoable} onUndo={onUndo} />;
  if (m.role === "user") return <div className="assistant-msg user">{m.text}</div>;
  return <p className="assistant-msg model">{m.text}</p>;
}

/**
 * Voice and chat: the "Ask or say…" launcher in the corner, and the panel it
 * opens. A live session hears, speaks and types, and shops the site through
 * the same tools the page offers agents. Typing works on its own; the
 * microphone is a switch on top of it.
 */
export default function Assistant() {
  const open = useStore(assistantStore, (s) => s.open);
  const geminiKey = useStore(assistantStore, (s) => s.geminiKey);
  // Any change to the shopping state re-renders, so a receipt's Undo goes away once something else changed.
  useApp();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("idle");
  const [micOn, setMicOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [modelDraft, setModelDraft] = useState("");
  const [userDraft, setUserDraft] = useState("");
  /** Asked, and nothing back yet. */
  const [pending, setPending] = useState(false);

  const clientRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  useDismiss(menuRef, menuOpen, () => setMenuOpen(false));

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "j") {
        event.preventDefault();
        toggleAssistant();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, modelDraft, userDraft]);

  // Closing the panel stops the microphone; the session itself stays up for when it opens again.
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else clientRef.current?.stopMic();
  }, [open]);

  // On a wide window the page makes room for the panel (assistant.css).
  useEffect(() => {
    document.documentElement.classList.toggle("assistant-open", open);
    return () => document.documentElement.classList.remove("assistant-open");
  }, [open]);

  // A new key means a new session; unmounting ends the current one.
  useEffect(
    () => () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
    },
    [geminiKey]
  );

  /** The session, made on first use; without a key the setup opens instead. */
  const client = () => {
    if (!geminiKey) {
      setSettingsOpen(true);
      return null;
    }
    if (clientRef.current) return clientRef.current;
    clientRef.current = new GeminiLiveClient(geminiKey, appStore, {
      onStatus: (s) => {
        setStatus(s);
        if (s === "idle" || s === "error") setPending(false);
      },
      onMessage: (m) => {
        setMessages((prev) => [...prev, m]);
        if (m.role === "model" || m.role === "system") setPending(false);
      },
      onModelDraft: (t) => {
        setModelDraft(t);
        if (t) setPending(false);
      },
      onUserDraft: setUserDraft,
      onMicChange: setMicOn,
    });
    return clientRef.current;
  };

  const ask = (text) => {
    const c = client();
    if (!c) return;
    c.sendText(text);
    setPending(true);
  };

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    ask(t);
    setDraft("");
  };

  const toggleMic = () => {
    const c = client();
    if (!c) return;
    if (micOn) c.stopMic();
    else void c.startMic();
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    clientRef.current?.setMuted(next);
  };

  const endSession = () => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setModelDraft("");
    setUserDraft("");
    setPending(false);
  };

  /** Forget the conversation: the log here and the model's memory of it. A running microphone carries on. */
  const clearHistory = () => {
    const wasListening = micOn;
    endSession();
    setMessages([]);
    if (wasListening) void client()?.startMic();
  };

  /** Take a tool call back, and let the model know the page no longer looks the way it left it. */
  const undo = (m) => {
    if (!applyUndo(m.tool.undo, appStore)) return;
    clientRef.current?.note(`(The shopper pressed Undo on your ${m.tool.name} call, so its changes were taken back. Read the state again before relying on it.)`);
  };

  const pick = (fn) => () => {
    setMenuOpen(false);
    fn();
  };

  const live = status === "connecting" || status === "ready";
  const mode = status === "connecting" || pending ? "thinking" : modelDraft ? "speaking" : micOn ? "listening" : "idle";
  const statusLabel = !geminiKey
    ? "Not set up"
    : status === "error"
      ? "Connection problem"
      : status === "connecting"
        ? "Connecting…"
        : mode === "thinking"
          ? "Thinking"
          : mode === "speaking"
            ? muted
              ? "Replying"
              : "Speaking"
            : mode === "listening"
              ? "Listening"
              : status === "ready"
                ? "Connected"
                : "Ready";
  const empty = messages.length === 0 && !modelDraft && !userDraft;
  // What the visualizer draws: the shopper while listening, the model while it speaks aloud; otherwise its own motion.
  const voice =
    mode === "listening"
      ? (clientRef.current?.micAnalyser ?? null)
      : mode === "speaking" && !muted
        ? (clientRef.current?.voiceAnalyser ?? null)
        : null;

  if (!open) {
    return (
      <>
        <button type="button" className="assistant-launcher" title="Ask or say something (⌘J)" onClick={() => setAssistantOpen(true)}>
          <Visualizer width={30} height={22} still />
          <span>Ask or say…</span>
          <kbd aria-hidden="true">⌘J</kbd>
        </button>
        <AssistantSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </>
    );
  }

  return (
    <>
      <aside
        className="assistant-panel"
        aria-label="Voice and chat"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          if (menuOpen) setMenuOpen(false);
          else setAssistantOpen(false);
        }}
      >
        <header className="assistant-head">
          <Visualizer width={30} height={22} mode={mode} voice={voice} />
          <span className={`assistant-status${status === "error" ? " error" : ""}`} role="status">
            {statusLabel}
          </span>
          <span className="assistant-spacer" />
          {live && (
            <button type="button" className="assistant-ghost" aria-pressed={muted} title={muted ? "Let it speak" : "Keep it quiet; replies still show as text"} onClick={toggleMute}>
              {muted ? "Unmute" : "Mute"}
            </button>
          )}
          {live && (
            <button type="button" className="assistant-ghost" title="Close the session" onClick={endSession}>
              End
            </button>
          )}
          <div className="assistant-more" ref={menuRef}>
            <button
              type="button"
              className="icon-button"
              aria-label="Voice and chat options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Icon d={MORE} />
            </button>
            {menuOpen && (
              <div className="assistant-menu" role="menu">
                <button type="button" role="menuitem" disabled={empty} onClick={pick(clearHistory)}>
                  Clear conversation history
                </button>
                <hr />
                <button type="button" role="menuitem" onClick={pick(() => setSettingsOpen(true))}>
                  {geminiKey ? "API key…" : "Set up an API key…"}
                </button>
              </div>
            )}
          </div>
          <button type="button" className="icon-button" aria-label="Close voice and chat" onClick={() => setAssistantOpen(false)}>
            <CloseIcon size={16} />
          </button>
        </header>

        <div className={`assistant-body${empty ? " empty" : ""}`}>
          {empty ? (
            <>
              <div className="assistant-hero">
                <Visualizer width={288} height={96} mode={mode} voice={voice} />
                <h2>Say it or type it.</h2>
                <p>It shops the page the way you would.</p>
              </div>
              <div className="assistant-try">
                <span className="assistant-try-label">Try</span>
                {TRY.map((t) => (
                  <button type="button" key={t} className="assistant-try-row" onClick={() => ask(t)}>
                    <span>{t}</span>
                    <Icon d={RETURN} size={14} />
                  </button>
                ))}
                <p className="assistant-hint">
                  It works through the same WebMCP tools the page offers any agent. Every call shows
                  up under 🤖 Agent tools.
                </p>
              </div>
            </>
          ) : (
            <div className="assistant-log">
              {messages.map((m) => (
                <Message key={m.id} m={m} undoable={canUndo(m.tool?.undo, appStore)} onUndo={() => undo(m)} />
              ))}
              {userDraft && (
                <div className="assistant-msg user live">
                  {userDraft}
                  <span className="assistant-caret" />
                </div>
              )}
              {modelDraft && <p className="assistant-msg model live">{modelDraft}</p>}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <footer className="assistant-dock">
          {geminiKey ? (
            <div className="assistant-input-row">
              <input
                ref={inputRef}
                className="assistant-input"
                type="text"
                value={draft}
                placeholder="Ask or say…"
                aria-label="Ask or say something"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) send();
                }}
              />
              <button
                type="button"
                className={`assistant-mic${micOn ? " on" : ""}`}
                aria-pressed={micOn}
                aria-label={micOn ? "Stop listening" : "Talk"}
                title={micOn ? "Stop listening" : "Talk"}
                onClick={toggleMic}
              >
                {micOn ? <Visualizer width={30} height={26} mode={mode} voice={voice} /> : <Icon d={MIC} size={18} weight={1.6} />}
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="button assistant-connect" onClick={() => setSettingsOpen(true)}>
                Connect a voice model
              </button>
              <p className="assistant-hint">
                Needs a Gemini API key.{" "}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                  Get one at Google AI Studio
                </a>
              </p>
            </>
          )}
        </footer>
      </aside>
      <AssistantSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
