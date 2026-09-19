/**
 * FX Worklet Node Bridge
 * Main-thread interface for the AudioWorklet FX processor
 */

import processorCode from "./fx-processor.js?raw";

export class FXWorkletNode {
  constructor(ctx, destination = null) {
    this.ctx = ctx;
    this.destination = destination || ctx.destination;
    this.node = null;
    this.isReady = false;
    this.currentPreset = "clean";
  }

  async init() {
    if (this.isReady) return true;
    if (!this.ctx || !this.ctx.audioWorklet) {
      console.warn("[FXWorkletNode] AudioWorklet not supported");
      return false;
    }

    try {
      const blob = new Blob([processorCode], { type: "application/javascript" });
      const moduleUrl = URL.createObjectURL(blob);
      await this.ctx.audioWorklet.addModule(moduleUrl);
      URL.revokeObjectURL(moduleUrl);

      this.node = new AudioWorkletNode(this.ctx, "wilsonix-fx-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });

      this.node.connect(this.destination);
      this.isReady = true;
      return true;
    } catch (err) {
      console.warn("[FXWorkletNode] Failed to initialize:", err);
      this.isReady = false;
      return false;
    }
  }

  setBypass(bypassed) {
    if (!this.isReady || !this.node) return;
    this.node.port.postMessage({ type: "setBypass", bypassed });
  }

  loadPreset(presetName) {
    if (!this.isReady || !this.node) return;
    this.currentPreset = presetName;
    this.node.port.postMessage({ type: "setPreset", preset: presetName });
  }

  setParam(effectIndex, param, value) {
    if (!this.isReady || !this.node) return;
    this.node.port.postMessage({ type: "setParam", effectIndex, param, value });
  }

  setDryWet(dry, wet) {
    if (!this.isReady || !this.node) return;
    this.node.port.postMessage({ type: "setDryWet", dry, wet });
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