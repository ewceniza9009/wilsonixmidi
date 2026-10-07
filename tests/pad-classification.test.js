import { test } from "node:test";
import assert from "node:assert/strict";
import { isPadSound } from "../src/audio/soundbanks.js";

test("isPadSound accurately identifies pad, ambient, swell, string, and choir sounds", () => {
  const positiveCases = [
    "roland_sc55_warm_pad",
    "m1_universe",
    "x5d_moonstone",
    "x5d_ariana",
    "string_ensemble_1",
    "choir_aahs",
    "angelic_choir",
    "eos_space_voice",
    "m1_ooh_ahh",
    "shimmer_air",
    "sy_chorus_swell",
    "roland_d50_fantasia",
    "bloom_paris_pad",
    "celestial_air_pad",
    "deep_ambient_layer",
  ];

  for (const id of positiveCases) {
    assert.equal(isPadSound(id), true, `expected "${id}" to be recognized as a pad sound`);
  }
});

test("isPadSound strictly excludes synth-bass, saws, leads, pianos, and percussive layers", () => {
  const negativeCases = [
    "juno_80s_synthbass",
    "synth_bass_1",
    "tr_808_sub_bass",
    "juno_jazz_bass",
    "eos_saw900",
    "saw_lead",
    "analog_saw_lead",
    "fairlight_lead",
    "acoustic_grand_piano",
    "electric_piano_1",
    "abletunes_fm_piano",
    "m1_organ_2",
    "church_organ",
    "alto_sax",
    "brass_section",
    "orchestral_hit",
    "taiko_drum",
    "clean_guitar",
    "acoustic_guitar_nylon",
    "harp_pluck",
  ];

  for (const id of negativeCases) {
    assert.equal(isPadSound(id), false, `expected "${id}" to NOT be classified as a pad sound`);
  }
});

test("isPadSound enforces word-boundary match on 'air' (avoids 'fairlight' false positive)", () => {
  assert.equal(isPadSound("shimmer_air"), true, "shimmer_air should match");
  assert.equal(isPadSound("air_swell"), true, "air_swell should match");
  assert.equal(isPadSound("vocal-air-layer"), true, "vocal-air-layer should match");
  assert.equal(isPadSound("fairlight"), false, "fairlight must NOT match as air");
  assert.equal(isPadSound("fairlight_sampler"), false, "fairlight_sampler must NOT match as air");
});

test("isPadSound supports object input with id, inst, or name", () => {
  assert.equal(isPadSound({ id: "m1_universe" }), true);
  assert.equal(isPadSound({ inst: "string_ensemble_1" }), true);
  assert.equal(isPadSound({ name: "Warm Analog Pad" }), true);
  assert.equal(isPadSound({ name: "Korg X5D Ancient Sun (Ambient Pad)" }), true);
  assert.equal(isPadSound({ name: "Korg X5D Solar Flare (Warm Swell)" }), true);
  assert.equal(isPadSound({ id: "juno_80s_synthbass", name: "Juno 80s SynthBass" }), false);
  assert.equal(isPadSound({ inst: "eos_saw900" }), false);
});

test("isPadSound safely handles null, undefined, and non-string inputs", () => {
  assert.equal(isPadSound(null), false);
  assert.equal(isPadSound(undefined), false);
  assert.equal(isPadSound(""), false);
  assert.equal(isPadSound(123), false);
  assert.equal(isPadSound({}), false);
});
