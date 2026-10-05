import { test } from "node:test";
import assert from "node:assert/strict";
import { toBase64, shouldEnable, OutputBridge } from "../src/audio/output-bridge.js";
import { audioCore } from "../src/audio/audio-core.js";

/**
 * Native Oboe output bridge (Phase A) regression coverage:
 * transport encoding, activation flag parsing, tap worklet chunking +
 * silence contract, fail-safe graph restore, and the latency meter's
 * honesty branch when the native path is active.
 */

test("toBase64 matches Node's base64 for every remainder class", () => {
  assert.equal(toBase64(new Uint8Array(0)), "");
  for (const len of [1, 2, 3, 4, 5, 6, 7, 960, 3840]) {
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = (i * 31 + 7) & 0xff;
    assert.equal(
      toBase64(bytes),
      Buffer.from(bytes).toString("base64"),
      `length ${len} must round-trip identically`,
    );
  }
  const extremes = Uint8Array.from([0, 0, 0, 255, 255, 255, 128, 64, 32]);
  assert.equal(toBase64(extremes), Buffer.from(extremes).toString("base64"));
});

test("shouldEnable only accepts an explicit ?bridge=1", () => {
  assert.equal(shouldEnable("?bridge=1"), true);
  assert.equal(shouldEnable("?foo=2&bridge=1"), true);
  assert.equal(shouldEnable("?bridge=0"), false);
  assert.equal(shouldEnable("?bridg"), false);
  assert.equal(shouldEnable(""), false);
  // Node has no location: default call must be off (bridge is opt-in).
  assert.equal(shouldEnable(), false);
});

test("tap processor chunks at 480 frames, transfers buffers, outputs silence", async () => {
  // AudioWorklet runtime stubs (must exist before the module evaluates).
  globalThis.AudioWorkletProcessor = class {
    constructor() {
      this.port = {
        onmessage: null,
        posted: [],
        postMessage: (msg, transfer) => this.port.posted.push({ msg, transfer }),
      };
    }
  };
  const registered = [];
  globalThis.registerProcessor = (name) => registered.push(name);
  globalThis.__wilsonixOutputTapRegistered = false;

  const { OutputTapProcessor } = await import(
    "../src/audio/worklet/output-tap-processor.js"
  );
  assert.ok(registered.includes("wilsonix-output-tap"), "processor must register");

  const tap = new OutputTapProcessor({
    processorOptions: { chunkFrames: 480 },
  });
  assert.ok(tap.port, "runtime must provide port");

  let frame = 0;
  const quantum = () => {
    const ch0 = new Float32Array(128);
    const ch1 = new Float32Array(128);
    for (let i = 0; i < 128; i++) {
      ch0[i] = frame + i;
      ch1[i] = -(frame + i);
    }
    frame += 128;
    const out0 = new Float32Array(128).fill(0.5);
    const out1 = new Float32Array(128).fill(0.5);
    const keep = tap.process([[ch0, ch1]], [[out0, out1]]);
    return { keep, out0, out1 };
  };

  // 10 quanta = 1280 frames -> 2 full 480-frame chunks + 320 held back.
  let last = null;
  for (let q = 0; q < 10; q++) last = quantum();
  assert.equal(tap.chunksPosted, 2, "1280 frames must yield exactly 2 chunks");
  assert.equal(tap.port.posted.length, 2);
  assert.equal(last.keep, true, "processor must stay alive");

  // Silence contract: whatever the inputs carry, the web output is zeros.
  assert.ok(last.out0.every((v) => v === 0), "left output must be silent");
  assert.ok(last.out1.every((v) => v === 0), "right output must be silent");

  // Chunk 1 must contain frames 0..479 interleaved, with transfer list.
  const first = tap.port.posted[0];
  assert.equal(first.msg.length, 960, "480 stereo frames = 960 floats");
  assert.equal(first.transfer.length, 1, "buffer must be transferred, not copied");
  assert.equal(first.msg[0], 0, "frame 0 left");
  assert.equal(first.msg[1], -0, "frame 0 right (signed zero is fine)");
  assert.equal(first.msg[958], 479, "frame 479 left");
  assert.equal(first.msg[959], -479, "frame 479 right");

  // disable() stops feeding the native path.
  tap.port.onmessage({ data: { type: "disable" } });
  for (let q = 0; q < 8; q++) quantum();
  assert.equal(tap.chunksPosted, 2, "disabled tap must not post chunks");
});

