/**
 * Workstation Multi-Layer (COMBI) Mixer Rack UI
 * Allows stacking up to 4 simultaneous sound layers with independent faders,
 * mute buttons, octave transpositions, and instrument selectors.
 */

import { multiLayerEngine, COMBI_PRESETS, COMBI_TIMBRES } from "../audio/multi-layer-engine.js";
import { LAYER_FX_OPTIONS } from "../audio/native-pcm-engine.js";

const esc = s => String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiName = m => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

const fxOptionsHTML = selectedIx => {
  const fxList = Object.values(LAYER_FX_OPTIONS);
  const fxCats = [];
  fxList.forEach(f => {
    const cat = f.category || "General FX";
    if (!fxCats.includes(cat)) fxCats.push(cat);
  });
  fxCats.sort((a, b) => a.includes("Synthesizer You") ? -1 : (b.includes("Synthesizer You") ? 1 : 0));
  return fxCats.map(cat => `
    <optgroup label="${cat.toUpperCase()}">
      ${fxList.filter(f => (f.category || "General FX") === cat).map(f => `
        <option value="${f.id}" ${selectedIx === f.id ? "selected" : ""}>
          ${f.name}
        </option>
      `).join("")}
    </optgroup>
  `).join("");
};

export class MultiLayerUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.combiSearchQuery = "";
    this.render();
    this.bindEvents();

    multiLayerEngine.onLayerChangeCallback = () => {
      this.updateLayerFaders();
    };

    multiLayerEngine.addSplitChangeListener(() => {
      const consoleEl = document.getElementById("split-keyboard-console");
      if (consoleEl) consoleEl.classList.toggle("active", !!multiLayerEngine.isSplitMode);
      const powerBtn = document.getElementById("split-power-btn");
      if (powerBtn) {
        powerBtn.classList.toggle("active", !!multiLayerEngine.isSplitMode);
        powerBtn.innerText = multiLayerEngine.isSplitMode ? "SPLIT ON" : "SPLIT OFF";
      }
      const nameEl = document.getElementById("split-name-lower");
      if (nameEl && multiLayerEngine.splitZones.lower?.name) {
        nameEl.innerText = multiLayerEngine.splitZones.lower.name;
        nameEl.title = multiLayerEngine.splitZones.lower.name;
      }
      const nameUpper = document.getElementById("split-name-upper");
      if (nameUpper && multiLayerEngine.splitZones.upper) {
        const z = multiLayerEngine.splitZones.upper;
        const nm = (z.inst && z.inst !== "current_stack" && z.name) ? z.name : "Current Stack";
        nameUpper.innerText = nm;
        nameUpper.title = nm;
        nameUpper.closest(".split-zone-strip")?.classList.toggle("stack", !z.inst || z.inst === "current_stack");
      }
    });
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
            <input type="text" id="combi-search-input" class="combi-search-input" placeholder="Search presets..." value="${this.combiSearchQuery}" />
            <select class="combi-preset-select" id="combi-preset-select" title="Choose combi preset">
              ${catOrder
                .map(
                  cat => `
                <optgroup label="${cat}">
                  ${allPresets
                    .filter(cp => cp.category === cat)
                    .filter(cp => !this.combiSearchQuery || cp.name.toLowerCase().includes(this.combiSearchQuery.toLowerCase()) || (cp.category && cp.category.toLowerCase().includes(this.combiSearchQuery.toLowerCase())))
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

        <!-- Search results as chips (only when searching) -->
        ${this.combiSearchQuery ? `
        <div class="combi-search-results" id="combi-search-results">
          ${allPresets
            .filter(cp => cp.name.toLowerCase().includes(this.combiSearchQuery.toLowerCase()) || (cp.category && cp.category.toLowerCase().includes(this.combiSearchQuery.toLowerCase())))
            .slice(0, 15)
            .map(cp => `<button class="combi-search-chip ${multiLayerEngine.activeCombi.id === cp.id ? "active" : ""}" data-combi-search="${cp.id}">${cp.name}</button>`)
            .join("")}
        </div>` : ""}

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

              <!-- Instrument Picker (searchable: all PCM workstation banks + every Triton tab bank incl. VA) -->
              <div class="strip-inst-picker timbre-picker" data-layer="${idx}">
                <label class="strip-picker-label">TIMBRE / SOUNDBANK 🔍</label>
                <div class="timbre-combo">
                  <input type="text" class="timbre-combo-input" data-layer="${idx}"
                         placeholder="Search ${COMBI_TIMBRES.length} PCM + VA timbres..."
                         value="${esc(layer.name || "")}" autocomplete="off" spellcheck="false" />
                  <div class="timbre-combo-list" data-layer="${idx}"></div>
                </div>
              </div>

              <!-- Dedicated Layer Effects Combo Box (Rack FX Insert) -->
              <div class="strip-fx-picker">
                <label class="strip-picker-label">INSERT EFFECT / DSP</label>
                <select class="layer-fx-select" data-layer="${idx}">
                  ${(() => {
                    const fxList = Object.values(LAYER_FX_OPTIONS);
                    const fxCats = [];
                    fxList.forEach(f => {
                      const cat = f.category || "General FX";
                      if (!fxCats.includes(cat)) fxCats.push(cat);
                    });
                    // Put Synthesizer You FX at very top
                    fxCats.sort((a, b) => a.includes("Synthesizer You") ? -1 : (b.includes("Synthesizer You") ? 1 : 0));
                    return fxCats.map(cat => `
                      <optgroup label="${cat.toUpperCase()}">
                        ${fxList.filter(f => (f.category || "General FX") === cat).map(f => `
                          <option value="${f.id}" ${layer.fx === f.id ? "selected" : ""}>
                            ${f.name}
                          </option>
                        `).join("")}
                      </optgroup>
                    `).join("");
                  })()}
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
                    .map(m => `<option value="${m}" ${m === p ? "selected" : ""}>${midiName(m)}</option>`)
                    .join("");
                })()}
              </select>
            </div>
          </div>

          <div class="split-zones-row">
            ${
              ["lower", "upper"].map(zk => {
                const z = multiLayerEngine.splitZones[zk];
                const isStack = !z.inst || z.inst === "current_stack";
                return `
                <div class="layer-channel-strip split-zone-strip ${isStack ? "stack" : ""}" id="split-strip-${zk}">
                  <div class="strip-header">
                    <span class="strip-num">${zk === "lower" ? "LOWER ZONE" : "UPPER ZONE"} · ${zk === "lower" ? "BELOW POINT" : "AT/ABOVE POINT"}</span>
                  </div>
                  <div class="strip-layer-name split-zone-name" id="split-name-${zk}" title="${z.name || "Current Stack"}">${z.name || "Current Stack"}</div>
                  <div class="strip-inst-picker timbre-picker" data-split-zone="${zk}">
                    <label class="strip-picker-label">ZONE TIMBRE 🔍</label>
                    <div class="timbre-combo" data-split-zone="${zk}">
                      <input type="text" class="timbre-combo-input" data-split-zone="${zk}"
                             placeholder="Search ${COMBI_TIMBRES.length} PCM + VA timbres..."
                             value="${esc(isStack ? "Follow Current Stack" : (z.name || ""))}" autocomplete="off" spellcheck="false" />
                      <div class="timbre-combo-list" data-split-zone="${zk}"></div>
                    </div>
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
              }).join("")
            }
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Combi search (debounced: no full DOM rebuild per keystroke)
    const searchInput = this.container.querySelector("#combi-search-input");
    searchInput?.addEventListener("input", e => {
      this.combiSearchQuery = e.target.value;
      clearTimeout(this._searchDebounce);
      this._searchDebounce = setTimeout(() => {
        this.render();
        this.bindEvents();
        // Refocus search input
        const newInput = this.container.querySelector("#combi-search-input");
        if (newInput) { newInput.focus(); newInput.setSelectionRange(newInput.value.length, newInput.value.length); }
      }, 160);
    });

    // Combi search chip clicks
    this.container.querySelectorAll("[data-combi-search]").forEach(btn => {
      btn.addEventListener("click", () => {
        multiLayerEngine.setCombiPreset(btn.getAttribute("data-combi-search"));
        this.combiSearchQuery = "";
        this.render();
        this.bindEvents();
      });
    });

    // Combi preset selector + steppers
    const presetSelect = this.container.querySelector("#combi-preset-select");
    presetSelect?.addEventListener("change", e => {
      multiLayerEngine.setCombiPreset(e.target.value);
      this.combiSearchQuery = "";
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

    // Instrument Pickers (searchable timbre combobox)
    this.bindTimbreCombos();

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
    this.container.querySelectorAll(".oct-mini-btn[data-layer]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-layer"));
        const delta = parseInt(btn.getAttribute("data-oct"));
        const currentOct = multiLayerEngine.layers[idx].oct || 0;
        multiLayerEngine.setLayerOctave(idx, currentOct + delta);
        const octVal = document.getElementById(`oct-val-${idx}`);
        if (octVal) octVal.innerText = `${multiLayerEngine.layers[idx].oct >= 0 ? "+" : ""}${multiLayerEngine.layers[idx].oct}`;
      });
    });

    // ---- Split Keyboard Console ----
    const splitPowerBtn = this.container.querySelector("#split-power-btn");
    splitPowerBtn?.addEventListener("click", () => {
      multiLayerEngine.toggleSplitMode(!multiLayerEngine.isSplitMode);
      this.render();
      this.bindEvents();
    });

    const splitPointSelect = this.container.querySelector("#split-point-select");
    splitPointSelect?.addEventListener("change", e => {
      multiLayerEngine.setSplitPointMidi(parseInt(e.target.value));
    });

    this.container.querySelectorAll(".split-zone-fx").forEach(sel => {
      sel.addEventListener("change", e => {
        const zone = sel.getAttribute("data-split-zone");
        multiLayerEngine.setSplitZoneFx(zone, e.target.value);
      });
    });

    this.container.querySelectorAll(".split-zone-gain").forEach(sl => {
      sl.addEventListener("input", e => {
        const zone = sl.getAttribute("data-split-gain");
        const val = parseFloat(e.target.value);
        multiLayerEngine.setSplitZoneGain(zone, val);
        const readout = document.getElementById(`split-gain-val-${zone}`);
        if (readout) readout.innerText = `${Math.round(val * 100)}%`;
      });
    });

    this.container.querySelectorAll(".oct-mini-btn[data-split-oct]").forEach(btn => {
      btn.addEventListener("click", () => {
        const zone = btn.getAttribute("data-split-oct");
        const delta = parseInt(btn.getAttribute("data-oct"));
        const currentOct = multiLayerEngine.splitZones[zone].oct || 0;
        multiLayerEngine.setSplitZoneOctave(zone, currentOct + delta);
        const octVal = document.getElementById(`split-oct-val-${zone}`);
        if (octVal) octVal.innerText = `${multiLayerEngine.splitZones[zone].oct >= 0 ? "+" : ""}${multiLayerEngine.splitZones[zone].oct}`;
      });
    });
  }

  bindTimbreCombos() {
    this.container.querySelectorAll(".timbre-combo").forEach(combo => {
      const input = combo.querySelector(".timbre-combo-input");
      const list = combo.querySelector(".timbre-combo-list");
      if (!input || !list) return;

      const zoneKey = combo.getAttribute("data-split-zone");
      const layerIdx = zoneKey
        ? null
        : parseInt((combo.getAttribute("data-layer") || input.getAttribute("data-layer") || "0"));

      const selectedValue = () => zoneKey
        ? multiLayerEngine.splitZones[zoneKey]?.inst
        : multiLayerEngine.layers[layerIdx]?.inst;
      const selectedName = () => zoneKey
        ? multiLayerEngine.splitZones[zoneKey]?.name
        : multiLayerEngine.layers[layerIdx]?.name;
      const isStackMode = zoneKey && (!selectedValue() || selectedValue() === "current_stack");

      const close = () => list.classList.remove("open");

      const renderList = () => {
        const q = input.value.trim().toLowerCase();
        let items = COMBI_TIMBRES.filter(t =>
          !q ||
          (t.name && t.name.toLowerCase().includes(q)) ||
          (t.bank || "").toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q) ||
          (t.code || "").toLowerCase().includes(q)
        );
        items = items.slice(0, 60);
        const selVal = selectedValue();
        const selName = selectedName();

        const stackRow = zoneKey
          ? `<div class="timbre-opt ${isStackMode ? "selected" : ""}" data-value="current_stack">
              <span class="timbre-opt-name">Follow Current Stack</span>
              <span class="timbre-opt-meta">▸ PLAYS THE ACTIVE COMBI / SINGLE PROGRAM</span>
            </div>`
          : "";

        const rows = items.map(
          t => `
          <div class="timbre-opt ${t.value === selVal || (selName && t.name === selName) ? "selected" : ""}" data-value="${esc(t.value)}">
            <span class="timbre-opt-name">${esc(t.name)}</span>
            <span class="timbre-opt-meta">${t.kind === "va" ? "⚙ VA OSCILLATOR" : "▤ PCM / SAMPLE"} · ${esc(t.bank)}${t.code ? " · " + esc(t.code) : ""}</span>
          </div>`
        ).join("");

        if (!rows && !stackRow) {
          list.innerHTML = `<div class="timbre-opt-empty">No timbres match "${esc(input.value)}" — try program names or codes like "A000"</div>`;
          list.classList.add("open");
          return;
        }
        list.innerHTML = stackRow + rows;
        list.classList.add("open");
      };

      const selectOption = optEl => {
        if (!optEl) return;
        const value = optEl.getAttribute("data-value");
        if (zoneKey) {
          if (value === "current_stack") {
            multiLayerEngine.setSplitZoneStack(zoneKey);
          } else {
            multiLayerEngine.setSplitZoneInstrument(zoneKey, value);
          }
          const nameEl = optEl.querySelector(".timbre-opt-name");
          if (nameEl) input.value = nameEl.textContent;
        } else {
          multiLayerEngine.setLayerInstrument(layerIdx, value);
          const nameEl = optEl.querySelector(".timbre-opt-name");
          if (nameEl) input.value = nameEl.textContent;
        }
        close();
        input.focus();
      };

      input.addEventListener("focus", renderList);
      input.addEventListener("input", renderList);
      input.addEventListener("click", () => { if (!list.classList.contains("open")) renderList(); });
      input.addEventListener("blur", close);

      input.addEventListener("keydown", e => {
        const opts = [...list.querySelectorAll(".timbre-opt")];
        if (!opts.length) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const cur = opts.findIndex(o => o.classList.contains("active"));
          const next = e.key === "ArrowDown" ? (cur + 1) % opts.length : (cur <= 0 ? opts.length - 1 : cur - 1);
          opts.forEach((o, i) => o.classList.toggle("active", i === next));
          opts[next]?.scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
          e.preventDefault();
          const active = opts.find(o => o.classList.contains("active")) || opts[0];
          if (active) selectOption(active);
        } else if (e.key === "Escape") {
          e.preventDefault();
          close();
          input.blur();
        }
      });

      // mousedown preventDefault keeps input focus so blur->close doesn't race the click
      list.addEventListener("mousedown", e => e.preventDefault());
      list.addEventListener("click", e => {
        const opt = e.target.closest(".timbre-opt");
        if (opt) selectOption(opt);
      });

      document.addEventListener("click", e => {
        if (!combo.contains(e.target)) close();
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

      const instInput = this.container.querySelector(`.timbre-combo-input[data-layer="${i}"]`);
      if (instInput && l.name) instInput.value = l.name;

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
