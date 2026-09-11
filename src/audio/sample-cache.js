/**
 * WILSONIX MIDIKEY Elite - High-Speed IndexedDB Binary Sample Cache
 * Provides persistent local caching of soundbank multisamples and waveforms.
 * Reduces cold startup time and memory heap consumption.
 */

const DB_NAME = "midikey_sample_cache_v1";
const DB_VERSION = 1;
const STORE_NAME = "samples";

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
          resolve(this.db);
        };
        req.onerror = () => {
          this.db = null;
          resolve(null);
        };
      } catch (err) {
        this.db = null;
        resolve(null);
      }
    });

    return this._initPromise;
  }

  async getSample(key) {
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    const db = await this.openDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result && req.result.buffer) {
            this.memoryCache.set(key, req.result.buffer);
            resolve(req.result.buffer);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async setSample(key, arrayBuffer, metadata = {}) {
    if (!arrayBuffer) return;
    this.memoryCache.set(key, arrayBuffer);

    const db = await this.openDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({
          key,
          buffer: arrayBuffer,
          metadata,
          timestamp: Date.now(),
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
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
      } catch (e) {}
    }
    return { usageBytes: 0, quotaBytes: 0, cachedItems: this.memoryCache.size };
  }
}

export const sampleCache = new SampleCache();
