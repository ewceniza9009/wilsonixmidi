/**
 * MidiKey Elite - Professional SFX, Nature, Vox & Percussion Synthesis Engine
 * Generates realistic nature ambience, human vocal expressions, sci-fi glitches,
 * DJ/cinematic sound effects, and analog/acoustic drum percussion using pure Web Audio DSP.
 */

import { synthesizerYouEngine } from "./synthesizer-you-samples.js";

export class SfxSoundGenerator {
  constructor(ctx, destinationNode) {
    this.ctx = ctx;
    this.destination = destinationNode;
    this.noiseBuffer = null;
    this.initNoiseBuffer();
  }

  initNoiseBuffer() {
    const ctx = this.ctx;
    const length = ctx.sampleRate * 4; // 4 seconds of noise
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      let lastOut = 0.0;
      for (let i = 0; i < length; i++) {
        // Pink-tinted random noise
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.03 * white) / 1.03;
        data[i] = (lastOut * 3.5 + white * 0.25) * 0.5;
      }
    }
    this.noiseBuffer = buffer;
  }

  // Helper: Create a noise source
  createNoiseSource(loop = true) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = loop;
    return src;
  }

  // =========================================================================
  // 1. NATURE SOUNDS
  // =========================================================================

  triggerThunder(velocity = 100, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    // Sub-bass thunder impact (120Hz -> 32Hz)
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 1.2);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(0.85 * vel * customGain, now + 0.04);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    // Rumble noise tail
    const noise = this.createNoiseSource(false);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 2.8);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.65 * vel * customGain, now + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);

    osc.connect(oscGain);
    oscGain.connect(this.destination);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.destination);

    osc.start(now);
    osc.stop(now + 2.6);
    noise.start(now);
    noise.stop(now + 3.3);

    return { osc, noise };
  }

  triggerRain(duration = 4.0, velocity = 90, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    const noise = this.createNoiseSource(true);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1800, now);
    bp.Q.setValueAtTime(0.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.40 * vel * customGain, now + 0.3);
    gain.gain.linearRampToValueAtTime(0.40 * vel * customGain, now + duration - 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(this.destination);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    return noise;
  }

  triggerOceanWave(duration = 5.0, velocity = 95, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    const noise = this.createNoiseSource(true);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(250, now);
    lp.frequency.linearRampToValueAtTime(1800, now + duration * 0.45);
    lp.frequency.linearRampToValueAtTime(320, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.55 * vel * customGain, now + duration * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(lp);
    lp.connect(gain);
    gain.connect(this.destination);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    return noise;
  }

  triggerBirdChirp(pitchMidi = 72, velocity = 95, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const baseFreq = 440 * Math.pow(2, (pitchMidi - 69) / 12);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq * 2.2, now);
    osc.frequency.linearRampToValueAtTime(baseFreq * 3.4, now + 0.04);
    osc.frequency.linearRampToValueAtTime(baseFreq * 2.8, now + 0.08);
    osc.frequency.linearRampToValueAtTime(baseFreq * 3.8, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.22);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35 * vel * customGain, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.destination);

    osc.start(now);
    osc.stop(now + 0.26);
    return osc;
  }

  triggerWind(duration = 4.0, velocity = 90, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    const noise = this.createNoiseSource(true);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(450, now);
    bp.frequency.linearRampToValueAtTime(850, now + duration * 0.5);
    bp.frequency.linearRampToValueAtTime(380, now + duration);
    bp.Q.setValueAtTime(3.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.45 * vel * customGain, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(this.destination);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    return noise;
  }

  // =========================================================================
  // 2. HUMAN VOICES & BEATBOX
  // =========================================================================

  triggerVocalChant(chantType = "yeah", pitchMidi = 60, velocity = 95, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const baseFreq = 440 * Math.pow(2, (pitchMidi - 69) / 12);

    // Realistic human vocal formants (Peterson & Barney standard human vowel acoustics):
    // "yeah": glide from /j/ (F1: 280, F2: 2200, F3: 2800) to /æ/ (F1: 660, F2: 1720, F3: 2410)
    // "whoa": /oʊ/ (F1: 450, F2: 850, F3: 2400)
    // "hey": glide from /h/ (breath aspiration) to /eɪ/ (F1: 530, F2: 1840, F3: 2480)
    const formants = chantType === "whoa" 
      ? [460, 880, 2400] 
      : (chantType === "hey" ? [540, 1820, 2500] : [640, 1950, 2650]);

    // 1. Dual Vocal Cord Glottal Source (Sine fundamental + rounded warm triangle/pulse - NEVER buzzy raw sawtooth)
    const cord1 = ctx.createOscillator();
    const cord2 = ctx.createOscillator();
    cord1.type = "sine";
    cord2.type = "triangle";
    cord1.frequency.setValueAtTime(baseFreq, now);
    cord2.frequency.setValueAtTime(baseFreq * 1.002, now); // subtle vocal chorusing

    // Natural human pitch inflection (expressive vocal scoop)
    if (chantType === "yeah") {
      cord1.frequency.setValueAtTime(baseFreq * 0.92, now);
      cord1.frequency.linearRampToValueAtTime(baseFreq * 1.06, now + 0.08);
      cord1.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, now + 0.40);

      cord2.frequency.setValueAtTime(baseFreq * 0.92, now);
      cord2.frequency.linearRampToValueAtTime(baseFreq * 1.06, now + 0.08);
      cord2.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, now + 0.40);
    } else if (chantType === "whoa") {
      cord1.frequency.setValueAtTime(baseFreq * 0.94, now);
      cord1.frequency.linearRampToValueAtTime(baseFreq * 1.12, now + 0.14);
      cord1.frequency.exponentialRampToValueAtTime(baseFreq * 0.88, now + 0.50);

      cord2.frequency.setValueAtTime(baseFreq * 0.94, now);
      cord2.frequency.linearRampToValueAtTime(baseFreq * 1.12, now + 0.14);
      cord2.frequency.exponentialRampToValueAtTime(baseFreq * 0.88, now + 0.50);
    } else {
      // "hey" punchy upbeat shout
      cord1.frequency.setValueAtTime(baseFreq * 0.96, now);
      cord1.frequency.linearRampToValueAtTime(baseFreq * 1.08, now + 0.05);
      cord1.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + 0.32);

      cord2.frequency.setValueAtTime(baseFreq * 0.96, now);
      cord2.frequency.linearRampToValueAtTime(baseFreq * 1.08, now + 0.05);
      cord2.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + 0.32);
    }

    // 2. Vocal Air / Breath Noise (adds authentic human throat texture & removes artificial synth buzz)
    const breath = this.createNoiseSource(false);
    const breathFilt = ctx.createBiquadFilter();
    breathFilt.type = "bandpass";
    breathFilt.frequency.setValueAtTime(1400, now);
    breathFilt.Q.value = 1.2;
    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.001, now);
    breathGain.gain.linearRampToValueAtTime(0.08 * vel * customGain, now + 0.03);
    breathGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    breath.connect(breathFilt);
    breathFilt.connect(breathGain);

    // 3. Multi-formant Vocal Resonators (F1, F2, F3)
    const f1 = ctx.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.setValueAtTime(formants[0], now);
    f1.Q.value = 4.5;

    const f2 = ctx.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.setValueAtTime(formants[1], now);
    f2.Q.value = 4.8;

    const f3 = ctx.createBiquadFilter();
    f3.type = "bandpass";
    f3.frequency.setValueAtTime(formants[2], now);
    f3.Q.value = 5.0;

    // Mix vocal cords into formants
    const cordMix = ctx.createGain();
    cordMix.gain.value = 0.55;
    cord1.connect(cordMix);
    cord2.connect(cordMix);

    cordMix.connect(f1);
    cordMix.connect(f2);
    cordMix.connect(f3);

    // 4. Output Envelope & Saturation (warm human throat bloom)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(0.65 * vel * customGain, now + 0.04);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    f1.connect(masterGain);
    f2.connect(masterGain);
    f3.connect(masterGain);
    breathGain.connect(masterGain);

    masterGain.connect(this.destination);

    cord1.start(now);
    cord2.start(now);
    breath.start(now);
    cord1.stop(now + 0.52);
    cord2.stop(now + 0.52);
    breath.stop(now + 0.52);
    return cord1;
  }

  triggerBeatbox(type = "kick", velocity = 100, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    if (type === "kick") {
      // Vocal "Pf-boom" kick
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.85 * vel * customGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.destination);
      osc.start(now);
      osc.stop(now + 0.30);
      return osc;
    } else if (type === "snare") {
      // Vocal "Kchhh" snare
      const noise = this.createNoiseSource(false);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2400;
      bp.Q.value = 1.8;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.70 * vel * customGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      noise.connect(bp);
      bp.connect(gain);
      gain.connect(this.destination);
      noise.start(now);
      noise.stop(now + 0.25);
      return noise;
    } else {
      // Vocal "Ts" hi-hat
      const noise = this.createNoiseSource(false);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6500;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.50 * vel * customGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noise.connect(hp);
      hp.connect(gain);
      gain.connect(this.destination);
      noise.start(now);
      noise.stop(now + 0.10);
      return noise;
    }
  }

  // =========================================================================
  // 3. WEIRD & SCI-FI FX
  // =========================================================================

  triggerLaserZap(velocity = 100, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.14);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4500, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.14);
    filter.Q.value = 4.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.60 * vel * customGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);

    osc.start(now);
    osc.stop(now + 0.16);
    return osc;
  }

  triggerAlienDrone(pitchMidi = 48, velocity = 95, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const freq = 440 * Math.pow(2, (pitchMidi - 69) / 12);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 1.503, now);

    // Subtle metallic LFO
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 3.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 14;
    lfo.connect(osc1.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq * 2.5, now);
    filter.Q.value = 6.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.50 * vel * customGain, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);

    osc1.start(now);
    osc2.start(now);
    lfo.start(now);
    osc1.stop(now + 3.1);
    osc2.stop(now + 3.1);
    lfo.stop(now + 3.1);

    return { osc1, osc2 };
  }

  triggerBionicGlitch(velocity = 95, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    const osc = ctx.createOscillator();
    osc.type = "square";
    // Stepped rapid frequency sequence
    const steps = [1200, 480, 2400, 850, 3600, 320, 1800, 150];
    steps.forEach((f, idx) => {
      osc.frequency.setValueAtTime(f, now + idx * 0.025);
    });

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45 * vel * customGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.25);
    return osc;
  }

  // =========================================================================
  // 4. DJ & CINEMATIC FX
  // =========================================================================

  triggerVinylScratch(velocity = 100, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    // Scratch forward and back motion
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.13);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.19);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.25);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1600;
    bp.Q.value = 3.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65 * vel * customGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);

    osc.connect(bp);
    bp.connect(gain);
    gain.connect(this.destination);

    osc.start(now);
    osc.stop(now + 0.28);
    return osc;
  }

  triggerTapeStop(velocity = 100, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.65);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3200, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.65);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.60 * vel * customGain, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.68);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);

    osc.start(now);
    osc.stop(now + 0.70);
    return osc;
  }

  triggerSubBoom(velocity = 105, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.8);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.95 * vel * customGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    osc.connect(gain);
    gain.connect(this.destination);

    osc.start(now);
    osc.stop(now + 2.3);
    return osc;
  }

  triggerReggaeAirhorn(velocity = 100, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    // Classic dancehall dual-square tone (375Hz & 425Hz) with staccato beeps
    const beeps = [0, 0.12, 0.24, 0.40];
    const oscs = [];

    beeps.forEach(delay => {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = "square";
      o2.type = "sawtooth";
      o1.frequency.value = 380;
      o2.frequency.value = 425;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now + delay);
      g.gain.linearRampToValueAtTime(0.50 * vel * customGain, now + delay + 0.01);
      g.gain.linearRampToValueAtTime(0.001, now + delay + 0.08);

      o1.connect(g);
      o2.connect(g);
      g.connect(this.destination);

      o1.start(now + delay);
      o2.start(now + delay);
      o1.stop(now + delay + 0.09);
      o2.stop(now + delay + 0.09);
      oscs.push(o1, o2);
    });

    return oscs;
  }

  // =========================================================================
  // 5. PERCUSSIONS & DRUM KITS (TR-808 & World Percussion)
  // =========================================================================

  trigger808Kick(velocity = 100, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.45);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0 * vel * customGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(this.destination);

    osc.start(now);
    osc.stop(now + 0.56);
    return osc;
  }

  trigger808Snare(velocity = 95, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    // Tone body
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.55 * vel * customGain, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    // Snappy noise
    const noise = this.createNoiseSource(false);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1400;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.70 * vel * customGain, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(oscGain);
    oscGain.connect(this.destination);
    noise.connect(hp);
    hp.connect(noiseGain);
    noiseGain.connect(this.destination);

    osc.start(now);
    osc.stop(now + 0.15);
    noise.start(now);
    noise.stop(now + 0.24);

    return { osc, noise };
  }

  trigger808Hat(closed = true, velocity = 90, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dur = closed ? 0.06 : 0.40;

    const noise = this.createNoiseSource(false);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 8500;
    bp.Q.value = 2.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55 * vel * customGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(this.destination);

    noise.start(now);
    noise.stop(now + dur + 0.02);
    return noise;
  }

  triggerConga(high = true, velocity = 95, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const freq = high ? 290 : 190;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * 1.4, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.03);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.80 * vel * customGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.destination);

    osc.start(now);
    osc.stop(now + 0.26);
    return osc;
  }

  triggerShaker(velocity = 85, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    const noise = this.createNoiseSource(false);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.40 * vel * customGain, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.destination);

    noise.start(now);
    noise.stop(now + 0.10);
    return noise;
  }

  triggerCowbell(velocity = 95, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = "square";
    o2.type = "square";
    o1.frequency.value = 587; // D5
    o2.frequency.value = 845; // Ab5

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 720;
    bp.Q.value = 1.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65 * vel * customGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    o1.connect(bp);
    o2.connect(bp);
    bp.connect(gain);
    gain.connect(this.destination);

    o1.start(now);
    o2.start(now);
    o1.stop(now + 0.30);
    o2.stop(now + 0.30);
    return { o1, o2 };
  }

  // =========================================================================
  // 7. AUTHENTIC ACOUSTIC KALIMBA (AFRICAN THUMB PIANO / MBIRA)
  // Physical model of clamped spring-steel tines on a hollow resonant wooden soundbox.
  // Combines thumb flesh impact, hollow box cavity resonance, pure fundamental sine bell,
  // and authentic inharmonic cantilever tine overtones (2.756x and 5.404x f0).
  // =========================================================================

  triggerKalimba(midiNote = 60, velocity = 95, customGain = 1.0) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.0, velocity / 127));
    const f0 = 440 * Math.pow(2, (midiNote - 69) / 12);

    // 1. Tine Mode 1 (Fundamental tone): Pure, rounded, bell-like sine
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(f0, now);

    const gain1 = ctx.createGain();
    const decay1 = 1.6 + vel * 0.8;
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.75 * vel * customGain, now + 0.003); // ultra-fast attack
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + decay1);

    // 2. Tine Mode 2 (Signature Inharmonic Cantilever Overtone ~ 2.756x f0):
    // Authentic thumb-piano metallic chime overtone
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(f0 * 2.756, now);

    const gain2 = ctx.createGain();
    const decay2 = 0.40 + vel * 0.25;
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(0.35 * vel * customGain, now + 0.002);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + decay2);

    // 3. Tine Mode 3 (High metallic strike shimmer ~ 5.404x f0):
    const osc3 = ctx.createOscillator();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(f0 * 5.404, now);

    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0.0001, now);
    gain3.gain.linearRampToValueAtTime(0.18 * vel * customGain, now + 0.001);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.08); // short metallic ping

    // 4. Thumb Flesh & Wooden Soundbox Impact Transient:
    // Low woody thump around 220Hz -> 80Hz + flesh tap click
    const woodThump = ctx.createOscillator();
    woodThump.type = "sine";
    woodThump.frequency.setValueAtTime(240, now);
    woodThump.frequency.exponentialRampToValueAtTime(80, now + 0.045);

    const woodGain = ctx.createGain();
    woodGain.gain.setValueAtTime(0.0001, now);
    woodGain.gain.linearRampToValueAtTime(0.32 * vel * customGain, now + 0.002);
    woodGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    // Flesh tap click (bandpassed transient at 3.6kHz)
    const clickNoise = this.createNoiseSource(false);
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = "bandpass";
    clickFilter.frequency.setValueAtTime(3600, now);
    clickFilter.Q.setValueAtTime(3.0, now);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.linearRampToValueAtTime(0.24 * vel * customGain, now + 0.001);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    // 5. Wooden Body Resonator Filter (Acoustic cavity boost at 440Hz)
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = "peaking";
    bodyFilter.frequency.setValueAtTime(440, now);
    bodyFilter.Q.setValueAtTime(1.8, now);
    bodyFilter.gain.setValueAtTime(4.5, now);

    // Audio routing
    osc1.connect(gain1);
    gain1.connect(bodyFilter);

    osc2.connect(gain2);
    gain2.connect(bodyFilter);

    osc3.connect(gain3);
    gain3.connect(bodyFilter);

    woodThump.connect(woodGain);
    woodGain.connect(bodyFilter);

    clickNoise.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(bodyFilter);

    bodyFilter.connect(this.destination);

    // Trigger
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    woodThump.start(now);
    clickNoise.start(now);

    const stopTime = now + decay1 + 0.1;
    osc1.stop(stopTime);
    osc2.stop(now + decay2 + 0.05);
    osc3.stop(now + 0.1);
    woodThump.stop(now + 0.06);
    clickNoise.stop(now + 0.03);

    return {
      stopNote: (relTime = ctx.currentTime) => {
        try {
          gain1.gain.cancelScheduledValues(relTime);
          gain1.gain.setTargetAtTime(0, relTime, 0.08); // natural finger mute
          osc1.stop(relTime + 0.15);
        } catch (e) {}
      }
    };
  }

  // =========================================================================
  // EXPANDED 1. NATURE SOUNDS
  // =========================================================================

  triggerCampfire(duration = 4.5, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    // Fire low warmth rumble
    const noise = this.createNoiseSource(true);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(320, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.35 * vel * customGain, now + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(lp);
    lp.connect(g);
    g.connect(dest);
    noise.start(now);
    noise.stop(now + duration + 0.1);

    // Random timber crackle pops
    const numPops = 8;
    for (let i = 0; i < numPops; i++) {
      const popTime = now + 0.2 + Math.random() * (duration - 0.8);
      const popOsc = ctx.createOscillator();
      popOsc.type = "sine";
      popOsc.frequency.setValueAtTime(900 + Math.random() * 1800, popTime);
      popOsc.frequency.exponentialRampToValueAtTime(120, popTime + 0.015);
      const popGain = ctx.createGain();
      popGain.gain.setValueAtTime(0.001, popTime);
      popGain.gain.linearRampToValueAtTime((0.15 + Math.random() * 0.2) * vel * customGain, popTime + 0.002);
      popGain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.02);
      popOsc.connect(popGain);
      popGain.connect(dest);
      popOsc.start(popTime);
      popOsc.stop(popTime + 0.03);
    }
    return noise;
  }

  triggerStream(duration = 4.5, velocity = 90, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const noise = this.createNoiseSource(true);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1400, now);
    bp.Q.setValueAtTime(1.2, now);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.7, now);
    const lfoG = ctx.createGain();
    lfoG.gain.value = 400;
    lfo.connect(lfoG);
    lfoG.connect(bp.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.40 * vel * customGain, now + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(bp);
    bp.connect(g);
    g.connect(dest);

    lfo.start(now);
    noise.start(now);
    lfo.stop(now + duration + 0.1);
    noise.stop(now + duration + 0.1);
    return noise;
  }

  triggerCrickets(duration = 4.0, velocity = 90, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(4800, now);

    const amLfo = ctx.createOscillator();
    amLfo.type = "square";
    amLfo.frequency.setValueAtTime(16, now); // rapid chirp modulation

    const amGain = ctx.createGain();
    amGain.gain.value = 0.5;
    amLfo.connect(amGain);

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0.001, now);
    mainGain.gain.linearRampToValueAtTime(0.30 * vel * customGain, now + 0.2);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(mainGain);
    mainGain.connect(dest);

    osc.start(now);
    amLfo.start(now);
    osc.stop(now + duration + 0.1);
    amLfo.stop(now + duration + 0.1);
    return osc;
  }

  triggerWaterfall(duration = 5.0, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const noise = this.createNoiseSource(true);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1800, now);

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(140, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.50 * vel * customGain, now + 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(dest);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    return noise;
  }

  // =========================================================================
  // EXPANDED 2. HUMAN VOX & CHOIR
  // =========================================================================

  triggerOhYeah(pitchMidi = 60, velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const baseFreq = 440 * Math.pow(2, (pitchMidi - 69) / 12);
    const dest = destNode || this.destination;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = "triangle";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(baseFreq * 0.90, now);
    osc1.frequency.linearRampToValueAtTime(baseFreq * 1.15, now + 0.18);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.88, now + 0.65);

    osc2.frequency.setValueAtTime(baseFreq * 0.90, now);
    osc2.frequency.linearRampToValueAtTime(baseFreq * 1.15, now + 0.18);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.88, now + 0.65);

    const f1 = ctx.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.setValueAtTime(580, now);
    f1.Q.setValueAtTime(4.0, now);

    const f2 = ctx.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.setValueAtTime(1850, now);
    f2.Q.setValueAtTime(3.5, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.80 * vel * customGain, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.70);

    osc1.connect(f1);
    osc2.connect(f2);
    f1.connect(g);
    f2.connect(g);
    g.connect(dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.75);
    osc2.stop(now + 0.75);
    return osc1;
  }

  triggerCrowdCheer(duration = 4.0, velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const noise = this.createNoiseSource(true);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1200, now);
    bp.frequency.linearRampToValueAtTime(2400, now + 1.2);
    bp.frequency.linearRampToValueAtTime(1500, now + duration);
    bp.Q.setValueAtTime(1.0, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.60 * vel * customGain, now + 0.8);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(bp);
    bp.connect(g);
    g.connect(dest);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    return noise;
  }

  triggerApplause(duration = 3.8, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const noise = this.createNoiseSource(true);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(800, now);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(6500, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.55 * vel * customGain, now + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(dest);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    return noise;
  }

  triggerWhisper(duration = 3.5, velocity = 90, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const noise = this.createNoiseSource(true);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2200, now);
    bp.Q.setValueAtTime(3.0, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.40 * vel * customGain, now + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(bp);
    bp.connect(g);
    g.connect(dest);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    return noise;
  }

  triggerVocalHum(pitchMidi = 48, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const baseFreq = 440 * Math.pow(2, (pitchMidi - 69) / 12);
    const dest = destNode || this.destination;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq, now);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(420, now);
    lp.Q.setValueAtTime(2.5, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.70 * vel * customGain, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    osc.connect(lp);
    lp.connect(g);
    g.connect(dest);

    osc.start(now);
    osc.stop(now + 2.1);
    return osc;
  }

  // =========================================================================
  // EXPANDED 3. WEIRD & SCI-FI FX
  // =========================================================================

  triggerWarpDrive(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.exponentialRampToValueAtTime(3200, now + 2.2);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(200, now);
    bp.frequency.exponentialRampToValueAtTime(4500, now + 2.2);
    bp.Q.setValueAtTime(4.0, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.75 * vel * customGain, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    osc.connect(bp);
    bp.connect(g);
    g.connect(dest);

    osc.start(now);
    osc.stop(now + 2.6);
    return osc;
  }

  triggerRobotTelemetry(velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const osc = ctx.createOscillator();
    osc.type = "square";
    // Stepped FM frequencies
    const freqs = [1200, 1800, 950, 2400, 1400, 3100, 1100];
    let t = now;
    freqs.forEach(f => {
      osc.frequency.setValueAtTime(f, t);
      t += 0.055;
    });

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.45 * vel * customGain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(g);
    g.connect(dest);

    osc.start(now);
    osc.stop(now + 0.48);
    return osc;
  }

  triggerPlasmaBlaster(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(2800, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(6000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.35);
    filter.Q.setValueAtTime(5.0, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.85 * vel * customGain, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.40);

    osc.connect(filter);
    filter.connect(g);
    g.connect(dest);

    osc.start(now);
    osc.stop(now + 0.42);
    return osc;
  }

  triggerCyberSweep(velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(5200, now + 4.0);

    const flt = ctx.createBiquadFilter();
    flt.type = "bandpass";
    flt.frequency.setValueAtTime(250, now);
    flt.frequency.exponentialRampToValueAtTime(8000, now + 4.0);
    flt.Q.setValueAtTime(4.5, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.70 * vel * customGain, now + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, now + 4.2);

    osc.connect(flt);
    flt.connect(g);
    g.connect(dest);

    osc.start(now);
    osc.stop(now + 4.3);
    return osc;
  }

  triggerSubResonator(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(48, now);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(4.5, now);
    const lfoG = ctx.createGain();
    lfoG.gain.value = 12;
    lfo.connect(lfoG);
    lfoG.connect(osc.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.90 * vel * customGain, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    osc.connect(g);
    g.connect(dest);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + 2.6);
    lfo.stop(now + 2.6);
    return osc;
  }

  // =========================================================================
  // EXPANDED 4. DJ & CINEMATIC FX
  // =========================================================================

  triggerCinemaBraam(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc2.type = "square";
    osc1.frequency.setValueAtTime(55, now); // Low A1 braam
    osc2.frequency.setValueAtTime(55.4, now);

    const dist = ctx.createWaveShaper();
    const n = 512;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(2.5 * x);
    }
    dist.curve = curve;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1600, now);
    lp.frequency.exponentialRampToValueAtTime(400, now + 1.8);
    lp.Q.setValueAtTime(2.0, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.95 * vel * customGain, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    osc1.connect(dist);
    osc2.connect(dist);
    dist.connect(lp);
    lp.connect(g);
    g.connect(dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.3);
    osc2.stop(now + 2.3);
    return osc1;
  }

  triggerClubDownlifter(duration = 3.5, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const noise = this.createNoiseSource(true);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(8000, now);
    lp.frequency.exponentialRampToValueAtTime(150, now + duration);
    lp.Q.setValueAtTime(3.0, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.65 * vel * customGain, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(lp);
    lp.connect(g);
    g.connect(dest);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    return noise;
  }

  triggerReverseCymbal(duration = 2.2, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const noise = this.createNoiseSource(true);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(3200, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.70 * vel * customGain, now + duration);
    g.gain.linearRampToValueAtTime(0.001, now + duration + 0.05);

    noise.connect(hp);
    hp.connect(g);
    g.connect(dest);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    return noise;
  }

  trigger808SubDrop(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 1.6);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.95 * vel * customGain, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    osc.connect(g);
    g.connect(dest);

    osc.start(now);
    osc.stop(now + 1.9);
    return osc;
  }

  triggerVinylCrackle(duration = 4.0, velocity = 90, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const noise = this.createNoiseSource(true);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(3400, now);
    bp.Q.setValueAtTime(2.0, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.35 * vel * customGain, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(bp);
    bp.connect(g);
    g.connect(dest);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    return noise;
  }

  // =========================================================================
  // EXPANDED 5. DRUMS & PERCUSSIONS
  // =========================================================================

  trigger909Kick(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.06);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.95 * vel * customGain, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(g);
    g.connect(dest);

    osc.start(now);
    osc.stop(now + 0.38);
    return osc;
  }

  triggerStereoClap(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    // 3 rapid micro-bursts followed by diffuse noise tail
    const bursts = [0, 0.012, 0.024];
    bursts.forEach(offset => {
      const noise = this.createNoiseSource(false);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1400, now + offset);
      bp.Q.setValueAtTime(1.5, now + offset);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now + offset);
      g.gain.linearRampToValueAtTime(0.65 * vel * customGain, now + offset + 0.002);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.02);
      noise.connect(bp);
      bp.connect(g);
      g.connect(dest);
      noise.start(now + offset);
      noise.stop(now + offset + 0.03);
    });

    // Tail
    const tailNoise = this.createNoiseSource(false);
    const tailBp = ctx.createBiquadFilter();
    tailBp.type = "bandpass";
    tailBp.frequency.setValueAtTime(1200, now + 0.036);
    const tailG = ctx.createGain();
    tailG.gain.setValueAtTime(0.001, now + 0.036);
    tailG.gain.linearRampToValueAtTime(0.70 * vel * customGain, now + 0.04);
    tailG.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    tailNoise.connect(tailBp);
    tailBp.connect(tailG);
    tailG.connect(dest);
    tailNoise.start(now + 0.036);
    tailNoise.stop(now + 0.30);
    return tailNoise;
  }

  triggerBongos(isHigh = true, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    const baseFreq = isHigh ? 380 : 210;
    osc.frequency.setValueAtTime(baseFreq * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.03);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.80 * vel * customGain, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, now + (isHigh ? 0.12 : 0.20));

    osc.connect(g);
    g.connect(dest);

    osc.start(now);
    osc.stop(now + 0.22);
    return osc;
  }

  triggerTimbales(midiNote = 64, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const baseFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const dest = destNode || this.destination;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq * 2.0, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.025);

    const ringOsc = ctx.createOscillator();
    ringOsc.type = "triangle";
    ringOsc.frequency.setValueAtTime(baseFreq * 3.4, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.75 * vel * customGain, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(g);
    ringOsc.connect(g);
    g.connect(dest);

    osc.start(now);
    ringOsc.start(now);
    osc.stop(now + 0.38);
    ringOsc.stop(now + 0.38);
    return osc;
  }

  triggerCrashGong(velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const noise = this.createNoiseSource(false);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(2800, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.70 * vel * customGain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    noise.connect(hp);
    hp.connect(g);
    g.connect(dest);

    noise.start(now);
    noise.stop(now + 2.6);
    return noise;
  }

  triggerTaiko(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = destNode || this.destination;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.95 * vel * customGain, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.90);

    osc.connect(g);
    g.connect(dest);

    osc.start(now);
    osc.stop(now + 0.95);
    return osc;
  }

  isSfxInstrument(instId) {
    if (!instId) return false;
    return (
      instId === "kalimba" ||
      instId === "m1_kalimba" ||
      instId.startsWith("sy_") ||
      instId.startsWith("nature_") ||
      instId.startsWith("vox_") ||
      instId.startsWith("fx_") ||
      instId.startsWith("percussion_") ||
      instId.startsWith("tr909_") ||
      instId === "tr808_kit" ||
      instId === "tr909_kit" ||
      instId === "drums1" ||
      instId === "m1_drums"
    );
  }

  playSfxNote(instId, midiNote = 60, velocity = 95, customGain = 1.0, destNode = null) {
    if (instId && instId.startsWith("sy_")) {
      return synthesizerYouEngine.trigger(instId, velocity, customGain, destNode, midiNote);
    }

    switch (instId) {
      // 0. Kalimba / Mbira Thumb Piano
      case "kalimba":
      case "m1_kalimba":
        return this.triggerKalimba(midiNote, velocity, customGain);

      // 1. Nature Sounds
      case "nature_thunder":
        return this.triggerThunder(velocity, customGain);
      case "nature_rain":
        return this.triggerRain(3.5, velocity, customGain);
      case "nature_ocean":
        return this.triggerOceanWave(4.5, velocity, customGain);
      case "nature_birds":
        return this.triggerBirdChirp(midiNote, velocity, customGain);
      case "nature_wind":
        return this.triggerWind(3.5, velocity, customGain);
      case "nature_fire":
        return this.triggerCampfire(4.5, velocity, customGain, destNode);
      case "nature_stream":
        return this.triggerStream(4.5, velocity, customGain, destNode);
      case "nature_crickets":
        return this.triggerCrickets(4.0, velocity, customGain, destNode);
      case "nature_waterfall":
        return this.triggerWaterfall(5.0, velocity, customGain, destNode);

      // 2. Human Vox
      case "vox_yeah":
        return this.triggerVocalChant("yeah", midiNote, velocity, customGain);
      case "vox_whoa":
        return this.triggerVocalChant("whoa", midiNote, velocity, customGain);
      case "vox_hey":
        return this.triggerVocalChant("hey", midiNote, velocity, customGain);
      case "vox_ohyeah":
        return this.triggerOhYeah(midiNote, velocity, customGain, destNode);
      case "vox_crowd_cheer":
        return this.triggerCrowdCheer(4.0, velocity, customGain, destNode);
      case "vox_applause":
        return this.triggerApplause(3.8, velocity, customGain, destNode);
      case "vox_whisper":
        return this.triggerWhisper(3.5, velocity, customGain, destNode);
      case "vox_hum":
        return this.triggerVocalHum(midiNote, velocity, customGain, destNode);
      case "vox_beatbox": {
        const mod = midiNote % 3;
        if (mod === 0) return this.triggerBeatbox("kick", velocity, customGain);
        if (mod === 1) return this.triggerBeatbox("snare", velocity, customGain);
        return this.triggerBeatbox("hat", velocity, customGain);
      }

      // 3. Weird Sci-Fi FX
      case "fx_laser":
        return this.triggerLaserZap(velocity, customGain);
      case "fx_alien":
        return this.triggerAlienDrone(midiNote, velocity, customGain);
      case "fx_bionic":
        return this.triggerBionicGlitch(velocity, customGain);
      case "fx_warpdrive":
        return this.triggerWarpDrive(velocity, customGain, destNode);
      case "fx_robot":
        return this.triggerRobotTelemetry(velocity, customGain, destNode);
      case "fx_plasma":
        return this.triggerPlasmaBlaster(velocity, customGain, destNode);
      case "fx_cyber_sweep":
        return this.triggerCyberSweep(velocity, customGain, destNode);
      case "fx_sub_resonator":
        return this.triggerSubResonator(velocity, customGain, destNode);

      // 4. DJ & Cinematic FX
      case "fx_scratch":
        return this.triggerVinylScratch(velocity, customGain);
      case "fx_tapestop":
        return this.triggerTapeStop(velocity, customGain);
      case "fx_subboom":
        return this.triggerSubBoom(velocity, customGain);
      case "fx_airhorn":
        return this.triggerReggaeAirhorn(velocity, customGain);
      case "fx_cinema_braam":
        return this.triggerCinemaBraam(velocity, customGain, destNode);
      case "fx_downlifter":
        return this.triggerClubDownlifter(3.5, velocity, customGain, destNode);
      case "fx_rev_cymbal":
        return this.triggerReverseCymbal(2.2, velocity, customGain, destNode);
      case "fx_sub_drop":
        return this.trigger808SubDrop(velocity, customGain, destNode);
      case "fx_vinyl_crackle":
        return this.triggerVinylCrackle(4.0, velocity, customGain, destNode);

      // 5. Percussions & Drum Kit
      case "tr808_kit":
      case "drums1":
      case "m1_drums": {
        if (midiNote === 35 || midiNote === 36 || midiNote % 12 === 0) {
          return this.trigger808Kick(velocity, customGain);
        } else if (midiNote === 38 || midiNote === 40 || midiNote % 12 === 2) {
          return this.trigger808Snare(velocity, customGain);
        } else if (midiNote === 42 || midiNote % 12 === 6) {
          return this.trigger808Hat(true, velocity, customGain);
        } else if (midiNote === 46 || midiNote % 12 === 10) {
          return this.trigger808Hat(false, velocity, customGain);
        } else if (midiNote === 56 || midiNote % 12 === 8) {
          return this.triggerCowbell(velocity, customGain);
        } else if (midiNote === 39 || midiNote % 12 === 3) {
          return this.triggerShaker(velocity, customGain);
        } else {
          return this.triggerConga(midiNote >= 60, velocity, customGain);
        }
      }
      case "tr909_kit":
        return this.trigger909Kick(velocity, customGain, destNode);
      case "percussion_conga":
        return this.triggerConga(midiNote >= 60, velocity, customGain);
      case "percussion_shaker":
        return this.triggerShaker(velocity, customGain);
      case "percussion_cowbell":
        return this.triggerCowbell(velocity, customGain);
      case "percussion_clap":
        return this.triggerStereoClap(velocity, customGain, destNode);
      case "percussion_bongo":
        return this.triggerBongos(midiNote >= 60, velocity, customGain, destNode);
      case "percussion_timbales":
        return this.triggerTimbales(midiNote, velocity, customGain, destNode);
      case "percussion_crash":
        return this.triggerCrashGong(velocity, customGain, destNode);
      case "percussion_taiko":
        return this.triggerTaiko(velocity, customGain, destNode);

      default:
        return null;
    }
  }
}

