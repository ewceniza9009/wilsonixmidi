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

export const HD_SOUNDBANKS = {
  acoustic_grand_piano: { id: "acoustic_grand_piano", name: "Velo Piano Concert Grand", category: "Acoustic Piano" },
  electric_piano_1: { id: "electric_piano_1", name: "Triton Suit. & Stage EP", category: "Electric Piano" },
  rhodes_stage_mp3: { id: "rhodes_stage_mp3", name: "Stage Rhodes 73 (Vintage Muir)", category: "Electric Piano" },
  abletunes_fm_piano: { id: "abletunes_fm_piano", name: "Abletunes Studio FM Piano (DX7)", category: "Electric Piano" },
  abletunes_upright: { id: "abletunes_upright", name: "Abletunes Studio Upright Piano", category: "Acoustic Piano" },
  m1_piano_16: { id: "m1_piano_16", name: "Korg M1 Piano 16' (Vogue House)", category: "Acoustic Piano" },
  m1_organ_2: { id: "m1_organ_2", name: "Korg M1 Organ 2 (Show Me Love)", category: "Organ & Bass" },
  m1_universe: { id: "m1_universe", name: "Korg M1 Universe (Celestial Pad)", category: "Synth Pad" },
  m1_ooh_ahh: { id: "m1_ooh_ahh", name: "Korg M1 03 Ooh-Ahh", category: "Strings & Choir" },
  m1_choir: { id: "m1_choir", name: "Korg M1 Ooh-Aah Choir", category: "Strings & Choir" },
  m1_symphonic: { id: "m1_symphonic", name: "Korg M1 Symphonic Strings", category: "Strings" },
  m1_guitar_1: { id: "m1_guitar_1", name: "Korg M1 Guitar 1", category: "Guitar" },
  m1_fretless: { id: "m1_fretless", name: "Korg M1 Fretless Bass", category: "Bass & Sub" },
  m1_pan_flute: { id: "m1_pan_flute", name: "Korg M1 Pan Flute", category: "Woodwind" },
  m1_bottle_bell: { id: "m1_bottle_bell", name: "Korg M1 Bottle Bell", category: "Bells & Mallet" },
  m1_kalimba: { id: "m1_kalimba", name: "Korg M1 Kalimba (Thumb Piano)", category: "Bells & Mallet" },
  kalimba: { id: "kalimba", name: "Acoustic Mbira Kalimba", category: "Bells & Mallet" },
  m1_12string: { id: "m1_12string", name: "Korg M1 12-String", category: "Guitar" },
  m1_fresh_air: { id: "m1_fresh_air", name: "Korg M1 Fresh Air (Airy Bell)", category: "Bells & Pad" },
  m1_slap_bass: { id: "m1_slap_bass", name: "Korg M1 Slap Bass (90s Funk)", category: "Bass & Sub" },
  string_ensemble_1: { id: "string_ensemble_1", name: "Triton Stereo Strings", category: "Strings & Choir" },
  drawbar_organ: { id: "drawbar_organ", name: "Korg M1 / B3 Rock Organ", category: "Organ" },
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
  soprano_sax: { id: "soprano_sax", name: "Sweet Soprano Sax", category: "Woodwind" },
  muted_trumpet: { id: "muted_trumpet", name: "Harmon Mute Trumpet", category: "Brass" },
  acoustic_guitar_steel: { id: "acoustic_guitar_steel", name: "Steel-String Acoustic", category: "Guitar" },
  slap_bass_1: { id: "slap_bass_1", name: "Slap Bass Attack", category: "Bass & Sub" },
  rock_organ: { id: "rock_organ", name: "Rock Organ Shout", category: "Organ" },
  harpsichord: { id: "harpsichord", name: "Baroque Harpsichord", category: "Bells & Pad" },

  // Genuine Saxophone & Reed Instruments
  sax_genuine_solo: { id: "sax_genuine_solo", name: "🎷 Expressive Solo Alto Sax", category: "Woodwind" },
  sax_sensual: { id: "sax_sensual", name: "🎷 Sensual 80s Breathy Sax", category: "Woodwind" },
  sax_blues_growl: { id: "sax_blues_growl", name: "🎷 Dirty Blues Sax Growl", category: "Woodwind" },
  sax_funk_stab: { id: "sax_funk_stab", name: "🎷 Funk Brass & Sax Stab", category: "Woodwind" },
  sax_fall: { id: "sax_fall", name: "🎷 Big Band Sax Fall", category: "Woodwind" },
  sax_scoop: { id: "sax_scoop", name: "🎷 Expressive Pitch Scoop Sax", category: "Woodwind" },

  // Nature Sounds
  nature_thunder: { id: "nature_thunder", name: "Deep Thunder Strike", category: "Nature Sounds" },
  nature_rain: { id: "nature_rain", name: "Gentle Rainstorm Ambience", category: "Nature Sounds" },
  nature_ocean: { id: "nature_ocean", name: "Ocean Surf Waves", category: "Nature Sounds" },
  nature_birds: { id: "nature_birds", name: "Forest Bird Chirps", category: "Nature Sounds" },
  nature_wind: { id: "nature_wind", name: "Howling Wind Gusts", category: "Nature Sounds" },

  // Human Voices
  vox_yeah: { id: "vox_yeah", name: "Vocal Chant 'Yeah!'", category: "Human Voices" },
  vox_whoa: { id: "vox_whoa", name: "Soul Vocal 'Whoa-Oh'", category: "Human Voices" },
  vox_hey: { id: "vox_hey", name: "Hype Vocal 'Hey!'", category: "Human Voices" },
  vox_beatbox: { id: "vox_beatbox", name: "Human Beatbox Kit", category: "Human Voices" },

  // Weird & Sci-Fi FX
  fx_laser: { id: "fx_laser", name: "Laser Beam Zap", category: "Weird & Sci-Fi FX" },
  fx_alien: { id: "fx_alien", name: "Alien Hyperspace Drone", category: "Weird & Sci-Fi FX" },
  fx_bionic: { id: "fx_bionic", name: "Bionic Glitch Cascade", category: "Weird & Sci-Fi FX" },

  // DJ & Cinematic FX
  fx_scratch: { id: "fx_scratch", name: "Vinyl Scratch Cut", category: "DJ & Cinematic FX" },
  fx_tapestop: { id: "fx_tapestop", name: "Tape Stop Slow-Down", category: "DJ & Cinematic FX" },
  fx_subboom: { id: "fx_subboom", name: "Sub Bass Impact Boom", category: "DJ & Cinematic FX" },
  fx_airhorn: { id: "fx_airhorn", name: "Dancehall Reggae Airhorn", category: "DJ & Cinematic FX" },

  // Reggae, Dub & Stage Sound FX
  dub_siren: { id: "dub_siren", name: "🚨 Jamaican Dub Siren", category: "Reggae & Dub SFX" },
  spring_splash: { id: "spring_splash", name: "💥 Vintage Spring Reverb Crash", category: "Reggae & Dub SFX" },
  laser_zap: { id: "laser_zap", name: "⚡ Sound System Laser Zap", category: "Reggae & Dub SFX" },
  dub_horn: { id: "dub_horn", name: "🎺 Dancehall Airhorn Blast", category: "Reggae & Dub SFX" },
  sub_boom: { id: "sub_boom", name: "💣 Heavy 808 Sub-Boom", category: "Reggae & Dub SFX" },
  noise_riser: { id: "noise_riser", name: "🌊 White Noise Sweep Riser", category: "Reggae & Dub SFX" },

  // Percussions & Drums
  tr808_kit: { id: "tr808_kit", name: "TR-808 Analog Drum Kit", category: "Percussion & Drums" },
  percussion_conga: { id: "percussion_conga", name: "Afro-Cuban Congas", category: "Percussion & Drums" },
  percussion_shaker: { id: "percussion_shaker", name: "Latin Shaker & Maracas", category: "Percussion & Drums" },
  // Synthesizer You (Ripped Sounds & Loops)
  sy_surf_spring: { id: "sy_surf_spring", name: "🏄 Synthesizer You - Surf Lead Riff", category: "Synthesizer You (80s)" },
  sy_chorus_swell: { id: "sy_chorus_swell", name: "🎹 Synthesizer You - Juno Chorus Pad Swell", category: "Synthesizer You (80s)" },
  sy_bass_riff: { id: "sy_bass_riff", name: "🎸 Synthesizer You - Analog Bass Riff", category: "Synthesizer You (80s)" },
  sy_gated_snare_1: { id: "sy_gated_snare_1", name: "💥 Synthesizer You - Gated Snare Cannon 1", category: "Synthesizer You (80s)" },
  sy_gated_snare_2: { id: "sy_gated_snare_2", name: "🥁 Synthesizer You - Gated Snare Cannon 2", category: "Synthesizer You (80s)" },
  sy_vox_slap_1: { id: "sy_vox_slap_1", name: "🎤 Synthesizer You - Slapback Vox Shout 1", category: "Synthesizer You (80s)" },
  sy_vox_slap_2: { id: "sy_vox_slap_2", name: "🔥 Synthesizer You - Slapback Vox Shout 2", category: "Synthesizer You (80s)" },
  sy_vox_slap_3: { id: "sy_vox_slap_3", name: "🎶 Synthesizer You - Slapback Vocal Phrase", category: "Synthesizer You (80s)" },
  sy_surf_pluck_c4: { id: "sy_surf_pluck_c4", name: "🎸 Synthesizer You - Surf Pluck C4", category: "Synthesizer You (80s)" },
  sy_kick_punch: { id: "sy_kick_punch", name: "🥊 Synthesizer You - 80s Punch Kick", category: "Synthesizer You (80s)" },
  sy_riser_sweep: { id: "sy_riser_sweep", name: "🚀 Synthesizer You - FX Riser Sweep", category: "Synthesizer You (80s)" },
  sy_tape_drop: { id: "sy_tape_drop", name: "🛑 Synthesizer You - Tape Drop FX", category: "Synthesizer You (80s)" },
};

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
      { id: 0, name: "Juno Analog Poly Synth", inst: "m1_universe", fx: "analog_juno_chorus", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Slapback Vocal Shout", inst: "vox_yeah", fx: "slapback_vocal", gain: 0.75, pan: 0.05, oct: 0, minVel: 40, maxVel: 127, enabled: true },
      { id: 2, name: "Optical Tremolo Synth Pulse", inst: "synth_bass_1", fx: "opto_tremolo_16th", gain: 0.70, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Korg M1 Fresh Air Shimmer", inst: "m1_fresh_air", fx: "spring_surf", gain: 0.50, pan: 0, oct: 1, minVel: 60, maxVel: 127, enabled: true },
    ],
  },
  synthesizer_you_cannon: {
    id: "synthesizer_you_cannon",
    name: "💥 Synthesizer You - 80s Gated Snare & Beat Stack",
    category: "Synthesizer You Signature",
    layers: [
      { id: 0, name: "80s Gated Snare Cannon", inst: "sy_gated_snare_1", fx: "gated_cannon", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Punchy 80s Tape Kick", inst: "sy_kick_punch", fx: "tape_sat_master", gain: 0.95, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Analog Synth Bassline", inst: "sy_bass_riff", fx: "tape_sat_master", gain: 0.80, pan: -0.05, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Surf Pluck Lead", inst: "sy_surf_pluck_c4", fx: "spring_surf", gain: 0.85, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  synthesizer_you_vocal_dub: {
    id: "synthesizer_you_vocal_dub",
    name: "🎤 Synthesizer You - Slapback Vocal & Tape Sat Stack",
    category: "Synthesizer You Signature",
    layers: [
      { id: 0, name: "Slapback Lead Vocal Phrase", inst: "sy_vox_slap_3", fx: "slapback_vocal", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Juno Stereo Chorus Swell", inst: "sy_chorus_swell", fx: "analog_juno_chorus", gain: 0.70, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Optical Tremolo Pulse", inst: "synth_bass_1", fx: "opto_tremolo_16th", gain: 0.75, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Surf Lead Spring Echo", inst: "sy_surf_spring", fx: "spring_surf", gain: 0.60, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
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
    name: "★ Neo-Soul Chill (DX7 FM + EP + Sax + Sub)",
    category: "R&B / Neo-Soul",
    layers: [
      { id: 0, name: "Abletunes FM Piano", inst: "abletunes_fm_piano", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Suit & Stage EP", inst: "electric_piano_1", fx: "clean", gain: 0.75, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Breathy Alto Sax", inst: "alto_sax", fx: "reverb_room", gain: 0.80, pan: 0, oct: 0, minVel: 40, maxVel: 127, enabled: true },
      { id: 3, name: "Analog Sub Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.70, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
    ],
  },
  reggae_bubble: {
    id: "reggae_bubble",
    name: "★ Kingston Bubble & Reggae Skank (B3 + Piano + Guitar)",
    category: "Reggae & Dub",
    fxPreset: "reggae_dub",
    layers: [
      { id: 0, name: "Percussive B3 Bubble Organ", inst: "drawbar_organ", fx: "rotary_fast", gain: 1.0, pan: -0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Staccato Grand Chop", inst: "acoustic_grand_piano", fx: "clean", gain: 0.85, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Muted Clean Guitar Skank", inst: "electric_guitar_clean", fx: "punch_comp", gain: 0.70, pan: 0.1, oct: 0, minVel: 20, maxVel: 127, enabled: true },
      { id: 3, name: "Dub Sub Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.80, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
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
    name: "★ Roger Troutman Talkbox Lead & Slap Funk",
    category: "Funk & Groove",
    fxPreset: "talkbox_vocal",
    layers: [
      { id: 0, name: "Roger Talkbox Synth Lead (Zapp)", inst: "va:A017", fx: "tube_warm", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Korg M1 Slap Bass", inst: "m1_slap_bass", fx: "punch_comp", gain: 0.85, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Funky Clavinet D6", inst: "electric_piano_1", fx: "clean", gain: 0.65, pan: 0.05, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Fat Brass Horns", inst: "brass_section", fx: "air_eq", gain: 0.60, pan: -0.05, oct: 0, minVel: 60, maxVel: 127, enabled: false },
    ],
  },
  lofi_vinyl_ep: {
    id: "lofi_vinyl_ep",
    name: "★ Lo-Fi Vintage Tape Rhodes (Wow & Flutter)",
    category: "Neo-Soul / Lo-Fi",
    fxPreset: "lofi_vinyl_tape",
    layers: [
      { id: 0, name: "Mark I Suitcase Rhodes", inst: "electric_piano_1", fx: "clean", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Warm Atmosphere Strings", inst: "string_ensemble_1", fx: "reverb_room", gain: 0.45, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Sub Sine Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.70, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Korg M1 Universe", inst: "string_ensemble_1", fx: "clean", gain: 0.35, pan: 0.05, oct: 1, minVel: 50, maxVel: 127, enabled: false },
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
      { id: 0, name: "Suitcase Rhodes 73", inst: "rhodes_stage_mp3", fx: "autopan_wide", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Rhodes Shimmer Chorus", inst: "rhodes_stage_mp3", fx: "chorus_lush", gain: 0.25, pan: 0, oct: 1, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Pocket Bass Guitar", inst: "synth_bass_1", fx: "warm_eq", gain: 0.75, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Night Air Strings", inst: "string_ensemble_1", fx: "reverb_hall", gain: 0.25, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
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
    name: "Synthesizer You (Neo-Soul Tape EP)",
    category: "Neo-Soul / Chill",
    layers: [
      { id: 0, name: "Dark Tape Rhodes", inst: "rhodes_stage_mp3", fx: "tape_lowpass", gain: 1.0, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 1, name: "Rhodes Stereo Width", inst: "rhodes_stage_mp3", fx: "autopan_wide", gain: 0.30, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: true },
      { id: 2, name: "Warm Tape Bass", inst: "synth_bass_1", fx: "warm_eq", gain: 0.70, pan: 0, oct: -1, minVel: 1, maxVel: 127, enabled: true },
      { id: 3, name: "Tape Compress Pad", inst: "string_ensemble_1", fx: "punch_comp", gain: 0.10, pan: 0, oct: 0, minVel: 1, maxVel: 127, enabled: false },
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

    this.onLayerChangeCallback = null;
    this.layerChangeListeners = new Set();
    this._vaEngines = new Map(); // VA oscillator engine per combi layer program
  }

  getVaEngineFor(prog, gain = 1) {
    const gainKey = Math.max(1, Math.min(150, Math.round((gain || 1) * 100)));
    const key = prog.id + "|" + gainKey;
    if (this._vaEngines.has(key)) return this._vaEngines.get(key);
    const eng = new TritonVirtualAnalogEngine();
    this.init();
    eng.init();
    eng.setProgram(prog);
    if (typeof gain === "number" && gain > 0 && eng.config) {
      eng.config.masterGain = (eng.config.masterGain || 0.72) * Math.min(1.25, 0.85 + gain);
    }
    this._vaEngines.set(key, eng);
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
      }
    }
    if (this.pcmEngine) {
      this.syncLayerFx();
      this.syncSplitFx();
    }
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
      breathy_alto_sax: "alto_sax",
      m1_fresh_air: "electric_piano_1",
      m1_universe: "string_ensemble_1",
      m1_choir: "choir_aahs",
      m1_ooh_ahh: "choir_aahs",
      ooh_ahh: "choir_aahs",
      choir_aahs: "choir_aahs",
      voice_oohs: "choir_aahs",
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
    };
    return BANK_MAP[instKey] || instKey;
  }

  setSingleInstrument(instKey) {
    this.isSplitMode = false;
    this.isSynthMode = false;
    this.isTritonVaMode = false;
    this.activeTritonVaProg = null;
    const resolved = this.resolveBankKey(instKey);
    this.activeSingleInst = resolved;

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

    this.init();
    this.notifyLayerChange();
    this.notifySplitChange();
  }

  setDualLayerEnabled(enabled) {
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
    }
    this.setDualLayerEnabled(true);
  }

  setSynthProgram(patchConfig) {
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
    this.isSplitMode = false;
    this.isTritonVaMode = true;
    this.isCombiMode = false;
    this.isSynthMode = true;
    this.activeTritonVaProg = prog;
    const ctx = audioCore.init();
    if (ctx) tritonVaEngine.init();
    tritonVaEngine.setProgram(prog);
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
      tritonVaEngine.allNotesOff();
      this.vaAllNotesOff();
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

  setCombiPreset(presetId) {
    if (COMBI_PRESETS[presetId]) {
      this.activeCombi = COMBI_PRESETS[presetId];
      this.isCombiMode = true;
      this.isSplitMode = false;
      this.isSynthMode = false;
      this.isTritonVaMode = false;
      this.activeTritonVaProg = null;
      tritonVaEngine.allNotesOff();
      this.vaAllNotesOff();
      this.isDualLayerActive = false; // explicitly loaded a full 4-layer combi
      this.layers = JSON.parse(JSON.stringify(this.activeCombi.layers));
      this.init();
      this.syncLayerFx();
      if (this.activeCombi.fxPreset && audioCore.fxRack) {
        audioCore.fxRack.applyPreset(this.activeCombi.fxPreset);
      }
      if (INSTRUMENT_PATCHES[presetId]) {
        synthEngine.activePatch = INSTRUMENT_PATCHES[presetId];
      }
      this.notifyLayerChange();
      this.notifySplitChange();
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
    if (layerIndex === 1) {
      this.setDualLayerEnabled(enabled);
      return;
    }
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
      }
      this.isCombiMode = true;
      this.isSynthMode = false;
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

  noteOn(midiNote, velocity = 95) {
    if (!this.pcmEngine) this.init();
    audioCore.ensureRunning();

    // Split zone: route through the dedicated zone bus (triggers assigned instrument
    // or the current stack, so each half gets its own insert FX like a combi strip)
    if (this.isSplitMode) {
      const isLower = midiNote < this.splitPointMidi;
      const zone = this.splitZone(isLower ? "lower" : "upper");

      if (zone && zone.inst !== null && zone.inst !== undefined && zone.inst !== "current_stack") {
        const transposedMidi = Math.max(21, Math.min(108, midiNote + (zone.oct || 0) * 12));
        if (zone.vaProg) {
          this.getVaEngineFor(zone.vaProg, zone.gain).noteOn(transposedMidi, velocity);
        } else if (this.pcmEngine) {
          const dest = (this.pcmEngine.splitZoneInserts && this.pcmEngine.splitZoneInserts[isLower ? "lower" : "upper"])
            ? this.pcmEngine.splitZoneInserts[isLower ? "lower" : "upper"].input
            : null;
          this.pcmEngine.playNote(zone.inst, transposedMidi, velocity, zone.gain, null, dest);
        }
        return;
      }
      // current-stack zone: fall through to normal routing (combi/single/VA)
    }

    // Triton VA mode: real oscillator engine plays the program's own waveforms
    if (this.isTritonVaMode && this.activeTritonVaProg) {
      tritonVaEngine.noteOn(midiNote, velocity);
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
        if (layer.vaProg) {
          this.getVaEngineFor(layer.vaProg, layer.gain).noteOn(transposedMidi, velocity);
        } else if (this.pcmEngine) {
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

    // Split zone release mirrors the noteOn routing (zone bus + VA/PCM)
    if (this.isSplitMode) {
      const isLower = midiNote < this.splitPointMidi;
      const zone = this.splitZone(isLower ? "lower" : "upper");

      if (zone && zone.inst !== null && zone.inst !== undefined && zone.inst !== "current_stack") {
        const transposedMidi = Math.max(21, Math.min(108, midiNote + (zone.oct || 0) * 12));
        if (zone.vaProg) {
          this.getVaEngineFor(zone.vaProg, zone.gain).noteOff(transposedMidi);
        } else if (this.pcmEngine) {
          this.pcmEngine.stopNote(zone.inst, transposedMidi);
        }
        return;
      }
      // current-stack zone: fall through to normal routing (combi/single/VA)
    }

    if (this.isTritonVaMode && this.activeTritonVaProg) {
      tritonVaEngine.noteOff(midiNote);
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
            this.getVaEngineFor(layer.vaProg, layer.gain).noteOff(transposedMidi);
          } else {
            this.pcmEngine.stopNote(layer.inst, transposedMidi);
          }
        }
      } else {
        this.pcmEngine.stopNote(this.activeSingleInst, midiNote);
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

  setSustainPedal(isDown) {
    if (!this.pcmEngine) this.init();
    audioCore.ensureRunning();
    if (this.isTritonVaMode && this.activeTritonVaProg) {
      tritonVaEngine.setSustainPedal(isDown);
      return;
    }
    if (this.pcmEngine) {
      this.pcmEngine.setSustainPedal(isDown);
      if (this.isCombiMode) {
        this._vaEngines.forEach(eng => { try { eng.setSustainPedal(isDown); } catch (err) {} });
      }
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

  setModWheel(amount) {
    if (!this.pcmEngine) this.init();
    if (this.pcmEngine) this.pcmEngine.setModWheel(amount);
  }

  panic() {
    if (this.pcmEngine) this.pcmEngine.allNotesOff();
    tritonVaEngine.allNotesOff();
    this.vaAllNotesOff();
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
