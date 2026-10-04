import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  generateLicense,
  generateActivationCode,
  TEST_PUBLIC_KEY_SPKI,
} from "./helpers/license-signer.js";

let localStorageStore;
const dispatched = [];

const mockLocalStorage = {
  getItem: (key) => localStorageStore[key] ?? null,
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; },
};

const originalGlobal = {};

function setupEnv() {
  localStorageStore = {};
  dispatched.length = 0;
  if (typeof globalThis.localStorage === "undefined") {
    originalGlobal.localStorage = globalThis.localStorage;
    globalThis.localStorage = mockLocalStorage;
  }
  if (typeof globalThis.navigator === "undefined") {
    originalGlobal.navigator = globalThis.navigator;
    globalThis.navigator = { userAgent: "TestAgent/1.0", language: "en", hardwareConcurrency: 4 };
  }
  if (typeof globalThis.window === "undefined") {
    originalGlobal.window = globalThis.window;
    globalThis.window = {
      screen: { width: 1920, height: 1080, colorDepth: 24 },
      dispatchEvent: (ev) => { dispatched.push(ev); return true; },
    };
  } else if (typeof globalThis.window.dispatchEvent !== "function") {
    globalThis.window.dispatchEvent = (ev) => { dispatched.push(ev); return true; };
  }
}

function teardownEnv() {
  for (const [k, v] of Object.entries(originalGlobal)) {
    if (v === undefined) delete globalThis[k];
    else globalThis[k] = v;
  }
}

let LicenseManager;

function createManager() {
  return new LicenseManager({ publicKeySpki: TEST_PUBLIC_KEY_SPKI });
}

const TRIAL_KEY = "midikey_elite_trial_state";
const LICENSE_KEY = "midikey_elite_license";

beforeEach(async () => {
  setupEnv();
  const mod = await import("../src/security/license-manager.js");
  LicenseManager = mod.LicenseManager;
});

afterEach(() => {
  teardownEnv();
});

test("a signature-less trial record cannot claim more than one trial window", () => {
  const now = Date.now();
  localStorage.setItem(TRIAL_KEY, JSON.stringify({
    startedAt: now - 1000,
    expiresAt: now + 10 * 365 * 24 * 60 * 60 * 1000, // 10 years, no signature
    lastSeenAt: now,
  }));

  const mgr = createManager();

  assert.equal(mgr.trialData.signature, "TAMPERED", "impossible duration must be treated as tampering");
  assert.equal(mgr.hasProAccess(), false, "the unsigned 10-year record must not grant Pro");
});

test("a signature-less legacy record inside the normal trial window is still accepted", () => {
  const now = Date.now();
  localStorage.setItem(TRIAL_KEY, JSON.stringify({
    startedAt: now - 5 * 24 * 60 * 60 * 1000,
    expiresAt: now + 25 * 24 * 60 * 60 * 1000, // 30-day total, unsigned
    lastSeenAt: now,
  }));

  const mgr = createManager();

  assert.notEqual(mgr.trialData.signature, "TAMPERED");
  assert.equal(mgr.hasProAccess(), true, "a normal legacy trial must keep working across the upgrade");
});

test("a trial record whose signature is valid but whose duration is impossible is rejected", () => {
  const now = Date.now();
  const startedAt = now - 1000;
  const expiresAt = now + 10 * 365 * 24 * 60 * 60 * 1000;
  // The FNV salt ships in the bundle, so a forged signature is trivial to mint.
  const manager = createManager();
  const forgedSig = manager.computeSignatureSync(
    `TRIAL:${manager.deviceFingerprint}:${startedAt}:${expiresAt}`,
    "MK_ELITE_TRIAL_PROTECT_2026",
  );
  localStorage.setItem(TRIAL_KEY, JSON.stringify({
    startedAt,
    expiresAt,
    lastSeenAt: now,
    signature: forgedSig,
  }));

  const mgr = createManager();

  assert.equal(mgr.trialData.signature, "TAMPERED");
  assert.equal(mgr.hasProAccess(), false);
});

test("a license record with self-minted activation bindings fails boot revalidation", async () => {
  const manager = createManager();
  const forgedKey = `MKPRO-FORGEDUSER-LIFETIME-${"AB".repeat(64)}`;

  // Exactly what an attacker can compute from the shipped bundle.
  localStorage.setItem(LICENSE_KEY, JSON.stringify({
    key: forgedKey,
    rawKey: forgedKey,
    licensee: "FORGED USER",
    type: "Lifetime Pro License",
    expires: "Lifetime",
    activatedAt: new Date().toISOString(),
    device: manager.deviceFingerprint,
    _activationToken: await manager.computeActivationToken(forgedKey),
    _activationHash: manager.computeActivationHash(forgedKey),
  }));

  const mgr = createManager();
  await mgr.revalidateLicense();

  assert.equal(mgr._licenseConfirmed, false, "ECDSA must be authoritative over the minted token");
  assert.equal(mgr.isLicensed(), false, "a forged key must never report licensed");
  assert.equal(mgr.getAccessStatus().isLicensed, false);
});

