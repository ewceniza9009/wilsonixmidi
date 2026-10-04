/**
 * Real input-latency instrumentation + acoustic loopback bench.
 *
 * The HUD latency pill shows only ctx.baseLatency + ctx.outputLatency — the
 * audio OUTPUT path — while the old tooltip claimed "round-trip". This
 * module adds the missing measurements:
 *
 *  - per-source input delivery (event.timeStamp → JS handler entry) for
 *    MIDI, touch/mouse, and QWERTY events. Chromium stamps event.timeStamp
 *    at hardware/driver delivery on the performance.now() clock, so the
 *    delta to handler entry IS the input path latency.
 *  - JS dispatch time (handler entry → engine call complete).
 *  - an acoustic speaker→mic loopback bench that measures the actual output
 *    path end to end, instead of trusting API-reported estimates.
 *
 * Everything is passive: the meters are plain EMAs, and the bench only
 * touches the mic graph while it runs.
 */

import probeWorkletCode from "./worklet/latency-probe-processor.js?raw";

const EMA_ALPHA = 0.3;
// Below this a "delivery" is really an untimestamped event (some engines set
// timeStamp to now). Such samples must not be presented as measurements.
const ZERO_MS = 0.05;

export function round1(x) {
  return Math.round(x * 10) / 10;
}

export function median(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

class SourceStats {
  constructor() {
    this.deliveryEma = null;
    this.dispatchEma = null;
    this.minDelivery = Infinity;
    this.maxDelivery = -Infinity;
    this.samples = 0;
    this.zeroCount = 0;
  }
}

const sources = new Map();

function statsFor(source) {
  if (!sources.has(source)) sources.set(source, new SourceStats());
  return sources.get(source);
}

export const latencyMeter = {
  /**
   * Record when an input event actually reached JS. Returns a t0 token to
   * hand to dispatchDone(). Browsers that do not timestamp events are
   * tracked via zeroCount so the UI can say "not measurable here".
   */
  inputArrived(source, eventTimeStamp, nowMs) {
    const now = nowMs === undefined ? performance.now() : nowMs;
    const s = statsFor(source);
    const ts = Number(eventTimeStamp);
    if (Number.isFinite(ts) && ts > 0) {
      const delivery = now - ts;
      if (delivery >= 0) {
        if (delivery < ZERO_MS) {
          s.zeroCount++;
        } else {
          s.deliveryEma =
            s.deliveryEma === null
              ? delivery
              : s.deliveryEma * (1 - EMA_ALPHA) + delivery * EMA_ALPHA;
          if (delivery < s.minDelivery) s.minDelivery = delivery;
          if (delivery > s.maxDelivery) s.maxDelivery = delivery;
        }
        s.samples++;
      }
    }
    return now;
  },

  /** Record how long the JS note-dispatch path took for this event. */
  dispatchDone(source, t0, nowMs) {
    const now = nowMs === undefined ? performance.now() : nowMs;
    const s = statsFor(source);
    const ms = now - t0;
    if (Number.isFinite(ms) && ms >= 0) {
      s.dispatchEma =
        s.dispatchEma === null ? ms : s.dispatchEma * (1 - EMA_ALPHA) + ms * EMA_ALPHA;
    }
  },

  /**
   * { deliveryMs, dispatchMs, samples, trusted, minMs, maxMs } or null when
   * nothing has been measured yet. deliveryMs is null when the browser does
   * not timestamp events on this platform.
   */
  getStats(source) {
    const s = sources.get(source);
    if (!s || s.samples === 0) return null;
    const trusted = s.zeroCount < s.samples * 0.8;
    return {
      deliveryMs: trusted && s.deliveryEma !== null ? round1(s.deliveryEma) : null,
      dispatchMs: s.dispatchEma === null ? null : round1(s.dispatchEma),
      samples: s.samples,
      trusted,
      minMs: s.minDelivery === Infinity ? null : round1(s.minDelivery),
      maxMs: s.maxDelivery === -Infinity ? null : round1(s.maxDelivery),
    };
  },

  reset() {
    sources.clear();
  },
};

/**
 * Pairs each mic detection with the click it came from and returns the
 * per-click loopback latencies in ms. Bogus pairs (ambient noise, missed
 * clicks, double detections) are rejected by the window bounds and the
 * one-detection-per-click pairing.
 */
export function correlateDetections(
  clickTimesSec,
  detectTimesSec,
  { minMs = 2, maxMs = 500 } = {}
) {
  const used = new Set();
  const samples = [];
  for (const click of clickTimesSec) {
    let best = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < detectTimesSec.length; i++) {
      if (used.has(i)) continue;
      const deltaMs = (detectTimesSec[i] - click) * 1000;
      if (deltaMs < minMs || deltaMs > maxMs) continue;
      if (deltaMs < bestDelta) {
        bestDelta = deltaMs;
        best = i;
      }
    }
    if (best >= 0) {
      used.add(best);
      samples.push(round1(bestDelta));
    }
  }
  const med = median(samples);
  return {
    samples,
    medianMs: med === null ? null : round1(med),
    spreadMs:
      samples.length > 1 ? round1(Math.max(...samples) - Math.min(...samples)) : 0,
    matched: samples.length,
  };
}

