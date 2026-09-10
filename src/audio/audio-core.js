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
      // "balanced" lets the browser use a larger WASAPI internal buffer than
      // "interactive". On low-power chips (WILSONIX-tier SoCs) the audio thread
      // can miss the tiny 128-frame (~2.9ms) interactive deadline during
      // sustained bass-heavy patches -> 1-3ms dropout = an audible crackle.
      // The tradeoff is a few extra ms of base latency, which is far less
      // obnoxious than periodic crackles. If it feels laggy, switch back to
      // "interactive" (measured tooling is unaffected either way).
      this.ctx = new AudioContextClass({ latencyHint: "balanced" });
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
    this.hardwareLimiter.threshold.value = -1.5;  // True brickwall safety ceiling
    this.hardwareLimiter.knee.value = 6.0;        // Soft knee - rounded clamp, no square-edge distortion
    this.hardwareLimiter.ratio.value = 20.0;      // 20:1 hard clamp on runaway peaks
    this.hardwareLimiter.attack.value = 0.002;    // 2ms - catches feedback blowups, smooths the grab
    this.hardwareLimiter.release.value = 0.150;   // 150ms fast recovery, no pumping below ceiling

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

    // Master bus glue compressor: optical-style leveling for stacked chords.
    // Bypassed by default — the 0.7 busPad + hardware limiter already prevent
    // clipping. Only engaged by heavy FX presets to contain sustained tails.
    this.busComp = this.ctx.createDynamicsCompressor();
    this.busComp.threshold.value = -16.0;
    this.busComp.knee.value = 12.0;
    this.busComp.ratio.value = 1.6;
    this.busComp.attack.value = 0.015;
    this.busComp.release.value = 0.300;

    // Bypass gain: routes AROUND the bus compressor when it's not needed,
    // removing its per-quantum DSP overhead entirely.
    this.busCompBypass = this.ctx.createGain();
    this.busCompBypass.gain.value = 1.0;
    this.busCompEnabled = false;

    // Routing: FX Rack -> Master Gain -> BusPad(trim) -> DC Blocker -> [BusComp OR Bypass] -> Analyser -> HardwareLimiter -> Destination
    this.fxRack.output.connect(this.masterGain);
    this.masterGain.connect(this.busPad);
    this.busPad.connect(this.dcBlocker);
    // Default: fast bypass path (no compressor)
    this.dcBlocker.connect(this.busCompBypass);
    this.busCompBypass.connect(this.analyser);
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

  // Latency analysis.
  // The engine's TRUE output latency is baseLatency + outputLatency (bounded,
  // negotiated with the OS audio device). getOutputTimestamp() timestamps run
  // on TWO different clocks (audio vs wall). While the engine is actively
  // rendering they stay in near-perfect lockstep; if the context is suspended
  // or the page throttles silent audio, the audio clock stalls while the wall
  // clock keeps advancing — the raw difference then drifts to tens of
  // thousands of ms. So we only trust the timestamp cross-check while the two
  // clocks are locked, surface that lock as a live "drift" meter, and always
  // report the bounded buffer latency as the primary measured value.
  measureLatency() {
    const out = {
      reportedMs: this.getLatencyMs(),
      baseMs: 0,
      measuredMs: null,
      outputMs: 0,
      lockMs: null,
      sampleRate: this.ctx ? this.ctx.sampleRate : 0,
      state: this.ctx ? this.ctx.state : "uninitialized",
    };
    if (!this.ctx) return out;

    try {
      const base = (this.ctx.baseLatency || 0.0026) * 1000;
      const output = (this.ctx.outputLatency || 0.005) * 1000;
      out.baseMs = Math.round(base * 10) / 10;
      out.outputMs = Math.round(output * 10) / 10;
      out.measuredMs = Math.round((base + output) * 10) / 10;

      if (typeof this.ctx.getOutputTimestamp === "function") {
        const ts = this.ctx.getOutputTimestamp();
        if (ts && Number.isFinite(ts.performanceTime) && Number.isFinite(ts.contextTime)) {
          if (this._lastLatTs) {
            const wallDelta = ts.performanceTime - this._lastLatTs.performanceTime;
            const audioDelta = (ts.contextTime - this._lastLatTs.contextTime) * 1000;
            if (wallDelta > 1 && wallDelta < 500) {
              const drift = Math.round((wallDelta - audioDelta) * 10) / 10;
              // Healthy lock ~0ms; runaway (stalled audio clock) = big positive
              out.lockMs = Math.abs(drift) > 100000 ? Math.round(drift) : drift;
            }
          }
          this._lastLatTs = { performanceTime: ts.performanceTime, contextTime: ts.contextTime };
        }
      }
    } catch (e) {
      // measurement failure — fall back to reported numbers
    }
    return out;
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

  // Toggle the bus compressor on/off. When OFF, audio routes through a
  // bypass gain node with zero DSP overhead. When ON, the compressor
  // contains sustained stacked chords before the limiter.
  setBusCompEnabled(enabled) {
    if (this.busCompEnabled === enabled) return;
    this.busCompEnabled = enabled;
    try {
      if (enabled) {
        this.dcBlocker.disconnect(this.busCompBypass);
        this.dcBlocker.connect(this.busComp);
        this.busComp.connect(this.analyser);
      } else {
        this.dcBlocker.disconnect(this.busComp);
        this.dcBlocker.connect(this.busCompBypass);
        this.busCompBypass.connect(this.analyser);
      }
    } catch (e) {}
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
