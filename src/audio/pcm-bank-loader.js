/**
 * Lazy loader for the three embedded PCM bank data modules.
 * The raw source of these modules is ~57MB of base64; importing them all
 * dynamically keeps that payload off the startup parse, loading each bank
 * chunk only when an instrument from it is first needed (or prewarmed).
 *
 * All reads go through bankData(name) (sync, already-loaded) or
 * ensureBankForInst(instId) (async, loads + caches the owning bank).
 *
 * ensureBankForInst resolves ownership by cheap id predicates before any
 * module loads, so a soundfont/EOS/user-miss id (e.g. "flute") never causes
 * the heavy yamaha/user chunks to be parsed just to test membership.
 */

const bankLoaders = {
  korg: () => import("./korg-pcm-data.js"),
  yamaha: () => import("./yamaha-eos-pcm-data.js"),
  user: () => import("./user-bank-pcm-data.js"),
};

// KORG holds exactly these 7 General-MIDI instruments.
const KORG_IDS = new Set([
  "acoustic_grand_piano",
  "electric_piano_1",
  "string_ensemble_1",
  "drawbar_organ",
  "alto_sax",
  "brass_section",
  "choir_aahs",
]);

function ownerBankName(instId) {
  if (typeof instId !== "string" || !instId) return null;
  if (KORG_IDS.has(instId)) return "korg";
  if (instId.startsWith("eos_") || instId.startsWith("tekk_")) return "yamaha";
  if (
    instId.startsWith("edm_") ||
    instId.startsWith("omega_") ||
    instId.startsWith("jns_") ||
    instId === "korg_techno_organ"
  )
    return "user";
  return null;
}

const state = { korg: null, yamaha: null, user: null };
const inflight = {};

function load(name) {
  if (state[name]) return Promise.resolve(state[name]);
  if (!inflight[name]) {
    inflight[name] = bankLoaders[name]()
      .then((mod) => {
        const bank =
          name === "korg"
            ? mod.KORG_PCM_BANKS
            : name === "yamaha"
              ? mod.YAMAHA_EOS_PCM_BANKS
              : mod.USER_BANK_PCM_BANKS;
        state[name] = bank;
        return bank;
      })
      .catch((err) => {
        inflight[name] = null;
        throw err;
      });
  }
  return inflight[name];
}

export function bankData(name) {
  return state[name] || null;
}

export function isBankLoaded(name) {
  return !!state[name];
}

export function prewarmBank(name) {
  return load(name);
}

export async function ensureBankForInst(instId) {
  // Cheap ownership check first — loads only the bank that could own this id.
  const owner = ownerBankName(instId);
  if (owner) {
    const bank = await load(owner);
    if (bank[instId]) return bank;
  }
  // Conservative fallback (id/predicate drift): sweep every bank exactly like
  // the historical korg -> yamaha -> user order. Never reached for ids that
  // match no predicate.
  for (const name of ["korg", "yamaha", "user"]) {
    const bank = await load(name);
    if (bank[instId]) return bank;
  }
  return null;
}