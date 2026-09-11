/**
 * Gentle Dynamic Auto-Wah & Touch Filter
 * Smooth velocity-sensitive filter sweep with bounded resonance and unity gain.
 */

export class DynamicAutoWah {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.baseFreq = 400;
    this.sweepRange = 1800;
    this.resonance = 2.4; // Controlled, non-screaming Q
    this.sensitivity = 1.0;
    this.mix = 0.50;
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Resonant Peaking Filter with safe +3.0dB max boost
    this.wahFilter = ctx.createBiquadFilter();
    this.wahFilter.type = "peaking";
    this.wahFilter.frequency.value = this.baseFreq;
    this.wahFilter.Q.value = this.resonance;
    this.wahFilter.gain.value = 3.0; // Safe subtle boost

    // Envelope Follower
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.4;
    this.input.connect(this.analyser);

    // Audio routing
    this.input.connect(this.wahFilter);
    this.wahFilter.connect(this.wetGain);
    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.startEnvelopeTracker();
  }

  startEnvelopeTracker() {
    const update = () => {
      if (this.enabled && this.ctx && this.ctx.state === "running") {
        this.analyser.getByteTimeDomainData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          const v = (this.dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / this.dataArray.length);
        const targetFreq = Math.min(3200, this.baseFreq + rms * this.sweepRange * this.sensitivity * 2.0);
        this.wahFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.04);
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
      this.dryGain.gain.setTargetAtTime(1.0 - this.mix * 0.3, now, 0.03);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(0.70, val));
    if (this.enabled) {
      this.wetGain.gain.setTargetAtTime(this.mix, this.ctx.currentTime, 0.03);
    }
  }

  setResonance(val) {
    this.resonance = Math.max(1, Math.min(4.0, val));
    this.wahFilter.Q.setTargetAtTime(this.resonance, this.ctx.currentTime, 0.03);
  }

  setSensitivity(val) {
    this.sensitivity = Math.max(0.1, Math.min(2.0, val));
  }
}
