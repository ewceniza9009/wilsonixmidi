/**
 * Click-Free Zero-Crackle Polyphonic Voice Pool
 * Smooth mathematical setTargetAtTime release curves that eliminate DC step clicks,
 * popping, sizzling, and crackling (no discontinuous disconnect() calls).
 */

export class PolyphonicVoice {
  constructor(ctx, voiceIndex, destinationNode) {
    this.ctx = ctx;
    this.index = voiceIndex;
    this.destination = destinationNode;

    this.activeMidiNote = null;
    this.startTime = 0;
    this.isSustained = false;
    this.isBusy = false;
    this._gen = 0;

    this.buildGraph();
  }

  buildGraph() {
    const ctx = this.ctx;

    // Master Voice Envelope Gain
    this.voiceGain = ctx.createGain();
    this.voiceGain.gain.value = 0.0; // Whisper-silent when idle

    // Primary Body Oscillator
    this.osc1 = ctx.createOscillator();
    this.osc1.type = "triangle";

    // Secondary Harmony / Tine Oscillator
    this.osc2 = ctx.createOscillator();
    this.osc2.type = "sine";

    // Sub Bass Oscillator
    this.osc3 = ctx.createOscillator();
    this.osc3.type = "sine";

    // Dynamic Multi-mode Filter
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 7500;
    this.filter.Q.value = 1.0;

    // Sub mixer gains
    this.gain1 = ctx.createGain();
    this.gain2 = ctx.createGain();
    this.gain3 = ctx.createGain();
    this.gain1.gain.value = 0.7;
    this.gain2.gain.value = 0.3;
    this.gain3.gain.value = 0.15;

    // Permanent, click-free audio routing:
    // Oscs -> Mixers -> Filter -> VoiceGain -> Destination
    this.osc1.connect(this.gain1);
    this.osc2.connect(this.gain2);
    this.osc3.connect(this.gain3);

    this.gain1.connect(this.filter);
    this.gain2.connect(this.filter);
    this.gain3.connect(this.filter);

    this.filter.connect(this.voiceGain);
    this.voiceGain.connect(this.destination);

    // Start oscillators once at boot time; envelope gating controls volume
    this.osc1.start();
    this.osc2.start();
    this.osc3.start();
  }

  trigger(midiNote, velocity, instrumentConfig, pitchBendRatio = 1.0) {
    this.activeMidiNote = midiNote;
    this._gen++;
    const wasBusy = this.isBusy;
    this.isBusy = true;
    this.isSustained = false;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.startTime = now;

    const baseFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const freq = baseFreq * pitchBendRatio;
    const velRatio = Math.max(0.05, Math.min(1.0, velocity / 127));

    // Update oscillator waveforms
    this.osc1.type = instrumentConfig.osc1Type || "triangle";
    this.osc2.type = instrumentConfig.osc2Type || "sine";
    this.osc3.type = instrumentConfig.osc3Type || "sine";

    // Smooth frequency transitions
    this.osc1.frequency.setValueAtTime(freq * (instrumentConfig.osc1Ratio || 1.0), now);
    this.osc2.frequency.setValueAtTime(freq * (instrumentConfig.osc2Ratio || 2.001), now);
    this.osc3.frequency.setValueAtTime(freq * (instrumentConfig.osc3Ratio || 0.5), now);

    // Dynamic Filter (smooth exponential slew so reused resonant voices never zipper)
    const baseCutoff = instrumentConfig.filterCutoff || 6000;
    const filterEnv = Math.min(18000, baseCutoff * (0.5 + velRatio * 0.8));
    this.filter.type = instrumentConfig.filterType || "lowpass";
    this.filter.Q.setValueAtTime(Math.min(5.0, instrumentConfig.filterQ || 1.0), now);
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setTargetAtTime(filterEnv, now, 0.012);

    // Component balances (clean, balanced timbre mix without velocity-squaring)
    this.gain1.gain.setValueAtTime(instrumentConfig.gain1 || 0.7, now);
    this.gain2.gain.setValueAtTime(instrumentConfig.gain2 || 0.3, now);
    this.gain3.gain.setValueAtTime(instrumentConfig.gain3 || 0.15, now);

    const attack = Math.max(0.001, instrumentConfig.attack || 0.002);
    const peakGain = (0.35 + velRatio * 0.65) * (instrumentConfig.masterGain || 0.85);
    const decay = instrumentConfig.decay || 2.2;
    const sustain = peakGain * (instrumentConfig.sustainLevel || 0.35);

    // Click-free gating: when a voice is stolen or retriggered while soundING,
    // duck it smoothly to near-silence first so the held note never gets chopped.
    const gateT = now + (wasBusy ? 0.055 : 0.0);
    this.voiceGain.gain.cancelScheduledValues(now);
    if (wasBusy) {
      this.voiceGain.gain.setTargetAtTime(0.0, now, 0.01);
    }
    this.voiceGain.gain.setValueAtTime(0.0, gateT);
    this.voiceGain.gain.setTargetAtTime(peakGain, gateT, attack);
    this.voiceGain.gain.setTargetAtTime(
      instrumentConfig.isPercussive ? 0.0 : sustain,
      gateT + attack * 3,
      instrumentConfig.isPercussive ? decay * 0.45 : 0.25
    );
  }

