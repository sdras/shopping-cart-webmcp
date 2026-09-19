// A Live API session with Gemini, shopping the site through the same tools
// the page registers for WebMCP. One WebSocket carries typed turns, microphone
// audio and the model's spoken replies; transcripts of both sides come back as
// text so the chat log reads whole.
//
// Protocol: https://ai.google.dev/api/live (BidiGenerateContent over WebSockets).
import { stores, storesById } from "../data/stores.js";
import { plural } from "../lib/format.js";
import { TurnTracker } from "./geminiText.js";
import { functionDeclarations, runTool } from "./tools.js";

/** Native audio in and out, function calling, transcription. */
export const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

const HOST = "generativelanguage.googleapis.com";
const PATH = "ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

const IN_RATE = 16000;
const OUT_RATE = 24000;

/**
 * @typedef {'idle' | 'connecting' | 'ready' | 'error'} LiveStatus
 *
 * @typedef {object} ChatMessage
 * @property {string} id
 * @property {'user' | 'model' | 'tool' | 'system'} role
 * @property {string} text
 * @property {{ name: string, error: boolean, undo: object | null }} [tool] Tool messages: the call that ran,
 *   whether it failed, and what it takes to undo it (see `runTool`).
 *
 * @typedef {object} LiveCallbacks
 * @property {(status: LiveStatus) => void} onStatus
 * @property {(message: ChatMessage) => void} onMessage
 * @property {(text: string) => void} onModelDraft The model's reply so far, while it is still talking (empty once logged).
 * @property {(text: string) => void} onUserDraft What the microphone has picked up so far, before the model answers.
 * @property {(on: boolean) => void} onMicChange
 */

const uid = () => Math.random().toString(36).slice(2, 10);

/** What the model needs to know that the tool descriptions do not say: the date, the stores, and how to behave. */
export function systemInstruction(state, now = new Date()) {
  const today = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const open = storesById[state.storeId];
  const inCart = open ? Object.values(state.carts[open.id] ?? {}).reduce((sum, n) => sum + n, 0) : 0;
  const staples = Object.keys(state.staples).length;
  return [
    "You are the voice of Basketful, a grocery delivery site. You speak with the shopper and act on the page through the tools; they watch the page change as you work.",
    `It is ${time} on ${today}. The stores: ${stores.map((s) => `${s.name} (${s.tagline.toLowerCase()})`).join("; ")}.`,
    open
      ? `${open.name} is open, with ${plural(inCart, "item")} in its cart.`
      : "No store is open yet, so start with choose_store; if they have not said which store, ask.",
    staples
      ? `They have ${plural(staples, "staple")} saved. "The usual", "my usuals" and "my staples" all mean add_staples_to_cart.`
      : "They have no staples saved yet.",
    "Before you answer about products, prices, the cart, staples or an order, read it with a tool. Add products by the exact names search_products returns, and never invent a product or a price. When a name matches several products, ask which one.",
    "place_order is a real purchase. Read back the store, how many items, the delivery window, the address and the total, and call it only once the shopper says yes. The checkout tools work only on the checkout page, so call start_checkout first.",
    "When a tool reports a problem, say what it said and offer the fix it suggests.",
    "Replies are spoken aloud: one to three short sentences, plain words, no lists or markdown.",
  ].join("\n");
}

/* ————— audio helpers ————— */

function pcm16(float32) {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ints = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
  const out = new Float32Array(ints.length);
  for (let i = 0; i < ints.length; i++) out[i] = ints[i] / 32768;
  return out;
}

/** An analyser sized for loudness readings a frame at a time: 1024 samples, 64 ms of microphone or 43 ms of speech. */
function tap(ctx) {
  const node = ctx.createAnalyser();
  node.fftSize = 1024;
  return node;
}

const userTurn = (text) => ({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } });

/* ————— the client ————— */

export class GeminiLiveClient {
  ws = null;
  ready = false;
  closing = false;
  queue = [];
  resumeHandle = null;
  retries = 0;

  inputCtx = null;
  outputCtx = null;
  mic = null;
  processor = null;
  micWanted = false;
  /** Taps on the microphone and the speaker, for the orb to read loudness from. */
  micTap = null;
  voiceTap = null;

  playing = [];
  nextStart = 0;
  muted = false;

  modelDraft = "";
  userDraft = "";
  turn = new TurnTracker();
  /** The last thing the shopper asked, typed or spoken, for asking again after a collapse. */
  lastAsk = null;

  /**
   * @param {string} apiKey
   * @param {{ getState: () => object, setState: Function }} app The shopping state, for the session's opening context and for undo.
   * @param {LiveCallbacks} cb
   */
  constructor(apiKey, app, cb) {
    this.apiKey = apiKey;
    this.app = app;
    this.cb = cb;
  }

