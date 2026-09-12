/**
 * Digital Bitcrusher & Sample Rate Decimator
 * Vintage 8-bit/12-bit sampler lo-fi grit, digital distortion, and harmonic foldback.
 * Constant-power dry/wet architecture with dynamic series chain compatibility.
 */

export class BitcrusherDecimator {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.bits = 8; // 2 to 16 bits
    this.downsampleFreq = 8000; // Hz (1000 to 20000)
    this.drive = 1.2; // 1.0 to 4.0
    this.mix = 0.65; // 0 to 1
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Pre-Gain drive
    this.driveGain = ctx.createGain();
    this.driveGain.gain.value = this.drive;

    // Anti-aliasing / decimation filter (simulates downsampled DAC bandwidth)
    this.deciFilter = ctx.createBiquadFilter();
    this.deciFilter.type = "lowpass";
    this.deciFilter.frequency.value = this.downsampleFreq;
    this.deciFilter.Q.value = 1.2;

    // Bit quantization WaveShaper
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = this.makeBitcrushCurve(this.bits);
    this.shaper.oversample = "none"; // None preserves raw retro digital bite

    // Post-tone smoothing filter
    this.postFilter = ctx.createBiquadFilter();
    this.postFilter.type = "lowpass";
    this.postFilter.frequency.value = 12000;

    // Wet signal path
    this.input.connect(this.driveGain);
    this.driveGain.connect(this.deciFilter);
    this.deciFilter.connect(this.shaper);
    this.shaper.connect(this.postFilter);
    this.postFilter.connect(this.wetGain);
    this.wetGain.connect(this.output);
    this.wetGain.gain.value = 0.0;
  }

  makeBitcrushCurve(bits) {
    const n = 4096;
    const curve = new Float32Array(n);
    const stepCount = Math.pow(2, Math.max(2, Math.min(16, bits)));
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / (n - 1) - 1; // -1 to +1
      // Quantize to discrete steps
      curve[i] = Math.round(x * stepCount) / stepCount;
    }
    return curve;
  }

  setBits(val) {
    this.bits = Math.max(2, Math.min(16, Math.round(val)));
    if (this.shaper) {
      this.shaper.curve = this.makeBitcrushCurve(this.bits);
    }
  }

  setDownsample(freqHz) {
    this.downsampleFreq = Math.max(1000, Math.min(20000, freqHz));
    if (this.deciFilter) {
      this.deciFilter.frequency.setTargetAtTime(this.downsampleFreq, this.ctx.currentTime, 0.02);
    }
  }

  setDrive(val) {
    this.drive = Math.max(1.0, Math.min(4.0, val));
    if (this.driveGain) {
      this.driveGain.gain.setTargetAtTime(this.drive, this.ctx.currentTime, 0.02);
    }
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