test("_fail restores the web path and keeps the first fallback reason", () => {
  const calls = [];
  const destination = { name: "destination" };
  const core = {
    ctx: { destination, sampleRate: 48000 },
    outputStage: {
      connect: (d) => calls.push(d === destination ? "stage->destination" : "stage->other"),
      disconnect: (d) =>
        calls.push(d === destination ? "stage-x-destination" : "stage-x-all"),
    },
    updateLatencyMetrics: () => calls.push("metrics-refreshed"),
  };

  const bridge = new OutputBridge(core);
  bridge.enabled = true;
  bridge.active = true;
  bridge._tapNode = { port: { onmessage: () => {} }, disconnect: () => calls.push("tap-x") };
  bridge._silentGain = { disconnect: () => calls.push("silent-x") };
  bridge._watchdog = setInterval(() => {}, 1000);

  bridge._fail("xrun-storm");

  assert.equal(bridge.enabled, false, "bridge must deactivate");
  assert.equal(bridge.active, false);
  assert.equal(bridge.fallbackReason, "xrun-storm");
  assert.equal(bridge._watchdog, null, "watchdog must be cleared");
  assert.deepEqual(
    calls.filter((c) => c === "tap-x" || c === "silent-x"),
    ["tap-x", "silent-x"],
    "tap graph must be torn down",
  );
  assert.ok(
    calls.includes("stage-x-all") &&
      calls.indexOf("stage-x-all") < calls.indexOf("stage->destination"),
    "outputStage must be rewired straight back to ctx.destination",
  );
  assert.ok(calls.includes("metrics-refreshed"), "pill must refresh after fallback");

  // Idempotent + first reason wins.
  bridge._fail("some-later-reason");
  assert.equal(bridge.fallbackReason, "xrun-storm", "first reason must stick");
});

test("persisted flag auto-enables and is cleared when enable fails", async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    const bridge = new OutputBridge({ ctx: null, outputStage: null });

    // No query flag, no persisted choice -> no attempt at all.
    assert.equal(await bridge.maybeEnable(), false);
    assert.equal(bridge._attempted, false, "must not attempt without a signal");

    // Persisted success from a previous launch -> attempts; on a platform
    // where native is unavailable the attempt fails and persistence must be
    // cleared, so a dead path never retries at every boot.
    store.set("midikey_native_bridge", "1");
    assert.equal(await bridge.maybeEnable(), false);
    assert.equal(bridge._attempted, true, "persisted flag must trigger an attempt");
    assert.equal(bridge.fallbackReason, "not-native-or-no-ctx");
    assert.equal(
      store.has("midikey_native_bridge"),
      false,
      "failed enable must clear persistence",
    );

    // retryEnable allows a second attempt (fresh fallback reason).
    assert.equal(await bridge.retryEnable(), false);
    assert.equal(bridge._attempted, true);
  } finally {
    delete globalThis.localStorage;
  }
});

test("backpressure guard drops chunks during stalls, fails only when sustained", () => {
  const core = { ctx: null, outputStage: null, updateLatencyMetrics() {} };
  const bridge = new OutputBridge(core);
  bridge.enabled = true;
  bridge.active = true;
  bridge._chunksSent = 10;
  bridge._inflight = 12;

  // Transient stall: chunk is dropped (not sent, not counted), no fallback.
  bridge._onChunk(new Float32Array(960));
  assert.equal(bridge._chunksSent, 10, "dropped chunk must not count as sent");
  assert.equal(bridge._droppedChunks, 1);
  assert.equal(bridge._dropBurst, 1);
  assert.equal(bridge.enabled, true, "a short stall must not fall back");

  // Sustained overload: 50 straight drops = 500ms -> web-path fallback.
  bridge._dropBurst = 49;
  bridge._onChunk(new Float32Array(960));
  assert.equal(bridge.enabled, false);
  assert.equal(bridge.fallbackReason, "backpressure");
  assert.equal(bridge._droppedChunks, 2);

  // Summary exposes RTT + drops for the popover.
  const s2 = new OutputBridge(core);
  assert.equal(s2.getSummary().rttMs, null);
  assert.equal(s2.getSummary().droppedChunks, 0);
  s2._rttEwma = 12.44;
  assert.equal(s2.getSummary().rttMs, 12);
});

