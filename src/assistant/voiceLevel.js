// Turns what an analyser hears, on the microphone or the speaker, into
// numbers the voice visualizer can draw: one overall level, and how that
// loudness is spread across the range a voice lives in.

/** Quieter than this is treated as silence, whatever the meter has learned. */
const SILENCE_DB = -70;
/** The ceiling never comes closer than this to the floor, so noise alone cannot fill the range. */
const MIN_RANGE_DB = 22;
/** Speech has to clear the floor by this much before anything moves at all. */
const GATE_DB = 6;

/**
 * Raw loudness in, a 0–1 level out. It listens for a moment and adapts: the
 * quiet between words sets the floor, the loudest recent syllables set the
 * ceiling, so a soft talker and a loud one both fill the range and room noise
 * stays still.
 */
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

/**
 * Band edges in Hz, from the bottom of a low voice to the top of the
 * consonants, evenly spaced to the ear (about two thirds of an octave each).
 */
export const VOICE_BANDS = [90, 150, 250, 400, 650, 1050, 1700, 2800, 4500];

/**
 * The shape of a sound across the voice bands, each 0–1 relative to the
 * strongest: which bands carry it, not how loud it is (the meter says that).
 * `bytes` is an analyser's `getByteFrequencyData`; `sampleRate` its context's.
 */
export function bandShape(bytes, sampleRate, out = new Float32Array(VOICE_BANDS.length - 1)) {
  const hzPerBin = sampleRate / 2 / bytes.length;
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    const lo = Math.min(bytes.length - 1, Math.max(1, Math.floor(VOICE_BANDS[i] / hzPerBin)));
    const hi = Math.min(bytes.length, Math.max(lo + 1, Math.ceil(VOICE_BANDS[i + 1] / hzPerBin)));
    let sum = 0;
    for (let bin = lo; bin < hi; bin++) sum += bytes[bin];
    out[i] = sum / (hi - lo);
    peak = Math.max(peak, out[i]);
  }
  // The bytes are decibels, which flatten a voice's peaks; squaring brings the formants back out.
  for (let i = 0; i < out.length; i++) out[i] = peak > 0 ? (out[i] / peak) ** 2 : 0;
  return out;
}
