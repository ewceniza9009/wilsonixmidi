/**
 * WILSONIX MIDIKEY Elite - Stage Registration Memory & Live Setlist Manager
 * Provides 4 Banks × 8 Slots (32 Live Rig Snapshots) for instant 1-touch sound switching during live gigs.
 * Saves/Restores: Triton VA Programs (Brian's Sync, leads), Combi 4-timbre stacks, Rompler instruments, Splits, FX, Transpose.
 */

import { synthEngine } from "../audio/synth-engine.js";
import { multiLayerEngine, COMBI_PRESETS, HD_SOUNDBANKS } from "../audio/multi-layer-engine.js";
import { audioCore } from "../audio/audio-core.js";
import { getTritonProgramById } from "../triton/combi-timbres.js";

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
        const parsed = JSON.parse(stored);
        if (parsed.A && parsed.B && parsed.C && parsed.D) {
          return parsed;
        }
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
    // Curated factory live gig templates across 4 Banks (A, B, C, D) × 8 Slots
    return {
      A: [
        { slot: 1, name: "Concert Grand & Triton Strings", type: "combi", activeCombiId: "ballad_master", isCombiMode: true, isSplitMode: false },
        { slot: 2, name: "Vintage Suitcase Stage EP", type: "single", activeSingleInst: "electric_piano_1", isCombiMode: false, isSplitMode: false },
        {
          slot: 3,
          name: "Split: Moog Bass & Dyno EP",
          type: "single",
          activeSingleInst: "electric_piano_1",
          isCombiMode: false,
          isSplitMode: true,
          splitPointMidi: 60,
          splitZones: {
            lower: { inst: "synth_bass_1", name: "Moog Punch Bass", fx: "punch_comp", gain: 1.0, oct: 0 },
            upper: { inst: "electric_piano_1", name: "Suitcase EP", fx: "autopan_wide", gain: 1.0, oct: 0 },
          },
        },
        { slot: 4, name: "Korg M1 House Organ 2", type: "single", activeSingleInst: "m1_organ_2", isCombiMode: false, isSplitMode: false },
        { slot: 5, name: "🎷 Sensual Breathy Alto Sax", type: "single", activeSingleInst: "sax_sensual", isCombiMode: false, isSplitMode: false },
        { slot: 6, name: "Korg M1 Universe Celestial Pad", type: "single", activeSingleInst: "m1_universe", isCombiMode: false, isSplitMode: false },
        {
          slot: 7,
          name: "Split: 90s Slap Bass & Lead",
          type: "single",
          activeSingleInst: "brass_section",
          isCombiMode: false,
          isSplitMode: true,
          splitPointMidi: 57,
          splitZones: {
            lower: { inst: "m1_slap_bass", name: "Korg M1 Slap Bass", fx: "punch_comp", gain: 1.0, oct: 0 },
            upper: { inst: "brass_section", name: "Triton Fat Brass", fx: "tube_warm", gain: 1.0, oct: 0 },
          },
        },
        { slot: 8, name: "Triton Stereo Strings Tutti", type: "single", activeSingleInst: "string_ensemble_1", isCombiMode: false, isSplitMode: false },
      ],
      B: [
        { slot: 1, name: "Abletunes Studio Upright Piano", type: "single", activeSingleInst: "abletunes_upright", isCombiMode: false, isSplitMode: false },
        { slot: 2, name: "Abletunes Studio FM Piano DX7", type: "single", activeSingleInst: "abletunes_fm_piano", isCombiMode: false, isSplitMode: false },
        { slot: 3, name: "Tokyo City Pop Stack", type: "combi", activeCombiId: "tokyo_city_pop", isCombiMode: true, isSplitMode: false },
        { slot: 4, name: "Chicago Blues & Rock Stack", type: "combi", activeCombiId: "chicago_blues_rock", isCombiMode: true, isSplitMode: false },
        { slot: 5, name: "Acid Jazz Groove Stack", type: "combi", activeCombiId: "acid_jazz_groove", isCombiMode: true, isSplitMode: false },
        { slot: 6, name: "Miles Harmon Mute Trumpet", type: "single", activeSingleInst: "muted_trumpet", isCombiMode: false, isSplitMode: false },
        { slot: 7, name: "Blue Note Jazz Trio", type: "combi", activeCombiId: "blue_note_trio", isCombiMode: true, isSplitMode: false },
        { slot: 8, name: "Jazz-Funk Soul Stack", type: "combi", activeCombiId: "jazz_funk_soul", isCombiMode: true, isSplitMode: false },
      ],
      C: [
        { slot: 1, name: "Sunday Pipe Praise Stack", type: "combi", activeCombiId: "sunday_pipe_praise", isCombiMode: true, isSplitMode: false },
        { slot: 2, name: "Cathedral Pipe Organ", type: "single", activeSingleInst: "church_organ", isCombiMode: false, isSplitMode: false },
        { slot: 3, name: "Cathedral Choir Aahs", type: "single", activeSingleInst: "choir_aahs", isCombiMode: false, isSplitMode: false },
        { slot: 4, name: "Korg M1 03 Ooh-Ahh Formant", type: "single", activeSingleInst: "m1_ooh_ahh", isCombiMode: false, isSplitMode: false },
        { slot: 5, name: "Neo-Classical Ambient Stack", type: "combi", activeCombiId: "neo_classical_ambient", isCombiMode: true, isSplitMode: false },
        { slot: 6, name: "Cool Mallet Vibraphone", type: "single", activeSingleInst: "vibraphone", isCombiMode: false, isSplitMode: false },
        { slot: 7, name: "Fender Strat Clean Chords", type: "single", activeSingleInst: "electric_guitar_clean", isCombiMode: false, isSplitMode: false },
        { slot: 8, name: "Fantom Acoustic Nylon Pluck", type: "single", activeSingleInst: "acoustic_guitar_nylon", isCombiMode: false, isSplitMode: false },
      ],
      D: [
        { slot: 1, name: "🎷 Expressive Solo Alto Sax", type: "single", activeSingleInst: "sax_genuine_solo", isCombiMode: false, isSplitMode: false },
        { slot: 2, name: "Brian's Sync Lead", type: "triton_va", tritonProgId: "A017", isCombiMode: false, isSplitMode: false },
        { slot: 3, name: "Smooth Sine Lead", type: "triton_va", tritonProgId: "A010", isCombiMode: false, isSplitMode: false },
        { slot: 4, name: "🎷 Dirty Blues Sax Growl", type: "single", activeSingleInst: "sax_blues_growl", isCombiMode: false, isSplitMode: false },
        { slot: 5, name: "🎷 Expressive Pitch Scoop Sax", type: "single", activeSingleInst: "sax_scoop", isCombiMode: false, isSplitMode: false },
        { slot: 6, name: "🎷 Funk Brass & Sax Stab", type: "single", activeSingleInst: "sax_funk_stab", isCombiMode: false, isSplitMode: false },
        { slot: 7, name: "Synthesizer You Neo-Soul Stack", type: "combi", activeCombiId: "synthesizer_you", isCombiMode: true, isSplitMode: false },
        { slot: 8, name: "TR-808 Analog Drum Kit", type: "single", activeSingleInst: "tr808_kit", isCombiMode: false, isSplitMode: false },
      ],
    };
  }

  getCurrentSnapshot() {
    const isTritonVa = multiLayerEngine.isTritonVaMode && !!multiLayerEngine.activeTritonVaProg;
    const isCombi = multiLayerEngine.isCombiMode && !isTritonVa;
    const isSplit = multiLayerEngine.isSplitMode;

    let snapshotName = "Custom Rig";
    if (isTritonVa) {
      snapshotName = multiLayerEngine.activeTritonVaProg.name || "Triton VA Lead";
    } else if (isCombi) {
      snapshotName = multiLayerEngine.activeCombi?.name || "Combi Stack";
    } else if (isSplit) {
      const lowerName = multiLayerEngine.splitZones?.lower?.name || "Bass";
      const upperName = multiLayerEngine.splitZones?.upper?.name || "Lead";
      snapshotName = `Split: ${lowerName} / ${upperName}`;
    } else {
      const instKey = multiLayerEngine.activeSingleInst || synthEngine.activePatch?.id || "acoustic_grand_piano";
      snapshotName = HD_SOUNDBANKS[instKey]?.name || instKey;
    }

    return {
      name: snapshotName,
      savedAt: new Date().toISOString(),
      type: isTritonVa ? "triton_va" : (isCombi ? "combi" : "single"),
      // Triton VA Program
      isTritonVaMode: isTritonVa,
      tritonProgId: isTritonVa ? multiLayerEngine.activeTritonVaProg.id : null,
      tritonProg: isTritonVa ? JSON.parse(JSON.stringify(multiLayerEngine.activeTritonVaProg)) : null,
      // Single Rompler
      activeSingleInst: multiLayerEngine.activeSingleInst || synthEngine.activePatch?.id || "acoustic_grand_piano",
      synthPatchId: synthEngine.activePatch?.id || "acoustic_grand_piano",
      masterOctave: synthEngine.octave || 0,
      // Combi 4-Timbre
      isCombiMode: isCombi,
      activeCombiId: multiLayerEngine.activeCombi?.id || null,
      layers: multiLayerEngine.layers.map(l => ({
        enabled: !!l.enabled,
        inst: l.inst,
        gain: l.gain ?? l.volume ?? 1.0,
        oct: l.oct ?? l.octave ?? 0,
        pan: l.pan ?? 0,
        fx: l.fx || "clean",
        minVel: l.minVel ?? 1,
        maxVel: l.maxVel ?? 127,
      })),
      // Split Mode
      isSplitMode: isSplit,
      splitPointMidi: multiLayerEngine.splitPointMidi || 60,
      splitZones: JSON.parse(JSON.stringify(multiLayerEngine.splitZones || {})),
    };
  }

  saveCurrentToSlot(bank, slotNumber, customName = null) {
    const slotIdx = slotNumber - 1;
    if (!this.banks[bank] || slotIdx < 0 || slotIdx > 7) return;

    const snapshot = this.getCurrentSnapshot();
    const existingName = this.banks[bank][slotIdx]?.name || `Rig ${bank}-${slotNumber}`;
    snapshot.name = customName || snapshot.name || existingName;
    snapshot.slot = slotNumber;

    this.banks[bank][slotIdx] = snapshot;
    this.saveBanks();

    if (audioCore && typeof audioCore._diagToast === "function") {
      audioCore._diagToast(`Saved Rig ${bank}-${slotNumber}: "${snapshot.name}"`);
    }
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
      // 1. Triton VA Program (e.g. Brian's Sync A017, Smooth Sine A010)
      if (item.type === "triton_va" || item.isTritonVaMode || item.tritonProgId || item.tritonProg) {
        const prog = item.tritonProg || getTritonProgramById(item.tritonProgId);
        if (prog) {
          multiLayerEngine.setTritonVaProgram(prog);
          if (window.__tritonConsole && typeof window.__tritonConsole.selectProgramById === "function") {
            window.__tritonConsole.selectProgramById(prog.id);
          }
        }
      }
      // 2. Combi 4-Timbre Stack
      else if (item.type === "combi" || (item.isCombiMode && (item.activeCombiId || Array.isArray(item.layers)))) {
        if (item.activeCombiId && COMBI_PRESETS[item.activeCombiId]) {
          multiLayerEngine.setCombiPreset(item.activeCombiId);
        } else {
          multiLayerEngine.toggleCombiMode(true);
          if (Array.isArray(item.layers)) {
            item.layers.forEach((l, idx) => {
              if (multiLayerEngine.layers[idx]) {
                multiLayerEngine.layers[idx].enabled = !!l.enabled;
                if (l.inst) multiLayerEngine.layers[idx].inst = l.inst;
                if (l.gain !== undefined) multiLayerEngine.layers[idx].gain = l.gain;
                if (l.oct !== undefined) multiLayerEngine.layers[idx].oct = l.oct;
                if (l.pan !== undefined) multiLayerEngine.layers[idx].pan = l.pan;
                if (l.fx !== undefined) multiLayerEngine.setLayerFx(idx, l.fx);
              }
            });
            multiLayerEngine.notifyLayerChange();
          }
        }
      }
      // 3. Single Rompler / Acoustic Instrument
      else {
        const instId = item.activeSingleInst || item.instId || item.synthPatchId || item.synth || "acoustic_grand_piano";
        multiLayerEngine.setSingleInstrument(instId);
        synthEngine.setPatch(instId);
      }

      // 4. Restore Split Mode
      if (item.isSplitMode || item.split) {
        multiLayerEngine.toggleSplitMode(true);
        if (item.splitPointMidi) multiLayerEngine.setSplitPointMidi(item.splitPointMidi);
        if (item.splitZones) {
          if (item.splitZones.lower) {
            multiLayerEngine.splitZones.lower = { ...multiLayerEngine.splitZones.lower, ...item.splitZones.lower };
          }
          if (item.splitZones.upper) {
            multiLayerEngine.splitZones.upper = { ...multiLayerEngine.splitZones.upper, ...item.splitZones.upper };
          }
          multiLayerEngine.syncSplitFx();
          multiLayerEngine.notifySplitChange();
        }
      } else {
        multiLayerEngine.toggleSplitMode(false);
      }

      // 5. Toast Feedback
      if (audioCore && typeof audioCore._diagToast === "function") {
        audioCore._diagToast(`Rig ${bank}-${slotNumber}: ${item.name || "Active"}`);
      }

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

      // 1. Function Keys F9..F12 switch Banks A, B, C, D
      const fBankMap = { F9: "A", F10: "B", F11: "C", F12: "D" };
      const matchedBank = fBankMap[e.code] || fBankMap[e.key?.toUpperCase()];
      if (matchedBank) {
        e.preventDefault();
        this.currentBank = matchedBank;
        this.recallSlot(matchedBank, this.currentSlot);
        return;
      }

      // 2. Function Keys F1..F8 map to Rig Slots 1 through 8
      let slotNum = null;
      const fKeyMatch = (e.code || "").match(/^F([1-8])$/);
      if (fKeyMatch) {
        slotNum = parseInt(fKeyMatch[1]);
      } else if (e.key && e.key.match(/^F([1-8])$/i)) {
        slotNum = parseInt(e.key.replace(/^F/i, ""));
      }

      if (slotNum !== null) {
        // Shift + F1..F8 OR Alt + F1..F8 saves current rig to slot instantly
        if (e.shiftKey || e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          const saved = this.saveCurrentToSlot(this.currentBank, slotNum);
          if (this.onRecallCallback) {
            this.onRecallCallback({ bank: this.currentBank, slot: slotNum, preset: saved });
          }
          return;
        }

        // Plain F1..F8 recalls slot in current bank
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          this.recallSlot(this.currentBank, slotNum);
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