let _probeModulePromise = null;

async function ensureProbeModule(ctx) {
  if (!_probeModulePromise) {
    _probeModulePromise = (async () => {
      const blob = new Blob([probeWorkletCode], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      try {
        await ctx.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    })();
    _probeModulePromise.catch(() => {
      _probeModulePromise = null;
    });
  }
  return _probeModulePromise;
}

function buildClickBuffer(ctx) {
  const sr = ctx.sampleRate;
  const len = Math.max(8, Math.floor(sr * 0.003));
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  const freq = 2000;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const attack = Math.min(1, i / (sr * 0.0002));
    const release = Math.max(0, 1 - t / 0.003);
    data[i] = Math.sin(2 * Math.PI * freq * t) * attack * release * 0.9;
  }
  return buf;
}

/**
 * Acoustic loopback bench: schedules click bursts straight to the output
 * device and measures (on the AudioContext clock) when the microphone
 * actually hears them. The result includes the mic input buffer depth
 * (typically ~5–20 ms) on top of the speaker output path.
 *
 * Run it with the device speaker ON, headphones unplugged, in a quiet room.
 */
export async function runLoopbackBench({
  ctx,
  clicks = 8,
  intervalSec = 0.4,
  onStatus,
} = {}) {
  const status = (msg) => {
    if (onStatus) onStatus(msg);
  };

  if (!ctx) {
    return { ok: false, error: "Audio engine not started yet — play a note first." };
  }
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== "function"
  ) {
    return { ok: false, error: "Microphone capture not available on this platform." };
  }

  let stream = null;
  let micSrc = null;
  let filter = null;
  let probe = null;
  let sink = null;
  let clickGain = null;

  const cleanup = () => {
    try { micSrc && micSrc.disconnect(); } catch (e) {}
    try { filter && filter.disconnect(); } catch (e) {}
    try { probe && probe.disconnect(); } catch (e) {}
    try { sink && sink.disconnect(); } catch (e) {}
    try { clickGain && clickGain.disconnect(); } catch (e) {}
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    } catch (e) {}
  };

  try {
    status("Requesting microphone…");
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
  } catch (e) {
    return {
      ok: false,
      error: "Microphone unavailable: " + (e && e.message ? e.message : "permission denied"),
    };
  }

  try {
    status("Loading probe…");
    await ensureProbeModule(ctx);

    micSrc = ctx.createMediaStreamSource(stream);
    filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2000;
    filter.Q.value = 1.2;

    probe = new AudioWorkletNode(ctx, "wilsonix-latency-probe", {
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    // Zero-gain sink guarantees the probe is pulled by the audio graph.
    sink = ctx.createGain();
    sink.gain.value = 0;
    micSrc.connect(filter).connect(probe).connect(sink).connect(ctx.destination);

    const detections = [];
    probe.port.onmessage = (ev) => {
      if (ev.data && ev.data.type === "detect") detections.push(ev.data.t);
    };

    clickGain = ctx.createGain();
    clickGain.gain.value = 0.7;
    clickGain.connect(ctx.destination);
    const clickBuffer = buildClickBuffer(ctx);

    status("Calibrating ambient noise…");
    const t0 = ctx.currentTime + 0.45;
    const clickTimes = [];
    for (let i = 0; i < clicks; i++) {
      const src = ctx.createBufferSource();
      src.buffer = clickBuffer;
      src.connect(clickGain);
      const when = t0 + i * intervalSec;
      src.start(when);
      clickTimes.push(when);
      src.onended = () => {
        try { src.disconnect(); } catch (e) {}
      };
    }

    status(`Measuring ${clicks} clicks…`);
    const totalMs = (0.45 + clicks * intervalSec + 0.5) * 1000;
    await new Promise((resolve) => setTimeout(resolve, totalMs));

    const result = correlateDetections(clickTimes, detections);
    cleanup();

    if (result.matched < 3) {
      return {
        ok: false,
        error: `Only heard ${result.matched}/${clicks} clicks — speaker ON (volume ~70%), headphones unplugged, quiet room, then retry.`,
        ...result,
      };
    }

    status(`Done: ${result.medianMs} ms median loopback`);
    return {
      ok: true,
      loopbackMs: result.medianMs,
      spreadMs: result.spreadMs,
      matched: result.matched,
      clicks,
      ...result,
    };
  } catch (e) {
    cleanup();
    return { ok: false, error: e && e.message ? e.message : "bench failed" };
  }
}
