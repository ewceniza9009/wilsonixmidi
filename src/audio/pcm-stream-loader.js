/**
 * Streaming PCM Sample Loader
 * Loads individual samples from IndexedDB on demand instead of keeping all banks in RAM
 * Integrates with existing sample-cache.js for persistent storage
 */

import { sampleCache } from "./sample-cache.js";
import { getDeviceConfig } from "./device-capabilities.js";
import { ownerBankName } from "./pcm-bank-loader.js";

const BANK_MANIFEST = {
  korg: {
    baseUrl: "/soundbanks/korg/",
    instruments: [
      "acoustic_grand_piano",
      "electric_piano_1",
      "string_ensemble_1",
      "drawbar_organ",
      "alto_sax",
      "brass_section",
      "choir_aahs",
    ],
  },
  yamaha: {
    baseUrl: "/soundbanks/yamaha/",
    instruments: [],
  },
  user: {
    baseUrl: "/soundbanks/user/",
    instruments: [],
  },
};

const SAMPLE_KEY_PREFIX = "pcm_sample_";
const MANIFEST_KEY = "pcm_bank_manifest_v1";

let manifestCache = null;
let isManifestLoaded = false;

async function loadManifest() {
  if (manifestCache) return manifestCache;
  if (isManifestLoaded) return manifestCache;

  isManifestLoaded = true;
  try {
    const cached = await sampleCache.getSample(MANIFEST_KEY);
    if (cached) {
      manifestCache = JSON.parse(new TextDecoder().decode(cached));
      return manifestCache;
    }
  } catch (e) {}

  try {
    const resp = await fetch("/soundbanks/manifest.json");
    if (resp.ok) {
      manifestCache = await resp.json();
      const encoded = new TextEncoder().encode(JSON.stringify(manifestCache));
      await sampleCache.setSample(MANIFEST_KEY, encoded.buffer);
      return manifestCache;
    }
  } catch (e) {
    console.warn("[PCM Stream] Manifest fetch failed, using fallback");
  }

  manifestCache = BANK_MANIFEST;
  return manifestCache;
}

function getSampleUrl(bankName, instId, midi) {
  const manifest = manifestCache || BANK_MANIFEST;
  const bank = manifest[bankName];
  if (!bank) return null;
  return `${bank.baseUrl}${instId}/${midi}.mp3`;
}

export async function streamSample(instId, midiNote) {
  const _config = getDeviceConfig();
  const cacheKey = `${SAMPLE_KEY_PREFIX}${instId}_${midiNote}`;

  const cached = await sampleCache.getSample(cacheKey);
  if (cached) {
    return cached;
  }

  const bankName = ownerBankName(instId);
  if (!bankName) {
    console.warn(`[PCM Stream] No bank found for ${instId}`);
    return null;
  }

  const url = getSampleUrl(bankName, instId, midiNote);
  if (!url) return null;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`[PCM Stream] Sample not found: ${url}`);
      return null;
    }
    const arrayBuffer = await resp.arrayBuffer();
    await sampleCache.setSample(cacheKey, arrayBuffer);
    return arrayBuffer;
  } catch (e) {
    console.error(`[PCM Stream] Failed to load ${url}:`, e);
    return null;
  }
}

export async function preloadInstrumentSamples(instId, midiRange = { min: 21, max: 108 }) {
  const config = getDeviceConfig();
  if (!config.streamSamples) return;

  const bankName = ownerBankName(instId);
  if (!bankName) return;

  const manifest = await loadManifest();
  const bank = manifest[bankName];
  if (!bank || !bank.instruments.includes(instId)) return;

  const maxPreload = Math.min(12, config.maxCachedSamples || 10);
  const step = Math.max(1, Math.floor((midiRange.max - midiRange.min) / maxPreload));

  for (let midi = midiRange.min; midi <= midiRange.max; midi += step) {
    const cacheKey = `${SAMPLE_KEY_PREFIX}${instId}_${midi}`;
    const cached = await sampleCache.getSample(cacheKey);
    if (cached) continue;

    const url = getSampleUrl(bankName, instId, midi);
    if (!url) continue;

    try {
      const resp = await fetch(url, { priority: "low" });
      if (resp.ok) {
        const arrayBuffer = await resp.arrayBuffer();
        await sampleCache.setSample(cacheKey, arrayBuffer);
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 50));
  }
}

export async function decodeStreamedSample(ctx, instId, midiNote) {
  const arrayBuffer = await streamSample(instId, midiNote);
  if (!arrayBuffer) return null;

  try {
    const audioBuf = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return audioBuf;
  } catch (e) {
    console.error(`[PCM Stream] Decode failed for ${instId}/${midiNote}:`, e);
    return null;
  }
}

export function clearStreamCache() {
  sampleCache.purgeMemoryCache();
}

export function getStreamCacheStats() {
  return sampleCache.getStorageUsage();
}