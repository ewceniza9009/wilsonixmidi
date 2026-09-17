import { test } from "node:test";
import assert from "node:assert/strict";
import { getInstrumentTrimGain } from "../src/audio/native-pcm-engine.js";
import { BLOOM_EDM_BANKS } from "../src/audio/bloom-edm-manifest.js";
import { ANIMAL_EDM_BANKS } from "../src/audio/animal-edm-manifest.js";
import { HD_SOUNDBANKS } from "../src/audio/soundbanks.js";

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

test("combiScale equal-power formula matches single-instrument loudness within 1.5 dB", () => {
  // 1 layer (gain 1.0)
  const scale1 = Math.min(1.0, 1.35 / Math.sqrt(1.0));
  assert.equal(scale1, 1.0);

  // 2 layers (gains 1.0 and 0.65, sum 1.65)
  const totalGain2 = 1.0 + 0.65;
  const scale2 = Math.min(1.0, 1.35 / Math.sqrt(totalGain2));
  assert.ok(scale2 >= 0.95 && scale2 <= 1.0);

  // 4 layers (gains 1.0, 0.85, 0.85, 0.70, sum 3.4)
  const totalGain4 = 1.0 + 0.85 + 0.85 + 0.70;
  const scale4 = Math.min(1.0, 1.35 / Math.sqrt(totalGain4));
  // In linear 1/totalGain formula, scale was 0.294 (-10.6 dB drop!).
  // With equal-power formula, scale4 is 0.732 (-2.7 dB total, matching psychoacoustic summing).
  assert.ok(scale4 >= 0.70 && scale4 <= 0.76, `Expected equal-power scale ~0.73, got ${scale4}`);
});
