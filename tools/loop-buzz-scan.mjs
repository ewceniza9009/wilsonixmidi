/**
 * Scans rendered anchors for loop-seam buzz and reports it per bank.
 *
 * The symptom this was written for (Pf:LoFi Piano sounding broken) showed up as
 * a strong sub-audio component whose frequency tracks the note exactly -- the
 * loop seam firing once per non-integer-cycle loop. Every pitch detector in the
 * repo was fooled by that stack of harmonics, so counting "out of tune" notes
 * said nothing about whether a bank is usable. This measures the defect
 * directly: energy below 100 Hz, and how loud the rumble is against the note's
 * own strongest partial.
 *
 * usage:
 *   node tools/loop-buzz-scan.mjs                 # every bank in the registry
 *   node tools/loop-buzz-scan.mjs juno_lofi_ep     # one bank
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyse, decode } from "./anchor-health.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const banksDir = path.join(root, "public", "banks", "yamaha-eos");

function anchorsOf(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /^\d+\.mp3$/.test(f))
    .map((f) => Number(f.slice(0, -4)))
    .sort((a, b) => a - b);
}

const only = process.argv[2];
const banks = fs.readdirSync(banksDir)
  .filter((n) => fs.statSync(path.join(banksDir, n)).isDirectory())
  .filter((n) => !only || n === only)
  .sort();

const rows = [];
for (const bank of banks) {
  const dir = path.join(banksDir, bank);
  const anchors = anchorsOf(dir);
  if (!anchors.length) continue;
  let low = 0, rumble = 0, worst = -Infinity, n = 0, silent = 0;
  for (const note of anchors) {
    const file = path.join(dir, `${note}.mp3`);
    let pcm;
    try { pcm = decode(file); } catch { silent++; continue; }
    const r = analyse(pcm);
    if (!r) { silent++; continue; }
    low += r.lowRatio;
    rumble += r.rumbleDb;
    if (r.rumbleDb > worst) worst = r.rumbleDb;
    n++;
  }
  if (!n) continue;
  rows.push({
    bank, n, silent,
    low: (low / n) * 100,
    rumble: rumble / n,
    worst,
    anchors: anchors.join(","),
  });
}

rows.sort((a, b) => b.low - a.low);

const hdr = ["bank", "n", "low%", "rumble_dB", "worst_dB", "silent", "anchors"];
const cells = rows.map((r) => [
  r.bank, String(r.n), r.low.toFixed(1),
  (r.rumble >= 0 ? "+" : "") + r.rumble.toFixed(1),
  (r.worst >= 0 ? "+" : "") + r.worst.toFixed(1),
  String(r.silent), r.anchors,
]);
const w = hdr.map((h, i) => Math.max(h.length, ...cells.map((c) => c[i].length)));
const line = (c) => c.map((v, i) => v.padEnd(w[i])).join("  ");
console.log(line(hdr));
for (const c of cells) {
  // Mark banks whose average rumble sits at or above the note peak; those are
  // the ones a listener will actually notice, not just the ones a detector trips on.
  const bad = Number(c[3].replace("+", "")) >= 0;
  console.log(line(c) + (bad ? "   <-- rumble >= note" : ""));
}
