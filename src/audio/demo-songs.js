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
];