test("a stored license stops granting access once its signed expiry passes", async () => {
  const now = Date.now();
  // An already-finished trial so the status falls through to the license branch.
  localStorage.setItem(TRIAL_KEY, JSON.stringify({
    startedAt: now - 40 * 24 * 60 * 60 * 1000,
    expiresAt: now - 10 * 24 * 60 * 60 * 1000,
    lastSeenAt: now,
  }));

  const { licenseKey } = generateLicense("Expiring User", 30);
  const mgr = createManager();

  const activated = await mgr.activate(licenseKey);
  assert.equal(activated.success, true, "a future-dated key must activate");
  assert.equal(mgr.isLicensed(), true);

  // Simulate the expiry date arriving after activation.
  mgr.licenseData.expiresAtMs = Date.now() - 1000;

  assert.equal(mgr.isLicensed(), false, "an expired time-limited key must not stay licensed");
  const status = mgr.getAccessStatus();
  assert.equal(status.isExpired, true);
  assert.equal(status.type, "License Expired");
});

test("the activation-code path rejects an expired license key", async () => {
  const { licenseKey } = generateLicense("Expired User", -1); // expired yesterday
  const mgr = createManager();
  const code = generateActivationCode(licenseKey, mgr.deviceFingerprint);

  const result = await mgr.activate(licenseKey, code);

  assert.equal(result.success, false);
  assert.match(result.error, /expired/i);
  assert.equal(mgr.isLicensed(), false);
});

test("licensee names containing a dash are not mistaken for hardware-locked keys", async () => {
  const { licenseKey } = generateLicense("Smith-Jones", "lifetime");
  assert.match(licenseKey, /^MKPRO-SMITH-JONES-LIFETIME-[0-9A-F]+$/);

  const mgr = createManager();
  const result = await mgr.activate(licenseKey);

  assert.equal(result.success, true, "a dashed licensee must still verify");
  assert.equal(result.license.licensee, "SMITH-JONES");
  assert.equal(mgr.isLicensed(), true);
});

test("requirePro opens the license modal event when Pro is not unlocked", () => {
  const now = Date.now();
  localStorage.setItem(TRIAL_KEY, JSON.stringify({
    startedAt: now - 40 * 24 * 60 * 60 * 1000,
    expiresAt: now - 10 * 24 * 60 * 60 * 1000,
    lastSeenAt: now,
    signature: "whatever",
  }));

  const mgr = createManager();
  assert.equal(mgr.hasProAccess(), false);

  const allowed = mgr.requirePro("Master WAV Audio Recording");

  assert.equal(allowed, false);
  const opened = dispatched.find((ev) => ev.type === "wilsonix-open-license-modal");
  assert.ok(opened, "the license modal must be requested");
  assert.match(opened.detail.reason, /Master WAV Audio Recording/);
});

test("revalidation announces the corrected status through wilsonix-access-changed", async () => {
  const forgedKey = `MKPRO-FORGEDUSER-LIFETIME-${"CD".repeat(64)}`;
  const manager = createManager();
  localStorage.setItem(LICENSE_KEY, JSON.stringify({
    key: forgedKey,
    rawKey: forgedKey,
    device: manager.deviceFingerprint,
    _activationToken: await manager.computeActivationToken(forgedKey),
    _activationHash: manager.computeActivationHash(forgedKey),
  }));

  dispatched.length = 0;
  const mgr = createManager();
  await mgr.revalidateLicense();

  const changed = dispatched.find((ev) => ev.type === "wilsonix-access-changed");
  assert.ok(changed, "the HUD must be told the optimistic PRO badge was wrong");
  assert.equal(changed.detail.isLicensed, false);
});

test("hardware-locked keys still bind to this machine after the parse rework", async () => {
  const fp = createManager().deviceFingerprint;
  const { licenseKey } = generateLicense("Locked User", "lifetime", fp);

  const mgr = createManager();
  const ok = await mgr.activate(licenseKey);
  assert.equal(ok.success, true);

  const other = createManager();
  other.deviceFingerprint = "DEV_00000000";
  const rejected = await other.activate(licenseKey);
  assert.equal(rejected.success, false);
  assert.match(rejected.error, /hardware-locked/i);
});

test("portable keys remain valid after the parse rework", async () => {
  const { licenseKey } = generateLicense("Portable User", 365);
  const mgr = createManager();
  const result = await mgr.activate(licenseKey);
  assert.equal(result.success, true);
  assert.equal(mgr.isLicensed(), true);
  assert.equal(mgr.getAccessStatus().badgeText, "★ PRO");
});
