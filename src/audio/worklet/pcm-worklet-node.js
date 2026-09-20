/**
 * WILSONIX MIDIKEY Elite - PcmWorkletNode
 * Main-thread bridge for the AudioWorklet PCM sample playback engine.
 * Routes noteOn/noteOff from NativePcmEngine to the audio thread.
 */

import { MidiRingBufferWriter } from "./ring-buffer.js";
import processorCode from "./pcm-processor.js?raw";

export class PcmWorkletNode {
  constructor(ctx, destination = null) {
    this.ctx = ctx;
    this.destination = destination || ctx.destination;
    this.node = null;
    this.writer = null;
    this.isReady = false;
    this.sharedBuffer = null;
    this._pendingBuffers = [];
    this._loadedBuffers = new Set();
    this._loadedBufferMaxSize = 60; // max anchors held in worklet to prevent memory bloat
    this._bufferRegistry = new Map();
    this._sustainSettings = null;
  }

  async init() {
    if (this.isReady) return true;
    if (!this.ctx || !this.ctx.audioWorklet) {
      console.warn("[PcmWorkletNode] AudioWorklet not supported");
      return false;
    }

    try {
      this.sharedBuffer = MidiRingBufferWriter.createSharedBuffer();
      this.writer = new MidiRingBufferWriter(this.sharedBuffer);

      if (!this.ctx.audioWorklet._wilsonixPcmRegistered) {
        const blob = new Blob([processorCode], { type: "application/javascript" });
        const moduleUrl = URL.createObjectURL(blob);
        await this.ctx.audioWorklet.addModule(moduleUrl);
        URL.revokeObjectURL(moduleUrl);
        this.ctx.audioWorklet._wilsonixPcmRegistered = true;
      }

      this.node = new AudioWorkletNode(this.ctx, "wilsonix-pcm-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
          sharedBuffer: this.sharedBuffer,
        },
      });

      this.writer.setPort(this.node.port);

      this.node.port.onmessage = e => {
        const msg = e.data;
        if (msg && msg.type === "visual" && this.onVisualCallback) {
          try { this.onVisualCallback(msg.note, msg.on, msg.vel); } catch (err) {}
        }
      };

      this.node.connect(this.destination);
      this.isReady = true;

      if (this._sustainSettings) {
        this.setSustainSettings(
          this._sustainSettings.sustainHoldSec,
          this._sustainSettings.sustainDecayTau,
          this._sustainSettings.heldNoteSec
        );
      }

      // Flush any buffers that were loaded before init completed
      for (const buf of this._pendingBuffers) {
        this._sendBuffer(buf);
      }
      this._pendingBuffers = [];

