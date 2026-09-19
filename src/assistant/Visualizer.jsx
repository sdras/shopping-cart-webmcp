import { useEffect, useId, useRef, useState } from "react";

// The same picture as the shader, held still, for wherever the shader isn't:
// the launcher, the moment before three.js arrives, a browser without WebGL.
// Each layer is a chain of lenses along the centre line of a 48 × 32 box.
const lenses = (nodes, heights) =>
  heights
    .map((h, i) => {
      const from = nodes[i];
      const to = nodes[i + 1];
      const mid = (from + to) / 2;
      return `M${from} 16Q${mid} ${16 - 2 * h} ${to} 16Q${mid} ${16 + 2 * h} ${from} 16Z`;
    })
    .join("");

const LAYERS = [
  { d: lenses([3, 17, 33, 45], [7, 13, 8]), opacity: 0.3 },
  { d: lenses([6, 14, 27, 39, 44], [4, 11, 9, 3]), opacity: 0.45 },
  { d: lenses([1, 10, 22, 36, 47], [3, 8, 12, 5]), opacity: 0.75 },
];

/**
 * The voice visualizer, filling a `width` × `height` box. The renderer
 * (three.js) loads on first use; until then, and wherever WebGL is missing, a
 * still drawing of it stands in. A `still` one is only ever the drawing, which
 * keeps three.js off the page until the panel is opened. Given a `voice` (an
 * analyser on the microphone or the speaker) it draws what is heard; otherwise
 * it moves on its own, to suit the `mode`.
 */
export default function Visualizer({ width, height, mode = "idle", voice = null, still = false }) {
  const canvasRef = useRef(null);
  const handle = useRef(null);
  const [live, setLive] = useState(false);
  const gradient = useId();
  // The renderer arrives a moment after mount; it starts from whatever these are by then.
  const latest = useRef({ mode, voice });
  latest.current = { mode, voice };

  useEffect(() => {
    if (still) return;
    let gone = false;
    import("./visualizer.js").then(({ createVisualizer }) => {
      if (gone) return;
      handle.current = createVisualizer(canvasRef.current, latest.current);
      setLive(Boolean(handle.current));
    });
    return () => {
      gone = true;
      handle.current?.destroy();
      handle.current = null;
    };
  }, [still]);

  useEffect(() => {
    handle.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    handle.current?.setVoice(voice);
  }, [voice]);

  return (
    <div className="visualizer" style={{ width, height }} aria-hidden="true">
      {!live && (
        <svg viewBox="0 0 48 32" preserveAspectRatio="none">
          <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="0" x2="48">
            {[1, 2, 3, 4, 5].map((n) => (
              <stop key={n} offset={(n - 1) / 4} style={{ stopColor: `var(--wave-${n})` }} />
            ))}
          </linearGradient>
          {LAYERS.map((layer) => (
            <path key={layer.d} d={layer.d} fill={`url(#${gradient})`} opacity={layer.opacity} />
          ))}
        </svg>
      )}
      {!still && <canvas ref={canvasRef} />}
    </div>
  );
}
