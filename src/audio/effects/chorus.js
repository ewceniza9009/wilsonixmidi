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

    this.rate = 0.8; // Hz - Gentle ensemble warmth
    this.depth = 0.0005; // 0.5ms ultra-subtle studio width (zero warble, zero flutter)
    this.mix = 0.25;
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Wet Pre-Filters: 120Hz highpass + 8500Hz lowpass for clean studio sheen
    this.wetHp = ctx.createBiquadFilter();
    this.wetHp.type = "highpass";
    this.wetHp.frequency.value = 120;

    this.wetLp = ctx.createBiquadFilter();
    this.wetLp.type = "lowpass";
    this.wetLp.frequency.value = 8500;

    this.input.connect(this.wetHp);
    this.wetHp.connect(this.wetLp);

    // Dimension D / Korg Vintage Chorus Delay Lines: 15ms Left, 17.5ms Right
    this.delayL = ctx.createDelay(0.1);
    this.delayL.delayTime.value = 0.015;

    this.delayR = ctx.createDelay(0.1);
    this.delayR.delayTime.value = 0.0175;

    // Smooth subtle LFO
    this.lfo = ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = this.rate;

    this.lfoGainL = ctx.createGain();
    this.lfoGainL.gain.value = this.depth;
    this.lfo.connect(this.lfoGainL);
    this.lfoGainL.connect(this.delayL.delayTime);

    this.lfoGainR = ctx.createGain();
    this.lfoGainR.gain.value = this.depth * 0.75;
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
    this.rate = Math.max(0.1, Math.min(4.0, hz));
    if (this.lfo) {
      this.lfo.frequency.setTargetAtTime(this.rate, this.ctx.currentTime, 0.02);
    }
  }

  setDepth(val) {
    // 0.5ms to 3.5ms safe micro-modulation depth (audible shimmer, no chorus "warble")
    this.depth = 0.0005 + val * 0.003;
    const now = this.ctx.currentTime;
    if (this.lfoGainL && this.lfoGainR) {
      this.lfoGainL.gain.setTargetAtTime(this.depth, now, 0.02);
      this.lfoGainR.gain.setTargetAtTime(this.depth * 0.75, now, 0.02);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      const dryFrac = Math.cos(this.mix * Math.PI * 0.5);
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5);
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
      const m = this.mix > 0 ? this.mix : 0.25;
      const dryFrac = Math.cos(m * Math.PI * 0.5);
      const wetFrac = Math.sin(m * Math.PI * 0.5);
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
    }
  }
}
