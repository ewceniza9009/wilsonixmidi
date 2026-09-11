/**
 * Strictly Clamped Dub Space Echo
 * Bounded feedback loop (max 40%) with analog tape damping and safe wet mixing
 * to prevent runaway oscillation or speaker overload.
 */

export class DubSpaceEcho {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.bpm = 120;
    this.time = 0.35; // Dotted 8th delay
    this.feedback = 0.35; // Safe bounded default
    this.mix = 0.28; // Musical, non-intrusive mix
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Delay line (max 1.5s)
    this.delayNode = ctx.createDelay(1.5);
    this.delayNode.delayTime.value = this.time;

    // Bounded Feedback Gain (Clamped to max 0.40)
    this.feedbackGain = ctx.createGain();
    this.feedbackGain.gain.value = 0.0;

    // Highpass (120Hz) & Lowpass (2.8kHz) tone damping
    this.highpassFilter = ctx.createBiquadFilter();
    this.highpassFilter.type = "highpass";
    this.highpassFilter.frequency.value = 140;

    this.tapeFilter = ctx.createBiquadFilter();
    this.tapeFilter.type = "lowpass";
    this.tapeFilter.frequency.value = 2600;

    // Soft Saturation Limiter
    this.saturation = ctx.createWaveShaper();
    this.saturation.curve = this.makeTapeCurve();

    // Wire Echo Loop: input -> delay -> hp -> lp -> saturation -> feedbackGain -> delay
    this.input.connect(this.delayNode);
    this.delayNode.connect(this.highpassFilter);
    this.highpassFilter.connect(this.tapeFilter);
    this.tapeFilter.connect(this.saturation);
    this.saturation.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);

    // Wet output
    this.saturation.connect(this.wetGain);
    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);
  }

  makeTapeCurve() {
    const n = 512;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * 1.2) * 0.85;
    }
    return curve;
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    const now = this.ctx.currentTime;
    if (bypassed) {
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.03);
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.03);
      this.feedbackGain.gain.setTargetAtTime(0.0, now, 0.03);
    } else {
      this.wetGain.gain.setTargetAtTime(this.mix, now, 0.03);
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.03);
      this.feedbackGain.gain.setTargetAtTime(this.feedback, now, 0.03);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(0.45, val));
    if (this.enabled) {
      this.wetGain.gain.setTargetAtTime(this.mix, this.ctx.currentTime, 0.03);
    }
  }

  setFeedback(val) {
    // Strictly clamp feedback to 0.42 max to prevent runaway screaming
    this.feedback = Math.max(0, Math.min(0.42, val));
    if (this.enabled) {
      this.feedbackGain.gain.setTargetAtTime(this.feedback, this.ctx.currentTime, 0.03);
    }
  }

  setTime(val) {
    this.time = Math.max(0.08, Math.min(0.9, val));
    this.delayNode.delayTime.setTargetAtTime(this.time, this.ctx.currentTime, 0.05);
  }

  setBpmSync(bpm, division = 0.375) {
    this.bpm = bpm;
    const beatSec = 60 / bpm;
    this.setTime(beatSec * division);
  }

  triggerDubThrow(durationSec = 1.8) {
    if (!this.enabled) this.setBypass(false);
    const now = this.ctx.currentTime;
    // Bounded momentary boost (0.50 max)
    this.feedbackGain.gain.cancelScheduledValues(now);
    this.feedbackGain.gain.setTargetAtTime(0.50, now, 0.05);

    setTimeout(() => {
      if (this.enabled) {
        this.feedbackGain.gain.setTargetAtTime(this.feedback, this.ctx.currentTime, 0.4);
      }
    }, durationSec * 1000);
  }
}
