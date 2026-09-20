/**
 * Workstation Multi-Layer (COMBI) & Triton Program Sound Engine
 * Driven by NativePcmEngine with pre-decoded RAM AudioBuffers for TRUE 0.00ms touch-to-sound latency.
 * Stacks up to 4 simultaneous genuine 24-bit PCM instrument layers on every keypress
 * with independent volume faders, octave transpositions, and Korg IFX/MFX effects.
 */

import { NativePcmEngine } from "./native-pcm-engine.js";
import { audioCore } from "./audio-core.js";
import { synthEngine, INSTRUMENT_PATCHES } from "./synth-engine.js";
import { tritonVaEngine, TritonVirtualAnalogEngine } from "./triton-va-engine.js";
import { getTritonProgramById, getTritonBankName, getTritonPcmEntries, getTritonVaPrograms } from "../triton/combi-timbres.js";
import { SynthWorkletNode } from "./worklet/synth-worklet-node.js";
import { PcmWorkletNode } from "./worklet/pcm-worklet-node.js";
import { HD_SOUNDBANKS } from "./soundbanks.js";
import { midiOutManager } from "../midi/midi-out.js";
import {
  registerBudgetProvider,
  onMemoryEvict,
} from "./memory-manager.js";

export { HD_SOUNDBANKS };

// Unified combi timbre catalog: HD workstation banks + every Triton tab bank
// (M1/PCM programs resolve to a real PCM/SFX instrument, VA programs route to
// their genuine Triton VA oscillator voice). Kept here so the engine and the
// picker UI read from one source of truth.
export const COMBI_TIMBRES = (() => {
  const out = [];
  Object.values(HD_SOUNDBANKS).forEach(inst => {
    out.push({ value: inst.id, name: inst.name, category: inst.category, bank: "PCM WORKSTATION", kind: "pcm", code: "" });
  });
  getTritonPcmEntries().forEach(entry => {
    if (HD_SOUNDBANKS[entry.instKey]) return;
    out.push({
      value: entry.instKey,
      name: entry.name,
      category: entry.category,
      bank: getTritonBankName(entry.bank),
      kind: "pcm",
      code: entry.id,
    });
  });
  getTritonVaPrograms().forEach(prog => {
    out.push({
      value: "va:" + prog.id,
      name: prog.name,
      category: prog.category || "VA Synth",
      bank: getTritonBankName(prog.bank),
      kind: "va",
      code: prog.id,
    });
  });
  return out;
})();

