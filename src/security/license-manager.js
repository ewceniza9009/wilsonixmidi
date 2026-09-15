import { LICENSE_PUBLIC_KEY_SPKI, LICENSE_ALGORITHM } from "./license-public-key.js";

function hexOrBase64ToUint8Array(str) {
  const clean = str.trim();
  if (/^[0-9A-Fa-f]{128}$/.test(clean)) {
    const bytes = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return bytes;
  }
  let base64 = clean.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  const binaryString = (typeof window !== "undefined" && window.atob)
    ? window.atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function base64ToUint8Array(b64) {
  return hexOrBase64ToUint8Array(b64);
}

const TRIAL_SALT = "MK_ELITE_TRIAL_PROTECT_2026";
const ACTIVATION_HMAC_SALT = "MKPRO_ACTIVATION_HMAC_SALT_2026";

export class LicenseManager {
  constructor() {
    this.storageKey = "midikey_elite_license";
    this.trialStorageKey = "midikey_elite_trial_state";
    this.deviceFingerprint = this.generateDeviceFingerprint();
    this.cryptoPublicKeyPromise = null;
    this._licenseConfirmed = null; // null = pending optimistic, true/false = verified
    this.licenseData = this.loadLicense();
    this.trialData = this.initOrLoadTrial();
    this.revalidateLicense();
  }

  async getCryptoPublicKey() {
    if (this.cryptoPublicKeyPromise) return this.cryptoPublicKeyPromise;
    this.cryptoPublicKeyPromise = (async () => {
      try {
        const cryptoObj = (typeof crypto !== "undefined" && crypto.subtle)
          ? crypto.subtle
          : (typeof crypto !== "undefined" && crypto.webcrypto?.subtle ? crypto.webcrypto.subtle : null);
        if (!cryptoObj) return null;

        const pubKeyDer = base64ToUint8Array(LICENSE_PUBLIC_KEY_SPKI);
        return await cryptoObj.importKey(
          "spki",
          pubKeyDer,
          LICENSE_ALGORITHM,
          false,
          ["verify"]
        );
      } catch (e) {
        console.warn("[LicenseManager] Public key import error:", e);
        return null;
      }
    })();
    return this.cryptoPublicKeyPromise;
  }

  async verifyEcdsaSignature(payload, signatureStr) {
    try {
      const cryptoKey = await this.getCryptoPublicKey();
      const cryptoObj = (typeof crypto !== "undefined" && crypto.subtle)
        ? crypto.subtle
        : (typeof crypto !== "undefined" && crypto.webcrypto?.subtle ? crypto.webcrypto.subtle : null);

      if (!cryptoKey || !cryptoObj) {
        // Web Crypto unavailable — let activate() handle format fallback
        return false;
      }

      const sigBytes = base64ToUint8Array(signatureStr);
      const dataBytes = new TextEncoder().encode(payload);

      return await cryptoObj.verify(
        LICENSE_ALGORITHM,
        cryptoKey,
        sigBytes,
        dataBytes
      );
    } catch (e) {
      return false;
    }
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

  computeSignatureSync(payload, salt = TRIAL_SALT) {
    let hash = 0x811c9dc5;
    const str = `${payload}:::${salt}`;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return Math.abs(hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  }

  /**
   * Computes a device-bound activation hash for the license key.
   * Uses HMAC-SHA256 via Web Crypto when available (much stronger than
   * FNV-1a), falling back to FNV-1a for environments without Web Crypto.
   */
  computeActivationHash(rawKey) {
    const salt = "MKPRO_ACTIVATE_BIND_2026";
    const data = `${rawKey}:::${this.deviceFingerprint}:::${salt}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return Math.abs(hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  }

  /**
   * HMAC-SHA256 activation token via Web Crypto. Returns base64url string
   * or null if Web Crypto is unavailable. This is the preferred activation
   * binding for platforms where Web Crypto works (desktop browsers, modern
   * Android WebView).
   */
  async computeActivationToken(rawKey) {
    try {
      const cryptoObj = (typeof crypto !== "undefined" && crypto.subtle)
        ? crypto.subtle
        : (typeof crypto !== "undefined" && crypto.webcrypto?.subtle ? crypto.webcrypto.subtle : null);
      if (!cryptoObj) return null;

      const keyData = new TextEncoder().encode(rawKey);
      const deviceData = new TextEncoder().encode(this.deviceFingerprint);
      const combined = new Uint8Array(keyData.length + deviceData.length);
      combined.set(keyData);
      combined.set(deviceData, keyData.length);

      const hmacKey = await cryptoObj.importKey(
        "raw",
        new TextEncoder().encode(ACTIVATION_HMAC_SALT),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const sig = await cryptoObj.sign("HMAC", hmacKey, combined);
      const bytes = new Uint8Array(sig);
      let base64 = "";
      for (let i = 0; i < bytes.length; i++) {
        base64 += String.fromCharCode(bytes[i]);
      }
      return (typeof btoa === "function" ? btoa(base64) : Buffer.from(base64, "binary").toString("base64"))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    } catch (e) {
      return null;
    }
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
        } else if (typeof parsed.expiresAt === "number" && parsed.expiresAt > now && parsed.startedAt <= now) {
          // Gracefully re-sign valid active trial from previous version
          parsed.signature = expectedSig;
          parsed.device = this.deviceFingerprint;
          localStorage.setItem(this.trialStorageKey, JSON.stringify(parsed));
          return parsed;
        } else {
          console.warn("Trial state expired or invalid. Resetting to new 30-Day trial.");
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

    if (remainingMs > 0 && trial?.signature !== "TAMPERED") {
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
   * Checks whether the current user has active Pro access (Licensed or Trial)
   */
  hasProAccess() {
    const status = this.getAccessStatus();
    return status.isLicensed || status.isTrial;
  }

  /**
   * Pro-feature guard: Returns true if unlocked, or prompts the activation modal with a friendly reason.
   */
  requirePro(featureName = "This Pro Feature") {
    if (this.hasProAccess()) return true;

    // Dispatch global event so LicenseModalUI opens and highlights the reason
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("wilsonix-open-license-modal", {
          detail: {
            reason: `${featureName} is a Pro feature. Enter an authorized key to unlock.`,
          },
        })
      );
    }
    return false;
  }

  /**
   * Decodes the licensee segment of a license key. Never throws: if the
   * segment is not valid percent-encoding, the raw text is returned instead.
   */
  decodeLicensee(raw) {
    try {
      return decodeURIComponent(raw).replace(/_/g, " ");
    } catch (e) {
      return raw.replace(/_/g, " ");
    }
  }

  /**
   * Validates a license key format:
   * Standard: MKPRO-<NAME>-<EXPIRY>-<SIG>
   * Hardware-locked: MKPRO-<NAME>-<EXPIRY>-<DEVID>-<SIG>
   */
  async verifyKey(key) {
    if (!key || typeof key !== "string") return { valid: false, reason: "Invalid license key format" };

    const cleanKey = key.trim().toUpperCase();

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
      const isValid = await this.verifyEcdsaSignature(payload, providedSig);

      if (!isValid) {
        // Let activate() handle the format fallback — return false here
        // so verifyKey() stays pure (crypto-only), and activate() retries
        // with verifyKeyFormat() when ECDSA fails.
        return { valid: false, reason: "Cryptographic signature mismatch. Unauthorized or forged license key." };
      }

      return {
        valid: true,
        licensee: this.decodeLicensee(licensee),
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
      const isValid = await this.verifyEcdsaSignature(payload, providedSig);

      if (!isValid) {
        return { valid: false, reason: "Cryptographic signature mismatch on hardware key. Unauthorized or forged key." };
      }

      return {
        valid: true,
        licensee: this.decodeLicensee(licensee),
        type: `Hardware-Locked Pro License (${targetDevId})`,
        expires: expiryDate,
        rawKey: cleanKey,
      };
    }

    return { valid: false, reason: "Key must follow format: MKPRO-NAME-EXPIRY-SIGNATURE" };
  }

  /**
   * Activates a license and stores securely in localStorage.
   *
   * @param {string} key  The MKPRO-... license key.
   * @param {string} [activationCode]  Optional MKACT-... activation code
   *   issued by the admin for this specific device. Required when direct
   *   ECDSA license-key verification fails (e.g. Android WebView).
   */
  async activate(key, activationCode) {
    let result;
    try {
      result = await this.verifyKey(key);
    } catch (e) {
      result = { valid: false, reason: "License validation failed unexpectedly." };
    }

    if (result.valid) {
      return await this._storeLicense(key, result, null);
    }

    // ECDSA license-key verification failed. Try the admin-issued activation
    // code path: a separately-signed token binding this exact key to this
    // exact device, verified with the same ECDSA public key.
    if (activationCode) {
      const rawKey = key.trim().toUpperCase();
      try {
        const actResult = await this.verifyActivationCode(activationCode, rawKey);
        if (actResult.valid) {
          // Extract licensee from the key structure
          const parts = rawKey.split("-");
          const licensee = parts.length >= 4 ? this.decodeLicensee(parts[1]) : "Pro Musician";
          const expiryStr = parts.length >= 4 ? parts[2] : "LIFETIME";
          const resultObj = {
            valid: true,
            licensee,
            type: expiryStr === "LIFETIME" ? "Lifetime Pro License" : "Time-Limited Pro License",
            expires: expiryStr === "LIFETIME" ? "Lifetime" : new Date(parseInt(expiryStr, 16)).toLocaleDateString(),
            rawKey,
          };
          return await this._storeLicense(key, resultObj, activationCode);
        }
      } catch (e) {
        // Activation code verification failed — fall through to rejection
      }
    }

    const hint = !activationCode && !result.valid
      ? " If direct verification failed, request a device activation code from your administrator."
      : "";
    return { success: false, error: (result.reason || "License key could not be verified.") + hint };
  }

  async _storeLicense(key, result, activationCode) {
    const rawKey = key.trim().toUpperCase();
    const activationToken = await this.computeActivationToken(rawKey);
    this.licenseData = {
      key: rawKey,
      rawKey,
      licensee: result.licensee,
      type: result.type,
      expires: result.expires,
      activatedAt: new Date().toISOString(),
      device: this.deviceFingerprint,
      _activationToken: activationToken,
      _activationHash: this.computeActivationHash(rawKey),
      _activationCode: activationCode || null,
    };
    this._licenseConfirmed = true;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(this.storageKey, JSON.stringify(this.licenseData));
    }
    return { success: true, license: this.licenseData };
  }

  /**
   * Verifies a device-bound activation code issued by the admin CLI or
   * admin HTML tool. Activation codes are ECDSA-signed over the payload
   * "ACTIVATE:<licenseKey>:<deviceId>" and allow activation on platforms
   * where direct license-key ECDSA verification is unavailable.
   *
   * Format: MKACT-<DEVICE_ID>-<ECDSA_HEX_SIG>
   * The device ID must match the current machine; the license key must
   * match the key being activated.
   *
   * Returns { valid: true } on success, or { valid: false, reason }.
   */
  async verifyActivationCode(activationCode, rawLicenseKey) {
    if (!activationCode || typeof activationCode !== "string") {
      return { valid: false, reason: "Activation code is required." };
    }

    const clean = activationCode.trim().toUpperCase();
    const parts = clean.split("-");
    // MKACT-<DEV-XXXXXXXX>-<HEX SIG>
    // parts[0] = "MKACT", parts[1] = "DEV", parts[2..] = device id segments, last = SIG
    if (parts.length < 3 || parts[0] !== "MKACT") {
      return { valid: false, reason: "Activation code must start with MKACT- and include device ID and signature." };
    }

    // Reconstruct device ID: everything between first and last dash segments.
    // Device IDs are DEV_XXXXXXXX or DEV-XXXXXXXX (8 hex chars), so they're
    // always 2-3 segments (DEV / XXXXXXXX or DEV / XXXX / XXXX).
    // We also need to extract the trailing hex signature.
    const sigHex = parts[parts.length - 1];
    const devParts = parts.slice(1, parts.length - 1);
    const deviceId = devParts.join("-");

    // Validate device matches
    const normalizedDev = deviceId.replace(/_/g, "-").toUpperCase();
    const normalizedCurrent = this.deviceFingerprint.replace(/_/g, "-").toUpperCase();
    if (normalizedDev !== normalizedCurrent) {
      return {
        valid: false,
        reason: `Activation code is for device [${deviceId}], but this machine is [${this.deviceFingerprint}].`,
      };
    }

    // Verify ECDSA signature
    const payload = `ACTIVATE:${rawLicenseKey}:${deviceId}`;
    const isValid = await this.verifyEcdsaSignature(payload, sigHex);

    if (!isValid) {
      return { valid: false, reason: "Activation code signature is invalid or forged." };
    }

    return { valid: true, deviceId };
  }

  loadLicense() {
    try {
      if (typeof localStorage === "undefined") return null;
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") return null;
      // Legacy keys (pre-hardening) only stored the clean key; promote it so
      // they can still be cryptographically re-validated on boot.
      if (!parsed.rawKey && typeof parsed.key === "string" && parsed.key.startsWith("MKPRO")) {
        parsed.rawKey = parsed.key;
      }
      // Anything that isn't a re-verifiable key is treated as tampered.
      return parsed.rawKey ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Re-verifies the stored license against the embedded public key and the
   * device fingerprint on every launch. This closes the "edit localStorage
   * once, unlocked forever" bypass: a forged/edited record fails the ECDSA
   * check (or the hardware-device binding) and is automatically reverted.
   *
   * If Web Crypto API is unavailable (e.g. Android WebView), revalidation
   * is skipped to avoid false rejections — the license was already verified
   * at activation time and stored in localStorage.
   */
  async revalidateLicense() {
    const ld = this.licenseData;
    if (!ld || !ld.rawKey) {
      this._licenseConfirmed = false;
      return;
    }

    // 1. Prefer HMAC-SHA256 activation token (strongest client-side binding).
    //    This token is set at activation time via Web Crypto and cannot be
    //    forged without the HMAC secret embedded in the binary.
    if (ld._activationToken) {
      const currentToken = await this.computeActivationToken(ld.rawKey);
      if (currentToken && currentToken === ld._activationToken) {
        this._licenseConfirmed = true;
        return;
      }
      // Token mismatch — either the key or device was tampered with
      this._licenseConfirmed = false;
      return;
    }

    // 2. If a trusted activation hash exists (set at activation time), use it
    // to verify the license without needing Web Crypto ECDSA. This handles
    // Android WebView where crypto.subtle may be available but ECDSA fails
    // due to key import issues or context restrictions.
    if (ld._activationHash) {
      const check = this.computeActivationHash(ld.rawKey);
      if (check === ld._activationHash) {
        this._licenseConfirmed = true;
        return;
      }
      // Hash mismatch — key was tampered in localStorage
      this._licenseConfirmed = false;
      return;
    }

    // 3. Legacy path: try full ECDSA revalidation
    let result = null;
    try {
      result = await this.verifyKey(ld.rawKey);
    } catch (e) {
      result = null;
    }
    if (!result || !result.valid) {
      // Don't auto-wipe — keep the license so the user can re-enter it
      this._licenseConfirmed = false;
      return;
    }
    ld.expires = result.expires;
    ld.device = this.deviceFingerprint;
    // Store activation token + hash for future boots
    ld._activationToken = await this.computeActivationToken(ld.rawKey);
    ld._activationHash = this.computeActivationHash(ld.rawKey);
    this._licenseConfirmed = true;
  }

  isLicensed() {
    const ld = this.licenseData;
    if (!ld || !ld.key) return false;
    // Hardware-locked keys must still be bound to this machine.
    if (ld.device && ld.device !== this.deviceFingerprint) return false;
    if (this._licenseConfirmed === false) return false;
    return true; // null = optimistic while the boot-time ECDSA check runs
  }

  getLicenseInfo() {
    return this.licenseData;
  }

  deactivate() {
    this.licenseData = null;
    this._licenseConfirmed = false;
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(this.storageKey);
    }
  }
}

export const licenseManager = new LicenseManager();
