/**
 * Resolves every instId in src/triton/triton-soundbanks.js through the same
 * ownership + anchor logic the runtime uses, and reports which ids would be
 * silent. Juno/sc55 ids must resolve to a real file on disk.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// pull the bank map out of the module without executing app code
const mod = await import(pathToFileURL(path.resolve("src/audio/yamaha-eos-pcm-data.js")).href);
const BANKS = mod.YAMHAHA_EOS_BANKS || Object.values(mod).find((v) => v && typeof v === "object" && !Array.isArray(v) && Object.values(v)[0]?.anchors);

const src = fs.readFileSync("src/triton/triton-soundbanks.js", "utf8");
const ids = [...src.matchAll(/instId: "([^"]+)"/g)].map((m) => m[1]);

const korg = new Set(["acoustic_grand_piano","electric_piano_1","string_ensemble_1","drawbar_organ","alto_sax","brass_section","choir_aahs"]);
function owner(i) {
  if (korg.has(i)) return "korg";
  if (/^(eos_|tekk_|sc55_|juno_)/.test(i)) return "yamaha";
  if (/^(edm_|omega_|jns_)/.test(i) || i === "korg_techno_organ") return "user";
  return null;
}

const seen = new Map();
for (const inst of ids) {
  const o = owner(inst);
  if (o !== "yamaha") { seen.set(inst, seen.get(inst) || "non-yamaha"); continue; }
  const b = BANKS[inst];
  if (!b) { seen.set(inst, "NO-BANK"); continue; }
  const missing = Object.values(b.anchors).filter((p) => !fs.existsSync(path.join("public", p)));
  seen.set(inst, missing.length ? `${missing.length} MISSING FILES` : "ok");
}

const tally = {};
for (const v of seen.values()) tally[v] = (tally[v] || 0) + 1;
console.log("distinct instIds:", seen.size);
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`);

const bad = [...seen].filter(([, v]) => v !== "ok" && v !== "non-yamaha");
console.log(bad.length ? "\nBROKEN:\n" + bad.map(([k, v]) => `  ${k}: ${v}`).join("\n") : "\nno broken yamaha bank references");
