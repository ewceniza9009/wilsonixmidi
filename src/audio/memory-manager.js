/**
 * Memory Pressure Monitor & Emergency Flush
 * Monitors JS heap usage and triggers emergency cleanup before OOM crash
 */

import { sampleCache } from "./sample-cache.js";
import { getDeviceConfig } from "./device-capabilities.js";

let memoryCheckInterval = null;
let lastHeapUsed = 0;
let pressureCallbacks = [];
let evictionCallbacks = [];
let isMonitoring = false;

/**
 * Engines register a provider that reports current decoded-RAM usage so the
 * monitor can act even where performance.memory does not exist (Android
 * System WebView). Each provider returns { bytes } or { bytes, budget } or null.
 */
const budgetProviders = [];

export function registerBudgetProvider(providerFn) {
  if (typeof providerFn === "function" && !budgetProviders.includes(providerFn)) {
    budgetProviders.push(providerFn);
  }
  return () => {
    const i = budgetProviders.indexOf(providerFn);
    if (i !== -1) budgetProviders.splice(i, 1);
  };
}

function providerUsage() {
  let bytes = 0;
  let budget = 0;
  let hasProvider = false;
  for (const fn of budgetProviders) {
    try {
      const r = fn();
      if (r && Number.isFinite(r.bytes)) {
        hasProvider = true;
        bytes += r.bytes;
        if (Number.isFinite(r.budget)) budget += r.budget;
      }
    } catch (e) {}
  }
  return hasProvider ? { bytes, budget } : null;
}

/** Registers a callback invoked on warning/critical pressure (cold evict). */
export function onMemoryEvict(callback) {
  evictionCallbacks.push(callback);
  return () => {
    const i = evictionCallbacks.indexOf(callback);
    if (i !== -1) evictionCallbacks.splice(i, 1);
  };
}

function triggerEvictionCallbacks() {
  for (const cb of evictionCallbacks) {
    try { cb(); } catch (e) { console.error("[MemoryManager] Evict callback error:", e); }
  }
}

export function initMemoryMonitor() {
  if (isMonitoring) return;

  isMonitoring = true;
  const hasHeapMonitor = typeof performance !== "undefined" && performance.memory;
  if (!hasHeapMonitor) {
    console.warn("[MemoryManager] performance.memory not available — using provider-based decoded-RAM monitoring");
  }

  const config = getDeviceConfig();
  // Limits tuned to the lazy-decode baseline (boot decodes only the default
  // preset's 3-4 instruments). Mobile stays strict to avoid OOM crash;
  // desktop (16GB) can hold a much larger decoded catalog safely.
  let heapLimit;
  if (config.tier === "low") {
    heapLimit = 150 * 1024 * 1024;
  } else if (config.tier === "high" && !config.isMobile) {
    heapLimit = 2200 * 1024 * 1024; // 2.2GB for desktop — decoded catalog fits
  } else if (config.tier === "high") {
    heapLimit = 700 * 1024 * 1024; // 700MB for high-tier Android
  } else {
    // Mid tier: 500MB for Android, 400MB for others
    heapLimit = config.isAndroid ? 500 * 1024 * 1024 : 400 * 1024 * 1024;
  }
  const warningThreshold = heapLimit * 0.85;
  const criticalThreshold = heapLimit * 0.95;

  let lastEmergencyFlush = 0;
  const EMERGENCY_COOLDOWN = 60000; // 60 seconds between emergency flushes

  // First check after a settle window — the boot/lazy decode spike is normal;
  // only act if usage STAYS high.
  let checksSinceStart = 0;

  const heapCap = () => [warningThreshold, criticalThreshold];

  const providerCheck = () => {
    const usage = providerUsage();
    if (!usage || usage.budget <= 0) return;
    const bytes = usage.bytes;
    if (bytes > usage.budget) {
      // Decoded PCM is over engine budget even before heap pressure registers —
      // evict cold decoded instruments (never hot/pinned ones).
      console.warn(`[MemoryManager] Decoded RAM ${Math.round(bytes / 1024 / 1024)}MB over budget ${Math.round(usage.budget / 1024 / 1024)}MB — evicting cold decoded instruments`);
      triggerPressureCallbacks("warning");
      triggerEvictionCallbacks();
    }
  };

  const heapCheck = () => {
    const mem = performance.memory;
    const used = mem.usedJSHeapSize;

    checksSinceStart++;
    if (checksSinceStart < 4) return; // ~90s grace for lazy decode settle

    // Desktop doesn't OOM from decoded AudioBuffers the way Android does —
    // but a 5GB heap thrashes the GC and chokes scrolling/switching. Trigger
    // the cold-instrument eviction callbacks instead of a hard flush.
    if (!config.isMobile && !config.isAndroid) {
      if (used > warningThreshold) {
        console.warn(`[MemoryManager] HIGH: ${Math.round(used / 1024 / 1024)}MB (evicting cold decoded instruments)`);
        triggerPressureCallbacks("warning");
        triggerEvictionCallbacks();
      }
      return;
    }

    // Skip if we're in cooldown
    if (Date.now() - lastEmergencyFlush < EMERGENCY_COOLDOWN) {
      return;
    }

    const [warnT, critT] = heapCap();
    checkMemory(warnT, critT, () => {
      lastEmergencyFlush = Date.now();
    });
  };

  memoryCheckInterval = setInterval(() => {
    // Provider check runs everywhere (WebView doesn't expose performance.memory).
    providerCheck();
    // Heap check only where the signal exists.
    if (hasHeapMonitor) heapCheck();
  }, 30000); // Check every 30s instead of 10s

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", emergencyFlushAll);
    window.addEventListener("beforeunload", emergencyFlushAll);
  }

  // Expose provider usage to the Performance Logger (LoggerUI reads this for
  // the DECODED RAM stat — without this assignment the stat shows "—" forever).
  if (typeof window !== "undefined") {
    window.__midikeyMemoryProvider = providerUsage;
  }

  console.log(`[MemoryManager] Monitoring started. Heap limit: ${Math.round(heapLimit / 1024 / 1024)}MB`);
}

