// The tools that are live on the page right now, by name. `useTool` keeps this
// in step with what it registers through WebMCP, so the built-in assistant
// sees exactly what a browser agent would, in any browser, flag or no flag.
const live = new Map();

/** Returns the function that takes the tool back out. */
export function registerLocalTool(definition, execute) {
  const entry = { definition, execute };
  live.set(definition.name, entry);
  return () => {
    // A re-registration under the same name may have replaced this entry.
    if (live.get(definition.name) === entry) live.delete(definition.name);
  };
}

export const getLocalTool = (name) => live.get(name) ?? null;

export const localTools = () => [...live.values()];
