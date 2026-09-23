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
    this._loadedBufferMaxSize = 256; // max anchors held in worklet (expanded to prevent multi-layer combi thrashing)
    this._bufferRegistry = new Map();
    this._sustainSettings = null;
    this.polyphonyCap = 64;
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

      if (Number.isFinite(this.polyphonyCap)) {
        this.setPolyphonyCap(this.polyphonyCap);
      }

      // Flush any buffers that were loaded before init completed
      for (const buf of this._pendingBuffers) {
        this._sendBuffer(buf);
      }
      this._pendingBuffers = [];

      if (typeof this.onReadyCallback === "function") {
        try { this.onReadyCallback(); } catch (err) {}
      }

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
   * first note. Anchors are prioritized by distance from C4 (midi 60) — the
   * keys most likely to be played first stay resident even when an instrument
   * has more anchors than the worklet LRU can hold, preventing self-eviction
   * thrash on velocity-layered instruments (e.g. the piano) where the last
   * pushes used to evict the closest anchors, forcing synchronous re-uploads
   * inside mid-play noteOns. Idempotent per (instId, anchorMidi): layered maps
   * carry string keys ("60_1"), so every distinct anchor midi is covered once.
   */
  prewarm(instId, instMap) {
    if (!instMap || instMap.size === 0) return 0;
    const anchors = this._collectAnchors(instMap);
    if (anchors.length === 0) return 0;
    const limit = Math.min(anchors.length, this._loadedBufferMaxSize);
    let pushed = 0;
    for (let i = 0; i < limit; i++) {
      if (this.ensureBuffer(instId, anchors[i].midiKey, anchors[i].audioBuf)) {
        pushed++;
      }
    }
    return pushed;
  }

  _collectAnchors(instMap) {
    const anchors = [];
    const seen = new Set();
    for (const [key, audioBuf] of instMap.entries()) {
      const midiKey = typeof key === "number" ? key : parseInt(key.split("_")[0], 10);
      if (Number.isNaN(midiKey)) continue;
      if (seen.has(midiKey)) continue;
      seen.add(midiKey);
      anchors.push({ midiKey, audioBuf });
    }
    anchors.sort((a, b) => Math.abs(a.midiKey - 60) - Math.abs(b.midiKey - 60));
    return anchors;
  }

  /**
   * Chunked, idle-scheduled prewarm: performs the full-PCM Float32 channel
   * copies in small batches across idle callbacks instead of one synchronous
   * burst inside the caller (often the preset click handler). The C4-closest
   * anchors upload first, so the first note almost always hits an
   * already-uploaded layer; any straggler falls back to the synchronous
   * ensureBuffer inside noteOn. Returns a cancel function.
   */
  prewarmChunked(instId, instMap, chunkSize = 6) {
    if (!instMap || instMap.size === 0) return () => {};
    const anchors = this._collectAnchors(instMap);
    if (anchors.length === 0) return () => {};
    const limit = Math.min(anchors.length, this._loadedBufferMaxSize);
    let i = 0;
    let cancelled = false;
    let timerId = null;
    let idleId = null;

    const scheduleNext = () => {
      if (i < limit && !cancelled) {
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
          idleId = window.requestIdleCallback(step, { timeout: 300 });
        } else {
          timerId = setTimeout(() => step(null), 0);
        }
      }
    };

    const step = (deadline) => {
      if (cancelled) return;
      while (i < limit) {
        const end = Math.min(i + chunkSize, limit);
        for (; i < end; i++) {
          this.ensureBuffer(instId, anchors[i].midiKey, anchors[i].audioBuf);
        }
        // Cooperative frame budget: if more than 1.5ms remain in this idle frame,
        // continue processing the next chunk without yielding; otherwise yield
        // so the browser can paint without frame hitching.
        if (deadline && typeof deadline.timeRemaining === "function") {
          if (deadline.timeRemaining() < 1.5) break;
        } else {
          break; // timer fallback: yield after one chunk
        }
      }
      scheduleNext();
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window !== "undefined" && window.cancelIdleCallback) {
        try { window.cancelIdleCallback(idleId); } catch (e) {}
      }
      if (timerId !== null) clearTimeout(timerId);
    };
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

  fastNoteOff(midiNote, layerIndex) {
    if (!this.isReady || !this.node) return false;
    this.node.port.postMessage({
      type: "fastNoteOff",
      midiNote,
      layerIndex,
    });
    return true;
  }

  setPolyphonyCap(cap) {
    if (Number.isFinite(cap)) {
      this.polyphonyCap = Math.max(16, Math.min(128, cap | 0));
    }
    if (!this.isReady || !this.node) return;
    this.node.port.postMessage({
      type: "polyphonyCap",
      cap: this.polyphonyCap,
    });
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
