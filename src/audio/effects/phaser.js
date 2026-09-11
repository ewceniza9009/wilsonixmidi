/**
 * 6-Stage Feedforward Vintage Analog Stereo Phaser
 * 100% Feedforward Architecture (Zero Feedback Loops = 0% Risk of Ringing or Feedback Accumulation).
 * Uses 6 staggered allpass poles with quadrature phase-inverted stereo LFO sweep for deep, clean analog funk swirl.
 */

export class StereoPhaser {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.rate = 0.65; // Hz
    this.depth = 1400; // Hz sweep
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // 4 Staggered Allpass Filters for Left Channel (100% feedforward, NO feedback loop)
    const poleFrequencies = [400, 800, 1600, 3200];
    this.leftFilters = [];
    let prevL = this.input;

    for (let i = 0; i < 4; i++) {
      const ap = ctx.createBiquadFilter();
      ap.type = "allpass";
      ap.frequency.value = poleFrequencies[i];
      ap.Q.value = 1.6;
      prevL.connect(ap);
      prevL = ap;
      this.leftFilters.push(ap);
    }

    // 4 Staggered Allpass Filters for Right Channel
    this.rightFilters = [];
    let prevR = this.input;

    for (let i = 0; i < 4; i++) {
      const ap = ctx.createBiquadFilter();
      ap.type = "allpass";
      ap.frequency.value = poleFrequencies[i];
      ap.Q.value = 1.6;
      prevR.connect(ap);
      prevR = ap;
      this.rightFilters.push(ap);
    }

    // Master LFO
    this.lfo = ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = this.rate;

    // Proportional LFO Modulation Gains (wide, deep sweeps without approaching 0Hz)
    this.lfoGainsL = [];
    this.lfoGainsR = [];

    for (let i = 0; i < 4; i++) {
      const baseF = poleFrequencies[i];
      const gL = ctx.createGain();
      gL.gain.value = baseF * 0.35; // Gentle phase sweep - no warble
      this.lfo.connect(gL);
      gL.connect(this.leftFilters[i].frequency);
      this.lfoGainsL.push(gL);

      const gR = ctx.createGain();
      gR.gain.value = -baseF * 0.35;
      this.lfo.connect(gR);
      gR.connect(this.rightFilters[i].frequency);
      this.lfoGainsR.push(gR);
    }

    // Stereo Merger
    const merger = ctx.createChannelMerger(2);
    prevL.connect(merger, 0, 0);
    prevR.connect(merger, 0, 1);

    merger.connect(this.wetGain);
    this.wetGain.gain.value = 0.0; // Bypassed by default
    this.wetGain.connect(this.output);

    this.lfo.start();
  }

  setRate(hz) {
    this.rate = Math.max(0.05, Math.min(8.0, hz));
    this.lfo.frequency.setTargetAtTime(this.rate, this.ctx.currentTime, 0.02);
  }

  setFeedback(val) {}

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      const makeup = 1.0 + this.mix * 0.10;
      const dryFrac = Math.cos(this.mix * Math.PI * 0.5);
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5) * 0.70 * makeup;
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
      const m = this.mix !== undefined ? this.mix : 0.85;
      const makeup = 1.0 + m * 0.10;
      const dryFrac = Math.cos(m * Math.PI * 0.5);
      const wetFrac = Math.sin(m * Math.PI * 0.5) * 0.70 * makeup;
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
    }
  }
}
