/**
 * Click-Free Zero-Crackle Polyphonic Voice Pool
 * Smooth mathematical setTargetAtTime release curves that eliminate DC step clicks,
 * popping, sizzling, and crackling (no discontinuous disconnect() calls).
 */

// True hard-sync in native Web Audio: the master saw (osc1) IS the phase ramp, so a
// WaveShaper can map master phase -> slave phase ((p * ratio) % 1) and synthesize a
// perfectly reset slave waveform for any ratio. Same technique JV/JP-style oscillators
// emulate sync with: no AudioWorklet needed, phase-locked octave/sync leads included.
const _syncCurveCache = new Map();

function getSyncCurve(ratio, waveType) {
  const key = ratio.toFixed(3) + "|" + waveType;
  const cached = _syncCurveCache.get(key);
  if (cached) return cached;

  const N = 4096;
  const curve = new Float32Array(N);
  const half = N - 1;
  for (let i = 0; i < N; i++) {
    const v = (i / half) * 2 - 1;      // WaveShaper input: osc1 saw >= -1..1 == master phase
    const p = (v + 1) * 0.5;           // master phase 0..1
    const sp = (p * ratio) % 1;        // slave phase, reset every master period (hard sync)
    let out;
    switch (waveType) {
      case "square":
        out = sp < 0.5 ? 1 : -1;
        break;
      case "triangle":
        out = sp < 0.5 ? 4 * sp - 1 : 3 - 4 * sp;
        break;
      case "sine":
        out = Math.sin(sp * 2 * Math.PI);
        break;
      case "sawtooth":
      default:
        out = sp * 2 - 1;
        break;
    }
    curve[i] = out;
  }
  _syncCurveCache.set(key, curve);
  return curve;
}

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
    this.gain3.gain.value = 0.0;

    // Hard-sync slave path:
    // osc2 passes through osc2Gate.
    // osc1 passes through syncShaper -> syncGate.
    // When sync is active: syncGate is 1.0, osc2Gate is 0.0.
    // When sync is off: syncGate is 0.0, osc2Gate is 1.0 (zero oversampling noise/leakage).
    this.osc2Gate = ctx.createGain();
    this.osc2Gate.gain.value = 1.0;
    this.osc2.connect(this.osc2Gate);
    this.osc2Gate.connect(this.gain2);

    this.syncShaper = ctx.createWaveShaper();
    this.syncShaper.oversample = "none";
    this.syncGate = ctx.createGain();
    this.syncGate.gain.value = 0.0;
    this.osc1.connect(this.syncShaper);
    this.syncShaper.connect(this.syncGate);
    this.syncGate.connect(this.gain2);

    // Static, click-free audio routing:
    // Oscs -> Mixers -> Filter -> VoiceGain -> Destination
    this.osc1.connect(this.gain1);
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

  trigger(midiNote, velocity, instrumentConfig, pitchBendRatio = 1.0, sameNote = false) {
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

    // Hard Sync routing
    const syncActive = !!instrumentConfig.syncSlave && (instrumentConfig.osc1Ratio || 1.0) > 0;
    if (syncActive) {
      const syncRatio = Math.max(1.001, (instrumentConfig.osc2Ratio || 2.0) / (instrumentConfig.osc1Ratio || 1.0));
      this.syncShaper.curve = getSyncCurve(syncRatio, instrumentConfig.osc2Type || "sawtooth");
      this.osc2Gate.gain.setTargetAtTime(0.0, now, 0.002);
      this.syncGate.gain.setTargetAtTime(1.0, now, 0.002);
    } else {
      this.osc2Gate.gain.setTargetAtTime(1.0, now, 0.002);
      this.syncGate.gain.setTargetAtTime(0.0, now, 0.002);
    }

    // Dynamic Filter
    const baseCutoff = instrumentConfig.filterCutoff || 6000;
    const filterEnv = Math.min(18000, Math.max(baseCutoff * (0.5 + velRatio * 0.8), freq * 1.5));
    this.filter.type = instrumentConfig.filterType || "lowpass";
    this.filter.Q.setValueAtTime(Math.min(2.5, Math.max(0.25, (instrumentConfig.filterQ || 1.0) * 0.55)), now);
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setTargetAtTime(filterEnv, now, 0.012);

    // Component balances
    this.gain1.gain.setValueAtTime(instrumentConfig.gain1 || 0.7, now);
    this.gain2.gain.setValueAtTime(instrumentConfig.gain2 || 0.3, now);
    this.gain3.gain.setValueAtTime(Number(instrumentConfig.gain3) || 0.0, now);

    const attack = Math.max(0.0015, instrumentConfig.attack || 0.002);
    const peakGain = (0.35 + velRatio * 0.65) * (instrumentConfig.masterGain || 0.85);
    const decay = instrumentConfig.decay || 2.2;
    const sustain = peakGain * (instrumentConfig.sustainLevel || 0.35);
    const decTau = instrumentConfig.isPercussive ? decay * 0.45 : 0.25;
    const decTarget = instrumentConfig.isPercussive ? 0.0 : sustain;

    this.voiceGain.gain.cancelScheduledValues(now);
    if (sameNote) {
      // Legato same-note retrigger: blend smoothly from current level
      const aStart = now + 0.001;
      this.voiceGain.gain.setTargetAtTime(peakGain, aStart, Math.max(0.001, attack));
      this.voiceGain.gain.setTargetAtTime(decTarget, aStart + Math.max(0.001, attack) * 3 + 0.003, decTau);
    } else if (wasBusy) {
      // Voice steal: quick gentle duck to zero, then clean attack
      const zeroAt = now + 0.018;
      this.voiceGain.gain.setTargetAtTime(0.0, now, 0.004);
      this.voiceGain.gain.setValueAtTime(0.0, zeroAt);
      const aStart = zeroAt + 0.002;
      this.voiceGain.gain.setTargetAtTime(peakGain, aStart, attack);
      this.voiceGain.gain.setTargetAtTime(decTarget, aStart + attack * 3 + 0.004, decTau);
    } else {
      // Idle voice: clean attack from silent state
      const aStart = now + 0.002;
      this.voiceGain.gain.setValueAtTime(0.0, now);
      this.voiceGain.gain.setTargetAtTime(peakGain, aStart, attack);
      this.voiceGain.gain.setTargetAtTime(decTarget, aStart + attack * 3 + 0.004, decTau);
    }
  }

  release(sustainPedalActive, releaseTime = 0.25) {
    if (sustainPedalActive) {
      this.isSustained = true;
      return;
    }
    this.isSustained = false;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const rel = Math.max(0.02, Math.min(0.8, releaseTime));
    const tau = Math.max(0.015, rel * 0.22);
    const gen = this._gen;

    // Smooth exponential decay to silence
    this.voiceGain.gain.cancelScheduledValues(now);
    this.voiceGain.gain.setTargetAtTime(0.0, now, tau);
    const fadeSec = Math.max(0.08, tau * 6);
    this.voiceGain.gain.setValueAtTime(0.0, now + fadeSec);

    setTimeout(() => {
      if (gen === this._gen && !this.isSustained) {
        this.isBusy = false;
        this.activeMidiNote = null;
      }
    }, (fadeSec + 0.04) * 1000);
  }

  forceStop() {
    const now = this.ctx.currentTime;
    this._gen++;
    const gen = this._gen;
    this.isBusy = false;
    this.isSustained = false;
    this.activeMidiNote = null;
    const fadeSec = 0.06;
    try {
      this.voiceGain.gain.cancelScheduledValues(now);
      this.voiceGain.gain.setTargetAtTime(0.0, now, 0.012);
      this.voiceGain.gain.setValueAtTime(0.0, now + fadeSec);
    } catch (e) {}
    setTimeout(() => {
      if (gen !== this._gen) return;
      this.isBusy = false;
    }, (fadeSec + 0.02) * 1000);
  }

  // Permanently silence this voice's oscillators. Only safe for pools whose
  // output is hard-wired into an inaudible path (e.g. the synth engine's muted
  // reserve pool). A stopped OscillatorNode continues outputting absolute
  // silence at zero CPU, freeing the render thread for real instrument audio.
  stopOscillators() {
    const stop = osc => {
      try {
        if (osc) osc.stop();
      } catch (e) {}
    };
    stop(this.osc1);
    stop(this.osc2);
    stop(this.osc3);
  }
}

