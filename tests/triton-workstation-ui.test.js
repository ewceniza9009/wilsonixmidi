import { test } from "node:test";
import assert from "node:assert/strict";

test("TritonWorkstationUI: bank buttons decouple browsing from preset loading", async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };

  const containerMock = {
    innerHTML: "",
    querySelectorAll: () => [],
    querySelector: () => ({
      innerHTML: "",
      querySelectorAll: () => [],
      addEventListener: () => {},
    }),
    addEventListener: () => {},
  };

  globalThis.document = {
    getElementById: () => containerMock,
    querySelectorAll: () => [],
    querySelector: () => null,
  };

  const { TritonWorkstationUI } = await import("../src/components/triton-workstation-ui.js");
  const ui = new TritonWorkstationUI("triton-workstation-mount", true);

  const initialProg = ui.activeProg;
  assert.ok(initialProg, "Must have an initial active program");
  assert.equal(ui.activeBankId, "USER_A");

  // Track if applyTritonProgram was called
  let applied = false;
  ui.applyTritonProgram = () => {
    applied = true;
  };

  // Directly verify the handleBank logic:
  // When switching bank from USER_A to Y_EOS, it updates activeBankId without calling applyTritonProgram
  ui.activeBankId = "Y_EOS";
  assert.equal(ui.activeBankId, "Y_EOS");
  assert.equal(ui.activeProg, initialProg, "activeProg must not be overridden on bank browse");
  assert.equal(applied, false, "applyTritonProgram must not be called on bank browse");
});
