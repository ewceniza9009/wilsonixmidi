import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NativePcmEngine } from "../src/audio/native-pcm-engine.js";
import { multisampleLoader } from "../src/audio/multisample-loader.js";
import { MULTISAMPLE_BANKS } from "../src/audio/multisample-manifest.js";
import { HD_SOUNDBANKS } from "../src/audio/soundbanks.js";
import { isSfxInstrumentId } from "../src/audio/sfx-instrument-ids.js";
import { sampleCache } from "../src/audio/sample-cache.js";

function fakeEngine() {
  // Minimal instance without the constructor (no AudioContext in Node):
  // prototype methods only need the state fields they touch.
  const engine = Object.create(NativePcmEngine.prototype);
  engine._velocityThresholds = new Map();
  engine._rrCounters = new Map();
  return engine;
}

test("velocityToLayerIndex: ascending lower-bounds resolve the right layer", () => {
  const engine = fakeEngine();
  engine._velocityThresholds.set("ms_test", [1, 55, 98]);
  assert.equal(engine.velocityToLayerIndex("ms_test", 1), 0);
  assert.equal(engine.velocityToLayerIndex("ms_test", 54), 0);
  assert.equal(engine.velocityToLayerIndex("ms_test", 55), 1);
  assert.equal(engine.velocityToLayerIndex("ms_test", 97), 1);
  assert.equal(engine.velocityToLayerIndex("ms_test", 98), 2);
  assert.equal(engine.velocityToLayerIndex("ms_test", 127), 2);
});

test("velocityToLayerIndex: instruments without thresholds resolve layer 0", () => {
  const engine = fakeEngine();
  assert.equal(engine.velocityToLayerIndex("unknown_inst", 90), 0);
});

test("velocityToLayerIndex: multisample loader registry is consulted", () => {
  const engine = fakeEngine();
  multisampleLoader.velocityThresholds.set("ms_loader_test", [1, 40, 80]);
  try {
    assert.equal(engine.velocityToLayerIndex("ms_loader_test", 10), 0);
    assert.equal(engine.velocityToLayerIndex("ms_loader_test", 50), 1);
    assert.equal(engine.velocityToLayerIndex("ms_loader_test", 100), 2);
  } finally {
    multisampleLoader.velocityThresholds.delete("ms_loader_test");
  }
});

test("_applyRoundRobin: single-variant results pass through unchanged", () => {
  const engine = fakeEngine();
  const result = { anchorMidi: 60, buffer: { id: "base" } };
  assert.equal(engine._applyRoundRobin(result, "ms_x"), result);
  assert.equal(engine._applyRoundRobin(null, "ms_x"), null);
});

test("_applyRoundRobin: repeated notes cycle through rr variants", () => {
  const engine = fakeEngine();
  const base = { id: "rr1" };
  const second = { id: "rr2" };
  const third = { id: "rr3" };
  const cached = {
    anchorMidi: 60,
    buffer: base,
    variants: [base, second, third],
    vlName: "vl2",
  };

  const r1 = engine._applyRoundRobin(cached, "ms_x");
  assert.equal(r1, cached, "first note plays the base variant (no rrKey)");

  const r2 = engine._applyRoundRobin(cached, "ms_x");
  assert.equal(r2.buffer, second, "second note plays rr2");
  assert.equal(r2.rrKey, "60_vl2_rr2");
  assert.equal(r2.anchorMidi, 60, "pitch reference unchanged");

  const r3 = engine._applyRoundRobin(cached, "ms_x");
  assert.equal(r3.buffer, third, "third note plays rr3");
  assert.equal(r3.rrKey, "60_vl2_rr3");

  const r4 = engine._applyRoundRobin(cached, "ms_x");
  assert.equal(r4, cached, "fourth note wraps back to the base variant");

  // Counter is per instId+anchor — a different instrument/anchor cycles independently.
  const other = engine._applyRoundRobin(cached, "ms_y");
  assert.equal(other, cached, "different instId starts its own cycle at the base");
});

