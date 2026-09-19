import * as THREE from "three";
import { createVoiceMeter } from "./voiceLevel.js";

/**
 * The orb: a blob of glass that stands for voice and chat. One noise-displaced sphere drawn in
 * four passes — the far wall, a warm cloud drifting inside, a near-clear front shell with an
 * iridescent rim, and a soft outer glow — lit by a key light and a warm fill. Its colours are
 * the accent plus two companions turned around the hue wheel, so it follows the brand green.
 *
 * Loaded on demand (three.js is heavy); `createOrb` mounts on a canvas and returns a handle.
 */

/**
 * @typedef {'idle' | 'listening' | 'thinking' | 'speaking'} OrbMode
 *
 * @typedef {object} OrbOptions
 * @property {string} [accent]
 * @property {OrbMode} [mode]
 * @property {number} [glass] How clear the middle of the glass is, 0 (solid) to 0.95.
 * @property {HTMLElement | null} [halo] A soft glow behind the orb, scaled with the level; its colours follow the accent.
 * @property {number} [detail] Icosahedron subdivisions: 24 for a big orb, 10 for a small one.
 * @property {boolean} [still] Draw once and hold: for an orb that is furniture (the launcher) rather than a live presence.
 * @property {AnalyserNode | null} [voice] Where to hear a voice from; while set, the shape moves to it instead of on its own.
 *
 * @typedef {object} OrbHandle
 * @property {(mode: OrbMode) => void} setMode
 * @property {(hex: string) => void} setAccent
 * @property {(value: number) => void} setGlass
 * @property {(source: AnalyserNode | null) => void} setVoice Hear a voice (the microphone, or the speaker) through this node; null goes back to built-in motion.
 * @property {() => void} destroy
 */

/* ————— shaders ————— */

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/** Big, slow lobes: one low-frequency octave carries the shape, a faint second one keeps it alive. */
const VERT = /* glsl */ `
uniform float uTime; uniform float uAmp; uniform float uFreq;
varying vec3 vN; varying vec3 vP; varying float vD;
${NOISE}
float disp(vec3 q){
  float a=snoise(q*uFreq+vec3(0.0,uTime*0.3,uTime*0.2));
  float b=snoise(q*uFreq*2.0-vec3(uTime*0.45,0.0,uTime*0.25));
  return a*0.85+b*0.15;
}
void main(){
  vec3 p=normalize(position);
  float d=disp(p); vec3 pos=p*(1.0+uAmp*d);
  vec3 up=abs(p.y)<0.98?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0);
  vec3 tg=normalize(cross(p,up)); vec3 bt=cross(p,tg); float e=0.02;
  vec3 p1=normalize(p+tg*e); vec3 p2=normalize(p+bt*e);
  vec3 q1=p1*(1.0+uAmp*disp(p1)); vec3 q2=p2*(1.0+uAmp*disp(p2));
  vec3 n=normalize(cross(q1-pos,q2-pos));
  vN=normalize(normalMatrix*n);
  vP=normalize(mat3(modelViewMatrix)*pos)*length(pos);
  vD=d;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);
}`;

