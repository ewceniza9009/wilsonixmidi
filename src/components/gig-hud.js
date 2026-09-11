/**
 * WILSONIX MIDIKEY Elite - Live Gig HUD & Stage Performance Dashboard
 * Floating lightweight latency analysis popover (anchored, non-blocking),
 * GIG mode, sound & layer selectors, Rig snapshots, WAV recorder, and workspace tabs.
 */

import { synthEngine, INSTRUMENT_PATCHES } from "../audio/synth-engine.js";
import { multiLayerEngine, HD_SOUNDBANKS } from "../audio/multi-layer-engine.js";
import { audioCore } from "../audio/audio-core.js";
import { midiManager } from "../midi/midi-manager.js";
import { licenseManager } from "../security/license-manager.js";
import { masterRecorder } from "../audio/master-recorder.js";
import { registrationManager } from "./registration-manager.js";

export class GigHudUI {
  constructor(containerId, onOpenLicenseModal) {
    this.container = document.getElementById(containerId);
    this.onOpenLicenseModal = onOpenLicenseModal;
    this.bpm = 120;
    this.lastTapTimes = [];
    this._latencySmoothed = null;
    this.gigMode = localStorage.getItem("midikey_gig_mode") === "1";
    this.sunlightMode = localStorage.getItem("wilsonix_sunlight_mode") === "1";
    this._vuRunning = false;
    this.vuAnimationId = null;

    if (this.sunlightMode) {
      document.body.classList.add("stage-sunlight-mode");
    }

    this.render();
    this.bindPillInteractions();
    this.bindRecorder();
    this.bindRegistration();

    if (!this.gigMode) {
      this.startVuMonitor();
    }
  }

  refresh() {
    this.render();
    this.bindPillInteractions();
    this.bindRecorder();
    this.bindRegistration();
    this._vuRunning = false;
    if (this.vuAnimationId) cancelAnimationFrame(this.vuAnimationId);
    if (!this.gigMode) {
      this.startVuMonitor();
    }
  }

