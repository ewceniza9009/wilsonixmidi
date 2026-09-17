import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MIDI_MAPPINGS } from "../src/midi/default-midi-mappings.js";

const entries = Object.entries(DEFAULT_MIDI_MAPPINGS);

test("default MIDI mappings: every entry is a well-formed mapping", () => {
  for (const [name, m] of entries) {
    assert.equal(typeof m.cc, "number", `${name}.cc must be numeric`);
    assert.ok(m.cc >= 0 && m.cc <= 127, `${name}.cc must be a 7-bit CC (${m.cc})`);
    assert.equal(typeof m.channel, "number", `${name}.channel must be numeric`);
    assert.equal(typeof m.min, "number", `${name}.min must be numeric`);
    assert.equal(typeof m.max, "number", `${name}.max must be numeric`);
    assert.ok(m.min < m.max, `${name} must have min < max`);
  }
});

test("default MIDI mappings: CC numbers are unique (no knob collisions)", () => {
  const seen = new Map();
  for (const [name, m] of entries) {
    assert.ok(
      !seen.has(m.cc),
      `CC ${m.cc} is assigned to both "${seen.get(m.cc)}" and "${name}"`,
    );
    seen.set(m.cc, name);
  }
});

test("default MIDI mappings: filter FX do not collide with layer faders", () => {
  const { fx_cutoff, fx_resonance, layer_1_vol, layer_2_vol, layer_3_vol, layer_4_vol } =
    DEFAULT_MIDI_MAPPINGS;
  const layerCcs = new Set([
    layer_1_vol.cc,
    layer_2_vol.cc,
    layer_3_vol.cc,
    layer_4_vol.cc,
  ]);
  assert.equal(layerCcs.has(fx_cutoff.cc), false);
  assert.equal(layerCcs.has(fx_resonance.cc), false);
  assert.notEqual(fx_cutoff.cc, fx_resonance.cc);
});

test("default MIDI mappings: layer faders occupy CC 71-74", () => {
  assert.equal(DEFAULT_MIDI_MAPPINGS.layer_1_vol.cc, 71);
  assert.equal(DEFAULT_MIDI_MAPPINGS.layer_2_vol.cc, 72);
  assert.equal(DEFAULT_MIDI_MAPPINGS.layer_3_vol.cc, 73);
  assert.equal(DEFAULT_MIDI_MAPPINGS.layer_4_vol.cc, 74);
});

test("default MIDI mappings: filter uses free General Purpose CC 18/19", () => {
  assert.equal(DEFAULT_MIDI_MAPPINGS.fx_cutoff.cc, 18);
  assert.equal(DEFAULT_MIDI_MAPPINGS.fx_resonance.cc, 19);
});

test("default MIDI mappings: reserved GM / channel-mode CCs are avoided", () => {
  const reserved = new Set([1, 2, 64, 120, 121, 122, 123, 124, 125, 126, 127]);
  for (const [name, m] of entries) {
    if (name === "master_vol") continue; // CC7 master volume is intentional
    assert.equal(reserved.has(m.cc), false, `${name} must not use reserved CC ${m.cc}`);
  }
});

test("default MIDI mappings: master volume uses GM CC7", () => {
  assert.equal(DEFAULT_MIDI_MAPPINGS.master_vol.cc, 7);
});