/** One program, three layers: 0 the front shell, 1 the far wall, 2 the cloud inside. */
const FRAG = /* glsl */ `
precision highp float;
varying vec3 vN; varying vec3 vP; varying float vD;
uniform vec3 cA; uniform vec3 cL; uniform vec3 cD; uniform vec3 cW; uniform vec3 cC;
uniform float uLevel; uniform float uLift; uniform float uGlass; uniform float uLayer;
void main(){
  bool front=gl_FrontFacing; vec3 N=normalize(vN); if(!front) N=-N; vec3 V=vec3(0.0,0.0,1.0);
  float ndv=max(dot(N,V),0.0);
  vec3 L1=normalize(vec3(-0.55,0.8,0.65)); vec3 L2=normalize(vec3(0.7,-0.35,0.45));
  float d1=max(dot(N,L1),0.0); float d2=max(dot(N,L2),0.0);
  float s1=pow(max(dot(reflect(-L1,N),V),0.0),42.0); float s2=pow(max(dot(reflect(-L2,N),V),0.0),16.0);
  float ramp=smoothstep(-1.0,0.8,vP.y*0.9+vP.x*0.5);
  vec3 col; float alpha; vec3 add=vec3(0.0);
  if(uLayer>1.5){
    vec3 base=mix(cW,cA,ramp);
    base=mix(base,cC,clamp(vD*0.5+0.3,0.0,1.0)*0.4+uLift*0.3);
    float glow=pow(ndv,2.5);
    col=base*(0.8+0.35*d1+0.15*d2)+cW*glow*(0.35+0.35*uLevel)+cL*glow*0.15;
    alpha=(0.42+0.3*uGlass)*pow(ndv,1.3);
  } else if(uLayer>0.5){
    float fres=pow(1.0-ndv,2.0);
    col=mix(cA,cC,0.5)*(0.75+0.35*d1)+cC*fres*0.6;
    alpha=uGlass*(0.05+0.3*fres);
  } else {
    float fr=pow(1.0-ndv,2.6); float fg=pow(1.0-ndv,2.0); float fb=pow(1.0-ndv,1.4); float edge=pow(1.0-ndv,7.0);
    vec3 rim=cW*fr*0.6+cA*fg*0.7+cC*fb*0.6+vec3(1.0)*edge*0.4;
    vec3 body=mix(cL,cC,0.35);
    float tint=0.45+0.25*(1.0-uGlass);
    col=body*tint*(0.7+0.3*d1)+rim*(0.9+0.7*uLevel)+cL*max(vD,0.0)*0.1;
    float sheen=pow(max(dot(reflect(-L1,N),V),0.0),6.0);
    add=vec3(1.0)*s1*0.5+cL*sheen*0.14+cW*s2*0.28;
    float clear=0.05+(1.0-uGlass)*0.5;
    alpha=mix(clear,0.94,pow(1.0-ndv,1.5));
  }
  gl_FragColor=vec4(col*alpha+add,alpha);
}`;

const AURA_FRAG = /* glsl */ `
precision highp float;
varying vec3 vN; varying vec3 vP; varying float vD;
uniform vec3 cA; uniform vec3 cC; uniform float uLevel;
void main(){
  vec3 N=normalize(vN); vec3 V=vec3(0.0,0.0,1.0);
  float fres=pow(1.0-max(dot(N,V),0.0),1.8);
  float a=fres*(0.18+0.5*uLevel);
  gl_FragColor=vec4(mix(cA,cC,0.5)*a,a);
}`;

/* ————— motion ————— */

/** `react` is how much the level (the mic, or the built-in pulse) shows in the shape. */
const MODES = {
  idle: { amp: 0.14, freq: 0.95, scale: 1.0, speed: 0.28, react: 0.3 },
  listening: { amp: 0.17, freq: 1.1, scale: 1.02, speed: 0.5, react: 1.0 },
  thinking: { amp: 0.24, freq: 1.45, scale: 0.97, speed: 1.1, react: 0.5 },
  speaking: { amp: 0.16, freq: 1.0, scale: 1.03, speed: 0.65, react: 1.0 },
};

/** What the orb does on its own when nothing is feeding it a level. */
function simulated(mode, t) {
  if (mode === "idle") return 0.12 + 0.1 * Math.sin(t * 1.25);
  if (mode === "listening") {
    const e =
      Math.max(0, Math.sin(t * 2.1)) * (0.55 + 0.45 * Math.sin(t * 9.3 + 1.0)) * (0.7 + 0.3 * Math.sin(t * 0.7));
    return Math.min(1, e * 1.1);
  }
  if (mode === "thinking") return 0.35 + 0.15 * Math.sin(t * 4.2);
  return Math.min(1, Math.pow(Math.max(0, Math.sin(t * 4.4)), 2.2) * (0.7 + 0.3 * Math.sin(t * 13.0)));
}

/* ————— colour ————— */