  render() {
    if (!this.container) return;

    const access = licenseManager.getAccessStatus();
    const patchList = Object.values(INSTRUMENT_PATCHES);
    const soundbanksList = Object.values(HD_SOUNDBANKS);

    const isLayerActive = multiLayerEngine.isCombiMode && (multiLayerEngine.layers[1]?.enabled ?? true);
    const activeLayerBank = multiLayerEngine.layers[1]?.inst || "string_ensemble_1";

    const curBank = registrationManager.currentBank || "A";
    const curSlot = registrationManager.currentSlot || 1;

    this.container.innerHTML = `
      <header class="gig-hud-bar">
        <!-- 1. LEFT: Brand & Sound + Layer Controls -->
        <div class="hud-section hud-left-group">
          <div class="brand-logo">
            <span class="logo-accent">WILSONIX</span> MIDIKEY
          </div>
          <button class="license-badge-btn ${access.badgeClass}" id="hud-license-btn" title="License & Access Info">
            ${access.badgeText}
          </button>

          <!-- Primary Sound Picker -->
          <div class="hud-sound-box">
            <button class="preset-arrow-btn" id="hud-prev-preset" title="Previous Sound">◀</button>
            <div class="sound-select-wrapper">
              <span class="sound-cat-icon">🎹</span>
              <select class="hud-sound-select" id="hud-sound-select" title="Switch Instrument Sound">
                ${patchList
                  .map(
                    p => `
                  <option value="${p.id}" ${synthEngine.activePatch?.id === p.id ? "selected" : ""}>
                    ${p.name}
                  </option>
                `
                  )
                  .join("")}
              </select>
            </div>
            <button class="preset-arrow-btn" id="hud-next-preset" title="Next Sound">▶</button>
          </div>

          <!-- Permanent Layer Sound Control Group -->
          <div class="hud-layer-box">
            <button class="layer-toggle-btn ${isLayerActive ? "active" : ""}" id="btn-toggle-layer" title="Toggle 2nd Sound Layer">
              ${isLayerActive ? "LAYER ON" : "LAYER"}
            </button>
            <select class="hud-layer-select ${isLayerActive ? "active" : ""}" id="hud-layer-select" title="Choose 2nd Layer Instrument">
              ${soundbanksList
                .map(
                  b => `
                <option value="${b.id}" ${activeLayerBank === b.id ? "selected" : ""}>
                  + ${b.name}
                </option>
              `
                )
                .join("")}
            </select>
          </div>
        </div>

        <!-- 2. CENTER: Live Rig Presets & Transport -->
        <div class="hud-section hud-center-group">
          <!-- Stage Registration Rig Quick Bar -->
          <div class="hud-rig-widget" title="Live Rig Snapshot (Keys 1-8 to recall, Shift+1-8 to save)">
            <span class="rig-label">RIG:</span>
            <div class="rig-bank-pills">
              <button class="rig-bank-pill ${curBank === "A" ? "active" : ""}" data-bank="A">A</button>
              <button class="rig-bank-pill ${curBank === "B" ? "active" : ""}" data-bank="B">B</button>
              <button class="rig-bank-pill ${curBank === "C" ? "active" : ""}" data-bank="C">C</button>
              <button class="rig-bank-pill ${curBank === "D" ? "active" : ""}" data-bank="D">D</button>
            </div>
            <div class="rig-slot-pills">
              ${[1, 2, 3, 4, 5, 6, 7, 8]
                .map(
                  num => `
                <button class="rig-slot-pill ${curSlot === num ? "active" : ""}" data-slot="${num}" title="Rig ${curBank}-${num} (Key ${num})">${num}</button>
              `
                )
                .join("")}
            </div>
          </div>

          <!-- Master WAV Recorder -->
          <button class="hud-rec-btn" id="hud-master-rec-btn" title="Record Master Bus to Lossless WAV">
            <span class="rec-dot"></span>
            <span class="rec-label" id="hud-rec-label">REC</span>
          </button>

          <!-- Tempo -->
          <div class="tempo-control-box">
            <button class="tempo-tap-btn" id="btn-tap-tempo">TAP</button>
            <span class="bpm-counter" id="bpm-val">${this.bpm}</span>
            <span class="bpm-label">BPM</span>
          </div>
        </div>

        <!-- 3. RIGHT: Master Volume, Status & Workspace Tabs -->
        <div class="hud-section hud-right-group">
          <!-- Master Volume -->
          <div class="hud-volume-unit" data-midi-param="master_vol" title="Master Volume (Right-click to MIDI Learn)">
            <span class="hud-vol-icon">🔊</span>
            <input type="range" id="hud-master-vol" min="0" max="100" value="50" class="hud-vol-slider" />
            <span class="hud-vol-readout" id="hud-master-vol-val">50%</span>
          </div>

          <!-- Compact Status Pills -->
          <div class="hud-status-cluster">
            <!-- GIG Mode Pill -->
            <button class="gig-mode-btn ${this.gigMode ? "active" : ""}" id="hud-gig-btn" title="GIG MODE: Disables background UI meters to eliminate audio jitter during live stage gigs">
              GIG
            </button>

            <!-- Floating Anchored Latency Pill (Click for analysis popover) -->
            <div class="latency-hud-pill interactive" id="hud-latency-pill" title="Click for round-trip latency analysis">
              <span class="latency-dot"></span>
              <span id="hud-latency-val">--</span>
            </div>

            <!-- MIDI Status Pill -->
            <div class="midi-status-pill" id="hud-midi-pill" title="Hardware MIDI Status">
              <span class="midi-indicator"></span>
              <span>MIDI</span>
            </div>

            <!-- Sunlight / Dark Mode -->
            <button class="sunlight-mode-btn ${this.sunlightMode ? "active" : ""}" id="hud-sunlight-btn" title="Toggle Stage Sunlight Contrast">
              ${this.sunlightMode ? "☀️" : "🌙"}
            </button>
          </div>

          <!-- Workspace Tabs -->
          <nav class="ws-tabs-bar" id="hud-workspace-tabs">
            <button class="ws-tab-btn active" data-view="triton" title="Main Workstation Console">MAIN</button>
            <button class="ws-tab-btn" data-view="combi" title="4-Timbre Combi Mixer">COMBI</button>
            <button class="ws-tab-btn" data-view="split" title="Split Keyboard Console">SPLIT</button>
            <button class="ws-tab-btn" data-view="fx" title="Master FX Rack">FX</button>
            <button class="ws-tab-btn" data-view="chords" title="Chord Harmony Pads">CHORDS</button>
            <button class="ws-tab-btn" data-view="grooves" title="Backing Grooves">GROOVES</button>
            <button class="ws-tab-btn" data-view="player" title="Media Player">PLAYER</button>
            <button class="ws-tab-btn fullscreen-btn" id="btn-toggle-fullscreen" title="Toggle Fullscreen">⛶</button>
          </nav>
        </div>
      </header>
    `;
  }

