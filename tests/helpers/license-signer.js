/**
 * Test-only ECDSA P-256 license signer.
 *
 * IMPORTANT: the keypair below is a throwaway fixture generated for the unit
 * suite. It is NOT the production signing key and grants no real entitlements.
 * The suite injects TEST_PUBLIC_KEY_SPKI into LicenseManager so verification
 * runs against this key — that keeps `npm test` working on a clean clone
 * without shipping or requiring tools/license-private-key.json.
 *
 * The signing logic mirrors tools/license-generator.js exactly (same payloads,
 * same IEEE-P1363 encoding) so tests exercise the real wire format.
 */
import crypto from "node:crypto";

const TEST_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgzzmt1dpgMh0W5A1L
Q5UvRYnuxzhRfncrP+B3imFH/1ShRANCAASFIstPqA2etdxtizLhYs4gJX29jPgL
xtFDRDyMtTM/HWe/HnQR15603DlFxTT5uKRpctWLJLvNAH1XPn9cTwcC
-----END PRIVATE KEY-----`;

/** SPKI base64 of the test public key — inject into `new LicenseManager(...)`. */
export const TEST_PUBLIC_KEY_SPKI =
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEhSLLT6gNnrXcbYsy4WLOICV9vYz4C8bRQ0Q8jLUzPx1nvx50EdeetNw5RcU0+bikaXLViyS7zQB9Vz5/XE8HAg==";

function signPayload(payload) {
  const sign = crypto.createSign("SHA256");
  sign.update(payload);
  return sign
    .sign({ key: TEST_PRIVATE_KEY_PEM, dsaEncoding: "ieee-p1363" })
    .toString("hex")
    .toUpperCase();
}

export function generateLicense(licenseeName, durationDays = "lifetime", deviceFingerprint = null) {
  const cleanName = encodeURIComponent(licenseeName.trim().toUpperCase().replace(/\s+/g, "_"));
  let expiryHex = "LIFETIME";

  if (durationDays !== "lifetime" && !isNaN(parseInt(durationDays))) {
    const days = parseInt(durationDays);
    const expiryTimestamp = Date.now() + days * 24 * 60 * 60 * 1000;
    expiryHex = expiryTimestamp.toString(16).toUpperCase();
  }

  let licenseKey;
  if (deviceFingerprint && (deviceFingerprint.startsWith("DEV-") || deviceFingerprint.startsWith("DEV_"))) {
    const dev = deviceFingerprint.trim().toUpperCase();
    const signature = signPayload(`MKPRO:${cleanName}:${expiryHex}:${dev}`);
    licenseKey = `MKPRO-${cleanName}-${expiryHex}-${dev}-${signature}`;
  } else {
    const signature = signPayload(`MKPRO:${cleanName}:${expiryHex}`);
    licenseKey = `MKPRO-${cleanName}-${expiryHex}-${signature}`;
  }

  return {
    licenseKey,
    licensee: licenseeName,
    expiry: expiryHex === "LIFETIME"
      ? "Never (Lifetime)"
      : new Date(parseInt(expiryHex, 16)).toLocaleDateString(),
    hardwareLock: deviceFingerprint || "Portable (Any Device)",
  };
}

/** Signs "ACTIVATE:<rawLicenseKey>:<deviceId>" → MKACT-<DEVICE_ID>-<SIG> */
export function generateActivationCode(rawLicenseKey, deviceFingerprint) {
  if (!deviceFingerprint || !(deviceFingerprint.startsWith("DEV-") || deviceFingerprint.startsWith("DEV_"))) {
    throw new Error("Device fingerprint must start with DEV- or DEV_ (e.g. DEV-8F2B1C3A)");
  }
  const dev = deviceFingerprint.trim().toUpperCase();
  const key = rawLicenseKey.trim().toUpperCase();
  return `MKACT-${dev}-${signPayload(`ACTIVATE:${key}:${dev}`)}`;
}
