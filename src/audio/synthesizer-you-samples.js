/**
 * MidiKey Elite - Synthesizer You Sample & FX Engine
 * Manages zero-latency playback of all authentic sound effects, stems, and loops
 * ripped directly from "Synthesizer You".
 */

import { audioCore } from "./audio-core.js";

export const SYNTHESIZER_YOU_EFFECTS = [
  {
    id: "sy_surf_spring",
    name: "🏄 Surf Synth Spring Riff",
    icon: "🌊",
    category: "synthesizer_you",
    desc: "Plucky staccato melody bathed in 3.2kHz resonant spring drip",
    file: "/samples/synthesizer_you/surf_spring_synth_riff.wav",
    gain: 1.15,
  },
  {
    id: "sy_chorus_swell",
    name: "🎹 Analog Stereo Chorus Swell",
    icon: "✨",
    category: "synthesizer_you",
    desc: "Lush 1980s Roland Juno-style widened stereo synth pad",
    file: "/samples/synthesizer_you/synth_chorus_pad_swell.wav",
    gain: 1.10,
  },
  {
    id: "sy_gated_snare_1",
    name: "💥 80s Gated Snare Cannon 1",
    icon: "🎯",
    category: "synthesizer_you",
    desc: "Dense plate reverb abruptly snapped shut at 180ms",
    file: "/samples/synthesizer_you/gated_snare_cannon_1.wav",
    gain: 1.25,
  },
  {
    id: "sy_gated_snare_2",
    name: "🥁 80s Gated Snare Cannon 2",
    icon: "💥",
    category: "synthesizer_you",
    desc: "Massive punchy explosive snare with hard noise gate",
    file: "/samples/synthesizer_you/gated_snare_cannon_2.wav",
    gain: 1.25,
  },
  {
    id: "sy_vox_slap_1",
    name: "🗣️ Slapback Vocal Shout 1",
    icon: "🎤",
    category: "synthesizer_you",
    desc: "95ms tape echo with zero feedback and high-end roll-off",
    file: "/samples/synthesizer_you/slapback_vox_chop_1.wav",
    gain: 1.20,
  },
  {
    id: "sy_vox_slap_2",
    name: "🗣️ Slapback Vocal Shout 2",
    icon: "🔥",
    category: "synthesizer_you",
    desc: "In-your-face rockabilly vocal punch with vintage tape slap",
    file: "/samples/synthesizer_you/slapback_vox_chop_2.wav",
    gain: 1.20,
  },
  {
    id: "sy_vox_slap_3",
    name: "🗣️ Slapback Vocal Phrase",
    icon: "🎶",
    category: "synthesizer_you",
    desc: "Tape-saturated lead vocal phrase at front of mix",
    file: "/samples/synthesizer_you/slapback_vox_chop_3.wav",
    gain: 1.20,
  },
  {
    id: "sy_vox_slap_4",
    name: "🗣️ Slapback Vox Cut 4",
    icon: "🎤",
    category: "synthesizer_you",
    desc: "Altered vocal cut from the Synthesizer You track",
    file: "/samples/synthesizer_you/slapback_vox_chop_4.wav",
    gain: 1.20,
  },
  {
    id: "sy_vox_slap_5",
    name: "🗣️ Slapback Vox Phrase A",
    icon: "🎤",
    category: "synthesizer_you",
    desc: "Vocal phrase sliced at 0:23 from the Synthesizer You track",
    file: "/samples/synthesizer_you/slapback_vox_chop_5.wav",
    gain: 1.20,
  },
  {
    id: "sy_vox_slap_6",
    name: "🗣️ Slapback Vox Phrase B",
    icon: "🎤",
    category: "synthesizer_you",
    desc: "Vocal phrase sliced at 1:05 from the Synthesizer You track",
    file: "/samples/synthesizer_you/slapback_vox_chop_6.wav",
    gain: 1.20,
  },
  {
    id: "sy_vox_slap_7",
    name: "🗣️ Slapback Vox Phrase C",
    icon: "🎤",
    category: "synthesizer_you",
    desc: "Vocal phrase sliced at 1:51 from the Synthesizer You track",
    file: "/samples/synthesizer_you/slapback_vox_chop_7.wav",
    gain: 1.20,
  },
  {
    id: "sy_vox_slap_8",
    name: "🗣️ Slapback Vox Phrase D",
    icon: "🎤",
    category: "synthesizer_you",
    desc: "Vocal phrase sliced at 2:29 from the Synthesizer You track",
    file: "/samples/synthesizer_you/slapback_vox_chop_8.wav",
    gain: 1.20,
  },
  {
    id: "sy_vox_slap_9",
    name: "🗣️ Slapback Vox Phrase E",
    icon: "🎤",
    category: "synthesizer_you",
    desc: "Vocal phrase sliced at 3:04 from the Synthesizer You track",
    file: "/samples/synthesizer_you/slapback_vox_chop_9.wav",
    gain: 1.20,
  },
  {
    id: "sy_vox_slap_10",
    name: "🗣️ Slapback Vox Phrase F",
    icon: "🎤",
    category: "synthesizer_you",
    desc: "Vocal phrase sliced at 3:16 from the Synthesizer You track",
    file: "/samples/synthesizer_you/slapback_vox_chop_10.wav",
    gain: 1.20,
  },
  {
    id: "sy_bass_riff",
    name: "⚡ Analog Synth Bass Pulse",
    icon: "🎸",
    category: "synthesizer_you",
    desc: "Driving 1980s synth bassline with stereo chorus widening",
    file: "/samples/synthesizer_you/analog_synth_bass_riff.wav",
    gain: 1.15,
  },
  {
    id: "sy_riser_sweep",
    name: "🚀 Synth Riser & White Noise",
    icon: "⚡",
    category: "synthesizer_you",
    desc: "Cinematic synth frequency sweep and transition build",
    file: "/samples/synthesizer_you/synth_riser_sweep_fx.wav",
    gain: 1.10,
  },
  {
    id: "sy_tape_drop",
    name: "🛑 Tape Drop & Splash FX",
    icon: "💿",
    category: "synthesizer_you",
    desc: "Motor slowdown pitch fall with metallic spring tail",
    file: "/samples/synthesizer_you/synth_tape_drop_fx.wav",
    gain: 1.15,
  },
  {
    id: "sy_kick_punch",
    name: "🥊 Tape Saturated 80s Kick",
    icon: "🥁",
    category: "synthesizer_you",
    desc: "Punchy transient kick drum with tape head bump",
    file: "/samples/synthesizer_you/punchy_80s_kick_hit.wav",
    gain: 1.20,
  },
  {
    id: "sy_surf_pluck_c4",
    name: "🎸 Surf Synth Pluck Staccato",
    icon: "🏄",
    category: "synthesizer_you",
    desc: "Single clean surf pluck with spring drip impulse",
    file: "/samples/synthesizer_you/surf_pluck_c4_sample.wav",
    gain: 1.15,
  }
];

