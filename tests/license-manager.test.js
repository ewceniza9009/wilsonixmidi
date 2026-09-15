import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { generateLicense, generateActivationCode } from "../tools/license-generator.js";

let localStorageStore;
const mockLocalStorage = {
  getItem: (key) => localStorageStore[key] ?? null,
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; },
};

const originalGlobal = {};
function setupEnv() {
  localStorageStore = {};
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
    globalThis.window = { screen: { width: 1920, height: 1080, colorDepth: 24 } };
  }
  if (typeof globalThis.Intl === "undefined") {
    originalGlobal.Intl = globalThis.Intl;
    globalThis.Intl = { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: "UTC" }) }) };
  }
}

function teardownEnv() {
  for (const [k, v] of Object.entries(originalGlobal)) {
    if (v === undefined) delete globalThis[k];
    else globalThis[k] = v;
  }
}

let LicenseManager;
let licenseManager;

beforeEach(async () => {
  setupEnv();
  const mod = await import("../src/security/license-manager.js");
  LicenseManager = mod.LicenseManager;
  licenseManager = new LicenseManager();
});

afterEach(() => {
  teardownEnv();
});

test("decodeLicensee decodes percent-encoded and underscored names", () => {
  assert.equal(licenseManager.decodeLicensee("JOHN_DOE"), "JOHN DOE");
  assert.equal(licenseManager.decodeLicensee("JOHN%20DOE"), "JOHN DOE");
});

test("generateDeviceFingerprint returns consistent DEV_ prefix string", () => {
  const fp = licenseManager.generateDeviceFingerprint();
  assert.match(fp, /^DEV_[0-9A-F]{8}$/);
});

test("computeActivationHash returns consistent FNV-1a hash", () => {
  const h1 = licenseManager.computeActivationHash("MKPRO-TEST-LIFETIME-AAAA");
  const h2 = licenseManager.computeActivationHash("MKPRO-TEST-LIFETIME-AAAA");
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9A-F]{8}$/);
});

test("computeActivationHash changes with different keys", () => {
  const h1 = licenseManager.computeActivationHash("MKPRO-TEST1-LIFETIME-AAAA");
  const h2 = licenseManager.computeActivationHash("MKPRO-TEST2-LIFETIME-AAAA");
  assert.notEqual(h1, h2);
});

test("computeActivationToken produces HMAC-SHA256 token", async () => {
  const token = await licenseManager.computeActivationToken("MKPRO-TEST-LIFETIME-AAAA");
  assert.ok(token, "token should not be null");
  assert.ok(typeof token === "string");
  assert.ok(token.length > 0);
  assert.ok(!token.includes("+"), "should be base64url encoded (no +)");
  assert.ok(!token.includes("/"), "should be base64url encoded (no /)");
  assert.ok(!token.includes("="), "should be base64url encoded (no =)");
});

test("computeActivationToken is deterministic", async () => {
  const t1 = await licenseManager.computeActivationToken("MKPRO-TEST-LIFETIME-AAAA");
  const t2 = await licenseManager.computeActivationToken("MKPRO-TEST-LIFETIME-AAAA");
  assert.equal(t1, t2);
});

test("computeActivationToken changes with different keys", async () => {
  const t1 = await licenseManager.computeActivationToken("MKPRO-KEY1-LIFETIME-AAAA");
  const t2 = await licenseManager.computeActivationToken("MKPRO-KEY2-LIFETIME-AAAA");
  assert.notEqual(t1, t2);
});

test("computeActivationToken changes with different device fingerprints", async () => {
  const origFp = licenseManager.deviceFingerprint;
  const t1 = await licenseManager.computeActivationToken("MKPRO-TEST-LIFETIME-AAAA");

  licenseManager.deviceFingerprint = "DEV_DIFFERENT";
  const t2 = await licenseManager.computeActivationToken("MKPRO-TEST-LIFETIME-AAAA");

  licenseManager.deviceFingerprint = origFp;
  assert.notEqual(t1, t2);
});