function hexToRgb(hex) {
  let h = String(hex || "#108910")
    .trim()
    .replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  let n = parseInt(h, 16);
  if (Number.isNaN(n)) n = 0x108910;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const clamp01 = (c) => Math.max(0, Math.min(1, c));

function rgbToOklab(rgb) {
  const r = toLin(rgb[0]),
    g = toLin(rgb[1]),
    b = toLin(rgb[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToRgb(lab) {
  const l_ = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2];
  const m_ = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2];
  const s_ = lab[0] - 0.0894841775 * lab[1] - 1.291485548 * lab[2];
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  return [
    clamp01(toSrgb(clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s))),
    clamp01(toSrgb(clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s))),
    clamp01(toSrgb(clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s))),
  ];
}
/** The colour turned `deg` around the hue wheel, `dl` lighter, with chroma scaled by `dc`. */
function turn(rgb, deg, dl, dc) {
  const lab = rgbToOklab(rgb);
  const chroma = Math.max(0.09, Math.hypot(lab[1], lab[2]) * dc);
  const hue = Math.atan2(lab[2], lab[1]) + (deg * Math.PI) / 180;
  return oklabToRgb([clamp01(lab[0] + dl), chroma * Math.cos(hue), chroma * Math.sin(hue)]);
}

function palette(hex) {
  const A = hexToRgb(hex);
  return {
    A,
    L: mix(A, [1, 1, 1], 0.55),
    D: mix(A, [0.03, 0.02, 0.07], 0.58),
    W: turn(A, 58, 0.08, 1.15), // the warm companion, inside
    C: turn(A, -78, 0.14, 1.05), // the cool companion, at the rim
  };
}
const css = (c, alpha) =>
  `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)} / ${alpha}%)`;

/* ————— the orb ————— */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {OrbOptions} [opts]
 * @returns {OrbHandle}
 */
