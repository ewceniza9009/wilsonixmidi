import { patchStorage } from "../storage/patch-storage-manager.js";
import { licenseManager } from "../security/license-manager.js";
import { tonicDroneEngine, DRONE_SOUND_PROFILES } from "../audio/tonic-drone-engine.js";
import { CustomModal } from "./custom-modal.js";
import { multiLayerEngine, getTimbreDisplayName } from "../audio/multi-layer-engine.js";
import { audioCore } from "../audio/audio-core.js";

const DEFAULT_PATCH_COLORS = ["#38bdf8", "#f59e0b", "#10b981", "#c084fc", "#ec4899", "#f97316"];

export class CustomPatchBrowserUI {
  constructor(containerId, appCore) {
    this.container = document.getElementById(containerId);
    this.appCore = appCore || { multiLayerEngine, get fxRack() { return audioCore.fxRack; } };
    this.patches = [];
    this.activePatchId = null;
    this.keySync = localStorage.getItem("wilsonix_drone_key_sync") !== "false";
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
          <p>Save custom layer mixes, FX, macros, and organize worship setlists.</p>
          <button type="button" class="upgrade-btn">
            UNLOCK PRO
          </button>
        </div>
      `;
      // Inline onclick is blocked by our own CSP (script-src 'self'), and the
      // old `#license-modal-trigger` target never existed. Route through the
      // standard license modal event instead.
      this.container.querySelector(".upgrade-btn")?.addEventListener("click", () => {
        licenseManager.requirePro("Setlist & Custom Patches");
      });
      return;
    }

