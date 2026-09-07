/**
 * Ableton-Style Real-time Arpeggiator & Note Repeater
 * Generates tempo-synced rhythmic note patterns from currently held keys or chord pads.
 */

import { synthEngine } from "../audio/synth-engine.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";

export class Arpeggiator {
  constructor() {
    this.enabled = false;
    this.bpm = 120;
    this.rateDivision = 0.5; // 1/8th note default (0.25 = 1/16th, 0.5 = 1/8th, 1.0 = 1/4)
    this.pattern = "up"; // 'up', 'down', 'updown', 'random'
    this.octaveRange = 1; // 1, 2, 3 octaves
    this.gateLength = 0.75; // 75% note duration

    this.timer = null;
    this.currentStep = 0;
    this.activeArpNote = null;

    this.heldNotes = [];
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(240, bpm));
    if (this.enabled) {
      this.restart();
    }
  }

  setPattern(pattern) {
    this.pattern = pattern;
    this.currentStep = 0;
  }

  setRate(div) {
    this.rateDivision = div;
    if (this.enabled) {
      this.restart();
    }
  }

  setOctaveRange(octs) {
    this.octaveRange = Math.max(1, Math.min(3, octs));
  }

  start() {
    if (this.timer) clearInterval(this.timer);
    const intervalMs = (60 / this.bpm) * this.rateDivision * 1000;
    this.timer = setInterval(this.tick.bind(this), intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.activeArpNote !== null) {
      multiLayerEngine.noteOff(this.activeArpNote);
      this.activeArpNote = null;
    }
    this.currentStep = 0;
  }

  restart() {
    this.stop();
    if (this.enabled) this.start();
  }

  tick() {
    if (!this.enabled) return;

    // Release previously struck arp note
    if (this.activeArpNote !== null) {
      multiLayerEngine.noteOff(this.activeArpNote);
      this.activeArpNote = null;
    }

    const baseNotes = Array.from(synthEngine.heldNotes).sort((a, b) => a - b);
    if (baseNotes.length === 0) return;

    // Expand notes across octaves
    let pool = [];
    for (let o = 0; o < this.octaveRange; o++) {
      baseNotes.forEach(n => pool.push(n + o * 12));
    }

    let noteToPlay = null;

    switch (this.pattern) {
      case "up":
        noteToPlay = pool[this.currentStep % pool.length];
        this.currentStep = (this.currentStep + 1) % pool.length;
        break;

      case "down":
        const reversed = [...pool].reverse();
        noteToPlay = reversed[this.currentStep % reversed.length];
        this.currentStep = (this.currentStep + 1) % reversed.length;
        break;

      case "updown":
        const upDown = [...pool];
        for (let i = pool.length - 2; i > 0; i--) upDown.push(pool[i]);
        noteToPlay = upDown[this.currentStep % upDown.length];
        this.currentStep = (this.currentStep + 1) % upDown.length;
        break;

      case "random":
        noteToPlay = pool[Math.floor(Math.random() * pool.length)];
        break;
    }

    if (noteToPlay !== null) {
      this.activeArpNote = noteToPlay;
      multiLayerEngine.noteOn(noteToPlay, 105);

      const noteDurationMs = (60 / this.bpm) * this.rateDivision * this.gateLength * 1000;
      setTimeout(() => {
        if (this.activeArpNote === noteToPlay) {
          multiLayerEngine.noteOff(noteToPlay);
          this.activeArpNote = null;
        }
      }, noteDurationMs);
    }
  }
}

export const arpeggiator = new Arpeggiator();
