/**
 * Studio Dynamics Compressor & Peak Leveler
 * Professional broadcast & mastering compressor with auto makeup gain,
 * variable knee, fast attack/release ballistics, and parallel compression mix.
 */

export class StudioCompressor {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.threshold = -24; // dB (-60 to 0)
    this.knee = 12; // dB (0 to 40)
    this.ratio = 4; // 1 to 20
    this.attack = 0.015; // s (0.001 to 0.5)
    this.release = 0.20; // s (0.02 to 1.0)
    this.makeup = 3.0; // dB (0 to 18)
    this.mix = 0.85; // 0 to 1 (parallel compression)
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Dynamics Compressor Node
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = this.threshold;
    this.comp.knee.value = this.knee;
    this.comp.ratio.value = this.ratio;
    this.comp.attack.value = this.attack;
    this.comp.release.value = this.release;

    // Makeup Gain Booster
    this.makeupGain = ctx.createGain();
    const linearMakeup = Math.pow(10, this.makeup / 20);
    this.makeupGain.gain.value = linearMakeup;

    // Wet Routing
    this.input.connect(this.comp);
    this.comp.connect(this.makeupGain);
    this.makeupGain.connect(this.wetGain);
    this.wetGain.connect(this.output);
    this.wetGain.gain.value = 0.0; // Bypassed initially
  }

  setThreshold(db) {
    this.threshold = Math.max(-60, Math.min(0, db));
    if (this.comp) {
      this.comp.threshold.setTargetAtTime(this.threshold, this.ctx.currentTime, 0.02);
    }
  }

  setRatio(val) {
    this.ratio = Math.max(1, Math.min(20, val));
    if (this.comp) {
      this.comp.ratio.setTargetAtTime(this.ratio, this.ctx.currentTime, 0.02);
    }
  }

  setKnee(val) {
    this.knee = Math.max(0, Math.min(40, val));
    if (this.comp) {
      this.comp.knee.setTargetAtTime(this.knee, this.ctx.currentTime, 0.02);
    }
  }

  setAttack(valSeconds) {
    this.attack = Math.max(0.001, Math.min(0.5, valSeconds));
    if (this.comp) {
      this.comp.attack.setTargetAtTime(this.attack, this.ctx.currentTime, 0.02);
    }
  }

  setRelease(valSeconds) {
    this.release = Math.max(0.02, Math.min(1.0, valSeconds));
    if (this.comp) {
      this.comp.release.setTargetAtTime(this.release, this.ctx.currentTime, 0.02);
    }
  }

  setMakeup(db) {
    this.makeup = Math.max(0, Math.min(18, db));
    if (this.makeupGain) {
      const linear = Math.pow(10, this.makeup / 20);
      this.makeupGain.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.02);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5);
      const dryFrac = Math.cos(this.mix * Math.PI * 0.5);
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
    }
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (bypassed) {
      this.wetGain.gain.setValueAtTime(0.0, now);
      this.dryGain.gain.setValueAtTime(1.0, now);
    } else {
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5);
      const dryFrac = Math.cos(this.mix * Math.PI * 0.5);
      this.wetGain.gain.setValueAtTime(wetFrac, now);
      this.dryGain.gain.setValueAtTime(dryFrac, now);
    }
  }

  getReduction() {
    return this.comp ? this.comp.reduction : 0;
  }
}
