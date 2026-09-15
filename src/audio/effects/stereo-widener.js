/**
 * Haas & Mid-Side Stereo Spatial Widener
 * Expands acoustic stereo imaging using psychoacoustic Haas micro-delays
 * and Mid/Side energy widening without causing comb-filtering phase cancellation.
 */

import { constantPowerMix, applyBypassGains, applyMixGains } from "./dry-wet-utils.js";

export class HaasStereoWidener {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.width = 1.4; // 0.0 (mono) to 2.5 (super wide)
    this.haasDelayMs = 18; // 1ms to 35ms
    this.mix = 0.70; // 0 to 1
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Channel Splitter: L (0) and R (1)
    this.splitter = ctx.createChannelSplitter(2);
    this.merger = ctx.createChannelMerger(2);

    // Mid-Side extraction gains
    // Mid = (L + R) * 0.5
    this.midSum = ctx.createGain();
    this.midSum.gain.value = 0.5;

    // Side = (L - R) * 0.5
    this.sideL = ctx.createGain();
    this.sideL.gain.value = 0.5;
    this.sideR = ctx.createGain();
    this.sideR.gain.value = -0.5;

    this.sideSum = ctx.createGain();
    this.sideSum.gain.value = 1.0;

    // Width control gain for Side channel
    this.widthGain = ctx.createGain();
    this.widthGain.gain.value = this.width;

    // Haas micro-delay for psychoacoustic spatialization
    this.haasDelayNode = ctx.createDelay(0.05);
    this.haasDelayNode.delayTime.value = this.haasDelayMs / 1000;

    // Haas subtle high-damp to keep high transients crisp
    this.haasFilter = ctx.createBiquadFilter();
    this.haasFilter.type = "lowpass";
    this.haasFilter.frequency.value = 9000;

    this.haasGain = ctx.createGain();
    this.haasGain.gain.value = 0.35;

    // Reconstruction Matrix:
    // Left Output = Mid + Side + Haas
    this.outL = ctx.createGain();
    this.outL.gain.value = 1.0;

    // Right Output = Mid - Side - Haas
    this.outR = ctx.createGain();
    this.outR.gain.value = 1.0;

    const negSide = ctx.createGain();
    negSide.gain.value = -1.0;

    const negHaas = ctx.createGain();
    negHaas.gain.value = -1.0;

    // Connect topology
    this.input.connect(this.splitter);

    // L & R -> Mid
    this.splitter.connect(this.midSum, 0);
    this.splitter.connect(this.midSum, 1);

    // L & R -> Side
    this.splitter.connect(this.sideL, 0);
    this.splitter.connect(this.sideR, 1);
    this.sideL.connect(this.sideSum);
    this.sideR.connect(this.sideSum);

    // Scale Side with Width
    this.sideSum.connect(this.widthGain);

    // Side -> Haas Delay
    this.sideSum.connect(this.haasDelayNode);
    this.haasDelayNode.connect(this.haasFilter);
    this.haasFilter.connect(this.haasGain);

    // Recombine Left
    this.midSum.connect(this.outL);
    this.widthGain.connect(this.outL);
    this.haasGain.connect(this.outL);
    this.outL.connect(this.merger, 0, 0);

    // Recombine Right
    this.midSum.connect(this.outR);
    this.widthGain.connect(negSide);
    negSide.connect(this.outR);
    this.haasGain.connect(negHaas);
    negHaas.connect(this.outR);
    this.outR.connect(this.merger, 0, 1);

    // Wet output
    this.merger.connect(this.wetGain);
    this.wetGain.connect(this.output);
    this.wetGain.gain.value = 0.0;
  }

  setWidth(val) {
    this.width = Math.max(0.0, Math.min(2.5, val));
    if (this.widthGain) {
      this.widthGain.gain.setTargetAtTime(this.width, this.ctx.currentTime, 0.02);
    }
  }

  setHaasDelay(ms) {
    this.haasDelayMs = Math.max(1, Math.min(35, ms));
    if (this.haasDelayNode) {
      this.haasDelayNode.delayTime.setTargetAtTime(this.haasDelayMs / 1000, this.ctx.currentTime, 0.02);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    if (this.enabled) {
      applyMixGains(this.wetGain, this.dryGain, this.mix, constantPowerMix, this.ctx);
    }
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    applyBypassGains(this.wetGain, this.dryGain, bypassed, this.mix, constantPowerMix, this.ctx);
  }
}
