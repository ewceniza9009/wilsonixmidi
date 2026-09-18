/**
 * Extract embedded PCM bank anchors (data:audio/mp3;base64,…) to real .mp3
 * asset files under public/banks/<bank>/<instId>/<midi>.mp3, and rewrite the
 * three bank data modules so each anchor holds an asset path instead of an
 * inline base64 string.
 *
 * The bytes exported are byte-identical to the inline payloads, so decoded
 * PCM is bit-identical. Runtime now fetches the .mp3 and decodes on first use,
 * which removes ~57MB of base64 strings from module memory at steady state
 * (P1.2 of FIX_PLAN_09_18_26.md).
 *
 * Usage: node tools/extract-pcm-banks.mjs
 * Idempotent: anchors already pointing at asset paths are left untouched.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const BANKS = [
  { src: "src/audio/korg-pcm-data.js", dir: "korg", module: "KORG_PCM_BANKS" },
  { src: "src/audio/yamaha-eos-pcm-data.js", dir: "yamaha-eos", module: "YAMAHA_EOS_PCM_BANKS" },
  { src: "src/audio/user-bank-pcm-data.js", dir: "user-bank", module: "USER_BANK_PCM_BANKS" },
];

const DATA_PREFIX = "data:audio/mp3;base64,";

async function extractBank(cfg) {
  const srcPath = join(root, cfg.src);
  const moduleText = await readFile(srcPath, "utf8");

  // Reload the module with a cache-busting query so re-runs see current bytes.
  const modUrl = new URL(`file://${srcPath.replace(/\\/g, "/")}?t=${Date.now()}`);
  const bank = (await import(modUrl.href))[cfg.module];
  if (!bank) throw new Error(`Missing export ${cfg.module} in ${cfg.src}`);

  const bankRoot = join(root, "public", "banks", cfg.dir);
  const byValue = new Map();
  let written = 0;

  for (const instId of Object.keys(bank)) {
    const anchors = bank[instId] && bank[instId].anchors
      ? bank[instId].anchors
      : {};
    for (const midi of Object.keys(anchors)) {
      const value = String(anchors[midi]);
      if (!value.startsWith(DATA_PREFIX)) continue;
      if (byValue.has(value)) continue;
      const base64 = value.slice(DATA_PREFIX.length);
      const bytes = Buffer.from(base64, "base64");
      if (bytes.toString("base64") !== base64) {
        throw new Error(`Base64 round-trip mismatch for ${cfg.dir}/${instId}/${midi}`);
      }
      const instDir = join(bankRoot, instId);
      await mkdir(instDir, { recursive: true });
      await writeFile(join(instDir, `${midi}.mp3`), bytes);
      byValue.set(value, `banks/${cfg.dir}/${instId}/${midi}.mp3`);
      written++;
    }
  }

  if (written === 0) {
    console.log(`${cfg.module}: no inline anchors to extract (already extracted)`);
    return 0;
  }

  let next = moduleText;
  for (const [value, path] of byValue) {
    const needle = `"${value}"`;
    if (!next.includes(needle)) {
      throw new Error(`Source value not found for path ${path} in ${cfg.src}`);
    }
    next = next.split(needle).join(`"${path}"`);
  }

  await writeFile(srcPath, next);
  console.log(`${cfg.module}: extracted ${written} anchors into ${bankRoot}`);
  return written;
}

let total = 0;
for (const cfg of BANKS) {
  total += await extractBank(cfg);
}
console.log(`PCM bank extraction complete: ${total} anchors exported.`);