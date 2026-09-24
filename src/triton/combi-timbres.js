/**
 * Combi Timbre Resolver
 * Mirrors the exact routing the Triton TouchView uses to play a bank program,
 * so a program pickable on the TRITON tab can also be selected as a COMBI layer
 * timbre and sound identical:
 *  - KORG_M1 programs (m1Type)  -> the same PCM instrument applyM1Program uses
 *  - instId-tagged programs     -> the real PCM/SFX instrument directly
 *  - osc-based VA programs      -> a genuine Triton VA oscillator voice
 *  - everything else            -> the same category-based PCM fallback
 */

import { TRITON_BANKS } from "./triton-soundbanks.js";

// Mirror of applyM1Program(): m1Type -> final playable PCM instKey
const M1_INST = {
  ooh_ahh: "choir_aahs",
  choir: "choir_aahs",
  universe: "string_ensemble_1",
  piano16: "acoustic_grand_piano",
  brass1: "brass_section",
  guitar1: "acoustic_guitar_steel",
  bottle_bell: "vibraphone",
  fretless: "acoustic_bass",
  symphonic: "string_ensemble_1",
  strings: "string_ensemble_1",
  pan_flute: "flute",
  drums1: "synth_bass_1",
  epiano: "electric_piano_2",
  trumpet: "trumpet",
  nimbus: "string_ensemble_1",
  dist_guitar: "distortion_guitar",
  vibes: "vibraphone",
  pick_bass: "slap_bass_1",
  flute: "flute",
  dream_pad: "string_ensemble_1",
  magic_piano: "acoustic_grand_piano",
  string12: "acoustic_guitar_steel",
  kalimba: "kalimba",
  abass: "acoustic_bass",
  koto: "harpsichord",
  bell_ring: "vibraphone",
  synth_bass1: "synth_bass_1",
  slapbass: "synth_bass_1",
  solo_synth: "brass_section",
  organ2: "drawbar_organ",
  magician: "string_ensemble_1",
  lore: "alto_sax",
  freshair: "electric_piano_1",
};

// Mirror of applyTritonProgram(): trait of a genuine VA oscillator program
export function isSynthTimbre(prog) {
  if (!prog || prog.instId) return false;
  const cat = (prog.category || "").toLowerCase();
  const name = (prog.name || "").toLowerCase();
  const hasOsc = !!prog.osc1 || !!prog.osc2;
  if (!hasOsc) return false;

  // Never classify acoustic/electro-mechanical rompler instruments as VA
  if (
    cat.includes("organ") ||
    cat.includes("electric piano") ||
    cat.includes("keyboard") ||
    cat.includes("piano") ||
    cat.includes("brass") ||
    cat.includes("woodwind") ||
    cat.includes("sax") ||
    cat.includes("harmonica") ||
    cat.includes("guitar") ||
    cat.includes("bass") ||
    name.includes("organ") ||
    /\bep\b/i.test(name) ||
    name.includes("tine") ||
    name.includes("rhodes") ||
    name.includes("piano") ||
    name.includes("trombone") ||
    name.includes("trumpet") ||
    name.includes("sax") ||
    name.includes("harmonica") ||
    name.includes("flute") ||
    name.includes("clarinet") ||
    name.includes("guitar")
  ) {
    return false;
  }

  return (
    cat.includes("lead") ||
    cat.includes("fast synth") ||
    cat.includes("synthesizer") ||
    cat.includes("motion") ||
    cat.includes("synth pad") ||
    cat.includes("hit") ||
    cat.includes("stab") ||
    name.includes("trance") ||
    name.includes("sine lead") ||
    name.includes("saw") ||
    name.includes("scream") ||
    name.includes("sweeper") ||
    name.includes("hypersaw") ||
    name.includes("sync") ||
    name.includes("techno") ||
    name.includes("stab")
  );
}