export function createOrb(canvas, opts = {}) {
  const none = { setMode() {}, setAccent() {}, setGlass() {}, setVoice() {}, destroy() {} };
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "low-power",
    });
  } catch {
    canvas.classList.add("fallback");
    return none;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
  camera.position.z = 3.6;

  const geometry = new THREE.IcosahedronGeometry(1, opts.detail ?? 24);
  const colors = {
    cA: { value: new THREE.Vector3() },
    cL: { value: new THREE.Vector3() },
    cD: { value: new THREE.Vector3() },
    cW: { value: new THREE.Vector3() },
    cC: { value: new THREE.Vector3() },
  };
  const shared = {
    uLevel: { value: 0 },
    uLift: { value: 0 },
    uGlass: { value: typeof opts.glass === "number" ? opts.glass : 0.55 },
  };
  const blend = {
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  };

  function layerMaterial(layer, side) {
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 0 },
        uFreq: { value: 1 },
        ...colors,
        ...shared,
        uLayer: { value: layer },
      },
      side,
      depthTest: true,
      depthWrite: true,
      ...blend,
    });
  }
  const wall = new THREE.Mesh(geometry, layerMaterial(1, THREE.BackSide));
  const cloud = new THREE.Mesh(geometry, layerMaterial(2, THREE.FrontSide));
  const shell = new THREE.Mesh(geometry, layerMaterial(0, THREE.FrontSide));
  const aura = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: AURA_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 0 },
        uFreq: { value: 1 },
        cA: colors.cA,
        cC: colors.cC,
        uLevel: shared.uLevel,
      },
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false,
      ...blend,
    }),
  );
  wall.renderOrder = 0;
  cloud.renderOrder = 1;
  shell.renderOrder = 2;
  aura.renderOrder = 3;
  for (const m of [wall, cloud, shell, aura]) {
    m.rotation.order = "YXZ";
    m.frustumCulled = false;
    scene.add(m);
  }

  const halo = opts.halo ?? null;
  function setAccent(hex) {
    const p = palette(hex);
    colors.cA.value.fromArray(p.A);
    colors.cL.value.fromArray(p.L);
    colors.cD.value.fromArray(p.D);
    colors.cW.value.fromArray(p.W);
    colors.cC.value.fromArray(p.C);
    if (halo)
      halo.style.background = `radial-gradient(circle, ${css(p.A, 24)} 0%, ${css(p.W, 14)} 34%, ${css(p.C, 6)} 52%, transparent 70%)`;
  }
  setAccent(opts.accent);

  let mode = opts.mode && MODES[opts.mode] ? opts.mode : "idle";
  const cur = { ...MODES[mode], lvl: 0 };
  let voice = opts.voice ?? null;
  let wave = new Float32Array(0);
  const meter = createVoiceMeter();
  const still = Boolean(opts.still) || (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  let raf = 0;
  let running = false;
  let dead = false;
  let phase = 0;
  const t0 = performance.now();
  let last = t0;
  let frames = 0;

  function schedule() {
    if (dead || running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  /** A held orb draws a few fresh frames after a change, then rests again. */
  function wake() {
    if (!still) return;
    frames = 0;
    schedule();
  }

  /** The voice right now as a 0–1 level, or null when nothing is feeding one. */
  function heard(dt) {
    if (!voice) return null;
    if (wave.length !== voice.fftSize) wave = new Float32Array(voice.fftSize);
    voice.getFloatTimeDomainData(wave);
    let sum = 0;
    for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
    return meter.sample(Math.sqrt(sum / wave.length), dt);
  }

  function frame(now) {
    running = false;
    if (dead) return;
    frames++;
    // A still orb (the launcher, or reduced motion) settles in a few frames and then stops rendering;
    // a live one at rest needs only every other frame. Hidden tabs get no frames from the browser at all.
    if (!(still && frames >= 3)) schedule();
    if (!still && mode === "idle" && frames % 2) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    const M = MODES[mode];
    const level = heard(dt) ?? simulated(mode, t);
    const k = 1 - Math.pow(0.001, dt);
    cur.amp += (M.amp - cur.amp) * k;
    cur.freq += (M.freq - cur.freq) * k;
    cur.scale += (M.scale - cur.scale) * k;
    cur.speed += (M.speed - cur.speed) * k;
    cur.react += (M.react - cur.react) * k;
    // Quick to rise on a syllable, slower to settle, so the shape follows speech rather than blurring it.
    cur.lvl += (level - cur.lvl) * Math.min(1, dt * (level > cur.lvl ? 30 : 9));
    const drive = cur.lvl * cur.react;
    phase += dt * (cur.speed + drive * 1.4);

    const w = Math.max(1, canvas.clientWidth),
      h = Math.max(1, canvas.clientHeight);
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    const amp = cur.amp + drive * 0.3;
    const scale = 0.72 * (cur.scale + drive * 0.12);
    const rx = 0.28 + 0.05 * Math.sin(t * 0.4),
      ry = phase * 0.5;
    const tt = phase * 1.6;
    shared.uLevel.value = cur.lvl;
    shared.uLift.value = mode === "thinking" ? 1 : 0;

    for (const m of [wall, shell, aura]) {
      m.rotation.set(rx, ry, 0);
      const u = m.material.uniforms;
      u.uTime.value = tt;
      u.uAmp.value = amp;
      u.uFreq.value = cur.freq;
    }
    wall.scale.setScalar(scale);
    shell.scale.setScalar(scale);
    aura.scale.setScalar(scale * 1.15);
    // The cloud inside drifts a little, so the shell reads as a volume around it.
    cloud.position.set(0.06 * Math.sin(t * 0.45), 0.05 * Math.cos(t * 0.37) - 0.02, 0.08 * Math.sin(t * 0.3));
    cloud.rotation.set(rx * 0.6, ry * 1.3, 0);
    cloud.scale.setScalar(scale * 0.78);
    const cu = cloud.material.uniforms;
    cu.uTime.value = tt + 3.7;
    cu.uAmp.value = amp * 0.55;
    cu.uFreq.value = cur.freq * 1.25;

    renderer.render(scene, camera);

    if (halo) {
      halo.style.transform = `translate(-50%,-50%) scale(${1 + drive * 0.4 + 0.04 * Math.sin(t * 1.25)})`;
      halo.style.opacity = String(0.55 + cur.lvl * 0.45);
    }
  }
  schedule();

  return {
    setMode(m) {
      if (MODES[m]) mode = m;
      wake();
    },
    setAccent(hex) {
      setAccent(hex);
      wake();
    },
    setGlass(v) {
      shared.uGlass.value = Math.max(0, Math.min(0.95, Number(v) || 0));
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
      for (const m of [wall, cloud, shell, aura]) m.material.dispose();
      geometry.dispose();
      renderer.dispose();
      // Browsers keep only so many WebGL contexts; give this one back rather than waiting for GC.
      renderer.forceContextLoss();
    },
  };
}
