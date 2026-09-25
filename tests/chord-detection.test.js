import { test } from "node:test";
import assert from "node:assert/strict";
import {
  identifyChord,
  chordSignature,
  midiToNoteName,
  midiToPitchClass,
} from "../src/utils/chord-detection.js";

test("identifies major and minor triads", () => {
  assert.equal(identifyChord([60, 64, 67]).name, "C Major");
  assert.equal(identifyChord([60, 63, 67]).name, "C Minor");
  assert.equal(identifyChord([62, 66, 69]).name, "D Major");
  assert.equal(identifyChord([62, 65, 69]).name, "D Minor");
});

test("identifies seventh and extension voicings", () => {
  assert.equal(identifyChord([60, 64, 67, 71]).name, "C Maj7");
  assert.equal(identifyChord([55, 59, 62, 65]).name, "G 7");
  assert.equal(identifyChord([57, 60, 64, 67]).name, "A m7");
  assert.equal(identifyChord([60, 63, 67, 71]).name, "C mMaj7");
  assert.equal(identifyChord([60, 63, 66, 69]).name, "C Dim7");
  assert.equal(identifyChord([60, 63, 66, 70]).name, "C m7b5");
  assert.equal(identifyChord([49, 52, 56, 59]).name, "C# m7");
});

test("identifies suspensions, sixths, ninths and triads with added tones", () => {
  assert.equal(identifyChord([55, 60, 62]).name, "G Sus4");
  assert.equal(identifyChord([60, 62, 67]).name, "C Sus2");
  assert.equal(identifyChord([60, 64, 67, 74]).name, "C Add9");
  assert.equal(identifyChord([60, 64, 67, 69]).name, "C 6");
  assert.equal(identifyChord([60, 64, 67, 71, 74]).name, "C Maj9");
  assert.equal(identifyChord([60, 64, 67, 70, 74]).name, "C 9");
});

test("resolves inverted voicings to their true root", () => {
  // E-G-C voiced upward: bass E is not a chord root, must fall back to C.
  assert.equal(identifyChord([64, 67, 72]).name, "C Major");
  // G-B-D-F (G7) inverted with F in bass still resolves to G 7.
  assert.equal(identifyChord([65, 55, 59, 62]).name, "G 7");
});

test("handles power chords, unisons and single notes", () => {
  assert.equal(identifyChord([31, 38]).name, "G 5th");
  assert.equal(identifyChord([31, 38, 62]).name, "G 5th");
  assert.equal(identifyChord([55, 62]).name, "G 5th");
  const singleNote = identifyChord([60]);
  assert.equal(singleNote.name, "C");
  assert.equal(singleNote.isChord, false);
  assert.equal(identifyChord([60, 72]).name, "C"); // octave = 1 pitch class
  assert.equal(identifyChord([]).name, "");
  assert.equal(identifyChord(undefined).name, "");
});

test("returns root pitch class metadata", () => {
  const cMajor = identifyChord([60, 64, 67]);
  assert.equal(cMajor.rootName, "C");
  assert.equal(cMajor.root, 0);
  assert.deepEqual(cMajor.pitchClasses, [0, 4, 7]);
  assert.equal(cMajor.isChord, true);
  assert.equal(cMajor.hasThird, true);
  const power = identifyChord([31, 38]);
  assert.equal(power.hasThird, false);
  assert.equal(power.isChord, true);
});

test("chordSignature is octave-independent and dedupe-friendly", () => {
  assert.equal(chordSignature([60, 64, 67]), chordSignature([72, 76, 79]));
  assert.equal(chordSignature([60, 64, 67]), chordSignature([64, 67, 60]));
  assert.equal(chordSignature([60, 64, 67, 71]), "4:0,4,7,11");
  assert.equal(chordSignature([]), "");
  // Different voicings of the same harmony share a signature.
  assert.notEqual(
    chordSignature([60, 64, 67]),
    chordSignature([60, 64, 67, 71]),
  );
});

test("midi helpers produce names and pitch classes", () => {
  assert.equal(midiToNoteName(60), "C4");
  assert.equal(midiToNoteName(61), "C#4");
  assert.equal(midiToNoteName(69), "A4");
  assert.equal(midiToNoteName(0), "C-1");
  assert.equal(midiToPitchClass(60), "C");
  assert.equal(midiToPitchClass(62), "D");
  assert.equal(midiToPitchClass(49), "C#");
});

test("unknown voicings fall back to a generic bass-root label", () => {
  const result = identifyChord([60, 61, 63]);
  assert.equal(result.name, "C Chord");
  assert.equal(result.isChord, true);
  assert.equal(result.hasThird, false);
});