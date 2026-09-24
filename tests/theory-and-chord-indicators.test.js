import { test } from "node:test";
import assert from "node:assert/strict";
import { PianoTutorCanvas } from "../src/components/piano-tutor-canvas.js";
import { THEORY_MODULES } from "../src/components/theory-course-deck.js";
import { THEORY_EXERCISES } from "../src/components/theory-exercises.js";

test("PianoTutorCanvas._identifyChord correctly names basic and complex chords", () => {
  const tutor = new PianoTutorCanvas(null, null);

  // Single note or empty
  assert.equal(tutor._identifyChord([]), "");
  assert.equal(tutor._identifyChord([60]), "");

  // Major triad (C4, E4, G4)
  assert.equal(tutor._identifyChord([60, 64, 67]), "C Major");

  // Minor triad (A3, C4, E4)
  assert.equal(tutor._identifyChord([57, 60, 64]), "A Minor");

  // Sus4 (G3, C4, D4)
  assert.equal(tutor._identifyChord([55, 60, 62]), "G Sus4");

  // Add9 (C4, D4, E4, G4)
  assert.equal(tutor._identifyChord([60, 62, 64, 67]), "C Add9");

  // Maj7 (C4, E4, G4, B4)
  assert.equal(tutor._identifyChord([60, 64, 67, 71]), "C Maj7");

  // Dominant 7 (G3, B3, D4, F4)
  assert.equal(tutor._identifyChord([55, 59, 62, 65]), "G 7");

  // Minor 7 (A3, C4, E4, G4)
  assert.equal(tutor._identifyChord([57, 60, 64, 67]), "A m7");

  // Diminished (B3, D4, F4)
  assert.equal(tutor._identifyChord([59, 62, 65]), "B Dim");

  // Octave (C4, C5)
  assert.equal(tutor._identifyChord([60, 72]), "C Octave");

  // 5th / Power chord (C4, G4)
  assert.equal(tutor._identifyChord([60, 67]), "C 5th");

  tutor.dispose();
});

test("PianoTutorCanvas clusters simultaneous notes into chords and marks isChord", () => {
  const chordSong = {
    id: "test-chord-song",
    title: "Simultaneous Chord Test",
    durationMs: 4000,
    events: [
      // Simultaneous C Major triad at 500ms
      { time: 500, note: 60, vel: 90, dur: 1000 },
      { time: 500, note: 64, vel: 90, dur: 1000 },
      { time: 500, note: 67, vel: 90, dur: 1000 },
      // Single melody note at 2000ms
      { time: 2000, note: 72, vel: 85, dur: 400 },
    ],
  };

  const tutor = new PianoTutorCanvas(null, null);
  tutor.loadSong(chordSong);

  assert.equal(tutor.events.length, 4);

  // The first 3 events should be flagged as chords
  const chordEvents = tutor.events.filter(e => e.time === 500);
  assert.equal(chordEvents.length, 3);
  for (const ev of chordEvents) {
    assert.equal(ev.isChord, true);
    assert.deepEqual(ev.chordNotes.sort(), [60, 64, 67]);
    assert.equal(ev.chordName, "C Major");
  }

  // The 4th note is a single melody note
  const singleNote = tutor.events.find(e => e.time === 2000);
  assert.equal(singleNote.isChord, false);

  tutor.dispose();
});

