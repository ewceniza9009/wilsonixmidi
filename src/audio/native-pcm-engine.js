/**
 * Native Korg TRITON PCM Multisample Rompler Engine
 * Pre-caches genuine 24-bit multi-samples into RAM AudioBuffers with 0.00ms touch-to-sound latency.
 */

import { KORG_PCM_BANKS } from "./korg-pcm-data.js";
import { ABLETUNES_BANKS } from "./abletunes-manifest.js";
import { SfxSoundGenerator } from "./sfx-sound-generator.js";
import { sampleCache } from "./sample-cache.js";

const NOTE_MAP = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const INST_ALIASES = {
  synthage_grand: "abletunes_upright",
  whitney_ballad: "abletunes_upright",
  ballad_master: "abletunes_upright",
  m1_piano_16: "abletunes_upright",
  abletunes_upright: "abletunes_upright",
  acoustic_grand_piano: "abletunes_upright",
  rhodes_stage_mp3: "electric_piano_1",
  electric_piano_1: "abletunes_fm_piano",
  electric_piano_2: "electric_piano_2",
  tri_stage_ep: "electric_piano_2",
  dx7_ep1: "electric_piano_2",
  triton_dyno_ep: "abletunes_fm_piano",
  abletunes_fm_piano: "abletunes_fm_piano",
  abletunes_fm_dx7: "abletunes_fm_piano",
  m1_fresh_air: "abletunes_fm_piano",
  distortion_guitar: "distortion_guitar",
  overdriven_guitar: "overdriven_guitar",
  electric_guitar_clean: "electric_guitar_clean",
  acoustic_guitar_nylon: "acoustic_guitar_nylon",
  fantom_nylon_pluck: "acoustic_guitar_nylon",
  drawbar_organ: "drawbar_organ",
  m1_rock_organ: "drawbar_organ",
  m1_organ_2: "drawbar_organ",
  synth_bass_1: "synth_bass_1",
  moog_punch_bass: "synth_bass_1",
  m1_slap_bass: "synth_bass_1",
  choir_aahs: "choir_aahs",
  voice_oohs: "voice_oohs",
  m1_choir: "choir_aahs",
  m1_ooh_ahh: "choir_aahs",
  ooh_ahh: "choir_aahs",
  choir: "choir_aahs",
  choral: "choir_aahs",
  cathedral_choir: "choir_aahs",
  angelic_oohs: "choir_aahs",
  vocal_breath: "breath_noise",
  breath_noise: "breath_noise",
  applause: "applause",
  concert_applause: "applause",
  stadium_roar: "applause",
  crowd_cheer: "applause",
  ovation: "applause",
  vox_applause: "applause",
  vox_crowd_cheer: "dj_cheer_r",
  vox_yeah: "vox_yeah_r",
  vox_yeah_r: "vox_yeah_r",
  vox_hey: "vox_hey_r",
  vox_hey_r: "vox_hey_r",
  vox_sigh: "vox_sigh_r",
  vox_sigh_r: "vox_sigh_r",
  vox_whoa: "voice_oohs",
  vox_ohyeah: "voice_oohs",
  vox_whisper: "breath_noise",
  vox_hum: "voice_oohs",
  vox_beatbox: "drum_kick_r",
  angelic_choir: "choir_aahs",
  tubular_bells: "tubular_bells",
  wind_chimes: "wind_chimes",
  crystal_chimes: "crystal_chimes",
  dj_scratch_r: "dj_scratch_r",
  dj_partyhorn_r: "dj_partyhorn_r",
  dj_siren_r: "dj_siren_r",
  dj_whistle_r: "dj_whistle_r",
  seashore: "seashore",
  ocean_waves: "seashore",
  nature_ocean: "seashore",
  bird_tweet: "bird_tweet",
  forest_birds: "bird_tweet",
  nature_birds: "bird_tweet",
  nature_thunder: "thunder_clap",
  nature_rain: "thunder_storm",
  nature_wind: "breath_noise",
  nature_fire: "breath_noise",
  nature_stream: "seashore",
  nature_crickets: "bird_tweet",
  nature_waterfall: "seashore",
  fx_laser: "fx_laser_r",
  fx_alien: "fx_ghost_r",
  fx_bionic: "fx_robot_r",
  fx_warpdrive: "fx_ufo_r",
  fx_robot: "fx_robot_r",
  fx_plasma: "fx_laser_r",
  fx_cyber_sweep: "fx_mystic_r",
  fx_sub_resonator: "fx_boom_r",
  fx_scratch: "dj_scratch_r",
  fx_tapestop: "fx_static_r",
  fx_subboom: "fx_boom_r",
  fx_sub_boom: "fx_boom_r",
  fx_airhorn: "dj_partyhorn_r",
  fx_cinema_braam: "fx_boom_r",
  fx_downlifter: "fx_ghost_r",
  fx_rev_cymbal: "drum_crash_r",
  fx_sub_drop: "fx_boom_r",
  fx_vinyl_crackle: "fx_static_r",
  dub_siren: "dj_siren_r",
  reggae_siren: "dj_siren_r",
  spring_splash: "drum_crash_r",
  dub_splash: "drum_crash_r",
  laser_zap: "fx_laser_r",
  dub_laser: "fx_laser_r",
  dub_horn: "dj_partyhorn_r",
  airhorn: "dj_partyhorn_r",
  sub_boom: "fx_boom_r",
  sub_drop: "fx_boom_r",
  "808_boom": "fx_boom_r",
  noise_riser: "fx_mystic_r",
  sweep_riser: "fx_mystic_r",
  taiko_drum: "taiko_drum",
  thunder_taiko: "taiko_drum",
  percussion_taiko: "taiko_drum",
  synth_drum: "synth_drum",
  gunshot: "gunshot",
  string_ensemble_1: "string_ensemble_1",
  triton_warm_strings: "string_ensemble_1",
  symphonic_strings: "string_ensemble_1",
  m1_symphonic: "string_ensemble_1",
  m1_strings: "string_ensemble_1",
  m1_universe: "string_ensemble_1",
  brass_section: "brass_section",
  fat_brass_horns: "brass_section",
  supersaw_lead: "brass_section",
  m1_brass_1: "brass_section",
  brass_1: "brass_section",
  alto_sax: "tenor_sax",
  breathy_alto_sax: "tenor_sax",
  sax_genuine_solo: "tenor_sax",
  sax_solo: "tenor_sax",
  sax_alto_lead: "tenor_sax",
  sax_funk_stab: "tenor_sax",
  sax_fall: "tenor_sax",
  sax_scoop: "tenor_sax",
  tenor_sax: "tenor_sax",
  sax_sensual: "tenor_sax",
  sax_blues_growl: "tenor_sax",
  sax_tenor_blues: "tenor_sax",
  soprano_sax: "soprano_sax",
  sax_soprano: "soprano_sax",
  m1_lore: "tenor_sax",
  m1_flute: "flute",
  m1_pan_flute: "flute",
  pan_flute: "flute",
  m1_guitar_1: "acoustic_guitar_steel",
  guitar_1: "acoustic_guitar_steel",
  m1_12string: "acoustic_guitar_steel",
  string_12: "acoustic_guitar_steel",
  m1_fretless: "acoustic_bass",
  fretless: "acoustic_bass",
  m1_bottle_bell: "vibraphone",
  bottle_bell: "vibraphone",
  m1_kalimba: "kalimba",
  kalimba: "kalimba",
  m1_koto: "harpsichord",
  koto: "harpsichord",
  m1_bell_ring: "vibraphone",
  bell_ring: "vibraphone",
  m1_pick_bass: "slap_bass_1",
  pick_bass: "slap_bass_1",
  m1_synth_bass_1: "synth_bass_1",
  m1_solo_synth: "brass_section",
};

const INST_TRIM_GAINS = {
  acoustic_grand_piano: 1.0,
  abletunes_upright: 1.0,
  m1_piano_16: 1.0,
  electric_piano_1: 1.0,
  abletunes_fm_piano: 1.0,
  string_ensemble_1: 1.0,
  m1_universe: 1.0,
  m1_choir: 1.0,
  choir_aahs: 1.0,
  acoustic_guitar_nylon: 1.0,
  electric_guitar_clean: 1.0,
  alto_sax: 1.0,
  brass_section: 1.0,
  drawbar_organ: 1.0,
  synth_bass_1: 1.0,
  m1_slap_bass: 1.0,
  distortion_guitar: 1.0,
  overdriven_guitar: 1.0,
  trumpet: 1.0,
  trombone: 1.0,
  tenor_sax: 1.0,
  flute: 1.0,
  clarinet: 1.0,
  violin: 1.0,
  cello: 1.0,
  church_organ: 1.0,
  vibraphone: 1.0,
  electric_piano_2: 1.0,
  acoustic_bass: 1.0,
  soprano_sax: 1.0,
  muted_trumpet: 1.0,
  acoustic_guitar_steel: 1.0,
  slap_bass_1: 1.0,
  rock_organ: 1.0,
  harpsichord: 1.0,
};

