/**
 * MidiKey Elite - Non-Linear Gated Reverb ("Rhythm Section Cannon")
 * 100% Native Web Audio Node Network (Zero JS loops, Zero Convolver blocking).
 * Dense multi-tap reflection with sharp gate truncation for explosive 80s snares.
 */

export class GatedReverb {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.gateHoldMs = 180;
    this.mix = 0.45;
    this.enabled = false;

    this.tapGains = [];
    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // HP & LP sculpting for 80s digital plate
    this.hpFilter = ctx.createBiquadFilter();
    this.hpFilter.type = "highpass";
    this.hpFilter.frequency.value = 180;

    this.lpFilter = ctx.createBiquadFilter();
    this.lpFilter.type = "lowpass";
    this.lpFilter.frequency.value = 7500;

    this.input.connect(this.hpFilter);
    this.hpFilter.connect(this.lpFilter);

    // Staggered Plate Reflections (Dense clustered reflections before cutoff)
    const tapDelays = [0.015, 0.032, 0.054, 0.078, 0.105, 0.135, 0.165];
    const tapWeights = [0.40, 0.45, 0.48, 0.50, 0.45, 0.40, 0.35];

    const sumL = ctx.createGain();
    const sumR = ctx.createGain();
    sumL.gain.value = 0.5;
    sumR.gain.value = 0.5;

    this.tapGains = [];

    for (let i = 0; i < tapDelays.length; i++) {
      const dL = ctx.createDelay(0.35);
      dL.delayTime.value = tapDelays[i];
      const gL = ctx.createGain();
      gL.gain.value = tapWeights[i];

      this.lpFilter.connect(dL);
      dL.connect(gL);
      gL.connect(sumL);
      this.tapGains.push({ delay: dL, gain: gL, baseDelay: tapDelays[i], baseWeight: tapWeights[i], ch: "L" });

      const dR = ctx.createDelay(0.35);
      dR.delayTime.value = tapDelays[i] * 1.08;
      const gR = ctx.createGain();
      gR.gain.value = tapWeights[i];

      this.lpFilter.connect(dR);
      dR.connect(gR);
      gR.connect(sumR);
      this.tapGains.push({ delay: dR, gain: gR, baseDelay: tapDelays[i] * 1.08, baseWeight: tapWeights[i], ch: "R" });
    }

    // Allpass Diffusers
    const ap1 = ctx.createBiquadFilter();
    ap1.type = "allpass";
    ap1.frequency.value = 1800;

    const ap2 = ctx.createBiquadFilter();
    ap2.type = "allpass";
    ap2.frequency.value = 2400;

    sumL.connect(ap1);
    sumR.connect(ap2);

    // Stereo Merger
    const merger = ctx.createChannelMerger(2);
    ap1.connect(merger, 0, 0);
    ap2.connect(merger, 0, 1);

    merger.connect(this.wetGain);
    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);
  }

  setGateTime(ms) {
    this.gateHoldMs = Math.max(80, Math.min(300, ms));
    const gateSec = this.gateHoldMs / 1000;
    const now = this.ctx ? this.ctx.currentTime : 0;

    // Enable only taps that fall within the gate window; mute taps outside the window
    this.tapGains.forEach(tap => {
      if (tap.baseDelay <= gateSec) {
        tap.gain.gain.setTargetAtTime(tap.baseWeight, now, 0.01);
      } else {
        tap.gain.gain.setTargetAtTime(0.0, now, 0.01);
      }
    });
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1, val));
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (this.enabled) {
      this.wetGain.gain.setTargetAtTime(this.mix * 1.2, now, 0.02);
    }
  }

  setBypass(bypass) {
    this.enabled = !bypass;
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (this.enabled) {
      this.wetGain.gain.setTargetAtTime(this.mix * 1.2, now, 0.02);
    } else {
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.02);
    }
  }
}
