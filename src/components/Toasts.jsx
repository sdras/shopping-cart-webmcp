import { uiStore } from "../state/uiStore.js";
import { useStore } from "../state/createStore.js";

export default function Toasts() {
  const toasts = useStore(uiStore, (s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <p key={t.id} className="toast">
          {t.agent && <span className="emoji" aria-hidden="true">🤖</span>}
          {t.message}
        </p>
      ))}
    </div>
  );
}
