/**
 * True duplicate report.
 *
 * The earlier scan only counted explicit `instId` fields and concluded there
 * were 15 duplicates. It was wrong: most presets have no instId at all — they
 * fall through resolvePcmByProgram()'s name/category cascade and collapse onto
 * one of ~30 PCM instruments at resolution time (A036 "Velo Piano ST" is
 * hardcoded to acoustic_grand_piano, so it plays the identical audio to
 * KX_STUDIO_01 "X5D Studio Grand 96k"). This resolves every program the way
 * the engine actually does, then groups by the resulting instrument.
 *
 * usage: node tools/true-duplicates.mjs
 */
import { TRITON_BANKS } from "../src/triton/triton-soundbanks.js";
import { resolveTritonProgram } from "../src/triton/combi-timbres.js";

const groups = new Map();
let total = 0, va = 0;

for (const [bankId, bank] of Object.entries(TRITON_BANKS)) {
  for (const prog of bank.programs || []) {
    const r = resolveTritonProgram(prog);
    total++;
    if (r.type !== "pcm") { va++; continue; }
    const key = r.instKey;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id: prog.id, name: prog.name, bank: bankId });
  }
}

const dupes = [...groups].filter(([, v]) => v.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

console.log(`programs: ${total}   (VA/synth: ${va}   PCM: ${total - va})`);
console.log(`distinct PCM instruments used: ${groups.size}`);
console.log(`INSTRUMENTS PLAYED BY 2+ PROGRAMS: ${dupes.length}\n`);

for (const [inst, list] of dupes) {
  console.log(`${inst}  ->  ${list.length} programs`);
  for (const p of list) console.log(`    ${p.id.padEnd(10)} ${p.name}   [${p.bank}]`);
}
