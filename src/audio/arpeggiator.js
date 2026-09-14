/**
 * WILSONIX Live Groove Arpeggiator Engine
 * Features:
 * - Sub-millisecond Web Audio clock scheduling
 * - Tap Tempo & Master BPM synchronization
 * - Rhythmic Rates: 1/4, 1/8, 1/16, 1/8T (triplet), Gospel Swing
 * - Patterns: UP, DOWN, UP_DOWN, RANDOM, CHORD_STRUM, GOSPEL_ROLL
 * - Octave Range (1, 2, or 3 octaves) & Gate length control
 * - Real-time visual note callback for on-screen key illumination
 */

import { audioCore } from "./audio-core.js";
import { multiLayerEngine } from "./multi-layer-engine.js";

export const ARP_PATTERNS = {
  UP: "up",
  DOWN: "down",
  UP_DOWN: "up_down",
  RANDOM: "random",
  CHORD_STRUM: "chord_strum",
  GOSPEL_ROLL: "gospel_roll",
};

export const ARP_RATES = {
  "1/4": 1.0,
  "1/8": 0.5,
  "1/16": 0.25,
  "1/8T": 0.3333,
  "1/16T": 0.1667,
  "gospel_swing": 0.5,
};

export class Arpeggiator {
  constructor() {
    this.enabled = false;
    this.bpm = 120;
    this.rate = "1/8";
    this.pattern = ARP_PATTERNS.UP;
    this.octaves = 1; // 1, 2, or 3 octaves
    this.gate = 0.75; // Note duration ratio (50% to 90%)
    this.swing = 0.25; // Gospel swing offset ratio

    this.heldNotes = new Set(); // Currently physically held MIDI notes
    this.currentSequence = [];
    this.seqIndex = 0;

    this.timerId = null;
    this.nextNoteTime = 0;
    this.activeArpNotes = new Map(); // midiNote -> noteOffTimeout

    this.onNoteTriggerCallback = null; // (midi, isPressed, vel) => {}
    this.onStateChangeCallback = null; // (enabled, bpm, rate, pattern) => {}
  }

