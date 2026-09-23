import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { HD_SOUNDBANKS } from "../src/audio/soundbanks.js";
import { TRITON_BANKS } from "../src/triton/triton-soundbanks.js";
import { resolveTritonProgram } from "../src/triton/combi-timbres.js";
import { NativePcmEngine, getInstrumentTrimGain } from "../src/audio/native-pcm-engine.js";
import { createMockAudioContext } from "./helpers/mock-audio-context.js";

const X5D_SLUGS = [
  "x5d_12_string", "x5d_accordeon", "x5d_analog_king", "x5d_ancient_sun", "x5d_ariana",
  "x5d_bass_horn", "x5d_big_band", "x5d_bigswell", "x5d_brass_swell", "x5d_cafedral",
  "x5d_chorus_guitar", "x5d_chorusclavi", "x5d_crank_it_up", "x5d_crossfades", "x5d_digipiano",
  "x5d_east_africa", "x5d_etnicorch", "x5d_fanfare", "x5d_fat_pianos", "x5d_full_strings",
  "x5d_guitarman", "x5d_harpsicord", "x5d_headhunter", "x5d_ice_bells", "x5d_java_bells",
  "x5d_layersynth", "x5d_lunar_bells", "x5d_malguea", "x5d_maxi_stab", "x5d_megatron",
  "x5d_moonstone", "x5d_multirez", "x5d_muted_horns", "x5d_neurofunk", "x5d_newworlds",
  "x5d_phantom_sax", "x5d_pizzo", "x5d_rezzofunky", "x5d_rock_organ", "x5d_rock_piano",
  "x5d_solar_flare", "x5d_stereo_keys", "x5d_super_ep", "x5d_superkeys", "x5d_symphony",
  "x5d_the_east", "x5d_the_saxman", "x5d_the_singers", "x5d_the_west", "x5d_torquemada",
  "x5d_ultraperc", "x5d_velo_roads", "x5d_warm_koto", "x5d_warriors", "x5d_wave_guitar",
  "x5d_wind_orch", "x5d_x_strings", "x5d_x_brass", "x5d_zen_garden"
];

test("All 59 Korg X5D instruments are registered in HD_SOUNDBANKS", () => {
  assert.equal(X5D_SLUGS.length, 59);
  for (const id of X5D_SLUGS) {
    const entry = HD_SOUNDBANKS[id];
    assert.ok(entry, `Missing X5D instrument in HD_SOUNDBANKS: ${id}`);
    assert.equal(entry.id, id);
    assert.ok(entry.name, `Missing name for ${id}`);
    assert.ok(entry.category, `Missing category for ${id}`);
  }
});

test("All 59 Korg X5D binary packs and manifests exist on disk with valid anchors", () => {
  const soundfontsBin = path.resolve("public", "soundfonts-bin");
  for (const id of X5D_SLUGS) {
    const packFile = path.join(soundfontsBin, `${id}.pack`);
    const jsonFile = path.join(soundfontsBin, `${id}.json`);

    assert.ok(fs.existsSync(packFile), `Missing pack: ${packFile}`);
    assert.ok(fs.existsSync(jsonFile), `Missing manifest: ${jsonFile}`);

    const packStat = fs.statSync(packFile);
    assert.ok(packStat.size > 100000, `Pack too small: ${packFile} (${packStat.size} bytes)`);

    const manifest = JSON.parse(fs.readFileSync(jsonFile, "utf-8"));
    assert.equal(manifest.id, id);
    assert.ok(Array.isArray(manifest.samples) && manifest.samples.length >= 2, `Invalid samples in ${id}`);

    for (const smp of manifest.samples) {
      assert.ok(typeof smp.n === "string" && smp.n.length > 0, `Invalid note name in ${id}`);
      assert.ok(typeof smp.m === "number" && smp.m >= 20 && smp.m <= 110, `Invalid MIDI note in ${id}`);
      assert.ok(typeof smp.o === "number" && smp.o >= 0, `Invalid offset in ${id}`);
      assert.ok(typeof smp.l === "number" && smp.l > 0, `Invalid length in ${id}`);
    }
  }
});

test("All 59 Korg X5D instruments receive calibrated trim gains", () => {
  for (const id of X5D_SLUGS) {
    const gain = getInstrumentTrimGain(id);
    assert.ok(typeof gain === "number" && Number.isFinite(gain), `Invalid gain for ${id}`);
    assert.ok(gain >= 0.55 && gain <= 0.95, `Trim gain out of range: ${gain} for ${id}`);
  }
});

test("KORG_M1 bank registers all 59 Korg X5D programs and resolves to PCM instruments", () => {
  const korgBank = TRITON_BANKS.KORG_M1;
  assert.ok(korgBank, "KORG_M1 bank must exist");
  assert.equal(korgBank.name, "KORG M1 & X5D");

  const x5dPrograms = korgBank.programs.filter(p => p.id.startsWith("X5D_"));
  assert.equal(x5dPrograms.length, 59, "Must contain all 59 X5D programs");

  for (const prog of x5dPrograms) {
    assert.ok(X5D_SLUGS.includes(prog.instId), `Unknown instId ${prog.instId} in ${prog.id}`);
    const resolved = resolveTritonProgram(prog);
    assert.ok(resolved, `Must resolve program ${prog.id}`);
    assert.equal(resolved.type, "pcm");
    assert.equal(resolved.instKey, prog.instId);
  }
});

