/**
 * Korg Valve Force & Analog Tube Overdrive
 * Asymmetric triode soft-saturation with warm 2nd and 3rd order harmonics.
 * Adds singing sustain, warmth, and crunch without muffling treble sparkle.
 */

export class TubeDrive {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.drive = 0.4; // 0 to 1
    this.tone = 12000; // Hz
    this.mix = 1.0; // 100% wet when engaged for authentic guitar/tube tone
    this.enabled = false;

    this.buildNetwork();

    // Only regenerate the 65536-sample WavShaper curve when drive actually
    // shifts by at least 1/512 of full range, so knob drags don't allocate
    // 256KB of garbage per mousemove event. Sub-0.2% steps are inaudible.
    this._curveKey = Math.round(this.drive * 512);
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Pre-Gain drive booster: pushes input signal into warm non-linear saturation
    this.preGain = ctx.createGain();
    this.preGain.gain.value = 1.0 + Math.pow(this.drive, 1.2) * 3.8;

    // Pre-emphasis filter: prevents harsh aliasing
    this.preFilter = ctx.createBiquadFilter();
    this.preFilter.type = "lowpass";
    this.preFilter.frequency.value = 14000;

    // WaveShaper with 4x oversampling
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = this.makeTriodeCurve(this.drive);
    this.shaper.oversample = "4x";

    // Post-distortion 4x12 Speaker Cabinet Simulation:
    // 1. Sub-bass tightener (preserves bass fundamentals down to 45Hz)
    this.cabHighpass = ctx.createBiquadFilter();
    this.cabHighpass.type = "highpass";
    this.cabHighpass.frequency.value = 45;

    // 2. Mid-presence punch (controlled British 4x12 bite without volume spike)
    this.cabPresence = ctx.createBiquadFilter();
    this.cabPresence.type = "peaking";
    this.cabPresence.frequency.value = 2600;
    this.cabPresence.Q.value = 1.2;
    this.cabPresence.gain.value = 1.0; // Subtle 1dB presence punch

    // 3. Post tone filter / Celestion speaker roll-off (eliminates harsh digital bee-buzz)
    this.postFilter = ctx.createBiquadFilter();
    this.postFilter.type = "lowpass";
    this.postFilter.frequency.value = this.tone;

    // 4. Equal-Loudness Makeup Gain (Crucial: prevents tube saturation from blowing speakers)
    this.makeupGain = ctx.createGain();
    this.makeupGain.gain.value = this.calculateMakeup(this.drive);

    this.input.connect(this.preGain);
    this.preGain.connect(this.preFilter);
    this.preFilter.connect(this.shaper);
    this.shaper.connect(this.cabHighpass);
    this.cabHighpass.connect(this.cabPresence);
    this.cabPresence.connect(this.postFilter);
    this.postFilter.connect(this.makeupGain);
    this.makeupGain.connect(this.wetGain);

    this.wetGain.gain.value = 0.0; // Bypassed by default
    this.wetGain.connect(this.output);
  }

  calculateMakeup(drive) {
    // True perceptual loudness calibration for non-linear saturation
    // Compensates for speaker cabinet filtering and harmonic compression so wet output level matches dry bypass
    return 0.68 / (1.0 + Math.pow(drive, 0.85) * 0.95);
  }

  makeTriodeCurve(amount) {
    const n_samples = 65536;
    const curve = new Float32Array(n_samples);
    const k = 1.0 + Math.max(0, Math.min(1.0, amount)) * 4.5;

    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      // 100% Smooth asymmetric triode saturation without any threshold steps or discontinuities
      const asym = x > 0 ? Math.tanh(x * k) : Math.tanh(x * (k * 0.75)) * 0.95;
      curve[i] = Math.tanh(asym * 1.2) * 0.88;
    }
    return curve;
  }

  setDrive(val) {
    this.drive = Math.max(0, Math.min(1.0, val));
    const curveKey = Math.round(this.drive * 512);
    if (curveKey !== this._curveKey) {
      this._curveKey = curveKey;
      this.shaper.curve = this.makeTriodeCurve(this.drive);
    }
    const now = this.ctx.currentTime;
    if (this.preGain) {
      const targetPre = 1.0 + Math.pow(this.drive, 1.2) * 3.8;
      this.preGain.gain.setTargetAtTime(targetPre, now, 0.02);
    }
    if (this.postFilter) {
      const cabFreq = this.drive > 0.5 ? 4600 : this.tone;
      this.postFilter.frequency.setTargetAtTime(cabFreq, now, 0.02);
    }
    if (this.makeupGain) {
      this.makeupGain.gain.setTargetAtTime(this.calculateMakeup(this.drive), now, 0.02);
    }
  }

  setTone(hz) {
    this.tone = Math.max(1500, Math.min(18000, hz));
    this.postFilter.frequency.setTargetAtTime(this.tone, this.ctx.currentTime, 0.02);
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5);
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
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5);
      const dryFrac = Math.cos(this.mix * Math.PI * 0.5);
      this.wetGain.gain.setValueAtTime(wetFrac, now);
      this.dryGain.gain.setValueAtTime(dryFrac, now);
    }
  }
}
