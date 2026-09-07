/**
 * Laptop QWERTY Keyboard Controller & Smart Chord Engine
 * Features:
 * - TWO-TIER MELODY LAYOUT (Continuous white-key diatonic scale on Q-P and Z-/)
 * - DAW HOME-ROW PIANO LAYOUT (Ableton / FL Studio style)
 * - SMART CHORD ENGINE (Single-key 7th, 9th/11th Neo-Soul/Gospel, and Diminished voicings)
 * - Anti-stutter OS key-repeat filter, instant velocity accents, and realistic Damper/Sustain Pedal
 */

import { synthEngine } from "../audio/synth-engine.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";

// Layout 1: Continuous Two-Tier Melody Layout (Natural scale along letter rows - easy song playback!)
const MELODY_KEYMAP = {
  // Upper Tier White Keys (C4 to G5)
  KeyQ: { noteOffset: 0, octOffset: 0, label: "Q" }, // C4
  KeyW: { noteOffset: 2, octOffset: 0, label: "W" }, // D4
  KeyE: { noteOffset: 4, octOffset: 0, label: "E" }, // E4
  KeyR: { noteOffset: 5, octOffset: 0, label: "R" }, // F4
  KeyT: { noteOffset: 7, octOffset: 0, label: "T" }, // G4
  KeyY: { noteOffset: 9, octOffset: 0, label: "Y" }, // A4
  KeyU: { noteOffset: 11, octOffset: 0, label: "U" }, // B4
  KeyI: { noteOffset: 12, octOffset: 0, label: "I" }, // C5
  KeyO: { noteOffset: 14, octOffset: 0, label: "O" }, // D5
  KeyP: { noteOffset: 16, octOffset: 0, label: "P" }, // E5
  BracketLeft: { noteOffset: 17, octOffset: 0, label: "[" }, // F5
  BracketRight: { noteOffset: 19, octOffset: 0, label: "]" }, // G5

  // Upper Number Row Black Keys (Accidentals)
  Digit2: { noteOffset: 1, octOffset: 0, label: "2" }, // C#4
  Digit3: { noteOffset: 3, octOffset: 0, label: "3" }, // D#4
  Digit5: { noteOffset: 6, octOffset: 0, label: "5" }, // F#4
  Digit6: { noteOffset: 8, octOffset: 0, label: "6" }, // G#4
  Digit7: { noteOffset: 10, octOffset: 0, label: "7" }, // A#4
  Digit9: { noteOffset: 13, octOffset: 0, label: "9" }, // C#5
  Digit0: { noteOffset: 15, octOffset: 0, label: "0" }, // D#5
  Equal: { noteOffset: 18, octOffset: 0, label: "=" }, // F#5

  // Lower Tier White Keys (C3 to E4)
  KeyZ: { noteOffset: 0, octOffset: -1, label: "Z" }, // C3
  KeyX: { noteOffset: 2, octOffset: -1, label: "X" }, // D3
  KeyC: { noteOffset: 4, octOffset: -1, label: "C" }, // E3
  KeyV: { noteOffset: 5, octOffset: -1, label: "V" }, // F3
  KeyB: { noteOffset: 7, octOffset: -1, label: "B" }, // G3
  KeyN: { noteOffset: 9, octOffset: -1, label: "N" }, // A3
  KeyM: { noteOffset: 11, octOffset: -1, label: "M" }, // B3
  Comma: { noteOffset: 12, octOffset: -1, label: "," }, // C4
  Period: { noteOffset: 14, octOffset: -1, label: "." }, // D4
  Slash: { noteOffset: 16, octOffset: -1, label: "/" }, // E4

  // Lower Home Row Black Keys (Accidentals)
  KeyS: { noteOffset: 1, octOffset: -1, label: "S" }, // C#3
  KeyD: { noteOffset: 3, octOffset: -1, label: "D" }, // D#3
  KeyG: { noteOffset: 6, octOffset: -1, label: "G" }, // F#3
  KeyH: { noteOffset: 8, octOffset: -1, label: "H" }, // G#3
  KeyJ: { noteOffset: 10, octOffset: -1, label: "J" }, // A#3
  KeyL: { noteOffset: 13, octOffset: -1, label: "L" }, // C#4
  Semicolon: { noteOffset: 15, octOffset: -1, label: ";" }, // D#4
};

