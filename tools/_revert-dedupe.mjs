/**
 * Undo the 15 instId repoints from tools/_dedupe.mjs — restore each preset to
 * the instrument it had in HEAD (the user's original good sounds).
 */
import fs from "node:fs";

const FILE = "src/triton/triton-soundbanks.js";

const RESTORE = [
  ["KX_LOFI_01", "juno_midnight_ep", "rhodes_stage_mp3"],
  ["KX_LOFI_02", "sc55_lofi_rhodes", "abletunes_upright"],
  ["KX_SAMBA_03", "sc55_samba_ep", "electric_piano_1"],
  ["E000", "sc55_vintage_ep", "eos_cp80"],
  ["E007", "sc55_soft_vibes", "eos_vibes"],
  ["YEOS33", "juno_jazz_guitar_2", "eos_jazz_guitar"],
  ["A015", "sc55_rnb_tine", "eos_deeproads"],
  ["E008", "sc55_deep_world", "eos_deeproads"],
  ["A025", "sc55_phantom_ep", "eos_tx816"],
  ["A028", "sc55_bright_ep", "x5d_velo_roads"],
  ["E003", "juno_jazz_bass", "eos_upright_bass"],
  ["D007", "sc55_acid_resonator", "eos_acid_bass"],
  ["B001", "sc55_techno_organ", "korg_techno_organ"],
  ["C006", "sc55_rave_stab", "edm_club_brass"],
  ["E018", "sc55_marsh_lead", "edm_trance_synth"],
];

let src = fs.readFileSync(FILE, "utf8");
let ok = 0;
const problems = [];

for (const [id, bad, good] of RESTORE) {
  const needle = `id: "${id}"`;
  let from = 0;
  let done = false;
  while (!done) {
    const at = src.indexOf(needle, from);
    if (at === -1) break;
    const win = src.slice(at, at + 600);
    const m = win.match(/instId: "([^"]+)"/);
    if (m && m[1] === bad) {
      const local = m.index;
      const abs = at + local;
      src = src.slice(0, abs) + `instId: "${good}"` + src.slice(abs + m[0].length);
      ok++;
      done = true;
      break;
    }
    from = at + needle.length;
    if (!m) problems.push(`${id}: no instId within block`);
  }
  if (!done) problems.push(`${id}: expected instId "${bad}" not found`);
}

fs.writeFileSync(FILE, src);
console.log(`restored: ${ok}/${RESTORE.length}`);
if (problems.length) console.log("PROBLEMS:\n" + problems.map((p) => "  " + p).join("\n"));