// =====================================================
// verifyActivationCode tests
// =====================================================
test("verifyActivationCode rejects null/undefined/non-string", async () => {
  const r1 = await licenseManager.verifyActivationCode(null, "MKPRO-X-LIFETIME-AAAA");
  const r2 = await licenseManager.verifyActivationCode(undefined, "MKPRO-X-LIFETIME-AAAA");
  const r3 = await licenseManager.verifyActivationCode(123, "MKPRO-X-LIFETIME-AAAA");
  assert.equal(r1.valid, false);
  assert.equal(r2.valid, false);
  assert.equal(r3.valid, false);
});

test("verifyActivationCode rejects non-MKACT prefix", async () => {
  const r = await licenseManager.verifyActivationCode("MKFOO-DEV-AAAA", "MKPRO-X-LIFETIME-AAAA");
  assert.equal(r.valid, false);
  assert.match(r.reason, /MKACT/i);
});

test("verifyActivationCode rejects code with too few segments", async () => {
  const r = await licenseManager.verifyActivationCode("MKACT-DEV", "MKPRO-X-LIFETIME-AAAA");
  assert.equal(r.valid, false);
});

test("verifyActivationCode rejects device mismatch", async () => {
  const r = await licenseManager.verifyActivationCode("MKACT-DEV_FAKE-BADSIG", "MKPRO-X-LIFETIME-AAAA");
  assert.equal(r.valid, false);
  assert.match(r.reason, /device/i);
});

// =====================================================
// Full activation flow: ECDSA license key (via generator)
// =====================================================
test("activate() accepts a valid ECDSA-signed license key", async () => {
  const license = generateLicense("TestUser", "lifetime");
  const res = await licenseManager.activate(license.licenseKey);
  assert.equal(res.success, true);
  assert.equal(res.license.licensee, "TESTUSER");
  assert.equal(res.license.type, "Lifetime Pro License");
  assert.ok(res.license._activationToken, "should store activation token");
  assert.ok(res.license._activationHash, "should store activation hash");
});

test("activate() accepts a valid ECDSA-signed time-limited key", async () => {
  const license = generateLicense("TimeUser", "30");
  const res = await licenseManager.activate(license.licenseKey);
  assert.equal(res.success, true);
  assert.match(res.license.type, /Time-Limited/);
});

test("activate() rejects an expired ECDSA key", async () => {
  const license = generateLicense("ExpiredUser", "lifetime");
  const parts = license.licenseKey.split("-");
  parts[2] = (Date.now() - 86400000).toString(16).toUpperCase();
  const expiredKey = parts.join("-");
  const res = await licenseManager.activate(expiredKey);
  assert.equal(res.success, false);
});

test("activate() rejects a forged key with no signature", async () => {
  const res = await licenseManager.activate("MKPRO-FORGER-LIFETIME-00000000");
  assert.equal(res.success, false);
});

test("activate() ignores activation code when ECDSA key is valid", async () => {
  const fp = licenseManager.deviceFingerprint;
  const license = generateLicense("ValidKey", "lifetime");
  const badActCode = `MKACT-${fp}-FACESIG`;
  const res = await licenseManager.activate(license.licenseKey, badActCode);
  assert.equal(res.success, true, "valid ECDSA key activates regardless of activation code");
});

// =====================================================
// Full activation flow: activation code fallback
// (Use a key with a BAD signature so verifyKey fails,
//  but generate a valid activation code for that key.)
// =====================================================

// Helper: create a structurally valid but cryptographically invalid key
function makeBadKey(name = "ACTCODEUSER") {
  const parts = ["MKPRO", name.toUpperCase(), "LIFETIME", "BADSIG00000000"];
  return parts.join("-");
}

test("activate() accepts valid activation code when ECDSA key fails", async () => {
  const fp = licenseManager.deviceFingerprint;
  const badKey = makeBadKey("ACTCODEUSER");
  const actCode = generateActivationCode(badKey, fp);
  const res = await licenseManager.activate(badKey, actCode);
  assert.equal(res.success, true);
  assert.equal(res.license.licensee, "ACTCODEUSER");
  assert.equal(res.license._activationCode, actCode);
});

