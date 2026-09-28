/**
 * Reports the tuning distribution of every anchor file, separated by bank
 * family, using the same pitch detector as verify-sc55-banks.mjs.
 *
 * The existing verifier only counts SILENT and missing-partial files as
 * "problems"; a file that is audibly in tune but sharp/flat prints the status
 * "cents" and does NOT fail the run. That is fine for a 20-cent wobble but
 * not for -307 cents (3 semitones), so this reports the real distribution.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = "public/banks/yamaha-eos";
const NN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const name = (n) => NN[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);

const banks = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const fams = {
  juno: banks.filter((b) => b.startsWith("juno_")),
  sc55: banks.filter((b) => b.startsWith("sc55_")),
  other: banks.filter((b) => !b.startsWith("juno_") && !b.startsWith("sc55_")),
};

for (const [fam, list] of Object.entries(fams)) {
  if (!list.length) continue;
  let out = "";
  try {
    out = execFileSync(
      "node",
      ["tools/verify-sc55-banks.mjs", ...list.map((b) => path.join(ROOT, b))],
      { encoding: "utf8", maxBuffer: 1 << 28 }
    );
  } catch (err) {
    // The verifier exits 1 on pre-existing problem banks but still prints every
    // per-file row to stdout; only the exit code is lost.
    out = err.stdout || "";
  }
  const rows = [];
  for (const line of out.split("\n")) {
    const m = line.match(/^(\S+)\s+(\d+)\s+\S+\s+(\d+|\?)\s+(-?\d+)\s+(-?\d+)\s/);
    if (!m) continue;
    rows.push({ bank: m[1], note: +m[2], midi: m[3] === "?" ? null : +m[3], cents: +m[4], oct: +m[5] });
  }
  // Octave-off readings are already tolerated by the project (status "ok(o)"):
  // the detector locks onto a subharmonic, not a wrong note. Only same-octave
  // deviation is a real tuning defect.
  const off = rows.filter((r) => r.oct !== 0);
  const sameOct = rows.filter((r) => r.oct === 0);
  const badSameOct = sameOct.filter((r) => Math.abs(r.cents) > 35).sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
  console.log(`\n=== ${fam}: ${list.length} banks, ${rows.length} anchors ===`);
  console.log(`  octave-off (tolerated "ok(o)"): ${off.length}`);
  console.log(`  same-octave, |cents|<=35      : ${sameOct.filter((r) => Math.abs(r.cents) <= 35).length}`);
  console.log(`  same-octave, |cents|>35  BAD  : ${badSameOct.length}`);
  if (badSameOct.length) {
    console.log("  offenders:");
    for (const r of badSameOct)
      console.log(`    ${r.bank.padEnd(22)} file=${String(r.note).padStart(3)}${name(r.note).padEnd(3)} measured=${String(r.midi).padStart(4)} ${String(r.cents).padStart(6)}c`);
  }
}
