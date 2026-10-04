import { test } from "node:test";
import assert from "node:assert/strict";

// Mock minimal DOM and storage for Node test environment
if (typeof window === "undefined") {
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  };
}
if (typeof document === "undefined") {
  global.document = {
    getElementById: () => null,
  };
}
if (typeof localStorage === "undefined") {
  const store = new Map();
  global.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

test("CustomPatchBrowserUI persists scenes and restores per patch", async () => {
  const { CustomPatchBrowserUI } = await import("../src/components/custom-patch-browser.js");

  let appliedSnapshots = null;
  let appliedActiveIdx = null;
  const mockMle = {
    layers: [
      { id: 0, inst: "piano", gain: 0.8, enabled: true },
      { id: 1, inst: "pad", gain: 0.5, enabled: true },
      { id: 2, inst: "strings", gain: 0.6, enabled: false },
      { id: 3, inst: "bass", gain: 0.7, enabled: true },
    ],
    snapshots: [
      { name: "Scene 1", gains: [0.8, 0.5, 0.6, 0.7], enabled: [true, true, false, true] },
      null, null, null, null, null, null, null,
    ],
    activeSnapshotIndex: 0,
    macros: { swell: 0.5, shimmer: 0.3, tone: 0.5, pad: 0.5 },
    setSnapshots(snaps, activeIdx) {
      appliedSnapshots = snaps;
      appliedActiveIdx = activeIdx;
    },
    setMacros() {},
    syncLayerFx() {},
    syncPinnedInstruments() {},
    notifyLayerChange() {},
    addLayerChangeListener() {},
    removeLayerChangeListener() {},
  };

  const ui = new CustomPatchBrowserUI("test-container", { multiLayerEngine: mockMle, fxRack: {} });

  const customPatch = {
    id: "patch-123",
    name: "Worship Intro",
    data: {
      layers: mockMle.layers,
      snapshots: [
        { name: "Scene 1", gains: [1, 0, 0, 0], enabled: [true, false, false, false] },
        { name: "Scene 2", gains: [1, 0.8, 0, 0], enabled: [true, true, false, false] },
        null, null, null, null, null, null,
      ],
      activeSnapshotIndex: 1,
    },
  };

  // 1. Loading patch sets activePatchId in instance & localStorage
  ui.handleLoadPatch(customPatch);
  assert.equal(ui.activePatchId, "patch-123");
  assert.equal(localStorage.getItem("wilsonix_active_patch_id"), "patch-123");

  // 2. Snapshots and activeSnapshotIndex applied from patch data
  assert.equal(appliedActiveIdx, 1);
  assert.equal(appliedSnapshots[0].name, "Scene 1");
  assert.equal(appliedSnapshots[1].name, "Scene 2");

  // 3. Loading a patch with no snapshots resets snapshots to clean slots
  const emptyPatch = {
    id: "patch-456",
    name: "Clean Patch",
    data: {
      layers: mockMle.layers,
      snapshots: null,
    },
  };
  ui.handleLoadPatch(emptyPatch);
  assert.equal(ui.activePatchId, "patch-456");
  assert.equal(localStorage.getItem("wilsonix_active_patch_id"), "patch-456");
  assert.equal(appliedSnapshots.length, 8);
  assert.equal(appliedSnapshots[0], null, "Old patch scenes must not leak to a patch without scenes");

  ui.destroy();
});
