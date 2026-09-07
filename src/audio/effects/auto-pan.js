/**
 * Authentic 1973 Rhodes Suitcase Stereo Auto-Pan & Optical Tremolo
 * Ping-ponging complementary L/R stereo field modulation for iconic R&B, Neo-Soul, and Funk.
 * Uses native constant-power StereoPannerNode with smooth sine LFO oscillation.
 */

export class AutoPan {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.rate = 1.0; // Hz - Gentle subtle sway
    this.depth = 0.35; // Gentle stereo movement (never extreme hard left/right)
    this.mix = 0.50;
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Stereo Panner (Constant-Power Stereo Field Modulation)
    if (ctx.createStereoPanner) {
      this.panner = ctx.createStereoPanner();
      this.panner.pan.value = 0.0;

      this.lfo = ctx.createOscillator();
      this.lfo.type = "sine";
      this.lfo.frequency.value = this.rate;

      this.lfoGain = ctx.createGain();
      this.lfoGain.gain.value = this.depth;

      this.lfo.connect(this.lfoGain);
      this.lfoGain.connect(this.panner.pan);

      this.input.connect(this.panner);
      this.panner.connect(this.wetGain);

      this.lfo.start();
    } else {
      // Fallback dual gain panner
      this.panL = ctx.createGain();
      this.panR = ctx.createGain();
      this.panL.gain.value = 0.5;
      this.panR.gain.value = 0.5;

      this.lfo = ctx.createOscillator();
      this.lfo.type = "sine";
      this.lfo.frequency.value = this.rate;

      this.lfoGain = ctx.createGain();
      this.lfoGain.gain.value = this.depth * 0.5;
      this.lfo.connect(this.lfoGain);
      this.lfoGain.connect(this.panL.gain);

      this.input.connect(this.panL);
      this.input.connect(this.panR);

      this.panL.connect(this.wetGain);
      this.panR.connect(this.wetGain);
      this.lfo.start();
    }

    this.wetGain.gain.value = 0.0; // Bypassed by default
    this.wetGain.connect(this.output);
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
      this.lfoGain.gain.setTargetAtTime(this.depth, now, 0.02);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    if (this.enabled) {
      const now = this.ctx.currentTime;
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5);
      const dryFrac = Math.cos(this.mix * Math.PI * 0.5);
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
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5);
      const dryFrac = Math.cos(this.mix * Math.PI * 0.5);
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
    }
  }
}