class SynthesizerYouSampleEngine {
  constructor() {
    this.buffers = new Map();
    this.loadingPromises = new Map();
    this.activeSources = new Set();
  }

  async loadSample(id) {
    if (this.buffers.has(id)) return this.buffers.get(id);
    if (this.loadingPromises.has(id)) return this.loadingPromises.get(id);

    const def = SYNTHESIZER_YOU_EFFECTS.find(x => x.id === id);
    if (!def) return null;

    const promise = (async () => {
      try {
        const ctx = audioCore.ctx;
        if (!ctx) return null;
        const resp = await fetch(def.file);
        if (!resp.ok) return null;
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        this.buffers.set(id, audioBuf);
        return audioBuf;
      } catch (err) {
        console.warn(`[SynthesizerYou] Load failed for ${id}:`, err);
        return null;
      } finally {
        this.loadingPromises.delete(id);
      }
    })();

    this.loadingPromises.set(id, promise);
    return promise;
  }

  preload() {
    // Non-blocking idle preload in background after page is fully responsive
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => {
        SYNTHESIZER_YOU_EFFECTS.forEach(item => {
          setTimeout(() => this.loadSample(item.id), 200);
        });
      });
    }
  }

  async trigger(id, velocity = 100, customGain = 1.0, destNode = null, pitchMidi = 60) {
    const ctx = audioCore.ctx;
    if (!ctx) return;
    audioCore.ensureRunning();

    let buffer = this.buffers.get(id);
    if (!buffer) {
      buffer = await this.loadSample(id);
    }
    if (!buffer) return;

    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;

      // Pitch shift relative to C4 (60) if played from keyboard (except for full 4-bar groove loop)
      if (typeof pitchMidi === "number" && id !== "sy_groove") {
        const semitoneShift = Math.max(-24, Math.min(24, pitchMidi - 60));
        src.playbackRate.value = Math.pow(2, semitoneShift / 12);
      }

      const gainNode = ctx.createGain();
      const velRatio = Math.max(0.1, Math.min(1.0, velocity / 127));
      const itemDef = SYNTHESIZER_YOU_EFFECTS.find(x => x.id === id);
      const baseGain = itemDef ? itemDef.gain : 1.0;
      const targetVol = baseGain * velRatio * customGain;

      const now = ctx.currentTime;
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(targetVol, now + 0.004);

      src.connect(gainNode);
      const targetDest = destNode || audioCore.masterGain || ctx.destination;
      gainNode.connect(targetDest);

      src.start();
      const voiceObj = { src, gainNode };
      this.activeSources.add(voiceObj);

      src.onended = () => {
        this.activeSources.delete(voiceObj);
        try { src.disconnect(); gainNode.disconnect(); } catch (e) {}
      };

      return voiceObj;
    } catch (e) {
      console.warn(`[SynthesizerYou] Trigger failed for ${id}:`, e);
    }
  }

  stopAll() {
    const ctx = audioCore.ctx;
    const now = ctx ? ctx.currentTime : 0;
    this.activeSources.forEach(voice => {
      try {
        if (voice.gainNode && ctx) {
          voice.gainNode.gain.setTargetAtTime(0.001, now, 0.04);
          setTimeout(() => {
            try { voice.src.stop(); voice.src.disconnect(); voice.gainNode.disconnect(); } catch (e) {}
          }, 60);
        } else {
          voice.src.stop();
          voice.src.disconnect();
        }
      } catch (e) {}
    });
    this.activeSources.clear();
  }
}

export const synthesizerYouEngine = new SynthesizerYouSampleEngine();


