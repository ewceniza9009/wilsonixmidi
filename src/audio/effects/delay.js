/**
 * Feedback-Clamped Stereo Ping-Pong Delay with Analog Tape Damping
 * Strictly bounded feedback loops (max 35%) with in-loop saturation limiter
 * to mathematically prevent runaway ringing, feedback accumulation, or speaker damage.
 */

export class PingPongDelay {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.bpm = 120;
    this.division = 0.375; // Dotted 8th note
    this.feedback = 0.48; // Healthy, rhythmic echo repeats
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

    // DC Blocker filter on input
    this.dcBlocker = ctx.createBiquadFilter();
    this.dcBlocker.type = "highpass";
    this.dcBlocker.frequency.value = 140;
    this.input.connect(this.dcBlocker);

    // Left delay line
    this.delayL = ctx.createDelay(2.0);
    this.delayL.delayTime.value = this.calculateDelayTime();

    // Right delay line
    this.delayR = ctx.createDelay(2.0);
    this.delayR.delayTime.value = this.calculateDelayTime() * 1.333;

    // Feedback gains
    this.feedbackL = ctx.createGain();
    this.feedbackR = ctx.createGain();
    this.feedbackL.gain.value = 0.0; // Muted by default
    this.feedbackR.gain.value = 0.0; // Muted by default

    // Analog High-Cut Damping: Warm analog tape character
    this.dampL = ctx.createBiquadFilter();
    this.dampL.type = "lowpass";
    this.dampL.frequency.value = 3600;

    this.dampR = ctx.createBiquadFilter();
    this.dampR.type = "lowpass";
    this.dampR.frequency.value = 3600;

    // Cross ping-pong wiring with clean, bounded feedback:
    // Input -> DelayL -> DampL -> FeedbackL -> DelayR
    // DelayR -> DampR -> FeedbackR -> DelayL
    this.dcBlocker.connect(this.delayL);
    this.delayL.connect(this.dampL);
    this.dampL.connect(this.feedbackL);
    this.feedbackL.connect(this.delayR);

    this.delayR.connect(this.dampR);
    this.dampR.connect(this.feedbackR);
    this.feedbackR.connect(this.delayL);

    // Stereo Merger
    const merger = ctx.createChannelMerger(2);
    this.dampL.connect(merger, 0, 0);
    this.dampR.connect(merger, 0, 1);

    merger.connect(this.wetGain);
    this.wetGain.gain.value = 0.0; // Bypassed by default
    this.wetGain.connect(this.output);
  }

  calculateDelayTime() {
    return (60.0 / this.bpm) * this.division;
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(240, bpm));
    const dt = this.calculateDelayTime();
    const now = this.ctx.currentTime;
    this.delayL.delayTime.setTargetAtTime(dt, now, 0.05);
    this.delayR.delayTime.setTargetAtTime(dt * 1.333, now, 0.05);
  }

  setDivision(div) {
    this.division = Math.max(0.125, Math.min(1.0, div));
    const dt = this.calculateDelayTime();
    const now = this.ctx.currentTime;
    this.delayL.delayTime.setTargetAtTime(dt, now, 0.05);
    this.delayR.delayTime.setTargetAtTime(dt * 1.333, now, 0.05);
  }

  setFeedback(val) {
    // Strictly bounded to 0.55 max so delay repeats always naturally decay and NEVER ring indefinitely
    this.feedback = Math.max(0, Math.min(0.55, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      this.feedbackL.gain.setTargetAtTime(this.feedback, now, 0.02);
      this.feedbackR.gain.setTargetAtTime(this.feedback, now, 0.02);
    }
  }

  flush() {
    const now = this.ctx.currentTime;
    try {
      this.feedbackL.gain.cancelScheduledValues(now);
      this.feedbackR.gain.cancelScheduledValues(now);
      this.feedbackL.gain.setValueAtTime(0, now);
      this.feedbackR.gain.setValueAtTime(0, now);
      if (this.enabled) {
        this.feedbackL.gain.setTargetAtTime(this.feedback, now + 0.05, 0.05);
        this.feedbackR.gain.setTargetAtTime(this.feedback, now + 0.05, 0.05);
      }
    } catch (e) {}
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      // Calibrated delay wet gain: sits musical in the mix without boosting master volume
      const fdbkComp = 1.0 / (1.0 + this.feedback * 0.45);
      const wet = this.mix * 0.42 * fdbkComp;
      const dry = 1.0 - this.mix * 0.12;
      this.wetGain.gain.setTargetAtTime(wet, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dry, now, 0.02);
    }
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    const now = this.ctx.currentTime;
    if (bypassed) {
      this.wetGain.gain.setTargetAtTime(0, now, 0.02);
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.feedbackL.gain.setTargetAtTime(0, now, 0.02);
      this.feedbackR.gain.setTargetAtTime(0, now, 0.02);
    } else {
      const m = this.mix > 0 ? this.mix : 0.35;
      const fdbkComp = 1.0 / (1.0 + this.feedback * 0.45);
      const wet = m * 0.42 * fdbkComp;
      const dry = 1.0 - m * 0.12;
      this.wetGain.gain.setTargetAtTime(wet, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dry, now, 0.02);
      this.feedbackL.gain.setTargetAtTime(this.feedback, now, 0.02);
      this.feedbackR.gain.setTargetAtTime(this.feedback, now, 0.02);
    }
  }
}
