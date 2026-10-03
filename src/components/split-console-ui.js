/**
 * Split Keyboard Console — dedicated workspace view.
 * Two-column assignment with searchable instrument combo boxes.
 */

import { multiLayerEngine, COMBI_TIMBRES } from "../audio/multi-layer-engine.js";
import { LAYER_FX_OPTIONS } from "../audio/native-pcm-engine.js";
import { timbreSearchModal } from "./timbre-search-modal.js";

const esc = s => String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiName = m => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

export class SplitConsoleUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
    this._bindDocClickOutside();
    this.bindCombos();
    this.bindEvents();
    this._splitListener = () => this.syncFromEngine();
    multiLayerEngine.addSplitChangeListener(this._splitListener);
  }

  // Bound once — see MultiLayerUI._bindDocClickOutside. Kept here so re-creating
  // the view never stacks duplicate document listeners.
  _bindDocClickOutside() {
    if (this._outsideClickHandler) return;
    this._outsideClickHandler = (e) => {
      if (!this.container) return;
      this.container.querySelectorAll(".timbre-combo-list.open").forEach(list => {
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
  }

  displayForZone(z) {
    if (!z.inst || z.inst === "current_stack") return "Follow Current Stack";
    return z.name || z.inst;
  }

  render() {
    if (!this.container) return;
    const split = multiLayerEngine.splitZones;
    const on = multiLayerEngine.isSplitMode;
    const point = multiLayerEngine.splitPointMidi;

    const zoneCard = (zk, z) => {
      const isLower = zk === "lower";
      return `
        <div class="split-card ${isLower ? "split-card-lower" : "split-card-upper"}">
          <div class="split-card-side">
            <span class="split-card-tag">${isLower ? "LEFT / LOW KEYS" : "RIGHT / HIGH KEYS"}</span>
            <h3 class="split-card-title">${isLower ? "LOWER ZONE" : "UPPER ZONE"}</h3>
            <p class="split-card-hint">${isLower ? "Plays any note BELOW the split point" : "Plays any note AT or ABOVE the split point"}</p>
          </div>
          <div class="split-card-controls">
            <label class="split-label">SOUND / INSTRUMENT</label>
            <div class="strip-inst-picker" data-split-zone="${zk}">
              <button type="button" class="timbre-picker-trigger split-timbre-trigger" data-split-zone="${zk}" title="Click to browse zone sound">
                <div class="timbre-trigger-info">
                  <span class="timbre-trigger-badge ${!z.inst || z.inst === "current_stack" ? "badge-auto" : (z.inst?.startsWith("va:") ? "badge-va" : "badge-pcm")}">
                    ${!z.inst || z.inst === "current_stack" ? "AUTO" : (z.inst?.startsWith("va:") ? "VA" : "PCM")}
                  </span>
                  <span class="timbre-trigger-name">${esc(this.displayForZone(z))}</span>
                </div>
                <span class="timbre-trigger-icon">🔍</span>
              </button>
            </div>
            <label class="split-label">INSERT EFFECT</label>
            <select class="split-fx-select" data-zone="${zk}">
              ${Object.values(LAYER_FX_OPTIONS)
                .map(f => `<option value="${esc(f.id)}" ${z.fx === f.id ? "selected" : ""}>${esc(f.name)}</option>`)
                .join("")}
            </select>
            <div class="split-card-row">
              <label class="split-label">OCTAVE</label>
              <button class="split-oct-btn" data-zone="${zk}" data-oct="-1">-12</button>
              <span class="split-oct-val" id="split-card-oct-${zk}">${z.oct >= 0 ? "+" : ""}${z.oct}</span>
              <button class="split-oct-btn" data-zone="${zk}" data-oct="1">+12</button>
              <label class="split-label">VOLUME</label>
              <input type="range" class="split-vol" data-zone="${zk}" min="0" max="1.5" step="0.05" value="${z.gain}" />
              <span class="split-vol-val" id="split-card-vol-${zk}">${Math.round(z.gain * 100)}%</span>
            </div>
            <div class="split-card-current" id="split-card-current-${zk}">${this.currentLabel(zk, z)}</div>
          </div>
        </div>
      `;
    };

    this.container.innerHTML = `
      <div class="split-console-view ${on ? "on" : ""}">
        <div class="split-console-header">
          <div>
            <span class="combi-pill">SPLIT KEYBOARD</span>
            <h2 class="split-console-title">Assign a sound to each keyboard half</h2>
            <p class="split-console-sub">You're in the SPLIT workspace, so split is already ON. Pick a sound for the <b>LOWER</b> half (notes below the point) and the <b>UPPER</b> half (notes at/above the point). Leaving this view turns split back OFF.</p>
          </div>
          <div class="split-master-area">
            <label class="split-label">SPLIT MODE</label>
            <div class="split-status-badge ${on ? "on" : ""}" id="split-status-badge">${on ? "SPLIT IS ON" : "SPLIT IS OFF"}</div>
            <label class="split-label">SPLIT POINT</label>
            <select id="split-point-select" class="split-point-select">
              ${[48, 55, 60, 62, 67, 72]
                .concat(Array.from({ length: 37 }, (_, i) => i + 48))
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort((a, b) => a - b)
                .map(m => `<option value="${m}" ${m === point ? "selected" : ""}>${midiName(m)}</option>`)
                .join("")}
            </select>
          </div>
        </div>
        <div class="split-cards-row">
          ${["lower", "upper"].map(zk => zoneCard(zk, split[zk])).join("")}
        </div>
        <div class="split-help-line">
          <span>&#128161; Tip:</span> try LOWER = <b>Synth Bass 1</b> and UPPER = <b>Follow Current Stack</b> for a classic bass/piano split.
        </div>
      </div>
    `;
  }

  currentLabel(zk, z) {
    if (!z.inst || z.inst === "current_stack") return "This half plays whatever program is currently loaded (a combi or single sound).";
    const t = COMBI_TIMBRES.find(x => x.value === z.inst);
    return t ? `Now playing: <b>${esc(t.name)}</b>` : `Now playing: <b>${esc(z.inst)}</b>`;
  }

  syncFromEngine() {
    const split = multiLayerEngine.splitZones;
    const on = multiLayerEngine.isSplitMode;

    const badge = document.getElementById("split-status-badge");
    if (badge) {
      badge.classList.toggle("on", on);
      badge.textContent = on ? "SPLIT IS ON" : "SPLIT IS OFF";
    }
    this.container?.querySelector(".split-console-view")?.classList.toggle("on", on);

    ["lower", "upper"].forEach(zk => {
      const trigger = this.container?.querySelector(`.timbre-picker-trigger[data-split-zone="${zk}"]`);
      if (trigger) {
        const nameSpan = trigger.querySelector(".timbre-trigger-name");
        const badgeSpan = trigger.querySelector(".timbre-trigger-badge");
        const isStack = !z.inst || z.inst === "current_stack";
        const isVa = z.inst?.startsWith("va:");
        if (nameSpan) nameSpan.textContent = this.displayForZone(z);
        if (badgeSpan) {
          badgeSpan.className = `timbre-trigger-badge ${isStack ? "badge-auto" : isVa ? "badge-va" : "badge-pcm"}`;
          badgeSpan.textContent = isStack ? "AUTO" : isVa ? "VA" : "PCM";
        }
      }
      const fx = this.container?.querySelector(`.split-fx-select[data-zone="${zk}"]`);
      if (fx && z.fx) fx.value = z.fx;
      const oct = document.getElementById(`split-card-oct-${zk}`);
      if (oct) oct.textContent = `${z.oct >= 0 ? "+" : ""}${z.oct}`;
      const vol = this.container?.querySelector(`.split-vol[data-zone="${zk}"]`);
      if (vol) vol.value = z.gain;
      const volVal = document.getElementById(`split-card-vol-${zk}`);
      if (volVal) volVal.textContent = `${Math.round(z.gain * 100)}%`;
      const cur = document.getElementById(`split-card-current-${zk}`);
      if (cur) cur.innerHTML = this.currentLabel(zk, z);
    });

    const pointSel = document.getElementById("split-point-select");
    if (pointSel) pointSel.value = multiLayerEngine.splitPointMidi;
  }

  bindCombos() {
    if (!this.container) return;
    this.container.querySelectorAll(".timbre-picker-trigger").forEach((btn) => {
      btn.addEventListener("click", () => {
        const zk = btn.getAttribute("data-split-zone");
        const z = multiLayerEngine.splitZones[zk];
        timbreSearchModal.open({
          zoneKey: zk,
          currentInst: z?.inst,
          currentName: this.displayForZone(z),
          onSelect: (val) => {
            if (val === "current_stack") {
              multiLayerEngine.setSplitZoneStack(zk);
            } else {
              multiLayerEngine.setSplitZoneInstrument(zk, val);
            }
            this.render();
            this.bindCombos();
            this.bindEvents();
          },
        });
      });
    });
  }

  bindEvents() {
    document.getElementById("split-point-select")?.addEventListener("change", e => {
      multiLayerEngine.setSplitPointMidi(parseInt(e.target.value, 10));
    });

    this.container?.querySelectorAll(".split-fx-select").forEach(sel => {
      sel.addEventListener("change", () => {
        multiLayerEngine.setSplitZoneFx(sel.dataset.zone, sel.value);
      });
    });

    this.container?.querySelectorAll(".split-oct-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const zk = btn.dataset.zone;
        const delta = parseInt(btn.dataset.oct, 10) || 0;
        const z = multiLayerEngine.splitZones[zk];
        multiLayerEngine.setSplitZoneOctave(zk, (z.oct || 0) + delta);
      });
    });

    this.container?.querySelectorAll(".split-vol").forEach(range => {
      range.addEventListener("input", () => {
        multiLayerEngine.setSplitZoneGain(range.dataset.zone, parseFloat(range.value));
      });
    });
  }
}
