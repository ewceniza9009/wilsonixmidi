/**
 * WILSONIX MIDIKEY Elite - Master Bus Studio Audio Recorder
 * Records lossless 16-bit 48kHz WAV audio directly from the master DSP output.
 *
 * The master tap runs in an AudioWorkletProcessor on the audio render thread and
 * writes into a lock-free SharedArrayBuffer ring buffer; the main thread drains
 * it. (The old ScriptProcessorNode design forced the entire master graph to render
 * through the main thread, producing jitter/dropout hiss during live takes.)
 */

import { audioCore } from "./audio-core.js";
// Worklet code is bundled via raw import + Blob URL for bulletproof offline &
// dev-server portability (same pattern as synth-worklet-node.js)
import tapProcessorCode from "./worklet/audio-tap-processor.js?raw";

import { downloadBlob } from "../utils/download-blob.js";

export class MasterRecorder {
  constructor() {
    this.isRecording = false;
    this.recordStartTime = 0;
    this.recordingDuration = 0;
    this.timerInterval = null;
    this.recBuffersL = [];
    this.recBuffersR = [];
    this.recLength = 0;

    // AudioWorklet tap (persistent once created)
    this._workletNode = null;
    this._tapMute = null;
    this._header = null;
    this._payload = null;
    this._tapMode = null; // null | "worklet" | "script"
    this._lastOverflow = 0;

    // ScriptProcessor fallback (legacy WebViews)
    this.processorNode = null;
    this._drainInterval = null;
    this.onStateChange = null;
  }

  start() {
    if (this.isRecording) return;
    const ctx = audioCore.ctx;
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    this.recBuffersL = [];
    this.recBuffersR = [];
    this.recLength = 0;
    this.isRecording = true;
    this.recordStartTime = Date.now();
    this.recordingDuration = 0;
    this._lastOverflow = 0;

    // Ensure the capture tap exists (AudioWorklet preferred, ScriptProcessor fallback)
    this._ensureTap();

    // Drain the worklet ring on the main thread (no-ops until the tap is live)
    if (!this._drainInterval) {
      this._drainInterval = setInterval(() => this._drain(), 90);
    }

    this.timerInterval = setInterval(() => {
      this.recordingDuration = (Date.now() - this.recordStartTime) / 1000;
      if (this.onStateChange) {
        this.onStateChange({
          isRecording: true,
          duration: this.recordingDuration,
          formattedTime: this.formatTime(this.recordingDuration),
        });
      }
    }, 200);

    if (this.onStateChange) {
      this.onStateChange({
        isRecording: true,
        duration: 0,
        formattedTime: "00:00",
      });
    }

    console.log("Master Bus Audio Recording Started (WAV)");
  }

  _ensureTap() {
    const ctx = audioCore.ctx;
    if (!ctx || !audioCore.analyser) return;
    if (this._tapMode) return; // already created

    if (ctx.audioWorklet && typeof ctx.audioWorklet.addModule === "function") {
      this._initWorkletTap(ctx).catch(err => {
        console.warn("[MasterRecorder] AudioWorklet tap unavailable, falling back to ScriptProcessor:", err);
        this._initScriptTap(ctx);
      });
    } else {
      this._initScriptTap(ctx);
    }
  }

  async _initWorkletTap(ctx) {
    const blob = new Blob([tapProcessorCode], { type: "application/javascript" });
    const moduleUrl = URL.createObjectURL(blob);
    try {
      await ctx.audioWorklet.addModule(moduleUrl);
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }

    // 8 seconds of interleaved stereo float PCM
    const capSamples = Math.floor(ctx.sampleRate * 8) * 2;
    const sab = new SharedArrayBuffer(16 + capSamples * 4);
    this._payload = new Float32Array(sab, 16, capSamples);
    this._header = new Int32Array(sab, 0, 4);

    this._workletNode = new AudioWorkletNode(ctx, "wilsonix-audio-tap", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: "explicit",
      processorOptions: { sharedBuffer: sab },
    });

