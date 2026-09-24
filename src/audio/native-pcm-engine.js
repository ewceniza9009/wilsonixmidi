/**
 * Native Korg TRITON PCM Multisample Rompler Engine
 * Pre-caches genuine 24-bit multi-samples into RAM AudioBuffers with 0.00ms touch-to-sound latency.
 */

import {
  bankData,
  ensureBankForInst,
} from "./pcm-bank-loader.js";
import { ABLETUNES_BANKS } from "./abletunes-manifest.js";
import { animalEdmLoader } from "./animal-edm-loader.js";
import { bloomEdmLoader } from "./bloom-edm-loader.js";
import { sampleCache } from "./sample-cache.js";
import { isSfxInstrumentId } from "./sfx-instrument-ids.js";
import { multisampleLoader } from "./multisample-loader.js";
import { configureSustainLoop } from "./sample-loop-helper.js";
import { logger } from "../utils/logger.js";

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

export const INST_ALIASES = {
  synthage_grand: "acoustic_grand_piano",
  whitney_ballad: "acoustic_grand_piano",
  ballad_master: "acoustic_grand_piano",
  m1_piano_16: "acoustic_grand_piano",
  abletunes_upright: "abletunes_upright",
  acoustic_grand_piano: "acoustic_grand_piano",
  rhodes_stage_mp3: "electric_piano_1",
  electric_piano_1: "electric_piano_1",
  electric_piano_2: "electric_piano_2",
  tri_stage_ep: "eos_oldroads",
  dx7_ep1: "eos_tx816",
  triton_dyno_ep: "eos_deeproads",
  abletunes_fm_piano: "abletunes_fm_piano",
  abletunes_fm_dx7: "abletunes_fm_piano",
  m1_fresh_air: "abletunes_fm_piano",
  pure_sine_lead: "pure_sine_lead",
  pure_sine_sub: "pure_sine_sub",
  warm_sine_keys: "warm_sine_keys",
  crystal_sine_bells: "crystal_sine_bells",
  cosmic_sine_flute: "cosmic_sine_flute",
  deep_sine_pad: "deep_sine_pad",
  tekk_hit1: "tekk_hit1",
  tekk_hit2: "tekk_hit2",
  tekk_hit3: "tekk_hit3",
  eos_dreamn: "eos_dreamn",
  eos_deeproads: "eos_deeproads",
  eos_oldroads: "eos_oldroads",
  eos_wah_clavi: "eos_wah_clavi",
  eos_lofi_piano: "eos_lofi_piano",
  eos_cp80: "eos_cp80",
  eos_tx816: "eos_tx816",
  eos_midi_grand: "eos_midi_grand",
  eos_vocoder: "eos_vocoder",
  eos_saw900: "eos_saw900",
  eos_extacy: "eos_extacy",
  eos_vibes: "eos_vibes",
  eos_thicksaw: "eos_thicksaw",
  eos_square2: "eos_square2",
  eos_seq_ana: "eos_seq_ana",
  eos_sweeppad: "eos_sweeppad",
  eos_warmpad: "eos_warmpad",
  eos_analog_brass: "eos_analog_brass",
  eos_synth_brass: "eos_synth_brass",
  eos_organ_60s: "eos_organ_60s",
  eos_rubber_bass: "eos_rubber_bass",
  eos_seq_bass: "eos_seq_bass",
  eos_synbass101: "eos_synbass101",
  eos_jazz_guitar: "eos_jazz_guitar",
  eos_upright_bass: "eos_upright_bass",
  eos_fantasia: "eos_fantasia",
  eos_jp_strings: "eos_jp_strings",
  eos_ob_strings: "eos_ob_strings",
  eos_euro_hit: "eos_euro_hit",
  eos_acid_bass: "eos_acid_bass",
  eos_funk_gtr: "eos_funk_gtr",
  eos_silky_pad: "eos_silky_pad",
  eos_space_voice: "eos_space_voice",
  eos_rotary_organ: "eos_rotary_organ",
  eos_mg_square: "eos_mg_square",
  eos_slow_strings: "eos_slow_strings",
  eos_oct_brass: "eos_oct_brass",
  // USER BANK B, C, D (EDM, House, Techno)
  edm_house_piano: "edm_house_piano",
  korg_techno_organ: "korg_techno_organ",
  edm_river_bass1: "edm_river_bass1",
  edm_dx_funkbass: "edm_dx_funkbass",
  edm_club_saw1: "edm_club_saw1",
  edm_club_brass: "edm_club_brass",
  edm_hiq_bass: "edm_hiq_bass",
  edm_mika_piano: "edm_mika_piano",
  edm_river_bass2: "edm_river_bass2",
  edm_iconic_lead1: "edm_iconic_lead1",
  edm_iconic_lead2: "edm_iconic_lead2",
  edm_supersaw_jp80: "edm_supersaw_jp80",
  edm_bigroom_saw: "edm_bigroom_saw",
  edm_trance_oct: "edm_trance_oct",
  edm_retro_synthbass1: "edm_retro_synthbass1",
  edm_k2500_oohs: "edm_k2500_oohs",
  edm_gus_voice: "edm_gus_voice",
  edm_warehouse_saw: "edm_warehouse_saw",
  edm_trance_synth: "edm_trance_synth",
  edm_berlin_sub: "edm_berlin_sub",
  edm_club_saw2: "edm_club_saw2",
  edm_trance_oct2: "edm_trance_oct2",
  omega_saw_gs: "omega_saw_gs",
  omega_doctor_solo: "omega_doctor_solo",
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
  alto_sax: "alto_sax",
  breathy_alto_sax: "alto_sax",
  sax_genuine_solo: "alto_sax",
  sax_solo: "alto_sax",
  sax_alto_lead: "alto_sax",
  sax_funk_stab: "alto_sax",
  sax_fall: "alto_sax",
  sax_scoop: "alto_sax",
  tenor_sax: "tenor_sax",
  sax_sensual: "alto_sax",
  sax_blues_growl: "tenor_sax",
  sax_tenor_blues: "tenor_sax",
  trombone: "trombone",
  harmonica: "alto_sax",
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

// Idle time after which a decoded instrument may be cold-evicted when over
// budget. Any instrument touched or selected within this window is always kept
// resident, so live performance and scheduled playback never re-decode mid-song
// (the v2.0.x hiss/lag regression). Tuned well below budget pressure so a demo
// or auditioned patch is never dropped while still being used.
const PROTECT_MS = 3 * 60 * 1000;

const INST_TRIM_GAINS = {
  // Acoustic Pianos — reference level (~0.85)
  acoustic_grand_piano: 0.85,
  abletunes_upright: 0.85,
  m1_piano_16: 0.85,

  // Electric Pianos — reference level (~0.85)
  electric_piano_1: 0.85,
  abletunes_fm_piano: 0.85,
  electric_piano_2: 0.85,
  rhodes_stage_mp3: 0.85,
  tri_stage_ep: 0.85,
  dx7_ep1: 0.85,
  triton_dyno_ep: 0.85,

  // Strings & Choir — sustained, high RMS → pull back
  string_ensemble_1: 0.58,
  m1_universe: 0.55,
  m1_symphonic: 0.58,
  m1_strings: 0.58,
  m1_choir: 0.50,
  choir_aahs: 0.50,
  voice_oohs: 0.52,
  ooh_ahh: 0.50,

  // Brass — medium-sustained
  brass_section: 0.72,
  m1_brass_1: 0.72,
  fat_brass_horns: 0.72,
  supersaw_lead: 0.75,
  trumpet: 0.75,
  trombone: 0.75,
  muted_trumpet: 0.70,

  // Saxophones — expressive medium
  alto_sax: 0.75,
  tenor_sax: 0.75,
  soprano_sax: 0.78,
  sax_genuine_solo: 0.75,
  sax_sensual: 0.75,
  sax_blues_growl: 0.78,
  sax_funk_stab: 0.80,
  sax_fall: 0.78,
  sax_scoop: 0.78,
  sax_alto_lead: 0.75,
  sax_soprano: 0.78,

  // Guitars — transient-heavy
  acoustic_guitar_nylon: 0.90,
  electric_guitar_clean: 0.90,
  acoustic_guitar_steel: 0.90,
  distortion_guitar: 0.85,
  overdriven_guitar: 0.85,
  m1_guitar_1: 0.90,
  m1_12string: 0.90,
  fantom_nylon_pluck: 0.90,

  // Bass — low frequency needs presence
  synth_bass_1: 0.80,
  m1_slap_bass: 0.80,
  m1_fretless: 0.82,
  acoustic_bass: 0.90,
  slap_bass_1: 0.85,
  m1_synth_bass_1: 0.80,
  moog_punch_bass: 0.80,
  pick_bass: 0.85,

  // Organ — very sustained, pull back
  drawbar_organ: 0.60,
  m1_organ_2: 0.60,
  m1_rock_organ: 0.60,
  church_organ: 0.60,
  rock_organ: 0.60,

  // Woodwinds — medium
  flute: 0.88,
  clarinet: 0.90,
  m1_flute: 0.88,
  m1_pan_flute: 0.85,
  pan_flute: 0.85,

  // Strings (bowed)
  violin: 0.78,
  cello: 0.80,

  // Bells & Mallet — quick decay, boost slightly
  vibraphone: 1.0,
  harpsichord: 0.95,
  kalimba: 1.0,
  m1_kalimba: 1.0,
  m1_bottle_bell: 0.95,
  m1_bell_ring: 0.95,
  m1_koto: 0.95,
  m1_fresh_air: 0.70,

  // Hits & Stabs — transient, punchy
  tekk_hit1: 0.95,
  tekk_hit2: 0.95,
  tekk_hit3: 0.95,

  // Drum & Percussion — keep punchy
  synth_drum: 0.90,
  drum_kick_r: 0.90,
  drum_snare_r: 0.88,
  drum_hhclosed_r: 0.75,
  drum_hhopen_r: 0.78,
  drum_crash_r: 0.82,
  tr808_kit: 0.85,

  // SFX & Nature Sounds
  applause: 0.70,
  concert_applause: 0.70,
  stadium_roar: 0.70,
  crowd_cheer: 0.70,
  ovation: 0.70,
  breath_noise: 0.65,
  tubular_bells: 0.85,
  wind_chimes: 0.80,
  crystal_chimes: 0.80,
  gunshot: 0.90,
  taiko_drum: 0.90,
  nature_thunder: 0.80,
  nature_rain: 0.85,
  nature_ocean: 0.85,
  nature_birds: 0.85,
  nature_wind: 0.85,

  // Human Voices & Vocal Chants
  vox_yeah: 0.75,
  vox_whoa: 0.75,
  vox_hey: 0.75,
  vox_beatbox: 0.78,

  // Weird & Sci-Fi & Reggae/Dub SFX
  fx_laser: 0.80,
  fx_alien: 0.75,
  fx_bionic: 0.75,
  fx_scratch: 0.80,
  fx_tapestop: 0.80,
  fx_subboom: 0.75,
  fx_airhorn: 0.75,
  dub_siren: 0.75,
  spring_splash: 0.80,
  laser_zap: 0.80,
  dub_horn: 0.75,
  sub_boom: 0.75,
  noise_riser: 0.75,

  // Synthesizer You Signature Samples
  analog_synth_bass_c2_sample: 0.65,
  analog_synth_bass_riff: 0.65,
  gated_snare_cannon_1: 0.80,
  gated_snare_cannon_2: 0.75,
  punchy_80s_kick_hit: 0.75,
  slapback_vox_chop_1: 0.70,
  slapback_vox_chop_2: 0.70,
  slapback_vox_chop_3: 0.70,
  slapback_vox_chop_4: 0.70,
  slapback_vox_chop_10: 0.70,

  // Stickz "Bloom" EDM Samples — hot 0dB mastered club samples trimmed to match acoustic reference
  bloom_closer_lead: 0.52,
  bloom_roses_lead: 0.52,
  bloom_inside_out_lead: 0.52,
  bloom_let_you_go_lead: 0.52,
  bloom_wise_lead: 0.52,
  bloom_paris_pad: 0.55,
  bloom_knowledge_pad: 0.55,
  bloom_breakdown_bass: 0.60,
  bloom_all_we_know_pluck: 0.65,
  bloom_flume_chord: 0.54,
  bloom_chord_swell: 0.54,
  bloom_drop_saw: 0.50,
  bloom_glassy_pluck: 0.65,
  bloom_punch_bass: 0.60,
  bloom_vocal_stab: 0.62,
  bloom_fm_pluck_bass: 0.60,

  // Stickz "Animal" Festival EDM Samples
  animal_drop_pluck_1: 0.62,
  animal_festival_lead_1: 0.52,
  animal_dutch_pluck: 0.62,
  animal_anthem_drone: 0.50,
  animal_punch_bass_1: 0.58,
  animal_bounce_lead: 0.52,
  animal_sub_drop_bass_1: 0.65,
  animal_pluck_arp: 0.62,
  animal_super_saw: 0.50,
  animal_lead_stab: 0.54,
  animal_bass_stab: 0.58,
  animal_growl_bass: 0.55,
  animal_dutch_synth: 0.52,
  animal_chords_lead: 0.52,
  animal_fx_downlifter_1: 0.75,
  animal_fx_impact_1: 0.85,
  animal_fx_riser_1: 0.75,

  // Abletunes EDM Samples
  abletunes_future_bass: 0.60,
  abletunes_pluck: 0.68,

  // Yamaha EOS instruments
  eos_dreamn: 0.60,
  eos_deeproads: 0.85,
  eos_oldroads: 0.85,
  eos_wah_clavi: 0.80,
  eos_lofi_piano: 0.80,
  eos_cp80: 0.80,
  eos_tx816: 0.88,
  eos_midi_grand: 0.85,
  eos_vibes: 1.0,
  eos_vocoder: 0.60,
  eos_saw900: 0.72,
  eos_extacy: 0.72,
  eos_thicksaw: 0.70,
  eos_square2: 0.75,
  eos_seq_ana: 0.72,
  eos_sweeppad: 0.55,
  eos_warmpad: 0.58,
  eos_analog_brass: 0.70,
  eos_synth_brass: 0.70,
  eos_organ_60s: 0.62,
  eos_rubber_bass: 0.82,
  eos_seq_bass: 0.82,
  eos_synbass101: 0.82,
  eos_jazz_guitar: 0.88,
  eos_upright_bass: 0.88,
  eos_fantasia: 0.55,
  eos_jp_strings: 0.58,
  eos_ob_strings: 0.58,
  eos_euro_hit: 0.88,
  eos_acid_bass: 0.80,
  eos_funk_gtr: 0.85,
  eos_silky_pad: 0.52,
  eos_space_voice: 0.55,
  eos_rotary_organ: 0.62,
  eos_mg_square: 0.72,
  eos_slow_strings: 0.58,
  eos_oct_brass: 0.70,

  // EDM Club Bank instruments
  edm_house_piano: 0.85,
  korg_techno_organ: 0.75,
  edm_river_bass1: 0.85,
  edm_dx_funkbass: 0.85,
  edm_club_saw1: 0.75,
  edm_club_brass: 0.80,
  edm_hiq_bass: 0.85,
  edm_mika_piano: 0.85,
  edm_river_bass2: 0.85,
  edm_iconic_lead1: 0.78,
  edm_iconic_lead2: 0.78,
  edm_supersaw_jp80: 0.75,
  edm_bigroom_saw: 0.75,
  edm_trance_oct: 0.75,
  edm_retro_synthbass1: 0.85,
  edm_k2500_oohs: 0.60,
  edm_gus_voice: 0.65,
  edm_warehouse_saw: 0.78,
  edm_trance_synth: 0.75,
  edm_berlin_sub: 0.85,
  edm_club_saw2: 0.75,
  edm_trance_oct2: 0.75,
  omega_saw_gs: 0.75,
  omega_doctor_solo: 0.75,

  // Roland SoundFonts
  roland_d50_fantasia: 0.85,
  roland_u20_choir: 0.82,
  roland_bright_ep: 0.88,
  roland_sc55_warm_pad: 0.80,
  roland_space_voice: 0.82,
  roland_metal_pad: 0.84,
  roland_sc55_finger_bass: 0.92,
  roland_u20_shakuhachi: 0.88,
  roland_orchestra_hit: 0.85,
  roland_synth_brass: 0.85,

  // Pure Studio Sine Soundfonts
  pure_sine_lead: 0.85,
  pure_sine_sub: 0.90,
  warm_sine_keys: 0.88,
  crystal_sine_bells: 0.82,
  cosmic_sine_flute: 0.85,
  deep_sine_pad: 0.80,
};

/**
 * Universal instrument loudness trim resolver.
 * Ensures every instrument (preset or soundfont) receives a calibrated trim gain
 * with an intelligent category fallback so no sound ever falls through to uncalibrated 1.0.
 */
export function getInstrumentTrimGain(instId) {
  if (!instId) return 0.85;
  const id = String(instId).toLowerCase();
  if (INST_TRIM_GAINS[id] !== undefined) return INST_TRIM_GAINS[id];
  if (INST_TRIM_GAINS[instId] !== undefined) return INST_TRIM_GAINS[instId];

  // Smart category-based fallback
  if (id.startsWith("bloom_") || id.startsWith("animal_") || id.startsWith("edm_") || id.startsWith("omega_")) {
    if (id.includes("pluck") || id.includes("arp")) return 0.64;
    if (id.includes("bass") || id.includes("sub")) return 0.62;
    if (id.includes("pad") || id.includes("chord") || id.includes("swell")) return 0.56;
    if (id.includes("fx") || id.includes("impact") || id.includes("riser") || id.includes("downlifter")) return 0.78;
    return 0.54; // Hot-mastered EDM leads & saws
  }
  if (id.startsWith("x5d_")) {
    if (id.includes("piano") || id.includes("roads") || id.includes("keys") || id.includes("clavi") || id.includes("harpsicord")) return 0.94;
    if (id.includes("string") || id.includes("pad") || id.includes("sun") || id.includes("flare") || id.includes("moonstone") || id.includes("ariana") || id.includes("singers") || id.includes("crossfades") || id.includes("newworlds") || id.includes("swell") || id.includes("torquemada")) return 0.85;
    if (id.includes("organ") || id.includes("cafedral")) return 0.88;
    if (id.includes("brass") || id.includes("horn") || id.includes("fanfare")) return 0.92;
    if (id.includes("sax")) return 0.92;
    if (id.includes("bass") || id.includes("megatron") || id.includes("neurofunk")) return 0.94;
    if (id.includes("guitar")) return 0.94;
    if (id.includes("bell") || id.includes("koto") || id.includes("africa") || id.includes("zen")) return 0.95;
    if (id.includes("perc") || id.includes("stab")) return 0.95;
    return 0.92;
  }
  if (id.includes("piano") || id.includes("rhodes") || id.includes("roads") || id.includes("cp80") || id.includes("ep")) return 0.85;
  if (id.includes("string") || id.includes("pad") || id.includes("choir") || id.includes("voice") || id.includes("ooh") || id.includes("vox")) return 0.56;
  if (id.includes("organ")) return 0.60;
  if (id.includes("brass") || id.includes("horn")) return 0.72;
  if (id.includes("sax") || id.includes("reed")) return 0.76;
  if (id.includes("guitar")) return 0.88;
  if (id.includes("bass")) return 0.82;
  if (id.includes("bell") || id.includes("chime") || id.includes("vib") || id.includes("kalimba") || id.includes("koto")) return 0.95;
  if (id.includes("drum") || id.includes("kit") || id.includes("hit") || id.includes("percussion")) return 0.88;
  if (id.includes("flute") || id.includes("clarinet")) return 0.88;
  return 0.80; // Safe workstation reference
}

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

// P2.3: Lazy materialization for the LayerInsertProcessor grids. A Proxy that
// only instantiates a bus the first time a caller actually reads that slot, so
// an engine that never uses layer FX / looper buses allocates zero insert nodes
// (22 processors x ~5 gain nodes idle was always in the graph before).
// NOTE: retrieving the raw backing store via LAZY_INSERT_RAW or calling
// forEach() NEVER materializes new buses - iteration only sees what exists.
const LAZY_INSERT_RAW = Symbol("lazyInsertRaw");
function createLazyInsertGrid(build, size) {
  const rows = [];
  const proxy = new Proxy(rows, {
    get(target, prop) {
      if (prop === LAZY_INSERT_RAW) return target;
      const idx = Number(prop);
      if (Number.isInteger(idx) && idx >= 0) {
        if (size !== undefined && idx >= size) return undefined;
        return target[idx] ?? (target[idx] = build(idx));
      }
      if (prop === "forEach") {
        return (cb) => {
          for (let i = 0; i < rows.length; i++) {
            if (rows[i] !== undefined) cb(rows[i], i);
          }
        };
      }
      return Reflect.get(target, prop);
    },
    has(target, prop) {
      return Reflect.has(target, prop);
    },
  });
  return proxy;
}
function createLazySplitZone(build) {
  const raw = {};
  const proxy = new Proxy(raw, {
    get(target, prop) {
      return target[prop] ?? (target[prop] = build(prop));
    },
    ownKeys() {
      return Reflect.ownKeys(raw);
    },
    getOwnPropertyDescriptor() {
      return { configurable: true, enumerable: true };
    },
  });
  return proxy;
}

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
          if (v.src) v.src.loop = false;
          v.voiceGain.gain.cancelScheduledValues(now);
          v.voiceGain.gain.setValueAtTime(0.0, now);
          v.src.stop(now + 0.01);
          v.src.disconnect();
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
          v.voiceGain.gain.setValueAtTime(v.voiceGain.gain.value || 0.0, now);
          v.voiceGain.gain.setTargetAtTime(0, now, 0.03);
          v.src.stop(now + 0.1);
        } catch (e) {}
      });
      this.sustainedVoices?.clear();

      // Temporarily mute insert input & dryGain to choke ANY orphaned or zombie nodes
      if (this.input?.gain) {
        this.input.gain.cancelScheduledValues(now);
        this.input.gain.setValueAtTime(0.0, now);
        setTimeout(() => {
          try { this.input.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.02); } catch (e) {}
        }, 40);
      }
      if (this.dryGain?.gain) {
        this.dryGain.gain.cancelScheduledValues(now);
        this.dryGain.gain.setValueAtTime(0.0, now);
        setTimeout(() => {
          try { this.dryGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.02); } catch (e) {}
        }, 40);
      }

      this.wetGain.gain.cancelScheduledValues(now);
      this.wetGain.gain.setValueAtTime(0.0, now);
      this.activeFxNodes.forEach((node) => {
        try {
          if (node.gain && node.gain.cancelScheduledValues) {
            node.gain.cancelScheduledValues(now);
            node.gain.setValueAtTime(0.0, now);
          }
        } catch (e) {}
      });
    } catch (e) {}
  }

  setEffect(fxType) {
    this.currentFx = fxType || "clean";
    const ctx = this.ctx;

    const now = ctx.currentTime;
    this.wetGain.gain.cancelScheduledValues(now);
    this.wetGain.gain.setValueAtTime(this.wetGain.gain.value || 0.0, now);
    this.wetGain.gain.setTargetAtTime(0, now, 0.02);

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
        // Base 1.0 + sine ±0.4 swept gain 0.6→1.4, so the open half slammed 40%
        // past unity into the limiter. Use 0.75 ± 0.25 for a clean 0.5→1.0 swing.
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.75;
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 2.0;
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
    // P1 code splitting: the 111KB SFX generator is dynamically imported on
    // first SFX use instead of being parsed at boot (it is only reachable
    // after the user selects an SFX preset). Classification of SFX ids in the
    // hot path uses the standalone stateless check (sfx-instrument-ids.js).
    this.sfxGenerator = null;
    this._sfxLoadPromise = null;

    this.layerInserts = createLazyInsertGrid(
      () => new LayerInsertProcessor(ctx, destinationNode),
      4,
    );

    this.splitZoneInserts = createLazySplitZone(
      () => new LayerInsertProcessor(ctx, destinationNode),
    );

    this.looperInserts = createLazyInsertGrid(
      () => createLazyInsertGrid(() => {
        const bus = new LayerInsertProcessor(ctx, destinationNode);
        bus.engine = this;
        return bus;
      }, 4),
      4,
    );

    this.decodedBuffers = new Map();
    this.activeVoices = new Map();
    this.sustainedVoices = new Map();
    this._allActiveVoices = new Set();
    this._looperPinned = new Set();

    this.sustainPedal = false;
    this.sustainHoldSec = 7.0;
    this.sustainDecayTau = 2.4;
    this.heldNoteSec = 15.0;
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

    // Memory-bounded decode residency (safe eviction).
    // `_pinnedInsts` is the live preset/combi/split set (replaced on sound
    // selection) PLUS the boot core, which is NEVER evicted. `_instProtectedAt`
    // marks instruments that were recently preloaded or touched so the evictor
    // never drops a sound the performer/transport is about to use.
    this._coreInsts = new Set([
      "acoustic_grand_piano",
      "electric_piano_1",
      "string_ensemble_1",
      "distortion_guitar",
    ]);
    this._pinnedInsts = new Set();
    this._instLastUsed = new Map();
    this._instProtectedAt = new Map();
    this._evictTimer = null;
    // Cache for findNearestAnchor: key = "instId:midi:vel", value = {anchorMidi, buffer}
    this._anchorCache = new Map();
    this._anchorCacheMaxSize = 1024;
    // In-memory registry of binary soundfont-pack manifests (small JSON) so
    // instrument selection never re-downloads the manifest — only the pack
    // bytes come from IndexedDB.
    this._packManifests = new Map();
    // Multi-velocity: instId -> ascending velocity lower-bounds (abletunes
    // registers its thresholds at decode time; imported multisample banks via
    // the multisample loader). Replaces the old hardcoded 55/98 law.
    this._velocityThresholds = new Map([
      ["abletunes_upright", [1, 55, 95]],
      ["abletunes_fm_piano", [1, 55, 95]],
    ]);
    // Round-robin: key = "instId:anchorMidi" -> cycle counter, incremented per
    // noteOn so repeated notes alternate through rr1..rrN variants.
    this._rrCounters = new Map();
    // Set of instIds whose prewarm was scheduled before pcmWorkletNode became ready
    this._pendingPrewarms = new Set();

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
    if (layerSlot < 0 || layerSlot > 3) return;
    const bus = this.looperInserts[trackIndex]?.[layerSlot];
    if (!bus) return;

    const voices = this.activeVoices.get(midiNote);
    if (!voices || voices.length === 0) return;

    const ctx = this.ctx;
    const now = when > 0 ? Math.max(when, ctx.currentTime) : ctx.currentTime;
    const remaining = [];

    voices.forEach((v) => {
      // ONLY stop the voice that was played into THIS looper bus!
      if (v.dest === bus.input && (!instId || v.instId === instId)) {
        if (bus.sustainActive) {
          bus.sustainedVoices.add(v);
          return;
        }
        try {
          v.voiceGain.gain.cancelScheduledValues(now);
          v.voiceGain.gain.setValueAtTime(v.voiceGain.gain.value || 0.0, now);
          v.voiceGain.gain.setTargetAtTime(0, now, 0.08);
          v.src.stop(now + 0.35);
          if (v.vibLfo) {
            try { v.vibLfo.stop(now + 0.35); } catch (e) {}
          }
          if (v.growlLfo) {
            try { v.growlLfo.stop(now + 0.35); } catch (e) {}
          }
        } catch (e) {}
      } else {
        remaining.push(v);
      }
    });

    if (remaining.length > 0) this.activeVoices.set(midiNote, remaining);
    else this.activeVoices.delete(midiNote);
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

  setLooperTrackSustain(trackIndex, isDown, _when = 0) {
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
    const tracks = this.looperInserts[LAZY_INSERT_RAW];
    for (let t = 0; t < tracks.length; t++) {
      const row = tracks[t];
      if (!row) continue;
      const buses = row[LAZY_INSERT_RAW];
      for (let l = 0; l < buses.length; l++) {
        const bus = buses[l];
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
            const step = Math.max(1, Math.floor(ch0.length / 600));
            for (let i = 0; i < ch0.length; i += step) {
              ch0Sum += Math.abs(ch0[i]);
              ch1Sum += Math.abs(ch1[i]);
            }
            const louder = ch0Sum >= ch1Sum ? ch0 : ch1;
            const louderSum = Math.max(ch0Sum, ch1Sum);
            const quieterSum = Math.min(ch0Sum, ch1Sum);
            // Rescue panned-mono sources (e.g. the alto_sax bank files that
            // were recorded hard-left with a near-silent right channel) so
            // they play centered instead of "only in one earphone". The
            // previous check only caught a FULLY silent channel; real samples
            // are panned, not silent, so they slipped through. True balanced
            // stereo (>~10dB separation) is left untouched.
            if (louderSum > 0.001 && quieterSum < louderSum / 3.2) {
              ch0.set(louder);
              ch1.set(louder);
            }
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
        // decodeAudioData returns a Promise in all modern browsers; passing a
        // success callback AND chaining .then() used to run handleDecoded twice
        // (double peak normalization / gain scaling). Use the Promise form only.
        ctx.decodeAudioData(arrayBuf)
          .then(handleDecoded)
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  fadeBufferEnd(buf, seconds = 0.02) {
    try {
      if (!buf) return buf;
      const fadeLen = Math.min(
        Math.floor(buf.sampleRate * seconds),
        Math.floor(buf.length * 0.04),
      );
      if (fadeLen < 16) return buf;
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

  /**
   * Trims silent encoder priming frames (e.g. ~1152 samples / 26ms from MP3 / LAME encoding)
   * from the start of an AudioBuffer so that note transients attack instantaneously without delay.
   * Preserves transients by backing off 16 samples and applying a smooth micro-fade.
   *
   * @param {AudioContext|BaseAudioContext} ctx
   * @param {AudioBuffer} originalBuf
   * @param {number} [threshold=0.0015] - Detection threshold in normalized amplitude (-56 dBFS)
   * @returns {AudioBuffer} Trimmed AudioBuffer, or originalBuf if no leading silence detected
   */
  trimLeadingSilence(ctx, originalBuf, threshold = 0.0015) {
    if (!originalBuf || !ctx || typeof ctx.createBuffer !== "function") return originalBuf;
    const numChannels = originalBuf.numberOfChannels;
    const length = originalBuf.length;
    const sampleRate = originalBuf.sampleRate || (ctx && ctx.sampleRate) || 44100;

    // Scan up to 50ms of audio (~2205 frames at 44.1kHz)
    const scanLimit = Math.min(length, Math.floor(sampleRate * 0.05));
    let firstActiveIndex = length;

    for (let c = 0; c < numChannels; c++) {
      const data = originalBuf.getChannelData(c);
      for (let i = 0; i < scanLimit; i++) {
        if (Math.abs(data[i]) >= threshold) {
          if (i < firstActiveIndex) {
            firstActiveIndex = i;
          }
          break;
        }
      }
    }

    // If silence is negligible (< 32 samples / < 0.7ms) or no active transient found within scan limit, do not trim
    if (firstActiveIndex <= 32 || firstActiveIndex >= scanLimit) {
      return originalBuf;
    }

    // Back off 16 samples before the detected threshold crossing to preserve the full transient onset
    const trimStart = Math.max(0, firstActiveIndex - 16);
    if (trimStart <= 0) return originalBuf;

    const newLength = length - trimStart;
    if (newLength <= 0) return originalBuf;

    const trimmedBuf = ctx.createBuffer(numChannels, newLength, sampleRate);
    const fadeLen = Math.min(16, newLength);

    const channelArrays = [];
    for (let c = 0; c < numChannels; c++) {
      const src = originalBuf.getChannelData(c);
      const dst = trimmedBuf.getChannelData(c);
      dst.set(src.subarray(trimStart, length));
      for (let i = 0; i < fadeLen; i++) {
        const factor = 0.5 * (1 - Math.cos((i / fadeLen) * Math.PI));
        dst[i] *= factor;
      }
      channelArrays.push(dst);
    }
    if (typeof AudioBuffer !== "undefined" && trimmedBuf instanceof AudioBuffer) {
      // Native AudioBuffer: getChannelData already accesses the native underlying buffer directly
    } else {
      trimmedBuf.getChannelData = (ch) => channelArrays[ch] || channelArrays[0];
    }

    // Maintain loop points and custom engine flags if present
    if (originalBuf._loopStartSec !== undefined) {
      const trimSec = trimStart / sampleRate;
      trimmedBuf._loopStartSec = Math.max(0, originalBuf._loopStartSec - trimSec);
      if (originalBuf._loopEndSec !== undefined) {
        trimmedBuf._loopEndSec = Math.max(
          trimmedBuf._loopStartSec,
          originalBuf._loopEndSec - trimSec,
        );
      }
    }
    if (originalBuf._isLoopable !== undefined) {
      trimmedBuf._isLoopable = originalBuf._isLoopable;
    }

    return trimmedBuf;
  }

  createCrossfadedLoopBuffer(ctx, originalBuf, instId) {
    if (!originalBuf) return originalBuf;

    // Eliminate MP3 priming silence and encoder latency so all presets attack instantaneously
    originalBuf = this.trimLeadingSilence(ctx, originalBuf);

    const id = String(instId || "").toLowerCase();
    const isX5D = id.startsWith("x5d_");

    // Percussive, decaying acoustic, pluck, bell, drum, or hit instruments must NOT loop
    const isOneShotOrDecaying =
      id.includes("piano") ||
      id.includes("grand") ||
      id.includes("rhodes") ||
      id.includes("roads") ||
      id.includes("wurly") ||
      id.includes("clavi") ||
      id.includes("harpsicord") ||
      id.includes("pluck") ||
      id.includes("guitar") ||
      id.includes("harp") ||
      id.includes("bell") ||
      id.includes("mallet") ||
      id.includes("kalimba") ||
      id.includes("koto") ||
      id.includes("vibraphone") ||
      id.includes("marimba") ||
      id.includes("drum") ||
      id.includes("perc") ||
      id.includes("kick") ||
      id.includes("snare") ||
      id.includes("hihat") ||
      id.includes("cymbal") ||
      id.includes("pizzo") ||
      id.includes("hit") ||
      id.includes("stab") ||
      id.includes("slap") ||
      id.includes("impact") ||
      id.includes("downlifter") ||
      id.includes("riser") ||
      id.includes("tapestop") ||
      id.startsWith("fx_") ||
      id.startsWith("tekk_");

    const isDroneInstrument =
      !isOneShotOrDecaying &&
      (isX5D ||
        id.includes("string") ||
        id.includes("pad") ||
        id.includes("choir") ||
        id.includes("organ") ||
        id.includes("voice") ||
        id.includes("vox") ||
        id.includes("universe") ||
        id.includes("sax") ||
        id.includes("bass") ||
        id.includes("flute") ||
        id.includes("clarinet") ||
        id.includes("trumpet") ||
        id.includes("trombone") ||
        id.includes("violin") ||
        id.includes("cello") ||
        id.includes("brass") ||
        id.includes("horn") ||
        id.includes("reed") ||
        id.includes("oboe") ||
        id.includes("bassoon") ||
        id.includes("accordion") ||
        id.includes("accordeon") ||
        id.includes("cafedral") ||
        id.includes("harmonica") ||
        id.includes("shakuhachi") ||
        id.includes("saw") ||
        id.includes("extacy") ||
        id.includes("vocoder") ||
        id.includes("synth") ||
        id.includes("lead") ||
        id.includes("square") ||
        id.includes("thicksaw") ||
        id.includes("sweeppad") ||
        id.includes("warmpad") ||
        id.includes("seq_") ||
        id.includes("dreamn"));

    // Stereo Channel Healing: if 2 channels and right channel is silent, copy left to right
    if (originalBuf.numberOfChannels >= 2) {
      const ch0 = originalBuf.getChannelData(0);
      const ch1 = originalBuf.getChannelData(1);
      let ch0Sum = 0,
        ch1Sum = 0;
      for (let i = 0; i < Math.min(1000, ch0.length); i += 10) {
        ch0Sum += Math.abs(ch0[i]);
        ch1Sum += Math.abs(ch1[i]);
      }
      if (ch0Sum > 0.001 && ch1Sum < 0.00005) ch1.set(ch0);
    }

    if (
      instId.startsWith("tekk_") ||
      !isDroneInstrument ||
      originalBuf.duration < 0.45
    ) {
      return this.fadeBufferEnd(originalBuf, 0.02);
    }

    return configureSustainLoop(originalBuf, "", instId);
  }

  _yield() {
    return new Promise((r) => {
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(() => r());
      } else {
        setTimeout(r, 16);
      }
    });
  }

  async initBuffers() {
    // Boot decode only what the DEFAULT preset (ballad_master) needs, so the
    // heap stays bounded. Every other instrument decodes lazily on first use
    // via preloadInstrument() (wired in preset selection) / findNearestAnchor.
    const eagerInsts = [
      "acoustic_grand_piano",
      "electric_piano_1",
      "string_ensemble_1",
      "distortion_guitar",
    ];
    // Decode sequentially with a yield between each so the UI can paint
    // during boot. Promise.all ran all 4 in parallel which blocked the main
    // thread for the full combined decode time — causing blank tabs and
    // startup hiccups.
    for (const id of eagerInsts) {
      await this.decodeEmbeddedAnchors(id);
      await this._yield();
    }
    this._createReedChiffBuffer();
    this.isReady = true;
    this._dbgMainThreadVoices = 0;
    console.log(
      `[PCM] ready: decodedInsts=${this.decodedBuffers.size} ` +
        `workletReady=${!!(this.pcmWorkletNode && this.pcmWorkletNode.isReady)} ` +
        `activeVoices=${this.activeVoices.size}`,
    );
    // On low-end Android, defer the non-default FM piano bank to lazy decode
    // (it is decoded on first selection). The upright is the default preset
    // piano, so it stays eager. Saves a large boot-time decode spike.
    {
      const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);
      let deviceMem = 4;
      if (typeof navigator !== "undefined" && navigator.deviceMemory) {
        deviceMem = navigator.deviceMemory;
      }
      // On low-end devices, defer ALL Abletunes loads to the idle preload
      // (they decode lazily on first selection). This removes ~200ms of
      // synchronous main-thread decode from boot so the UI can paint first.
      if (!(isMobile && deviceMem <= 6)) {
        this.loadAbletunesInstrument("upright_piano");
        this.loadAbletunesInstrument("fm_piano");
      }
    }
    setTimeout(() => {
      const w = this.pcmWorkletNode;
      console.info(
        `[PCM] t+4s: workletReady=${!!(w && w.isReady)} ` +
          `initError=${w && w.lastInitError ? String(w.lastInitError).slice(0, 140) : "none"} ` +
          `activeVoices=${this.activeVoices.size}`,
      );
    }, 4000);
    // Small, memory-aware progressive preload of the most common core
    // instruments, staggered, stopping early once decoded usage approaches the
    // budget. Uses decoded-byte accounting (getDecodedBufferStats), NOT
    // performance.memory — which is undefined on many Android WebViews and
    // silently disabled the cap (preloading everything = boot OOM).
    //
    // Runs via requestIdleCallback with deadline checks so decode work NEVER
    // blocks rendering — each instrument is decoded only when the browser has
    // idle time, and yields immediately if a render is pending.
    //
    // On desktop we preload fewer instruments so the decoded-RAM budget is
    // never exceeded during playback or scrolling, avoiding eviction churn
    // that causes stutter and OOM crashes on low-end devices.
    const warm = [
      "drawbar_organ",
      "choir_aahs",
      "synth_bass_1",
      "brass_section",
      "alto_sax",
    ];
    const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);
    let deviceMem = 4;
    if (typeof navigator !== "undefined" && navigator.deviceMemory) {
      deviceMem = navigator.deviceMemory;
    }
    // Low-end phones get only the first 3 staples; desktop gets a modest 5
    // so decoded RAM stays under the budget and eviction doesn't churn during live play.
    const limit = isMobile && deviceMem <= 3 ? 3 : isMobile && deviceMem <= 6 ? 6 : 5;
    const decodedBudget = this._getDecodedMemoryBudget();
    const softCap = isMobile ? Math.floor(decodedBudget * 0.6) : 700 * 1024 * 1024;

    const warmUp = () => {
      let idx = 0;
      const step = (deadline) => {
        while (idx < limit) {
          // If the browser needs to paint, stop immediately.
          if (deadline && deadline.timeRemaining() < 5) {
            requestAnimationFrame(() => requestIdleCallback(step));
            return;
          }
          const stats = this.getDecodedBufferStats();
          if (stats.bytes > softCap) break;
          const inst = warm[idx++];
          this.preloadInstrument(inst).catch(() => {}).finally(() => {
            // After each instrument, yield then continue in next idle slot.
            requestAnimationFrame(() => requestIdleCallback(step));
          });
          return; // one instrument per idle callback
        }
        this._scheduleEvictionCheck(2000);
      };
      requestIdleCallback(step, { timeout: 15000 });
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      setTimeout(warmUp, 3000);
    } else {
      // Fallback: staggered with generous gaps so UI stays responsive.
      (async () => {
        for (let i = 0; i < limit; i++) {
          try { await this.preloadInstrument(warm[i]); } catch (e) {}
          await new Promise(r => setTimeout(r, 500));
        }
        this._scheduleEvictionCheck(2000);
      })();
    }
  }

  preloadInstrument(instId) {
    if (!instId || !this.ctx) return Promise.resolve();
    // A selected sound must never be dropped by budget eviction: any instrument
    // the app explicitly preloads is in active use, so protect it for the full
    // PROTECT_MS window (or until a new preset replaces the pin set).
    const baseId = (instId && INST_ALIASES[instId]) || instId;
    if (this._instProtectedAt) {
      this._instProtectedAt.set(baseId, Date.now() + PROTECT_MS);
    }
    if (this.decodedBuffers.has(baseId) && this.decodedBuffers.get(baseId).size > 0) {
      this._prewarmWorklet(baseId);
      return Promise.resolve();
    }
    if (isSfxInstrumentId(baseId)) {
      // Kick the lazy SFX bootstrap (P1) so the generator is ready by the time
      // a key is pressed; SFX instruments have no PCM anchors to decode.
      this.ensureSfxGenerator().catch(() => {});
      return Promise.resolve();
    }
    if (multisampleLoader && multisampleLoader.isMultisampleInstrument(baseId)) {
      return multisampleLoader.loadInstrument(baseId, this.ctx, this.decodedBuffers).then(() => {
        this._prewarmWorklet(baseId);
      });
    }
    if (baseId.startsWith("animal_")) {
      return animalEdmLoader.loadInstrument(baseId, this.ctx, this.decodedBuffers).then(() => {
        this._prewarmWorklet(baseId);
      });
    } else if (baseId.startsWith("bloom_")) {
      return bloomEdmLoader.loadInstrument(baseId, this.ctx, this.decodedBuffers).then(() => {
        this._prewarmWorklet(baseId);
      });
    } else if (baseId.startsWith("abletunes_")) {
      const bankKey = baseId === "abletunes_fm_piano" ? "fm_piano" : "upright_piano";
      return this.loadAbletunesInstrument(bankKey).then(() => {
        this._prewarmWorklet(baseId);
      });
    } else {
      return this.decodeEmbeddedAnchors(baseId).then(() => {
        this._prewarmWorklet(baseId);
      });
    }
  }

  /**
   * Lazily bootstraps the SfxSoundGenerator via dynamic import. Kicked from
   * preloadInstrument (SFX preset selected) and the noteOn hot path; until it
   * resolves, SFX notes are dropped (silence for a fraction of a second —
   * consistent with the engine's silence-over-wrong-instrument policy).
   */
  ensureSfxGenerator() {
    if (this.sfxGenerator) return Promise.resolve(this.sfxGenerator);
    if (this._sfxLoadPromise) return this._sfxLoadPromise;
    this._sfxLoadPromise = import("./sfx-sound-generator.js")
      .then((mod) => {
        this.sfxGenerator = new mod.SfxSoundGenerator(this.ctx, this.destination);
        this._sfxLoadPromise = null;
        return this.sfxGenerator;
      })
      .catch((err) => {
        this._sfxLoadPromise = null;
        logger.warn("PCM", "Failed to lazy-load SFX generator", err);
        return null;
      });
    return this._sfxLoadPromise;
  }

  async loadSoundfont(instId) {
    if (!instId || this.loadingSoundfonts.has(instId)) return;
    if (isSfxInstrumentId(instId)) {
      // Kick the lazy SFX bootstrap so the generator is ready by the time a
      // key is pressed (import + construction is a one-time fraction of a
      // second; until then SFX notes are dropped).
      this.ensureSfxGenerator().catch(() => {});
      return;
    }
    this.loadingSoundfonts.add(instId);
    try {
      // P1: binary pack path — one fetch + one IndexedDB entry per instrument,
      // no megabyte-scale JSON.parse and no per-sample base64 decode on the
      // main thread (the old JSONP pipeline cost seconds on Android WebView).
      const loaded = await this._loadSoundfontPack(instId);
      if (loaded) {
        this._prewarmWorklet(instId);
        return;
      }
      // Fallback: legacy JSONP path (dev trees / builds without extracted packs).
      await this._loadSoundfontJsonp(instId);
      this._prewarmWorklet(instId);
    } catch (err) {
      logger.warn("PCM", `Failed to load soundfont: ${instId}`, err);
    } finally {
      // Allow the instrument to be loaded again later (e.g. after cold eviction
      // frees it). Without this, an evicted soundfont could never re-decode.
      this.loadingSoundfonts.delete(instId);
      this._maybeEvictDecodedBuffers();
    }
  }

  /**
   * Loads a soundfont from its build-time extracted binary pack
   * (`/soundfonts-bin/<id>.pack` + sibling `.json` manifest, see
   * tools/extract-soundfonts.mjs). One fetch + one IndexedDB entry per
   * instrument instead of ~88 sequential base64 decodes plus a megabyte-scale
   * JSON.parse on the main thread; the pack is also ~25% smaller than its
   * base64 JSONP source. Returns true when loaded, null when the packs are
   * unavailable (caller falls back to the JSONP path).
   */
  async _loadSoundfontPack(instId) {
    try {
      if (this.decodedBuffers.has(instId) && this.decodedBuffers.get(instId).size > 0) {
        return true;
      }
      const cacheKey = instId.startsWith("x5d_") ? `sfb_v2_${instId}` : `sfb_${instId}`;
      let manifest = this._packManifests.get(instId);
      let packBuf = null;

      const cachedEntry = await sampleCache.getSampleEntry(cacheKey);
      if (cachedEntry) {
        packBuf = cachedEntry.buffer;
        if (!manifest && cachedEntry.metadata?.manifest) {
          manifest = cachedEntry.metadata.manifest;
          this._packManifests.set(instId, manifest);
        }
      }

      // If pack is cached in IndexedDB but manifest wasn't in metadata (e.g. legacy entry),
      // we ONLY fetch the tiny ~1KB .json manifest, NEVER re-downloading the multi-MB .pack.
      if (packBuf && !manifest) {
        try {
          const manifestResp = await fetch(`/soundfonts-bin/${instId}.json`);
          if (manifestResp && manifestResp.ok) {
            const parsed = await manifestResp.json();
            if (parsed && Array.isArray(parsed.samples) && parsed.samples.length > 0) {
              manifest = parsed;
              this._packManifests.set(instId, manifest);
              sampleCache.setSample(cacheKey, packBuf, {
                instId,
                kind: "soundfont-pack",
                manifest,
              });
            }
          }
        } catch (_) {}
      }

      // If either pack or manifest is still missing, fetch both from network
      if (!manifest || !packBuf) {
        const base = `/soundfonts-bin/${instId}`;
        const [manifestResp, packResp] = await Promise.all([
          fetch(`${base}.json`),
          fetch(`${base}.pack`),
        ]);
        if (!manifestResp.ok || !packResp.ok) return null;
        const contentType = packResp.headers.get("content-type") || "";
        if (contentType.includes("text/html")) return null;
        manifest = await manifestResp.json();
        if (!manifest || !Array.isArray(manifest.samples) || manifest.samples.length === 0) {
          return null;
        }
        packBuf = await packResp.arrayBuffer();
        sampleCache.setSample(cacheKey, packBuf, { instId, kind: "soundfont-pack", manifest });
        this._packManifests.set(instId, manifest);
      }

      if (!this.decodedBuffers.has(instId))
        this.decodedBuffers.set(instId, new Map());
      const instMap = this.decodedBuffers.get(instId);
      const ctx = this.ctx;
      // Decode the anchors nearest C4 first so the first played notes become
      // playable as early as possible.
      const entries = manifest.samples
        .slice()
        .sort((a, b) => Math.abs(a.m - 60) - Math.abs(b.m - 60));

      // Corrupt pack healing helper (single-flight per instrument so concurrent
      // decodes in a batch don't spawn multiple parallel fetches of the same pack).
      let healPromise = null;
      const getFreshPack = () => {
        if (!healPromise) {
          healPromise = (async () => {
            const packResp = await fetch(`/soundfonts-bin/${instId}.pack`).catch(() => null);
            if (packResp && packResp.ok) {
              const fresh = await packResp.arrayBuffer();
              packBuf = fresh;
              sampleCache.setSample(cacheKey, fresh, {
                instId,
                kind: "soundfont-pack",
                manifest,
              });
              return fresh;
            }
            return null;
          })().finally(() => {
            healPromise = null;
          });
        }
        return healPromise;
      };

      const BATCH_SIZE = 8;
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (s) => {
            const midi = s.m;
            if (typeof midi !== "number") return;
            try {
              let audioBuf = null;
              try {
                audioBuf = await this.decodeAudioBuffer(
                  ctx,
                  packBuf.slice(s.o, s.o + s.l),
                );
              } catch (firstErr) {
                // Corrupt pack in IndexedDB (a known WebView failure mode): the
                // cached bytes fail decode on every future note. Refetch a
                // fresh copy (single-flight), HEAL the cache entry, and retry so the
                // instrument recovers permanently instead of staying silent until reinstall.
                const fresh = await getFreshPack();
                if (fresh) {
                  audioBuf = await this.decodeAudioBuffer(ctx, fresh.slice(s.o, s.o + s.l));
                }
              }
              if (!audioBuf) return;
              const processedBuf = this.createCrossfadedLoopBuffer(
                ctx,
                audioBuf,
                instId,
              );
              instMap.set(midi, processedBuf);
              this._trackDecodedBuffer(instId, processedBuf);
            } catch (err) {
              logger.warn(
                "PCM",
                `Failed to decode soundfont sample ${s.n} for "${instId}"`,
                err,
              );
            }
          }),
        );
      }
      this._prewarmWorklet(instId);
      return instMap.size > 0;
    } catch (err) {
      logger.warn("PCM", `Soundfont pack load failed for "${instId}" — falling back to JSONP`, err);
      return null;
    }
  }

  async _loadSoundfontJsonp(instId) {
    try {
      const resp = await fetch(`/soundfonts/${instId}-mp3.js`);
      if (!resp.ok) return;
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("text/html")) return;
      const text = await resp.text();
      if (!text || text.trim().startsWith("<")) return;
      const samples = this.parseSoundfontJsonp(text);
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
              let audioBuf = null;
              try {
                audioBuf = await this.decodeAudioBuffer(ctx, arrayBuf);
              } catch (firstErr) {
                // Corrupt IndexedDB cache (a known WebView failure mode): retry
                // with a freshly decoded copy and HEAL the cache entry, so the
                // instrument recovers permanently instead of falling back to a
                // wrong-instrument substitute forever.
                const fresh = this.base64ToArrayBuffer(base64Uri);
                audioBuf = await this.decodeAudioBuffer(ctx, fresh);
                sampleCache.setSample(cacheKey, fresh, { instId, midi });
              }
              const processedBuf = this.createCrossfadedLoopBuffer(
                ctx,
                audioBuf,
                instId,
              );
              instMap.set(midi, processedBuf);
              this._trackDecodedBuffer(instId, processedBuf);
            } catch (err) {
              logger.warn(
                "PCM",
                `Failed to decode soundfont sample ${noteName} for "${instId}"`,
                err,
              );
            }
          }),
        );
      }
    } catch (err) {
      logger.warn("PCM", `Failed to load soundfont: ${instId}`, err);
    }
  }

  /**
   * Safely parses the MusyngKite/FluidR3 JSONP soundfont files
   * (`MIDI.Soundfont.<id> = { note: "data:..." }`).
   *
   * The previous implementation executed the fetched text via `new Function`,
   * which would run arbitrary script if a static asset was ever tampered with
   * or served by a compromised host. We now extract the object literal and
   * parse it as strict JSON instead.
   */
  parseSoundfontJsonp(text) {
    if (typeof text !== "string" || !text.includes("MIDI.Soundfont")) return null;
    const markerIdx = text.lastIndexOf("MIDI.Soundfont");
    const eqIdx = text.indexOf("= {", markerIdx);
    if (eqIdx < 0) return null;
    const start = text.indexOf("{", eqIdx);
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    let json = text.slice(start, end + 1);
    // JSONP object literals end with a trailing comma before the closing brace —
    // legal in JS, illegal in JSON. Strip them so JSON.parse accepts the payload.
    json = json.replace(/,(\s*})/g, "$1");
    try {
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        return parsed;
      }
    } catch (err) {
      logger.warn("PCM", "Failed to parse soundfont JSONP payload", err);
    }
    return null;
  }

  async loadAbletunesInstrument(bankKey) {
    const bank = ABLETUNES_BANKS[bankKey];
    if (!bank) return;
    const instId = bank.id;
    if (this.loadingSoundfonts.has(instId)) return;
    this.loadingSoundfonts.add(instId);
    try {
      await this._runLoadAbletunes(bank, bankKey, instId);
    } finally {
      // Allow the instrument to be loaded again later (e.g. after cold eviction
      // frees it, or after a transient decode failure). Without this release,
      // the loading guard blocks every future load attempt for the rest of the
      // session — an evicted/failed instrument would never re-decode and both
      // live play and clip playback would go permanently silent.
      this.loadingSoundfonts.delete(instId);
      this._maybeEvictDecodedBuffers();
    }
  }

  async _runLoadAbletunes(bank, bankKey, instId) {
    if (!this.decodedBuffers.has(instId))
      this.decodedBuffers.set(instId, new Map());
    const instMap = this.decodedBuffers.get(instId);
    const ctx = this.ctx;
    const coreAnchors = bank.samples.slice().sort((a, b) => Math.abs(a.m - 60) - Math.abs(b.m - 60));
    const BATCH = 4;
    for (let i = 0; i < coreAnchors.length; i += BATCH) {
      const batch = coreAnchors.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (sample) => {
          try {
            const cacheKey = `able_${instId}_${sample.f}`;
            let arrayBuf = await sampleCache.getSample(cacheKey);
            if (arrayBuf && !sampleCache.constructor._looksLikeAudio(new Uint8Array(arrayBuf.slice(0, 16)))) {
              arrayBuf = null; // discard corrupt or HTML 404 cache entry
            }
            const safeFile = sample.f.split("/").map(encodeURIComponent).join("/");
            if (!arrayBuf) {
              const url = `${bank.path}/${safeFile}`;
              const resp = await fetch(url);
              if (!resp.ok) return;
              arrayBuf = await resp.arrayBuffer();
              sampleCache.setSample(cacheKey, arrayBuf, {
                instId,
                file: sample.f,
              });
            }
            let audioBuf = null;
            try {
              audioBuf = await this.decodeAudioBuffer(ctx, arrayBuf);
            } catch (cacheErr) {
              // Corrupt IndexedDB cache (a known WebView failure mode): the
              // cached bytes fail decode on every future note. Re-fetch a
              // fresh copy, HEAL the cache entry, and retry so the instrument
              // recovers permanently instead of staying silent until reinstall.
              const url = `${bank.path}/${safeFile}`;
              const resp = await fetch(url);
              if (resp.ok) {
                const fresh = await resp.arrayBuffer();
                audioBuf = await this.decodeAudioBuffer(ctx, fresh);
                sampleCache.setSample(cacheKey, fresh, {
                  instId,
                  file: sample.f,
                });
              }
            }
            if (!audioBuf) return;
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
            this._trackDecodedBuffer(instId, processedBuf);
          } catch (e) {
            logger.warn(
              "PCM",
              `Failed to decode Abletunes sample ${sample.f} for "${instId}"`,
              e,
            );
          }
        }),
      );
      this._prewarmWorklet(instId);
    }
  }

  async decodeEmbeddedAnchors(instId) {
    const baseId = (instId && INST_ALIASES[instId]) || instId;
    if (!this._decodePromises) this._decodePromises = new Map();
    if (this._decodePromises.has(baseId)) return this._decodePromises.get(baseId);
    const p = this._runDecodeEmbedded(baseId).finally(() => {
      this._decodePromises.delete(baseId);
    });
    this._decodePromises.set(baseId, p);
    return p;
  }

  async _runDecodeEmbedded(instId) {
    const baseId = (instId && INST_ALIASES[instId]) || instId;
    const bank = await ensureBankForInst(baseId);
    const instData = bank ? bank[baseId] : null;
    if (!instData || !instData.anchors) {
      return this.loadSoundfont(baseId);
    }
    if (!this.decodedBuffers.has(baseId))
      this.decodedBuffers.set(baseId, new Map());
    const instMap = this.decodedBuffers.get(baseId);
    const ctx = this.ctx;
    const anchors = Object.entries(instData.anchors);

    // Each anchor decode includes a sync createCrossfadedLoopBuffer call that
    // copies and crossfades the full AudioBuffer on the main thread. Batching
    // multiple anchors back-to-back blocks rendering for the combined duration
    // (3 anchors × 20ms = 60ms = 3-4 dropped frames). Decode one at a time
    // with a yield between each so the browser can always paint.
    const BATCH_SIZE = 1;

    for (let i = 0; i < anchors.length; i += BATCH_SIZE) {
      const batch = anchors.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async ([midiStr, anchor]) => {
        const midi = parseInt(midiStr);
        try {
          const arrayBuf = await this.fetchEmbeddedAnchor(anchor);
          const audioBuf = await this.decodeAudioBuffer(ctx, arrayBuf);
          const processedBuf = this.createCrossfadedLoopBuffer(
            ctx,
            audioBuf,
            instId,
          );
          instMap.set(midi, processedBuf);
          this._trackDecodedBuffer(instId, processedBuf);
        } catch (e) {
          console.warn(
            `[PCM Rompler] Anchor ${midi} decode failed for ${instId}:`,
            e,
          );
        }
      }));
      // Yield to rendering pipeline between batches/anchors.
      if (i + BATCH_SIZE < anchors.length) {
      await this._yield();
      }
    }
    this._prewarmWorklet(baseId);
    this._maybeEvictDecodedBuffers();
  }

  /**
   * Resolves an embedded bank anchor to its raw encoded bytes. Anchors now
   * point at bundled .mp3 assets ("banks/<bank>/<instId>/<midi>.mp3");
   * legacy inline "data:audio/mp3;base64,…" values are still supported.
   */
  async fetchEmbeddedAnchor(anchor) {
    if (typeof anchor === "string" && anchor.startsWith("data:")) {
      return this.base64ToArrayBuffer(anchor);
    }
    const resp = await fetch(anchor);
    if (!resp.ok) throw new Error(`Anchor asset ${anchor} -> HTTP ${resp.status}`);
    return resp.arrayBuffer();
  }

  _trackDecodedBuffer(instId, buf) {
    if (!buf) return;
    if (!this._bufOwner) this._bufOwner = new WeakMap();
    this._bufOwner.set(buf, instId);
  }

  /**
   * Uploads an instrument's decoded buffers to the worklet ahead of the first
   * note (P1.5). Registers the decode name plus every alias that resolves to
   * it, because the worklet keys noteOn by the requested instId.
   *
   * P1: chunked + idle-scheduled — the full-PCM Float32 channel copies run
   * across idle callbacks in small batches instead of one synchronous burst.
   * This used to run inside the preset click handler and cost tens-to-hundreds
   * of ms of main-thread jank on Android for multi-anchor instruments.
   */
  _prewarmWorklet(instId) {
    const w = this.pcmWorkletNode;
    if (!instId) return;
    const baseId = (instId && INST_ALIASES[instId]) || instId;
    if (!w || !w.isReady) {
      if (!this._pendingPrewarms) this._pendingPrewarms = new Set();
      this._pendingPrewarms.add(baseId);
      return;
    }
    const instMap = this.decodedBuffers.get(baseId);
    if (!instMap || instMap.size === 0) return;
    w.prewarmChunked(baseId, instMap);
  }

  /**
   * Flushes all pending prewarms that were queued while the AudioWorklet was
   * initializing. Called when pcmWorkletNode becomes ready.
   */
  flushPendingPrewarms() {
    if (!this._pendingPrewarms || this._pendingPrewarms.size === 0) return;
    const w = this.pcmWorkletNode;
    if (!w || !w.isReady) return;
    for (const instId of this._pendingPrewarms) {
      this._prewarmWorklet(instId);
    }
    this._pendingPrewarms.clear();
  }

  _touchBuffer(buf) {
    if (!buf) return;
    const owner = this._bufOwner && this._bufOwner.get(buf);
    if (!owner) return;
    if (!this._instLastUsed) this._instLastUsed = new Map();
    this._instLastUsed.set(owner, Date.now());
    // Protection updated on the same cadence as lastUsed (every 12 touches)
    // to avoid a Date.now() allocation on every single note.
    if (!this._touchCount) this._touchCount = 0;
    if (++this._touchCount % 12 === 0) {
      if (!this._instProtectedAt) this._instProtectedAt = new Map();
      this._instProtectedAt.set(owner, Date.now() + PROTECT_MS);
      // Time-gated eviction check — only when 3+ seconds since last schedule.
      const now = performance.now();
      if (now - (this._lastEvictSchedule || 0) > 3000) {
        this._lastEvictSchedule = now;
        this._scheduleEvictionCheck(0);
      }
    }
  }

  _decodedBufferBytes(instMap) {
    if (!instMap || instMap.size === 0) return 0;
    const rate = this.ctx ? this.ctx.sampleRate : 44100;
    let bytes = 0;
    for (const buf of instMap.values()) {
      if (!buf) continue;
      const ch = Math.max(2, buf.numberOfChannels || 2);
      const sr = buf.sampleRate || rate;
      bytes += buf.duration * sr * ch * 4;
    }
    return bytes;
  }

  _getActiveInstIds() {
    const ids = new Set();
    if (this.playNoteUsing && this.playNoteUsing.size > 0) {
      for (const id of this.playNoteUsing) ids.add(id);
    }
    if (this.activeVoices && this.activeVoices.size > 0) {
      for (const [, v] of this.activeVoices) {
        if (v && v.instId) ids.add(v.instId);
      }
    }
    return ids;
  }

  /**
   * Replaces the "do not evict" set with exactly the instruments the current
   * sound needs (preset / combi / split layers), unioned with the boot core.
   * Called by multi-layer-engine every time a sound is selected/deselected.
   */
  setPinnedInstruments(instIds) {
    if (!this._pinnedInsts) this._pinnedInsts = new Set();
    const next = this._coreInsts ? new Set(this._coreInsts) : new Set();
    if (instIds) {
      for (const id of instIds) if (id) next.add(id);
    }
    // Looper pins survive preset switches — a recorded clip's frozen preset
    // instruments are NOT part of the live set and must never be evicted
    // (eviction dropped them mid-session → silent clip playback, measured).
    if (this._looperPinned) {
      for (const id of this._looperPinned) next.add(id);
    }
    this._pinnedInsts = next;
  }

  /** Pins instruments for recorded clip presets (survives preset switches). */
  pinLooperInstruments(instIds) {
    if (!instIds) return;
    if (!this._looperPinned) this._looperPinned = new Set();
    const fresh = [];
    for (const id of instIds) {
      if (id && !this._looperPinned.has(id)) {
        this._looperPinned.add(id);
        fresh.push(id);
      }
    }
    if (fresh.length && this._pinnedInsts) {
      for (const id of fresh) this._pinnedInsts.add(id);
    }
  }

  unpinLooperInstruments(instIds) {
    if (!instIds || !this._looperPinned) return;
    for (const id of instIds) {
      if (!id) continue;
      this._looperPinned.delete(id);
      if (
        this._pinnedInsts &&
        !this._looperPinned.has(id) &&
        !(this._coreInsts && this._coreInsts.has(id))
      ) {
        this._pinnedInsts.delete(id);
      }
    }
  }

  addPinnedInstruments(instIds) {
    if (!instIds) return;
    if (!this._pinnedInsts) this._pinnedInsts = new Set(this._coreInsts || []);
    for (const id of instIds) if (id) this._pinnedInsts.add(id);
  }

  removePinnedInstruments(instIds) {
    if (!instIds || !this._pinnedInsts) return;
    for (const id of instIds) {
      if (id && this._coreInsts && !this._coreInsts.has(id)) {
        this._pinnedInsts.delete(id);
      }
    }
  }

  /**
   * Any instrument that produced a note within PROTECT_MS is not evictable —
   * it protects both worklet-routed voices (which never populate activeVoices)
   * and main-thread voices alike.
   */
  _isDecodeProtected(instId) {
    if (!instId) return true;
    if (this._coreInsts && this._coreInsts.has(instId)) return true;
    if (this._pinnedInsts && this._pinnedInsts.has(instId)) return true;
    const prot = this._instProtectedAt && this._instProtectedAt.get(instId);
    if (prot && Date.now() < prot) return true;
    return false;
  }

  _getDecodedMemoryBudget() {
    const isMobile =
      typeof window !== "undefined" &&
      (window.Capacitor ||
        /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent));
    if (!isMobile) return 1024 * 1024 * 1024; // 1GB for desktop-class devices
    // Real Android RAM-conscious budgets — scaled to device memory so modern
    // phones with 6GB+ RAM don't get a hard 384MB cap that causes OOM churn.
    let deviceMem = 0;
    if (typeof navigator !== "undefined" && navigator.deviceMemory) {
      deviceMem = navigator.deviceMemory;
    } else if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
      // navigator.deviceMemory is often UNAVAILABLE on Android browsers — the
      // old default of 4 gave an 8GB Xiaomi Pad 6 a stifling 128MB budget.
      // Proxy by CPU cores instead: 6+ cores ≈ mid/high device (Pad 6 = 8).
      deviceMem = navigator.hardwareConcurrency >= 6 ? 8 : 4;
    }
    // Unknown Android fallback: 256MB (safer than the old 128MB, still OOM-safe).
    if (deviceMem <= 0) return 256 * 1024 * 1024;
    // Scale budget proportionally to device RAM. Decoded PCM lives in NATIVE
    // memory (outside the V8 heap), so the ceiling that matters here is device
    // RAM, not jsHeapSizeLimit. MEASURED on an 8GB Pad 6: the old 384MB cap
    // sat BELOW the 753MB working set of heavy presets, so cold-eviction fired
    // constantly (churn + dropouts). 900MB holds the working set; low tiers
    // stay strict for OOM safety.
    if (deviceMem <= 2) return 64 * 1024 * 1024;
    if (deviceMem <= 4) return 128 * 1024 * 1024;
    if (deviceMem <= 6) return 256 * 1024 * 1024;
    if (deviceMem <= 8) return 900 * 1024 * 1024;
    if (deviceMem <= 12) return 1024 * 1024 * 1024;
    return 1024 * 1024 * 1024; // 1GB for 12GB+ RAM devices
  }

  getDecodedBufferStats() {
    let insts = 0;
    let buffers = 0;
    let bytes = 0;
    if (this.decodedBuffers) {
      for (const map of this.decodedBuffers.values()) {
        if (map && map.size > 0) insts++;
        buffers += map ? map.size : 0;
        bytes += this._decodedBufferBytes(map);
      }
    }
    return {
      instCount: insts,
      bufferCount: buffers,
      bytes,
      bytesMB: Math.round(bytes / 1024 / 1024),
      pinned: this._pinnedInsts ? this._pinnedInsts.size : 0,
      budget: this._getDecodedMemoryBudget(),
    };
  }

  /**
   * Budget-bounded, cold-only decoded-buffer eviction.
   *
   * SAFETY DESIGN (this is what made v2.0.x churn and get disabled):
   *  - Candidates are ONLY instruments that are unpinned, not currently
   *    sounding, not decoding, and idle for > PROTECT_MS. Pinned instruments
   *    (current preset, playing demo, boot core) can never be evicted, and
   *    re-selection re-protects via preloadInstrument()/touch, so scheduled
   *    playback never re-decodes mid-song.
   *  - Eviction is never run from the note hot path (_touchBuffer). It runs
   *    from a debounced timer after decode/preload settles and from the
   *    memory manager on real pressure.
   *  - Each drop frees BOTH the main-thread AudioBuffer map AND the worklet's
   *    Float32Array catalog via dropInstrument().
   */
  _safeEvictDecodedBuffers(force = false) {
    if (!this.decodedBuffers || this.decodedBuffers.size === 0) return 0;
    const budget = this._getDecodedMemoryBudget();
    const now = Date.now();

    // Measure per-instrument bytes (LRU by last touch).
    const instSizes = new Map();
    let used = 0;
    for (const [id, map] of this.decodedBuffers) {
      const bytes = this._decodedBufferBytes(map);
      if (bytes > 0) {
        instSizes.set(id, bytes);
        used += bytes;
      }
    }
    if (!force && used <= budget) return 0;

    const active = this._getActiveInstIds();
    const candidates = [];
    for (const [id, bytes] of instSizes) {
      if (this._isDecodeProtected(id)) continue;
      if (active.has(id)) continue;
      if (this.loadingSoundfonts && this.loadingSoundfonts.has(id)) continue;
      if (this._decodePromises && this._decodePromises.has(id)) continue;
      const lastUsed = this._instLastUsed ? this._instLastUsed.get(id) || 0 : 0;
      if (!force && now - lastUsed < PROTECT_MS) continue;
      candidates.push({ id, bytes, lastUsed });
    }
    // Coldest first.
    candidates.sort((a, b) => a.lastUsed - b.lastUsed);

    let freed = 0;
    for (const c of candidates) {
      if (!force && used <= budget) break;
      this._dropDecodedInstrument(c.id);
      used = Math.max(0, used - c.bytes);
      freed += c.bytes;
    }

    if (freed > 0 || candidates.length > 0) {
      if (freed > 0) {
        console.log(
          `[PCM] Memory: freed ${Math.round(freed / 1024 / 1024)}MB decoded ` +
            `(now ${Math.round(used / 1024 / 1024)}MB, budget ` +
            `${Math.round(budget / 1024 / 1024)}MB, ${candidates.length} cold)`,
        );
      }
      // Report pressure context to the memory manager via existing hooks.
      if (used > budget && this._onBudgetExceeded) {
        try { this._onBudgetExceeded(used, budget); } catch (e) {}
      }
    }
    return freed;
  }

  /** Removes one instrument from main-thread decodes AND the worklet catalog. */
  _dropDecodedInstrument(instId) {
    if (!instId) return;
    this.decodedBuffers.delete(instId);
    if (this._instLastUsed) this._instLastUsed.delete(instId);
    if (this._instProtectedAt) this._instProtectedAt.delete(instId);
    // Invalidate anchor cache for this instrument
    if (this._anchorCache) {
      for (const key of this._anchorCache.keys()) {
        if (key.startsWith(instId + ":")) {
          this._anchorCache.delete(key);
        }
      }
    }
    if (this.pcmWorkletNode && typeof this.pcmWorkletNode.dropInstrument === "function") {
      try { this.pcmWorkletNode.dropInstrument(instId); } catch (e) {}
    }
  }

  _scheduleEvictionCheck(delayMs = 1500) {
    if (this._evictTimer) return;
    this._evictTimer = setTimeout(() => {
      this._evictTimer = null;
      try {
        this._safeEvictDecodedBuffers(false);
      } catch (e) {}
    }, delayMs);
  }

  _maybeEvictDecodedBuffers() {
    // Safe budget-bounded eviction (see _safeEvictDecodedBuffers). The v2.0.x
    // regression (mid-play decode churn / hiss) is fixed by never evicting
    // pinned, active, or recently-used instruments and never running from the
    // note hot path — only a debounced timer or explicit pressure call.
    try {
      this._safeEvictDecodedBuffers(false);
    } catch (e) {}
  }

  /**
   * Full manual reset of ALL decoded sample state (RAM + worklet copies),
   * invoked by the in-app "Clear Sample Cache" maintenance action after the
   * IndexedDB store is wiped. Forces every instrument to refetch fresh bytes
   * from disk/network on next use, so corrupted cached samples can never be
   * served again. In-flight voices keep their own buffer references and are
   * not cut off.
   */
  resetDecodedBuffers() {
    try {
      const ids = this.decodedBuffers
        ? Array.from(this.decodedBuffers.keys())
        : [];
      this.decodedBuffers = new Map();
      if (this._anchorCache) this._anchorCache.clear();
      if (this._instLastUsed) this._instLastUsed.clear();
      if (this._instProtectedAt) this._instProtectedAt.clear();
      if (this.loadingSoundfonts) this.loadingSoundfonts.clear();
      if (this._decodePromises) this._decodePromises.clear();
      if (this.pcmWorkletNode && typeof this.pcmWorkletNode.dropInstrument === "function") {
        ids.forEach((id) => {
          try { this.pcmWorkletNode.dropInstrument(id); } catch (e) {}
        });
      }
      // The EDM loaders keep their own decoded maps outside decodedBuffers —
      // reset those too so the wipe is complete.
      if (typeof animalEdmLoader !== "undefined") animalEdmLoader.decodedBuffers = new Map();
      if (typeof bloomEdmLoader !== "undefined") bloomEdmLoader.decodedBuffers = new Map();
      if (typeof multisampleLoader !== "undefined") multisampleLoader.decodedBuffers = new Map();
      console.log("[PCM] Cache: all decoded sample state reset — instruments refetch on next use");
    } catch (e) {
      logger.warn("PCM", "Failed to reset decoded buffers", e);
    }
  }

  /**
   * Multi-velocity layer resolution: maps a note velocity (1-127) to a layer
   * index using the instrument's ascending velocity lower-bounds (registered
   * at decode/load time from the bank manifest). Falls back to layer 0
   * (single-sample behavior) for instruments without thresholds.
   */
  velocityToLayerIndex(instId, velocity) {
    let thresholds = this._velocityThresholds?.get(instId);
    if (
      !thresholds &&
      multisampleLoader &&
      multisampleLoader.velocityThresholds?.has?.(instId)
    ) {
      thresholds = multisampleLoader.velocityThresholds.get(instId);
    }
    if (!thresholds || thresholds.length <= 1) return 0;
    let idx = 0;
    for (let i = 0; i < thresholds.length; i++) {
      if (velocity >= thresholds[i]) idx = i;
    }
    return Math.min(idx, thresholds.length - 1);
  }

  /**
   * Round-robin cycling (industry-standard rompler behavior): for an anchor
   * with rr1..rrN variants, successive noteOns alternate through the variants
   * (per instId+anchor counter), adding timbre variation to repeated notes.
   * The cached anchor entry holds the whole variant array; cycling happens
   * here at call time. Non-RR results pass through unchanged.
   */
  _applyRoundRobin(result, instId) {
    if (!result || !Array.isArray(result.variants) || result.variants.length <= 1) {
      return result;
    }
    const key = `${instId || result.instId}:${result.anchorMidi}`;
    const n = this._rrCounters.get(key) || 0;
    this._rrCounters.set(key, n + 1);
    const idx = n % result.variants.length;
    if (idx === 0) {
      if (!result.workletKey && result.variants && result.variants.length > 1) {
        result.workletKey = `${result.anchorMidi}_${result.vlName || "vl1"}_rr1`;
      }
      return result;
    }
    const variantBuf = result.variants[idx] || result.buffer;
    const rrKey = `${result.anchorMidi}_${result.vlName || "vl1"}_rr${idx + 1}`;
    return {
      anchorMidi: result.anchorMidi,
      buffer: variantBuf,
      workletKey: rrKey,
      rrKey,
    };
  }

  _setAnchorCache(key, value) {
    if (!this._anchorCache) this._anchorCache = new Map();
    if (this._anchorCache.size >= (this._anchorCacheMaxSize || 1024)) {
      const firstKey = this._anchorCache.keys().next().value;
      if (firstKey) this._anchorCache.delete(firstKey);
    }
    this._anchorCache.set(key, value);
  }

  findNearestAnchor(instId, targetMidi, velocity = 95) {
    if (isSfxInstrumentId(instId)) return null;
    if (instId && INST_ALIASES[instId]) instId = INST_ALIASES[instId];

    // Check cache first (RR variants cycle at call time even on cache hits)
    const cacheKey = `${instId}:${targetMidi}:${velocity}`;
    const cached = this._anchorCache ? this._anchorCache.get(cacheKey) : null;
    if (cached) return this._applyRoundRobin(cached, instId);

    const yamahaBank = bankData("yamaha");
    const userBank = bankData("user");
    if (
      (yamahaBank && yamahaBank[instId]) ||
      (userBank && userBank[instId])
    ) {
      if (
        !this.decodedBuffers.has(instId) ||
        this.decodedBuffers.get(instId).size === 0
      ) {
        this.decodeEmbeddedAnchors(instId);
      }
      const eosMap = this.decodedBuffers.get(instId);
      if (eosMap && eosMap.size > 0) {
        const result = this.findAnchorInMap(eosMap, targetMidi);
        this._setAnchorCache(cacheKey, result);
        return result;
      }
    } else if (!yamahaBank && !userBank) {
      ensureBankForInst(instId).catch(() => {});
    }

    if (instId && instId.startsWith("abletunes_")) {
      const bankKey =
        instId === "abletunes_fm_piano" ? "fm_piano" : "upright_piano";
      if (
        !this.decodedBuffers.has(instId) ||
        this.decodedBuffers.get(instId).size === 0
      ) {
        this.loadAbletunesInstrument(bankKey);
        const grandMap = this.decodedBuffers.get("acoustic_grand_piano");
        if (grandMap && grandMap.size > 0) {
          const grandAnchor = this.findAnchorInMap(grandMap, targetMidi);
          if (grandAnchor) return grandAnchor;
        }
        return null;
      }
      const instMap = this.decodedBuffers.get(instId);
      // Multi-velocity via the per-instrument thresholds registry (abletunes
      // registers [1, 55, 98] at decode time — same law as the old hardcoded
      // <55/<98 split, now manifest-driven for any multi-velocity bank).
      const vlIdx = this.velocityToLayerIndex(instId, velocity);
      const vl = "vl" + (vlIdx + 1);
      const exactKey = `${targetMidi}_${vl}`;
      if (instMap.has(exactKey)) {
        const result = {
          anchorMidi: targetMidi,
          buffer: instMap.get(exactKey),
          workletKey: exactKey,
        };
        if (!this.loadingSoundfonts.has(instId)) this._setAnchorCache(cacheKey, result);
        return result;
      }
      if (instMap.has(targetMidi)) {
        const result = {
          anchorMidi: targetMidi,
          buffer: instMap.get(targetMidi),
          workletKey: targetMidi,
        };
        if (!this.loadingSoundfonts.has(instId)) this._setAnchorCache(cacheKey, result);
        return result;
      }
      let closestMidi = null;
      let minDiff = Infinity;
      for (const key of instMap.keys()) {
        const midi =
          typeof key === "number" ? key : parseInt(String(key).split("_")[0]);
        const diff = Math.abs(targetMidi - midi);
        if (diff < minDiff) {
          minDiff = diff;
          closestMidi = midi;
        }
      }
      if (closestMidi !== null) {
        // If the target note is in the ultra-high register (above C6 = 84),
        // Abletunes Upright has no samples (highest is C6) and pitch-shifting up
        // by > 4 semitones produces a tinny, chipmunk-like "toy piano" sound.
        // Seamlessly fall back to the 88-key acoustic_grand_piano if available!
        if (targetMidi > 84 && minDiff > 4) {
          const grandMap = this.decodedBuffers.get("acoustic_grand_piano");
          if (grandMap && grandMap.size > 0) {
            const grandAnchor = this.findAnchorInMap(grandMap, targetMidi);
            if (grandAnchor) {
              if (!this.loadingSoundfonts.has(instId)) this._setAnchorCache(cacheKey, grandAnchor);
              return grandAnchor;
            }
          }
        }
        const exactClosestKey = `${closestMidi}_${vl}`;
        const buf =
          instMap.get(exactClosestKey) || instMap.get(closestMidi);
        if (buf) {
          const result2 = {
            anchorMidi: closestMidi,
            buffer: buf,
            workletKey: instMap.has(exactClosestKey) ? exactClosestKey : closestMidi,
          };
          if (!this.loadingSoundfonts.has(instId)) this._setAnchorCache(cacheKey, result2);
          return result2;
        }
      }
      const pianoMap = this.decodedBuffers.get("acoustic_grand_piano");
      const result2 = this.findAnchorInMap(pianoMap, targetMidi);
      if (!this.loadingSoundfonts.has(instId)) this._setAnchorCache(cacheKey, result2);
      return result2;
    }

    if (multisampleLoader && multisampleLoader.isMultisampleInstrument(instId)) {
      // Imported multisample bank (multisample-manifest.js): closest anchor +
      // per-bank velocity thresholds + round-robin cycling.
      if (
        !this.decodedBuffers.has(instId) ||
        this.decodedBuffers.get(instId).size === 0
      ) {
        multisampleLoader.loadInstrument(instId, this.ctx, this.decodedBuffers);
        return null;
      }
      const msMap = this.decodedBuffers.get(instId);
      let msClosest = null;
      let msMinDiff = Infinity;
      for (const key of msMap.keys()) {
        const midi =
          typeof key === "number" ? key : parseInt(String(key).split("_")[0]);
        if (!Number.isFinite(midi)) continue;
        const diff = Math.abs(targetMidi - midi);
        if (diff < msMinDiff) {
          msMinDiff = diff;
          msClosest = midi;
        }
      }
      if (msClosest !== null) {
        const vlIdx = this.velocityToLayerIndex(instId, velocity);
        const vlName = "vl" + (vlIdx + 1);
        const baseKey = `${msClosest}_${vlName}`;
        // Collect rr1..rrN variants for this (note, layer); cycle per note.
        const variants = [];
        for (let n = 1; ; n++) {
          const b = msMap.get(`${baseKey}_rr${n}`);
          if (!b) break;
          variants.push(b);
        }
        if (variants.length === 0) {
          const base = msMap.get(baseKey) || msMap.get(msClosest);
          if (!base) return null;
          variants.push(base);
        }
        const msResult = {
          anchorMidi: msClosest,
          buffer: variants[0],
          variants,
          vlName,
          workletKey: variants.length > 1 ? `${msClosest}_${vlName}_rr1` : (msMap.has(baseKey) ? baseKey : msClosest),
        };
        this._setAnchorCache(cacheKey, msResult);
        return this._applyRoundRobin(msResult, instId);
      }
      return null;
    }

    if (instId && instId.startsWith("animal_")) {
      if (
        !this.decodedBuffers.has(instId) ||
        this.decodedBuffers.get(instId).size === 0
      ) {
        animalEdmLoader.loadInstrument(instId, this.ctx, this.decodedBuffers);
        return null;
      }
      const instMap = this.decodedBuffers.get(instId);
      const result = this.findAnchorInMap(instMap, targetMidi);
      this._setAnchorCache(cacheKey, result);
      return result;
    }

    if (instId && instId.startsWith("bloom_")) {
      if (
        !this.decodedBuffers.has(instId) ||
        this.decodedBuffers.get(instId).size === 0
      ) {
        bloomEdmLoader.loadInstrument(instId, this.ctx, this.decodedBuffers);
        return null;
      }
      const instMap = this.decodedBuffers.get(instId);
      const result = this.findAnchorInMap(instMap, targetMidi);
      this._setAnchorCache(cacheKey, result);
      return result;
    }

    let instMap = this.decodedBuffers.get(instId);
    if (!instMap || instMap.size === 0) {
      // No decoded data for this instrument yet — kick the async decode and
      // return null (silence). MEASURED FIX: the old keyword-based substitute
      // (choir/sax/piano map) played a WRONG instrument on the first note and
      // FOREVER for instruments whose samples failed to decode — the grand
      // piano "ding" from vox/vocal pads. Silence for the first hit (while
      // the soundfont decodes) beats a wrong-instrument sound every time.
      this.decodeEmbeddedAnchors(instId).catch(() => {});
      return null;
    }
    const result2 = this.findAnchorInMap(instMap, targetMidi);
    this._setAnchorCache(cacheKey, result2);
    return result2;
  }

  findAnchorInMap(map, targetMidi) {
    if (!map || map.size === 0) return null;
    if (map.has(targetMidi)) {
      return { anchorMidi: targetMidi, buffer: map.get(targetMidi), workletKey: targetMidi };
    }
    const strTarget = String(targetMidi);
    if (map.has(strTarget)) {
      return { anchorMidi: targetMidi, buffer: map.get(strTarget), workletKey: strTarget };
    }
    let closestKey = null;
    let closestMidi = null;
    let minDiff = Infinity;
    for (const key of map.keys()) {
      const midi = typeof key === "number" ? key : parseInt(String(key).split("_")[0], 10);
      if (!Number.isFinite(midi)) continue;
      const diff = Math.abs(targetMidi - midi);
      if (diff < minDiff) {
        minDiff = diff;
        closestMidi = midi;
        closestKey = key;
        if (diff === 0) break;
      }
    }
    if (closestKey !== null) {
      return { anchorMidi: closestMidi, buffer: map.get(closestKey), workletKey: closestKey };
    }
    const firstEntry = map.entries().next().value;
    if (firstEntry) {
      const k = firstEntry[0];
      const m = typeof k === "number" ? k : parseInt(String(k).split("_")[0], 10) || 60;
      return {
        anchorMidi: m,
        buffer: firstEntry[1],
        workletKey: k,
      };
    }
    return null;
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

    if (isSfxInstrumentId(instId)) {
      // Lazily bootstrap the SFX generator on first use (P1 code splitting);
      // until it resolves the note is dropped — consistent with the engine's
      // silence-over-wrong-instrument policy.
      this.ensureSfxGenerator().catch(() => {});
      if (this.sfxGenerator) {
        return this.sfxGenerator.playSfxNote(
          instId,
          midiNote,
          velocity,
          customGain,
          dest,
          when,
        );
      }
      return null;
    }

    const anchorData = this.findNearestAnchor(instId, midiNote, velocity);
    if (!anchorData || !anchorData.buffer) return null;
    this._touchBuffer(anchorData.buffer);

    const ctx = this.ctx;
    const now = when > 0 ? Math.max(when, ctx.currentTime) : ctx.currentTime;
    const velNorm = Math.max(0.08, Math.min(1.0, velocity / 127));
    this.heldNotes.add(midiNote);

    const semitoneDiff = midiNote - anchorData.anchorMidi;
    const basePlaybackRate = Math.pow(2, semitoneDiff / 12);
    const bentPlaybackRate =
      basePlaybackRate * Math.pow(2, this.pitchBendSemitones / 12);

    const delaySec = when > 0 ? Math.max(0, when - ctx.currentTime) : 0;

    // === AudioWorklet path: route voice to audio thread (zero main-thread jank) ===
    // MUST NOT intercept when destOverride is set (e.g. looper track sub-buses).
    // Supports both immediate notes (delaySec = 0) and scheduled notes (demo songs, delaySec < 0.25).
    if (!destOverride && delaySec < 0.25 && this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
      const buf = anchorData.buffer;
      const baseId = (instId && INST_ALIASES[instId]) || instId;

      // On-demand buffer transfer (v2.0.4 behavior restored): push this exact
      // layer now unless the worklet already holds it. ensureBuffer compares
      // buffer identity, so same-layer retriggers are free and differing
      // velocity layers re-upload only the layer they need. This keeps
      // velocity-layered instruments (piano) correct AND prewarmed — no
      // mid-play transfer storm = no choppy. Round-robin variants upload
      // under their distinct rrKey (one copy per variant, then copy-free).
      const workletKey = anchorData.workletKey || anchorData.rrKey || anchorData.anchorMidi;
      this.pcmWorkletNode.ensureBuffer(baseId, workletKey, buf);
      const isRockPiano = instId === "x5d_rock_piano" || instId?.includes("rock_piano");
      const trim = getInstrumentTrimGain(instId);
      const dynamicAmp = isRockPiano ? Math.pow(velNorm, 0.78) : Math.pow(velNorm, 1.10);
      const peakGain = (isRockPiano ? 0.28 + dynamicAmp * 0.72 : 0.16 + dynamicAmp * 0.84) * customGain * trim;
      const [isSax, isChoirTimbre] = this._instTimbre(instId);
      const isChoir =
        isChoirTimbre ||
        instId === "choir_aahs" ||
        instId === "m1_choir" ||
        instId === "m1_ooh_ahh" ||
        instId?.includes("choir") ||
        instId?.includes("voice") ||
        instId?.includes("vox");
      const isString =
        instId === "string_ensemble_1" ||
        instId?.includes("string") ||
        instId?.includes("pad") ||
        instId?.includes("fantasia") ||
        instId?.includes("saw") ||
        instId?.includes("extacy") ||
        instId?.includes("vocoder") ||
        instId?.includes("dreamn") ||
        instId?.includes("synth") ||
        instId?.includes("lead");
      const isHit = instId?.includes("hit");
      const isPiano =
        instId?.includes("piano") ||
        instId?.includes("rhodes") ||
        instId?.includes("roads") ||
        instId?.includes("cp80") ||
        instId?.includes("tx816") ||
        instId?.includes("grand") ||
        instId?.includes("clavi") ||
        instId?.includes("ep");

      const releaseTime = isRockPiano
        ? 0.65
        : isHit
          ? 1.8
          : isString
            ? 0.75
            : isChoir
              ? 0.55
              : isPiano
                ? 0.55
                : isSax
                  ? 0.28
                  : 0.35;

      const minCutoff = isRockPiano ? 18000 : isPiano ? 14000 : isSax ? 4000 : isChoir ? 1000 : 3500;
      const maxCutoff = isSax ? 16000 : isChoir ? 8500 : 20000;
      const filterNorm = Math.min(
        1.0,
        (minCutoff + Math.pow(velNorm, 1.35) * (maxCutoff - minCutoff)) / 20000,
      );

      this.pcmWorkletNode.noteOn({
        instId: baseId,
        midiNote,
        velocity: velNorm,
        gain: peakGain,
        layerIndex,
        anchorMidi: workletKey,
        playbackRate: bentPlaybackRate,
        isLoopable: !!buf._isLoopable,
        loopStart: buf._loopStartSec || 0,
        loopEnd: buf._loopEndSec || 0,
        attackTime: isRockPiano ? 0.001 : isChoir ? 0.04 : 0.003,
        decayTime: isRockPiano ? 0.60 : isPiano ? 0.4 : 0.25,
        sustainLevel: isRockPiano ? 0.88 : isHit ? 0.95 : isPiano ? 0.75 : 0.65,
        releaseTime,
        filterCutoff: isRockPiano ? 1.0 : filterNorm,
        maxLife: buf._isLoopable
          ? 60.0
          : Math.max(12.0, (buf.duration || 6.0) + 0.5),
        delaySec,
      });
      return null; // voice managed by worklet, no main-thread record
    }

    // === Main-thread fallback (when AudioWorklet unavailable) ===
    if (this.activeVoices.has(midiNote)) {
      const oldList = this.activeVoices.get(midiNote);
      if (oldList && oldList.length > 0) {
        const remaining = [];
        oldList.forEach((oldV) => {
          const isSameDest = (oldV.dest === dest) || (!oldV.dest && !dest);
          const isSameLayer =
            layerIndex !== null &&
            layerIndex !== undefined &&
            oldV.layerIndex === layerIndex &&
            isSameDest;
          const isSameInst = oldV.instId === instId && isSameDest;
          if (isSameLayer || (layerIndex === null && isSameInst)) {
            try {
              const rIsChoir =
                oldV.instId === "choir_aahs" ||
                oldV.instId === "m1_choir" ||
                oldV.instId === "m1_ooh_ahh" ||
                oldV.instId?.includes("choir") ||
                oldV.instId?.includes("voice") ||
                oldV.instId?.includes("vox");
              const rIsString =
                oldV.instId === "string_ensemble_1" ||
                oldV.instId?.includes("string") ||
                oldV.instId?.includes("pad") ||
                oldV.instId?.includes("fantasia") ||
                oldV.instId?.includes("saw") ||
                oldV.instId?.includes("extacy") ||
                oldV.instId?.includes("vocoder") ||
                oldV.instId?.includes("dreamn") ||
                oldV.instId?.includes("synth") ||
                oldV.instId?.includes("lead");
              const rIsSax =
                oldV.instId === "alto_sax" ||
                oldV.instId?.includes("sax") ||
                oldV.instId?.includes("reed") ||
                oldV.instId?.includes("flute");
              const rIsHit = oldV.instId?.includes("hit");
              const rIsPiano =
                oldV.instId?.includes("piano") ||
                oldV.instId?.includes("roads") ||
                oldV.instId?.includes("cp80") ||
                oldV.instId?.includes("tx816") ||
                oldV.instId?.includes("grand") ||
                oldV.instId?.includes("clavi") ||
                oldV.instId?.includes("ep");
              const rTau = rIsChoir
                ? 0.15
                : rIsString
                  ? 0.18
                  : rIsSax
                    ? 0.10
                    : rIsHit
                      ? 0.4
                      : rIsPiano
                        ? 0.06
                        : 0.08;
              const rStop = rIsChoir
                ? 0.6
                : rIsString
                  ? 0.8
                  : rIsSax
                    ? 0.35
                    : rIsHit
                      ? 1.2
                      : rIsPiano
                        ? 0.25
                        : 0.3;
              oldV.voiceGain.gain.cancelScheduledValues(now);
              oldV.voiceGain.gain.setValueAtTime(
                oldV.voiceGain.gain.value || 0.0,
                now,
              );
              oldV.voiceGain.gain.setTargetAtTime(0.0, now, rTau);
              if (oldV.src) {
                oldV.src.loop = false;
                oldV.src.stop(now + rStop);
              }
            } catch (e) {}
            this._removeFromTracking(midiNote, oldV);
            const rn = midiNote;
            const rv = oldV;
            if (rv.src) {
              rv.src.onended = () => {
                this._disconnectAndRecycle(rn, rv);
              };
            } else {
              this._disconnectAndRecycle(rn, rv);
            }
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
        const remainingSus = [];
        susList.forEach((oldV) => {
          const isSameDest = (oldV.dest === dest) || (!oldV.dest && !dest);
          if (!isSameDest) {
            remainingSus.push(oldV);
            return;
          }
          try {
              const rsIsChoir =
                oldV.instId === "choir_aahs" ||
                oldV.instId === "m1_choir" ||
                oldV.instId === "m1_ooh_ahh" ||
                oldV.instId?.includes("choir") ||
                oldV.instId?.includes("voice") ||
                oldV.instId?.includes("vox");
              const rsIsString =
                oldV.instId === "string_ensemble_1" ||
                oldV.instId?.includes("string") ||
                oldV.instId?.includes("pad") ||
                oldV.instId?.includes("saw") ||
                oldV.instId?.includes("extacy") ||
                oldV.instId?.includes("vocoder") ||
                oldV.instId?.includes("dreamn") ||
                oldV.instId?.includes("synth") ||
                oldV.instId?.includes("lead");
              const rsIsSax =
                oldV.instId === "alto_sax" ||
                oldV.instId?.includes("sax") ||
                oldV.instId?.includes("reed") ||
                oldV.instId?.includes("flute");
              const rsIsHit = oldV.instId?.includes("hit");
              const rsIsPiano =
                oldV.instId?.includes("piano") ||
                oldV.instId?.includes("roads") ||
                oldV.instId?.includes("cp80") ||
                oldV.instId?.includes("tx816") ||
                oldV.instId?.includes("grand") ||
                oldV.instId?.includes("clavi") ||
                oldV.instId?.includes("ep");
              const rsTau = rsIsChoir
                ? 0.18
                : rsIsString
                  ? 0.22
                  : rsIsSax
                    ? 0.12
                    : rsIsHit
                      ? 0.5
                      : rsIsPiano
                        ? 0.08
                        : 0.10;
              const rsStop = rsIsChoir
                ? 0.85
                : rsIsString
                  ? 1.0
                  : rsIsSax
                    ? 0.45
                    : rsIsHit
                      ? 1.5
                      : rsIsPiano
                        ? 0.4
                        : 0.5;
            oldV.voiceGain.gain.cancelScheduledValues(now);
            oldV.voiceGain.gain.setValueAtTime(
              oldV.voiceGain.gain.value || 0.0,
              now,
            );
            oldV.voiceGain.gain.setTargetAtTime(0.0, now, rsTau);
            if (oldV.src) {
              oldV.src.loop = false;
              oldV.src.stop(now + rsStop);
            }
          } catch (e) {}
          this._removeFromTracking(midiNote, oldV);
          const rn = midiNote;
          const rv = oldV;
          if (rv.src) {
            rv.src.onended = () => {
              this._disconnectAndRecycle(rn, rv);
            };
          } else {
            this._disconnectAndRecycle(rn, rv);
          }
        });
        if (remainingSus.length > 0) this.sustainedVoices.set(midiNote, remainingSus);
        else this.sustainedVoices.delete(midiNote);
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
    const isPiano =
      instId?.includes("piano") ||
      instId?.includes("rhodes") ||
      instId?.includes("roads") ||
      instId?.includes("cp80") ||
      instId?.includes("tx816") ||
      instId?.includes("grand") ||
      instId?.includes("clavi") ||
      instId?.includes("ep");
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

    const minCutoff = isPiano ? 14000 : isSax ? 4000 : isChoir ? 1000 : isHashy ? 3000 : 3500;
    const maxCutoff = isSax ? 16000 : isChoir ? 8500 : isHashy ? 16000 : 20000;
    const dynamicCutoff =
      minCutoff + Math.pow(velNorm, 1.35) * (maxCutoff - minCutoff);
    const noteFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const keyTrackedCutoff = Math.max(
      dynamicCutoff,
      Math.min(20000, noteFreq * (2.0 + velNorm * 2.2)),
    );

    const isRockPiano = instId === "x5d_rock_piano" || instId?.includes("rock_piano");
    filter.frequency.setValueAtTime(isRockPiano ? 20000 : keyTrackedCutoff, now);
    filter.Q.setValueAtTime(isRockPiano ? 0.45 : 0.35, now);

    const trim = getInstrumentTrimGain(instId);
    const dynamicAmp = isRockPiano ? Math.pow(velNorm, 0.78) : Math.pow(velNorm, 1.10);
    const peakGain = (isRockPiano ? 0.28 + dynamicAmp * 0.72 : 0.16 + dynamicAmp * 0.84) * customGain * trim;

    voiceGain.gain.setValueAtTime(0.0, now);
    if (isChoir) voiceGain.gain.setTargetAtTime(peakGain, now, 0.04);
    else if (isRockPiano) voiceGain.gain.setTargetAtTime(peakGain, now, 0.001);
    else voiceGain.gain.setTargetAtTime(peakGain, now, 0.008);

    const maxLife =
      anchorData.buffer && anchorData.buffer._isLoopable
        ? 60.0
        : Math.max(12.0, (anchorData.buffer?.duration || 6.0) + 0.5);

    // Natural decay for non-loopable samples: fade out smoothly over the last 150ms
    // to prevent abrupt brickwall cutoffs and clicks when holding keys
    if (!anchorData.buffer?._isLoopable && maxLife > 0.5) {
      const fadeStart = Math.max(now + 0.05, now + maxLife - 0.15);
      voiceGain.gain.setValueAtTime(peakGain, fadeStart);
      voiceGain.gain.setTargetAtTime(0.0, fadeStart, 0.04);
    }

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
      _isRecycled: false,
    };

    this._allActiveVoices.add(voiceRecord);

    while (this.voiceQueue.length >= this.MAX_VOICES) {
      // Smart voice stealing — prioritize released tails first
      let target = null;
      let bestScore = Infinity;
      let oldest = null;
      let oldestTime = Infinity;
      for (let i = 0; i < this.voiceQueue.length; i++) {
        const v = this.voiceQueue[i];
        if (!v) continue;
        const t = v.startTime || 0;
        if (t < oldestTime) { oldest = v; oldestTime = t; }
        if (!this.heldNotes.has(v.midiNote)) {
          const score = (v.voiceGain?.gain?.value || 0) * 1000 + t;
          if (score < bestScore) { target = v; bestScore = score; }
        }
      }
      if (!target) {
        for (let i = 0; i < this.voiceQueue.length; i++) {
          const v = this.voiceQueue[i];
          if (!v) continue;
          const t = v.startTime || 0;
          const score = (v.voiceGain?.gain?.value || 0) * 1000 + t;
          if (score < bestScore) { target = v; bestScore = score; }
        }
      }
      if (!target) target = oldest;
      if (!target) break;
      try {
        // Quick 5ms clickless ramp down before stopping stolen voice
        target.voiceGain.gain.cancelScheduledValues(now);
        target.voiceGain.gain.setValueAtTime(
          target.voiceGain.gain.value || 0.0,
          now,
        );
        target.voiceGain.gain.setTargetAtTime(0.0, now, 0.005);
        if (target.src) {
          target.src.loop = false;
          target.src.stop(now + 0.025);
        }
      } catch (e) {}
      this._removeFromTracking(target.midiNote, target);
      const stlMidiNote = target.midiNote;
      const stlRecord = target;
      if (stlRecord.src) {
        stlRecord.src.onended = () => {
          this._disconnectAndRecycle(stlMidiNote, stlRecord);
        };
      } else {
        this._disconnectAndRecycle(stlMidiNote, stlRecord);
      }
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
    voiceRecord._isRecycled = true;
    this._allActiveVoices.delete(voiceRecord);
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
        const isDuplicate = this._voiceNodePool.some(
          p => p.filter === voiceRecord.filter || p.voiceGain === voiceRecord.voiceGain
        );
        if (!isDuplicate) {
          this._voiceNodePool.push({
            filter: voiceRecord.filter,
            voiceGain: voiceRecord.voiceGain,
          });
        }
      }
    } catch (e) {}
  }

  _removeFromTracking(midiNote, voiceRecord) {
    if (!voiceRecord) return;
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
  }

  _disconnectAndRecycle(midiNote, voiceRecord) {
    if (!voiceRecord || voiceRecord._isRecycled) return;
    voiceRecord._isRecycled = true;
    voiceRecord._isRemoved = true;
    try {
      if (voiceRecord.src) {
        voiceRecord.src.onended = null;
        voiceRecord.src.disconnect();
      }
      if (voiceRecord.filter) voiceRecord.filter.disconnect();
      if (voiceRecord.voiceGain) voiceRecord.voiceGain.disconnect();
      if (this._voiceNodePool.length < this.MAX_VOICES) {
        const isDuplicate = this._voiceNodePool.some(
          p => p.filter === voiceRecord.filter || p.voiceGain === voiceRecord.voiceGain
        );
        if (!isDuplicate) {
          this._voiceNodePool.push({
            filter: voiceRecord.filter,
            voiceGain: voiceRecord.voiceGain,
          });
        }
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
    if (this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
      this.pcmWorkletNode.setPitchBend(this.pitchBendSemitones);
    }
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
    if (this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
      this.pcmWorkletNode.setModWheel(this.modWheelAmount);
    }
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

  updateSustainSettings(sustainHoldSec, sustainDecayTau, heldNoteSec) {
    if (Number.isFinite(sustainHoldSec)) this.sustainHoldSec = sustainHoldSec;
    if (Number.isFinite(sustainDecayTau)) this.sustainDecayTau = sustainDecayTau;
    if (Number.isFinite(heldNoteSec)) this.heldNoteSec = heldNoteSec;
    if (this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
      this.pcmWorkletNode.setSustainSettings(
        this.sustainHoldSec,
        this.sustainDecayTau,
        this.heldNoteSec
      );
    }
  }

  setPolyphonyCap(cap) {
    if (Number.isFinite(cap)) {
      this.MAX_VOICES = Math.max(16, Math.min(128, cap | 0));
    }
    if (this.pcmWorkletNode && typeof this.pcmWorkletNode.setPolyphonyCap === "function") {
      this.pcmWorkletNode.setPolyphonyCap(this.MAX_VOICES);
    }
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
      let voiceIdx = 0;
      this.sustainedVoices.forEach((voices) => {
        voices.forEach((v) => {
          try {
            const isChoir =
              v.instId === "choir_aahs" ||
              v.instId === "m1_choir" ||
              v.instId === "m1_ooh_ahh" ||
              v.instId?.includes("choir") ||
              v.instId?.includes("voice") ||
              v.instId?.includes("vox");
            const isString =
              v.instId === "string_ensemble_1" ||
              v.instId?.includes("string") ||
              v.instId?.includes("pad") ||
              v.instId?.includes("saw") ||
              v.instId?.includes("extacy") ||
              v.instId?.includes("vocoder") ||
              v.instId?.includes("dreamn") ||
              v.instId?.includes("synth") ||
              v.instId?.includes("lead");
            const isSax =
              v.instId === "alto_sax" ||
              v.instId?.includes("sax") ||
              v.instId?.includes("reed") ||
              v.instId?.includes("flute");
            const isHit = v.instId?.includes("hit");
            const isPiano =
              v.instId?.includes("piano") ||
              v.instId?.includes("roads") ||
              v.instId?.includes("cp80") ||
              v.instId?.includes("tx816") ||
              v.instId?.includes("grand") ||
              v.instId?.includes("clavi") ||
              v.instId?.includes("ep");

            const tau = isChoir
              ? 0.2
              : isString
                ? 0.25
                : isSax
                  ? 0.12
                  : isHit
                    ? 0.6
                    : isPiano
                      ? 0.08
                      : 0.06;
            const stopTime = isChoir
              ? 1.4
              : isString
                ? 1.2
                : isSax
                  ? 0.55
                  : isHit
                    ? 1.8
                    : isPiano
                      ? 0.45
                      : 0.35;
            // Micro-stagger: offset each voice's release by 0.3ms so 48+
            // simultaneous voices don't all drop at the exact same sample.
            // Spreads the collective volume step over ~15ms, eliminating the
            // audible "bump" when the pedal lifts during a dense combi chord.
            const stagger = Math.min(voiceIdx * 0.0003, 0.015);
            voiceIdx++;
            const t = now + stagger;
            v.voiceGain.gain.cancelScheduledValues(t);
            v.voiceGain.gain.setValueAtTime(v.voiceGain.gain.value || 0.0, t);
            v.voiceGain.gain.setTargetAtTime(0, t, tau);
            v.src.stop(t + stopTime);
            if (v.vibLfo) {
              try {
                v.vibLfo.stop(t + stopTime + 0.1);
              } catch (e) {}
            }
            if (v.growlLfo) {
              try {
                v.growlLfo.stop(t + stopTime + 0.1);
              } catch (e) {}
            }
          } catch (e) {}
        });
      });
      this.sustainedVoices.clear();
    }
  }

  stopNote(instId, midiNote, when = 0, layerIndex = null) {
    if (this.heldNotes) this.heldNotes.delete(midiNote);

    // AudioWorklet path: forward to audio thread (immediate or scheduled)
    if (this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
      const delaySec = when > 0 ? Math.max(0, when - this.ctx.currentTime) : 0;
      if (delaySec < 0.25) {
        this.pcmWorkletNode.noteOff(midiNote, layerIndex, delaySec);
      } else {
        const delayMs = Math.round(delaySec * 1000);
        setTimeout(() => {
          if (this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
            this.pcmWorkletNode.noteOff(midiNote, layerIndex);
          }
        }, delayMs);
      }
    }

    const voices = this.activeVoices ? this.activeVoices.get(midiNote) : null;
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

          // Auto-release timeout governed by sustainHoldSec from latency popover modal
          const holdSec = this.sustainHoldSec || 7.0;
          const releaseTau = Math.min(0.8, (this.sustainDecayTau || 2.4) * 0.25);
          const stopAt = now + holdSec;
          try {
            v.voiceGain.gain.setValueAtTime(v.voiceGain.gain.value || 0.0, stopAt);
            v.voiceGain.gain.setTargetAtTime(0, stopAt, releaseTau);
            v.src.stop(stopAt + releaseTau * 4);
          } catch (e) {}

          try {
            let totalSus = 0;
            this.sustainedVoices.forEach((list) => {
              totalSus += list.length;
            });
            const maxSus = 32;
            while (totalSus > maxSus) {
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
              oldest.voiceGain.gain.setValueAtTime(oldest.voiceGain.gain.value || 0.0, now);
              oldest.voiceGain.gain.setTargetAtTime(0, now, 0.015);
              oldest.src.stop(now + 0.05);
              if (oldest.vibLfo) {
                try {
                  oldest.vibLfo.stop(now + 0.05);
                } catch (e) {}
              }
              if (oldest.growlLfo) {
                try {
                  oldest.growlLfo.stop(now + 0.05);
                } catch (e) {}
              }
              this._removeFromTracking(oldestKey, oldest);
              const ok = oldestKey;
              const ov = oldest;
              if (ov.src) {
                ov.src.onended = () => {
                  this._disconnectAndRecycle(ok, ov);
                };
              } else {
                this._disconnectAndRecycle(ok, ov);
              }
              totalSus--;
            }
          } catch (e) {}
        } else {
          try {
            const isChoir =
              v.instId === "choir_aahs" ||
              v.instId === "m1_choir" ||
              v.instId === "m1_ooh_ahh" ||
              v.instId?.includes("choir") ||
              v.instId?.includes("voice") ||
              v.instId?.includes("vox");
            const isString =
              v.instId === "string_ensemble_1" ||
              v.instId?.includes("string") ||
              v.instId?.includes("pad") ||
              v.instId?.includes("saw") ||
              v.instId?.includes("extacy") ||
              v.instId?.includes("vocoder") ||
              v.instId?.includes("dreamn") ||
              v.instId?.includes("synth") ||
              v.instId?.includes("lead") ||
              v.instId?.includes("brass") ||
              v.instId?.includes("organ");
            const isSax =
              v.instId === "alto_sax" ||
              v.instId?.includes("sax") ||
              v.instId?.includes("reed") ||
              v.instId?.includes("flute");
            const isHit = v.instId?.includes("hit");
            const isPiano =
              v.instId?.includes("piano") ||
              v.instId?.includes("roads") ||
              v.instId?.includes("cp80") ||
              v.instId?.includes("tx816") ||
              v.instId?.includes("grand") ||
              v.instId?.includes("clavi") ||
              v.instId?.includes("vibes") ||
              v.instId?.includes("guitar") ||
              v.instId?.includes("bass") ||
              v.instId?.includes("ep");

            const tau = isHit
              ? 0.5
              : isString
                ? 0.25
                : isChoir
                  ? 0.20
                  : isPiano
                    ? 0.16
                    : isSax
                      ? 0.09
                      : 0.12;
            const stopTime = isHit
              ? 1.8
              : isString
                ? 1.2
                : isChoir
                  ? 0.85
                  : isPiano
                    ? 0.75
                    : isSax
                      ? 0.40
                      : 0.50;
            v.voiceGain.gain.cancelScheduledValues(now);
            v.voiceGain.gain.setValueAtTime(v.voiceGain.gain.value || 0.0, now);
            v.voiceGain.gain.setTargetAtTime(0, now, tau);
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

  fastStopNote(instId, midiNote, when = 0, layerIndex = null) {
    if (this.heldNotes) this.heldNotes.delete(midiNote);

    if (this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
      const delaySec = when > 0 ? Math.max(0, when - this.ctx.currentTime) : 0;
      if (delaySec < 0.25) {
        if (typeof this.pcmWorkletNode.fastNoteOff === "function") {
          this.pcmWorkletNode.fastNoteOff(midiNote, layerIndex, delaySec);
        } else {
          this.pcmWorkletNode.noteOff(midiNote, layerIndex, delaySec);
        }
      } else {
        const delayMs = Math.round(delaySec * 1000);
        setTimeout(() => {
          if (this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
            if (typeof this.pcmWorkletNode.fastNoteOff === "function") {
              this.pcmWorkletNode.fastNoteOff(midiNote, layerIndex);
            } else {
              this.pcmWorkletNode.noteOff(midiNote, layerIndex);
            }
          }
        }, delayMs);
      }
    }

    const voices = this.activeVoices ? this.activeVoices.get(midiNote) : null;
    if (!voices || voices.length === 0) return;

    const ctx = this.ctx;
    const now = when > 0 ? Math.max(when, ctx.currentTime) : ctx.currentTime;
    const remaining = [];

    voices.forEach((v) => {
      if (!instId || v.instId === instId || !this.heldNotes.has(v.midiNote)) {
        if (this.sustainPedal) {
          if (!this.sustainedVoices.has(midiNote)) {
            this.sustainedVoices.set(midiNote, []);
          }
          this.sustainedVoices.get(midiNote).push(v);
          return;
        }
        try {
          if (v.src) v.src.loop = false;
          // Smooth 70ms clickless fade for glissando sweeps so they bloom without a chopped up effect
          v.voiceGain.gain.cancelScheduledValues(now);
          v.voiceGain.gain.setValueAtTime(v.voiceGain.gain.value || 0.0, now);
          v.voiceGain.gain.setTargetAtTime(0.0, now, 0.07);
          v.src.stop(now + 0.30);
          if (v.vibLfo) {
            try { v.vibLfo.stop(now + 0.035); } catch (e) {}
          }
          if (v.growlLfo) {
            try { v.growlLfo.stop(now + 0.035); } catch (e) {}
          }
          this._removeFromTracking(midiNote, v);
          const stopTimer = setTimeout(() => {
            this._disconnectAndRecycle(midiNote, v);
          }, 45);
          this._scheduledStops.add(stopTimer);
        } catch (e) {}
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
              v.voiceGain.gain.setValueAtTime(v.voiceGain.gain.value || 0.0, now);
              v.voiceGain.gain.setTargetAtTime(0, now, 0.02);
              v.src.stop(now + 0.1);
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

  allNotesOff(preserveLooper = false) {
    this.sustainPedal = false;

    // AudioWorklet path
    if (this.pcmWorkletNode && this.pcmWorkletNode.isReady) {
      this.pcmWorkletNode.allNotesOff();
    }

    const now = this.ctx.currentTime;

    const killVoice = (v) => {
      if (!v) return;
      if (preserveLooper && this._findLooperBusByDest(v.dest)) {
        return; // Retain active playing looper voice!
      }
      try {
        if (v.src) {
          v.src.onended = null;
          v.src.loop = false; // Break infinite sample loops immediately!
        }
        if (v.voiceGain) {
          v.voiceGain.gain.cancelScheduledValues(now);
          v.voiceGain.gain.setValueAtTime(0.0, now);
        }
        if (v.src) {
          try { v.src.stop(now + 0.02); } catch (e) {}
        }
        if (v.vibLfo) {
          try {
            v.vibLfo.stop(now + 0.05);
          } catch (e) {}
        }
        if (v.growlLfo) {
          try {
            v.growlLfo.stop(now + 0.05);
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
        }, 30);
      } catch (e) {}
    };

    if (preserveLooper) {
      this.activeVoices.forEach((list, midi) => {
        const remaining = [];
        list.forEach((v) => {
          if (this._findLooperBusByDest(v.dest)) {
            remaining.push(v);
          } else {
            killVoice(v);
          }
        });
        if (remaining.length > 0) this.activeVoices.set(midi, remaining);
        else this.activeVoices.delete(midi);
      });

      this.sustainedVoices.forEach((list, midi) => {
        const remaining = [];
        list.forEach((v) => {
          if (this._findLooperBusByDest(v.dest)) {
            remaining.push(v);
          } else {
            killVoice(v);
          }
        });
        if (remaining.length > 0) this.sustainedVoices.set(midi, remaining);
        else this.sustainedVoices.delete(midi);
      });
    } else {
      this.activeVoices.forEach((list) => list.forEach(killVoice));
      this.sustainedVoices.forEach((list) => list.forEach(killVoice));
      this.activeVoices.clear();
      this.sustainedVoices.clear();
    }

    if (this._allActiveVoices) {
      this._allActiveVoices.forEach(killVoice);
      if (!preserveLooper) {
        this._allActiveVoices.clear();
      }
    }

    this.heldNotes.clear();
    this.voiceQueue.length = 0;

    if (this.layerInserts) {
      this.layerInserts.forEach((ins) => {
        try {
          ins.setSustain(false);
          ins.flush();
        } catch (e) {}
      });
    }
    if (this.splitZoneInserts) {
      Object.values(this.splitZoneInserts).forEach((ins) => {
        try {
          ins.setSustain(false);
          ins.flush();
        } catch (e) {}
      });
    }
    if (this.looperInserts && !preserveLooper) {
      this.looperInserts.forEach((trackBuses) => {
        trackBuses.forEach((ins) => {
          try {
            ins.setSustain(false);
            ins.flush();
          } catch (e) {}
        });
      });
    }
  }
}
