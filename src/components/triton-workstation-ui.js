/**
 * KORG TRITON TouchView Workstation Console
 * Replicates the authentic Korg Triton Classic hardware workstation UI:
 * Brushed silver chassis, Realtime Controls 1-4, Bank Selectors (A, B, C, D, Factory, EXB-PCM),
 * 4-column TouchView Program Grid, and the full IFX/MFX effects routing matrix.
 */

import { TRITON_BANKS } from "../triton/triton-soundbanks.js";
import { TRITON_ALGORITHMS } from "../triton/triton-effects-matrix.js";
import { synthEngine } from "../audio/synth-engine.js";
import { audioCore } from "../audio/audio-core.js";
import { multiLayerEngine, COMBI_PRESETS } from "../audio/multi-layer-engine.js";

export class TritonWorkstationUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeBankId = "USER_A";
    this.activeSubTab = "BROWSER"; // 'BROWSER', 'EASY', 'IFX/MFX', 'ARP'
    this.activeProg = TRITON_BANKS.USER_A.programs[29]; // A036 Velo Piano ST (Concert Grand) default
    this.searchQuery = "";

    this.render();
    this.applyTritonProgram(this.activeProg);
  }

  isCombiBank() {
    return this.activeBankId === "COMBI";
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

  isGridCellActive(p) {
    if (this.isCombiBank()) {
      try {
        return multiLayerEngine.activeCombi.id === p.id;
      } catch (e) {
        return false;
      }
    }
    return this.activeProg.id === p.id;
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
            <div class="workstation-tag">MUSIC WORKSTATION / SAMPLER</div>
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

    // Default: BROWSER Mode
    return `
      <!-- Bank Selectors Row -->
      <div class="triton-banks-row">
        ${Object.values(TRITON_BANKS)
          .map(
            b => `
          <button class="triton-bank-card ${this.activeBankId === b.id ? "active" : ""}" data-bank="${b.id}">
            <div class="bank-thumb-preview">
              <div class="mini-triton-icon"></div>
            </div>
            <div class="bank-meta">
              <span class="bank-card-title">${b.name}</span>
              <span class="bank-card-desc">${b.category}</span>
            </div>
          </button>
        `
          )
          .join("")}
          <button class="triton-bank-card ${this.activeBankId === "COMBI" ? "active" : ""}" data-bank="COMBI">
            <div class="bank-thumb-preview">
              <div class="mini-triton-icon"></div>
            </div>
            <div class="bank-meta">
              <span class="bank-card-title">COMBI</span>
              <span class="bank-card-desc">4-Timbre Stacks</span>
            </div>
          </button>
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
          <span class="ifx-title">MULTI-EFFECTS ROUTING MATRIX (IFX 1-5 + MFX 1-2 + MEQ)</span>
          <span class="ifx-chip">102 EFFECT ALGORITHMS</span>
        </div>

        <div class="ifx-mfx-grid">
          <!-- 5 Insert Effects (IFX) -->
          <div class="ifx-column">
            <h4 class="ifx-col-title">INSERT EFFECTS (IFX)</h4>
            
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
      btn.addEventListener("click", () => {
        this.activeSubTab = btn.getAttribute("data-tab");
        this.render();
      });
    });
  }

  bindBankButtons() {
    this.container.querySelectorAll(".triton-bank-card").forEach(btn => {
      btn.addEventListener("click", () => {
        this.activeBankId = btn.getAttribute("data-bank");
        this.render();
      });
    });
  }

  bindProgramGrid() {
    this.container.querySelectorAll(".triton-prog-cell").forEach(cell => {
      cell.addEventListener("click", () => {
        const progId = cell.getAttribute("data-prog-id");
        // COMBI bank: trigger 4-timbre stack + update LCD
        if (this.isCombiBank()) {
          const cp = COMBI_PRESETS[progId];
          if (cp) {
            multiLayerEngine.setCombiPreset(progId);
            const lcdTitle = document.getElementById("triton-lcd-title");
            const lcdBankCat = document.getElementById("triton-lcd-bank-cat");
            const lcdCat = document.getElementById("triton-lcd-category");
            if (lcdTitle) lcdTitle.innerText = cp.name;
            if (lcdBankCat) lcdBankCat.innerText = `BANK: COMBI`;
            if (lcdCat) lcdCat.innerText = `CATEGORY: ${(cp.category || "").toUpperCase()}`;
            this.container.querySelectorAll(".triton-prog-cell").forEach(c => c.classList.remove("active"));
            cell.classList.add("active");
          }
          return;
        }
        const bank = TRITON_BANKS[this.activeBankId] || TRITON_BANKS.USER_A;
        const prog = bank.programs.find(p => p.id === progId);
        if (prog) {
          this.activeProg = prog;
          this.applyTritonProgram(prog, true);

          // Update LCD
          const lcdTitle = document.getElementById("triton-lcd-title");
          const lcdBankCat = document.getElementById("triton-lcd-bank-cat");
          const lcdCat = document.getElementById("triton-lcd-category");
          if (lcdTitle) lcdTitle.innerText = prog.name;
          if (lcdBankCat) lcdBankCat.innerText = `BANK: ${this.activeBankId.replace("_", " ")} ${prog.num}`;
          if (lcdCat) lcdCat.innerText = `CATEGORY: ${prog.category.toUpperCase()}`;

          this.container.querySelectorAll(".triton-prog-cell").forEach(c => c.classList.remove("active"));
          cell.classList.add("active");
        }
      });
    });
  }

  applyTritonProgram(prog, isUserExplicit = false) {
    if (!prog) return;

    if (prog.m1Type) {
      this.applyM1Program(prog);
      return;
    }

    const cat = (prog.category || "").toLowerCase();
    const name = (prog.name || "").toLowerCase();

    // Determine if this program is an acoustic/electric PCM bank instrument
    const isGuitar = cat.includes("guitar") || name.includes("guitar");
    const isBass = cat.includes("bass") || name.includes("bass");

    // VA TIMBRE: any Triton program whose sound is defined by its own oscillators
    // (and is NOT a dedicated genuine PCM sample) renders through the Triton VA
    // engine so every program has its OWN unique voice instead of collapsing onto
    // a shared sample. Pianos/keyboards/guitars/woodwinds/brass keep real samples.
    const hasOsc = !!prog.osc1 || !!prog.osc2;
    const isSynthTimbre =
      hasOsc &&
      (cat.includes("lead") ||
        cat.includes("fast synth") ||
        cat.includes("synthesizer") ||
        cat.includes("motion") ||
        cat.includes("synth pad") ||
        cat.includes("hit") ||
        cat.includes("stab") ||
        cat.includes("bells & pad") ||
        cat.includes("bells") ||
        cat.includes("electric piano") ||
        cat.includes("organ") ||
        cat.includes("strings") ||
        cat.includes("bass & sub") ||
        name.includes("trance") ||
        name.includes("lead") ||
        name.includes("saw") ||
        name.includes("scream") ||
        name.includes("sweeper") ||
        name.includes("vox") ||
        name.includes("throats") ||
        name.includes("techno") ||
        name.includes("hypersaw") ||
        name.includes("synth") ||
        name.includes("tine") ||
        name.includes("rhodes") ||
        name.includes("r&b") ||
        name.includes("fm piano"));

    if (isSynthTimbre) {
      // EVERY synth-timbre program plays its own genuine oscillator voice.
      multiLayerEngine.setTritonVaProgram(prog);
      this.applyIfxMfx(prog);
      return;
    }

    let instKey = "acoustic_grand_piano";
    const ifx = (prog.ifx || "").toLowerCase();
    const mfx = (prog.mfx || "").toLowerCase();

    if (prog.instId) {
      instKey = prog.instId;
    } else if (prog.id === "A006") {
      // SG Hybrid Piano = HYBRID grand: acoustic attack + electric bell shimmer.
      // Routes to the Rhodes-style EP sample so it sounds clearly DIFFERENT from
      // the other pianos instead of collapsing onto the same acoustic grand.
      instKey = "electric_piano_1";
    } else if (prog.id === "A036") {
      // Velo Piano ST = real velocity-layered acoustic grand piano
      instKey = "acoustic_grand_piano";
    } else if (name.includes("distortion") || name.includes("*dist") || prog.id === "A042") {
      instKey = "distortion_guitar";
    } else if (name.includes("feedback") || name.includes("overdrive") || prog.id === "A037") {
      instKey = "overdriven_guitar";
    } else if (name.includes("nylon") || (isGuitar && cat.includes("acoustic")) || prog.id === "B007") {
      instKey = "acoustic_guitar_nylon";
    } else if (isGuitar) {
      instKey = "electric_guitar_clean";
    } else if (isBass || cat.includes("bass")) {
      instKey = "synth_bass_1";
    } else if (cat.includes("organ") || name.includes("organ") || ifx.includes("rotary")) {
      instKey = "drawbar_organ";
    } else if (cat.includes("electric piano") || cat.includes("ep") || name.includes("ep") || name.includes("tine") || name.includes("r&b") || name.includes("fm piano")) {
      instKey = "electric_piano_1";
    } else if (name.includes("kalimba") || cat.includes("kalimba") || name.includes("mbira")) {
      instKey = "kalimba";
    } else if (name.includes("flute") || cat.includes("flute")) {
      instKey = "flute";
    } else if (name.includes("clarinet") || cat.includes("clarinet")) {
      instKey = "clarinet";
    } else if (cat.includes("woodwind") || name.includes("sax") || name.includes("harmonica")) {
      instKey = "alto_sax";
    } else if (cat.includes("brass") || name.includes("brass") || name.includes("trombone")) {
      instKey = "brass_section";
    } else if (cat.includes("lead") || cat.includes("fast synth") || cat.includes("synthesizer") || cat.includes("hit") || name.includes("lead") || name.includes("trance") || name.includes("saw")) {
      instKey = "brass_section";
    } else if (cat.includes("choir") || cat.includes("vocal") || name.includes("choir") || name.includes("voice") || name.includes("vox") || name.includes("ooh") || name.includes("ahh")) {
      instKey = "choir_aahs";
    } else if (cat.includes("strings") || cat.includes("pad")) {
      instKey = "string_ensemble_1";
    } else if (cat.includes("percussion") || cat.includes("drum")) {
      instKey = "tr808_kit";
    } else if (cat.includes("piano") || cat.includes("keyboard")) {
      instKey = "acoustic_grand_piano";
    }

    multiLayerEngine.setSingleInstrument(instKey);

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

    // Healthy default trim
    fx.setPresetTrim(1.0);
    fx.tube.setBypass(true);
    fx.autopan.setBypass(true);
    fx.phaser.setBypass(true);
    fx.flanger.setBypass(true);
    fx.chorus.setBypass(true);
    fx.rotary.setBypass(true);
    fx.tremolo.setBypass(true);
    fx.slapback.setBypass(true);
    fx.delay.setBypass(true);
    fx.springReverb.setBypass(true);
    fx.gatedReverb.setBypass(true);
    fx.tapeSat.setBypass(true);
    fx.reverb.setBypass(false);
    fx.reverb.setMix(0.12);
    fx.reverb.setDecay(1.6);
    fx.masterEq.setLowGain(0);
    fx.masterEq.setMidGain(0);
    fx.masterEq.setHighGain(0);

    const has = (s) => ifx.includes(s) || mfx.includes(s) || name.includes(s);

    if (has("overdrive") || has("distortion") || has(" tube")) {
      fx.tube.setBypass(false);
      if (has("distortion")) {
        fx.tube.setDrive(0.45);
        fx.tube.setTone(6000); // bright, not muffled
      } else {
        fx.tube.setDrive(0.32);
        fx.tube.setTone(5500);
      }
      fx.tube.setMix(0.50);
    }
    if (has("phaser")) {
      fx.phaser.setBypass(false);
      fx.phaser.setRate(1.0);
      fx.phaser.setMix(0.30);
    }
    if (has("flanger")) {
      fx.flanger.setBypass(false);
      fx.flanger.setRate(0.45);
      fx.flanger.setMix(0.30);
    }
    if (has("chorus") || has("ensemble")) {
      fx.chorus.setBypass(false);
      fx.chorus.setRate(0.85);
      fx.chorus.setDepth(0.7);
      fx.chorus.setMix(0.35);
    }
    if (has("rotary")) {
      fx.rotary.setBypass(false);
      fx.rotary.setMix(0.45);
    }
    if (has("tremolo") || has("pan")) {
      fx.tremolo.setBypass(false);
      fx.tremolo.setDepth(0.4);
      fx.tremolo.setMix(0.35);
    }
    if (has("delay") || has("echo") || has("ping-pong")) {
      fx.delay.setBypass(false);
      fx.delay.setMix(0.30);
      fx.delay.setFeedback(0.35);
      if (has("dotted") || has("dub") || has("ping-pong")) {
        fx.delay.setDivision(0.375);
      }
    }
    if (has("spring")) {
      fx.springReverb.setBypass(false);
      fx.springReverb.setMix(0.35);
      fx.springReverb.setDecay(2.2);
    }
    if (has("gated") || has("cathedral") || has("hall")) {
      fx.gatedReverb.setBypass(false);
      fx.gatedReverb.setMix(has("gated") ? 0.45 : 0.25);
    } else if (has("plate")) {
      fx.reverb.setBypass(false);
      fx.reverb.setMix(0.20);
    }
    if (has("tape") && !has("tape delay")) {
      fx.tapeSat.setBypass(false);
      fx.tapeSat.setDrive(0.30);
      fx.tapeSat.setWarmth(0.6);
    }
    if (has("auto-wah") || has("wah")) {
      // Vibrato-style movement + resonant filter flavor
      fx.phaser.setBypass(false);
      fx.phaser.setRate(2.6);
      fx.phaser.setMix(0.40);
    }
    if (has(" paramet") || has("eq")) {
      fx.masterEq.setLowGain(1.0);
      fx.masterEq.setMidGain(0.6);
      fx.masterEq.setHighGain(1.4);
    }
    if (has("decimat") || has("bit") || has("mega")) {
      // Grungy digital character
      fx.reverb.setBypass(false);
      fx.reverb.setMix(0.10);
    }

    this.syncFxPowerButtons();
  }

  syncFxPowerButtons() {
    const fx = audioCore.fxRack;
    if (!fx) return;
    const fxDevs = ["autopan", "chorus", "tube", "phaser", "flanger", "rotary", "tremolo", "delay", "reverb", "springReverb", "gatedReverb", "tapeSat"];
    fxDevs.forEach(dev => {
      const unit = fx[dev];
      const isEn = unit && unit.enabled !== false;
      const btn = document.querySelector(`.dev-power-btn[data-dev="${dev}"]`);
      if (btn) {
        btn.classList.toggle("active", !!isEn);
        btn.innerText = isEn ? "ON" : "OFF";
      }
    });
  }

  bindIfxMfxControls() {
    if (!this.container) return;
    const fx = audioCore.fxRack;
    if (!fx) return;

    this.container.querySelectorAll(".slot-toggle[data-fx]").forEach(btn => {
      btn.addEventListener("click", () => {
        const fxKey = btn.getAttribute("data-fx");
        const isNowActive = btn.classList.toggle("active");
        btn.innerText = isNowActive ? "ON" : "OFF";
        const bypassed = !isNowActive;

        if (fx[fxKey] && typeof fx[fxKey].setBypass === "function") {
          fx[fxKey].setBypass(bypassed);
        }

        const devBtn = document.querySelector(`.dev-power-btn[data-dev="${fxKey}"]`);
        if (devBtn) {
          devBtn.classList.toggle("active", isNowActive);
          devBtn.innerText = isNowActive ? "ON" : "OFF";
        }
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
}
