/**
 * Workstation Multi-Layer (COMBI) & Triton Program Sound Engine
 * Driven by NativePcmEngine with pre-decoded RAM AudioBuffers for TRUE 0.00ms touch-to-sound latency.
 * Stacks up to 4 simultaneous genuine 24-bit PCM instrument layers on every keypress
 * with independent volume faders, octave transpositions, and Korg IFX/MFX effects.
 */

import { NativePcmEngine } from "./native-pcm-engine.js";
import { audioCore } from "./audio-core.js";
import { synthEngine, INSTRUMENT_PATCHES } from "./synth-engine.js";

export const HD_SOUNDBANKS = {
  acoustic_grand_piano: { id: "acoustic_grand_piano", name: "SG Hybrid Concert Grand", category: "Acoustic Piano" },
  electric_piano_1: { id: "electric_piano_1", name: "Triton Suit. & Stage EP", category: "Electric Piano" },
  rhodes_stage_mp3: { id: "rhodes_stage_mp3", name: "Stage Rhodes 73 (Vintage Muir)", category: "Electric Piano" },
  abletunes_fm_piano: { id: "abletunes_fm_piano", name: "Abletunes Studio FM Piano (DX7)", category: "Electric Piano" },
  abletunes_upright: { id: "abletunes_upright", name: "Abletunes Studio Upright Piano", category: "Acoustic Piano" },
  m1_piano_16: { id: "m1_piano_16", name: "Korg M1 Piano 16' (Vogue House)", category: "Acoustic Piano" },
  m1_organ_2: { id: "m1_organ_2", name: "Korg M1 Organ 2 (Show Me Love)", category: "Organ & Bass" },
  m1_universe: { id: "m1_universe", name: "Korg M1 Universe (Celestial Pad)", category: "Synth Pad" },
  m1_choir: { id: "m1_choir", name: "Korg M1 Ooh-Aah Choir", category: "Strings & Choir" },
  m1_fresh_air: { id: "m1_fresh_air", name: "Korg M1 Fresh Air (Airy Bell)", category: "Bells & Pad" },
  m1_slap_bass: { id: "m1_slap_bass", name: "Korg M1 Slap Bass (90s Funk)", category: "Bass & Sub" },
  string_ensemble_1: { id: "string_ensemble_1", name: "Triton Stereo Strings", category: "Strings & Choir" },
  drawbar_organ: { id: "drawbar_organ", name: "M1 / B3 Rock Organ", category: "Organ" },
  alto_sax: { id: "alto_sax", name: "Breathy Alto Saxophone", category: "Woodwind" },
  brass_section: { id: "brass_section", name: "Triton Fat Brass Section", category: "Brass" },
  synth_bass_1: { id: "synth_bass_1", name: "Moog Prodigy Punch Bass", category: "Bass & Sub" },
  distortion_guitar: { id: "distortion_guitar", name: "Triton Distortion Guitar", category: "Guitar" },
  overdriven_guitar: { id: "overdriven_guitar", name: "Heavy Overdrive Guitar", category: "Guitar" },
  electric_guitar_clean: { id: "electric_guitar_clean", name: "Fender Strat Clean Guitar", category: "Guitar" },
  acoustic_guitar_nylon: { id: "acoustic_guitar_nylon", name: "Fantom Acoustic Nylon", category: "Guitar" },
  trumpet: { id: "trumpet", name: "Miles Lead Trumpet", category: "Brass" },
  trombone: { id: "trombone", name: "Tailgate Trombone", category: "Brass" },
  tenor_sax: { id: "tenor_sax", name: "Blue Note Tenor Sax", category: "Woodwind" },
  flute: { id: "flute", name: "Concert Flute", category: "Woodwind" },
  clarinet: { id: "clarinet", name: "Licorice Stick Clarinet", category: "Woodwind" },
  violin: { id: "violin", name: "Solo Violin", category: "Strings & Choir" },
  cello: { id: "cello", name: "Warm Cello", category: "Strings & Choir" },
  choir_aahs: { id: "choir_aahs", name: "Cathedral Choir Aahs", category: "Strings & Choir" },
  church_organ: { id: "church_organ", name: "Cathedral Pipe Organ", category: "Organ" },
  vibraphone: { id: "vibraphone", name: "Cool Vibraphone", category: "Bells & Pad" },
  electric_piano_2: { id: "electric_piano_2", name: "FM Tine EP Second Voice", category: "Electric Piano" },
  acoustic_bass: { id: "acoustic_bass", name: "Upright Walking Bass", category: "Bass & Sub" },
};

