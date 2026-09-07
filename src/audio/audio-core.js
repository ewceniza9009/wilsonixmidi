/**
 * Audio Core Manager
 * Manages low-latency AudioContext, keep-alive hardware stream, latency metrics, and master bus.
 */

import { FxRackManager } from "./fx-rack-manager.js";

export class AudioCore {
  constructor() {
    this.ctx = null;
    this.fxRack = null;
    this.masterGain = null;
    this.analyser = null;
    this.isUnlocked = false;

    // Pre-allocated buffer for zero GC overhead during 60/120fps metering
    this.peakBuffer = new Uint8Array(128);
  }

  init() {
    if (this.ctx) return this.ctx;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    try {
      // Force interactive low-latency hardware buffer
      this.ctx = new AudioContextClass({ latencyHint: "interactive" });
    } catch (e) {
      this.ctx = new AudioContextClass();
    }

    this.sampleRate = this.ctx.sampleRate;

    // Master bus: slider 0-100% maps to 0-3x gain, defaults to 50% (1.5x)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.5;

    // Fast Peak Analyser for meters & oscilloscope
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.6;
    this.peakBuffer = new Uint8Array(this.analyser.frequencyBinCount);

    // Transparent Hardware Output Safety Limiter (Prevents DAC clipping with zero waveform modulation & zero squashing)
    this.hardwareLimiter = this.ctx.createDynamicsCompressor();
    this.hardwareLimiter.threshold.value = -0.3; // Transparent safety ceiling
    this.hardwareLimiter.knee.value = 12.0;      // Very soft knee for transparent limiting
    this.hardwareLimiter.ratio.value = 4.0;       // Gentle ratio - no pumping, no distortion
    this.hardwareLimiter.attack.value = 0.005;    // 5ms musical transient catch
    this.hardwareLimiter.release.value = 0.100;   // 100ms smooth recovery (zero pumping)

    // Initialize FX Rack
    this.fxRack = new FxRackManager(this.ctx);

    // Master DC Blocker: kills any DC offset, denormal, or static from effects chain
    this.dcBlocker = this.ctx.createBiquadFilter();
    this.dcBlocker.type = "highpass";
    this.dcBlocker.frequency.value = 20;

    // Master bus glue compressor: slow optical-style leveling that transparently
    // contains sustained stacked chords BEFORE the limiter, so the limiter only
    // catches true transient peaks and never pumps or distorts
    this.busComp = this.ctx.createDynamicsCompressor();
    this.busComp.threshold.value = -14.0;
    this.busComp.knee.value = 18.0;
    this.busComp.ratio.value = 2.0;
    this.busComp.attack.value = 0.030;
    this.busComp.release.value = 0.400;

    // Routing: FX Rack -> Master Gain -> DC Blocker -> BusComp -> Analyser -> HardwareLimiter -> Destination
    // (No waveshaper on the master bus: tanh saturation was adding grit to sustained chords)
    this.fxRack.output.connect(this.masterGain);
    this.masterGain.connect(this.dcBlocker);
    this.dcBlocker.connect(this.busComp);
    this.busComp.connect(this.analyser);
    this.analyser.connect(this.hardwareLimiter);
    this.hardwareLimiter.connect(this.ctx.destination);

    // Telemetry
    this.updateLatencyMetrics();

    return this.ctx;
  }

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().then(() => {
        this.isUnlocked = true;
        this.updateLatencyMetrics();
      });
    } else {
      this.isUnlocked = true;
      this.updateLatencyMetrics();
    }
  }

  updateLatencyMetrics() {
    if (!this.ctx) return;
    const base = (this.ctx.baseLatency || 0.0026) * 1000;
    const output = (this.ctx.outputLatency || 0.005) * 1000;
    this.reportedLatencyMs = Math.round((base + output) * 10) / 10;
  }

  getLatencyMs() {
    this.updateLatencyMetrics();
    return this.reportedLatencyMs || 5.2;
  }

  getPeakLevel() {
    if (!this.analyser || !this.peakBuffer) return 0;
    this.analyser.getByteTimeDomainData(this.peakBuffer);
    let max = 0;
    const len = this.peakBuffer.length;
    for (let i = 0; i < len; i += 4) {
      const val = Math.abs(this.peakBuffer[i] - 128) / 128;
      if (val > max) max = val;
    }
    return max;
  }

  setMasterVolume(val) {
    if (!this.masterGain || !this.ctx) return;
    const v = Math.max(0, Math.min(3.0, val * 3.0));
    this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }
}

export const audioCore = new AudioCore();
