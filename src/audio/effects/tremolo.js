/**
 * Vintage Optical Tremolo Pulse
 * Smooth sine-driven amplitude pulsation for soul, gospel, and surf textures.
 * Constant-power dry/wet architecture with click-free bypass.
 */

export class TremoloPulse {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.rate = 4.5; // Hz
    this.depth = 0.55; // 0 to 1
    this.mix = 0.60;
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Tremolo carrier (unity base, LFO subtracts for pulse)
    this.pulseGain = ctx.createGain();
    this.pulseGain.gain.value = 1.0 - this.depth * 0.25;

    this.lfo = ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = this.rate;

    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = this.depth * 0.5;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.pulseGain.gain);

    this.input.connect(this.pulseGain);
    this.pulseGain.connect(this.wetGain);

    this.wetGain.gain.value = 0.0; // Bypassed by default
    this.wetGain.connect(this.output);

    this.lfo.start();
  }

  setRate(hz) {
    this.rate = Math.max(0.2, Math.min(12.0, hz));
    if (this.lfo) {
      this.lfo.frequency.setTargetAtTime(this.rate, this.ctx.currentTime, 0.02);
    }
  }

  setDepth(val) {
    this.depth = Math.max(0, Math.min(1.0, val));
    const now = this.ctx.currentTime;
    if (this.lfoGain) {
      this.lfoGain.gain.setTargetAtTime(this.depth * 0.5, now, 0.02);
    }
    if (this.pulseGain) {
      this.pulseGain.gain.setTargetAtTime(1.0 - this.depth * 0.25, now, 0.02);
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
}