// Layout 2: Standard DAW Home-Row Piano Layout (Ableton / FL Studio)
const DAW_KEYMAP = {
  // Home Row White Keys
  KeyA: { noteOffset: 0, octOffset: 0, label: "A" }, // C4
  KeyS: { noteOffset: 2, octOffset: 0, label: "S" }, // D4
  KeyD: { noteOffset: 4, octOffset: 0, label: "D" }, // E4
  KeyF: { noteOffset: 5, octOffset: 0, label: "F" }, // F4
  KeyG: { noteOffset: 7, octOffset: 0, label: "G" }, // G4
  KeyH: { noteOffset: 9, octOffset: 0, label: "H" }, // A4
  KeyJ: { noteOffset: 11, octOffset: 0, label: "J" }, // B4
  KeyK: { noteOffset: 12, octOffset: 0, label: "K" }, // C5
  KeyL: { noteOffset: 14, octOffset: 0, label: "L" }, // D5
  Semicolon: { noteOffset: 16, octOffset: 0, label: ";" }, // E5
  Quote: { noteOffset: 17, octOffset: 0, label: "'" }, // F5

  // QWERTY Row Black Keys
  KeyW: { noteOffset: 1, octOffset: 0, label: "W" }, // C#4
  KeyE: { noteOffset: 3, octOffset: 0, label: "E" }, // D#4
  KeyT: { noteOffset: 6, octOffset: 0, label: "T" }, // F#4
  KeyY: { noteOffset: 8, octOffset: 0, label: "Y" }, // G#4
  KeyU: { noteOffset: 10, octOffset: 0, label: "U" }, // A#4
  KeyO: { noteOffset: 13, octOffset: 0, label: "O" }, // C#5
  KeyP: { noteOffset: 15, octOffset: 0, label: "P" }, // D#5
  BracketLeft: { noteOffset: 18, octOffset: 0, label: "[" }, // F#5
  BracketRight: { noteOffset: 20, octOffset: 0, label: "]" }, // G#5

  // Lower Row Bass Keys
  KeyZ: { noteOffset: 0, octOffset: -1, label: "Z" }, // C3
  KeyX: { noteOffset: 2, octOffset: -1, label: "X" }, // D3
  KeyC: { noteOffset: 4, octOffset: -1, label: "C" }, // E3
  KeyV: { noteOffset: 5, octOffset: -1, label: "V" }, // F3
  KeyB: { noteOffset: 7, octOffset: -1, label: "B" }, // G3
  KeyN: { noteOffset: 9, octOffset: -1, label: "N" }, // A3
  KeyM: { noteOffset: 11, octOffset: -1, label: "M" }, // B3
  Comma: { noteOffset: 12, octOffset: -1, label: "," }, // C4
  Period: { noteOffset: 14, octOffset: -1, label: "." }, // D4
  Slash: { noteOffset: 16, octOffset: -1, label: "/" }, // E4
};

export class QwertyKeyboard {
  constructor() {
    this.baseOctave = 4; // C4 Middle C default
    this.velocity = 95; // Standard Mezzo-Forte
    this.layoutMode = "melody"; // 'melody' (default: Q-P melody) or 'daw' (A-' home row)
    this.chordMode = "off"; // 'off', '7th', '9th', 'dim'
    this.activeChordMap = new Map(); // KeyCode -> [midiNote, ...]
    this.enabled = true;
    this.sustainPedal = false;
    this.sustainLatched = false;
    this.onStateChangeCallback = null;
    this.onChordVisualCallback = null; // (notes, isPressed) => void

    this.bindEvents();
  }

  get activeKeyMap() {
    return this.layoutMode === "melody" ? MELODY_KEYMAP : DAW_KEYMAP;
  }

  bindEvents() {
    if (typeof window === "undefined") return;
    window.addEventListener("keydown", this.handleKeyDown.bind(this), { capture: true });
    window.addEventListener("keyup", this.handleKeyUp.bind(this), { capture: true });
  }

