/**
 * MidiKey Elite - Private Admin License Key Generator
 * Usage: node tools/license-generator.js "Musician Name" [days]
 * Example: node tools/license-generator.js "John Doe" 365
 *          node tools/license-generator.js "Stage Key" lifetime
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

export function generateLicense(licenseeName, durationDays = "lifetime") {
  const cleanName = encodeURIComponent(licenseeName.trim().toUpperCase().replace(/\s+/g, "_"));
  let expiryHex = "LIFETIME";

  if (durationDays !== "lifetime" && !isNaN(parseInt(durationDays))) {
    const days = parseInt(durationDays);
    const expiryTimestamp = Date.now() + days * 24 * 60 * 60 * 1000;
    expiryHex = expiryTimestamp.toString(16).toUpperCase();
  }

  const payload = `MKPRO:${cleanName}:${expiryHex}`;
  const signature = computeSignatureSync(payload);
  const licenseKey = `MKPRO-${cleanName}-${expiryHex}-${signature}`;

  return {
    licenseKey,
    licensee: licenseeName,
    expiry: expiryHex === "LIFETIME" ? "Never (Lifetime)" : new Date(parseInt(expiryHex, 16)).toLocaleDateString(),
  };
}

// CLI Execution
const args = process.argv.slice(2);
if (args.length > 0) {
  const name = args[0];
  const duration = args[1] || "lifetime";
  const result = generateLicense(name, duration);
  console.log("\n========================================================");
  console.log("       MIDIKEY ELITE - OFFICIAL LICENSE GENERATOR       ");
  console.log("========================================================");
  console.log(`Licensee:    ${result.licensee}`);
  console.log(`Expiration:  ${result.expiry}`);
  console.log(`License Key: \x1b[32m${result.licenseKey}\x1b[0m`);
  console.log("========================================================\n");
}
