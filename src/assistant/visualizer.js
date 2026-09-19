import { Camera, Mesh, NoBlending, PlaneGeometry, Scene, ShaderMaterial, Vector3, WebGLRenderer } from "three";
import { VOICE_BANDS, bandShape, createVoiceMeter } from "./voiceLevel.js";

/**
 * The voice visualizer: a waveform that stands for voice and chat. Four
 * translucent layers of mirrored wave, each a chain of lens-shaped lobes that
 * pinch to a centre line and taper out toward the ends, drifting past one
 * another in opposite directions. How tall a lobe stands is what is being
 * heard: the voice bands run from the low ones in the middle to the high ones
 * at the edges, so a vowel swells the centre and an "s" flickers at the tips.
 *
 * One quad, all of it drawn in the fragment shader, so it is sharp at any size
 * and any shape: a wide banner in the empty panel, a 22px badge in its header.
 * Its colours are the `--wave-1` … `--wave-5` custom properties on the canvas.
 *
 * Loaded on demand (three.js is heavy); `createVisualizer` mounts on a canvas
 * and returns a handle, or null where WebGL is missing.
 */

/**
 * @typedef {'idle' | 'listening' | 'thinking' | 'speaking'} VoiceMode
 *
 * @typedef {object} VisualizerHandle
 * @property {(mode: VoiceMode) => void} setMode
 * @property {(source: AnalyserNode | null) => void} setVoice Hear a voice (the microphone, or the speaker)
 *   through this node; null goes back to built-in motion.
 * @property {() => void} destroy
 */

const BANDS = VOICE_BANDS.length - 1;
const STOPS = 5;

/* ————— shaders ————— */

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;

/** Back to front: the back layers are the tallest, palest and slowest; the front one is the most vivid. */
const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uPhase; uniform float uCalm; uniform float uLobes; uniform float uStroke; uniform float uSmall;
uniform float uBands[${BANDS}]; uniform vec3 uStops[${STOPS}];

// How loud the voice is at this distance from the middle: low bands at the centre, high at the edges.
float heard(float ax){
  float u=ax*${(BANDS - 1).toFixed(1)}; float s=0.0;
  for(int i=0;i<${BANDS};i++) s+=uBands[i]*max(0.0,1.0-abs(u-float(i)));
  return s;
}
vec3 ramp(float t){
  float u=clamp(t,0.0,1.0)*${(STOPS - 1).toFixed(1)}; vec3 c=vec3(0.0);
  for(int i=0;i<${STOPS};i++) c+=uStops[i]*max(0.0,1.0-abs(u-float(i)));
  return c;
}
vec4 over(vec4 under,vec3 rgb,float a){ return vec4(rgb*a,a)+under*(1.0-a); }

