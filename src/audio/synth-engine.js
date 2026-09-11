/**
 * Workstation Synthesizer Engine
 * Coordinates instrument patches (Synthage, Korg Triton, M1, Fantom), voice routing,
 * dual-layering, keyboard splitting, pitch bend, and sustain pedals.
 */

import { VoicePoolManager } from "./voice-pool.js";
import { audioCore } from "./audio-core.js";

export const INSTRUMENT_PATCHES = {
  whitney_ballad: {
    id: "whitney_ballad",
    name: "★ Whitney - I Have Nothing (Foster Rig)",
    category: "Ballad",
    osc1Type: "triangle",
    osc1Ratio: 1.0,
    osc2Type: "sine",
    osc2Ratio: 2.001,
    osc3Type: "triangle",
    osc3Ratio: 0.5,
    gain1: 0.65,
    gain2: 0.28,
    gain3: 0.15,
    filterType: "lowpass",
    filterCutoff: 6500,
    filterQ: 0.8,
    filterDecay: 1.5,
    attack: 0.002,
    decay: 3.5,
    sustainLevel: 0.20,
    release: 0.45,
    isPercussive: true,
    fxPreset: "whitney_ballad",
  },
  synthage_grand: {
    id: "synthage_grand",
    name: "Synthage Concert Grand",
    category: "Acoustic Piano",
    osc1Type: "triangle",
    osc1Ratio: 1.0,
    osc2Type: "sine",
    osc2Ratio: 2.001,
    osc3Type: "triangle",
    osc3Ratio: 0.5,
    gain1: 0.65,
    gain2: 0.28,
    gain3: 0.15,
    filterType: "lowpass",
    filterCutoff: 5800,
    filterQ: 0.8,
    filterDecay: 1.2,
    attack: 0.002, // 2ms hammer strike
    decay: 3.2,
    sustainLevel: 0.15,
    release: 0.35,
    isPercussive: true,
    fxPreset: "grand",
  },
  triton_dyno_ep: {
    id: "triton_dyno_ep",
    name: "Korg Triton Dyno EP",
    category: "Electric Piano",
    osc1Type: "sine",
    osc1Ratio: 1.0,
    osc2Type: "sine",
    osc2Ratio: 3.998, // Bell-tine harmonic
    osc3Type: "triangle",
    osc3Ratio: 2.0,
    gain1: 0.58,
    gain2: 0.32,
    gain3: 0.18,
    filterType: "lowpass",
    filterCutoff: 6500,
    filterQ: 1.4,
    filterDecay: 1.6,
    attack: 0.002,
    decay: 2.8,
    sustainLevel: 0.25,
    release: 0.45,
    isPercussive: true,
    fxPreset: "triton_ep",
  },
  triton_warm_strings: {
    id: "triton_warm_strings",
    name: "Triton Warm Strings",
    category: "Strings & Pads",
    osc1Type: "sawtooth",
    osc1Ratio: 1.0,
    osc2Type: "sawtooth",
    osc2Ratio: 1.006, // Lush analog detuning
    osc3Type: "triangle",
    osc3Ratio: 0.5,
    gain1: 0.45,
    gain2: 0.42,
    gain3: 0.25,
    filterType: "lowpass",
    filterCutoff: 3800,
    filterQ: 1.1,
    filterDecay: null,
    attack: 0.22, // Expressive slow swell
    decay: 0.6,
    sustainLevel: 0.85,
    release: 0.8,
    isPercussive: false,
    fxPreset: "warm_strings",
  },
  m1_rock_organ: {
    id: "m1_rock_organ",
    name: "M1 / Triton Drawbar Organ",
    category: "Organ",
    osc1Type: "sine",
    osc1Ratio: 1.0, // 8' fundamental drawbar
    osc2Type: "sine",
    osc2Ratio: 2.996, // 2-2/3' 3rd harmonic percussion
    osc3Type: "sine",
    osc3Ratio: 0.5, // 16' warm sub drawbar
    gain1: 0.58,
    gain2: 0.35,
    gain3: 0.25,
    filterType: "lowpass",
    filterCutoff: 6500,
    filterQ: 0.5,
    filterDecay: null,
    attack: 0.003, // Clean smooth transient
    decay: 0.15,
    sustainLevel: 0.95,
    release: 0.10,
    isPercussive: false,
    fxPreset: "m1_organ",
  },
  fantom_nylon_pluck: {
    id: "fantom_nylon_pluck",
    name: "Fantom Acoustic Nylon",
    category: "Guitar & Pluck",
    osc1Type: "triangle",
    osc1Ratio: 1.0,
    osc2Type: "sawtooth",
    osc2Ratio: 2.0,
    osc3Type: "sine",
    osc3Ratio: 0.5,
    gain1: 0.62,
    gain2: 0.22,
    gain3: 0.15,
    filterType: "lowpass",
    filterCutoff: 5200,
    filterQ: 1.2,
    filterDecay: 0.4,
    attack: 0.003,
    decay: 1.9,
    sustainLevel: 0.05,
    release: 0.25,
    isPercussive: true,
    fxPreset: "grand",
  },
  moog_punch_bass: {
    id: "moog_punch_bass",
    name: "Moog / Triton Punchy Bass",
    category: "Bass & Sub",
    osc1Type: "sawtooth",
    osc1Ratio: 1.0,
    osc2Type: "square",
    osc2Ratio: 1.004,
    osc3Type: "sine",
    osc3Ratio: 0.5, // Sub-bass reinforcement
    gain1: 0.52,
    gain2: 0.40,
    gain3: 0.38,
    filterType: "lowpass",
    filterCutoff: 2400,
    filterQ: 1.8, // Controlled warm punch
    filterDecay: 0.35,
    attack: 0.003,
    decay: 1.2,
    sustainLevel: 0.4,
    release: 0.15,
    isPercussive: false,
    fxPreset: "grand",
  },
  supersaw_lead: {
    id: "supersaw_lead",
    name: "SuperSaw Brass & PolyLead",
    category: "Synthesizer",
    osc1Type: "sawtooth",
    osc1Ratio: 1.0,
    osc2Type: "sawtooth",
    osc2Ratio: 1.012, // Massive detune
    osc3Type: "sawtooth",
    osc3Ratio: 0.988,
    gain1: 0.4,
    gain2: 0.38,
    gain3: 0.38,
    filterType: "lowpass",
    filterCutoff: 8200,
    filterQ: 1.4,
    filterDecay: 0.9,
    attack: 0.005,
    decay: 1.8,
    sustainLevel: 0.7,
    release: 0.45,
    isPercussive: false,
    fxPreset: "synth_lead",
  },
  m1_organ_2: {
    id: "m1_organ_2",
    name: "M1 Organ 2 (Show Me Love)",
    category: "Organ & Bass",
    osc1Type: "sine",
    osc1Ratio: 1.0,
    osc2Type: "sine",
    osc2Ratio: 2.996, // 3rd harmonic percussive tine
    osc3Type: "sine",
    osc3Ratio: 0.5,   // 16' clean sub drawbar
    gain1: 0.65,
    gain2: 0.42,
    gain3: 0.28,
    filterType: "lowpass",
    filterCutoff: 6200,
    filterQ: 0.6,
    attack: 0.003, // Clean non-clicking keyclick
    decay: 0.25,   // Snappy percussive drop
    sustainLevel: 0.55,
    release: 0.10, // Smooth dance bass release
    isPercussive: false,
    fxPreset: "m1_organ",
  },
  m1_universe: {
    id: "m1_universe",
    name: "M1 Universe (Celestial Pad)",
    category: "Synth Pad",
    osc1Type: "sawtooth",
    osc1Ratio: 1.0,
    osc2Type: "triangle",
    osc2Ratio: 1.006,
    osc3Type: "sine",
    osc3Ratio: 2.0,
    gain1: 0.55,
    gain2: 0.45,
    gain3: 0.35,
    filterType: "lowpass",
    filterCutoff: 4000,
    filterQ: 1.4,
    attack: 0.38,
    decay: 3.5,
    sustainLevel: 0.85,
    release: 1.5,
    isPercussive: false,
    fxPreset: "warm_strings",
  },
  m1_slap_bass: {
    id: "m1_slap_bass",
    name: "M1 Slap Bass (90s Funk)",
    category: "Bass & Sub",
    osc1Type: "sawtooth",
    osc1Ratio: 1.0,
    osc2Type: "square",
    osc2Ratio: 0.5,
    osc3Type: "triangle",
    osc3Ratio: 2.0,
    gain1: 0.65,
    gain2: 0.50,
    gain3: 0.30,
    filterType: "lowpass",
    filterCutoff: 4800,
    filterQ: 3.2,
    filterDecay: 0.18,
    attack: 0.001,
    decay: 0.42,
    sustainLevel: 0.10,
    release: 0.08,
    isPercussive: true,
    fxPreset: "grand",
  },
  m1_choir: {
    id: "m1_choir",
    name: "M1 Ooh-Aah Choir",
    category: "Strings & Choir",
    osc1Type: "sine",
    osc1Ratio: 1.0,
    osc2Type: "triangle",
    osc2Ratio: 2.0,
    osc3Type: "sawtooth",
    osc3Ratio: 1.002,
    gain1: 0.60,
    gain2: 0.35,
    gain3: 0.20,
    filterType: "lowpass",
    filterCutoff: 3200,
    filterQ: 2.2,
    attack: 0.18,
    decay: 3.2,
    sustainLevel: 0.85,
    release: 1.4,
    isPercussive: false,
    fxPreset: "warm_strings",
  },
  m1_ooh_ahh: {
    id: "m1_ooh_ahh",
    name: "03 Ooh-Ahh (Korg M1 Vocal)",
    category: "Strings & Choir",
    osc1Type: "sine",
    osc1Ratio: 1.0,
    osc2Type: "triangle",
    osc2Ratio: 2.0,
    osc3Type: "sawtooth",
    osc3Ratio: 1.003,
    gain1: 0.65,
    gain2: 0.35,
    gain3: 0.20,
    filterType: "lowpass",
    filterCutoff: 3400,
    filterQ: 2.4,
    attack: 0.18,
    decay: 3.2,
    sustainLevel: 0.85,
    release: 1.4,
    isPercussive: false,
    fxPreset: "warm_strings",
  },
  m1_fresh_air: {
    id: "m1_fresh_air",
    name: "M1 Fresh Air (Airy Bell)",
    category: "Bells & Pad",
    osc1Type: "sine",
    osc1Ratio: 1.0,
    osc2Type: "triangle",
    osc2Ratio: 4.004,
    osc3Type: "sawtooth",
    osc3Ratio: 0.5,
    gain1: 0.55,
    gain2: 0.45,
    gain3: 0.25,
    filterType: "lowpass",
    filterCutoff: 7800,
    filterQ: 2.5,
    attack: 0.005,
    decay: 3.0,
    sustainLevel: 0.65,
    release: 1.2,
    isPercussive: false,
    fxPreset: "synth_lead",
  },
  m1_piano_16: {
    id: "m1_piano_16",
    name: "M1 Piano 16' (Vogue House)",
    category: "Acoustic Piano",
    osc1Type: "triangle",
    osc1Ratio: 1.0,
    osc2Type: "sawtooth",
    osc2Ratio: 2.0,
    osc3Type: "sine",
    osc3Ratio: 4.0,
    gain1: 0.62,
    gain2: 0.35,
    gain3: 0.20,
    filterType: "lowpass",
    filterCutoff: 8200,
    filterQ: 1.2,
    attack: 0.002,
    decay: 2.8,
    sustainLevel: 0.20,
    release: 0.35,
    isPercussive: true,
    fxPreset: "grand",
  },
  abletunes_fm_dx7: {
    id: "abletunes_fm_dx7",
    name: "Abletunes FM Piano (DX7)",
    category: "Electric Piano",
    osc1Type: "sine",
    osc1Ratio: 1.0,
    osc2Type: "sine",
    osc2Ratio: 5.0, // Iconic metallic bell tine
    osc3Type: "triangle",
    osc3Ratio: 2.0,
    gain1: 0.55,
    gain2: 0.38,
    gain3: 0.25,
    filterType: "lowpass",
    filterCutoff: 7500,
    filterQ: 1.5,
    attack: 0.002,
    decay: 3.0,
    sustainLevel: 0.25,
    release: 0.45,
    isPercussive: true,
    fxPreset: "triton_ep",
  },
  fat_brass_horns: {
    id: "fat_brass_horns",
    name: "Triton Fat Brass Section",
    category: "Brass",
    osc1Type: "sawtooth",
    osc1Ratio: 1.0,
    osc2Type: "sawtooth",
    osc2Ratio: 1.008,
    osc3Type: "square",
    osc3Ratio: 0.5,
    gain1: 0.50,
    gain2: 0.45,
    gain3: 0.25,
    filterType: "lowpass",
    filterCutoff: 6200,
    filterQ: 2.2,
    attack: 0.04,
    decay: 1.8,
    sustainLevel: 0.65,
    release: 0.35,
    isPercussive: false,
    fxPreset: "synth_lead",
  },
  breathy_alto_sax: {
    id: "breathy_alto_sax",
    name: "Breathy Alto Saxophone",
    category: "Woodwind",
    osc1Type: "sawtooth",
    osc1Ratio: 1.0,
    osc2Type: "triangle",
    osc2Ratio: 2.0,
    osc3Type: "sine",
    osc3Ratio: 1.0,
    gain1: 0.52,
    gain2: 0.35,
    gain3: 0.25,
    filterType: "lowpass",
    filterCutoff: 4600,
    filterQ: 2.5,
    attack: 0.06,
    decay: 1.6,
    sustainLevel: 0.80,
    release: 0.25,
    isPercussive: false,
    fxPreset: "grand",
  },
};

