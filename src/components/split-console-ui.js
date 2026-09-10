/**
 * Split Keyboard Console — dedicated workspace view.
 * Two-column assignment with searchable instrument combo boxes.
 */

import { multiLayerEngine, COMBI_PRESETS, COMBI_TIMBRES } from "../audio/multi-layer-engine.js";
import { LAYER_FX_OPTIONS } from "../audio/native-pcm-engine.js";

const esc = s => String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiName = m => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

export class SplitConsoleUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
    this.bindCombos();
    this.bindEvents();
    multiLayerEngine.addSplitChangeListener(() => this.syncFromEngine());
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
      const isStack = !z.inst || z.inst === "current_stack";
      return `
        <div class="split-card ${isLower ? "split-card-lower" : "split-card-upper"}">
          <div class="split-card-side">
            <span class="split-card-tag">${isLower ? "LEFT / LOW KEYS" : "RIGHT / HIGH KEYS"}</span>
            <h3 class="split-card-title">${isLower ? "LOWER ZONE" : "UPPER ZONE"}</h3>
            <p class="split-card-hint">${isLower ? "Plays any note BELOW the split point" : "Plays any note AT or ABOVE the split point"}</p>
          </div>
          <div class="split-card-controls">
            <label class="split-label">SOUND / INSTRUMENT — type to search</label>
            <div class="timbre-combo" data-split-zone="${zk}">
              <input type="text" class="timbre-combo-input" data-split-zone="${zk}"
                     placeholder="Search ${COMBI_TIMBRES.length} PCM + Triton timbres..."
                     value="${esc(this.displayForZone(z))}" autocomplete="off" spellcheck="false" />
              <div class="timbre-combo-list" data-split-zone="${zk}"></div>
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
      const z = split[zk];
      const input = this.container?.querySelector(`.timbre-combo-input[data-split-zone="${zk}"]`);
      if (input && !input.matches(":focus")) {
        input.value = this.displayForZone(z);
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
    this.container.querySelectorAll(".timbre-combo").forEach(combo => {
      const input = combo.querySelector(".timbre-combo-input");
      const list = combo.querySelector(".timbre-combo-list");
      if (!input || !list) return;

      const zk = combo.getAttribute("data-split-zone");
      const selectedValue = () => multiLayerEngine.splitZones[zk]?.inst;
      const selectedName = () => this.displayForZone(multiLayerEngine.splitZones[zk]);
      const isStackMode = () => {
        const v = selectedValue();
        return !v || v === "current_stack";
      };

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

        const stackRow = `
          <div class="timbre-opt ${isStackMode() ? "selected" : ""}" data-value="current_stack">
            <span class="timbre-opt-name">Follow Current Stack</span>
            <span class="timbre-opt-meta">&#9654; PLAYS THE ACTIVE COMBI / SINGLE PROGRAM</span>
          </div>`;

        const rows = items.map(
          t => `
          <div class="timbre-opt ${t.value === selVal || (selName && t.name === selName) ? "selected" : ""}" data-value="${esc(t.value)}">
            <span class="timbre-opt-name">${esc(t.name)}</span>
            <span class="timbre-opt-meta">${t.kind === "va" ? "TRITON VA OSCILLATOR" : "PCM / SAMPLE"} · ${esc(t.bank)}${t.code ? " · " + esc(t.code) : ""}</span>
          </div>`
        ).join("");

        if (!rows && !stackRow) {
          list.innerHTML = `<div class="timbre-opt-empty">No timbres match "${esc(input.value)}"</div>`;
          list.classList.add("open");
          return;
        }
        list.innerHTML = stackRow + rows;
        list.classList.add("open");
      };

      const selectOption = optEl => {
        if (!optEl) return;
        const value = optEl.getAttribute("data-value");
        if (value === "current_stack") {
          multiLayerEngine.setSplitZoneStack(zk);
        } else {
          multiLayerEngine.setSplitZoneInstrument(zk, value);
        }
        const nameEl = optEl.querySelector(".timbre-opt-name");
        if (nameEl) input.value = nameEl.textContent;
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
