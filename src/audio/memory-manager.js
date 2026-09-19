/**
 * Memory Pressure Monitor & Emergency Flush
 * Monitors JS heap usage and triggers emergency cleanup before OOM crash
 */

import { sampleCache } from "./sample-cache.js";
import { getDeviceConfig } from "./device-capabilities.js";

let memoryCheckInterval = null;
let lastHeapUsed = 0;
let pressureCallbacks = [];
let isMonitoring = false;

export function initMemoryMonitor() {
  if (isMonitoring) return;
  if (typeof performance === "undefined" || !performance.memory) {
    console.warn("[MemoryManager] performance.memory not available");
    return;
  }

  isMonitoring = true;
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

  memoryCheckInterval = setInterval(() => {
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
      }
      return;
    }

    // Skip if we're in cooldown
    if (Date.now() - lastEmergencyFlush < EMERGENCY_COOLDOWN) {
      return;
    }

    checkMemory(warningThreshold, criticalThreshold, () => {
      lastEmergencyFlush = Date.now();
    });
  }, 30000); // Check every 30s instead of 10s

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", emergencyFlushAll);
    window.addEventListener("beforeunload", emergencyFlushAll);
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
  
  // DO NOT flush worklet catalog - kills sound
  // DO NOT flush main thread decoded buffers - kills sound
  // Just clear sample cache memory
  
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