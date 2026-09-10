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
    this.gain3.gain.value = 0.15;

    // Hard-sync slave path: osc2 (the "harmony" oscillator) is silently gated when a
    // program requests sync, and a phase-sync WaveShaper (fed by osc1 = master) drives
    // gain2 instead. osc2 keeps running but contributes nothing while sync is active.
    this.osc2Gate = ctx.createGain();
    this.osc2Gate.gain.value = 1.0;
    this.osc2.connect(this.osc2Gate);
    this.osc2Gate.connect(this.gain2);

    this.syncShaper = ctx.createWaveShaper();
    this.syncShaper.oversample = "2x";
    this.syncShaper.curve = new Float32Array(2); // all-zero = silent while no program uses sync
    this.osc1.connect(this.syncShaper);
    this.syncShaper.connect(this.gain2);

    // Permanent, click-free audio routing:
    // Oscs -> Mixers -> Filter -> VoiceGain -> Destination
    this.osc1.connect(this.gain1);
    this.osc3.connect(this.gain3);
    this._osc3Connected = true;

    this.gain1.connect(this.filter);
    this.gain2.connect(this.filter);
    this.gain3.connect(this.filter);

    this.filter.connect(this.voiceGain);
    this._filterConnected = true;
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

    // If this voice was physically decoupled from the graph while silent
    // (see release()/forceStop()), re-insert it BEFORE the attack ramps in.
    // The envelope is 0.0001/0 until now+0.002, so reconnecting is click-free.
    if (!this._filterConnected) {
      try { this.filter.connect(this.voiceGain); } catch (e) {}
      this._filterConnected = true;
    }

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

    // HARD SYNC: master = osc1, slave = WaveShaper(osc1 phase) mapped at osc2 ratio.
    // The native osc2 is gated out (it would add a plain harmonic on top); the shaper
    // renders (p * n) % 1 with the slave's own waveform = exact phase-reset sync.
    const syncActive = !!instrumentConfig.syncSlave && (instrumentConfig.osc1Ratio || 1.0) > 0;
    if (syncActive) {
      const syncRatio = Math.max(1.001, (instrumentConfig.osc2Ratio || 2.0) / (instrumentConfig.osc1Ratio || 1.0));
      this.syncShaper.curve = getSyncCurve(syncRatio, instrumentConfig.osc2Type || "sawtooth");
      this.osc2Gate.gain.setTargetAtTime(0.0, now, 0.0015);
    } else {
      this.osc2Gate.gain.setTargetAtTime(1.0, now, 0.0015);
      if (this.syncShaper.curve.length > 2) this.syncShaper.curve = new Float32Array(2);
    }

    // Dynamic Filter (smooth exponential slew; resonance scaled down ~55% so high-Q
    // programs don't turn into boxy resonant clipping - the grainy/dirty wall)
    const baseCutoff = instrumentConfig.filterCutoff || 6000;
    const filterEnv = Math.min(18000, baseCutoff * (0.5 + velRatio * 0.8));
    this.filter.type = instrumentConfig.filterType || "lowpass";
    this.filter.Q.setValueAtTime(Math.min(2.5, Math.max(0.25, (instrumentConfig.filterQ || 1.0) * 0.55)), now);
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setTargetAtTime(filterEnv, now, 0.012);

    // Component balances (clean, balanced timbre mix without velocity-squaring)
    this.gain1.gain.setValueAtTime(instrumentConfig.gain1 || 0.7, now);
    this.gain2.gain.setValueAtTime(instrumentConfig.gain2 || 0.3, now);

    // Decouple the sub oscillator whenever a program sets its gain to ZERO
    // (organs/EPs/strings disable the sub entirely). A connected osc3 costs
    // render time every quantum even at gain 0 -- physically dropping it keeps
    // sustained sounding voices as lean as possible.
    const osc3Gain = Number(instrumentConfig.gain3) || 0;
    const osc3On = osc3Gain > 0.0001;
    if (osc3On && !this._osc3Connected) {
      // Reconnecting a running oscillator at gain>0 would step in mid-phase --
      // fade the sub in over a few ms so the transition is click-free.
      this.gain3.gain.setValueAtTime(0.0, now);
      try { this.osc3.connect(this.gain3); } catch (e) {}
      this._osc3Connected = true;
      this.gain3.gain.setTargetAtTime(osc3Gain, now, 0.004);
    } else if (osc3On) {
      this.gain3.gain.setValueAtTime(osc3Gain, now);
    } else {
      this.gain3.gain.setValueAtTime(0.0, now);
      if (this._osc3Connected) {
        try { this.osc3.disconnect(this.gain3); } catch (e) {}
        this._osc3Connected = false;
      }
    }

    const attack = Math.max(0.0015, instrumentConfig.attack || 0.002);
    const peakGain = (0.35 + velRatio * 0.65) * (instrumentConfig.masterGain || 0.85);
    const decay = instrumentConfig.decay || 2.2;
    const sustain = peakGain * (instrumentConfig.sustainLevel || 0.35);
    const decTau = instrumentConfig.isPercussive ? decay * 0.45 : 0.25;
    const decTarget = instrumentConfig.isPercussive ? 0.0 : sustain;

    // NEVER schedule two automation events at the same timestamp (Web Audio treats
    // coincident events ambiguously) and NEVER hard-snap a sounding voice to zero.
    this.voiceGain.gain.cancelScheduledValues(now);
    if (sameNote) {
      // Legato same-note retrigger (fast repeated keys): blend from the current
      // level -- no zero gap, no duck, no chop, instant response.
      const aStart = now + 0.001;
      this.voiceGain.gain.setTargetAtTime(peakGain, aStart, Math.max(0.001, attack));
      this.voiceGain.gain.setTargetAtTime(decTarget, aStart + Math.max(0.001, attack) * 3 + 0.003, decTau);
    } else if (wasBusy) {
      // Voice steal: fast duck to near-silence, then clean attack wave-in.
      // 25ms duck is fast enough to feel instant on rapid re-triggers.
      const zeroAt = now + 0.025;
      this.voiceGain.gain.setTargetAtTime(0.0, now, 0.006);
      this.voiceGain.gain.setValueAtTime(0.0, zeroAt);
      const aStart = zeroAt + 0.002;
      this.voiceGain.gain.setTargetAtTime(peakGain, aStart, attack);
      this.voiceGain.gain.setTargetAtTime(decTarget, aStart + attack * 3 + 0.004, decTau);
    } else {
      // Idle voice: already silent, just run the attack envelope.
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
    // Force an EXACT digital zero once the fade completes. setTargetAtTime only
    // approaches zero asymptotically (~-52dB residual at 6*tau), and disconnecting
    // the voice's sub-graph over a barely-audible hair of signal is what leaked
    // the soft "static hiss" across dense chord changes. Pinning an unambiguous
    // 0.0 makes the subsequent physical disconnect a silent, sample-exact cut.
    const fadeSec = Math.max(0.08, tau * 6);
    this.voiceGain.gain.setValueAtTime(0.0, now + fadeSec);

    // Free the voice only after it has physically faded to inaudibility AND the
    // same generation still owns it (a reused/retriggered note must never be
    // killed by a stale release timer from an earlier tap on the same key).
    setTimeout(() => {
      if (gen === this._gen && !this.isSustained) {
        this.isBusy = false;
        this.activeMidiNote = null;
        // Fully silent now (exact zero since fadeSec): physically remove this
        // voice's sub-graph from the render pull so an idle voice costs ZERO
        // render time, not just a zeroed gain still being synthesized every
        // quantum. Sustained warm sounds (organs, pads) release in waves --
        // this frees the render thread in real time instead of leaving 96 dead
        // oscillators running.
        if (this._filterConnected) {
          try { this.filter.disconnect(this.voiceGain); } catch (e) {}
          this._filterConnected = false;
        }
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
    // Fade out fast, then pin an exact zero so the physical disconnect that
    // follows is sample-exact silence (no residual -52dB step = no hiss).
    const fadeSec = 0.09;
    try {
      this.voiceGain.gain.cancelScheduledValues(now);
      this.voiceGain.gain.setTargetAtTime(0.0, now, 0.015);
      this.voiceGain.gain.setValueAtTime(0.0, now + fadeSec);
    } catch (e) {}
    setTimeout(() => {
      if (gen !== this._gen) return; // retriggered -- never kill the new note
      if (this._filterConnected) {
        try { this.filter.disconnect(this.voiceGain); } catch (e) {}
        this._filterConnected = false;
      }
    }, (fadeSec + 0.05) * 1000);
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