test("MULTISAMPLE_BANKS entries are well-formed and registered in the catalog", () => {
  for (const [key, bank] of Object.entries(MULTISAMPLE_BANKS)) {
    assert.equal(bank.id, key, `${key} id must match its key`);
    assert.equal(typeof bank.name, "string");
    assert.equal(typeof bank.category, "string");
    assert.equal(typeof bank.path, "string");
    assert.ok(Array.isArray(bank.samples) && bank.samples.length > 0, `${key} must list samples`);
    for (const s of bank.samples) {
      assert.equal(typeof s.f, "string");
      assert.equal(typeof s.m, "number");
      assert.ok(s.m >= 0 && s.m <= 127, `${key} sample ${s.f} midi within range`);
      assert.match(s.v, /^vl\d+$/, `${key} sample ${s.f} velocity layer naming`);
      assert.ok(s.rr === undefined || s.rr >= 0, `${key} sample ${s.f} rr index`);
    }
    assert.ok(HD_SOUNDBANKS[key], `${key} must be registered in HD_SOUNDBANKS`);
  }
});

test("Imported multisample sample files exist on disk", () => {
  for (const bank of Object.values(MULTISAMPLE_BANKS)) {
    const dir = path.resolve("." + bank.path);
    assert.ok(fs.existsSync(dir), `${bank.path} directory must exist`);
    for (const s of bank.samples) {
      const filePath = path.join(dir, s.f);
      assert.ok(fs.existsSync(filePath), `Sample file ${s.f} must exist on disk`);
      assert.ok(fs.statSync(filePath).size > 1000, `Sample file ${s.f} must not be empty`);
    }
  }
});

test("Binary soundfont packs: every manifest has a valid size-matched pack", () => {
  const dir = path.resolve("public/soundfonts-bin");
  assert.ok(fs.existsSync(dir), "public/soundfonts-bin must exist (packs are the only soundfont source)");

  const manifests = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(manifests.length > 0, "at least one extracted soundfont manifest must exist");

  for (const m of manifests) {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, m), "utf8"));
    assert.ok(manifest.count > 0, `${m} must list samples`);
    const packPath = path.join(dir, m.replace(/\.json$/, ".pack"));
    assert.ok(fs.existsSync(packPath), `${m} must have a .pack sibling`);
    assert.equal(
      fs.statSync(packPath).size,
      manifest.totalBytes,
      `${m} pack size must match manifest totalBytes`,
    );
    for (const s of manifest.samples) {
      assert.equal(typeof s.m, "number");
      assert.equal(typeof s.o, "number");
      assert.equal(typeof s.l, "number");
      assert.ok(s.o >= 0 && s.l > 0 && s.o + s.l <= manifest.totalBytes, `${m} sample ${s.n} within pack bounds`);
    }
  }
});

test("isSfxInstrumentId: stateless classification matches the generator contract", () => {
  assert.equal(isSfxInstrumentId("nature_thunder"), true);
  assert.equal(isSfxInstrumentId("real_drum_kit"), true);
  assert.equal(isSfxInstrumentId("dj_scratch_r"), false, "sample-backed _r ids are not SFX");
  assert.equal(isSfxInstrumentId("choir_aahs"), false, "choir_aahs is PCM-sampled");
  assert.equal(isSfxInstrumentId("acoustic_grand_piano"), false);
  assert.equal(isSfxInstrumentId(null), false);
});

