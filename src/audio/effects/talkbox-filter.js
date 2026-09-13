/**
 * Authentic Heil / Roger Troutman Physical Talk Box Emulation
 * Models the acoustic vocal tract transfer function using a 4-formant dynamic filter bank (F1-F4),
 * tube compression saturation, and real-time envelope-driven mouth articulation (OO -> AH -> EE).
 */

export class TalkboxFormantFilter {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    // Authentic Peterson & Barney Vocal Tract Formants [F1, F2, F3, F4, Gain, Q]
    // Clamped Q to 2.2-3.2 to prevent mathematical self-oscillation & NaN blowout under heavy chords
    this.vowelMap = {
      oo: { f: [280, 840, 2200, 3200], g: [0.90, 0.40, 0.20, 0.12], q: [2.2, 2.5, 2.8, 3.0] },
      oh: { f: [450, 950, 2350, 3300], g: [0.90, 0.50, 0.22, 0.14], q: [2.4, 2.6, 2.8, 3.0] },
      ah: { f: [750, 1180, 2450, 3400], g: [0.95, 0.55, 0.28, 0.16], q: [2.5, 2.8, 3.0, 3.2] },
      eh: { f: [530, 1850, 2500, 3500], g: [0.85, 0.70, 0.32, 0.18], q: [2.5, 2.9, 3.0, 3.2] },
      ee: { f: [270, 2300, 3050, 3600], g: [0.80, 0.85, 0.45, 0.22], q: [2.2, 3.0, 3.2, 3.2] },
      yea: { f: [620, 1950, 2700, 3550], g: [0.90, 0.75, 0.40, 0.20], q: [2.6, 3.0, 3.1, 3.2] }
    };

    this.mix = 0.85; // Talkbox is prominently wet
    this.mouthMorph = 0.0; // 0.0 (Closed OO) -> 0.5 (Open AH) -> 1.0 (Wide EE)
    this.sensitivity = 1.25;
    this.drive = 0.30; // Tube driver saturation
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // 1. Plastic Tube Driver Simulation (Mild Compression + Saturation)
    this.tubeDrive = ctx.createWaveShaper();
    this.tubeDrive.curve = this.makeTubeCurve();

    this.tubePreFilter = ctx.createBiquadFilter();
    this.tubePreFilter.type = "bandpass";
    this.tubePreFilter.frequency.value = 1800;
    this.tubePreFilter.Q.value = 0.65; // Wide vocal presence

    this.input.connect(this.tubePreFilter);
    this.tubePreFilter.connect(this.tubeDrive);

    // 2. 4 Parallel Vocal Tract Formant Filters (F1, F2, F3, F4)
    this.formantFilters = [];
    this.formantGains = [];
    this.mouthSum = ctx.createGain();
    this.mouthSum.gain.value = 1.15; // Balanced makeup gain for 4 vocal tract bandpass filters

    for (let i = 0; i < 4; i++) {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      const gain = ctx.createGain();

      this.tubeDrive.connect(filter);
      filter.connect(gain);
      gain.connect(this.mouthSum);

      this.formantFilters.push(filter);
      this.formantGains.push(gain);
    }

    // 3. Oral Cavity Air / Presence Post-Filter
    this.airFilter = ctx.createBiquadFilter();
    this.airFilter.type = "peaking";
    this.airFilter.frequency.value = 3200;
    this.airFilter.Q.value = 1.5;
    this.airFilter.gain.value = 1.0; // Controlled human vocal presence

    // 4. Dedicated Anti-Clip Brickwall Limiter for Formant Output
    this.talkboxLimiter = ctx.createDynamicsCompressor();
    this.talkboxLimiter.threshold.value = -1.5;
    this.talkboxLimiter.knee.value = 4.0;
    this.talkboxLimiter.ratio.value = 12.0;
    this.talkboxLimiter.attack.value = 0.003;
    this.talkboxLimiter.release.value = 0.080;

