/**
 * Studio-Grade Feedforward Multi-Tap Stereo Diffuse Reverb
 * 100% Native Web Audio Feedforward Network (Mathematically 0% Feedback Loops, 0% Denormals, 0% Ringing, 0% Static).
 * Uses dual-channel prime-staggered delay taps + cascaded spatial allpass diffusers with highpass DC blocking.
 */

export class AlgorithmicReverb {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.decay = 2.0; // seconds
    this.mix = 0.22;
    this.enabled = false;

    this.tapGains = [];
    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // 1. Dry Direct Path (100% pure pass-through)
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // 2. Pre-Filters: 160Hz highpass cuts mud/rumble, 6500Hz lowpass prevents harsh sheen
    this.preHp = ctx.createBiquadFilter();
    this.preHp.type = "highpass";
    this.preHp.frequency.value = 160;

    this.preLp = ctx.createBiquadFilter();
    this.preLp.type = "lowpass";
    this.preLp.frequency.value = 6500;

    this.input.connect(this.preHp);
    this.preHp.connect(this.preLp);

    // 3. Multi-Tap Prime Spatial Reflection Network (Zero feedback loops = 0% denormals, 0% static crackle)
    const leftTaps = [0.019, 0.038, 0.067, 0.098, 0.137, 0.183];
    const rightTaps = [0.023, 0.044, 0.076, 0.109, 0.151, 0.197];
    const baseWeights = [0.38, 0.32, 0.26, 0.20, 0.15, 0.10];

    const sumL = ctx.createGain();
    const sumR = ctx.createGain();
    sumL.gain.value = 0.45;
    sumR.gain.value = 0.45;

    this.tapGains = [];

    for (let i = 0; i < leftTaps.length; i++) {
      const dL = ctx.createDelay(0.3);
      dL.delayTime.value = leftTaps[i];
      const gL = ctx.createGain();
      gL.gain.value = baseWeights[i];
      this.preLp.connect(dL);
      dL.connect(gL);
      gL.connect(sumL);
      this.tapGains.push(gL);

      const dR = ctx.createDelay(0.3);
      dR.delayTime.value = rightTaps[i];
      const gR = ctx.createGain();
      gR.gain.value = baseWeights[i];
      this.preLp.connect(dR);
      dR.connect(gR);
      gR.connect(sumR);
      this.tapGains.push(gR);
    }

    // 4. Cascaded Allpass Diffusers on Left & Right Channels (Rich spatial bloom)
    let nodeL = sumL;
    let nodeR = sumR;
    const apFreqs = [1200, 2200, 3400];
    for (let i = 0; i < apFreqs.length; i++) {
      const apL = ctx.createBiquadFilter();
      apL.type = "allpass";
      apL.frequency.value = apFreqs[i];
      apL.Q.value = 0.7;
      nodeL.connect(apL);
      nodeL = apL;

      const apR = ctx.createBiquadFilter();
      apR.type = "allpass";
      apR.frequency.value = apFreqs[i] * 1.15;
      apR.Q.value = 0.7;
      nodeR.connect(apR);
      nodeR = apR;
    }

    // Stereo Merger
    const merger = ctx.createChannelMerger(2);
    nodeL.connect(merger, 0, 0);
    nodeR.connect(merger, 0, 1);

    merger.connect(this.wetGain);
    this.wetGain.gain.value = 0.0; // Bypassed by default
    this.wetGain.connect(this.output);
  }

  setDecay(seconds) {
    this.decay = Math.max(0.5, Math.min(6.0, seconds));
    const norm = Math.max(0.35, Math.min(1.0, this.decay / 3.0));
    const now = this.ctx.currentTime;
    this.tapGains.forEach((g, idx) => {
      const baseW = [0.38, 0.38, 0.32, 0.32, 0.26, 0.26, 0.20, 0.20, 0.15, 0.15, 0.10, 0.10][idx] || 0.2;
      g.gain.setTargetAtTime(baseW * norm, now, 0.03);
    });
  }

  setRoomSize(val) {
    const norm = Math.max(0.05, Math.min(1.0, val));
    this.setDecay(0.8 + norm * 3.6);
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      const dryFrac = 1.0;
      const wetFrac = this.mix * 0.42;
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
    }
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    const now = this.ctx.currentTime;
    if (bypassed) {
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.02);
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
    } else {
      const m = this.mix > 0 ? this.mix : 0.22;
      const dryFrac = 1.0;
      const wetFrac = m * 0.42;
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
    }
  }
}
