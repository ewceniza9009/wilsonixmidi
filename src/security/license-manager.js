import { LICENSE_PUBLIC_KEY_SPKI, LICENSE_ALGORITHM } from "./license-public-key.js";
import {
  loadPersistentTrialVault,
  savePersistentTrialVault,
} from "./persistent-trial-vault.js";

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
// Longest trial a stored record may ever describe. The FNV/HMAC bindings below
// ship inside the bundle, so they are tamper-EVIDENT only: an attacker who
// reads them can mint any signature they like. Capping the duration is what
// actually bounds a forged record to "at most one fresh trial".
const TRIAL_MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const TRIAL_DURATION_SLACK_MS = 60 * 60 * 1000; // clock skew / re-signing drift

export class LicenseManager {
  /**
   * @param {{publicKeySpki?: string}} [options] Test-only escape hatch: lets the
   *   unit suite verify signatures made with a throwaway test keypair instead of
   *   the production key. Never pass anything here outside of tests.
   */
  constructor(options = {}) {
    this.storageKey = "midikey_elite_license";
    this.trialStorageKey = "midikey_elite_trial_state";
    this.publicKeySpki = options.publicKeySpki || LICENSE_PUBLIC_KEY_SPKI;
    this.deviceFingerprint = this.generateDeviceFingerprint();
    this.cryptoPublicKeyPromise = null;
    this._licenseConfirmed = null; // null = pending optimistic, true/false = verified
    this.licenseData = this.loadLicense();
    this.trialData = this.initOrLoadTrial();
    this.revalidateLicense();
    this.syncPersistentTrial();
  }

  async getCryptoPublicKey() {
    if (this.cryptoPublicKeyPromise) return this.cryptoPublicKeyPromise;
    this.cryptoPublicKeyPromise = (async () => {
      try {
        const cryptoObj = (typeof crypto !== "undefined" && crypto.subtle)
          ? crypto.subtle
          : (typeof crypto !== "undefined" && crypto.webcrypto?.subtle ? crypto.webcrypto.subtle : null);
        if (!cryptoObj) return null;

        const pubKeyDer = base64ToUint8Array(this.publicKeySpki);
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
      const screenPart =
        typeof window !== "undefined" && window.screen
          ? `${Math.max(window.screen.width, window.screen.height)}x${Math.min(window.screen.width, window.screen.height)}x${window.screen.colorDepth || 24}`
          : "1920x1080x24";
      const rawUa =
        (typeof navigator !== "undefined" && navigator.userAgent) || "Desktop";
      const cleanUa = rawUa
        .replace(/Chrome\/[\d.]+/g, (m) => m.split(".")[0])
        .replace(/Version\/[\d.]+/g, (m) => m.split(".")[0]);

      const parts = [
        cleanUa,
        (typeof navigator !== "undefined" && navigator.language) || "en",
        screenPart,
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
          lastSeenAt: Date.now(),
          isExpired: false,
        };
      }

      const stored = localStorage.getItem(this.trialStorageKey);
      const now = Date.now();
      const trialDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 Days

      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed.startedAt === "number" && typeof parsed.expiresAt === "number") {
            const expectedSig = this.computeSignatureSync(
              `TRIAL:${this.deviceFingerprint}:${parsed.startedAt}:${parsed.expiresAt}`,
              TRIAL_SALT
            );

            // Monotonic time anchor — mitigate system clock rollback tampering
            const lastSeen = typeof parsed.lastSeenAt === "number" ? parsed.lastSeenAt : parsed.startedAt;
            if (now < lastSeen - (2 * 3600 * 1000)) {
              console.warn("[LicenseManager] Clock rollback detected.");
            }
            parsed.lastSeenAt = Math.max(now, lastSeen);

            const isSigMatch = parsed.signature === expectedSig;
            // A record with no signature at all is only trusted for a normal
            // trial window - previously any duration was accepted, so editing
            // one localStorage field bought a 10-year "trial" with no crypto.
            const legacyDuration = parsed.expiresAt - parsed.startedAt;
            const isDurationOk =
              legacyDuration <= trialDurationMs + TRIAL_DURATION_SLACK_MS &&
              legacyDuration > 0;
            const isLegacyValid =
              !parsed.signature &&
              parsed.startedAt <= now &&
              isDurationOk;

            if ((isSigMatch || isLegacyValid) && isDurationOk) {
              if (!isSigMatch) {
                parsed.signature = expectedSig;
                parsed.device = this.deviceFingerprint;
              }
              if (parsed.expiresAt <= now || parsed.isExpired === true) {
                parsed.isExpired = true;
              }
              localStorage.setItem(this.trialStorageKey, JSON.stringify(parsed));
              return parsed;
            }

            // Tampered trial record: lock Pro access, DO NOT reset to a new trial
            console.warn(
              "[LicenseManager] Tampered trial state detected" +
                (!isDurationOk ? " (impossible trial duration)." : "."),
            );
            parsed.signature = "TAMPERED";
            parsed.isExpired = true;
            localStorage.setItem(this.trialStorageKey, JSON.stringify(parsed));
            return parsed;
          }
        } catch (e) {
          console.warn("[LicenseManager] Corrupted trial in storage:", e);
        }
      }

