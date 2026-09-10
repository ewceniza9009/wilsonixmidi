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
  epiano: "electric_piano_1",
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

// Mirror of applyTritonProgram(): trait of a VA oscillator program
function isSynthTimbre(prog) {
  const cat = (prog.category || "").toLowerCase();
  const name = (prog.name || "").toLowerCase();
  const hasOsc = !!prog.osc1 || !!prog.osc2;
  return (
    hasOsc &&
    (cat.includes("lead") ||
      cat.includes("fast synth") ||
      cat.includes("synthesizer") ||
      cat.includes("motion") ||
      cat.includes("synth pad") ||
      cat.includes("hit") ||
      cat.includes("stab") ||
      cat.includes("bells & pad") ||
      cat.includes("bells") ||
      cat.includes("electric piano") ||
      cat.includes("organ") ||
      cat.includes("strings") ||
      cat.includes("bass & sub") ||
      name.includes("trance") ||
      name.includes("lead") ||
      name.includes("saw") ||
      name.includes("scream") ||
      name.includes("sweeper") ||
      name.includes("vox") ||
      name.includes("throats") ||
      name.includes("techno") ||
      name.includes("hypersaw") ||
      name.includes("synth") ||
      name.includes("tine") ||
      name.includes("rhodes") ||
      name.includes("r&b") ||
      name.includes("fm piano"))
  );
}

// Mirror of applyTritonProgram() category/name -> PCM instKey cascade
function resolvePcmByProgram(prog) {
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
  if (cat.includes("organ") || name.includes("organ") || ifx.includes("rotary")) return "drawbar_organ";
  if (cat.includes("electric piano") || cat.includes("ep") || name.includes("ep") || name.includes("tine") || name.includes("r&b") || name.includes("fm piano")) return "electric_piano_1";
  if (name.includes("kalimba") || cat.includes("kalimba") || name.includes("mbira")) return "kalimba";
  if (name.includes("flute") || cat.includes("flute")) return "flute";
  if (name.includes("clarinet") || cat.includes("clarinet")) return "clarinet";
  if (cat.includes("woodwind") || name.includes("sax") || name.includes("harmonica")) return "alto_sax";
  if (cat.includes("brass") || name.includes("brass") || name.includes("trombone")) return "brass_section";
  if (cat.includes("lead") || cat.includes("fast synth") || cat.includes("synthesizer") || cat.includes("hit") || name.includes("lead") || name.includes("trance") || name.includes("saw")) return "brass_section";
  if (cat.includes("choir") || cat.includes("vocal") || name.includes("choir") || name.includes("voice") || name.includes("vox") || name.includes("ooh") || name.includes("ahh")) return "choir_aahs";
  if (cat.includes("strings") || cat.includes("pad")) return "string_ensemble_1";
  if (cat.includes("percussion") || cat.includes("drum")) return "tr808_kit";
  if (cat.includes("piano") || cat.includes("keyboard")) return "acoustic_grand_piano";
  return "acoustic_grand_piano";
}

// Resolve bank program -> either { type: "pcm", instKey } or { type: "va", prog }
export function resolveTritonProgram(prog) {
  if (!prog) return null;
  if (prog.m1Type) {
    return { type: "pcm", instKey: M1_INST[prog.m1Type] || resolvePcmByProgram(prog) };
  }
  if (prog.instId) {
    return { type: "pcm", instKey: prog.instId };
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
    const resolved = resolveTritonProgram(prog);
    if (resolved.type === "va") {
      TRITON_VA_PROGRAMS.push({ ...prog, bank: bankId });
      TRITON_PROGRAMS_BY_ID.set(prog.id, { ...prog, bank: bankId });
    } else {
      TRITON_PCM_ENTRIES.push({
        id: prog.id,
        instKey: resolved.instKey,
        name: prog.name,
        category: prog.category || bank.category || "Triton",
        bank: bankId,
      });
    }
  });
});

export function getTritonProgramById(id) {
  return TRITON_PROGRAMS_BY_ID.get(id) || null;
}

export function getTritonBankName(bankId) {
  return TRITON_BANK_NAME[bankId] || bankId || "TRITON";
}

export function getTritonPcmEntries() {
  return TRITON_PCM_ENTRIES;
}

export function getTritonVaPrograms() {
  return TRITON_VA_PROGRAMS;
}