import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockAudioContext } from "./helpers/mock-audio-context.js";
import { constantPowerMix, constantPowerMixScaled, applyBypassGains, applyMixGains } from "../src/audio/effects/dry-wet-utils.js";
import { StudioCompressor } from "../src/audio/effects/compressor.js";
import { BitcrusherDecimator } from "../src/audio/effects/bitcrusher.js";
import { AlgorithmicReverb } from "../src/audio/effects/reverb.js";
import { HaasStereoWidener } from "../src/audio/effects/stereo-widener.js";
import { TubeDrive } from "../src/audio/effects/tube-drive.js";
import { KorgStereoChorus } from "../src/audio/effects/chorus.js";

function approx(actual, expected, eps = 1e-6) {
  assert.ok(Math.abs(actual - expected) < eps, `expected ${actual} to be within ${eps} of ${expected}`);
}

test("constantPowerMix applies sin/cos crossfade", () => {
  const { wet, dry } = constantPowerMix(0);
  assert.ok(Math.abs(wet - 0) < 1e-9);
  assert.ok(Math.abs(dry - 1) < 1e-9);

  const mid = constantPowerMix(0.5);
  assert.ok(Math.abs(mid.wet - Math.sin(Math.PI * 0.25)) < 1e-9);
  assert.ok(Math.abs(mid.dry - Math.cos(Math.PI * 0.25)) < 1e-9);

  const full = constantPowerMix(1);
  assert.ok(Math.abs(full.wet - 1) < 1e-9);
  assert.ok(Math.abs(full.dry - 0) < 1e-9);
});

test("constantPowerMix clamps out-of-range input", () => {
  assert.deepEqual(constantPowerMix(-1), constantPowerMix(0));
  assert.deepEqual(constantPowerMix(2), constantPowerMix(1));
});

test("constantPowerMixScaled scales wet side", () => {
  const { wet, dry } = constantPowerMixScaled(1, 0.75);
  assert.ok(Math.abs(wet - 0.75) < 1e-9);
  assert.ok(Math.abs(dry - 0) < 1e-9);
});

test("applyBypassGains bypasses to dry=1 wet=0", () => {
  const ctx = createMockAudioContext();
  const wetGain = ctx.createGain();
  const dryGain = ctx.createGain();
  applyBypassGains(wetGain, dryGain, true, 0.5, constantPowerMix, ctx);
  assert.equal(wetGain.gain.value, 0);
  assert.equal(dryGain.gain.value, 1);
});

test("applyBypassGains engages with mix gains", () => {
  const ctx = createMockAudioContext();
  const wetGain = ctx.createGain();
  const dryGain = ctx.createGain();
  applyBypassGains(wetGain, dryGain, false, 1.0, constantPowerMix, ctx);
  approx(wetGain.gain.value, 1);
  approx(dryGain.gain.value, 0);
});

test("applyMixGains sets target gains", () => {
  const ctx = createMockAudioContext();
  const wetGain = ctx.createGain();
  const dryGain = ctx.createGain();
  applyMixGains(wetGain, dryGain, 0.5, constantPowerMix, ctx);
  assert.ok(wetGain.gain.value > 0);
  assert.ok(dryGain.gain.value > 0);
});

test("StudioCompressor: initial enabled state is false", () => {
  const ctx = createMockAudioContext();
  const comp = new StudioCompressor(ctx);
  assert.equal(comp.enabled, false);
  assert.equal(comp.mix, 0.85);
});

test("StudioCompressor: setBypass(false) enables, setBypass(true) disables", () => {
  const ctx = createMockAudioContext();
  const comp = new StudioCompressor(ctx);
  comp.setBypass(false);
  assert.equal(comp.enabled, true);
  comp.setBypass(true);
  assert.equal(comp.enabled, false);
});

test("StudioCompressor: setMix clamps to [0,1]", () => {
  const ctx = createMockAudioContext();
  const comp = new StudioCompressor(ctx);
  comp.setMix(2.5);
  assert.equal(comp.mix, 1);
  comp.setMix(-1);
  assert.equal(comp.mix, 0);
  comp.setMix(0.4);
  assert.equal(comp.mix, 0.4);
});

test("StudioCompressor: setThreshold clamps", () => {
  const ctx = createMockAudioContext();
  const comp = new StudioCompressor(ctx);
  comp.setThreshold(-100);
  assert.equal(comp.threshold, -60);
  comp.setThreshold(50);
  assert.equal(comp.threshold, 0);
});

test("StudioCompressor: bypass engages correct dry/wet values", () => {
  const ctx = createMockAudioContext();
  const comp = new StudioCompressor(ctx);
  comp.mix = 1;
  comp.setBypass(false);
  approx(comp.wetGain.gain.value, 1);
  approx(comp.dryGain.gain.value, 0);
  comp.setBypass(true);
  assert.equal(comp.wetGain.gain.value, 0);
  assert.equal(comp.dryGain.gain.value, 1);
});

test("BitcrusherDecimator: full wet engages sin/cos gains", () => {
  const ctx = createMockAudioContext();
  const bc = new BitcrusherDecimator(ctx);
  bc.mix = 1;
  bc.setBypass(false);
  approx(bc.wetGain.gain.value, 1);
  approx(bc.dryGain.gain.value, 0);
  bc.setBypass(true);
  assert.equal(bc.wetGain.gain.value, 0);
  assert.equal(bc.dryGain.gain.value, 1);
});

test("AlgorithmicReverb: scaled wet engages (0.75 scale)", () => {
  const ctx = createMockAudioContext();
  const reverb = new AlgorithmicReverb(ctx);
  reverb.mix = 1;
  reverb.setBypass(false);
  assert.ok(Math.abs(reverb.wetGain.gain.value - 0.75) < 1e-9);
  reverb.setBypass(true);
  assert.equal(reverb.wetGain.gain.value, 0);
});

test("HaasStereoWidener: bypass toggling restores mix", () => {
  const ctx = createMockAudioContext();
  const w = new HaasStereoWidener(ctx);
  w.mix = 1;
  w.setBypass(false);
  assert.equal(w.wetGain.gain.value, 1);
  w.setBypass(true);
  assert.equal(w.dryGain.gain.value, 1);
});

test("TubeDrive: setMix clamps and only updates when enabled", () => {
  const ctx = createMockAudioContext();
  const t = new TubeDrive(ctx);
  t.setMix(1.7);
  assert.equal(t.mix, 1);
  t.setBypass(false);
  t.setMix(0.5);
  assert.ok(Math.abs(t.wetGain.gain.value - Math.sin(Math.PI * 0.25)) < 1e-9);
});

test("KorgStereoChorus: bypass starts/stops LFO", () => {
  const ctx = createMockAudioContext();
  const c = new KorgStereoChorus(ctx);
  assert.equal(c._lfoRunning, false);
  c.setBypass(false);
  assert.equal(c._lfoRunning, true);
  c.setBypass(true);
  assert.equal(c._lfoRunning, false);
});

test("Effects export matching class names", () => {
  assert.equal(typeof StudioCompressor, "function");
  assert.equal(typeof BitcrusherDecimator, "function");
  assert.equal(typeof AlgorithmicReverb, "function");
  assert.equal(typeof HaasStereoWidener, "function");
  assert.equal(typeof TubeDrive, "function");
  assert.equal(typeof KorgStereoChorus, "function");
});