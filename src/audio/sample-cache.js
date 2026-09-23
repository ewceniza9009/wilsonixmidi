/**
 * WILSONIX MIDIKEY Elite - High-Speed IndexedDB Binary Sample Cache
 * Provides persistent local caching of soundbank multisamples and waveforms.
 * Reduces cold startup time and memory heap consumption.
 */

import { logger } from "../utils/logger.js";

const DB_NAME = "midikey_sample_cache_v2";
const DB_VERSION = 1;
const STORE_NAME = "samples";
// v1 entries were written without integrity metadata; a WebView storage failure
// could poison them (decode fails on every read → permanent silent playback).
// Bumping the DB name discards that entire cache on app update.

export class SampleCache {
  constructor() {
    this.db = null;
    this._initPromise = null;
    this.memoryCache = new Map();
  }

  async openDb() {
    if (this.db) return this.db;
    if (this._initPromise) return this._initPromise;
    if (typeof indexedDB === "undefined") return null;

    this._initPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "key" });
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          // Fire-and-forget: drop the legacy v1 database so its (potentially
          // poisoned) entries stop consuming device storage.
          try { indexedDB.deleteDatabase("midikey_sample_cache_v1"); } catch (_) {}
          resolve(this.db);
        };
        req.onerror = () => {
          this.db = null;
          resolve(null);
        };
      } catch (err) {
        logger.warn("SAMPLE_CACHE", "IndexedDB unavailable; running without persistent sample cache", err);
        this.db = null;
        resolve(null);
      }
    });

    return this._initPromise;
  }

  /**
   * Reads a cached sample entry and validates its integrity before returning it.
   * Returns { buffer, metadata } for valid entries, or null for missing/corrupt
   * entries so the caller can handle misses or fetch fresh bytes.
   */
  async getSampleEntry(key) {
    if (this.memoryCache.has(key)) {
      return { buffer: this.memoryCache.get(key), metadata: {} };
    }

    const db = await this.openDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = async () => {
          const entry = req.result;
          if (!entry || !entry.buffer) {
            resolve(null);
            return;
          }
          const valid = await this._validateEntry(entry);
          if (!valid) {
            // Poisoned entry: drop it from disk so it is never re-read.
            this._dropSample(key);
            resolve(null);
            return;
          }
          resolve({ buffer: entry.buffer, metadata: entry.metadata || {} });
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * Reads a cached sample and validates its integrity before returning it.
   * Returns null for missing OR corrupt entries so the caller treats it as a
   * cache miss and refetches fresh bytes instead of playing garbage forever.
   */
  async getSample(key) {
    const entry = await this.getSampleEntry(key);
    return entry ? entry.buffer : null;
  }

  /**
   * Integrity check: stored byte length, audio-container magic bytes, and
   * (when crypto.subtle is available) a SHA-256 checksum written at put-time.
   * Cheap on read — magic bytes are 4 bytes; the digest is hardware-accelerated.
   */
  async _validateEntry(entry) {
    try {
      const buf = entry.buffer;
      if (!(buf instanceof ArrayBuffer) || buf.byteLength === 0) return false;
      if (typeof entry.bytes === "number" && entry.bytes !== buf.byteLength) {
        return false;
      }
      const bytes = new Uint8Array(buf, 0, Math.min(16, buf.byteLength));
      if (!SampleCache._looksLikeAudio(bytes)) return false;
      if (entry.checksum && typeof crypto !== "undefined" && crypto.subtle) {
        const digest = await SampleCache._checksum(buf);
        if (digest !== entry.checksum) return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Sniffs common audio container magic bytes (MP3/FLAC/WAV/OGG/M4A).
   * A WebView storage failure usually zero-fills or truncates the buffer,
   * which this cheap header check catches before decode is even attempted.
   */
  static _looksLikeAudio(b) {
    if (b.length < 4) return false;
    if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) return true; // "fLaC"
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return true; // "RIFF"
    if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true; // "ID3"
    if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return true; // "OggS"
    if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return true; // "ftyp"
    if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return true; // MPEG frame sync
    return false;
  }

  static async _checksum(arrayBuffer) {
    try {
      const data = new Uint8Array(arrayBuffer);
      const hash = await crypto.subtle.digest("SHA-256", data);
      const hex = [];
      const view = new Uint8Array(hash);
      for (let i = 0; i < view.length; i++) hex.push(view[i].toString(16).padStart(2, "0"));
      return hex.join("");
    } catch (e) {
      return null;
    }
  }

  _dropSample(key) {
    (async () => {
      try {
        const db = await this.openDb();
        if (!db) return;
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(key);
      } catch (e) {}
    })();
  }

  async setSample(key, arrayBuffer, metadata = {}) {
    if (!arrayBuffer) return;

    const db = await this.openDb();
    if (!db) return;

    const checksum = await SampleCache._checksum(arrayBuffer);

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({
          key,
          buffer: arrayBuffer,
          bytes: arrayBuffer.byteLength,
          checksum,
          metadata,
          timestamp: Date.now(),
        });
        tx.oncomplete = () => {
          // Immediately evict raw binary from RAM memoryCache since it's safely on disk in IndexedDB
          this.memoryCache.delete(key);
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  evictMemoryBuffer(key) {
    this.memoryCache.delete(key);
  }

  purgeMemoryCache() {
    this.memoryCache.clear();
  }

  async hasSample(key) {
    if (this.memoryCache.has(key)) return true;
    const db = await this.openDb();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.count(key);
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async clearCache() {
    this.memoryCache.clear();
    const db = await this.openDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async getStorageUsage() {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          usageBytes: estimate.usage || 0,
          quotaBytes: estimate.quota || 0,
          cachedItems: this.memoryCache.size,
        };
      } catch (e) {
        logger.warn("SAMPLE_CACHE", "Failed to read storage estimate", e);
      }
    }
    return { usageBytes: 0, quotaBytes: 0, cachedItems: this.memoryCache.size };
  }
}

export const sampleCache = new SampleCache();
