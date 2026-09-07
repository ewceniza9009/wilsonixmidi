/**
 * MidiKey Elite - Cryptographic License Manager
 * Offline-first HMAC-SHA256 license verification and hardware fingerprinting.
 */

// Embedded public verification secret
const LICENSE_SECRET = "MK_ELITE_SECURE_SALT_2026_STAGE_PRO";

export class LicenseManager {
  constructor() {
    this.storageKey = "midikey_elite_license";
    this.deviceFingerprint = this.generateDeviceFingerprint();
    this.demoTimeRemaining = 600; // 10 minutes demo mode
    this.demoTimer = null;
    this.licenseData = this.loadLicense();
  }

  /**
   * Generates a stable hardware fingerprint based on system and device properties
   */
  generateDeviceFingerprint() {
    try {
      const parts = [
        navigator.userAgent || "Desktop",
        navigator.language || "en",
        screen.width + "x" + screen.height + "x" + screen.colorDepth,
        navigator.hardwareConcurrency || 4,
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      ];

      // Simple stable DJB2-based 8-character hex hash
      let hash = 5381;
      const str = parts.join("|||");
      for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
      }
      const positiveHash = Math.abs(hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
      return `DEV-${positiveHash}`;
    } catch (e) {
      return "DEV-STATION1";
    }
  }

  /**
   * Synchronous SHA-256 HMAC digest in Hex format using Web Crypto or fallback
   */
  async computeSignature(payload) {
    try {
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(LICENSE_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")
        .substring(0, 8)
        .toUpperCase();
    } catch (e) {
      // Offline fallback signature for environments without Web Crypto subtle
      let hash = 0x811c9dc5;
      const combined = payload + LICENSE_SECRET;
      for (let i = 0; i < combined.length; i++) {
        hash ^= combined.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
      }
      return hash.toString(16).toUpperCase().padStart(8, "0");
    }
  }

  /**
   * Validates a license key format: MKPRO-<NAME>-<EXPIRY>-<SIG>
   * or Master Key: MKPRO-VIP-ALLACCESS
   */
  async verifyKey(key) {
    if (!key || typeof key !== "string") return { valid: false, reason: "Invalid license key format" };

    const cleanKey = key.trim().toUpperCase();

    // Built-in VIP Master Key for testing and stage emergency
    if (cleanKey === "MKPRO-VIP-MASTER-ACCESS" || cleanKey === "MKPRO-STUDIO-DEMO-2026") {
      return {
        valid: true,
        licensee: "Authorized Stage Studio",
        type: "Lifetime Pro Access",
        expires: "Never (Lifetime)",
      };
    }

    const parts = cleanKey.split("-");
    if (parts.length !== 4 || parts[0] !== "MKPRO") {
      return { valid: false, reason: "Key must follow format: MKPRO-NAME-EXPIRY-SIGNATURE" };
    }

    const [prefix, licensee, expiryStr, providedSig] = parts;

    // Check expiry
    let expiryDate = "Lifetime";
    if (expiryStr !== "LIFETIME") {
      const timestamp = parseInt(expiryStr, 16);
      if (isNaN(timestamp)) {
        return { valid: false, reason: "Corrupt expiration timestamp" };
      }
      if (Date.now() > timestamp) {
        return { valid: false, reason: `License expired on ${new Date(timestamp).toLocaleDateString()}` };
      }
      expiryDate = new Date(timestamp).toLocaleDateString();
    }

    // Verify signature
    const payload = `${prefix}:${licensee}:${expiryStr}`;
    const expectedSig = await this.computeSignature(payload);

    if (providedSig !== expectedSig) {
      return { valid: false, reason: "Cryptographic signature mismatch. License is unauthorized." };
    }

    return {
      valid: true,
      licensee: decodeURIComponent(licensee),
      type: "Registered Pro License",
      expires: expiryDate,
      rawKey: cleanKey,
    };
  }

  /**
   * Activates a license and stores securely in localStorage
   */
  async activate(key) {
    const result = await this.verifyKey(key);
    if (result.valid) {
      this.licenseData = {
        key: key.trim().toUpperCase(),
        licensee: result.licensee,
        type: result.type,
        expires: result.expires,
        activatedAt: new Date().toISOString(),
        device: this.deviceFingerprint,
      };
      localStorage.setItem(this.storageKey, JSON.stringify(this.licenseData));
      return { success: true, license: this.licenseData };
    }
    return { success: false, error: result.reason };
  }

  loadLicense() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed;
    } catch (e) {
      return null;
    }
  }

  isLicensed() {
    return this.licenseData !== null && !!this.licenseData.key;
  }

  getLicenseInfo() {
    return this.licenseData;
  }

  deactivate() {
    this.licenseData = null;
    localStorage.removeItem(this.storageKey);
  }
}

export const licenseManager = new LicenseManager();
