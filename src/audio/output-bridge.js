/**
 * Native Output Bridge (Oboe) - Phase A POC.
 *
 * Replaces ONLY the last mile of the audio path on Android: the final mix is
 * tapped at outputStage, shipped to native as base64 float32 (10ms chunks,
 * ~100/s) over the Capacitor bridge, and played by an Oboe LowLatency stream
 * (~3ms burst) instead of Chromium's ~45ms output pipeline. Everything
 * upstream (voices, effects, limiter, spatial, recorder taps) is untouched.
 *
 * Safety contract (regression-proofing):
 *  - OFF by default; activates only via ?bridge=1, the popover's ENABLE
 *    button, or a persisted success (APK launches carry no query string).
 *  - The graph is mutated ONLY after the native stream has opened. Any
 *    failure - configure, rework, write errors, xrun storm, stream death -
 *    restores the original wiring (outputStage -> ctx.destination), clears
 *    the persisted flag (no boot-retry loops), and fires
 *    `wilsonix-output-fallback`. Failing always lands on today's exact web
 *    path, never on silence.
 *  - Chromium's path stays connected through a silent tap while active (the
 *    graph keeps pulling; audible playback belongs to the native stream).
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import tapProcessorCode from "./worklet/output-tap-processor.js?raw";

const AudioBridge = registerPlugin("AudioBridge");

// Survives restarts once native output has PROVEN it works on this device;
// any _fail() clears it so a broken path never boot-loops.
const PERSIST_KEY = "midikey_native_bridge";

function persistedBridgeEnabled() {
  try {
    return localStorage.getItem(PERSIST_KEY) === "1";
  } catch (e) {
    return false;
  }
}

const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Fast Uint8Array -> base64 (no spread, no call-stack limits). */
export function toBase64(u8) {
  let out = "";
  const len = u8.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const n = (u8[i] << 16) | (u8[i + 1] << 8) | u8[i + 2];
    out +=
      B64_CHARS[(n >> 18) & 63] +
      B64_CHARS[(n >> 12) & 63] +
      B64_CHARS[(n >> 6) & 63] +
      B64_CHARS[n & 63];
  }
  const rem = len - i;
  if (rem === 1) {
    const n = u8[i] << 16;
    out +=
      B64_CHARS[(n >> 18) & 63] +
      B64_CHARS[(n >> 12) & 63] +
      "==";
  } else if (rem === 2) {
    const n = (u8[i] << 16) | (u8[i + 1] << 8);
    out +=
      B64_CHARS[(n >> 18) & 63] +
      B64_CHARS[(n >> 12) & 63] +
      B64_CHARS[(n >> 6) & 63] +
      "=";
  }
  return out;
}

/** True only when ?bridge=1 is present (testable with an explicit search). */
export function shouldEnable(search) {
  try {
    const q =
      typeof search === "string"
        ? search
        : typeof location !== "undefined"
          ? location.search
          : "";
    return new URLSearchParams(q).get("bridge") === "1";
  } catch (e) {
    return false;
  }
}

export class OutputBridge {
  constructor(audioCore) {
    this.core = audioCore;
    this.enabled = false;
    this.active = false;
    this.fallbackReason = null;
    this.nativeInfo = null;
    this.stats = null;
    this._attempted = false;
    this._tapNode = null;
    this._silentGain = null;
    this._inflight = 0;
    this._chunksSent = 0;
    this._writeErrors = 0;
    this._zeroWrites = 0;
    this._droppedChunks = 0;
    this._dropBurst = 0;
    this._rttEwma = null;
    this._lastXruns = 0;
    this._watchdogStrikes = 0;
    this._watchdog = null;
  }

  /** Called from audio-core resume() (first gesture): query flag OR persist. */
  maybeEnable() {
    if (!shouldEnable() && !persistedBridgeEnabled()) {
      return Promise.resolve(false);
    }
    return this.enable();
  }

  /**
   * One-shot attempt gate. Success persists the choice for future launches;
   * failure clears persistence (transient issues are re-tried by the user
   * via retryEnable(), never silently at every boot).
   */
  async enable() {
    if (this._attempted || this.enabled) return this.enabled;
    this._attempted = true;
    const ok = await this._enableInner();
    try {
      if (ok) localStorage.setItem(PERSIST_KEY, "1");
      else localStorage.removeItem(PERSIST_KEY);
    } catch (e) {}
    return ok;
  }

  /** Popover RETRY path: allows a fresh attempt after an earlier failure. */
  async retryEnable() {
    if (this.enabled) return true;
    this._attempted = false;
    this.fallbackReason = null;
    return this.enable();
  }

  /** Popover DISABLE path: restore web output and forget the choice. */
  disable() {
    this._fail("user-disabled");
  }

