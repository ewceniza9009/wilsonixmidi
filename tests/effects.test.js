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
import { StereoPhaser } from "../src/audio/effects/phaser.js";
import { buildSoftClipCurve } from "../src/audio/effects/soft-clip.js";

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

import { StudioEqLimiter } from "../src/audio/effects/eq-limiter.js";

test("StudioEqLimiter: setEq sets low, mid, and high gains and exposes gain getters", () => {
  const ctx = createMockAudioContext();
  const eq = new StudioEqLimiter(ctx);
  assert.equal(typeof eq.setEq, "function");
  eq.setEq(2.5, -1.0, 3.0);
  assert.equal(eq.lowGain.value, 2.5);
  assert.equal(eq.midGain.value, -1.0);
  assert.equal(eq.highGain.value, 3.0);
});

test("Effects export matching class names", () => {
  assert.equal(typeof StudioCompressor, "function");
  assert.equal(typeof BitcrusherDecimator, "function");
  assert.equal(typeof AlgorithmicReverb, "function");
  assert.equal(typeof HaasStereoWidener, "function");
  assert.equal(typeof TubeDrive, "function");
  assert.equal(typeof KorgStereoChorus, "function");
  assert.equal(typeof StudioEqLimiter, "function");
  assert.equal(typeof StereoPhaser, "function");
});

test("StereoPhaser: starts bypassed with unity dry / silent wet, LFO stopped", () => {
  const ctx = createMockAudioContext();
  const p = new StereoPhaser(ctx);
  assert.equal(p.enabled, false);
  assert.equal(p.dryGain.gain.value, 1);
  assert.equal(p.wetGain.gain.value, 0);
  assert.equal(p._lfoRunning, false);
});

test("StereoPhaser: setBypass engages mix gains and starts/stops LFO", () => {
  const ctx = createMockAudioContext();
  const p = new StereoPhaser(ctx);
  p.setMix(0.5);
  p.setBypass(false);
  assert.equal(p.enabled, true);
  assert.equal(p._lfoRunning, true);
  const m = 0.5;
  const wet = Math.sin(m * Math.PI * 0.5) * 0.70 * (1 + m * 0.10);
  const dry = Math.cos(m * Math.PI * 0.5);
  approx(p.wetGain.gain.value, wet, 1e-9);
  approx(p.dryGain.gain.value, dry, 1e-9);
  p.setBypass(true);
  assert.equal(p.enabled, false);
  assert.equal(p._lfoRunning, false);
  assert.equal(p.wetGain.gain.value, 0);
  assert.equal(p.dryGain.gain.value, 1);
});

test("StereoPhaser: setMix clamps to [0,1] and updates engaged gains", () => {
  const ctx = createMockAudioContext();
  const p = new StereoPhaser(ctx);
  p.setMix(2.5);
  assert.equal(p.mix, 1);
  p.setMix(-1);
  assert.equal(p.mix, 0);
  p.setMix(0.4);
  assert.equal(p.mix, 0.4);
  p.setBypass(false);
  p.setMix(1.0);
  approx(p.wetGain.gain.value, 1 * 0.70 * (1 + 0.10), 1e-9);
  approx(p.dryGain.gain.value, 0, 1e-9);
  p.setBypass(true);
});

test("StereoPhaser: setRate clamps to [0.05, 8]", () => {
  const p = new StereoPhaser(createMockAudioContext());
  p.setRate(0.01);
  assert.equal(p.rate, 0.05);
  p.setRate(100);
  assert.equal(p.rate, 8);
  p.setRate(1.2);
  assert.equal(p.rate, 1.2);
});

test("StereoPhaser: control-rate LFO — no audio-node → AudioParam connections", () => {
  const p = new StereoPhaser(createMockAudioContext());
  p.setBypass(false);
  for (const f of [...p.leftFilters, ...p.rightFilters]) {
    assert.ok(
      !f.frequency._calls.some(c => c[0] === "connect"),
      "biquad frequency must not receive audio-rate input (forces per-sample coefficient recompute)",
    );
    assert.ok(!f.Q._calls.some(c => c[0] === "connect"));
  }
  assert.equal(p.lfo, undefined);
  p.setBypass(true);
});

test("StereoPhaser: LFO sweep is quadrature across the two channels", () => {
  const p = new StereoPhaser(createMockAudioContext());
  p._lfoPhase = Math.PI / 2;
  p._applyLfo();
  approx(p.leftFilters[0].frequency.value, 400 * 1.35, 1e-9);
  approx(p.rightFilters[0].frequency.value, 400 * 0.65, 1e-9);
  approx(p.leftFilters[3].frequency.value, 3200 * 1.35, 1e-9);
  approx(p.rightFilters[3].frequency.value, 3200 * 0.65, 1e-9);
  p._lfoPhase = -Math.PI / 2;
  p._applyLfo();
  approx(p.leftFilters[0].frequency.value, 400 * 0.65, 1e-9);
  approx(p.rightFilters[0].frequency.value, 400 * 1.35, 1e-9);
});

test("StereoPhaser: splitter feeds independent chains that merge to stereo", () => {
  const ctx = createMockAudioContext();
  const p = new StereoPhaser(ctx);
  const inputTargets = p.input._connects.map(c => c.target);
  assert.ok(inputTargets.includes(p.splitter), "input must feed the channel splitter");
  const splitTargets = p.splitter._connects.map(c => c.target);
  assert.ok(splitTargets.includes(p.leftFilters[0]), "splitter channel 0 → left chain");
  assert.ok(splitTargets.includes(p.rightFilters[0]), "splitter channel 1 → right chain");
  const lastL = p.leftFilters[3]._connects[0];
  const lastR = p.rightFilters[3]._connects[0];
  assert.equal(lastL.target, p.merger);
  assert.equal(lastL.inputIndex, 0);
  assert.equal(lastR.target, p.merger);
  assert.equal(lastR.inputIndex, 1);
  assert.ok(p.merger._connects.some(c => c.target === p.wetGain));
});

test("buildSoftClipCurve: identity below knee, bounded, symmetric, monotonic", () => {
  const curve = buildSoftClipCurve(8192, 0.9);
  assert.equal(curve.length, 8192);
  let maxAbs = 0;
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    // curve is a Float32Array (Web Audio spec): compare at float32 precision.
    if (Math.abs(x) <= 0.89) approx(curve[i], x, 1e-6);
    assert.ok(curve[i] <= 1 && curve[i] >= -1, "curve must stay inside [-1,1]");
    assert.ok(curve[i] >= curve[Math.max(0, i - 1)] - 1e-9, "curve must be monotonic");
    maxAbs = Math.max(maxAbs, Math.abs(curve[i]));
    approx(curve[i], -curve[curve.length - 1 - i], 1e-6);
  }
  assert.ok(maxAbs < 1, "ceiling must stay below full scale");
  assert.ok(maxAbs > 0.95, "ceiling must stay close to full scale");
});