import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BLOOM_EDM_BANKS } from "../src/audio/bloom-edm-manifest.js";
import { HD_SOUNDBANKS } from "../src/audio/soundbanks.js";

test("BLOOM_EDM_BANKS contains the 12 curated iconic Future Bass instruments", () => {
  const keys = Object.keys(BLOOM_EDM_BANKS);
  assert.equal(keys.length, 12, "expected 12 curated iconic bloom instruments");
});

test("Every BLOOM_EDM_BANKS entry has valid metadata and root MIDI", () => {
  for (const [key, entry] of Object.entries(BLOOM_EDM_BANKS)) {
    assert.equal(entry.id, key, `${key} id must match its key`);
    assert.equal(typeof entry.name, "string", `${key} name must be string`);
    assert.equal(typeof entry.category, "string", `${key} category must be string`);
    assert.equal(typeof entry.file, "string", `${key} file must be string`);
    assert.equal(typeof entry.rootMidi, "number", `${key} rootMidi must be number`);
    assert.ok(entry.rootMidi >= 21 && entry.rootMidi <= 108, `${key} rootMidi within piano range`);
  }
});

test("All BLOOM_EDM_BANKS sample files exist in public/samples/bloom_edm", () => {
  const dir = path.resolve("public/samples/bloom_edm");
  assert.ok(fs.existsSync(dir), "public/samples/bloom_edm directory must exist");

  for (const entry of Object.values(BLOOM_EDM_BANKS)) {
    const filePath = path.join(dir, entry.file);
    assert.ok(fs.existsSync(filePath), `Sample file ${entry.file} must exist on disk`);
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 1000, `Sample file ${entry.file} must not be empty`);
  }
});

test("HD_SOUNDBANKS catalog registers every BLOOM_EDM_BANKS entry", () => {
  for (const key of Object.keys(BLOOM_EDM_BANKS)) {
    assert.ok(HD_SOUNDBANKS[key], `HD_SOUNDBANKS must contain ${key}`);
    assert.equal(HD_SOUNDBANKS[key].id, key);
  }
});


test("Bloom EDM Stems (Vocal Chops and Wavy Pad) exist in public/samples/bloom_edm", () => {
  const chopsPath = path.resolve("public/samples/bloom_edm/bloom_stem_003_vocal_chops.flac");
  const padPath = path.resolve("public/samples/bloom_edm/bloom_stem_003_wavy_pad.flac");

  assert.ok(fs.existsSync(chopsPath), "bloom_stem_003_vocal_chops.flac must exist on disk");
  assert.ok(fs.statSync(chopsPath).size > 100000, "bloom_stem_003_vocal_chops.flac must be > 100KB");

  assert.ok(fs.existsSync(padPath), "bloom_stem_003_wavy_pad.flac must exist on disk");
  assert.ok(fs.statSync(padPath).size > 100000, "bloom_stem_003_wavy_pad.flac must be > 100KB");
});
