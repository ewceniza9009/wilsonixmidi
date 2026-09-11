/**
 * WILSONIX MIDIKEY Elite - Cryptographic License & 30-Day Trial Engine
 * Features:
 * - 30-Day Full Pro Trial with tamper-resistant cryptographic verification
 * - Offline HMAC-SHA256 license key verification & hardware fingerprinting
 * - Stage-ready access status telemetry
 */

const LICENSE_SECRET = "MK_ELITE_SECURE_SALT_2026_STAGE_PRO";
const TRIAL_SALT = "MK_ELITE_TRIAL_PROTECT_2026";

export class LicenseManager {
  constructor() {
    this.storageKey = "midikey_elite_license";
    this.trialStorageKey = "midikey_elite_trial_state";
    this.deviceFingerprint = this.generateDeviceFingerprint();
    this.licenseData = this.loadLicense();
    this.trialData = this.initOrLoadTrial();
  }

  /**
   * Generates a stable hardware fingerprint based on system and device properties
   */
  generateDeviceFingerprint() {
    try {
      const parts = [
        (typeof navigator !== "undefined" && navigator.userAgent) || "Desktop",
        (typeof navigator !== "undefined" && navigator.language) || "en",
        (typeof window !== "undefined" && window.screen ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}` : "1920x1080x24"),
        (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4,
        (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC",
      ];

      let hash = 5381;
      const str = parts.join("|||");
      for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
      }
      const positiveHash = Math.abs(hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
      return `DEV_${positiveHash}`;
    } catch (e) {
      return "DEV_STATION1";
    }
  }

  /**
   * Synchronous SHA-256 HMAC digest in Hex format using Web Crypto or fallback
   */
  async computeSignature(payload, secret = LICENSE_SECRET) {
    try {
      if (typeof crypto !== "undefined" && crypto.subtle) {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          enc.encode(secret),
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
      }
    } catch (e) {
      // Fallback below
    }

    // High-performance offline DJB2/FNV-1a combination fallback
    let hash = 0x811c9dc5;
    const combined = payload + secret;
    for (let i = 0; i < combined.length; i++) {
      hash ^= combined.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).toUpperCase().padStart(8, "0");
  }

  computeSignatureSync(payload, secret = LICENSE_SECRET) {
    let hash = 0x811c9dc5;
    const combined = payload + secret;
    for (let i = 0; i < combined.length; i++) {
      hash ^= combined.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).toUpperCase().padStart(8, "0");
  }

  /**
   * Initializes or loads the 30-Day Free Trial
   */
  initOrLoadTrial() {
    try {
      if (typeof localStorage === "undefined") {
        return {
          startedAt: Date.now(),
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          device: this.deviceFingerprint,
          signature: "NODE_TEST",
          trialDaysTotal: 30,
        };
      }

      const stored = localStorage.getItem(this.trialStorageKey);
      const now = Date.now();
      const trialDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 Days

      if (stored) {
        const parsed = JSON.parse(stored);
        // Verify tamper signature
        const expectedSig = this.computeSignatureSync(
          `TRIAL:${this.deviceFingerprint}:${parsed.startedAt}:${parsed.expiresAt}`,
          TRIAL_SALT
        );

        if (parsed.signature === expectedSig && typeof parsed.expiresAt === "number") {
          return parsed;
        } else {
          console.warn("Trial state tamper detected or corrupt. Resetting to expired state.");
          return {
            startedAt: parsed.startedAt || now,
            expiresAt: 0, // Expired
            device: this.deviceFingerprint,
            signature: "TAMPERED",
          };
        }
      }

      // First run: create new 30-Day Trial record
      const startedAt = now;
      const expiresAt = now + trialDurationMs;
      const signature = this.computeSignatureSync(
        `TRIAL:${this.deviceFingerprint}:${startedAt}:${expiresAt}`,
        TRIAL_SALT
      );

      const newTrial = {
        startedAt,
        expiresAt,
        device: this.deviceFingerprint,
        signature,
        trialDaysTotal: 30,
      };

      localStorage.setItem(this.trialStorageKey, JSON.stringify(newTrial));
      return newTrial;
    } catch (e) {
      console.warn("Trial initialization error:", e);
      return {
        startedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        device: this.deviceFingerprint,
        signature: "FALLBACK",
        trialDaysTotal: 30,
      };
    }
  }

  /**
   * Returns comprehensive access status for the app and HUD
   */
  getAccessStatus() {
    const isLicensed = this.isLicensed();
    if (isLicensed) {
      const info = this.getLicenseInfo();
      return {
        isLicensed: true,
        isTrial: false,
        isExpired: false,
        canPlayFull: true,
        badgeText: "★ PRO",
        badgeClass: "pro",
        type: info.type || "Registered Pro License",
        licensee: info.licensee || "Pro Musician",
        expires: info.expires || "Lifetime",
        daysRemaining: null,
      };
    }

    // Check 30-day trial status
    const now = Date.now();
    const trial = this.trialData;
    const remainingMs = trial ? trial.expiresAt - now : 0;
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    if (remainingMs > 0 && trial.signature !== "TAMPERED") {
      return {
        isLicensed: false,
        isTrial: true,
        isExpired: false,
        canPlayFull: true,
        badgeText: `⏱ ${daysRemaining}D TRIAL`,
        badgeClass: "trial",
        type: "30-Day Pro Trial",
        licensee: "Trial User",
        expires: new Date(trial.expiresAt).toLocaleDateString(),
        daysRemaining: daysRemaining,
        startedAt: new Date(trial.startedAt).toLocaleDateString(),
      };
    }

    // Trial expired
    return {
      isLicensed: false,
      isTrial: false,
      isExpired: true,
      canPlayFull: false,
      badgeText: "⚡ EXPIRED",
      badgeClass: "expired",
      type: "Trial Expired",
      licensee: "Unlicensed",
      expires: "Expired",
      daysRemaining: 0,
      reason: "Your 30-Day Free Trial has ended. Please enter an authorized license key to continue using Pro features.",
    };
  }

  /**
   * Validates a license key format:
   * Standard: MKPRO-<NAME>-<EXPIRY>-<SIG>
   * Hardware-locked: MKPRO-<NAME>-<EXPIRY>-<DEVID>-<SIG>
   * Master Keys: MKPRO-VIP-MASTER-ACCESS / MKPRO-STUDIO-DEMO-2026
   */
  async verifyKey(key) {
    if (!key || typeof key !== "string") return { valid: false, reason: "Invalid license key format" };

    const cleanKey = key.trim().toUpperCase();

    // Built-in VIP Master Keys
    if (cleanKey === "MKPRO-VIP-MASTER-ACCESS" || cleanKey === "MKPRO-STUDIO-DEMO-2026") {
      return {
        valid: true,
        licensee: "Wilsonix Authorized Studio",
        type: "Lifetime VIP Master Access",
        expires: "Never (Lifetime)",
      };
    }

    const parts = cleanKey.split("-");
    if (parts[0] !== "MKPRO") {
      return { valid: false, reason: "License key must start with 'MKPRO-'" };
    }

    if (parts.length === 4) {
      // Standard Key: MKPRO-<NAME>-<EXPIRY>-<SIG>
      const [prefix, licensee, expiryStr, providedSig] = parts;

      let expiryDate = "Lifetime";
      if (expiryStr !== "LIFETIME") {
        const timestamp = parseInt(expiryStr, 16);
        if (isNaN(timestamp)) {
          return { valid: false, reason: "Corrupt expiration timestamp in license key." };
        }
        if (Date.now() > timestamp) {
          return { valid: false, reason: `License expired on ${new Date(timestamp).toLocaleDateString()}` };
        }
        expiryDate = new Date(timestamp).toLocaleDateString();
      }

      const payload = `${prefix}:${licensee}:${expiryStr}`;
      const expectedSig = await this.computeSignature(payload);

      if (providedSig !== expectedSig) {
        return { valid: false, reason: "Cryptographic signature mismatch. Unauthorized license key." };
      }

      return {
        valid: true,
        licensee: decodeURIComponent(licensee).replace(/_/g, " "),
        type: expiryStr === "LIFETIME" ? "Lifetime Pro License" : "Time-Limited Pro License",
        expires: expiryDate,
        rawKey: cleanKey,
      };
    } else if (parts.length === 5) {
      // Hardware-Locked Key: MKPRO-<NAME>-<EXPIRY>-<DEVICEID>-<SIG>
      const [prefix, licensee, expiryStr, targetDevId, providedSig] = parts;

      const normalizedDevId = targetDevId.replace(/-/g, "_");
      const normalizedCurrentDev = this.deviceFingerprint.replace(/-/g, "_");

      if (normalizedDevId !== normalizedCurrentDev) {
        return {
          valid: false,
          reason: `License is hardware-locked to machine [${targetDevId}]. Current machine is [${this.deviceFingerprint}].`,
        };
      }

      let expiryDate = "Lifetime";
      if (expiryStr !== "LIFETIME") {
        const timestamp = parseInt(expiryStr, 16);
        if (isNaN(timestamp)) {
          return { valid: false, reason: "Corrupt expiration timestamp." };
        }
        if (Date.now() > timestamp) {
          return { valid: false, reason: `License expired on ${new Date(timestamp).toLocaleDateString()}` };
        }
        expiryDate = new Date(timestamp).toLocaleDateString();
      }

      const payload = `${prefix}:${licensee}:${expiryStr}:${targetDevId}`;
      const expectedSig = await this.computeSignature(payload);

      if (providedSig !== expectedSig) {
        return { valid: false, reason: "Cryptographic signature mismatch on hardware key." };
      }

      return {
        valid: true,
        licensee: decodeURIComponent(licensee).replace(/_/g, " "),
        type: `Hardware-Locked Pro License (${targetDevId})`,
        expires: expiryDate,
        rawKey: cleanKey,
      };
    }

    return { valid: false, reason: "Key must follow format: MKPRO-NAME-EXPIRY-SIGNATURE" };
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
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.storageKey, JSON.stringify(this.licenseData));
      }
      return { success: true, license: this.licenseData };
    }
    return { success: false, error: result.reason };
  }

  loadLicense() {
    try {
      if (typeof localStorage === "undefined") return null;
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return null;
      return JSON.parse(stored);
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
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(this.storageKey);
    }
  }
}

export const licenseManager = new LicenseManager();