export class SynthEngine {
  constructor() {
    this.voicePool = null;
    this.activePatch = INSTRUMENT_PATCHES.synthage_grand;

    // Dual Layer Configuration
    this.isDualLayer = false;
    this.layerPatch = INSTRUMENT_PATCHES.triton_warm_strings;

    // Split Keyboard Configuration
    this.isSplitMode = false;
    this.splitPointMidi = 60; // C3 split
    this.splitLeftPatch = INSTRUMENT_PATCHES.moog_punch_bass;

    // Controllers
    this.sustainPedal = false;
    this.pitchBendSemi = 0;
    this.modWheelAmount = 0;

    // Active key tracker
    this.heldNotes = new Set();
    this.onNoteChangeCallback = null;
  }

  init() {
    const ctx = audioCore.init();
    if (!this.voicePool) {
      // NUCLEAR FIX: Route voice pool to a PERMANENTLY MUTED gain node.
      // This ensures the 96 boot-time oscillators can NEVER produce audible "toot" sounds.
      // All real instrument audio comes from NativePcmEngine (24-bit PCM samples).
      this._muteNode = ctx.createGain();
      this._muteNode.gain.value = 0.0;
      this._muteNode.connect(ctx.destination);
      this.voicePool = new VoicePoolManager(ctx, 32, this._muteNode);
      // This pool's 96 oscillators are permanently inaudible (hard-wired to the
      // muted node above) yet still rendered every quantum. Stop them outright
      // to free the audio render thread; the Triton VA pool is untouched.
      this.voicePool.voices.forEach(v => v.stopOscillators());
    }
    audioCore.fxRack.applyPreset(this.activePatch.fxPreset);
  }

