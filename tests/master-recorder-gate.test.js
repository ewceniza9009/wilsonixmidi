import { test } from "node:test";
import assert from "node:assert/strict";
import { MasterRecorder } from "../src/audio/master-recorder.js";
import { audioCore } from "../src/audio/audio-core.js";
import { licenseManager } from "../src/security/license-manager.js";

/**
 * Capability gate regression tests. The HUD button is gated too, but start()
 * is the single entry point that actually arms the master bus tap.
 */
function revokeAccess() {
  licenseManager.licenseData = null;
  licenseManager._licenseConfirmed = false;
  licenseManager.trialData = { startedAt: 0, expiresAt: 0, signature: "test" };
}

function grantAccess() {
  licenseManager.hasProAccess = () => true;
  licenseManager.requirePro = () => true;
}

test("start() refuses to arm the recorder without Pro access", () => {
  revokeAccess();
  assert.equal(licenseManager.hasProAccess(), false, "this process must be unlicensed");

  const originalCtx = audioCore.ctx;
  audioCore.ctx = { state: "running", resume() {} };
  try {
    const recorder = new MasterRecorder();
    recorder.start();
    assert.equal(recorder.isRecording, false, "an unlicensed session must never start recording");
    assert.equal(recorder.timerInterval, null, "no recording timer may be armed");
  } finally {
    audioCore.ctx = originalCtx;
  }
});

test("start() arms the recorder when Pro access is granted", () => {
  const originalHasPro = licenseManager.hasProAccess;
  const originalRequirePro = licenseManager.requirePro;
  grantAccess();

  const originalCtx = audioCore.ctx;
  audioCore.ctx = { state: "running", resume() {} };
  const recorder = new MasterRecorder();
  try {
    recorder.start();
    assert.equal(recorder.isRecording, true, "licensed sessions still record");
    assert.ok(recorder.timerInterval, "the duration timer must be running");
  } finally {
    clearInterval(recorder.timerInterval);
    clearInterval(recorder._drainInterval);
    recorder._drainInterval = null;
    recorder.isRecording = false;
    audioCore.ctx = originalCtx;
    licenseManager.hasProAccess = originalHasPro;
    licenseManager.requirePro = originalRequirePro;
  }
});