function checkMemory(warningThreshold, criticalThreshold, onEmergency) {
  const mem = performance.memory;
  const used = mem.usedJSHeapSize;
  lastHeapUsed = used;

  if (used > criticalThreshold) {
    console.error(`[MemoryManager] CRITICAL: ${Math.round(used / 1024 / 1024)}MB > ${Math.round(criticalThreshold / 1024 / 1024)}MB`);
    triggerPressureCallbacks("critical");
    if (onEmergency) onEmergency();
    emergencyFlushAll();
  } else if (used > warningThreshold) {
    console.warn(`[MemoryManager] WARNING: ${Math.round(used / 1024 / 1024)}MB > ${Math.round(warningThreshold / 1024 / 1024)}MB`);
    triggerPressureCallbacks("warning");
  }

  const growth = used - lastHeapUsed;
  if (growth > 10 * 1024 * 1024) {
    console.warn(`[MemoryManager] Rapid growth: +${Math.round(growth / 1024 / 1024)}MB`);
  }
}

export function onMemoryPressure(callback) {
  pressureCallbacks.push(callback);
  return () => {
    const idx = pressureCallbacks.indexOf(callback);
    if (idx !== -1) pressureCallbacks.splice(idx, 1);
  };
}

function triggerPressureCallbacks(level) {
  pressureCallbacks.forEach(cb => {
    try { cb(level); } catch (e) { console.error("[MemoryManager] Callback error:", e); }
  });
}

export async function emergencyFlushAll() {
  console.log("[MemoryManager] Emergency flush triggered");
  try {
    await sampleCache.purgeMemoryCache();
    await sampleCache.clearCache();
  } catch (e) {}

  // Real memory return: evict COLD decoded instruments (main-thread map +
  // worklet catalog). Hot/pinned instruments are never touched by the engine's
  // safe eviction, so this cannot drop currently-sounding or preset sounds.
  triggerEvictionCallbacks();

  triggerPressureCallbacks("emergency");
}

export function getMemoryStats() {
  if (typeof performance === "undefined" || !performance.memory) {
    return { available: false };
  }
  const mem = performance.memory;
  return {
    used: mem.usedJSHeapSize,
    total: mem.totalJSHeapSize,
    limit: mem.jsHeapSizeLimit,
    usedMB: Math.round(mem.usedJSHeapSize / 1024 / 1024),
    totalMB: Math.round(mem.totalJSHeapSize / 1024 / 1024),
    limitMB: Math.round(mem.jsHeapSizeLimit / 1024 / 1024),
  };
}

export function stopMemoryMonitor() {
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval);
    memoryCheckInterval = null;
  }
  isMonitoring = false;
}

export function forceGC() {
  if (typeof window !== "undefined" && window.gc) {
    window.gc();
  }
}

if (typeof window !== "undefined") {
  window.__memoryManager = {
    init: initMemoryMonitor,
    emergencyFlush: emergencyFlushAll,
    getStats: getMemoryStats,
    onPressure: onMemoryPressure,
  };
}