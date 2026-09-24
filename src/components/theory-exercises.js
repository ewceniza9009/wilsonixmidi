/**
 * Theory Masterclass Exercises
 * Hands-on companion exercises for all 12 Music Theory modules.
 * Formatted as playable song objects compatible with PianoTutorCanvas.
 */

function buildExercise(meta, rawEvents) {
  // Normalize both events (ms) and notes (seconds) for 100% interoperability
  const events = rawEvents.map((e) => ({
    note: e.note,
    time: e.time,
    dur: e.dur || 1000,
    vel: e.vel || 85,
    hand: e.hand || (e.note >= 60 ? "right" : "left"),
    finger: e.finger,
  }));

  const notes = events.map((e) => ({
    note: e.note,
    time: Math.round((e.time / 1000) * 100) / 100,
    duration: Math.round((e.dur / 1000) * 100) / 100,
    velocity: e.vel,
    hand: e.hand,
    finger: e.finger,
  }));

  return {
    ...meta,
    events,
    notes,
  };
}

export const THEORY_EXERCISES = {
  // Module 1
  c_scale_intro: buildExercise(
    {
      id: "theory_c_scale",
      title: "Exercise 1: C Major Scale",
      subtitle: "Navigate 8 white keys (C4 to C5) with 1-2-3-1-2-3-4-5 fingering",
      bpm: 72,
      timeSignature: [4, 4],
      combi: "concert_grand_stage",
      durationMs: 19000,
    },
    [
      // Ascending
      { note: 60, time: 1200, dur: 800, vel: 85, hand: "right", finger: 1 },
      { note: 62, time: 2200, dur: 800, vel: 85, hand: "right", finger: 2 },
      { note: 64, time: 3200, dur: 800, vel: 85, hand: "right", finger: 3 },
      { note: 65, time: 4200, dur: 800, vel: 85, hand: "right", finger: 1 },
      { note: 67, time: 5200, dur: 800, vel: 85, hand: "right", finger: 2 },
      { note: 69, time: 6200, dur: 800, vel: 85, hand: "right", finger: 3 },
      { note: 71, time: 7200, dur: 800, vel: 85, hand: "right", finger: 4 },
      { note: 72, time: 8200, dur: 1400, vel: 90, hand: "right", finger: 5 },
      // Descending
      { note: 72, time: 10200, dur: 800, vel: 85, hand: "right", finger: 5 },
      { note: 71, time: 11200, dur: 800, vel: 85, hand: "right", finger: 4 },
      { note: 69, time: 12200, dur: 800, vel: 85, hand: "right", finger: 3 },
      { note: 67, time: 13200, dur: 800, vel: 85, hand: "right", finger: 2 },
      { note: 65, time: 14200, dur: 800, vel: 85, hand: "right", finger: 1 },
      { note: 64, time: 15200, dur: 800, vel: 85, hand: "right", finger: 3 },
      { note: 62, time: 16200, dur: 800, vel: 85, hand: "right", finger: 2 },
      { note: 60, time: 17200, dur: 1600, vel: 90, hand: "right", finger: 1 },
    ]
  ),

  // Module 2
  triads_intro: buildExercise(
    {
      id: "theory_triads",
      title: "Exercise 2: Basic Triads (1-3-5)",
      subtitle: "Strike Root + 3rd + 5th simultaneously: C Maj, F Maj, G Maj, A Min",
      bpm: 68,
      timeSignature: [4, 4],
      combi: "warm_acoustic_pad",
      durationMs: 14000,
    },
    [
      // 1. C Major (C4 - E4 - G4)
      { note: 60, time: 1200, dur: 2400, vel: 85, hand: "right", finger: 1 },
      { note: 64, time: 1200, dur: 2400, vel: 85, hand: "right", finger: 3 },
      { note: 67, time: 1200, dur: 2400, vel: 85, hand: "right", finger: 5 },
      // 2. F Major (F4 - A4 - C5)
      { note: 65, time: 4400, dur: 2400, vel: 85, hand: "right", finger: 1 },
      { note: 69, time: 4400, dur: 2400, vel: 85, hand: "right", finger: 3 },
      { note: 72, time: 4400, dur: 2400, vel: 85, hand: "right", finger: 5 },
      // 3. G Major (G4 - B4 - D5)
      { note: 67, time: 7600, dur: 2400, vel: 85, hand: "right", finger: 1 },
      { note: 71, time: 7600, dur: 2400, vel: 85, hand: "right", finger: 3 },
      { note: 74, time: 7600, dur: 2400, vel: 85, hand: "right", finger: 5 },
      // 4. A Minor (A4 - C5 - E5)
      { note: 69, time: 10800, dur: 2600, vel: 85, hand: "right", finger: 1 },
      { note: 72, time: 10800, dur: 2600, vel: 85, hand: "right", finger: 3 },
      { note: 76, time: 10800, dur: 2600, vel: 85, hand: "right", finger: 5 },
    ]
  ),

  // Module 3
  four_magic_chords: buildExercise(
    {
      id: "theory_magic_4",
      title: "Exercise 3: The 4 Magic Chords",
      subtitle: "I - V - vi - IV Progression (C - G - Am - F) that powers 100+ top hits",
      bpm: 74,
      timeSignature: [4, 4],
      combi: "concert_grand_stage",
      durationMs: 15000,
    },
    [
      // Measure 1: C Major (C3 bass + C4-E4-G4 chord)
      { note: 48, time: 1200, dur: 2500, vel: 90, hand: "left", finger: 5 },
      { note: 60, time: 1200, dur: 2500, vel: 85, hand: "right", finger: 1 },
      { note: 64, time: 1200, dur: 2500, vel: 85, hand: "right", finger: 3 },
      { note: 67, time: 1200, dur: 2500, vel: 85, hand: "right", finger: 5 },
      // Measure 2: G Major (G2 bass + B3-D4-G4 smooth voice lead)
      { note: 43, time: 4400, dur: 2500, vel: 90, hand: "left", finger: 5 },
      { note: 59, time: 4400, dur: 2500, vel: 85, hand: "right", finger: 1 },
      { note: 62, time: 4400, dur: 2500, vel: 85, hand: "right", finger: 2 },
      { note: 67, time: 4400, dur: 2500, vel: 85, hand: "right", finger: 5 },
      // Measure 3: A Minor (A2 bass + A3-C4-E4 chord)
      { note: 45, time: 7600, dur: 2500, vel: 90, hand: "left", finger: 5 },
      { note: 57, time: 7600, dur: 2500, vel: 85, hand: "right", finger: 1 },
      { note: 60, time: 7600, dur: 2500, vel: 85, hand: "right", finger: 3 },
      { note: 64, time: 7600, dur: 2500, vel: 85, hand: "right", finger: 5 },
      // Measure 4: F Major (F2 bass + A3-C4-F4 smooth voice lead)
      { note: 41, time: 10800, dur: 2500, vel: 90, hand: "left", finger: 5 },
      { note: 57, time: 10800, dur: 2500, vel: 85, hand: "right", finger: 1 },
      { note: 60, time: 10800, dur: 2500, vel: 85, hand: "right", finger: 2 },
      { note: 65, time: 10800, dur: 2500, vel: 85, hand: "right", finger: 5 },
    ]
  ),

  // Module 4
  nashville_numbers: buildExercise(
    {
      id: "theory_nashville",
      title: "Exercise 4: Nashville 1 - 5 - 6 - 4 Voice Leading",
      subtitle: "Anchor thumb on C4 or G4 to smoothly glide chords with minimal movement",
      bpm: 70,
      timeSignature: [4, 4],
      combi: "clean_electric_piano",
      durationMs: 15000,
    },
    [
      // 1 Chord: C
      { note: 48, time: 1200, dur: 2500, vel: 85, hand: "left", finger: 5 },
      { note: 60, time: 1200, dur: 2500, vel: 80, hand: "right", finger: 1 },
      { note: 64, time: 1200, dur: 2500, vel: 80, hand: "right", finger: 3 },
      { note: 67, time: 1200, dur: 2500, vel: 80, hand: "right", finger: 5 },
      // 5 Chord: G
      { note: 43, time: 4400, dur: 2500, vel: 85, hand: "left", finger: 5 },
      { note: 59, time: 4400, dur: 2500, vel: 80, hand: "right", finger: 1 },
      { note: 62, time: 4400, dur: 2500, vel: 80, hand: "right", finger: 2 },
      { note: 67, time: 4400, dur: 2500, vel: 80, hand: "right", finger: 5 },
      // 6 Chord: Am
      { note: 45, time: 7600, dur: 2500, vel: 85, hand: "left", finger: 5 },
      { note: 60, time: 7600, dur: 2500, vel: 80, hand: "right", finger: 1 },
      { note: 64, time: 7600, dur: 2500, vel: 80, hand: "right", finger: 3 },
      { note: 69, time: 7600, dur: 2500, vel: 80, hand: "right", finger: 5 },
      // 4 Chord: F
      { note: 41, time: 10800, dur: 2500, vel: 85, hand: "left", finger: 5 },
      { note: 60, time: 10800, dur: 2500, vel: 80, hand: "right", finger: 1 },
      { note: 65, time: 10800, dur: 2500, vel: 80, hand: "right", finger: 3 },
      { note: 69, time: 10800, dur: 2500, vel: 80, hand: "right", finger: 5 },
    ]
  ),

  // Module 5
  color_chords_ballad: buildExercise(
    {
      id: "theory_color_chords",
      title: "Exercise 5: Lush Color Chords Ballad",
      subtitle: "Cadd9 (C-D-E-G) -> Gsus4 (G-C-D) -> Am7 (A-C-E-G) -> Fadd9 (F-G-A-C)",
      bpm: 65,
      timeSignature: [4, 4],
      combi: "warm_acoustic_pad",
      durationMs: 16500,
    },
    [
      // Cadd9
      { note: 48, time: 1200, dur: 2800, vel: 85, hand: "left", finger: 5 },
      { note: 60, time: 1200, dur: 2800, vel: 80, hand: "right", finger: 1 },
      { note: 62, time: 1200, dur: 2800, vel: 80, hand: "right", finger: 2 },
      { note: 64, time: 1200, dur: 2800, vel: 80, hand: "right", finger: 3 },
      { note: 67, time: 1200, dur: 2800, vel: 80, hand: "right", finger: 5 },
      // Gsus4
      { note: 43, time: 4800, dur: 2800, vel: 85, hand: "left", finger: 5 },
      { note: 60, time: 4800, dur: 2800, vel: 80, hand: "right", finger: 1 },
      { note: 62, time: 4800, dur: 2800, vel: 80, hand: "right", finger: 2 },
      { note: 67, time: 4800, dur: 2800, vel: 80, hand: "right", finger: 5 },
      // Am7
      { note: 45, time: 8400, dur: 2800, vel: 85, hand: "left", finger: 5 },
      { note: 60, time: 8400, dur: 2800, vel: 80, hand: "right", finger: 1 },
      { note: 64, time: 8400, dur: 2800, vel: 80, hand: "right", finger: 3 },
      { note: 67, time: 8400, dur: 2800, vel: 80, hand: "right", finger: 5 },
      // Fadd9
      { note: 41, time: 12000, dur: 3200, vel: 85, hand: "left", finger: 5 },
      { note: 57, time: 12000, dur: 3200, vel: 80, hand: "right", finger: 1 },
      { note: 60, time: 12000, dur: 3200, vel: 80, hand: "right", finger: 2 },
      { note: 65, time: 12000, dur: 3200, vel: 80, hand: "right", finger: 4 },
      { note: 67, time: 12000, dur: 3200, vel: 80, hand: "right", finger: 5 },
    ]
  ),

  // Module 6
  pentatonic_solo_jam: buildExercise(
    {
      id: "theory_pentatonic",
      title: "Exercise 6: C Major Pentatonic Riff",
      subtitle: "Zero-clash notes: C (1) - D (2) - E (3) - G (5) - A (6) over a C base",
      bpm: 78,
      timeSignature: [4, 4],
      combi: "concert_grand_stage",
      durationMs: 12000,
    },
    [
      { note: 48, time: 1000, dur: 8000, vel: 90, hand: "left", finger: 5 },
      { note: 60, time: 1200, dur: 800, vel: 85, hand: "right", finger: 1 },
      { note: 62, time: 2200, dur: 800, vel: 85, hand: "right", finger: 2 },
      { note: 64, time: 3200, dur: 800, vel: 85, hand: "right", finger: 3 },
      { note: 67, time: 4200, dur: 800, vel: 85, hand: "right", finger: 4 },
      { note: 69, time: 5200, dur: 900, vel: 85, hand: "right", finger: 5 },
      { note: 67, time: 6400, dur: 900, vel: 85, hand: "right", finger: 4 },
      { note: 64, time: 7600, dur: 1200, vel: 90, hand: "right", finger: 3 },
      { note: 60, time: 8800, dur: 1600, vel: 90, hand: "right", finger: 1 },
    ]
  ),

  // Module 7
  two_five_one_turnaround: buildExercise(
    {
      id: "theory_two_five_one",
      title: "Exercise 7: The ii - V - I Jazz Turnaround",
      subtitle: "Dm7 -> G7 -> Cmaj7: The gold standard progression of jazz, R&B & gospel",
      bpm: 66,
      timeSignature: [4, 4],
      combi: "clean_electric_piano",
      durationMs: 13000,
    },
    [
      // Dm7 (ii)
      { note: 50, time: 1200, dur: 2600, vel: 85, hand: "left", finger: 5 },
      { note: 65, time: 1200, dur: 2600, vel: 80, hand: "right", finger: 1 },
      { note: 69, time: 1200, dur: 2600, vel: 80, hand: "right", finger: 3 },
      { note: 72, time: 1200, dur: 2600, vel: 80, hand: "right", finger: 5 },
      // G7 (V)
      { note: 43, time: 4800, dur: 2600, vel: 85, hand: "left", finger: 5 },
      { note: 65, time: 4800, dur: 2600, vel: 80, hand: "right", finger: 1 },
      { note: 71, time: 4800, dur: 2600, vel: 80, hand: "right", finger: 3 },
      { note: 74, time: 4800, dur: 2600, vel: 80, hand: "right", finger: 5 },
      // Cmaj7 (I)
      { note: 48, time: 8400, dur: 3200, vel: 90, hand: "left", finger: 5 },
      { note: 64, time: 8400, dur: 3200, vel: 80, hand: "right", finger: 1 },
      { note: 67, time: 8400, dur: 3200, vel: 80, hand: "right", finger: 3 },
      { note: 71, time: 8400, dur: 3200, vel: 80, hand: "right", finger: 5 },
    ]
  ),

  // Module 8
  ballad_arpeggio_comp: buildExercise(
    {
      id: "theory_ballad_comp",
      title: "Exercise 8: Left-Hand 1-5-10 Ballad Flow",
      subtitle: "Wide open arpeggios that fill the room without cluttering low frequencies",
      bpm: 68,
      timeSignature: [4, 4],
      combi: "concert_grand_stage",
      durationMs: 13000,
    },
    [
      // C Bar
      { note: 36, time: 1000, dur: 1200, vel: 85, hand: "left", finger: 5 },
      { note: 43, time: 1800, dur: 1200, vel: 80, hand: "left", finger: 2 },
      { note: 52, time: 2600, dur: 1600, vel: 80, hand: "left", finger: 1 },
      { note: 60, time: 3200, dur: 2000, vel: 85, hand: "right", finger: 1 },
      { note: 64, time: 3200, dur: 2000, vel: 85, hand: "right", finger: 3 },
      { note: 67, time: 3200, dur: 2000, vel: 85, hand: "right", finger: 5 },
      // Am Bar
      { note: 33, time: 6000, dur: 1200, vel: 85, hand: "left", finger: 5 },
      { note: 40, time: 6800, dur: 1200, vel: 80, hand: "left", finger: 2 },
      { note: 48, time: 7600, dur: 1600, vel: 80, hand: "left", finger: 1 },
      { note: 57, time: 8200, dur: 2200, vel: 85, hand: "right", finger: 1 },
      { note: 60, time: 8200, dur: 2200, vel: 85, hand: "right", finger: 3 },
      { note: 64, time: 8200, dur: 2200, vel: 85, hand: "right", finger: 5 },
    ]
  ),

  // Module 9
  gospel_passing_chords: buildExercise(
    {
      id: "theory_gospel_passing",
      title: "Exercise 9: Gospel Diminished Passing Chords",
      subtitle: "Glide from C to Dm with the tension-packed C#dim7 passing chord",
      bpm: 64,
      timeSignature: [4, 4],
      combi: "warm_acoustic_pad",
      durationMs: 12000,
    },
    [
      // C Major (I)
      { note: 48, time: 1200, dur: 2400, vel: 85, hand: "left", finger: 5 },
      { note: 60, time: 1200, dur: 2400, vel: 80, hand: "right", finger: 1 },
      { note: 64, time: 1200, dur: 2400, vel: 80, hand: "right", finger: 3 },
      { note: 67, time: 1200, dur: 2400, vel: 80, hand: "right", finger: 5 },
      // C#dim7 (Passing chord)
      { note: 49, time: 4200, dur: 2400, vel: 85, hand: "left", finger: 5 },
      { note: 58, time: 4200, dur: 2400, vel: 80, hand: "right", finger: 1 },
      { note: 61, time: 4200, dur: 2400, vel: 80, hand: "right", finger: 2 },
      { note: 64, time: 4200, dur: 2400, vel: 80, hand: "right", finger: 3 },
      { note: 67, time: 4200, dur: 2400, vel: 80, hand: "right", finger: 5 },
      // Dm7 (Resolution)
      { note: 50, time: 7200, dur: 3200, vel: 90, hand: "left", finger: 5 },
      { note: 57, time: 7200, dur: 3200, vel: 80, hand: "right", finger: 1 },
      { note: 60, time: 7200, dur: 3200, vel: 80, hand: "right", finger: 2 },
      { note: 65, time: 7200, dur: 3200, vel: 80, hand: "right", finger: 4 },
    ]
  ),

  // Module 10
  neo_soul_extensions: buildExercise(
    {
      id: "theory_neo_soul",
      title: "Exercise 10: Neo-Soul 9ths & Grace Slurs",
      subtitle: "Lush Dm9 and Cmaj9 chords with smooth thumb pedal notes",
      bpm: 65,
      timeSignature: [4, 4],
      combi: "clean_electric_piano",
      durationMs: 12000,
    },
    [
      // Dm9
      { note: 50, time: 1200, dur: 2800, vel: 85, hand: "left", finger: 5 },
      { note: 60, time: 1200, dur: 2800, vel: 80, hand: "right", finger: 1 },
      { note: 64, time: 1200, dur: 2800, vel: 80, hand: "right", finger: 2 },
      { note: 65, time: 1200, dur: 2800, vel: 80, hand: "right", finger: 3 },
      { note: 69, time: 1200, dur: 2800, vel: 80, hand: "right", finger: 5 },
      // G13
      { note: 43, time: 4600, dur: 2800, vel: 85, hand: "left", finger: 5 },
      { note: 59, time: 4600, dur: 2800, vel: 80, hand: "right", finger: 1 },
      { note: 64, time: 4600, dur: 2800, vel: 80, hand: "right", finger: 2 },
      { note: 65, time: 4600, dur: 2800, vel: 80, hand: "right", finger: 3 },
      { note: 69, time: 4600, dur: 2800, vel: 80, hand: "right", finger: 5 },
      // Cmaj9
      { note: 48, time: 8000, dur: 3200, vel: 90, hand: "left", finger: 5 },
      { note: 59, time: 8000, dur: 3200, vel: 80, hand: "right", finger: 1 },
      { note: 62, time: 8000, dur: 3200, vel: 80, hand: "right", finger: 2 },
      { note: 64, time: 8000, dur: 3200, vel: 80, hand: "right", finger: 3 },
      { note: 67, time: 8000, dur: 3200, vel: 80, hand: "right", finger: 5 },
    ]
  ),

  // Module 11
  blues_scale_groove: buildExercise(
    {
      id: "theory_blues_scale",
      title: "Exercise 11: The Blues Scale & The Crushed Note",
      subtitle: "1 - b3 - 4 - b5 - 5 - b7 (C - Eb - F - F# - G - Bb): Raw expressive grit",
      bpm: 76,
      timeSignature: [4, 4],
      combi: "concert_grand_stage",
      durationMs: 12000,
    },
    [
      { note: 48, time: 1000, dur: 8500, vel: 90, hand: "left", finger: 5 },
      { note: 60, time: 1200, dur: 700, vel: 85, hand: "right", finger: 1 },
      { note: 63, time: 2000, dur: 700, vel: 85, hand: "right", finger: 2 },
      { note: 65, time: 2800, dur: 700, vel: 85, hand: "right", finger: 3 },
      // Crushed note: F# into G
      { note: 66, time: 3500, dur: 200, vel: 80, hand: "right", finger: 3 },
      { note: 67, time: 3700, dur: 800, vel: 90, hand: "right", finger: 4 },
      { note: 70, time: 4700, dur: 800, vel: 85, hand: "right", finger: 5 },
      { note: 72, time: 5700, dur: 1600, vel: 90, hand: "right", finger: 5 },
    ]
  ),

  // Module 12
  epic_final_chorus_mod: buildExercise(
    {
      id: "theory_epic_modulation",
      title: "Exercise 12: Stage Climax Modulation (Key Change)",
      subtitle: "Lift the room by shifting up a semitone from C Major to Db Major",
      bpm: 72,
      timeSignature: [4, 4],
      combi: "power_ballad_1989",
      durationMs: 13000,
    },
    [
      // Verse/Chorus in C Major
      { note: 48, time: 1200, dur: 2400, vel: 85, hand: "left", finger: 5 },
      { note: 60, time: 1200, dur: 2400, vel: 80, hand: "right", finger: 1 },
      { note: 64, time: 1200, dur: 2400, vel: 80, hand: "right", finger: 3 },
      { note: 67, time: 1200, dur: 2400, vel: 80, hand: "right", finger: 5 },
      // Pivot Dominant (Ab7)
      { note: 44, time: 4400, dur: 2400, vel: 90, hand: "left", finger: 5 },
      { note: 56, time: 4400, dur: 2400, vel: 85, hand: "right", finger: 1 },
      { note: 60, time: 4400, dur: 2400, vel: 85, hand: "right", finger: 2 },
      { note: 63, time: 4400, dur: 2400, vel: 85, hand: "right", finger: 4 },
      { note: 66, time: 4400, dur: 2400, vel: 85, hand: "right", finger: 5 },
      // Modulated Climax in Db Major!
      { note: 49, time: 7600, dur: 3600, vel: 95, hand: "left", finger: 5 },
      { note: 61, time: 7600, dur: 3600, vel: 90, hand: "right", finger: 1 },
      { note: 65, time: 7600, dur: 3600, vel: 90, hand: "right", finger: 3 },
      { note: 68, time: 7600, dur: 3600, vel: 90, hand: "right", finger: 5 },
    ]
  ),
};
