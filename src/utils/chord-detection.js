/**
 * Chord detection utilities: turn a set of held MIDI notes into a human
 * readable chord name in real time. Pure functions, no DOM/audio coupling —
 * safe for unit tests.
 *
 * Strategy: collect pitch classes, then try the BASS note as root first
 * (standard root-position preference); if no known template matches, fall
 * back to other candidate roots so inverted voicings (e.g. E-G-C) still
 * resolve to their true chord (C Major) instead of a bogus root.
 */

const PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Templates: semitone intervals relative to a candidate root.
// Listed from RICHEST to leanest so full extensions (Maj9, 9, m9) resolve
// before their subsets (Maj7, 7, m7), which resolve before the triads.
const TEMPLATES = [
  { intervals: [0, 4, 7, 11, 2], name: "Maj9" },
  { intervals: [0, 4, 7, 10, 2], name: "9" },
  { intervals: [0, 3, 7, 10, 2], name: "m9" },
  { intervals: [0, 3, 7, 11], name: "mMaj7" },
  { intervals: [0, 4, 7, 11], name: "Maj7" },
  { intervals: [0, 3, 6, 10], name: "m7b5" },
  { intervals: [0, 3, 6, 9], name: "Dim7" },
  { intervals: [0, 4, 7, 10], name: "7" },
  { intervals: [0, 3, 7, 10], name: "m7" },
  { intervals: [0, 4, 7, 9], name: "6" },
  { intervals: [0, 3, 7, 9], name: "m6" },
  { intervals: [0, 4, 7, 2], name: "Add9" },
  { intervals: [0, 2, 7], name: "Sus2" },
  { intervals: [0, 5, 7], name: "Sus4" },
  { intervals: [0, 3, 6], name: "Dim" },
  { intervals: [0, 4, 8], name: "Aug" },
  { intervals: [0, 4, 7], name: "Major" },
  { intervals: [0, 3, 7], name: "Minor" },
  { intervals: [0, 7], name: "5th" },
];

export function midiToNoteName(midi) {
  const oct = Math.floor(midi / 12) - 1;
  return `${PC_NAMES[((midi % 12) + 12) % 12]}${oct}`;
}

export function midiToPitchClass(midi) {
  return PC_NAMES[((midi % 12) + 12) % 12];
}

/**
 * Identify the chord formed by `notes` (array of integer MIDI note numbers).
 * @param {number[]} notes
 * @returns {{name: string, root: number, rootName: string, pitchClasses: number[],
 *            hasThird: boolean, isChord: boolean}}
 */
export function identifyChord(notes) {
  if (!Array.isArray(notes) || notes.length === 0) {
    return {
      name: "",
      root: null,
      rootName: "",
      pitchClasses: [],
      hasThird: false,
      isChord: false,
    };
  }

  const sorted = [...new Set(notes.map((n) => Math.round(n)))].sort((a, b) => a - b);
  const pcs = [...new Set(sorted.map((n) => ((n % 12) + 12) % 12))];
  const bass = sorted[0];

  if (pcs.length === 1) {
    return {
      name: PC_NAMES[pcs[0]],
      root: pcs[0],
      rootName: PC_NAMES[pcs[0]],
      pitchClasses: pcs,
      hasThird: false,
      isChord: false,
    };
  }

  // Candidate roots: bass first, then every other played pitch class ascending.
  const bassPc = ((bass % 12) + 12) % 12;
  const candidateRoots = [bassPc, ...pcs.filter((pc) => pc !== bassPc)];

  for (const root of candidateRoots) {
    const intervals = [...new Set(pcs.map((pc) => ((pc - root) % 12 + 12) % 12))].sort(
      (a, b) => a - b,
    );
    for (const tpl of TEMPLATES) {
      const hit = tpl.intervals.every((iv) => intervals.includes(iv));
      if (hit) {
        // A voicing counts as an EXECUTED chord once it has 2+ notes, whether
        // or not it carries a 3rd (power chord = G 5th, no third).
        const hasThird = tpl.intervals.includes(4) || tpl.intervals.includes(3);
        return {
          name: `${PC_NAMES[root]} ${tpl.name}`,
          root,
          rootName: PC_NAMES[root],
          pitchClasses: pcs,
          hasThird,
          isChord: pcs.length >= 2,
        };
      }
    }
  }

  // No known template: fall back to the bass root with a generic label.
  const isChord = pcs.length >= 2;
  return {
    name: isChord ? `${PC_NAMES[bassPc]} Chord` : PC_NAMES[bassPc],
    root: bassPc,
    rootName: PC_NAMES[bassPc],
    pitchClasses: pcs,
    hasThird: false,
    isChord,
  };
}

/**
 * Pitch-class signature for a chord: invertible/octave-independent identity
 * used to dedupe consecutive identical chords in history (C E G and E G C are
 * the same harmony across octaves).
 * @param {number[]} notes
 * @returns {string}
 */
export function chordSignature(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return "";
  const pcs = [...new Set(notes.map((n) => ((n % 12) + 12) % 12))].sort((a, b) => a - b);
  return `${pcs.length}:${pcs.join(",")}`;
}