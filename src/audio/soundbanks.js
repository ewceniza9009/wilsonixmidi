/**
 * WILSONIX MIDIKEY - Master SoundBank Catalog (single source of truth).
 * Every HD workstation / M1 / Triton / SFX instrument entry that the multi-layer
 * engine, picker UIs and registration manager read from lives here. Import this
 * module (or re-export via multi-layer-engine.js) instead of re-declaring the map.
 */

import { ANIMAL_EDM_BANKS } from "./animal-edm-manifest.js";
import { BLOOM_EDM_BANKS } from "./bloom-edm-manifest.js";
import { MULTISAMPLE_BANKS } from "./multisample-manifest.js";

export const HD_SOUNDBANKS = {
  ...ANIMAL_EDM_BANKS,
  ...BLOOM_EDM_BANKS,
  ...MULTISAMPLE_BANKS,
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
  fx_sub_resonator: { id: "fx_sub_resonator", name: "Sub-Atomic Resonator", category: "Weird & Sci-Fi FX" },

  // Human Vocals & Choir
  voice_oohs: { id: "voice_oohs", name: "Soul Gospel Vocal Oohs", category: "Human Voices" },
  vox_yeah_r: { id: "vox_yeah_r", name: "Soul Vocal 'Yeah!' Shout", category: "Human Voices" },
  vox_hey_r: { id: "vox_hey_r", name: "Hype Vocal 'Hey!' Shout", category: "Human Voices" },
  angelic_choir: { id: "angelic_choir", name: "Angelic Worship Choir", category: "Human Voices" },
  vox_hum: { id: "vox_hum", name: "Deep Male Vocal Hum", category: "Human Voices" },

  // Bells & Chimes
  tubular_bells: { id: "tubular_bells", name: "Orchestral Tubular Chimes", category: "Bells & Mallet" },
  wind_chimes: { id: "wind_chimes", name: "Mark Tree Wind Chimes", category: "Bells & Mallet" },
  crystal_chimes: { id: "crystal_chimes", name: "Crystal Shimmer Chimes", category: "Bells & Mallet" },

  // Authentic DJ Samples
  dj_scratch_r: { id: "dj_scratch_r", name: "Authentic Vinyl Scratch", category: "DJ & Cinematic FX" },
  dj_partyhorn_r: { id: "dj_partyhorn_r", name: "Dancehall Reggae Airhorn", category: "DJ & Cinematic FX" },
  dj_siren_r: { id: "dj_siren_r", name: "Sound System Dub Siren", category: "DJ & Cinematic FX" },
  dj_whistle_r: { id: "dj_whistle_r", name: "Carnival Samba Whistle", category: "DJ & Cinematic FX" },

  // Percussions & Drums
  tr808_kit: { id: "tr808_kit", name: "TR-808 Analog Drum Kit", category: "Percussion & Drums" },
  percussion_conga: { id: "percussion_conga", name: "Afro-Cuban Congas (Slap & Open)", category: "Percussion & Drums" },
  synth_drum: { id: "synth_drum", name: "Analog Synth Drum (Simmons SDSV Space)", category: "Percussion & Drums" },
  real_drum_kit: { id: "real_drum_kit", name: "Real Acoustic Drum Kit (Zero-Latency)", category: "Percussion & Drums" },
  percussion_shaker: { id: "percussion_shaker", name: "Latin Shaker & Maracas", category: "Percussion & Drums" },
  taiko_drum: { id: "taiko_drum", name: "Cinematic Taiko Impact", category: "Percussion & Drums" },
  percussion_taiko: { id: "taiko_drum", name: "Cinematic Taiko Impact", category: "Percussion & Drums" },
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

  // Roland Legendary D-50, U-20, MV-30 & SC-55 SoundBanks
  roland_d50_fantasia: { id: "roland_d50_fantasia", name: "Roland D-50 Fantasia", category: "Synth Pad" },
  roland_u20_choir: { id: "roland_u20_choir", name: "Roland U-20 Airy Vocal Choir", category: "Strings & Choir" },
  roland_bright_ep: { id: "roland_bright_ep", name: "Roland SA Bright E.Piano", category: "Electric Piano" },
  roland_sc55_warm_pad: { id: "roland_sc55_warm_pad", name: "Roland SC-55 Warm Pad", category: "Synth Pad" },
  roland_space_voice: { id: "roland_space_voice", name: "Roland SC-55 Space Voice", category: "Strings & Choir" },
  roland_metal_pad: { id: "roland_metal_pad", name: "Roland MV-30 Shimmer Metal Pad", category: "Synth Pad" },
  roland_sc55_finger_bass: { id: "roland_sc55_finger_bass", name: "Roland SC-55 Punchy Finger Bass", category: "Bass & Sub" },
  roland_u20_shakuhachi: { id: "roland_u20_shakuhachi", name: "Roland U-20 Breathy Shakuhachi", category: "Woodwind" },
  roland_orchestra_hit: { id: "roland_orchestra_hit", name: "Roland SC-55 Orchestra Hit", category: "Orchestral & Hit" },
  roland_synth_brass: { id: "roland_synth_brass", name: "Roland Jupiter Synth Brass", category: "Brass" },
};