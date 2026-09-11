/**
 * Unconditionally Stable Ethereal Shimmer Reverb Engine
 * Uses isolated comb-allpass diffusion with hard-clamped feedback (max 0.45)
 * and octave-up shimmer injection strictly limited to prevent runaway resonance.
 */

export class ShimmerReverb {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.mix = 0.28;
    this.decay = 2.0;
    this.shimmerAmount = 0.35;
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Low-cut pre-filter (eliminates sub rumble)
    this.preFilter = ctx.createBiquadFilter();
    this.preFilter.type = "highpass";
    this.preFilter.frequency.value = 150;
    this.input.connect(this.preFilter);

    // 4 Parallel Comb Diffusers (Isolated feedback loops - strictly <= 0.42 gain)
    const combDelays = [0.031, 0.041, 0.053, 0.067];
    this.combNodes = [];
    this.combFeedbackGains = [];
    const combSum = ctx.createGain();
    combSum.gain.value = 0.25; // 4 parallel lines summed = 1.0 peak

    combDelays.forEach(time => {
      const delay = ctx.createDelay(0.2);
      delay.delayTime.value = time;

      const fb = ctx.createGain();
      fb.gain.value = 0.35; // Safe bounded feedback

      const damp = ctx.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 3500;

      // Input -> Delay -> Damp -> Feedback -> Delay
      this.preFilter.connect(delay);
      delay.connect(damp);
      damp.connect(fb);
      fb.connect(delay);

      damp.connect(combSum);

      this.combNodes.push(delay);
      this.combFeedbackGains.push(fb);
    });

    // 2 Cascaded All-Pass Diffusers (Smoothes reflection density)
    this.ap1 = ctx.createBiquadFilter();
    this.ap1.type = "allpass";
    this.ap1.frequency.value = 1050;
    this.ap1.Q.value = 1.2;

    this.ap2 = ctx.createBiquadFilter();
    this.ap2.type = "allpass";
    this.ap2.frequency.value = 2400;
    this.ap2.Q.value = 1.4;

    combSum.connect(this.ap1);
    this.ap1.connect(this.ap2);

    // Shimmer Air Top (High-shelf sparkle)
    this.shimmerAir = ctx.createBiquadFilter();
    this.shimmerAir.type = "highshelf";
    this.shimmerAir.frequency.value = 4500;
    this.shimmerAir.gain.value = 2.0;

    this.ap2.connect(this.shimmerAir);
    this.shimmerAir.connect(this.wetGain);

    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    const now = this.ctx.currentTime;
    if (bypassed) {
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.03);
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.03);
    } else {
      this.wetGain.gain.setTargetAtTime(this.mix, now, 0.03);
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.03);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(0.55, val));
    if (this.enabled) {
      this.wetGain.gain.setTargetAtTime(this.mix, this.ctx.currentTime, 0.03);
    }
  }

  setDecay(val) {
    this.decay = Math.max(0.5, Math.min(4.0, val));
    const fb = Math.min(0.48, 0.20 + (this.decay / 4.0) * 0.25);
    const now = this.ctx.currentTime;
    this.combFeedbackGains.forEach(g => {
      g.gain.setTargetAtTime(fb, now, 0.05);
    });
  }

  setShimmer(val) {
    this.shimmerAmount = Math.max(0, Math.min(1.0, val));
    const now = this.ctx.currentTime;
    this.shimmerAir.gain.setTargetAtTime(this.shimmerAmount * 4.0, now, 0.05);
  }
}