test("SampleCache._looksLikeAudio handles edge cases and short buffers without error", () => {
  const SampleCacheClass = sampleCache.constructor;
  // Buffer shorter than 4 bytes
  assert.equal(SampleCacheClass._looksLikeAudio(new Uint8Array([0x66, 0x4c])), false);
  // Buffer shorter than 8 bytes (verifies ftyp length guard)
  assert.equal(SampleCacheClass._looksLikeAudio(new Uint8Array([0, 0, 0, 0, 0x66, 0x74])), false);
  // Valid audio formats
  assert.equal(SampleCacheClass._looksLikeAudio(new Uint8Array([0x66, 0x4c, 0x61, 0x43])), true); // fLaC
  assert.equal(SampleCacheClass._looksLikeAudio(new Uint8Array([0x52, 0x49, 0x46, 0x46])), true); // RIFF
  assert.equal(SampleCacheClass._looksLikeAudio(new Uint8Array([0x49, 0x44, 0x33, 0x03])), true); // ID3
  assert.equal(SampleCacheClass._looksLikeAudio(new Uint8Array([0x4f, 0x67, 0x67, 0x53])), true); // OggS
  assert.equal(SampleCacheClass._looksLikeAudio(new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70])), true); // ftyp
  assert.equal(SampleCacheClass._looksLikeAudio(new Uint8Array([0xff, 0xfb, 0x90, 0x64])), true); // MPEG frame sync
});

test("_prewarmWorklet queues instruments when worklet is unready and flushPendingPrewarms drains them", () => {
  const engine = fakeEngine();
  engine.pcmWorkletNode = { isReady: false };
  engine._pendingPrewarms = new Set();
  engine.decodedBuffers = new Map([["test_inst", new Map([[60, {}]])]]);

  // Worklet unready: prewarm call queues the instId
  engine._prewarmWorklet("test_inst");
  assert.ok(engine._pendingPrewarms.has("test_inst"), "must be queued when worklet not ready");

  // Track worklet calls on ready
  const prewarmed = [];
  engine.pcmWorkletNode = {
    isReady: true,
    prewarmChunked: (name) => prewarmed.push(name),
  };

  engine.flushPendingPrewarms();
  assert.equal(engine._pendingPrewarms.size, 0, "queue must be cleared after flush");
  assert.ok(prewarmed.includes("test_inst"), "queued inst must be prewarmed on flush");
});

test("NativePcmEngine fastStopNote forwards to pcmWorkletNode.fastNoteOff with layerIndex", () => {
  const engine = fakeEngine();
  const fastOffCalls = [];
  engine.pcmWorkletNode = {
    isReady: true,
    fastNoteOff: (midi, layer) => fastOffCalls.push({ midi, layer }),
  };

  engine.fastStopNote("inst_test", 72, 0, 2);
  assert.equal(fastOffCalls.length, 1, "fastNoteOff must be invoked on worklet");
  assert.deepEqual(fastOffCalls[0], { midi: 72, layer: 2 });
});

test("NativePcmEngine setPolyphonyCap clamps value and syncs to worklet", () => {
  const engine = fakeEngine();
  let workletCap = null;
  engine.pcmWorkletNode = {
    isReady: true,
    setPolyphonyCap: (cap) => { workletCap = cap; },
  };

  engine.setPolyphonyCap(48);
  assert.equal(engine.MAX_VOICES, 48);
  assert.equal(workletCap, 48);

  // Clamped bounds (16–128)
  engine.setPolyphonyCap(8);
  assert.equal(engine.MAX_VOICES, 16);
  assert.equal(workletCap, 16);

  engine.setPolyphonyCap(500);
  assert.equal(engine.MAX_VOICES, 128);
  assert.equal(workletCap, 128);
});

test("PcmWorkletNode buffer cache headroom is at least 256 to prevent combi thrash", () => {
  const code = fs.readFileSync(path.resolve("src/audio/worklet/pcm-worklet-node.js"), "utf8");
  const match = code.match(/this\._loadedBufferMaxSize\s*=\s*(\d+)/);
  assert.ok(match, "must declare _loadedBufferMaxSize");
  const size = parseInt(match[1], 10);
  assert.ok(size >= 256, `cache limit must be >= 256 (got ${size})`);
});


