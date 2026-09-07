/**
 * Workstation Multi-Layer (COMBI) Mixer Rack UI
 * Allows stacking up to 4 simultaneous sound layers with independent faders,
 * mute buttons, octave transpositions, and instrument selectors.
 */

import { multiLayerEngine, COMBI_PRESETS, HD_SOUNDBANKS } from "../audio/multi-layer-engine.js";
import { LAYER_FX_OPTIONS } from "../audio/native-pcm-engine.js";

export class MultiLayerUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
    this.bindEvents();

    multiLayerEngine.onLayerChangeCallback = () => {
      this.updateLayerFaders();
    };
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="combi-layers-console">
        <!-- Combi Header & Quick Presets -->
        <div class="combi-header-bar">
          <div class="combi-title-group">
            <span class="combi-pill">WORKSTATION COMBI</span>
            <span class="combi-main-title">4-TIMBRE MULTI-LAYER INPUT MATRIX</span>
          </div>

          <div class="combi-preset-strip">
            ${Object.values(COMBI_PRESETS)
              .map(
                cp => `
              <button class="combi-preset-btn ${multiLayerEngine.activeCombi.id === cp.id ? "active" : ""}" 
                      data-combi="${cp.id}">
                ${cp.name}
              </button>
            `
              )
              .join("")}
          </div>
        </div>

        <!-- 4 Layer Channel Strips (Ableton / Workstation Style) -->
        <div class="layer-strips-rack">
          ${multiLayerEngine.layers
            .map(
              (layer, idx) => `
            <div class="layer-channel-strip ${layer.enabled ? "active" : "muted"}" id="layer-strip-${idx}">
              <div class="strip-header">
                <button class="layer-power-btn ${layer.enabled ? "active" : ""}" data-layer="${idx}">
                  ${layer.enabled ? "ON" : "MUTE"}
                </button>
                <span class="strip-num">LAYER ${idx + 1}</span>
              </div>
              <div class="strip-layer-name" data-layer="${idx}" title="${layer.name}">${layer.name}</div>

              <!-- Instrument Picker -->
              <div class="strip-inst-picker">
                <label class="strip-picker-label">TIMBRE / SOUNDBANK</label>
                <select class="layer-inst-select" data-layer="${idx}">
                  ${Object.values(HD_SOUNDBANKS)
                    .map(
                      inst => `
                    <option value="${inst.id}" ${layer.inst === inst.id ? "selected" : ""}>
                      ${inst.name}
                    </option>
                  `
                    )
                    .join("")}
                </select>
              </div>

              <!-- Dedicated Layer Effects Combo Box (Rack FX Insert) -->
              <div class="strip-fx-picker">
                <label class="strip-picker-label">INSERT EFFECT / DSP</label>
                <select class="layer-fx-select" data-layer="${idx}">
                  ${Object.values(LAYER_FX_OPTIONS)
                    .map(
                      fx => `
                    <option value="${fx.id}" ${layer.fx === fx.id ? "selected" : ""}>
                      ${fx.name}
                    </option>
                  `
                    )
                    .join("")}
                </select>
              </div>

              <!-- Volume Fader & Meter -->
              <div class="strip-fader-bay">
                <div class="fader-track">
                  <input type="range" 
                         class="vertical-fader" 
                         orient="vertical" 
                         min="0" 
                         max="1.5" 
                         step="0.05" 
                         value="${layer.gain}" 
                         data-layer="${idx}"/>
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
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Combi Presets
    this.container.querySelectorAll(".combi-preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const combiId = btn.getAttribute("data-combi");
        multiLayerEngine.setCombiPreset(combiId);
        this.render();
        this.bindEvents();
      });
    });

    // Layer Mute / Power toggles
    this.container.querySelectorAll(".layer-power-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-layer"));
        multiLayerEngine.toggleLayer(idx);
        this.render();
        this.bindEvents();
      });
    });

    // Instrument Pickers
    this.container.querySelectorAll(".layer-inst-select").forEach(sel => {
      sel.addEventListener("change", e => {
        const idx = parseInt(sel.getAttribute("data-layer"));
        multiLayerEngine.setLayerInstrument(idx, e.target.value);
      });
    });

    // Effects Combo Box Pickers per Rack
    this.container.querySelectorAll(".layer-fx-select").forEach(sel => {
      sel.addEventListener("change", e => {
        const idx = parseInt(sel.getAttribute("data-layer"));
        multiLayerEngine.setLayerFx(idx, e.target.value);
      });
    });

    // Volume Faders
    this.container.querySelectorAll(".vertical-fader").forEach(fader => {
      fader.addEventListener("input", e => {
        const idx = parseInt(fader.getAttribute("data-layer"));
        const val = parseFloat(e.target.value);
        multiLayerEngine.setLayerGain(idx, val);
        const readout = document.getElementById(`fader-val-${idx}`);
        if (readout) readout.innerText = `${Math.round(val * 100)}%`;
      });
    });

    // Octave Shift Buttons
    this.container.querySelectorAll(".oct-mini-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-layer"));
        const delta = parseInt(btn.getAttribute("data-oct"));
        const currentOct = multiLayerEngine.layers[idx].oct || 0;
        multiLayerEngine.setLayerOctave(idx, currentOct + delta);
        const octVal = document.getElementById(`oct-val-${idx}`);
        if (octVal) octVal.innerText = `${multiLayerEngine.layers[idx].oct >= 0 ? "+" : ""}${multiLayerEngine.layers[idx].oct}`;
      });
    });
  }

  updateLayerFaders() {
    multiLayerEngine.layers.forEach((l, i) => {
      const fader = this.container.querySelector(`.vertical-fader[data-layer="${i}"]`);
      const readout = document.getElementById(`fader-val-${i}`);
      if (fader) fader.value = l.gain;
      if (readout) readout.innerText = `${Math.round(l.gain * 100)}%`;

      const fxSelect = this.container.querySelector(`.layer-fx-select[data-layer="${i}"]`);
      if (fxSelect && l.fx) fxSelect.value = l.fx;

      const instSelect = this.container.querySelector(`.layer-inst-select[data-layer="${i}"]`);
      if (instSelect && l.inst) instSelect.value = l.inst;

      const nameEl = this.container.querySelector(`.strip-layer-name[data-layer="${i}"]`);
      if (nameEl && l.name) {
        nameEl.innerText = l.name;
        nameEl.title = l.name;
      }

      const strip = document.getElementById(`layer-strip-${i}`);
      if (strip) strip.classList.toggle("active", !!l.enabled);
    });
  }
}