  /**
   * Generates sophisticated, rich open-voiced chords for gospel, worship, neo-soul, and pop.
   */
  generateSmartVoicing(rootMidi, chordMode) {
    if (chordMode === "off") return [rootMidi];

    const pitchClass = rootMidi % 12; // 0=C, 2=D, 4=E, 5=F, 7=G, 9=A, 11=B
    const bass = rootMidi - 12;

    if (chordMode === "7th") {
      // Diatonic 7th Voicings with deep sub-bass root
      switch (pitchClass) {
        case 0: // C Major 7th
          return [bass, rootMidi, rootMidi + 4, rootMidi + 7, rootMidi + 11];
        case 2: // D Minor 7th
          return [bass, rootMidi, rootMidi + 3, rootMidi + 7, rootMidi + 10];
        case 4: // E Minor 7th
          return [bass, rootMidi, rootMidi + 3, rootMidi + 7, rootMidi + 10];
        case 5: // F Major 7th
          return [bass, rootMidi, rootMidi + 4, rootMidi + 7, rootMidi + 11];
        case 7: // G Dominant 7th
          return [bass, rootMidi, rootMidi + 4, rootMidi + 7, rootMidi + 10];
        case 9: // A Minor 7th
          return [bass, rootMidi, rootMidi + 3, rootMidi + 7, rootMidi + 10];
        case 11: // B Half-Diminished (Bm7b5)
          return [bass, rootMidi, rootMidi + 3, rootMidi + 6, rootMidi + 10];
        default: // Altered / Accidental Dominant 7ths
          return [bass, rootMidi, rootMidi + 4, rootMidi + 7, rootMidi + 10];
      }
    }

    if (chordMode === "9th") {
      // Pro Gospel / Neo-Soul / Worship 9th & 11th Open Spread Voicings
      switch (pitchClass) {
        case 0: // Cmaj9 (C-G-B-D-E)
          return [bass, rootMidi + 7, rootMidi + 11, rootMidi + 14, rootMidi + 16];
        case 2: // Dm9 (D-A-C-E-F)
          return [bass, rootMidi + 7, rootMidi + 10, rootMidi + 14, rootMidi + 15];
        case 4: // Em11 (E-B-D-G-A)
          return [bass, rootMidi + 7, rootMidi + 10, rootMidi + 15, rootMidi + 17];
        case 5: // Fmaj9 (F-C-E-G-A)
          return [bass, rootMidi + 7, rootMidi + 11, rootMidi + 14, rootMidi + 16];
        case 7: // G13sus / G9 (G-F-A-C-E)
          return [bass, rootMidi + 5, rootMidi + 10, rootMidi + 14, rootMidi + 16];
        case 9: // Am11 (A-G-C-D-E)
          return [bass, rootMidi + 7, rootMidi + 10, rootMidi + 14, rootMidi + 15];
        case 11: // Bdim7 / Bm7b5(b9)
          return [bass, rootMidi + 6, rootMidi + 10, rootMidi + 14, rootMidi + 17];
        default: // Altered 9th
          return [bass, rootMidi + 7, rootMidi + 10, rootMidi + 14, rootMidi + 16];
      }
    }

    if (chordMode === "dim") {
      // Symmetrical Diminished 7th (Stacked Minor 3rds - Perfect Gospel Turnarounds)
      return [bass, rootMidi, rootMidi + 3, rootMidi + 6, rootMidi + 9];
    }

    return [rootMidi];
  }