test("PianoTutorCanvas step-by-step chord fulfillment in Wait Mode", () => {
  let lastWaitNotes = null;
  let lastSatisfiedNotes = null;
  let lastChordName = null;

  const tutor = new PianoTutorCanvas(null, null, {
    mode: "wait",
    speed: 1.0,
    onWaitNotesChange: (pending, satisfied, chordName) => {
      lastWaitNotes = pending;
      lastSatisfiedNotes = satisfied;
      lastChordName = chordName;
    },
  });

  const chordSong = {
    id: "chord-wait-test",
    title: "Wait Mode Chord Test",
    durationMs: 4000,
    events: [
      { time: 500, note: 60, vel: 90, dur: 800 },
      { time: 500, note: 64, vel: 90, dur: 800 },
      { time: 500, note: 67, vel: 90, dur: 800 },
    ],
  };

  tutor.loadSong(chordSong);
  tutor.isPlaying = true;
  tutor.currentTimeMs = 500; // Arrive at hit line

  // Simulate arriving at hit line with C Major chord
  tutor.isWaitingForKey = true;
  tutor.pendingWaitNotes = new Set([60, 64, 67]);
  tutor.satisfiedWaitNotes = new Set();
  tutor.currentChordName = "C Major";

  assert.equal(tutor.isWaitingForKey, true);
  assert.deepEqual(Array.from(tutor.pendingWaitNotes).sort(), [60, 64, 67]);

  // User strikes the first key C4 (60)
  tutor.handleUserNote(60, true);
  assert.equal(tutor.isWaitingForKey, true, "Still waiting for remaining 2 notes");
  assert.deepEqual(Array.from(tutor.satisfiedWaitNotes), [60]);
  assert.deepEqual(Array.from(tutor.pendingWaitNotes).sort(), [64, 67]);
  assert.deepEqual(lastWaitNotes.sort(), [64, 67]);
  assert.deepEqual(lastSatisfiedNotes, [60]);
  assert.equal(lastChordName, "C Major");

  // User strikes second key E4 (64)
  tutor.handleUserNote(64, true);
  assert.equal(tutor.isWaitingForKey, true, "Still waiting for G4");
  assert.deepEqual(Array.from(tutor.satisfiedWaitNotes).sort(), [60, 64]);
  assert.deepEqual(Array.from(tutor.pendingWaitNotes), [67]);

  // User strikes third key G4 (67)
  tutor.handleUserNote(67, true);
  assert.equal(tutor.isWaitingForKey, false, "All chord keys satisfied, resumes rolling!");
  assert.equal(tutor.satisfiedWaitNotes.size, 0);
  assert.equal(tutor.pendingWaitNotes.size, 0);

  tutor.dispose();
});

test("THEORY_MODULES contains all 12 comprehensive masterclass lessons", () => {
  assert.equal(THEORY_MODULES.length, 12);

  const expectedIds = [
    "mod1", "mod2", "mod3", "mod4", "mod5", "mod6",
    "mod7", "mod8", "mod9", "mod10", "mod11", "mod12"
  ];
  assert.deepEqual(THEORY_MODULES.map(m => m.id), expectedIds);

  for (const mod of THEORY_MODULES) {
    assert.ok(mod.title.length > 5, `Module ${mod.id} has title`);
    assert.ok(mod.intro.length > 10, `Module ${mod.id} has intro`);
    assert.ok(mod.html.length > 50, `Module ${mod.id} has rich HTML`);
  }

  // Verify Pro Keyboardist mindset module contents (Module 4)
  const proMod = THEORY_MODULES.find(m => m.id === "mod4");
  assert.ok(proMod.html.includes("Nashville Number System"), "Covers Nashville Number System");
  assert.ok(proMod.html.includes("Voice Leading"), "Covers Voice Leading");
  assert.ok(proMod.html.includes("Pedal Hygiene"), "Covers Pedal Hygiene");
  assert.ok(proMod.html.includes("The Pocket"), "Covers Comping in The Pocket");
});

test("THEORY_EXERCISES provides structured playable songs for interactive practice", () => {
  const keys = Object.keys(THEORY_EXERCISES);
  assert.equal(keys.length, 12, "All 12 modules have corresponding interactive exercises");

  for (const [key, song] of Object.entries(THEORY_EXERCISES)) {
    assert.ok(song.id, `${key} has id`);
    assert.ok(song.title, `${key} has title`);
    assert.ok(song.notes && song.notes.length > 0, `${key} has notes array`);
    assert.ok(song.bpm > 0, `${key} has bpm`);
    assert.ok(song.combi, `${key} has combi preset`);

    // Verify all note values are valid MIDI numbers (21 to 108)
    for (const n of song.notes) {
      assert.ok(n.note >= 21 && n.note <= 108, `Note ${n.note} in ${key} is valid MIDI key`);
      assert.ok(n.time >= 0, `Note time in ${key} is >= 0`);
      assert.ok(n.duration > 0, `Note duration in ${key} is > 0`);
    }
  }
});

test("PianoTutorCanvas loads all THEORY_EXERCISES with active falling events and chord ribbons", () => {
  const tutor = new PianoTutorCanvas(null, null);

  for (const [key, exerciseSong] of Object.entries(THEORY_EXERCISES)) {
    tutor.loadSong(exerciseSong);
    assert.ok(tutor.events.length > 0, `Exercise ${key} has active falling events`);
    assert.ok(tutor.durationMs > 5000, `Exercise ${key} durationMs is set`);
  }

  // Specifically verify Exercise 2 (triads_intro) has clustered chords
  tutor.loadSong(THEORY_EXERCISES.triads_intro);
  const firstChordGroup = tutor.events.filter(e => e.time === 1200);
  assert.equal(firstChordGroup.length, 3, "C Major triad has 3 notes");
  for (const ev of firstChordGroup) {
    assert.equal(ev.isChord, true);
    assert.equal(ev.chordName, "C Major");
  }

  tutor.dispose();
});

