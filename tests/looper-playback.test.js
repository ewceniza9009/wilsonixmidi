import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOUNDFONTS_BIN_DIR = path.resolve(__dirname, "../public/soundfonts-bin");

test("Looper source code routes VA programs through getVaEngineFor", () => {
  const looperPath = path.resolve(__dirname, "../src/components/looper.js");
  const looperCode = fs.readFileSync(looperPath, "utf-8");

  // Must import getTritonProgramById
  assert.ok(
    looperCode.includes("getTritonProgramById"),
    "looper.js must import or reference getTritonProgramById",
  );

  // Must route VA timbres in _playLooperEvent
  assert.ok(
    looperCode.includes("getVaEngineFor"),
    "looper.js must use getVaEngineFor for VA synthesis",
  );

  // Must call audioCore.ensureRunning on startPlayback / togglePlay
  assert.ok(
    looperCode.includes("audioCore.ensureRunning"),
    "looper.js must call audioCore.ensureRunning to wake suspended contexts",
  );

  // Must NOT display the false-alarm cache corruption toast on silent voices
  assert.ok(
    !looperCode.includes("cached samples may be corrupted. Open LATENCY popover"),
    "looper.js must not show deceptive cache corruption toast",
  );
});

test("AudioCore resume unconditionally attempts to resume suspended AudioContext", () => {
  const audioCorePath = path.resolve(__dirname, "../src/audio/audio-core.js");
  const audioCoreCode = fs.readFileSync(audioCorePath, "utf-8");

  // resume() must not be gated by _suspendedByApp
  const resumeMatch = audioCoreCode.match(/async\s+resume\(\)\s*\{([\s\S]*?)\}/);
  assert.ok(resumeMatch, "audio-core.js must have async resume() method");
  assert.ok(
    !resumeMatch[1].includes("_suspendedByApp &&"),
    "resume() must not block resuming if _suspendedByApp is false",
  );
});

test("All 10 Roland audio packs have valid totalBytes matching disk size", () => {
  const ROLAND_IDS = [
    "roland_d50_fantasia",
    "roland_u20_choir",
    "roland_bright_ep",
    "roland_sc55_warm_pad",
    "roland_space_voice",
    "roland_metal_pad",
    "roland_sc55_finger_bass",
    "roland_u20_shakuhachi",
    "roland_orchestra_hit",
    "roland_synth_brass",
  ];

  for (const id of ROLAND_IDS) {
    const packPath = path.join(SOUNDFONTS_BIN_DIR, `${id}.pack`);
    const jsonPath = path.join(SOUNDFONTS_BIN_DIR, `${id}.json`);
    assert.ok(fs.existsSync(packPath), `Missing pack: ${id}`);
    assert.ok(fs.existsSync(jsonPath), `Missing json: ${id}`);

    const stat = fs.statSync(packPath);
    const meta = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    assert.equal(meta.totalBytes, stat.size, `Manifest byte count mismatch for ${id}`);
    assert.ok(meta.samples.length > 0, `No samples in manifest for ${id}`);
  }
});
