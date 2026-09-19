import { useEffect, useState } from "react";
import { uiStore } from "../state/uiStore.js";
import { useStore } from "../state/createStore.js";

// What the browser says is registered right now. `getTools()` is async and
// `toolchange` fires as tools come and go with the page state.
function useRegisteredTools() {
  const [state, setState] = useState({ supported: false, tools: [] });

  useEffect(() => {
    let cancelled = false;
    let context = null;

    async function refresh() {
      try {
        const tools = (await context.getTools?.()) ?? [];
        if (!cancelled) setState({ supported: true, tools: Array.from(tools) });
      } catch {
        if (!cancelled) setState({ supported: true, tools: [] });
      }
    }

    // An extension can inject document.modelContext a beat after load.
    let attempts = 0;
    const timer = setInterval(() => {
      if (document.modelContext) {
        clearInterval(timer);
        context = document.modelContext;
        context.addEventListener?.("toolchange", refresh);
        refresh();
      } else if (++attempts >= 20) {
        clearInterval(timer);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearInterval(timer);
      context?.removeEventListener?.("toolchange", refresh);
    };
  }, []);

  return state;
}

function hint(tool) {
  if (tool.annotations?.consequentialHint) return "asks first";
  if (tool.annotations?.readOnlyHint) return "read-only";
  return null;
}

const time = (at) =>
  new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

export default function AgentPanel() {
  const { supported, tools } = useRegisteredTools();
  const log = useStore(uiStore, (s) => s.toolLog);

  return (
    <details className="agent-panel">
      <summary>
        <span aria-hidden="true">🤖</span>
        <span>Agent tools</span>
        <span className="agent-count">{supported ? tools.length : "off"}</span>
      </summary>
      <div className="agent-panel-body">
        {supported ? (
          <>
            <h2>Registered on this page</h2>
            <ul className="agent-tools">
              {tools.map((tool) => (
                <li key={tool.name} title={tool.description}>
                  <code>{tool.name}</code>
                  {hint(tool) && <span className="badge muted">{hint(tool)}</span>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>
            WebMCP isn't available in this browser, so the page works like any other shop. To let
            an agent drive it, use Chrome 149 or later and
            enable <code>chrome://flags/#enable-webmcp-testing</code>.
          </p>
        )}

        <h2>Activity</h2>
        {log.length === 0 ? (
          <p className="muted">Tool calls from an agent show up here.</p>
        ) : (
          <ol className="agent-log">
            {log.map((entry) => (
              <li key={entry.id} className={entry.ok ? "" : "failed"}>
                <p>
                  <code>{entry.name}</code> <span className="muted">{time(entry.at)}</span>
                  {!entry.ok && <span className="badge danger">error</span>}
                </p>
                <pre>{JSON.stringify(entry.input)}</pre>
                <pre className="agent-output">{entry.output}</pre>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