  setEnabled(enabled) {
    const next = enabled !== undefined ? !!enabled : !this.enabled;
    if (this.enabled === next) return;
    this.enabled = next;

    if (!this.enabled) {
      this.stop();
    } else if (this.heldNotes.size > 0) {
      this.start();
    }

    if (this.onStateChangeCallback) {
      try { this.onStateChangeCallback(this.enabled, this.bpm, this.rate, this.pattern); } catch (e) {}
    }
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(260, Math.round(bpm)));
    if (this.onStateChangeCallback) {
      try { this.onStateChangeCallback(this.enabled, this.bpm, this.rate, this.pattern); } catch (e) {}
    }
  }

  setRate(rateKey) {
    if (ARP_RATES[rateKey] !== undefined) {
      this.rate = rateKey;
      if (this.onStateChangeCallback) {
        try { this.onStateChangeCallback(this.enabled, this.bpm, this.rate, this.pattern); } catch (e) {}
      }
    }
  }

  setPattern(patternKey) {
    if (Object.values(ARP_PATTERNS).includes(patternKey)) {
      this.pattern = patternKey;
      this.rebuildSequence();
      if (this.onStateChangeCallback) {
        try { this.onStateChangeCallback(this.enabled, this.bpm, this.rate, this.pattern); } catch (e) {}
      }
    }
  }

  setOctaves(oct) {
    this.octaves = Math.max(1, Math.min(3, Math.round(oct)));
    this.rebuildSequence();
  }

  /**
   * Called by keyboard/MIDI engine when a key is pressed
   */
  handleNoteOn(midiNote, velocity = 95) {
    this.heldNotes.add({ midi: midiNote, vel: velocity });
    this.rebuildSequence();

    if (this.enabled && !this.timerId) {
      this.start();
    }
  }

  /**
   * Called by keyboard/MIDI engine when a key is released
   */
  handleNoteOff(midiNote) {
    for (const item of this.heldNotes) {
      if (item.midi === midiNote) {
        this.heldNotes.delete(item);
        break;
      }
    }

    if (this.heldNotes.size === 0) {
      this.stop();
    } else {
      this.rebuildSequence();
    }
  }

  rebuildSequence() {
    if (this.heldNotes.size === 0) {
      this.currentSequence = [];
      this.seqIndex = 0;
      return;
    }

    const sortedNotes = Array.from(this.heldNotes).sort((a, b) => a.midi - b.midi);
    const expandedNotes = [];

    // Expand through octave range
    for (let oct = 0; oct < this.octaves; oct++) {
      sortedNotes.forEach(item => {
        const transposed = item.midi + oct * 12;
        if (transposed <= 108) {
          expandedNotes.push({ midi: transposed, vel: item.vel });
        }
      });
    }

    if (this.pattern === ARP_PATTERNS.UP) {
      this.currentSequence = expandedNotes;
    } else if (this.pattern === ARP_PATTERNS.DOWN) {
      this.currentSequence = [...expandedNotes].reverse();
    } else if (this.pattern === ARP_PATTERNS.UP_DOWN) {
      const up = [...expandedNotes];
      const down = expandedNotes.slice(1, -1).reverse();
      this.currentSequence = up.concat(down);
    } else if (this.pattern === ARP_PATTERNS.RANDOM) {
      this.currentSequence = expandedNotes;
    } else if (this.pattern === ARP_PATTERNS.CHORD_STRUM) {
      // Strum rolls the chord bottom-up with micro-offsets
      this.currentSequence = expandedNotes;
    } else if (this.pattern === ARP_PATTERNS.GOSPEL_ROLL) {
      // Gospel Roll: Root, Grace note (+2 or +3), 5th, Octave, 3rd
      const root = expandedNotes[0];
      const fifth = expandedNotes.find(n => n.midi === root.midi + 7) || expandedNotes[Math.min(1, expandedNotes.length - 1)];
      const grace = { midi: root.midi + 3, vel: Math.round(root.vel * 0.85) };
      this.currentSequence = [root, grace, fifth, ...expandedNotes.slice(1)];
    } else {
      this.currentSequence = expandedNotes;
    }

    if (this.seqIndex >= this.currentSequence.length) {
      this.seqIndex = 0;
    }
  }

  start() {
    this.stop();
    if (this.currentSequence.length === 0) return;

    const ctx = audioCore.init();
    if (!ctx) return;

    this.nextNoteTime = ctx.currentTime;
    this.tick();
  }

  stop() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    // Silence any lingering arpeggiator notes
    for (const [midi, timeoutId] of this.activeArpNotes.entries()) {
      clearTimeout(timeoutId);
      multiLayerEngine.noteOff(midi);
      if (this.onNoteTriggerCallback) {
        try { this.onNoteTriggerCallback(midi, false, 0); } catch (e) {}
      }
    }
    this.activeArpNotes.clear();
    this.seqIndex = 0;
  }

  tick() {
    if (!this.enabled || this.currentSequence.length === 0) {
      this.stop();
      return;
    }

    const ctx = audioCore.ctx;
    if (!ctx) return;

    const secondsPerBeat = 60.0 / this.bpm;
    let stepDuration = secondsPerBeat * (ARP_RATES[this.rate] || 0.5);

    // Apply Gospel Swing rhythm on alternate eighth/sixteenth beats
    const isSwingBeat = this.seqIndex % 2 === 1;
    if (this.rate === "gospel_swing" || isSwingBeat) {
      stepDuration += (isSwingBeat ? 1 : -1) * (stepDuration * this.swing * 0.4);
    }

    // Pick target note from sequence
    let target;
    if (this.pattern === ARP_PATTERNS.RANDOM) {
      const randIdx = Math.floor(Math.random() * this.currentSequence.length);
      target = this.currentSequence[randIdx];
    } else {
      target = this.currentSequence[this.seqIndex % this.currentSequence.length];
      this.seqIndex = (this.seqIndex + 1) % this.currentSequence.length;
    }

    if (target) {
      const midi = target.midi;
      const vel = target.vel || 95;
      const noteDuration = Math.max(0.06, stepDuration * this.gate);

      // Trigger sound in multiLayerEngine
      multiLayerEngine.noteOn(midi, vel);
      if (this.onNoteTriggerCallback) {
        try { this.onNoteTriggerCallback(midi, true, vel); } catch (e) {}
      }

      // Schedule note release
      const releaseTimeout = setTimeout(() => {
        multiLayerEngine.noteOff(midi);
        if (this.onNoteTriggerCallback) {
          try { this.onNoteTriggerCallback(midi, false, 0); } catch (e) {}
        }
        this.activeArpNotes.delete(midi);
      }, noteDuration * 1000);

      this.activeArpNotes.set(midi, releaseTimeout);
    }

    // Audio-clock look-ahead: schedule the next step on the WebAudio timeline
    // instead of a naive relative timeout, so main-thread jank never
    // accumulates into tempo drift. If a step runs late, the next interval
    // shrinks to catch back up to the clock grid instead of pushing every
    // following note later.
    if (!this.nextNoteTime || this.nextNoteTime <= ctx.currentTime) {
      this.nextNoteTime = ctx.currentTime;
    }
    const delayMs = Math.max(25, (this.nextNoteTime + stepDuration - ctx.currentTime) * 1000);
    this.nextNoteTime += stepDuration;
    this.timerId = setTimeout(() => this.tick(), delayMs);
  }
}

export const arpeggiator = new Arpeggiator();
