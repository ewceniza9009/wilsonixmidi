/**
 * Device Capability Detection & Tier Configuration
 * Determines optimal audio settings based on device hardware
 */

export const DEVICE_TIER = {
  LOW: 'low',
  MID: 'mid',
  HIGH: 'high'
};

export function detectDeviceCapabilities() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  
  let tier = DEVICE_TIER.MID;
  
  // More generous tier detection for mobile
  if (isAndroid) {
    // Android: 4GB+ = mid, 8GB+ = high
    if (mem < 4 || cores < 4) {
      tier = DEVICE_TIER.LOW;
    } else if (mem >= 8 && cores >= 6) {
      tier = DEVICE_TIER.HIGH;
    }
  } else if (isIOS) {
    // iOS: similar but slightly more conservative
    if (mem < 3 || cores < 4) {
      tier = DEVICE_TIER.LOW;
    } else if (mem >= 6 && cores >= 6) {
      tier = DEVICE_TIER.HIGH;
    }
  } else {
    // Desktop: original logic
    if (mem < 4 || cores < 4) {
      tier = DEVICE_TIER.LOW;
    } else if (mem >= 8 && cores >= 8) {
      tier = DEVICE_TIER.HIGH;
    }
  }

  const config = {
    tier,
    isMobile,
    isAndroid,
    isIOS,
    deviceMemoryGB: mem,
    hardwareConcurrency: cores,
    
    maxPolyphony: isMobile ? (tier === DEVICE_TIER.LOW ? 24 : 36) : (tier === DEVICE_TIER.LOW ? 32 : tier === DEVICE_TIER.HIGH ? 128 : 64),
    maxWorkletVoices: isMobile ? (tier === DEVICE_TIER.LOW ? 24 : 36) : (tier === DEVICE_TIER.LOW ? 32 : tier === DEVICE_TIER.HIGH ? 128 : 64),
    maxSynthVoices: tier === DEVICE_TIER.LOW ? 8 : tier === DEVICE_TIER.HIGH ? 16 : 12,
    
    enableReverb: tier !== DEVICE_TIER.LOW,
    enableChorus: tier !== DEVICE_TIER.LOW,
    enablePhaser: tier === DEVICE_TIER.HIGH,
    enableConvolution: false,
    
    streamSamples: tier === DEVICE_TIER.LOW || isMobile,
    preloadSamples: tier === DEVICE_TIER.HIGH,
    maxCachedSamples: tier === DEVICE_TIER.LOW ? 10 : tier === DEVICE_TIER.HIGH ? 50 : 20,
    
    audioWorkletSupported: typeof AudioWorkletNode !== 'undefined',
    sharedArrayBufferSupported: typeof SharedArrayBuffer !== 'undefined',
    
    sampleRate: 48000,
    bufferSize: tier === DEVICE_TIER.LOW ? 2048 : 1024,
    
    masterGain: tier === DEVICE_TIER.LOW ? 0.7 : 1.0,
  };

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('wilsonix_device_tier', JSON.stringify({
        tier,
        mem,
        cores,
        isMobile,
        timestamp: Date.now()
      }));
    } catch (e) {}
  }

  console.log(`[DeviceCapabilities] Tier: ${tier}, Mem: ${mem}GB, Cores: ${cores}, Mobile: ${isMobile}`);
  return config;
}

let cachedConfig = null;
export function getDeviceConfig() {
  if (!cachedConfig) {
    cachedConfig = detectDeviceCapabilities();
  }
  return cachedConfig;
}

export function forceTier(tier) {
  if (Object.values(DEVICE_TIER).includes(tier)) {
    cachedConfig = null;
    Object.defineProperty(navigator, 'deviceMemory', { value: tier === DEVICE_TIER.LOW ? 2 : tier === DEVICE_TIER.HIGH ? 8 : 4, configurable: true });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: tier === DEVICE_TIER.LOW ? 2 : tier === DEVICE_TIER.HIGH ? 8 : 4, configurable: true });
    return getDeviceConfig();
  }
  return getDeviceConfig();
}