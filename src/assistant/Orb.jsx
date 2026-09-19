import { useEffect, useRef } from "react";

/** The brand green, read off the page's tokens so the orb follows them. */
const brand = () => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#108910";

/**
 * The orb, sized to fit its box. The renderer (three.js) loads on first use;
 * until then, and wherever WebGL is missing, a plain gradient circle stands
 * in. Given a `voice` (an analyser on the microphone or the speaker) it moves
 * to what is heard; otherwise it moves on its own.
 */
export default function Orb({ size, mode = "idle", voice = null, halo = false, still = false }) {
  const canvasRef = useRef(null);
  const haloRef = useRef(null);
  const handle = useRef(null);
  // The renderer arrives a moment after mount; it starts from whatever these are by then.
  const latest = useRef({ mode, voice });
  latest.current = { mode, voice };

  useEffect(() => {
    const canvas = canvasRef.current;
    let gone = false;
    // A still orb is furniture: it waits for the page to go quiet before it
    // asks for three.js, so the launcher never competes with the shop loading.
    const whenIdle = (load) => window.requestIdleCallback(load, { timeout: 4000 });
    const schedule = still && window.requestIdleCallback ? whenIdle : (load) => load();
    schedule(async () => {
      if (gone) return;
      const { createOrb } = await import("./orb.js");
      if (gone) return;
      handle.current = createOrb(canvas, {
        accent: brand(),
        mode: latest.current.mode,
        voice: latest.current.voice,
        halo: haloRef.current,
        detail: size >= 100 ? 24 : 10,
        still,
      });
      canvas.classList.remove("loading");
    });
    return () => {
      gone = true;
      handle.current?.destroy();
      handle.current = null;
    };
    // Mounted once; mode and voice changes go through the handle below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handle.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    handle.current?.setVoice(voice);
  }, [voice]);

  return (
    <div className="orb" style={{ width: size, height: size }} aria-hidden="true">
      {halo && <div className="orb-halo" ref={haloRef} />}
      {halo && <div className="orb-floor" />}
      <canvas className="orb-canvas loading" ref={canvasRef} />
    </div>
  );
}
