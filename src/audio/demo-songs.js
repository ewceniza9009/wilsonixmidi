/**
 * Demo Station Song Library
 * 30-second interactive clips played live through the MIDIKey engine.
 * (Original compositions based on popular chord progressions.)
 */

import { WHITNEY_30S_EVENTS } from "./whitney-demo-player.js";

// Build a soft rolled chord event group: root + triad notes voiced low-to-high,
// staggered by `rollMs` for a gentle arpeggiated strike. Each note sustains `durMs`.
function rolledChord(startMs, notes, { durMs = 3600, vel = 72, rollMs = 90 } = {}) {
  const events = [];
  notes.forEach((n, i) => {
    events.push({ time: startMs + i * rollMs, note: n, vel: vel - i * 2, dur: durMs - i * 60 });
  });
  return events;
}

// A single pad/harmony block held by the sustain pedal: rolled chord + top melody note.
function pad(startMs, chordNotes, melody, { durMs = 3400, vel = 70, mVel = 82 } = {}) {
  const events = rolledChord(startMs, chordNotes, { durMs, vel, rollMs: 110 });
  if (melody !== null && melody !== undefined) {
    events.push({ time: startMs + 340, note: melody, vel: mVel, dur: durMs * 0.45 });
  }
  return events;
}

export const DEMO_SONGS = [
  {
    id: "whitney_ihavenothing",
    title: "I Have Nothing",
    subtitle: "Whitney Houston - classic power ballad (Foster rig, full voicing)",
    combi: "whitney_ballad",
    fxPreset: "whitney_ballad",
    durationMs: 30000,
    embeddedInsts: ["acoustic_grand_piano", "string_ensemble_1", "electric_piano_1"],
    events: WHITNEY_30S_EVENTS,
  },
  {
    id: "ethereal_fm_ballad",
    title: "Ethereal FM Ballad",
    subtitle: "Original 80s ballad on the DX7 E.Piano 1 (F#m - Bm - E - A)",
    combi: "rooftop_cathedral",
    fxPreset: "rooftop_cathedral",
    durationMs: 30000,
    embeddedInsts: ["string_ensemble_1"],
    soundfontInsts: ["electric_piano_2"],
    events: [
      { time: 0, type: "pedal", down: true },
      ...pad(120, [42, 57, 61, 66], 69, { durMs: 3600, vel: 72, mVel: 84 }),
      ...pad(4000, [47, 62, 66, 71], 71, { durMs: 3400, vel: 70 }),
      ...pad(7900, [40, 56, 59, 64], 68, { durMs: 3400, vel: 70 }),
      ...pad(11800, [45, 61, 64, 69], 69, { durMs: 3600, vel: 72 }),
      ...pad(15700, [38, 54, 57, 62], 62, { durMs: 3400, vel: 70 }),
      ...pad(19600, [45, 61, 64, 69], 67, { durMs: 3400, vel: 68 }),
      ...pad(23500, [40, 56, 59, 64], 64, { durMs: 3400, vel: 70 }),
      { time: 27400, type: "pedal", down: false },
      { time: 27420, type: "pedal", down: true },
      ...pad(27480, [42, 57, 61, 66], 71, { durMs: 4000, vel: 74, mVel: 88 }),
      { time: 29600, type: "pedal", down: false },
    ],
  },
  {
    id: "neosoul_afterglow",
    title: "Neo-Soul Afterglow",
    subtitle: "Original 90s R&B groove on Rhodes & strings (F#m9 - B13 - Emaj9 - C#m11)",
    combi: "smooth_rnb",
    fxPreset: "smooth_rnb",
    durationMs: 30000,
    embeddedInsts: ["electric_piano_1", "string_ensemble_1"],
    events: [
      { time: 0, type: "pedal", down: true },
      ...pad(80, [42, 49, 54, 57, 61, 66], 73, { durMs: 3400, vel: 74, mVel: 80, rollMs: 70 }),
      ...pad(3950, [47, 54, 57, 61, 64, 66], 71, { durMs: 3400, vel: 72, rollMs: 70 }),
      ...pad(7820, [40, 47, 51, 54, 59, 63], 68, { durMs: 3400, vel: 72, rollMs: 70 }),
      ...pad(11690, [37, 49, 56, 59, 61, 66], 66, { durMs: 3400, vel: 70, rollMs: 70 }),
      ...pad(15560, [45, 52, 57, 61, 66, 69], 69, { durMs: 3400, vel: 72, mVel: 82, rollMs: 70 }),
      ...pad(19430, [38, 50, 53, 57, 62, 65], 67, { durMs: 3400, vel: 70, rollMs: 70 }),
      ...pad(23300, [43, 50, 55, 59, 62, 67], 71, { durMs: 3200, vel: 70, mVel: 84, rollMs: 70 }),
      { time: 27200, note: 74, vel: 84, dur: 200 },
      { time: 27600, note: 73, vel: 82, dur: 200 },
      { time: 28000, note: 71, vel: 82, dur: 1600 },
      { time: 29600, type: "pedal", down: false },
    ],
  },
  {
id: "sergio_never_let_go",
    title: "Never Gonna Let You Go",
    subtitle: "Sergio Mendes - F#m7-Bm7-E7-A(add9)-D(add9) harmony, 133 BPM (smooth 80s EP & strings)",
    combi: "smooth_rnb",
    fxPreset: "smooth_rnb",
    durationMs: 30000,
    embeddedInsts: ["electric_piano_1", "string_ensemble_1"],
    soundfontInsts: ["alto_sax"],
    events: [
      { time: 0, type: "pedal", down: true },
      // ========== INTRO (133 BPM, 1 bar per chord) ==========
      // F#m7 rising EP figure
      ...rolledChord(100, [42, 54, 57, 61, 66], { durMs: 1600, vel: 70, rollMs: 60 }),
      { time: 500, note: 69, vel: 84, dur: 400 },
      { time: 1000, note: 71, vel: 82, dur: 400 },
      { time: 1500, note: 73, vel: 82, dur: 600 },
      // Bm7
      ...rolledChord(1904, [47, 54, 57, 62, 66], { durMs: 1600, vel: 68, rollMs: 60 }),
      { time: 2200, note: 71, vel: 82, dur: 400 },
      { time: 2700, note: 69, vel: 80, dur: 400 },
      { time: 3300, note: 66, vel: 80, dur: 450 },
      // E7
      ...rolledChord(3708, [40, 52, 56, 59, 62], { durMs: 1500, vel: 68, rollMs: 60 }),
      { time: 4300, note: 64, vel: 84, dur: 600 },
      // A(add9)
      ...rolledChord(5512, [45, 52, 57, 61, 64, 69], { durMs: 1600, vel: 72, rollMs: 60 }),
      { time: 6000, note: 73, vel: 84, dur: 350 },
      { time: 6600, note: 69, vel: 80, dur: 500 },
      // ========== VERSE 1 ==========
      // F#m7 (i7) - chord + melodic hit + THE LICK
      ...rolledChord(7316, [42, 54, 57, 61, 66], { durMs: 1600, vel: 68, rollMs: 60 }),
      { time: 7800, note: 73, vel: 90, dur: 500 },
      { time: 8400, note: 71, vel: 84, dur: 350 },
      { time: 9000, note: 69, vel: 82, dur: 400 },
      { time: 8116, note: 66, vel: 72, dur: 160 },
      { time: 8296, note: 68, vel: 74, dur: 160 },
      { time: 8476, note: 69, vel: 78, dur: 200 },
      { time: 8656, note: 71, vel: 72, dur: 160 },
      { time: 8836, note: 73, vel: 80, dur: 300 },
      // Bm7 (iv7)
      ...rolledChord(9120, [47, 54, 57, 62, 66], { durMs: 1600, vel: 68, rollMs: 60 }),
      { time: 9600, note: 71, vel: 86, dur: 500 },
      { time: 10500, note: 62, vel: 78, dur: 400 },
      { time: 9920, note: 66, vel: 70, dur: 160 },
      { time: 10100, note: 68, vel: 72, dur: 160 },
      { time: 10280, note: 71, vel: 76, dur: 200 },
      { time: 10460, note: 73, vel: 70, dur: 160 },
      { time: 10640, note: 74, vel: 78, dur: 300 },
      // E7 (VII)
      ...rolledChord(10924, [40, 52, 56, 59, 62], { durMs: 1600, vel: 68, rollMs: 60 }),
      { time: 11400, note: 73, vel: 88, dur: 400 },
      { time: 11900, note: 71, vel: 84, dur: 400 },
      { time: 12500, note: 64, vel: 80, dur: 500 },
      { time: 11724, note: 64, vel: 72, dur: 150 },
      { time: 11904, note: 66, vel: 74, dur: 150 },
      { time: 12084, note: 68, vel: 78, dur: 180 },
      { time: 12264, note: 71, vel: 72, dur: 160 },
      { time: 12444, note: 73, vel: 82, dur: 300 },
      // A(add9) (III)
      ...rolledChord(12728, [45, 52, 57, 61, 64, 69], { durMs: 1600, vel: 70, rollMs: 60 }),
      { time: 13200, note: 73, vel: 88, dur: 500 },
      { time: 14000, note: 69, vel: 80, dur: 400 },
      { time: 13528, note: 61, vel: 70, dur: 150 },
      { time: 13708, note: 64, vel: 72, dur: 150 },
      { time: 13888, note: 66, vel: 76, dur: 180 },
      { time: 14068, note: 69, vel: 70, dur: 160 },
      { time: 14248, note: 71, vel: 80, dur: 300 },
      // D(add9) (VI)
      ...rolledChord(14532, [38, 50, 54, 57, 62, 66], { durMs: 1600, vel: 70, rollMs: 60 }),
      { time: 15100, note: 71, vel: 86, dur: 500 },
      { time: 15800, note: 66, vel: 80, dur: 400 },
      { time: 15332, note: 66, vel: 72, dur: 150 },
      { time: 15512, note: 69, vel: 74, dur: 150 },
      { time: 15692, note: 71, vel: 78, dur: 180 },
      { time: 15872, note: 73, vel: 70, dur: 160 },
      { time: 16052, note: 74, vel: 82, dur: 300 },
      // F#m7 (i7) - turnaround
      ...rolledChord(16336, [42, 54, 57, 61, 66], { durMs: 1600, vel: 68, rollMs: 60 }),
      { time: 16800, note: 71, vel: 86, dur: 500 },
      { time: 17136, note: 71, vel: 72, dur: 150 },
      { time: 17316, note: 73, vel: 74, dur: 150 },
      { time: 17496, note: 74, vel: 78, dur: 180 },
      { time: 17676, note: 73, vel: 70, dur: 160 },
      { time: 17856, note: 71, vel: 80, dur: 300 },
      // ========== CASCADE: E7 -> Bm7 ==========
      ...rolledChord(18140, [40, 52, 56, 59, 62], { durMs: 1300, vel: 68, rollMs: 50 }),
      { time: 18500, note: 74, vel: 84, dur: 300 },
      ...rolledChord(18942, [47, 54, 57, 62, 66], { durMs: 1300, vel: 68, rollMs: 50 }),
      { time: 19400, note: 71, vel: 84, dur: 400 },
      // ========== F#m7 LANDING (held 2 bars) ==========
      ...rolledChord(19744, [42, 54, 57, 61, 66, 73], { durMs: 2900, vel: 74, rollMs: 60 }),
      { time: 20900, note: 69, vel: 84, dur: 500 },
      { time: 21700, note: 66, vel: 80, dur: 600 },
      // ========== OUTRO VAMP (F#m - Bm - E - A loop reprise) ==========
      ...rolledChord(21948, [42, 54, 57, 61, 66], { durMs: 1600, vel: 68, rollMs: 60 }),
      { time: 22848, note: 69, vel: 76, dur: 150 },
      { time: 23028, note: 71, vel: 78, dur: 150 },
      { time: 23208, note: 73, vel: 80, dur: 300 },
      ...rolledChord(23752, [47, 54, 57, 62, 66], { durMs: 1600, vel: 68, rollMs: 60 }),
      { time: 24200, note: 71, vel: 82, dur: 400 },
      { time: 24552, note: 66, vel: 74, dur: 150 },
      { time: 24732, note: 68, vel: 76, dur: 150 },
      { time: 24912, note: 71, vel: 78, dur: 300 },
      ...rolledChord(25556, [40, 52, 56, 59, 62], { durMs: 1500, vel: 66, rollMs: 60 }),
      { time: 26100, note: 64, vel: 82, dur: 500 },
      { time: 26356, note: 64, vel: 74, dur: 150 },
      { time: 26536, note: 66, vel: 76, dur: 150 },
      { time: 26716, note: 68, vel: 78, dur: 300 },
      ...rolledChord(27360, [45, 52, 57, 61, 64, 69], { durMs: 1600, vel: 70, rollMs: 60 }),
      { time: 27800, note: 73, vel: 86, dur: 500 },
      { time: 28600, note: 69, vel: 80, dur: 700 },
      { time: 29600, type: "pedal", down: false },
    ],
  },
];