/**
 * WILSONIX MIDIKEY Elite - Private Admin CLI License Key Generator
 * Usage:
 *   node tools/license-generator.js "Musician Name" [days|lifetime] [optional-device-id]
 * Examples:
 *   node tools/license-generator.js "John Mayer" 30
 *   node tools/license-generator.js "Studio Live" lifetime
 *   node tools/license-generator.js "Locked Stage Rig" lifetime DEV-A1B2C3D4
 */

import crypto from "crypto";

const LICENSE_SECRET = "MK_ELITE_SECURE_SALT_2026_STAGE_PRO";

function computeSignatureSync(payload) {
  return crypto
    .createHmac("sha256", LICENSE_SECRET)
    .update(payload)
    .digest("hex")
    .substring(0, 8)
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

  let payload = "";
  let licenseKey = "";

  if (deviceFingerprint && deviceFingerprint.startsWith("DEV-")) {
    const dev = deviceFingerprint.trim().toUpperCase();
    payload = `MKPRO:${cleanName}:${expiryHex}:${dev}`;
    const signature = computeSignatureSync(payload);
    licenseKey = `MKPRO-${cleanName}-${expiryHex}-${dev}-${signature}`;
  } else {
    payload = `MKPRO:${cleanName}:${expiryHex}`;
    const signature = computeSignatureSync(payload);
    licenseKey = `MKPRO-${cleanName}-${expiryHex}-${signature}`;
  }

  return {
    licenseKey,
    licensee: licenseeName,
    expiry: expiryHex === "LIFETIME" ? "Never (Lifetime)" : new Date(parseInt(expiryHex, 16)).toLocaleDateString(),
    hardwareLock: deviceFingerprint || "Portable (Any Device)",
  };
}

// CLI Execution
const args = process.argv.slice(2);
if (args.length > 0) {
  const name = args[0];
  const duration = args[1] || "lifetime";
  const devId = args[2] || null;
  const result = generateLicense(name, duration, devId);

  console.log("\n========================================================");
  console.log("       WILSONIX MIDIKEY - ADMIN LICENSE SIGNER          ");
  console.log("========================================================");
  console.log(`Licensee:      ${result.licensee}`);
  console.log(`Expiration:    ${result.expiry}`);
  console.log(`Hardware Lock: ${result.hardwareLock}`);
  console.log(`License Key:   \x1b[32m${result.licenseKey}\x1b[0m`);
  console.log("========================================================\n");
}