  handleKeyDown(e) {
    if (!this.enabled) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;

    // CRITICAL: Always suppress browser/OS default for mapped music keys — even on repeat!
    // Without this, Windows plays its system alert "toot" sound on held keys (R+T+U, V+B+M etc.)
    const mapping = this.activeKeyMap[e.code];
    if (mapping) {
      e.preventDefault();
    }

    // Don't re-trigger notes on OS key repeat, but preventDefault was already called above
    if (e.repeat) return;

    // Spacebar = Damper / Sustain Pedal
    if (e.code === "Space") {
      e.preventDefault();
      this.setSustainPedal(true);
      return;
    }

    // Octave Shifting: Minus / Plus or NumPad
    if (e.code === "Minus" || e.code === "NumpadSubtract") {
      e.preventDefault();
      this.shiftOctave(-1);
      return;
    }
    if ((e.code === "Equal" && e.shiftKey) || e.code === "NumpadAdd") {
      e.preventDefault();
      this.shiftOctave(1);
      return;
    }

    // Backquote / Tilde (`~`): Cycle Smart Chord Voicing Mode
    if (e.code === "Backquote") {
      e.preventDefault();
      this.cycleChordMode();
      return;
    }

    // F2: Cycle Keyboard Layout (Melody <-> DAW)
    if (e.code === "F2") {
      e.preventDefault();
      this.cycleLayoutMode();
      return;
    }

    // Panic Kill Switch: Escape
    if (e.code === "Escape") {
      e.preventDefault();
      synthEngine.panic();
      multiLayerEngine.panic();
      this.activeChordMap.clear();
      return;
    }

    if (mapping && !this.activeChordMap.has(e.code)) {
      let hitVel = this.velocity;
      if (e.shiftKey) hitVel = 122;

      const rootMidi = (this.baseOctave + 1 + mapping.octOffset) * 12 + mapping.noteOffset;
      const chordNotes = this.generateSmartVoicing(rootMidi, this.chordMode);

      this.activeChordMap.set(e.code, chordNotes);

      // Trigger multi-layer PCM engine
      chordNotes.forEach((note, idx) => {
        // Balance voicing velocities: root bass is warm, top melody is clear
        const v = idx === 0 ? Math.min(127, hitVel + 5) : hitVel;
        multiLayerEngine.noteOn(note, v);
      });

      // Visual key feedback
      if (this.onChordVisualCallback) {
        this.onChordVisualCallback(chordNotes, true, hitVel);
      }
    }
  }

  handleKeyUp(e) {
    if (!this.enabled) return;

    if (e.code === "Space") {
      e.preventDefault();
      if (!this.sustainLatched) {
        this.setSustainPedal(false);
      }
      return;
    }

    // Always preventDefault for mapped keys to suppress any Windows system sounds
    const mapping = this.activeKeyMap[e.code];
    if (mapping) {
      e.preventDefault();
    }

    if (this.activeChordMap.has(e.code)) {
      const chordNotes = this.activeChordMap.get(e.code);
      this.activeChordMap.delete(e.code);

      chordNotes.forEach(note => {
        multiLayerEngine.noteOff(note);
      });

      if (this.onChordVisualCallback) {
        this.onChordVisualCallback(chordNotes, false);
      }
    }
  }

  cycleChordMode() {
    const modes = ["off", "7th", "9th", "dim"];
    const curIdx = modes.indexOf(this.chordMode);
    this.chordMode = modes[(curIdx + 1) % modes.length];
    if (this.onStateChangeCallback) this.onStateChangeCallback();
  }

  setChordMode(mode) {
    if (["off", "7th", "9th", "dim"].includes(mode)) {
      this.chordMode = mode;
      if (this.onStateChangeCallback) this.onStateChangeCallback();
    }
  }

  cycleLayoutMode() {
    this.layoutMode = this.layoutMode === "melody" ? "daw" : "melody";
    if (this.onStateChangeCallback) this.onStateChangeCallback();
  }

  setLayoutMode(mode) {
    if (mode === "melody" || mode === "daw") {
      this.layoutMode = mode;
      if (this.onStateChangeCallback) this.onStateChangeCallback();
    }
  }

  setSustainPedal(isDown) {
    this.sustainPedal = !!isDown;
    multiLayerEngine.setSustainPedal(this.sustainPedal);
    synthEngine.setSustainPedal(this.sustainPedal);
    if (this.onStateChangeCallback) this.onStateChangeCallback();
  }

  toggleSustainLatch() {
    this.sustainLatched = !this.sustainLatched;
    this.setSustainPedal(this.sustainLatched);
  }

  shiftOctave(delta) {
    this.baseOctave = Math.max(1, Math.min(7, this.baseOctave + delta));
    if (this.onStateChangeCallback) this.onStateChangeCallback();
  }

  setVelocity(val) {
    this.velocity = Math.max(10, Math.min(127, val));
    if (this.onStateChangeCallback) this.onStateChangeCallback();
  }
}

export const qwertyKeyboard = new QwertyKeyboard();
