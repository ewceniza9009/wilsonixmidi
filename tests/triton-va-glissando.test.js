import { test } from "node:test";
import assert from "node:assert/strict";
import { TritonVirtualAnalogEngine } from "../src/audio/triton-va-engine.js";
import { getTritonProgramById } from "../src/triton/combi-timbres.js";
import { audioCore } from "../src/audio/audio-core.js";
import { createMockAudioContext } from "./helpers/mock-audio-context.js";

test("Smooth Sine Lead and pure sine leads enable monophonic legato glissando portamento", () => {
  const mockCtx = createMockAudioContext();
  audioCore.ctx = mockCtx;

  const va = new TritonVirtualAnalogEngine();
  const smoothSineProg = getTritonProgramById("A010");
  assert.ok(smoothSineProg, "Smooth Sine Lead program A010 must exist");

  va.setProgram(smoothSineProg);
  assert.equal(va.config.isPureSineLead, true, "A010 must be recognized as pure sine lead");
  assert.equal(va.config.isGlissando, true, "A010 must have glissando enabled");
  assert.ok(va.config.glideTime > 0.02, "Glissando must have a musical glide time constant");

  // 1. Initial noteOn triggers first voice
  va.noteOn(60, 100);
  assert.equal(va.heldNotes.has(60), true, "Note 60 must be in heldNotes");
  const busyVoices = va.pool.voices.filter((v) => v.isBusy);
  assert.equal(busyVoices.length, 1, "Exactly 1 voice should be active");
  assert.equal(busyVoices[0].activeMidiNote, 60, "Voice must play note 60");

  // 2. Legato noteOn (overlapping note 64) triggers frequency glide on the same voice
  const activeVoice = busyVoices[0];
  va.noteOn(64, 110);
  assert.equal(va.heldNotes.has(64), true, "Note 64 must be added to heldNotes");
  assert.equal(va.pool.voices.filter((v) => v.isBusy).length, 1, "Must remain strictly monophonic without extra voice");
  assert.equal(activeVoice.activeMidiNote, 64, "Active voice must now track note 64");

  // Check oscillator frequency was glided via setTargetAtTime
  const osc1Calls = activeVoice.osc1.frequency._calls;
  const hasGlided = osc1Calls.some(([method]) => method === "setTargetAtTime");
  assert.equal(hasGlided, true, "Oscillator 1 frequency must be glided via setTargetAtTime");

  // 3. Legato release of note 64 while note 60 is still held triggers fallback glide back to 60
  va.noteOff(64);
  assert.equal(va.heldNotes.has(64), false, "Note 64 must be removed from heldNotes");
  assert.equal(va.heldNotes.has(60), true, "Note 60 remains held");
  assert.equal(activeVoice.isBusy, true, "Voice must remain singing while note 60 is held");
  assert.equal(activeVoice.activeMidiNote, 60, "Voice must glide back to note 60");

  // 4. Final release of note 60 releases the voice
  va.noteOff(60);
  assert.equal(va.heldNotes.size, 0, "No notes held");
});
