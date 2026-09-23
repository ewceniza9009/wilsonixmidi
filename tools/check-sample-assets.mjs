/**
 * P1.6 — Build-time guard for uncompressed sample assets.
 *
 * Fails the build (exit 1) if:
 *   1. Any .wav/.pcm remains under public/abletunes or public/samples
 *      (re-introduction guard — these must be FLAC, see transcode-sample-assets.mjs).
 *   2. Any sample file referenced by the audio manifests / pads / groove tracks
 *      is missing from public/.
 *   3. Any extracted soundfont pack manifest (public/soundfonts-bin/*.json) is
 *      missing its .pack sibling or the pack size disagrees with the manifest
 *      totalBytes (re-introduction guard — the runtime prefers binary packs,
 *      see extract-soundfonts.mjs / NativePcmEngine._loadSoundfontPack).
 *
 * Usage: node tools/check-sample-assets.mjs   (run from the repo root)
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { ABLETUNES_BANKS } from "../src/audio/abletunes-manifest.js";
import { BLOOM_EDM_BANKS } from "../src/audio/bloom-edm-manifest.js";
import { ANIMAL_EDM_BANKS } from "../src/audio/animal-edm-manifest.js";
import { MULTISAMPLE_BANKS } from "../src/audio/multisample-manifest.js";

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

// Imported multisample banks: every sample file must exist.
checkManifest("multisample", MULTISAMPLE_BANKS, (e) => `${e.path.replace(/^\/+/, "")}/${e.f}`);

// Soundfont binary packs: every manifest needs a valid, size-matched pack.
// public/soundfonts-bin must exist (the JSONP fallback is gone from the tree).
const SF_BIN = join(PUBLIC, "soundfonts-bin");
if (!existsSync(SF_BIN)) {
  errors.push("soundfonts-bin missing: run tools/extract-soundfonts.mjs (packs are the only soundfont source now)");
} else {
  for (const entry of readdirSync(SF_BIN)) {
    if (!/\.json$/i.test(entry)) continue;
    const manifestPath = join(SF_BIN, entry);
    const packPath = manifestPath.replace(/\.json$/i, ".pack");
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (!existsSync(packPath)) {
        errors.push(`soundfont pack missing: ${entry.replace(/\.json$/i, ".pack")}`);
        continue;
      }
      if (manifest.totalBytes !== statSync(packPath).size) {
        errors.push(`soundfont pack size mismatch for ${entry}: manifest ${manifest.totalBytes} != ${statSync(packPath).size}`);
      }
    } catch (err) {
      errors.push(`soundfont manifest unreadable: ${entry} (${err.message})`);
    }
  }
}

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