    this.container.innerHTML = `
      <div class="patch-browser-ui">
        <div class="browser-header">
          <h3>SETLIST</h3>
          <div class="browser-header-tools">
            <button id="patch-prev-btn" class="patch-nav-btn" title="Previous Patch (Up)">◀</button>
            <button id="patch-next-btn" class="patch-nav-btn" title="Next Patch (Down)">▶</button>
            <button id="save-patch-btn" class="save-btn" title="Save Current Mix as Patch">+ SAVE</button>
          </div>
        </div>

        <div class="browser-search">
          <input type="text" id="patch-search-input" placeholder="Search setlist..." />
        </div>

        <div class="patch-list" id="patch-list-container">
          <!-- Patches injected here -->
        </div>

        <!-- Ambient Tonic Pad (Compact 12-key strip with crossfade & auto-sync) -->
        <div class="drone-player-ui">
          <div class="drone-header">
            <h4>TONIC PAD</h4>
            <div class="drone-header-tools">
              <button id="drone-sync-btn" class="drone-sync-btn ${this.keySync ? 'active' : ''}" title="Auto-switch drone key when loading patch">
                ${this.keySync ? 'SYNC ON' : 'SYNC OFF'}
              </button>
              <button id="drone-stop-btn" class="drone-stop-btn" title="Fade Out Drone">■ FADE</button>
            </div>
          </div>
          <div class="drone-profile-bar">
            <span class="drone-profile-label">PAD SOUND</span>
            <select id="drone-profile-select" class="drone-profile-select" title="Select Pad Sound Texture">
              ${Object.values(DRONE_SOUND_PROFILES).map(p => `
                <option value="${p.id}" ${tonicDroneEngine.currentProfile === p.id ? 'selected' : ''}>${p.name}</option>
              `).join('')}
            </select>
          </div>
          <div class="drone-keys">
            ${["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].map(k => `
              <button class="drone-key ${tonicDroneEngine.activeKey === k ? 'active' : ''}" data-note="${k}">${k}</button>
            `).join("")}
          </div>
          <div class="drone-vol-control">
            <span class="vol-icon">PAD</span>
            <input type="range" id="drone-vol-slider" min="0" max="1" step="0.01" value="${tonicDroneEngine.volume}" title="Tonic Pad Volume" />
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const saveBtn = this.container.querySelector("#save-patch-btn");
    const searchInput = this.container.querySelector("#patch-search-input");
    const prevBtn = this.container.querySelector("#patch-prev-btn");
    const nextBtn = this.container.querySelector("#patch-next-btn");
    const syncBtn = this.container.querySelector("#drone-sync-btn");

    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.handleSavePatch());
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.renderPatchList(e.target.value.toLowerCase());
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => this.stepPatch(-1));
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => this.stepPatch(1));
    }

    if (syncBtn) {
      syncBtn.addEventListener("click", () => {
        this.keySync = !this.keySync;
        localStorage.setItem("wilsonix_drone_key_sync", String(this.keySync));
        syncBtn.classList.toggle("active", this.keySync);
        syncBtn.textContent = this.keySync ? "SYNC ON" : "SYNC OFF";
      });
    }

    // Drone Bindings
    const droneKeys = this.container.querySelectorAll(".drone-key");
    droneKeys.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const note = e.target.getAttribute("data-note");
        tonicDroneEngine.playDrone(note);
        this.updateDroneActiveKeys();
      });
    });

    const stopBtn = this.container.querySelector("#drone-stop-btn");
    if (stopBtn) {
      stopBtn.addEventListener("click", () => {
        tonicDroneEngine.stopDrone({ fadeSec: 1.8 });
        this.updateDroneActiveKeys();
      });
    }

    const profileSelect = this.container.querySelector("#drone-profile-select");
    if (profileSelect) {
      profileSelect.addEventListener("change", (e) => {
        tonicDroneEngine.setProfile(e.target.value, { crossfade: true });
      });
    }

    const volSlider = this.container.querySelector("#drone-vol-slider");
    if (volSlider) {
      volSlider.addEventListener("input", (e) => {
        tonicDroneEngine.setVolume(parseFloat(e.target.value));
      });
    }
  }

  updateDroneActiveKeys() {
    const droneKeys = this.container.querySelectorAll(".drone-key");
    droneKeys.forEach(b => {
      const note = b.getAttribute("data-note");
      b.classList.toggle("active", tonicDroneEngine.activeKey === note);
    });
  }

  async loadPatches() {
    try {
      this.patches = await patchStorage.getAllPatches();
      this.renderPatchList();
    } catch (e) {
      console.error("[CustomPatchBrowser] Failed to load patches", e);
    }
  }

  stepPatch(delta) {
    if (!this.patches.length) return;
    const curIdx = this.patches.findIndex(p => p.id === this.activePatchId);
    let nextIdx = curIdx + delta;
    if (nextIdx < 0) nextIdx = this.patches.length - 1;
    if (nextIdx >= this.patches.length) nextIdx = 0;
    const target = this.patches[nextIdx];
    if (target) this.handleLoadPatch(target);
  }

  renderPatchList(filter = "") {
    const listContainer = this.container.querySelector("#patch-list-container");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    const filtered = this.patches.filter(p => p.name.toLowerCase().includes(filter));

    if (filtered.length === 0) {
      listContainer.innerHTML = `<div class="empty-state">No saved patches. Click + SAVE to add one.</div>`;
      return;
    }

    filtered.forEach((patch, idx) => {
      const el = document.createElement("div");
      el.className = `patch-item ${this.activePatchId === patch.id ? 'active' : ''}`;
      el.setAttribute("data-id", patch.id);

      // Color tag bar
      const colorBar = document.createElement("div");
      colorBar.className = "patch-color-bar";
      colorBar.style.backgroundColor = patch.data?.color || DEFAULT_PATCH_COLORS[idx % DEFAULT_PATCH_COLORS.length];
      el.appendChild(colorBar);
      
      // Patch Title
      const titleEl = document.createElement("div");
      titleEl.className = "patch-title";
      titleEl.textContent = patch.name;
      el.appendChild(titleEl);

      // Optional Key badge
      if (patch.data?.key) {
        const keyBadge = document.createElement("span");
        keyBadge.className = "patch-key-badge";
        keyBadge.textContent = patch.data.key;
        el.appendChild(keyBadge);
      }

      // Delete Button
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
    if (!licenseManager.hasProAccess()) {
      licenseManager.requirePro("Setlist & Custom Patches");
      return;
    }
    const rawInput = await CustomModal.prompt(
      "Save Custom Patch",
      "Enter patch name (optionally add [Key], e.g. 'Sunday Praise [G]'):",
      "Patch Name [Key]"
    );
    if (!rawInput) return;

    let patchName = rawInput.trim();
    let detectedKey = "";

    // Parse [Key] or / Key if provided in name
    const keyMatch = patchName.match(/\[([A-G][b#]?)\]/i) || patchName.match(/\/\s*([A-G][b#]?)$/i);
    if (keyMatch) {
      detectedKey = keyMatch[1].toUpperCase();
      if (detectedKey.length === 2 && detectedKey[1] === 'B') {
        detectedKey = detectedKey[0] + 'b';
      }
      patchName = patchName.replace(keyMatch[0], "").trim();
    } else if (tonicDroneEngine.activeKey) {
      // Default to current playing drone key if active
      detectedKey = tonicDroneEngine.activeKey;
    }

    const mle = this.appCore?.multiLayerEngine || multiLayerEngine;
    const fxRack = this.appCore?.fxRack || audioCore.fxRack;

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
      key: detectedKey,
      color: DEFAULT_PATCH_COLORS[Math.floor(Math.random() * DEFAULT_PATCH_COLORS.length)],
      macros: mle.macros ? { ...mle.macros } : { swell: 0.3, shimmer: 0.2, tone: 0.5, pad: tonicDroneEngine.volume },
      snapshots: mle.snapshots ? JSON.parse(JSON.stringify(mle.snapshots)) : null,
      padProfile: tonicDroneEngine.currentProfile,
      timestamp: Date.now()
    };

    try {
      const saved = await patchStorage.savePatch(patchName, state);
      this.activePatchId = saved.id;
      await this.loadPatches();
    } catch (e) {
      CustomModal.alert("Error", "Failed to save patch: " + e.message);
    }
  }

  async handleDeletePatch(id) {
    const confirmed = await CustomModal.confirm("Delete Patch", "Are you sure you want to delete this patch?");
    if (!confirmed) return;
    try {
      if (this.activePatchId === id) this.activePatchId = null;
      await patchStorage.deletePatch(id);
      await this.loadPatches();
    } catch (e) {
      CustomModal.alert("Error", "Failed to delete patch.");
    }
  }

  handleLoadPatch(patch) {
    if (!patch || !patch.data) return;
    this.activePatchId = patch.id;
    this.renderPatchList();
    
    const mle = this.appCore?.multiLayerEngine || multiLayerEngine;
    const fxRack = this.appCore?.fxRack || audioCore.fxRack;

    // Inject layers back into multiLayerEngine with resolved names (seamlessly)
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

    // Restore Macros & Snapshots if available
    if (patch.data.macros && mle.setMacros) {
      mle.setMacros(patch.data.macros);
    }
    if (patch.data.snapshots && mle.setSnapshots) {
      mle.setSnapshots(patch.data.snapshots);
    }

    // Auto-sync Tonic Drone key if enabled
    if (this.keySync && patch.data.key) {
      tonicDroneEngine.playDrone(patch.data.key, { crossfadeSec: 1.5 });
      this.updateDroneActiveKeys();
    }

    // Restore Tonic Pad sound profile if saved
    if (patch.data.padProfile && tonicDroneEngine.currentProfile !== patch.data.padProfile) {
      tonicDroneEngine.setProfile(patch.data.padProfile, { crossfade: true });
      const profSelect = this.container.querySelector("#drone-profile-select");
      if (profSelect) profSelect.value = patch.data.padProfile;
    }
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = "";
    }
    this.patches = [];
  }
}
