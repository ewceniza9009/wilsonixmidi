/**
 * KORG TRITON TouchView Workstation Console
 * Replicates the authentic Korg Triton Classic hardware workstation UI:
 * Brushed silver chassis, Realtime Controls 1-4, Bank Selectors (A, B, C, D, Factory, EXB-PCM),
 * 4-column TouchView Program Grid, and the full IFX/MFX effects routing matrix.
 */

import { TRITON_BANKS } from "../triton/triton-soundbanks.js";
import { synthEngine } from "../audio/synth-engine.js";
import { audioCore } from "../audio/audio-core.js";
import { multiLayerEngine, COMBI_PRESETS } from "../audio/multi-layer-engine.js";

export class TritonWorkstationUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);

    // Restore saved active bank and program from localStorage if available
    let savedBank = "USER_A";
    let savedProgId = null;
    try {
      savedBank = localStorage.getItem("wilsonix_triton_active_bank") || "USER_A";
      savedProgId = localStorage.getItem("wilsonix_triton_active_prog_id");
    } catch (e) {}

    // Map legacy bank IDs to consolidated 7 workstation bank IDs
    const LEGACY_BANK_MAP = {
      USER_B: "EDM_CLUB",
      USER_C: "EDM_CLUB",
      USER_D: "EDM_CLUB",
      USER_E: "Y_EOS",
      GENUINE_SAX: "KORG_M1",
      HUMAN_VOX: "CINEMATIC_FX",
      WEIRD_FX: "CINEMATIC_FX",
      DJ_CINEMATIC: "CINEMATIC_FX",
      NATURE: "CINEMATIC_FX",
    };
    if (LEGACY_BANK_MAP[savedBank]) {
      savedBank = LEGACY_BANK_MAP[savedBank];
    }

    // Verify savedBank exists in TRITON_BANKS or is COMBI
    if (savedBank !== "COMBI" && !TRITON_BANKS[savedBank]) {
      savedBank = "USER_A";
    }

    this.activeBankId = savedBank;
    this.activeSubTab = "BROWSER"; // 'BROWSER', 'EASY', 'IFX/MFX', 'ARP'

    // Find initial program strictly respecting savedBank
    let initialProg = null;
    if (savedBank === "COMBI") {
      if (savedProgId && COMBI_PRESETS[savedProgId]) {
        initialProg = COMBI_PRESETS[savedProgId];
      } else {
        initialProg = Object.values(COMBI_PRESETS)[0];
      }
    } else if (TRITON_BANKS[savedBank]) {
      const bankProgs = TRITON_BANKS[savedBank].programs || [];
      if (savedProgId) {
        initialProg = bankProgs.find(p => p.id === savedProgId);
      }
      if (!initialProg && bankProgs.length > 0) {
        initialProg = bankProgs[0];
      }
    }

    if (!initialProg) {
      initialProg = TRITON_BANKS.USER_A.programs[29];
      this.activeBankId = "USER_A";
    }

    this.activeProg = initialProg;
    this._persistSelection();
    this.searchQuery = "";

    this.render();
    if (this.isCombiBank() && this.activeProg) {
      multiLayerEngine.setCombiPreset(this.activeProg.id);
    } else if (this.activeProg) {
      this.applyTritonProgram(this.activeProg);
    }

    multiLayerEngine.addLayerChangeListener(() => {
      this.syncActiveProgramFromEngine();
    });
  }

  _persistSelection() {
    try {
      if (this.activeBankId) {
        localStorage.setItem("wilsonix_triton_active_bank", this.activeBankId);
      }
      if (this.activeProg && this.activeProg.id) {
        localStorage.setItem("wilsonix_triton_active_prog_id", this.activeProg.id);
      }
    } catch (e) {}
  }

  syncActiveProgramFromEngine() {
    if (this.activeSubTab !== "BROWSER") return;
    if (this._suppressAutoBankSwitch) return;

    // 1. Combi Mode
    if (multiLayerEngine.isCombiMode && multiLayerEngine.activeCombi) {
      const combiProg = multiLayerEngine.activeCombi;
      if (!this.activeProg || this.activeBankId === "COMBI") {
        this.activeProg = combiProg;
      }
      if (this.activeProg) {
        this.updateLcdAndGridHighlight(
          this.activeProg.id,
          this.activeProg.name,
          this.activeBankId === "COMBI" ? "BANK: COMBI" : `BANK: ${this.activeBankId.replace("_", " ")} ${this.activeProg.num || ""}`,
          `CATEGORY: ${(this.activeProg.category || "COMBI").toUpperCase()}`
        );
      }
      return;
    }

    // 2. Triton Virtual Analog (VA) Mode
    if (multiLayerEngine.isTritonVaMode && multiLayerEngine.activeTritonVaProg) {
      const prog = multiLayerEngine.activeTritonVaProg;
      this.activeProg = prog;
      this.updateLcdAndGridHighlight(
        prog.id,
        prog.name,
        `BANK: ${this.activeBankId.replace("_", " ")} ${prog.num || ""}`,
        `CATEGORY: ${(prog.category || "").toUpperCase()}`
      );
      return;
    }

    // 3. Single Instrument / Dedicated PCM Mode
    if (multiLayerEngine.activeSingleInst && this.activeProg) {
      this.updateLcdAndGridHighlight(
        this.activeProg.id,
        this.activeProg.name,
        `BANK: ${this.activeBankId.replace("_", " ")} ${this.activeProg.num || ""}`,
        `CATEGORY: ${(this.activeProg.category || "").toUpperCase()}`
      );
    }
  }

  updateLcdAndGridHighlight(progId, title, bankStr, catStr) {
    const lcdTitle = document.getElementById("triton-lcd-title");
    const lcdBankCat = document.getElementById("triton-lcd-bank-cat");
    const lcdCat = document.getElementById("triton-lcd-category");
    if (lcdTitle && title) lcdTitle.innerText = title;
    if (lcdBankCat && bankStr) lcdBankCat.innerText = bankStr.startsWith("BANK:") ? bankStr : `BANK: ${bankStr}`;
    if (lcdCat && catStr) lcdCat.innerText = catStr.startsWith("CATEGORY:") ? catStr : `CATEGORY: ${catStr.toUpperCase()}`;

    if (this.container) {
      this.container.querySelectorAll(".triton-bank-card").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-bank") === this.activeBankId);
      });
      this.container.querySelectorAll(".triton-prog-cell").forEach(c => {
        const match = c.getAttribute("data-prog-id") === progId;
        c.classList.toggle("active", match);
      });
    }
  }

  isCombiBank() {
    return this.activeBankId === "COMBI";
  }

  isGridCellActive(p) {
    if (this.isCombiBank()) {
      if (multiLayerEngine.isCombiMode && multiLayerEngine.activeCombi) {
        return multiLayerEngine.activeCombi.id === p.id;
      }
    }
    return this.activeProg && this.activeProg.id === p.id;
  }

  // Normalized grid list for the active bank (combi presets get display numbers)
  getGridPrograms() {
    if (this.isCombiBank()) {
      const list = Object.values(COMBI_PRESETS).map((c, i) => ({
        ...c,
        num: String(i + 1).padStart(3, "0"),
      }));
      if (!this.searchQuery) return list;
      const q = this.searchQuery.toLowerCase();
      return list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q)
      );
    }
    const currentBank = TRITON_BANKS[this.activeBankId] || TRITON_BANKS.USER_A;
    let programs = currentBank.programs || [];
    if (this.searchQuery) {
      programs = programs.filter(
        p =>
          p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }
    return programs;
  }

  render() {
    if (!this.container) return;

    const programs = this.getGridPrograms();

    this.container.innerHTML = `
      <div class="triton-hardware-chassis">
        <!-- Triton Top Header Bar -->
        <div class="triton-top-header">
          <div class="korg-badge">
            <span class="korg-logo-text">MIDIKEY</span>
          </div>

          <!-- Realtime Controls 1-4 -->
          <div class="triton-realtime-bay">
            <span class="rt-bay-label">REALTIME CONTROLS</span>
            <div class="rt-knobs-row">
              <div class="rt-knob-unit">
                <span class="rt-knob-num">1</span>
                <div class="triton-silver-knob" data-knob="cutoff" title="Filter Cutoff">
                  <div class="knob-cap"><div class="knob-notch"></div></div>
                </div>
                <span class="rt-label">CUTOFF</span>
              </div>
              <div class="rt-knob-unit">
                <span class="rt-knob-num">2</span>
                <div class="triton-silver-knob" data-knob="resonance" title="Filter Resonance">
                  <div class="knob-cap"><div class="knob-notch"></div></div>
                </div>
                <span class="rt-label">RESO</span>
              </div>
              <div class="rt-knob-unit">
                <span class="rt-knob-num">3</span>
                <div class="triton-silver-knob" data-knob="eg-int" title="EG Intensity / Attack">
                  <div class="knob-cap"><div class="knob-notch"></div></div>
                </div>
                <span class="rt-label">EG INT</span>
              </div>
              <div class="rt-knob-unit">
                <span class="rt-knob-num">4</span>
                <div class="triton-silver-knob" data-knob="fx-depth" title="Master FX Depth">
                  <div class="knob-cap"><div class="knob-notch"></div></div>
                </div>
                <span class="rt-label">ASSIGN (FX)</span>
              </div>
            </div>
          </div>

          <!-- Triton Blue LCD Display -->
          <div class="triton-lcd-display">
            <div class="lcd-meta-row">
              <span class="lcd-badge">PROG</span>
              <span class="lcd-arp-indicator">● SYNC (ARP)</span>
              <span class="lcd-bank-cat" id="triton-lcd-bank-cat">BANK: ${this.activeBankId.replace("_", " ")} ${this.activeProg.num}</span>
              <span class="lcd-cat-label" id="triton-lcd-category">CATEGORY: ${this.activeProg.category.toUpperCase()}</span>
            </div>
            <div class="lcd-main-title" id="triton-lcd-title">${this.activeProg.name}</div>
          </div>

          <!-- Triton Logo & Workstation Branding -->
          <div class="triton-brand-badge">
            <div class="workstation-tag">MUSIC WORKSTATION</div>
            <div class="triton-hero-text">ELITE</div>
          </div>
        </div>

        <!-- TouchView Sub-Tab Bar -->
        <div class="triton-subtab-bar">
          <div class="nav-cluster-left">
            <button class="triton-subtab ${this.activeSubTab === "BROWSER" ? "active" : ""}" data-tab="BROWSER">BROWSE</button>
            <button class="triton-subtab ${this.activeSubTab === "EASY" ? "active" : ""}" data-tab="EASY">EASY EDIT</button>
            <button class="triton-subtab ${this.activeSubTab === "IFX/MFX" ? "active" : ""}" data-tab="IFX/MFX">IFX / MFX</button>
            <button class="triton-subtab ${this.activeSubTab === "ARP" ? "active" : ""}" data-tab="ARP">ARP</button>
          </div>
          <div class="nav-cluster-right">
            <div class="triton-search-box">
              <span class="search-ico">🔍</span>
              <input type="text" id="triton-search-input" placeholder="Search 60+ patches..." value="${this.searchQuery}" />
            </div>
          </div>
        </div>

        <!-- TouchView Screen Body -->
        <div class="touchview-screen">
          ${this.renderTouchViewContent(programs)}
        </div>
      </div>
    `;

    this.bindSubTabs();
    this.bindBankButtons();
    this.bindProgramGrid();
    this.bindFastScroll();
    this.bindRealtimeKnobs();
    this.bindSearch();
    this.bindIfxMfxControls();
    this.bindEasyEditControls();
  }

  renderTouchViewContent(programs) {
    if (this.activeSubTab === "IFX/MFX") {
      return this.renderIfxMfxMatrix();
    }
    if (this.activeSubTab === "EASY") {
      return this.renderEasyEditView();
    }
    if (this.activeSubTab === "ARP") {
      return this.renderArpView();
    }

    // Distinct modern vector SVG icons for each soundbank
    const BANK_ICONS = {
      USER_A: `<svg viewBox="0 0 24 24" class="bank-svg-icon icon-triton" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8v8M10 8v8M14 8v8M18 8v8"/><path d="M6 12h4M14 12h4"/></svg>`,
      KORG_M1: `<svg viewBox="0 0 24 24" class="bank-svg-icon icon-m1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15v-2M12 15v-3M17 15v-1"/></svg>`,
      Y_EOS: `<svg viewBox="0 0 24 24" class="bank-svg-icon icon-yeos" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      EDM_CLUB: `<svg viewBox="0 0 24 24" class="bank-svg-icon icon-edm" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      COMBI: `<svg viewBox="0 0 24 24" class="bank-svg-icon icon-combi" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
      PERCUSSION: `<svg viewBox="0 0 24 24" class="bank-svg-icon icon-drums" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>`,
      CINEMATIC_FX: `<svg viewBox="0 0 24 24" class="bank-svg-icon icon-cinema" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M4 11V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="m4 11 16-4"/><path d="m9 5 2 6"/><path d="m14 5 2 6"/></svg>`,
    };

    // Default: BROWSER Mode
    const bankCardHtml = b => `
          <button class="triton-bank-card ${this.activeBankId === b.id ? "active" : ""}" data-bank="${b.id}">
            <div class="bank-thumb-preview">
              ${BANK_ICONS[b.id] || `<div class="mini-triton-icon"></div>`}
            </div>
            <div class="bank-meta">
              <span class="bank-card-title">${b.name}</span>
              <span class="bank-card-desc">${b.category}</span>
            </div>
          </button>
        `;

    const combiCardHtml = () => `
          <button class="triton-bank-card ${this.activeBankId === "COMBI" ? "active" : ""}" data-bank="COMBI">
            <div class="bank-thumb-preview">
              ${BANK_ICONS.COMBI}
            </div>
            <div class="bank-meta">
              <span class="bank-card-title">COMBI</span>
              <span class="bank-card-desc">4-Timbre Stacks</span>
            </div>
          </button>
        `;

    // Bank card display order (7 consolidated workstation banks: fits on single screen)
    const bankRowOrder = ["USER_A", "KORG_M1", "Y_EOS", "EDM_CLUB", "COMBI", "PERCUSSION", "CINEMATIC_FX"];

    return `
      <!-- Bank Selectors Row -->
      <div class="triton-banks-row">
        ${bankRowOrder
          .map(bankId => {
            if (bankId === "COMBI") return combiCardHtml();
            const b = TRITON_BANKS[bankId];
            return b ? bankCardHtml(b) : "";
          })
          .join("")}
      </div>

      <!-- TouchView 4-Column Program Grid (Matches Image 2) -->
      <div class="touchview-program-grid">
        ${programs
          .map(
            p => `
          <div class="triton-prog-cell ${this.isGridCellActive(p) ? "active" : ""}" data-prog-id="${p.id}">
            <span class="prog-bank-code">${this.activeBankId.replace("_", " ")}</span>
            <span class="prog-num">${p.num}</span>
            <span class="prog-name-label">${p.name}</span>
            <span class="prog-star">★</span>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  renderIfxMfxMatrix() {
    const fx = audioCore.fxRack;
    const isCompressor = fx?.compressor?.enabled;
    const isBitcrusher = fx?.bitcrusher?.enabled;
    const isWidener = fx?.stereoWidener?.enabled;
    const isAutopan = fx?.autopan?.enabled;
    const isChorus = fx?.chorus?.enabled;
    const isTube = fx?.tube?.enabled;
    const isPhaser = fx?.phaser?.enabled;
    const isFlanger = fx?.flanger?.enabled;
    const isRotary = fx?.rotary?.enabled;
    const isTremolo = fx?.tremolo?.enabled;
    const isDelay = fx?.delay?.enabled;
    const isReverb = fx?.reverb?.enabled;

    return `
      <div class="ifx-mfx-workspace">
        <div class="ifx-mfx-header">
          <span class="ifx-title">MULTI-EFFECTS ROUTING MATRIX (IFX 1-10 + MFX 1-2 + MEQ)</span>
          <span class="ifx-chip">102 EFFECT ALGORITHMS</span>
        </div>

        <div class="ifx-mfx-grid">
          <!-- Insert Effects (IFX) -->
          <div class="ifx-column">
            <h4 class="ifx-col-title">INSERT EFFECTS (IFX)</h4>
            
            <!-- IFX 0: Studio Dynamics Compressor -->
            <div class="ifx-slot-card">
              <div class="slot-bar">
                <span class="slot-tag">IFX 0</span>
                <span class="slot-name">001: Studio Dynamics Compressor</span>
                <button class="slot-toggle ${isCompressor ? "active" : ""}" data-fx="compressor">${isCompressor ? "ON" : "OFF"}</button>
              </div>
              <div class="slot-knobs">
                <div class="slot-param"><span>THRESH</span><input type="range" class="fx-slider" data-fx-param="comp-thresh" min="-60" max="0" step="1" value="${fx?.compressor?.threshold || -24}"/></div>
                <div class="slot-param"><span>RATIO</span><input type="range" class="fx-slider" data-fx-param="comp-ratio" min="1" max="20" step="0.5" value="${fx?.compressor?.ratio || 4}"/></div>
                <div class="slot-param"><span>MAKEUP</span><input type="range" class="fx-slider" data-fx-param="comp-makeup" min="0" max="18" step="0.5" value="${fx?.compressor?.makeup || 3}"/></div>
                <div class="slot-param"><span>MIX</span><input type="range" class="fx-slider" data-fx-param="comp-mix" min="0" max="1" step="0.05" value="${fx?.compressor?.mix || 0.85}"/></div>
              </div>
            </div>

            <!-- IFX 1: Rhodes Stereo Auto-Pan & Optical Tremolo -->
            <div class="ifx-slot-card">
              <div class="slot-bar">
                <span class="slot-tag">IFX 1</span>
                <span class="slot-name">034: Stereo Auto-Pan / Tremolo</span>
                <button class="slot-toggle ${isAutopan ? "active" : ""}" data-fx="autopan">${isAutopan ? "ON" : "OFF"}</button>
              </div>
              <div class="slot-knobs">
                <div class="slot-param"><span>RATE</span><input type="range" class="fx-slider" data-fx-param="autopan-rate" min="0.2" max="8.0" step="0.1" value="${fx?.autopan?.rate || 2.1}"/></div>
                <div class="slot-param"><span>DEPTH</span><input type="range" class="fx-slider" data-fx-param="autopan-depth" min="0" max="1" step="0.05" value="${fx?.autopan?.depth || 0.85}"/></div>
                <div class="slot-param"><span>MIX</span><input type="range" class="fx-slider" data-fx-param="autopan-mix" min="0" max="1" step="0.05" value="${fx?.autopan?.mix || 0.85}"/></div>
              </div>
            </div>

            <!-- IFX 2: Dimension D Stereo Chorus -->
            <div class="ifx-slot-card">
              <div class="slot-bar">
                <span class="slot-tag">IFX 2</span>
                <span class="slot-name">018: Stereo Ensemble Chorus</span>
                <button class="slot-toggle ${isChorus ? "active" : ""}" data-fx="chorus">${isChorus ? "ON" : "OFF"}</button>
              </div>
              <div class="slot-knobs">
                <div class="slot-param"><span>MIX</span><input type="range" class="fx-slider" data-fx-param="chorus-mix" min="0" max="1" step="0.05" value="${fx?.chorus?.mix || 0.55}"/></div>
                <div class="slot-param"><span>RATE</span><input type="range" class="fx-slider" data-fx-param="chorus-rate" min="0.2" max="6.0" step="0.1" value="${fx?.chorus?.rate || 1.1}"/></div>
              </div>
            </div>

            <!-- IFX 3: Valve Force Tube Drive -->
            <div class="ifx-slot-card">
              <div class="slot-bar">
                <span class="slot-tag">IFX 3</span>
                <span class="slot-name">006: Valve Force Tube Drive</span>
                <button class="slot-toggle ${isTube ? "active" : ""}" data-fx="tube">${isTube ? "ON" : "OFF"}</button>
              </div>
              <div class="slot-knobs">
                <div class="slot-param"><span>DRIVE</span><input type="range" class="fx-slider" data-fx-param="tube-drive" min="0" max="1" step="0.02" value="${fx?.tube?.drive || 0.18}"/></div>
                <div class="slot-param"><span>TONE</span><input type="range" class="fx-slider" data-fx-param="tube-tone" min="2000" max="16000" step="500" value="${fx?.tube?.tone || 12000}"/></div>
              </div>
            </div>

            <!-- IFX 4: 4-Stage Analog Phaser -->
            <div class="ifx-slot-card">
              <div class="slot-bar">
                <span class="slot-tag">IFX 4</span>
                <span class="slot-name">024: Vintage Analog Phaser</span>
                <button class="slot-toggle ${isPhaser ? "active" : ""}" data-fx="phaser">${isPhaser ? "ON" : "OFF"}</button>
              </div>
              <div class="slot-knobs">
                <div class="slot-param"><span>RATE</span><input type="range" class="fx-slider" data-fx-param="phaser-rate" min="0.1" max="5.0" step="0.1" value="${fx?.phaser?.rate || 0.65}"/></div>
                <div class="slot-param"><span>MIX</span><input type="range" class="fx-slider" data-fx-param="phaser-mix" min="0" max="1" step="0.05" value="0.6"/></div>
              </div>
            </div>

            <!-- IFX 5: Leslie Rotary Speaker -->
            <div class="ifx-slot-card">
              <div class="slot-bar">
                <span class="slot-tag">IFX 5</span>
                <span class="slot-name">042: Leslie 122 Rotary Cabinet</span>
                <button class="slot-toggle ${isRotary ? "active" : ""}" data-fx="rotary">${isRotary ? "ON" : "OFF"}</button>
              </div>
              <div class="slot-knobs">
                <button class="rotary-speed-btn-triton" id="triton-rotary-speed">${fx?.rotary?.speedMode === "fast" ? "FAST (TREMOLO)" : "SLOW (CHORALE)"}</button>
                <div class="slot-param"><span>DRIVE/MIX</span><input type="range" class="fx-slider" data-fx-param="rotary-mix" min="0" max="1" step="0.05" value="0.65"/></div>
              </div>
            </div>

            <!-- IFX 6: Stereo Tape Flanger -->
            <div class="ifx-slot-card">
              <div class="slot-bar">
                <span class="slot-tag">IFX 6</span>
                <span class="slot-name">022: Stereo Tape Flanger</span>
                <button class="slot-toggle ${isFlanger ? "active" : ""}" data-fx="flanger">${isFlanger ? "ON" : "OFF"}</button>
              </div>
              <div class="slot-knobs">
                <div class="slot-param"><span>RATE</span><input type="range" class="fx-slider" data-fx-param="flanger-rate" min="0.1" max="5.0" step="0.1" value="${fx?.flanger?.rate || 0.45}"/></div>
                <div class="slot-param"><span>MIX</span><input type="range" class="fx-slider" data-fx-param="flanger-mix" min="0" max="1" step="0.05" value="${fx?.flanger?.mix || 0.45}"/></div>
                <div class="slot-param"><span>FEEDBACK</span><input type="range" class="fx-slider" data-fx-param="flanger-feedback" min="0" max="0.5" step="0.05" value="${fx?.flanger?.feedback || 0.22}"/></div>
              </div>
            </div>

            <!-- IFX 7: Vintage Optical Tremolo -->
            <div class="ifx-slot-card">
              <div class="slot-bar">
                <span class="slot-tag">IFX 7</span>
                <span class="slot-name">021: Vintage Optical Tremolo</span>
                <button class="slot-toggle ${isTremolo ? "active" : ""}" data-fx="tremolo">${isTremolo ? "ON" : "OFF"}</button>
              </div>
              <div class="slot-knobs">
                <div class="slot-param"><span>RATE</span><input type="range" class="fx-slider" data-fx-param="tremolo-rate" min="0.2" max="12.0" step="0.1" value="${fx?.tremolo?.rate || 4.5}"/></div>
                <div class="slot-param"><span>DEPTH</span><input type="range" class="fx-slider" data-fx-param="tremolo-depth" min="0" max="1" step="0.05" value="${fx?.tremolo?.depth || 0.55}"/></div>
                <div class="slot-param"><span>MIX</span><input type="range" class="fx-slider" data-fx-param="tremolo-mix" min="0" max="1" step="0.05" value="${fx?.tremolo?.mix || 0.6}"/></div>
              </div>
            </div>

            <!-- IFX 8: Retro Bitcrusher & Sample Decimator -->
            <div class="ifx-slot-card">
              <div class="slot-bar">
                <span class="slot-tag">IFX 8</span>
                <span class="slot-name">014: Retro Bitcrusher / Decimator</span>
                <button class="slot-toggle ${isBitcrusher ? "active" : ""}" data-fx="bitcrusher">${isBitcrusher ? "ON" : "OFF"}</button>
              </div>
              <div class="slot-knobs">
                <div class="slot-param"><span>BITS</span><input type="range" class="fx-slider" data-fx-param="crush-bits" min="2" max="16" step="1" value="${fx?.bitcrusher?.bits || 8}"/></div>
                <div class="slot-param"><span>DOWNSAMPLE</span><input type="range" class="fx-slider" data-fx-param="crush-downsample" min="1000" max="20000" step="500" value="${fx?.bitcrusher?.downsampleFreq || 8000}"/></div>
                <div class="slot-param"><span>MIX</span><input type="range" class="fx-slider" data-fx-param="crush-mix" min="0" max="1" step="0.05" value="${fx?.bitcrusher?.mix || 0.65}"/></div>
              </div>
            </div>

            <!-- IFX 9: Haas Stereo Spatial Widener -->
            <div class="ifx-slot-card">
              <div class="slot-bar">
                <span class="slot-tag">IFX 9</span>
                <span class="slot-name">038: Haas Stereo Spatial Widener</span>
                <button class="slot-toggle ${isWidener ? "active" : ""}" data-fx="stereo-widener">${isWidener ? "ON" : "OFF"}</button>
              </div>
              <div class="slot-knobs">
                <div class="slot-param"><span>WIDTH</span><input type="range" class="fx-slider" data-fx-param="widener-width" min="0" max="2.5" step="0.1" value="${fx?.stereoWidener?.width || 1.4}"/></div>
                <div class="slot-param"><span>HAAS DELAY</span><input type="range" class="fx-slider" data-fx-param="widener-haas" min="1" max="35" step="1" value="${fx?.stereoWidener?.haasDelayMs || 18}"/></div>
                <div class="slot-param"><span>MIX</span><input type="range" class="fx-slider" data-fx-param="widener-mix" min="0" max="1" step="0.05" value="${fx?.stereoWidener?.mix || 0.70}"/></div>
              </div>
            </div>
          </div>

          <!-- Master Effects (MFX) & MEQ -->
          <div class="mfx-column">
            <h4 class="ifx-col-title">MASTER EFFECTS (MFX) & MASTER EQ</h4>
            
            <!-- MFX 1: Ping-Pong Tape Delay -->
            <div class="mfx-slot-card">
              <div class="slot-bar">
                <span class="slot-tag mfx-tag">MFX 1</span>
                <span class="slot-name">051: Ping-Pong Tape Delay</span>
                <button class="slot-toggle ${isDelay ? "active" : ""}" data-fx="delay">${isDelay ? "ON" : "OFF"}</button>
              </div>
              <div class="slot-knobs">
                <div class="slot-param"><span>RETURN LEVEL</span><input type="range" class="fx-slider" data-fx-param="delay-mix" min="0" max="1" step="0.05" value="${fx?.delay?.mix || 0.25}"/></div>
                <div class="slot-param"><span>FEEDBACK</span><input type="range" class="fx-slider" data-fx-param="delay-feedback" min="0" max="0.7" step="0.05" value="${fx?.delay?.feedback || 0.3}"/></div>
                <div class="slot-param"><span>DIVISION</span><input type="range" class="fx-slider" data-fx-param="delay-division" min="0.125" max="1.0" step="0.125" value="${fx?.delay?.division || 0.375}"/></div>
              </div>
            </div>

            <!-- MFX 2: Studio Hall Reverb -->
            <div class="mfx-slot-card">
              <div class="slot-bar">
                <span class="slot-tag mfx-tag">MFX 2</span>
                <span class="slot-name">089: Concert Hall / Plate Reverb</span>
                <button class="slot-toggle ${isReverb ? "active" : ""}" data-fx="reverb">${isReverb ? "ON" : "OFF"}</button>
              </div>
              <div class="slot-knobs">
                <div class="slot-param"><span>RETURN LEVEL</span><input type="range" class="fx-slider" data-fx-param="reverb-mix" min="0" max="1" step="0.05" value="${fx?.reverb?.mix || 0.25}"/></div>
                <div class="slot-param"><span>DECAY</span><input type="range" class="fx-slider" data-fx-param="reverb-decay" min="0.5" max="5.0" step="0.1" value="${fx?.reverb?.decay || 2.2}"/></div>
                <div class="slot-param"><span>ROOM SIZE</span><input type="range" class="fx-slider" data-fx-param="reverb-size" min="0.05" max="1.0" step="0.05" value="0.45"/></div>
              </div>
            </div>

            <!-- Master EQ -->
            <div class="meq-slot-card">
              <span class="slot-tag meq-tag">MASTER 3-BAND EQ</span>
              <div class="meq-controls">
                <div class="meq-band"><span>LOW (80Hz)</span><input type="range" class="fx-slider" data-fx-param="eq-low" min="-12" max="12" step="0.5" value="1.5"/></div>
                <div class="meq-band"><span>MID (1.4kHz)</span><input type="range" class="fx-slider" data-fx-param="eq-mid" min="-12" max="12" step="0.5" value="0.0"/></div>
                <div class="meq-band"><span>HIGH (10kHz)</span><input type="range" class="fx-slider" data-fx-param="eq-high" min="-12" max="12" step="0.5" value="2.0"/></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderEasyEditView() {
    return `
      <div class="easy-edit-workspace">
        <h4 class="ifx-col-title">EASY EDIT PARAMETERS: ${this.activeProg.name.toUpperCase()}</h4>
        <div class="easy-sliders-grid">
          <div class="easy-slider-card">
            <label>FILTER CUTOFF</label>
            <input type="range" min="500" max="12000" value="${this.activeProg.cutoff || 6000}" id="easy-cutoff-slider"/>
          </div>
          <div class="easy-slider-card">
            <label>FILTER RESONANCE</label>
            <input type="range" min="0.5" max="8" step="0.1" value="${this.activeProg.Q || 1.2}" id="easy-reso-slider"/>
          </div>
          <div class="easy-slider-card">
            <label>EG ATTACK TIME</label>
            <input type="range" min="0.001" max="1.5" step="0.01" value="${this.activeProg.attack || 0.002}" id="easy-attack-slider"/>
          </div>
          <div class="easy-slider-card">
            <label>EG RELEASE TIME</label>
            <input type="range" min="0.05" max="3.0" step="0.05" value="${this.activeProg.release || 0.35}" id="easy-release-slider"/>
          </div>
        </div>
      </div>
    `;
  }

  renderArpView() {
    return `
      <div class="easy-edit-workspace">
        <h4 class="ifx-col-title">DUAL POLYPHONIC ARPEGGIATOR SETUP</h4>
        <div class="arp-setup-box">
          <p>Tempo-synchronized pattern generator mapped directly to your currently held chord notes.</p>
          <div class="easy-sliders-grid">
            <div class="easy-slider-card"><label>ARP PATTERN</label><select id="arp-pat-sel"><option>UP</option><option>DOWN</option><option>UP/DOWN</option><option>RANDOM</option></select></div>
            <div class="easy-slider-card"><label>RESOLUTION</label><select id="arp-res-sel"><option>1/16 (Default)</option><option>1/8</option><option>1/4</option><option>1/32</option></select></div>
          </div>
        </div>
      </div>
    `;
  }

  bindSubTabs() {
    this.container.querySelectorAll(".triton-subtab").forEach(btn => {
      let lastTap = 0;
      const handleTab = () => {
        const now = performance.now();
        if (now - lastTap < 120) return;
        lastTap = now;
        this.activeSubTab = btn.getAttribute("data-tab");
        this.render();
      };
      btn.addEventListener("pointerdown", handleTab);
      btn.addEventListener("click", handleTab);
    });
  }

  bindBankButtons() {
    this.container.querySelectorAll(".triton-bank-card").forEach(btn => {
      let lastTap = 0;
      const handleBank = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const now = performance.now();
        if (now - lastTap < 100) return;
        lastTap = now;
        const newBank = btn.getAttribute("data-bank");
        if (this.activeBankId !== newBank) {
          this.activeBankId = newBank;
          if (newBank === "COMBI") {
            this.activeProg = Object.values(COMBI_PRESETS)[0];
            multiLayerEngine.setCombiPreset(this.activeProg.id);
          } else if (TRITON_BANKS[newBank] && TRITON_BANKS[newBank].programs?.length > 0) {
            this.activeProg = TRITON_BANKS[newBank].programs[0];
            this.applyTritonProgram(this.activeProg, true);
          }
          this._persistSelection();
          this.render();
        }
      };
      btn.addEventListener("pointerdown", handleBank);
    });
  }

  bindProgramGrid() {
    this.container.querySelectorAll(".triton-prog-cell").forEach(cell => {
      let lastTap = 0;
      const handleSelect = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const now = performance.now();
        if (now - lastTap < 80) return;
        lastTap = now;

        const progId = cell.getAttribute("data-prog-id");
        if (!progId) return;

        // COMBI bank: trigger 4-timbre stack + update LCD
        if (this.isCombiBank()) {
          const cp = COMBI_PRESETS[progId];
          if (cp) {
            this.activeProg = cp;
            this._persistSelection();
            this._suppressAutoBankSwitch = true;
            try {
              multiLayerEngine.setCombiPreset(progId);
              this.updateLcdAndGridHighlight(progId, cp.name, "BANK: COMBI", `CATEGORY: ${(cp.category || "COMBI").toUpperCase()}`);
            } finally {
              setTimeout(() => { this._suppressAutoBankSwitch = false; }, 120);
            }
          }
          return;
        }

        const currentBank = TRITON_BANKS[this.activeBankId] || TRITON_BANKS.USER_A;
        let prog = (currentBank.programs || []).find(p => p.id === progId);
        if (!prog) {
          for (const bank of Object.values(TRITON_BANKS)) {
            prog = (bank.programs || []).find(p => p.id === progId);
            if (prog) break;
          }
        }

        if (prog) {
          this.activeProg = prog;
          this._persistSelection();
          this._suppressAutoBankSwitch = true;
          try {
            this.applyTritonProgram(prog, true);
            this.updateLcdAndGridHighlight(
              prog.id,
              prog.name,
              `BANK: ${this.activeBankId.replace("_", " ")} ${prog.num || ""}`,
              `CATEGORY: ${(prog.category || "").toUpperCase()}`
            );
          } finally {
            setTimeout(() => { this._suppressAutoBankSwitch = false; }, 120);
          }
        }
      };

      cell.addEventListener("pointerdown", handleSelect);
    });
  }

  bindFastScroll() {
    const grid = this.container?.querySelector(".touchview-program-grid");
    if (!grid) return;
    grid.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaY) > 0) {
          e.preventDefault();
          grid.scrollTop += e.deltaY * 1.5;
        }
      },
      { passive: false }
    );
  }

  selectProgramById(progId) {
    if (!progId) return;

    // Check COMBI presets
    if (COMBI_PRESETS[progId]) {
      const cp = COMBI_PRESETS[progId];
      this.activeBankId = "COMBI";
      this.activeProg = cp;
      this._persistSelection();
      this.render();
      multiLayerEngine.setCombiPreset(progId);
      this.updateLcdAndGridHighlight(progId, cp.name, "BANK: COMBI", `CATEGORY: ${(cp.category || "COMBI").toUpperCase()}`);
      return;
    }

    // Check TRITON_BANKS (prioritize the 7 main bank IDs)
    const mainBankIds = ["USER_A", "KORG_M1", "Y_EOS", "EDM_CLUB", "COMBI", "PERCUSSION", "CINEMATIC_FX"];
    for (const bankId of mainBankIds) {
      const bank = TRITON_BANKS[bankId];
      if (!bank) continue;
      const prog = (bank.programs || []).find(p => p.id === progId);
      if (prog) {
        this.activeBankId = bankId;
        this.activeProg = prog;
        this._persistSelection();
        this.render();
        this.applyTritonProgram(prog, true);
        this.updateLcdAndGridHighlight(prog.id, prog.name, `BANK: ${this.activeBankId.replace("_", " ")} ${prog.num || ""}`, `CATEGORY: ${(prog.category || "").toUpperCase()}`);
        return;
      }
    }
  }

  applyTritonProgram(prog, _isUserExplicit = false) {
    if (!prog) return;

    if (prog.m1Type) {
      this.applyM1Program(prog);
      return;
    }

    if (prog.eosType) {
      this.applyYamahaEosProgram(prog);
      return;
    }

    if (prog.userType) {
      this.applyUserBankProgram(prog);
      return;
    }

    const isDedicatedPcm =
      prog.instId ||
      prog.id === "A036" ||
      prog.id === "A037" ||
      prog.id === "A042" ||
      prog.id === "A043" ||
      prog.id === "A044" ||
      prog.id === "B007";

    if (isDedicatedPcm) {
      let instKey = "acoustic_grand_piano";
      if (prog.instId) instKey = prog.instId;
      else if (prog.id === "A036") instKey = "acoustic_grand_piano";
      else if (prog.id === "A037") instKey = "overdriven_guitar";
      else if (prog.id === "A042") instKey = "distortion_guitar";
      else if (prog.id === "A043") instKey = "abletunes_fm_piano";
      else if (prog.id === "A044") instKey = "abletunes_upright";
      else if (prog.id === "B007") instKey = "acoustic_guitar_nylon";

      multiLayerEngine.setSingleInstrument(instKey);
      if (audioCore.fxRack) {
        this.applyIfxMfx(prog);
      }
      return;
    }

    // All other Triton Classic User A, B, C, D programs have their OWN unique oscillator timbres & IFX/MFX
    if (prog.osc1 || prog.osc2) {
      multiLayerEngine.setTritonVaProgram(prog);
      if (audioCore.fxRack) {
        this.applyIfxMfx(prog);
      }
      return;
    }

    let instKey = "acoustic_grand_piano";
    multiLayerEngine.setSingleInstrument(instKey);
    if (audioCore.fxRack) {
      this.applyIfxMfx(prog);
    }

    // Configure matched KORG TRITON IFX & MFX Routing
    if (audioCore.fxRack) {
      this.applyIfxMfx(prog);

      // If user is currently looking at the IFX/MFX tab, update live display
      if (this.activeSubTab === "IFX/MFX") {
        const tv = this.container.querySelector(".touchview-screen");
        if (tv) {
          tv.innerHTML = this.renderIfxMfxMatrix();
          this.bindIfxMfxControls();
        }
      }
    }
  }

  applyIfxMfx(prog) {
    const fx = audioCore.fxRack;
    if (!fx) return;
    const ifx = (prog.ifx || "").toLowerCase();
    const mfx = (prog.mfx || "").toLowerCase();
    const name = (prog.name || "").toLowerCase();
    const cat = (prog.category || "").toLowerCase();

    // Batch all setBypass calls under the bootstrapping guard so the audio
    // chain is rebuilt exactly ONCE at the end, not 20+ times per switch.
    fx._bootstrapping = true;
    try {

    // Healthy default trim & disengage all series units to keep processing lean
    fx.setPresetTrim(1.0);
    fx.compressor?.setBypass(true);
    fx.autoWah?.setBypass(true);
    fx.talkbox?.setBypass(true);
    fx.tube?.setBypass(true);
    fx.bitcrusher?.setBypass(true);
    fx.vinylLoFi?.setBypass(true);
    fx.stereoWidener?.setBypass(true);
    fx.autopan?.setBypass(true);
    fx.phaser?.setBypass(true);
    fx.flanger?.setBypass(true);
    fx.chorus?.setBypass(true);
    fx.rotary?.setBypass(true);
    fx.tremolo?.setBypass(true);
    fx.slapback?.setBypass(true);
    fx.dubEcho?.setBypass(true);
    fx.delay?.setBypass(true);
    fx.springReverb?.setBypass(true);
    fx.gatedReverb?.setBypass(true);
    fx.tapeSat?.setBypass(true);
    fx.reverb?.setBypass(false);
    fx.reverb?.setMix(0.12);
    fx.reverb?.setDecay(1.6);
    fx.masterEq?.setLowGain(0);
    fx.masterEq?.setMidGain(0);
    fx.masterEq?.setHighGain(0);

    const has = (s) => ifx.includes(s) || mfx.includes(s) || name.includes(s);

    // 1. DYNAMICS & COMPRESSION PRESETS
    if (
      has("compressor") ||
      has("limiter") ||
      has("punch") ||
      cat.includes("percussion") ||
      cat.includes("drum") ||
      name.includes("fat brass") ||
      name.includes("velo piano") ||
      name.includes("piano 16") ||
      name.includes("pick bass") ||
      name.includes("beatbox")
    ) {
      fx.compressor?.setBypass(false);
      if (cat.includes("percussion") || cat.includes("drum") || name.includes("beatbox")) {
        // Punchy fast drum bus compression
        fx.compressor?.setThreshold(-20);
        fx.compressor?.setRatio(6.0);
        fx.compressor?.setAttack(0.008);
        fx.compressor?.setRelease(0.12);
        fx.compressor?.setMakeup(4.0);
        fx.compressor?.setMix(0.90);
      } else if (name.includes("bass") || cat.includes("bass")) {
        // Tight, leveled bass control
        fx.compressor?.setThreshold(-24);
        fx.compressor?.setRatio(4.5);
        fx.compressor?.setAttack(0.015);
        fx.compressor?.setRelease(0.18);
        fx.compressor?.setMakeup(3.5);
        fx.compressor?.setMix(0.85);
      } else if (name.includes("piano") || cat.includes("keyboard")) {
        // Transparent acoustic piano sustain and peak leveling
        fx.compressor?.setThreshold(-18);
        fx.compressor?.setRatio(3.0);
        fx.compressor?.setAttack(0.025);
        fx.compressor?.setRelease(0.25);
        fx.compressor?.setMakeup(2.5);
        fx.compressor?.setMix(0.80);
      } else {
        // Bold brass and lead dynamics
        fx.compressor?.setThreshold(-22);
        fx.compressor?.setRatio(4.0);
        fx.compressor?.setAttack(0.012);
        fx.compressor?.setRelease(0.20);
        fx.compressor?.setMakeup(3.0);
        fx.compressor?.setMix(0.85);
      }
    }

    // 2. RETRO BITCRUSHER & DECIMATOR PRESETS
    if (
      has("decimat") ||
      has("bit") ||
      has("glitch") ||
      has("chiptune") ||
      has("bionic") ||
      has("lfo trance") ||
      has("techno phonic") ||
      has("slap synth bass")
    ) {
      fx.bitcrusher?.setBypass(false);
      if (has("bionic") || has("glitch")) {
        // Heavy 4-bit crunchy alien foldback
        fx.bitcrusher?.setBits(4);
        fx.bitcrusher?.setDownsample(3800);
        fx.bitcrusher?.setDrive(2.0);
        fx.bitcrusher?.setMix(0.80);
      } else if (has("techno phonic") || has("lfo trance")) {
        // Classic 8-bit DAC bite and downsampled resonance
        fx.bitcrusher?.setBits(8);
        fx.bitcrusher?.setDownsample(7000);
        fx.bitcrusher?.setDrive(1.3);
        fx.bitcrusher?.setMix(0.65);
      } else {
        // 10-bit vintage sampler character
        fx.bitcrusher?.setBits(10);
        fx.bitcrusher?.setDownsample(9500);
        fx.bitcrusher?.setDrive(1.2);
        fx.bitcrusher?.setMix(0.50);
      }
    }

    // 3. HAAS STEREO SPATIAL WIDENER PRESETS
    if (
      has("dimension") ||
      has("wide") ||
      has("spatial") ||
      has("universe") ||
      has("nimbus") ||
      has("ooh-ahh") ||
      has("ooh_ahh") ||
      has("chair of light") ||
      has("angelic") ||
      has("12-string") ||
      has("abletunes") ||
      has("chime") ||
      has("tubular") ||
      cat.includes("choir")
    ) {
      fx.stereoWidener?.setBypass(false);
      fx.stereoWidener?.setWidth(1.6);
      fx.stereoWidener?.setHaasDelay(20);
      fx.stereoWidener?.setMix(0.80);
    }

    // 4. OVERDRIVE & TUBE SATURATION
    if (has("overdrive") || has("distortion") || has(" tube")) {
      fx.tube?.setBypass(false);
      if (has("distortion")) {
        fx.tube?.setDrive(0.48);
        fx.tube?.setTone(6200);
      } else {
        fx.tube?.setDrive(0.32);
        fx.tube?.setTone(5500);
      }
      fx.tube?.setMix(0.55);
    }

    // 5. MODULATION
    if (has("phaser")) {
      fx.phaser?.setBypass(false);
      fx.phaser?.setRate(1.0);
      fx.phaser?.setMix(0.35);
    }
    if (has("flanger")) {
      fx.flanger?.setBypass(false);
      fx.flanger?.setRate(0.45);
      fx.flanger?.setMix(0.35);
    }
    if (has("chorus") || has("ensemble")) {
      fx.chorus?.setBypass(false);
      fx.chorus?.setRate(0.85);
      fx.chorus?.setDepth(0.75);
      fx.chorus?.setMix(0.40);
    }
    if (has("rotary")) {
      fx.rotary?.setBypass(false);
      fx.rotary?.setMix(0.50);
    }
    if (has("tremolo") || has("pan")) {
      fx.tremolo?.setBypass(false);
      fx.tremolo?.setDepth(0.45);
      fx.tremolo?.setMix(0.40);
    }

    // 6. DELAYS & ECHOES
    if (has("delay") || has("echo") || has("ping-pong")) {
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.32);
      fx.delay?.setFeedback(0.38);
      if (has("dotted") || has("dub") || has("ping-pong")) {
        fx.delay?.setDivision(0.375);
      }
    }
    if (has("slapback")) {
      fx.slapback?.setBypass(false);
      fx.slapback?.setMix(0.38);
    }

    // 7. REVERBS
    if (has("spring")) {
      fx.springReverb?.setBypass(false);
      fx.springReverb?.setMix(0.35);
      fx.springReverb?.setDecay(2.2);
    }
    if (has("gated")) {
      fx.gatedReverb?.setBypass(false);
      fx.gatedReverb?.setMix(0.38);
    } else if (has("cathedral") || has("hall")) {
      fx.reverb?.setBypass(false);
      fx.reverb?.setMix(0.22);
      fx.reverb?.setDecay(2.2);
    } else if (has("plate") || has("room")) {
      fx.reverb?.setBypass(false);
      fx.reverb?.setMix(0.16);
      fx.reverb?.setDecay(1.5);
    }

    // 8. TAPE & VINYL
    if (has("tape") && !has("tape delay")) {
      fx.tapeSat?.setBypass(false);
      fx.tapeSat?.setDrive(0.32);
      fx.tapeSat?.setWarmth(0.65);
    }
    if (has("vinyl") || has("lofi") || has("lo-fi") || has("crackle")) {
      fx.vinylLoFi?.setBypass(false);
      fx.vinylLoFi?.setWobble(0.45);
      fx.vinylLoFi?.setMix(0.60);
    }

    // 9. TALKBOX & AUTO-WAH
    if (has("auto-wah") || has("wah") || has("clavinet")) {
      fx.autoWah?.setBypass(false);
      fx.autoWah?.setSensitivity(1.0);
      fx.autoWah?.setResonance(2.2);
    }
    if (has("talkbox") || has("throats")) {
      fx.talkbox?.setBypass(false);
      fx.talkbox?.setMix(1.0);
    }

    // 10. STUDIO EQ ENHANCER
    if (has(" paramet") || has("eq")) {
      fx.masterEq?.setLowGain(1.0);
      fx.masterEq?.setMidGain(0.6);
      fx.masterEq?.setHighGain(1.4);
    }

    } finally {
      fx._bootstrapping = false;
      fx._updateChainRouting();
    }

    this.syncFxPowerButtons();
  }

  syncFxPowerButtons() {
    const fx = audioCore.fxRack;
    if (!fx) return;
    const fxDevMap = {
      compressor: "compressor",
      bitcrusher: "bitcrusher",
      stereoWidener: "stereo-widener",
      autopan: "autopan",
      chorus: "chorus",
      tube: "tube",
      phaser: "phaser",
      flanger: "flanger",
      rotary: "rotary",
      tremolo: "tremolo",
      slapback: "slapback",
      dubEcho: "dub-echo",
      delay: "delay",
      springReverb: "spring-reverb",
      shimmerReverb: "shimmer-reverb",
      gatedReverb: "gated-reverb",
      reverb: "reverb",
      tapeSat: "tape-sat",
      autoWah: "auto-wah",
      talkbox: "talkbox",
      vinylLoFi: "vinyl-lofi",
    };
    Object.entries(fxDevMap).forEach(([fxKey, devDomName]) => {
      const unit = fx[fxKey];
      const isEn = unit && !!unit.enabled;
      document.querySelectorAll(`.dev-power-btn[data-dev="${devDomName}"]`).forEach(btn => {
        btn.classList.toggle("active", isEn);
        btn.innerText = isEn ? "ON" : "OFF";
      });
      document.querySelectorAll(`.slot-toggle[data-fx="${devDomName}"]`).forEach(btn => {
        btn.classList.toggle("active", isEn);
        btn.innerText = isEn ? "ON" : "OFF";
      });
    });
  }

  bindIfxMfxControls() {
    if (!this.container) return;
    const fx = audioCore.fxRack;
    if (!fx) return;

    this.container.querySelectorAll(".slot-toggle[data-fx]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        if (e) e.stopPropagation();
        const fxKey = btn.getAttribute("data-fx");
        const isNowActive = btn.classList.toggle("active");
        btn.innerText = isNowActive ? "ON" : "OFF";
        const bypassed = !isNowActive;

        const effectObj = fxKey === "stereo-widener"
          ? fx.stereoWidener
          : fxKey === "spring-reverb"
          ? fx.springReverb
          : fxKey === "gated-reverb"
          ? fx.gatedReverb
          : fxKey === "shimmer-reverb"
          ? fx.shimmerReverb
          : fxKey === "dub-echo"
          ? fx.dubEcho
          : fxKey === "auto-wah"
          ? fx.autoWah
          : fxKey === "vinyl-lofi"
          ? fx.vinylLoFi
          : fxKey === "tape-sat"
          ? fx.tapeSat
          : fx[fxKey];

        if (effectObj && typeof effectObj.setBypass === "function") {
          effectObj.setBypass(bypassed);
        }

        this.syncFxPowerButtons();
      });
    });

    this.container.querySelectorAll(".fx-slider[data-fx-param]").forEach(slider => {
      slider.addEventListener("input", e => {
        const param = slider.getAttribute("data-fx-param");
        const val = parseFloat(e.target.value);
        this.dispatchFxParam(param, val);
      });
    });

    const rotaryBtn = document.getElementById("triton-rotary-speed");
    rotaryBtn?.addEventListener("click", () => {
      if (fx.rotary) {
        fx.rotary.toggleSpeed();
        rotaryBtn.innerText = fx.rotary.speedMode === "fast" ? "FAST (TREMOLO)" : "SLOW (CHORALE)";
      }
    });
  }

  dispatchFxParam(param, val) {
    const fx = audioCore.fxRack;
    if (!fx) return;
    switch (param) {
      case "comp-thresh": fx.compressor?.setThreshold(val); break;
      case "comp-ratio": fx.compressor?.setRatio(val); break;
      case "comp-makeup": fx.compressor?.setMakeup(val); break;
      case "comp-mix": fx.compressor?.setMix(val); break;
      case "crush-bits": fx.bitcrusher?.setBits(val); break;
      case "crush-downsample": fx.bitcrusher?.setDownsample(val); break;
      case "crush-mix": fx.bitcrusher?.setMix(val); break;
      case "widener-width": fx.stereoWidener?.setWidth(val); break;
      case "widener-haas": fx.stereoWidener?.setHaasDelay(val); break;
      case "widener-mix": fx.stereoWidener?.setMix(val); break;
      case "autopan-rate": fx.autopan?.setRate(val); break;
      case "autopan-depth": fx.autopan?.setDepth(val); break;
      case "autopan-mix": fx.autopan?.setMix(val); break;
      case "chorus-mix": fx.chorus?.setMix(val); break;
      case "chorus-rate": fx.chorus?.setRate(val); break;
      case "tube-drive": fx.tube?.setDrive(val); break;
      case "tube-tone": fx.tube?.setTone(val); break;
      case "phaser-rate": fx.phaser?.setRate(val); break;
      case "phaser-mix": fx.phaser?.setMix(val); break;
      case "flanger-rate": fx.flanger?.setRate(val); break;
      case "flanger-mix": fx.flanger?.setMix(val); break;
      case "rotary-mix": fx.rotary?.setMix(val); break;
      case "tremolo-rate": fx.tremolo?.setRate(val); break;
      case "tremolo-depth": fx.tremolo?.setDepth(val); break;
      case "delay-mix": fx.delay?.setMix(val); break;
      case "delay-feedback": fx.delay?.setFeedback(val); break;
      case "delay-division": fx.delay?.setDivision(val); break;
      case "reverb-mix": fx.reverb?.setMix(val); break;
      case "reverb-decay": fx.reverb?.setDecay(val); break;
      case "reverb-size": fx.reverb?.setRoomSize(val); break;
      case "flanger-feedback": fx.flanger?.setFeedback(val); break;
      case "tremolo-mix": fx.tremolo?.setMix(val); break;
      case "eq-low": fx.masterEq?.setLowGain(val); break;
      case "eq-mid": fx.masterEq?.setMidGain(val); break;
      case "eq-high": fx.masterEq?.setHighGain(val); break;
    }
  }

  bindEasyEditControls() {
    const cutoff = document.getElementById("easy-cutoff-slider");
    cutoff?.addEventListener("input", e => {
      const val = parseFloat(e.target.value);
      if (synthEngine.activePatch) synthEngine.activePatch.filterCutoff = val;
    });

    const reso = document.getElementById("easy-reso-slider");
    reso?.addEventListener("input", e => {
      const val = parseFloat(e.target.value);
      if (synthEngine.activePatch) synthEngine.activePatch.filterQ = val;
    });

    const attack = document.getElementById("easy-attack-slider");
    attack?.addEventListener("input", e => {
      const val = parseFloat(e.target.value);
      if (synthEngine.activePatch) synthEngine.activePatch.attack = val;
    });

    const release = document.getElementById("easy-release-slider");
    release?.addEventListener("input", e => {
      const val = parseFloat(e.target.value);
      if (synthEngine.activePatch) synthEngine.activePatch.release = val;
    });
  }

  bindRealtimeKnobs() {
    const knobs = this.container.querySelectorAll(".triton-silver-knob");
    knobs.forEach(knob => {
      const param = knob.getAttribute("data-knob");
      const notch = knob.querySelector(".knob-notch");
      let isDragging = false;
      let startY = 0;
      let val = 0.5;

      const onMouseDown = e => {
        isDragging = true;
        startY = e.clientY || (e.touches && e.touches[0].clientY);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        window.addEventListener("touchmove", onMouseMove);
        window.addEventListener("touchend", onMouseUp);
      };

      const onMouseMove = e => {
        if (!isDragging) return;
        const currentY = e.clientY || (e.touches && e.touches[0].clientY);
        const delta = startY - currentY;
        val = Math.max(0, Math.min(1.0, val + delta * 0.005));
        const deg = -140 + val * 280;
        if (notch) notch.style.transform = `rotate(${deg}deg)`;

        // Modulate synth / FX live
        if (param === "cutoff" && synthEngine.activePatch) {
          synthEngine.activePatch.filterCutoff = 800 + val * 12000;
        } else if (param === "resonance" && synthEngine.activePatch) {
          synthEngine.activePatch.filterQ = 0.5 + val * 6;
        } else if (param === "eg-int" && synthEngine.activePatch) {
          synthEngine.activePatch.attack = 0.001 + val * 0.4;
        } else if (param === "fx-depth" && audioCore.fxRack) {
          audioCore.fxRack.chorus.setMix(val);
          audioCore.fxRack.autopan.setMix(val);
          audioCore.fxRack.reverb.setMix(val * 0.7);
        }
      };

      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("touchmove", onMouseMove);
        window.removeEventListener("touchend", onMouseUp);
      };

      knob.addEventListener("mousedown", onMouseDown);
      knob.addEventListener("touchstart", onMouseDown, { passive: true });
    });
  }

  bindSearch() {
    const searchInput = document.getElementById("triton-search-input");
    searchInput?.addEventListener("input", e => {
      this.searchQuery = e.target.value;
      clearTimeout(this._searchDebounce);
      this._searchDebounce = setTimeout(() => {
        const programs = this.getGridPrograms();
        const grid = this.container.querySelector(".touchview-program-grid");
        if (grid) {
          grid.innerHTML = programs
            .map(
              p => `
            <div class="triton-prog-cell ${this.isGridCellActive(p) ? "active" : ""}" data-prog-id="${p.id}">
              <span class="prog-bank-code">${this.activeBankId.replace("_", " ")}</span>
              <span class="prog-num">${p.num}</span>
              <span class="prog-name-label">${p.name}</span>
              <span class="prog-star">★</span>
            </div>
          `
            )
            .join("");
          this.bindProgramGrid();
        }
      }, 160);
    });
  }

  applyM1Program(prog) {
    const fx = audioCore.fxRack;
    const mType = prog.m1Type || "";

    // Reset all FX to clean baseline first to prevent unwanted bleed
    if (fx) {
      fx.tube.setBypass(true);
      fx.autopan.setBypass(true);
      fx.chorus.setBypass(true);
      fx.phaser.setBypass(true);
      fx.flanger.setBypass(true);
      fx.rotary.setBypass(true);
      fx.tremolo.setBypass(true);
      fx.delay.setBypass(true);
      fx.reverb.setBypass(false);
      fx.masterEq.setLowGain(0);
      fx.masterEq.setMidGain(0);
      fx.masterEq.setHighGain(0);
    }

    if (mType === "ooh_ahh" || mType === "choir") {
      // ★ 03 Ooh-Ahh: Queen "I'm Going Slightly Mad" / Korg M1 Signature Vocal Choir
      // Genuine PCM human choir + dual "Ooh"-to-"Ahh" formant morph + M1 Stereo Chorus + Cathedral Hall
      multiLayerEngine.setSingleInstrument("choir_aahs");
      if (fx) {
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.45);
        fx.chorus.setRate(0.95);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.35);
        fx.reverb.setDecay(3.2);
        fx.reverb.setRoomSize(0.85);
        fx.masterEq.setLowGain(1.0);
        fx.masterEq.setMidGain(1.5);
        fx.masterEq.setHighGain(3.2);
      }
    } else if (mType === "universe") {
      // ★ 00 Universe: Ethereal composite texture (Vocal Choir + Warm Strings + Crystal Bell Chimes)
      multiLayerEngine.isCombiMode = true;
      multiLayerEngine.isSynthMode = false;
      multiLayerEngine.layers = [
        { id: 0, name: "M1 Ooh-Ahh Vocal Choir", inst: "choir_aahs", fx: "chorus_lush", gain: 0.75, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
        { id: 1, name: "Triton Warm Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.65, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
        { id: 2, name: "Celestial Bell Shimmer", inst: "electric_piano_1", fx: "clean", gain: 0.45, pan: 0.10, oct: 1, minVel: 30, maxVel: 127, enabled: true },
        { id: 3, name: "Crystal Space Chime", inst: "vibraphone", fx: "reverb_hall", gain: 0.35, pan: -0.10, oct: 1, minVel: 50, maxVel: 127, enabled: true },
      ];
      multiLayerEngine.init();
      multiLayerEngine.syncLayerFx();
      multiLayerEngine.notifyLayerChange();
      if (fx) {
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.38);
        fx.reverb.setDecay(3.6);
        fx.reverb.setRoomSize(0.90);
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.40);
        fx.chorus.setRate(0.80);
      }
    } else if (mType === "piano16") {
      // ★ 01 Piano 16': Madonna "Vogue" / Black Box 90s House Piano
      multiLayerEngine.setSingleInstrument("acoustic_grand_piano");
      if (fx) {
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.42);
        fx.chorus.setRate(1.25);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.26);
        fx.reverb.setDecay(2.2);
        fx.masterEq.setLowGain(-1.0);
        fx.masterEq.setMidGain(3.5);
        fx.masterEq.setHighGain(3.8);
      }
    } else if (mType === "brass1") {
      // ★ 02 Brass 1: Punchy 80s/90s analog horn section
      multiLayerEngine.setSingleInstrument("brass_section");
      if (fx) {
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.28);
        fx.chorus.setRate(0.65);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.22);
        fx.reverb.setDecay(1.8);
        fx.masterEq.setLowGain(2.0);
        fx.masterEq.setMidGain(1.5);
      }
    } else if (mType === "guitar1") {
      // ★ 04 Guitar 1: Clean acoustic/electric 6-string finger pluck
      multiLayerEngine.setSingleInstrument("acoustic_guitar_steel");
      if (fx) {
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.20);
        fx.reverb.setDecay(1.6);
        fx.masterEq.setHighGain(2.0);
      }
    } else if (mType === "bottle_bell") {
      // ★ 05 Bottle Bell: Blowing over glass bottle chime
      multiLayerEngine.setSingleInstrument("vibraphone");
      if (fx) {
        fx.delay.setBypass(false);
        fx.delay.setMix(0.28);
        fx.delay.setDivision(0.375);
        fx.delay.setFeedback(0.35);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.30);
        fx.reverb.setDecay(3.0);
      }
    } else if (mType === "fretless") {
      // ★ 06 Fretless: Singing fretless bass with expressive chorus mwah
      multiLayerEngine.setSingleInstrument("acoustic_bass");
      if (fx) {
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.42);
        fx.chorus.setRate(1.1);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.18);
        fx.reverb.setDecay(1.4);
        fx.masterEq.setLowGain(3.5);
        fx.masterEq.setMidGain(2.2);
      }
    } else if (mType === "symphonic" || mType === "strings") {
      // ★ 07 Symphonic / 27 Strings: Full orchestral strings
      multiLayerEngine.setSingleInstrument("string_ensemble_1");
      if (fx) {
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.35);
        fx.chorus.setRate(0.75);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.30);
        fx.reverb.setDecay(2.8);
      }
    } else if (mType === "pan_flute") {
      // ★ 08 Pan Flute: Breathy Andean pan pipes with echo
      multiLayerEngine.setSingleInstrument("flute");
      if (fx) {
        fx.delay.setBypass(false);
        fx.delay.setMix(0.30);
        fx.delay.setDivision(0.375);
        fx.delay.setFeedback(0.32);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.28);
        fx.reverb.setDecay(2.6);
        fx.masterEq.setHighGain(2.5);
      }
    } else if (mType === "drums1") {
      // ★ 09 Drums #1: 16-bit gated drum kit
      multiLayerEngine.setSingleInstrument("synth_bass_1");
      if (fx) {
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.15);
        fx.reverb.setDecay(1.0);
      }
    } else if (mType === "epiano") {
      // ★ 11 E. Piano: Classic chorused bell tine EP
      multiLayerEngine.setSingleInstrument("electric_piano_1");
      if (fx) {
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.48);
        fx.chorus.setRate(1.0);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.25);
        fx.reverb.setDecay(2.2);
      }
    } else if (mType === "trumpet") {
      // ★ 12 Trumpet: Brilliant solo lead trumpet
      multiLayerEngine.setSingleInstrument("trumpet");
      if (fx) {
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.22);
        fx.reverb.setDecay(1.8);
        fx.masterEq.setHighGain(2.2);
      }
    } else if (mType === "nimbus") {
      // ★ 13 Nimbus: Deep celestial cloud pad with shimmer
      multiLayerEngine.setSingleInstrument("string_ensemble_1");
      if (fx) {
        fx.phaser.setBypass(false);
        fx.phaser.setMix(0.35);
        fx.phaser.setRate(0.30);
        fx.delay.setBypass(false);
        fx.delay.setMix(0.24);
        fx.delay.setDivision(0.375);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.35);
        fx.reverb.setDecay(3.5);
      }
    } else if (mType === "dist_guitar") {
      // ★ 14 Dist Guitar: Heavy 80s rock power chord distortion
      multiLayerEngine.setSingleInstrument("distortion_guitar");
      if (fx) {
        fx.tube.setBypass(false);
        fx.tube.setDrive(0.75);
        fx.tube.setMix(0.85);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.20);
        fx.reverb.setDecay(1.5);
      }
    } else if (mType === "vibes") {
      // ★ 15 Vibes: Acoustic vibraphone with tremolo rotor
      multiLayerEngine.setSingleInstrument("vibraphone");
      if (fx) {
        fx.tremolo.setBypass(false);
        fx.tremolo.setRate(4.5);
        fx.tremolo.setDepth(0.55);
        fx.tremolo.setMix(0.50);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.25);
        fx.reverb.setDecay(2.4);
      }
    } else if (mType === "pick_bass") {
      // ★ 16 Pick Bass: Punchy rock picked electric bass
      multiLayerEngine.setSingleInstrument("slap_bass_1");
      if (fx) {
        fx.tube.setBypass(false);
        fx.tube.setDrive(0.20);
        fx.tube.setMix(0.30);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.12);
        fx.reverb.setDecay(1.0);
        fx.masterEq.setLowGain(2.5);
      }
    } else if (mType === "flute") {
      // ★ 18 Flute: Organic acoustic concert flute
      multiLayerEngine.setSingleInstrument("flute");
      if (fx) {
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.25);
        fx.reverb.setDecay(2.2);
        fx.masterEq.setHighGain(2.0);
      }
    } else if (mType === "dream_pad") {
      // ★ 20 Dream Pad: Lush warm analog pad with slow chorus swell
      multiLayerEngine.setSingleInstrument("string_ensemble_1");
      if (fx) {
        fx.phaser.setBypass(false);
        fx.phaser.setRate(0.22);
        fx.phaser.setMix(0.40);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.35);
        fx.reverb.setDecay(3.5);
      }
    } else if (mType === "magic_piano") {
      // ★ 21 Magic Piano: Concert Grand + Crystal Bell Chime layer
      multiLayerEngine.isCombiMode = true;
      multiLayerEngine.isSynthMode = false;
      multiLayerEngine.layers = [
        { id: 0, name: "M1 Concert Grand", inst: "acoustic_grand_piano", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
        { id: 1, name: "Magic Bell Chime", inst: "electric_piano_1", fx: "reverb_hall", gain: 0.65, pan: 0.05, oct: 1, minVel: 30, maxVel: 127, enabled: true },
        { id: 2, name: "Celestial Glass Shimmer", inst: "vibraphone", fx: "clean", gain: 0.40, pan: -0.05, oct: 1, minVel: 60, maxVel: 127, enabled: true },
        { id: 3, name: "Soft Warm Pad", inst: "string_ensemble_1", fx: "clean", gain: 0.35, pan: 0, oct: 0, minVel: 70, maxVel: 127, enabled: false },
      ];
      multiLayerEngine.init();
      multiLayerEngine.syncLayerFx();
      multiLayerEngine.notifyLayerChange();
      if (fx) {
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.35);
        fx.chorus.setRate(1.1);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.30);
        fx.reverb.setDecay(2.8);
      }
    } else if (mType === "string12") {
      // ★ 24 12-String: Shimmering doubled 12-string acoustic guitar
      multiLayerEngine.setSingleInstrument("acoustic_guitar_steel");
      if (fx) {
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.52);
        fx.chorus.setRate(1.35);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.20);
        fx.reverb.setDecay(1.8);
        fx.masterEq.setHighGain(3.0);
      }
    } else if (mType === "kalimba") {
      // ★ 25 Kalimba: African thumb piano (mbira) with resonant metal tines
      multiLayerEngine.setSingleInstrument("kalimba");
      if (fx) {
        fx.delay.setBypass(false);
        fx.delay.setMix(0.18);
        fx.delay.setDivision(0.375);
        fx.delay.setFeedback(0.25);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.18);
        fx.reverb.setDecay(1.6);
      }
    } else if (mType === "abass") {
      // ★ 26 A. Bass: Warm upright acoustic double bass
      multiLayerEngine.setSingleInstrument("acoustic_bass");
      if (fx) {
        fx.tube.setBypass(false);
        fx.tube.setDrive(0.15);
        fx.tube.setMix(0.25);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.14);
        fx.reverb.setDecay(1.2);
        fx.masterEq.setLowGain(3.0);
      }
    } else if (mType === "koto") {
      // ★ 34 Koto Trem: Japanese plucked zither with rapid tremolo
      multiLayerEngine.setSingleInstrument("harpsichord");
      if (fx) {
        fx.tremolo.setBypass(false);
        fx.tremolo.setRate(8.0);
        fx.tremolo.setDepth(0.65);
        fx.tremolo.setMix(0.48);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.24);
        fx.reverb.setDecay(2.0);
      }
    } else if (mType === "bell_ring") {
      // ★ 35 Bell Ring: Shimmering metallic bell chime ring
      multiLayerEngine.setSingleInstrument("vibraphone");
      if (fx) {
        fx.flanger.setBypass(false);
        fx.flanger.setMix(0.38);
        fx.flanger.setRate(0.45);
        fx.flanger.setFeedback(0.28);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.35);
        fx.reverb.setDecay(3.5);
      }
    } else if (mType === "synth_bass1" || mType === "slapbass") {
      // ★ 36 Synth Bass 1 / Slap Bass: Punchy analog synth bass
      multiLayerEngine.setSingleInstrument("synth_bass_1");
      if (fx) {
        fx.tube.setBypass(true);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.12);
        fx.reverb.setDecay(1.0);
        fx.masterEq.setLowGain(2.5);
        fx.masterEq.setHighGain(1.0);
      }
    } else if (mType === "solo_synth") {
      // ★ 38 Solo Synth: Singing analog lead synth with delay
      multiLayerEngine.setSingleInstrument("brass_section");
      if (fx) {
        fx.delay.setBypass(false);
        fx.delay.setMix(0.28);
        fx.delay.setDivision(0.375);
        fx.delay.setFeedback(0.35);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.25);
        fx.reverb.setDecay(2.6);
      }
    } else if (mType === "organ2") {
      // ★ 39 Pop (Organ 2): Robin S "Show Me Love" Organ Bass
      multiLayerEngine.setSingleInstrument("drawbar_organ");
      if (fx) {
        fx.tube.setBypass(false);
        fx.tube.setDrive(0.22);
        fx.tube.setMix(0.45);
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.48);
        fx.chorus.setRate(0.90);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.22);
        fx.reverb.setDecay(1.6);
      }
    } else if (mType === "magician") {
      // ★ 40 Magician: Fantasy motion soundscape with breath & bells
      multiLayerEngine.isCombiMode = true;
      multiLayerEngine.isSynthMode = false;
      multiLayerEngine.layers = [
        { id: 0, name: "Breathy Woodwind Flute", inst: "flute", fx: "clean", gain: 0.85, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
        { id: 1, name: "Celestial Crystal Bell", inst: "vibraphone", fx: "reverb_hall", gain: 0.70, pan: 0.05, oct: 1, minVel: 20, maxVel: 127, enabled: true },
        { id: 2, name: "M1 Ooh-Ahh Vocal Pad", inst: "choir_aahs", fx: "chorus_lush", gain: 0.65, pan: 0, oct: 0, minVel: 30, maxVel: 127, enabled: true },
        { id: 3, name: "Deep Space Reverb", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.50, pan: 0, oct: 0, minVel: 50, maxVel: 127, enabled: true },
      ];
      multiLayerEngine.init();
      multiLayerEngine.syncLayerFx();
      multiLayerEngine.notifyLayerChange();
      if (fx) {
        fx.delay.setBypass(false);
        fx.delay.setMix(0.30);
        fx.delay.setDivision(0.375);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.35);
        fx.reverb.setDecay(3.8);
      }
    } else if (mType === "lore") {
      multiLayerEngine.setSingleInstrument("alto_sax");
      if (fx) {
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.20);
        fx.reverb.setDecay(2.2);
      }
    } else if (mType === "freshair") {
      multiLayerEngine.setSingleInstrument("electric_piano_1");
      if (fx) {
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.25);
        fx.reverb.setDecay(2.4);
      }
    }
  }

  applyYamahaEosProgram(prog) {
    const fx = audioCore.fxRack;
    const eosType = prog.eosType || "";
    const instId = prog.instId || (eosType.startsWith("eos_") ? eosType : "eos_" + eosType);

    // Crucial: Load the unique PCM instrument for each preset
    multiLayerEngine.setSingleInstrument(instId);

    // Reset all FX to clean baseline first to prevent unwanted bleed
    if (fx) {
      fx.tube?.setBypass(true);
      fx.autopan?.setBypass(true);
      fx.chorus?.setBypass(true);
      fx.phaser?.setBypass(true);
      fx.flanger?.setBypass(true);
      fx.rotary?.setBypass(true);
      fx.tremolo?.setBypass(true);
      fx.delay?.setBypass(true);
      fx.compressor?.setBypass(true);
      fx.reverb?.setBypass(false);
      fx.reverb?.setMix(0.18);
      fx.reverb?.setDecay(1.8);
      fx.masterEq?.setLowGain(0);
      fx.masterEq?.setMidGain(0);
      fx.masterEq?.setHighGain(0);
    }

    if (!fx) return;

    // Preset-specific authentic FX staging
    if (eosType === "dreamn") {
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.35);
      fx.chorus?.setRate(0.85);
      fx.reverb?.setMix(0.28);
      fx.reverb?.setDecay(2.6);
      fx.masterEq?.setLowGain(0.5);
      fx.masterEq?.setHighGain(1.0);
    } else if (eosType === "deeproads") {
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.22);
      fx.chorus?.setRate(0.45);
      fx.reverb?.setMix(0.18);
      fx.reverb?.setDecay(1.8);
      fx.masterEq?.setLowGain(0.5);
      fx.masterEq?.setHighGain(1.0);
    } else if (eosType === "oldroads") {
      fx.autopan?.setBypass(false);
      fx.autopan?.setMix(0.25);
      fx.autopan?.setRate(1.2);
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.18);
      fx.reverb?.setMix(0.16);
      fx.masterEq?.setHighGain(1.0);
    } else if (eosType === "wah_clavi") {
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.15);
      fx.delay?.setDivision(0.25);
      fx.delay?.setFeedback(0.20);
      fx.masterEq?.setMidGain(2.0);
      fx.masterEq?.setHighGain(2.5);
    } else if (eosType === "lofi_piano") {
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.18);
      fx.reverb?.setMix(0.22);
      fx.masterEq?.setLowGain(1.0);
      fx.masterEq?.setHighGain(-1.0);
    } else if (eosType === "cp80") {
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.35);
      fx.chorus?.setRate(1.0);
      fx.reverb?.setMix(0.24);
      fx.masterEq?.setHighGain(1.5);
    } else if (eosType === "tx816") {
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.38);
      fx.chorus?.setRate(0.95);
      fx.reverb?.setMix(0.25);
      fx.masterEq?.setHighGain(2.0);
    } else if (eosType === "midi_grand") {
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.15);
      fx.reverb?.setMix(0.22);
      fx.masterEq?.setLowGain(0.5);
      fx.masterEq?.setHighGain(1.5);
    } else if (eosType === "vibes") {
      fx.tremolo?.setBypass(false);
      fx.tremolo?.setRate(4.2);
      fx.tremolo?.setDepth(0.40);
      fx.reverb?.setMix(0.28);
      fx.reverb?.setDecay(2.2);
    } else if (eosType === "eos_saw900") {
      fx.flanger?.setBypass(false);
      fx.flanger?.setMix(0.28);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.22);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.28);
      fx.reverb?.setMix(0.24);
      fx.masterEq?.setHighGain(1.5);
    } else if (eosType === "eos_extacy") {
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.32);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.22);
      fx.delay?.setDivision(0.25);
      fx.reverb?.setMix(0.22);
      fx.masterEq?.setHighGain(1.5);
    } else if (eosType === "thicksaw") {
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.38);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.25);
      fx.delay?.setDivision(0.375);
      fx.reverb?.setMix(0.26);
      fx.masterEq?.setHighGain(2.0);
    } else if (eosType === "square2") {
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.35);
      fx.reverb?.setMix(0.16);
      fx.masterEq?.setMidGain(1.5);
    } else if (eosType === "seq_ana") {
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.24);
      fx.delay?.setDivision(0.25);
      fx.delay?.setFeedback(0.30);
      fx.reverb?.setMix(0.20);
    } else if (eosType === "sweeppad") {
      fx.phaser?.setBypass(false);
      fx.phaser?.setMix(0.40);
      fx.phaser?.setRate(0.35);
      fx.reverb?.setMix(0.35);
      fx.reverb?.setDecay(3.0);
    } else if (eosType === "warmpad") {
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.35);
      fx.reverb?.setMix(0.32);
      fx.reverb?.setDecay(2.8);
    } else if (eosType === "vocoder" || eosType === "eos_vocoder") {
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.35);
      fx.reverb?.setMix(0.25);
      fx.masterEq?.setMidGain(2.0);
    } else if (eosType === "analog_brass") {
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-18);
      fx.reverb?.setMix(0.20);
      fx.masterEq?.setMidGain(1.0);
      fx.masterEq?.setHighGain(1.5);
    } else if (eosType === "synth_brass") {
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.28);
      fx.reverb?.setMix(0.22);
      fx.masterEq?.setHighGain(1.5);
    } else if (eosType === "organ_60s") {
      fx.rotary?.setBypass(false);
      fx.rotary?.setSpeed("fast");
      fx.rotary?.setMix(0.45);
      fx.reverb?.setMix(0.22);
    } else if (eosType === "rubber_bass") {
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-22);
      fx.masterEq?.setLowGain(2.0);
    } else if (eosType === "seq_bass") {
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.18);
      fx.delay?.setDivision(0.25);
      fx.masterEq?.setLowGain(2.5);
    } else if (eosType === "synbass101") {
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.40);
      fx.masterEq?.setLowGain(3.0);
    } else if (eosType === "jazz_guitar") {
      // Warm, pristine hollow-body archtop jazz guitar tone (Wes Montgomery / Joe Pass / George Benson)
      fx.tube?.setBypass(true);
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-18);
      fx.compressor?.setRatio(2.5);
      fx.compressor?.setAttack(0.012);
      fx.compressor?.setRelease(0.22);
      fx.compressor?.setMakeup(2.2);
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.12);
      fx.chorus?.setRate(0.65);
      fx.reverb?.setMix(0.18);
      fx.reverb?.setDecay(1.6);
      fx.masterEq?.setLowGain(1.2);
      fx.masterEq?.setMidGain(1.5);
      fx.masterEq?.setHighGain(0.0);
    } else if (eosType === "upright_bass") {
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-20);
      fx.compressor?.setRatio(3.5);
      fx.compressor?.setMakeup(2.5);
      fx.reverb?.setMix(0.14);
      fx.reverb?.setDecay(1.2);
      fx.masterEq?.setLowGain(3.0);
      fx.masterEq?.setMidGain(1.0);
      fx.masterEq?.setHighGain(-0.5);
    } else if (eosType === "tekk_hit1" || eosType === "tekk_hit2" || eosType === "tekk_hit3") {
      fx.reverb?.setMix(0.25);
      fx.reverb?.setDecay(1.4);
      fx.masterEq?.setLowGain(1.5);
      fx.masterEq?.setHighGain(1.0);

    // ── Omega Premium Elite Collection ──

    } else if (eosType === "fantasia") {
      // Ethereal motion pad with phaser sweep + lush cathedral reverb
      fx.phaser?.setBypass(false);
      fx.phaser?.setMix(0.35);
      fx.phaser?.setRate(0.25);
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.28);
      fx.chorus?.setRate(0.55);
      fx.reverb?.setMix(0.38);
      fx.reverb?.setDecay(3.5);
      fx.masterEq?.setHighGain(1.0);
    } else if (eosType === "jp_strings") {
      // JP-8000 lush supersaw strings – wide stereo chorus + hall reverb
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.40);
      fx.chorus?.setRate(0.75);
      fx.reverb?.setMix(0.30);
      fx.reverb?.setDecay(2.8);
      fx.masterEq?.setMidGain(1.0);
      fx.masterEq?.setHighGain(1.5);
    } else if (eosType === "ob_strings") {
      // Oberheim OB-X analog string ensemble – warm ensemble + plate reverb
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.35);
      fx.chorus?.setRate(0.90);
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-16);
      fx.compressor?.setRatio(2.5);
      fx.reverb?.setMix(0.25);
      fx.reverb?.setDecay(2.2);
      fx.masterEq?.setLowGain(1.0);
    } else if (eosType === "euro_hit") {
      // 90s Eurodance orchestral hit stab – punchy compression + gated reverb
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-14);
      fx.compressor?.setRatio(6.0);
      fx.compressor?.setAttack(0.005);
      fx.compressor?.setRelease(0.10);
      fx.compressor?.setMakeup(4.0);
      fx.reverb?.setMix(0.30);
      fx.reverb?.setDecay(0.8);
      fx.masterEq?.setLowGain(2.0);
      fx.masterEq?.setHighGain(2.0);
    } else if (eosType === "acid_bass") {
      // TB-303 acid squelch bass – tube overdrive + resonant filter + tape delay
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.45);
      fx.tube?.setMix(0.60);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.18);
      fx.delay?.setDivision(0.25);
      fx.delay?.setFeedback(0.25);
      fx.reverb?.setMix(0.10);
      fx.masterEq?.setLowGain(3.5);
      fx.masterEq?.setMidGain(2.0);
    } else if (eosType === "funk_gtr") {
      // Disco funk wah guitar – auto-wah + compressor + room reverb
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-18);
      fx.compressor?.setRatio(3.5);
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.15);
      fx.reverb?.setMix(0.16);
      fx.reverb?.setDecay(1.2);
      fx.masterEq?.setMidGain(2.0);
      fx.masterEq?.setHighGain(1.5);
    } else if (eosType === "silky_pad") {
      // Ultra-lush dreamy string cloud – slow chorus + deep cathedral reverb
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.38);
      fx.chorus?.setRate(0.40);
      fx.reverb?.setMix(0.40);
      fx.reverb?.setDecay(4.0);
      fx.masterEq?.setLowGain(0.5);
      fx.masterEq?.setHighGain(1.0);
    } else if (eosType === "space_voice") {
      // Ethereal space choir synth vocal – dimension chorus + delay + huge reverb
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.35);
      fx.chorus?.setRate(0.65);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.22);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.30);
      fx.reverb?.setMix(0.35);
      fx.reverb?.setDecay(3.2);
      fx.masterEq?.setMidGain(1.5);
    } else if (eosType === "rotary_organ") {
      // Fast Leslie rotary Hammond organ
      fx.rotary?.setBypass(false);
      fx.rotary?.setSpeed("fast");
      fx.rotary?.setMix(0.50);
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.25);
      fx.tube?.setMix(0.40);
      fx.reverb?.setMix(0.18);
      fx.reverb?.setDecay(1.4);
    } else if (eosType === "mg_square") {
      // Moog square wave mono lead – overdrive + ping-pong delay
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.30);
      fx.tube?.setMix(0.50);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.24);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.30);
      fx.reverb?.setMix(0.20);
      fx.masterEq?.setMidGain(1.5);
      fx.masterEq?.setHighGain(1.0);
    } else if (eosType === "slow_strings") {
      // Cinematic slow attack orchestral strings – lush ensemble + concert hall
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.30);
      fx.chorus?.setRate(0.55);
      fx.reverb?.setMix(0.32);
      fx.reverb?.setDecay(3.0);
      fx.masterEq?.setLowGain(1.0);
      fx.masterEq?.setMidGain(0.5);
      fx.masterEq?.setHighGain(1.0);
    } else if (eosType === "oct_brass") {
      // Massive octave-layered synth brass – punchy compression + studio plate
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-16);
      fx.compressor?.setRatio(4.0);
      fx.compressor?.setAttack(0.008);
      fx.compressor?.setMakeup(3.5);
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.20);
      fx.reverb?.setMix(0.22);
      fx.reverb?.setDecay(1.8);
      fx.masterEq?.setMidGain(1.0);
      fx.masterEq?.setHighGain(2.0);
    }
  }

  applyUserBankProgram(prog) {
    const fx = audioCore.fxRack;
    const userType = prog.userType || "";
    const instId = prog.instId || "edm_house_piano";

    // Route PCM multisample into engine
    multiLayerEngine.setSingleInstrument(instId);

    // Reset FX rack baseline to clean slate
    if (fx) {
      fx.tube?.setBypass(true);
      fx.autopan?.setBypass(true);
      fx.chorus?.setBypass(true);
      fx.phaser?.setBypass(true);
      fx.flanger?.setBypass(true);
      fx.rotary?.setBypass(true);
      fx.tremolo?.setBypass(true);
      fx.delay?.setBypass(true);
      fx.compressor?.setBypass(true);
      fx.bitcrusher?.setBypass(true);
      fx.reverb?.setBypass(false);
      fx.reverb?.setMix(0.18);
      fx.reverb?.setDecay(1.8);
      fx.masterEq?.setLowGain(0);
      fx.masterEq?.setMidGain(0);
      fx.masterEq?.setHighGain(0);
    }

    if (!fx) return;

    // --- USER BANK B: House & Garage Classics ---
    if (userType === "house_piano") {
      // 90s House Piano - Clean punchy compression + stereo plate reverb
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-16);
      fx.compressor?.setRatio(3.2);
      fx.compressor?.setAttack(0.015);
      fx.compressor?.setMakeup(2.2);
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.10);
      fx.chorus?.setRate(0.8);
      fx.reverb?.setMix(0.20);
      fx.reverb?.setDecay(1.8);
      fx.masterEq?.setLowGain(0.5);
      fx.masterEq?.setHighGain(0.5);
    } else if (userType === "korg_organ") {
      // Genuine Korg Triton Techno Rock Organ - Fast Leslie rotary + subtle tube warmth
      fx.rotary?.setBypass(false);
      fx.rotary?.setSpeed("fast");
      fx.rotary?.setMix(0.48);
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.18);
      fx.tube?.setMix(0.25);
      fx.reverb?.setMix(0.18);
      fx.reverb?.setDecay(1.6);
      fx.masterEq?.setMidGain(1.0);
    } else if (userType === "river_bass1") {
      // River House Bass 1 - Tight punchy compression + low end warmth
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-22);
      fx.compressor?.setRatio(4.0);
      fx.compressor?.setAttack(0.010);
      fx.compressor?.setRelease(0.12);
      fx.compressor?.setMakeup(3.0);
      fx.reverb?.setMix(0.06);
      fx.reverb?.setDecay(0.8);
      fx.masterEq?.setLowGain(2.5);
      fx.masterEq?.setMidGain(-0.5);
    } else if (userType === "dx_funkbass") {
      // DX Funk Slap - Snappy slap compression + subtle chorus
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-18);
      fx.compressor?.setRatio(3.5);
      fx.compressor?.setAttack(0.008);
      fx.compressor?.setMakeup(2.5);
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.12);
      fx.chorus?.setRate(1.0);
      fx.reverb?.setMix(0.10);
      fx.reverb?.setDecay(1.0);
      fx.masterEq?.setLowGain(2.0);
      fx.masterEq?.setHighGain(0.5);
    } else if (userType === "club_saw1") {
      // Club Saw Lead 1 - Stereo ensemble + stereo tape delay
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.28);
      fx.chorus?.setRate(0.85);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.18);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.22);
      fx.reverb?.setMix(0.20);
      fx.reverb?.setDecay(2.2);
      fx.masterEq?.setHighGain(0.5);
    } else if (userType === "club_brass") {
      // Vital Club Brass Lead - Punch limiter + studio plate
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-16);
      fx.compressor?.setRatio(4.0);
      fx.compressor?.setAttack(0.006);
      fx.compressor?.setMakeup(2.5);
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.15);
      fx.chorus?.setRate(0.7);
      fx.reverb?.setMix(0.22);
      fx.reverb?.setDecay(1.8);
      fx.masterEq?.setMidGain(1.0);
    } else if (userType === "hiq_bass") {
      // HiQ Deep Bass - Clean heavy sub punch
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-22);
      fx.compressor?.setRatio(4.5);
      fx.compressor?.setAttack(0.010);
      fx.compressor?.setRelease(0.10);
      fx.compressor?.setMakeup(3.5);
      fx.reverb?.setMix(0.05);
      fx.reverb?.setDecay(0.6);
      fx.masterEq?.setLowGain(2.5);
    } else if (userType === "mika_piano") {
      // Mika Dance Piano - Heavy club chord punch + plate reverb
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-18);
      fx.compressor?.setRatio(3.0);
      fx.compressor?.setAttack(0.020);
      fx.compressor?.setMakeup(2.5);
      fx.reverb?.setMix(0.20);
      fx.reverb?.setDecay(1.8);
      fx.masterEq?.setLowGain(0.5);
      fx.masterEq?.setHighGain(0.5);
    } else if (userType === "river_bass2") {
      // River Sub Bass 2 - Smooth low-end analog warmth
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.14);
      fx.tube?.setMix(0.20);
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-22);
      fx.compressor?.setRatio(4.0);
      fx.compressor?.setAttack(0.012);
      fx.compressor?.setMakeup(3.0);
      fx.masterEq?.setLowGain(3.0);
      fx.masterEq?.setMidGain(-1.0);
    }

    // --- USER BANK C: EDM & Festival Anthems ---
    else if (userType === "iconic_lead1") {
      // Stadium EDM Anthem Lead 1 - Wide stereo + ping-pong delay + hall reverb
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.25);
      fx.chorus?.setRate(0.85);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.22);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.25);
      fx.reverb?.setMix(0.22);
      fx.reverb?.setDecay(2.2);
      fx.masterEq?.setHighGain(0.5);
    } else if (userType === "iconic_lead2") {
      // Festival Melbourne Screamer - Controlled presence + concert hall
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.20);
      fx.tube?.setMix(0.28);
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-16);
      fx.compressor?.setRatio(3.5);
      fx.compressor?.setAttack(0.008);
      fx.compressor?.setMakeup(2.5);
      fx.reverb?.setMix(0.24);
      fx.reverb?.setDecay(2.4);
      fx.masterEq?.setMidGain(1.2);
    } else if (userType === "supersaw_jp80") {
      // Authentic JP-8000 SuperSaw Stack - Massive unison chorus + tape delay
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.35);
      fx.chorus?.setRate(0.75);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.20);
      fx.delay?.setDivision(0.25);
      fx.delay?.setFeedback(0.22);
      fx.reverb?.setMix(0.25);
      fx.reverb?.setDecay(2.8);
      fx.masterEq?.setLowGain(1.0);
      fx.masterEq?.setHighGain(0.8);
    } else if (userType === "bigroom_saw") {
      // Big Room Festival Saw - Punch limiter + concert hall
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-15);
      fx.compressor?.setRatio(4.5);
      fx.compressor?.setAttack(0.005);
      fx.compressor?.setMakeup(2.8);
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.25);
      fx.chorus?.setRate(0.8);
      fx.reverb?.setMix(0.26);
      fx.reverb?.setDecay(2.5);
      fx.masterEq?.setMidGain(0.8);
    } else if (userType === "trance_oct") {
      // Shimmering Euro Anthem Trance Octave - Dimension chorus + ping-pong
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.28);
      fx.chorus?.setRate(0.65);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.22);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.28);
      fx.reverb?.setMix(0.26);
      fx.reverb?.setDecay(2.8);
      fx.masterEq?.setHighGain(0.5);
    } else if (userType === "retro_synthbass1") {
      // Punch Synth Bass - Punchy low-end control
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-22);
      fx.compressor?.setRatio(4.5);
      fx.compressor?.setAttack(0.010);
      fx.compressor?.setRelease(0.12);
      fx.compressor?.setMakeup(3.0);
      fx.masterEq?.setLowGain(2.5);
    } else if (userType === "club_brass_rave") {
      // Rave Synth Brass - Punch compression + gated plate
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.18);
      fx.tube?.setMix(0.25);
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-16);
      fx.compressor?.setRatio(4.0);
      fx.compressor?.setAttack(0.008);
      fx.compressor?.setMakeup(2.5);
      fx.reverb?.setMix(0.22);
      fx.reverb?.setDecay(1.8);
      fx.masterEq?.setHighGain(0.8);
    } else if (userType === "k2500_oohs") {
      // Kurzweil K-2500 Voice Oohs - Shimmer chorus + deep cathedral
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.32);
      fx.chorus?.setRate(0.50);
      fx.reverb?.setMix(0.35);
      fx.reverb?.setDecay(3.5);
      fx.masterEq?.setLowGain(0.5);
    } else if (userType === "gus_voice") {
      // GUS Synth Voice - Slow phaser + chorus + cathedral reverb
      fx.phaser?.setBypass(false);
      fx.phaser?.setMix(0.22);
      fx.phaser?.setRate(0.35);
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.22);
      fx.chorus?.setRate(0.60);
      fx.reverb?.setMix(0.30);
      fx.reverb?.setDecay(3.0);
      fx.masterEq?.setMidGain(1.0);
    }

    // --- USER BANK D: Techno, Trance & Underground ---
    else if (userType === "warehouse_saw") {
      // Techno Warehouse Saw - Controlled overdrive + tight dark room
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.24);
      fx.tube?.setMix(0.32);
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-16);
      fx.compressor?.setRatio(3.5);
      fx.compressor?.setAttack(0.008);
      fx.compressor?.setMakeup(2.5);
      fx.reverb?.setMix(0.18);
      fx.reverb?.setDecay(1.4);
      fx.masterEq?.setMidGain(1.5);
    } else if (userType === "dark_organ") {
      // Dark Underground Organ - Subtle tube drive + dark studio plate
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.18);
      fx.tube?.setMix(0.25);
      fx.reverb?.setMix(0.20);
      fx.reverb?.setDecay(1.8);
      fx.masterEq?.setMidGain(1.0);
    } else if (userType === "trance_synth") {
      // Euro Trance Synth - Stereo flanger + ping-pong delay + concert hall
      fx.flanger?.setBypass(false);
      fx.flanger?.setMix(0.20);
      fx.flanger?.setRate(0.4);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.22);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.25);
      fx.reverb?.setMix(0.26);
      fx.reverb?.setDecay(2.6);
      fx.masterEq?.setHighGain(0.5);
    } else if (userType === "berlin_sub") {
      // Berlin Sub Bass - Heavy low-end sub boost + tight compression
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-24);
      fx.compressor?.setRatio(5.0);
      fx.compressor?.setAttack(0.015);
      fx.compressor?.setRelease(0.15);
      fx.compressor?.setMakeup(3.8);
      fx.masterEq?.setLowGain(3.5);
      fx.masterEq?.setHighGain(-1.5);
    } else if (userType === "club_saw2") {
      // Detuned Club Saw 2 - Punch compressor + stereo tape delay
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-15);
      fx.compressor?.setRatio(4.0);
      fx.compressor?.setAttack(0.008);
      fx.compressor?.setMakeup(2.5);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.20);
      fx.delay?.setDivision(0.25);
      fx.delay?.setFeedback(0.22);
      fx.reverb?.setMix(0.20);
      fx.reverb?.setDecay(1.8);
      fx.masterEq?.setMidGain(1.0);
    } else if (userType === "trance_oct2") {
      // Trance Synth Oct2 - Massive octave stack + concert hall
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.30);
      fx.chorus?.setRate(0.70);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.22);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.25);
      fx.reverb?.setMix(0.28);
      fx.reverb?.setDecay(3.0);
      fx.masterEq?.setHighGain(0.5);
    } else if (userType === "saw_gs") {
      // Saw Wave GS - Warm analog chorus + plate reverb
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.26);
      fx.chorus?.setRate(0.65);
      fx.reverb?.setMix(0.20);
      fx.reverb?.setDecay(2.0);
      fx.masterEq?.setMidGain(0.8);
    } else if (userType === "acid_resonator") {
      // Screaming TB-303 Acid Resonator - Overdrive drive + resonant tape delay
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.28);
      fx.tube?.setMix(0.38);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.18);
      fx.delay?.setDivision(0.25);
      fx.delay?.setFeedback(0.25);
      fx.reverb?.setMix(0.10);
      fx.reverb?.setDecay(1.0);
      fx.masterEq?.setLowGain(2.5);
      fx.masterEq?.setMidGain(1.8);
    } else if (userType === "doctor_solo") {
      // Doctor Solo Lead - Piercing pitch overdrive + ping-pong delay
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.20);
      fx.tube?.setMix(0.28);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.22);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.26);
      fx.reverb?.setMix(0.24);
      fx.reverb?.setDecay(2.5);
      fx.masterEq?.setMidGain(1.2);
    }

    // --- USER BANK E: Studio Rompler & GM2 Elite (Jnsgm2.sf2) ---
    else if (userType === "jns_rhodes") {
      // Vintage Mark I Rhodes - Warm suitcase bell-tine EP + stereo chorus + studio plate
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.35);
      fx.chorus?.setRate(0.95);
      fx.reverb?.setMix(0.22);
      fx.reverb?.setDecay(1.8);
      fx.masterEq?.setLowGain(1.0);
      fx.masterEq?.setHighGain(0.5);
    } else if (userType === "jns_hammond") {
      // Gospel Hammond B3 - Fast rotary speaker + warm tube drive + plate reverb
      fx.rotary?.setBypass(false);
      fx.rotary?.setSpeed("fast");
      fx.rotary?.setMix(0.50);
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.16);
      fx.tube?.setMix(0.20);
      fx.reverb?.setMix(0.20);
      fx.reverb?.setDecay(1.5);
      fx.masterEq?.setMidGain(0.8);
    } else if (userType === "jns_shakuhachi") {
      // Bamboo Shakuhachi Flute - Breathy bamboo flute + ping-pong delay + cathedral hall
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.24);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.30);
      fx.reverb?.setMix(0.30);
      fx.reverb?.setDecay(3.0);
      fx.masterEq?.setHighGain(0.5);
    } else if (userType === "jns_fingered_bass") {
      // Classic Fingered Bass - Punch compressor + warm low end + subtle room
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-20);
      fx.compressor?.setRatio(3.8);
      fx.compressor?.setAttack(0.010);
      fx.compressor?.setRelease(0.12);
      fx.compressor?.setMakeup(3.0);
      fx.reverb?.setMix(0.08);
      fx.reverb?.setDecay(0.8);
      fx.masterEq?.setLowGain(2.5);
      fx.masterEq?.setMidGain(0.5);
    } else if (userType === "jns_charang") {
      // Charang Screamer - Overdrive lead + tape delay + concert hall
      fx.tube?.setBypass(false);
      fx.tube?.setDrive(0.18);
      fx.tube?.setMix(0.24);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.24);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.28);
      fx.reverb?.setMix(0.22);
      fx.reverb?.setDecay(2.2);
      fx.masterEq?.setMidGain(1.5);
    } else if (userType === "jns_5th_saw") {
      // 5th Power Saw Lead - Parallel 5th rave lead + ensemble chorus + ping-pong delay
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.32);
      fx.chorus?.setRate(0.85);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.20);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.22);
      fx.reverb?.setMix(0.22);
      fx.reverb?.setDecay(2.4);
      fx.masterEq?.setHighGain(0.5);
    } else if (userType === "jns_halo_pad") {
      // Ethereal Halo Pad - Roland D-50 / JV choir pad + phaser swirl + cathedral hall
      fx.phaser?.setBypass(false);
      fx.phaser?.setMix(0.35);
      fx.phaser?.setRate(0.4);
      fx.chorus?.setBypass(false);
      fx.chorus?.setMix(0.30);
      fx.chorus?.setRate(0.65);
      fx.reverb?.setMix(0.38);
      fx.reverb?.setDecay(3.8);
      fx.masterEq?.setLowGain(1.0);
    } else if (userType === "jns_bowed_glass") {
      // Bowed Crystal Glass - Acoustic glass texture + flanger + wide shimmer delay
      fx.flanger?.setBypass(false);
      fx.flanger?.setMix(0.28);
      fx.flanger?.setRate(0.5);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.18);
      fx.delay?.setDivision(0.5);
      fx.delay?.setFeedback(0.30);
      fx.reverb?.setMix(0.35);
      fx.reverb?.setDecay(3.5);
    } else if (userType === "jns_sitar") {
      // Mystic Sitar & Drone - Exotic sitar pluck + compressor + room ambience
      fx.compressor?.setBypass(false);
      fx.compressor?.setThreshold(-16);
      fx.compressor?.setRatio(3.2);
      fx.compressor?.setAttack(0.008);
      fx.compressor?.setMakeup(2.0);
      fx.delay?.setBypass(false);
      fx.delay?.setMix(0.15);
      fx.delay?.setDivision(0.375);
      fx.delay?.setFeedback(0.18);
      fx.reverb?.setMix(0.22);
      fx.reverb?.setDecay(1.6);
    }
  }
}