// Mirror of applyTritonProgram() category/name -> PCM instKey cascade
export function resolvePcmByProgram(prog) {
  if (!prog) return "acoustic_grand_piano";
  const cat = (prog.category || "").toLowerCase();
  const name = (prog.name || "").toLowerCase();
  const ifx = (prog.ifx || "").toLowerCase();
  const isGuitar = cat.includes("guitar") || name.includes("guitar");
  const isBass = cat.includes("bass") || name.includes("bass");

  if (prog.instId) return prog.instId;
  if (prog.id === "A006") return "electric_piano_1";
  if (prog.id === "A036") return "acoustic_grand_piano";
  if (name.includes("distortion") || name.includes("*dist") || prog.id === "A042") return "distortion_guitar";
  if (name.includes("feedback") || name.includes("overdrive") || prog.id === "A037") return "overdriven_guitar";
  if (name.includes("nylon") || (isGuitar && cat.includes("acoustic")) || prog.id === "B007") return "acoustic_guitar_nylon";
  if (isGuitar) return "electric_guitar_clean";
  if (isBass || cat.includes("bass")) return "synth_bass_1";

  // Trombone & Brass
  if (name.includes("trombone") || prog.id === "A030") return "trombone";
  if (name.includes("trumpet")) return "trumpet";
  if (cat.includes("brass") || name.includes("brass") || name.includes("horn")) return "brass_section";

  // Organs
  if (name.includes("dark jazz") || ifx.includes("rotary") || name.includes("b3")) return "drawbar_organ";
  if (name.includes("vox") || name.includes("rock organ") || prog.id === "A023") return "rock_organ";
  if (name.includes("church") || name.includes("cathedral organ")) return "church_organ";
  if (cat.includes("organ") || name.includes("organ")) return "drawbar_organ";

  // Pure Sine presets (Studio PCM Soundfonts)
  if (name.includes("sine whistler") || prog.id === "A046") return "pure_sine_lead";
  if (name.includes("smooth sine") || prog.id === "A010") return "pure_sine_lead";
  if (name.includes("sine sub") || prog.id === "A047") return "pure_sine_sub";
  if (name.includes("sine electric keys") || prog.id === "A048") return "warm_sine_keys";
  if (name.includes("sine bells") || prog.id === "A049") return "crystal_sine_bells";
  if (name.includes("sine flute") || prog.id === "A050") return "cosmic_sine_flute";
  if (name.includes("sine pad") || prog.id === "A051") return "deep_sine_pad";

  // Electric Pianos
  if (name.includes("phantom of tine") || prog.id === "A025") return "eos_tx816";
  if (name.includes("fm piano") || prog.id === "A043") return "abletunes_fm_piano";
  if (name.includes("r&b") || prog.id === "A015") return "eos_deeproads";
  if (name.includes("studio stage") || prog.id === "A020") return "electric_piano_1";
  if (name.includes("suit") || name.includes("stage ep") || prog.id === "A028") return "x5d_velo_roads";
  if (name.includes("super keys") || prog.id === "X5D_29") return "x5d_superkeys";
  if (name.includes("stereo keys") || prog.id === "X5D_28") return "x5d_stereo_keys";
  if (name.includes("dyno") || prog.id === "X5D_27") return "x5d_super_ep";
  if (name.includes("old roads") || prog.id === "YEOS02") return "eos_oldroads";
  if (name.includes("deep roads") || prog.id === "YEOS01") return "eos_deeproads";
  if (cat.includes("electric piano") || /\bep\b/i.test(cat) || /\bep\b/i.test(name) || name.includes("rhodes")) return "x5d_velo_roads";

  // Saxophones & Woodwinds
  if (name.includes("breathy") || name.includes("alto sax") || prog.id === "A026" || prog.id === "SAX02") return "alto_sax";
  if (name.includes("soprano")) return "soprano_sax";
  if (name.includes("tenor") || name.includes("blues growl")) return "tenor_sax";
  if (name.includes("harmonica") || prog.id === "A033") return "alto_sax";
  if (name.includes("flute") || cat.includes("flute")) return "flute";
  if (name.includes("clarinet") || cat.includes("clarinet")) return "clarinet";
  if (cat.includes("woodwind") || name.includes("sax")) return "alto_sax";

  // Pianos & Piano Pads
  if (name.includes("piano pad") || name.includes("icy piano") || prog.id === "A013" || prog.id === "A018") return "acoustic_grand_piano";
  if (name.includes("upright") || prog.id === "A044") return "abletunes_upright";
  if (cat.includes("piano") || cat.includes("keyboard")) return "acoustic_grand_piano";

  // Choirs & Strings
  if (cat.includes("choir") || cat.includes("vocal") || name.includes("choir") || name.includes("voice") || name.includes("vox") || name.includes("ooh") || name.includes("ahh")) return "choir_aahs";
  if (cat.includes("strings") || cat.includes("pad") || name.includes("chair of light") || prog.id === "A000") return "string_ensemble_1";

  // Miscellaneous
  if (name.includes("kalimba") || cat.includes("kalimba") || name.includes("mbira")) return "kalimba";
  if (cat.includes("percussion") || cat.includes("drum")) return "tr808_kit";
  return "acoustic_grand_piano";
}