  setPatch(patchId) {
    if (INSTRUMENT_PATCHES[patchId]) {
      this.activePatch = INSTRUMENT_PATCHES[patchId];
      if (audioCore.fxRack) {
        audioCore.fxRack.applyPreset(this.activePatch.fxPreset);
      }
    }
  }

  setLayerPatch(patchId) {
    if (INSTRUMENT_PATCHES[patchId]) {
      this.layerPatch = INSTRUMENT_PATCHES[patchId];
    }
  }

  setSplitPatch(patchId) {
    if (INSTRUMENT_PATCHES[patchId]) {
      this.splitLeftPatch = INSTRUMENT_PATCHES[patchId];
    }
  }

  toggleDualLayer(enabled) {
    this.isDualLayer = enabled !== undefined ? enabled : !this.isDualLayer;
  }

  toggleSplitMode(enabled) {
    this.isSplitMode = enabled !== undefined ? enabled : !this.isSplitMode;
  }

  noteOn(midiNote, velocity = 95) {
    // Track held notes for arpeggiator, UI, and visual keyboard feedback
    this.heldNotes.add(midiNote);

    // Fire visual callback (virtual keyboard highlighting) — NO oscillator triggering
    if (this.onNoteChangeCallback) {
      this.onNoteChangeCallback(midiNote, true, velocity);
    }
  }