void main(){
  float x=vUv.x*2.0-1.0; float y=abs(vUv.y*2.0-1.0);
  // A badge has no room for long tapered tips or a modest wave, so it gets blunter ends and a taller reach.
  float taper=pow(max(0.0,cos(x*1.5708)),mix(1.2,0.5,uSmall));
  float lift=1.0+1.3*uSmall;
  float voice=heard(abs(x));
  vec4 col=vec4(0.0);
  for(int k=0;k<4;k++){
    float fk=float(k);
    float lobes=uLobes*(0.55+0.24*fk);
    float dir=mod(fk,2.0)<0.5?1.0:-1.0;
    float wave=abs(sin(x*lobes*1.5708+uPhase*dir*(0.6+0.25*fk)+fk*1.9));
    float reach=taper*min(0.94,(uCalm*(1.35-0.2*fk)+voice*(1.0-0.16*fk))*lift);
    float d=y-reach*wave;
    float w=max(fwidth(d),1e-4);
    vec3 c=ramp(x*0.5+0.5+(fk-1.5)*0.07);
    // Where a lobe pinches shut the fill is half a pixel of itself: the centre line, for free.
    col=over(col,c,smoothstep(w,-w,d)*(0.2+0.14*fk));
    col=over(col,c,smoothstep(w*1.6,0.0,abs(d))*uStroke);
  }
  gl_FragColor=col;
}`;

/* ————— motion ————— */

/** `calm` is how tall the wave stands with nothing to hear; `speed` is how fast the layers drift. */
const MODES = {
  idle: { calm: 0.24, speed: 0.4 },
  listening: { calm: 0.06, speed: 0.8 },
  thinking: { calm: 0.08, speed: 1.5 },
  speaking: { calm: 0.1, speed: 1.0 },
};

/** What a band does on its own when no voice is feeding it. */
function imagined(mode, t, i) {
  // Idle: a slow breath, swelling from the middle, so it looks awake and not switched off.
  if (mode === "idle") return 0.13 + 0.11 * Math.sin(t * 1.3 - i * 0.6);
  // Thinking: ripples that start in the middle and run out to the tips.
  if (mode === "thinking") return 0.45 + 0.32 * Math.sin(t * 5.2 - i * 0.85);
  // Listening or speaking with nothing to hear (a muted reply): the rhythm of talk, made up.
  const syllable = Math.max(0, Math.sin(t * (mode === "speaking" ? 4.4 : 2.1))) ** 1.5;
  return syllable * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * (2.3 + i * 0.7) + i * 1.9)));
}

/* ————— colour ————— */

const FALLBACK = ["#0a9c8a", "#108910", "#8fc93a", "#ffc533", "#ff7009"];

function hexToRgb(hex, fallback) {
  let h = String(hex || "").trim().replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = /^[0-9a-f]{6}$/i.test(h) ? parseInt(h, 16) : parseInt(fallback.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** The palette, left to right, as the page's CSS has it. */
function palette(canvas) {
  const style = getComputedStyle(canvas);
  return FALLBACK.map((fallback, i) => new Vector3(...hexToRgb(style.getPropertyValue(`--wave-${i + 1}`), fallback)));
}

/* ————— the visualizer ————— */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ mode?: VoiceMode, voice?: AnalyserNode | null }} [opts]
 * @returns {VisualizerHandle | null}
 */
export function createVisualizer(canvas, opts = {}) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

  const uniforms = {
    uPhase: { value: 0 },
    uCalm: { value: 0 },
    uLobes: { value: 3 },
    uStroke: { value: 0 },
    uSmall: { value: 0 },
    uBands: { value: new Float32Array(BANDS) },
    uStops: { value: palette(canvas) },
  };
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    // The shader composites its own layers and writes premultiplied colour; there is nothing under the quad to blend with.
    blending: NoBlending,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(geometry, material);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  const camera = new Camera();

  let mode = MODES[opts.mode] ? opts.mode : "idle";
  let voice = opts.voice ?? null;
  let wave = new Float32Array(0);
  let spectrum = new Uint8Array(0);
  const shape = new Float32Array(BANDS);
  const meter = createVoiceMeter();
  // With reduced motion the layers hold their places and nothing moves on its own; a voice still shows, since that is
  // what the thing is for.
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  let calm = MODES[mode].calm;
  let speed = MODES[mode].speed;
  let raf = 0;
  let running = false;
  let dead = false;
  let frames = 0;
  let width = 0;
  let height = 0;
  const t0 = performance.now();
  let last = t0;

  function schedule() {
    if (dead || running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  /** At rest under reduced motion it draws a few fresh frames after a change, then stops. */
  function wake() {
    frames = 0;
    schedule();
  }

  /** What is being heard right now, band by band, 0–1; or null when nothing is feeding it. */
  function heard(dt) {
    if (!voice) return null;
    if (wave.length !== voice.fftSize) wave = new Float32Array(voice.fftSize);
    if (spectrum.length !== voice.frequencyBinCount) spectrum = new Uint8Array(voice.frequencyBinCount);
    voice.getFloatTimeDomainData(wave);
    let sum = 0;
    for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
    const level = meter.sample(Math.sqrt(sum / wave.length), dt);
    voice.getByteFrequencyData(spectrum);
    bandShape(spectrum, voice.context.sampleRate, shape);
    return level;
  }

  function frame(now) {
    running = false;
    if (dead) return;
    frames++;
    const resting = reduced && !voice;
    if (!(resting && frames >= 3)) schedule();
    // At rest the drift is slow enough that every other frame will do.
    if (!resting && mode === "idle" && !voice && frames % 2) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;

    const M = MODES[mode];
    const ease = resting ? 1 : 1 - Math.pow(0.001, dt);
    calm += (M.calm - calm) * ease;
    speed += (M.speed - speed) * ease;

    const level = heard(dt);
    const bands = uniforms.uBands.value;
    let loudest = 0;
    for (let i = 0; i < BANDS; i++) {
      const target = level === null ? imagined(mode, reduced ? 0 : t, i) : level * (0.25 + 0.75 * shape[i]);
      // Quick to rise on a syllable, slower to settle, so the shape follows speech rather than blurring it.
      bands[i] += (target - bands[i]) * (resting ? 1 : Math.min(1, dt * (target > bands[i] ? 26 : 9)));
      loudest = Math.max(loudest, bands[i]);
    }
    uniforms.uCalm.value = calm;
    // A voice hurries the drift along a little, so loud reads as lively and not only as tall.
    if (!reduced) uniforms.uPhase.value += dt * (speed + loudest * 1.6);

    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    if (w !== width || h !== height) {
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      // A banner has room for a row of lobes and for outlines; a badge gets two or three fat lobes and no outlines,
      // or it turns to fuzz.
      const small = Math.max(0, Math.min(1, (72 - h) / 44));
      uniforms.uSmall.value = small;
      uniforms.uLobes.value = Math.max(2.2, Math.min(7, 1.1 + 1.3 * (w / h))) * (1 - 0.4 * small);
      uniforms.uStroke.value = 0.7 * Math.max(0, Math.min(1, (h - 28) / 50));
    }
    renderer.render(scene, camera);
  }
  schedule();

  return {
    setMode(next) {
      if (MODES[next]) mode = next;
      wake();
    },
    setVoice(source) {
      if (source === voice) return;
      voice = source;
      meter.reset();
      wake();
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      // Browsers keep only so many WebGL contexts; give this one back rather than waiting for GC.
      renderer.forceContextLoss();
    },
  };
}
