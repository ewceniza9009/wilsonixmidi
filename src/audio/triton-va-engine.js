/**
 * Triton Virtual-Analog (VA) Oscillator Engine
 * Renders KORG Triton Program waveforms (osc1/osc2/osc3 mix, filter, + envelope)
 * through real oscillators so every program has its OWN unique sound instead of
 * collapsing onto a shared PCM sample.
 */

import { VoicePoolManager } from "./voice-pool.js";
import { audioCore } from "./audio-core.js";

const WAVEFORMS = ["sawtooth", "square", "triangle", "sine"];

function safeWave(w) {
  return WAVEFORMS.includes(w) ? w : "sawtooth";
}

export class TritonVirtualAnalogEngine {
  constructor() {
    this.pool = null;
    this.activeProgram = null;
    this.config = null;
    this.pitchBendSemitones = 0;
    this.sustainPedal = false;
    this.heldNotes = new Set();
    this._monoIndex = 0;
  }

  init() {
    if (this.pool) return;
    const ctx = audioCore.ctx;
    if (!ctx) return;
    // Route through the master FX Rack so program IFX/MFX still apply on top.
    const dest = audioCore.fxRack?.input || ctx.destination;
    this.pool = new VoicePoolManager(ctx, 32, dest, this.heldNotes);
  }

  setProgram(prog) {
    if (!prog) return;
    this.init();
    this.activeProgram = prog;

    const osc1 = safeWave(prog.osc1 || "sawtooth");
    const osc2 = safeWave(prog.osc2 || "sawtooth");
    const r1 = prog.r1 || 1.0;
    const r2 = prog.r2 || 1.0;

    // Third osc: for leads = ultra-tight detuned mirror (fatness, no beating rumble).
    // For every other timbre (EPs, organs, strings, brass) the sub is DISABLED --
    // a wholetone sine under every voice was the "warm muddy stacking" noise.
    let osc3Type = "sine";
    let osc3Ratio = 0.5;
    const isLead = /(lead|trance|saw|synth|stabb|stab|fast|hit|motion)/i.test((prog.category || "") + " " + (prog.name || ""));
    if (isLead) {
      osc3Type = osc1;
      osc3Ratio = r1 * 0.995; // Detuned mirror: slower, softer beating than the old 1%
    }

    // Blend gains: osc1 body, osc2 colour, osc3 mirror/sub. Sum kept near 1.0 pre-filter;
    // the master busPad trim (0.7) + soft limiters provide all the headroom.
    let gain1 = 0.48;
    let gain2 = 0.34;
    let gain3 = 0.0; // sub disabled for non-leads
    if (isLead) {
      gain1 = 0.40;
      gain2 = 0.34;
      gain3 = 0.26;
    }

    const isPercussive = /(stab|hit|pluck|slap|tine|ep|wurly|rhodes|clav|harp|kalimba|mallet|vibes|vibe|bell(?!\s*pad)|piano(?!\s*pad))/i.test((prog.category || "") + " " + (prog.name || ""));

    // HARD SYNC: programs named "sync" (Brian's Sync, Octa Sync, sync pads/leads)
    // route osc2 to the phase-sync WaveShaper so the slave is reset by osc1 on every
    // master period -- the authentic raucous octave/harmonic "sync lead" character.
    const isSyncProgram = /(\bsync\b|octa.?sync|harm.?sync|sync.?lead)/i.test((prog.category || "") + " " + (prog.name || "") + " " + (prog.ifx || ""));

    this.config = {
      osc1Type: osc1,
      osc1Ratio: r1,
      osc2Type: osc2,
      osc2Ratio: r2,
      osc3Type,
      osc3Ratio,
      gain1,
      gain2,
      gain3,
      filterType: "lowpass",
      filterCutoff: prog.cutoff || 7000,
      filterQ: prog.Q || 1.5,
      filterDecay: null,
      attack: Math.max(0.001, prog.attack ?? 0.01),
      decay: prog.decay || 2.0,
      sustainLevel: prog.sustain ?? 0.65,
      release: prog.release ?? 0.35,
      isPercussive,
      syncSlave: isSyncProgram,
      masterGain: 0.72,
    };
  }

  noteOn(midiNote, velocity = 95) {
    if (!this.pool || !this.config) return;
    this.init();
    this.heldNotes.add(midiNote);

    const vel = Math.max(1, Math.min(127, velocity));
    // Nudge each voice's base detune by a hair so stacked notes stay phase-rich
    const sameNote = this.pool.voices.some(v => v.isBusy && v.activeMidiNote === midiNote);
    const voice = this.pool.acquireVoice(midiNote);
    const ratio = Math.pow(2, this.pitchBendSemitones / 12);
    voice.trigger(midiNote, vel, this.config, ratio, sameNote);
  }

  noteOff(midiNote) {
    if (!this.pool) return;
    this.heldNotes.delete(midiNote);
    const rel = Math.max(0.02, Math.min(1.2, this.config?.release || 0.35));
    const voices = this.pool.getActiveVoicesByNote(midiNote);
    voices.forEach(v => v.release(this.sustainPedal, rel));
  }

  setSustainPedal(down) {
    this.sustainPedal = !!down;
    if (!this.sustainPedal && this.pool) {
      this.pool.voices.forEach(v => {
        if (v.isSustained && !this.heldNotes.has(v.activeMidiNote)) {
          v.release(false, this.config?.release || 0.35);
        }
      });
    }
  }

  setPitchBend(semitones) {
    this.pitchBendSemitones = Math.max(-12, Math.min(12, semitones));
    const ratio = Math.pow(2, this.pitchBendSemitones / 12);
    if (!this.pool || !audioCore.ctx) return;
    const now = audioCore.ctx.currentTime;
    this.pool.voices.forEach(v => {
      if (v.isBusy && v.activeMidiNote !== null) {
        const baseFreq = 440 * Math.pow(2, (v.activeMidiNote - 69) / 12);
        v.osc1.frequency.setTargetAtTime(baseFreq * ratio, now, 0.008);
      }
    });
  }

  allNotesOff() {
    this.heldNotes.clear();
    this.sustainPedal = false;
    if (this.pool) this.pool.allNotesOff();
  }
}

export const tritonVaEngine = new TritonVirtualAnalogEngine();