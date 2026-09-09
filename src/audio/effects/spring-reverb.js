/**
 * MidiKey Elite - Vintage Spring Reverb ("The Surf Foundation")
 * 100% Native Web Audio Node Network (Zero JS loops, Zero Convolver blocking).
 * Emulates coiled springs in vintage guitar amps with metallic dispersion & 2k-5k resonant drip.
 */

export class SpringReverb {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.decay = 2.2;
    this.mix = 0.35;
    this.toneFreq = 3400;
    this.enabled = false;

    this.tankGains = [];
    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // 1. Low-end highpass (<220Hz roll-off)
    this.hpFilter = ctx.createBiquadFilter();
    this.hpFilter.type = "highpass";
    this.hpFilter.frequency.value = 220;

    // 2. 2kHz - 5kHz Metallic "Drip" Resonance Peaking Filter
    this.dripFilter = ctx.createBiquadFilter();
    this.dripFilter.type = "peaking";
    this.dripFilter.frequency.value = this.toneFreq;
    this.dripFilter.Q.value = 4.2;
    this.dripFilter.gain.value = 8.5;

    this.input.connect(this.hpFilter);
    this.hpFilter.connect(this.dripFilter);

    // 3. Staggered Spring Reflection Taps (coiled spring delay taps)
    const springDelays = [0.029, 0.038, 0.047, 0.059, 0.073];
    const tapWeights = [0.45, 0.38, 0.30, 0.22, 0.15];

    const sumL = ctx.createGain();
    const sumR = ctx.createGain();
    sumL.gain.value = 0.5;
    sumR.gain.value = 0.5;

    this.tankGains = [];

    for (let i = 0; i < springDelays.length; i++) {
      const dL = ctx.createDelay(0.2);
      dL.delayTime.value = springDelays[i];
      const gL = ctx.createGain();
      gL.gain.value = tapWeights[i];

      this.dripFilter.connect(dL);
      dL.connect(gL);
      gL.connect(sumL);
      this.tankGains.push(gL);

      const dR = ctx.createDelay(0.2);
      dR.delayTime.value = springDelays[i] * 1.12;
      const gR = ctx.createGain();
      gR.gain.value = tapWeights[i];

      this.dripFilter.connect(dR);
      dR.connect(gR);
      gR.connect(sumR);
      this.tankGains.push(gR);
    }

    // 4. Spring Dispersion Allpass Filters (Metallic chirp)
    let nodeL = sumL;
    let nodeR = sumR;
    const apFreqs = [2400, 3200, 4200];
    for (let i = 0; i < apFreqs.length; i++) {
      const apL = ctx.createBiquadFilter();
      apL.type = "allpass";
      apL.frequency.value = apFreqs[i];
      apL.Q.value = 2.5; // High resonant dispersion
      nodeL.connect(apL);
      nodeL = apL;

      const apR = ctx.createBiquadFilter();
      apR.type = "allpass";
      apR.frequency.value = apFreqs[i] * 1.08;
      apR.Q.value = 2.5;
      nodeR.connect(apR);
      nodeR = apR;
    }

    // Stereo Merger
    const merger = ctx.createChannelMerger(2);
    nodeL.connect(merger, 0, 0);
    nodeR.connect(merger, 0, 1);

    merger.connect(this.wetGain);
    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);
  }

  setTone(freq) {
    this.toneFreq = Math.max(1800, Math.min(5500, freq));
    if (this.dripFilter && this.ctx) {
      this.dripFilter.frequency.setTargetAtTime(this.toneFreq, this.ctx.currentTime, 0.02);
    }
  }

  setDecay(sec) {
    this.decay = Math.max(0.6, Math.min(4.5, sec));
    const factor = this.decay / 2.2;
    const now = this.ctx ? this.ctx.currentTime : 0;
    const tapWeights = [0.45, 0.38, 0.30, 0.22, 0.15];

    for (let i = 0; i < tapWeights.length; i++) {
      const w = Math.min(1.0, tapWeights[i] * factor);
      if (this.tankGains[i * 2]) {
        this.tankGains[i * 2].gain.setTargetAtTime(w, now, 0.02);
      }
      if (this.tankGains[i * 2 + 1]) {
        this.tankGains[i * 2 + 1].gain.setTargetAtTime(w, now, 0.02);
      }
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1, val));
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (this.enabled) {
      this.dryGain.gain.setTargetAtTime(1.0 - this.mix * 0.3, now, 0.02);
      this.wetGain.gain.setTargetAtTime(this.mix * 1.25, now, 0.02);
    }
  }

  setBypass(bypass) {
    this.enabled = !bypass;
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (this.enabled) {
      this.dryGain.gain.setTargetAtTime(1.0 - this.mix * 0.3, now, 0.02);
      this.wetGain.gain.setTargetAtTime(this.mix * 1.25, now, 0.02);
    } else {
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.02);
    }
  }
}
