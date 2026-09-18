/**
 * P1.6 — Build-time guard for uncompressed sample assets.
 *
 * Fails the build (exit 1) if:
 *   1. Any .wav/.pcm remains under public/abletunes or public/samples
 *      (re-introduction guard — these must be FLAC, see transcode-sample-assets.mjs).
 *   2. Any sample file referenced by the audio manifests / pads / groove tracks
 *      is missing from public/.
 *
 * Usage: node tools/check-sample-assets.mjs   (run from the repo root)
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { ABLETUNES_BANKS } from "../src/audio/abletunes-manifest.js";
import { BLOOM_EDM_BANKS } from "../src/audio/bloom-edm-manifest.js";
import { ANIMAL_EDM_BANKS } from "../src/audio/animal-edm-manifest.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PUBLIC = join(ROOT, "public");
const SOURCE_DIRS = ["abletunes", "samples"];
const SRC_SCAN_FILES = [
  "src/components/groove-player-ui.js",
  "src/audio/sample-groove-player.js",
  "src/audio/synthesizer-you-samples.js",
];

const errors = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

for (const sub of SOURCE_DIRS) {
  const dir = join(PUBLIC, sub);
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (/\.(wav|pcm)$/i.test(file)) {
      errors.push(`uncompressed audio found (must be .flac): ${file.replace(ROOT, "")}`);
    }
  }
}

function checkManifest(tag, samples, resolveFile) {
  for (const [key, entry] of Object.entries(samples)) {
    const rel = resolveFile(entry);
    if (!rel) continue;
    const full = join(PUBLIC, ...rel.split("/"));
    if (!existsSync(full) || !statSync(full).isFile()) {
      errors.push(`${tag}[${key}] references missing file: ${rel}`);
    }
  }
}

for (const [bankKey, bank] of Object.entries(ABLETUNES_BANKS)) {
  for (const sample of bank.samples || []) {
    const rel = `${bank.path.replace(/^\/+/, "")}/${sample.f}`;
    const full = join(PUBLIC, ...rel.split("/"));
    if (!existsSync(full) || !statSync(full).isFile()) {
      errors.push(`abletunes[${bankKey}] ${sample.f} missing: ${rel}`);
    }
  }
}
checkManifest("bloom", BLOOM_EDM_BANKS, (e) => `samples/bloom_edm/${e.file}`);
checkManifest("animal", ANIMAL_EDM_BANKS, (e) => `samples/animal_edm/${e.file}`);

for (const rel of SRC_SCAN_FILES) {
  const text = readFileSync(join(ROOT, rel), "utf8");
  const refs = [...text.matchAll(/["'`]\/?(samples\/[^"'`]+?\.flac)["'`]/g)].map((m) => m[1]);
  for (const ref of new Set(refs)) {
    const full = join(PUBLIC, ...ref.replace(/^\/+/, "").split("/"));
    if (!existsSync(full)) {
      errors.push(`${rel} references missing file: ${ref}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`P1.6 asset check FAILED (${errors.length}):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log("P1.6 asset check OK: no uncompressed audio, all referenced samples present.");