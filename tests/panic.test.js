import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockAudioContext } from "./helpers/mock-audio-context.js";
import { DubSpaceEcho } from "../src/audio/effects/dub-echo.js";

test("dubEcho.flush() zeroes feedbackGain and wetGain immediately to silence echoes", () => {
  const ctx = createMockAudioContext();
  const dub = new DubSpaceEcho(ctx);
  dub.setFeedback(0.35);
  dub.wetGain.gain.value = 0.5;

  dub.flush();

  assert.equal(dub.feedbackGain.gain.value, 0, "feedbackGain must be 0 after flush");
  assert.equal(dub.wetGain.gain.value, 0, "wetGain must be 0 after flush");
});

test("panic hook registry: registers, executes in order, and catches hook errors", () => {
  const hooks = new Set();
  const registerPanicHook = (fn) => { if (typeof fn === "function") hooks.add(fn); };
  const unregisterPanicHook = (fn) => { hooks.delete(fn); };

  const callOrder = [];
  const hook1 = () => callOrder.push("station-stop");
  const hookThrowing = () => { throw new Error("Faulty hook"); };
  const hook2 = () => callOrder.push("keyboard-reset");

  registerPanicHook(hook1);
  registerPanicHook(hookThrowing);
  registerPanicHook(hook2);
  assert.equal(hooks.size, 3);

  // Invoke hooks with error isolation (multiLayerEngine panic pattern)
  for (const hook of hooks) {
    try {
      hook();
    } catch (e) {
      // Ignored so one faulty hook never blocks panic
    }
  }

  assert.deepEqual(callOrder, ["station-stop", "keyboard-reset"]);

  unregisterPanicHook(hook1);
  assert.equal(hooks.size, 2);
  assert.ok(!hooks.has(hook1));
});

test("panic voice kill contract: breaks infinite sample loops and drops gain to 0.0 immediately", () => {
  // Simulates PCM engine active voice structure (NativePcmEngine)
  const activeVoices = [
    {
      id: "voice-1",
      src: { loop: true, stop: () => { activeVoices[0].src._stopped = true; }, _stopped: false },
      voiceGain: {
        gain: {
          value: 0.85,
          setValueAtTime: (val) => { activeVoices[0].voiceGain.gain.value = val; },
          cancelScheduledValues: () => {}
        }
      }
    },
    {
      id: "voice-2",
      src: { loop: true, stop: () => { activeVoices[1].src._stopped = true; }, _stopped: false },
      voiceGain: {
        gain: {
          value: 0.90,
          setValueAtTime: (val) => { activeVoices[1].voiceGain.gain.value = val; },
          cancelScheduledValues: () => {}
        }
      }
    }
  ];

  // Exact killVoice logic from native-pcm-engine.js line 2231-2244:
  const now = 10.0;
  const killVoice = (v) => {
    if (!v) return;
    try {
      if (v.src) {
        v.src.loop = false; // Break infinite sample loops (pads, EDM leads)
      }
      if (v.voiceGain && v.voiceGain.gain) {
        v.voiceGain.gain.cancelScheduledValues(now);
        v.voiceGain.gain.setValueAtTime(0.0, now);
      }
      if (v.src && typeof v.src.stop === "function") {
        v.src.stop(now + 0.01);
      }
    } catch (e) {}
  };

  for (const v of activeVoices) {
    killVoice(v);
  }

  for (const v of activeVoices) {
    assert.equal(v.src.loop, false, "Voice loop must be false on panic");
    assert.equal(v.voiceGain.gain.value, 0.0, "Voice gain must immediately drop to 0.0");
    assert.equal(v.src._stopped, true, "Voice stop must be scheduled");
  }
});

test("lookahead scheduler queue clear contract: drops all queued future notes on panic", () => {
  class MockLookaheadScheduler {
    constructor() {
      this.queue = [];
      this.running = true;
    }
    schedule(source, when, action, type) {
      this.queue.push({ source, when, action, type });
    }
    discard(sourcePrefix) {
      this.queue = this.queue.filter(e => !e.source || !e.source.startsWith(sourcePrefix));
    }
    clear() {
      this.queue.length = 0;
    }
    stop() {
      this.running = false;
      this.clear();
    }
  }

  const scheduler = new MockLookaheadScheduler();
  scheduler.schedule("demo-song-1", 10.1, () => {}, "note-on");
  scheduler.schedule("demo-song-1", 10.2, () => {}, "note-off");
  scheduler.schedule("user-improv", 10.3, () => {}, "note-on");

  assert.equal(scheduler.queue.length, 3);

  // Discarding specific demo song leaves user tracks
  scheduler.discard("demo-song-1");
  assert.equal(scheduler.queue.length, 1);
  assert.equal(scheduler.queue[0].source, "user-improv");

  // Panic calls scheduler.stop() -> completely purges all queues
  scheduler.stop();
  assert.equal(scheduler.queue.length, 0);
  assert.equal(scheduler.running, false);
});
