/**
 * MidiKey Elite - Professional SFX, Nature, Vox & Percussion Synthesis Engine
 * Generates realistic nature ambience, human vocal expressions, sci-fi glitches,
 * DJ/cinematic sound effects, and analog/acoustic drum percussion using pure Web Audio DSP.
 */

import { synthesizerYouEngine } from "./synthesizer-you-samples.js";
import { audioCore } from "./audio-core.js";

export class SfxSoundGenerator {
  constructor(ctx, destinationNode) {
    this.ctx = ctx;
    this.destination = destinationNode;
    this.noiseBuffer = null;
    this._longFx = new Set();
    this.initNoiseBuffer();
  }

  trackSfx(nodes, endsInSeconds = 30) {
    if (!nodes || !nodes.length) return;
    const unit = { nodes };
    this._longFx.add(unit);
    setTimeout(() => this._longFx.delete(unit), (endsInSeconds + 0.5) * 1000);
  }

  stopAll() {
    const now = this.ctx.currentTime;
    this._longFx.forEach(unit => {
      unit.nodes.forEach(node => {
        try {
          if (node && typeof node.stop === "function") {
            try { node.stop(now + 0.03); } catch (e) {}
          }
          if (node && node.gain && typeof node.gain.cancelScheduledValues === "function") {
            try {
              node.gain.cancelScheduledValues(now);
              node.gain.setTargetAtTime(0, now, 0.03);
            } catch (e) {}
          }
        } catch (e) {}
      });
    });
    this._longFx.clear();
  }

