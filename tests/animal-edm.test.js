import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ANIMAL_EDM_BANKS } from "../src/audio/animal-edm-manifest.js";
import { HD_SOUNDBANKS } from "../src/audio/soundbanks.js";

test("ANIMAL_EDM_BANKS contains the curated animal synth one-shots and FX", () => {
  const keys = Object.keys(ANIMAL_EDM_BANKS);
  assert.equal(keys.length, 36, "expected 36 animal instruments");
});

test("Every ANIMAL_EDM_BANKS entry has valid metadata and root MIDI", () => {
  for (const [key, entry] of Object.entries(ANIMAL_EDM_BANKS)) {
    assert.equal(entry.id, key, `${key} id must match its key`);
    assert.equal(typeof entry.name, "string", `${key} name must be string`);
    assert.equal(typeof entry.category, "string", `${key} category must be string`);
    assert.equal(typeof entry.file, "string", `${key} file must be string`);
    assert.equal(typeof entry.rootMidi, "number", `${key} rootMidi must be number`);
    assert.ok(entry.rootMidi >= 21 && entry.rootMidi <= 108, `${key} rootMidi within piano range`);
  }
});

test("All ANIMAL_EDM_BANKS sample files exist in public/samples/animal_edm", () => {
  const dir = path.resolve("public/samples/animal_edm");
  assert.ok(fs.existsSync(dir), "public/samples/animal_edm directory must exist");

  for (const entry of Object.values(ANIMAL_EDM_BANKS)) {
    const filePath = path.join(dir, entry.file);
    assert.ok(fs.existsSync(filePath), `Sample file ${entry.file} must exist on disk`);
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 1000, `Sample file ${entry.file} must not be empty`);
  }
});

test("HD_SOUNDBANKS catalog registers every ANIMAL_EDM_BANKS entry", () => {
  for (const key of Object.keys(ANIMAL_EDM_BANKS)) {
    assert.ok(HD_SOUNDBANKS[key], `HD_SOUNDBANKS must contain ${key}`);
    assert.equal(HD_SOUNDBANKS[key].id, key);
  }
});
