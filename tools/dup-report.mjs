/**
 * Genuine duplicate report: groups PCM instruments shared by two or more
 * DIFFERENT presets (same preset mirrored into another bank is an alias, not
 * a duplicate). Also groups VA programs whose oscillator parameters are
 * byte-identical.
 *
 * usage: node tools/dup-report.mjs
 */
import { TRITON_BANKS } from "../src/triton/triton-soundbanks.js";
import { resolveTritonProgram } from "../src/triton/combi-timbres.js";

const byInst = new Map();
const byVa = new Map();
const seenId = new Set();

for (const [bankId, bank] of Object.entries(TRITON_BANKS)) {
  for (const prog of bank.programs || []) {
    const r = resolveTritonProgram(prog);
    if (r.type !== "pcm") {
      const sig = JSON.stringify([
        prog.osc1, prog.osc2, prog.r1, prog.r2, prog.cutoff, prog.Q,
        prog.gain1, prog.gain2, prog.gain3, prog.attack, prog.decay,
        prog.sustain, prog.release,
      ]);
      if (!byVa.has(sig)) byVa.set(sig, new Map());
      byVa.get(sig).set(prog.id, { id: prog.id, name: prog.name, bank: bankId });
      continue;
    }
    if (!byInst.has(r.instKey)) byInst.set(r.instKey, new Map());
    const m = byInst.get(r.instKey);
    if (!m.has(prog.id)) m.set(prog.id, { id: prog.id, name: prog.name, bank: bankId });
    seenId.add(prog.id);
  }
}

const pcmDupes = [...byInst].filter(([, m]) => m.size > 1)
  .sort((a, b) => b[1].size - a[1].size);
const vaDupes = [...byVa].filter(([, m]) => m.size > 1);

const presetsAffected = pcmDupes.reduce((n, [, m]) => n + m.size, 0);
console.log(`distinct presets: ${seenId.size}`);
console.log(`PCM instruments shared by 2+ DIFFERENT presets: ${pcmDupes.length}  (affecting ${presetsAffected} presets)`);
console.log(`VA presets with identical oscillator settings: ${vaDupes.length}\n`);

for (const [inst, m] of pcmDupes) {
  console.log(`${inst}  ->  ${m.size} presets`);
  for (const p of m.values()) console.log(`    ${p.id.padEnd(10)} ${p.name}`);
  console.log("");
}
if (vaDupes.length) {
  console.log("--- identical VA voices ---");
  for (const [, m] of vaDupes) {
    console.log([...m.values()].map((p) => `${p.id} ${p.name}`).join("  ==  "));
  }
}
