import { test } from "node:test";
import assert from "node:assert/strict";
import { ScaleLock, SCALES } from "../src/midi/scale-lock.js";

test("snapToScale never jumps more than a tritone from the input note", () => {
  const sl = new ScaleLock();
  const scaleIds = Object.keys(SCALES).filter((id) => id !== "chromatic");

  for (let root = 0; root < 12; root++) {
    sl.setRootNote(root);
    for (const id of scaleIds) {
      sl.setScale(id);
      for (let note = 21; note <= 108; note++) {
        const snapped = sl.snapToScale(note);
        if (snapped === null) continue; // snapMode "mute"
        const distance = Math.abs(snapped - note);
        assert.ok(
          distance <= 6,
          `root=${root} scale=${id} note=${note} snapped=${snapped} distance=${distance}`,
        );
      }
    }
  }
});

test("snapToScale returns in-scale notes for every snapped result away from the clamp bounds", () => {
  const sl = new ScaleLock();
  for (let root = 0; root < 12; root++) {
    sl.setRootNote(root);
    for (const id of ["major", "natural_minor", "pentatonic_minor"]) {
      sl.setScale(id);
      for (let note = 24; note <= 105; note++) {
        const snapped = sl.snapToScale(note);
        assert.notEqual(snapped, null);
        assert.ok(
          sl.isNoteInScale(snapped),
          `root=${root} scale=${id} note=${note} snapped=${snapped} is not in scale`,
        );
      }
    }
  }
});

test("snapToScale reproduces the reported octave-jump bug case (root B, note D)", () => {
  const sl = new ScaleLock();
  sl.setRootNote(11); // B
  sl.setScale("major"); // B C# D# E F# G# A#
  // Note 62 (D) is not in B major; nearest in-scale notes are C#(61)/D#(63).
  const snapped = sl.snapToScale(62);
  assert.equal(snapped, 61);
});

test("snapToScale leaves notes untouched that are already in scale", () => {
  const sl = new ScaleLock();
  sl.setRootNote(0);
  sl.setScale("major");
  for (const note of [60, 62, 64, 65, 67, 69, 71, 72]) {
    assert.equal(sl.snapToScale(note), note);
  }
});

test("snapMode mute returns null for out-of-scale notes", () => {
  const sl = new ScaleLock();
  sl.setRootNote(0);
  sl.setScale("major");
  sl.snapMode = "mute";
  assert.equal(sl.snapToScale(61), null); // C#
  assert.equal(sl.snapToScale(60), 60); // C is in scale
});

test("isNoteInScale is true for everything when unlocked (chromatic)", () => {
  const sl = new ScaleLock();
  assert.equal(sl.isLocked, false);
  for (let n = 0; n < 128; n++) {
    assert.equal(sl.isNoteInScale(n), true);
  }
});
