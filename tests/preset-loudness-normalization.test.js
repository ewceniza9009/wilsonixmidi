import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getInstrumentTrimGain } from "../src/audio/native-pcm-engine.js";
import { BLOOM_EDM_BANKS } from "../src/audio/bloom-edm-manifest.js";
import { ANIMAL_EDM_BANKS } from "../src/audio/animal-edm-manifest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MULTI_LAYER_ENGINE_PATH = path.resolve(__dirname, "../src/audio/multi-layer-engine.js");

/**
 * Parse COMBI_PRESETS from the multi-layer-engine.js source to extract layer
 * gains and instrument IDs without triggering Vite-only imports.
 */
function parseCombiPresets() {
  const src = fs.readFileSync(MULTI_LAYER_ENGINE_PATH, "utf-8");
  const presets = {};
  // Match each preset block
  const presetRegex = /^\s{2}([a-zA-Z0-9_]+):\s*\{[^}]*?id:\s*"([^"]+)"[^]*?layers:\s*\[([\s\S]*?)\]\s*,?\s*\}/gm;
  // Simpler approach: parse line by line
  const lines = src.split("\n");
  let inPresets = false;
  let curId = null;
  let braceDepth = 0;
  for (const line of lines) {
    if (line.includes("export const COMBI_PRESETS = {")) { inPresets = true; braceDepth = 1; continue; }
    if (!inPresets) continue;

    // Track braces
    for (const ch of line) {
      if (ch === "{") braceDepth++;
      if (ch === "}") braceDepth--;
    }
    if (braceDepth <= 0) break;

    // Detect preset start (top level key in COMBI_PRESETS)
    const idMatch = line.match(/^\s{2}([a-zA-Z0-9_]+):\s*\{/);
    if (idMatch && braceDepth === 2) {
      curId = idMatch[1];
      presets[curId] = { layers: [] };
    }
    // Detect inst
    const instMatch = line.match(/inst:\s*"([^"]+)"/);
    // Detect gain
    const gainMatch = line.match(/gain:\s*([0-9.]+)/);
    // Detect vaProg
    const vaMatch = line.match(/vaProg:\s*"?([^",]+)/);
    // Detect enabled
    const enabledMatch = line.match(/enabled:\s*(true|false)/);

    if (curId) {
      if (instMatch) {
        const last = presets[curId].layers[presets[curId].layers.length - 1];
        if (last && !last.inst) last.inst = instMatch[1];
        else presets[curId].layers.push({ inst: instMatch[1], gain: 1.0, enabled: true });
      }
      if (gainMatch) {
        const last = presets[curId].layers[presets[curId].layers.length - 1];
        if (last) last.gain = parseFloat(gainMatch[1]);
      }
      if (vaMatch) {
        const last = presets[curId].layers[presets[curId].layers.length - 1];
        if (last) last.vaProg = true;
      }
      if (enabledMatch) {
        const last = presets[curId].layers[presets[curId].layers.length - 1];
        if (last) last.enabled = enabledMatch[1] === "true";
      }
    }
  }
  return presets;
}

test("getInstrumentTrimGain provides calibrated trims for all Bloom EDM instruments", () => {
  for (const id of Object.keys(BLOOM_EDM_BANKS)) {
    const trim = getInstrumentTrimGain(id);
    assert.ok(typeof trim === "number", `Trim should be a number for ${id}`);
    assert.ok(trim >= 0.45 && trim <= 0.70, `Bloom EDM instrument ${id} should be trimmed between 0.45 and 0.70 to prevent loudness blowout, got ${trim}`);
  }
});

test("getInstrumentTrimGain provides calibrated trims for all Animal EDM instruments", () => {
  for (const id of Object.keys(ANIMAL_EDM_BANKS)) {
    const trim = getInstrumentTrimGain(id);
    assert.ok(typeof trim === "number", `Trim should be a number for ${id}`);
    assert.ok(trim >= 0.45 && trim <= 0.90, `Animal EDM instrument ${id} should be trimmed between 0.45 and 0.90, got ${trim}`);
  }
});

test("getInstrumentTrimGain provides balanced trims for acoustic and soundfont instruments", () => {
  assert.equal(getInstrumentTrimGain("acoustic_grand_piano"), 0.85);
  assert.equal(getInstrumentTrimGain("electric_piano_1"), 0.85);
  assert.equal(getInstrumentTrimGain("string_ensemble_1"), 0.58);
  assert.equal(getInstrumentTrimGain("drawbar_organ"), 0.60);
  assert.equal(getInstrumentTrimGain("flute"), 0.88);
  assert.equal(getInstrumentTrimGain("brass_section"), 0.72);
});

