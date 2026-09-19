// Turns raw microphone (or speaker) loudness into a 0–1 level the orb can move
// to. It listens for a moment and adapts: the quiet between words sets the
// floor, the loudest recent syllables set the ceiling, so a soft talker and a
// loud one both fill the range and room noise stays still.

/** Quieter than this is treated as silence, whatever the meter has learned. */
const SILENCE_DB = -70;
/** The ceiling never comes closer than this to the floor, so noise alone cannot fill the range. */
const MIN_RANGE_DB = 22;
/** Speech has to clear the floor by this much before the orb moves at all. */
const GATE_DB = 6;

export function createVoiceMeter() {
  let floor = -60;
  let loud = -24;
  return {
    /** Feed one reading (RMS of the samples, 0–1) taken `dt` seconds after the last; returns the level. */
    sample(rms, dt) {
      const db = Math.max(SILENCE_DB, 20 * Math.log10(Math.max(rms, 1e-5)));
      // The floor drops quickly to the quiet and climbs slowly if the room gets louder.
      floor += (db - floor) * Math.min(1, dt * (db < floor ? 4 : 0.2));
      // The ceiling jumps up to the loudest syllable and eases down between them.
      loud += (db - loud) * Math.min(1, dt * (db > loud ? 20 : 0.4));
      const lo = floor + GATE_DB;
      const hi = Math.max(loud, floor + MIN_RANGE_DB);
      return Math.max(0, Math.min(1, (db - lo) / (hi - lo)));
    },
    /** Forget what it learned; for a new source. */
    reset() {
      floor = -60;
      loud = -24;
    },
  };
}
