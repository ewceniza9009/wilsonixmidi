import { test } from "node:test";
import assert from "node:assert/strict";
import { HD_SOUNDBANKS } from "../src/audio/soundbanks.js";

test("HD_SOUNDBANKS is a non-empty catalog", () => {
  const keys = Object.keys(HD_SOUNDBANKS);
  assert.ok(keys.length > 0, "expected at least one soundbank");
});

test("HD_SOUNDBANKS entries have id/name/category strings", () => {
  for (const [key, entry] of Object.entries(HD_SOUNDBANKS)) {
    assert.equal(typeof entry, "object", `${key} must be an object`);
    assert.equal(typeof entry.id, "string", `${key}.id must be a string`);
    assert.equal(typeof entry.name, "string", `${key}.name must be a string`);
    assert.equal(typeof entry.category, "string", `${key}.category must be a string`);
  }
});

test("HD_SOUNDBANKS keys match their entry id (except known aliases)", () => {
  const ALIASES = new Set(["percussion_taiko"]);
  for (const [key, entry] of Object.entries(HD_SOUNDBANKS)) {
    if (ALIASES.has(key)) continue;
    assert.equal(entry.id, key, `entry id "${entry.id}" should match key "${key}"`);
  }
});

test("HD_SOUNDBANKS ids are non-empty with only the documented alias duplicate", () => {
  const ids = Object.values(HD_SOUNDBANKS).map(e => e.id);
  assert.equal(ids.every(id => id.length > 0), true, "empty soundbank id detected");
  const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  const expectedDupes = HD_SOUNDBANKS.percussion_taiko ? ["taiko_drum"] : [];
  assert.deepEqual(dupes, expectedDupes, "only known aliases may repeat an id");
});

test("HD_SOUNDBANKS includes the canonical piano and layer instruments", () => {
  assert.ok(HD_SOUNDBANKS.acoustic_grand_piano, "acoustic_grand_piano missing");
  assert.ok(HD_SOUNDBANKS.synth_bass_1, "synth_bass_1 missing");
  assert.ok(HD_SOUNDBANKS.brass_section, "brass_section missing");
  assert.ok(HD_SOUNDBANKS.electric_piano_1, "electric_piano_1 missing");
});

test("HD_SOUNDBANKS aliased keys point at their canonical instrument", () => {
  // percussion_taiko is a historical alias that shares the taiko_drum id.
  if (HD_SOUNDBANKS.percussion_taiko) {
    assert.equal(HD_SOUNDBANKS.percussion_taiko.id, HD_SOUNDBANKS.taiko_drum.id);
  }
});

test("Triton soundbanks and combi timbres have no duplicate preset names", async () => {
  const { getTritonPcmEntries } = await import("../src/triton/combi-timbres.js");
  const pcm = getTritonPcmEntries();
  const oldRoads = pcm.filter(p => p.name.toLowerCase().includes("old roads"));
  assert.equal(oldRoads.length, 1, "Pf:Old Roads should only appear once");
});

test("getTimbreDisplayName resolves genuine preset names for PCM, VA, and aliases", async () => {
  const { getTimbreDisplayName } = await import("../src/triton/combi-timbres.js");
  assert.equal(getTimbreDisplayName("acoustic_grand_piano"), "Velo Piano Concert Grand");
  assert.equal(getTimbreDisplayName("synth_bass_1"), "Moog Prodigy Punch Bass");
  assert.equal(getTimbreDisplayName("eos_oldroads"), "Pf:Old Roads");
  assert.equal(getTimbreDisplayName("current_stack"), "Follow Current Stack");
  assert.equal(getTimbreDisplayName(null, "Fallback"), "Fallback");
});