      // First run in this localStorage partition:
      // Note: syncPersistentTrial() will immediately check external persistent anchors
      // (Desktop Tauri vault / Android Documents anchor / IndexedDB) to restore any previous
      // trial progress if the app was uninstalled and reinstalled.
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
        lastSeenAt: now,
        isExpired: false,
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
        lastSeenAt: Date.now(),
        isExpired: false,
      };
    }
  }

  /**
   * Synchronizes trial state with persistent storage outside the app sandbox
   * (survives uninstall and reinstall on both Desktop and Android).
   */
  async syncPersistentTrial() {
    try {
      const vaultStr = await loadPersistentTrialVault();
      const now = Date.now();

      if (vaultStr) {
        let vault = null;
        try {
          vault = JSON.parse(vaultStr);
        } catch {
          vault = null;
        }

        if (vault && typeof vault.startedAt === "number" && typeof vault.expiresAt === "number") {
          const targetDevice = vault.device || this.deviceFingerprint;
          const expectedVaultSig = this.computeSignatureSync(
            `TRIAL_VAULT:${targetDevice}:${vault.startedAt}:${vault.expiresAt}`,
            TRIAL_SALT
          );
          const currentDeviceVaultSig = this.computeSignatureSync(
            `TRIAL_VAULT:${this.deviceFingerprint}:${vault.startedAt}:${vault.expiresAt}`,
            TRIAL_SALT
          );
          const isSigValid = vault.signature === expectedVaultSig || vault.signature === currentDeviceVaultSig;

          const vaultDuration = vault.expiresAt - vault.startedAt;
          const isVaultDurationOk =
            vaultDuration > 0 &&
            vaultDuration <= TRIAL_MAX_DURATION_MS + TRIAL_DURATION_SLACK_MS;

          if (isSigValid && isVaultDurationOk) {
            const isVaultExpired = vault.expiresAt <= now || vault.isExpired === true;
            const currentStartedAt = this.trialData ? this.trialData.startedAt : now;

            // If this device was previously installed and has an earlier start date or was expired:
            if (isVaultExpired || vault.startedAt < currentStartedAt) {
              console.log("[LicenseManager] Persistent hardware anchor found across reinstall. Restoring true trial progress.");
              const restoredTrial = {
                startedAt: vault.startedAt,
                expiresAt: isVaultExpired ? Math.min(vault.expiresAt, now - 1000) : vault.expiresAt,
                device: this.deviceFingerprint,
                signature: this.computeSignatureSync(
                  `TRIAL:${this.deviceFingerprint}:${vault.startedAt}:${vault.expiresAt}`,
                  TRIAL_SALT
                ),
                trialDaysTotal: 30,
                lastSeenAt: Math.max(now, vault.lastSeenAt || 0),
                isExpired: isVaultExpired,
              };
              this.trialData = restoredTrial;
              if (typeof localStorage !== "undefined") {
                localStorage.setItem(this.trialStorageKey, JSON.stringify(restoredTrial));
              }
              // Immediately write back the restored trial to the anchor
              await this.savePersistentAnchor(restoredTrial);
              if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
                window.dispatchEvent(
                  new CustomEvent("wilsonix-access-changed", {
                    detail: this.getAccessStatus(),
                  })
                );
              }
              return;
            }
          } else {
            console.warn("[LicenseManager] Persistent anchor signature mismatch or different device.");
          }
        }
      }

      // Save current valid trial state to persistent anchor if not yet present
      if (this.trialData && this.trialData.signature !== "NODE_TEST" && this.trialData.signature !== "FALLBACK") {
        await this.savePersistentAnchor(this.trialData);
      }
    } catch (e) {
      console.warn("[LicenseManager] Persistent trial sync error:", e);
    }
  }

  async savePersistentAnchor(trial) {
    if (!trial || typeof trial.startedAt !== "number" || typeof trial.expiresAt !== "number") return;
    try {
      const now = Date.now();
      const isExpired = trial.isExpired === true || trial.expiresAt <= now;
      const vaultPayload = {
        version: 1,
        device: this.deviceFingerprint,
        startedAt: trial.startedAt,
        expiresAt: isExpired ? Math.min(trial.expiresAt, now - 1000) : trial.expiresAt,
        lastSeenAt: trial.lastSeenAt || now,
        isExpired,
        signature: this.computeSignatureSync(
          `TRIAL_VAULT:${this.deviceFingerprint}:${trial.startedAt}:${trial.expiresAt}`,
          TRIAL_SALT
        ),
      };
      await savePersistentTrialVault(JSON.stringify(vaultPayload));
    } catch (e) {
      console.warn("[LicenseManager] Failed to save persistent anchor:", e);
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
    const effectiveNow = Math.max(now, trial?.lastSeenAt || 0);
    const remainingMs = trial ? trial.expiresAt - effectiveNow : 0;
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    if (remainingMs > 0 && trial?.signature !== "TAMPERED" && !trial?.isExpired) {
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

    // No trial access, but a license record exists: say why it is not
    // granting access instead of reporting a trial expiry that has nothing
    // to do with the user's actual situation.
    if (this.licenseData && this.licenseData.rawKey) {
      const expMs =
        typeof this.licenseData.expiresAtMs === "number"
          ? this.licenseData.expiresAtMs
          : this._keyExpiryMs(this.licenseData.rawKey);
      const expired = expMs !== null && Date.now() > expMs;
      return {
        isLicensed: false,
        isTrial: false,
        isExpired: true,
        canPlayFull: false,
        badgeText: expired ? "⌛ EXPIRED" : "✖ UNVERIFIED",
        badgeClass: "expired",
        type: expired ? "License Expired" : "License Not Verified",
        licensee: this.licenseData.licensee || "Unlicensed",
        expires: expired ? new Date(expMs).toLocaleDateString() : this.licenseData.expires || "—",
        daysRemaining: 0,
        reason: expired
          ? `Your license expired on ${new Date(expMs).toLocaleDateString()}. Enter a renewed license key to continue using Pro features.`
          : "The stored license could not be verified on this device. Re-enter your license key to continue using Pro features.",
      };
    }

    // Trial expired - persist expired state to storage and hardware anchor immediately
    if (trial && !trial.isExpired) {
      trial.isExpired = true;
      trial.expiresAt = Math.min(trial.expiresAt, now - 1000);
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(this.trialStorageKey, JSON.stringify(trial));
        }
        this.savePersistentAnchor(trial).catch(() => {});
      } catch (e) {}
    }

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

  expireTrial() {
    if (!this.trialData) return;
    const now = Date.now();
    this.trialData.isExpired = true;
    this.trialData.expiresAt = Math.min(this.trialData.expiresAt, now - 1000);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.trialStorageKey, JSON.stringify(this.trialData));
      }
      this.savePersistentAnchor(this.trialData).catch(() => {});
    } catch (e) {}
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(
        new CustomEvent("wilsonix-access-changed", {
          detail: this.getAccessStatus(),
        })
      );
    }
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

  /** Device ids are always DEV_XXXXXXXX / DEV-XXXXXXXX (see fingerprint). */
  _looksLikeDeviceId(seg) {
    return /^DEV[_-]/i.test(seg || "");
  }

  /**
   * Splits `MKPRO-<NAME>-<EXPIRY>-<SIG>` / `MKPRO-<NAME>-<EXPIRY>-<DEV>-<SIG>`.
   *
   * `encodeURIComponent` does not escape `-`, so a licensee named "SMITH-JONES"
   * produces a 5-segment key that the old parser mistook for a hardware-locked
   * one and rejected. The shape is decided by the segment BEFORE the trailing
   * signature: if it is a device id we have the hardware form, otherwise every
   * segment between the prefix and the expiry belongs to the name.
   *
   * Returns `{ prefix, licensee, expiryStr, devId, sig }` or null.
   */
  _parseKeyParts(cleanKey) {
    const parts = cleanKey.split("-");
    if (parts[0] !== "MKPRO" || parts.length < 4) return null;
    const n = parts.length;
    const sig = parts[n - 1];
    if (this._looksLikeDeviceId(parts[n - 2])) {
      return {
        prefix: parts[0],
        licensee: parts.slice(1, n - 3).join("-"),
        expiryStr: parts[n - 3],
        devId: parts[n - 2],
        sig,
      };
    }
    return {
      prefix: parts[0],
      licensee: parts.slice(1, n - 2).join("-"),
      expiryStr: parts[n - 2],
      devId: null,
      sig,
    };
  }

  /** Expiry (ms) encoded in an MKPRO key, or null for lifetime keys. */
  _keyExpiryMs(rawKey) {
    if (typeof rawKey !== "string") return null;
    const parts = this._parseKeyParts(rawKey.trim().toUpperCase());
    if (!parts || !parts.expiryStr || parts.expiryStr === "LIFETIME") return null;
    const ts = parseInt(parts.expiryStr, 16);
    return Number.isFinite(ts) && ts > 0 ? ts : null;
  }

  _deviceMatches(devId) {
    const normalized = String(devId).replace(/-/g, "_").toUpperCase();
    const current = this.deviceFingerprint.replace(/-/g, "_").toUpperCase();
    return normalized === current;
  }

  /**
   * Validates a license key format:
   * Standard: MKPRO-<NAME>-<EXPIRY>-<SIG>
   * Hardware-locked: MKPRO-<NAME>-<EXPIRY>-<DEVID>-<SIG>
   */
  async verifyKey(key) {
    if (!key || typeof key !== "string") return { valid: false, reason: "Invalid license key format" };

    const cleanKey = key.trim().toUpperCase();

    if (cleanKey.split("-")[0] !== "MKPRO") {
      return { valid: false, reason: "License key must start with 'MKPRO-'" };
    }

    const parsed = this._parseKeyParts(cleanKey);
    if (!parsed) {
      return { valid: false, reason: "Key must follow format: MKPRO-NAME-EXPIRY-SIGNATURE" };
    }
    const { prefix, licensee, expiryStr, devId, sig: providedSig } = parsed;

    if (devId && !this._deviceMatches(devId)) {
      return {
        valid: false,
        reason: `License is hardware-locked to machine [${devId}]. Current machine is [${this.deviceFingerprint}].`,
      };
    }

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

    const payload = devId
      ? `${prefix}:${licensee}:${expiryStr}:${devId}`
      : `${prefix}:${licensee}:${expiryStr}`;
    const isValid = await this.verifyEcdsaSignature(payload, providedSig);

    if (!isValid) {
      // Stay crypto-only here. activate() owns the only other route in: an
      // admin-issued activation code bound to this exact device. The bundle
      // salts are never enough to make a forged *key* verify — they are only
      // consulted by revalidateLicense() when WebCrypto is unavailable.
      return { valid: false, reason: "Cryptographic signature mismatch. Unauthorized or forged license key." };
    }

    return {
      valid: true,
      licensee: this.decodeLicensee(licensee),
      type: devId
        ? `Hardware-Locked Pro License (${devId})`
        : expiryStr === "LIFETIME"
          ? "Lifetime Pro License"
          : "Time-Limited Pro License",
      expires: expiryDate,
      expiresAtMs: this._keyExpiryMs(cleanKey),
      rawKey: cleanKey,
    };
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
          // The activation code only proves device binding - it carries no
          // time binding, so the key's own expiry must still be honoured.
          const expiryMs = this._keyExpiryMs(rawKey);
          if (expiryMs !== null && Date.now() > expiryMs) {
            return {
              success: false,
              error: `License expired on ${new Date(expiryMs).toLocaleDateString()}.`,
            };
          }
          // Extract licensee from the key structure
          const parsedKey = this._parseKeyParts(rawKey);
          const licensee = parsedKey ? this.decodeLicensee(parsedKey.licensee) : "Pro Musician";
          const expiryStr = parsedKey ? parsedKey.expiryStr : "LIFETIME";
          const resultObj = {
            valid: true,
            licensee,
            type: expiryStr === "LIFETIME" ? "Lifetime Pro License" : "Time-Limited Pro License",
            expires: expiryStr === "LIFETIME" ? "Lifetime" : new Date(parseInt(expiryStr, 16)).toLocaleDateString(),
            expiresAtMs: expiryMs,
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
      // Parsed out of the signed payload so isLicensed() can re-check expiry
      // on every call instead of trusting the activation-time result forever.
      expiresAtMs: typeof result.expiresAtMs === "number" ? result.expiresAtMs : this._keyExpiryMs(rawKey),
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
   * The signature over the key itself is authoritative. The HMAC activation
   * token and the FNV activation hash are only consulted when Web Crypto
   * cannot import the public key at all (some Android WebViews), because their
   * salts are embedded in the shipped bundle — they make tampering evident,
   * they cannot make it impossible. Preferring them (the old order) meant a
   * one-line localStorage edit could skip signature verification entirely.
   */
  async revalidateLicense() {
    const ld = this.licenseData;
    if (!ld || !ld.rawKey) {
      this._licenseConfirmed = false;
      return;
    }

    const cryptoKey = await this._importPublicKeyOrNone();
    if (cryptoKey) {
      let result = null;
      try {
        result = await this.verifyKey(ld.rawKey);
      } catch (e) {
        result = null;
      }
      if (!result || !result.valid) {
        // Don't auto-wipe — keep the license so the user can re-enter it
        this._licenseConfirmed = false;
        this._dispatchAccessChanged();
        return;
      }
      ld.licensee = result.licensee;
      ld.type = result.type;
      ld.expires = result.expires;
      ld.expiresAtMs = result.expiresAtMs ?? null;
      ld.device = this.deviceFingerprint;
      ld._activationToken = await this.computeActivationToken(ld.rawKey);
      ld._activationHash = this.computeActivationHash(ld.rawKey);
      this._licenseConfirmed = true;
      this._persistLicense();
      this._dispatchAccessChanged();
      return;
    }

    // Web Crypto cannot verify here: fall back to the bindings minted at
    // activate() time (they are at least bound to key + device).
    if (ld._activationToken) {
      const currentToken = await this.computeActivationToken(ld.rawKey);
      this._licenseConfirmed = !!currentToken && currentToken === ld._activationToken;
    } else if (ld._activationHash) {
      this._licenseConfirmed = this.computeActivationHash(ld.rawKey) === ld._activationHash;
    } else {
      // Nothing verifiable — do not trust the raw record.
      this._licenseConfirmed = false;
    }
  }

  /** Resolves the ECDSA public key, or null when crypto cannot verify. */
  async _importPublicKeyOrNone() {
    try {
      return await this.getCryptoPublicKey();
    } catch (e) {
      return null;
    }
  }

  _persistLicense() {
    if (typeof localStorage !== "undefined" && this.licenseData) {
      localStorage.setItem(this.storageKey, JSON.stringify(this.licenseData));
    }
  }

  _dispatchAccessChanged() {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(
        new CustomEvent("wilsonix-access-changed", {
          detail: this.getAccessStatus(),
        })
      );
    }
  }

  isLicensed() {
    const ld = this.licenseData;
    if (!ld || !ld.key) return false;
    // Hardware-locked keys must still be bound to this machine.
    if (ld.device && ld.device !== this.deviceFingerprint) return false;
    if (this._licenseConfirmed === false) return false;
    // A time-limited key must not outlive its signed expiry, even after a
    // successful activation (activation-time checks were the only ones before,
    // so an expired key kept showing ★ PRO forever).
    const expiresAtMs =
      typeof ld.expiresAtMs === "number" ? ld.expiresAtMs : this._keyExpiryMs(ld.rawKey || ld.key);
    if (expiresAtMs !== null && Date.now() > expiresAtMs) return false;
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