  noteOff(midiNote) {
    this.heldNotes.delete(midiNote);

    if (this.onNoteChangeCallback) {
      this.onNoteChangeCallback(midiNote, false, 0);
    }
  }

  triggerLayerVoice(midiNote, velocity, patchOverride) {
    if (!this.voicePool) this.init();
    const patch = patchOverride || this.layerPatch;
    if (!patch) return;
    const pitchRatio = Math.pow(2, this.pitchBendSemi / 12);
    const voice = this.voicePool.acquireVoice(midiNote + 1000);
    voice.trigger(midiNote, velocity, patch, pitchRatio);
  }

  releaseLayerVoice(midiNote, patchOverride) {
    if (!this.voicePool) return;
    const patch = patchOverride || this.layerPatch;
    const releaseTime = patch?.release || 0.45;
    const voices = this.voicePool.getActiveVoicesByNote(midiNote + 1000);
    voices.forEach(v => v.release(this.sustainPedal, releaseTime));
  }

  setSustainPedal(active) {
    this.sustainPedal = active;
    if (!active && this.voicePool) {
      // Release all sustained voices that are no longer physically held down
      this.voicePool.voices.forEach(voice => {
        if (voice.isSustained && !this.heldNotes.has(voice.activeMidiNote)) {
          voice.release(false, 0.25);
        }
      });
    }
  }