export const COMBI_PRESETS = {
  synthesizer_you_surf: {
    id: "synthesizer_you_surf",
    name: "🏄 Synthesizer You - 80s Surf & Beach Rock Stack",
    category: "Synthesizer You Signature",
    layers: [
      { id: 0, name: "Strat Clean Lead (Spring Drip)", inst: "electric_guitar_clean", fx: "spring_surf", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Juno Stereo Synth Pad", inst: "m1_universe", fx: "analog_juno_chorus", gain: 0.65, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Analog Synth Bass (Tape Sat)", inst: "synth_bass_1", fx: "tape_sat_master", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "80s Gated Snare Drum Kit", inst: "tr808_kit", fx: "gated_cannon", gain: 0.80, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  synthesizer_you_pad: {
    id: "synthesizer_you_pad",
    name: "✨ Synthesizer You - Lush Juno & Vocal Echo Stack",
    category: "Synthesizer You Signature",
    layers: [
      { id: 0, name: "Juno Analog Poly Synth", inst: "m1_universe", fx: "analog_juno_chorus", gain: 0.85, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Slapback Vocal Shout", inst: "vox_yeah", fx: "slapback_vocal", gain: 0.75, pan: 0.05, oct: 0, minVel: 40, maxVel: 127, enabled: true },
      { id: 2, name: "Optical Tremolo Synth Pulse", inst: "synth_bass_1", fx: "opto_tremolo_16th", gain: 0.70, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Korg M1 Fresh Air Shimmer", inst: "m1_fresh_air", fx: "spring_surf", gain: 0.50, pan: 0, oct: 1, minVel: 60, maxVel: 127, enabled: true },
    ],
  },
  animal_festival_stack: {
    id: "animal_festival_stack",
    name: "🦁 Animal Festival Anthem (Drop Pluck + Festival Lead + Sub)",
    category: "EDM Festival",
    layers: [
      { id: 0, name: "Animal Drop Pluck 1", inst: "animal_drop_pluck_1", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Animal Festival Lead 1", inst: "animal_festival_lead_1", fx: "reverb_hall", gain: 0.70, pan: 0, oct: 0, minVel: 30, maxVel: 127, enabled: true },
      { id: 2, name: "Animal Sub Drop Bass", inst: "animal_sub_drop_bass_1", fx: "warm_eq", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Animal Bounce Lead", inst: "animal_bounce_lead", fx: "clean", gain: 0.60, pan: 0.05, oct: 1, minVel: 60, maxVel: 127, enabled: false },
    ],
  },
  bloom_future_bass_stack: {
    id: "bloom_future_bass_stack",
    name: "🌸 Bloom Chainsmokers Anthem (Closer Lead + Inside Out + Paris Pad + Reese)",
    category: "EDM Future Bass",
    layers: [
      { id: 0, name: "Bloom LEAD - Closer", inst: "bloom_closer_lead", fx: "reverb_hall", gain: 0.95, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Bloom LEAD - Inside Out", inst: "bloom_inside_out_lead", fx: "stereo_chorus", gain: 0.85, pan: 0.05, oct: 0, minVel: 20, maxVel: 127, enabled: true },
      { id: 2, name: "Bloom PAD - Paris", inst: "bloom_paris_pad", fx: "clean", gain: 0.80, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Bloom BASS - Breakdown", inst: "bloom_breakdown_bass", fx: "warm_eq", gain: 0.90, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  whitney_ballad: {
    id: "whitney_ballad",
    name: "★ Whitney 1992 - I Have Nothing (Foster Rig)",
    category: "Power Ballad",
    layers: [
      { id: 0, name: "David Foster Concert Grand", inst: "acoustic_grand_piano", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Hollywood Warm Strings", inst: "string_ensemble_1", fx: "clean", gain: 0.65, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Dyno 80s Bell Tine (Foster Ding)", inst: "electric_piano_1", fx: "clean", gain: 0.50, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Foster Shimmer Chime (+12)", inst: "electric_piano_1", fx: "reverb_hall", gain: 0.40, pan: -0.05, oct: 1, minVel: 75, maxVel: 127, enabled: false },
    ],
  },
  ballad_master: {
    id: "ballad_master",
    name: "★ Ballad Master (Synthage + Triton Strings + Tine)",
    category: "Worship / Ballad",
    layers: [
      { id: 0, name: "Velo Piano Grand", inst: "acoustic_grand_piano", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Triton Warm Strings", inst: "string_ensemble_1", fx: "clean", gain: 0.65, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Dyno Bell Tine", inst: "electric_piano_1", fx: "clean", gain: 0.55, pan: 0.05, oct: 0, minVel: 30, maxVel: 127, enabled: true },
      { id: 3, name: "Shreddage Lead Guitar", inst: "distortion_guitar", fx: "tube_warm", gain: 0.75, pan: 0, oct: 0, minVel: 95, maxVel: 127, enabled: false },
    ],
  },
  celestial_worship: {
    id: "celestial_worship",
    name: "★ Celestial Worship (Piano + Universe + Choir)",
    category: "Worship / Ambient",
    layers: [
      { id: 0, name: "Velo Piano Concert Grand", inst: "acoustic_grand_piano", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Triton Warm Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.65, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Korg M1 Ooh-Ahh Vocal Choir", inst: "choir_aahs", fx: "chorus_lush", gain: 0.75, pan: 0.05, oct: 0, minVel: 20, maxVel: 127, enabled: true },
      { id: 3, name: "Dyno Bell Tine", inst: "electric_piano_1", fx: "clean", gain: 0.45, pan: 0, oct: 1, minVel: 50, maxVel: 127, enabled: true },
    ],
  },
  m1_90s_house: {
    id: "m1_90s_house",
    name: "★ 90s House Anthem (M1 Piano 16' + Organ 2 + Strings)",
    category: "90s Dance / House",
    layers: [
      { id: 0, name: "Concert Grand Piano", inst: "acoustic_grand_piano", fx: "punch_comp", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "B3 Rock Organ (Bass)", inst: "drawbar_organ", fx: "clean", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Symphony Strings", inst: "string_ensemble_1", fx: "clean", gain: 0.55, pan: 0.05, oct: 0, minVel: 30, maxVel: 127, enabled: true },
      { id: 3, name: "Moog Synth Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.65, pan: -0.05, oct: -1, minVel: 75, maxVel: 127, enabled: false },
    ],
  },
  clean_electric_piano: {
    id: "clean_electric_piano",
    name: "★ Clean Stage Electric Piano (Suit & Stage EP + Bell)",
    category: "Electric Piano",
    layers: [
      { id: 0, name: "Suit & Stage EP", inst: "electric_piano_1", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "FM Bell Tine", inst: "electric_piano_2", fx: "clean", gain: 0.45, pan: 0.05, oct: 0, minVel: 50, maxVel: 127, enabled: true },
      { id: 2, name: "Warm Soft Strings", inst: "string_ensemble_1", fx: "clean", gain: 0.35, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Pocket Bass", inst: "synth_bass_1", fx: "clean", gain: 0.65, pan: -0.05, oct: -1, minVel: 1, maxVel: 127, maxNote: 59, enabled: true },
    ],
  },
  smooth_rnb: {
    id: "smooth_rnb",
    name: "★ Smooth R&B Soul (Stage EP + Breathy Sax + Strings)",
    category: "R&B / Soul",
    layers: [
      { id: 0, name: "Suit & Stage EP", inst: "electric_piano_1", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Breathy Alto Sax", inst: "alto_sax", fx: "reverb_room", gain: 0.85, pan: 0, oct: 0, minVel: 40, maxVel: 127, enabled: true },
      { id: 2, name: "Triton Stereo Strings", inst: "string_ensemble_1", fx: "clean", gain: 0.55, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Punch Bass (Left)", inst: "synth_bass_1", fx: "punch_comp", gain: 0.70, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: false },
    ],
  },
  rooftop_cathedral: {
    id: "rooftop_cathedral",
    name: "★ 1985 DX7 E.Piano 1 (FM Bell + Dimension Chorus + Hall)",
    category: "Electric Piano",
    fxPreset: "rooftop_cathedral",
    layers: [
      { id: 0, name: "DX7 E.Piano 1 Bell", inst: "electric_piano_2", fx: "chorus_lush", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Hall Wash Return", inst: "electric_piano_2", fx: "reverb_hall", gain: 0.55, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Analog Ensemble Double", inst: "electric_piano_2", fx: "chorus_vintage", gain: 0.24, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Angelic String Shimmer", inst: "string_ensemble_1", fx: "reverb_plate", gain: 0.18, pan: 0.03, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  neo_soul_chill: {
    id: "neo_soul_chill",
    name: "★ Neo-Soul Chill (Studio Rhodes + Universe Pad + Nylon + Sub)",
    category: "R&B / Neo-Soul",
    layers: [
      { id: 0, name: "Studio DX7 FM / Stage Rhodes", inst: "abletunes_fm_piano", fx: "autopan_wide", gain: 0.70, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Celestial Universe Pad", inst: "m1_universe", fx: "reverb_hall", gain: 0.45, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Warm Nylon Comping Chords", inst: "acoustic_guitar_nylon", fx: "clean", gain: 0.70, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Moog Analog Sub Bass", inst: "synth_bass_1", fx: "clean", gain: 0.75, pan: -0.05, oct: -1, minVel: 1, maxVel: 127, maxNote: 59, enabled: true },
    ],
  },
  reggae_bubble: {
    id: "reggae_bubble",
    name: "★ Kingston Bubble & Reggae Skank (B3 + Piano + Guitar)",
    category: "Reggae & Dub",
    fxPreset: "reggae_dub",
    layers: [
      { id: 0, name: "Percussive B3 Bubble Organ", inst: "drawbar_organ", fx: "rotary_fast", gain: 0.95, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Staccato Grand Chop", inst: "acoustic_grand_piano", fx: "clean", gain: 0.90, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Muted Clean Guitar Skank", inst: "electric_guitar_clean", fx: "punch_comp", gain: 0.70, pan: 0.1, oct: 0, minVel: 20, maxVel: 127, enabled: true },
      { id: 3, name: "Dub Sub Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.70, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  shimmer_worship_celestial: {
    id: "shimmer_worship_celestial",
    name: "★ Celestial Shimmer & Grand (Octave Reverb)",
    category: "Worship & Ambient",
    fxPreset: "shimmer_ethereal",
    layers: [
      { id: 0, name: "Concert Grand Piano", inst: "acoustic_grand_piano", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Ethereal Shimmer Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.75, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Dyno 80s Bell Tine", inst: "electric_piano_1", fx: "clean", gain: 0.50, pan: 0.05, oct: 1, minVel: 30, maxVel: 127, enabled: true },
      { id: 3, name: "Korg M1 Ooh-Ahh Formant", inst: "choir_aahs", fx: "chorus_lush", gain: 0.45, pan: 0, oct: 0, minVel: 20, maxVel: 127, enabled: true },
    ],
  },
  talkbox_funk_master: {
    id: "talkbox_funk_master",
    name: "★ Roger Troutman Talkbox Lead (Zapp & Roger)",
    category: "Funk & Groove",
    fxPreset: "talkbox_vocal",
    layers: [
      { id: 0, name: "Roger Talkbox Lead (Zapp)", inst: "va:A045", fx: "tube_warm", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Korg M1 Slap Bass", inst: "m1_slap_bass", fx: "punch_comp", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: false },
      { id: 2, name: "Funky Clavinet D6", inst: "electric_piano_1", fx: "clean", gain: 0.65, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: false },
      { id: 3, name: "Fat Brass Horns", inst: "brass_section", fx: "air_eq", gain: 0.60, pan: -0.05, oct: 0, minVel: 60, maxVel: 127, enabled: false },
    ],
  },
  lofi_vinyl_ep: {
    id: "lofi_vinyl_ep",
    name: "★ Lo-Fi Vintage Tape Rhodes (Vintage EP + Kalimba + Wow & Flutter)",
    category: "Lo-Fi & Vintage",
    layers: [
      { id: 0, name: "Vintage Stage Rhodes", inst: "rhodes_stage_mp3", fx: "lofi_vinyl", gain: 0.90, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Organic Kalimba Bell", inst: "kalimba", fx: "reverb_room", gain: 0.55, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Mellow Upright Bass", inst: "acoustic_bass", fx: "warm_eq", gain: 0.70, pan: -0.05, oct: -1, minVel: 1, maxVel: 127, maxNote: 59, enabled: true },
      { id: 3, name: "Vinyl String Pad", inst: "string_ensemble_1", fx: "clean", gain: 0.25, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  gospel_praise: {
    id: "gospel_praise",
    name: "★ Gospel Praise (Grand Piano + B3 Organ + Brass)",
    category: "Gospel & Praise",
    layers: [
      { id: 0, name: "Concert Grand", inst: "acoustic_grand_piano", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "B3 Rock Organ", inst: "drawbar_organ", fx: "clean", gain: 0.75, pan: 0, oct: 0, minVel: 20, maxVel: 127, enabled: true },
      { id: 2, name: "Triton Stereo Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.55, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Fat Brass Horns", inst: "brass_section", fx: "tube_warm", gain: 0.65, pan: 0, oct: 0, minVel: 75, maxVel: 127, enabled: false },
    ],
  },
  ambient_space: {
    id: "ambient_space",
    name: "★ Deep Space Ambient (Universe + Fresh Air + Choir)",
    category: "Ambient / Cinematic",
    layers: [
      { id: 0, name: "Triton Stereo Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.85, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Dyno Bell Chime", inst: "electric_piano_1", fx: "clean", gain: 0.65, pan: 0, oct: 1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Korg M1 Ooh-Ahh Vocal Choir", inst: "choir_aahs", fx: "reverb_hall", gain: 0.80, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Stage Electric Piano", inst: "electric_piano_1", fx: "clean", gain: 0.55, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  stadium_synth: {
    id: "stadium_synth",
    name: "★ 80s Stadium Anthem (Fat Brass + Dyno EP + Bass)",
    category: "Pop & Synth",
    layers: [
      { id: 0, name: "Fat Brass", inst: "brass_section", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Dyno Tine EP", inst: "electric_piano_1", fx: "clean", gain: 0.65, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Prodigy Bass", inst: "synth_bass_1", fx: "punch_comp", gain: 0.75, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Triton Warm Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.50, pan: 0, oct: 1, minVel: 1, maxVel: 127, enabled: false },
    ],
  },
  hard_rock_shred: {
    id: "hard_rock_shred",
    name: "★ Hard Rock Shred (Distortion Lead + Overdrive + Bass)",
    category: "Rock / Metal",
    layers: [
      { id: 0, name: "Distortion Guitar Lead", inst: "distortion_guitar", fx: "tube_lead", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Heavy Overdrive Rhythm", inst: "overdriven_guitar", fx: "tube_warm", gain: 0.80, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Punch Rock Bass", inst: "synth_bass_1", fx: "punch_comp", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "B3 Rock Organ Pad", inst: "drawbar_organ", fx: "clean", gain: 0.60, pan: 0, oct: 0, minVel: 30, maxVel: 127, enabled: true },
    ],
  },
  smooth_latin_jazz: {
    id: "smooth_latin_jazz",
    name: "★ Smooth Latin Jazz (Nylon Guitar + Breathy Sax + Grand)",
    category: "Jazz / Fusion",
    layers: [
      { id: 0, name: "Fantom Nylon Guitar", inst: "acoustic_guitar_nylon", fx: "reverb_room", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Breathy Alto Sax", inst: "alto_sax", fx: "reverb_room", gain: 0.85, pan: 0, oct: 0, minVel: 40, maxVel: 127, enabled: true },
      { id: 2, name: "Concert Grand Chords", inst: "acoustic_grand_piano", fx: "clean", gain: 0.70, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Acoustic Sub Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.65, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  synthwave_80s_drive: {
    id: "synthwave_80s_drive",
    name: "★ Cyberpunk Synthwave (Fat Brass + FM Tine + Moog Bass)",
    category: "Synthwave / Retro",
    layers: [
      { id: 0, name: "Fat Brass Lead", inst: "brass_section", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "FM 80s Crystal Bell", inst: "electric_piano_1", fx: "clean", gain: 0.70, pan: 0, oct: 1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Moog Prodigy Punch Bass", inst: "synth_bass_1", fx: "punch_comp", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Stereo Chorus Strings", inst: "string_ensemble_1", fx: "clean", gain: 0.55, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  acoustic_cafe_lounge: {
    id: "acoustic_cafe_lounge",
    name: "★ Acoustic Cafe Lounge (Nylon Guitar + Sax + Upright)",
    category: "Acoustic / Lounge",
    layers: [
      { id: 0, name: "Acoustic Nylon Guitar", inst: "acoustic_guitar_nylon", fx: "reverb_room", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Abletunes Upright Piano", inst: "abletunes_upright", fx: "warm_eq", gain: 0.90, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Breathy Alto Saxophone", inst: "alto_sax", fx: "reverb_room", gain: 0.80, pan: 0, oct: 0, minVel: 40, maxVel: 127, enabled: true },
      { id: 3, name: "Soft Strings Background", inst: "string_ensemble_1", fx: "clean", gain: 0.45, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  vintage_funk_fusion: {
    id: "vintage_funk_fusion",
    name: "★ Vintage Funk Fusion (M1 Slap Bass + Rock Organ + Strat)",
    category: "Funk / Fusion",
    layers: [
      { id: 0, name: "Fender Strat Clean Guitar", inst: "electric_guitar_clean", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Korg M1 B3 Rock Organ", inst: "drawbar_organ", fx: "clean", gain: 0.85, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Punch Slap Bass", inst: "synth_bass_1", fx: "punch_comp", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Fat Horn Stabs", inst: "brass_section", fx: "tube_warm", gain: 0.70, pan: 0, oct: 0, minVel: 75, maxVel: 127, enabled: false },
    ],
  },
  power_ballad_1989: {
    id: "power_ballad_1989",
    name: "★ Power Ballad 1989 (Foster Piano + Dyno EP + Warm Strings)",
    category: "Power Ballad",
    layers: [
      { id: 0, name: "Concert Grand Piano", inst: "acoustic_grand_piano", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Dyno 80s Stage EP", inst: "electric_piano_1", fx: "clean", gain: 0.70, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Triton Warm Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.65, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Strat Clean Arp", inst: "electric_guitar_clean", fx: "clean", gain: 0.55, pan: 0, oct: 0, minVel: 40, maxVel: 127, enabled: true },
    ],
  },
  gospel_cathedral: {
    id: "gospel_cathedral",
    name: "★ Gospel Cathedral (M1 Organ 2 + Choir + Grand)",
    category: "Gospel & Praise",
    layers: [
      { id: 0, name: "Concert Grand Piano", inst: "acoustic_grand_piano", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Korg M1 / B3 Gospel Organ", inst: "drawbar_organ", fx: "clean", gain: 0.85, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Korg M1 Ooh-Ahh Vocal Choir", inst: "choir_aahs", fx: "reverb_hall", gain: 0.75, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Fat Brass Fanfare", inst: "brass_section", fx: "tube_warm", gain: 0.60, pan: 0, oct: 0, minVel: 85, maxVel: 127, enabled: false },
    ],
  },
  cyberpunk_arena: {
    id: "cyberpunk_arena",
    name: "★ Cyberpunk 2077 Arena (Distortion + Moog Bass + Fresh Air)",
    category: "Rock / Synth",
    layers: [
      { id: 0, name: "Distortion Heavy Lead", inst: "distortion_guitar", fx: "distortion_metal", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Moog Prodigy Punch Bass", inst: "synth_bass_1", fx: "punch_comp", gain: 0.90, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Fat Brass Swell", inst: "brass_section", fx: "air_eq", gain: 0.65, pan: 0, oct: 0, minVel: 30, maxVel: 127, enabled: true },
      { id: 3, name: "Stereo Tine Chime", inst: "electric_piano_1", fx: "clean", gain: 0.55, pan: 0, oct: 1, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  cinematic_symphony: {
    id: "cinematic_symphony",
    name: "★ Cinematic Symphony (Stereo Strings + Fat Brass + Grand)",
    category: "Cinematic / Film",
    layers: [
      { id: 0, name: "Triton Stereo Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Fat Brass Horns", inst: "brass_section", fx: "air_eq", gain: 0.80, pan: 0, oct: 0, minVel: 30, maxVel: 127, enabled: true },
      { id: 2, name: "Velo Piano Accent", inst: "acoustic_grand_piano", fx: "clean", gain: 0.80, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Breathy Alto Saxophone", inst: "alto_sax", fx: "reverb_room", gain: 0.75, pan: 0, oct: 0, minVel: 50, maxVel: 127, enabled: true },
    ],
  },
  chicago_blues_rock: {
    id: "chicago_blues_rock",
    name: "★ Chicago Blues & Rock (Clean Strat + B3 Organ + Bass)",
    category: "Blues / Rock",
    layers: [
      { id: 0, name: "Fender Strat Clean Guitar", inst: "electric_guitar_clean", fx: "tube_warm", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Korg M1 B3 Rock Organ", inst: "drawbar_organ", fx: "clean", gain: 0.85, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Punch Blues Bass", inst: "synth_bass_1", fx: "punch_comp", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Breathy Blues Sax", inst: "alto_sax", fx: "reverb_room", gain: 0.80, pan: 0, oct: 0, minVel: 40, maxVel: 127, enabled: true },
    ],
  },
  tokyo_city_pop: {
    id: "tokyo_city_pop",
    name: "★ Tokyo City Pop (FM Piano + Clean Strat + Sax + EP)",
    category: "Pop / Funk",
    layers: [
      { id: 0, name: "Abletunes FM Piano", inst: "abletunes_fm_piano", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Fender Strat Clean", inst: "electric_guitar_clean", fx: "clean", gain: 0.75, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Breathy Alto Sax Solo", inst: "alto_sax", fx: "reverb_room", gain: 0.85, pan: 0, oct: 0, minVel: 40, maxVel: 127, enabled: true },
      { id: 3, name: "Punch Synth Bass", inst: "synth_bass_1", fx: "punch_comp", gain: 0.80, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  neo_classical_ambient: {
    id: "neo_classical_ambient",
    name: "★ Neo-Classical Ambient (Grand + Nylon + Strings)",
    category: "Neo-Classical",
    layers: [
      { id: 0, name: "Velo Piano Concert Grand", inst: "acoustic_grand_piano", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Fantom Acoustic Nylon", inst: "acoustic_guitar_nylon", fx: "reverb_hall", gain: 0.85, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Triton Stereo Strings", inst: "string_ensemble_1", fx: "clean", gain: 0.65, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Breathy Alto Sax", inst: "alto_sax", fx: "reverb_room", gain: 0.70, pan: 0, oct: 0, minVel: 50, maxVel: 127, enabled: false },
    ],
  },
  acid_jazz_groove: {
    id: "acid_jazz_groove",
    name: "Acid Jazz Groove (FM Tine + Slap Bass + B3 + Sax)",
    category: "Jazz / Acid Jazz",
    layers: [
      { id: 0, name: "Dyno FM Tine", inst: "electric_piano_1", fx: "chorus_lush", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Korg M1 Slap Bass", inst: "synth_bass_1", fx: "punch_comp", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "B3 Groove Organ", inst: "drawbar_organ", fx: "rotary_slow", gain: 0.70, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Breathy Sax Stabs", inst: "alto_sax", fx: "reverb_room", gain: 0.70, pan: 0, oct: 0, minVel: 80, maxVel: 127, enabled: true },
    ],
  },
  blue_note_trio: {
    id: "blue_note_trio",
    name: "Blue Note Trio (Upright + Nylon + Walking Bass)",
    category: "Jazz / Straight-Ahead",
    layers: [
      { id: 0, name: "Upright Acoustic Piano", inst: "abletunes_upright", fx: "warm_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Nylon Comping Guitar", inst: "acoustic_guitar_nylon", fx: "reverb_room", gain: 0.70, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Walking Sub Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.75, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Late Night Sax", inst: "alto_sax", fx: "reverb_plate", gain: 0.65, pan: 0, oct: 0, minVel: 45, maxVel: 127, enabled: true },
    ],
  },
  jazz_funk_soul: {
    id: "jazz_funk_soul",
    name: "Jazz-Funk Soul (Suitcase EP + Moog Bass + Horns)",
    category: "Jazz / Funk",
    layers: [
      { id: 0, name: "Suitcase Stage EP", inst: "electric_piano_1", fx: "autopan_wide", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Moog Funk Bass", inst: "synth_bass_1", fx: "punch_comp", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Fat Horn Stabs", inst: "brass_section", fx: "tube_warm", gain: 0.70, pan: 0, oct: 0, minVel: 75, maxVel: 127, enabled: true },
      { id: 3, name: "Gospel B3 Swell", inst: "drawbar_organ", fx: "clean", gain: 0.55, pan: 0, oct: 0, minVel: 30, maxVel: 127, enabled: true },
    ],
  },
  bossa_nova_sunset: {
    id: "bossa_nova_sunset",
    name: "★ Bossa Nova Sunset (Nylon Guitar + Grand + Vibraphone)",
    category: "Latin / Bossa Nova",
    layers: [
      { id: 0, name: "Nylon Fingerstyle Lead", inst: "acoustic_guitar_nylon", fx: "reverb_room", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Warm Acoustic Piano", inst: "abletunes_upright", fx: "clean", gain: 0.70, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Vibraphone Chime", inst: "vibraphone", fx: "chorus_vintage", gain: 0.45, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, minNote: 60, enabled: true },
      { id: 3, name: "Upright Acoustic Bass", inst: "acoustic_bass", fx: "warm_eq", gain: 0.80, pan: 0, oct: -1, minVel: 1, maxVel: 127, maxNote: 59, enabled: true },
    ],
  },
  sun_rai_street: {
    id: "sun_rai_street",
    name: "San Francisco Street (Sun Rai Rhodes Bed)",
    category: "Soul-Pop / R&B",
    layers: [
      { id: 0, name: "Suitcase Rhodes 73", inst: "rhodes_stage_mp3", fx: "autopan_wide", gain: 0.85, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Rhodes Shimmer Chorus", inst: "rhodes_stage_mp3", fx: "chorus_lush", gain: 0.25, pan: 0, oct: 1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Pocket Bass Guitar", inst: "synth_bass_1", fx: "warm_eq", gain: 0.75, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Night Air Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.20, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  acid_jazz_afterhours: {
    id: "acid_jazz_afterhours",
    name: "★ Acid Jazz Groove (Rhodes + B3 Rotary + Slap Bass)",
    category: "Jazz / Acid Jazz",
    layers: [
      { id: 0, name: "Vintage Stage Rhodes", inst: "rhodes_stage_mp3", fx: "delay_tape", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Korg M1 Slap Bass", inst: "m1_slap_bass", fx: "punch_comp", gain: 0.85, pan: -0.05, oct: -1, minVel: 1, maxVel: 127, maxNote: 59, enabled: true },
      { id: 2, name: "Midnight B3 Bed", inst: "drawbar_organ", fx: "rotary_slow", gain: 0.55, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Sensual Alto Sax", inst: "alto_sax", fx: "reverb_plate", gain: 0.80, pan: 0.05, oct: 0, minVel: 85, maxVel: 127, minNote: 60, enabled: true },
    ],
  },
  bebop_quartet: {
    id: "bebop_quartet",
    name: "★ Blue Note Trio (Upright + Nylon + Upright Bass)",
    category: "Jazz / Blue Note",
    layers: [
      { id: 0, name: "Abletunes Studio Upright", inst: "abletunes_upright", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Celestial Universe Pad", inst: "m1_universe", fx: "reverb_hall", gain: 0.35, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Warm Upright Bass", inst: "acoustic_bass", fx: "warm_eq", gain: 0.80, pan: -0.05, oct: -1, minVel: 1, maxVel: 127, maxNote: 59, enabled: true },
      { id: 3, name: "Warm Nylon Comping", inst: "acoustic_guitar_nylon", fx: "clean", gain: 0.35, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  smooth_jazz_radio: {
    id: "smooth_jazz_radio",
    name: "Smooth Jazz Radio (FM Lead + Sax Melody + Silk Pad)",
    category: "Jazz / Smooth",
    layers: [
      { id: 0, name: "Silk FM Lead", inst: "abletunes_fm_piano", fx: "chorus_vintage", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Soprano-Style Sax Melody", inst: "alto_sax", fx: "reverb_hall", gain: 0.80, pan: 0, oct: 1, minVel: 40, maxVel: 127, enabled: true },
      { id: 2, name: "Silk Pad Underneath", inst: "string_ensemble_1", fx: "clean", gain: 0.50, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Smooth Sub Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.70, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  jazz_waltz_3am: {
    id: "jazz_waltz_3am",
    name: "3AM Jazz Waltz (Upright + Strings + Nylon Lullaby)",
    category: "Jazz / Ballad",
    layers: [
      { id: 0, name: "3AM Upright Piano", inst: "abletunes_upright", fx: "reverb_hall", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Lullaby Strings", inst: "string_ensemble_1", fx: "clean", gain: 0.60, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Nylon Whisper", inst: "acoustic_guitar_nylon", fx: "reverb_room", gain: 0.60, pan: 0.05, oct: 0, minVel: 20, maxVel: 127, enabled: true },
      { id: 3, name: "Distant Sax Memory", inst: "alto_sax", fx: "reverb_plate", gain: 0.55, pan: 0, oct: 0, minVel: 60, maxVel: 127, enabled: false },
    ],
  },
  funk_brothers: {
    id: "funk_brothers",
    name: "Funk Brothers (Strat Wah + Slap Bass + B3 + Horns)",
    category: "Funk / Soul",
    layers: [
      { id: 0, name: "Wah Strat Rhythm", inst: "electric_guitar_clean", fx: "autopan_fast", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Slap Funk Bass", inst: "synth_bass_1", fx: "punch_comp", gain: 0.90, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "B3 Funk Comp", inst: "drawbar_organ", fx: "rotary_fast", gain: 0.70, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Tower Horn Stabs", inst: "brass_section", fx: "tube_warm", gain: 0.75, pan: 0, oct: 0, minVel: 75, maxVel: 127, enabled: true },
    ],
  },
  soul_train_70s: {
    id: "soul_train_70s",
    name: "Soul Train 70s (FM Soul EP + Strings + Brass + B3)",
    category: "Soul / 70s",
    layers: [
      { id: 0, name: "70s Soul FM EP", inst: "abletunes_fm_piano", fx: "tremolo_pulse", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Philly Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.65, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Soul Brass Section", inst: "brass_section", fx: "clean", gain: 0.70, pan: 0, oct: 0, minVel: 60, maxVel: 127, enabled: true },
      { id: 3, name: "Church B3 Underneath", inst: "drawbar_organ", fx: "clean", gain: 0.55, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  lofi_study_beats: {
    id: "lofi_study_beats",
    name: "★ Lo-Fi Study Beats (Felt Upright Piano + Vibraphone + Upright Bass)",
    category: "Lo-Fi / Chill",
    layers: [
      { id: 0, name: "Abletunes Felt Upright Piano", inst: "abletunes_upright", fx: "clean", gain: 0.90, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Cool Jazzy Vibraphone", inst: "vibraphone", fx: "reverb_room", gain: 0.55, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, minNote: 60, enabled: true },
      { id: 2, name: "Mellow Upright Bass", inst: "acoustic_bass", fx: "warm_eq", gain: 0.65, pan: -0.05, oct: -1, minVel: 1, maxVel: 127, maxNote: 59, enabled: true },
      { id: 3, name: "Korg M1 Universe Air", inst: "m1_universe", fx: "clean", gain: 0.50, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  gospel_shout: {
    id: "gospel_shout",
    name: "Gospel Shout (Shouting B3 + Piano + Brass + Choir)",
    category: "Gospel / Shout",
    layers: [
      { id: 0, name: "Shouting B3 Organ", inst: "drawbar_organ", fx: "rotary_fast", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Gospel Piano Drive", inst: "acoustic_grand_piano", fx: "punch_comp", gain: 0.85, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Shout Brass Fanfare", inst: "brass_section", fx: "tube_warm", gain: 0.75, pan: 0, oct: 0, minVel: 70, maxVel: 127, enabled: true },
      { id: 3, name: "Mass Choir Lift", inst: "m1_choir", fx: "reverb_hall", gain: 0.65, pan: 0, oct: 0, minVel: 40, maxVel: 127, enabled: true },
    ],
  },
  yamaha_cfx_stage: {
    id: "yamaha_cfx_stage",
    name: "CFX Stage Grand (Bright Grand + Strings + Shimmer)",
    category: "Piano / Stage",
    layers: [
      { id: 0, name: "Bright Stage Grand", inst: "acoustic_grand_piano", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Live Concert Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.60, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "FM Sparkle Top", inst: "abletunes_fm_piano", fx: "clean", gain: 0.40, pan: 0.05, oct: 1, minVel: 50, maxVel: 127, enabled: true },
      { id: 3, name: "Stage Sub Bass", inst: "acoustic_bass", fx: "warm_eq", gain: 0.70, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  sweet_soprano_ballad: {
    id: "sweet_soprano_ballad",
    name: "Sweet Soprano Ballad (Soprano Lead + Grand + Pad)",
    category: "Ballad / Smooth",
    layers: [
      { id: 0, name: "Concert Grand Bed", inst: "acoustic_grand_piano", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Sweet Soprano Lead", inst: "soprano_sax", fx: "reverb_hall", gain: 0.85, pan: 0, oct: 0, minVel: 40, maxVel: 127, enabled: true },
      { id: 2, name: "Velvet Warm Pad", inst: "string_ensemble_1", fx: "clean", gain: 0.50, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Upright Bass Walk", inst: "acoustic_bass", fx: "warm_eq", gain: 0.70, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  unplugged_morning: {
    id: "unplugged_morning",
    name: "Unplugged Morning (Steel Guitar + Upright Bass + Nylon)",
    category: "Acoustic / Unplugged",
    layers: [
      { id: 0, name: "Steel-String Strum", inst: "acoustic_guitar_steel", fx: "reverb_room", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Upright Bass Root", inst: "acoustic_bass", fx: "warm_eq", gain: 0.80, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Nylon Fingerpick", inst: "acoustic_guitar_nylon", fx: "clean", gain: 0.60, pan: 0.05, oct: 0, minVel: 30, maxVel: 127, enabled: true },
      { id: 3, name: "Morning Flute Air", inst: "flute", fx: "reverb_hall", gain: 0.50, pan: 0, oct: 1, minVel: 60, maxVel: 127, enabled: false },
    ],
  },
  sunday_pipe_praise: {
    id: "sunday_pipe_praise",
    name: "Sunday Pipe Praise (Pipe Organ + Choir + Trumpet)",
    category: "Gospel / Worship",
    layers: [
      { id: 0, name: "Cathedral Pipe Organ", inst: "church_organ", fx: "reverb_hall", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Aahs Choir Swell", inst: "choir_aahs", fx: "reverb_hall", gain: 0.70, pan: 0, oct: 0, minVel: 20, maxVel: 127, enabled: true },
      { id: 2, name: "Grand Piano Accent", inst: "acoustic_grand_piano", fx: "clean", gain: 0.70, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Trumpet Fanfare Lift", inst: "trumpet", fx: "clean", gain: 0.65, pan: 0, oct: 0, minVel: 75, maxVel: 127, enabled: true },
    ],
  },
  yacht_rock_79: {
    id: "yacht_rock_79",
    name: "Yacht Rock 79 (FM EP + Steel Guitar + Muted Horns)",
    category: "Pop / Yacht Rock",
    layers: [
      { id: 0, name: "Yacht FM EP", inst: "abletunes_fm_piano", fx: "chorus_lush", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Steel Guitar Licks", inst: "acoustic_guitar_steel", fx: "clean", gain: 0.65, pan: 0.05, oct: 0, minVel: 30, maxVel: 127, enabled: true },
      { id: 2, name: "Muted Horn Stabs", inst: "muted_trumpet", fx: "reverb_room", gain: 0.65, pan: 0, oct: 0, minVel: 75, maxVel: 127, enabled: true },
      { id: 3, name: "Slap Pocket Bass", inst: "slap_bass_1", fx: "punch_comp", gain: 0.80, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  shreddage_arena: {
    id: "shreddage_arena",
    name: "Shreddage Arena (High-Gain Lead + Rhythm + Punch Bass)",
    category: "Rock / Metal",
    layers: [
      { id: 0, name: "Shreddage Lead Guitar", inst: "distortion_guitar", fx: "shred_stack", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Overdrive Rhythm Double", inst: "overdriven_guitar", fx: "tube_warm", gain: 0.80, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Punch Arena Bass", inst: "synth_bass_1", fx: "punch_comp", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Arena Rock Organ Pad", inst: "drawbar_organ", fx: "clean", gain: 0.50, pan: 0, oct: 0, minVel: 30, maxVel: 127, enabled: true },
    ],
  },

  synthesizer_you: {
    id: "synthesizer_you",
    name: "★ Synthesizer You (Neo-Soul Rhodes Bed)",
    category: "Neo-Soul / Chill",
    layers: [
      { id: 0, name: "Studio DX7 FM / Stage EP", inst: "abletunes_fm_piano", fx: "autopan_wide", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Celestial Universe Pad", inst: "m1_universe", fx: "reverb_hall", gain: 0.35, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Analog Sub Bass", inst: "synth_bass_1", fx: "clean", gain: 0.70, pan: -0.05, oct: -1, minVel: 1, maxVel: 127, maxNote: 59, enabled: true },
      { id: 3, name: "Silky Ambient Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.30, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: false },
    ],
  },

  final_countdown: {
    id: "final_countdown",
    name: "🎸 The Final Countdown (Europe - Synth Lead & Pad)",
    category: "Synthesizer / Retro",
    layers: [
      { id: 0, name: "Final Countdown Lead", inst: "supersaw_lead", fx: "synth_lead", gain: 0.75, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Final Countdown Pad", inst: "m1_universe", fx: "reverb_hall", gain: 0.60, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },

  europe_ambient: {
    id: "europe_ambient",
    name: "🪐 Europe Ambient (Choir Shimmer Pad)",
    category: "Synthesizer / Ambient",
    layers: [
      { id: 0, name: "Final Countdown Pad", inst: "m1_universe", fx: "reverb_hall", gain: 0.65, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },

  afro_cuban_congas: {
    id: "afro_cuban_congas",
    name: "🪘 Afro-Cuban Congas & Latin Percussion Stack",
    category: "Percussion & Drums",
    layers: [
      { id: 0, name: "High & Low Congas", inst: "percussion_conga", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Latin Shaker & Maracas", inst: "percussion_shaker", fx: "air_eq", gain: 0.65, pan: 0.15, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Brass Section Cowbell", inst: "percussion_cowbell", fx: "clean", gain: 0.70, pan: -0.15, oct: 0, minVel: 60, maxVel: 127, enabled: true },
      { id: 3, name: "Mark Tree Wind Chimes", inst: "wind_chimes", fx: "reverb_hall", gain: 0.60, pan: 0.10, oct: 1, minVel: 85, maxVel: 127, enabled: false },
    ],
  },

  analog_synth_drum_space: {
    id: "analog_synth_drum_space",
    name: "🥁 Simmons SDSV Analog Synth Drum (80s Space)",
    category: "Percussion & Drums",
    layers: [
      { id: 0, name: "Simmons SDSV Pitch-Sweep Drum", inst: "synth_drum", fx: "tape_sat_master", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "TR-808 Analog Kit", inst: "tr808_kit", fx: "clean", gain: 0.80, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Analog Synth Bassline", inst: "synth_bass_1", fx: "tape_sat_master", gain: 0.75, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "White Noise Sweep Riser", inst: "noise_riser", fx: "reverb_hall", gain: 0.50, pan: 0, oct: 0, minVel: 90, maxVel: 127, enabled: false },
    ],
  },

  studio_acoustic_kit: {
    id: "studio_acoustic_kit",
    name: "🥁 Real Studio Acoustic Drum Kit (Zero-Latency)",
    category: "Percussion & Drums",
    layers: [
      { id: 0, name: "Acoustic Drum Kit Master", inst: "real_drum_kit", fx: "punch_comp", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Latin Cowbell & Ride Bell", inst: "percussion_cowbell", fx: "clean", gain: 0.75, pan: 0.15, oct: 0, minVel: 65, maxVel: 127, enabled: true },
      { id: 2, name: "Afro-Cuban Congas", inst: "percussion_conga", fx: "clean", gain: 0.70, pan: -0.15, oct: 0, minVel: 45, maxVel: 127, enabled: true },
      { id: 3, name: "Studio Wind Chimes", inst: "wind_chimes", fx: "reverb_hall", gain: 0.60, pan: 0.20, oct: 0, minVel: 85, maxVel: 127, enabled: false },
    ],
  },
};

export class MultiLayerEngine {
  constructor() {
    this.pcmEngine = null;
    this.activeCombi = COMBI_PRESETS.ballad_master;
    this.isCombiMode = true; // Signature Synthage + Triton Strings Combi active on boot!
    this.isSynthMode = false;
    this.isTritonVaMode = false;
    this.activeTritonVaProg = null;
    this.activeSingleInst = "acoustic_grand_piano";
    this.synthPatch = null;
    this.layers = JSON.parse(JSON.stringify(this.activeCombi.layers));
    this.layers.forEach(layer => {
      if (layer.inst && layer.inst.startsWith("va:")) {
        const prog = getTritonProgramById(layer.inst.slice(3));
        if (prog) layer.vaProg = prog;
      }
    });
    this.isDualLayerActive = false; // Dedicated dual-layer toggle state for live stage performance

    // Keyboard split: two fully assignable zones. Notes below splitPointMidi hit the
    // LOWER zone; notes at/above hit the UPPER zone. Each zone carries its own
    // instrument, insert FX, gain and octave shift, routed through dedicated split
    // insert buses (lower/upper) exactly like a combi rack strip.
    this.isSplitMode = false;
    this.splitPointMidi = 60; // Middle C split
    this.splitZones = {
      lower: { inst: "synth_bass_1", name: "Moog Prodigy Punch Bass", fx: "clean", gain: 1.0, oct: 0 },
      upper: { inst: null, name: null, fx: "clean", gain: 1.0, oct: 0 }, // inst null = follow current stack
    };
    this.onSplitChangeCallback = null;
    this.splitChangeListeners = new Set();

    this.onNoteChangeCallback = null;
    this.onPanicCallback = null;
    this._panicHooks = new Set();

    this.onLayerChangeCallback = null;
    this.layerChangeListeners = new Set();
    this._vaEngines = new Map(); // VA oscillator engine per combi layer program

    // AudioWorklet bridge: live VA notes route here for zero-jank playback
    this._workletNode = null;
    this._workletReady = false;

    // PCM AudioWorklet: sample playback on the audio thread
    this._pcmWorkletNode = null;
    this._pcmWorkletReady = false;

    // Held-note max sustain (no pedal): notes ring while keys are held, then
    // fade after heldNoteSec. Sustain pedal state tracked here for the timers.
    this.sustainPedalActive = false;
    this.heldNotes = new Set();
    this._heldNoteTimers = new Map();

    // Ambient Pad Sidechain Ducking: smoothly dips Layer 1 (pad/strings) when Layer 0 (piano/lead) plays
    this.isPadDuckingEnabled = false;
    try {
      if (typeof localStorage !== "undefined") {
        this.isPadDuckingEnabled = localStorage.getItem("wilsonix_pad_ducking") === "1";
      }
    } catch (e) {}
    this.activeLeadNotes = 0;
    this.padDuckingListeners = new Set();

    // User settings (persisted to localStorage)
    this.settings = {
      // Sustain
      sustainHoldSec: 7,      // pedal held: auto-release timeout (3–30s)
      sustainDecayTau: 2.4,   // pedal held: decay rate (0.5–8s)
      heldNoteSec: 15,        // NO pedal, key held: rings for this long, then fades (2–60s)
      // Audio
      polyphonyCap: 128,       // max simultaneous voices (16–128)
      masterVolumePct: 50,    // default master volume on load (0–100)
      // Keyboard
      defaultOctave: 4,       // starting octave (1–7)
      defaultVelocity: 95,    // default note velocity (1–127)
      // UI
      theme: "dark",          // "dark" or "light"
      tabRestore: true,       // remember last active tab on reload
      lastTab: "keys",        // last active tab
    };
    try {
      if (typeof localStorage !== "undefined") {
        const raw = JSON.parse(localStorage.getItem("wilsonix_settings"));
        if (raw && typeof raw === "object") {
          const s = this.settings;
          if (typeof raw.sustainHoldSec === "number") s.sustainHoldSec = Math.max(3, Math.min(30, raw.sustainHoldSec));
          if (typeof raw.sustainDecayTau === "number") s.sustainDecayTau = Math.max(0.5, Math.min(8, raw.sustainDecayTau));
          if (typeof raw.heldNoteSec === "number") s.heldNoteSec = Math.max(2, Math.min(60, raw.heldNoteSec));
          if (typeof raw.polyphonyCap === "number") s.polyphonyCap = Math.max(16, Math.min(128, raw.polyphonyCap));
          if (typeof raw.masterVolumePct === "number") s.masterVolumePct = Math.max(0, Math.min(100, raw.masterVolumePct));
          if (typeof raw.defaultOctave === "number") s.defaultOctave = Math.max(1, Math.min(7, raw.defaultOctave));
          if (typeof raw.defaultVelocity === "number") s.defaultVelocity = Math.max(1, Math.min(127, raw.defaultVelocity));
          if (raw.theme === "dark" || raw.theme === "light") s.theme = raw.theme;
          if (typeof raw.tabRestore === "boolean") s.tabRestore = raw.tabRestore;
          if (typeof raw.lastTab === "string") s.lastTab = raw.lastTab;
        }
      }
    } catch (e) {}
  }

  updateSetting(key, value) {
    const s = this.settings;
    switch (key) {
      case "sustainHoldSec": s.sustainHoldSec = Math.max(3, Math.min(30, Number(value) || 7)); break;
      case "sustainDecayTau": s.sustainDecayTau = Math.max(0.5, Math.min(8, Number(value) || 2.4)); break;
      case "heldNoteSec": s.heldNoteSec = Math.max(2, Math.min(60, Number(value) || 15)); break;
      case "polyphonyCap": s.polyphonyCap = Math.max(16, Math.min(128, Number(value) || 64)); break;
      case "masterVolumePct": s.masterVolumePct = Math.max(0, Math.min(100, Number(value) || 50)); break;
      case "defaultOctave": s.defaultOctave = Math.max(1, Math.min(7, Number(value) || 4)); break;
      case "defaultVelocity": s.defaultVelocity = Math.max(1, Math.min(127, Number(value) || 95)); break;
      case "theme": s.theme = value === "light" ? "light" : "dark"; break;
      case "tabRestore": s.tabRestore = !!value; break;
      case "lastTab": s.lastTab = String(value || "keys"); break;
    }
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("wilsonix_settings", JSON.stringify(s));
      }
    } catch (e) {}
    // Apply immediately where needed
    if (key === "masterVolumePct" && audioCore) {
      try { audioCore.setMasterVolume(s.masterVolumePct / 100); } catch (e) {}
    }
    if (key === "polyphonyCap" && this.pcmEngine) {
      this.pcmEngine.MAX_VOICES = s.polyphonyCap;
    }
    if (key === "sustainDecayTau" && this._workletReady && this._workletNode) {
      try { this._workletNode.setParam("sustainTau", s.sustainDecayTau); } catch (e) {}
    }
    if (key === "sustainHoldSec" || key === "sustainDecayTau" || key === "heldNoteSec") {
      if (this._pcmWorkletNode && this._pcmWorkletNode.setSustainSettings) {
        this._pcmWorkletNode.setSustainSettings(s.sustainHoldSec, s.sustainDecayTau, s.heldNoteSec);
      }
      if (this.pcmEngine && this.pcmEngine.updateSustainSettings) {
        this.pcmEngine.updateSustainSettings(s.sustainHoldSec, s.sustainDecayTau, s.heldNoteSec);
      }
    }
    if (key === "theme") {
      document.documentElement.setAttribute("data-theme", s.theme);
    }
  }

  togglePadDucking(enabled) {
    this.isPadDuckingEnabled = enabled !== undefined ? !!enabled : !this.isPadDuckingEnabled;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("wilsonix_pad_ducking", this.isPadDuckingEnabled ? "1" : "0");
      }
    } catch (e) {}

    // If disabled while notes are sustained, restore layer 1 gain immediately
    if (!this.isPadDuckingEnabled && this.pcmEngine && this.pcmEngine.layerInserts && this.pcmEngine.layerInserts[1]) {
      const ctx = audioCore.ctx;
      if (ctx) {
        this.pcmEngine.layerInserts[1].input.gain.setTargetAtTime(1.0, ctx.currentTime, 0.05);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wilsonix-pad-ducking-changed", { detail: { enabled: this.isPadDuckingEnabled } }));
    }
    for (const cb of this.padDuckingListeners) {
      try { cb(this.isPadDuckingEnabled); } catch (e) {}
    }
  }

  addPadDuckingListener(cb) {
    if (typeof cb === "function") this.padDuckingListeners.add(cb);
  }

  removePadDuckingListener(cb) {
    this.padDuckingListeners.delete(cb);
  }

  setMasterFilter(cutoffHz, resonance = 1.0) {
    audioCore.setMasterFilter(cutoffHz, resonance);
  }

  setSpaceSend(amount) {
    audioCore.setSpaceSend(amount);
  }

  getVaEngineFor(prog, gain = 1, slotIdx = 0) {
    const key = "va_slot_" + slotIdx;
    let eng = this._vaEngines.get(key);
    if (!eng) {
      eng = new TritonVirtualAnalogEngine();
      eng._sustainSettings = this.settings;
      this.init();
      eng.init();
      this._vaEngines.set(key, eng);
    }
    eng.setProgram(prog);
    this._syncWorkletParams(prog);
    if (typeof gain === "number" && gain > 0 && eng.config) {
      eng.config.masterGain = 0.82 * Math.min(1.15, Math.max(0.5, gain));
    }
    return eng;
  }

  vaAllNotesOff() {
    this._vaEngines.forEach(eng => {
      try { eng.allNotesOff(); } catch (err) { /* voice pool may be mid-init */ }
    });
  }

  addLayerChangeListener(cb) {
    if (typeof cb === "function") this.layerChangeListeners.add(cb);
  }

  removeLayerChangeListener(cb) {
    this.layerChangeListeners.delete(cb);
  }

  notifyLayerChange() {
    if (this.onLayerChangeCallback) {
      try { this.onLayerChangeCallback(this.layers); } catch (e) {}
    }
    for (const cb of this.layerChangeListeners) {
      try { cb(this.layers); } catch (e) {}
    }
    this.saveSessionSoon();
  }

  setMasterVolumePct(pct) {
    this._masterPct = Math.max(0, Math.min(100, Math.round(pct)));
    try {
      audioCore.setMasterVolume(this._masterPct / 100);
    } catch (e) {}
    this.saveSessionSoon();
  }

  // ---- Crash/refresh-proof session: autosaved working state, restored on boot ----
  markCleanShutdown() {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem("wilsonix_clean_prev", "1");
    } catch (e) {}
  }

  checkCrashRecovery() {
    try {
      if (typeof localStorage === "undefined") return false;
      const clean = localStorage.getItem("wilsonix_clean_prev") === "1";
      localStorage.removeItem("wilsonix_clean_prev");
      return !clean;
    } catch (e) {
      return false;
    }
  }

  saveSessionSoon() {
    try {
      clearTimeout(this._sessTimer);
    } catch (e) {}
    this._sessTimer = setTimeout(() => this.saveSessionNow(), 400);
  }

  saveSessionNow() {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem("wilsonix_session_v1", JSON.stringify({
        layers: this.layers,
        isCombiMode: this.isCombiMode,
        activeCombiId: this.activeCombi?.id || null,
        activeCombiName: this.activeCombi?.name || null,
        activeSingleInst: this.activeSingleInst,
        masterPct: this._masterPct ?? 50,
        split: {
          enabled: this.isSplitMode,
          pointMidi: this.splitPointMidi,
          zones: this.splitZones,
        },
      }));
    } catch (e) {}
  }

  restoreSession() {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem("wilsonix_session_v1");
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.layers) || s.layers.length !== 4) return null;
      if (!s.layers.every(l => l && typeof l.inst === "string")) return null;
      this.layers = s.layers;
      this.layers.forEach(layer => {
        if (layer.inst && layer.inst.startsWith("va:")) {
          const prog = getTritonProgramById(layer.inst.slice(3));
          if (prog) layer.vaProg = prog;
        }
      });
      this.isCombiMode = s.isCombiMode !== false;
      this.isSynthMode = false;
      if (this.isCombiMode && s.activeCombiId) {
        this.activeCombi = COMBI_PRESETS[s.activeCombiId] || {
          id: s.activeCombiId,
          name: s.activeCombiName || "Restored Stack",
          layers: this.layers,
        };
      } else if (!this.isCombiMode && s.activeSingleInst) {
        this.activeSingleInst = s.activeSingleInst;
      }
      if (typeof s.masterPct === "number") {
        this._masterPct = Math.max(0, Math.min(100, Math.round(s.masterPct)));
      }
      if (s.split && typeof s.split === "object") {
        this.isSplitMode = !!s.split.enabled;
        if (typeof s.split.pointMidi === "number") {
          this.splitPointMidi = Math.max(21, Math.min(108, Math.round(s.split.pointMidi)));
        }
        if (s.split.zones && s.split.zones.lower) this.splitZones.lower = { ...this.splitZones.lower, ...s.split.zones.lower };
        if (s.split.zones && s.split.zones.upper) this.splitZones.upper = { ...this.splitZones.upper, ...s.split.zones.upper };
      }
      this.init();
      this.syncLayerFx();
      this.syncSplitFx();
      return s;
    } catch (e) {
      return null;
    }
  }

  init() {
    if (!this.pcmEngine) {
      const ctx = audioCore.init();
      if (ctx) {
        // Route through FX Rack Input so Tube Overdrive, Distortion, Chorus, Rotary work on ALL sounds!
        this.pcmEngine = new NativePcmEngine(ctx, audioCore.fxRack.input);
        this._wireMemoryProviders();
      }
    }
    if (this.pcmEngine) {
      this.pcmEngine.MAX_VOICES = this.settings.polyphonyCap;
      this.pcmEngine._sustainSettings = this.settings;
      if (this.pcmEngine.updateSustainSettings) {
        this.pcmEngine.updateSustainSettings(
          this.settings.sustainHoldSec,
          this.settings.sustainDecayTau,
          this.settings.heldNoteSec
        );
      }
      this.syncLayerFx();
      this.syncSplitFx();
    }
    // Thread sustain settings to VA engines
    tritonVaEngine._sustainSettings = this.settings;
    this._vaEngines.forEach(eng => { eng._sustainSettings = this.settings; });

    // Bring up the audio worklets (VA synth + native PCM) on the high-priority
    // audio thread. This MUST run or every PCM/VA note silently falls back to
    // the main thread, which chokes under layered/combi or swept material
    // (choppy + dropped notes). Idempotent, so safe to call repeatedly.
    this._initWorklet().catch((e) => console.warn("[MLE] _initWorklet failed:", e));
  }

  /**
   * Registers the PCM engine with the memory manager so decoded sample RAM is
   * actually reclaimed under pressure (and monitored even without
   * performance.memory). The engine's own safe eviction guarantees only cold,
   * unpinned instruments are dropped — never the current preset or sounding
   * voices — so this adds no hiss/lag risk.
   */
  _wireMemoryProviders() {
    if (this._memoryWired) return;
    this._memoryWired = true;
    const getEngine = () => this.pcmEngine;
    const provider = () => {
      const eng = getEngine();
      if (!eng || typeof eng.getDecodedBufferStats !== "function") return null;
      const s = eng.getDecodedBufferStats();
      return { bytes: s.bytes, budget: s.budget };
    };
    const onEvict = (force = true) => {
      const eng = getEngine();
      if (!eng || typeof eng._safeEvictDecodedBuffers !== "function") return;
      try { eng._safeEvictDecodedBuffers(!!force); } catch (e) {}
    };
    registerBudgetProvider(provider);
    onMemoryEvict(() => onEvict(true));
    this.memoryProvider = provider;
  }

  /** Total active PCM voices (used by the Performance Logger's spike context). */
  getActiveVoiceCount() {
    try {
      return this.pcmEngine?.activeVoices?.size || 0;
    } catch (e) {
      return 0;
    }
  }

  async _initWorklet() {
    if (this._workletReady || this._workletNode) return this._workletNode;
    const ctx = audioCore.ctx;
    if (!ctx) return null;
    try {
      // Route through the FX Rack input (same as NativePcmEngine) so the worklet
      // gets the rack, masterFilter, busPad trim and DC blocker before the
      // limiter. Connecting straight to hardwareLimiter previously slammed the
      // limiter with an un-trimmed 16-voice sum - no busPad headroom, no DC
      // blocker - which read as constant limiter grab/release buzz.
      const dest =
        (audioCore.fxRack && audioCore.fxRack.input) ||
        audioCore.dcBlocker ||
        audioCore.masterGain ||
        ctx.destination;
      this._workletNode = new SynthWorkletNode(ctx, dest);
      // Synchronous visual feedback is dispatched directly from noteOn/noteOff with 0.00ms latency.
      // We explicitly avoid queuing asynchronous postMessage visual callbacks across threads to prevent visual lag.
      this._workletNode.onVisualCallback = null;
      const ok = await this._workletNode.init();
      if (ok) {
        this._workletReady = true;
        try { this._workletNode.setParam("sustainTau", this.settings.sustainDecayTau); } catch (e) {}
      } else {
        this._workletNode = null;
      }
    } catch (e) {
      console.warn("[MLE] Worklet init failed:", e);
      this._workletNode = null;
    }

    // PCM AudioWorklet: routes sample playback to the audio thread
    try {
      const pcmDest =
        (audioCore.fxRack && audioCore.fxRack.input) ||
        audioCore.dcBlocker ||
        audioCore.masterGain ||
        (audioCore.ctx && audioCore.ctx.destination);
      this._pcmWorkletNode = new PcmWorkletNode(audioCore.ctx, pcmDest);
      const pcmOk = await this._pcmWorkletNode.init();
      if (pcmOk) {
        this._pcmWorkletReady = true;
        this._pcmWorkletNode.setSustainSettings(
          this.settings.sustainHoldSec,
          this.settings.sustainDecayTau,
          this.settings.heldNoteSec
        );
        // Connect to NativePcmEngine so playNote routes to worklet
        if (this.pcmEngine) {
          this.pcmEngine.pcmWorkletNode = this._pcmWorkletNode;
          if (this.pcmEngine.updateSustainSettings) {
            this.pcmEngine.updateSustainSettings(
              this.settings.sustainHoldSec,
              this.settings.sustainDecayTau,
              this.settings.heldNoteSec
            );
          }
        }
        // Pre-load decoded sample buffers into worklet
        this._loadBuffersToWorklet();
      } else {
        this._pcmWorkletNode = null;
      }
    } catch (e) {
      console.warn("[MLE] PCM Worklet init failed:", e);
      this._pcmWorkletNode = null;
    }

    return this._workletNode;
  }

  _loadBuffersToWorklet() {
    if (!this._pcmWorkletReady || !this._pcmWorkletNode || !this.pcmEngine) return;
    try {
      const decodedBuffers = this.pcmEngine.decodedBuffers;
      if (!decodedBuffers) return;
      const w = this._pcmWorkletNode;
      const seen = new Set();
      decodedBuffers.forEach((instMap, instId) => {
        instMap.forEach((buf, anchorKey) => {
          if (!buf) return;
          // Layered maps carry STRING keys ("60_1") while the worklet looks up
          // by NUMERIC anchor midi. Normalize so layered instruments preload
          // correctly (otherwise every note transfers mid-play -> choppy).
          const midiKey = typeof anchorKey === "number"
            ? anchorKey
            : parseInt(String(anchorKey).split("_")[0], 10);
          if (!Number.isFinite(midiKey)) return;
          const dedupe = instId + ":" + midiKey;
          if (seen.has(dedupe)) return;
          seen.add(dedupe);
          w.ensureBuffer(instId, midiKey, buf);
        });
      });
    } catch (e) {
      console.warn("[MLE] Failed to load buffers to PCM worklet:", e);
    }
  }

  _syncWorkletParams(prog) {
    if (!this._workletReady || !this._workletNode || !prog) return;
    const WAVE_MAP = { sawtooth: 0, square: 1, triangle: 2, sine: 3 };
    const wave1 = WAVE_MAP[prog.osc1] ?? 0;
    const wave2 = WAVE_MAP[prog.osc2] ?? 1;
    this._workletNode.setParam("wave1", wave1);
    this._workletNode.setParam("wave2", wave2);
    this._workletNode.setParam("ratio1", prog.r1 || 1.0);
    this._workletNode.setParam("ratio2", prog.r2 || 1.0);
    const isBass = /(bass|sub)/i.test((prog.category || "") + " " + (prog.name || ""));
    this._workletNode.setParam("subLevel", isBass ? 0.35 : 0.0);
    if (prog.cutoff != null) this._workletNode.setParam("cutoff", Math.min(18000, Math.max(800, prog.cutoff * 1.5)));
    if (prog.Q != null) this._workletNode.setParam("resonance", Math.min(4.0, Math.max(0.5, prog.Q * 1.5)));
    if (prog.attack != null) this._workletNode.setParam("attack", Math.max(0.003, prog.attack));
    if (prog.decay != null) this._workletNode.setParam("decay", prog.decay);
    if (prog.sustain != null) this._workletNode.setParam("sustain", prog.sustain);
    if (prog.release != null) this._workletNode.setParam("release", Math.max(0.06, prog.release));
  }

  resolveBankKey(instKey) {
    if (!instKey) return "acoustic_grand_piano";
    const BANK_MAP = {
      synthage_grand: "acoustic_grand_piano",
      whitney_ballad: "acoustic_grand_piano",
      triton_dyno_ep: "electric_piano_1",
      triton_warm_strings: "string_ensemble_1",
      m1_rock_organ: "drawbar_organ",
      fantom_nylon_pluck: "acoustic_guitar_nylon",
      moog_punch_bass: "synth_bass_1",
      supersaw_lead: "brass_section",
      abletunes_fm_dx7: "abletunes_fm_piano",
      fat_brass_horns: "brass_section",
      alto_sax: "alto_sax",
      breathy_alto_sax: "alto_sax",
      sax_genuine_solo: "alto_sax",
      sax_sensual: "alto_sax",
      sax_blues_growl: "tenor_sax",
      sax_funk_stab: "alto_sax",
      sax_fall: "alto_sax",
      sax_scoop: "alto_sax",
      sax_solo: "alto_sax",
      trombone: "trombone",
      harmonica: "alto_sax",
      m1_fresh_air: "electric_piano_1",
      m1_universe: "string_ensemble_1",
      m1_choir: "choir_aahs",
      m1_ooh_ahh: "choir_aahs",
      ooh_ahh: "choir_aahs",
      choir_aahs: "choir_aahs",
      voice_oohs: "voice_oohs",
      tubular_bells: "tubular_bells",
      wind_chimes: "wind_chimes",
      crystal_chimes: "crystal_chimes",
      m1_piano_16: "acoustic_grand_piano",
      m1_organ_2: "drawbar_organ",
      m1_slap_bass: "synth_bass_1",
      m1_symphonic: "string_ensemble_1",
      m1_guitar_1: "acoustic_guitar_steel",
      m1_fretless: "acoustic_bass",
      m1_pan_flute: "flute",
      pan_flute: "flute",
      m1_flute: "flute",
      flute: "flute",
      m1_bottle_bell: "vibraphone",
      m1_kalimba: "kalimba",
      kalimba: "kalimba",
      m1_12string: "acoustic_guitar_steel",
      m1_koto: "harpsichord",
      m1_bell_ring: "vibraphone",
      taiko_drum: "taiko_drum",
      percussion_taiko: "taiko_drum",
      thunder_taiko: "taiko_drum",
    };
    return BANK_MAP[instKey] || instKey;
  }

  setSingleInstrument(instKey) {
    this.setSustainPedal(false);
    if (this.pcmEngine) this.pcmEngine.allNotesOff(true);
    tritonVaEngine.allNotesOff();
    this.vaAllNotesOff();
    synthEngine.panic();
    if (this._workletReady && this._workletNode) this._workletNode.allNotesOff();
    this._clearHeldNoteState();

    this.isSplitMode = false;
    this.isSynthMode = false;
    this.isTritonVaMode = false;
    this.activeTritonVaProg = null;
    const resolved = this.resolveBankKey(instKey);
    this.activeSingleInst = resolved;
    // Force worklet re-initialization on preset change to prevent state drift
    // that causes grainy/awful sound over time. Reset the worklet node so it
    // starts fresh with the new preset's parameters.
    if (this._workletNode) {
      this._workletNode = null;
      this._workletReady = false;
    }
    if (this._pcmWorkletNode) {
      this._pcmWorkletNode = null;
      this._pcmWorkletReady = false;
    }
    // Budget guard: if decoded RAM is near budget, skip the eager preload and
    // let this instrument lazy-decode on first note (prevents OOM on low-RAM).
    let preloadEnabled = true;
    if (this.pcmEngine && typeof this.pcmEngine.getDecodedBufferStats === "function") {
      const stats = this.pcmEngine.getDecodedBufferStats();
      const currentBytes = stats?.bytes || 0;
      const budget = stats?.budget || this.pcmEngine._getDecodedMemoryBudget();
      if (currentBytes + 1024 * 1024 > budget * 0.8) preloadEnabled = false;
    }
    // Fire-and-forget preload - don't block UI thread
    if (preloadEnabled && this.pcmEngine) {
      this.pcmEngine.preloadInstrument(resolved).catch(() => {});
    }

    // Synchronize Layer 0 with the active single instrument
    if (this.layers[0]) {
      this.layers[0].inst = resolved;
      this.layers[0].name = HD_SOUNDBANKS[resolved]?.name || HD_SOUNDBANKS[instKey]?.name || resolved;
      this.layers[0].enabled = true;
    }

    // If dual layer is active and layer 1 is enabled, stay in Combi mode so Layer 0 + Layer 1 play together!
    if (this.isDualLayerActive && this.layers[1]?.enabled) {
      this.isCombiMode = true;
      if (this.layers[2]) this.layers[2].enabled = false;
      if (this.layers[3]) this.layers[3].enabled = false;
    } else {
      this.isCombiMode = false;
    }

    this.syncPinnedInstruments();
    this.init();
    this.notifyLayerChange();
    this.notifySplitChange();
  }

  setDualLayerEnabled(enabled) {
    this.setSustainPedal(false);
    if (this.pcmEngine) this.pcmEngine.allNotesOff(true);
    tritonVaEngine.allNotesOff();
    this.vaAllNotesOff();
    synthEngine.panic();
    this._clearHeldNoteState();

    this.isDualLayerActive = enabled !== undefined ? !!enabled : !this.isDualLayerActive;
    this.isSynthMode = false;

    if (this.isDualLayerActive) {
      // Ensure Layer 0 is enabled and matches current single instrument
      if (this.layers[0]) {
        const primaryInst = this.resolveBankKey(this.activeSingleInst || "acoustic_grand_piano");
        this.layers[0].inst = primaryInst;
        this.layers[0].name = HD_SOUNDBANKS[primaryInst]?.name || primaryInst;
        this.layers[0].enabled = true;
      }
      // Ensure Layer 1 is enabled with designated layer sound
      if (this.layers[1]) {
        this.layers[1].enabled = true;
        if (!this.layers[1].inst) {
          this.layers[1].inst = "choir_aahs";
        }
      }
      // Disable layers 2 & 3 so dual layer is clean 2-instrument layer
      if (this.layers[2]) this.layers[2].enabled = false;
      if (this.layers[3]) this.layers[3].enabled = false;

      this.isCombiMode = true;
    } else {
      if (this.layers[1]) {
        this.layers[1].enabled = false;
      }
      this.isCombiMode = false;
    }

    this.syncPinnedInstruments();
    this.init();
    this.notifyLayerChange();
  }

  setDualLayerInstrument(instKey) {
    if (instKey.startsWith("va:")) {
      const prog = getTritonProgramById(instKey.slice(3));
      if (prog && this.layers[1]) {
        this.layers[1].inst = instKey;
        this.layers[1].vaProg = prog;
        this.layers[1].name = prog.name;
      }
    } else {
      const resolved = this.resolveBankKey(instKey);
      if (this.layers[1]) {
        this.layers[1].inst = resolved;
        delete this.layers[1].vaProg;
        this.layers[1].name = HD_SOUNDBANKS[resolved]?.name || HD_SOUNDBANKS[instKey]?.name || resolved;
      }
      if (this.pcmEngine) {
        this.pcmEngine.preloadInstrument(resolved);
      }
    }
    this.setDualLayerEnabled(true);
  }

  setSynthProgram(patchConfig) {
    this.setSustainPedal(false);
    if (this.pcmEngine) this.pcmEngine.allNotesOff(true);
    tritonVaEngine.allNotesOff();
    this.vaAllNotesOff();
    synthEngine.panic();
    this._clearHeldNoteState();

    this.isSplitMode = false;
    this.isSynthMode = true;
    this.isTritonVaMode = false;
    this.activeTritonVaProg = null;
    this.isCombiMode = false;
    this.synthPatch = patchConfig;
    synthEngine.activePatch = patchConfig;
    this.init();
    this.notifySplitChange();
  }

  setTritonVaProgram(prog) {
    this.setSustainPedal(false);
    if (this.pcmEngine) this.pcmEngine.allNotesOff(true);
    tritonVaEngine.allNotesOff();
    tritonVaEngine.sustainPedal = false;
    this.vaAllNotesOff();
    synthEngine.panic();
    this._clearHeldNoteState();

    this.isSplitMode = false;
    this.isTritonVaMode = true;
    this.isCombiMode = false;
    this.isSynthMode = true;
    this.activeTritonVaProg = prog;
    audioCore.init();
    tritonVaEngine.setProgram(prog);
    this._syncWorkletParams(prog);
    if ((prog.id === "A045" || prog.ifx === "Talkbox") && audioCore.fxRack) {
      audioCore.fxRack.applyPreset("talkbox_vocal");
    }
    this.init();
    this.notifyLayerChange();
    this.notifySplitChange();
  }

  toggleCombiMode(enabled) {
    this.isCombiMode = enabled !== undefined ? enabled : !this.isCombiMode;
    if (this.isCombiMode) {
      this.isSplitMode = false;
      this.isSynthMode = false;
      this.isTritonVaMode = false;
      this.activeTritonVaProg = null;
      this.setSustainPedal(false);
      if (this.pcmEngine) this.pcmEngine.allNotesOff(true);
      tritonVaEngine.allNotesOff();
      this.vaAllNotesOff();
      synthEngine.panic();
      this._clearHeldNoteState();
    }
    this.init();
    this.notifyLayerChange();
    this.notifySplitChange();
  }

  syncLayerFx() {
    if (this.pcmEngine && this.pcmEngine.layerInserts) {
      this.layers.forEach((layer, idx) => {
        if (this.pcmEngine.layerInserts[idx]) {
          this.pcmEngine.layerInserts[idx].setEffect(layer.fx || "clean");
        }
      });
    }
  }

  async setCombiPreset(presetId) {
    if (!COMBI_PRESETS[presetId]) return;
    
    const newCombi = COMBI_PRESETS[presetId];
    const fxPresetChanged = this.activeCombi?.fxPreset !== newCombi.fxPreset;
    
    // Force-clear sustain pedal first — prevents sustained voices bleeding into new preset
    this.setSustainPedal(false);
    if (this.pcmEngine) this.pcmEngine.allNotesOff(true);
    tritonVaEngine.allNotesOff();
    this.vaAllNotesOff();
    synthEngine.panic();
    if (this._workletReady && this._workletNode) this._workletNode.allNotesOff();
    // Force worklet re-initialization on combi change to prevent state drift
    // that causes grainy/awful sound over time.
    if (this._workletNode) {
      this._workletNode = null;
      this._workletReady = false;
    }
    if (this._pcmWorkletNode) {
      this._pcmWorkletNode = null;
      this._pcmWorkletReady = false;
    }
    this._clearHeldNoteState();

    this.activeCombi = newCombi;
    this.isCombiMode = true;
    this.isSplitMode = false;
    this.isSynthMode = false;
    this.isTritonVaMode = false;
    this.activeTritonVaProg = null;
    this.isDualLayerActive = false;
    this.layers = JSON.parse(JSON.stringify(this.activeCombi.layers));
    
    // Budget guard: if decoded RAM is near budget, skip eager preloads and
    // let layer instruments lazy-decode on first note (prevents OOM on low-RAM).
    let preloadEnabled = true;
    if (this.pcmEngine && typeof this.pcmEngine.getDecodedBufferStats === "function") {
      const stats = this.pcmEngine.getDecodedBufferStats();
      const currentBytes = stats?.bytes || 0;
      const budget = stats?.budget || this.pcmEngine._getDecodedMemoryBudget();
      const pcmLayers = this.layers.filter((l) => l.inst && !l.inst.startsWith("va:")).length;
      if (currentBytes + pcmLayers * 1024 * 1024 > budget * 0.8) preloadEnabled = false;
    }
    // Fire-and-forget preloads - don't block UI thread
    if (preloadEnabled) {
      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];
        if (layer.inst && layer.inst.startsWith("va:")) {
          const prog = getTritonProgramById(layer.inst.slice(3));
          if (prog) layer.vaProg = prog;
        } else if (layer.inst && this.pcmEngine) {
          this.pcmEngine.preloadInstrument(this.resolveBankKey(layer.inst)).catch(() => {});
        }
      }
    }
    
    // NO init() call - engine already initialized at startup
    // Only sync layer FX
    this.syncLayerFx();
    
    // Only apply FX preset if it actually changed
    if (audioCore.fxRack && fxPresetChanged) {
      if (this.activeCombi.fxPreset) {
        audioCore.fxRack.applyPreset(this.activeCombi.fxPreset);
      } else {
        audioCore.fxRack.applyPreset(null);
      }
    }
    
    if (INSTRUMENT_PATCHES[presetId]) {
      synthEngine.activePatch = INSTRUMENT_PATCHES[presetId];
    }
    this.syncPinnedInstruments();
    this.notifyLayerChange();
    this.notifySplitChange();
  }

  setLayerFx(layerIndex, fxId) {
    if (this.layers[layerIndex]) {
      this.layers[layerIndex].fx = fxId || "clean";
      this.init();
      if (this.pcmEngine && this.pcmEngine.layerInserts && this.pcmEngine.layerInserts[layerIndex]) {
        this.pcmEngine.layerInserts[layerIndex].setEffect(fxId);
      }
      this.notifyLayerChange();
    }
  }

  toggleLayer(layerIndex, enabled) {
    if (layerIndex === 1) {
      this.setDualLayerEnabled(enabled);
      return;
    }
    if (this.layers[layerIndex]) {
      this.layers[layerIndex].enabled = enabled !== undefined ? enabled : !this.layers[layerIndex].enabled;
      this.isCombiMode = true;
      this.isSynthMode = false;
      this.syncPinnedInstruments();
      this.init();
      this.notifyLayerChange();
    }
  }

  setLayerGain(layerIndex, gain) {
    if (this.layers[layerIndex]) {
      this.layers[layerIndex].gain = Math.max(0, Math.min(1.5, gain));
      this.notifyLayerChange();
    }
  }

  setLayerOctave(layerIndex, oct) {
    if (this.layers[layerIndex]) {
      this.layers[layerIndex].oct = Math.max(-2, Math.min(2, oct));
      this.notifyLayerChange();
    }
  }

  setLayerInstrument(layerIndex, instKey) {
    if (layerIndex === 1) {
      this.setDualLayerInstrument(instKey);
      return;
    }
    if (this.layers[layerIndex] && instKey) {
      if (instKey.startsWith("va:")) {
        const prog = getTritonProgramById(instKey.slice(3));
        if (prog) {
          this.layers[layerIndex].inst = instKey;
          this.layers[layerIndex].vaProg = prog;
          this.layers[layerIndex].name = prog.name;
        }
      } else {
        const resolvedKey = this.resolveBankKey(instKey);
        this.layers[layerIndex].inst = resolvedKey;
        delete this.layers[layerIndex].vaProg;
        this.layers[layerIndex].name = HD_SOUNDBANKS[resolvedKey]?.name || HD_SOUNDBANKS[instKey]?.name || instKey;
        if (this.pcmEngine) {
          this.pcmEngine.preloadInstrument(resolvedKey);
        }
      }
      this.isCombiMode = true;
      this.isSynthMode = false;
      this.syncPinnedInstruments();
      this.init();
      this.notifyLayerChange();
    }
  }

  toggleSplitMode(enabled) {
    this.isSplitMode = enabled !== undefined ? enabled : !this.isSplitMode;
    this.notifySplitChange();
  }

  notifySplitChange() {
    if (this.onSplitChangeCallback) {
      try { this.onSplitChangeCallback(this.isSplitMode); } catch (e) {}
    }
    for (const cb of this.splitChangeListeners) {
      try { cb(this.isSplitMode); } catch (e) {}
    }
    this.saveSessionSoon();
  }

  addSplitChangeListener(cb) {
    if (typeof cb === "function") this.splitChangeListeners.add(cb);
  }

  removeSplitChangeListener(cb) {
    this.splitChangeListeners.delete(cb);
  }

  splitZone(zoneKey) {
    return this.splitZones[zoneKey === "upper" ? "upper" : "lower"];
  }

  /**
   * Recomputes the PCM engine's "never evict" pin set from whatever sound is
   * currently selected (single instrument, combi layers, split zones). This is
   * what guarantees the budget evictor never drops the sound being performed —
   * only long-idle instruments — so no hiss/lag/decoded-notes regressions.
   */
  syncPinnedInstruments() {
    if (!this.pcmEngine || typeof this.pcmEngine.setPinnedInstruments !== "function") return;
    const ids = new Set();
    if (this.activeSingleInst) {
      ids.add(this.resolveBankKey(this.activeSingleInst));
    }
    if (this.isCombiMode && this.layers) {
      for (const layer of this.layers) {
        if (layer && layer.enabled && layer.inst && !layer.inst.startsWith("va:")) {
          ids.add(this.resolveBankKey(layer.inst));
        }
      }
    }
    if (this.isSplitMode && this.splitZones) {
      for (const key of Object.keys(this.splitZones)) {
        const zone = this.splitZones[key];
        if (zone && zone.inst && !zone.inst.startsWith("va:")) {
          ids.add(this.resolveBankKey(zone.inst));
        }
      }
    }
    this.pcmEngine.setPinnedInstruments(ids);
  }

  setSplitPointMidi(midi) {
    this.splitPointMidi = Math.max(21, Math.min(108, Math.round(midi)));
    this.notifySplitChange();
  }

  setSplitZoneInstrument(zoneKey, instKey) {
    const zone = this.splitZone(zoneKey);
    if (!zone || !instKey) return;
    if (instKey.startsWith("va:")) {
      const prog = getTritonProgramById(instKey.slice(3));
      if (prog) {
        zone.inst = "va:" + prog.id;
        zone.name = prog.name;
        zone.vaProg = prog;
      }
    } else {
      const resolved = this.resolveBankKey(instKey);
      zone.inst = resolved;
      delete zone.vaProg;
      zone.name = HD_SOUNDBANKS[resolved]?.name || HD_SOUNDBANKS[instKey]?.name || instKey;
    }
    this.init();
    this.notifySplitChange();
  }

  setSplitZoneStack(zoneKey) {
    // "Follow current stack": upper zone plays the active combi/single program
    const zone = this.splitZone(zoneKey);
    if (!zone) return;
    zone.inst = null;
    zone.name = "Current Stack";
    delete zone.vaProg;
    this.notifySplitChange();
  }

  setSplitZoneFx(zoneKey, fxId) {
    const zone = this.splitZone(zoneKey);
    if (!zone) return;
    zone.fx = fxId || "clean";
    this.init();
    if (this.pcmEngine && this.pcmEngine.splitZoneInserts && this.pcmEngine.splitZoneInserts[zoneKey]) {
      this.pcmEngine.splitZoneInserts[zoneKey].setEffect(zone.fx);
    }
    this.notifySplitChange();
  }

  setSplitZoneGain(zoneKey, gain) {
    const zone = this.splitZone(zoneKey);
    if (!zone) return;
    zone.gain = Math.max(0, Math.min(1.5, gain));
    this.notifySplitChange();
  }

  setSplitZoneOctave(zoneKey, oct) {
    const zone = this.splitZone(zoneKey);
    if (!zone) return;
    zone.oct = Math.max(-2, Math.min(2, oct));
    this.notifySplitChange();
  }

  syncSplitFx() {
    if (this.pcmEngine && this.pcmEngine.splitZoneInserts) {
      ["lower", "upper"].forEach(key => {
        const zone = this.splitZones[key];
        if (zone && this.pcmEngine.splitZoneInserts[key]) {
          this.pcmEngine.splitZoneInserts[key].setEffect(zone.fx || "clean");
        }
      });
    }
  }

  noteOn(midiNote, velocity = 95, when = 0) {
    if (!this.pcmEngine) this.init();
    audioCore.ensureRunning();

    try { midiOutManager.noteOn(midiOutManager.channel, midiNote, velocity); } catch (e) {}

    // 1:1 Instant Synchronous Visual Key Trigger (True 0.00ms touch-to-visual response)
    if (this.onNoteChangeCallback) {
      if (when === 0) {
        try { this.onNoteChangeCallback(midiNote, true, velocity); } catch (e) {}
      } else {
        const delayMs = Math.max(0, (when - (audioCore.ctx ? audioCore.ctx.currentTime : 0)) * 1000);
        setTimeout(() => {
          try { this.onNoteChangeCallback(midiNote, true, velocity); } catch (e) {}
        }, delayMs);
      }
    }
    if (synthEngine.onNoteChangeCallback && synthEngine.onNoteChangeCallback !== this.onNoteChangeCallback) {
      if (when === 0) {
        try { synthEngine.onNoteChangeCallback(midiNote, true, velocity); } catch (e) {}
      } else {
        const delayMs = Math.max(0, (when - (audioCore.ctx ? audioCore.ctx.currentTime : 0)) * 1000);
        setTimeout(() => {
          try { synthEngine.onNoteChangeCallback(midiNote, true, velocity); } catch (e) {}
        }, delayMs);
      }
    }

    const now = when > 0 ? when : (audioCore.ctx ? audioCore.ctx.currentTime : 0);

    // Live held-note tracking: a key held with no sustain pedal rings for
    // heldNoteSec, then fades. Scheduled (when > 0) notes arm the timer at
    // their scheduled play time.
    this.heldNotes.add(midiNote);
    this._armHeldNoteTimer(midiNote, now);

    if (audioCore.fxRack?.talkbox && audioCore.fxRack.talkbox.enabled) {
      audioCore.fxRack.talkbox.triggerVocalAttack(velocity);
    }

    // Split zone: route through the dedicated zone bus (triggers assigned instrument
    // or the current stack, so each half gets its own insert FX like a combi strip)
    if (this.isSplitMode) {
      const isLower = midiNote < this.splitPointMidi;
      const zone = this.splitZone(isLower ? "lower" : "upper");

      if (zone && zone.inst !== null && zone.inst !== undefined && zone.inst !== "current_stack") {
        const transposedMidi = Math.max(21, Math.min(108, midiNote + (zone.oct || 0) * 12));
        if (zone.vaProg) {
          this.getVaEngineFor(zone.vaProg, zone.gain, isLower ? 4 : 5).noteOn(transposedMidi, velocity, when);
        } else if (this.pcmEngine) {
          const dest = (this.pcmEngine.splitZoneInserts && this.pcmEngine.splitZoneInserts[isLower ? "lower" : "upper"])
            ? this.pcmEngine.splitZoneInserts[isLower ? "lower" : "upper"].input
            : null;
          this.pcmEngine.playNote(zone.inst, transposedMidi, velocity, zone.gain, null, dest, when);
        }
        return;
      }
      // current-stack zone: fall through to normal routing (combi/single/VA)
    }

    // Triton VA mode: real oscillator engine plays the program's own waveforms
    if (this.isTritonVaMode && this.activeTritonVaProg) {
      tritonVaEngine.noteOn(midiNote, velocity, when);
      return;
    }

    // ALL MODES use PCM samples — never raw oscillator voices
    if (this.isCombiMode) {
      // Pad sidechain ducking: when Layer 0 strikes, duck Layer 1 down by -6dB so lead melody is clean
      if (this.isPadDuckingEnabled && this.layers[0]?.enabled) {
        this.activeLeadNotes++;
        if (this.activeLeadNotes === 1 && this.pcmEngine && this.pcmEngine.layerInserts && this.pcmEngine.layerInserts[1]) {
          const ctx = audioCore.ctx;
          if (ctx) {
            this.pcmEngine.layerInserts[1].input.gain.setTargetAtTime(0.35, now, 0.025);
          }
        }
      }

      // Pro Combi Mixer Auto-Headroom: scale each layer so the summed output
      // matches single-instrument reference level regardless of how many layers
      // are active or what their individual gains are. Multi-instrument summing is
      // psychoacoustically incoherent, so dividing by linear sum severely under-powers
      // 3- and 4-layer combis. 1.35 / sqrt(totalLayerGain) perfectly equalizes loudness.
      let totalLayerGain = 0;
      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];
        if (!layer.enabled) continue;
        if (velocity < layer.minVel || velocity > layer.maxVel) continue;
        totalLayerGain += (layer.gain ?? 1.0);
      }
      const combiScale = totalLayerGain > 0
        ? Math.min(1.0, 1.35 / Math.sqrt(totalLayerGain))
        : 1.0;
      // Headroom protection for dense Combi chords & sweeps:
      // Prevents 4-layer stacks from driving +20dB into the master limiter
      const polyHeadroom = this.heldNotes.size > 2 ? Math.min(1.0, 1.45 / Math.sqrt(this.heldNotes.size)) : 1.0;

      // COMBI MODE: Synchronous sample-0 trigger on all enabled PCM layers
      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];
        if (!layer.enabled) continue;
        if (velocity < layer.minVel || velocity > layer.maxVel) continue;

        const effectiveGain = (layer.gain ?? 1.0) * combiScale * polyHeadroom;
        const transposedMidi = Math.max(21, Math.min(108, midiNote + layer.oct * 12));
        if (layer.vaProg) {
          this.getVaEngineFor(layer.vaProg, effectiveGain, i).noteOn(transposedMidi, velocity, when);
        } else if (this.pcmEngine) {
          this.pcmEngine.playNote(layer.inst, transposedMidi, velocity, effectiveGain, i, null, when);
        }
      }
    } else {
      // SINGLE PROGRAM MODE: Instant sample-0 playback of authentic PCM sound
      if (this.pcmEngine) {
        this.pcmEngine.playNote(this.activeSingleInst, midiNote, velocity, 1.0, null, null, when);
      }
    }
  }

  noteOff(midiNote, when = 0) {
    audioCore.ensureRunning();

    try { midiOutManager.noteOff(midiOutManager.channel, midiNote); } catch (e) {}

    // 1:1 Instant Synchronous Visual Key Release
    if (this.onNoteChangeCallback) {
      if (when === 0) {
        try { this.onNoteChangeCallback(midiNote, false, 0); } catch (e) {}
      } else {
        const delayMs = Math.max(0, (when - (audioCore.ctx ? audioCore.ctx.currentTime : 0)) * 1000);
        setTimeout(() => {
          try { this.onNoteChangeCallback(midiNote, false, 0); } catch (e) {}
        }, delayMs);
      }
    }
    if (synthEngine.onNoteChangeCallback && synthEngine.onNoteChangeCallback !== this.onNoteChangeCallback) {
      if (when === 0) {
        try { synthEngine.onNoteChangeCallback(midiNote, false, 0); } catch (e) {}
      } else {
        const delayMs = Math.max(0, (when - (audioCore.ctx ? audioCore.ctx.currentTime : 0)) * 1000);
        setTimeout(() => {
          try { synthEngine.onNoteChangeCallback(midiNote, false, 0); } catch (e) {}
        }, delayMs);
      }
    }

    // Key lifted: stop the held-note timer; the note's tail is now governed by
    // the normal release / sustain-pedal path.
    this.heldNotes.delete(midiNote);
    this._clearHeldNoteTimer(midiNote);

    const now = when > 0 ? when : (audioCore.ctx ? audioCore.ctx.currentTime : 0);

    // Pad sidechain ducking release: restore Layer 1 volume when all lead keys are released
    if (this.isPadDuckingEnabled && this.isCombiMode && this.layers[0]?.enabled) {
      this.activeLeadNotes = Math.max(0, this.activeLeadNotes - 1);
      if (this.activeLeadNotes === 0 && this.pcmEngine && this.pcmEngine.layerInserts && this.pcmEngine.layerInserts[1]) {
        const ctx = audioCore.ctx;
        if (ctx) {
          this.pcmEngine.layerInserts[1].input.gain.setTargetAtTime(1.0, now, 0.28);
        }
      }
    }

    // Split zone release mirrors the noteOn routing (zone bus + VA/PCM)
    if (this.isSplitMode) {
      const isLower = midiNote < this.splitPointMidi;
      const zone = this.splitZone(isLower ? "lower" : "upper");

      if (zone && zone.inst !== null && zone.inst !== undefined && zone.inst !== "current_stack") {
        const transposedMidi = Math.max(21, Math.min(108, midiNote + (zone.oct || 0) * 12));
        if (zone.vaProg) {
          this.getVaEngineFor(zone.vaProg, zone.gain, isLower ? 4 : 5).noteOff(transposedMidi, when);
        } else if (this.pcmEngine) {
          this.pcmEngine.stopNote(zone.inst, transposedMidi, when);
        }
        return;
      }
      // current-stack zone: fall through to normal routing (combi/single/VA)
    }

    if (this.isTritonVaMode && this.activeTritonVaProg) {
      tritonVaEngine.noteOff(midiNote, when);
      return;
    }
    if (this.isSynthMode) {
      synthEngine.noteOff(midiNote);
      if (synthEngine.isDualLayer) {
        synthEngine.releaseLayerVoice(midiNote);
      }
    }

    if (this.pcmEngine) {
      if (this.isCombiMode) {
        for (let i = 0; i < this.layers.length; i++) {
          const layer = this.layers[i];
          const transposedMidi = Math.max(21, Math.min(108, midiNote + layer.oct * 12));
          if (layer.vaProg) {
            this.getVaEngineFor(layer.vaProg, layer.gain, i).noteOff(transposedMidi, when);
          } else {
            this.pcmEngine.stopNote(layer.inst, transposedMidi, when);
          }
        }
      } else {
        this.pcmEngine.stopNote(this.activeSingleInst, midiNote, when);
      }
    }
  }

  fastNoteOff(midiNote, when = 0) {
    audioCore.ensureRunning();

    if (this.onNoteChangeCallback) {
      try { this.onNoteChangeCallback(midiNote, false, 0); } catch (e) {}
    }
    if (synthEngine.onNoteChangeCallback && synthEngine.onNoteChangeCallback !== this.onNoteChangeCallback) {
      try { synthEngine.onNoteChangeCallback(midiNote, false, 0); } catch (e) {}
    }

    this.heldNotes.delete(midiNote);
    this._clearHeldNoteTimer(midiNote);

    const now = when > 0 ? when : (audioCore.ctx ? audioCore.ctx.currentTime : 0);

    // Pad sidechain ducking release: restore Layer 1 volume when all lead keys are released
    if (this.isPadDuckingEnabled && this.isCombiMode && this.layers[0]?.enabled) {
      this.activeLeadNotes = Math.max(0, this.activeLeadNotes - 1);
      if (this.activeLeadNotes === 0 && this.pcmEngine && this.pcmEngine.layerInserts && this.pcmEngine.layerInserts[1]) {
        const ctx = audioCore.ctx;
        if (ctx) {
          this.pcmEngine.layerInserts[1].input.gain.setTargetAtTime(1.0, now, 0.28);
        }
      }
    }

    // Split zone release
    if (this.isSplitMode) {
      const isLower = midiNote < this.splitPointMidi;
      const zone = this.splitZone(isLower ? "lower" : "upper");

      if (zone && zone.inst !== null && zone.inst !== undefined && zone.inst !== "current_stack") {
        const transposedMidi = Math.max(21, Math.min(108, midiNote + (zone.oct || 0) * 12));
        if (zone.vaProg) {
          this.getVaEngineFor(zone.vaProg, zone.gain, isLower ? 4 : 5).noteOff(transposedMidi, when);
        } else if (this.pcmEngine) {
          if (typeof this.pcmEngine.fastStopNote === "function") {
            this.pcmEngine.fastStopNote(zone.inst, transposedMidi, when);
          } else {
            this.pcmEngine.stopNote(zone.inst, transposedMidi, when);
          }
        }
        return;
      }
    }

    if (this.isTritonVaMode && this.activeTritonVaProg) {
      tritonVaEngine.noteOff(midiNote, when);
      return;
    }
    if (this.isSynthMode) {
      synthEngine.noteOff(midiNote);
      if (synthEngine.isDualLayer) {
        synthEngine.releaseLayerVoice(midiNote);
      }
    }

    if (this.pcmEngine) {
      if (this.isCombiMode) {
        for (let i = 0; i < this.layers.length; i++) {
          const layer = this.layers[i];
          const transposedMidi = Math.max(21, Math.min(108, midiNote + layer.oct * 12));
          if (layer.vaProg) {
            this.getVaEngineFor(layer.vaProg, layer.gain, i).noteOff(transposedMidi, when);
          } else {
            if (typeof this.pcmEngine.fastStopNote === "function") {
              this.pcmEngine.fastStopNote(layer.inst, transposedMidi, when);
            } else {
              this.pcmEngine.stopNote(layer.inst, transposedMidi, when);
            }
          }
        }
      } else {
        if (typeof this.pcmEngine.fastStopNote === "function") {
          this.pcmEngine.fastStopNote(this.activeSingleInst, midiNote, when);
        } else {
          this.pcmEngine.stopNote(this.activeSingleInst, midiNote, when);
        }
      }
    }
  }

  setNoteExpression(midiNote, relativeY) {
    if (!this.pcmEngine) this.init();

    if (this.isSplitMode) {
      const isLower = midiNote < this.splitPointMidi;
      const zone = this.splitZone(isLower ? "lower" : "upper");
      if (zone && zone.inst !== null && zone.inst !== undefined && zone.inst !== "current_stack") {
        const transposedMidi = Math.max(21, Math.min(108, midiNote + (zone.oct || 0) * 12));
        if (this.pcmEngine) this.pcmEngine.setNoteExpression(transposedMidi, relativeY);
        return;
      }
    }

    if (this.pcmEngine) {
      if (this.isCombiMode) {
        for (let i = 0; i < this.layers.length; i++) {
          const layer = this.layers[i];
          if (!layer.enabled) continue;
          const transposedMidi = Math.max(21, Math.min(108, midiNote + layer.oct * 12));
          this.pcmEngine.setNoteExpression(transposedMidi, relativeY);
        }
      } else {
        this.pcmEngine.setNoteExpression(midiNote, relativeY);
      }
    }
  }

  // Held-note auto-release (no pedal): after heldNoteSec, fade a note whose key
  // is still held down. startTime lets scheduled notes arm at play time.
  _armHeldNoteTimer(midiNote, startTime = null) {
    this._clearHeldNoteTimer(midiNote);
    if (this.sustainPedalActive) return;
    const sec = this.settings?.heldNoteSec;
    if (typeof sec !== "number" || !(sec > 0)) return;
    const ctxTime = audioCore.ctx ? audioCore.ctx.currentTime : 0;
    const scheduledDelay = startTime != null && startTime > ctxTime ? (startTime - ctxTime) * 1000 : 0;
    this._heldNoteTimers.set(midiNote, setTimeout(() => {
      this._heldNoteTimers.delete(midiNote);
      if (this.sustainPedalActive) return;
      if (!this.heldNotes.has(midiNote)) return;
      if (!audioCore.ctx || audioCore.ctx.state === "suspended" || audioCore.ctx.state === "interrupted") return;
      this._stopNoteSound(midiNote, 0);
    }, sec * 1000 + scheduledDelay));
  }

  _clearHeldNoteTimer(midiNote) {
    const t = this._heldNoteTimers.get(midiNote);
    if (t) {
      clearTimeout(t);
      this._heldNoteTimers.delete(midiNote);
    }
  }

  _clearAllHeldNoteTimers() {
    this._heldNoteTimers.forEach(t => clearTimeout(t));
    this._heldNoteTimers.clear();
  }

  _clearHeldNoteState() {
    this._clearAllHeldNoteTimers();
    this.heldNotes.clear();
  }

  // Audio-only note stop: mirrors noteOff() routing but never touches visuals or
  // pad-ducking bookkeeping - used for the held-note auto-fade so a still-pressed
  // key stays lit while its sound rings out.
  _stopNoteSound(midiNote, when = 0) {
    if (this.isSplitMode) {
      const isLower = midiNote < this.splitPointMidi;
      const zone = this.splitZone(isLower ? "lower" : "upper");
      if (zone && zone.inst !== null && zone.inst !== undefined && zone.inst !== "current_stack") {
        const transposedMidi = Math.max(21, Math.min(108, midiNote + (zone.oct || 0) * 12));
        if (zone.vaProg) {
          this.getVaEngineFor(zone.vaProg, zone.gain, isLower ? 4 : 5).noteOff(transposedMidi, when);
        } else if (this.pcmEngine) {
          this.pcmEngine.stopNote(zone.inst, transposedMidi, when);
        }
        return;
      }
    }

    if (this.isTritonVaMode && this.activeTritonVaProg) {
      tritonVaEngine.noteOff(midiNote, when);
      return;
    }

    if (this.pcmEngine) {
      if (this.isCombiMode) {
        for (let i = 0; i < this.layers.length; i++) {
          const layer = this.layers[i];
          if (!layer.enabled) continue;
          const transposedMidi = Math.max(21, Math.min(108, midiNote + layer.oct * 12));
          if (layer.vaProg) {
            this.getVaEngineFor(layer.vaProg, layer.gain, i).noteOff(transposedMidi, when);
          } else {
            this.pcmEngine.stopNote(layer.inst, transposedMidi, when);
          }
        }
      } else {
        this.pcmEngine.stopNote(this.activeSingleInst, midiNote, when);
      }
    }
  }

  setSustainPedal(isDown, when = 0) {
    if (!this.pcmEngine) this.init();
    audioCore.ensureRunning();
    this.sustainPedalActive = !!isDown;
    // Pedal governs sustained notes: cancel held-note timers while down, re-arm
    // them for keys still physically held once the pedal lifts.
    if (isDown) {
      this._clearAllHeldNoteTimers();
    } else {
      this.heldNotes.forEach(n => this._armHeldNoteTimer(n));
    }
    // Notify worklet for live VA sustain handling
    if (this._workletReady && this._workletNode) {
      this._workletNode.setSustainPedal(isDown);
    }
    if (this.isTritonVaMode && this.activeTritonVaProg) {
      tritonVaEngine.setSustainPedal(isDown, when);
    }
    if (this.pcmEngine) {
      this.pcmEngine.setSustainPedal(isDown, when);
      if (this.isCombiMode) {
        this._vaEngines.forEach(eng => { try { eng.setSustainPedal(isDown, when); } catch (err) {} });
      }
    }
    // Notify UI when sustain is force-cleared (e.g. during preset switch)
    if (!isDown && this.onSustainForceOffCallback) {
      try { this.onSustainForceOffCallback(); } catch (e) {}
    }
  }

  setPitchBend(semitones) {
    if (!this.pcmEngine) this.init();
    if (this.isTritonVaMode && this.activeTritonVaProg) {
      tritonVaEngine.setPitchBend(semitones);
      return;
    }
    if (this.pcmEngine) {
      this.pcmEngine.setPitchBend(semitones);
      if (this.isCombiMode) {
        this._vaEngines.forEach(eng => { try { eng.setPitchBend(semitones); } catch (err) {} });
      }
    }
  }

  registerPanicHook(fn) {
    if (typeof fn === "function") {
      this._panicHooks.add(fn);
      return () => this._panicHooks.delete(fn);
    }
    return () => {};
  }

  unregisterPanicHook(fn) {
    this._panicHooks.delete(fn);
  }

  setModWheel(amount) {
    if (!this.pcmEngine) this.init();
    if (this.pcmEngine) this.pcmEngine.setModWheel(amount);
    synthEngine.setModWheel(amount);
  }

  panic() {
    this.activeLeadNotes = 0;
    this.setSustainPedal(false);
    this.setPitchBend(0);
    this.setModWheel(0);

    // Hard-mute master output immediately so zero residue/tails can leak
    if (audioCore?.hardSilence) {
      try { audioCore.hardSilence(); } catch (e) {}
    }

    // 1. Notify all registered panic hooks (demo player, looper, schedulers, groove, etc.)
    if (this._panicHooks) {
      this._panicHooks.forEach((hook) => {
        try { hook(); } catch (e) {}
      });
    }
    if (this.onPanicCallback) {
      try { this.onPanicCallback(); } catch (e) {}
    }
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("wilsonix:panic"));
      } catch (e) {}
    }

    // 2. Clear visual note styling for all active keys
    if (this.onNoteChangeCallback) {
      this.heldNotes.forEach((note) => {
        try { this.onNoteChangeCallback(note, false, 0); } catch (e) {}
      });
    }

    // 3. Silence all PCM engine voices & stop SFX generator
    if (this.pcmEngine) {
      this.pcmEngine.allNotesOff(false);
      if (this.pcmEngine.sfxGenerator && typeof this.pcmEngine.sfxGenerator.stopAll === "function") {
        try { this.pcmEngine.sfxGenerator.stopAll(); } catch (e) {}
      }
      this.pcmEngine.pitchBendSemitones = 0;
      this.pcmEngine.modWheelAmount = 0;
    }

    // 4. Silence all synth & VA voices
    synthEngine.panic();
    tritonVaEngine.allNotesOff();
    tritonVaEngine.sustainPedal = false;
    this.vaAllNotesOff();
    if (this._workletReady && this._workletNode) this._workletNode.allNotesOff();
    this._clearHeldNoteState();

    // 5. Instantly kill all FX Rack tails, delays, reverbs, and feedback loops
    if (audioCore.fxRack) {
      try {
        audioCore.fxRack.muteOutput();
        audioCore.fxRack.resetAllEffects();
        if (audioCore.fxRack._chainEffects) {
          audioCore.fxRack._chainEffects.forEach((fx) => {
            try { fx.setBypass(true); } catch (e) {}
          });
        }
        setTimeout(() => {
          try { audioCore.fxRack.unmuteOutput(); } catch (e) {}
        }, 35);
      } catch (e) {}
    }

    // 6. Recover audio graph if context crashed
    if (audioCore.recoverAudioGraph) {
      try { audioCore.recoverAudioGraph(); } catch (e) {}
    }
  }

  // ---- User presets + gig setlist (localStorage: sync, offline, zero deps) ----
  getUserPresets() {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem("wilsonix_user_presets") : null;
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  saveUserPresets(list) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("wilsonix_user_presets", JSON.stringify(list));
      }
    } catch (e) {}
  }

  saveUserPreset(name) {
    const clean = (name || "My Stack").trim().slice(0, 40) || "My Stack";
    const list = this.getUserPresets();
    const entry = {
      id: "user_" + Date.now(),
      name: clean,
      layers: JSON.parse(JSON.stringify(this.layers)),
    };
    list.push(entry);
    this.saveUserPresets(list);
    this.notifyLayerChange();
    return entry;
  }

  applyUserPreset(id) {
    const found = this.getUserPresets().find(p => p.id === id);
    if (!found || !Array.isArray(found.layers)) return false;
    this.activeCombi = { id: found.id, name: found.name, layers: found.layers };
    this.isCombiMode = true;
    this.isSynthMode = false;
    this.layers = JSON.parse(JSON.stringify(found.layers));
    this.init();
    this.syncLayerFx();
    this.notifyLayerChange();
    return true;
  }

  deleteUserPreset(id) {
    this.saveUserPresets(this.getUserPresets().filter(p => p.id !== id));
    this.notifyLayerChange();
  }

  getSetlist() {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem("wilsonix_setlist") : null;
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  saveSetlist(list) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("wilsonix_setlist", JSON.stringify(list));
      }
    } catch (e) {}
    this.notifyLayerChange();
  }

  currentStackSnapshot() {
    const activeId = this.activeCombi?.id || "";
    const isUser = this.isCombiMode && typeof activeId === "string" && activeId.startsWith("user_");
    if (isUser) {
      return { kind: "user", id: activeId, name: this.activeCombi.name };
    }
    if (this.isCombiMode) {
      return { kind: "combi", id: activeId, name: this.activeCombi.name };
    }
    return {
      kind: "single",
      id: this.activeSingleInst,
      name: HD_SOUNDBANKS[this.activeSingleInst]?.name || this.activeSingleInst,
    };
  }

  applySetlistEntry(entry) {
    if (!entry) return false;
    if (entry.kind === "user") return this.applyUserPreset(entry.id);
    if (entry.kind === "single") {
      this.setSingleInstrument(entry.id);
      return true;
    }
    if (COMBI_PRESETS[entry.id]) {
      this.setCombiPreset(entry.id);
      return true;
    }
    return false;
  }

  moveSetlistEntry(fromIdx, delta) {
    const list = this.getSetlist();
    const toIdx = fromIdx + delta;
    if (fromIdx < 0 || fromIdx >= list.length || toIdx < 0 || toIdx >= list.length) return;
    const [item] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, item);
    this.saveSetlist(list);
  }

  removeSetlistEntry(idx) {
    const list = this.getSetlist();
    if (idx < 0 || idx >= list.length) return;
    list.splice(idx, 1);
    this.saveSetlist(list);
  }
}

export const multiLayerEngine = new MultiLayerEngine();
