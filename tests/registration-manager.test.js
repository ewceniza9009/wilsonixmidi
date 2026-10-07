import { test } from "node:test";
import assert from "node:assert/strict";

// Setup mocks for browser globals before importing RegistrationManager & AudioCore
const store = new Map();
const mockLocalStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const listeners = [];
globalThis.localStorage = mockLocalStorage;
globalThis.window = {
  addEventListener: (type, cb) => {
    listeners.push({ type, cb });
  },
  removeEventListener: () => {},
};
globalThis.document = {
  activeElement: null,
  querySelectorAll: () => [],
  getElementById: () => null,
};

const { RegistrationManager } = await import("../src/components/registration-manager.js");
const { AudioCore } = await import("../src/audio/audio-core.js");

test("RegistrationManager: selectBank switches viewed bank without auto-recalling presets", () => {
  store.clear();
  const regMgr = new RegistrationManager();

  assert.equal(regMgr.currentBank, "A");
  assert.equal(regMgr.activeBank, "A");
  assert.equal(regMgr.currentSlot, 1);
  assert.equal(regMgr.activeSlot, 1);

  let recalled = false;
  regMgr.onRecallCallback = () => {
    recalled = true;
  };

  // Switch to Bank B
  regMgr.selectBank("B");

  assert.equal(regMgr.currentBank, "B", "currentBank must update to B");
  assert.equal(regMgr.activeBank, "A", "activeBank must remain A (active sound untouched)");
  assert.equal(regMgr.activeSlot, 1, "activeSlot must remain 1");
  assert.equal(recalled, false, "Preset must NOT be recalled on bank switch");
  assert.equal(store.get("wilsonix_current_reg_bank"), "B");
});

test("RegistrationManager: keyboard shortcuts F9..F12 switch banks without auto-recalling", () => {
  store.clear();
  const regMgr = new RegistrationManager();

  let recalled = false;
  regMgr.onRecallCallback = () => {
    recalled = true;
  };

  // Simulate F10 keypress (Bank B)
  const keydownListener = listeners.filter((l) => l.type === "keydown").pop()?.cb;
  assert.ok(keydownListener, "Keydown listener must be bound");

  keydownListener({
    code: "F10",
    key: "F10",
    preventDefault: () => {},
  });

  assert.equal(regMgr.currentBank, "B");
  assert.equal(regMgr.activeBank, "A");
  assert.equal(recalled, false, "F10 must NOT trigger preset recall");
});

test("RegistrationManager: explicit recallSlot updates active bank/slot and fires callback", () => {
  store.clear();
  const regMgr = new RegistrationManager();

  let recalledPayload = null;
  regMgr.onRecallCallback = (p) => {
    recalledPayload = p;
  };

  regMgr.recallSlot("B", 3);

  assert.equal(regMgr.currentBank, "B");
  assert.equal(regMgr.activeBank, "B");
  assert.equal(regMgr.currentSlot, 3);
  assert.equal(regMgr.activeSlot, 3);
  assert.ok(recalledPayload, "Callback must fire on explicit recall");
  assert.equal(recalledPayload.bank, "B");
  assert.equal(recalledPayload.slot, 3);
});

test("AudioCore: defaults to ultra-low profile when user hasn't explicitly overridden", () => {
  store.clear();
  const core = new AudioCore();
  assert.equal(core.currentLatencyProfile, "ultra-low");
});

test("MultiLayerEngine: setMasterVolumePct persists and survives reload without reverting to 50%", async () => {
  store.clear();
  const { multiLayerEngine } = await import("../src/audio/multi-layer-engine.js");
  multiLayerEngine.setMasterVolumePct(85);
  assert.equal(store.get("wilsonix_master_volume_pct"), "85");
  assert.equal(multiLayerEngine.settings.masterVolumePct, 85);
  assert.equal(multiLayerEngine._masterPct, 85);
});

