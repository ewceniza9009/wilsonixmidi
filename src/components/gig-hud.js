/**
 * Live Gig HUD & Stage Performance Dashboard
 * High-density pro Ableton/Korg DAW header:
 * Streamlined Quick Sound Selector, Dual-Layer & Split controls,
 * Real-time buffer latency meter, stereo VU meter, BPM tap tempo,
 * Workspace View Switchers (Triton, Combi, FX Rack, Chords, Keys).
 */

import { synthEngine, INSTRUMENT_PATCHES } from "../audio/synth-engine.js";
import { multiLayerEngine, HD_SOUNDBANKS, COMBI_PRESETS } from "../audio/multi-layer-engine.js";
import { audioCore } from "../audio/audio-core.js";
import { midiManager } from "../midi/midi-manager.js";
import { licenseManager } from "../security/license-manager.js";

export class GigHudUI {
  constructor(containerId, onOpenLicenseModal) {
    this.container = document.getElementById(containerId);
    this.onOpenLicenseModal = onOpenLicenseModal;
    this.bpm = 120;
    this.lastTapTimes = [];
    this.vuAnimationId = null;
    this._latencySmoothed = null;
    this.gigMode = localStorage.getItem("midikey_gig_mode") === "1";

    this.render();
    this.bindPillInteractions();
    if (this.gigMode) {
      this._vuRunning = false;
    } else {
      this.startVuMonitor();
    }

    // Pause the VU meter rAF loop whenever the HUD is scrolled out of view
    if (typeof IntersectionObserver !== "undefined" && this.container) {
      this._vuObserver = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !this.gigMode) {
          this.startVuMonitor();
        } else {
          this._vuRunning = false;
          if (this.vuAnimationId) cancelAnimationFrame(this.vuAnimationId);
        }
      });
      this._vuObserver.observe(this.container);
    }
  }

  render() {
    if (!this.container) return;

    const isPro = licenseManager.isLicensed();
    const licenseInfo = licenseManager.getLicenseInfo();
    const patchList = Object.values(INSTRUMENT_PATCHES);
    const soundbanksList = Object.values(HD_SOUNDBANKS);

    // True dual layer status from multi-layer engine
    const isLayerActive = multiLayerEngine.isCombiMode && (multiLayerEngine.layers[1]?.enabled ?? true);
    const activeLayerBank = multiLayerEngine.layers[1]?.inst || "string_ensemble_1";

    this.container.innerHTML = `
      <header class="gig-hud-bar">
        <!-- 1. Brand & License Unit -->
        <div class="hud-left-unit">
          <div class="brand-logo">
            <span class="logo-accent">WILSONIX</span> MIDIKEY
          </div>
          <button class="license-badge-btn ${isPro ? "pro" : "demo"}" id="hud-license-btn" title="License Status">
            ${isPro ? "★ PRO" : "⚡ DEMO"}
          </button>
        </div>

        <!-- 2. Fast Preset Switcher -->
        <div class="hud-sound-picker-unit">
          <button class="preset-arrow-btn" id="hud-prev-preset" title="Previous Sound (Left Arrow)">◀</button>
          <div class="sound-select-wrapper">
            <span class="sound-cat-icon">🎹</span>
            <select class="hud-sound-select" id="hud-sound-select" title="Switch Instrument Sound">
              ${patchList
                .map(
                  p => `
                <option value="${p.id}" ${synthEngine.activePatch?.id === p.id ? "selected" : ""}>
                  [${p.category.toUpperCase()}] ${p.name}
                </option>
              `
                )
                .join("")}
            </select>
          </div>
          <button class="preset-arrow-btn" id="hud-next-preset" title="Next Sound (Right Arrow)">▶</button>
        </div>

        <!-- 3. Dual Layer & Split Controls -->
        <div class="hud-modes-unit">
          <div class="layer-control-group">
            <button class="mode-pill-btn ${isLayerActive ? "active" : ""}" id="btn-toggle-layer" title="Toggle 2nd Layer Sound">
              ${isLayerActive ? "LAYER ON" : "LAYER"}
            </button>
            <select class="hud-layer-select" id="hud-layer-select" title="Choose 2nd Layer Sound">
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

        <!-- 4. Performance & Hardware Telemetry -->
        <div class="hud-telemetry-unit">
          <!-- Tempo -->
          <div class="tempo-control-box">
            <button class="tempo-tap-btn" id="btn-tap-tempo">TAP</button>
            <span class="bpm-counter" id="bpm-val">${this.bpm}</span>
            <span class="bpm-label">BPM</span>
          </div>

          <!-- Latency -->
          <div class="latency-hud-pill" id="hud-latency-pill" title="Click for measured round-trip latency analysis">
            <span class="latency-dot"></span>
            <span class="latency-number" id="hud-latency-val">--</span>
          </div>

          <!-- Gig Mode: strip every rAF loop for minimum input-to-output jitter -->
          <button class="gig-mode-btn ${this.gigMode ? "active" : ""}" id="hud-gig-btn" title="GIG MODE: disable all meters/live polling for minimum latency jitter">
            GIG
          </button>

          <!-- MIDI -->
          <div class="midi-status-pill" id="hud-midi-pill" title="Hardware MIDI connection">
            <span class="midi-indicator"></span>
            <span id="hud-midi-text">MIDI</span>
          </div>

          <!-- Master VU Meter -->
          <div class="master-vu-unit" title="Output Level">
            <div class="vu-channel">
              <div class="vu-bar" id="vu-meter-bar"></div>
            </div>
          </div>

          <!-- Master Volume Slider -->
          <div class="hud-volume-unit" title="Master Studio Volume Output">
            <span class="hud-vol-icon">🔊</span>
            <input type="range" id="hud-master-vol" min="0" max="100" value="50" class="hud-vol-slider" />
            <span class="hud-vol-readout" id="hud-master-vol-val">50%</span>
            <button class="hud-vol-icon" id="hud-diag-btn" title="Record 8s of master output for crackle diagnosis" style="cursor:pointer;background:none;border:none;">⏺</button>
          </div>
        </div>

        <!-- 5. Workspace View Switchers (Zero Scrolling - All in Stage Deck) -->
        <div class="hud-views-unit">
          <nav class="ws-tabs-bar" id="hud-workspace-tabs">
            <button class="ws-tab-btn" data-view="all" title="View All Modules Stacked (Workstation + Combi + FX + Chords)">
              <span class="tab-icon">🎛️</span>
              <span class="tab-label">ALL</span>
            </button>
            <button class="ws-tab-btn active" data-view="triton" title="MidiKey Elite Workstation Console">
              <span class="tab-icon">🎹</span>
              <span class="tab-label">MAIN</span>
            </button>
            <button class="ws-tab-btn" data-view="combi" title="4-Timbre Combi Mixer">
              <span class="tab-icon">🎚️</span>
              <span class="tab-label">COMBI</span>
            </button>
            <button class="ws-tab-btn" data-view="split" title="Split Keyboard: assign a sound to the lower and upper halves">
              <span class="tab-icon">✂️</span>
              <span class="tab-label">SPLIT</span>
            </button>
            <button class="ws-tab-btn" data-view="fx" title="7-Device Master FX Rack">
              <span class="tab-icon">🎛️</span>
              <span class="tab-label">FX</span>
            </button>
            <button class="ws-tab-btn" data-view="chords" title="Chord Harmony Pads & Looper">
              <span class="tab-icon">🎼</span>
              <span class="tab-label">CHORDS</span>
            </button>
            <button class="ws-tab-btn" data-view="demo" title="30s Interactive Song Clip Demos">
              <span class="tab-icon">🎬</span>
              <span class="tab-label">DEMO</span>
            </button>
            <button class="ws-tab-btn" data-view="grooves" title="Backing Grooves & SFX Soundboard">
              <span class="tab-icon">🥁</span>
              <span class="tab-label">GROOVES</span>
            </button>
            <button class="ws-tab-btn" data-view="player" title="Audio & Video Media Player Deck">
              <span class="tab-icon">🎧</span>
              <span class="tab-label">PLAYER</span>
            </button>
            <button class="ws-tab-btn" data-view="keys" title="Keys Focused View">
              <span class="tab-icon">🎹</span>
              <span class="tab-label">KEYS</span>
            </button>
            <button class="ws-tab-btn fullscreen-btn" id="btn-toggle-fullscreen" title="Toggle Fullscreen">
              <span class="tab-icon">⛶</span>
            </button>
          </nav>
        </div>

      </header>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const patchList = Object.values(INSTRUMENT_PATCHES);

    // Preset selector dropdown
    const soundSelect = document.getElementById("hud-sound-select");
    soundSelect?.addEventListener("change", e => {
      this.switchPatch(e.target.value);
    });

    // Next / Prev Preset Buttons
    const prevBtn = document.getElementById("hud-prev-preset");
    prevBtn?.addEventListener("click", () => {
      const curId = synthEngine.activePatch?.id;
      const idx = patchList.findIndex(p => p.id === curId);
      const nextIdx = idx > 0 ? idx - 1 : patchList.length - 1;
      this.switchPatch(patchList[nextIdx].id);
    });

    const nextBtn = document.getElementById("hud-next-preset");
    nextBtn?.addEventListener("click", () => {
      const curId = synthEngine.activePatch?.id;
      const idx = patchList.findIndex(p => p.id === curId);
      const nextIdx = idx < patchList.length - 1 ? idx + 1 : 0;
      this.switchPatch(patchList[nextIdx].id);
    });

    // Dual Layer Toggle & Sound Selector
    const layerBtn = document.getElementById("btn-toggle-layer");
    const layerSelect = document.getElementById("hud-layer-select");

    // Sync layerBtn with multiLayerEngine state changes from anywhere (Mixer rack, Presets, etc.)
    multiLayerEngine.addLayerChangeListener(layers => {
      const isLayer1Active = (multiLayerEngine.isCombiMode && (layers[1]?.enabled ?? false)) || multiLayerEngine.isDualLayerActive;
      if (layerBtn) {
        layerBtn.classList.toggle("active", isLayer1Active);
        layerBtn.innerText = isLayer1Active ? "LAYER: ON" : "LAYER: OFF";
      }
      if (layerSelect && layers[1]?.inst) {
        const instVal = layers[1].inst;
        const exists = Array.from(layerSelect.options).some(o => o.value === instVal);
        if (exists) {
          layerSelect.value = instVal;
        } else if (instVal === "choir_aahs") {
          layerSelect.value = "m1_ooh_ahh";
        }
      }
    });

    layerBtn?.addEventListener("click", () => {
      const isCurrentlyActive = (multiLayerEngine.isCombiMode && (multiLayerEngine.layers[1]?.enabled ?? false)) || multiLayerEngine.isDualLayerActive;
      const newState = !isCurrentlyActive;

      multiLayerEngine.setDualLayerEnabled(newState);
      synthEngine.toggleDualLayer(newState);

      layerBtn.classList.toggle("active", newState);
      layerBtn.innerText = newState ? "LAYER: ON" : "LAYER: OFF";
    });

    layerSelect?.addEventListener("change", e => {
      const bankId = e.target.value;
      multiLayerEngine.setDualLayerInstrument(bankId);
      synthEngine.toggleDualLayer(true);

      if (layerBtn) {
        layerBtn.classList.add("active");
        layerBtn.innerText = "LAYER: ON";
      }
    });

    // Split is controlled by the SPLIT workspace tab (auto-enable/disable there)

    // Tap Tempo
    const tapBtn = document.getElementById("btn-tap-tempo");
    const bpmVal = document.getElementById("bpm-val");
    tapBtn?.addEventListener("click", () => {
      const now = performance.now();
      this.lastTapTimes.push(now);
      if (this.lastTapTimes.length > 4) this.lastTapTimes.shift();

      if (this.lastTapTimes.length > 1) {
        let sum = 0;
        for (let i = 1; i < this.lastTapTimes.length; i++) {
          sum += this.lastTapTimes[i] - this.lastTapTimes[i - 1];
        }
        const avgDelta = sum / (this.lastTapTimes.length - 1);
        if (avgDelta > 200 && avgDelta < 2000) {
          this.bpm = Math.round(60000 / avgDelta);
          if (bpmVal) bpmVal.innerText = this.bpm;
          if (audioCore.fxRack) audioCore.fxRack.delay.setBpm(this.bpm);
        }
      }
    });

    // Master Studio Volume Slider
    const volSlider = document.getElementById("hud-master-vol");
    const volReadout = document.getElementById("hud-master-vol-val");
    volSlider?.addEventListener("input", e => {
      const val = parseInt(e.target.value);
      if (volReadout) volReadout.innerText = `${val}%`;
      multiLayerEngine.setMasterVolumePct(val);
    });

    // DIAG recorder: tap once to start, play the crackle, tap again to download
    const diagBtn = document.getElementById("hud-diag-btn");
    diagBtn?.addEventListener("click", () => {
      if (audioCore.isDiagRecording) {
        audioCore.stopDiagRecord();
        if (diagBtn) diagBtn.innerText = "⏺";
      } else {
        if (audioCore.startDiagRecord() && diagBtn) diagBtn.innerText = "⏹";
      }
    });

    // License modal trigger
    const licenseBtn = document.getElementById("hud-license-btn");
    licenseBtn?.addEventListener("click", () => {
      if (this.onOpenLicenseModal) this.onOpenLicenseModal();
    });

    // MIDI Device listener
    midiManager.onDeviceChangeCallback = devices => {
      const pill = document.getElementById("hud-midi-pill");
      const text = document.getElementById("hud-midi-text");
      if (devices.length > 0) {
        pill?.classList.add("connected");
        if (text) text.innerText = devices[0].name.substring(0, 10).toUpperCase();
      } else {
        pill?.classList.remove("connected");
        if (text) text.innerText = "MIDI";
      }
    };

    // Fullscreen Toggle
    const fullscreenBtn = document.getElementById("btn-toggle-fullscreen");
    fullscreenBtn?.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
        fullscreenBtn.classList.add("active");
      } else {
        document.exitFullscreen?.().catch(() => {});
        fullscreenBtn.classList.remove("active");
      }
    });

    // Workspace view switching is owned by app.js (single authoritative handler)
  }

  switchPatch(patchId) {
    if (COMBI_PRESETS[patchId]) {
      // COMBI presets: Multi-layer stacked sound (e.g. Grand Piano + R&B EP + Strings + Sax + FX)
      multiLayerEngine.setCombiPreset(patchId);
      if (audioCore.fxRack) audioCore.fxRack.applyPreset(patchId);
      synthEngine.setPatch(patchId);

      const layerBtn = document.getElementById("btn-toggle-layer");
      if (layerBtn) {
        layerBtn.classList.add("active");
        layerBtn.innerText = "LAYER: ON";
      }
    } else {
      // SINGLE INSTRUMENT: Solo PCM sound
      const BANK_MAP = {
        synthage_grand: "acoustic_grand_piano",
        triton_dyno_ep: "electric_piano_1",
        triton_warm_strings: "string_ensemble_1",
        m1_rock_organ: "drawbar_organ",
        fantom_nylon_pluck: "acoustic_guitar_nylon",
        moog_punch_bass: "synth_bass_1",
        supersaw_lead: "brass_section",
        abletunes_fm_dx7: "abletunes_fm_piano",
        fat_brass_horns: "brass_section",
        breathy_alto_sax: "alto_sax",
        m1_fresh_air: "electric_piano_1",
        m1_universe: "string_ensemble_1",
        m1_choir: "choir_aahs",
        m1_ooh_ahh: "choir_aahs",
        choir_aahs: "choir_aahs",
        m1_piano_16: "acoustic_grand_piano",
        m1_organ_2: "drawbar_organ",
        m1_slap_bass: "synth_bass_1",
      };
      const resolvedInst = BANK_MAP[patchId] || patchId;
      multiLayerEngine.setSingleInstrument(resolvedInst);
      if (audioCore.fxRack) audioCore.fxRack.applyPreset(resolvedInst);
      synthEngine.setPatch(patchId);
    }

    const soundSelect = document.getElementById("hud-sound-select");
    if (soundSelect && soundSelect.value !== patchId) {
      soundSelect.value = patchId;
    }
  }

  syncActivePatch(patchId) {
    const soundSelect = document.getElementById("hud-sound-select");
    if (soundSelect) {
      soundSelect.value = patchId;
    }
  }

  bindPillInteractions() {
    if (this._pillInteractionsBound || !this.container) return;
    this._pillInteractionsBound = true;

    const latencyVal = document.getElementById("hud-latency-val");
    const latencyPill = document.getElementById("hud-latency-pill");

    const paintLatency = (l) => {
      const shown = l.measuredMs || l.reportedMs;
      if (!shown || !latencyVal) return;
      this._latencySmoothed = this._latencySmoothed === null ? shown : this._latencySmoothed * 0.6 + shown * 0.4;
      latencyVal.innerText = `${this._latencySmoothed.toFixed(1)}ms`;
      latencyPill?.classList.toggle("latency-warm", this._latencySmoothed > 20);
      latencyPill?.classList.toggle("latency-hot", this._latencySmoothed > 50);
    };

    latencyPill?.addEventListener("click", (e) => {
      e.stopPropagation();
      const l = audioCore.measureLatency();
      this._renderLatencyPopover(l, this._latencySmoothed);
      paintLatency(l);
    });
    const gigBtn = document.getElementById("hud-gig-btn");
    gigBtn?.addEventListener("click", () => this.toggleGigMode());
    window.addEventListener("click", () => this._closeLatencyPopover());
  }

  startVuMonitor() {
    if (this._vuRunning) return;
    this._vuRunning = true;

    const vuBar = document.getElementById("vu-meter-bar");
    const latencyVal = document.getElementById("hud-latency-val");
    const latencyPill = document.getElementById("hud-latency-pill");

    let lastMeasure = 0;
    const updateFrame = () => {
      if (!this._vuRunning) return;
      const level = audioCore.getPeakLevel();
      if (vuBar) {
        const heightPct = Math.min(100, Math.round(level * 180));
        vuBar.style.height = `${heightPct}%`;
        if (level > 0.85) vuBar.style.backgroundColor = "#ef4444";
        else if (level > 0.5) vuBar.style.backgroundColor = "#f59e0b";
        else vuBar.style.backgroundColor = "#10b981";
      }

      // Live measured latency (throttled to ~10Hz to let the drift accumulate)
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

  toggleGigMode() {
    this.setGigMode(!this.gigMode);
  }

  setGigMode(on) {
    this.gigMode = !!on;
    localStorage.setItem("midikey_gig_mode", this.gigMode ? "1" : "0");
    const btn = document.getElementById("hud-gig-btn");
    btn?.classList.toggle("active", this.gigMode);
    btn?.setAttribute(
      "title",
      this.gigMode
        ? "GIG MODE ON: all meters disabled for minimum jitter (click to re-enable)"
        : "GIG MODE: disable all meters/live polling for minimum latency jitter"
    );
    const vuBar = document.getElementById("vu-meter-bar");
    if (vuBar) vuBar.style.display = this.gigMode ? "none" : "";
    if (this.gigMode) {
      this._vuRunning = false;
      if (this.vuAnimationId) cancelAnimationFrame(this.vuAnimationId);
    } else {
      this.startVuMonitor();
    }
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
      ["ROUND-TRIP (Buffer+Output)", `${l.measuredMs.toFixed(1)} ms`],
      ["SMOOTHED (10Hz avg)", primary],
      ["Base buffer (input side)", `${l.baseMs.toFixed(1)} ms (${bufferSamples} samples @ ${(l.sampleRate / 1000).toFixed(1)} kHz)`],
      ["Audio clock lock (drift)", l.lockMs === null ? "—" : `${l.lockMs.toFixed(1)} ms`],
      ["Engine state", l.state],
    ].map(
      ([k, v]) => `
      <div class="latency-pop-row">
        <span class="latency-pop-key">${k}</span>
        <span class="latency-pop-val">${v}</span>
      </div>`
    ).join("");

    pop.innerHTML = `
      <div class="latency-pop-head">
        <span>ROUND-TRIP LATENCY ANALYSIS</span>
        <button class="latency-pop-close" id="hud-latency-close">✕</button>
      </div>
      <div class="latency-pop-body">${rows}</div>
      <div class="latency-pop-tip">
        <span>${stalled
          ? "⚠️ Audio clock is stalled (engine silent or tab throttled) — the live readout floats; play a note to re-lock it."
          : "🔹 Real latency = base buffer + OS output buffer. Bluetooth output adds 100–200ms on top — use wired listening."}</span>
      </div>
    `;

    pop.style.top = `${rect.bottom + 8}px`;
    pop.style.left = `${Math.max(8, rect.left)}px`;
    document.body.appendChild(pop);

    pop.querySelector("#hud-latency-close").addEventListener("click", (e) => {
      e.stopPropagation();
      this._closeLatencyPopover();
    });
  }

  _closeLatencyPopover() {
    const pop = document.getElementById("hud-latency-popover");
    if (pop) pop.remove();
  }
}
