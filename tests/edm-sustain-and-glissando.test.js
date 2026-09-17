import { test } from "node:test";
import assert from "node:assert/strict";
import { configureSustainLoop } from "../src/audio/sample-loop-helper.js";
import { BLOOM_EDM_BANKS } from "../src/audio/bloom-edm-manifest.js";
import { ANIMAL_EDM_BANKS } from "../src/audio/animal-edm-manifest.js";

test("configureSustainLoop sets loopable sustain regions on EDM leads, saws, pads, and basses", () => {
  const sr = 44100;
  const numFrames = 44100 * 2; // 2 seconds
  const chData = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    chData[i] = Math.sin(2 * Math.PI * 220 * i / sr);
  }

  const mockBuffer = () => ({
    duration: 2.0,
    sampleRate: sr,
    length: numFrames,
    numberOfChannels: 1,
    getChannelData: () => chData,
  });

  // Test sustaining categories
  const sustainingKeys = [
    "bloom_closer_lead",
    "bloom_roses_lead",
    "bloom_inside_out_lead",
    "bloom_paris_pad",
    "bloom_breakdown_bass",
    "animal_festival_lead_1",
    "animal_power_saw",
    "animal_sub_drop_bass_1"
  ];

  for (const key of sustainingKeys) {
    const def = BLOOM_EDM_BANKS[key] || ANIMAL_EDM_BANKS[key];
    assert.ok(def, `${key} must exist in manifest`);
    const buf = mockBuffer();
    configureSustainLoop(buf, def.subCategory || def.category, key);
    assert.equal(buf._isLoopable, true, `${key} must be loopable for infinite keyboard sustain`);
    assert.ok(buf._loopStartSec > 0.15, `${key} loop start must allow attack punch`);
    assert.ok(buf._loopEndSec > buf._loopStartSec + 0.1, `${key} loop end must exceed loop start`);
  }
});

test("configureSustainLoop keeps one-shot plucks and FX risers non-loopable for natural decay", () => {
  const sr = 44100;
  const numFrames = 44100 * 2;
  const chData = new Float32Array(numFrames);
  const mockBuffer = () => ({
    duration: 2.0,
    sampleRate: sr,
    length: numFrames,
    numberOfChannels: 1,
    getChannelData: () => chData,
  });

  const oneShotKeys = [
    "bloom_all_we_know_pluck",
    "animal_drop_pluck_1",
    "animal_dutch_pluck"
  ];

  for (const key of oneShotKeys) {
    const def = BLOOM_EDM_BANKS[key] || ANIMAL_EDM_BANKS[key];
    if (!def) continue;
    const buf = mockBuffer();
    configureSustainLoop(buf, def.subCategory || def.category, key);
    assert.equal(buf._isLoopable, false, `${key} must not be loopable`);
  }
});

test("NativePcmEngine voice pool guarantees zero duplicate nodes and supports fastStopNote", async () => {
  const { NativePcmEngine } = await import("../src/audio/native-pcm-engine.js");

  // Create a minimal mock AudioContext
  const mockCtx = {
    sampleRate: 44100,
    currentTime: 0,
    createGain: () => ({
      gain: {
        value: 1,
        cancelScheduledValues: () => {},
        setValueAtTime: () => {},
        setTargetAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
      disconnect: () => {},
    }),
    createBiquadFilter: () => ({
      type: "lowpass",
      frequency: {
        value: 18000,
        cancelScheduledValues: () => {},
        setValueAtTime: () => {},
        setTargetAtTime: () => {},
      },
      Q: {
        value: 1,
        cancelScheduledValues: () => {},
        setValueAtTime: () => {},
      },
      connect: () => {},
      disconnect: () => {},
    }),
    createBuffer: (ch, len, sr) => ({
      numberOfChannels: ch,
      length: len,
      sampleRate: sr,
      duration: len / sr,
      getChannelData: () => new Float32Array(len),
    }),
    destination: {},
  };

  const engine = new NativePcmEngine(mockCtx, mockCtx.destination);
  assert.equal(typeof engine.fastStopNote, "function", "engine must expose fastStopNote");

  // Test pool uniqueness: pushing the same node pair multiple times must be prevented
  const sharedFilter = mockCtx.createBiquadFilter();
  const sharedGain = mockCtx.createGain();

  const mockVoice1 = {
    src: { disconnect: () => {}, onended: null },
    filter: sharedFilter,
    voiceGain: sharedGain,
    _isRemoved: false,
    _isRecycled: false,
  };

  const mockVoice2 = {
    src: { disconnect: () => {}, onended: null },
    filter: sharedFilter,
    voiceGain: sharedGain,
    _isRemoved: false,
    _isRecycled: false,
  };

  engine.removeVoice(60, mockVoice1);
  engine._disconnectAndRecycle(60, mockVoice2);

  // Pool must have exactly 1 entry for this filter/gain, not 2
  const poolEntries = engine._voiceNodePool.filter(p => p.filter === sharedFilter && p.voiceGain === sharedGain);
  assert.equal(poolEntries.length, 1, "_voiceNodePool must never contain duplicate node pairs");
});

test("NativePcmEngine fastStopNote respects sustainPedal when active", async () => {
  const { NativePcmEngine } = await import("../src/audio/native-pcm-engine.js");
  const mockCtx = {
    sampleRate: 44100,
    currentTime: 0,
    createGain: () => ({ gain: { value: 1, cancelScheduledValues: () => {}, setValueAtTime: () => {}, setTargetAtTime: () => {} }, connect: () => {}, disconnect: () => {} }),
    createBiquadFilter: () => ({ type: "lowpass", frequency: { value: 18000, cancelScheduledValues: () => {}, setValueAtTime: () => {}, setTargetAtTime: () => {} }, Q: { value: 1, cancelScheduledValues: () => {}, setValueAtTime: () => {} }, connect: () => {}, disconnect: () => {} }),
    createBuffer: (ch, len, sr) => ({
      numberOfChannels: ch,
      length: len,
      sampleRate: sr,
      duration: len / sr,
      getChannelData: () => new Float32Array(len),
    }),
    destination: {},
  };

  const engine = new NativePcmEngine(mockCtx, mockCtx.destination);
  engine.setSustainPedal(true);
  assert.equal(engine.sustainPedal, true);

  const mockVoice = {
    src: { stop: () => {} },
    voiceGain: { gain: { value: 0.8, cancelScheduledValues: () => {}, setValueAtTime: () => {}, setTargetAtTime: () => {} } },
    instId: "bloom_closer_lead",
    midiNote: 64,
  };

  engine.activeVoices.set(64, [mockVoice]);
  engine.fastStopNote("bloom_closer_lead", 64, 0);

  // When sustain pedal is active, voice must be saved to sustainedVoices instead of forcibly destroyed
  assert.ok(engine.sustainedVoices.has(64), "Voice must be added to sustainedVoices when pedal is active");
  assert.equal(engine.sustainedVoices.get(64).length, 1);
});


