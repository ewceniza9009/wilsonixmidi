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
import { multiLayerEngine } from "../audio/multi-layer-engine.js";

export class TritonWorkstationUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeBankId = "USER_A";
    this.activeSubTab = "BROWSER"; // 'BROWSER', 'EASY', 'IFX/MFX', 'ARP'
    this.activeProg = TRITON_BANKS.USER_A.programs[5]; // SG Hybrid Piano default
    this.searchQuery = "";

    this.render();
    this.applyTritonProgram(this.activeProg);
  }

  render() {
    if (!this.container) return;

    const currentBank = TRITON_BANKS[this.activeBankId] || TRITON_BANKS.USER_A;
    let programs = currentBank.programs;

    if (this.searchQuery) {
      programs = programs.filter(
        p =>
          p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }

    this.container.innerHTML = `
      <div class="triton-hardware-chassis">
        <!-- Triton Top Header Bar -->
        <div class="triton-top-header">
          <div class="korg-badge">
            <span class="korg-logo-text">KORG</span>
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
            <div class="triton-hero-text">TRITON</div>
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
              <input type="text" id="triton-search-input" placeholder="Search 60+ Triton patches..." value="${this.searchQuery}" />
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
      </div>

      <!-- TouchView 4-Column Program Grid (Matches Image 2) -->
      <div class="touchview-program-grid">
        ${programs
          .map(
            p => `
          <div class="triton-prog-cell ${this.activeProg.id === p.id ? "active" : ""}" data-prog-id="${p.id}">
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
    const isRotary = fx?.rotary?.enabled;
    const isDelay = fx?.delay?.enabled;
    const isReverb = fx?.reverb?.enabled;

    return `
      <div class="ifx-mfx-workspace">
        <div class="ifx-mfx-header">
          <span class="ifx-title">KORG TRITON MULTI-EFFECTS ROUTING MATRIX (IFX 1-5 + MFX 1-2 + MEQ)</span>
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

    const isPcmAcoustic =
      cat.includes("piano") ||
      name.includes("piano") ||
      cat.includes("organ") ||
      name.includes("organ") ||
      cat.includes("woodwind") ||
      name.includes("sax") ||
      cat.includes("brass") ||
      name.includes("brass") ||
      isGuitar ||
      isBass ||
      (cat.includes("strings") && !cat.includes("pad") && !cat.includes("synth"));

    let instKey = "acoustic_grand_piano";
    const ifx = (prog.ifx || "").toLowerCase();
    const mfx = (prog.mfx || "").toLowerCase();

    if (name.includes("distortion") || name.includes("*dist") || prog.id === "A042") {
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
    } else if (cat.includes("woodwind") || name.includes("sax") || name.includes("harmonica") || name.includes("flute")) {
      instKey = "alto_sax";
    } else if (cat.includes("brass") || name.includes("brass") || name.includes("trombone")) {
      instKey = "brass_section";
    } else if (cat.includes("lead") || cat.includes("fast synth") || cat.includes("synthesizer") || cat.includes("hit") || name.includes("lead") || name.includes("trance") || name.includes("saw")) {
      instKey = "brass_section";
    } else if (cat.includes("strings") || cat.includes("pad") || cat.includes("choir")) {
      instKey = "string_ensemble_1";
    } else if (cat.includes("piano") || cat.includes("keyboard")) {
      instKey = "acoustic_grand_piano";
    }

    multiLayerEngine.setSingleInstrument(instKey);

    // Configure matched KORG TRITON IFX & MFX Routing
    if (audioCore.fxRack) {
      const fx = audioCore.fxRack;
      const isRotary = ifx.includes("rotary") || cat.includes("organ") || name.includes("organ");
      const isLeadSynth = cat.includes("lead") || cat.includes("fast synth") || cat.includes("synthesizer") || name.includes("trance") || name.includes("saw");
      const isEp = cat.includes("electric piano") || cat.includes("ep") || name.includes("ep") || name.includes("tine") || name.includes("r&b") || name.includes("fm piano");
      const isGuitarDist = name.includes("distortion") || name.includes("*dist") || name.includes("feedback") || name.includes("overdrive") || ifx.includes("distortion") || ifx.includes("overdrive");
      const isPhaser = ifx.includes("phaser") || name.includes("sweeper") || name.includes("throats");

      if (isRotary) {
        fx.setPresetTrim(0.92);
        fx.rotary.setBypass(false);
        fx.rotary.setSpeed("fast");
        fx.rotary.setMix(1.0);
        fx.tube.setBypass(false);
        fx.tube.setDrive(0.25);
        fx.tube.setMix(0.70);
        fx.autopan.setBypass(true);
        fx.chorus.setBypass(true);
        fx.phaser.setBypass(true);
        fx.delay.setBypass(true);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.28);
      } else if (isGuitarDist) {
        fx.setPresetTrim(0.85);
        fx.tube.setBypass(false);
        fx.tube.setDrive(0.65);
        fx.tube.setMix(1.0);
        fx.tube.setTone(4500);
        fx.autopan.setBypass(true);
        fx.chorus.setBypass(true);
        fx.rotary.setBypass(true);
        fx.phaser.setBypass(true);
        fx.delay.setBypass(false);
        fx.delay.setMix(0.40);
        fx.delay.setFeedback(0.45);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.25);
      } else if (isLeadSynth) {
        // Aggressive, distinct Synth Lead: Tube Saturation + 6-Stage Phaser + Ping-Pong Delay
        fx.setPresetTrim(0.88);
        fx.tube.setBypass(false);
        fx.tube.setDrive(0.45);
        fx.tube.setMix(0.80);
        fx.autopan.setBypass(true);
        fx.phaser.setBypass(false);
        fx.phaser.setMix(0.75);
        fx.phaser.setRate(0.85);
        fx.chorus.setBypass(true);
        fx.rotary.setBypass(true);
        fx.delay.setBypass(false);
        fx.delay.setMix(0.35);
        fx.delay.setFeedback(0.40);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.28);
      } else if (isEp) {
        fx.setPresetTrim(1.0);
        fx.tube.setBypass(true);
        fx.autopan.setBypass(false);
        fx.autopan.setRate(2.4);
        fx.autopan.setDepth(0.95);
        fx.autopan.setMix(1.0);
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.55);
        fx.phaser.setBypass(true);
        fx.rotary.setBypass(true);
        fx.delay.setBypass(true);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.30);
      } else if (isPhaser) {
        fx.setPresetTrim(0.95);
        fx.phaser.setBypass(false);
        fx.phaser.setRate(0.75);
        fx.phaser.setMix(0.85);
        fx.tube.setBypass(true);
        fx.autopan.setBypass(true);
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.40);
        fx.rotary.setBypass(true);
        fx.delay.setBypass(true);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.35);
      } else if (cat.includes("strings") || cat.includes("pad") || cat.includes("choir")) {
        fx.setPresetTrim(0.95);
        fx.tube.setBypass(true);
        fx.autopan.setBypass(true);
        fx.phaser.setBypass(true);
        fx.rotary.setBypass(true);
        fx.delay.setBypass(true);
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.65);
        fx.chorus.setRate(0.85);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.42);
        fx.reverb.setDecay(3.4);
      } else if (cat.includes("brass")) {
        fx.setPresetTrim(0.92);
        fx.tube.setBypass(false);
        fx.tube.setDrive(0.20);
        fx.tube.setMix(0.45);
        fx.autopan.setBypass(true);
        fx.phaser.setBypass(true);
        fx.chorus.setBypass(true);
        fx.rotary.setBypass(true);
        fx.delay.setBypass(true);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.25);
      } else if (cat.includes("woodwind")) {
        fx.setPresetTrim(0.95);
        fx.tube.setBypass(true);
        fx.autopan.setBypass(true);
        fx.phaser.setBypass(true);
        fx.chorus.setBypass(true);
        fx.rotary.setBypass(true);
        fx.delay.setBypass(true);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.30);
      } else {
        // Clean Acoustic Grand Piano
        fx.setPresetTrim(1.0);
        fx.tube.setBypass(true);
        fx.autopan.setBypass(true);
        fx.phaser.setBypass(true);
        fx.chorus.setBypass(true);
        fx.rotary.setBypass(true);
        fx.delay.setBypass(true);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.28);
        fx.reverb.setDecay(2.4);
      }

      // Sync Ableton device bay power buttons immediately
      const fxDevs = ["autopan", "chorus", "tube", "phaser", "rotary", "delay", "reverb"];
      fxDevs.forEach(dev => {
        const isEn = audioCore.fxRack[dev]?.enabled;
        const btn = document.querySelector(`.dev-power-btn[data-dev="${dev}"]`);
        if (btn) {
          btn.classList.toggle("active", !!isEn);
          btn.innerText = isEn ? "ON" : "OFF";
        }
      });

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
      case "rotary-mix": fx.rotary?.setMix(val); break;
      case "delay-mix": fx.delay?.setMix(val); break;
      case "delay-feedback": fx.delay?.setFeedback(val); break;
      case "reverb-mix": fx.reverb?.setMix(val); break;
      case "reverb-decay": fx.reverb?.setDecay(val); break;
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
      const bank = TRITON_BANKS[this.activeBankId] || TRITON_BANKS.USER_A;
      let programs = bank.programs;
      if (this.searchQuery) {
        programs = programs.filter(
          p =>
            p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
      }
      const grid = this.container.querySelector(".touchview-program-grid");
      if (grid) {
        grid.innerHTML = programs
          .map(
            p => `
          <div class="triton-prog-cell ${this.activeProg.id === p.id ? "active" : ""}" data-prog-id="${p.id}">
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
    });
  }

  applyM1Program(prog) {
    const fx = audioCore.fxRack;
    if (prog.m1Type === "organ2") {
      // Iconic Korg M1 Organ 2
      multiLayerEngine.setSingleInstrument("drawbar_organ");
      if (fx) {
        fx.rotary.setBypass(true);
        fx.tube.setBypass(false);
        fx.tube.setDrive(0.18);
        fx.tube.setMix(0.40);
        fx.autopan.setBypass(true);
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.45);
        fx.chorus.setRate(0.85);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.22);
        fx.reverb.setDecay(1.6);
        fx.delay.setBypass(true);
        fx.phaser.setBypass(true);
      }
    } else if (prog.m1Type === "piano16") {
      // Iconic Korg M1 Piano 16'
      multiLayerEngine.setSingleInstrument("acoustic_grand_piano");
      if (fx) {
        fx.tube.setBypass(true);
        fx.autopan.setBypass(true);
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.45);
        fx.chorus.setRate(1.2);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.28);
        fx.reverb.setDecay(2.4);
        fx.delay.setBypass(true);
        fx.phaser.setBypass(true);
        fx.rotary.setBypass(true);
        fx.masterEq.setLowGain(-1.0);
        fx.masterEq.setMidGain(3.0);
        fx.masterEq.setHighGain(3.5);
      }
    } else if (prog.m1Type === "universe") {
      // Iconic Korg M1 Universe (Celestial Space Choir Pad)
      multiLayerEngine.setSingleInstrument("string_ensemble_1");
      if (fx) {
        fx.tube.setBypass(true);
        fx.autopan.setBypass(false);
        fx.autopan.setRate(0.4);
        fx.autopan.setDepth(0.6);
        fx.autopan.setMix(0.6);
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.68);
        fx.chorus.setRate(0.85);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.48);
        fx.reverb.setDecay(3.8);
        fx.delay.setBypass(true);
        fx.phaser.setBypass(true);
        fx.rotary.setBypass(true);
      }
    } else if (prog.m1Type === "slapbass") {
      // Iconic Korg M1 Slap Bass
      multiLayerEngine.setSingleInstrument("drawbar_organ");
      if (fx) {
        fx.tube.setBypass(false);
        fx.tube.setDrive(0.22);
        fx.tube.setMix(0.50);
        fx.autopan.setBypass(true);
        fx.chorus.setBypass(true);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.15);
        fx.reverb.setDecay(1.0);
        fx.delay.setBypass(true);
        fx.phaser.setBypass(true);
        fx.rotary.setBypass(true);
        fx.masterEq.setLowGain(3.5);
        fx.masterEq.setHighGain(2.0);
      }
    } else if (prog.m1Type === "lore") {
      // Iconic Korg M1 Lore (Celtic Breath)
      multiLayerEngine.setSingleInstrument("alto_sax");
      if (fx) {
        fx.tube.setBypass(true);
        fx.autopan.setBypass(false);
        fx.autopan.setRate(1.2);
        fx.autopan.setDepth(0.6);
        fx.autopan.setMix(0.7);
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.50);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.38);
        fx.reverb.setDecay(3.0);
        fx.delay.setBypass(true);
        fx.phaser.setBypass(true);
        fx.rotary.setBypass(true);
      }
    } else if (prog.m1Type === "choir" || prog.m1Type === "strings") {
      // Iconic Korg M1 Choir / Symphony Strings
      multiLayerEngine.setSingleInstrument("string_ensemble_1");
      if (fx) {
        fx.tube.setBypass(true);
        fx.autopan.setBypass(true);
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.65);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.42);
        fx.reverb.setDecay(3.4);
        fx.delay.setBypass(true);
        fx.phaser.setBypass(true);
        fx.rotary.setBypass(true);
      }
    } else if (prog.m1Type === "freshair") {
      // Iconic Korg M1 Fresh Air
      multiLayerEngine.setSingleInstrument("electric_piano_1");
      if (fx) {
        fx.tube.setBypass(true);
        fx.autopan.setBypass(true);
        fx.chorus.setBypass(false);
        fx.chorus.setMix(0.55);
        fx.delay.setBypass(false);
        fx.delay.setMix(0.30);
        fx.reverb.setBypass(false);
        fx.reverb.setMix(0.35);
        fx.phaser.setBypass(true);
        fx.rotary.setBypass(true);
      }
    }
  }
}
