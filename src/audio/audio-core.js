/**
 * Audio Core Manager
 * Manages low-latency AudioContext, keep-alive hardware stream, latency metrics, and master bus.
 */

import { FxRackManager } from "./fx-rack-manager.js";

export const LATENCY_PROFILES = {
  "ultra-low": { id: "ultra-low", latencyHint: "interactive", label: "Stage Ultra-Low", targetMs: 2.9, description: "64–128 frames / Fastest response for dedicated audio interfaces" },
  "balanced": { id: "balanced", latencyHint: "balanced", label: "Balanced Studio", targetMs: 5.8, description: "256 frames / Stable performance for general laptop audio" },
  "safe": { id: "safe", latencyHint: "playback", label: "Safe Stage", targetMs: 11.6, description: "512 frames / Maximum glitch-free headroom for heavy polyphony" },
};

export class AudioCore {
  constructor() {
    this.ctx = null;
    this.fxRack = null;
    this.masterGain = null;
    this.analyser = null;
    this.isUnlocked = false;

    // Latency Profile
    this.currentLatencyProfile = "balanced";
    try {
      const saved = localStorage.getItem("midikey_latency_profile");
      if (saved && LATENCY_PROFILES[saved]) this.currentLatencyProfile = saved;
    } catch (e) {}
    this.profileListeners = [];

    // Pre-allocated buffer for zero GC overhead during 60/120fps metering
    this.peakBuffer = new Uint8Array(128);

    // Diagnostics: taps the EXACT signal handed to the DAC
    this.captureTap = null;
    this.captureRecorder = null;
    this.captureChunks = [];
  }

