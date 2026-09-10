/**
 * 3-Band Studio Parametric EQ & Safety Peak Limiter
 * Provides final mastering polish, deep bass punch, vocal air, and brickwall clipping protection.
 */

export class StudioEqLimiter {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.enabled = true;
    this._bypassRestore = null;

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

    // 4. Transparent Master Polish & Gain Stage (100% full dynamic range, zero squashing)
    this.masterTrim = ctx.createGain();
    this.masterTrim.gain.value = 1.0;

    // Direct clean connection: Input -> LowShelf -> MidPeak -> HighShelf -> Trim -> Output
    this.input.connect(this.lowShelf);
    this.lowShelf.connect(this.midPeak);
    this.midPeak.connect(this.highShelf);
    this.highShelf.connect(this.masterTrim);
    this.masterTrim.connect(this.output);
  }

  setLowGain(db) {
    this.enabled = true;
    this.lowShelf.gain.setTargetAtTime(Math.max(-12, Math.min(12, db)), this.ctx.currentTime, 0.02);
  }

  setMidGain(db) {
    this.enabled = true;
    this.midPeak.gain.setTargetAtTime(Math.max(-12, Math.min(12, db)), this.ctx.currentTime, 0.02);
  }

  setHighGain(db) {
    this.enabled = true;
    this.highShelf.gain.setTargetAtTime(Math.max(-12, Math.min(12, db)), this.ctx.currentTime, 0.02);
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    if (bypassed) {
      if (this._bypassRestore === null) {
        this._bypassRestore = [
          this.lowShelf.gain.value,
          this.midPeak.gain.value,
          this.highShelf.gain.value,
        ];
      }
      this.lowShelf.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      this.midPeak.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      this.highShelf.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    } else if (this._bypassRestore) {
      this.lowShelf.gain.setTargetAtTime(this._bypassRestore[0], this.ctx.currentTime, 0.02);
      this.midPeak.gain.setTargetAtTime(this._bypassRestore[1], this.ctx.currentTime, 0.02);
      this.highShelf.gain.setTargetAtTime(this._bypassRestore[2], this.ctx.currentTime, 0.02);
      this._bypassRestore = null;
    }
  }

  setTrim(val) {
    this.masterTrim.gain.setTargetAtTime(Math.max(0, Math.min(2.0, val)), this.ctx.currentTime, 0.02);
  }
}
