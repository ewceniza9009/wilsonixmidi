/**
 * WILSONIX Smart "Zero Wrong Notes" Scale Lock Engine
 * Musical scale quantizer and key highlighter for live touchscreen performance.
 */

export const ROOT_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const SCALES = {
  chromatic: {
    id: "chromatic",
    name: "OFF (Chromatic)",
    short: "OFF",
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  major: {
    id: "major",
    name: "Major (Ionian)",
    short: "MAJ",
    intervals: [0, 2, 4, 5, 7, 9, 11],
  },
  natural_minor: {
    id: "natural_minor",
    name: "Natural Minor (Aeolian)",
    short: "MIN",
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  harmonic_minor: {
    id: "harmonic_minor",
    name: "Harmonic Minor",
    short: "H-MIN",
    intervals: [0, 2, 3, 5, 7, 8, 11],
  },
  pentatonic_major: {
    id: "pentatonic_major",
    name: "Pentatonic Major",
    short: "P-MAJ",
    intervals: [0, 2, 4, 7, 9],
  },
  pentatonic_minor: {
    id: "pentatonic_minor",
    name: "Pentatonic Minor",
    short: "P-MIN",
    intervals: [0, 3, 5, 7, 10],
  },
  gospel_blues: {
    id: "gospel_blues",
    name: "Gospel Blues Scale",
    short: "GOSPEL",
    intervals: [0, 3, 4, 5, 6, 7, 10],
  },
  dorian: {
    id: "dorian",
    name: "Dorian (Santana/Funk)",
    short: "DORIAN",
    intervals: [0, 2, 3, 5, 7, 9, 10],
  },
};

export class ScaleLock {
  constructor() {
    this.rootNote = 0; // 0 = C, 1 = C#, ... 11 = B
    this.scaleId = "chromatic";
    this.snapMode = "snap"; // "snap" (quantum quantize to nearest in-key note) or "mute"
    this.listeners = new Set();
  }

  get isLocked() {
    return this.scaleId !== "chromatic";
  }

  setRootNote(rootIdx) {
    this.rootNote = Math.max(0, Math.min(11, Math.round(rootIdx)));
    this.notify();
  }

  setScale(scaleId) {
    if (SCALES[scaleId]) {
      this.scaleId = scaleId;
      this.notify();
    }
  }

  isNoteInScale(midiNote) {
    if (!this.isLocked) return true;
    const scale = SCALES[this.scaleId] || SCALES.chromatic;
    const semitone = (midiNote % 12 - this.rootNote + 12) % 12;
    return scale.intervals.includes(semitone);
  }

  /**
   * Snaps an incoming MIDI note to the nearest valid scale degree
   */
  snapToScale(midiNote) {
    if (!this.isLocked) return midiNote;
    const scale = SCALES[this.scaleId] || SCALES.chromatic;
    const currentSemitone = (midiNote % 12 - this.rootNote + 12) % 12;

    if (scale.intervals.includes(currentSemitone)) {
      return midiNote;
    }

    if (this.snapMode === "mute") {
      return null;
    }

    // Find closest valid scale interval
    let bestDelta = 999;
    let bestInterval = scale.intervals[0];

    for (const interval of scale.intervals) {
      const delta = Math.abs(currentSemitone - interval);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestInterval = interval;
      }
    }

    const octBase = Math.floor(midiNote / 12) * 12;
    const snapped = octBase + this.rootNote + bestInterval;
    return Math.max(21, Math.min(108, snapped));
  }

  notify() {
    const detail = {
      isLocked: this.isLocked,
      rootNote: this.rootNote,
      rootName: ROOT_NAMES[this.rootNote],
      scaleId: this.scaleId,
      scale: SCALES[this.scaleId],
    };

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wilsonix-scale-lock-changed", { detail }));
    }

    for (const cb of this.listeners) {
      try { cb(detail); } catch (e) {}
    }
  }

  addListener(cb) {
    if (typeof cb === "function") this.listeners.add(cb);
  }

  removeListener(cb) {
    this.listeners.delete(cb);
  }
}

export const scaleLock = new ScaleLock();