  release(sustainPedalActive, releaseTime = 0.25) {
    if (sustainPedalActive) {
      this.isSustained = true;
      return;
    }
    // CRITICAL FIX: Clear sustained status when releasing damper
    this.isSustained = false;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const rel = Math.max(0.02, Math.min(0.8, releaseTime));
    const tau = Math.max(0.015, rel * 0.22);
    const gen = this._gen;

    // Smooth, guaranteed exponential decay to absolute zero
    this.voiceGain.gain.cancelScheduledValues(now);
    this.voiceGain.gain.setTargetAtTime(0.0, now, tau);

    // Free the voice only after it has physically faded to inaudibility AND the
    // same generation still owns it (a reused/retriggered note must never be
    // killed by a stale release timer from an earlier tap on the same key).
    setTimeout(() => {
      if (gen === this._gen && !this.isSustained) {
        this.isBusy = false;
        this.activeMidiNote = null;
      }
    }, Math.max(220, tau * 6 * 1000));
  }

  forceStop() {
    const now = this.ctx.currentTime;
    this._gen++;
    this.isBusy = false;
    this.isSustained = false;
    this.activeMidiNote = null;
    try {
      this.voiceGain.gain.cancelScheduledValues(now);
      this.voiceGain.gain.setTargetAtTime(0.0, now, 0.015);
    } catch (e) {}
  }
}

export class VoicePoolManager {
  constructor(ctx, poolSize = 32, destinationNode = null) {
    this.ctx = ctx;
    this.poolSize = poolSize;
    this.destination = destinationNode || ctx.destination;
    this.voices = [];
    this.initPool();
  }

  initPool() {
    for (let i = 0; i < this.poolSize; i++) {
      this.voices.push(new PolyphonicVoice(this.ctx, i, this.destination));
    }
  }

  acquireVoice(midiNote) {
    const existing = this.voices.find(v => v.activeMidiNote === midiNote);
    if (existing) return existing;

    const idle = this.voices.find(v => !v.isBusy);
    if (idle) return idle;

    // Steal oldest voice
    let oldest = this.voices[0];
    let oldestTime = oldest.startTime;
    for (let i = 1; i < this.voices.length; i++) {
      if (this.voices[i].startTime < oldestTime) {
        oldest = this.voices[i];
        oldestTime = this.voices[i].startTime;
      }
    }
    return oldest;
  }

  getActiveVoicesByNote(midiNote) {
    return this.voices.filter(v => v.activeMidiNote === midiNote);
  }

  allNotesOff() {
    this.voices.forEach(v => v.forceStop());
  }
}