  setPitchBend(semitones) {
    this.pitchBendSemi = Math.max(-12, Math.min(12, semitones));
    const ratio = Math.pow(2, this.pitchBendSemi / 12);
    const now = audioCore.ctx ? audioCore.ctx.currentTime : 0;

    if (this.voicePool && audioCore.ctx) {
      this.voicePool.voices.forEach(v => {
        if (v.isBusy && v.activeMidiNote !== null) {
          const rawMidi = v.activeMidiNote > 900 ? v.activeMidiNote - 1000 : v.activeMidiNote;
          const baseFreq = 440 * Math.pow(2, (rawMidi - 69) / 12);
          v.osc1.frequency.setTargetAtTime(baseFreq * ratio, now, 0.005);
        }
      });
    }
  }

  setModWheel(normalized) {
    this.modWheelAmount = Math.max(0, Math.min(1.0, normalized));
    // Modulates Korg Chorus depth or filter cutoff dynamically
    if (audioCore.fxRack) {
      audioCore.fxRack.chorus.setDepth(0.3 + this.modWheelAmount * 0.7);
    }
  }

  panic() {
    this.heldNotes.clear();
    this.sustainPedal = false;
    if (this.voicePool) {
      this.voicePool.allNotesOff();
    }
  }
}

export const synthEngine = new SynthEngine();