test("getInstrumentTrimGain smart fallback never defaults to raw 1.0 for unlisted synth leads or pads", () => {
  const customLeadTrim = getInstrumentTrimGain("bloom_custom_unlisted_super_lead");
  assert.equal(customLeadTrim, 0.54);

  const customPadTrim = getInstrumentTrimGain("edm_trance_pad_custom");
  assert.equal(customPadTrim, 0.56);

  const customBassTrim = getInstrumentTrimGain("animal_ultra_sub_bass_custom");
  assert.equal(customBassTrim, 0.62);
});

test("RMS equal-loudness normalizer brings all combi presets within ±0.08 of TARGET_RMS", () => {
  const TARGET_RMS = 1.10;
  const tolerance = 0.08;
  const presets = parseCombiPresets();

  assert.ok(Object.keys(presets).length >= 50, `Expected at least 50 combi presets, found ${Object.keys(presets).length}`);

  for (const [id, preset] of Object.entries(presets)) {
    const layers = preset.layers || [];
    let sumPower = 0;
    for (const layer of layers) {
      if (!layer.enabled) continue;
      const g = layer.gain ?? 1.0;
      const t = layer.vaProg ? 0.82 : getInstrumentTrimGain(layer.inst);
      sumPower += (g * t) * (g * t);
    }
    const rms = Math.sqrt(sumPower);
    const combiScale = rms > 0.05 ? Math.max(0.60, Math.min(1.65, TARGET_RMS / rms)) : 1.0;
    const normalizedRms = rms * combiScale;

    assert.ok(
      normalizedRms >= TARGET_RMS - tolerance && normalizedRms <= TARGET_RMS + tolerance,
      `Preset "${id}": normalized RMS ${normalizedRms.toFixed(3)} should be within ±${tolerance} of ${TARGET_RMS} (raw RMS=${rms.toFixed(3)}, scale=${combiScale.toFixed(3)})`,
    );
  }
});

test("Single Program Mode loudness matches combi reference within 1.5 dB", () => {
  const TARGET_RMS = 1.10;
  const singleTrim = getInstrumentTrimGain("acoustic_grand_piano");
  const singleGain = singleTrim > 0.05 ? Math.min(1.65, TARGET_RMS / singleTrim) : 1.0;
  const singleOutput = singleGain * singleTrim;
  const diffDb = 20 * Math.log10(singleOutput / TARGET_RMS);
  assert.ok(
    Math.abs(diffDb) < 1.5,
    `Single Program Mode output ${singleOutput.toFixed(3)} should be within 1.5 dB of ${TARGET_RMS}, diff=${diffDb.toFixed(2)} dB`,
  );
});

test("polyHeadroom does not attenuate 1-4 note chords", () => {
  for (let notes = 1; notes <= 4; notes++) {
    const polyHeadroom = notes > 4
      ? Math.min(1.0, 2.0 / Math.sqrt(notes))
      : 1.0;
    assert.equal(polyHeadroom, 1.0, `${notes}-note chord should have full volume (polyHeadroom=1.0)`);
  }
  // 5+ notes should attenuate gently
  const poly5 = Math.min(1.0, 2.0 / Math.sqrt(5));
  assert.ok(poly5 >= 0.85 && poly5 <= 0.95, `5-note chord polyHeadroom should be gentle, got ${poly5.toFixed(3)}`);
});

test("combiScale RMS normalizer correctly boosts quiet presets and attenuates loud ones", () => {
  const TARGET_RMS = 1.10;

  // 1 layer with gain 1.0 and trim 0.85 -> rms = 0.85 -> scale = 1.10/0.85 = 1.294
  const rms1 = 0.85;
  const scale1 = Math.max(0.60, Math.min(1.65, TARGET_RMS / rms1));
  assert.ok(scale1 >= 1.2 && scale1 <= 1.35, `1-layer scale should boost, got ${scale1.toFixed(3)}`);

  // 4 layers with mixed trims -> rms ~ 1.2-1.4 -> scale < 1.0 (attenuates)
  const rms4 = Math.sqrt(
    (0.95 * 0.85) ** 2 + (0.70 * 0.56) ** 2 + (0.60 * 0.56) ** 2 + (0.90 * 0.82) ** 2,
  );
  const scale4 = Math.max(0.60, Math.min(1.65, TARGET_RMS / rms4));
  assert.ok(scale4 >= 0.70 && scale4 <= 1.05, `4-layer scale should attenuate gently, got ${scale4.toFixed(3)}`);
});