// Resolve bank program -> either { type: "pcm", instKey } or { type: "va", prog }
export function resolveTritonProgram(prog) {
  if (!prog) return null;
  if (prog.m1Type) {
    return { type: "pcm", instKey: M1_INST[prog.m1Type] || resolvePcmByProgram(prog) };
  }
  if (prog.eosType) {
    const key = prog.instId || (prog.eosType.startsWith("eos_") ? prog.eosType : "eos_" + prog.eosType);
    return { type: "pcm", instKey: key };
  }
  if (prog.instId) {
    return { type: "pcm", instKey: prog.instId };
  }
  // Piano-family PADS with genuine oscillator data are synth voices, not
  // rompler piano samples (e.g. A013 "Piano Pad 2", A018 "Icy Piano Pad").
  // Routing them to the same grand-piano PCM made them identical to each
  // other; sending them to the VA engine gives each its own distinct voice.
  if ((prog.osc1 || prog.osc2) && /piano\s+pad|icy piano/i.test(prog.name || "")) {
    return { type: "va", prog };
  }
  // A030 "Trombone Hard" declares real sawtooth oscillators; route it to the
  // VA engine so it plays a punchy synth-brass trombone instead of the weak
  // generic soundfont sample (user-confirmed choice).
  if (prog.id === "A030" && (prog.osc1 || prog.osc2)) {
    return { type: "va", prog };
  }
  if (isSynthTimbre(prog)) {
    return { type: "va", prog };
  }
  return { type: "pcm", instKey: resolvePcmByProgram(prog) };
}

const TRITON_VA_PROGRAMS = [];
const TRITON_PCM_ENTRIES = [];
const TRITON_PROGRAMS_BY_ID = new Map();
const TRITON_BANK_NAME = {};

Object.entries(TRITON_BANKS).forEach(([bankId, bank]) => {
  TRITON_BANK_NAME[bankId] = bank.name;
  (bank.programs || []).forEach(prog => {
    const progWithBank = { ...prog, bank: bankId };
    TRITON_PROGRAMS_BY_ID.set(prog.id, progWithBank);
    const resolved = resolveTritonProgram(prog);
    if (resolved.type === "va") {
      TRITON_VA_PROGRAMS.push(progWithBank);
    } else {
      TRITON_PCM_ENTRIES.push({
        id: prog.id,
        instKey: resolved.instKey,
        name: prog.name,
        category: prog.category || bank.category || "Workstation",
        bank: bankId,
      });
    }
  });
});

export function getTritonProgramById(id) {
  return TRITON_PROGRAMS_BY_ID.get(id) || null;
}

export function getTritonBankName(bankId) {
  return TRITON_BANK_NAME[bankId] || bankId || "WORKSTATION";
}

export function getTritonPcmEntries() {
  return TRITON_PCM_ENTRIES;
}

export function getTritonVaPrograms() {
  return TRITON_VA_PROGRAMS;
}