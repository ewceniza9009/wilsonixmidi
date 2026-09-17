/**
 * Wilsonix MIDIKey - Stickz "Animal" Festival EDM Sample Loader
 * Loads and decodes authentic 24-bit WAV synth one-shots and FX
 * with IndexedDB sample caching and zero-latency RAM playback.
 */

import { ANIMAL_EDM_BANKS } from "./animal-edm-manifest.js";
import { sampleCache } from "./sample-cache.js";
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
      try {
        const cacheKey = `animal_edm_${instId}_${def.file}`;
        let arrayBuf = await sampleCache.getSample(cacheKey);

        if (!arrayBuf) {
          const url = `/samples/animal_edm/${def.file}`;
          const resp = await fetch(url);
          if (!resp.ok) {
            logger.warn("PCM", `Failed to fetch Animal EDM sample: ${url} (${resp.status})`);
            return null;
          }
          arrayBuf = await resp.arrayBuffer();
          sampleCache.setSample(cacheKey, arrayBuf, {
            instId,
            file: def.file,
            rootMidi: def.rootMidi,
          });
        }

        // Web Audio API decodeAudioData needs a copy of arrayBuf if used multiple times
        const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
        if (!audioBuf) return null;

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
