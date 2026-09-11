/**
 * Classic Stereo Tape Flanger
 * Short modulated delay lines with DC-blocked feedback for jet sweeps
 * without static accumulation or runaway ringing.
 */

export class StereoFlanger {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.rate = 0.45; // Hz
    this.depth = 0.0012; // seconds of sweep
    this.feedback = 0.22;
    this.mix = 0.45;
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Input conditioning (sub highpass at 30Hz)
    this.hp = ctx.createBiquadFilter();
    this.hp.type = "highpass";
    this.hp.frequency.value = 30;
    this.input.connect(this.hp);

    // Stereo modulated delay lines (mono-compatible pair)
    this.delayL = ctx.createDelay(0.05);
    this.delayL.delayTime.value = 0.0035;
    this.delayR = ctx.createDelay(0.05);
    this.delayR.delayTime.value = 0.0035;
    this.hp.connect(this.delayL);
    this.hp.connect(this.delayR);

    // Sweep LFO (right channel phase-offset for stereo spread)
    this.lfo = ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = this.rate;

    this.lfoGainL = ctx.createGain();
    this.lfoGainL.gain.value = this.depth;
    this.lfo.connect(this.lfoGainL);
    this.lfoGainL.connect(this.delayL.delayTime);

    this.lfoGainR = ctx.createGain();
    this.lfoGainR.gain.value = -this.depth * 0.8;
    this.lfo.connect(this.lfoGainR);
    this.lfoGainR.connect(this.delayR.delayTime);

    // DC-blocked feedback loops (bounded, never accumulate)
    this.fbDcL = ctx.createBiquadFilter();
    this.fbDcL.type = "highpass";
    this.fbDcL.frequency.value = 80;
    this.fbDcR = ctx.createBiquadFilter();
    this.fbDcR.type = "highpass";
    this.fbDcR.frequency.value = 80;

    this.feedbackL = ctx.createGain();
    this.feedbackL.gain.value = this.feedback;
    this.feedbackR = ctx.createGain();
    this.feedbackR.gain.value = this.feedback;

    this.delayL.connect(this.fbDcL);
    this.fbDcL.connect(this.feedbackL);
    this.feedbackL.connect(this.delayL);

    this.delayR.connect(this.fbDcR);
    this.fbDcR.connect(this.feedbackR);
    this.feedbackR.connect(this.delayR);

    // Stereo merger
    const merger = ctx.createChannelMerger(2);
    this.delayL.connect(merger, 0, 0);
    this.delayR.connect(merger, 0, 1);
    merger.connect(this.wetGain);

    this.wetGain.gain.value = 0.0; // Bypassed by default
    this.wetGain.connect(this.output);

    this.lfo.start();
  }

  setRate(hz) {
    this.rate = Math.max(0.1, Math.min(5.0, hz));
    if (this.lfo) {
      this.lfo.frequency.setTargetAtTime(this.rate, this.ctx.currentTime, 0.02);
    }
  }

  setDepth(val) {
    // 0.0004s to 0.0020s sweep depth
    this.depth = 0.0004 + Math.max(0, Math.min(1.0, val)) * 0.0016;
    const now = this.ctx.currentTime;
    if (this.lfoGainL && this.lfoGainR) {
      this.lfoGainL.gain.setTargetAtTime(this.depth, now, 0.02);
      this.lfoGainR.gain.setTargetAtTime(-this.depth * 0.8, now, 0.02);
    }
  }

  setFeedback(val) {
    this.feedback = Math.max(0, Math.min(0.5, val));
    const now = this.ctx.currentTime;
    if (this.feedbackL && this.feedbackR) {
      this.feedbackL.gain.setTargetAtTime(this.feedback, now, 0.02);
      this.feedbackR.gain.setTargetAtTime(this.feedback, now, 0.02);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      const fdbkComp = 1.0 / (1.0 + this.feedback * 0.35);
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5) * 0.85 * fdbkComp;
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
      const m = this.mix > 0 ? this.mix : 0.45;
      const fdbkComp = 1.0 / (1.0 + this.feedback * 0.35);
      const wetFrac = Math.sin(m * Math.PI * 0.5) * 0.85 * fdbkComp;
      const dryFrac = Math.cos(m * Math.PI * 0.5);
      this.wetGain.gain.setValueAtTime(wetFrac, now);
      this.dryGain.gain.setValueAtTime(dryFrac, now);
    }
  }
}
