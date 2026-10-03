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
    this._bindDocClickOutside();
    this.render();
    this.bindEvents();

    this._layerChangeListener = () => {
      this.updateLayerFaders();
    };
    multiLayerEngine.addLayerChangeListener(this._layerChangeListener);
    multiLayerEngine.onLayerChangeCallback = this._layerChangeListener;

    multiLayerEngine.onLayerActivityCallback = (layerIdx, vel, gain) => {
      this.triggerLayerActivity(layerIdx, vel, gain);
    };

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
    if (this._outsideClickHandler) {
      document.removeEventListener("click", this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    if (this._splitListener) {
      multiLayerEngine.removeSplitChangeListener(this._splitListener);
      this._splitListener = null;
    }
    if (multiLayerEngine.onLayerChangeCallback) {
      multiLayerEngine.onLayerChangeCallback = null;
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

    this.container.innerHTML = `
      <div class="combi-layers-console">
        <!-- Combi Header & Compact Preset Selector -->
        <div class="combi-header-bar">
          <div class="combi-title-group">
            <span class="combi-pill">WORKSTATION COMBI</span>
            <span class="combi-main-title">4-TIMBRE MULTI-LAYER INPUT MATRIX</span>
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
                    <option value="${esc(cp.id)}" ${multiLayerEngine.activeCombi.id === cp.id ? "selected" : ""}>
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
                `<button class="combi-search-chip ${multiLayerEngine.activeCombi.id === cp.id ? "active" : ""}" data-combi-search="${esc(cp.id)}">${esc(cp.name)}</button>`,
            )
            .join("")}
        </div>`
            : ""
        }

        <!-- Combi Split View: Left Panel (Browser) + Right Panel (Workstation Strips) -->
        <div style="display: flex; flex-direction: row; gap: 12px; width: 100%; height: 100%; overflow: hidden; padding-bottom: 10px;">
          
          <!-- Custom Patch Browser (Setlist + Drone) -->
          <div id="combi-custom-browser-mount" style="flex: 0 0 280px; background: #0b0f17; border-radius: 8px; border: 1px solid #1a2233; display: flex; flex-direction: column; overflow: hidden; height: 100%;"></div>

          <!-- Right Panel: Stack Layers & Split Zones -->
          <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; overflow-x: hidden;">
            <!-- 4 Layer Channel Strips (Ableton / Workstation Style) -->
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

              <!-- Instrument Picker (Touch-friendly trigger: opens Soundbank Popup Modal) -->
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

              <!-- Dedicated Layer Effects Combo Box (Rack FX Insert) -->
              <div class="strip-fx-picker">
                <label class="strip-picker-label">INSERT EFFECT / DSP</label>
                <select class="layer-fx-select" data-layer="${idx}">
                  ${(() => {
                    const fxList = Object.values(LAYER_FX_OPTIONS);
                    const fxCats = [];
                    fxList.forEach((f) => {
                      const cat = f.category || "General FX";
                      if (!fxCats.includes(cat)) fxCats.push(cat);
                    });
                    // Put Synthesizer You FX at very top
                    fxCats.sort((a, b) =>
                      a.includes("Synthesizer You")
                        ? -1
                        : b.includes("Synthesizer You")
                          ? 1
                          : 0,
                    );
                    return fxCats
                      .map(
                        (cat) => `
                      <optgroup label="${cat.toUpperCase()}">
                        ${fxList
                          .filter((f) => (f.category || "General FX") === cat)
                          .map(
                            (f) => `
                          <option value="${f.id}" ${layer.fx === f.id ? "selected" : ""}>
                            ${f.name}
                          </option>
                        `,
                          )
                          .join("")}
                      </optgroup>
                    `,
                      )
                      .join("");
                  })()}
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

        <!-- Split Keyboard Zones Console (assignable instrument + insert FX per half) -->
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
              <select class="split-point-select" id="split-point-select" title="Split point (notes below → LOWER zone, at/above → UPPER zone)">
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
          </div> <!-- End Right Panel (Column) -->
        </div> <!-- End Flex Row Split View -->
      </div>
    `;
  }

  bindEvents() {
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
    // Speculative prefetch (P1): while the user is choosing in the dropdown,
    // decode the presets adjacent to the current selection (budget-guarded).
    presetSelect?.addEventListener("mousedown", () => {
      const ids = Object.keys(COMBI_PRESETS);
      const cur = Math.max(0, ids.indexOf(multiLayerEngine.activeCombi.id));
      for (const d of [-1, 1]) {
        const id = ids[(cur + d + ids.length) % ids.length];
        if (id) multiLayerEngine.preloadCombi(id);
      }
    });
    presetSelect?.addEventListener("change", (e) => {
      multiLayerEngine.setCombiPreset(e.target.value);
      this.combiSearchQuery = "";
      this.updateCombiSelectorActive();
    });
    const stepPreset = (delta) => {
      const ids = Object.keys(COMBI_PRESETS);
      const cur = Math.max(0, ids.indexOf(multiLayerEngine.activeCombi.id));
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

    // Volume Faders
    this.container.querySelectorAll(".vertical-fader").forEach((fader) => {
      fader.addEventListener("input", (e) => {
        const idx = parseInt(fader.getAttribute("data-layer"));
        const val = parseFloat(e.target.value);
        multiLayerEngine.setLayerGain(idx, val);
        const readout = document.getElementById(`fader-val-${idx}`);
        if (readout) readout.innerText = `${Math.round(val * 100)}%`;
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
          const octVal = document.getElementById(`oct-val-${idx}`);
          if (octVal)
            octVal.innerText = `${multiLayerEngine.layers[idx].oct >= 0 ? "+" : ""}${multiLayerEngine.layers[idx].oct}`;
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
        `.vertical-fader[data-layer="${i}"]`,
      );
      const readout = document.getElementById(`fader-val-${i}`);
      if (fader) fader.value = l.gain;
      if (readout) readout.innerText = `${Math.round(l.gain * 100)}%`;

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
      const hasSolo = multiLayerEngine.layers.some((l) => l.solo);
      if (strip) {
        strip.classList.toggle("active", !!l.enabled);
        strip.classList.toggle("muted", !l.enabled);
        strip.classList.toggle("is-soloed", !!l.solo);
        strip.classList.toggle("solo-dimmed", hasSolo && !l.solo);
      }
      const powerBtn = this.container.querySelector(`.layer-power-btn[data-layer="${i}"]`);
      if (powerBtn) {
        powerBtn.classList.toggle("active", !!l.enabled);
        powerBtn.innerText = l.enabled ? "ON" : "MUTE";
      }
      const soloBtn = this.container.querySelector(`.layer-solo-btn[data-layer="${i}"]`);
      if (soloBtn) {
        soloBtn.classList.toggle("active", !!l.solo);
      }

      const octVal = document.getElementById(`oct-val-${i}`);
      if (octVal) {
        const oct = l.oct || 0;
        octVal.innerText = `${oct >= 0 ? "+" : ""}${oct}`;
      }
    });
  }

  triggerLayerActivity(layerIdx, vel, gain) {
    const led = document.getElementById(`sig-led-${layerIdx}`);
    if (led) {
      led.classList.add("active");
      clearTimeout(this._ledTimers?.[layerIdx]);
      if (!this._ledTimers) this._ledTimers = {};
      this._ledTimers[layerIdx] = setTimeout(() => {
        led.classList.remove("active");
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
                  `<option value="${esc(cp.id)}" ${multiLayerEngine.activeCombi.id === cp.id ? "selected" : ""}>${esc(cp.name)}</option>`,
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
                `<button class="combi-search-chip ${multiLayerEngine.activeCombi.id === cp.id ? "active" : ""}" data-combi-search="${esc(cp.id)}">${esc(cp.name)}</button>`,
            )
            .join("");

      results.querySelectorAll("[data-combi-search]").forEach((btn) => {
        this._bindCombiChip(btn);
      });
    }
  }
}
