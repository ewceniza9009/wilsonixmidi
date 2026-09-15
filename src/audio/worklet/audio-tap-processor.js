/**
 * WILSONIX MIDIKEY Elite - Master Bus Audio Tap Processor
 * AudioWorkletProcessor that taps the master signal and copies it into a
 * lock-free SharedArrayBuffer ring buffer so lossless capture runs entirely on
 * the audio render thread. Replaces the ScriptProcessorNode tap, which forced
 * the master graph through the main thread and caused jitter/dropout hiss
 * while recording live takes.
 *
 * Header layout: [0]=readPtr (drained on main thread), [1]=writePtr,
 * [2]=overflow counter, [3]=reserved.
 */

class WilsonixAudioTapProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const sab = options?.processorOptions?.sharedBuffer;
    this.hasSAB = !!(sab && typeof SharedArrayBuffer !== "undefined" && sab instanceof SharedArrayBuffer);
    if (this.hasSAB) {
      this.header = new Int32Array(sab, 0, 4);
      this.payload = new Float32Array(sab, 16, (sab.byteLength - 16) / 4);
    }
  }

  process(inputs, outputs) {
    if (!this.hasSAB) return true;
    const input = inputs[0];
    if (!input || input.length < 2) return true;
    const L = input[0];
    const R = input[1];
    if (!L || !R) return true;

    const n = L.length;
    const h = this.header;
    const p = this.payload;
    const cap = p.length;

    // Drop oldest samples if the main thread falls behind
    const used = (h[1] - h[0] + cap) % cap;
    const free = cap - used;
    const needed = n * 2;
    if (needed > free) {
      h[0] = (h[0] + (needed - free)) % cap;
      h[2] = (h[2] + 1) >>> 0;
    }

    // Interleaved stereo write
    let w = h[1];
    for (let i = 0; i < n; i++) {
      p[w] = L[i];
      p[w + 1] = R[i];
      w += 2;
      if (w >= cap) w = 0;
    }
    h[1] = w;
    return true;
  }
}

registerProcessor("wilsonix-audio-tap", WilsonixAudioTapProcessor);