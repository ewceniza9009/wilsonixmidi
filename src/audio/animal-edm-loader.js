/**
 * Wilsonix MIDIKey - Stickz "Animal" Festival EDM Sample Loader
 * Loads and decodes authentic 24-bit WAV synth one-shots and FX
 * with IndexedDB sample caching and zero-latency RAM playback.
 */

import { ANIMAL_EDM_BANKS } from "./animal-edm-manifest.js";
import { sampleCache } from "./sample-cache.js";
import { configureSustainLoop } from "./sample-loop-helper.js";
import { logger } from "../utils/logger.js";

class AnimalEdmSampleLoader {
  constructor() {
    this.decodedBuffers = new Map(); // instId -> Map<midi, AudioBuffer>
    this.loadingPromises = new Map();
  }

  isAnimalInstrument(instId) {
    return typeof instId === "string" && instId.startsWith("animal_") && !!ANIMAL_EDM_BANKS[instId];
  }

  getDef(instId) {
    return ANIMAL_EDM_BANKS[instId] || null;
  }

  async loadInstrument(instId, ctx, targetMap = null) {
    if (!ctx) return null;
    const def = this.getDef(instId);
    if (!def) return null;

    if (this.decodedBuffers.has(instId)) {
      const existing = this.decodedBuffers.get(instId);
      if (targetMap && !targetMap.has(instId)) {
        targetMap.set(instId, existing);
      }
      return existing;
    }

    if (this.loadingPromises.has(instId)) {
      return this.loadingPromises.get(instId);
    }

    const promise = (async () => {
      const url = `/samples/animal_edm/${def.file}`;
      const fetchFresh = async () => {
        const resp = await fetch(url);
        if (!resp.ok) {
          logger.warn("PCM", `Failed to fetch Animal EDM sample: ${url} (${resp.status})`);
          return null;
        }
        return resp.arrayBuffer();
      };
      try {
        const cacheKey = `animal_edm_${instId}_${def.file}`;
        let arrayBuf = await sampleCache.getSample(cacheKey);

        if (!arrayBuf) {
          arrayBuf = await fetchFresh();
          if (!arrayBuf) return null;
          sampleCache.setSample(cacheKey, arrayBuf, {
            instId,
            file: def.file,
            rootMidi: def.rootMidi,
          });
        }

        // Web Audio API decodeAudioData needs a copy of arrayBuf if used multiple times
        let audioBuf = null;
        try {
          audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
        } catch (cacheErr) {
          // Corrupt IndexedDB cache (a known WebView failure mode): the cached
          // bytes fail decode on every future note. Re-fetch a fresh copy, HEAL
          // the cache entry, and retry so playback recovers permanently instead
          // of staying silent until reinstall.
          const fresh = await fetchFresh();
          if (!fresh) throw cacheErr;
          audioBuf = await ctx.decodeAudioData(fresh.slice(0));
          sampleCache.setSample(cacheKey, fresh, {
            instId,
            file: def.file,
            rootMidi: def.rootMidi,
          });
        }
        if (!audioBuf) return null;

        configureSustainLoop(audioBuf, def.subCategory || def.category, instId);

        const noteMap = new Map();
        noteMap.set(def.rootMidi, audioBuf);

        this.decodedBuffers.set(instId, noteMap);
        if (targetMap) {
          targetMap.set(instId, noteMap);
        }

        return noteMap;
      } catch (err) {
        logger.warn("PCM", `Animal EDM sample decode failed for ${instId}:`, err);
        return null;
      } finally {
        this.loadingPromises.delete(instId);
      }
    })();

    this.loadingPromises.set(instId, promise);
    return promise;
  }

  preloadTopShots(ctx, targetMap = null) {
    const allIds = Object.keys(ANIMAL_EDM_BANKS);

    const runPreload = () => {
      allIds.forEach((id, idx) => {
        setTimeout(() => {
          this.loadInstrument(id, ctx, targetMap);
        }, idx * 40);
      });
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => runPreload());
    } else {
      setTimeout(runPreload, 200);
    }
  }
}

export const animalEdmLoader = new AnimalEdmSampleLoader();