  bindRecorder() {
    const recBtn = document.getElementById("hud-master-rec-btn");
    const recLabel = document.getElementById("hud-rec-label");

    recBtn?.addEventListener("click", () => {
      if (!masterRecorder.isRecording) {
        masterRecorder.start();
        recBtn.classList.add("recording");
      } else {
        masterRecorder.stopAndExport();
        recBtn.classList.remove("recording");
        if (recLabel) recLabel.innerText = "REC";
      }
    });

    masterRecorder.onStateChange = state => {
      if (state.isRecording) {
        if (recLabel) recLabel.innerText = state.formattedTime;
      } else {
        if (recLabel) recLabel.innerText = "REC";
      }
    };
  }

  bindRegistration() {
    const bankBtns = this.container.querySelectorAll(".rig-bank-pill");
    const slotBtns = this.container.querySelectorAll(".rig-slot-pill");

    bankBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        bankBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const bank = btn.getAttribute("data-bank");
        registrationManager.currentBank = bank;
        registrationManager.recallSlot(bank, registrationManager.currentSlot);
      });
    });

    slotBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        slotBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const slot = parseInt(btn.getAttribute("data-slot"));
        registrationManager.recallSlot(registrationManager.currentBank, slot);
      });
    });

    registrationManager.onRecallCallback = ({ bank, slot }) => {
      bankBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-bank") === bank));
      slotBtns.forEach(b => b.classList.toggle("active", parseInt(b.getAttribute("data-slot")) === slot));
      const soundSelect = document.getElementById("hud-sound-select");
      if (soundSelect && synthEngine.activePatch) {
        soundSelect.value = synthEngine.activePatch.id;
      }
    };
  }

  bindPillInteractions() {
    // 1. License modal
    document.getElementById("hud-license-btn")?.addEventListener("click", () => {
      if (this.onOpenLicenseModal) this.onOpenLicenseModal();
    });

    // 2. Main Sound Picker
    const soundSelect = document.getElementById("hud-sound-select");
    soundSelect?.addEventListener("change", e => {
      const pid = e.target.value;
      synthEngine.setPatch(pid);
      if (multiLayerEngine.layers[0]) {
        multiLayerEngine.layers[0].inst = pid;
      }
    });

    document.getElementById("hud-prev-preset")?.addEventListener("click", () => {
      if (soundSelect && soundSelect.selectedIndex > 0) {
        soundSelect.selectedIndex--;
        soundSelect.dispatchEvent(new Event("change"));
      }
    });

    document.getElementById("hud-next-preset")?.addEventListener("click", () => {
      if (soundSelect && soundSelect.selectedIndex < soundSelect.options.length - 1) {
        soundSelect.selectedIndex++;
        soundSelect.dispatchEvent(new Event("change"));
      }
    });

    // 3. Layer Toggle & Sound Selection
    const layerBtn = document.getElementById("btn-toggle-layer");
    const layerSelect = document.getElementById("hud-layer-select");

    layerBtn?.addEventListener("click", () => {
      const isCurrentlyActive = multiLayerEngine.isCombiMode && (multiLayerEngine.layers[1]?.enabled ?? true);
      const nextActive = !isCurrentlyActive;

      multiLayerEngine.toggleCombiMode(nextActive);
      if (multiLayerEngine.layers[1]) {
        multiLayerEngine.layers[1].enabled = nextActive;
      }

      layerBtn.classList.toggle("active", nextActive);
      layerBtn.innerText = nextActive ? "LAYER ON" : "LAYER";
      if (layerSelect) {
        layerSelect.classList.toggle("active", nextActive);
      }
    });

    layerSelect?.addEventListener("change", e => {
      const bankId = e.target.value;
      if (multiLayerEngine.layers[1]) {
        multiLayerEngine.layers[1].inst = bankId;
        multiLayerEngine.layers[1].enabled = true;
      }
      multiLayerEngine.toggleCombiMode(true);
      if (layerBtn) {
        layerBtn.classList.add("active");
        layerBtn.innerText = "LAYER ON";
      }
      layerSelect.classList.add("active");
    });

    // 4. GIG Mode Toggle
    const gigBtn = document.getElementById("hud-gig-btn");
    gigBtn?.addEventListener("click", () => {
      this.gigMode = !this.gigMode;
      localStorage.setItem("midikey_gig_mode", this.gigMode ? "1" : "0");
      gigBtn.classList.toggle("active", this.gigMode);
      if (this.gigMode) {
        this._vuRunning = false;
        if (this.vuAnimationId) cancelAnimationFrame(this.vuAnimationId);
      } else {
        this.startVuMonitor();
      }
    });

    // 5. Floating Anchored Latency Popover (Old Non-Blocking Implementation)
    const latencyVal = document.getElementById("hud-latency-val");
    const latencyPill = document.getElementById("hud-latency-pill");

    const paintLatency = l => {
      const shown = l.measuredMs || l.reportedMs;
      if (!shown || !latencyVal) return;
      this._latencySmoothed = this._latencySmoothed === null ? shown : this._latencySmoothed * 0.6 + shown * 0.4;
      latencyVal.innerText = `${this._latencySmoothed.toFixed(1)}ms`;
      latencyPill?.classList.toggle("latency-warm", this._latencySmoothed > 20);
      latencyPill?.classList.toggle("latency-hot", this._latencySmoothed > 50);
    };

    latencyPill?.addEventListener("click", e => {
      e.stopPropagation();
      const l = audioCore.measureLatency();
      this._renderLatencyPopover(l, this._latencySmoothed);
      paintLatency(l);
    });

    window.addEventListener("click", () => this._closeLatencyPopover());

    // 6. Tap Tempo
    document.getElementById("btn-tap-tempo")?.addEventListener("click", () => {
      const now = performance.now();
      this.lastTapTimes.push(now);
      if (this.lastTapTimes.length > 4) this.lastTapTimes.shift();

      if (this.lastTapTimes.length >= 2) {
        let sum = 0;
        for (let i = 1; i < this.lastTapTimes.length; i++) {
          sum += this.lastTapTimes[i] - this.lastTapTimes[i - 1];
        }
        const avgDelta = sum / (this.lastTapTimes.length - 1);
        if (avgDelta > 200 && avgDelta < 2000) {
          this.bpm = Math.round(60000 / avgDelta);
          const bpmVal = document.getElementById("bpm-val");
          if (bpmVal) bpmVal.innerText = this.bpm;
        }
      }
    });

    // 7. Sunlight Mode Toggle
    const sunBtn = document.getElementById("hud-sunlight-btn");
    sunBtn?.addEventListener("click", () => {
      this.sunlightMode = !this.sunlightMode;
      document.body.classList.toggle("stage-sunlight-mode", this.sunlightMode);
      localStorage.setItem("wilsonix_sunlight_mode", this.sunlightMode ? "1" : "0");
      if (sunBtn) {
        sunBtn.innerText = this.sunlightMode ? "☀️" : "🌙";
        sunBtn.classList.toggle("active", this.sunlightMode);
      }
    });

    // 8. Master Volume Slider
    const volSlider = document.getElementById("hud-master-vol");
    const volReadout = document.getElementById("hud-master-vol-val");
    volSlider?.addEventListener("input", e => {
      const val = parseInt(e.target.value);
      multiLayerEngine.setMasterVolumePct(val);
      if (volReadout) volReadout.innerText = `${val}%`;
    });
  }

  startVuMonitor() {
    if (this._vuRunning) return;
    this._vuRunning = true;

    const latencyVal = document.getElementById("hud-latency-val");
    const latencyPill = document.getElementById("hud-latency-pill");

    let lastMeasure = 0;
    const updateFrame = () => {
      if (!this._vuRunning) return;

      const now = performance.now();
      if (now - lastMeasure > 100) {
        lastMeasure = now;
        const l = audioCore.measureLatency();
        const shown = l.measuredMs || l.reportedMs;
        if (shown) {
          this._latencySmoothed = this._latencySmoothed === null ? shown : this._latencySmoothed * 0.6 + shown * 0.4;
          if (latencyVal) {
            latencyVal.innerText = `${this._latencySmoothed.toFixed(1)}ms`;
            latencyPill?.classList.toggle("latency-warm", this._latencySmoothed > 20);
            latencyPill?.classList.toggle("latency-hot", this._latencySmoothed > 50);
          }
        }
      }

      this.vuAnimationId = requestAnimationFrame(updateFrame);
    };

    updateFrame();
  }

  _renderLatencyPopover(l, smoothed) {
    this._closeLatencyPopover();

    const pill = document.getElementById("hud-latency-pill");
    if (!pill) return;
    const rect = pill.getBoundingClientRect();

    const pop = document.createElement("div");
    pop.className = "latency-popover";
    pop.id = "hud-latency-popover";

    const shown = l.measuredMs || l.reportedMs;
    const primary = smoothed !== null ? `${smoothed.toFixed(1)}ms` : `${(shown ?? 0).toFixed(1)}ms`;
    const bufferMs = l.baseMs;
    const bufferSamples = l.sampleRate ? Math.round((bufferMs / 1000) * l.sampleRate) : 0;
    const stalled = l.lockMs !== null && Math.abs(l.lockMs) > 50;

    const rows = [
      ["BUFFER PROFILE", l.profileLabel || "Balanced Studio"],
      ["ROUND-TRIP (Buffer+Output)", `${(l.measuredMs ?? 7.6).toFixed(1)} ms`],
      ["SMOOTHED (10Hz avg)", primary],
      ["Base buffer (input side)", `${(l.baseMs ?? 2.6).toFixed(1)} ms (${bufferSamples} samples @ ${((l.sampleRate || 48000) / 1000).toFixed(1)} kHz)`],
      ["Audio clock lock (drift)", l.lockMs === null ? "—" : `${l.lockMs.toFixed(1)} ms`],
      ["Engine state", l.state || "running"],
    ]
      .map(
        ([k, v]) => `
      <div class="latency-pop-row">
        <span class="latency-pop-key">${k}</span>
        <span class="latency-pop-val">${v}</span>
      </div>`
      )
      .join("");

    const currentProf = l.profile || "balanced";

    pop.innerHTML = `
      <div class="latency-pop-head">
        <span>ROUND-TRIP LATENCY & BUFFER CONTROL</span>
        <button class="latency-pop-close" id="hud-latency-close">✕</button>
      </div>
      <div class="latency-profile-section">
        <div class="latency-profile-title">BUFFER / LATENCY PROFILE</div>
        <div class="latency-profile-pills">
          <button class="latency-prof-btn ${currentProf === 'ultra-low' ? 'active' : ''}" data-profile="ultra-low" title="64–128 frames / Fastest response for dedicated audio interfaces">
            <span class="prof-title">STAGE ULTRA-LOW</span>
            <span class="prof-sub">~2.9ms</span>
          </button>
          <button class="latency-prof-btn ${currentProf === 'balanced' ? 'active' : ''}" data-profile="balanced" title="256 frames / Stable performance for general laptop audio">
            <span class="prof-title">BALANCED STUDIO</span>
            <span class="prof-sub">~5.8ms</span>
          </button>
          <button class="latency-prof-btn ${currentProf === 'safe' ? 'active' : ''}" data-profile="safe" title="512 frames / Maximum glitch-free headroom for heavy polyphony">
            <span class="prof-title">SAFE STAGE</span>
            <span class="prof-sub">~11.6ms</span>
          </button>
        </div>
      </div>
      <div class="latency-pop-body">${rows}</div>
      <div class="latency-pop-tip">
        <span>${
          stalled
            ? "⚠️ Audio clock is stalled — play a note to re-lock it."
            : "🔹 Real latency = base buffer + OS output buffer. Bluetooth output adds 100–200ms on top — use wired listening."
        }</span>
      </div>
    `;

    pop.style.position = "fixed";
    pop.style.top = `${rect.bottom + 6}px`;
    pop.style.left = `${Math.max(8, rect.left - 120)}px`;
    pop.style.zIndex = "10000";

    pop.addEventListener("click", e => e.stopPropagation());

    document.body.appendChild(pop);

    pop.querySelectorAll(".latency-prof-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const prof = btn.getAttribute("data-profile");
        if (prof) {
          audioCore.setLatencyProfile(prof);
          const newL = audioCore.measureLatency();
          this._renderLatencyPopover(newL, this._latencySmoothed);
        }
      });
    });

    pop.querySelector("#hud-latency-close")?.addEventListener("click", e => {
      e.stopPropagation();
      this._closeLatencyPopover();
    });
  }

  _closeLatencyPopover() {
    const pop = document.getElementById("hud-latency-popover");
    if (pop) pop.remove();
  }
}
