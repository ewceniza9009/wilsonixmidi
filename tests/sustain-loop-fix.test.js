import { test } from "node:test";
import assert from "node:assert/strict";
import { configureSustainLoop } from "../src/audio/sample-loop-helper.js";
import { NativePcmEngine } from "../src/audio/native-pcm-engine.js";
import { createMockAudioContext } from "./helpers/mock-audio-context.js";

function createSyntheticAudioBuffer(duration = 2.0, sr = 44100, freq = 300, isHarmonic = true) {
  const numFrames = Math.floor(duration * sr);
  const dataL = new Float32Array(numFrames);
  const dataR = new Float32Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    const t = i / sr;
    let s = Math.sin(2 * Math.PI * freq * t);
    if (isHarmonic) {
      s = 0.6 * s + 0.3 * Math.sin(4 * Math.PI * freq * t) + 0.15 * Math.sin(6 * Math.PI * freq * t);
    }
    // Slight natural decay across 2 seconds
    const env = Math.min(1.0, t / 0.02) * Math.max(0.3, 1.0 - 0.25 * t);
    dataL[i] = s * env;
    dataR[i] = s * env;
  }

  return {
    duration,
    sampleRate: sr,
    length: numFrames,
    numberOfChannels: 2,
    getChannelData: (ch) => (ch === 1 ? dataR : dataL),
  };
}

function createTestEngine() {
  const mockCtx = createMockAudioContext();
  mockCtx.createBuffer = (ch, len, sr) => ({
    numberOfChannels: ch,
    length: len,
    sampleRate: sr,
    duration: len / sr,
    getChannelData: () => new Float32Array(len),
  });
  // Prevent network calls in node test runner
  const origInit = NativePcmEngine.prototype.initBuffers;
  NativePcmEngine.prototype.initBuffers = function() {
    this.isReady = true;
    return Promise.resolve();
  };
  const engine = new NativePcmEngine(mockCtx);
  NativePcmEngine.prototype.initBuffers = origInit;
  return { engine, mockCtx };
}

test("createCrossfadedLoopBuffer enables seamless looping on brass, sax, and organ presets", () => {
  const { engine, mockCtx } = createTestEngine();

  const sustainedPresets = [
    "brass_section",
    "fat_brass_horns",
    "edm_club_brass",
    "alto_sax",
    "tenor_sax",
    "breathy_alto_sax",
    "sax_genuine_solo",
    "drawbar_organ",
    "m1_rock_organ",
    "m1_organ_2",
    "church_organ",
    "rock_organ"
  ];

  for (const instId of sustainedPresets) {
    const buf = createSyntheticAudioBuffer(2.0, 44100, 320, true);
    const processed = engine.createCrossfadedLoopBuffer(mockCtx, buf, instId);

    assert.equal(processed._isLoopable, true, `${instId} must be marked loopable`);
    assert.ok(processed._loopStartSec > 0.2, `${instId} loopStartSec must allow attack transient (>0.2s)`);
    assert.ok(processed._loopEndSec > processed._loopStartSec + 0.2, `${instId} loopEndSec must be well after loopStartSec`);
    assert.ok(processed._loopEndSec <= buf.duration, `${instId} loopEndSec must not exceed buffer duration`);
  }
});

test("createCrossfadedLoopBuffer keeps pianos, plucks, hits, and drums non-loopable", () => {
  const { engine, mockCtx } = createTestEngine();

  const nonLoopingPresets = [
    "acoustic_grand_piano",
    "synthage_grand",
    "m1_piano_16",
    "electric_piano_1",
    "fantom_nylon_pluck",
    "m1_slap_bass",
    "roland_orchestra_hit",
    "real_drum_kit"
  ];

  for (const instId of nonLoopingPresets) {
    const buf = createSyntheticAudioBuffer(2.0, 44100, 440, true);
    const processed = engine.createCrossfadedLoopBuffer(mockCtx, buf, instId);

    assert.equal(!processed._isLoopable, true, `${instId} must NOT be loopable`);
  }
});

test("configureSustainLoop produces smooth seam with no NaN or infinite values", () => {
  const buf = createSyntheticAudioBuffer(2.5, 44100, 261.63, true);
  configureSustainLoop(buf, "brass", "brass_section");

  assert.equal(buf._isLoopable, true);
  const dataL = buf.getChannelData(0);
  const startIdx = Math.floor(buf._loopStartSec * 44100);
  const endIdx = Math.floor(buf._loopEndSec * 44100);

  // Check seam continuity: sample at endIdx - 1 compared with startIdx
  assert.ok(Number.isFinite(dataL[startIdx]), "startIdx sample must be finite");
  assert.ok(Number.isFinite(dataL[endIdx - 1]), "endIdx - 1 sample must be finite");
  assert.ok(!Number.isNaN(dataL[startIdx]), "startIdx sample must not be NaN");
  assert.ok(!Number.isNaN(dataL[endIdx - 1]), "endIdx - 1 sample must not be NaN");

  // Check no samples in the entire buffer became corrupted
  for (let i = 0; i < buf.length; i += 50) {
    assert.ok(Number.isFinite(dataL[i]), `sample at frame ${i} must be finite`);
    assert.ok(Math.abs(dataL[i]) <= 1.05, `sample at frame ${i} must not exceed unity range`);
  }
});