test("watchdog: prefill grace, 2-strike transients, structural failures", () => {
  const core = { ctx: null, outputStage: null, updateLatencyMetrics() {} };
  const mk = () => {
    const b = new OutputBridge(core);
    b.enabled = true;
    b.active = true;
    return b;
  };
  const base = { ok: true, running: true, prefilling: false, xruns: 0, fillMs: 20 };

  // Prefill phase (stream not started yet) is healthy by definition.
  let b = mk();
  b._evaluateStats({ ...base, running: false, prefilling: true });
  assert.equal(b.enabled, true, "prefilling must not count as stream-stopped");

  // Stopped without prefilling = structural -> immediate fallback.
  b = mk();
  b._evaluateStats({ ...base, running: false, prefilling: false });
  assert.equal(b.enabled, false);
  assert.equal(b.fallbackReason, "stream-stopped");

  // One unhealthy window = strike only; a clean window resets it.
  b = mk();
  b._evaluateStats({ ...base, xruns: 40 });
  assert.equal(b.enabled, true, "first bad window must survive");
  assert.equal(b._watchdogStrikes, 1);
  b._evaluateStats({ ...base, xruns: 40 });
  assert.equal(b._watchdogStrikes, 0, "clean window resets strikes");

  // Two CONSECUTIVE unhealthy windows = xrun-storm fallback.
  b._evaluateStats({ ...base, xruns: 80 });
  assert.equal(b.enabled, true, "strike 1 of the new streak survives");
  b._evaluateStats({ ...base, xruns: 120 });
  assert.equal(b.enabled, false, "strike 2 falls back");
  assert.equal(b.fallbackReason, "xrun-storm");

  // Cumulative backstop (raised to 250 to tolerate a few bad seconds).
  b = mk();
  b._evaluateStats({ ...base, xruns: 251 });
  assert.equal(b.fallbackReason, "xrun-cumulative");

  // Ring starvation also needs 2 consecutive windows.
  b = mk();
  b._chunksSent = 100;
  b._evaluateStats({ ...base, fillMs: 0 });
  assert.equal(b.enabled, true, "starve strike 1 survives");
  b._evaluateStats({ ...base, fillMs: 0 });
  assert.equal(b.fallbackReason, "ring-starvation");
});

test("latency meter reports the native path when the bridge is active", () => {
  const origCtx = audioCore.ctx;
  const origBridge = audioCore.outputBridge;
  const origReported = audioCore.reportedLatencyMs;
  audioCore.ctx = {
    sampleRate: 48000,
    baseLatency: 0.005,
    outputLatency: 0.045,
    state: "running",
  };

  try {
    // Active native path: output = ring fill + Oboe stream latency.
    audioCore.outputBridge = {
      active: true,
      stats: { latencyMs: 12.3, fillMs: 16.0, burst: 192, xruns: 0 },
    };
    const l = audioCore.measureLatency();
    assert.equal(l.nativeBridge, true);
    assert.equal(l.outputMs, 28.3, "16.0 fill + 12.3 stream");
    assert.equal(l.measuredMs, 28.3);
    assert.equal(l.estimated, false, "both native numbers reported = measured");
    assert.equal(l.nativeLatencyMs, 12.3);
    assert.equal(l.nativeFillMs, 16.0);
    assert.equal(l.measuredFrames, 192, "burst frames are the native quantum");
    audioCore.updateLatencyMetrics();
    assert.equal(audioCore.reportedLatencyMs, 28.3, "pill must follow the bridge");

    // Unknown native latency stays labelled as an estimate.
    audioCore.outputBridge = {
      active: true,
      stats: { latencyMs: 0, fillMs: 16.0, burst: 128, xruns: 0 },
    };
    const est = audioCore.measureLatency();
    assert.equal(est.estimated, true, "missing stream latency = estimate");
    assert.equal(est.outputMs, 16.0);

    // Inactive bridge: Chromium path numbers, nativeBridge flag false.
    audioCore.outputBridge = { active: false, stats: null };
    const web = audioCore.measureLatency();
    assert.equal(web.nativeBridge, false);
    assert.equal(web.outputMs, 45, "ctx.outputLatency path untouched");
    assert.equal(web.measuredMs, 50, "base 5 + output 45");
    assert.equal(web.estimated, false);
    audioCore.updateLatencyMetrics();
    assert.equal(audioCore.reportedLatencyMs, 50);
  } finally {
    audioCore.ctx = origCtx;
    audioCore.outputBridge = origBridge;
    audioCore.reportedLatencyMs = origReported;
  }
});
