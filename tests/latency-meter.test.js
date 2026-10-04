import { test } from "node:test";
import assert from "node:assert/strict";
import {
  latencyMeter,
  median,
  round1,
  correlateDetections,
} from "../src/audio/latency-meter.js";

test("median handles odd, even, and empty inputs", () => {
  assert.equal(median([5]), 5);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median(null), null);
});

test("round1 rounds to one decimal", () => {
  assert.equal(round1(44.06251), 44.1);
  assert.equal(round1(2.94999), 2.9);
});

test("inputArrived records delivery EMA and returns the t0 token", () => {
  latencyMeter.reset();
  const t0 = latencyMeter.inputArrived("midi", 1000.0, 1012.0);
  assert.equal(t0, 1012.0);

  latencyMeter.inputArrived("midi", 2000.0, 2016.0);
  const stats = latencyMeter.getStats("midi");
  assert.equal(stats.samples, 2);
  assert.ok(stats.deliveryMs >= 12 && stats.deliveryMs <= 16, "EMA must sit between the two samples");
  assert.equal(stats.trusted, true);
  assert.equal(stats.minMs, 12);
  assert.equal(stats.maxMs, 16);
});

test("dispatchDone records the JS dispatch cost", () => {
  latencyMeter.reset();
  const t0 = latencyMeter.inputArrived("touch", 500.0, 505.0);
  latencyMeter.dispatchDone("touch", t0, 506.5);
  const stats = latencyMeter.getStats("touch");
  assert.equal(stats.dispatchMs, 1.5);
});

test("untimestamped events are flagged untrusted instead of faked", () => {
  latencyMeter.reset();
  // Browsers that set timeStamp=now produce ~0 delivery — not a measurement.
  latencyMeter.inputArrived("qwerty", 900.000, 900.004);
  latencyMeter.inputArrived("qwerty", 901.000, 901.004);
  latencyMeter.inputArrived("qwerty", 902.000, 902.004);
  const stats = latencyMeter.getStats("qwerty");
  assert.equal(stats.samples, 3);
  assert.equal(stats.trusted, false, "all-zero deliveries mean the platform cannot measure");
  assert.equal(stats.deliveryMs, null, "no fabricated delivery number");
});

test("getStats returns null for unknown sources", () => {
  latencyMeter.reset();
  assert.equal(latencyMeter.getStats("midi"), null);
});

test("correlateDetections pairs clicks to detections and rejects noise", () => {
  const clicks = [10.0, 10.4, 10.8, 11.2];
  const detections = [
    10.045, // click 1 (+45ms)
    10.441, // click 2 (+41ms)
    10.001, // bogus: before minMs window (1ms < minMs=2)
    10.848, // click 3 (+48ms)
    11.239, // click 4 (+39ms)
    12.9, // stray noise far outside any window
  ];
  const result = correlateDetections(clicks, detections);
  assert.equal(result.matched, 4, "every click pairs with its nearest detection");
  assert.deepEqual(
    result.samples.slice().sort((a, b) => a - b),
    [39, 41, 45, 48]
  );
  assert.equal(result.medianMs, 43);
});

test("correlateDetections reports matched=0 when nothing is heard", () => {
  const result = correlateDetections([10.0, 10.4], []);
  assert.equal(result.matched, 0);
  assert.equal(result.medianMs, null);
});

test("the probe worklet source is bundled and registers the right processor", async () => {
  const { readFile } = await import("node:fs/promises");
  const code = await readFile(
    new URL("../src/audio/worklet/latency-probe-processor.js", import.meta.url),
    "utf8"
  );
  assert.match(code, /registerProcessor\("wilsonix-latency-probe"/);
  assert.match(code, /CALIBRATION_SEC/);
  assert.match(code, /REFRACTORY_SEC/);
});