    this.mouthSum.connect(this.airFilter);
    this.airFilter.connect(this.talkboxLimiter);
    this.talkboxLimiter.connect(this.wetGain);

    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);

    // 5. Real-time Envelope Follower (Dynamic "Talking Mouth" Articulation)
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.35;
    this.input.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    this._vocalAttackTime = 0;
    this._vocalPeak = 0.85;
    this._vocalRest = 0.38;

    this.setVowelPosition(0.35);
    this.startDynamicMouthTracking();
  }

  makeTubeCurve() {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * 1.5) * 0.88;
    }
    return curve;
  }

  /**
   * Smoothly morphs the 4 acoustic formants across the vocal continuum:
   * 0.0 = [OO / Closed] -> 0.45 = [AH / Open] -> 0.75 = [YEAH] -> 1.0 = [EE / Smile]
   */
  setVowelPosition(pos) {
    if (!this.ctx) return;
    const clamped = Math.max(0, Math.min(1.0, isNaN(pos) ? 0.35 : pos));
    this.mouthMorph = clamped;
    const now = this.ctx.currentTime;

    let v1, v2, blend;
    if (clamped < 0.45) {
      v1 = this.vowelMap.oo;
      v2 = this.vowelMap.ah;
      blend = clamped / 0.45;
    } else if (clamped < 0.75) {
      v1 = this.vowelMap.ah;
      v2 = this.vowelMap.yea;
      blend = (clamped - 0.45) / 0.30;
    } else {
      v1 = this.vowelMap.yea;
      v2 = this.vowelMap.ee;
      blend = (clamped - 0.75) / 0.25;
    }

    for (let i = 0; i < 4; i++) {
      const freq = Math.max(80, Math.min(12000, v1.f[i] + blend * (v2.f[i] - v1.f[i])));
      const gain = Math.max(0.01, Math.min(1.5, v1.g[i] + blend * (v2.g[i] - v1.g[i])));
      const q = Math.max(0.5, Math.min(3.5, v1.q[i] + blend * (v2.q[i] - v1.q[i])));

      try {
        this.formantFilters[i].frequency.setTargetAtTime(freq, now, 0.025);
        this.formantFilters[i].Q.setTargetAtTime(q, now, 0.025);
        this.formantGains[i].gain.setTargetAtTime(gain * 0.85, now, 0.025);
      } catch (e) {}
    }
  }

  /**
   * Triggers an authentic Roger Troutman phonetic vocal onset:
   * Key Strike -> Mouth opens "OO -> YEA/AH" (0.08 -> 0.85) -> Settles into resonant singing "OH" (0.38)
   */
  triggerVocalAttack(velocity = 95) {
    if (!this.enabled || !this.ctx) return;
    const velNorm = Math.max(0.2, Math.min(1.0, velocity / 127));
    const now = this.ctx.currentTime;
    this._vocalAttackTime = now;
    this._vocalPeak = 0.65 + velNorm * 0.28; // 0.70 - 0.93 based on touch dynamics
    this._vocalRest = 0.36;
    this.setVowelPosition(0.08); // Start at initial closed mouth onset
  }

  startDynamicMouthTracking() {
    let lastRms = 0;
    let smoothedMorph = 0.35;
    let lastUpdateMs = 0;

    const update = () => {
      const nowMs = performance.now();
      // Throttle to max 60fps even on 120Hz/144Hz high refresh rate tablet screens
      if (nowMs - lastUpdateMs >= 16) {
        lastUpdateMs = nowMs;
        if (this.enabled && this.ctx && this.ctx.state === "running") {
          this.analyser.getByteTimeDomainData(this.dataArray);
          let sum = 0;
          for (let i = 0; i < this.dataArray.length; i++) {
            const v = (this.dataArray[i] - 128) / 128;
            sum += v * v;
          }
          let rms = Math.sqrt(sum / this.dataArray.length);
          // Anti-NaN / Infinity protection
          if (!isFinite(rms) || isNaN(rms)) {
            rms = 0;
            lastRms = 0;
          }

          const delta = Math.max(0, rms - lastRms);
          lastRms = rms * 0.85 + lastRms * 0.15;

          const now = this.ctx.currentTime;
          let vocalEnv = 0.35;
          if (this._vocalAttackTime) {
            const elapsed = now - this._vocalAttackTime;
            if (elapsed < 0.045) {
              const t = elapsed / 0.045;
              vocalEnv = 0.08 + t * (this._vocalPeak - 0.08);
            } else if (elapsed < 0.32) {
              const t = (elapsed - 0.045) / 0.275;
              vocalEnv = this._vocalPeak - t * (this._vocalPeak - this._vocalRest);
            } else {
              const lfo = Math.sin((elapsed - 0.32) * Math.PI * 2 * 5.2) * 0.055;
              vocalEnv = this._vocalRest + lfo;
            }
          }

          // Dynamic transient accent push
          const transientPush = Math.min(0.30, delta * this.sensitivity * 1.5);
          const targetMorph = Math.max(0.05, Math.min(0.98, vocalEnv + transientPush));

          // Smooth interpolation eliminates filter clicking
          smoothedMorph = smoothedMorph * 0.75 + targetMorph * 0.25;
          this.setVowelPosition(smoothedMorph);
        }
      }
      this.animId = requestAnimationFrame(update);
    };
    this.animId = requestAnimationFrame(update);
  }

  reset() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      this.mouthSum.gain.cancelScheduledValues(now);
      this.mouthSum.gain.setValueAtTime(1.15, now);
      for (let i = 0; i < 4; i++) {
        if (this.formantFilters[i]) {
          this.formantFilters[i].frequency.cancelScheduledValues(now);
          this.formantFilters[i].Q.cancelScheduledValues(now);
        }
        if (this.formantGains[i]) {
          this.formantGains[i].gain.cancelScheduledValues(now);
        }
      }
      this.setVowelPosition(0.35);
    } catch (e) {}
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (bypassed) {
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.03);
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.03);
    } else {
      const dryVal = Math.max(0.0, 1.0 - this.mix);
      this.wetGain.gain.setTargetAtTime(this.mix, now, 0.03);
      this.dryGain.gain.setTargetAtTime(dryVal, now, 0.03);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    if (this.enabled && this.ctx) {
      const now = this.ctx.currentTime;
      const dryVal = Math.max(0.0, 1.0 - this.mix);
      this.wetGain.gain.setTargetAtTime(this.mix, now, 0.03);
      this.dryGain.gain.setTargetAtTime(dryVal, now, 0.03);
    }
  }

  setSensitivity(val) {
    this.sensitivity = Math.max(0.2, Math.min(3.0, val));
  }
}
