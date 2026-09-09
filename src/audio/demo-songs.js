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
    subtitle: "Sergio Mendes - F#m7-Bm7-E7-A(add9)-D(add9) harmony, 66 BPM (smooth 80s EP & strings)",
    combi: "smooth_rnb",
    fxPreset: "smooth_rnb",
    durationMs: 30000,
    embeddedInsts: ["electric_piano_1", "string_ensemble_1"],
    soundfontInsts: ["alto_sax"],
    events: [
      { time: 0, type: "pedal", down: true },
      // ========== INTRO ==========
      // F#m7 rising EP figure
      ...rolledChord(100, [42, 54, 57, 61, 66], { durMs: 3400, vel: 70, rollMs: 90 }),
      { time: 1500, note: 69, vel: 84, dur: 550 },
      { time: 2200, note: 71, vel: 84, dur: 550 },
      { time: 3000, note: 73, vel: 82, dur: 900 },
      { time: 4200, note: 73, vel: 86, dur: 450 },
      { time: 4700, note: 71, vel: 82, dur: 400 },
      { time: 5200, note: 69, vel: 80, dur: 400 },
      { time: 5800, note: 66, vel: 82, dur: 700 },
      // ========== VERSE 1 ==========
      // F#m7 (i7) - chord + lick
      ...rolledChord(7300, [42, 54, 57, 61, 66], { durMs: 3000, vel: 68, rollMs: 80 }),
      { time: 7900, note: 73, vel: 90, dur: 700 },
      { time: 8750, note: 71, vel: 84, dur: 400 },
      { time: 9200, note: 69, vel: 84, dur: 550 },
      { time: 9950, note: 66, vel: 82, dur: 950 },
      // THE LICK! (F#m7 pentatonic fill)
      { time: 10200, note: 66, vel: 72, dur: 180 },
      { time: 10380, note: 68, vel: 74, dur: 180 },
      { time: 10560, note: 69, vel: 78, dur: 250 },
      { time: 10800, note: 71, vel: 72, dur: 200 },
      { time: 10980, note: 73, vel: 80, dur: 350 },
      // Bm7 (iv7)
      ...rolledChord(11200, [47, 54, 57, 62, 66], { durMs: 3000, vel: 68, rollMs: 80 }),
      { time: 11600, note: 71, vel: 86, dur: 600 },
      { time: 12400, note: 62, vel: 78, dur: 450 },
      { time: 12900, note: 66, vel: 80, dur: 450 },
      { time: 13600, note: 71, vel: 86, dur: 900 },
      // THE LICK (Bm7)
      { time: 13900, note: 66, vel: 70, dur: 180 },
      { time: 14080, note: 68, vel: 72, dur: 180 },
      { time: 14260, note: 71, vel: 76, dur: 250 },
      { time: 14500, note: 73, vel: 70, dur: 200 },
      { time: 14680, note: 74, vel: 78, dur: 350 },
      // E7 (VII)
      ...rolledChord(14800, [40, 52, 56, 59, 62], { durMs: 3000, vel: 68, rollMs: 80 }),
      { time: 15200, note: 73, vel: 88, dur: 400 },
      { time: 15700, note: 71, vel: 84, dur: 500 },
      { time: 16400, note: 68, vel: 80, dur: 400 },
      { time: 17000, note: 64, vel: 80, dur: 900 },
      // THE LICK (E7 blues)
      { time: 17300, note: 64, vel: 72, dur: 160 },
      { time: 17460, note: 66, vel: 74, dur: 160 },
      { time: 17620, note: 68, vel: 78, dur: 220 },
      { time: 17840, note: 71, vel: 72, dur: 180 },
      { time: 18020, note: 73, vel: 82, dur: 400 },
      // A(add9) (III)
      ...rolledChord(18200, [45, 52, 57, 61, 64, 69], { durMs: 3000, vel: 70, rollMs: 80 }),
      { time: 18900, note: 73, vel: 88, dur: 700 },
      { time: 19900, note: 69, vel: 80, dur: 450 },
      { time: 20400, note: 64, vel: 78, dur: 450 },
      { time: 21100, note: 61, vel: 78, dur: 850 },
      // THE LICK (A major pentatonic)
      { time: 21400, note: 61, vel: 70, dur: 160 },
      { time: 21560, note: 64, vel: 72, dur: 160 },
      { time: 21720, note: 66, vel: 76, dur: 220 },
      { time: 21940, note: 69, vel: 70, dur: 180 },
      { time: 22120, note: 71, vel: 80, dur: 350 },
      // D(add9) (VI)
      ...rolledChord(22300, [38, 50, 54, 57, 62, 66], { durMs: 3000, vel: 70, rollMs: 80 }),
      { time: 22600, note: 71, vel: 86, dur: 600 },
      { time: 23300, note: 66, vel: 80, dur: 400 },
      { time: 23800, note: 62, vel: 78, dur: 450 },
      { time: 24500, note: 66, vel: 84, dur: 900 },
      // THE LICK (D major pentatonic)
      { time: 24800, note: 66, vel: 72, dur: 160 },
      { time: 24960, note: 69, vel: 74, dur: 160 },
      { time: 25120, note: 71, vel: 78, dur: 220 },
      { time: 25340, note: 73, vel: 70, dur: 180 },
      { time: 25520, note: 74, vel: 82, dur: 400 },
      // ========== TURNAROUND ==========
      // Bm7 (iv7)
      ...rolledChord(25750, [47, 54, 57, 62, 66], { durMs: 1500, vel: 66, rollMs: 60 }),
      { time: 26100, note: 71, vel: 84, dur: 550 },
      // LICK (Bm7 turnaround)
      { time: 26350, note: 71, vel: 72, dur: 140 },
      { time: 26490, note: 73, vel: 74, dur: 140 },
      { time: 26630, note: 74, vel: 78, dur: 200 },
      { time: 26830, note: 73, vel: 70, dur: 160 },
      { time: 26990, note: 71, vel: 80, dur: 300 },
      // E7 (VII)
      ...rolledChord(27200, [40, 52, 56, 59, 62], { durMs: 1500, vel: 66, rollMs: 60 }),
      { time: 27900, note: 73, vel: 86, dur: 400 },
      { time: 28400, note: 74, vel: 82, dur: 350 },
      // FINAL LICK (climax to F#m7)
      { time: 28650, note: 74, vel: 76, dur: 140 },
      { time: 28790, note: 73, vel: 78, dur: 140 },
      { time: 28930, note: 71, vel: 82, dur: 200 },
      { time: 29130, note: 69, vel: 80, dur: 180 },
      { time: 29310, note: 66, vel: 84, dur: 400 },
      // F#m7 (i) - landing chord
      ...rolledChord(29450, [42, 54, 57, 61, 66, 73], { durMs: 800, vel: 74, rollMs: 60 }),
      { time: 29600, type: "pedal", down: false },
    ],
  },
];