      return true;
    } catch (err) {
      console.warn("[PcmWorkletNode] Failed to initialize:", err);
      this.isReady = false;
      this.lastInitError = err;
      return false;
    }
  }

  _sendBuffer(data) {
    if (!this.isReady || !this.node) {
      this._pendingBuffers.push(data);
      return;
    }
    // Transfer Float32Arrays for zero-copy
    const transferList = [];
    if (data.bufferL) transferList.push(data.bufferL.buffer);
    if (data.bufferR) transferList.push(data.bufferR.buffer);
    this.node.port.postMessage(data, transferList);
  }

  loadBuffer(instId, anchorMidi, audioBuffer) {
    if (!audioBuffer) return;
    let bufferL = null;
    let bufferR = null;
    if (audioBuffer.numberOfChannels >= 2) {
      bufferL = new Float32Array(audioBuffer.getChannelData(0));
      bufferR = new Float32Array(audioBuffer.getChannelData(1));
    } else {
      bufferL = new Float32Array(audioBuffer.getChannelData(0));
    }
    this._sendBuffer({
      type: "loadBuffer",
      instId,
      anchorMidi,
      bufferL,
      bufferR,
    });
  }

  /**
   * Uploads anchorMidi's audio only when the exact layer/sample differs from
   * what the worklet already holds. Keeps velocity-correct layers in sync
   * without redundant transfers: a note resolving to the already-loaded layer
   * costs nothing (pointer compare), a note resolving to a different velocity
   * layer re-uploads just that layer. This is what lets velocity-layered
   * instruments (e.g. the piano) be fully prewarmed without ever playing the
   * wrong layer.
   */
  ensureBuffer(instId, anchorMidi, audioBuffer) {
    if (!audioBuffer) return false;
    const key = `${instId}:${anchorMidi}`;
    if (this._bufferRegistry.get(key) === audioBuffer) return false;
    // Enforce max buffer size with LRU eviction
    this._loadedBuffers.delete(key);
    if (this._loadedBuffers.size >= this._loadedBufferMaxSize) {
      const oldestKey = this._loadedBuffers.keys().next().value;
      if (oldestKey) {
        this._loadedBuffers.delete(oldestKey);
        this._bufferRegistry.delete(oldestKey);
      }
    }
    this._bufferRegistry.set(key, audioBuffer);
    this._loadedBuffers.add(key);
    this.loadBuffer(instId, anchorMidi, audioBuffer);
    return true;
  }

  /**
   * Pushes every decoded anchor of an instrument to the worklet ahead of the
   * first note. The full-PCM Float32 copy happens here, at instrument
   * (de)selection time, instead of synchronously inside the first noteOn
   * (P1.5). Idempotent per (instId, anchorMidi): layered maps carry string
   * keys ("60_1"), so every distinct anchor midi is covered exactly once.
   */
  prewarm(instId, instMap) {
    if (!instMap || instMap.size === 0) return 0;
    let pushed = 0;
    const seen = new Set();
    for (const [key, audioBuf] of instMap.entries()) {
      const midiKey = typeof key === "number" ? key : parseInt(key.split("_")[0], 10);
      if (Number.isNaN(midiKey)) continue;
      if (seen.has(midiKey)) continue;
      seen.add(midiKey);
      if (this.ensureBuffer(instId, midiKey, audioBuf)) pushed++;
    }
    return pushed;
  }

  noteOn(params) {
    if (!this.isReady || !this.node) return false;
    this.node.port.postMessage({
      type: "noteOn",
      ...params,
    });
    return true;
  }

  noteOff(midiNote, layerIndex) {
    if (!this.isReady || !this.node) return false;
    this.node.port.postMessage({
      type: "noteOff",
      midiNote,
      layerIndex,
    });
    return true;
  }

  setSustainPedal(down) {
    if (!this.isReady || !this.node) return;
    this.node.port.postMessage({ type: "sustain", down });
  }

  setSustainSettings(sustainHoldSec, sustainDecayTau, heldNoteSec) {
    this._sustainSettings = { sustainHoldSec, sustainDecayTau, heldNoteSec };
    if (!this.isReady || !this.node) return;
    this.node.port.postMessage({
      type: "sustainSettings",
      sustainHoldSec,
      sustainDecayTau,
      heldNoteSec,
    });
  }

  allNotesOff() {
    if (!this.isReady || !this.node) return;
    this.node.port.postMessage({ type: "allNotesOff" });
  }

  /**
   * Drops every uploaded anchor of an instrument from the audio thread and
   * forgets it locally so the next note re-uploads a fresh copy. This is the
   * only way decoded PCM memory is actually returned to the system on Android
   * (the processor deletes the map entry, freeing its Float32Arrays).
   */
  dropInstrument(instId) {
    if (!instId) return;
    const prefix = `${instId}:`;
    if (this._bufferRegistry) {
      for (const key of [...this._bufferRegistry.keys()]) {
        if (key.startsWith(prefix)) this._bufferRegistry.delete(key);
      }
    }
    if (this._loadedBuffers) {
      for (const key of [...this._loadedBuffers]) {
        if (key.startsWith(prefix)) this._loadedBuffers.delete(key);
      }
    }
    if (this.isReady && this.node) {
      this.node.port.postMessage({ type: "dropInstrument", instId });
    }
  }

  disconnect() {
    if (this.node) {
      try { this.node.disconnect(); } catch (e) {}
    }
  }
}