export class VoicePoolManager {
  constructor(ctx, poolSize = 32, destinationNode = null, heldNotes = null) {
    this.ctx = ctx;
    this.poolSize = poolSize;
    this.destination = destinationNode || ctx.destination;
    this.heldNotes = heldNotes; // Set of currently HELD midi notes (protected from stealing)
    this.voices = [];
    this.initPool();
  }

  bindHeldNotes(heldNotes) {
    this.heldNotes = heldNotes;
  }

  initPool() {
    for (let i = 0; i < this.poolSize; i++) {
      this.voices.push(new PolyphonicVoice(this.ctx, i, this.destination));
    }
  }

  acquireVoice(midiNote) {
    const existing = this.voices.find(v => v.activeMidiNote === midiNote && v.isBusy);
    if (existing) return existing;

    const idle = this.voices.find(v => !v.isBusy);
    if (idle) return idle;

    const held = this.heldNotes;
    const isHeld = note => !!held && held.has(note);

    // Prefer stealing a voice whose note has been RELEASED (only its tail is
    // ringing) so a note the player is still holding is NEVER cut off mid-sustain.
    // Single O(n) pass -- no temporary array allocation, no sort, no GC churn
    // during sustained dense playing (organs/pads love doing this).
    let tail = null;
    let tailOldest = Infinity;
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      if (v.isBusy && v.activeMidiNote !== null && !isHeld(v.activeMidiNote) && v.startTime < tailOldest) {
        tail = v;
        tailOldest = v.startTime;
      }
    }
    if (tail) return tail;

    // Only when literally every voice is a held note, steal the longest-sounding one.
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