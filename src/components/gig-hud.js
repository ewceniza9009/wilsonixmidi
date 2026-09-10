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

    this.render();
    this.startVuMonitor();

    // Pause the VU meter rAF loop whenever the HUD is scrolled out of view
    if (typeof IntersectionObserver !== "undefined" && this.container) {
      this._vuObserver = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
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

          <button class="mode-pill-btn ${synthEngine.isSplitMode ? "active" : ""}" id="btn-toggle-split" title="Split Bass on Left Hand">
            ${synthEngine.isSplitMode ? "SPLIT ON" : "SPLIT"}
          </button>
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
          <div class="latency-hud-pill" title="Hardware buffer latency">
            <span class="latency-dot"></span>
            <span class="latency-number" id="hud-latency-val">4.2ms</span>
          </div>

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
            <button class="ws-tab-btn" data-view="all" title="View All Modules Stacked (Triton + Combi + FX + Chords)">
              <span class="tab-icon">🎛️</span>
              <span class="tab-label">ALL</span>
            </button>
            <button class="ws-tab-btn active" data-view="triton" title="Korg Triton VST Console">
              <span class="tab-icon">🎹</span>
              <span class="tab-label">TRITON</span>
            </button>
            <button class="ws-tab-btn" data-view="combi" title="4-Timbre Combi Mixer">
              <span class="tab-icon">🎚️</span>
              <span class="tab-label">COMBI</span>
            </button>
            <button class="ws-tab-btn" data-view="fx" title="Ableton 7-Device Master FX Rack">
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

    // Split toggle (audible PCM path + legacy synth state kept in sync)
    const splitBtn = document.getElementById("btn-toggle-split");
    splitBtn?.addEventListener("click", () => {
      const next = !multiLayerEngine.isSplitMode;
      multiLayerEngine.toggleSplitMode(next);
      synthEngine.toggleSplitMode(next);
      splitBtn.classList.toggle("active", next);
      splitBtn.innerText = `SPLIT: ${next ? "ON" : "OFF"}`;
    });

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

    // Workspace View Tabs Switcher (Triggers instant in-place switch, 0 scrolling!)
    const appRoot = document.getElementById("app-root");
    const wsTabBtns = this.container.querySelectorAll(".ws-tab-btn[data-view]");
    wsTabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        wsTabBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const view = btn.getAttribute("data-view");

        if (appRoot) {
          appRoot.classList.remove(
            "view-all",
            "view-triton",
            "view-combi",
            "view-keys",
            "view-chords",
            "view-demo",
            "view-fx",
            "view-looper",
            "view-grooves"
          );
          appRoot.classList.add(`view-${view}`);
        }

        if (view === "combi") {
          multiLayerEngine.toggleCombiMode(true);
        }
      });
    });
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

  startVuMonitor() {
    if (this._vuRunning) return;
    this._vuRunning = true;

    const vuBar = document.getElementById("vu-meter-bar");
    const latencyVal = document.getElementById("hud-latency-val");

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

      if (Math.random() < 0.03 && latencyVal) {
        const ms = audioCore.getLatencyMs();
        latencyVal.innerText = `${ms}ms`;
      }

      this.vuAnimationId = requestAnimationFrame(updateFrame);
    };

    updateFrame();
  }
}
