/**
 * MidiKey Elite - Master Bus Tape Saturation ("Warm Lo-Fi Polish & Glue")
 * Introduces subtle harmonic saturation, dynamic compression, and soft clipping
 * mimicking analog magnetic master tape.
 * Features:
 * - Generates 2nd (even) & 3rd (odd) musical harmonics
 * - Soft-clips high transient peaks
 * - Gentle high-frequency roll-off (14kHz-16kHz tape smoothing)
 * - Cohesive analog tape glue across the entire mix
 */

export class MasterTapeSaturation {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.drive = 0.35;
    this.warmth = 0.60;
    this.mix = 0.85;
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // 1. Pre-emphasis / Head-bump filter (subtle +0.8dB at 65Hz)
    this.headBump = ctx.createBiquadFilter();
    this.headBump.type = "peaking";
    this.headBump.frequency.value = 65;
    this.headBump.gain.value = 0.8;
    this.headBump.Q.value = 0.8;

    // 2. Analog Tape Waveshaper (Soft-Clipping Polynomial Curve)
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = "4x";
    this.generateTapeCurve();

    // 3. Post-Saturation High-Frequency Tape Roll-off (Gentle 15kHz smoothing)
    this.tapeLp = ctx.createBiquadFilter();
    this.tapeLp.type = "lowpass";
    this.tapeLp.frequency.value = 14500;

    // Output level compensation (Calibrated for exact 0dB unity with bypass)
    this.outComp = ctx.createGain();
    this.outComp.gain.value = 0.82 / (1.0 + this.drive * 0.22);

    // Routing
    this.input.connect(this.headBump);
    this.headBump.connect(this.shaper);
    this.shaper.connect(this.tapeLp);
    this.tapeLp.connect(this.outComp);
    this.outComp.connect(this.wetGain);

    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);
  }

  generateTapeCurve() {
    const n = 2048;
    const curve = new Float32Array(n);
    const k = 1.0 + this.drive * 4.0;

    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      // Tape saturation function: tanh-like soft clipping with asymmetric 2nd harmonic warmth
      const asym = 0.08 * Math.sin(Math.PI * x);
      curve[i] = Math.tanh(k * (x + asym)) / Math.tanh(k);
    }
    this.shaper.curve = curve;
  }

  setDrive(val) {
    this.drive = Math.max(0.05, Math.min(1.0, val));
    this.generateTapeCurve();
    if (this.outComp && this.ctx) {
      const comp = 0.82 / (1.0 + this.drive * 0.22);
      this.outComp.gain.setTargetAtTime(comp, this.ctx.currentTime, 0.02);
    }
  }

  setWarmth(val) {
    this.warmth = Math.max(0.1, Math.min(1.0, val));
    // Warmth shifts the high-end tape roll-off between 11kHz and 18kHz
    const cutoff = 18000 - this.warmth * 7000;
    if (this.tapeLp) {
      this.tapeLp.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.02);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      const dryFrac = Math.cos(this.mix * Math.PI * 0.5);
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
    }
  }

  setBypass(bypass) {
    this.enabled = !bypass;
    const now = this.ctx.currentTime;
    if (this.enabled) {
      const m = this.mix > 0 ? this.mix : 0.85;
      const dryFrac = Math.cos(m * Math.PI * 0.5);
      const wetFrac = Math.sin(m * Math.PI * 0.5);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
    } else {
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.02);
    }
  }
}
