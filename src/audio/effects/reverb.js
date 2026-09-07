/**
 * Non-Feedback High-Density Studio Convolution Reverb
 * 100% FIR Architecture (Zero Feedback Loops = Mathematically 0% Risk of Runaway Oscillation or Ringing).
 * Generates an ultra-smooth, warm, diffuse acoustic decay normalized for zero hiss, zero distortion, and zero feedback.
 */

export class AlgorithmicReverb {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.convolver = ctx.createConvolver();
    this.convolver.normalize = true; // Web Audio auto-normalization prevents volume surges

    this.decay = 1.8; // seconds
    this.mix = 0.0; // Dry by default
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // 1. Dry Direct Path (100% pass-through)
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // 2. Pre-Delay (20ms)
    this.preDelay = ctx.createDelay(0.1);
    this.preDelay.delayTime.value = 0.02;

    // 3. Highpass (160Hz) - cuts sub-bass resonance
    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = "highpass";
    this.highpass.frequency.value = 160;

    // 4. Lowpass (7500Hz) - lush open studio air & plate sparkle
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = "lowpass";
    this.lowpass.frequency.value = 7500;

    // Calibrated wet trim gain: prevents normalized convolution from overpowering direct signal
    this.reverbTrim = ctx.createGain();
    this.reverbTrim.gain.value = 0.30;

    // Connect Wet: input -> preDelay -> highpass -> lowpass -> convolver -> reverbTrim -> wetGain -> output
    this.input.connect(this.preDelay);
    this.preDelay.connect(this.highpass);
    this.highpass.connect(this.lowpass);
    this.lowpass.connect(this.convolver);
    this.convolver.connect(this.reverbTrim);
    this.reverbTrim.connect(this.wetGain);
    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);

    this.generateSmoothImpulse(this.decay);
  }

  generateSmoothImpulse(decaySeconds) {
    const ctx = this.ctx;
    const sampleRate = ctx.sampleRate || 48000;
    const len = Math.max(1, Math.floor(sampleRate * Math.min(4.0, Math.max(0.5, decaySeconds))));
    const impulse = ctx.createBuffer(2, len, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    const decayConstant = 3.5 / Math.max(0.5, decaySeconds);

    // Filter state for smoothing noise into lush warm diffuse reflections
    let lpL = 0;
    let lpR = 0;
    const alpha = 0.22; // Smooth out harsh peaks while keeping open hall shimmer

    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * decayConstant);

      // Early diffuse reflections + decaying tail
      const rawL = (Math.random() * 2 - 1) * env;
      const rawR = (Math.random() * 2 - 1) * env;

      lpL += alpha * (rawL - lpL);
      lpR += alpha * (rawR - lpR);

      // Wide stereo decorrelation
      left[i] = (lpL * 0.85 + (Math.random() * 2 - 1) * env * 0.15);
      right[i] = (lpR * 0.85 + (Math.random() * 2 - 1) * env * 0.15);
    }

    this.convolver.buffer = impulse;
  }

  setDecay(seconds) {
    this.decay = Math.max(0.4, Math.min(5.0, seconds));
    this.generateSmoothImpulse(this.decay);
  }

  setRoomSize(val) {
    const norm = Math.max(0.05, Math.min(1.0, val));
    if (this.preDelay) {
      this.preDelay.delayTime.setTargetAtTime(0.01 + norm * 0.055, this.ctx.currentTime, 0.02);
    }
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      // Parallel dry/wet: dry stays punchy and 100% present, reverb sits musical underneath
      const dryFrac = 1.0 - this.mix * 0.08;
      const wetFrac = this.mix * 0.90;
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
    }
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    const now = this.ctx.currentTime;
    if (bypassed) {
      this.wetGain.gain.setTargetAtTime(0, now, 0.02);
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
    } else {
      const m = this.mix > 0 ? this.mix : 0.28;
      const dryFrac = 1.0 - m * 0.08;
      const wetFrac = m * 0.90;
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
    }
  }
}
