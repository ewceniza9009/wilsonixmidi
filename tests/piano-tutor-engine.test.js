import { test } from "node:test";
import assert from "node:assert/strict";
import { PianoTutorCanvas } from "../src/components/piano-tutor-canvas.js";

const sampleSong = {
  id: "test-song",
  title: "Test Song",
  subtitle: "Tutor Test",
  durationMs: 5000,
  combi: "rock_piano",
  events: [
    { time: 100, note: 48, vel: 80, dur: 300 }, // C3 (Left Hand < 60)
    { time: 200, note: 60, vel: 90, dur: 400 }, // C4 (Right Hand >= 60)
    { time: 500, note: 64, vel: 95, dur: 350 }, // E4 (Right Hand >= 60)
    { time: 800, note: 67, vel: 85, dur: 300 }, // G4 (Right Hand >= 60)
    { time: 1000, note: 55, vel: 75, dur: 500 }, // G3 (Left Hand < 60)
  ],
};

test("PianoTutorCanvas instantiates and cleans up safely without DOM", () => {
  const tutor = new PianoTutorCanvas(null, null, { mode: "wait", speed: 1.0 });
  assert.equal(tutor.mode, "wait");
  assert.equal(tutor.speed, 1.0);
  assert.equal(tutor.hand, "both");
  assert.equal(tutor.isPlaying, false);

  tutor.dispose();
  assert.equal(tutor.canvas, null);
  assert.equal(tutor.events.length, 0);
});

test("PianoTutorCanvas parses song and filters events by hand split", () => {
  const tutor = new PianoTutorCanvas(null, null);

  // 1. Both Hands
  tutor.setHand("both");
  tutor.loadSong(sampleSong);
  assert.equal(tutor.events.length, 5, "Both hands includes all 5 notes");
  assert.equal(tutor.accompanimentEvents.length, 0);

  // 2. Right Hand Only (>= 60)
  tutor.setHand("right");
  assert.equal(tutor.events.length, 3, "Right hand includes C4, E4, G4 (3 notes)");
  assert.equal(tutor.accompanimentEvents.length, 2, "Left hand notes moved to accompaniment");
  assert.ok(tutor.events.every((e) => e.note >= 60));

  // 3. Left Hand Only (< 60)
  tutor.setHand("left");
  assert.equal(tutor.events.length, 2, "Left hand includes C3, G3 (2 notes)");
  assert.equal(tutor.accompanimentEvents.length, 3, "Right hand notes moved to accompaniment");
  assert.ok(tutor.events.every((e) => e.note < 60));

  tutor.dispose();
});

test("PianoTutorCanvas handles hit detection and scoring in Flow Mode", () => {
  let scoreUpdate = null;
  const tutor = new PianoTutorCanvas(null, null, {
    mode: "flow",
    speed: 1.0,
    onScoreUpdate: (s) => {
      scoreUpdate = { ...s };
    },
  });

  tutor.loadSong(sampleSong);
  tutor.isPlaying = true;
  tutor.currentTimeMs = 200; // Exact match for C4 at 200ms

  // Hit C4
  tutor.handleUserNote(60, true);
  assert.equal(tutor.stats.hits, 1);
  assert.equal(tutor.stats.streak, 1);
  assert.equal(tutor.stats.lastRating, "PERFECT");
  assert.equal(tutor.stats.accuracy, 100);
  assert.ok(scoreUpdate && scoreUpdate.hits === 1);

  // Hit off-note outside tolerance window -> ignored in flow
  tutor.handleUserNote(72, true);
  assert.equal(tutor.stats.hits, 1);

  // Miss detection
  tutor._recordMiss(64);
  assert.equal(tutor.stats.misses, 1);
  assert.equal(tutor.stats.streak, 0, "Streak resets on miss");
  assert.equal(tutor.stats.accuracy, 50, "1 hit out of 2 total = 50%");

  tutor.dispose();
});

test("PianoTutorCanvas handles hit detection in Wait For Key Mode", () => {
  const tutor = new PianoTutorCanvas(null, null, { mode: "wait" });
  tutor.loadSong(sampleSong);
  tutor.isPlaying = true;

  // Simulate arriving at hit line with C4
  tutor.isWaitingForKey = true;
  tutor.pendingWaitNotes = new Set([60]);

  // Pressing wrong note does not clear pending wait note
  tutor.handleUserNote(62, true);
  assert.ok(tutor.pendingWaitNotes.has(60));
  assert.equal(tutor.isWaitingForKey, true);

  // Pressing correct note clears pending wait note and unlocks
  tutor.handleUserNote(60, true);
  assert.equal(tutor.pendingWaitNotes.size, 0);
  assert.equal(tutor.isWaitingForKey, false, "Waiting paused clears when notes satisfied");
  assert.equal(tutor.stats.hits, 1);

  tutor.dispose();
});

test("PianoTutorCanvas triggers accompaniment notes for non-practiced hand", () => {
  const mockEngine = {
    notesOn: [],
    notesOff: [],
    noteOn(note, vel) { this.notesOn.push({ note, vel }); },
    noteOff(note) { this.notesOff.push(note); },
  };

  const tutor = new PianoTutorCanvas(null, null, {
    engine: mockEngine,
    hand: "right",
  });
  tutor.loadSong(sampleSong);

  // Sample song has accompaniment C3 at 100ms
  tutor._triggerAccompanimentAt(150);
  assert.equal(mockEngine.notesOn.length, 1);
  assert.equal(mockEngine.notesOn[0].note, 48); // C3

  tutor._stopAllAccompanimentNotes();
  assert.equal(mockEngine.notesOff.length, 1);
  assert.equal(mockEngine.notesOff[0], 48);

  tutor.dispose();
});

test("Note hook registry pattern: registers, executes, and unregisters cleanly", () => {
  const hooks = new Set();
  const registerNoteHook = (fn) => {
    if (typeof fn === "function") {
      hooks.add(fn);
      return () => hooks.delete(fn);
    }
    return () => {};
  };

  const received = [];
  const hook = (note, pressed, vel) => {
    received.push({ note, pressed, vel });
  };

  const unsub = registerNoteHook(hook);
  assert.equal(hooks.size, 1);

  // Dispatch noteOn
  for (const h of hooks) {
    h(60, true, 100);
  }
  assert.equal(received.length, 1);
  assert.deepEqual(received[0], { note: 60, pressed: true, vel: 100 });

  // Dispatch noteOff
  for (const h of hooks) {
    h(60, false, 0);
  }
  assert.equal(received.length, 2);
  assert.deepEqual(received[1], { note: 60, pressed: false, vel: 0 });

  // Unregister
  unsub();
  assert.equal(hooks.size, 0);
  for (const h of hooks) {
    h(64, true, 90);
  }
  assert.equal(received.length, 2, "No more events dispatched after unsub");
});
