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

      const blob = new Blob([processorCode], { type: "application/javascript" });
      const moduleUrl = URL.createObjectURL(blob);
      await this.ctx.audioWorklet.addModule(moduleUrl);
      URL.revokeObjectURL(moduleUrl);

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

      // Flush any buffers that were loaded before init completed
      for (const buf of this._pendingBuffers) {
        this._sendBuffer(buf);
      }
      this._pendingBuffers = [];

      return true;
    } catch (err) {
      console.warn("[PcmWorkletNode] Failed to initialize:", err);
      this.isReady = false;
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

  allNotesOff() {
    if (!this.isReady || !this.node) return;
    this.node.port.postMessage({ type: "allNotesOff" });
  }

  disconnect() {
    if (this.node) {
      try { this.node.disconnect(); } catch (e) {}
    }
  }
}