test("activate() rejects activation code for wrong device", async () => {
  const badKey = makeBadKey("WRONGDEV");
  const actCode = generateActivationCode(badKey, "DEV_DEADBEEF");
  const res = await licenseManager.activate(badKey, actCode);
  assert.equal(res.success, false);
});

test("activate() rejects forged activation code", async () => {
  const fp = licenseManager.deviceFingerprint;
  const badKey = makeBadKey("FORGED");
  const res = await licenseManager.activate(badKey, `MKACT-${fp}-FACESIG`);
  assert.equal(res.success, false);
});

test("activate() rejects activation code signed for different key", async () => {
  const fp = licenseManager.deviceFingerprint;
  const badKey = makeBadKey("WRONGKEY");
  const otherKey = makeBadKey("OTHERUSER");
  const actCode = generateActivationCode(otherKey, fp);
  const res = await licenseManager.activate(badKey, actCode);
  assert.equal(res.success, false);
});

test("activate() with no activation code when ECDSA fails returns hint", async () => {
  const badKey = makeBadKey("NOCODE");
  const res = await licenseManager.activate(badKey);
  assert.equal(res.success, false);
  assert.match(res.error, /activation code/i);
});

// =====================================================
// License persistence & revalidation
// =====================================================
test("activate() stores license in localStorage", async () => {
  const license = generateLicense("PersistUser", "lifetime");
  await licenseManager.activate(license.licenseKey);
  const stored = JSON.parse(localStorageStore["midikey_elite_license"]);
  assert.equal(stored.rawKey, license.licenseKey.toUpperCase());
  assert.ok(stored._activationToken);
  assert.ok(stored._activationHash);
});

test("isLicensed returns false when no license data", () => {
  assert.equal(licenseManager.isLicensed(), false);
});

test("deactivate clears license data", async () => {
  const license = generateLicense("DeactUser", "lifetime");
  await licenseManager.activate(license.licenseKey);
  assert.equal(licenseManager.isLicensed(), true);
  licenseManager.deactivate();
  assert.equal(licenseManager.isLicensed(), false);
  assert.equal(licenseManager.licenseData, null);
});

test("getAccessStatus returns trial info when unlicensed", () => {
  const status = licenseManager.getAccessStatus();
  assert.equal(status.isLicensed, false);
  assert.ok(status.isTrial || status.isExpired);
});

test("hasProAccess returns false when unlicensed and trial expired", () => {
  licenseManager.trialData = {
    startedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    expiresAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    device: licenseManager.deviceFingerprint,
    signature: "OLD",
    trialDaysTotal: 30,
  };
  assert.equal(licenseManager.hasProAccess(), false);
});

test("loadLicense returns null for empty/invalid localStorage", () => {
  const lm = new LicenseManager();
  assert.equal(lm.licenseData, null);
});

test("loadLicense migrates legacy key-only format", () => {
  const legacyKey = "MKPRO-LEGACYUSER-LIFETIME-AAAA";
  localStorageStore["midikey_elite_license"] = JSON.stringify({ key: legacyKey });
  const lm = new LicenseManager();
  assert.equal(lm.licenseData.rawKey, legacyKey);
});

test("loadLicense rejects tampered non-key data", () => {
  localStorageStore["midikey_elite_license"] = JSON.stringify({ foo: "bar" });
  const lm = new LicenseManager();
  assert.equal(lm.licenseData, null);
});

// =====================================================
// Hardware-locked activation code
// =====================================================
test("activate() accepts hardware-locked ECDSA key for this device", async () => {
  const fp = licenseManager.deviceFingerprint;
  const license = generateLicense("HwLockUser", "lifetime", fp);
  const res = await licenseManager.activate(license.licenseKey);
  assert.equal(res.success, true);
  assert.match(res.license.type, /Hardware-Locked/);
});

test("activate() rejects hardware-locked key for wrong device", async () => {
  const license = generateLicense("HwWrong", "lifetime", "DEV_WRONG0");
  const res = await licenseManager.activate(license.licenseKey);
  assert.equal(res.success, false);
});
