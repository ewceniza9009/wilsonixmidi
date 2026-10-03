/**
 * Shimmer Worklet Node Bridge
 * Main-thread interface for the AudioWorklet Shimmer processor
 */

import processorCode from "./shimmer-fx-processor.js?raw";

export class ShimmerWorkletNode {
  constructor(ctx, destination = null) {
    this.ctx = ctx;
    this.destination = destination || ctx.destination;
    this.node = null;
    this.isReady = false;
  }

  async init() {
    if (this.isReady) return true;
    if (!this.ctx || !this.ctx.audioWorklet) {
      console.warn("[ShimmerWorkletNode] AudioWorklet not supported");
      return false;
    }

    try {
      const blob = new Blob([processorCode], { type: "application/javascript" });
      const moduleUrl = URL.createObjectURL(blob);
      await this.ctx.audioWorklet.addModule(moduleUrl);
      URL.revokeObjectURL(moduleUrl);

      this.node = new AudioWorkletNode(this.ctx, "shimmer-fx-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });

      this.node.connect(this.destination);
      this.isReady = true;
      return true;
    } catch (err) {
      console.warn("[ShimmerWorkletNode] Failed to initialize:", err);
      this.isReady = false;
      return false;
    }
  }

  // Not strictly needed since ShimmerFxProcessor uses fixed params for now, 
  // but good for future control of mix/feedback via MessagePort
  setMix(value) {
    if (this.isReady && this.node) {
      this.node.port.postMessage({ type: "setMix", value });
    }
  }

  getInput() {
    return this.node;
  }

  disconnect() {
    if (this.node) {
      this.node.disconnect();
      this.node = null;
      this.isReady = false;
    }
  }
}
