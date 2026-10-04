/**
 * patch-storage-manager.js
 * Handles saving, loading, and deleting user custom patches (Combi tweaks) to IndexedDB.
 */

import { licenseManager } from "../security/license-manager.js";

const DB_NAME = "MidikeyCustomPatchesDB";
const STORE_NAME = "custom_patches";
const DB_VERSION = 1;

class PatchStorageManager {
  constructor() {
    this.db = null;
    this.initPromise = this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("name", "name", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        console.error("[PatchStorage] IndexedDB error:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  async savePatch(patchName, patchData) {
    // Capability gate: custom patches are a Pro entitlement, so enforcement
    // lives here rather than only in the browser UI that calls this.
    if (!licenseManager.requirePro("Setlist & Custom Patches")) {
      throw new Error("Saving custom patches requires a Pro license.");
    }
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const id = "custom_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      const patch = {
        id,
        name: patchName,
        data: patchData, // The full state of multi-layer engine and FX rack
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(patch);

      request.onsuccess = () => resolve(patch);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async updatePatch(id, patchName, patchData) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (!getReq.result) return reject(new Error("Patch not found"));
        
        const patch = getReq.result;
        patch.name = patchName || patch.name;
        if (patchData) patch.data = patchData;
        patch.updatedAt = Date.now();
        
        const putReq = store.put(patch);
        putReq.onsuccess = () => resolve(patch);
        putReq.onerror = (e) => reject(e.target.error);
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  }

  async getAllPatches() {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("updatedAt");
      const request = index.getAll();

      request.onsuccess = () => {
        // Sort newest first
        const patches = request.result.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(patches);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async deletePatch(id) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }
}

export const patchStorage = new PatchStorageManager();
