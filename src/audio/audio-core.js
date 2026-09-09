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

    // Master bus: slider 0-100% maps to 0-3x gain, defaults to 50% (1.0x)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;

    // Fast Peak Analyser for meters & oscilloscope
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.6;
    this.peakBuffer = new Uint8Array(this.analyser.frequencyBinCount);

    // Transparent Hardware Output Safety Limiter (Prevents DAC clipping with zero waveform modulation & zero squashing)
    this.hardwareLimiter = this.ctx.createDynamicsCompressor();
    this.hardwareLimiter.threshold.value = -1.0;  // Transparent safety ceiling
    this.hardwareLimiter.knee.value = 18.0;       // Very soft knee for transparent limiting
    this.hardwareLimiter.ratio.value = 2.5;       // Gentle ratio - no pumping, no distortion
    this.hardwareLimiter.attack.value = 0.010;    // 10ms musical transient catch
    this.hardwareLimiter.release.value = 0.150;   // 150ms smooth recovery (zero pumping)

    // Initialize FX Rack
    this.fxRack = new FxRackManager(this.ctx);

    // Master DC Blocker: kills any DC offset, denormal, or static from effects chain
    this.dcBlocker = this.ctx.createBiquadFilter();
    this.dcBlocker.type = "highpass";
    this.dcBlocker.frequency.value = 20;
    // Master-wide fixed headroom trim: keeps stacked chords safely below full-scale
    // WITHOUT any dynamics processing, so the bus compressors stay completely
    // transparent (compressors running hot = warm grindy noise)
    this.busPad = this.ctx.createGain();
    this.busPad.gain.value = 0.7;

    // Master bus glue compressor: slow optical-style leveling that transparently
    // contains sustained stacked chords BEFORE the limiter, so the limiter only
    // catches true transient peaks and never pumps or distorts
    this.busComp = this.ctx.createDynamicsCompressor();
    this.busComp.threshold.value = -16.0;
    this.busComp.knee.value = 24.0;
    this.busComp.ratio.value = 1.6;
    this.busComp.attack.value = 0.050;
    this.busComp.release.value = 0.450;

    // Routing: FX Rack -> Master Gain -> BusPad(trim) -> DC Blocker -> BusComp -> Analyser -> HardwareLimiter -> Destination
    // (No waveshaper on the master bus: tanh saturation was adding grit to sustained chords)
    this.fxRack.output.connect(this.masterGain);
    this.masterGain.connect(this.busPad);
    this.busPad.connect(this.dcBlocker);
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
      }).catch(() => {});
    } else {
      this.isUnlocked = true;
      this.updateLatencyMetrics();
    }
  }

  // Watchdog: browsers suspend audio on tab switch/bluetooth changes and it
  // never comes back on its own (total silence that feels like a crash)
  ensureRunning() {
    try {
      if (!this.ctx) {
        this.init();
        return;
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {}
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

  // DIAG recorder: taps post-limiter master output so crackle reports can be
  // analyzed as real waveforms instead of guessed at
  startDiagRecord() {
    try {
      if (!this.ctx || this.diagRecorder) return false;
      this.diagDest = this.ctx.createMediaStreamDestination();
      this.hardwareLimiter.connect(this.diagDest);
      this.diagChunks = [];
      this.diagRecorder = new MediaRecorder(this.diagDest.stream);
      this.diagRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) this.diagChunks.push(e.data);
      };
      this.diagRecorder.start(250);
      return true;
    } catch (e) {
      return false;
    }
  }

  stopDiagRecord() {
    try {
      if (!this.diagRecorder) return;
      const rec = this.diagRecorder;
      rec.onstop = () => {
        try {
          const blob = new Blob(this.diagChunks || [], { type: rec.mimeType || "audio/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "wilsonix-diag.webm";
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 2000);
        } catch (e) {}
        try {
          this.hardwareLimiter.disconnect(this.diagDest);
        } catch (e) {}
        this.diagRecorder = null;
        this.diagDest = null;
        this.diagChunks = [];
      };
      rec.stop();
    } catch (e) {}
  }

  get isDiagRecording() {
    return !!this.diagRecorder;
  }
}

export const audioCore = new AudioCore();
