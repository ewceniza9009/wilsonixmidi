/**
 * WILSONIX MIDIKEY Elite - Universal MIDI Learn & Hardware Controller Binding Engine
 * Allows mapping physical MIDI knobs, faders, and pads to any UI control via right-click / MIDI Learn.
 */

import { multiLayerEngine } from "../audio/multi-layer-engine.js";
import { synthEngine } from "../audio/synth-engine.js";
import { audioCore } from "../audio/audio-core.js";

export class MidiLearnManager {
  constructor() {
    this.storageKey = "wilsonix_midikey_midi_mappings";
    this.learningParam = null;
    this.mappings = this.loadMappings();
    this.onMappingChange = null;

    this.initContextMenuListeners();
  }

  loadMappings() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) return JSON.parse(stored);
    } catch (e) {}

    // Default factory mappings (General MIDI standard CCs)
    return {
      master_vol: { cc: 7, channel: 0, min: 0, max: 100 },
      layer_1_vol: { cc: 71, channel: 0, min: 0, max: 100 },
      layer_2_vol: { cc: 72, channel: 0, min: 0, max: 100 },
      layer_3_vol: { cc: 73, channel: 0, min: 0, max: 100 },
      layer_4_vol: { cc: 74, channel: 0, min: 0, max: 100 },
      fx_cutoff: { cc: 74, channel: 0, min: 20, max: 20000 },
      fx_resonance: { cc: 71, channel: 0, min: 0, max: 20 },
    };
  }

  saveMappings() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.mappings));
    } catch (e) {}
  }

  startLearning(paramId, element) {
    this.learningParam = { id: paramId, element };
    if (element) {
      element.classList.add("midi-learning-active");
    }
    console.log(`MIDI Learn active for parameter: "${paramId}". Move any hardware MIDI knob/fader now.`);
  }

  cancelLearning() {
    if (this.learningParam?.element) {
      this.learningParam.element.classList.remove("midi-learning-active");
    }
    this.learningParam = null;
  }

  /**
   * Called by midiManager whenever a Control Change message (status 0xB0-0xBF) is received
   */
  handleControlChange(channel, ccNumber, value) {
    // 1. If currently in MIDI Learn mode, bind this CC!
    if (this.learningParam) {
      const paramId = this.learningParam.id;
      this.mappings[paramId] = {
        cc: ccNumber,
        channel,
        min: 0,
        max: 100,
      };
      this.saveMappings();

      if (this.learningParam.element) {
        this.learningParam.element.classList.remove("midi-learning-active");
        this.learningParam.element.classList.add("midi-learn-success");
        setTimeout(() => this.learningParam.element?.classList.remove("midi-learn-success"), 1500);
      }

      console.log(`✓ Mapped parameter "${paramId}" to MIDI CC #${ccNumber} (Ch ${channel + 1})`);
      this.learningParam = null;
      if (this.onMappingChange) this.onMappingChange();
      return true;
    }

    // 2. Normal playback dispatch: check if CC matches any mapped parameter
    let handled = false;
    for (const [paramId, mapping] of Object.entries(this.mappings)) {
      if (mapping.cc === ccNumber) {
        this.applyParameterValue(paramId, value);
        handled = true;
      }
    }
    return handled;
  }

  applyParameterValue(paramId, midiVal) {
    const normalized = midiVal / 127; // 0.0 to 1.0

    if (paramId === "master_vol") {
      const pct = Math.round(normalized * 100);
      multiLayerEngine.setMasterVolumePct(pct);
      const slider = document.getElementById("hud-master-vol");
      const readout = document.getElementById("hud-master-vol-val");
      if (slider) slider.value = pct;
      if (readout) readout.innerText = `${pct}%`;
    } else if (paramId.startsWith("layer_") && paramId.endsWith("_vol")) {
      const layerIdx = parseInt(paramId.split("_")[1]) - 1;
      if (multiLayerEngine.layers[layerIdx]) {
        multiLayerEngine.layers[layerIdx].volume = normalized;
        const slider = document.getElementById(`layer-${layerIdx}-vol`);
        if (slider) slider.value = Math.round(normalized * 100);
      }
    }
  }

  initContextMenuListeners() {
    // Context menu listener for any element with data-midi-param
    document.addEventListener("contextmenu", e => {
      const target = e.target.closest("[data-midi-param]");
      if (target) {
        e.preventDefault();
        const paramId = target.getAttribute("data-midi-param");
        const currentMapping = this.mappings[paramId];
        const msg = currentMapping ? `Currently mapped to CC #${currentMapping.cc}. Learn new MIDI CC?` : "Learn MIDI Controller CC for this knob?";
        if (confirm(msg)) {
          this.startLearning(paramId, target);
        }
      }
    });
  }
}

export const midiLearnManager = new MidiLearnManager();
