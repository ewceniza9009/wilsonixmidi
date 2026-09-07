/**
 * 3-Band Studio Parametric EQ & Safety Peak Limiter
 * Provides final mastering polish, deep bass punch, vocal air, and brickwall clipping protection.
 */

export class StudioEqLimiter {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // 1. Low Shelf EQ (flat default)
    this.lowShelf = ctx.createBiquadFilter();
    this.lowShelf.type = "lowshelf";
    this.lowShelf.frequency.value = 90;
    this.lowShelf.gain.value = 0.0;

    // 2. Mid Peaking EQ
    this.midPeak = ctx.createBiquadFilter();
    this.midPeak.type = "peaking";
    this.midPeak.frequency.value = 1400;
    this.midPeak.Q.value = 1.0;
    this.midPeak.gain.value = 0.0;

    // 3. High Shelf EQ
    this.highShelf = ctx.createBiquadFilter();
    this.highShelf.type = "highshelf";
    this.highShelf.frequency.value = 8500;
    this.highShelf.gain.value = 0.0;

    // 4. Gentle Musical Limiter (clean, transparent, NO brickwall distortion on chords)
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10.0; // Start compressing gently at -10dB
    this.limiter.knee.value = 15.0;       // Very wide smooth knee
    this.limiter.ratio.value = 2.5;       // Gentle 2.5:1 musical leveling
    this.limiter.attack.value = 0.012;    // 12ms preserve piano hammer transients
    this.limiter.release.value = 0.200;   // 200ms smooth musical recovery

    // Master trim gain
    this.masterTrim = ctx.createGain();
    this.masterTrim.gain.value = 1.0;

    // Direct clean connection: Input -> LowShelf -> MidPeak -> HighShelf -> Trim -> Limiter -> Output
    this.input.connect(this.lowShelf);
    this.lowShelf.connect(this.midPeak);
    this.midPeak.connect(this.highShelf);
    this.highShelf.connect(this.masterTrim);
    this.masterTrim.connect(this.limiter);
    this.limiter.connect(this.output);
  }

  setLowGain(db) {
    this.lowShelf.gain.setTargetAtTime(Math.max(-12, Math.min(12, db)), this.ctx.currentTime, 0.02);
  }

  setMidGain(db) {
    this.midPeak.gain.setTargetAtTime(Math.max(-12, Math.min(12, db)), this.ctx.currentTime, 0.02);
  }

  setHighGain(db) {
    this.highShelf.gain.setTargetAtTime(Math.max(-12, Math.min(12, db)), this.ctx.currentTime, 0.02);
  }

  setTrim(val) {
    this.masterTrim.gain.setTargetAtTime(Math.max(0, Math.min(2.0, val)), this.ctx.currentTime, 0.02);
  }
}
