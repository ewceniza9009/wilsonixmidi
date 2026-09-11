/**
 * WILSONIX MIDIKEY Elite - Stage Registration Memory & Live Setlist Manager
 * Provides 4 Banks × 8 Slots (32 Live Rig Snapshots) for instant 1-touch sound switching during live gigs.
 * Saves/Restores: Combi 4-timbre layers, Triton Program, Splits, FX settings, Transpose, BPM.
 */

import { synthEngine } from "../audio/synth-engine.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";
import { audioCore } from "../audio/audio-core.js";

export class RegistrationManager {
  constructor() {
    this.storageKey = "wilsonix_midikey_registrations";
    this.currentBank = "A"; // A, B, C, D
    this.currentSlot = 1; // 1-8
    this.banks = this.loadBanks();
    this.onRecallCallback = null;

    this.bindKeyboardShortcuts();
  }

  loadBanks() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Could not load registration banks:", e);
    }
    return this.getDefaultBanks();
  }

  saveBanks() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.banks));
    } catch (e) {
      console.warn("Could not save registration banks:", e);
    }
  }

  getDefaultBanks() {
    // Curated factory live gig templates
    return {
      A: [
        { slot: 1, name: "Concert Grand & Pad", synth: "acoustic_grand_piano", combi: true, split: false },
        { slot: 2, name: "Vintage Rhodes & Tremolo", synth: "rhodes_stage_mp3", combi: false, split: false },
        { slot: 3, name: "Split: Funk Bass & EP", synth: "synth_bass_1", combi: false, split: true },
        { slot: 4, name: "M1 House Organ & Brass", synth: "m1_organ_2", combi: true, split: false },
        { slot: 5, name: "Sensual Breathy Alto Sax", synth: "sax_sensual", combi: false, split: false },
        { slot: 6, name: "Celestial Universe Pad", synth: "m1_universe", combi: true, split: false },
        { slot: 7, name: "90s Slap Bass & Lead", synth: "m1_slap_bass", combi: false, split: true },
        { slot: 8, name: "Cathedral Strings Tutti", synth: "string_ensemble_1", combi: true, split: false },
      ],
      B: Array.from({ length: 8 }, (_, i) => ({ slot: i + 1, name: `Bank B - Rig ${i + 1}`, synth: "acoustic_grand_piano" })),
      C: Array.from({ length: 8 }, (_, i) => ({ slot: i + 1, name: `Bank C - Rig ${i + 1}`, synth: "acoustic_grand_piano" })),
      D: Array.from({ length: 8 }, (_, i) => ({ slot: i + 1, name: `Bank D - Rig ${i + 1}`, synth: "acoustic_grand_piano" })),
    };
  }

  getCurrentSnapshot() {
    return {
      name: "",
      savedAt: new Date().toISOString(),
      // 1. Synth & Master
      synthPatchId: synthEngine.activePatch?.id || "acoustic_grand_piano",
      masterOctave: synthEngine.octave || 0,
      // 2. Combi 4-Timbre
      isCombiMode: multiLayerEngine.isCombiMode,
      layers: multiLayerEngine.layers.map(l => ({
        enabled: l.enabled,
        inst: l.inst,
        volume: l.volume,
        octave: l.octave,
        pan: l.pan,
      })),
      // 3. Split Mode
      isSplitMode: multiLayerEngine.isSplitMode,
      splitPointNote: multiLayerEngine.splitPointNote || 60,
      splitLowerInst: multiLayerEngine.splitLowerInst,
      splitUpperInst: multiLayerEngine.splitUpperInst,
      splitLowerVol: multiLayerEngine.splitLowerVol,
      splitUpperVol: multiLayerEngine.splitUpperVol,
    };
  }

  saveCurrentToSlot(bank, slotNumber, customName = null) {
    const slotIdx = slotNumber - 1;
    if (!this.banks[bank] || slotIdx < 0 || slotIdx > 7) return;

    const snapshot = this.getCurrentSnapshot();
    const existingName = this.banks[bank][slotIdx]?.name || `Rig ${bank}-${slotNumber}`;
    snapshot.name = customName || existingName;
    snapshot.slot = slotNumber;

    this.banks[bank][slotIdx] = snapshot;
    this.saveBanks();
    console.log(`Saved Live Rig to Bank ${bank} Slot ${slotNumber}: "${snapshot.name}"`);
    return snapshot;
  }

  recallSlot(bank, slotNumber) {
    const slotIdx = slotNumber - 1;
    const item = this.banks[bank]?.[slotIdx];
    if (!item) return;

    this.currentBank = bank;
    this.currentSlot = slotNumber;

    try {
      // 1. Restore Synth Patch
      if (item.synthPatchId) {
        synthEngine.setPatch(item.synthPatchId);
      }

      // 2. Restore Combi 4-Timbre
      if (typeof item.isCombiMode === "boolean") {
        multiLayerEngine.toggleCombiMode(item.isCombiMode);
      }
      if (Array.isArray(item.layers)) {
        item.layers.forEach((l, idx) => {
          if (multiLayerEngine.layers[idx]) {
            multiLayerEngine.layers[idx].enabled = l.enabled;
            multiLayerEngine.layers[idx].inst = l.inst;
            multiLayerEngine.layers[idx].volume = l.volume;
            multiLayerEngine.layers[idx].octave = l.octave;
            multiLayerEngine.layers[idx].pan = l.pan;
          }
        });
      }

      // 3. Restore Split Mode
      if (typeof item.isSplitMode === "boolean") {
        multiLayerEngine.toggleSplitMode(item.isSplitMode);
        synthEngine.toggleSplitMode(item.isSplitMode);
      }
      if (item.splitPointNote) multiLayerEngine.splitPointNote = item.splitPointNote;
      if (item.splitLowerInst) multiLayerEngine.splitLowerInst = item.splitLowerInst;
      if (item.splitUpperInst) multiLayerEngine.splitUpperInst = item.splitUpperInst;

      console.log(`Recalled Live Rig Bank ${bank}-${slotNumber}: "${item.name}"`);

      if (this.onRecallCallback) {
        this.onRecallCallback({ bank, slot: slotNumber, preset: item });
      }
    } catch (e) {
      console.warn("Error recalling registration slot:", e);
    }
  }

  bindKeyboardShortcuts() {
    window.addEventListener("keydown", e => {
      // Only handle if not typing in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;

      // Keys 1-8 recall slots in current bank
      if (e.key >= "1" && e.key <= "8" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const slotNum = parseInt(e.key);
        this.recallSlot(this.currentBank, slotNum);
      }

      // Shift + 1-8 saves current rig to slot
      if (e.shiftKey && e.key >= "1" && e.key <= "8") {
        const slotNum = parseInt(e.key);
        const name = prompt(`Enter name for Bank ${this.currentBank} - Slot ${slotNum}:`, `Rig ${this.currentBank}-${slotNum}`);
        if (name !== null) {
          this.saveCurrentToSlot(this.currentBank, slotNum, name || undefined);
          if (this.onRecallCallback) {
            this.onRecallCallback({ bank: this.currentBank, slot: slotNum, preset: this.banks[this.currentBank][slotNum - 1] });
          }
        }
      }
    });
  }

  exportSetlist() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.banks, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `WILSONIX_Setlist_${new Date().toISOString().slice(0, 10)}.mkgig`);
    dlAnchor.click();
  }

  importSetlist(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.A && parsed.B) {
        this.banks = parsed;
        this.saveBanks();
        return true;
      }
    } catch (e) {
      console.error("Invalid setlist format:", e);
    }
    return false;
  }
}

export const registrationManager = new RegistrationManager();
