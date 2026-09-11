/**
 * WILSONIX MIDIKEY Elite - SynthWorkletNode
 * Main-thread bridge for the AudioWorklet synthesis engine.
 * Connects the lock-free MidiRingBufferWriter to the AudioWorkletProcessor.
 */

import { MidiRingBufferWriter } from "./ring-buffer.js";

// Worklet code can be bundled or loaded via blob URL to ensure 100% offline & dev-server portability
import processorCode from "./synth-processor.js?raw";

export class SynthWorkletNode {
  constructor(ctx, destination = null) {
    this.ctx = ctx;
    this.destination = destination || ctx.destination;
    this.node = null;
    this.writer = null;
    this.isReady = false;
    this.sharedBuffer = null;
  }

  async init() {
    if (this.isReady) return true;
    if (!this.ctx || !this.ctx.audioWorklet) {
      console.warn("[SynthWorkletNode] AudioWorklet not supported in this environment");
      return false;
    }

    try {
      // 1. Create SharedArrayBuffer if supported
      this.sharedBuffer = MidiRingBufferWriter.createSharedBuffer();
      this.writer = new MidiRingBufferWriter(this.sharedBuffer);

      // 2. Load the processor module using Blob URL for bulletproof bundler & dev-server portability
      const blob = new Blob([processorCode], { type: "application/javascript" });
      const moduleUrl = URL.createObjectURL(blob);

      await this.ctx.audioWorklet.addModule(moduleUrl);
      URL.revokeObjectURL(moduleUrl);

      // 3. Instantiate AudioWorkletNode
      this.node = new AudioWorkletNode(this.ctx, "wilsonix-synth-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
          sharedBuffer: this.sharedBuffer,
        },
      });

      this.writer.setPort(this.node.port);
      this.node.connect(this.destination);
      this.isReady = true;
      return true;
    } catch (err) {
      console.warn("[SynthWorkletNode] Failed to initialize AudioWorklet processor:", err);
      this.isReady = false;
      return false;
    }
  }

  noteOn(midiNote, velocity = 100) {
    if (!this.isReady || !this.writer) return false;
    return this.writer.writeMidi(0x90, midiNote, velocity, this.ctx.currentTime);
  }

  noteOff(midiNote) {
    if (!this.isReady || !this.writer) return false;
    return this.writer.writeMidi(0x80, midiNote, 0, this.ctx.currentTime);
  }

  allNotesOff() {
    if (!this.isReady) return;
    if (this.writer) {
      this.writer.writeMidi(0xb0, 123, 0, this.ctx.currentTime);
    }
    if (this.node) {
      this.node.port.postMessage({ type: "allNotesOff" });
    }
  }

  setParam(name, value) {
    if (!this.isReady || !this.node) return;
    this.node.port.postMessage({ type: "param", name, value });
  }

  disconnect() {
    if (this.node) {
      try {
        this.node.disconnect();
      } catch (e) {}
    }
  }
}
