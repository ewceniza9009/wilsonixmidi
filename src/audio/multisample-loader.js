/**
 * WILSONIX MIDIKEY - Generalized Multisample Bank Loader.
 *
 * Loads imported multisample instruments (see multisample-manifest.js) with
 * industry-standard rompler features:
 *   - Multi-velocity: per-bank velocity thresholds resolve `vl1..vlN` layers
 *     (registered into the engine at load start, so the FIRST note of a
 *     still-decoding bank already resolves the right layer once decoded).
 *   - Round-robins: `rr1..rrN` variants per (note, layer) are stored under
 *     distinct keys and cycled per repeated note by the engine
 *     (NativePcmEngine._applyRoundRobin).
 *   - IndexedDB per-file caching with integrity validation + decode-failure
 *     heal (same corruption-resilient pattern as the EDM loaders).
 *   - Sustain-loop voicing via the existing loop engine, driven by the bank
 *     category.
 */

import { MULTISAMPLE_BANKS } from "./multisample-manifest.js";
import { sampleCache } from "./sample-cache.js";
import { configureSustainLoop } from "./sample-loop-helper.js";
import { logger } from "../utils/logger.js";

class MultisampleLoader {
  constructor() {
    this.decodedBuffers = new Map(); // instId -> Map<key, AudioBuffer>
    this.loadingPromises = new Map();
    // instId -> ascending velocity lower-bounds (shared with the engine).
    this.velocityThresholds = new Map();
  }

  isMultisampleInstrument(instId) {
    return typeof instId === "string" && !!MULTISAMPLE_BANKS[instId];
  }

  getBank(instId) {
    return MULTISAMPLE_BANKS[instId] || null;
  }

  async loadInstrument(instId, ctx, targetMap = null) {
    if (!ctx) return null;
    const bank = this.getBank(instId);
    if (!bank) return null;

    // Register velocity thresholds immediately (not after decode) so the
    // engine resolves the right velocity layer from the first note on.
    if (
      Array.isArray(bank.velocityThresholds) &&
      bank.velocityThresholds.length > 1
    ) {
      this.velocityThresholds.set(instId, bank.velocityThresholds.slice());
    } else {
      this.velocityThresholds.delete(instId);
    }

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
        if (!this.decodedBuffers.has(instId))
          this.decodedBuffers.set(instId, new Map());
        const noteMap = this.decodedBuffers.get(instId);
        const ctxLocal = this.ctx || ctx;

        const samples = (bank.samples || []).slice();
        // Decode the anchors nearest C4 first so the first played notes become
        // playable as early as possible.
        samples.sort((a, b) => Math.abs(a.m - 60) - Math.abs(b.m - 60));

        const BATCH = 4;
        for (let i = 0; i < samples.length; i += BATCH) {
          const batch = samples.slice(i, i + BATCH);
          await Promise.all(
            batch.map(async (sample) => {
              try {
                const cacheKey = `ms_${instId}_${sample.f}`;
                let arrayBuf = await sampleCache.getSample(cacheKey);
                if (arrayBuf && !sampleCache.constructor._looksLikeAudio(new Uint8Array(arrayBuf.slice(0, 16)))) {
                  arrayBuf = null; // discard corrupt or HTML 404 cache entry
                }
                const safeFile = sample.f.split("/").map(encodeURIComponent).join("/");
                if (!arrayBuf) {
                  const url = `${bank.path}/${safeFile}`;
                  const resp = await fetch(url);
                  if (!resp.ok) {
                    logger.warn(
                      "PCM",
                      `Failed to fetch multisample: ${url} (${resp.status})`,
                    );
                    return;
                  }
                  arrayBuf = await resp.arrayBuffer();
                  sampleCache.setSample(cacheKey, arrayBuf, {
                    instId,
                    file: sample.f,
                  });
                }

                let audioBuf = null;
                try {
                  audioBuf = await ctxLocal.decodeAudioData(arrayBuf.slice(0));
                } catch (cacheErr) {
                  // Corrupt IndexedDB cache (a known WebView failure mode):
                  // re-fetch a fresh copy, HEAL the cache entry, and retry so
                  // the instrument recovers permanently.
                  const url = `${bank.path}/${safeFile}`;
                  const resp = await fetch(url);
                  if (resp.ok) {
                    const fresh = await resp.arrayBuffer();
                    audioBuf = await ctxLocal.decodeAudioData(fresh.slice(0));
                    sampleCache.setSample(cacheKey, fresh, {
                      instId,
                      file: sample.f,
                    });
                  }
                }
                if (!audioBuf) return;

                configureSustainLoop(
                  audioBuf,
                  bank.category || "",
                  instId,
                );

                // Storage convention (engine contract):
                //   rr 0/absent -> `${m}_${v}`  (+ numeric base on first VL)
                //   rr >= 1     -> `${m}_${v}_rr${rr}`
                const vl = sample.v || "vl1";
                const rr = sample.rr || 0;
                const key = rr >= 1 ? `${sample.m}_${vl}_rr${rr}` : `${sample.m}_${vl}`;
                noteMap.set(key, audioBuf);
                if (rr < 1 && !noteMap.has(sample.m)) {
                  noteMap.set(sample.m, audioBuf);
                }
                if (targetMap) {
                  if (!targetMap.has(instId)) targetMap.set(instId, noteMap);
                }
              } catch (err) {
                logger.warn(
                  "PCM",
                  `Failed to decode multisample ${sample.f} for "${instId}"`,
                  err,
                );
              }
            }),
          );
        }

        if (targetMap) {
          const finalMap = this.decodedBuffers.get(instId);
          if (finalMap && !targetMap.has(instId)) targetMap.set(instId, finalMap);
        }
        return this.decodedBuffers.get(instId) || null;
      } catch (err) {
        logger.warn("PCM", `Multisample load failed for ${instId}:`, err);
        return null;
      } finally {
        this.loadingPromises.delete(instId);
      }
    })();

    this.loadingPromises.set(instId, promise);
    return promise;
  }
}

export const multisampleLoader = new MultisampleLoader();
