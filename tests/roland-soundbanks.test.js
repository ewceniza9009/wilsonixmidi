import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HD_SOUNDBANKS } from "../src/audio/soundbanks.js";
import { getInstrumentTrimGain } from "../src/audio/native-pcm-engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOUNDFONTS_BIN_DIR = path.resolve(__dirname, "../public/soundfonts-bin");
const MULTI_LAYER_ENGINE_PATH = path.resolve(__dirname, "../src/audio/multi-layer-engine.js");


const ROLAND_IDS = [
  "roland_d50_fantasia",
  "roland_u20_choir",
  "roland_bright_ep",
  "roland_sc55_warm_pad",
  "roland_space_voice",
  "roland_metal_pad",
  "roland_sc55_finger_bass",
  "roland_u20_shakuhachi",
  "roland_orchestra_hit",
  "roland_synth_brass",
];

test("All 10 Roland instruments are registered in HD_SOUNDBANKS", () => {
  for (const id of ROLAND_IDS) {
    const entry = HD_SOUNDBANKS[id];
    assert.ok(entry, `Missing Roland instrument in HD_SOUNDBANKS: ${id}`);
    assert.equal(entry.id, id);
    assert.ok(typeof entry.name === "string" && entry.name.length > 0);
    assert.ok(typeof entry.category === "string" && entry.category.length > 0);
  }
});

test("All 10 Roland binary packs and manifests exist on disk", () => {
  for (const id of ROLAND_IDS) {
    const packPath = path.join(SOUNDFONTS_BIN_DIR, `${id}.pack`);
    const jsonPath = path.join(SOUNDFONTS_BIN_DIR, `${id}.json`);

    assert.ok(fs.existsSync(packPath), `Missing pack file: ${packPath}`);
    assert.ok(fs.existsSync(jsonPath), `Missing json manifest: ${jsonPath}`);

    const packStat = fs.statSync(packPath);
    assert.ok(packStat.size > 1000, `Pack file for ${id} is too small: ${packStat.size} bytes`);

    const manifestContent = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    assert.equal(manifestContent.id, id);
    assert.ok(manifestContent.count > 0);
    assert.equal(manifestContent.totalBytes, packStat.size);
    assert.equal(manifestContent.samples.length, manifestContent.count);

    for (const smp of manifestContent.samples) {
      assert.ok(typeof smp.n === "string");
      assert.ok(typeof smp.m === "number" && smp.m >= 21 && smp.m <= 108);
      assert.ok(typeof smp.o === "number" && smp.o >= 0);
      assert.ok(typeof smp.l === "number" && smp.l > 0);
      assert.ok(smp.o + smp.l <= manifestContent.totalBytes);
    }
  }
});

test("All 10 Roland instruments have calibrated trim gains", () => {
  for (const id of ROLAND_IDS) {
    const trim = getInstrumentTrimGain(id);
    assert.ok(typeof trim === "number");
    assert.ok(
      trim >= 0.75 && trim <= 0.95,
      `Calibrated trim for ${id} should be between 0.75 and 0.95, got ${trim}`,
    );
  }
});

test("Roland Combi Presets exist and reference valid instruments", () => {
  const engineSource = fs.readFileSync(MULTI_LAYER_ENGINE_PATH, "utf-8");
  const rolandCombis = [
    "roland_d50_masterpiece",
    "roland_ballad_power_ep",
    "roland_cyberpunk_soundtrack",
    "roland_enigma_chillout",
  ];

  for (const combiId of rolandCombis) {
    assert.ok(
      engineSource.includes(`id: "${combiId}"`),
      `multi-layer-engine.js missing combi definition for: ${combiId}`,
    );
  }

  // Ensure all referenced instruments exist in HD_SOUNDBANKS
  for (const id of ROLAND_IDS) {
    assert.ok(
      engineSource.includes(`"${id}"`),
      `multi-layer-engine.js should reference Roland instrument: ${id}`,
    );
  }
});

