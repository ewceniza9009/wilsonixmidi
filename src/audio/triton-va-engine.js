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
    this._sustainSettings = null;
  }

  init() {
    if (this.pool) return;
    const ctx = audioCore.ctx;
    if (!ctx) return;
    // Route through the master FX Rack so program IFX/MFX still apply on top.
    const dest = audioCore.fxRack?.input || ctx.destination;
    // P2.2: cap the packed pool at 8 hot voices; it grows on demand toward
    // 16 inside acquireVoice. Multi-VA combis no longer render 48 osc/slot.
    this.pool = new VoicePoolManager(ctx, 16, dest, this.heldNotes, 8);
  }

  setProgram(prog) {
    if (!prog) return;
    this.activeProgram = prog;

    const osc1 = safeWave(prog.osc1 || "sawtooth");
    let osc2 = safeWave(prog.osc2 || "sawtooth");
    const r1 = prog.r1 || 1.0;
    let r2 = prog.r2 || 1.0;

    // Oscillator 3 configuration and blend gains:
    // 1. Pure Sine Leads (Smooth Sine Lead): strong fundamental core + octave sheen, no 3rd osc beating
    // 2. Organs & E.Pianos (Dark Jazz, R&B EP, Phantom of Tine): body + harmonic drawbar/tine
    // 3. Complex Synth Leads (Saw/Square/Trance): lush 3-osc supersaw detune
    // 4. General Pads, Strings, Brass: clean 2-osc mix (no sub rumble)
    const isLead = /(lead|trance|saw|synth|stabb|stab|fast|hit|motion)/i.test((prog.category || "") + " " + (prog.name || ""));
    const isPureSineLead = (osc1 === "sine" && osc2 === "sine") && isLead;
    const isOrganOrEP = /(organ|\bep\b|piano|tine|clav|vibes|bell|wurly|rhodes)/i.test((prog.category || "") + " " + (prog.name || ""));

    let osc3Type = "sine";
    let osc3Ratio = 0.5;
    let gain1 = 0.50;
    let gain2 = 0.35;
    let gain3 = 0.0; // sub disabled for non-leads

    if (isPureSineLead) {
      gain1 = 0.65;
      gain2 = 0.25;
      gain3 = 0.0;
      osc3Type = "sine";
      osc3Ratio = 1.0;
    } else if (isOrganOrEP) {
      gain1 = 0.55;
      gain2 = 0.35;
      gain3 = 0.0;
      osc3Type = "sine";
      osc3Ratio = 0.5;
    } else if (isLead) {
      osc3Type = osc1;
      osc3Ratio = r1 * 0.995; // Detuned mirror: rich unison fatness
      gain1 = 0.40;
      gain2 = 0.34;
      gain3 = 0.26;
    }

    // Calibrate square waves to match sawtooth/triangle perceived loudness
    if (osc1 === "square") gain1 *= 0.65;
    if (osc2 === "square") gain2 *= 0.65;
    if (osc3Type === "square") gain3 *= 0.65;

    const isPercussive = /(stab|hit|pluck|slap|tine|\bep\b|wurly|rhodes|clav|harp|kalimba|mallet|vibes|vibe|bell(?!\s*pad)|piano(?!\s*pad))/i.test((prog.category || "") + " " + (prog.name || ""));

    // HARD SYNC: programs named "sync" (Brian's Sync, Octa Sync, sync pads/leads)
    // route osc2 to the phase-sync WaveShaper so the slave is reset by osc1 on every
    // master period -- the authentic raucous octave/harmonic "sync lead" character.
    const isSyncProgram = /(\bsync\b|octa.?sync|harm.?sync|sync.?lead)/i.test((prog.category || "") + " " + (prog.name || "") + " " + (prog.ifx || ""));

    // ── Phase S data-driven re-voice: A013 / A018 / A036 ─────────────────
    // Tone values are LOCKED INTO THE PRESET DATA (triton-soundbanks.js):
    // gain1/gain2/gain3, osc3Type/osc3Ratio, osc2, r2, cutoff, attack.
    // The engine only re-reads the preset's own fields — no hardcoded DSP.
    let cutoffHz = prog.cutoff || 6000;
    let attackVal = prog.attack ?? 0.01;
    if (prog.id === "A036") {
      // Velo Piano ST → bright punchy bell-tine EP: triangle + octave
      // triangle (hair of detune), bright open filter, percussive pluck body.
      osc2 = safeWave(prog.osc2);
      r2 = prog.r2;
      gain1 = prog.gain1;
      gain2 = prog.gain2;
      gain3 = prog.gain3;
      cutoffHz = prog.cutoff;
      attackVal = Math.max(0.005, prog.attack ?? 0.002);
    } else if (prog.id === "A013") {
      // Piano Pad 2 → warm, soft, slow-swelling pad: near-unison detuned
      // triangles, gentle low-pass, slow attack. Reads as a pad, not a piano.
      osc2 = safeWave(prog.osc2);
      r2 = prog.r2;
      gain1 = prog.gain1;
      gain2 = prog.gain2;
      gain3 = prog.gain3;
      cutoffHz = prog.cutoff;
      attackVal = Math.max(0.005, prog.attack ?? 0.01);
    } else if (prog.id === "A018") {
      // Icy Piano Pad → cold crystalline shimmer: triangle + 2-octave sine
      // bell harmonic pushed up + a fixed octave glass partial, bright filter.
      osc2 = safeWave(prog.osc2);
      r2 = prog.r2;
      gain1 = prog.gain1;
      gain2 = prog.gain2;
      gain3 = prog.gain3;
      if (prog.osc3Type) osc3Type = safeWave(prog.osc3Type);
      if (prog.osc3Ratio) osc3Ratio = prog.osc3Ratio;
      cutoffHz = prog.cutoff;
      attackVal = Math.max(0.005, prog.attack ?? 0.01);
    }

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
      filterCutoff: Math.min(9500, cutoffHz),
      filterQ: Math.min(1.2, prog.Q || 0.8),
      filterDecay: null,
      attack: Math.max(0.005, attackVal),
      decay: prog.decay || 2.0,
      sustainLevel: prog.sustain ?? 0.65,
      release: Math.max(0.06, prog.release ?? 0.35),
      isPercussive,
      isLead,
      syncSlave: isSyncProgram,
      masterGain: 0.82,
    };
  }

  noteOn(midiNote, velocity = 95, when = 0) {
    if (!this.config) return;
    // P2.2: the voice pool is built lazily on the first actual trigger, not
    // when a program is merely selected — an idle VA slot allocates nothing.
    this.init();
    if (!this.pool) return;

    // Voice polyphony ceiling: limits simultaneous voices to avoid DSP overflow under sustain
    const maxActive = this.config.isLead ? 8 : 16;
    const busyVoices = this.pool.voices.filter(v => v.isBusy);
    if (busyVoices.length >= maxActive) {
      // Steal oldest voice that is not currently held down by a finger
      const unheld = busyVoices.filter(v => !this.heldNotes.has(v.activeMidiNote));
      if (unheld.length > 0) {
        unheld.sort((a, b) => a.startTime - b.startTime);
        unheld[0].forceStop();
      } else {
        busyVoices.sort((a, b) => a.startTime - b.startTime);
        busyVoices[0].forceStop();
      }
    }

    this.heldNotes.add(midiNote);

    const vel = Math.max(1, Math.min(127, velocity));
    // Nudge each voice's base detune by a hair so stacked notes stay phase-rich
    const sameNote = this.pool.voices.some(v => v.isBusy && v.activeMidiNote === midiNote);
    const voice = this.pool.acquireVoice(midiNote);
    const ratio = Math.pow(2, this.pitchBendSemitones / 12);
    voice.trigger(midiNote, vel, this.config, ratio, sameNote, when);
  }

  noteOff(midiNote, when = 0) {
    if (!this.pool) return;
    this.heldNotes.delete(midiNote);
    const rel = Math.max(0.02, Math.min(1.2, this.config?.release || 0.35));
    const voices = this.pool.getActiveVoicesByNote(midiNote);
    voices.forEach(v => v.release(this.sustainPedal, rel, when, this._sustainSettings));
  }

  setSustainPedal(down, when = 0) {
    this.sustainPedal = !!down;
    if (!this.sustainPedal && this.pool) {
      this.pool.voices.forEach(v => {
        if (v.isSustained && !this.heldNotes.has(v.activeMidiNote)) {
          v.release(false, this.config?.release || 0.35, when, this._sustainSettings);
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