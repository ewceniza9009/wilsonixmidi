/**
 * Audio Core Manager
 * Manages low-latency AudioContext, keep-alive hardware stream, latency metrics, and master bus.
 */

import { FxRackManager } from "./fx-rack-manager.js";
import { SpatialEngine } from "./spatial-engine.js";

export const LATENCY_PROFILES = {
  "ultra-low": { id: "ultra-low", latencyHint: "interactive", label: "Stage Ultra-Low", targetMs: 2.9, frames: 128, description: "64–128 frames / Fastest response for dedicated audio interfaces" },
  "balanced": { id: "balanced", latencyHint: "balanced", label: "Balanced Studio", targetMs: 5.8, frames: 256, description: "256 frames / Stable performance for general laptop audio" },
  "safe": { id: "safe", latencyHint: "playback", label: "Safe Stage", targetMs: 11.6, frames: 512, description: "512 frames / Maximum glitch-free headroom for heavy polyphony" },
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
    this.hardwareLimiter.threshold.value = -1.0;  // True brickwall safety ceiling
    this.hardwareLimiter.knee.value = 12.0;       // Smooth soft-knee transition (eliminates hard corner chatter/buzzing)
    this.hardwareLimiter.ratio.value = 4.0;       // Controlled peak clamp (smooth & musical, no pumping)
    this.hardwareLimiter.attack.value = 0.003;    // 3ms - fast transparent peak catching without pumping
    this.hardwareLimiter.release.value = 0.060;   // 60ms smooth instant recovery (no laggy ducking)

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

    // Dynamic Master Kaoss Filter (Lowpass filter modulated in real time by X/Y Pad)
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = "lowpass";
    this.masterFilter.frequency.value = 18000;
    this.masterFilter.Q.value = 1.0;

    // Master bus pipeline: FX Rack -> Master Filter -> Master Gain -> BusPad(trim) -> DC Blocker -> Analyser -> HardwareLimiter -> Destination
    this.fxRack.output.connect(this.masterFilter);
    this.masterFilter.connect(this.masterGain);
    this.masterGain.connect(this.busPad);
    this.busPad.connect(this.dcBlocker);
    this.dcBlocker.connect(this.analyser);
    this.analyser.connect(this.hardwareLimiter);
    // Binaural spatial engine: inserted between limiter and destination.
    // OFF by default — when disabled, dry signal passes through unchanged.
    this.spatialEngine = null; // Lazy init — created on first use to avoid blocking init()
    this._connectSpatial();

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

  // Watchdog: browsers suspend/interrupt audio on tab switch/bluetooth changes and it
  // never comes back on its own (total silence that feels like a crash)
  ensureRunning() {
    try {
      if (!this.ctx) {
        this.init();
        return;
      }
      if (this.ctx.state === "suspended" || this.ctx.state === "interrupted") {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {}
  }

  recoverAudioGraph() {
    try {
      if (!this.ctx) {
        this.init();
        return;
      }
      const now = this.ctx.currentTime;
      if (this.ctx.state === "suspended" || this.ctx.state === "interrupted") {
        this.ctx.resume().catch(() => {});
      }
      // Reset filter states & cancel scheduled ramps that could be stuck in NaN
      if (this.masterFilter) {
        this.masterFilter.frequency.cancelScheduledValues(now);
        this.masterFilter.frequency.setValueAtTime(18000, now);
        this.masterFilter.Q.setValueAtTime(1.0, now);
      }
      if (this.dcBlocker) {
        this.dcBlocker.frequency.cancelScheduledValues(now);
        this.dcBlocker.frequency.setValueAtTime(20, now);
      }
      if (this.hardwareLimiter) {
        // Reset compressor gain reduction if wedged
        this.hardwareLimiter.threshold.setValueAtTime(-1.0, now);
      }
      if (this.fxRack?.talkbox) {
        // Force-bypass and tear down any active wet-path nodes to guarantee
        // fresh IIR state. The nuclear rebuild on next engage will fix everything.
        this.fxRack.talkbox.setBypass(true);
        if (this.fxRack.talkbox._wetNodes) {
          this.fxRack.talkbox._teardownWetPath();
        }
      }
    } catch (e) {}
  }

  updateLatencyMetrics() {
    if (!this.ctx) return;
    const base = (this.ctx.baseLatency || 0.0026) * 1000;
    const output = (this.ctx.outputLatency || 0.005) * 1000;
    this.reportedLatencyMs = Math.round((base + output) * 10) / 10;
  }

  setLatencyProfile(profileId) {
    if (!LATENCY_PROFILES[profileId]) return false;
    this.currentLatencyProfile = profileId;
    const prevSpatialEnv = this.spatialEngine?.currentEnv || "off";
    try {
      localStorage.setItem("midikey_latency_profile", profileId);
    } catch (e) {}

    if (this.ctx) {
      const oldMasterGain = this.masterGain ? this.masterGain.gain.value : 1.0;
      try {
        this.ctx.close();
      } catch (e) {}
      this.ctx = null;
      this.spatialEngine = null;
      this.init();
      if (this.masterGain) this.masterGain.gain.value = oldMasterGain;
      this.unlock();
    }

    // Restore spatial environment after context recreation
    if (prevSpatialEnv !== "off") {
      this.setSpatialEnvironment(prevSpatialEnv);
    }

    this.profileListeners.forEach(cb => {
      try { cb(this.currentLatencyProfile); } catch (e) {}
    });
    return true;
  }

  onLatencyProfileChange(cb) {
    if (typeof cb === "function") this.profileListeners.push(cb);
  }

  async enumerateOutputDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === "audiooutput");
    } catch (e) {
      return [];
    }
  }

  async setSinkId(deviceId) {
    if (!this.ctx?.setSinkId) return false;
    try {
      await this.ctx.setSinkId(deviceId || "");
      return true;
    } catch (e) {
      return false;
    }
  }

  get currentSinkId() {
    return this.ctx?.sinkId || "";
  }

  // --- Binaural Stage Monitor: HRTF spatial audio for headphones ---

  _connectSpatial() {
    if (!this.ctx) return;
    // Disconnect old direct connection
    try { this.hardwareLimiter.disconnect(this.ctx.destination); } catch (e) {}

    // Lazy-init spatial engine on first call
    if (!this.spatialEngine) {
      this.spatialEngine = new SpatialEngine(this.ctx, this.hardwareLimiter, this.ctx.destination);
      this.spatialEngine.connect();
    }
  }

  async setSpatialEnvironment(envId) {
    if (!this.ctx) return false;
    if (!this.spatialEngine) this._connectSpatial();
    await this.spatialEngine.setEnvironment(envId);
    return true;
  }

  getSpatialEnvironments() {
    if (!this.spatialEngine) return [];
    return this.spatialEngine.getEnvironments();
  }

  getCurrentSpatialEnv() {
    if (!this.spatialEngine) return "off";
    return this.spatialEngine.currentEnv;
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
    const currentProfile = LATENCY_PROFILES[this.currentLatencyProfile] || LATENCY_PROFILES["balanced"];
    const out = {
      reportedMs: this.getLatencyMs(),
      baseMs: 0,
      measuredMs: null,
      outputMs: 0,
      lockMs: null,
      sampleRate: this.ctx ? this.ctx.sampleRate : 0,
      state: this.ctx ? this.ctx.state : "uninitialized",
      profile: currentProfile.id,
      profileLabel: currentProfile.label,
      profileFrames: currentProfile.frames || 0,
      measuredFrames: 0,
      recommendedProfile: null,
    };
    if (!this.ctx) return out;

    try {
      const base = (this.ctx.baseLatency || 0.0026) * 1000;
      const output = (this.ctx.outputLatency || 0.005) * 1000;
      out.baseMs = Math.round(base * 10) / 10;
      out.outputMs = Math.round(output * 10) / 10;
      out.measuredMs = Math.round((base + output) * 10) / 10;

      // Measured base buffer in frames — the real negotiated render quantum.
      if (out.sampleRate > 0 && out.baseMs > 0) {
        out.measuredFrames = Math.max(0, Math.round((out.baseMs / 1000) * out.sampleRate));
      }

      // Recommend the profile whose claimed buffer frames are closest to the
      // ACTUAL negotiated buffer. This is the "truth" the old popover hid:
      // the selected profile's label says nothing about what the OS gave us.
      if (out.measuredFrames > 0) {
        let bestId = null;
        let bestDiff = Infinity;
        for (const pid of Object.keys(LATENCY_PROFILES)) {
          const p = LATENCY_PROFILES[pid];
          const diff = Math.abs((p.frames || 0) - out.measuredFrames);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestId = pid;
          }
        }
        if (bestId) {
          out.recommendedProfile = {
            id: bestId,
            label: LATENCY_PROFILES[bestId].label,
            isActive: bestId === currentProfile.id,
          };
        }
      }

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

  setMasterFilter(cutoffHz, resonance = 1.0) {
    if (!this.masterFilter || !this.ctx) return;
    const now = this.ctx.currentTime;
    const clampedCutoff = Math.max(150, Math.min(20000, cutoffHz));
    const clampedQ = Math.max(0.1, Math.min(10.0, resonance));
    this.masterFilter.frequency.setTargetAtTime(clampedCutoff, now, 0.015);
    this.masterFilter.Q.setTargetAtTime(clampedQ, now, 0.015);
  }

  setSpaceSend(amount) {
    if (!this.fxRack) return;
    const norm = Math.max(0, Math.min(1, amount));
    if (this.fxRack.reverb && typeof this.fxRack.reverb.setMix === "function") {
      this.fxRack.reverb.setMix(norm * 0.85);
    }
    if (this.fxRack.shimmerReverb && typeof this.fxRack.shimmerReverb.setMix === "function") {
      this.fxRack.shimmerReverb.setMix(norm * 0.70);
    }
    if (this.fxRack.delay && typeof this.fxRack.delay.setMix === "function") {
      this.fxRack.delay.setMix(norm * 0.45);
    }
  }
}

export const audioCore = new AudioCore();
