/**
 * Workstation Multi-Layer (COMBI) Mixer Rack UI
 * Allows stacking up to 4 simultaneous sound layers with independent faders,
 * mute buttons, octave transpositions, and instrument selectors.
 */

import {
  multiLayerEngine,
  COMBI_PRESETS,
  getTimbreDisplayName,
} from "../audio/multi-layer-engine.js";
import { audioCore } from "../audio/audio-core.js";
import { LAYER_FX_OPTIONS } from "../audio/native-pcm-engine.js";
import { CustomPatchBrowserUI } from "./custom-patch-browser.js";
import { CustomModal } from "./custom-modal.js";
import { timbreSearchModal } from "./timbre-search-modal.js";
import { tonicDroneEngine } from "../audio/tonic-drone-engine.js";

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const midiName = (m) =>
  NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

const fxOptionsHTML = (selectedIx) => {
  const fxList = Object.values(LAYER_FX_OPTIONS);
  const fxCats = [];
  fxList.forEach((f) => {
    const cat = f.category || "General FX";
    if (!fxCats.includes(cat)) fxCats.push(cat);
  });
  fxCats.sort((a, b) =>
    a.includes("Synthesizer You") ? -1 : b.includes("Synthesizer You") ? 1 : 0,
  );
  return fxCats
    .map(
      (cat) => `
    <optgroup label="${cat.toUpperCase()}">
      ${fxList
        .filter((f) => (f.category || "General FX") === cat)
        .map(
          (f) => `
        <option value="${f.id}" ${selectedIx === f.id ? "selected" : ""}>
          ${f.name}
        </option>
      `,
        )
        .join("")}
    </optgroup>
  `,
    )
    .join("");
};