    // Tap master output before destination. The tap itself emits silence; the
    // zero-gain sink keeps the node connected so it renders while remaining
    // inaudible, so what you hear while recording matches playback.
    audioCore.analyser.connect(this._workletNode);
    this._tapMute = ctx.createGain();
    this._tapMute.gain.value = 0.0;
    this._workletNode.connect(this._tapMute);
    this._tapMute.connect(ctx.destination);
    this._tapMode = "worklet";
    console.log("[MasterRecorder] AudioWorklet master tap online");
  }

  _initScriptTap(ctx) {
    const bufferSize = 4096;
    this.processorNode = ctx.createScriptProcessor(bufferSize, 2, 2);

    this.processorNode.onaudioprocess = e => {
      if (!this.isRecording) return;
      const inputL = e.inputBuffer.getChannelData(0);
      const inputR = e.inputBuffer.getChannelData(1);

      this.recBuffersL.push(new Float32Array(inputL));
      this.recBuffersR.push(new Float32Array(inputR));
      this.recLength += inputL.length;
    };

    if (audioCore.analyser) {
      audioCore.analyser.connect(this.processorNode);
      this.tapMute = ctx.createGain();
      this.tapMute.gain.value = 0.0;
      this.processorNode.connect(this.tapMute);
      this.tapMute.connect(ctx.destination);
    }
    this._tapMode = "script";
  }

  _drain() {
    if (this._tapMode !== "worklet" || !this._header || !this._payload) return;
    const h = this._header;
    const p = this._payload;
    const cap = p.length;

    const r = h[0];
    const w = h[1];
    if (r === w) return;

    const frames = Math.floor(((w - r + cap) % cap) / 2);
    if (frames <= 0) return;
    const next = (r + frames * 2) % cap;

    if (this.isRecording) {
      const cL = new Float32Array(frames);
      const cR = new Float32Array(frames);
      let pos = r;
      for (let i = 0; i < frames; i++) {
        cL[i] = p[pos];
        cR[i] = p[pos + 1];
        pos = (pos + 2) % cap;
      }
      this.recBuffersL.push(cL);
      this.recBuffersR.push(cR);
      this.recLength += frames;
    }

    if (h[2] !== this._lastOverflow) {
      this._lastOverflow = h[2];
      console.warn("[MasterRecorder] ring buffer overflow, dropped audio frames:", h[2]);
    }

    Atomics.store(h, 0, next);
  }

  stopAndExport() {
    if (!this.isRecording) return null;

    this.isRecording = false;
    clearInterval(this.timerInterval);

    // Capture any trailing frames still sitting in the ring buffer
    this._drain();

    // ScriptProcessor fallback is per-run; tear it down on stop.
    // The AudioWorklet tap is persistent and merely discards when idle.
    if (this._tapMode === "script" && this.processorNode) {
      try {
        if (audioCore.analyser) audioCore.analyser.disconnect(this.processorNode);
        this.processorNode.disconnect();
        if (this.tapMute) this.tapMute.disconnect();
      } catch (e) {}
      this.processorNode = null;
      this._tapMode = null;
    }

    const sampleRate = audioCore.ctx?.sampleRate || 48000;
    const wavBlob = this.encodeWAV(this.recBuffersL, this.recBuffersR, this.recLength, sampleRate);

    // Trigger auto-download (native share sheet on Android)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `WILSONIX_Live_Take_${timestamp}.wav`;
    downloadBlob(filename, wavBlob);

    if (this.onStateChange) {
      this.onStateChange({
        isRecording: false,
        duration: this.recordingDuration,
        formattedTime: this.formatTime(this.recordingDuration),
        exportedFile: filename,
      });
    }

    console.log(`Master Bus Audio Recording Saved: ${filename}`);
    return wavBlob;
  }

  formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  encodeWAV(buffersL, buffersR, length, sampleRate) {
    // Merge buffers
    const flatL = new Float32Array(length);
    const flatR = new Float32Array(length);
    let offset = 0;
    for (let i = 0; i < buffersL.length; i++) {
      flatL.set(buffersL[i], offset);
      flatR.set(buffersR[i], offset);
      offset += buffersL[i].length;
    }

    // Interleave stereo samples to 16-bit PCM
    const buffer = new ArrayBuffer(44 + length * 2 * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + length * 2 * 2, true);
    this.writeString(view, 8, "WAVE");

    // fmt sub-chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, 2, true); // NumChannels (2 = Stereo)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 4, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 4, true); // BlockAlign (NumChannels * BitsPerSample/8)
    view.setUint16(34, 16, true); // BitsPerSample (16-bit)

    // data sub-chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, length * 2 * 2, true);

    // Write PCM samples with soft clipping
    let dataOffset = 44;
    for (let i = 0; i < length; i++) {
      let sL = flatL[i];
      let sR = flatR[i];

      // Soft clamp -1.0 to +1.0
      sL = Math.max(-1, Math.min(1, sL));
      sR = Math.max(-1, Math.min(1, sR));

      // 16-bit conversion
      const intL = sL < 0 ? sL * 0x8000 : sL * 0x7fff;
      const intR = sR < 0 ? sR * 0x8000 : sR * 0x7fff;

      view.setInt16(dataOffset, intL, true);
      dataOffset += 2;
      view.setInt16(dataOffset, intR, true);
      dataOffset += 2;
    }

    return new Blob([view], { type: "audio/wav" });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

export const masterRecorder = new MasterRecorder();