  /** The microphone, while it is on; read it for how loud the shopper is. */
  get micAnalyser() {
    return this.micTap;
  }

  /** The speaker, while the session is up; read it for how loud the model is. */
  get voiceAnalyser() {
    return this.voiceTap;
  }

  /** Open the socket and send the session setup. Safe to call again after a drop. */
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.closing = false;
    this.cb.onStatus("connecting");
    // Made here, inside the click that started things, so the browser lets it play.
    this.outputContext();
    const ws = new WebSocket(`wss://${HOST}/${PATH}?key=${encodeURIComponent(this.apiKey)}`);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ setup: this.setup() }));
    ws.onmessage = (e) => void this.receive(e.data);
    ws.onerror = () => {
      /* the close event that follows carries the reason */
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      const wasReady = this.ready;
      this.ready = false;
      this.finishDrafts();
      if (this.closing) {
        this.cb.onStatus("idle");
        return;
      }
      // Live connections end after about ten minutes; with a resumption handle the session carries on.
      if (this.resumeHandle && this.retries < 3 && e.code !== 1008) {
        this.retries++;
        this.connect();
        return;
      }
      // Nothing typed while the session was coming up should wait on a session that isn't coming.
      this.queue = [];
      const why = e.reason?.trim();
      this.system(why ? `The session ended: ${why}` : wasReady ? "The session ended." : "Couldn't reach Gemini. Check the connection and the API key.");
      this.cb.onStatus(why || !wasReady ? "error" : "idle");
      this.stopMic();
    };
  }

  /** Close everything: the socket, the microphone, the speakers. */
  disconnect() {
    this.closing = true;
    this.resumeHandle = null;
    this.queue = [];
    this.stopMic();
    this.stopPlayback();
    this.ws?.close(1000);
    this.ws = null;
    this.ready = false;
    void this.outputCtx?.close();
    this.outputCtx = null;
    this.voiceTap = null;
    this.cb.onStatus("idle");
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) this.stopPlayback();
  }

  /** A typed turn. Waits for the session if it is still coming up, so nothing typed is lost. */
  sendText(text) {
    const t = text.trim();
    if (!t) return;
    this.cb.onMessage({ id: uid(), role: "user", text: t });
    this.lastAsk = t;
    if (!this.ready || !this.ws) {
      this.queue.push(t);
      this.connect();
      return;
    }
    this.stopPlayback();
    this.send(userTurn(t));
  }

  /** Something the model should know but not answer, like a change the shopper made by hand. */
  note(text) {
    if (!this.ready) return;
    this.send({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: false } });
  }

  /** Start streaming the microphone; connects first if needed. */
  async startMic() {
    this.micWanted = true;
    this.connect();
    if (this.mic) return;
    try {
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (err) {
      this.micWanted = false;
      this.system(`The microphone could not start: ${err.message}`);
      return;
    }
    if (!this.micWanted) {
      this.mic.getTracks().forEach((t) => t.stop());
      this.mic = null;
      return;
    }
    // A 16 kHz context makes the browser resample the mic to what the model wants.
    this.inputCtx = new AudioContext({ sampleRate: IN_RATE });
    const source = this.inputCtx.createMediaStreamSource(this.mic);
    this.micTap = tap(this.inputCtx);
    source.connect(this.micTap);
    this.processor = this.inputCtx.createScriptProcessor(2048, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (!this.ready) return;
      const samples = e.inputBuffer.getChannelData(0);
      this.send({ realtimeInput: { audio: { mimeType: `audio/pcm;rate=${IN_RATE}`, data: toBase64(pcm16(samples)) } } });
    };
    source.connect(this.processor);
    // A script processor only runs while it is wired to the output; it writes nothing, so nothing is heard.
    this.processor.connect(this.inputCtx.destination);
    this.cb.onMicChange(true);
  }

  stopMic() {
    this.micWanted = false;
    if (!this.mic && !this.inputCtx) return;
    if (this.ready) this.send({ realtimeInput: { audioStreamEnd: true } });
    this.processor?.disconnect();
    this.processor = null;
    this.micTap = null;
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    void this.inputCtx?.close();
    this.inputCtx = null;
    this.cb.onMicChange(false);
  }

  /* ————— session setup ————— */

  setup() {
    return {
      model: `models/${LIVE_MODEL}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
      },
      systemInstruction: { parts: [{ text: systemInstruction(this.app.getState()) }] },
      tools: [{ functionDeclarations: functionDeclarations() }],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // A sliding window over the context lifts the fifteen-minute cap on audio sessions.
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: this.resumeHandle ? { handle: this.resumeHandle } : {},
    };
  }

  send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  system(text) {
    this.cb.onMessage({ id: uid(), role: "system", text });
  }

  /* ————— incoming ————— */

  async receive(raw) {
    const text = raw instanceof Blob ? await raw.text() : String(raw);
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    if (msg.setupComplete) {
      this.ready = true;
      this.retries = 0;
      this.cb.onStatus("ready");
      for (const t of this.queue.splice(0)) this.send(userTurn(t));
      return;
    }

    const resume = msg.sessionResumptionUpdate;
    if (resume?.resumable && resume.newHandle) this.resumeHandle = resume.newHandle;

    if (msg.goAway) this.system("Gemini is about to rotate the connection; the session will pick up where it left off.");

    if (msg.serverContent) this.serverContent(msg.serverContent);

    if (msg.toolCall?.functionCalls?.length) await this.runTools(msg.toolCall.functionCalls);
  }

  serverContent(c) {
    if (c.interrupted) {
      // Talked over: what was said so far goes in the log, the rest is dropped.
      this.stopPlayback();
      this.turn.reset();
      this.finishDrafts();
      return;
    }
    const heard = c.inputTranscription?.text;
    if (heard) {
      this.userDraft += heard;
      this.cb.onUserDraft(this.userDraft);
    }
    const said = c.outputTranscription?.text;
    if (said) this.modelSaid(said);
    for (const p of c.modelTurn?.parts ?? []) {
      if (p.inlineData?.mimeType.startsWith("audio/pcm")) this.play(p.inlineData.data);
      // Thought summaries ride along as text parts; only what is actually said belongs in the log.
      if (p.text && !p.thought) this.modelSaid(p.text);
    }
    if (c.turnComplete) this.endTurn();
  }

  /** A piece of the model's reply, shown without control tokens. */
  modelSaid(raw) {
    const text = this.turn.note(raw);
    if (!text) return;
    this.logUserDraft();
    this.modelDraft += text;
    this.cb.onModelDraft(this.modelDraft);
  }

  /**
   * The turn is over. A turn that was nothing but control tokens is a collapse on Gemini's side:
   * the same question goes once more, then it is left to the shopper to put it another way.
   */
  endTurn() {
    const outcome = this.turn.complete();
    this.finishDrafts();
    if (outcome === "retry" && this.lastAsk) {
      this.system("Lost the thread; asking again.");
      this.stopPlayback();
      this.send(userTurn(this.lastAsk));
    } else if (outcome === "give-up" || (outcome === "retry" && !this.lastAsk)) {
      this.system("Lost the thread again. Try putting it another way.");
    }
  }

  /** The mic transcript becomes a user bubble once the model starts on its answer. */
  logUserDraft() {
    const t = this.userDraft.trim();
    this.userDraft = "";
    this.cb.onUserDraft("");
    if (!t) return;
    this.lastAsk = t;
    this.cb.onMessage({ id: uid(), role: "user", text: t });
  }

  finishDrafts() {
    this.logUserDraft();
    const t = this.modelDraft.trim();
    this.modelDraft = "";
    this.cb.onModelDraft("");
    if (t) this.cb.onMessage({ id: uid(), role: "model", text: t });
  }

  /* ————— tools ————— */

  async runTools(calls) {
    this.turn.toolCalled();
    this.logUserDraft();
    const responses = [];
    for (const { id, name, args } of calls) {
      const { text, error, undo } = await runTool(name, args, this.app);
      this.cb.onMessage({ id: uid(), role: "tool", text, tool: { name, error, undo } });
      responses.push({ id, name, response: error ? { error: text } : { result: text } });
    }
    this.send({ toolResponse: { functionResponses: responses } });
  }

  /* ————— playback ————— */

  outputContext() {
    if (!this.outputCtx) {
      this.outputCtx = new AudioContext({ sampleRate: OUT_RATE });
      // Everything played goes through the tap on its way out, so the orb can move to the voice.
      this.voiceTap = tap(this.outputCtx);
      this.voiceTap.connect(this.outputCtx.destination);
    }
    if (this.outputCtx.state === "suspended") void this.outputCtx.resume();
    return this.outputCtx;
  }

  play(b64) {
    if (this.muted) return;
    const ctx = this.outputContext();
    const samples = fromBase64(b64);
    if (!samples.length) return;
    const buffer = ctx.createBuffer(1, samples.length, OUT_RATE);
    buffer.getChannelData(0).set(samples);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.voiceTap ?? ctx.destination);
    const at = Math.max(this.nextStart, ctx.currentTime + 0.02);
    source.start(at);
    this.nextStart = at + buffer.duration;
    this.playing.push(source);
    source.onended = () => {
      this.playing = this.playing.filter((s) => s !== source);
    };
  }

  stopPlayback() {
    for (const s of this.playing) {
      try {
        s.stop();
      } catch {
        /* not started or already done */
      }
    }
    this.playing = [];
    this.nextStart = 0;
  }
}
