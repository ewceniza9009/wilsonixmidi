import { patchStorage } from "../storage/patch-storage-manager.js";
import { licenseManager } from "../security/license-manager.js";
import { tonicDroneEngine } from "../audio/tonic-drone-engine.js";
import { CustomModal } from "./custom-modal.js";
import { multiLayerEngine, getTimbreDisplayName } from "../audio/multi-layer-engine.js";
import { audioCore } from "../audio/audio-core.js";

export class CustomPatchBrowserUI {
  constructor(containerId, appCore) {
    this.container = document.getElementById(containerId);
    this.appCore = appCore || { multiLayerEngine, get fxRack() { return audioCore.fxRack; } };
    this.patches = [];
    this.render();
    this.loadPatches();
  }

  render() {
    if (!this.container) return;

    const access = licenseManager.getAccessStatus();
    
    // License check
    if (access.isExpired) {
      this.container.innerHTML = `
        <div class="patch-browser-locked">
          <div class="locked-icon">🔒</div>
          <h3>SETLIST & CUSTOM PATCHES</h3>
          <p>This premium feature allows you to save custom layer mixes, FX, and organize gig setlists.</p>
          <button class="upgrade-btn" onclick="document.getElementById('license-modal-trigger')?.click()">
            UNLOCK WITH PRO OR TRIAL
          </button>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <style>
        .patch-browser-ui {
          display: flex; flex-direction: column; height: 100%; padding: 10px; gap: 10px;
          background: #0b0f17; box-sizing: border-box; width: 100%;
        }
        .browser-header {
          display: flex; justify-content: space-between; align-items: center; 
          border-bottom: 1px solid #2a3441; padding-bottom: 8px;
        }
        .browser-header h3 {
          margin: 0; font-size: 13px; color: #fff; letter-spacing: 1.5px; font-weight: 800;
        }
        .save-btn {
          background: #ff764d; color: #000; border: none; border-radius: 4px; 
          padding: 5px 10px; font-weight: 800; font-size: 11px; cursor: pointer; 
          display: flex; align-items: center; gap: 5px; transition: all 0.2s;
        }
        .save-btn:hover { background: #ff8b66; transform: scale(1.05); }
        .browser-search input {
          width: 100%; background: #151a26; border: 1px solid #2a3441; border-radius: 4px; 
          padding: 8px 10px; color: #fff; font-size: 12px; outline: none; box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .browser-search input:focus { border-color: #00d2ff; }
        .patch-list {
          flex: 1 1 auto; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
        }
        .patch-item {
          display: flex; justify-content: space-between; align-items: center;
          background: #151a26; border: 1px solid #2a3441; padding: 8px 10px;
          border-radius: 4px; cursor: pointer; transition: all 0.15s;
        }
        .patch-item:hover { background: #1f2738; border-color: #38bdf8; }
        .patch-item.active { background: rgba(0, 210, 255, 0.1); border-color: #00d2ff; }
        .patch-name { font-size: 12px; font-weight: 700; color: #cbd5e1; }
        .patch-item:hover .patch-name { color: #fff; }
        .patch-del-btn {
          background: transparent; color: #94a3b8; border: none; font-size: 12px;
          cursor: pointer; padding: 2px 6px; border-radius: 3px; transition: all 0.15s;
        }
        .patch-del-btn:hover { background: #e74c3c; color: #fff; }
        
        .drone-player-ui {
          background: linear-gradient(180deg, #111520 0%, #0a0c10 100%);
          border-top: 1px solid #2a3441; padding: 6px 8px; 
          flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; 
        }
        .drone-header {
          display: flex; justify-content: center; align-items: center;
        }
        .drone-header h4 {
          margin: 0; font-size: 9px; color: #00d2ff; letter-spacing: 1px; 
          font-weight: 800; text-shadow: 0 0 8px rgba(0, 210, 255, 0.4);
        }
        .drone-keys {
          display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px;
        }
        .drone-key {
          background: #1a2233; color: #94a3b8; border: 1px solid #2a3441; 
          border-radius: 3px; font-weight: 700; font-size: 10px; padding: 4px 0; 
          cursor: pointer; transition: all 0.1s ease;
        }
        .drone-key:hover { background: #2b3348; color: #fff; }
        .drone-key.active {
          background: linear-gradient(180deg, #00d2ff 0%, #0284c7 100%);
          color: #0b0f17; border-color: #38bdf8;
          box-shadow: 0 0 8px rgba(0, 210, 255, 0.6);
        }
        .drone-vol-control {
          display: flex; align-items: center; gap: 6px; background: #06080b; 
          padding: 4px 8px; border-radius: 4px; border: 1px solid #1a2233;
        }
        .drone-vol-control input[type="range"] {
          flex: 1; accent-color: #00d2ff; height: 3px; background: #1a2233;
          border-radius: 2px; outline: none; -webkit-appearance: none;
        }
        .drone-vol-control input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px; background: #fff;
          border-radius: 50%; cursor: pointer;
        }
      </style>
      <div class="patch-browser-ui">
        <div class="browser-header">
          <h3>CUSTOM SETLIST</h3>
          <button id="save-patch-btn" class="save-btn" title="Save Current Mix as Patch">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> SAVE
          </button>
        </div>
        <div class="browser-search">
          <input type="text" id="patch-search-input" placeholder="Search patches..." />
        </div>
        <div class="patch-list" id="patch-list-container">
          <!-- Patches injected here -->
        </div>

        <div class="drone-player-ui">
          <div class="drone-header" style="justify-content: space-between; padding: 0 4px;">
            <h4>AMBIENT TONIC PAD</h4>
            <button id="drone-stop-btn" class="drone-stop-btn" title="Stop Ambient Drone" style="background:#2a1515;border:1px solid #ff4444;color:#ff8888;font-size:9px;font-weight:700;padding:2px 8px;border-radius:3px;cursor:pointer;line-height:1.2;">■ STOP</button>
          </div>
          <div class="drone-keys">
            ${["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].map(k => `
              <button class="drone-key ${tonicDroneEngine.activeKey === k ? 'active' : ''}" data-note="${k}">${k}</button>
            `).join("")}
          </div>
          <div class="drone-vol-control">
            <span class="vol-icon" style="font-size: 14px; color: #00d2ff;">🔉</span>
            <input type="range" id="drone-vol-slider" min="0" max="1" step="0.01" value="${tonicDroneEngine.volume}" />
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const saveBtn = this.container.querySelector("#save-patch-btn");
    const searchInput = this.container.querySelector("#patch-search-input");

    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.handleSavePatch());
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.renderPatchList(e.target.value.toLowerCase());
      });
    }

    // Drone Bindings
    const droneKeys = this.container.querySelectorAll(".drone-key");
    droneKeys.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const note = e.target.getAttribute("data-note");
        tonicDroneEngine.playDrone(note);
        
        // UI feedback
        droneKeys.forEach(b => b.classList.remove("active"));
        if (tonicDroneEngine.activeKey === note) {
          e.target.classList.add("active");
        }
      });
    });

    const stopBtn = this.container.querySelector("#drone-stop-btn");
    if (stopBtn) {
      stopBtn.addEventListener("click", () => {
        tonicDroneEngine.stopDrone();
        droneKeys.forEach(b => b.classList.remove("active"));
      });
    }

    const volSlider = this.container.querySelector("#drone-vol-slider");
    if (volSlider) {
      volSlider.addEventListener("input", (e) => {
        tonicDroneEngine.setVolume(parseFloat(e.target.value));
      });
    }
  }

  async loadPatches() {
    try {
      this.patches = await patchStorage.getAllPatches();
      this.renderPatchList();
    } catch (e) {
      console.error("[CustomPatchBrowser] Failed to load patches", e);
    }
  }

  renderPatchList(filter = "") {
    const listContainer = this.container.querySelector("#patch-list-container");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    const filtered = this.patches.filter(p => p.name.toLowerCase().includes(filter));

    if (filtered.length === 0) {
      listContainer.innerHTML = `<div class="empty-state">No custom patches found.</div>`;
      return;
    }

    filtered.forEach(patch => {
      const el = document.createElement("div");
      el.className = "patch-item";
      
      const titleEl = document.createElement("div");
      titleEl.className = "patch-title";
      titleEl.textContent = patch.name;
      el.appendChild(titleEl);

      const delBtn = document.createElement("button");
      delBtn.className = "patch-del-btn";
      delBtn.innerHTML = "✕";
      delBtn.title = "Delete Patch";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handleDeletePatch(patch.id);
      });
      el.appendChild(delBtn);

      // Load patch on click
      el.addEventListener("click", () => this.handleLoadPatch(patch));

      listContainer.appendChild(el);
    });
  }

  async handleSavePatch() {
    const patchName = await CustomModal.prompt("Save Custom Patch", "Enter a name for this custom patch:");
    if (!patchName) return;

    const mle = this.appCore?.multiLayerEngine || multiLayerEngine;
    const fxRack = this.appCore?.fxRack || audioCore.fxRack;

    // Build the state object using multiLayerEngine and fxRack with resolved timbre names
    const layersCopy = JSON.parse(JSON.stringify(mle.layers || [])).map((l) => ({
      ...l,
      name: getTimbreDisplayName(l.inst, l.name),
    }));
    
    const fxState = {
      reverb: fxRack?.reverb?.mix || 0,
      delay: fxRack?.delay?.mix || 0,
      chorus: fxRack?.chorus?.mix || 0,
      phaser: fxRack?.phaser?.mix || 0,
      tube: fxRack?.tube?.mix || 0,
      eq: {
        low: fxRack?.masterEq?.lowShelf?.gain?.value ?? fxRack?.masterEq?.lowGain?.value ?? 0,
        mid: fxRack?.masterEq?.midPeak?.gain?.value ?? fxRack?.masterEq?.midGain?.value ?? 0,
        high: fxRack?.masterEq?.highShelf?.gain?.value ?? fxRack?.masterEq?.highGain?.value ?? 0,
      }
    };

    const state = {
      layers: layersCopy,
      fx: fxState,
      timestamp: Date.now()
    };

    try {
      await patchStorage.savePatch(patchName, state);
      await this.loadPatches(); // Refresh list
    } catch (e) {
      CustomModal.alert("Error", "Failed to save patch: " + e.message);
    }
  }

  async handleDeletePatch(id) {
    const confirmed = await CustomModal.confirm("Delete Patch", "Are you sure you want to delete this patch?");
    if (!confirmed) return;
    try {
      await patchStorage.deletePatch(id);
      await this.loadPatches(); // Refresh list
    } catch (e) {
      CustomModal.alert("Error", "Failed to delete patch.");
    }
  }

  handleLoadPatch(patch) {
    if (!patch || !patch.data) return;
    console.log("Loading custom patch:", patch.name);
    
    const mle = this.appCore?.multiLayerEngine || multiLayerEngine;
    const fxRack = this.appCore?.fxRack || audioCore.fxRack;

    // Inject layers back into multiLayerEngine with resolved names
    if (patch.data.layers) {
      mle.layers = JSON.parse(JSON.stringify(patch.data.layers)).map((l) => ({
        ...l,
        name: getTimbreDisplayName(l.inst, l.name),
      }));
      while (mle.layers.length < 4) {
        const idx = mle.layers.length;
        mle.layers.push({
          id: idx,
          name: idx === 3 ? "Sub / Bass Layer" : `Layer ${idx + 1}`,
          inst: "synth_bass_1",
          fx: "clean",
          gain: 0.7,
          pan: 0,
          oct: idx === 3 ? -1 : 0,
          minVel: 1,
          maxVel: 127,
          enabled: false,
        });
      }
      mle.isCombiMode = true;
      mle.activeCombi = {
        id: patch.id || "custom",
        name: patch.name || "Custom Mix",
      };
      if (typeof mle._resolveLayerVaProgs === "function") {
        mle._resolveLayerVaProgs(mle.layers);
      }
      if (mle.pcmEngine) {
        mle.layers.forEach((layer) => {
          if (layer.inst && !layer.inst.startsWith("va:")) {
            const key = mle.resolveBankKey(layer.inst);
            mle.pcmEngine.preloadInstrument(key).catch(() => {});
          }
        });
      }
      mle.syncLayerFx();
      mle.syncPinnedInstruments();
      mle.notifyLayerChange();
    }
    
    // Restore FX State
    if (patch.data.fx && fxRack) {
      const fx = patch.data.fx;
      if (fx.reverb !== undefined) fxRack.reverb?.setMix(fx.reverb);
      if (fx.delay !== undefined) fxRack.delay?.setMix(fx.delay);
      if (fx.chorus !== undefined) fxRack.chorus?.setMix(fx.chorus);
      if (fx.phaser !== undefined) fxRack.phaser?.setMix(fx.phaser);
      if (fx.tube !== undefined) fxRack.tube?.setMix(fx.tube);
      
      if (fx.eq && fxRack.masterEq) {
        if (typeof fxRack.masterEq.setEq === "function") {
          fxRack.masterEq.setEq(fx.eq.low ?? 0, fx.eq.mid ?? 0, fx.eq.high ?? 0);
        } else {
          if (typeof fxRack.masterEq.setLowGain === "function") fxRack.masterEq.setLowGain(fx.eq.low ?? 0);
          if (typeof fxRack.masterEq.setMidGain === "function") fxRack.masterEq.setMidGain(fx.eq.mid ?? 0);
          if (typeof fxRack.masterEq.setHighGain === "function") fxRack.masterEq.setHighGain(fx.eq.high ?? 0);
        }
      }
    }
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = "";
    }
    this.patches = [];
  }
}