  async _enableInner() {
    const core = this.core;
    const ctx = core && core.ctx;
    if (!Capacitor.isNativePlatform() || !ctx || !core.outputStage) {
      this.fallbackReason = "not-native-or-no-ctx";
      return false;
    }

    // 1. Worklet module (blob-inlined, same pattern as pcm-worklet-node.js).
    try {
      if (!ctx.audioWorklet._wilsonixOutputTapRegistered) {
        const blob = new Blob([tapProcessorCode], {
          type: "application/javascript",
        });
        const url = URL.createObjectURL(blob);
        try {
          await ctx.audioWorklet.addModule(url);
        } finally {
          URL.revokeObjectURL(url);
        }
        ctx.audioWorklet._wilsonixOutputTapRegistered = true;
      }
    } catch (e) {
      this.fallbackReason = "worklet-load-failed";
      return false;
    }

    // 2. Native configure BEFORE any graph change: failure mutates nothing.
    const chunkFrames = Math.max(128, Math.round(ctx.sampleRate * 0.01));
    let cfg;
    try {
      cfg = await AudioBridge.configure({ sampleRate: Math.round(ctx.sampleRate) });
    } catch (e) {
      const detail = ((e && e.message) || String(e)).slice(0, 160);
      this.fallbackReason = `configure-rejected: ${detail}`;
      console.error("[OutputBridge] configure rejected:", e);
      return false;
    }
    if (!cfg || cfg.ok === false) {
      const detail = (cfg && cfg.error ? `: ${cfg.error}` : "").slice(0, 160);
      this.fallbackReason = `configure-failed${detail}`;
      return false;
    }
    if (cfg.sampleRate && cfg.sampleRate !== Math.round(ctx.sampleRate)) {
      // POC has no resampler - a rate mismatch must fall back, never detune.
      try {
        await AudioBridge.stop();
      } catch (e) {}
      this.fallbackReason = "rate-mismatch";
      return false;
    }
    this.nativeInfo = cfg;

    // 3. Graph rewire. All steps run in one JS task, so Web Audio applies
    //    them atomically at the next render quantum - no gap, no double-play.
    let tap = null;
    let silent = null;
    try {
      tap = new AudioWorkletNode(ctx, "wilsonix-output-tap", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { chunkFrames },
      });
      tap.port.onmessage = (e) => this._onChunk(e.data);
      silent = ctx.createGain();
      silent.gain.value = 0;
      silent.connect(ctx.destination);
      tap.connect(silent);
      const stage = core.outputStage;
      stage.connect(tap);
      stage.disconnect(ctx.destination);
      this._tapNode = tap;
      this._silentGain = silent;
    } catch (e) {
      try {
        if (tap) tap.disconnect();
      } catch (e2) {}
      try {
        if (silent) silent.disconnect();
      } catch (e2) {}
      try {
        const stage = core.outputStage;
        stage.disconnect();
        stage.connect(ctx.destination);
      } catch (e2) {}
      try {
        AudioBridge.stop();
      } catch (e2) {}
      this.fallbackReason = "rewire-failed";
      return false;
    }

