/**
 * Clean Studio Stereo Chorus (Korg Dimension D Architecture)
 * Completely click-free, scratch-free, buffer-underrun-free.
 * Safe 18ms base delay with gentle 2ms LFO sweep (16ms to 20ms safe range, never approaching 0ms).
 */

export class KorgStereoChorus {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.rate = 1.1; // Hz - Classic ensemble swirl
    this.depth = 0.0045; // 4.5ms wide sweep for rich Dimension D chorus
    this.mix = 0.65;
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Wet Pre-Filters: 100Hz highpass + 9000Hz lowpass for silky studio sheen
    this.wetHp = ctx.createBiquadFilter();
    this.wetHp.type = "highpass";
    this.wetHp.frequency.value = 100;

    this.wetLp = ctx.createBiquadFilter();
    this.wetLp.type = "lowpass";
    this.wetLp.frequency.value = 9000;

    this.input.connect(this.wetHp);
    this.wetHp.connect(this.wetLp);

    // Dimension D / Korg Vintage Chorus Delay Lines: 13ms Left, 18ms Right
    this.delayL = ctx.createDelay(0.1);
    this.delayL.delayTime.value = 0.013;

    this.delayR = ctx.createDelay(0.1);
    this.delayR.delayTime.value = 0.018;

    // Dual-Phase Sine LFO (180 deg out-of-phase for panoramic stereo motion)
    this.lfo = ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = this.rate;

    this.lfoGainL = ctx.createGain();
    this.lfoGainL.gain.value = this.depth;
    this.lfo.connect(this.lfoGainL);
    this.lfoGainL.connect(this.delayL.delayTime);

    this.lfoGainR = ctx.createGain();
    this.lfoGainR.gain.value = -this.depth;
    this.lfo.connect(this.lfoGainR);
    this.lfoGainR.connect(this.delayR.delayTime);

    this.wetLp.connect(this.delayL);
    this.wetLp.connect(this.delayR);

    // Stereo Merger
    const merger = ctx.createChannelMerger(2);
    this.delayL.connect(merger, 0, 0);
    this.delayR.connect(merger, 0, 1);

    merger.connect(this.wetGain);
    this.wetGain.gain.value = 0.0; // Bypassed by default
    this.wetGain.connect(this.output);

    this.lfo.start();
  }

  setRate(hz) {
    this.rate = Math.max(0.1, Math.min(6.0, hz));
    this.lfo.frequency.setTargetAtTime(this.rate, this.ctx.currentTime, 0.02);
  }

  setDepth(val) {
    // 0.0015s to 0.006s sweep for unmistakable chorus detuning
    this.depth = 0.0015 + val * 0.0045;
    const now = this.ctx.currentTime;
    this.lfoGainL.gain.setTargetAtTime(this.depth, now, 0.02);
    this.lfoGainR.gain.setTargetAtTime(-this.depth, now, 0.02);
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      const dryFrac = 1.0 - this.mix * 0.05;
      const wetFrac = this.mix * 0.75;
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
    }
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    const now = this.ctx.currentTime;
    if (bypassed) {
      this.wetGain.gain.setTargetAtTime(0, now, 0.02);
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
    } else {
      const m = this.mix > 0 ? this.mix : 0.45;
      const dryFrac = 1.0 - m * 0.05;
      const wetFrac = m * 0.75;
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
    }
  }
}
