/**
 * MidiKey Elite - Vintage Slapback Tape Delay ("Vocal Attitude")
 * Creates a single, distinct, and rapid echo mimicking early vintage tape machines.
 * Features:
 * - 75ms to 120ms short rapid delay
 * - Zero feedback (no repeating wash)
 * - Subtle high-frequency tape degradation roll-off
 * - In-your-face rockabilly & 80s synth-pop vocal attitude
 */

export class SlapbackTapeDelay {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.delayTime = 0.095; // 95ms default (75ms - 120ms)
    this.tapeTone = 3400; // 3.4kHz warm tape lowpass
    this.mix = 0.35;
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Tape Warmth / Rolloff Filter
    this.tapeFilter = ctx.createBiquadFilter();
    this.tapeFilter.type = "lowpass";
    this.tapeFilter.frequency.value = this.tapeTone;

    // Highpass to eliminate low-end mud
    this.hpFilter = ctx.createBiquadFilter();
    this.hpFilter.type = "highpass";
    this.hpFilter.frequency.value = 160;

    // Single Precision Delay Line (Zero Feedback)
    this.delayNode = ctx.createDelay(0.3);
    this.delayNode.delayTime.value = this.delayTime;

    // Routing: Input -> HP -> LP -> Delay -> WetGain -> Output (Strictly Zero Feedback)
    this.input.connect(this.hpFilter);
    this.hpFilter.connect(this.tapeFilter);
    this.tapeFilter.connect(this.delayNode);
    this.delayNode.connect(this.wetGain);
    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);
  }

  setDelayTime(sec) {
    // 0.065s to 0.140s (65ms - 140ms rockabilly / new wave slapback)
    this.delayTime = Math.max(0.065, Math.min(0.140, sec));
    if (this.delayNode) {
      this.delayNode.delayTime.setTargetAtTime(this.delayTime, this.ctx.currentTime, 0.02);
    }
  }

  setTone(freq) {
    this.tapeTone = Math.max(1800, Math.min(8000, freq));
    if (this.tapeFilter) {
      this.tapeFilter.frequency.setTargetAtTime(this.tapeTone, this.ctx.currentTime, 0.02);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      const dryFrac = Math.cos(this.mix * Math.PI * 0.5);
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5) * 0.85;
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
    }
  }

  setBypass(bypass) {
    this.enabled = !bypass;
    const now = this.ctx.currentTime;
    if (this.enabled) {
      const m = this.mix > 0 ? this.mix : 0.35;
      const dryFrac = Math.cos(m * Math.PI * 0.5);
      const wetFrac = Math.sin(m * Math.PI * 0.5) * 0.85;
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
    } else {
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.02);
    }
  }
}