test("trimLeadingSilence strips MP3 priming delay (~26ms) and ensures instantaneous attack", () => {
  const mockCtx = createMockAudioContext();
  mockCtx.createBuffer = (ch, len, sr) => {
    const channels = Array.from({ length: ch }, () => new Float32Array(len));
    return {
      numberOfChannels: ch,
      length: len,
      sampleRate: sr,
      duration: len / sr,
      getChannelData: (c) => channels[c] || channels[0],
    };
  };

  const origInit = NativePcmEngine.prototype.initBuffers;
  NativePcmEngine.prototype.initBuffers = function() {
    this.isReady = true;
    return Promise.resolve();
  };
  const engine = new NativePcmEngine(mockCtx);
  NativePcmEngine.prototype.initBuffers = origInit;

  const sr = 44100;
  const totalFrames = 44100;
  const silenceFrames = 1152; // standard MP3 LAME priming delay (~26.1ms)
  const bufL = new Float32Array(totalFrames);
  const bufR = new Float32Array(totalFrames);
  for (let i = silenceFrames; i < totalFrames; i++) {
    const s = Math.sin((2 * Math.PI * 440 * (i - silenceFrames)) / sr);
    bufL[i] = s * 0.8;
    bufR[i] = s * 0.8;
  }
  const mockMp3Buffer = {
    duration: totalFrames / sr,
    sampleRate: sr,
    length: totalFrames,
    numberOfChannels: 2,
    getChannelData: (ch) => (ch === 1 ? bufR : bufL),
    _loopStartSec: 0.5,
    _loopEndSec: 0.9,
    _isLoopable: true,
  };

  const trimmed = engine.trimLeadingSilence(mockCtx, mockMp3Buffer);
  assert.ok(trimmed !== mockMp3Buffer, "Buffer with MP3 delay must be trimmed");
  assert.ok(trimmed.length < totalFrames, "Trimmed length must be shorter than original");
  // sin(0)=0, so threshold (0.0015) is exceeded at sample silenceFrames + 1
  const expectedTrim = (silenceFrames + 1) - 16;
  assert.equal(trimmed.length, totalFrames - expectedTrim);

  const trimmedData = trimmed.getChannelData(0);
  assert.ok(Math.abs(trimmedData[16]) > 0.001, "Transient must be at immediate attack position");

  const trimSec = expectedTrim / sr;
  assert.ok(Math.abs(trimmed._loopStartSec - (0.5 - trimSec)) < 1e-5, "Loop start must adjust by trim duration");

  // Tight buffer (< 32 frames silence) is untouched
  const tightBufL = new Float32Array(totalFrames);
  tightBufL[5] = 0.5;
  const tightBuf = {
    duration: 1.0,
    sampleRate: sr,
    length: totalFrames,
    numberOfChannels: 1,
    getChannelData: () => tightBufL,
  };
  const untrimmed = engine.trimLeadingSilence(mockCtx, tightBuf);
  assert.equal(untrimmed, tightBuf, "Tight buffer must not be modified");
});

test("createCrossfadedLoopBuffer automatically trims leading delay for X5D presets", () => {
  const mockCtx = createMockAudioContext();
  mockCtx.createBuffer = (ch, len, sr) => {
    const channels = Array.from({ length: ch }, () => new Float32Array(len));
    return {
      numberOfChannels: ch,
      length: len,
      sampleRate: sr,
      duration: len / sr,
      getChannelData: (c) => channels[c] || channels[0],
    };
  };

  const origInit = NativePcmEngine.prototype.initBuffers;
  NativePcmEngine.prototype.initBuffers = function() {
    this.isReady = true;
    return Promise.resolve();
  };
  const engine = new NativePcmEngine(mockCtx);
  NativePcmEngine.prototype.initBuffers = origInit;

  const sr = 44100;
  const totalFrames = 44100;
  const silenceFrames = 1152;
  const bufL = new Float32Array(totalFrames);
  const bufR = new Float32Array(totalFrames);
  for (let i = silenceFrames; i < totalFrames; i++) {
    bufL[i] = Math.sin((2 * Math.PI * 440 * (i - silenceFrames)) / sr) * 0.8;
    bufR[i] = bufL[i];
  }
  const x5dBuffer = {
    duration: totalFrames / sr,
    sampleRate: sr,
    length: totalFrames,
    numberOfChannels: 2,
    getChannelData: (ch) => (ch === 1 ? bufR : bufL),
  };

  const processed = engine.createCrossfadedLoopBuffer(mockCtx, x5dBuffer, "x5d_rock_piano");
  assert.ok(processed.length < totalFrames, "Must trim the MP3 silence delay for x5d_rock_piano");
  const expectedTrim = (silenceFrames + 1) - 16;
  assert.equal(processed.length, totalFrames - expectedTrim);
});
