/**
 * Master Lo-Fi Vintage Tape & Vinyl Engine
 * Implements pitch wow/flutter micro-wobble, warm tape saturation,
 * and high-frequency analog roll-off for vintage Rhodes, keys & chillhop.
 */

export class VinylLoFiTape {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.wowSpeed = 0.35; // Hz slow tape drift
    this.flutterSpeed = 4.2; // Hz fast motor jitter
    this.wowDepth = 0.0022; // ~2.2ms pitch wobble
    this.flutterDepth = 0.0008; // ~0.8ms flutter
    this.mix = 0.85;
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Modulated Delay for Wow & Flutter
    this.delayNode = ctx.createDelay(0.1);
    this.delayNode.delayTime.value = 0.02;

    // LFO 1: Wow (Slow drift)
    this.wowOsc = ctx.createOscillator();
    this.wowOsc.frequency.value = this.wowSpeed;
    this.wowGain = ctx.createGain();
    this.wowGain.gain.value = this.wowDepth;
    this.wowOsc.connect(this.wowGain);
    this.wowGain.connect(this.delayNode.delayTime);

    // LFO 2: Flutter (Fast jitter)
    this.flutterOsc = ctx.createOscillator();
    this.flutterOsc.frequency.value = this.flutterSpeed;
    this.flutterGain = ctx.createGain();
    this.flutterGain.gain.value = this.flutterDepth;
    this.flutterOsc.connect(this.flutterGain);
    this.flutterGain.connect(this.delayNode.delayTime);

    try {
      this.wowOsc.start();
      this.flutterOsc.start();
    } catch (e) {}

    // Analog Tone Shaping Filter (Tape Warmth)
    this.tapeFilter = ctx.createBiquadFilter();
    this.tapeFilter.type = "lowpass";
    this.tapeFilter.frequency.value = 5200;

    // Tape Saturation Waveshaper
    this.saturation = ctx.createWaveShaper();
    this.saturation.curve = this.makeWarmCurve();

    // Wire Audio Path
    this.input.connect(this.delayNode);
    this.delayNode.connect(this.tapeFilter);
    this.tapeFilter.connect(this.saturation);
    this.saturation.connect(this.wetGain);

    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);
  }

  makeWarmCurve() {
    const n = 512;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = (Math.PI + 4) * x / (Math.PI + 4 * Math.abs(x));
    }
    return curve;
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    const now = this.ctx.currentTime;
    if (bypassed) {
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.03);
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.03);
    } else {
      this.wetGain.gain.setTargetAtTime(this.mix, now, 0.03);
      this.dryGain.gain.setTargetAtTime(1.0 - this.mix * 0.5, now, 0.03);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1, val));
    if (this.enabled) {
      this.wetGain.gain.setTargetAtTime(this.mix, this.ctx.currentTime, 0.03);
    }
  }

  setWobble(depthVal) {
    const val = Math.max(0, Math.min(1, depthVal));
    const now = this.ctx.currentTime;
    this.wowGain.gain.setTargetAtTime(val * 0.0035, now, 0.05);
    this.flutterGain.gain.setTargetAtTime(val * 0.0012, now, 0.05);
  }
}