  getDest(destNode = null) {
    if (destNode && typeof destNode.connect === "function") return destNode;
    if (this.destination && typeof this.destination.connect === "function") return this.destination;
    if (audioCore.masterGain && typeof audioCore.masterGain.connect === "function") return audioCore.masterGain;
    if (this.ctx && this.ctx.destination) return this.ctx.destination;
    if (audioCore.ctx && audioCore.ctx.destination) return audioCore.ctx.destination;
    return null;
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

  triggerThunder(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

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
    if (dest) oscGain.connect(dest);
    noise.connect(filter);
    filter.connect(noiseGain);
    if (dest) noiseGain.connect(dest);

    osc.start(now);
    osc.stop(now + 2.6);
    noise.start(now);
    noise.stop(now + 3.3);

    return { osc, noise };
  }

  triggerRain(duration = 4.0, velocity = 90, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

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
    if (dest) gain.connect(dest);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    this.trackSfx([noise, gain], duration);
    return noise;
  }

  triggerOceanWave(duration = 5.0, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

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
    if (dest) gain.connect(dest);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    this.trackSfx([noise, gain], duration);
    return noise;
  }

  triggerBirdChirp(pitchMidi = 72, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);
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
    if (dest) gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.26);
    return osc;
  }

  triggerWind(duration = 4.0, velocity = 90, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

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
    if (dest) gain.connect(dest);

    noise.start(now);
    noise.stop(now + duration + 0.1);
    this.trackSfx([noise, gain], duration);
    return noise;
  }

  // =========================================================================
  // 2. HUMAN VOICES & BEATBOX
  // =========================================================================

  triggerVocalChant(chantType = "yeah", pitchMidi = 60, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);
    const baseFreq = 440 * Math.pow(2, (pitchMidi - 69) / 12);

    const formants = chantType === "whoa" 
      ? [460, 880, 2400] 
      : (chantType === "hey" ? [540, 1820, 2500] : [640, 1950, 2650]);

    const cord1 = ctx.createOscillator();
    const cord2 = ctx.createOscillator();
    cord1.type = "sine";
    cord2.type = "triangle";
    cord1.frequency.setValueAtTime(baseFreq, now);
    cord2.frequency.setValueAtTime(baseFreq * 1.002, now);

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
      cord1.frequency.setValueAtTime(baseFreq * 0.96, now);
      cord1.frequency.linearRampToValueAtTime(baseFreq * 1.08, now + 0.05);
      cord1.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + 0.32);

      cord2.frequency.setValueAtTime(baseFreq * 0.96, now);
      cord2.frequency.linearRampToValueAtTime(baseFreq * 1.08, now + 0.05);
      cord2.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + 0.32);
    }

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

    const cordMix = ctx.createGain();
    cordMix.gain.value = 0.55;
    cord1.connect(cordMix);
    cord2.connect(cordMix);

    cordMix.connect(f1);
    cordMix.connect(f2);
    cordMix.connect(f3);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(0.65 * vel * customGain, now + 0.04);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    f1.connect(masterGain);
    f2.connect(masterGain);
    f3.connect(masterGain);
    breathGain.connect(masterGain);

    if (dest) masterGain.connect(dest);

    cord1.start(now);
    cord2.start(now);
    breath.start(now);
    cord1.stop(now + 0.52);
    cord2.stop(now + 0.52);
    breath.stop(now + 0.52);
    return cord1;
  }

  triggerBeatbox(type = "kick", velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

    if (type === "kick") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.85 * vel * customGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      if (dest) gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.30);
      return osc;
    } else if (type === "snare") {
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
      if (dest) gain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.25);
      return noise;
    } else {
      const noise = this.createNoiseSource(false);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6500;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.50 * vel * customGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noise.connect(hp);
      hp.connect(gain);
      if (dest) gain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.10);
      return noise;
    }
  }

  // =========================================================================
  // 3. WEIRD & SCI-FI FX
  // =========================================================================

  triggerLaserZap(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

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
    if (dest) gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.16);
    return osc;
  }

  triggerAlienDrone(pitchMidi = 48, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);
    const freq = 440 * Math.pow(2, (pitchMidi - 69) / 12);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 1.503, now);

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
    if (dest) gain.connect(dest);

    osc1.start(now);
    osc2.start(now);
    lfo.start(now);
    osc1.stop(now + 3.1);
    osc2.stop(now + 3.1);
    lfo.stop(now + 3.1);
    this.trackSfx([osc1, osc2, lfo, gain], 3.2);

    return { osc1, osc2 };
  }

  triggerBionicGlitch(velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

    const osc = ctx.createOscillator();
    osc.type = "square";
    const steps = [1200, 480, 2400, 850, 3600, 320, 1800, 150];
    steps.forEach((f, idx) => {
      osc.frequency.setValueAtTime(f, now + idx * 0.025);
    });

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45 * vel * customGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    if (dest) gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.25);
    return osc;
  }

  // =========================================================================
  // 4. DJ & CINEMATIC FX
  // =========================================================================

  triggerVinylScratch(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
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
    if (dest) gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.28);
    return osc;
  }

  triggerTapeStop(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

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
    if (dest) gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.70);
    return osc;
  }

  triggerSubBoom(velocity = 105, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.8);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.95 * vel * customGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    osc.connect(gain);
    if (dest) gain.connect(dest);

    osc.start(now);
    osc.stop(now + 2.3);
    return osc;
  }

  triggerReggaeAirhorn(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

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
      if (dest) g.connect(dest);

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

  trigger808Kick(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.45);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0 * vel * customGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    if (dest) gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.56);
    return osc;
  }

  trigger808Snare(velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.55 * vel * customGain, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    const noise = this.createNoiseSource(false);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1400;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.70 * vel * customGain, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(oscGain);
    if (dest) oscGain.connect(dest);
    noise.connect(hp);
    hp.connect(noiseGain);
    if (dest) noiseGain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.15);
    noise.start(now);
    noise.stop(now + 0.24);

    return { osc, noise };
  }

  trigger808Hat(closed = true, velocity = 90, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);
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
    if (dest) gain.connect(dest);

    noise.start(now);
    noise.stop(now + dur + 0.02);
    return noise;
  }

  triggerConga(high = true, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);
    const freq = high ? 290 : 190;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * 1.4, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.03);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.80 * vel * customGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    if (dest) gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.26);
    return osc;
  }

  triggerShaker(velocity = 85, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

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
    if (dest) gain.connect(dest);

    noise.start(now);
    noise.stop(now + 0.10);
    return noise;
  }

  triggerCowbell(velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = "square";
    o2.type = "square";
    o1.frequency.value = 587;
    o2.frequency.value = 845;

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
    if (dest) gain.connect(dest);

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

  triggerKalimba(midiNote = 60, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.0, velocity / 127));
    const dest = this.getDest(destNode);
    const f0 = 440 * Math.pow(2, (midiNote - 69) / 12);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(f0, now);

    const gain1 = ctx.createGain();
    const decay1 = 1.6 + vel * 0.8;
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.75 * vel * customGain, now + 0.003);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + decay1);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(f0 * 2.756, now);

    const gain2 = ctx.createGain();
    const decay2 = 0.40 + vel * 0.25;
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(0.35 * vel * customGain, now + 0.002);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + decay2);

    const osc3 = ctx.createOscillator();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(f0 * 5.404, now);

    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0.0001, now);
    gain3.gain.linearRampToValueAtTime(0.18 * vel * customGain, now + 0.001);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    const woodThump = ctx.createOscillator();
    woodThump.type = "sine";
    woodThump.frequency.setValueAtTime(240, now);
    woodThump.frequency.exponentialRampToValueAtTime(80, now + 0.045);

    const woodGain = ctx.createGain();
    woodGain.gain.setValueAtTime(0.0001, now);
    woodGain.gain.linearRampToValueAtTime(0.32 * vel * customGain, now + 0.002);
    woodGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    const clickNoise = this.createNoiseSource(false);
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = "bandpass";
    clickFilter.frequency.setValueAtTime(3600, now);
    clickFilter.Q.setValueAtTime(3.0, now);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.linearRampToValueAtTime(0.24 * vel * customGain, now + 0.001);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = "peaking";
    bodyFilter.frequency.setValueAtTime(440, now);
    bodyFilter.Q.setValueAtTime(1.8, now);
    bodyFilter.gain.setValueAtTime(4.5, now);

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

    if (dest) bodyFilter.connect(dest);

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(4800, now);

    const amLfo = ctx.createOscillator();
    amLfo.type = "square";
    amLfo.frequency.setValueAtTime(16, now);

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

    const osc = ctx.createOscillator();
    osc.type = "square";
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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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

  triggerSubResonator(pitchMidi = 48, velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = Math.max(0.12, Math.min(1.0, velocity / 127));
    const dest = this.getDest(destNode);
    if (!dest) return null;

    // Musical pitch tracking based on keyboard MIDI note
    const rawFreq = 440 * Math.pow(2, (pitchMidi - 69) / 12);
    // Keep fundamental in rich resonant sub-bass to low-mid range (48Hz to 360Hz)
    const baseFreq = Math.max(48, Math.min(360, rawFreq > 280 ? rawFreq * 0.5 : rawFreq));

    // 1. Deep Sub Sine Fundamental (for subwoofer power)
    const subOsc = ctx.createOscillator();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(baseFreq, now);

    // 2. Resonant Atomic Harmonic Core: Detuned Sawtooth + Triangle for rich audible harmonics on laptops
    const harmOsc1 = ctx.createOscillator();
    harmOsc1.type = "sawtooth";
    harmOsc1.frequency.setValueAtTime(baseFreq, now);

    const harmOsc2 = ctx.createOscillator();
    harmOsc2.type = "triangle";
    harmOsc2.frequency.setValueAtTime(baseFreq * 1.008 + 1.2, now); // Atomic phase pulsation

    // 3. Sub-Atomic LFO Modulation (pulsating quantum flutter)
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(5.2, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(baseFreq * 0.08 + 6, now);
    lfo.connect(lfoGain);
    lfoGain.connect(harmOsc1.frequency);
    lfoGain.connect(harmOsc2.frequency);

    // 4. Swept Resonant Atomic Filter (Lowpass with pronounced Q peak)
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    const startCutoff = Math.min(8000, baseFreq * 7.5);
    const endCutoff = Math.max(180, baseFreq * 1.8);
    filter.frequency.setValueAtTime(startCutoff, now);
    filter.frequency.exponentialRampToValueAtTime(endCutoff, now + 1.4);
    filter.Q.setValueAtTime(6.0, now);

    // 5. Soft-Clip Saturation for harmonic punch and warmth
    const saturator = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = (Math.PI + 2.5) * x / (Math.PI + 2.5 * Math.abs(x));
    }
    saturator.curve = curve;
    saturator.oversample = "2x";

    // 6. Gain Envelopes
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.95 * vel * customGain, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);

    const harmGain = ctx.createGain();
    harmGain.gain.setValueAtTime(0.001, now);
    harmGain.gain.linearRampToValueAtTime(0.75 * vel * customGain, now + 0.025);
    harmGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    // Routing
    subOsc.connect(subGain);
    subGain.connect(dest);

    harmOsc1.connect(filter);
    harmOsc2.connect(filter);
    filter.connect(saturator);
    saturator.connect(harmGain);
    harmGain.connect(dest);

    // Start & Stop
    subOsc.start(now);
    harmOsc1.start(now);
    harmOsc2.start(now);
    lfo.start(now);

    const stopTime = now + 2.9;
    subOsc.stop(stopTime);
    harmOsc1.stop(stopTime);
    harmOsc2.stop(stopTime);
    lfo.stop(stopTime);

    this.trackSfx([subOsc, harmOsc1, harmOsc2, lfo, subGain, harmGain], 3.0);
    return harmOsc1;
  }

  // =========================================================================
  // EXPANDED 4. DJ & CINEMATIC FX
  // =========================================================================

  triggerCinemaBraam(pitchMidi = 48, velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = Math.max(0.2, Math.min(1.0, velocity / 127));
    const dest = this.getDest(destNode);
    if (!dest) return null;

    const rawFreq = 440 * Math.pow(2, (pitchMidi - 69) / 12);
    const baseFreq = Math.max(38, Math.min(140, rawFreq > 130 ? rawFreq * 0.25 : rawFreq));

    // Hans Zimmer Inception Braam: Triple detuned brass saws + sub-bass
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const sub = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc2.type = "sawtooth";
    sub.type = "sine";

    osc1.frequency.setValueAtTime(baseFreq, now);
    osc2.frequency.setValueAtTime(baseFreq * 1.012, now); // Detune
    sub.frequency.setValueAtTime(baseFreq * 0.5, now); // Sub rumble

    // Waveshaper drive for authentic brass rasp and bite
    const dist = ctx.createWaveShaper();
    const n = 512;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(3.0 * x);
    }
    dist.curve = curve;

    // Resonant brass lowpass filter sweep
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(3200, baseFreq * 24), now);
    lp.frequency.exponentialRampToValueAtTime(baseFreq * 3.5, now + 1.8);
    lp.Q.setValueAtTime(3.5, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(1.10 * vel * customGain, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    osc1.connect(dist);
    osc2.connect(dist);
    dist.connect(lp);
    lp.connect(g);
    sub.connect(g);
    g.connect(dest);

    osc1.start(now);
    osc2.start(now);
    sub.start(now);
    osc1.stop(now + 2.6);
    osc2.stop(now + 2.6);
    sub.stop(now + 2.6);

    this.trackSfx([osc1, osc2, sub, g], 2.8);
    return osc1;
  }

  // =========================================================================
  // 6. BELLS & CHIMES (Tubular Bells, Wind Chimes & Crystal Chimes)
  // =========================================================================

  triggerTubularBells(pitchMidi = 72, velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = Math.max(0.15, Math.min(1.0, velocity / 127));
    const dest = this.getDest(destNode);
    if (!dest) return null;

    const baseFreq = 440 * Math.pow(2, (pitchMidi - 69) / 12);
    // Acoustic Euler-Bernoulli flexural partial ratios for struck metal tube
    const partials = [
      { ratio: 1.000, gain: 0.85, decay: 4.2 },
      { ratio: 2.756, gain: 0.55, decay: 2.8 },
      { ratio: 5.404, gain: 0.35, decay: 1.9 },
      { ratio: 8.932, gain: 0.20, decay: 1.1 }
    ];

    const oscs = [];
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.90 * vel * customGain, now);

    // Initial strike transient: metallic mallet impact burst
    const noise = this.createNoiseSource(false);
    const strikeFlt = ctx.createBiquadFilter();
    strikeFlt.type = "highpass";
    strikeFlt.frequency.setValueAtTime(2800, now);
    const strikeGain = ctx.createGain();
    strikeGain.gain.setValueAtTime(0.50 * vel, now);
    strikeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    noise.connect(strikeFlt);
    strikeFlt.connect(strikeGain);
    strikeGain.connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.03);

    // Resonating tubular partials
    partials.forEach(p => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq * p.ratio, now);

      const pGain = ctx.createGain();
      pGain.gain.setValueAtTime(0.001, now);
      pGain.gain.linearRampToValueAtTime(p.gain, now + 0.003);
      pGain.exponentialRampToValueAtTime(0.0001, now + p.decay);

      osc.connect(pGain);
      pGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + p.decay + 0.1);
      oscs.push(osc);
    });

    masterGain.connect(dest);
    this.trackSfx([...oscs, masterGain], 4.5);
    return oscs[0];
  }

  triggerWindChimes(pitchMidi = 72, velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = Math.max(0.2, Math.min(1.0, velocity / 127));
    const dest = this.getDest(destNode);
    if (!dest) return null;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85 * vel * customGain, now);
    masterGain.connect(dest);

    // Cascading Mark Tree glissando: 12 cascading bar chime strikes
    const numBars = 12;
    const baseFreq = 2200 * Math.pow(2, (pitchMidi - 72) / 24);
    const oscs = [];

    for (let i = 0; i < numBars; i++) {
      const strikeTime = now + i * 0.038 + (Math.random() * 0.008);
      const freq = baseFreq * Math.pow(1.075, i);

      // Fundamental chime tine
      const o1 = ctx.createOscillator();
      o1.type = "sine";
      o1.frequency.setValueAtTime(freq, strikeTime);

      // Inharmonic sparkle overtone
      const o2 = ctx.createOscillator();
      o2.type = "triangle";
      o2.frequency.setValueAtTime(freq * 2.76, strikeTime);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.setValueAtTime(0.0001, strikeTime);
      g.gain.linearRampToValueAtTime(0.35 * (1 - i * 0.03), strikeTime + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, strikeTime + 1.6);

      o1.connect(g);
      o2.connect(g);
      g.connect(masterGain);

      o1.start(strikeTime);
      o2.start(strikeTime);
      o1.stop(strikeTime + 1.7);
      o2.stop(strikeTime + 1.7);
      oscs.push(o1, o2);
    }

    this.trackSfx([...oscs, masterGain], 2.8);
    return oscs[0];
  }

  triggerCrystalChimes(pitchMidi = 72, velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = Math.max(0.15, Math.min(1.0, velocity / 127));
    const dest = this.getDest(destNode);
    if (!dest) return null;

    const baseFreq = 440 * Math.pow(2, (pitchMidi - 69) / 12);

    // FM Crystal Bells: Carrier + Dual Shimmer Modulators
    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.setValueAtTime(baseFreq, now);

    const mod1 = ctx.createOscillator();
    mod1.type = "sine";
    mod1.frequency.setValueAtTime(baseFreq * 3.5, now);
    const mod1G = ctx.createGain();
    mod1G.gain.setValueAtTime(baseFreq * 1.8, now);
    mod1G.gain.exponentialRampToValueAtTime(baseFreq * 0.05, now + 1.5);
    mod1.connect(mod1G);
    mod1G.connect(carrier.frequency);

    const mod2 = ctx.createOscillator();
    mod2.type = "triangle";
    mod2.frequency.setValueAtTime(baseFreq * 7.01, now);
    const mod2G = ctx.createGain();
    mod2G.gain.setValueAtTime(baseFreq * 0.8, now);
    mod2G.gain.exponentialRampToValueAtTime(0.1, now + 0.8);
    mod2.connect(mod2G);
    mod2G.connect(carrier.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.80 * vel * customGain, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

    carrier.connect(g);
    g.connect(dest);

    carrier.start(now);
    mod1.start(now);
    mod2.start(now);
    carrier.stop(now + 3.1);
    mod1.stop(now + 3.1);
    mod2.stop(now + 3.1);

    this.trackSfx([carrier, mod1, mod2, g], 3.2);
    return carrier;
  }

  triggerAngelicChoir(pitchMidi = 69, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = Math.max(0.15, Math.min(1.0, velocity / 127));
    const dest = this.getDest(destNode);
    if (!dest) return null;

    const baseFreq = 440 * Math.pow(2, (pitchMidi - 69) / 12);

    // Dual-octave ethereal soprano choir with gentle detune
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const o3 = ctx.createOscillator();
    o1.type = "sawtooth";
    o2.type = "sine";
    o3.type = "triangle";
    o1.frequency.setValueAtTime(baseFreq, now);
    o2.frequency.setValueAtTime(baseFreq * 1.006, now);
    o3.frequency.setValueAtTime(baseFreq * 2.002, now); // Upper octave celestial shimmer

    // Airy formant bandpass filter cluster
    const f1 = ctx.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.setValueAtTime(850, now);
    f1.Q.setValueAtTime(4.0, now);

    const f2 = ctx.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.setValueAtTime(2800, now);
    f2.Q.setValueAtTime(5.0, now);

    const airFlt = ctx.createBiquadFilter();
    airFlt.type = "highshelf";
    airFlt.frequency.setValueAtTime(4500, now);
    airFlt.gain.setValueAtTime(6.0, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.75 * vel * customGain, now + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

    o1.connect(f1);
    o2.connect(f1);
    o3.connect(f2);
    f1.connect(airFlt);
    f2.connect(airFlt);
    airFlt.connect(g);
    g.connect(dest);

    o1.start(now);
    o2.start(now);
    o3.start(now);
    o1.stop(now + 2.9);
    o2.stop(now + 2.9);
    o3.stop(now + 2.9);

    this.trackSfx([o1, o2, o3, g], 3.0);
    return o1;
  }

  triggerClubDownlifter(duration = 3.5, velocity = 95, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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
    const dest = this.getDest(destNode);
    if (!dest) return null;

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

  triggerTaiko(velocity = 100, customGain = 1.0, destNode = null, midiNote = 48) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = velocity / 127;
    const dest = this.getDest(destNode);
    if (!dest) return null;

    const baseFreq = 440 * Math.pow(2, ((midiNote || 48) - 69) / 12);
    const fundamental = Math.max(45, Math.min(180, baseFreq));

    // 1. Heavy resonant drum head (sine with quick pitch bend)
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(fundamental * 2.2, now);
    osc.frequency.exponentialRampToValueAtTime(fundamental, now + 0.09);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(1.1 * vel * customGain, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

    // 2. Wooden stick strike transient
    const noise = this.createNoiseSource(false);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1200, now);
    bp.Q.setValueAtTime(2.5, now);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.6 * vel * customGain, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    noise.connect(bp);
    bp.connect(clickGain);
    clickGain.connect(dest);

    osc.connect(g);
    g.connect(dest);

    osc.start(now);
    osc.stop(now + 1.65);
    noise.start(now);
    noise.stop(now + 0.05);

    return osc;
  }

  // =========================================================================
  // 6. GENUINE SAXOPHONE & WOODWIND PHYSICAL DSP SYNTHESIS
  // =========================================================================

  triggerGenuineSax(
    midiNote = 65,
    velocity = 100,
    customGain = 1.0,
    destNode = null,
    style = "solo"
  ) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.getDest(destNode);
    if (!out) return null;
    const vel = velocity / 127;
    const targetFreq = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Duration & Envelope Settings based on style
    let duration = 2.8;
    let attackTime = 0.045;
    let decayTime = 1.8;
    let sustainLevel = 0.75;
    let releaseTime = 0.28;
    let scoopAmount = 0.92; // frequency factor (~ -150 cents)
    let scoopDuration = 0.07;
    let vibratoDelay = 0.18;
    let vibratoRate = 5.3;
    let vibratoDepth = 0.025; // pitch modulation ratio
    let breathGainVal = 0.16;
    let isFall = style === "fall";
    let isStab = style === "stab";
    let isGrowl = style === "growl";
    let isSensual = style === "sensual";

    if (isStab) {
      duration = 0.45;
      attackTime = 0.008;
      decayTime = 0.32;
      sustainLevel = 0.1;
      releaseTime = 0.08;
      scoopAmount = 0.98;
      scoopDuration = 0.02;
      breathGainVal = 0.28;
    } else if (isSensual) {
      attackTime = 0.09;
      decayTime = 2.2;
      sustainLevel = 0.85;
      releaseTime = 0.45;
      scoopAmount = 0.94;
      scoopDuration = 0.09;
      vibratoDelay = 0.14;
      vibratoRate = 4.8;
      vibratoDepth = 0.035;
      breathGainVal = 0.24;
    } else if (isGrowl) {
      attackTime = 0.025;
      decayTime = 1.6;
      sustainLevel = 0.8;
      releaseTime = 0.25;
      breathGainVal = 0.30;
    } else if (isFall) {
      duration = 0.85;
      attackTime = 0.015;
      decayTime = 0.75;
      sustainLevel = 0.05;
      releaseTime = 0.15;
      breathGainVal = 0.22;
    }

    // 1. Core Reed Sound: Dual Oscillators (Sawtooth + Asymmetrical Triangle)
    const osc1 = ctx.createOscillator();
    osc1.type = "sawtooth";

    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";

    // Pitch envelope (Scoop into note or Fall off note)
    const startFreq = targetFreq * scoopAmount;
    osc1.frequency.setValueAtTime(startFreq, now);
    osc2.frequency.setValueAtTime(startFreq * 1.002, now); // subtle detune for reed thickness

    osc1.frequency.exponentialRampToValueAtTime(targetFreq, now + scoopDuration);
    osc2.frequency.exponentialRampToValueAtTime(targetFreq * 1.002, now + scoopDuration);

    if (isFall) {
      // Big band brass/sax fall
      osc1.frequency.setValueAtTime(targetFreq, now + 0.12);
      osc2.frequency.setValueAtTime(targetFreq * 1.002, now + 0.12);
      osc1.frequency.exponentialRampToValueAtTime(Math.max(40, targetFreq * 0.35), now + 0.65);
      osc2.frequency.exponentialRampToValueAtTime(Math.max(40, targetFreq * 0.35), now + 0.65);
    }

    // 2. Expressive Vibrato LFO
    const vibratoLfo = ctx.createOscillator();
    vibratoLfo.type = "sine";
    vibratoLfo.frequency.setValueAtTime(vibratoRate, now);

    const vibratoGain = ctx.createGain();
    vibratoGain.gain.setValueAtTime(0.0001, now);
    // Vibrato swells in naturally after the initial breath attack
    vibratoGain.gain.setValueAtTime(0.0001, now + vibratoDelay);
    vibratoGain.gain.linearRampToValueAtTime(targetFreq * vibratoDepth, now + vibratoDelay + 0.35);

    vibratoLfo.connect(vibratoGain);
    vibratoGain.connect(osc1.frequency);
    vibratoGain.connect(osc2.frequency);

    // 3. Throat Growl Modulator (if growl style)
    let growlLfo = null;
    if (isGrowl) {
      growlLfo = ctx.createOscillator();
      growlLfo.type = "sawtooth";
      growlLfo.frequency.setValueAtTime(95, now); // ~95Hz vocal flutter
      const growlGain = ctx.createGain();
      growlGain.gain.setValueAtTime(targetFreq * 0.08, now);
      growlLfo.connect(growlGain);
      growlGain.connect(osc1.frequency);
      growlLfo.start(now);
      growlLfo.stop(now + duration + 0.2);
    }

    // 4. Non-Linear Reed Wave-Shaping / Saturation
    const waveShaper = ctx.createWaveShaper();
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      // Soft tube clipping characteristic of a reed vibrating against a mouthpiece lay
      curve[i] = (1.5 * x) / (1 + 0.5 * Math.abs(x));
    }
    waveShaper.curve = curve;
    waveShaper.oversample = "2x";

    // 5. Breath Noise Puff (Turbulent airflow through reed tip)
    const breathSource = this.createNoiseSource(false);
    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = "bandpass";
    breathFilter.frequency.setValueAtTime(3200, now);
    breathFilter.Q.setValueAtTime(2.8, now);

    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.0001, now);
    breathGain.gain.linearRampToValueAtTime(breathGainVal * vel * customGain, now + 0.025);
    breathGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, breathGainVal * 0.35 * vel * customGain), now + 0.12);
    breathGain.gain.setTargetAtTime(0.0001, now + duration * 0.85, releaseTime);

    breathSource.connect(breathFilter);
    breathFilter.connect(breathGain);

    // 6. Conical Bore Acoustic Formant Filtering (Body, Throat & Bell)
    // Formant 1: Warm body resonance (~720Hz)
    const formantBody = ctx.createBiquadFilter();
    formantBody.type = "peaking";
    formantBody.frequency.setValueAtTime(720, now);
    formantBody.Q.setValueAtTime(2.2, now);
    formantBody.gain.setValueAtTime(7.0, now);

    // Formant 2: Nasal / Throat projection (~1550Hz)
    const formantThroat = ctx.createBiquadFilter();
    formantThroat.type = "peaking";
    formantThroat.frequency.setValueAtTime(1550, now);
    formantThroat.Q.setValueAtTime(2.6, now);
    formantThroat.gain.setValueAtTime(5.5, now);

    // Formant 3: Brass Bell presence (~3300Hz)
    const formantBell = ctx.createBiquadFilter();
    formantBell.type = "peaking";
    formantBell.frequency.setValueAtTime(3300, now);
    formantBell.Q.setValueAtTime(1.8, now);
    formantBell.gain.setValueAtTime(4.0, now);

    // Lowpass cutoff dynamically tracks velocity & note
    const mainLpf = ctx.createBiquadFilter();
    mainLpf.type = "lowpass";
    const baseCutoff = Math.min(16000, targetFreq * (isSensual ? 4.8 : 6.2) + vel * 3500);
    mainLpf.frequency.setValueAtTime(baseCutoff * 0.75, now);
    mainLpf.frequency.linearRampToValueAtTime(baseCutoff, now + attackTime);
    mainLpf.Q.setValueAtTime(1.4, now);

    // 7. Master Amplitude Envelope
    const ampGain = ctx.createGain();
    const peakGain = 0.55 * vel * customGain;
    ampGain.gain.setValueAtTime(0.0001, now);
    ampGain.gain.linearRampToValueAtTime(peakGain, now + attackTime);
    ampGain.gain.linearRampToValueAtTime(peakGain * sustainLevel, now + attackTime + decayTime);
    ampGain.gain.setTargetAtTime(0.0001, now + duration, releaseTime);

    // Connect audio paths
    osc1.connect(waveShaper);
    osc2.connect(waveShaper);
    waveShaper.connect(formantBody);
    formantBody.connect(formantThroat);
    formantThroat.connect(formantBell);
    formantBell.connect(mainLpf);
    mainLpf.connect(ampGain);
    breathGain.connect(ampGain);

    ampGain.connect(out);

    // Start nodes
    osc1.start(now);
    osc2.start(now);
    vibratoLfo.start(now);
    breathSource.start(now);

    const stopTime = now + duration + releaseTime + 0.3;
    osc1.stop(stopTime);
    osc2.stop(stopTime);
    vibratoLfo.stop(stopTime);
    breathSource.stop(stopTime);

    return {
      osc1,
      osc2,
      ampGain,
      stop: (t = ctx.currentTime) => {
        try {
          ampGain.gain.cancelScheduledValues(t);
          ampGain.gain.setTargetAtTime(0.0001, t, 0.08);
          osc1.stop(t + 0.15);
          osc2.stop(t + 0.15);
          vibratoLfo.stop(t + 0.15);
          breathSource.stop(t + 0.15);
          if (growlLfo) growlLfo.stop(t + 0.15);
        } catch (e) {}
      },
    };
  }

  triggerSaxSolo(midiNote = 65, velocity = 100, customGain = 1.0, destNode = null) {
    return this.triggerGenuineSax(midiNote, velocity, customGain, destNode, "solo");
  }

  triggerSaxSensual(midiNote = 65, velocity = 100, customGain = 1.0, destNode = null) {
    return this.triggerGenuineSax(midiNote, velocity, customGain, destNode, "sensual");
  }

  triggerSaxBluesGrowl(midiNote = 65, velocity = 100, customGain = 1.0, destNode = null) {
    return this.triggerGenuineSax(midiNote, velocity, customGain, destNode, "growl");
  }

  triggerSaxFunkStab(midiNote = 65, velocity = 100, customGain = 1.0, destNode = null) {
    return this.triggerGenuineSax(midiNote, velocity, customGain, destNode, "stab");
  }

  triggerSaxFall(midiNote = 65, velocity = 100, customGain = 1.0, destNode = null) {
    return this.triggerGenuineSax(midiNote, velocity, customGain, destNode, "fall");
  }

  triggerSaxScoop(midiNote = 65, velocity = 100, customGain = 1.0, destNode = null) {
    return this.triggerGenuineSax(midiNote, velocity, customGain, destNode, "scoop");
  }

  isSfxInstrument(instId) {
    if (!instId) return false;
    if (instId.endsWith("_r")) return false;
    const id = String(instId).toLowerCase();
    if (id === "percussion_taiko" || id === "taiko_drum" || id === "thunder_taiko") return false;
    if (id === "voice_oohs" || id === "choir_aahs") return false;
    if (id === "tubular_bells" || id === "wind_chimes" || id === "crystal_chimes") return true;
    if (id === "angelic_choir") return true;
    if (id.startsWith("sy_")) return true;
    if (id.startsWith("nature_")) return true;
    if (id.startsWith("vox_")) return true;
    if (id.startsWith("fx_")) return true;
    if (id.startsWith("percussion_")) return true;
    if (id === "tr808_kit" || id === "tr909_kit" || id === "drums1" || id === "m1_drums") return true;
    if (id === "dub_siren" || id === "reggae_siren" || id === "spring_splash" || id === "dub_splash") return true;
    if (id === "laser_zap" || id === "dub_laser" || id === "dub_horn" || id === "airhorn" || id === "sub_boom" || id === "sub_drop" || id === "noise_riser") return true;
    if (id === "kalimba" || id === "m1_kalimba") return true;
    return false;
  }

  playSfxNote(instId, midiNote = 60, velocity = 95, customGain = 1.0, destNode = null) {
    if (instId && instId.startsWith("sy_")) {
      return synthesizerYouEngine.trigger(instId, velocity, customGain, destNode, midiNote);
    }

    switch (instId) {
      // 0. Kalimba / Mbira Thumb Piano
      case "kalimba":
      case "m1_kalimba":
        return this.triggerKalimba(midiNote, velocity, customGain, destNode);

      // 1. Nature Sounds
      case "nature_thunder":
        return this.triggerThunder(velocity, customGain, destNode);
      case "nature_rain":
        return this.triggerRain(3.5, velocity, customGain, destNode);
      case "nature_ocean":
        return this.triggerOceanWave(4.5, velocity, customGain, destNode);
      case "nature_birds":
        return this.triggerBirdChirp(midiNote, velocity, customGain, destNode);
      case "nature_wind":
        return this.triggerWind(3.5, velocity, customGain, destNode);
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
        return this.triggerVocalChant("yeah", midiNote, velocity, customGain, destNode);
      case "vox_whoa":
        return this.triggerVocalChant("whoa", midiNote, velocity, customGain, destNode);
      case "vox_hey":
        return this.triggerVocalChant("hey", midiNote, velocity, customGain, destNode);
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
      case "angelic_choir":
        return this.triggerAngelicChoir(midiNote, velocity, customGain, destNode);
      case "vox_beatbox": {
        const mod = midiNote % 3;
        if (mod === 0) return this.triggerBeatbox("kick", velocity, customGain, destNode);
        if (mod === 1) return this.triggerBeatbox("snare", velocity, customGain, destNode);
        return this.triggerBeatbox("hat", velocity, customGain, destNode);
      }

      // Bells & Chimes
      case "tubular_bells":
        return this.triggerTubularBells(midiNote, velocity, customGain, destNode);
      case "wind_chimes":
        return this.triggerWindChimes(midiNote, velocity, customGain, destNode);
      case "crystal_chimes":
        return this.triggerCrystalChimes(midiNote, velocity, customGain, destNode);

      // 3. Weird Sci-Fi FX
      case "fx_laser":
        return this.triggerLaserZap(velocity, customGain, destNode);
      case "fx_alien":
        return this.triggerAlienDrone(midiNote, velocity, customGain, destNode);
      case "fx_bionic":
        return this.triggerBionicGlitch(velocity, customGain, destNode);
      case "fx_warpdrive":
        return this.triggerWarpDrive(velocity, customGain, destNode);
      case "fx_robot":
        return this.triggerRobotTelemetry(velocity, customGain, destNode);
      case "fx_plasma":
        return this.triggerPlasmaBlaster(velocity, customGain, destNode);
      case "fx_cyber_sweep":
        return this.triggerCyberSweep(velocity, customGain, destNode);
      case "fx_sub_resonator":
        return this.triggerSubResonator(midiNote, velocity, customGain, destNode);

      // 4. DJ & Cinematic FX
      case "fx_scratch":
        return this.triggerVinylScratch(velocity, customGain, destNode);
      case "fx_tapestop":
        return this.triggerTapeStop(velocity, customGain, destNode);
      case "fx_subboom":
        return this.triggerSubBoom(velocity, customGain, destNode);
      case "fx_airhorn":
        return this.triggerReggaeAirhorn(velocity, customGain, destNode);
      case "fx_cinema_braam":
        return this.triggerCinemaBraam(midiNote, velocity, customGain, destNode);
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
          return this.trigger808Kick(velocity, customGain, destNode);
        } else if (midiNote === 38 || midiNote === 40 || midiNote % 12 === 2) {
          return this.trigger808Snare(velocity, customGain, destNode);
        } else if (midiNote === 42 || midiNote % 12 === 6) {
          return this.trigger808Hat(true, velocity, customGain, destNode);
        } else if (midiNote === 46 || midiNote % 12 === 10) {
          return this.trigger808Hat(false, velocity, customGain, destNode);
        } else if (midiNote === 56 || midiNote % 12 === 8) {
          return this.triggerCowbell(velocity, customGain, destNode);
        } else if (midiNote === 39 || midiNote % 12 === 3) {
          return this.triggerShaker(velocity, customGain, destNode);
        } else {
          return this.triggerConga(midiNote >= 60, velocity, customGain, destNode);
        }
      }
      case "tr909_kit":
        return this.trigger909Kick(velocity, customGain, destNode);
      case "percussion_conga":
        return this.triggerConga(midiNote >= 60, velocity, customGain, destNode);
      case "percussion_shaker":
        return this.triggerShaker(velocity, customGain, destNode);
      case "percussion_cowbell":
        return this.triggerCowbell(velocity, customGain, destNode);
      case "percussion_clap":
        return this.triggerStereoClap(velocity, customGain, destNode);
      case "percussion_bongo":
        return this.triggerBongos(midiNote >= 60, velocity, customGain, destNode);
      case "percussion_timbales":
        return this.triggerTimbales(midiNote, velocity, customGain, destNode);
      case "percussion_crash":
        return this.triggerCrashGong(velocity, customGain, destNode);
      case "percussion_taiko":
      case "taiko_drum":
        return this.triggerTaiko(velocity, customGain, destNode, midiNote);


      // 7. Reggae, Dub & Stage Sound FX
      case "dub_siren":
      case "reggae_siren":
        return this.triggerDubSiren(midiNote || 60, velocity, customGain, destNode);
      case "spring_splash":
      case "dub_splash":
        return this.triggerSpringSplash(velocity, customGain, destNode);
      case "laser_zap":
      case "dub_laser":
        return this.triggerLaserZap(velocity, customGain, destNode);
      case "dub_horn":
      case "airhorn":
        return this.triggerDubHorn(velocity, customGain, destNode);
      case "sub_boom":
      case "sub_drop":
      case "808_boom":
        return this.trigger808SubBoom(velocity, customGain, destNode);
      case "noise_riser":
      case "sweep_riser":
        return this.triggerNoiseRiser(velocity, customGain, destNode);

      default:
        return null;
    }
  }

  /**
   * Authentic Jamaican Sound System Dub Siren with LFO Pitch Modulation & Space Echo
   */
  triggerDubSiren(midiNote = 60, velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const dest = this.getDest(destNode);
    if (!dest) return null;
    const now = ctx.currentTime;
    const baseFreq = 440 * Math.pow(2, (midiNote - 69) / 12);

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(baseFreq, now);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(4.8, now); // Siren speed

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(baseFreq * 0.28, now); // Siren depth
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.value = 4.5;

    const gainNode = ctx.createGain();
    const peakVol = (velocity / 127) * 0.45 * customGain;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(peakVol, now + 0.05);
    gainNode.gain.setValueAtTime(peakVol, now + 1.2);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 2.8);

    // Dub Echo Delay line
    const delay = ctx.createDelay(1.0);
    delay.delayTime.setValueAtTime(0.32, now);
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.68, now);
    const delayDamp = ctx.createBiquadFilter();
    delayDamp.type = "lowpass";
    delayDamp.frequency.setValueAtTime(2400, now);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(dest);

    // Feed to echo
    gainNode.connect(delay);
    delay.connect(delayDamp);
    delayDamp.connect(delayFeedback);
    delayFeedback.connect(delay);
    delayDamp.connect(dest);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + 3.0);
    lfo.stop(now + 3.0);

    this.trackSfx([osc, lfo, gainNode, delay], 3.2);
    return { stop: () => { try { gainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.05); } catch(e){} } };
  }

  /**
   * Vintage Spring Reverb Splash / Tank Crash (Iconic Dub Crash)
   */
  triggerSpringSplash(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const dest = this.getDest(destNode);
    if (!dest) return null;
    const now = ctx.currentTime;

    // Transient impulse
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

    const impGain = ctx.createGain();
    impGain.gain.setValueAtTime(0.8 * customGain, now);
    impGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(impGain);

    // Dispersive Spring Diffusion Network (Resonant Allpass cascade)
    const ap1 = ctx.createBiquadFilter();
    ap1.type = "allpass";
    ap1.frequency.setValueAtTime(750, now);
    ap1.Q.value = 8.0;

    const ap2 = ctx.createBiquadFilter();
    ap2.type = "allpass";
    ap2.frequency.setValueAtTime(1450, now);
    ap2.Q.value = 10.0;

    const springDelay = ctx.createDelay(0.5);
    springDelay.delayTime.setValueAtTime(0.038, now);
    const springFb = ctx.createGain();
    springFb.gain.setValueAtTime(0.82, now);

    const springOut = ctx.createGain();
    springOut.gain.setValueAtTime((velocity / 127) * 0.5 * customGain, now);
    springOut.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    impGain.connect(ap1);
    ap1.connect(ap2);
    ap2.connect(springDelay);
    springDelay.connect(springFb);
    springFb.connect(ap1);
    springDelay.connect(springOut);
    springOut.connect(dest);

    osc.start(now);
    osc.stop(now + 0.1);
    this.trackSfx([osc, impGain, springOut], 2.0);
    return true;
  }

  /**
   * Sound System Laser Zap
   */
  triggerLaserZap(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const dest = this.getDest(destNode);
    if (!dest) return null;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(3200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.16);

    const gain = ctx.createGain();
    const vol = (velocity / 127) * 0.4 * customGain;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.25);
    this.trackSfx([osc, gain], 0.3);
    return true;
  }

  /**
   * Dancehall / Reggae Stage Airhorn
   */
  triggerDubHorn(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const dest = this.getDest(destNode);
    if (!dest) return null;
    const now = ctx.currentTime;

    const f1 = 349.23; // F4
    const f2 = 466.16; // Bb4

    [f1, f2].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq * 0.92, now);
      osc.frequency.linearRampToValueAtTime(freq, now + 0.04);

      const gain = ctx.createGain();
      const vol = (velocity / 127) * 0.22 * customGain;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.02);
      gain.gain.setValueAtTime(vol, now + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(freq * 1.5, now);
      filter.Q.value = 2.0;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.75);
      this.trackSfx([osc, gain], 0.8);
    });
    return true;
  }

  /**
   * Heavy 808 Sub-Boom / Bass Drop
   */
  trigger808SubBoom(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const dest = this.getDest(destNode);
    if (!dest) return null;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.8);

    const gain = ctx.createGain();
    const vol = (velocity / 127) * 0.75 * customGain;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 1.7);
    this.trackSfx([osc, gain], 1.8);
    return true;
  }

  /**
   * White Noise Sweep / Riser Transition
   */
  triggerNoiseRiser(velocity = 100, customGain = 1.0, destNode = null) {
    const ctx = this.ctx;
    const dest = this.getDest(destNode);
    if (!dest || !this.noiseBuffer) return null;
    const now = ctx.currentTime;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    noiseSrc.loop = true;

    const sweepFilter = ctx.createBiquadFilter();
    sweepFilter.type = "bandpass";
    sweepFilter.Q.value = 3.5;
    sweepFilter.frequency.setValueAtTime(220, now);
    sweepFilter.frequency.exponentialRampToValueAtTime(6500, now + 2.2);

    const gain = ctx.createGain();
    const vol = (velocity / 127) * 0.35 * customGain;
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(vol, now + 2.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

    noiseSrc.connect(sweepFilter);
    sweepFilter.connect(gain);
    gain.connect(dest);

    noiseSrc.start(now);
    noiseSrc.stop(now + 2.5);
    this.trackSfx([noiseSrc, gain], 2.6);
    return true;
  }
}


