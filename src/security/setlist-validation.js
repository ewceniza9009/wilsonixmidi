/**
 * Pure setlist/registration shape validation. No DOM, no browser globals —
 * safe to import from unit tests (node:test) and from the Tauri webview.
 */

export const BANK_KEYS = ["A", "B", "C", "D"];
export const BANK_SLOT_TYPES = new Set(["single", "combi", "triton_va"]);

export function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function isValidSlot(slot) {
  if (!isPlainObject(slot)) return false;
  if (slot.slot != null && (typeof slot.slot !== "number" || !Number.isInteger(slot.slot) || slot.slot < 1)) return false;
  if (slot.type != null && (typeof slot.type !== "string" || !BANK_SLOT_TYPES.has(slot.type))) return false;
  if (slot.name != null && (typeof slot.name !== "string" || slot.name.length > 200)) return false;
  if (slot.savedAt != null && typeof slot.savedAt !== "string") return false;
  for (const k of ["splitPointMidi", "masterOctave"]) {
    if (slot[k] != null && (typeof slot[k] !== "number" || !Number.isFinite(slot[k]))) return false;
  }
  for (const k of ["isCombiMode", "isSplitMode", "isTritonVaMode"]) {
    if (slot[k] != null && typeof slot[k] !== "boolean") return false;
  }
  for (const k of ["activeCombiId", "activeSingleInst", "synthPatchId", "instId", "synth", "tritonProgId"]) {
    if (slot[k] != null && typeof slot[k] !== "string") return false;
  }
  if (slot.layers != null && (
    !Array.isArray(slot.layers) || slot.layers.length > 32 || !slot.layers.every(l => isPlainObject(l))
  )) return false;
  if (slot.splitZones != null && !isPlainObject(slot.splitZones)) return false;
  if (slot.tritonProg != null && !isPlainObject(slot.tritonProg)) return false;
  return true;
}

export function isValidBanksShape(parsed) {
  if (!isPlainObject(parsed)) return false;
  if (!BANK_KEYS.every(k => Array.isArray(parsed[k]))) return false;
  const total = BANK_KEYS.reduce((n, k) => n + parsed[k].length, 0);
  if (total < 1 || total > 256) return false;
  return BANK_KEYS.every(k => parsed[k].every(isValidSlot));
}