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

    const allPresets = Object.values(COMBI_PRESETS);
    const catOrder = [];
    allPresets.forEach(cp => {
      if (cp.category && !catOrder.includes(cp.category)) catOrder.push(cp.category);
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
            <select class="combi-preset-select" id="combi-preset-select" title="Choose combi preset">
              ${catOrder
                .map(
                  cat => `
                <optgroup label="${cat}">
                  ${allPresets
                    .filter(cp => cp.category === cat)
                    .map(
                      cp => `
                    <option value="${cp.id}" ${multiLayerEngine.activeCombi.id === cp.id ? "selected" : ""}>
                      ${cp.name}
                    </option>
                  `
                    )
                    .join("")}
                </optgroup>
              `
                )
                .join("")}
            </select>
            <button class="preset-arrow-btn" id="combi-next-btn" title="Next preset">▶</button>
          </div>
        </div>

        <!-- My Presets (localStorage) -->
        <div class="user-presets-bar">
          <span class="combi-pill">MY PRESETS</span>
          <input id="user-preset-name" class="user-preset-input" maxlength="40" placeholder="Stack name..." />
          <button class="combi-preset-btn" id="save-user-preset-btn">+ SAVE CURRENT STACK</button>
          <div class="user-preset-list">
            ${multiLayerEngine.getUserPresets()
              .map(
                up => `
              <span class="user-preset-chip ${multiLayerEngine.activeCombi.id === up.id ? "active" : ""}">
                <button class="user-preset-load" data-user-preset="${up.id}" title="Load ${up.name}">${up.name}</button>
                <button class="user-preset-del" data-user-del="${up.id}" title="Delete">✕</button>
              </span>
            `
              )
              .join("")}
          </div>
        </div>

        <!-- Gig Setlist (localStorage, ordered) -->
        <div class="setlist-bar">
          <span class="combi-pill">SETLIST</span>
          <button class="combi-preset-btn" id="setlist-add-btn">+ ADD CURRENT</button>
          <button class="combi-preset-btn" id="setlist-clear-btn">CLEAR</button>
          <ol class="setlist-list">
            ${multiLayerEngine.getSetlist()
              .map(
                (entry, i) => `
              <li class="setlist-entry" data-setlist-idx="${i}">
                <button class="setlist-load" data-setlist-load="${i}" title="Load">${i + 1}. ${entry.name || entry.id}</button>
                <button class="setlist-move" data-setlist-move="${i}|-1" title="Move up">▲</button>
                <button class="setlist-move" data-setlist-move="${i}|1" title="Move down">▼</button>
                <button class="setlist-del" data-setlist-del="${i}" title="Remove">✕</button>
              </li>
            `
              )
              .join("")}
          </ol>
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
    // Combi preset selector + steppers
    const presetSelect = this.container.querySelector("#combi-preset-select");
    presetSelect?.addEventListener("change", e => {
      multiLayerEngine.setCombiPreset(e.target.value);
      this.render();
      this.bindEvents();
    });
    const stepPreset = delta => {
      const ids = Object.keys(COMBI_PRESETS);
      const cur = Math.max(0, ids.indexOf(multiLayerEngine.activeCombi.id));
      const next = ids[(cur + delta + ids.length) % ids.length];
      multiLayerEngine.setCombiPreset(next);
      this.render();
      this.bindEvents();
    };
    this.container.querySelector("#combi-prev-btn")?.addEventListener("click", () => stepPreset(-1));
    this.container.querySelector("#combi-next-btn")?.addEventListener("click", () => stepPreset(1));

    // My Presets: save / load / delete
    const rerender = () => {
      this.render();
      this.bindEvents();
    };
    this.container.querySelector("#save-user-preset-btn")?.addEventListener("click", () => {
      const input = this.container.querySelector("#user-preset-name");
      multiLayerEngine.saveUserPreset(input?.value);
      rerender();
    });
    this.container.querySelectorAll("[data-user-preset]").forEach(btn => {
      btn.addEventListener("click", () => {
        multiLayerEngine.applyUserPreset(btn.getAttribute("data-user-preset"));
        rerender();
      });
    });
    this.container.querySelectorAll("[data-user-del]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        multiLayerEngine.deleteUserPreset(btn.getAttribute("data-user-del"));
        rerender();
      });
    });

    // Setlist: add current / load / reorder / remove / clear
    this.container.querySelector("#setlist-add-btn")?.addEventListener("click", () => {
      const list = multiLayerEngine.getSetlist();
      list.push(multiLayerEngine.currentStackSnapshot());
      multiLayerEngine.saveSetlist(list);
      rerender();
    });
    this.container.querySelector("#setlist-clear-btn")?.addEventListener("click", () => {
      multiLayerEngine.saveSetlist([]);
      rerender();
    });
    this.container.querySelectorAll("[data-setlist-load]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-setlist-load"));
        multiLayerEngine.applySetlistEntry(multiLayerEngine.getSetlist()[idx]);
        rerender();
      });
    });
    this.container.querySelectorAll("[data-setlist-move]").forEach(btn => {
      btn.addEventListener("click", () => {
        const [idx, delta] = btn.getAttribute("data-setlist-move").split("|").map(Number);
        multiLayerEngine.moveSetlistEntry(idx, delta);
        rerender();
      });
    });
    this.container.querySelectorAll("[data-setlist-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        multiLayerEngine.removeSetlistEntry(parseInt(btn.getAttribute("data-setlist-del")));
        rerender();
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
    const presetSelect = this.container.querySelector("#combi-preset-select");
    if (presetSelect && multiLayerEngine.activeCombi?.id) {
      const exists = [...presetSelect.options].some(o => o.value === multiLayerEngine.activeCombi.id);
      if (exists) presetSelect.value = multiLayerEngine.activeCombi.id;
    }
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