    this.enabled = true;
    this.active = true;
    this.fallbackReason = null;
    this._lastXruns = 0;
    this._startWatchdog();
    try {
      window.dispatchEvent(
        new CustomEvent("wilsonix-output-bridge", {
          detail: { state: "active", ...(cfg || {}) },
        }),
      );
    } catch (e) {}
    console.info("[OutputBridge] native Oboe output active", cfg);
    return true;
  }

  /** Tap worklet chunk -> base64 -> native ring. Backpressure-gated. */
  _onChunk(chunk) {
    if (!this.enabled) return;
    if (!chunk || typeof chunk.length !== "number" || chunk.length === 0) return;
    if (this._inflight >= 12) {
      // Bridge stall (>=120ms of unanswered writes): SKIP this 10ms slice
      // instead of queueing latency behind it. The native ring underruns
      // briefly (click-guard fades), and the first resolving write resets the
      // burst - so a transient main-thread stall survives. Only a SUSTAINED
      // overload (50 straight drops = 500ms, or promises that never settle)
      // falls back to the web path.
      this._droppedChunks++;
      this._dropBurst++;
      if (this._dropBurst >= 50) this._fail("backpressure");
      return;
    }
    let b64;
    try {
      b64 = toBase64(
        new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength),
      );
    } catch (e) {
      this._fail("encode-failed");
      return;
    }
    this._inflight++;
    this._chunksSent++;
    const t0 = Date.now();
    AudioBridge.write({ data: b64 })
      .then((res) => {
        this._inflight--;
        this._dropBurst = 0;
        const rtt = Date.now() - t0;
        this._rttEwma =
          this._rttEwma == null ? rtt : this._rttEwma * 0.85 + rtt * 0.15;
        if (res && res.written === 0) {
          this._zeroWrites++;
          // Ring full for ~1.2s straight = consumer stopped draining.
          if (this._zeroWrites > 120) this._fail("ring-full");
        } else {
          this._zeroWrites = 0;
        }
      })
      .catch(() => {
        this._inflight--;
        this._dropBurst = 0;  // bridge answered - this is an error, not a stall
        this._writeErrors++;
        if (this._writeErrors > 10) this._fail("write-errors");
      });
  }

  _startWatchdog() {
    if (this._watchdog) clearInterval(this._watchdog);
    this._watchdog = setInterval(() => this._poll(), 1000);
  }

  async _poll() {
    if (!this.enabled) return;
    let s = null;
    try {
      s = await AudioBridge.stats();
    } catch (e) {
      this._fail("stats-unreachable");
      return;
    }
    if (!this.enabled) return;  // a chunk failure won the race
    this._evaluateStats(s);
  }

  /**
   * Watchdog policy (pure, unit-tested). Structural failures fall back on the
   * spot; TRANSIENT health blips (one bad second from a UI jank stall) get a
   * 2-strike grace - strike resets on any clean window, so a single popover
   * render hitch fades over via the click-guard instead of killing the bridge.
   * Prefill phase (stream not started yet) is healthy by definition.
   */
  _evaluateStats(s) {
    if (!s || s.ok === false) {
      this._fail("stats-invalid");
      return;
    }
    this.stats = s;
    if (s.error) {
      this._fail("native-stream-error");
      return;
    }
    if (!s.running && !s.prefilling) {
      this._fail("stream-stopped");
      return;
    }
    const xruns = s.xruns || 0;
    const delta = xruns - this._lastXruns;
    this._lastXruns = xruns;
    const starved = s.fillMs < 1 && this._chunksSent > 50;
    if (delta > 12 || starved) {
      this._watchdogStrikes++;
      if (this._watchdogStrikes >= 2) {
        this._fail(delta > 12 ? "xrun-storm" : "ring-starvation");
        return;
      }
    } else {
      this._watchdogStrikes = 0;
    }
    if (xruns > 250) {
      this._fail("xrun-cumulative");
      return;
    }
    if (s.fillMs > 100) {
      this._fail("ring-overflow");
      return;
    }
    try {
      this.core.updateLatencyMetrics();
    } catch (e) {}
  }

  /**
   * Restore the original web path. Runs in ONE task -> the graph swaps at the
   * next render quantum with no audible gap. Safe to call any number of times,
   * before or after enable().
   */
  _fail(reason) {
    const wasActive = this.enabled;
    this.enabled = false;
    this.active = false;
    if (this._watchdog) {
      clearInterval(this._watchdog);
      this._watchdog = null;
    }
    if (!this.fallbackReason) this.fallbackReason = reason;
    // Never persist a state we just failed out of (also covers user-disabled).
    try {
      localStorage.removeItem(PERSIST_KEY);
    } catch (e) {}

    const core = this.core;
    const ctx = core && core.ctx;
    try {
      if (this._tapNode) {
        this._tapNode.port.onmessage = null;
        this._tapNode.disconnect();
      }
    } catch (e) {}
    try {
      if (this._silentGain) this._silentGain.disconnect();
    } catch (e) {}
    this._tapNode = null;
    this._silentGain = null;
    try {
      if (core && core.outputStage && ctx) {
        core.outputStage.disconnect();
        core.outputStage.connect(ctx.destination);
      }
    } catch (e) {}
    try {
      const stopResult = AudioBridge.stop();
      if (stopResult && typeof stopResult.catch === "function") {
        stopResult.catch(() => {});
      }
    } catch (e) {}

    if (wasActive) {
      try {
        window.dispatchEvent(
          new CustomEvent("wilsonix-output-fallback", {
            detail: { reason },
          }),
        );
      } catch (e) {}
      console.warn("[OutputBridge] fell back to web output:", reason);
      try {
        if (core) core.updateLatencyMetrics();
      } catch (e) {}
    }
  }

  getSummary() {
    return {
      active: this.active,
      attempted: this._attempted,
      fallbackReason: this.fallbackReason,
      chunksSent: this._chunksSent,
      inflight: this._inflight,
      writeErrors: this._writeErrors,
      droppedChunks: this._droppedChunks,
      rttMs: this._rttEwma == null ? null : Math.round(this._rttEwma),
      native: this.nativeInfo || null,
      stats: this.stats || null,
    };
  }

  dispose() {
    this._fail("dispose");
  }
}