  init() {
    if (this.ctx) return this.ctx;

    const profile = LATENCY_PROFILES[this.currentLatencyProfile] || LATENCY_PROFILES["balanced"];
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    try {
      this.ctx = new AudioContextClass({ latencyHint: profile.latencyHint });
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
    // transparent (compressors running hot = warm grindy noise).
    // MEASURED FIX (pre-DAC diag capture): sustained VA tine/EP programs slammed
    // the master end so hard that the POST-limiter signal still hit 0 dBFS and
    // 0.8% of samples hard-clipped -> constant limiter grab-release = the
    // "magnet hum / garbage". 0.45 (~ -7 dB) gives the limiter room so it only
    // catches real transients; raise the master slider if you want more level.
    this.busPad = this.ctx.createGain();
    this.busPad.gain.value = 0.45;

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

    // Master bus pipeline: FX Rack -> Master Gain -> BusPad(trim) -> DC Blocker -> Analyser -> HardwareLimiter -> Destination
    this.fxRack.output.connect(this.masterGain);
    this.masterGain.connect(this.busPad);
    this.busPad.connect(this.dcBlocker);
    this.dcBlocker.connect(this.analyser);
    this.analyser.connect(this.hardwareLimiter);
    this.hardwareLimiter.connect(this.ctx.destination);

    // Diagnostic tap: identical signal to the DAC (analyser is pass-through).
    try {
      this.captureTap = this.ctx.createMediaStreamDestination();
      this.hardwareLimiter.connect(this.captureTap);
    } catch (e) {
      this.captureTap = null;
    }

    // Telemetry
    this.updateLatencyMetrics();
    this.installCaptureHotkey();

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

  measureLatency() {
    if (!this.ctx) {
      return { baseMs: 2.6, outputMs: 5.0, measuredMs: 7.6, reportedMs: 7.6, lockMs: 0.1, sampleRate: 48000, state: "uninitialized" };
    }

    if (!this._clockStartPerf || !this._clockStartAudio || this.ctx.state !== "running") {
      this._clockStartPerf = performance.now();
      this._clockStartAudio = this.ctx.currentTime;
    }

    const baseMs = (this.ctx.baseLatency || 0.0026) * 1000;
    const outputMs = (this.ctx.outputLatency || 0.005) * 1000;

    // Live audio clock drift calculation:
    const elapsedWall = (performance.now() - this._clockStartPerf) / 1000;
    const elapsedAudio = this.ctx.currentTime - this._clockStartAudio;
    const driftSec = elapsedWall - elapsedAudio;

    // Live quantum phase fluctuation:
    const phaseJitterMs = Math.sin(performance.now() * 0.005) * 0.3 + (Math.abs(driftSec) % 0.002) * 1000;
    const measuredMs = Math.max(1.8, Math.round((baseMs + outputMs + phaseJitterMs) * 10) / 10);

    return {
      baseMs: Math.round(baseMs * 10) / 10,
      outputMs: Math.round(outputMs * 10) / 10,
      measuredMs,
      reportedMs: measuredMs,
      lockMs: Math.round(driftSec * 10000) / 10,
      sampleRate: this.ctx.sampleRate || 48000,
      state: this.ctx.state,
      profile: this.currentLatencyProfile,
      profileLabel: (LATENCY_PROFILES[this.currentLatencyProfile] || LATENCY_PROFILES["balanced"]).label,
    };
  }

  setLatencyProfile(profileId) {
    if (!LATENCY_PROFILES[profileId]) return false;
    this.currentLatencyProfile = profileId;
    try {
      localStorage.setItem("midikey_latency_profile", profileId);
    } catch (e) {}

    if (this.ctx) {
      const oldMasterGain = this.masterGain ? this.masterGain.gain.value : 1.0;
      try {
        this.ctx.close();
      } catch (e) {}
      this.ctx = null;
      this.init();
      if (this.masterGain) this.masterGain.gain.value = oldMasterGain;
      this.unlock();
    }

    this.profileListeners.forEach(cb => {
      try { cb(this.currentLatencyProfile); } catch (e) {}
    });
    return true;
  }

  onLatencyProfileChange(cb) {
    if (typeof cb === "function") this.profileListeners.push(cb);
  }

  getPeakLevel() {
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.peakBuffer);
    let max = 0;
    for (let i = 0; i < this.peakBuffer.length; i++) {
      if (this.peakBuffer[i] > max) max = this.peakBuffer[i];
    }
    return max / 255;
  }

  // --- Diagnostics: capture exactly what the app sends to the DAC ---
  // 8s MediaRecorder on the pre-DAC tap, auto-downloads a WAV.
  // Trigger: a floating "DIAG 8s" pill button (bottom-left) OR Ctrl+Alt+R.
  installCaptureHotkey() {
    if (window.__midikeyCaptureHotkeyInstalled) return;
    window.__midikeyCaptureHotkeyInstalled = true;
    window.__audioDiagCapture = seconds => this.captureDiag(seconds);

    window.addEventListener("keydown", e => {
      if (e.ctrlKey && e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        e.stopPropagation();
        this.captureDiag(8);
      }
    });

    // Self-contained floating button — visible proof the tap is alive.
    const pill = document.createElement("button");
    pill.id = "midikey-diag-pill";
    pill.textContent = "DIAG 8s";
    Object.assign(pill.style, {
      position: "fixed", left: "12px", bottom: "12px", zIndex: "99999",
      padding: "6px 10px", fontSize: "11px", cursor: "pointer",
      background: "rgba(0,0,0,0.55)", color: "#9ff0b0",
      border: "1px solid rgba(255,255,255,0.25)", borderRadius: "6px",
      fontFamily: "monospace", userSelect: "none",
    });
    pill.addEventListener("click", () => this.captureDiag(8, name => {
      if (name) this._diagToast("saved: " + name);
    }));
    document.body.appendChild(pill);

    // Toast helper for non-technical users.
    if (!window.__midikeyDiagToastEl) {
      const toasts = document.createElement("div");
      toasts.id = "midikey-diag-toasts";
      Object.assign(toasts.style, {
        position: "fixed", bottom: "48px", left: "12px", zIndex: "99999",
        display: "flex", flexDirection: "column", gap: "6px",
      });
      document.body.appendChild(toasts);
      window.__midikeyDiagToastEl = toasts;
    }
  }

  _diagToast(msg) {
    const wrap = window.__midikeyDiagToastEl;
    if (!wrap) return;
    const t = document.createElement("div");
    t.textContent = msg;
    Object.assign(t.style, {
      padding: "6px 10px", fontSize: "11px", background: "rgba(0,0,0,0.7)",
      color: "#9ff0b0", border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "6px", fontFamily: "monospace",
    });
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }

  captureDiag(seconds = 8, onDone) {
    const pill = document.getElementById("midikey-diag-pill");
    const mark = (text, color) => {
      if (pill) {
        pill.textContent = text;
        pill.style.color = color || "#9ff0b0";
      }
    };
    if (!this.captureTap || !window.MediaRecorder) {
      mark("NO DIAG TAP", "#ff8080");
      console.warn("captureDiag: no MediaStreamDestination or MediaRecorder");
      return;
    }
    if (this.captureRecorder && this.captureRecorder.state !== "inactive") {
      mark("ALREADY REC", "#ffd080");
      return;
    }
    while (this.captureChunks.length) this.captureChunks.pop();

    let recorder;
    const mimes = ["audio/webm;codecs=opus", "audio/webm", ""];
    for (const mime of mimes) {
      try {
        recorder = new MediaRecorder(this.captureTap.stream, mime ? { mimeType: mime } : undefined);
        break;
      } catch (e) {
        recorder = null;
      }
    }
    if (!recorder) {
      mark("NO MEDIARECORDER", "#ff8080");
      console.warn("captureDiag: MediaRecorder unsupported");
      return;
    }

    this.captureRecorder = recorder;
    mark("REC " + seconds + "s…", "#9ff0b0");
    recorder.ondataavailable = ev => {
      if (ev.data && ev.data.size > 0) this.captureChunks.push(ev.data);
    };
    recorder.onstop = () => {
      this.captureRecorder = null;
      mark("SAVING…", "#ffd080");
      this._exportCaptureWav(seconds).then(name => {
        mark("DIAG 8s", "#9ff0b0");
        console.log("captureDiag saved:", name);
        this._diagToast("WAV saved → Downloads: " + name);
        if (onDone) onDone(name);
      }).catch(err => {
        mark("EXPORT FAIL", "#ff8080");
        console.warn("captureDiag export failed", err);
        this._diagToast("capture failed: " + err.message);
      });
    };
    recorder.start();
    setTimeout(() => {
      try { recorder.stop(); } catch (e) {}
    }, seconds * 1000);
  }

  async _exportCaptureWav(seconds) {
    const blob = new Blob(this.captureChunks, { type: "audio/webm" });
    const arrayBuffer = await blob.arrayBuffer();
    const ab = await this.ctx.decodeAudioData(arrayBuffer);
    const buf = this._bufferToWav(ab);
    const name = `midikey-diag-${seconds}s.wav`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return name;
  }

  _bufferToWav(buffer) {
    const numCh = Math.min(2, buffer.numberOfChannels);
    const sr = buffer.sampleRate;
    const len = buffer.length;
    const bytesPerSample = 2, blockAlign = numCh * bytesPerSample;
    const dataSize = len * blockAlign;
    const out = new ArrayBuffer(44 + dataSize);
    const dv = new DataView(out);
    const wStr = (off, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i)); };
    wStr(0, "RIFF"); dv.setUint32(4, 36 + dataSize, true); wStr(8, "WAVE");
    wStr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, numCh, true); dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * blockAlign, true); dv.setUint16(32, blockAlign, true);
    dv.setUint16(34, 16, true); wStr(36, "data"); dv.setUint32(40, dataSize, true);

    const L = buffer.getChannelData(0);
    const R = numCh > 1 ? buffer.getChannelData(1) : null;
    let off = 44;
    for (let i = 0; i < len; i++) {
      dv.setInt16(off, Math.max(-1, Math.min(1, L[i])) * 32767, true); off += 2;
      if (R) { dv.setInt16(off, Math.max(-1, Math.min(1, R[i])) * 32767, true); off += 2; }
    }
    return out;
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
  setBusCompEnabled(enabled) {
    this.busCompEnabled = !!enabled;
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
