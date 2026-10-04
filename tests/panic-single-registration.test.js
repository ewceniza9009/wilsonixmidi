import { test } from "node:test";
import assert from "node:assert/strict";

// Regression guard for the double-cleanup bug: panic() both runs the
// multiLayerEngine hook registry AND dispatches the `wilsonix:panic` window
// event. Components used to register on BOTH channels, so every panic ran
// their cleanup twice (double stop / double state reset).
test("importing the arpeggiator registers a panic hook but no wilsonix:panic listener", async () => {
  const panicListeners = [];
  globalThis.window = {
    addEventListener: (type, fn) => panicListeners.push({ type, fn }),
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };

  const { multiLayerEngine } = await import("../src/audio/multi-layer-engine.js");
  const hooksBefore = multiLayerEngine._panicHooks.size;

  await import("../src/audio/arpeggiator.js");

  assert.ok(
    multiLayerEngine._panicHooks.size > hooksBefore,
    "the arp must stop itself through the panic hook registry",
  );
  assert.equal(
    panicListeners.filter((l) => l.type === "wilsonix:panic").length,
    0,
    "the same cleanup must not also be registered on the window event channel",
  );

  delete globalThis.window;
});

test("panic hook registry dedupes and isolates throwing hooks", async () => {
  const { multiLayerEngine } = await import("../src/audio/multi-layer-engine.js");

  const seen = [];
  const hook = () => seen.push("arp-stop");
  const thrower = () => {
    throw new Error("hook blew up");
  };

  const off = multiLayerEngine.registerPanicHook(hook);
  const sizeAfterFirst = multiLayerEngine._panicHooks.size;
  multiLayerEngine.registerPanicHook(hook);
  assert.equal(
    multiLayerEngine._panicHooks.size,
    sizeAfterFirst,
    "registering the same function twice must stay a single hook",
  );

  multiLayerEngine.registerPanicHook(thrower);
  // Same iteration pattern panic() uses: each hook is isolated so one failure
  // can never silence the rest of the cleanup chain.
  for (const registered of multiLayerEngine._panicHooks) {
    try {
      registered();
    } catch (e) {
      // ignored on purpose
    }
  }

  assert.deepEqual(seen, ["arp-stop"], "a throwing hook must not stop the others");

  multiLayerEngine.unregisterPanicHook(thrower);
  off();
  assert.equal(
    multiLayerEngine._panicHooks.has(hook),
    false,
    "the returned unsubscribe function must remove the hook",
  );
});
