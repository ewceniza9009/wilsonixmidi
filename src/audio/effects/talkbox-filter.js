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
    this.vowelMap = {
      oo: { f: [280, 840, 2200, 3200], g: [1.0, 0.45, 0.20, 0.12], q: [4.5, 5.0, 5.5, 6.0] },
      oh: { f: [450, 950, 2350, 3300], g: [1.0, 0.55, 0.25, 0.15], q: [4.8, 5.2, 5.8, 6.0] },
      ah: { f: [750, 1180, 2450, 3400], g: [1.0, 0.65, 0.35, 0.18], q: [5.0, 5.5, 6.0, 6.5] },
      eh: { f: [530, 1850, 2500, 3500], g: [0.9, 0.80, 0.40, 0.20], q: [4.8, 6.0, 6.2, 6.5] },
      ee: { f: [270, 2300, 3050, 3600], g: [0.85, 1.0, 0.55, 0.25], q: [4.5, 6.5, 7.0, 7.0] },
      yea: { f: [620, 1950, 2700, 3550], g: [1.0, 0.90, 0.50, 0.22], q: [5.2, 6.2, 6.5, 6.8] }
    };

    this.mix = 0.85; // Talkbox is prominently wet
    this.mouthMorph = 0.0; // 0.0 (Closed OO) -> 0.5 (Open AH) -> 1.0 (Wide EE)
    this.sensitivity = 1.35;
    this.drive = 0.35; // Tube driver saturation
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
    this.mouthSum.gain.value = 0.55;

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
    this.airFilter.Q.value = 1.8;
    this.airFilter.gain.value = 3.0; // Human vocal presence

    this.mouthSum.connect(this.airFilter);
    this.airFilter.connect(this.wetGain);

    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);

    // 4. Real-time Envelope Follower (Dynamic "Talking Mouth" Articulation)
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.35;
    this.input.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    this.setVowelPosition(0.0);
    this.startDynamicMouthTracking();
  }

  makeTubeCurve() {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * 1.8) * 0.9;
    }
    return curve;
  }

  /**
   * Smoothly morphs the 4 acoustic formants across the vocal continuum:
   * 0.0 = [OO / Closed] -> 0.45 = [AH / Open] -> 0.75 = [YEAH] -> 1.0 = [EE / Smile]
   */
  setVowelPosition(pos) {
    const clamped = Math.max(0, Math.min(1.0, pos));
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
      const freq = v1.f[i] + blend * (v2.f[i] - v1.f[i]);
      const gain = v1.g[i] + blend * (v2.g[i] - v1.g[i]);
      const q = v1.q[i] + blend * (v2.q[i] - v1.q[i]);

      this.formantFilters[i].frequency.setTargetAtTime(freq, now, 0.035);
      this.formantFilters[i].Q.setTargetAtTime(q, now, 0.035);
      this.formantGains[i].gain.setTargetAtTime(gain * 0.9, now, 0.035);
    }
  }

  startDynamicMouthTracking() {
    const update = () => {
      if (this.enabled && this.ctx && this.ctx.state === "running") {
        this.analyser.getByteTimeDomainData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          const v = (this.dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / this.dataArray.length);
        // Dynamic envelope sweeps mouth from OO to AH/EE and back
        const targetMorph = Math.min(1.0, rms * this.sensitivity * 3.8);
        this.setVowelPosition(targetMorph);
      }
      this.animId = requestAnimationFrame(update);
    };
    this.animId = requestAnimationFrame(update);
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    const now = this.ctx.currentTime;
    if (bypassed) {
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.03);
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.03);
    } else {
      this.wetGain.gain.setTargetAtTime(this.mix, now, 0.03);
      this.dryGain.gain.setTargetAtTime(1.0 - this.mix * 0.7, now, 0.03);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    if (this.enabled) {
      this.wetGain.gain.setTargetAtTime(this.mix, this.ctx.currentTime, 0.03);
      this.dryGain.gain.setTargetAtTime(1.0 - this.mix * 0.7, this.ctx.currentTime, 0.03);
    }
  }

  setSensitivity(val) {
    this.sensitivity = Math.max(0.2, Math.min(3.0, val));
  }
}
