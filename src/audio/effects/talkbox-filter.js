/**
 * Authentic Roger Troutman / Heil Physical Talk Box Emulation
 * Models vocal tract mouth resonances (Formants F1, F2, F3) combined with a rich
 * fundamental carrier core, tube warmth, and organic note-triggered mouth articulation.
 *
 * Permanent Audio Graph (Zero audio drops, zero NaN wedging, zero disconnect leaks).
 */

export class TalkboxFormantFilter {
  constructor(ctx) {
    this.ctx = ctx;

    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.mix = 0.85;
    this.enabled = false;

    this._tubeCurve = this._makeTubeCurve();
    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // 1. Dry Path (input -> dryGain -> output)
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // 2. DC Blocker Highpass (removes sub-bass DC offset)
    this.dcBlocker = ctx.createBiquadFilter();
    this.dcBlocker.type = "highpass";
    this.dcBlocker.frequency.value = 60;
    this.dcBlocker.Q.value = 0.7;

    // 3. Throat Driver Tube Saturation
    this.tubeDrive = ctx.createWaveShaper();
    this.tubeDrive.curve = this._tubeCurve;

    // 4. Chest / Throat Body Resonance (~300Hz, +5dB)
    this.throatFilter = ctx.createBiquadFilter();
    this.throatFilter.type = "peaking";
    this.throatFilter.frequency.value = 320;
    this.throatFilter.Q.value = 1.8;
    this.throatFilter.gain.value = 5.0;

    // 5. Formant F1 (Throat/Jaw Vowel Height - resting ~650Hz, +15dB boost)
    this.f1Filter = ctx.createBiquadFilter();
    this.f1Filter.type = "peaking";
    this.f1Filter.frequency.value = 650;
    this.f1Filter.Q.value = 3.8;
    this.f1Filter.gain.value = 15.0;

    // 6. Formant F2 (Mouth Cavity / Tongue Vowel Shape - resting ~1550Hz, +14dB boost)
    this.f2Filter = ctx.createBiquadFilter();
    this.f2Filter.type = "peaking";
    this.f2Filter.frequency.value = 1550;
    this.f2Filter.Q.value = 4.2;
    this.f2Filter.gain.value = 14.0;

    // 7. Formant F3 (Nasal / Teeth Resonance - resting ~2850Hz, +10dB boost)
    this.f3Filter = ctx.createBiquadFilter();
    this.f3Filter.type = "peaking";
    this.f3Filter.frequency.value = 2850;
    this.f3Filter.Q.value = 3.5;
    this.f3Filter.gain.value = 10.0;

    // 8. Vinyl Tube High-Frequency Damping (>5.5kHz)
    this.tubeLowpass = ctx.createBiquadFilter();
    this.tubeLowpass.type = "lowpass";
    this.tubeLowpass.frequency.value = 5400;
    this.tubeLowpass.Q.value = 0.9;

    // 9. Vocal Articulation Presence (+3.5dB at 2.8kHz)
    this.presence = ctx.createBiquadFilter();
    this.presence.type = "peaking";
    this.presence.frequency.value = 2800;
    this.presence.Q.value = 1.5;
    this.presence.gain.value = 3.5;

    // 10. Vocal Leveler / Brickwall Limiter
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3.0;
    this.limiter.knee.value = 3.0;
    this.limiter.ratio.value = 6.0;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.050;

    // Series Routing:
    // input -> dcBlocker -> tubeDrive -> throatFilter -> f1Filter -> f2Filter -> f3Filter -> tubeLowpass -> presence -> limiter -> wetGain -> output
    this.input.connect(this.dcBlocker);
    this.dcBlocker.connect(this.tubeDrive);
    this.tubeDrive.connect(this.throatFilter);
    this.throatFilter.connect(this.f1Filter);
    this.f1Filter.connect(this.f2Filter);
    this.f2Filter.connect(this.f3Filter);
    this.f3Filter.connect(this.tubeLowpass);
    this.tubeLowpass.connect(this.presence);
    this.presence.connect(this.limiter);
    this.limiter.connect(this.wetGain);

    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);
  }

  _makeTubeCurve() {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * 1.5) * 0.90;
    }
    return curve;
  }

  /**
   * Triggers an authentic Roger Troutman mouth articulation on key strike.
   */
  triggerVocalAttack(velocity = 95) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const velNorm = Math.max(0.2, Math.min(1.0, velocity / 127));

    // Dynamic vowel shape morphing (Closed mouth 'W'/'Y' consonant -> Open 'AH' / 'OH' / 'EE')
    const startF1 = 350;
    const peakF1 = 700 + velNorm * 220; // up to 920Hz (open "AH")
    const targetF1 = 580 + velNorm * 120; // settles on singing "OH"

    const startF2 = 1050;
    const peakF2 = 1800 + velNorm * 450; // up to 2250Hz ("EE" / "AH")
    const targetF2 = 1500 + velNorm * 200;

    const startF3 = 2400;
    const peakF3 = 3100 + velNorm * 300;
    const targetF3 = 2850;

    try {
      if (this.f1Filter) {
        this.f1Filter.frequency.cancelScheduledValues(now);
        this.f1Filter.frequency.setValueAtTime(startF1, now);
        this.f1Filter.frequency.setTargetAtTime(peakF1, now, 0.025);
        this.f1Filter.frequency.setTargetAtTime(targetF1, now + 0.06, 0.12);
      }
      if (this.f2Filter) {
        this.f2Filter.frequency.cancelScheduledValues(now);
        this.f2Filter.frequency.setValueAtTime(startF2, now);
        this.f2Filter.frequency.setTargetAtTime(peakF2, now, 0.030);
        this.f2Filter.frequency.setTargetAtTime(targetF2, now + 0.065, 0.14);
      }
      if (this.f3Filter) {
        this.f3Filter.frequency.cancelScheduledValues(now);
        this.f3Filter.frequency.setValueAtTime(startF3, now);
        this.f3Filter.frequency.setTargetAtTime(peakF3, now, 0.025);
        this.f3Filter.frequency.setTargetAtTime(targetF3, now + 0.06, 0.15);
      }
    } catch (e) {}
  }

  /**
   * Reset formant frequencies to resting positions.
   */
  reset() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      if (this.f1Filter) {
        this.f1Filter.frequency.cancelScheduledValues(now);
        this.f1Filter.frequency.setTargetAtTime(650, now, 0.02);
      }
      if (this.f2Filter) {
        this.f2Filter.frequency.cancelScheduledValues(now);
        this.f2Filter.frequency.setTargetAtTime(1550, now, 0.02);
      }
      if (this.f3Filter) {
        this.f3Filter.frequency.cancelScheduledValues(now);
        this.f3Filter.frequency.setTargetAtTime(2850, now, 0.02);
      }
    } catch (e) {}
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      this.wetGain.gain.cancelScheduledValues(now);
      this.dryGain.gain.cancelScheduledValues(now);

      if (bypassed) {
        this.wetGain.gain.setTargetAtTime(0.0, now, 0.015);
        this.dryGain.gain.setTargetAtTime(1.0, now, 0.015);
      } else {
        const dryVal = Math.max(0.0, 1.0 - this.mix);
        this.wetGain.gain.setTargetAtTime(this.mix, now, 0.015);
        this.dryGain.gain.setTargetAtTime(dryVal, now, 0.015);
      }
    } catch (e) {}
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    if (this.enabled && this.ctx) {
      const now = this.ctx.currentTime;
      try {
        const dryVal = Math.max(0.0, 1.0 - this.mix);
        this.wetGain.gain.setTargetAtTime(this.mix, now, 0.015);
        this.dryGain.gain.setTargetAtTime(dryVal, now, 0.015);
      } catch (e) {}
    }
  }

  setSensitivity(val) {
    // Retained for API compatibility
  }
}