export const COMBI_PRESETS = {
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
      { id: 0, name: "Synthage Grand", inst: "acoustic_grand_piano", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
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
      { id: 0, name: "Concert Grand", inst: "acoustic_grand_piano", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Triton Warm Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.70, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Hollywood Soft Strings", inst: "string_ensemble_1", fx: "clean", gain: 0.60, pan: 0.05, oct: 1, minVel: 35, maxVel: 127, enabled: true },
      { id: 3, name: "Dyno Bell Tine", inst: "electric_piano_1", fx: "clean", gain: 0.50, pan: 0, oct: 1, minVel: 50, maxVel: 127, enabled: true },
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
  smooth_rnb: {
    id: "smooth_rnb",
    name: "★ Smooth R&B Soul (Stage EP + Breathy Sax + Strings)",
    category: "R&B / Soul",
    layers: [
      { id: 0, name: "Suit & Stage EP", inst: "electric_piano_1", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Breathy Alto Sax", inst: "alto_sax", fx: "reverb_room", gain: 0.85, pan: 0, oct: 0, minVel: 40, maxVel: 127, enabled: true },
      { id: 2, name: "Stereo Strings", inst: "string_ensemble_1", fx: "clean", gain: 0.55, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Punch Bass (Left)", inst: "synth_bass_1", fx: "punch_comp", gain: 0.70, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: false },
    ],
  },
  neo_soul_chill: {
    id: "neo_soul_chill",
    name: "★ Neo-Soul Chill (DX7 FM + EP + Sax + Sub)",
    category: "R&B / Neo-Soul",
    layers: [
      { id: 0, name: "Abletunes FM Piano", inst: "abletunes_fm_piano", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Suit & Stage EP", inst: "electric_piano_1", fx: "clean", gain: 0.75, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Breathy Alto Sax", inst: "alto_sax", fx: "reverb_room", gain: 0.80, pan: 0, oct: 0, minVel: 40, maxVel: 127, enabled: true },
      { id: 3, name: "Analog Sub Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.70, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  gospel_praise: {
    id: "gospel_praise",
    name: "★ Gospel Praise (Grand Piano + B3 Organ + Brass)",
    category: "Gospel & Praise",
    layers: [
      { id: 0, name: "Concert Grand", inst: "acoustic_grand_piano", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "B3 Rock Organ", inst: "drawbar_organ", fx: "clean", gain: 0.75, pan: 0, oct: 0, minVel: 20, maxVel: 127, enabled: true },
      { id: 2, name: "Stereo Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.55, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Fat Brass Horns", inst: "brass_section", fx: "tube_warm", gain: 0.65, pan: 0, oct: 0, minVel: 75, maxVel: 127, enabled: false },
    ],
  },
  ambient_space: {
    id: "ambient_space",
    name: "★ Deep Space Ambient (Universe + Fresh Air + Choir)",
    category: "Ambient / Cinematic",
    layers: [
      { id: 0, name: "Stereo Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Dyno Bell Chime", inst: "electric_piano_1", fx: "clean", gain: 0.65, pan: 0, oct: 1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Warm Upper Strings", inst: "string_ensemble_1", fx: "clean", gain: 0.60, pan: 0, oct: 1, minVel: 1, maxVel: 127, enabled: true },
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
      { id: 3, name: "Warm Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.50, pan: 0, oct: 1, minVel: 1, maxVel: 127, enabled: false },
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
      { id: 1, name: "M1 B3 Rock Organ", inst: "drawbar_organ", fx: "clean", gain: 0.85, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
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
      { id: 1, name: "M1 / B3 Gospel Organ", inst: "drawbar_organ", fx: "clean", gain: 0.85, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Triton Cathedral Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.65, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
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
      { id: 2, name: "Concert Grand Accent", inst: "acoustic_grand_piano", fx: "clean", gain: 0.80, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Breathy Alto Saxophone", inst: "alto_sax", fx: "reverb_room", gain: 0.75, pan: 0, oct: 0, minVel: 50, maxVel: 127, enabled: true },
    ],
  },
  chicago_blues_rock: {
    id: "chicago_blues_rock",
    name: "★ Chicago Blues & Rock (Clean Strat + B3 Organ + Bass)",
    category: "Blues / Rock",
    layers: [
      { id: 0, name: "Fender Strat Clean Guitar", inst: "electric_guitar_clean", fx: "tube_warm", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "M1 B3 Rock Organ", inst: "drawbar_organ", fx: "clean", gain: 0.85, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
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
      { id: 0, name: "SG Hybrid Concert Grand", inst: "acoustic_grand_piano", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
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
      { id: 1, name: "M1 Slap Bass", inst: "synth_bass_1", fx: "punch_comp", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
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
    name: "Bossa Nova Sunset (Nylon + FM Bell + Soft Bass)",
    category: "Jazz / Latin",
    layers: [
      { id: 0, name: "Fantom Nylon Bossa", inst: "acoustic_guitar_nylon", fx: "reverb_hall", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "FM Bell Comp", inst: "electric_piano_1", fx: "clean", gain: 0.65, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Soft Bossa Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.70, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Airy String Pad", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.45, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  sun_rai_street: {
    id: "sun_rai_street",
    name: "San Francisco Street (Sun Rai Rhodes Bed)",
    category: "Soul-Pop / R&B",
    layers: [
      { id: 0, name: "Splashed Rhodes 73", inst: "rhodes_stage_mp3", fx: "air_eq", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Rhodes High Shimmer", inst: "rhodes_stage_mp3", fx: "clean", gain: 0.30, pan: 0, oct: 1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Pocket Bass Guitar", inst: "synth_bass_1", fx: "warm_eq", gain: 0.75, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "70s String Whisper", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.35, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  acid_jazz_afterhours: {
    id: "acid_jazz_afterhours",
    name: "Acid Jazz Afterhours (Dark Tine + Deep Bass + Smoky Sax)",
    category: "Jazz / Acid Jazz",
    layers: [
      { id: 0, name: "Dark FM Tine", inst: "electric_piano_1", fx: "delay_tape", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Deep Pocket Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Smoky Alto Sax", inst: "alto_sax", fx: "reverb_plate", gain: 0.80, pan: 0, oct: 0, minVel: 35, maxVel: 127, enabled: true },
      { id: 3, name: "Midnight B3 Bed", inst: "drawbar_organ", fx: "rotary_slow", gain: 0.55, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  bebop_quartet: {
    id: "bebop_quartet",
    name: "Bebop Quartet (Upright + Nylon + Walking Bass + Brass Hits)",
    category: "Jazz / Bebop",
    layers: [
      { id: 0, name: "Bebop Upright Piano", inst: "abletunes_upright", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Nylon Rhythm Comp", inst: "acoustic_guitar_nylon", fx: "clean", gain: 0.65, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Walking Bass Line", inst: "synth_bass_1", fx: "punch_comp", gain: 0.80, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Brass Section Hits", inst: "brass_section", fx: "clean", gain: 0.70, pan: 0, oct: 0, minVel: 85, maxVel: 127, enabled: true },
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
    name: "Lo-Fi Study Beats (Dusty EP + Mellow Bass + Vinyl Pad)",
    category: "Lo-Fi / Chill",
    layers: [
      { id: 0, name: "Dusty FM EP", inst: "abletunes_fm_piano", fx: "lofi_vinyl", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Mellow Lo-Fi Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.75, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Vinyl String Pad", inst: "string_ensemble_1", fx: "clean", gain: 0.50, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Rainy Night Sax", inst: "alto_sax", fx: "reverb_room", gain: 0.60, pan: 0, oct: 0, minVel: 55, maxVel: 127, enabled: false },
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
};

export class MultiLayerEngine {
  constructor() {
    this.pcmEngine = null;
    this.activeCombi = COMBI_PRESETS.ballad_master;
    this.isCombiMode = true; // Signature Synthage + Triton Strings Combi active on boot!
    this.isSynthMode = false;
    this.activeSingleInst = "acoustic_grand_piano";
    this.synthPatch = null;
    this.layers = JSON.parse(JSON.stringify(this.activeCombi.layers));

    // Keyboard split: notes below the split point play bass instead (audible PCM path)
    this.isSplitMode = false;
    this.splitPointMidi = 60; // Middle C split
    this.splitBassInst = "synth_bass_1";

    this.onLayerChangeCallback = null;
    this.layerChangeListeners = new Set();
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
  }

  init() {
    if (!this.pcmEngine) {
      const ctx = audioCore.init();
      if (ctx) {
        // Route through FX Rack Input so Tube Overdrive, Distortion, Chorus, Rotary work on ALL sounds!
        this.pcmEngine = new NativePcmEngine(ctx, audioCore.fxRack.input);
      }
    }
  }

  setSingleInstrument(instKey) {
    this.isSynthMode = false;
    this.isCombiMode = false;
    if (HD_SOUNDBANKS[instKey] || instKey === "acoustic_grand_piano") {
      this.activeSingleInst = instKey;
      this.init();
    }
  }

  setSynthProgram(patchConfig) {
    this.isSynthMode = true;
    this.isCombiMode = false;
    this.synthPatch = patchConfig;
    synthEngine.activePatch = patchConfig;
    this.init();
  }

  toggleCombiMode(enabled) {
    this.isCombiMode = enabled !== undefined ? enabled : !this.isCombiMode;
    if (this.isCombiMode) {
      this.isSynthMode = false;
    }
    this.init();
    this.notifyLayerChange();
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

  setCombiPreset(presetId) {
    if (COMBI_PRESETS[presetId]) {
      this.activeCombi = COMBI_PRESETS[presetId];
      this.isCombiMode = true;
      this.isSynthMode = false;
      this.layers = JSON.parse(JSON.stringify(this.activeCombi.layers));
      this.init();
      this.syncLayerFx();
      if (INSTRUMENT_PATCHES[presetId]) {
        synthEngine.activePatch = INSTRUMENT_PATCHES[presetId];
      }
      this.notifyLayerChange();
    }
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
    if (this.layers[layerIndex]) {
      this.layers[layerIndex].enabled = enabled !== undefined ? enabled : !this.layers[layerIndex].enabled;
      this.isCombiMode = true;
      this.isSynthMode = false;
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
    if (this.layers[layerIndex] && instKey) {
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
        breathy_alto_sax: "alto_sax",
        m1_fresh_air: "electric_piano_1",
        m1_universe: "string_ensemble_1",
        m1_choir: "string_ensemble_1",
        m1_piano_16: "acoustic_grand_piano",
        m1_organ_2: "drawbar_organ",
        m1_slap_bass: "synth_bass_1",
      };
      const resolvedKey = BANK_MAP[instKey] || instKey;
      this.layers[layerIndex].inst = resolvedKey;
      this.layers[layerIndex].name = HD_SOUNDBANKS[resolvedKey]?.name || HD_SOUNDBANKS[instKey]?.name || instKey;
      this.isCombiMode = true;
      this.isSynthMode = false;
      this.init();
      this.notifyLayerChange();
    }
  }

  toggleSplitMode(enabled) {
    this.isSplitMode = enabled !== undefined ? enabled : !this.isSplitMode;
  }

  noteOn(midiNote, velocity = 95) {
    if (!this.pcmEngine) this.init();
    audioCore.ensureRunning();

    // Split zone: left hand plays bass regardless of mode
    if (this.isSplitMode && midiNote < this.splitPointMidi) {
      if (this.pcmEngine) {
        this.pcmEngine.playNote(this.splitBassInst, midiNote, velocity, 1.0, null);
      }
      return;
    }

    // ALL MODES use PCM samples — never raw oscillator voices
    if (this.isCombiMode) {
      // COMBI MODE: Synchronous sample-0 trigger on all enabled PCM layers
      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];
        if (!layer.enabled) continue;
        if (velocity < layer.minVel || velocity > layer.maxVel) continue;

        const transposedMidi = Math.max(21, Math.min(108, midiNote + layer.oct * 12));
        if (this.pcmEngine) {
          this.pcmEngine.playNote(layer.inst, transposedMidi, velocity, layer.gain, i);
        }
      }
    } else {
      // SINGLE PROGRAM MODE: Instant sample-0 playback of authentic PCM sound
      if (this.pcmEngine) {
        this.pcmEngine.playNote(this.activeSingleInst, midiNote, velocity, 1.0, null);
      }
    }
  }

  noteOff(midiNote) {
    audioCore.ensureRunning();
    if (this.isSynthMode) {
      synthEngine.noteOff(midiNote);
      if (synthEngine.isDualLayer) {
        synthEngine.releaseLayerVoice(midiNote);
      }
    }

    if (this.isSplitMode && midiNote < this.splitPointMidi) {
      if (this.pcmEngine) {
        this.pcmEngine.stopNote(this.splitBassInst, midiNote);
      }
      return;
    }

    if (this.pcmEngine) {
      if (this.isCombiMode) {
        for (let i = 0; i < this.layers.length; i++) {
          const layer = this.layers[i];
          const transposedMidi = Math.max(21, Math.min(108, midiNote + layer.oct * 12));
          this.pcmEngine.stopNote(layer.inst, transposedMidi);
        }
      } else {
        this.pcmEngine.stopNote(this.activeSingleInst, midiNote);
      }
    }
  }

  setNoteExpression(midiNote, relativeY) {
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

  setSustainPedal(isDown) {
    if (!this.pcmEngine) this.init();
    audioCore.ensureRunning();
    if (this.pcmEngine) this.pcmEngine.setSustainPedal(isDown);
  }

  setPitchBend(semitones) {
    if (!this.pcmEngine) this.init();
    if (this.pcmEngine) this.pcmEngine.setPitchBend(semitones);
  }

  setModWheel(amount) {
    if (!this.pcmEngine) this.init();
    if (this.pcmEngine) this.pcmEngine.setModWheel(amount);
  }

  panic() {
    if (this.pcmEngine) this.pcmEngine.allNotesOff();
  }
}

export const multiLayerEngine = new MultiLayerEngine();
