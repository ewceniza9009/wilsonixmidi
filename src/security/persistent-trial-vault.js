/**
 * Multi-Platform Persistent Trial Anchor Storage.
 *
 * Persists trial data outside the application's volatile sandbox so that
 * uninstalling and reinstalling the app on Android or Desktop does NOT
 * reset the 30-day trial back to 30 days.
 *
 * Platforms:
 * 1. Desktop (Tauri / Windows):
 *    - %USERPROFILE%\.wilsonix_vault.dat
 *    - %LOCALAPPDATA%\Wilsonix\.sys_vault.bin
 *    - %PROGRAMDATA%\Wilsonix\.sys_vault.bin
 *    These survive NSIS uninstallation of the app.
 *
 * 2. Android (Capacitor):
 *    - Public Directory.Documents/.wilsonix_vault.dat
 *    - Android Auto-Backup (android:allowBackup="true")
 *    Documents directory survives package uninstallation on Android.
 *
 * 3. Web / PWA / Fallback:
 *    - IndexedDB ('wilsonix_security_db')
 */

import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";

const VAULT_FILE_NAME = ".wilsonix_vault.dat";
const IDB_DB_NAME = "wilsonix_security_db";
const IDB_STORE_NAME = "security_vault";
const IDB_KEY = "trial_vault";

export const isNativeAndroid = () =>
  typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();

export const isTauriDesktop = () =>
  typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

/**
 * Lightweight IndexedDB persistence fallback
 */
function openSecurityDB() {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function loadFromIndexedDB() {
  try {
    const db = await openSecurityDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE_NAME, "readonly");
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.get(IDB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

async function saveToIndexedDB(val) {
  try {
    const db = await openSecurityDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE_NAME, "readwrite");
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.put(val, IDB_KEY);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Loads the raw trial payload from the persistent platform anchor
 */
export async function loadPersistentTrialVault() {
  // 1. Desktop (Tauri)
  if (isTauriDesktop()) {
    try {
      const res = await window.__TAURI_INTERNALS__.invoke("load_persistent_trial_vault");
      if (res && typeof res === "string" && res.trim().length > 0) {
        return res.trim();
      }
    } catch (e) {
      console.warn("[PersistentVault] Tauri read error:", e);
    }
  }

  // 2. Android (Capacitor Filesystem in Documents)
  if (isNativeAndroid()) {
    try {
      const res = await Filesystem.readFile({
        path: VAULT_FILE_NAME,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      if (res && res.data && typeof res.data === "string") {
        return res.data.trim();
      }
    } catch (e) {
      // Try subfolder Wilsonix/
      try {
        const resSub = await Filesystem.readFile({
          path: `Wilsonix/${VAULT_FILE_NAME}`,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        if (resSub && resSub.data && typeof resSub.data === "string") {
          return resSub.data.trim();
        }
      } catch {
        // Vault file not yet written or fresh device
      }
    }
  }

  // 3. IndexedDB fallback
  const idbVal = await loadFromIndexedDB();
  if (idbVal && typeof idbVal === "string") {
    return idbVal.trim();
  }

  return null;
}

/**
 * Saves the raw trial payload into persistent platform anchors
 */
export async function savePersistentTrialVault(payload) {
  if (!payload || typeof payload !== "string") return;

  // 1. Desktop (Tauri)
  if (isTauriDesktop()) {
    try {
      await window.__TAURI_INTERNALS__.invoke("save_persistent_trial_vault", {
        payload,
      });
    } catch (e) {
      console.warn("[PersistentVault] Tauri write error:", e);
    }
  }

  // 2. Android (Capacitor Filesystem in Documents)
  if (isNativeAndroid()) {
    try {
      await Filesystem.writeFile({
        path: VAULT_FILE_NAME,
        directory: Directory.Documents,
        data: payload,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    } catch (e) {
      console.warn("[PersistentVault] Android write to Documents root failed, trying subfolder:", e);
      try {
        await Filesystem.writeFile({
          path: `Wilsonix/${VAULT_FILE_NAME}`,
          directory: Directory.Documents,
          data: payload,
          encoding: Encoding.UTF8,
          recursive: true,
        });
      } catch (subErr) {
        console.warn("[PersistentVault] Android write failed:", subErr);
      }
    }
  }

  // 3. IndexedDB fallback
  await saveToIndexedDB(payload);
}