export class MultiLayerUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.combiSearchQuery = "";
    this.viewMode = localStorage.getItem("wilsonix_combi_view_mode") || "perform";
    if (!multiLayerEngine.macros) {
      multiLayerEngine.macros = { swell: 0.35, shimmer: 0.2, tone: 0.5, pad: 0.5 };
    }
    if (!multiLayerEngine.snapshots) {
      multiLayerEngine.snapshots = [null, null, null, null, null, null, null, null];
    }
    // No slot is "active" until it actually holds a scene (an empty highlighted
    // slot 1 made it look like a scene already existed there).
    const curSnap = multiLayerEngine.activeSnapshotIndex;
    multiLayerEngine.activeSnapshotIndex =
      Number.isInteger(curSnap) && multiLayerEngine.snapshots[curSnap] ? curSnap : null;

    // Refresh scene buttons/macros when scenes are loaded externally (custom patch load)
    this._scenesChangedListener = () => this.refreshScenesFromEngine();
    window.addEventListener("wilsonix-scenes-changed", this._scenesChangedListener);

    this._bindDocClickOutside();
    this.render();
    this.bindEvents();

    this._layerChangeListener = () => {
      this.updateLayerFaders();
    };
    multiLayerEngine.addLayerChangeListener(this._layerChangeListener);
    multiLayerEngine.onLayerChangeCallback = this._layerChangeListener;

    this._layerActivityCallback = (layerIdx, vel, gain) => {
      this.triggerLayerActivity(layerIdx, vel, gain);
    };
    multiLayerEngine.onLayerActivityCallback = this._layerActivityCallback;

    this._splitListener = () => {
      const consoleEl = document.getElementById("split-keyboard-console");
      if (consoleEl)
        consoleEl.classList.toggle("active", !!multiLayerEngine.isSplitMode);
      const powerBtn = document.getElementById("split-power-btn");
      if (powerBtn) {
        powerBtn.classList.toggle("active", !!multiLayerEngine.isSplitMode);
        powerBtn.innerText = multiLayerEngine.isSplitMode
          ? "SPLIT ON"
          : "SPLIT OFF";
      }
      const nameEl = document.getElementById("split-name-lower");
      if (nameEl && multiLayerEngine.splitZones.lower?.name) {
        nameEl.innerText = multiLayerEngine.splitZones.lower.name;
        nameEl.title = multiLayerEngine.splitZones.lower.name;
      }
      const nameUpper = document.getElementById("split-name-upper");
      if (nameUpper && multiLayerEngine.splitZones.upper) {
        const z = multiLayerEngine.splitZones.upper;
        const nm =
          z.inst && z.inst !== "current_stack" && z.name
            ? z.name
            : "Current Stack";
        nameUpper.innerText = nm;
        nameUpper.title = nm;
        nameUpper
          .closest(".split-zone-strip")
          ?.classList.toggle("stack", !z.inst || z.inst === "current_stack");
      }
    };
    multiLayerEngine.addSplitChangeListener(this._splitListener);
  }

  // Bound ONCE here (not per timbre combo) — bindTimbreCombos() runs on every
  // render()/bindEvents(), so attaching a document listener inside it leaked a
  // new handler on each pass.
  _bindDocClickOutside() {
    if (this._outsideClickHandler) return;
    this._outsideClickHandler = (e) => {
      if (!this.container) return;
      this.container
        .querySelectorAll(".timbre-combo-list.open")
        .forEach((list) => {
          const combo = list.closest(".timbre-combo");
          if (combo && !combo.contains(e.target)) list.classList.remove("open");
        });
    };
    document.addEventListener("click", this._outsideClickHandler);
  }

  dispose() {
    if (this._scenesChangedListener) {
      window.removeEventListener("wilsonix-scenes-changed", this._scenesChangedListener);
      this._scenesChangedListener = null;
    }
    if (this._outsideClickHandler) {
      document.removeEventListener("click", this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    if (this._splitListener) {
      multiLayerEngine.removeSplitChangeListener(this._splitListener);
      this._splitListener = null;
    }
    if (this._layerChangeListener) {
      multiLayerEngine.removeLayerChangeListener(this._layerChangeListener);
      if (multiLayerEngine.onLayerChangeCallback === this._layerChangeListener) {
        multiLayerEngine.onLayerChangeCallback = null;
      }
      this._layerChangeListener = null;
    }
    if (
      this._layerActivityCallback &&
      multiLayerEngine.onLayerActivityCallback === this._layerActivityCallback
    ) {
      multiLayerEngine.onLayerActivityCallback = null;
      this._layerActivityCallback = null;
    }
  }

  render() {
    if (!this.container) return;

    const allPresets = Object.values(COMBI_PRESETS);
    const catOrder = [];
    allPresets.forEach((cp) => {
      if (cp.category && !catOrder.includes(cp.category))
        catOrder.push(cp.category);
    });

    const macros = multiLayerEngine.macros || { swell: 0.35, shimmer: 0.2, tone: 0.5, pad: 0.5 };
    const snapshots = multiLayerEngine.snapshots || [null, null, null, null, null, null, null, null];
    const activeSnap = multiLayerEngine.activeSnapshotIndex ?? null;

    this.container.innerHTML = `
      <div class="combi-layers-console">
        <!-- Combi Header & Compact Preset Selector -->
        <div class="combi-header-bar">
          <div class="combi-title-group">
            <span class="combi-pill">WORKSTATION COMBI</span>
            <span class="combi-main-title">4-TIMBRE MULTI-LAYER INPUT MATRIX</span>
            <div class="combi-view-mode-toggle" title="Toggle Compact Live Performance View / Deep Edit Strips">
              <button class="view-mode-btn ${this.viewMode === 'perform' ? 'active' : ''}" data-view="perform">PERFORM</button>
              <button class="view-mode-btn ${this.viewMode === 'edit' ? 'active' : ''}" data-view="edit">EDIT</button>
            </div>
          </div>

          <div class="combi-selector-row">
            <button class="preset-arrow-btn" id="combi-prev-btn" title="Previous preset">◀</button>
            <input type="text" id="combi-search-input" class="combi-search-input" placeholder="Search presets..." value="${esc(this.combiSearchQuery)}" />
            <select class="combi-preset-select" id="combi-preset-select" title="Choose combi preset">
              ${catOrder
                .map(
                  (cat) => `
                <optgroup label="${cat}">
                  ${allPresets
                    .filter((cp) => cp.category === cat)
                    .filter(
                      (cp) =>
                        !this.combiSearchQuery ||
                        cp.name
                          .toLowerCase()
                          .includes(this.combiSearchQuery.toLowerCase()) ||
                        (cp.category &&
                          cp.category
                            .toLowerCase()
                            .includes(this.combiSearchQuery.toLowerCase())),
                    )
                    .map(
                      (cp) => `
                    <option value="${esc(cp.id)}" ${multiLayerEngine.activeCombi?.id === cp.id ? "selected" : ""}>
                      ${esc(cp.name)}
                    </option>
                  `,
                    )
                    .join("")}
                </optgroup>
              `,
                )
                .join("")}
            </select>
            <button class="preset-arrow-btn" id="combi-next-btn" title="Next preset">▶</button>
            <div style="width: 1px; height: 20px; background: #2a3441; margin: 0 5px;"></div>
            <button class="combi-preset-btn" id="init-layers-btn" title="Initialize a new blank stack" style="background: rgba(255, 60, 60, 0.2); color: #ff764d; border-color: rgba(255, 60, 60, 0.4);">CLEAR LAYERS</button>
          </div>
        </div>

        <!-- Search results as chips (only when searching) -->
        ${
          this.combiSearchQuery
            ? `
        <div class="combi-search-results" id="combi-search-results">
          ${allPresets
            .filter(
              (cp) =>
                cp.name
                  .toLowerCase()
                  .includes(this.combiSearchQuery.toLowerCase()) ||
                (cp.category &&
                  cp.category
                    .toLowerCase()
                    .includes(this.combiSearchQuery.toLowerCase())),
            )
            .slice(0, 15)
            .map(
              (cp) =>
                `<button class="combi-search-chip ${multiLayerEngine.activeCombi?.id === cp.id ? "active" : ""}" data-combi-search="${esc(cp.id)}">${esc(cp.name)}</button>`,
            )
            .join("")}
        </div>`
            : ""
        }

        <!-- Combi Split View: Left Panel (Browser) + Right Panel (Workstation Strips) -->
        <div style="display: flex; flex-direction: row; gap: 8px; width: 100%; height: 100%; overflow: hidden; padding-bottom: 6px;">
          
          <!-- Custom Patch Browser (Setlist + Drone - Compact 210px for Medium Tablet) -->
          <div id="combi-custom-browser-mount" style="flex: 0 0 210px; min-width: 195px; max-width: 220px; background: #0b0f17; border-radius: 6px; border: 1px solid #1a2233; display: flex; flex-direction: column; overflow: hidden; height: 100%;"></div>

          <!-- Right Panel: Stack Layers & Split Zones -->
          <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; overflow-x: hidden;">
            
            <!-- Performance Macro Sliders & Snapshots Strip -->
            <div class="combi-macro-strip">
              <div class="macro-cell" title="Swell: Master Reverb Wet">
                <span class="macro-label">SWELL</span>
                <input type="range" class="macro-slider" data-macro="swell" min="0" max="1" step="0.01" value="${macros.swell}" />
                <span class="macro-val" id="macro-val-swell">${Math.round(macros.swell * 100)}%</span>
              </div>
              <div class="macro-cell" title="Shimmer: Shimmer Reverb Mix">
                <span class="macro-label">SHIMMER</span>
                <input type="range" class="macro-slider" data-macro="shimmer" min="0" max="1" step="0.01" value="${macros.shimmer}" />
                <span class="macro-val" id="macro-val-shimmer">${Math.round(macros.shimmer * 100)}%</span>
              </div>
              <div class="macro-cell" title="Tone: Lowpass Filter / High-End Tilt">
                <span class="macro-label">TONE</span>
                <input type="range" class="macro-slider" data-macro="tone" min="0" max="1" step="0.01" value="${macros.tone}" />
                <span class="macro-val" id="macro-val-tone">${Math.round(macros.tone * 100)}%</span>
              </div>
              <div class="macro-cell" title="Pad: Tonic Ambient Drone Volume">
                <span class="macro-label">PAD</span>
                <input type="range" class="macro-slider" data-macro="pad" min="0" max="1" step="0.01" value="${macros.pad}" />
                <span class="macro-val" id="macro-val-pad">${Math.round(macros.pad * 100)}%</span>
              </div>

              <div class="snapshots-bay" title="Scenes: tap an empty slot to create a scene, tap a filled slot to recall it. Edits auto-save to the active scene. Right-click to overwrite.">
                <span class="snapshots-label">SCENES</span>
                <div class="snapshot-btns">
                  ${[1, 2, 3, 4, 5, 6, 7, 8].map((num, i) => `
                    <button class="snapshot-btn ${activeSnap === i ? 'active' : ''} ${snapshots[i] ? 'has-data' : ''}" data-snapshot="${i}" title="${snapshots[i] ? `Scene ${num} (Tap to recall, right-click to overwrite)` : `Scene ${num} (Empty: tap to create a new scene here)`}">
                      ${num}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>

            ${this.viewMode === "perform" ? `
              <!-- Compact PERFORM Mode Layer Rack (28px rows) -->
              <div class="perform-layer-rack">
                ${multiLayerEngine.layers.map((layer, idx) => {
                  const hasSolo = multiLayerEngine.layers.some((l) => l.solo);
                  const isDimmed = hasSolo && !layer.solo;
                  return `
                    <div class="perform-layer-row ${layer.enabled ? "active" : "muted"} ${layer.solo ? "is-soloed" : ""} ${isDimmed ? "solo-dimmed" : ""}" id="perform-layer-${idx}">
                      <span class="perform-layer-badge">L${idx + 1}</span>
                      <button class="layer-power-btn ${layer.enabled ? "active" : ""}" data-layer="${idx}" title="${layer.enabled ? "Mute" : "Unmute"} Layer ${idx + 1}">
                        ${layer.enabled ? "ON" : "MUTE"}
                      </button>
                      <button class="layer-solo-btn ${layer.solo ? "active" : ""}" data-layer="${idx}" title="Solo Layer ${idx + 1}">S</button>
                      <span class="strip-sig-led" id="sig-led-perf-${idx}"></span>

                      <div class="perform-timbre-bay timbre-picker" data-layer="${idx}">
                        <button type="button" class="timbre-picker-trigger" data-layer="${idx}" title="Click to browse sounds">
                          <span class="timbre-trigger-badge ${layer.inst?.startsWith("va:") ? "badge-va" : "badge-pcm"}">
                            ${layer.inst?.startsWith("va:") ? "VA" : "PCM"}
                          </span>
                          <span class="timbre-trigger-name">${esc(getTimbreDisplayName(layer.inst, layer.name))}</span>
                          <span class="timbre-trigger-icon">🔍</span>
                        </button>
                      </div>

                      <div class="perform-fader-bay">
                        <span class="fader-label">VOL</span>
                        <input type="range" class="horizontal-fader layer-gain-slider" min="0" max="1.5" step="0.05" value="${layer.gain}" data-layer="${idx}" />
                        <span class="fader-readout" id="perf-fader-val-${idx}">${Math.round(layer.gain * 100)}%</span>
                      </div>

                      <div class="perform-fx-bay">
                        <select class="layer-fx-select" data-layer="${idx}">
                          ${fxOptionsHTML(layer.fx || "clean")}
                        </select>
                      </div>

                      <div class="octave-mini-picker">
                        <button class="oct-mini-btn" data-layer="${idx}" data-oct="-1">-12</button>
                        <span class="oct-mini-val" id="perf-oct-val-${idx}">${layer.oct >= 0 ? "+" : ""}${layer.oct}</span>
                        <button class="oct-mini-btn" data-layer="${idx}" data-oct="1">+12</button>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            ` : `
              <!-- Full EDIT Mode 4 Layer Channel Strips Rack -->
              <div class="layer-strips-rack" style="display: grid; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap: 8px; padding-bottom: 5px; flex-shrink: 0;">
              ${multiLayerEngine.layers
                .map(
                  (layer, idx) => {
                    const hasSolo = multiLayerEngine.layers.some((l) => l.solo);
                    const isDimmed = hasSolo && !layer.solo;
                    return `
              <div class="layer-channel-strip ${layer.enabled ? "active" : "muted"} ${layer.solo ? "is-soloed" : ""} ${isDimmed ? "solo-dimmed" : ""}" id="layer-strip-${idx}">
                <div class="strip-header">
                  <div style="display:flex;align-items:center;gap:4px;">
                    <button class="layer-power-btn ${layer.enabled ? "active" : ""}" data-layer="${idx}" title="${layer.enabled ? "Mute" : "Unmute"} Layer ${idx + 1}">
                      ${layer.enabled ? "ON" : "MUTE"}
                    </button>
                    <button class="layer-solo-btn ${layer.solo ? "active" : ""}" data-layer="${idx}" title="Solo Layer ${idx + 1}">
                      S
                    </button>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span class="strip-sig-led" id="sig-led-${idx}" title="Audio Signal Activity"></span>
                    <span class="strip-num">L${idx + 1}</span>
                  </div>
                </div>
                <div class="strip-layer-name" data-layer="${idx}" title="${esc(getTimbreDisplayName(layer.inst, layer.name))}">${esc(getTimbreDisplayName(layer.inst, layer.name))}</div>

                <!-- Instrument Picker -->
                <div class="strip-inst-picker timbre-picker" data-layer="${idx}">
                  <label class="strip-picker-label">TIMBRE / SOUNDBANK</label>
                  <button type="button" class="timbre-picker-trigger" data-layer="${idx}" title="Click to browse sounds">
                    <div class="timbre-trigger-info">
                      <span class="timbre-trigger-badge ${layer.inst?.startsWith("va:") ? "badge-va" : "badge-pcm"}">
                        ${layer.inst?.startsWith("va:") ? "VA" : "PCM"}
                      </span>
                      <span class="timbre-trigger-name">${esc(getTimbreDisplayName(layer.inst, layer.name))}</span>
                    </div>
                    <span class="timbre-trigger-icon">🔍</span>
                  </button>
                </div>

                <!-- Dedicated Layer Effects Combo Box -->
                <div class="strip-fx-picker">
                  <label class="strip-picker-label">INSERT EFFECT / DSP</label>
                  <select class="layer-fx-select" data-layer="${idx}">
                    ${fxOptionsHTML(layer.fx || "clean")}
                  </select>
                </div>

                <!-- Volume Fader & Meter -->
                <div class="strip-fader-bay">
                  <span class="fader-label">GAIN</span>
                  <div class="fader-track">
                    <input type="range" 
                           class="vertical-fader layer-gain-slider" 
                           min="0" 
                           max="1.5" 
                           step="0.05" 
                           value="${layer.gain}" 
                           data-layer="${idx}"/>
                    <div class="strip-meter-track" title="Real-Time Signal Level">
                      <div class="strip-meter-fill" id="meter-fill-${idx}"></div>
                    </div>
                  </div>
                  <div class="fader-readout" id="fader-val-${idx}">${Math.round(layer.gain * 100)}%</div>
                </div>

                <!-- Layer Meta Controls: Octave & Pan -->
                <div class="strip-footer-controls">
                  <div class="octave-mini-picker">
                    <button class="oct-mini-btn" data-layer="${idx}" data-oct="-1">-12</button>
                    <span class="oct-mini-val" id="oct-val-${idx}">${layer.oct >= 0 ? "+" : ""}${layer.oct}</span>
                    <button class="oct-mini-btn" data-layer="${idx}" data-oct="1">+12</button>
                  </div>
                  <span class="strip-role-tag">${idx === 0 ? "PRIMARY" : idx === 1 ? "ENSEMBLE" : idx === 2 ? "ACCENT" : "SUB/BASS"}</span>
                </div>
              </div>
            `;
                  },
                )
                .join("")}
          </div>

          <!-- Split Keyboard Zones Console -->
          <div class="split-keyboard-console ${multiLayerEngine.isSplitMode ? "active" : ""}" id="split-keyboard-console">
            <div class="combi-header-bar">
              <div class="combi-title-group">
                <span class="combi-pill">SPLIT KEYBOARD</span>
                <span class="combi-main-title">TWO-ZONE PERFORMANCE SPLIT</span>
              </div>
              <div class="split-master-row">
                <button class="layer-power-btn split-power-btn ${multiLayerEngine.isSplitMode ? "active" : ""}" id="split-power-btn">
                  ${multiLayerEngine.isSplitMode ? "SPLIT ON" : "SPLIT OFF"}
                </button>
                <label class="strip-picker-label">POINT</label>
                <select class="split-point-select" id="split-point-select" title="Split point">
                  ${(() => {
                    const p = multiLayerEngine.splitPointMidi;
                    return [48, 55, 60, 62, 67, 72]
                      .concat(Array.from({ length: 37 }, (_, i) => i + 48))
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .sort((a, b) => a - b)
                      .map(
                        (m) =>
                          `<option value="${m}" ${m === p ? "selected" : ""}>${midiName(m)}</option>`,
                      )
                      .join("");
                  })()}
                </select>
              </div>
            </div>

            <div class="split-zones-row">
              ${["lower", "upper"]
                .map((zk) => {
                  const z = multiLayerEngine.splitZones[zk];
                  const isStack = !z.inst || z.inst === "current_stack";
                  return `
                  <div class="layer-channel-strip split-zone-strip ${isStack ? "stack" : ""}" id="split-strip-${zk}">
                    <div class="strip-header">
                      <span class="strip-num">${zk === "lower" ? "LOWER ZONE" : "UPPER ZONE"} · ${zk === "lower" ? "BELOW POINT" : "AT/ABOVE POINT"}</span>
                    </div>
                    <div class="strip-layer-name split-zone-name" id="split-name-${zk}" title="${esc(z.name || "Current Stack")}">${esc(z.name || "Current Stack")}</div>
                    <div class="strip-inst-picker timbre-picker" data-split-zone="${zk}">
                      <label class="strip-picker-label">ZONE TIMBRE</label>
                      <button type="button" class="timbre-picker-trigger" data-split-zone="${zk}" title="Click to browse zone sound">
                        <div class="timbre-trigger-info">
                          <span class="timbre-trigger-badge ${isStack ? "badge-auto" : (z.inst?.startsWith("va:") ? "badge-va" : "badge-pcm")}">
                            ${isStack ? "AUTO" : (z.inst?.startsWith("va:") ? "VA" : "PCM")}
                          </span>
                          <span class="timbre-trigger-name">${esc(isStack ? "Follow Current Stack" : z.name || "Select Sound")}</span>
                        </div>
                        <span class="timbre-trigger-icon">🔍</span>
                      </button>
                    </div>
                    <div class="strip-fx-picker">
                      <label class="strip-picker-label">INSERT EFFECT / DSP</label>
                      <select class="layer-fx-select split-zone-fx" data-split-zone="${zk}">${fxOptionsHTML(z.fx || "clean")}</select>
                    </div>
                    <div class="strip-footer-controls">
                      <div class="octave-mini-picker">
                        <button class="oct-mini-btn" data-split-oct="${zk}" data-oct="-1">-12</button>
                        <span class="oct-mini-val" id="split-oct-val-${zk}">${z.oct >= 0 ? "+" : ""}${z.oct}</span>
                        <button class="oct-mini-btn" data-split-oct="${zk}" data-oct="1">+12</button>
                      </div>
                      <span class="strip-role-tag">GAIN</span>
                      <input type="range" class="split-zone-gain" data-split-gain="${zk}" min="0" max="1.5" step="0.05" value="${z.gain}" title="Zone volume" />
                      <span class="split-gain-val" id="split-gain-val-${zk}">${Math.round(z.gain * 100)}%</span>
                    </div>
                  </div>
                `;
                })
                .join("")}
              </div>
            </div> <!-- End Split Keyboard Console -->
            `}
          </div> <!-- End Right Panel -->
        </div> <!-- End Flex Row -->
      </div>
    `;
  }

  setMacro(name, val) {
    if (!multiLayerEngine.macros) {
      multiLayerEngine.macros = { swell: 0.35, shimmer: 0.2, tone: 0.5, pad: 0.5 };
    }
    multiLayerEngine.macros[name] = val;
    const rack = audioCore.fxRack;

    if (name === "swell") {
      if (rack && rack.reverb) {
        if (val > 0.01) {
          rack.reverb.setBypass(false);
          rack.reverb.setMix(Math.min(0.85, val * 0.8));
          rack.reverb.setDecay(1.4 + val * 2.6);
        } else {
          rack.reverb.setBypass(true);
          rack.reverb.setMix(0);
        }
      }
    } else if (name === "shimmer") {
      if (rack && rack.shimmerReverb) {
        if (val > 0.01) {
          rack.shimmerReverb.setBypass(false);
          rack.shimmerReverb.setMix(Math.min(0.65, val * 0.7));
          rack.shimmerReverb.setShimmer(val);
          rack.shimmerReverb.setDecay(1.8 + val * 2.2);
        } else {
          rack.shimmerReverb.setBypass(true);
          rack.shimmerReverb.setMix(0);
        }
      }
    } else if (name === "tone") {
      const eq = rack?.masterEq;
      if (eq) {
        if (typeof eq.setHighGain === "function") {
          eq.setHighGain((val - 0.5) * 20); // -10dB (dark/warm) to +10dB (bright air)
        }
        if (typeof eq.setMidGain === "function") {
          eq.setMidGain((val - 0.5) * 6);
        }
      }
    } else if (name === "pad") {
      tonicDroneEngine.setVolume(val);
      const droneVol = document.getElementById("drone-vol-slider");
      if (droneVol) droneVol.value = val;
    }
  }

  applyAllMacros() {
    const macros = multiLayerEngine.macros || { swell: 0.35, shimmer: 0.2, tone: 0.5, pad: 0.5 };
    Object.entries(macros).forEach(([k, v]) => {
      this.setMacro(k, v);
    });
  }

  _captureScene(idx) {
    return {
      name: `Scene ${idx + 1}`,
      gains: multiLayerEngine.layers.map((l) => l.gain),
      enabled: multiLayerEngine.layers.map((l) => !!l.enabled),
      macros: { ...(multiLayerEngine.macros || { swell: 0.35, shimmer: 0.2, tone: 0.5, pad: 0.5 }) },
    };
  }

  saveSnapshot(idx) {
    if (!multiLayerEngine.snapshots) {
      multiLayerEngine.snapshots = [null, null, null, null, null, null, null, null];
    }
    multiLayerEngine.snapshots[idx] = this._captureScene(idx);
    multiLayerEngine.activeSnapshotIndex = idx;
    this.updateSnapshotButtons();
    multiLayerEngine.saveSessionSoon?.();
    multiLayerEngine._notifyScenesChanged?.();
  }

  /**
   * Live-edit model: any fader / mute / macro change is written straight into
   * the active scene, so building a mix never leaves the slot holding a stale
   * state (which made scene 1's mix get captured into slot 2 on "new scene").
   */
  syncActiveScene() {
    const idx = multiLayerEngine.activeSnapshotIndex;
    if (!Number.isInteger(idx) || !multiLayerEngine.snapshots?.[idx]) return;
    multiLayerEngine.snapshots[idx] = this._captureScene(idx);
    multiLayerEngine.saveSessionSoon?.();
    multiLayerEngine._notifyScenesChanged?.();
  }

  recallSnapshot(idx) {
    if (!multiLayerEngine.snapshots || !multiLayerEngine.snapshots[idx]) {
      // Empty slot → create a NEW scene here, seeded from the current mix,
      // and make it the active scene. Earlier scenes keep their own slots.
      this.saveSnapshot(idx);
      return;
    }
    const snap = multiLayerEngine.snapshots[idx];
    multiLayerEngine.activeSnapshotIndex = idx;
    
    // Smoothly apply gains and enabled states
    snap.gains.forEach((gain, i) => {
      multiLayerEngine.setLayerGain(i, gain);
    });
    snap.enabled.forEach((en, i) => {
      if (multiLayerEngine.layers[i] && multiLayerEngine.layers[i].enabled !== en) {
        multiLayerEngine.toggleLayer(i, en);
      }
    });
    if (snap.macros) {
      Object.entries(snap.macros).forEach(([k, v]) => {
        this.setMacro(k, v);
        const sl = this.container?.querySelector(`.macro-slider[data-macro="${k}"]`);
        if (sl) sl.value = v;
        const readout = document.getElementById(`macro-val-${k}`);
        if (readout) readout.innerText = `${Math.round(v * 100)}%`;
      });
    }
    this.updateLayerFaders();
    this.updateSnapshotButtons();
    multiLayerEngine.saveSessionSoon?.();
    multiLayerEngine._notifyScenesChanged?.();
  }

  refreshScenesFromEngine() {
    const macros = multiLayerEngine.macros;
    if (macros) {
      Object.entries(macros).forEach(([k, v]) => {
        this.setMacro(k, v);
        const sl = this.container?.querySelector(`.macro-slider[data-macro="${k}"]`);
        if (sl) sl.value = v;
        const readout = document.getElementById(`macro-val-${k}`);
        if (readout) readout.innerText = `${Math.round(v * 100)}%`;
      });
    }
    this.updateSnapshotButtons();
  }

  updateSnapshotButtons() {
    this.container?.querySelectorAll(".snapshot-btn").forEach((btn) => {
      const i = parseInt(btn.getAttribute("data-snapshot"));
      const hasData = !!(multiLayerEngine.snapshots && multiLayerEngine.snapshots[i]);
      const isActive = multiLayerEngine.activeSnapshotIndex === i;
      btn.classList.toggle("has-data", hasData);
      btn.classList.toggle("active", isActive);
    });
  }

  bindEvents() {
    // View mode toggle
    this.container.querySelectorAll(".view-mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-view");
        this.viewMode = mode;
        localStorage.setItem("wilsonix_combi_view_mode", mode);
        this.render();
        this.bindEvents();
      });
    });

    // Macro sliders
    this.container.querySelectorAll(".macro-slider").forEach((sl) => {
      sl.addEventListener("input", (e) => {
        const key = sl.getAttribute("data-macro");
        const val = parseFloat(e.target.value);
        this.setMacro(key, val);
        const readout = document.getElementById(`macro-val-${key}`);
        if (readout) readout.innerText = `${Math.round(val * 100)}%`;
        this.syncActiveScene();
      });
    });
    this.applyAllMacros();

    // Snapshot buttons (Click to recall, contextmenu/long-press to save)
    this.container.querySelectorAll(".snapshot-btn").forEach((btn) => {
      const idx = parseInt(btn.getAttribute("data-snapshot"));
      btn.addEventListener("click", () => {
        this.recallSnapshot(idx);
      });
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.saveSnapshot(idx);
      });
    });

    // Combi search (debounced: filter visible results, no full DOM rebuild)
    const searchInput = this.container.querySelector("#combi-search-input");
    searchInput?.addEventListener("input", (e) => {
      this.combiSearchQuery = e.target.value;
      clearTimeout(this._searchDebounce);
      this._searchDebounce = setTimeout(() => {
        this.filterProgramGrid();
        const newInput = this.container.querySelector("#combi-search-input");
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(
            newInput.value.length,
            newInput.value.length,
          );
        }
      }, 160);
    });

    // Combi search chip clicks
    this.container.querySelectorAll("[data-combi-search]").forEach((btn) => {
      this._bindCombiChip(btn);
    });

    // Combi preset selector + steppers
    const presetSelect = this.container.querySelector("#combi-preset-select");
    presetSelect?.addEventListener("mousedown", () => {
      const ids = Object.keys(COMBI_PRESETS);
      const cur = Math.max(0, multiLayerEngine.activeCombi?.id ? ids.indexOf(multiLayerEngine.activeCombi.id) : 0);
      for (const d of [-1, 1]) {
        const id = ids[(cur + d + ids.length) % ids.length];
        if (id) multiLayerEngine.preloadCombi(id);
      }
    });
    presetSelect?.addEventListener("change", (e) => {
      if (!e.target.value) return;
      multiLayerEngine.setCombiPreset(e.target.value);
      this.combiSearchQuery = "";
      this.updateCombiSelectorActive();
    });
    const stepPreset = (delta) => {
      const ids = Object.keys(COMBI_PRESETS);
      const cur = Math.max(0, multiLayerEngine.activeCombi?.id ? ids.indexOf(multiLayerEngine.activeCombi.id) : 0);
      const next = ids[(cur + delta + ids.length) % ids.length];
      multiLayerEngine.setCombiPreset(next);
      this.updateCombiSelectorActive();
    };
    this.container
      .querySelector("#combi-prev-btn")
      ?.addEventListener("click", () => stepPreset(-1));
    this.container
      .querySelector("#combi-next-btn")
      ?.addEventListener("click", () => stepPreset(1));
      
    this.container.querySelector("#init-layers-btn")?.addEventListener("click", async () => {
      const ok = await CustomModal.confirm("Clear Layers", "Are you sure you want to clear all layers and initialize a blank stack?");
      if (!ok) return;
      multiLayerEngine.clearAllLayers();
      this.combiSearchQuery = "";
      this.updateCombiSelectorActive();
      this.render();
      this.bindEvents();
    });

    // Mount the Custom Patch Browser UI inside this tab
    setTimeout(() => {
      if (this.customPatchBrowser && typeof this.customPatchBrowser.destroy === "function") {
        this.customPatchBrowser.destroy();
        this.customPatchBrowser = null;
      }
      this.customPatchBrowser = new CustomPatchBrowserUI(
        "combi-custom-browser-mount",
        {
          multiLayerEngine,
          get fxRack() {
            return audioCore.fxRack;
          },
        },
      );
    }, 0);

    // Layer Mute / Power toggles
    this.container.querySelectorAll(".layer-power-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-layer"));
        multiLayerEngine.toggleLayer(idx);
        this.syncActiveScene();
        this.render();
        this.bindEvents();
      });
    });

    // Layer Solo toggles
    this.container.querySelectorAll(".layer-solo-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-layer"));
        multiLayerEngine.toggleLayerSolo(idx);
        this.render();
        this.bindEvents();
      });
    });

    // Instrument Pickers (modal popup trigger)
    this.bindTimbreTriggers();

    // Effects Combo Box Pickers per Rack
    this.container.querySelectorAll(".layer-fx-select").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const idx = parseInt(sel.getAttribute("data-layer"));
        multiLayerEngine.setLayerFx(idx, e.target.value);
      });
    });

    // Volume Faders (supports both vertical fader and horizontal fader in perform mode)
    this.container.querySelectorAll(".layer-gain-slider").forEach((fader) => {
      fader.addEventListener("input", (e) => {
        const idx = parseInt(fader.getAttribute("data-layer"));
        const val = parseFloat(e.target.value);
        multiLayerEngine.setLayerGain(idx, val);
        const readout1 = document.getElementById(`fader-val-${idx}`);
        if (readout1) readout1.innerText = `${Math.round(val * 100)}%`;
        const readout2 = document.getElementById(`perf-fader-val-${idx}`);
        if (readout2) readout2.innerText = `${Math.round(val * 100)}%`;
        this.syncActiveScene();
      });
    });

    // Octave Shift Buttons
    this.container
      .querySelectorAll(".oct-mini-btn[data-layer]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-layer"));
          const delta = parseInt(btn.getAttribute("data-oct"));
          const currentOct = multiLayerEngine.layers[idx].oct || 0;
          multiLayerEngine.setLayerOctave(idx, currentOct + delta);
          const octVal1 = document.getElementById(`oct-val-${idx}`);
          if (octVal1)
            octVal1.innerText = `${multiLayerEngine.layers[idx].oct >= 0 ? "+" : ""}${multiLayerEngine.layers[idx].oct}`;
          const octVal2 = document.getElementById(`perf-oct-val-${idx}`);
          if (octVal2)
            octVal2.innerText = `${multiLayerEngine.layers[idx].oct >= 0 ? "+" : ""}${multiLayerEngine.layers[idx].oct}`;
        });
      });

    // ---- Split Keyboard Console ----
    const splitPowerBtn = this.container.querySelector("#split-power-btn");
    splitPowerBtn?.addEventListener("click", () => {
      multiLayerEngine.toggleSplitMode(!multiLayerEngine.isSplitMode);
      this.render();
      this.bindEvents();
    });

    const splitPointSelect = this.container.querySelector(
      "#split-point-select",
    );
    splitPointSelect?.addEventListener("change", (e) => {
      multiLayerEngine.setSplitPointMidi(parseInt(e.target.value));
    });

    this.container.querySelectorAll(".split-zone-fx").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const zone = sel.getAttribute("data-split-zone");
        multiLayerEngine.setSplitZoneFx(zone, e.target.value);
      });
    });

    this.container.querySelectorAll(".split-zone-gain").forEach((sl) => {
      sl.addEventListener("input", (e) => {
        const zone = sl.getAttribute("data-split-gain");
        const val = parseFloat(e.target.value);
        multiLayerEngine.setSplitZoneGain(zone, val);
        const readout = document.getElementById(`split-gain-val-${zone}`);
        if (readout) readout.innerText = `${Math.round(val * 100)}%`;
      });
    });

    this.container
      .querySelectorAll(".oct-mini-btn[data-split-oct]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const zone = btn.getAttribute("data-split-oct");
          const delta = parseInt(btn.getAttribute("data-oct"));
          const currentOct = multiLayerEngine.splitZones[zone].oct || 0;
          multiLayerEngine.setSplitZoneOctave(zone, currentOct + delta);
          const octVal = document.getElementById(`split-oct-val-${zone}`);
          if (octVal)
            octVal.innerText = `${multiLayerEngine.splitZones[zone].oct >= 0 ? "+" : ""}${multiLayerEngine.splitZones[zone].oct}`;
        });
      });
  }

  bindTimbreTriggers() {
    this.container.querySelectorAll(".timbre-picker-trigger").forEach((btn) => {
      btn.addEventListener("click", () => {
        const zoneKey = btn.getAttribute("data-split-zone");
        const layerIdx = zoneKey ? null : parseInt(btn.getAttribute("data-layer") || "0", 10);

        if (zoneKey) {
          const zone = multiLayerEngine.splitZones[zoneKey];
          timbreSearchModal.open({
            zoneKey,
            currentInst: zone?.inst,
            currentName: zone?.name || "Follow Current Stack",
            onSelect: (val) => {
              if (val === "current_stack") {
                multiLayerEngine.setSplitZoneStack(zoneKey);
              } else {
                multiLayerEngine.setSplitZoneInstrument(zoneKey, val);
              }
              this.render();
              this.bindEvents();
            },
          });
        } else {
          const layer = multiLayerEngine.layers[layerIdx];
          timbreSearchModal.open({
            layerIndex: layerIdx,
            currentInst: layer?.inst,
            currentName: layer?.name,
            onSelect: (val) => {
              multiLayerEngine.setLayerInstrument(layerIdx, val);
              this.render();
              this.bindEvents();
            },
          });
        }
      });
    });
  }

  updateLayerFaders() {
    const presetSelect = this.container.querySelector("#combi-preset-select");
    if (presetSelect && multiLayerEngine.activeCombi?.id) {
      const exists = [...presetSelect.options].some(
        (o) => o.value === multiLayerEngine.activeCombi.id,
      );
      if (exists) presetSelect.value = multiLayerEngine.activeCombi.id;
    }
    multiLayerEngine.layers.forEach((l, i) => {
      const fader = this.container.querySelector(
        `.layer-gain-slider[data-layer="${i}"]`,
      );
      const readout = document.getElementById(`fader-val-${i}`);
      const perfReadout = document.getElementById(`perf-fader-val-${i}`);
      if (fader) fader.value = l.gain;
      if (readout) readout.innerText = `${Math.round(l.gain * 100)}%`;
      if (perfReadout) perfReadout.innerText = `${Math.round(l.gain * 100)}%`;

      const fxSelect = this.container.querySelector(
        `.layer-fx-select[data-layer="${i}"]`,
      );
      if (fxSelect && l.fx) fxSelect.value = l.fx;

      const trigger = this.container.querySelector(
        `.timbre-picker-trigger[data-layer="${i}"]`,
      );
      const displayName = getTimbreDisplayName(l.inst, l.name);
      if (trigger) {
        const nameSpan = trigger.querySelector(".timbre-trigger-name");
        const badgeSpan = trigger.querySelector(".timbre-trigger-badge");
        if (nameSpan) nameSpan.textContent = displayName;
        if (badgeSpan) {
          const isVa = l.inst?.startsWith("va:");
          badgeSpan.className = `timbre-trigger-badge ${isVa ? "badge-va" : "badge-pcm"}`;
          badgeSpan.textContent = isVa ? "VA" : "PCM";
        }
      }

      const nameEl = this.container.querySelector(
        `.strip-layer-name[data-layer="${i}"]`,
      );
      if (nameEl) {
        nameEl.innerText = displayName;
        nameEl.title = displayName;
      }

      const strip = document.getElementById(`layer-strip-${i}`);
      const perfRow = document.getElementById(`perform-layer-${i}`);
      const hasSolo = multiLayerEngine.layers.some((l) => l.solo);
      [strip, perfRow].forEach((el) => {
        if (!el) return;
        el.classList.toggle("active", !!l.enabled);
        el.classList.toggle("muted", !l.enabled);
        el.classList.toggle("is-soloed", !!l.solo);
        el.classList.toggle("solo-dimmed", hasSolo && !l.solo);
      });

      const powerBtns = this.container.querySelectorAll(
        `.layer-power-btn[data-layer="${i}"]`,
      );
      powerBtns.forEach((btn) => {
        btn.classList.toggle("active", !!l.enabled);
        btn.innerText = l.enabled ? "ON" : "MUTE";
      });

      const soloBtns = this.container.querySelectorAll(
        `.layer-solo-btn[data-layer="${i}"]`,
      );
      soloBtns.forEach((btn) => {
        btn.classList.toggle("active", !!l.solo);
      });

      const octVal = document.getElementById(`oct-val-${i}`);
      const perfOctVal = document.getElementById(`perf-oct-val-${i}`);
      const oct = l.oct || 0;
      const octText = `${oct >= 0 ? "+" : ""}${oct}`;
      if (octVal) octVal.innerText = octText;
      if (perfOctVal) perfOctVal.innerText = octText;
    });
  }

  triggerLayerActivity(layerIdx, vel, gain) {
    const leds = [
      document.getElementById(`sig-led-${layerIdx}`),
      document.getElementById(`sig-led-perf-${layerIdx}`),
    ].filter(Boolean);
    if (leds.length > 0) {
      leds.forEach((led) => led.classList.add("active"));
      clearTimeout(this._ledTimers?.[layerIdx]);
      if (!this._ledTimers) this._ledTimers = {};
      this._ledTimers[layerIdx] = setTimeout(() => {
        leds.forEach((led) => led.classList.remove("active"));
      }, 150);
    }
    const fill = document.getElementById(`meter-fill-${layerIdx}`);
    if (fill) {
      const pct = Math.min(100, Math.max(15, Math.round((vel / 127) * Math.min(1.25, gain || 1.0) * 100)));
      fill.style.height = `${pct}%`;
      clearTimeout(this._meterTimers?.[layerIdx]);
      if (!this._meterTimers) this._meterTimers = {};
      this._meterTimers[layerIdx] = setTimeout(() => {
        fill.style.height = "0%";
      }, 260);
    }
  }

  updateCombiSelectorActive() {
    const presetSelect = this.container.querySelector("#combi-preset-select");
    if (presetSelect && multiLayerEngine.activeCombi?.id) {
      const exists = [...presetSelect.options].some(
        (o) => o.value === multiLayerEngine.activeCombi.id,
      );
      if (exists) presetSelect.value = multiLayerEngine.activeCombi.id;
    }
    this.container.querySelectorAll("[data-combi-search]").forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.getAttribute("data-combi-search") ===
          multiLayerEngine.activeCombi?.id,
      );
    });
    this.filterProgramGrid();
  }

  /**
   * Shared chip binder: click selects the preset; pointerenter/pointerdown
   * speculatively prefetch+decode it (P1). Used by bindEvents AND
   * filterProgramGrid, because filterProgramGrid rebuilds the chips container
   * and any new chips must carry the prefetch handlers too.
   */
  _bindCombiChip(btn) {
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener("pointerenter", () => {
      multiLayerEngine.preloadCombi(btn.getAttribute("data-combi-search"));
    });
    btn.addEventListener("pointerdown", () => {
      multiLayerEngine.preloadCombi(btn.getAttribute("data-combi-search"));
    });
    btn.addEventListener("click", () => {
      multiLayerEngine.setCombiPreset(btn.getAttribute("data-combi-search"));
      this.combiSearchQuery = "";
      this.updateCombiSelectorActive();
    });
  }

  filterProgramGrid() {
    // Rebuild-free filter: updates the combi preset <select> and the search
    // result chips for the current query. CRITICAL FIX: the original method
    // definition was lost in an earlier refactor — its call sites (the search
    // debounce + updateCombiSelectorActive) threw a TypeError on every search
    // keystroke and preset switch.
    const q = (this.combiSearchQuery || "").toLowerCase();
    const allPresets = Object.values(COMBI_PRESETS);
    const catOrder = [];
    allPresets.forEach((cp) => {
      if (cp.category && !catOrder.includes(cp.category))
        catOrder.push(cp.category);
    });

    // P1: skip the whole rebuild when the filtered set is unchanged — the
    // search debounce can fire on edits that don't change the result list
    // (e.g. a trailing space), and rebuilding 56 <option>s + re-binding for
    // the same set is wasted main-thread work.
    const visibleIds = [];
    catOrder.forEach((cat) => {
      allPresets
        .filter((cp) => cp.category === cat)
        .filter(
          (cp) =>
            !q ||
            cp.name.toLowerCase().includes(q) ||
            cp.category.toLowerCase().includes(q),
        )
        .forEach((cp) => visibleIds.push(cp.id));
    });
    const sig = `${q}::${visibleIds.join(",")}`;
    if (sig === this._lastFilterSig) return;
    this._lastFilterSig = sig;

    const presetSelect = this.container?.querySelector("#combi-preset-select");
    if (presetSelect) {
      presetSelect.innerHTML = catOrder
        .map(
          (cat) => `
          <optgroup label="${esc(cat)}">
            ${allPresets
              .filter((cp) => cp.category === cat)
              .filter(
                (cp) =>
                  !q ||
                  cp.name.toLowerCase().includes(q) ||
                  cp.category.toLowerCase().includes(q),
              )
              .map(
                (cp) =>
                  `<option value="${esc(cp.id)}" ${multiLayerEngine.activeCombi?.id === cp.id ? "selected" : ""}>${esc(cp.name)}</option>`,
              )
              .join("")}
          </optgroup>
        `,
        )
        .join("");
    }

    let results = this.container?.querySelector("#combi-search-results");
    if (!results && q) {
      results = document.createElement("div");
      results.className = "combi-search-results";
      results.id = "combi-search-results";
      const userBar = this.container?.querySelector(".user-presets-bar");
      userBar?.parentNode?.insertBefore(results, userBar);
    }
    if (results) {
      results.innerHTML = !q
        ? ""
        : allPresets
            .filter(
              (cp) =>
                cp.name.toLowerCase().includes(q) ||
                (cp.category && cp.category.toLowerCase().includes(q)),
            )
            .slice(0, 15)
            .map(
              (cp) =>
                `<button class="combi-search-chip ${multiLayerEngine.activeCombi?.id === cp.id ? "active" : ""}" data-combi-search="${esc(cp.id)}">${esc(cp.name)}</button>`,
            )
            .join("");

      results.querySelectorAll("[data-combi-search]").forEach((btn) => {
        this._bindCombiChip(btn);
      });
    }
  }
}
