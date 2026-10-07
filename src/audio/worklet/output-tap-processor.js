/**
 * Output Tap (AudioWorklet) - native bridge feed.
 *
 * Sits at the app's final output point (after limiter + spatial, right before
 * ctx.destination) while the native Oboe bridge is active. Two jobs:
 *
 *  1. Accumulates the final stereo mix into fixed-size chunks (default 5ms)
 *     and posts each chunk to the main thread (transferable, zero-copy), which
 *     ships it to the native Oboe engine over the Capacitor bridge.
 *  2. Outputs DIGITAL SILENCE to Chromium, so the web path stays wired (the
 *     graph keeps pulling - voices/effects keep rendering) but never double-
 *     plays against the native stream. On fallback the main thread rewires
 *     outputStage straight to destination and this node is discarded.
 *
 * Node-importable: registration is guarded like pcm-processor.js so unit
 * tests can instantiate the class directly.
 */

class OutputTapProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.chunkFrames = opts.chunkFrames > 0 ? Math.floor(opts.chunkFrames) : 240;
    this.channels = 2;
    this.buffer = new Float32Array(this.chunkFrames * this.channels);
    this.fill = 0;
    this.enabled = true;
    this.chunksPosted = 0;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.type === "disable") this.enabled = false;
      else if (d.type === "enable") this.enabled = true;
      else if (d.type === "drop") this.fill = 0;
    };
  }

  _flush() {
    const chunk = this.buffer.slice();
    this.port.postMessage(chunk, [chunk.buffer]);
    this.chunksPosted++;
    this.fill = 0;
  }

  process(inputs, outputs) {
    // Web output stays silent: audible playback belongs to the native stream.
    const out = outputs[0];
    if (out) {
      for (let c = 0; c < out.length; c++) out[c].fill(0);
    }

    const input = inputs[0];
    const ch0 = input && input[0];
    if (!this.enabled || !ch0) return true;
    const ch1 = input[1] || ch0;
    const n = ch0.length;

    let i = 0;
    while (i < n) {
      const space = this.chunkFrames - this.fill;
      const take = Math.min(space, n - i);
      const base = this.fill * this.channels;
      for (let k = 0; k < take; k++) {
        this.buffer[base + k * 2] = ch0[i + k];
        this.buffer[base + k * 2 + 1] = ch1[i + k];
      }
      this.fill += take;
      i += take;
      if (this.fill >= this.chunkFrames) this._flush();
    }
    return true;
  }
}

if (typeof globalThis.registerProcessor === "function" && !globalThis.__wilsonixOutputTapRegistered) {
  globalThis.__wilsonixOutputTapRegistered = true;
  registerProcessor("wilsonix-output-tap", OutputTapProcessor);
}

if (typeof globalThis !== "undefined") globalThis.OutputTapProcessor = OutputTapProcessor;

export { OutputTapProcessor };