export function noteNameToMidi(noteStr) {
  const match = noteStr.match(/^([A-G][b#]?)([0-9])$/);
  if (!match) return null;
  const name = match[1];
  const oct = parseInt(match[2]);
  return (oct + 1) * 12 + NOTE_MAP[name];
}

export const LAYER_FX_OPTIONS = {
  spring_surf: {
    id: "spring_surf",
    name: "🏄 Spring Reverb (Surf Foundation Drip)",
    category: "Synthesizer You FX",
  },
  analog_juno_chorus: {
    id: "analog_juno_chorus",
    name: "🎹 Roland Juno Chorus (Synth Core)",
    category: "Synthesizer You FX",
  },
  slapback_vocal: {
    id: "slapback_vocal",
    name: "🎤 Slapback Tape Delay (Vocal Punch)",
    category: "Synthesizer You FX",
  },
  gated_cannon: {
    id: "gated_cannon",
    name: "💥 80s Gated Reverb (Snare Cannon)",
    category: "Synthesizer You FX",
  },
  opto_tremolo_16th: {
    id: "opto_tremolo_16th",
    name: "⚡ Optical Tremolo (16th Groove Sync)",
    category: "Synthesizer You FX",
  },
  tape_sat_master: {
    id: "tape_sat_master",
    name: "📼 Master Bus Tape Saturation & Glue",
    category: "Synthesizer You FX",
  },
  clean: { id: "clean", name: "Direct Clean (Dry Bypass)", category: "Clean" },
  chorus_lush: {
    id: "chorus_lush",
    name: "Dimension D Stereo Chorus",
    category: "Modulation",
  },
  chorus_vintage: {
    id: "chorus_vintage",
    name: "Analog Warm Ensemble",
    category: "Modulation",
  },
  autopan_wide: {
    id: "autopan_wide",
    name: "1973 Suitcase Auto-Pan",
    category: "Modulation",
  },
  autopan_fast: {
    id: "autopan_fast",
    name: "Fast Stereo Panning",
    category: "Modulation",
  },
  rotary_fast: {
    id: "rotary_fast",
    name: "Leslie 122 Rotary (Fast)",
    category: "Modulation",
  },
  rotary_slow: {
    id: "rotary_slow",
    name: "Leslie 122 Rotary (Chorale)",
    category: "Modulation",
  },
  phaser_6stage: {
    id: "phaser_6stage",
    name: "Analog 6-Stage Phaser",
    category: "Modulation",
  },
  phaser_deep: {
    id: "phaser_deep",
    name: "Deep Jet Sweep Phaser",
    category: "Modulation",
  },
  flanger_stereo: {
    id: "flanger_stereo",
    name: "Stereo Tape Flanger",
    category: "Modulation",
  },
  tremolo_pulse: {
    id: "tremolo_pulse",
    name: "Opto-Tremolo Pulse",
    category: "Modulation",
  },
  supersaw_unison: {
    id: "supersaw_unison",
    name: "Supersaw Unison Detune",
    category: "Modulation",
  },
  delay_tape: {
    id: "delay_tape",
    name: "Ping-Pong Tape Delay",
    category: "Delay & Reverb",
  },
  delay_dub: {
    id: "delay_dub",
    name: "Space Dub Echo (Dotted 8th)",
    category: "Delay & Reverb",
  },
  trance_delay: {
    id: "trance_delay",
    name: "Trance Ping-Pong (1/8 Dotted)",
    category: "Delay & Reverb",
  },
  reverb_hall: {
    id: "reverb_hall",
    name: "Cathedral Ambient Reverb",
    category: "Delay & Reverb",
  },
  reverb_plate: {
    id: "reverb_plate",
    name: "Studio Plate Reverb",
    category: "Delay & Reverb",
  },
  reverb_room: {
    id: "reverb_room",
    name: "Warm Acoustic Room Reverb",
    category: "Delay & Reverb",
  },
  tube_warm: {
    id: "tube_warm",
    name: "12AX7 Tube Saturation",
    category: "Drive & EQ",
  },
  tube_lead: {
    id: "tube_lead",
    name: "Screaming Tube Overdrive",
    category: "Drive & EQ",
  },
  distortion_metal: {
    id: "distortion_metal",
    name: "High-Gain Distortion",
    category: "Drive & EQ",
  },
  shred_stack: {
    id: "shred_stack",
    name: "Shreddage High-Gain Stack",
    category: "Drive & EQ",
  },
  air_eq: {
    id: "air_eq",
    name: "Air & Presence EQ (+4dB Treble)",
    category: "Drive & EQ",
  },
  warm_eq: {
    id: "warm_eq",
    name: "Warm Vintage EQ (+3dB Bass)",
    category: "Drive & EQ",
  },
  punch_comp: {
    id: "punch_comp",
    name: "Punch Limiter / Compressor",
    category: "Dynamics & Special",
  },
  lofi_vinyl: {
    id: "lofi_vinyl",
    name: "Lo-Fi Vintage Vinyl / Warmth",
    category: "Dynamics & Special",
  },
  tape_lowpass: {
    id: "tape_lowpass",
    name: "Tape Lowpass (Warm HF Rolloff)",
    category: "Dynamics & Special",
  },
  trance_gate: {
    id: "trance_gate",
    name: "Trance Gate (Rhythmic Slicer)",
    category: "Dynamics & Special",
  },
  sidechain_pump: {
    id: "sidechain_pump",
    name: "Sidechain Pump (Ducking)",
    category: "Dynamics & Special",
  },
};

export class LayerInsertProcessor {
  constructor(ctx, destinationNode) {
    this.ctx = ctx;
    this.destination = destinationNode;
    this.input = ctx.createGain();
    this.currentFx = "clean";

    this.input.channelCount = 2;
    this.input.channelCountMode = "explicit";
    this.input.channelInterpretation = "speakers";

    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain.gain.value = 1.0;
    this.wetGain.gain.value = 0.0;

    this.effectChainInput = ctx.createGain();
    this.effectChainOutput = ctx.createGain();

    this.dryGain.channelCount = 2;
    this.dryGain.channelCountMode = "explicit";
    this.dryGain.channelInterpretation = "speakers";

    this.wetGain.channelCount = 2;
    this.wetGain.channelCountMode = "explicit";
    this.wetGain.channelInterpretation = "speakers";

    this.effectChainOutput.channelCount = 2;
    this.effectChainOutput.channelCountMode = "explicit";
    this.effectChainOutput.channelInterpretation = "speakers";

    this.input.connect(this.dryGain);
    this.dryGain.connect(this.destination);

    this.input.connect(this.effectChainInput);
    this.effectChainOutput.connect(this.wetGain);
    this.wetGain.connect(this.destination);

    this.activeFxNodes = [];
    this.engine = null;
    this.sustainActive = false;
    this.sustainedVoices = new Set();
    this.setEffect("clean");
  }

  setSustain(isDown) {
    this.sustainActive = !!isDown;
    if (!this.sustainActive) {
      const now = this.ctx.currentTime;
      this.sustainedVoices.forEach((v) => {
        try {
          v.voiceGain.gain.cancelScheduledValues(now);
          v.voiceGain.gain.setTargetAtTime(0, now, 0.06);
          v.src.stop(now + 0.25);
        } catch (e) {}
        if (this.engine) this.engine.removeVoice(v.midiNote, v);
      });
      this.sustainedVoices.clear();
    }
  }

  flush() {
    try {
      const now = this.ctx.currentTime;
      this.sustainedVoices?.forEach((v) => {
        try {
          v.voiceGain.gain.cancelScheduledValues(now);
          v.voiceGain.gain.setTargetAtTime(0, now, 0.01);
          v.src.stop(now + 0.05);
        } catch (e) {}
      });
      this.sustainedVoices?.clear();

      this.wetGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.wetGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.activeFxNodes.forEach((node) => {
        try {
          if (node.gain && node.gain.cancelScheduledValues) {
            node.gain.cancelScheduledValues(this.ctx.currentTime);
            node.gain.setValueAtTime(0, this.ctx.currentTime);
          }
        } catch (e) {}
      });
    } catch (e) {}
  }

  setEffect(fxType) {
    this.currentFx = fxType || "clean";
    const ctx = this.ctx;

    this.wetGain.gain.cancelScheduledValues(ctx.currentTime);
    this.wetGain.gain.setValueAtTime(0, ctx.currentTime);

    try {
      this.effectChainInput.disconnect();
      this.activeFxNodes.forEach((node) => {
        try {
          if (node.stop) node.stop();
          node.disconnect();
        } catch (e) {}
      });
      this.activeFxNodes = [];
    } catch (e) {}

    if (this.currentFx === "clean") {
      this.dryGain.gain.setValueAtTime(1.0, ctx.currentTime);
      this.wetGain.gain.setValueAtTime(0.0, ctx.currentTime);
      return;
    }

    const isSerialInsert = [
      "air_eq",
      "warm_eq",
      "punch_comp",
      "tube_warm",
      "tube_lead",
      "distortion_metal",
      "lofi_vinyl",
      "tape_lowpass",
      "trance_delay",
      "shred_stack",
    ].includes(this.currentFx);

    const WET_BLEND = {
      chorus_lush: 0.34,
      chorus_vintage: 0.3,
      analog_juno_chorus: 0.3,
      reverb_hall: 0.34,
      reverb_plate: 0.28,
      reverb_room: 0.24,
      delay_tape: 0.24,
      delay_dub: 0.24,
    };

    if (isSerialInsert) {
      this.dryGain.gain.setValueAtTime(0.0, ctx.currentTime);
      this.wetGain.gain.setValueAtTime(1.0, ctx.currentTime);
    } else {
      this.dryGain.gain.setValueAtTime(1.0, ctx.currentTime);
      this.wetGain.gain.setValueAtTime(
        WET_BLEND[this.currentFx] ?? 0.15,
        ctx.currentTime,
      );
    }

    switch (this.currentFx) {
      case "chorus_lush":
      case "chorus_vintage": {
        const isLush = this.currentFx === "chorus_lush";
        const delayL = ctx.createDelay(0.1);
        const delayR = ctx.createDelay(0.1);
        delayL.delayTime.value = isLush ? 0.022 : 0.019;
        delayR.delayTime.value = isLush ? 0.026 : 0.023;
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = isLush ? 0.65 : 0.5;
        const lfoGainL = ctx.createGain();
        const lfoGainR = ctx.createGain();
        const depth = isLush ? 0.0028 : 0.0022;
        lfoGainL.gain.value = depth;
        lfoGainR.gain.value = depth * 0.78;
        lfo.connect(lfoGainL);
        lfo.connect(lfoGainR);
        lfoGainL.connect(delayL.delayTime);
        lfoGainR.connect(delayR.delayTime);
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 120;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 8500;
        this.effectChainInput.connect(hp);
        hp.connect(lp);
        lp.connect(delayL);
        lp.connect(delayR);
        const merger = ctx.createChannelMerger(2);
        delayL.connect(merger, 0, 0);
        delayR.connect(merger, 0, 1);
        merger.connect(this.effectChainOutput);
        lfo.start();
        this.activeFxNodes.push(
          delayL,
          delayR,
          lfo,
          lfoGainL,
          lfoGainR,
          hp,
          lp,
          merger,
        );
        break;
      }
      case "autopan_wide":
      case "autopan_fast": {
        const panner = ctx.createStereoPanner
          ? ctx.createStereoPanner()
          : ctx.createGain();
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = this.currentFx === "autopan_fast" ? 2.5 : 1.2;
        if (ctx.createStereoPanner) {
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 0.25;
          lfo.connect(lfoGain);
          lfoGain.connect(panner.pan);
          lfo.start();
          this.activeFxNodes.push(panner, lfo, lfoGain);
        }
        this.effectChainInput.connect(panner);
        panner.connect(this.effectChainOutput);
        break;
      }
      case "rotary_fast":
      case "rotary_slow": {
        const filter = ctx.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = 850;
        filter.Q.value = 1.0;
        filter.gain.value = 1.4;
        const panner = ctx.createStereoPanner
          ? ctx.createStereoPanner()
          : ctx.createGain();
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = this.currentFx === "rotary_fast" ? 4.2 : 0.9;
        if (ctx.createStereoPanner) {
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 0.15;
          lfo.connect(lfoGain);
          lfoGain.connect(panner.pan);
          lfo.start();
          this.activeFxNodes.push(lfo, lfoGain);
        }
        this.effectChainInput.connect(filter);
        filter.connect(panner);
        panner.connect(this.effectChainOutput);
        this.activeFxNodes.push(filter, panner);
        break;
      }
      case "tube_warm":
      case "tube_lead": {
        const shaper = ctx.createWaveShaper();
        const drive = this.currentFx === "tube_lead" ? 0.7 : 0.35;
        const n_samples = 4096;
        const curve = new Float32Array(n_samples);
        const k = 1.0 + drive * 3.5;
        for (let i = 0; i < n_samples; ++i) {
          const x = (i * 2) / n_samples - 1;
          curve[i] = Math.tanh(x * k) * 0.85;
        }
        shaper.curve = curve;
        shaper.oversample = "4x";
        const cab = ctx.createBiquadFilter();
        cab.type = "lowpass";
        cab.frequency.value = this.currentFx === "tube_lead" ? 4200 : 6500;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 80;
        this.effectChainInput.connect(hp);
        hp.connect(shaper);
        shaper.connect(cab);
        cab.connect(this.effectChainOutput);
        this.activeFxNodes.push(hp, shaper, cab);
        break;
      }
      case "distortion_metal": {
        const dist = ctx.createWaveShaper();
        const n_samples = 4096;
        const curve = new Float32Array(n_samples);
        for (let i = 0; i < n_samples; ++i) {
          const x = (i * 2) / n_samples - 1;
          curve[i] = Math.tanh(x * 3.6) * 0.8;
        }
        dist.curve = curve;
        dist.oversample = "4x";
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 90;
        const cab = ctx.createBiquadFilter();
        cab.type = "lowpass";
        cab.frequency.value = 3800;
        this.effectChainInput.connect(hp);
        hp.connect(dist);
        dist.connect(cab);
        cab.connect(this.effectChainOutput);
        this.activeFxNodes.push(hp, dist, cab);
        break;
      }
      case "shred_stack": {
        const dc = ctx.createBiquadFilter();
        dc.type = "highpass";
        dc.frequency.value = 80;
        const scream = ctx.createBiquadFilter();
        scream.type = "peaking";
        scream.frequency.value = 2800;
        scream.Q.value = 1.0;
        scream.gain.value = 6.0;
        const shred = ctx.createWaveShaper();
        const n_samples = 4096;
        const curve = new Float32Array(n_samples);
        for (let i = 0; i < n_samples; ++i) {
          const x = (i * 2) / n_samples - 1;
          curve[i] = Math.tanh(x * 4.2) * 0.78;
        }
        shred.curve = curve;
        shred.oversample = "4x";
        const tight = ctx.createBiquadFilter();
        tight.type = "highpass";
        tight.frequency.value = 110;
        const cab = ctx.createBiquadFilter();
        cab.type = "lowpass";
        cab.frequency.value = 3600;
        this.effectChainInput.connect(dc);
        dc.connect(scream);
        scream.connect(shred);
        shred.connect(tight);
        tight.connect(cab);
        cab.connect(this.effectChainOutput);
        this.activeFxNodes.push(dc, scream, shred, tight, cab);
        break;
      }
      case "phaser_6stage":
      case "phaser_deep": {
        const ap1 = ctx.createBiquadFilter();
        ap1.type = "allpass";
        ap1.frequency.value = 900;
        ap1.Q.value = 0.7;
        const ap2 = ctx.createBiquadFilter();
        ap2.type = "allpass";
        ap2.frequency.value = 1800;
        ap2.Q.value = 0.7;
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = this.currentFx === "phaser_deep" ? 0.35 : 0.8;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 300;
        lfo.connect(lfoGain);
        lfoGain.connect(ap1.frequency);
        lfoGain.connect(ap2.frequency);
        lfo.start();
        this.effectChainInput.connect(ap1);
        ap1.connect(ap2);
        ap2.connect(this.effectChainOutput);
        this.activeFxNodes.push(ap1, ap2, lfo, lfoGain);
        break;
      }
      case "flanger_stereo": {
        const delay = ctx.createDelay(0.05);
        delay.delayTime.value = 0.0035;
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 0.45;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.0018;
        lfo.connect(lfoGain);
        lfoGain.connect(delay.delayTime);
        lfo.start();
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 140;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 4500;
        const fbDcBlock = ctx.createBiquadFilter();
        fbDcBlock.type = "highpass";
        fbDcBlock.frequency.value = 80;
        const feedback = ctx.createGain();
        feedback.gain.value = 0.22;
        this.effectChainInput.connect(hp);
        hp.connect(delay);
        delay.connect(lp);
        lp.connect(fbDcBlock);
        fbDcBlock.connect(feedback);
        feedback.connect(delay);
        lp.connect(this.effectChainOutput);
        this.activeFxNodes.push(
          delay,
          lfo,
          lfoGain,
          hp,
          lp,
          fbDcBlock,
          feedback,
        );
        break;
      }
      case "delay_tape":
      case "delay_dub": {
        const delayL = ctx.createDelay(2.0);
        const delayR = ctx.createDelay(2.0);
        const dt = this.currentFx === "delay_dub" ? 0.42 : 0.28;
        delayL.delayTime.value = dt;
        delayR.delayTime.value = dt * 1.333;
        const fbDcL = ctx.createBiquadFilter();
        fbDcL.type = "highpass";
        fbDcL.frequency.value = 80;
        const fbDcR = ctx.createBiquadFilter();
        fbDcR.type = "highpass";
        fbDcR.frequency.value = 80;
        const feedbackL = ctx.createGain();
        const feedbackR = ctx.createGain();
        const fb = this.currentFx === "delay_dub" ? 0.38 : 0.3;
        feedbackL.gain.value = fb;
        feedbackR.gain.value = fb;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 140;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 3200;
        this.effectChainInput.connect(hp);
        hp.connect(lp);
        lp.connect(delayL);
        lp.connect(delayR);
        delayL.connect(fbDcL);
        fbDcL.connect(feedbackL);
        feedbackL.connect(delayL);
        delayR.connect(fbDcR);
        fbDcR.connect(feedbackR);
        feedbackR.connect(delayR);
        const merger = ctx.createChannelMerger(2);
        delayL.connect(merger, 0, 0);
        delayR.connect(merger, 0, 1);
        merger.connect(this.effectChainOutput);
        this.activeFxNodes.push(
          delayL,
          delayR,
          hp,
          lp,
          fbDcL,
          fbDcR,
          feedbackL,
          feedbackR,
          merger,
        );
        break;
      }
      case "reverb_hall":
      case "reverb_plate":
      case "reverb_room": {
        const isHall = this.currentFx === "reverb_hall";
        const isPlate = this.currentFx === "reverb_plate";
        const dampHz = isPlate ? 7000 : isHall ? 5000 : 4200;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 150;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = dampHz;
        this.effectChainInput.connect(hp);
        hp.connect(lp);
        const tapsL = isHall
          ? [0.023, 0.045, 0.078, 0.112]
          : [0.016, 0.032, 0.054, 0.082];
        const tapsR = isHall
          ? [0.029, 0.052, 0.086, 0.125]
          : [0.021, 0.039, 0.063, 0.095];
        const weights = [0.45, 0.35, 0.25, 0.15];
        const sumL = ctx.createGain();
        const sumR = ctx.createGain();
        sumL.gain.value = 0.5;
        sumR.gain.value = 0.5;
        const nodes = [hp, lp, sumL, sumR];
        for (let i = 0; i < tapsL.length; i++) {
          const dL = ctx.createDelay(0.3);
          dL.delayTime.value = tapsL[i];
          const gL = ctx.createGain();
          gL.gain.value = weights[i];
          lp.connect(dL);
          dL.connect(gL);
          gL.connect(sumL);
          const dR = ctx.createDelay(0.3);
          dR.delayTime.value = tapsR[i];
          const gR = ctx.createGain();
          gR.gain.value = weights[i];
          lp.connect(dR);
          dR.connect(gR);
          gR.connect(sumR);
          nodes.push(dL, dR, gL, gR);
        }
        const apL = ctx.createBiquadFilter();
        apL.type = "allpass";
        apL.frequency.value = 1800;
        apL.Q.value = 0.7;
        sumL.connect(apL);
        const apR = ctx.createBiquadFilter();
        apR.type = "allpass";
        apR.frequency.value = 2200;
        apR.Q.value = 0.7;
        sumR.connect(apR);
        const merger = ctx.createChannelMerger(2);
        apL.connect(merger, 0, 0);
        apR.connect(merger, 0, 1);
        merger.connect(this.effectChainOutput);
        nodes.push(apL, apR, merger);
        this.activeFxNodes.push(...nodes);
        break;
      }
      case "air_eq": {
        const eq = ctx.createBiquadFilter();
        eq.type = "highshelf";
        eq.frequency.value = 4500;
        eq.gain.value = 3.5;
        this.effectChainInput.connect(eq);
        eq.connect(this.effectChainOutput);
        this.activeFxNodes.push(eq);
        break;
      }
      case "warm_eq": {
        const low = ctx.createBiquadFilter();
        low.type = "lowshelf";
        low.frequency.value = 180;
        low.gain.value = 1.0;
        const high = ctx.createBiquadFilter();
        high.type = "lowpass";
        high.frequency.value = 7500;
        this.effectChainInput.connect(low);
        low.connect(high);
        high.connect(this.effectChainOutput);
        this.activeFxNodes.push(low, high);
        break;
      }
      case "punch_comp": {
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16.0;
        comp.knee.value = 8.0;
        comp.ratio.value = 2.8;
        comp.attack.value = 0.012;
        comp.release.value = 0.14;
        this.effectChainInput.connect(comp);
        comp.connect(this.effectChainOutput);
        this.activeFxNodes.push(comp);
        break;
      }
      case "lofi_vinyl": {
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 220;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 3800;
        this.effectChainInput.connect(hp);
        hp.connect(lp);
        lp.connect(this.effectChainOutput);
        this.activeFxNodes.push(hp, lp);
        break;
      }
      case "tape_lowpass": {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 6500;
        lp.Q.value = 0.7;
        this.effectChainInput.connect(lp);
        lp.connect(this.effectChainOutput);
        this.activeFxNodes.push(lp);
        break;
      }
      case "trance_gate": {
        // The old base=1.0 + square LFO ±1.0 produced a gain sweep of 0↔2 — the
        // "open" half of the gate amplified by 2×, clipping into the limiter.
        // Use 0.5 ± 0.5 so the swing is a clean 0→1.
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.5;
        const lfo = ctx.createOscillator();
        lfo.type = "square";
        lfo.frequency.value = 4.0;
        const gateGain = ctx.createGain();
        gateGain.gain.value = 0.5;
        lfo.connect(gateGain);
        gateGain.connect(gainNode.gain);
        lfo.start();
        this.effectChainInput.connect(gainNode);
        gainNode.connect(this.effectChainOutput);
        this.activeFxNodes.push(gainNode, lfo, gateGain);
        break;
      }
      case "sidechain_pump": {
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1.0;
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 2.0;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.4;
        lfo.connect(lfoGain);
        lfoGain.connect(gainNode.gain);
        lfo.start();
        this.effectChainInput.connect(gainNode);
        gainNode.connect(this.effectChainOutput);
        this.activeFxNodes.push(gainNode, lfo, lfoGain);
        break;
      }
      case "trance_delay": {
        const delayL = ctx.createDelay(1.0);
        delayL.delayTime.value = 0.375;
        const delayR = ctx.createDelay(1.0);
        delayR.delayTime.value = 0.5625;
        const fbL = ctx.createGain();
        fbL.gain.value = 0.55;
        const fbR = ctx.createGain();
        fbR.gain.value = 0.55;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 5500;
        const dcL = ctx.createBiquadFilter();
        dcL.type = "highpass";
        dcL.frequency.value = 60;
        const dcR = ctx.createBiquadFilter();
        dcR.type = "highpass";
        dcR.frequency.value = 60;
        const merger = ctx.createChannelMerger(2);
        this.effectChainInput.connect(filter);
        filter.connect(delayL);
        filter.connect(delayR);
        delayL.connect(fbL);
        fbL.connect(dcL);
        dcL.connect(delayL);
        delayR.connect(fbR);
        fbR.connect(dcR);
        dcR.connect(delayR);
        delayL.connect(merger, 0, 0);
        delayR.connect(merger, 0, 1);
        merger.connect(this.effectChainOutput);
        this.activeFxNodes.push(
          delayL,
          delayR,
          fbL,
          fbR,
          filter,
          dcL,
          dcR,
          merger,
        );
        break;
      }
      case "supersaw_unison": {
        const delays = [];
        const detunes = [-0.08, -0.04, 0.0, 0.04, 0.08];
        for (const d of detunes) {
          const del = ctx.createDelay(0.1);
          del.delayTime.value = 0.012 + Math.abs(d) * 0.005;
          const pitchLfo = ctx.createOscillator();
          pitchLfo.type = "sine";
          pitchLfo.frequency.value = 0.3 + Math.abs(d) * 2;
          const pitchGain = ctx.createGain();
          pitchGain.gain.value = 0.0003;
          pitchLfo.connect(pitchGain);
          pitchGain.connect(del.delayTime);
          const g = ctx.createGain();
          g.gain.value = 0.2;
          this.effectChainInput.connect(del);
          del.connect(g);
          g.connect(this.effectChainOutput);
          pitchLfo.start();
          delays.push(del, pitchLfo, pitchGain, g);
        }
        this.activeFxNodes.push(...delays);
        break;
      }
      case "tremolo_pulse": {
        const gainNode = ctx.createGain();
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 3.8;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.35;
        lfo.connect(lfoGain);
        lfoGain.connect(gainNode.gain);
        lfo.start();
        this.effectChainInput.connect(gainNode);
        gainNode.connect(this.effectChainOutput);
        this.activeFxNodes.push(gainNode, lfo, lfoGain);
        break;
      }
      case "spring_surf": {
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 220;
        const drip = ctx.createBiquadFilter();
        drip.type = "peaking";
        drip.frequency.value = 3400;
        drip.Q.value = 2.5;
        drip.gain.value = 5.0;
        const d1 = ctx.createDelay(0.2);
        d1.delayTime.value = 0.038;
        const fb1 = ctx.createGain();
        fb1.gain.value = 0.45;
        this.effectChainInput.connect(hp);
        hp.connect(drip);
        drip.connect(d1);
        d1.connect(fb1);
        fb1.connect(d1);
        d1.connect(this.effectChainOutput);
        this.activeFxNodes.push(hp, drip, d1, fb1);
        break;
      }
      case "slapback_vocal": {
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 160;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 3400;
        const slap = ctx.createDelay(0.3);
        slap.delayTime.value = 0.095;
        this.effectChainInput.connect(hp);
        hp.connect(lp);
        lp.connect(slap);
        slap.connect(this.effectChainOutput);
        this.activeFxNodes.push(hp, lp, slap);
        break;
      }
      case "gated_cannon": {
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 180;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 7500;
        const d1 = ctx.createDelay(0.3);
        d1.delayTime.value = 0.045;
        const d2 = ctx.createDelay(0.3);
        d2.delayTime.value = 0.085;
        const d3 = ctx.createDelay(0.3);
        d3.delayTime.value = 0.14;
        this.effectChainInput.connect(hp);
        hp.connect(lp);
        lp.connect(d1);
        lp.connect(d2);
        lp.connect(d3);
        d1.connect(this.effectChainOutput);
        d2.connect(this.effectChainOutput);
        d3.connect(this.effectChainOutput);
        this.activeFxNodes.push(hp, lp, d1, d2, d3);
        break;
      }
      case "tape_sat_master": {
        const bump = ctx.createBiquadFilter();
        bump.type = "peaking";
        bump.frequency.value = 65;
        bump.gain.value = 1.5;
        bump.Q.value = 0.9;
        const shaper = ctx.createWaveShaper();
        shaper.oversample = "4x";
        const n = 2048;
        const curve = new Float32Array(n);
        const k = 2.2;
        for (let i = 0; i < n; i++) {
          const x = (i * 2) / n - 1;
          curve[i] = Math.tanh(k * x) / Math.tanh(k);
        }
        shaper.curve = curve;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 14500;
        this.effectChainInput.connect(bump);
        bump.connect(shaper);
        shaper.connect(lp);
        lp.connect(this.effectChainOutput);
        this.activeFxNodes.push(bump, shaper, lp);
        break;
      }
      case "analog_juno_chorus": {
        const delayL = ctx.createDelay(0.1);
        const delayR = ctx.createDelay(0.1);
        delayL.delayTime.value = 0.022;
        delayR.delayTime.value = 0.027;
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 0.75;
        const lfoGainL = ctx.createGain();
        const lfoGainR = ctx.createGain();
        lfoGainL.gain.value = 0.0006;
        lfoGainR.gain.value = 0.0005;
        lfo.connect(lfoGainL);
        lfo.connect(lfoGainR);
        lfoGainL.connect(delayL.delayTime);
        lfoGainR.connect(delayR.delayTime);
        this.effectChainInput.connect(delayL);
        this.effectChainInput.connect(delayR);
        const merger = ctx.createChannelMerger(2);
        delayL.connect(merger, 0, 0);
        delayR.connect(merger, 0, 1);
        merger.connect(this.effectChainOutput);
        lfo.start();
        this.activeFxNodes.push(
          delayL,
          delayR,
          lfo,
          lfoGainL,
          lfoGainR,
          merger,
        );
        break;
      }
      case "opto_tremolo_16th": {
        const gainNode = ctx.createGain();
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 5.5;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.25;
        lfo.connect(lfoGain);
        lfoGain.connect(gainNode.gain);
        lfo.start();
        this.effectChainInput.connect(gainNode);
        gainNode.connect(this.effectChainOutput);
        this.activeFxNodes.push(gainNode, lfo, lfoGain);
        break;
      }
      default:
        this.effectChainInput.connect(this.effectChainOutput);
        break;
    }
  }
}

export class NativePcmEngine {
  constructor(ctx, destinationNode) {
    this.ctx = ctx;
    this.destination = destinationNode;
    this.sfxGenerator = new SfxSoundGenerator(ctx, destinationNode);

    this.layerInserts = [
      new LayerInsertProcessor(ctx, destinationNode),
      new LayerInsertProcessor(ctx, destinationNode),
      new LayerInsertProcessor(ctx, destinationNode),
      new LayerInsertProcessor(ctx, destinationNode),
    ];

    this.splitZoneInserts = {
      lower: new LayerInsertProcessor(ctx, destinationNode),
      upper: new LayerInsertProcessor(ctx, destinationNode),
    };

    this.looperInserts = [];
    for (let t = 0; t < 4; t++) {
      const trackBuses = [];
      for (let l = 0; l < 4; l++) {
        const bus = new LayerInsertProcessor(ctx, destinationNode);
        bus.engine = this;
        trackBuses.push(bus);
      }
      this.looperInserts.push(trackBuses);
    }

    this.decodedBuffers = new Map();
    this.activeVoices = new Map();
    this.sustainedVoices = new Map();

    this.sustainPedal = false;
    this.pitchBendSemitones = 0;
    this.modWheelAmount = 0;

    this.voiceQueue = [];
    this.MAX_VOICES = 128;
    this.heldNotes = new Set();

    this._voiceNodePool = [];

    // PCM AudioWorklet: routes voice playback to the audio thread when available.
    // Set by multi-layer-engine._initWorklet(); null means fallback to main-thread.
    this.pcmWorkletNode = null;

    this._spinePools = new Map();
    this._hammerPools = new Map();
    this._chiffPools = new Map();

    try {
      const hlen = Math.floor(ctx.sampleRate * 0.06);
      this.hammerBuf = ctx.createBuffer(1, hlen, ctx.sampleRate);
      const hd = this.hammerBuf.getChannelData(0);
      for (let i = 0; i < hlen; i++) {
        const t = i / hlen;
        hd[i] = (Math.random() * 2 - 1) * Math.exp(-t * 9);
      }
    } catch (e) {
      this.hammerBuf = null;
    }

    try {
      this._createReedChiffBuffer();
    } catch (e) {}

    this.loadingSoundfonts = new Set();
    this.isReady = false;

    this.initBuffers();
  }

  playLooperNote(
    trackIndex,
    layerSlot,
    instId,
    midiNote,
    velocity,
    gain = 1.0,
    when = 0,
  ) {
    if (trackIndex < 0 || trackIndex > 3) return null;
    if (layerSlot < 0 || layerSlot > 3) return null;
    const bus = this.looperInserts[trackIndex]?.[layerSlot];
    if (!bus) return null;
    return this.playNote(
      instId,
      midiNote,
      velocity,
      gain,
      null,
      bus.input,
      when,
    );
  }

  stopLooperNote(trackIndex, layerSlot, instId, midiNote, when = 0) {
    if (trackIndex < 0 || trackIndex > 3) return;
    this.stopNote(instId, midiNote, when);
  }

  setLooperTrackFx(trackIndex, layerSlot, fxId) {
    if (trackIndex < 0 || trackIndex > 3) return;
    const bus = this.looperInserts[trackIndex]?.[layerSlot];
    if (bus) bus.setEffect(fxId || "clean");
  }

  setLooperTrackGain(trackIndex, layerSlot, gain) {
    if (trackIndex < 0 || trackIndex > 3) return;
    const bus = this.looperInserts[trackIndex]?.[layerSlot];
    if (bus && bus.input && bus.input.gain) {
      const g = Math.max(0, Math.min(2.0, gain));
      bus.input.gain.setTargetAtTime(g, this.ctx.currentTime, 0.02);
    }
  }

  setLooperTrackSustain(trackIndex, isDown, when = 0) {
    if (trackIndex < 0 || trackIndex > 3) return;
    const buses = this.looperInserts[trackIndex];
    if (!buses) return;
    buses.forEach((bus) => {
      try {
        bus.setSustain(isDown);
      } catch (e) {}
    });
  }

  clearLooperTrack(trackIndex) {
    if (trackIndex < 0 || trackIndex > 3) return;
    const buses = this.looperInserts[trackIndex];
    if (!buses) return;
    buses.forEach((bus) => {
      try {
        bus.flush();
      } catch (e) {}
    });
  }

  _findLooperBusByDest(destNode) {
    if (!this.looperInserts || !destNode) return null;
    for (let t = 0; t < this.looperInserts.length; t++) {
      for (let l = 0; l < this.looperInserts[t].length; l++) {
        const bus = this.looperInserts[t][l];
        if (bus && bus.input === destNode) return bus;
      }
    }
    return null;
  }

  base64ToArrayBuffer(base64Uri) {
    const base64 = base64Uri.split(",")[1] || base64Uri;
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  decodeAudioBuffer(ctx, arrayBuf) {
    return new Promise((resolve, reject) => {
      try {
        const handleDecoded = (buf) => {
          if (!buf) {
            resolve(buf);
            return;
          }
          if (buf.numberOfChannels === 1) {
            const stereoBuf = ctx.createBuffer(2, buf.length, buf.sampleRate);
            const monoData = buf.getChannelData(0);
            stereoBuf.getChannelData(0).set(monoData);
            stereoBuf.getChannelData(1).set(monoData);
            resolve(stereoBuf);
            return;
          }
          if (buf.numberOfChannels >= 2) {
            const ch0 = buf.getChannelData(0);
            const ch1 = buf.getChannelData(1);
            let ch0Sum = 0,
              ch1Sum = 0;
            const sampleLen = Math.min(2000, ch0.length);
            for (let i = 0; i < sampleLen; i += 10) {
              ch0Sum += Math.abs(ch0[i]);
              ch1Sum += Math.abs(ch1[i]);
            }
            if (ch0Sum > 0.001 && ch1Sum < 0.00005) ch1.set(ch0);
          }
          try {
            let peak = 0;
            for (let c = 0; c < buf.numberOfChannels; c++) {
              const d = buf.getChannelData(c);
              for (let i = 0; i < d.length; i += 3) {
                const a = Math.abs(d[i]);
                if (a > peak) peak = a;
              }
            }
            if (peak > 0.02) {
              const g = Math.min(15, 0.9 / peak);
              if (g > 1.001 || g < 0.999) {
                for (let c = 0; c < buf.numberOfChannels; c++) {
                  const d = buf.getChannelData(c);
                  for (let i = 0; i < d.length; i++) d[i] *= g;
                }
              }
            }
            try {
              const edgeLen = Math.min(
                Math.floor(buf.sampleRate * 0.01),
                Math.floor(buf.length * 0.02),
              );
              if (edgeLen > 16) {
                for (let c = 0; c < buf.numberOfChannels; c++) {
                  const d = buf.getChannelData(c);
                  for (let i = 0; i < edgeLen; i++) {
                    d[buf.length - edgeLen + i] *=
                      0.5 * (1 + Math.cos((i / edgeLen) * Math.PI));
                  }
                }
              }
            } catch (e) {}
          } catch (e) {}
          resolve(buf);
        };
        const res = ctx.decodeAudioData(arrayBuf, handleDecoded, (err) =>
          reject(err),
        );
        if (res && typeof res.then === "function")
          res.then(handleDecoded).catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  fadeBufferEnd(buf, seconds) {
    try {
      if (!buf) return buf;
      const fadeLen = Math.min(
        Math.floor(buf.sampleRate * seconds),
        Math.floor(buf.length * 0.25),
      );
      if (fadeLen < 32) return buf;
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < fadeLen; i++) {
          const t = i / fadeLen;
          d[buf.length - fadeLen + i] *= 0.5 * (1 + Math.cos(t * Math.PI));
        }
      }
    } catch (e) {}
    return buf;
  }

  createCrossfadedLoopBuffer(ctx, originalBuf, instId) {
    if (!originalBuf) return originalBuf;
    const isDroneInstrument =
      instId &&
      (instId.includes("string") ||
        instId.includes("pad") ||
        instId.includes("choir") ||
        instId.includes("organ") ||
        instId.includes("voice") ||
        instId.includes("universe") ||
        instId.includes("sax") ||
        instId.includes("bass") ||
        instId.includes("flute") ||
        instId.includes("clarinet") ||
        instId.includes("trumpet") ||
        instId.includes("trombone") ||
        instId.includes("violin") ||
        instId.includes("cello") ||
        instId.includes("brass"));
    if (!isDroneInstrument || originalBuf.duration < 0.8)
      return this.fadeBufferEnd(originalBuf, 0.4);
    const numChannels = Math.max(2, originalBuf.numberOfChannels);
    const sampleRate = originalBuf.sampleRate;
    const totalSamples = originalBuf.length;
    const fadeSamples = Math.min(
      Math.floor(sampleRate * 0.06),
      Math.floor(totalSamples * 0.06),
    );
    const loopEndSample = totalSamples - fadeSamples;
    const minLoopLen = Math.min(
      Math.floor(sampleRate * 0.5),
      Math.floor(totalSamples * 0.2),
    );
    const searchFrom = Math.floor(totalSamples * 0.15);
    const searchTo = loopEndSample - minLoopLen;
    if (searchTo <= searchFrom || fadeSamples < 64)
      return this.fadeBufferEnd(originalBuf, 0.3);
    let loopStartSample = -1;
    try {
      const ref = originalBuf.getChannelData(0);
      let sum = 0,
        cnt = 0;
      for (let i = searchFrom; i < loopEndSample; i += 7) {
        sum += ref[i] * ref[i];
        cnt++;
      }
      const rms = Math.sqrt(sum / Math.max(1, cnt));
      if (rms < 0.001) return this.fadeBufferEnd(originalBuf, 0.3);
      const W = Math.min(1024, fadeSamples * 2);
      const endBase = loopEndSample - W;
      const threshold = rms * 0.45;
      for (let s = searchFrom; s <= searchTo; s += 256) {
        let diff = 0;
        for (let i = 0; i < W; i += 2) {
          const d = ref[s + i] - ref[endBase + i];
          diff += d * d;
        }
        diff = Math.sqrt(diff / (W / 2));
        if (diff < threshold) {
          loopStartSample = s;
          break;
        }
      }
    } catch (e) {}
    if (loopStartSample < 0) return this.fadeBufferEnd(originalBuf, 0.3);
    const newBuf = ctx.createBuffer(numChannels, loopEndSample, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      const srcCh = Math.min(ch, originalBuf.numberOfChannels - 1);
      const src = originalBuf.getChannelData(srcCh);
      const dst = newBuf.getChannelData(ch);
      for (let i = 0; i < loopStartSample; i++) dst[i] = src[i];
      for (let i = 0; i < fadeSamples; i++) {
        const t = i / fadeSamples;
        const gainTail = Math.cos(t * Math.PI * 0.5);
        const gainHead = Math.sin(t * Math.PI * 0.5);
        const headIdx = loopStartSample + i;
        const tailIdx = loopEndSample + i;
        dst[headIdx] = src[tailIdx] * gainTail + src[headIdx] * gainHead;
      }
      for (let i = loopStartSample + fadeSamples; i < loopEndSample; i++)
        dst[i] = src[i];
    }
    if (newBuf.numberOfChannels >= 2) {
      const ch0 = newBuf.getChannelData(0);
      const ch1 = newBuf.getChannelData(1);
      let ch0Sum = 0,
        ch1Sum = 0;
      for (let i = 0; i < Math.min(1000, ch0.length); i += 10) {
        ch0Sum += Math.abs(ch0[i]);
        ch1Sum += Math.abs(ch1[i]);
      }
      if (ch0Sum > 0.001 && ch1Sum < 0.00005) ch1.set(ch0);
    }
    newBuf._isLoopable = true;
    newBuf._loopStartSec = loopStartSample / sampleRate;
    newBuf._loopEndSec = loopEndSample / sampleRate;
    return newBuf;
  }

  async initBuffers() {
    await Promise.all([
      this.decodeEmbeddedAnchors("acoustic_grand_piano"),
      this.decodeEmbeddedAnchors("choir_aahs"),
      this.loadSoundfont("alto_sax"),
      this.loadSoundfont("tenor_sax"),
    ]);
    this._createReedChiffBuffer();
    this.isReady = true;
    this.loadAbletunesInstrument("fm_piano");
    this.loadAbletunesInstrument("upright_piano");
    const idlePreload = async () => {
      const coreInstruments = [
        "electric_piano_2",
        "electric_guitar_clean",
        "acoustic_guitar_nylon",
        "acoustic_guitar_steel",
        "drawbar_organ",
        "synth_bass_1",
        "soprano_sax",
        "string_ensemble_1",
        "brass_section",
        "flute",
        "distortion_guitar",
        "overdriven_guitar",
        "drum_kick_r",
        "drum_snare_r",
        "drum_hhclosed_r",
        "drum_hhopen_r",
        "drum_crash_r",
      ];
      for (const inst of coreInstruments) {
        await this.loadSoundfont(inst);
        await new Promise((r) => setTimeout(r, 120));
      }
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => idlePreload());
    } else {
      setTimeout(idlePreload, 1500);
    }
  }

  async loadSoundfont(instId) {
    if (!instId || this.loadingSoundfonts.has(instId)) return;
    if (this.sfxGenerator && this.sfxGenerator.isSfxInstrument(instId)) return;
    this.loadingSoundfonts.add(instId);
    try {
      const resp = await fetch(`/soundfonts/${instId}-mp3.js`);
      if (!resp.ok) return;
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("text/html")) return;
      const text = await resp.text();
      if (!text || text.trim().startsWith("<")) return;
      const fn = new Function("MIDI", text);
      const MIDI = { Soundfont: {} };
      fn(MIDI);
      const samples = MIDI.Soundfont[instId];
      if (!samples) return;
      if (!this.decodedBuffers.has(instId))
        this.decodedBuffers.set(instId, new Map());
      const instMap = this.decodedBuffers.get(instId);
      const ctx = this.ctx;
      const entries = Object.entries(samples);
      entries.sort((a, b) => {
        const mA = noteNameToMidi(a[0]) || 60;
        const mB = noteNameToMidi(b[0]) || 60;
        return Math.abs(mA - 60) - Math.abs(mB - 60);
      });
      const BATCH_SIZE = 8;
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async ([noteName, base64Uri]) => {
            const midi = noteNameToMidi(noteName);
            if (midi === null) return;
            try {
              const cacheKey = `sf_${instId}_${midi}`;
              let arrayBuf = await sampleCache.getSample(cacheKey);
              if (!arrayBuf) {
                arrayBuf = this.base64ToArrayBuffer(base64Uri);
                sampleCache.setSample(cacheKey, arrayBuf, { instId, midi });
              }
              const audioBuf = await this.decodeAudioBuffer(ctx, arrayBuf);
              const processedBuf = this.createCrossfadedLoopBuffer(
                ctx,
                audioBuf,
                instId,
              );
              instMap.set(midi, processedBuf);
            } catch (err) {}
          }),
        );
      }
    } catch (err) {
      console.warn(
        `[Native PCM Rompler] Failed to load soundfont: ${instId}`,
        err,
      );
    }
  }

  async loadAbletunesInstrument(bankKey) {
    const bank = ABLETUNES_BANKS[bankKey];
    if (!bank) return;
    const instId = bank.id;
    if (this.loadingSoundfonts.has(instId)) return;
    this.loadingSoundfonts.add(instId);
    if (!this.decodedBuffers.has(instId))
      this.decodedBuffers.set(instId, new Map());
    const instMap = this.decodedBuffers.get(instId);
    const ctx = this.ctx;
    const coreAnchors = bank.samples.slice();
    const BATCH = 4;
    for (let i = 0; i < coreAnchors.length; i += BATCH) {
      const batch = coreAnchors.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (sample) => {
          try {
            const cacheKey = `able_${instId}_${sample.f}`;
            let arrayBuf = await sampleCache.getSample(cacheKey);
            if (!arrayBuf) {
              const url = `${bank.path}/${sample.f}`;
              const resp = await fetch(url);
              if (!resp.ok) return;
              arrayBuf = await resp.arrayBuffer();
              sampleCache.setSample(cacheKey, arrayBuf, {
                instId,
                file: sample.f,
              });
            }
            const audioBuf = await this.decodeAudioBuffer(ctx, arrayBuf);
            if (
              bankKey === "fm_piano" &&
              audioBuf &&
              audioBuf.length > ctx.sampleRate
            ) {
              const fadeLen = Math.min(
                Math.floor(ctx.sampleRate * 1.5),
                Math.floor(audioBuf.length * 0.25),
              );
              for (let c = 0; c < audioBuf.numberOfChannels; c++) {
                const d = audioBuf.getChannelData(c);
                for (let i = 0; i < fadeLen; i++) {
                  const t = i / fadeLen;
                  d[audioBuf.length - fadeLen + i] *=
                    0.5 * (1 + Math.cos(t * Math.PI));
                }
              }
            }
            const processedBuf = this.createCrossfadedLoopBuffer(
              ctx,
              audioBuf,
              instId,
            );
            instMap.set(sample.m, processedBuf);
            instMap.set(`${sample.m}_${sample.v}`, processedBuf);
          } catch (e) {}
        }),
      );
    }
  }

  async decodeEmbeddedAnchors(instId) {
    const instData = KORG_PCM_BANKS[instId];
    if (!instData || !instData.anchors) return;
    if (!this.decodedBuffers.has(instId))
      this.decodedBuffers.set(instId, new Map());
    const instMap = this.decodedBuffers.get(instId);
    const ctx = this.ctx;
    const anchorPromises = Object.entries(instData.anchors).map(
      async ([midiStr, base64]) => {
        const midi = parseInt(midiStr);
        try {
          const arrayBuf = this.base64ToArrayBuffer(base64);
          const audioBuf = await this.decodeAudioBuffer(ctx, arrayBuf);
          const processedBuf = this.createCrossfadedLoopBuffer(
            ctx,
            audioBuf,
            instId,
          );
          instMap.set(midi, processedBuf);
        } catch (e) {
          console.warn(
            `[PCM Rompler] Anchor ${midi} decode failed for ${instId}:`,
            e,
          );
        }
      },
    );
    await Promise.all(anchorPromises);
  }

  findNearestAnchor(instId, targetMidi, velocity = 95) {
    if (this.sfxGenerator && this.sfxGenerator.isSfxInstrument(instId))
      return null;
    if (instId && INST_ALIASES[instId]) instId = INST_ALIASES[instId];

    if (instId && instId.startsWith("abletunes_")) {
      const bankKey =
        instId === "abletunes_fm_piano" ? "fm_piano" : "upright_piano";
      if (
        !this.decodedBuffers.has(instId) ||
        this.decodedBuffers.get(instId).size === 0
      ) {
        this.loadAbletunesInstrument(bankKey);
        const pianoMap = this.decodedBuffers.get("acoustic_grand_piano");
        if (pianoMap && pianoMap.size > 0)
          return this.findAnchorInMap(pianoMap, targetMidi);
        return null;
      }
      const instMap = this.decodedBuffers.get(instId);
      const vl = velocity < 55 ? "vl1" : velocity < 98 ? "vl2" : "vl3";
      const exactKey = `${targetMidi}_${vl}`;
      if (instMap.has(exactKey))
        return { anchorMidi: targetMidi, buffer: instMap.get(exactKey) };
      if (instMap.has(targetMidi))
        return { anchorMidi: targetMidi, buffer: instMap.get(targetMidi) };
      let closestMidi = null;
      let minDiff = Infinity;
      for (const key of instMap.keys()) {
        const midi =
          typeof key === "number" ? key : parseInt(key.split("_")[0]);
        const diff = Math.abs(targetMidi - midi);
        if (diff < minDiff) {
          minDiff = diff;
          closestMidi = midi;
        }
      }
      if (closestMidi !== null) {
        const buf =
          instMap.get(`${closestMidi}_${vl}`) || instMap.get(closestMidi);
        if (buf) return { anchorMidi: closestMidi, buffer: buf };
      }
      const pianoMap = this.decodedBuffers.get("acoustic_grand_piano");
      return this.findAnchorInMap(pianoMap, targetMidi);
    }

    let instMap = this.decodedBuffers.get(instId);
    if (!instMap || instMap.size === 0) {
      this.loadSoundfont(instId);
      const str = String(instId || "").toLowerCase();
      if (
        str.includes("choir") ||
        str.includes("ooh") ||
        str.includes("ahh") ||
        str.includes("voice")
      ) {
        instMap = this.decodedBuffers.get("choir_aahs");
      } else if (
        str.includes("tenor_sax") ||
        str.includes("sensual") ||
        str.includes("blues_growl")
      ) {
        instMap =
          this.decodedBuffers.get("tenor_sax") ||
          this.decodedBuffers.get("alto_sax");
      } else if (str.includes("soprano_sax") || str.includes("soprano")) {
        instMap =
          this.decodedBuffers.get("soprano_sax") ||
          this.decodedBuffers.get("alto_sax");
      } else if (str.includes("sax")) {
        instMap =
          this.decodedBuffers.get("alto_sax") ||
          this.decodedBuffers.get("tenor_sax");
      } else if (str.includes("flute") || str.includes("pan_flute")) {
        instMap = this.decodedBuffers.get("flute");
      } else if (str.includes("woodwind") || str.includes("clarinet")) {
        instMap =
          this.decodedBuffers.get("clarinet") ||
          this.decodedBuffers.get("alto_sax");
      } else if (str.includes("string") || str.includes("pad")) {
        instMap = this.decodedBuffers.get("string_ensemble_1");
      } else if (str.includes("electric") || str.includes("dx")) {
        instMap =
          this.decodedBuffers.get("electric_piano_2") ||
          this.decodedBuffers.get("electric_piano_1");
      }
      if (!instMap || instMap.size === 0)
        instMap = this.decodedBuffers.get("acoustic_grand_piano");
    }
    if (!instMap || instMap.size === 0) {
      for (const [id, map] of this.decodedBuffers.entries()) {
        if (map && map.size > 0) {
          instMap = map;
          break;
        }
      }
    }
    if (!instMap || instMap.size === 0) return null;
    return this.findAnchorInMap(instMap, targetMidi);
  }

  findAnchorInMap(map, targetMidi) {
    if (!map || map.size === 0) return null;
    if (map.has(targetMidi))
      return { anchorMidi: targetMidi, buffer: map.get(targetMidi) };
    let closestMidi = null;
    let minDiff = Infinity;
    for (const anchorMidi of map.keys()) {
      if (typeof anchorMidi !== "number") continue;
      const diff = Math.abs(targetMidi - anchorMidi);
      if (diff < minDiff) {
        minDiff = diff;
        closestMidi = anchorMidi;
        if (diff <= 1) break;
      }
    }
    if (closestMidi === null) {
      const firstEntry = map.entries().next().value;
      if (firstEntry) {
        return {
          anchorMidi: typeof firstEntry[0] === "number" ? firstEntry[0] : 60,
          buffer: firstEntry[1],
        };
      }
      return null;
    }
    return { anchorMidi: closestMidi, buffer: map.get(closestMidi) };
  }

  _acquireHammer(dest) {
    let pool = this._hammerPools.get(dest);
    if (!pool) {
      pool = { free: [] };
      this._hammerPools.set(dest, pool);
    }
    let h = pool.free.pop();
    if (!h) {
      const hbp = this.ctx.createBiquadFilter();
      hbp.type = "bandpass";
      const hg = this.ctx.createGain();
      hbp.connect(hg);
      hg.connect(dest);
      h = { hbp, hg };
    }
    return h;
  }

  _releaseHammer(dest, h) {
    if (!h || !this._hammerPools) return;
    let pool = this._hammerPools.get(dest);
    if (!pool) {
      pool = { free: [] };
      this._hammerPools.set(dest, pool);
    }
    pool.free.push(h);
  }

  _instTimbre(instId) {
    const id = (instId || "").toLowerCase();
    const isSax = id.includes("sax");
    const isChoir =
      id.includes("choir") ||
      id.includes("ooh_ahh") ||
      id.includes("vox") ||
      id.includes("voice");
    const isHashy =
      id.includes("guitar") ||
      id.includes("pluck") ||
      id.includes("harpsichord") ||
      id.includes("slap_bass");
    return [isSax, isChoir, isHashy];
  }

  _createReedChiffBuffer() {
    if (this.reedChiffBuf || !this.ctx) return;
    const sampleRate = this.ctx.sampleRate || 44100;
    const len = Math.floor(sampleRate * 0.08);
    const buf = this.ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + white * 0.05;
      b1 = 0.95 * b1 + white * 0.11;
      b2 = 0.85 * b2 + white * 0.25;
      const pink = (b0 + b1 + b2 + white * 0.1) * 0.6;
      const click =
        i < sampleRate * 0.012
          ? Math.sin((i / (sampleRate * 0.012)) * Math.PI) *
            Math.sin(i * 0.35) *
            0.45
          : 0;
      const env = Math.exp(-t * 7.2);
      data[i] = (pink * 0.75 + click) * env;
    }
    this.reedChiffBuf = buf;
  }

  _acquireReedChiff(dest) {
    if (!this._chiffPools) this._chiffPools = new Map();
    let pool = this._chiffPools.get(dest);
    if (!pool) {
      pool = { free: [] };
      this._chiffPools.set(dest, pool);
    }
    let c = pool.free.pop();
    if (!c) {
      const cbp = this.ctx.createBiquadFilter();
      cbp.type = "bandpass";
      const cg = this.ctx.createGain();
      cbp.connect(cg);
      cg.connect(dest);
      c = { cbp, cg };
    }
    return c;
  }

  _releaseReedChiff(dest, c) {
    if (!c || !this._chiffPools) return;
    let pool = this._chiffPools.get(dest);
    if (!pool) {
      pool = { free: [] };
      this._chiffPools.set(dest, pool);
    }
    pool.free.push(c);
  }

  playNote(
    instId,
    midiNote,
    velocity = 95,
    customGain = 1.0,
    layerIndex = null,
    destOverride = null,
    when = 0,
  ) {
    const dest = destOverride
      ? destOverride
      : layerIndex !== null &&
          layerIndex !== undefined &&
          this.layerInserts &&
          this.layerInserts[layerIndex]
        ? this.layerInserts[layerIndex].input
        : this.destination;

    if (this.sfxGenerator && this.sfxGenerator.isSfxInstrument(instId)) {
      return this.sfxGenerator.playSfxNote(
        instId,
        midiNote,
        velocity,
        customGain,
        dest,
        when,
      );
    }

    const anchorData = this.findNearestAnchor(instId, midiNote, velocity);
    if (!anchorData || !anchorData.buffer) return null;

    const ctx = this.ctx;
    const now = when > 0 ? Math.max(when, ctx.currentTime) : ctx.currentTime;
    const velNorm = Math.max(0.08, Math.min(1.0, velocity / 127));
    this.heldNotes.add(midiNote);

    const semitoneDiff = midiNote - anchorData.anchorMidi;
    const basePlaybackRate = Math.pow(2, semitoneDiff / 12);
    const bentPlaybackRate =
      basePlaybackRate * Math.pow(2, this.pitchBendSemitones / 12);

    // === AudioWorklet path: route voice to audio thread (zero main-thread jank) ===
    if (this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
      const buf = anchorData.buffer;

      // On-demand buffer transfer: if a soundfont loaded after worklet init,
      // push the buffer now so the worklet can play it.
      const bufKey = instId + ":" + anchorData.anchorMidi;
      if (!this.pcmWorkletNode._loadedBuffers.has(bufKey)) {
        this.pcmWorkletNode.loadBuffer(instId, anchorData.anchorMidi, buf);
        this.pcmWorkletNode._loadedBuffers.add(bufKey);
      }

      const trim = INST_TRIM_GAINS[instId] || 1.0;
      const dynamicAmp = Math.pow(velNorm, 1.25);
      const peakGain = (0.1 + dynamicAmp * 0.9) * customGain * trim;
      const [isSax, isChoir] = this._instTimbre(instId);
      const minCutoff = isSax ? 4000 : isChoir ? 1000 : 3500;
      const maxCutoff = isSax ? 16000 : isChoir ? 8500 : 20000;
      const noteFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
      const filterNorm = Math.min(1.0, (minCutoff + Math.pow(velNorm, 1.35) * (maxCutoff - minCutoff)) / 20000);

      this.pcmWorkletNode.noteOn({
        instId,
        midiNote,
        velocity: velNorm,
        gain: peakGain,
        layerIndex,
        anchorMidi: anchorData.anchorMidi,
        playbackRate: bentPlaybackRate,
        isLoopable: !!buf._isLoopable,
        loopStart: buf._isLoopStartSec || 0,
        loopEnd: buf._isLoopEndSec || 0,
        attackTime: isChoir ? 0.04 : 0.003,
        decayTime: 0.25,
        sustainLevel: 0.65,
        releaseTime: isChoir ? 0.2 : isSax ? 0.12 : 0.06,
        filterCutoff: filterNorm,
        maxLife: buf._isLoopable ? 60.0 : Math.min(8.0, (buf.duration || 4.0) + 0.1),
      });
      return null; // voice managed by worklet, no main-thread record
    }

    // === Main-thread fallback (when AudioWorklet unavailable) ===
    if (this.activeVoices.has(midiNote)) {
      const oldList = this.activeVoices.get(midiNote);
      if (oldList && oldList.length > 0) {
        const remaining = [];
        oldList.forEach((oldV) => {
          const isSameLayer =
            layerIndex !== null &&
            layerIndex !== undefined &&
            oldV.layerIndex === layerIndex;
          const isSameInst = oldV.instId === instId;
          if (isSameLayer || (layerIndex === null && isSameInst)) {
            try {
              if (oldV.src) oldV.src.onended = null;
              oldV.voiceGain.gain.cancelScheduledValues(now);
              oldV.voiceGain.gain.setValueAtTime(
                oldV.voiceGain.gain.value || 0.0,
                now,
              );
                oldV.voiceGain.gain.linearRampToValueAtTime(0.0, now + 0.05);
              if (oldV.src) oldV.src.stop(now + 0.06);
            } catch (e) {}
            this.removeVoice(midiNote, oldV);
          } else {
            remaining.push(oldV);
          }
        });
        if (remaining.length > 0) this.activeVoices.set(midiNote, remaining);
        else this.activeVoices.delete(midiNote);
      }
    }

    if (this.sustainedVoices.has(midiNote)) {
      const susList = this.sustainedVoices.get(midiNote);
      if (susList && susList.length > 0) {
        susList.forEach((oldV) => {
          try {
            if (oldV.src) oldV.src.onended = null;
            oldV.voiceGain.gain.cancelScheduledValues(now);
            oldV.voiceGain.gain.setValueAtTime(
              oldV.voiceGain.gain.value || 0.0,
              now,
            );
            // Aligned with the smart-steal fade: a 50ms low-slope ramp means
            // re-striking a still-ringing SUSTAINED note (sustain pedal down)
            // fades the old ringing tail cleanly instead of the sharp 25ms chop
            // that punched through the limiter as the sustaining "crackle".
            oldV.voiceGain.gain.linearRampToValueAtTime(0.0, now + 0.05);
            if (oldV.src) oldV.src.stop(now + 0.06);
          } catch (e) {}
          this.removeVoice(midiNote, oldV);
        });
        this.sustainedVoices.delete(midiNote);
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = anchorData.buffer;
    src.playbackRate.setValueAtTime(bentPlaybackRate, now);

    if (anchorData.buffer && anchorData.buffer._isLoopable) {
      src.loop = true;
      src.loopStart = anchorData.buffer._loopStartSec;
      src.loopEnd = anchorData.buffer._loopEndSec;
    } else {
      src.loop = false;
    }

    const [isSax, isChoir, isHashy] = this._instTimbre(instId);
    let filter, voiceGain;
    const pooled = this._voiceNodePool.pop();
    if (pooled) {
      filter = pooled.filter;
      voiceGain = pooled.voiceGain;
      filter.connect(voiceGain);
      voiceGain.connect(dest);
      voiceGain.gain.cancelScheduledValues(now);
      voiceGain.gain.setValueAtTime(0.0, now);
      filter.frequency.cancelScheduledValues(now);
      filter.Q.cancelScheduledValues(now);
    } else {
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      voiceGain = ctx.createGain();
      voiceGain.channelCount = 2;
      voiceGain.channelCountMode = "explicit";
      voiceGain.channelInterpretation = "speakers";
      filter.connect(voiceGain);
      voiceGain.connect(dest);
    }

    const minCutoff = isSax ? 4000 : isChoir ? 1000 : isHashy ? 3000 : 3500;
    const maxCutoff = isSax ? 16000 : isChoir ? 8500 : isHashy ? 16000 : 20000;
    const dynamicCutoff =
      minCutoff + Math.pow(velNorm, 1.35) * (maxCutoff - minCutoff);
    const noteFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const keyTrackedCutoff = Math.max(
      dynamicCutoff,
      Math.min(20000, noteFreq * (2.0 + velNorm * 2.2)),
    );

    filter.frequency.setValueAtTime(keyTrackedCutoff, now);
    filter.Q.setValueAtTime(0.35, now);

    const trim = INST_TRIM_GAINS[instId] || 1.0;
    const dynamicAmp = Math.pow(velNorm, 1.25);
    const peakGain = (0.1 + dynamicAmp * 0.9) * customGain * trim;

    voiceGain.gain.setValueAtTime(0.0, now);
    if (isChoir) voiceGain.gain.setTargetAtTime(peakGain, now, 0.04);
    else voiceGain.gain.linearRampToValueAtTime(peakGain, now + 0.0035);

    voiceGain.gain.setTargetAtTime(0.0, now + 32.0, 3.5);
    const maxLife =
      anchorData.buffer && anchorData.buffer._isLoopable
        ? 60.0
        : Math.min(8.0, (anchorData.buffer?.duration || 4.0) + 0.1);
    try {
      src.stop(now + maxLife);
    } catch (e) {}

    src.connect(filter);
    src.start(now);

    const voiceRecord = {
      src,
      filter,
      voiceGain,
      dest,
      instId,
      midiNote,
      layerIndex,
      basePlaybackRate,
      baseGain: peakGain,
      baseCutoff: keyTrackedCutoff,
      velNorm,
      startTime: now,
      _isRemoved: false,
    };

    while (this.voiceQueue.length >= this.MAX_VOICES) {
      // Smart voice stealing — never chop a still-held sustained note if a
      // released tail (a note released but still ringing out) is available.
      // Stealing a held chord note mid-sustain is what produced the audible
      // "null/choppy dropped note" + burning-crackle: the sustain is abruptly
      // sliced and the cut punches straight into the master limiter.
      // Released tails are already decaying to silence, so stealing one is
      // essentially inaudible — preference order:
      //   1. a released tail (not in heldNotes): steal the deepest into release
      //      (oldest start). Cutting these costs nothing perceptible.
      //   2. only if EVERY voice is held: steal the oldest as a last resort.
      // Single O(n) pass — no temporary array allocation, no GC churn during
      // sustained dense playing (organs/pads love doing this).
      let target = null;
      let targetTime = Infinity;
      let oldest = null;
      let oldestTime = Infinity;
      for (let i = 0; i < this.voiceQueue.length; i++) {
        const v = this.voiceQueue[i];
        if (!v) continue;
        const t = v.startTime || 0;
        if (t < oldestTime) { oldest = v; oldestTime = t; }
        if (!this.heldNotes.has(v.midiNote) && t < targetTime) { target = v; targetTime = t; }
      }
      if (!target) target = oldest;
      if (!target) break;
      try {
        if (target.src) target.src.onended = null;
        target.voiceGain.gain.cancelScheduledValues(now);
        target.voiceGain.gain.setValueAtTime(
          target.voiceGain.gain.value || 0.0,
          now,
        );
        // Longer 50ms steal fade (was 25ms): a slow, low-slope fade makes even
        // the unavoidable "all voices held" steal click-free instead of the
        // sharp 25ms chop that buzzed against the limiter.
        target.voiceGain.gain.linearRampToValueAtTime(0.0, now + 0.05);
        if (target.src) target.src.stop(now + 0.06);
      } catch (e) {}
      this.removeVoice(target.midiNote, target);
    }

    if (!this.activeVoices.has(midiNote)) this.activeVoices.set(midiNote, []);
    this.activeVoices.get(midiNote).push(voiceRecord);
    this.voiceQueue.push(voiceRecord);

    src.onended = () => {
      this.removeVoice(midiNote, voiceRecord);
    };
    return voiceRecord;
  }

  removeVoice(midiNote, voiceRecord) {
    if (!voiceRecord || voiceRecord._isRemoved) return;
    voiceRecord._isRemoved = true;
    if (voiceRecord.src) {
      try {
        voiceRecord.src.onended = null;
      } catch (e) {}
    }
    const qi = this.voiceQueue.indexOf(voiceRecord);
    if (qi !== -1) this.voiceQueue.splice(qi, 1);
    const list = this.activeVoices.get(midiNote);
    if (list) {
      const idx = list.indexOf(voiceRecord);
      if (idx !== -1) list.splice(idx, 1);
      if (list.length === 0) this.activeVoices.delete(midiNote);
    }
    const susList = this.sustainedVoices.get(midiNote);
    if (susList) {
      const idx = susList.indexOf(voiceRecord);
      if (idx !== -1) susList.splice(idx, 1);
      if (susList.length === 0) this.sustainedVoices.delete(midiNote);
    }
    try {
      if (voiceRecord.src) {
        voiceRecord.src.disconnect();
      }
      if (voiceRecord.filter) voiceRecord.filter.disconnect();
      if (voiceRecord.voiceGain) voiceRecord.voiceGain.disconnect();
      if (this._voiceNodePool.length < this.MAX_VOICES) {
        this._voiceNodePool.push({
          filter: voiceRecord.filter,
          voiceGain: voiceRecord.voiceGain,
        });
      }
    } catch (e) {}
  }

  setNoteExpression(midiNote, relativeY) {
    const voices = this.activeVoices.get(midiNote);
    if (!voices || voices.length === 0) return;
    const now = this.ctx.currentTime;
    const yNorm = Math.max(0.05, Math.min(1.0, relativeY));
    voices.forEach((v) => {
      try {
        const minCut = 900,
          maxCut = 19000;
        const targetCutoff =
          minCut * Math.pow(maxCut / minCut, Math.pow(yNorm, 0.75));
        v.filter.frequency.setTargetAtTime(targetCutoff, now, 0.035);
        const targetGain = Math.pow(yNorm, 1.1) * (v.baseGain * 1.15);
        v.voiceGain.gain.setTargetAtTime(targetGain, now, 0.035);
      } catch (e) {}
    });
  }

  setPitchBend(semitones) {
    this.pitchBendSemitones = Math.max(-12, Math.min(12, semitones));
    const now = this.ctx.currentTime;
    const bendRatio = Math.pow(2, this.pitchBendSemitones / 12);
    const updateVoicePitch = (voices) => {
      voices.forEach((v) => {
        try {
          v.src.playbackRate.setTargetAtTime(
            v.basePlaybackRate * bendRatio,
            now,
            0.02,
          );
        } catch (e) {}
      });
    };
    this.activeVoices.forEach(updateVoicePitch);
    this.sustainedVoices.forEach(updateVoicePitch);
  }

  setModWheel(amount) {
    this.modWheelAmount = Math.max(0, Math.min(1.0, amount));
    const now = this.ctx.currentTime;
    this.activeVoices.forEach((voices) => {
      voices.forEach((v) => {
        try {
          const modCutoff = Math.min(
            20000,
            v.baseCutoff + this.modWheelAmount * 6000,
          );
          v.filter.frequency.setTargetAtTime(modCutoff, now, 0.03);
        } catch (e) {}
      });
    });
  }

  setSustainPedal(isDown, when = 0) {
    const wasDown = this.sustainPedal;
    this.sustainPedal = !!isDown;

    // AudioWorklet path
    if (this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
      this.pcmWorkletNode.setSustainPedal(!!isDown);
      return;
    }

    const ctx = this.ctx;
    const now = when > 0 ? Math.max(when, ctx.currentTime) : ctx.currentTime;

    if (wasDown !== this.sustainPedal) {
      try {
        if (typeof window !== "undefined" && window.__pianoAcoustics) {
          window.__pianoAcoustics.triggerDamperPedalSound(this.sustainPedal);
        }
      } catch (e) {}
    }

    if (!this.sustainPedal) {
      this.sustainedVoices.forEach((voices) => {
        voices.forEach((v) => {
          try {
            const isChoir =
              v.instId === "choir_aahs" ||
              v.instId === "m1_choir" ||
              v.instId === "m1_ooh_ahh" ||
              v.instId?.includes("choir");
            const isString =
              v.instId === "string_ensemble_1" ||
              v.instId?.includes("string") ||
              v.instId?.includes("pad");
            const isSax = v.instId === "alto_sax" || v.instId?.includes("sax");
            const tau = isChoir ? 0.2 : isString ? 0.08 : isSax ? 0.12 : 0.015;
            v.voiceGain.gain.cancelScheduledValues(now);
            v.voiceGain.gain.setTargetAtTime(0, now, tau);
            const stopTime = isChoir
              ? 1.4
              : isString
                ? 0.5
                : isSax
                  ? 0.55
                  : 0.1;
            v.src.stop(now + stopTime);
            if (v.vibLfo) {
              try {
                v.vibLfo.stop(now + stopTime + 0.1);
              } catch (e) {}
            }
            if (v.growlLfo) {
              try {
                v.growlLfo.stop(now + stopTime + 0.1);
              } catch (e) {}
            }
          } catch (e) {}
        });
      });
      this.sustainedVoices.clear();
    }
  }

  stopNote(instId, midiNote, when = 0) {
    this.heldNotes.delete(midiNote);

    // AudioWorklet path: forward to audio thread
    if (this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
      this.pcmWorkletNode.noteOff(midiNote);
      return;
    }

    const voices = this.activeVoices.get(midiNote);
    if (!voices || voices.length === 0) return;

    const ctx = this.ctx;
    const now = when > 0 ? Math.max(when, ctx.currentTime) : ctx.currentTime;
    const remaining = [];

    voices.forEach((v) => {
      if (!instId || v.instId === instId || !this.heldNotes.has(v.midiNote)) {
        const bus = this._findLooperBusByDest(v.dest);
        if (bus && bus.sustainActive) {
          bus.sustainedVoices.add(v);
          return;
        }

        if (this.sustainPedal) {
          if (!this.sustainedVoices.has(midiNote))
            this.sustainedVoices.set(midiNote, []);
          this.sustainedVoices.get(midiNote).push(v);
          try {
            let totalSus = 0;
            this.sustainedVoices.forEach((list) => {
              totalSus += list.length;
            });
            while (totalSus > 96) {
              let oldest = null;
              let oldestKey = null;
              for (const [key, list] of this.sustainedVoices) {
                if (list.length > 0) {
                  oldest = list[0];
                  oldestKey = key;
                  break;
                }
              }
              if (!oldest) break;
            oldest.voiceGain.gain.cancelScheduledValues(now);
            // Moved off the 25ms tau to the same 50ms low-slope family used by
            // smart stealing: when sustain is ON and fast chords overflow the
            // 48-voice sustained pool, the deepest tail is trimmed on a slow
            // 50ms exponential instead of the sharp 25ms chop that punched
            // against the limiter as the residual sustain-pedal "burn/crackle".
            oldest.voiceGain.gain.setTargetAtTime(0, now, 0.05);
            oldest.src.stop(now + 0.18);
              if (oldest.vibLfo) {
                try {
                  oldest.vibLfo.stop(now + 0.16);
                } catch (e) {}
              }
              if (oldest.growlLfo) {
                try {
                  oldest.growlLfo.stop(now + 0.16);
                } catch (e) {}
              }
              this.removeVoice(oldestKey, oldest);
              totalSus--;
            }
          } catch (e) {}
        } else {
          try {
            const isChoir =
              v.instId === "choir_aahs" ||
              v.instId === "m1_choir" ||
              v.instId === "m1_ooh_ahh" ||
              v.instId?.includes("choir");
            const isString =
              v.instId === "string_ensemble_1" ||
              v.instId?.includes("string") ||
              v.instId?.includes("pad");
            const isSax =
              v.instId === "alto_sax" ||
              v.instId?.includes("sax") ||
              v.instId?.includes("reed") ||
              v.instId?.includes("flute");
            const tau = isChoir ? 0.08 : isString ? 0.06 : isSax ? 0.03 : 0.015;
            v.voiceGain.gain.cancelScheduledValues(now);
            v.voiceGain.gain.setTargetAtTime(0, now, tau);
            const stopTime = isChoir
              ? 0.28
              : isString
                ? 0.22
                : isSax
                  ? 0.1
                  : 0.06;
            v.src.stop(now + stopTime);
            if (v.vibLfo) {
              try {
                v.vibLfo.stop(now + stopTime + 0.02);
              } catch (e) {}
            }
            if (v.growlLfo) {
              try {
                v.growlLfo.stop(now + stopTime + 0.02);
              } catch (e) {}
            }
          } catch (e) {}
        }
      } else {
        remaining.push(v);
      }
    });

    if (remaining.length > 0) this.activeVoices.set(midiNote, remaining);
    else this.activeVoices.delete(midiNote);
  }

  hasActiveSfxSample(instId = null) {
    const matches = (v) => {
      if (!v || !v.instId) return false;
      if (instId) return v.instId === instId;
      if (v.instId.endsWith("_r")) return true;
      return (
        v.instId === "thunder_clap" ||
        v.instId === "lightning_bolt" ||
        v.instId === "thunder_storm"
      );
    };
    for (const list of this.activeVoices.values()) {
      for (const v of list) if (matches(v)) return true;
    }
    for (const list of this.sustainedVoices.values()) {
      for (const v of list) if (matches(v)) return true;
    }
    return false;
  }

  stopSfxSamples(instId = null) {
    const now = this.ctx.currentTime;
    const matches = (v) => {
      if (!v || !v.instId) return false;
      if (instId) return v.instId === instId;
      if (v.instId.endsWith("_r")) return true;
      return (
        v.instId === "thunder_clap" ||
        v.instId === "lightning_bolt" ||
        v.instId === "thunder_storm"
      );
    };
    const silence = (map) => {
      const keptKeys = [];
      map.forEach((voices, key) => {
        const keep = [];
        voices.forEach((v) => {
          if (matches(v)) {
            try {
              v.voiceGain.gain.cancelScheduledValues(now);
              v.voiceGain.gain.setTargetAtTime(0, now, 0.01);
              v.src.stop(now + 0.05);
              const qi = this.voiceQueue.indexOf(v);
              if (qi !== -1) this.voiceQueue.splice(qi, 1);
            } catch (e) {}
          } else {
            keep.push(v);
          }
        });
        if (keep.length > 0) map.set(key, keep);
        else keptKeys.push(key);
      });
      keptKeys.forEach((k) => map.delete(k));
    };
    silence(this.activeVoices);
    silence(this.sustainedVoices);
  }

  allNotesOff() {
    this.sustainPedal = false;

    // AudioWorklet path
    if (this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
      this.pcmWorkletNode.allNotesOff();
      return;
    }

    const now = this.ctx.currentTime;

    const killVoice = (v) => {
      if (!v) return;
      try {
        if (v.src) v.src.onended = null;
        if (v.voiceGain) {
          v.voiceGain.gain.cancelScheduledValues(now);
          v.voiceGain.gain.setValueAtTime(v.voiceGain.gain.value || 0.0, now);
          v.voiceGain.gain.linearRampToValueAtTime(0.0, now + 0.003);
        }
        if (v.src) v.src.stop(now + 0.004);
        if (v.vibLfo) {
          try {
            v.vibLfo.stop(now + 0.005);
          } catch (e) {}
        }
        if (v.growlLfo) {
          try {
            v.growlLfo.stop(now + 0.005);
          } catch (e) {}
        }
        setTimeout(() => {
          try {
            if (v.src) v.src.disconnect();
            if (v.filter) v.filter.disconnect();
            if (v.voiceGain) v.voiceGain.disconnect();
            if (this._voiceNodePool.length < this.MAX_VOICES) {
              this._voiceNodePool.push({ filter: v.filter, voiceGain: v.voiceGain });
            }
          } catch (e) {}
        }, 10);
      } catch (e) {}
    };

    this.activeVoices.forEach((list) => list.forEach(killVoice));
    this.sustainedVoices.forEach((list) => list.forEach(killVoice));
    this.voiceQueue.forEach(killVoice);

    this.activeVoices.clear();
    this.sustainedVoices.clear();
    this.heldNotes.clear();
    this.voiceQueue.length = 0;

    if (this.layerInserts) {
      this.layerInserts.forEach((ins) => {
        try {
          ins.flush();
        } catch (e) {}
      });
    }
    if (this.splitZoneInserts) {
      Object.values(this.splitZoneInserts).forEach((ins) => {
        try {
          ins.flush();
        } catch (e) {}
      });
    }
    if (this.looperInserts) {
      this.looperInserts.forEach((trackBuses) => {
        trackBuses.forEach((ins) => {
          try {
            ins.flush();
          } catch (e) {}
        });
      });
    }
  }
}
