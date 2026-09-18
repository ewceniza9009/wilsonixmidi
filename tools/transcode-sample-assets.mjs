/**
 * P1.6 — Transcode uncompressed sample assets (public/abletunes .pcm-as-WAV
 * and public/samples .wav) to lossless FLAC, verifying byte-identical PCM so
 * the conversion cannot change sample data (ground rule: sample contents must
 * not change — FLAC is lossless, so decoded PCM is bit-identical).
 *
 * Usage: node tools/transcode-sample-assets.mjs
 *   Default: converts unconditioned files, verifies each output decodes to the
 *   exact same PCM as the input (decode -> raw s24le -> SHA-256), then deletes
 *   the original. Idempotent: any file with a .flac sibling already present is
 *   assumed converted and its .pcm/.wav original is removed.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, statSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../public/", import.meta.url)).replace(/[\\/]+$/, "");
const DIRS = ["abletunes", "samples"];

const TRANSCODED_EXT = ".flac";

let convertedCount = 0;
let removedCount = 0;
let bytesBefore = 0;
let bytesAfter = 0;

function listAudioFiles(dir) {
  const full = join(ROOT, dir);
  try {
    const all = readdirSync(full, { recursive: true, withFileTypes: true });
    return all
      .filter((e) => e.isFile() && /\.(pcm|wav)$/i.test(e.name))
      .map((e) => join(e.parentPath ?? e.path, e.name));
  } catch {
    console.warn(`skip missing dir: ${full}`);
    return [];
  }
}

function probeFormat(path) {
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=format_name,duration", "-of", "default=nw=1", path],
      { encoding: "utf8" },
    );
    return out.trim().split("\n").join(" | ");
  } catch {
    return "probe-failed";
  }
}

function rawHash(path) {
  // Decode to packed s24le raw (identical for FLAC and the WAV/PCM sources) and
  // hash the stream. Equal hashes == bit-identical audio.
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", path, "-f", "s24le", "-acodec", "pcm_s24le", "-"],
    { encoding: null, maxBuffer: 1 << 30 },
  );
  return createHash("sha256").update(raw).digest("hex");
}

function transcode(file) {
  const outFile = file.replace(/\.(pcm|wav)$/i, TRANSCODED_EXT);
  const size = statSync(file).size;
  bytesBefore += size;

  if (statSync(outFile, { throwIfNoEntry: false })) {
    rmSync(file, { force: true });
    removedCount++;
    bytesAfter += statSync(outFile).size;
    console.log(`already-converted  ${file}`);
    return;
  }

  console.log(`ffmpeg -> ${outFile} (${(size / 1e6).toFixed(2)} MB)`);
  try {
    execFileSync(
      "ffmpeg",
      ["-v", "error", "-y", "-i", file, "-map", "0:a:0", "-c:a", "flac", "-compression_level", "12", outFile],
      { stdio: "ignore" },
    );
  } catch (err) {
    console.error(`FAILED transcode: ${file}\n${err}`);
    rmSync(outFile, { force: true });
    return;
  }

  const inHash = rawHash(file);
  const outHash = rawHash(outFile);
  if (inHash !== outHash) {
    console.error(`INTEGRITY MISMATCH (decoded PCM differs): ${file}\n  in=${inHash}\n  out=${outHash}`);
    rmSync(outFile, { force: true });
    return;
  }

  rmSync(file, { force: true });
  convertedCount++;
  bytesAfter += statSync(outFile).size;
  console.log(`  verified bit-identical (${probeFormat(outFile)})`);
}

for (const dir of DIRS) {
  for (const file of listAudioFiles(dir)) transcode(file);
}

console.log(
  `\nP1.6 transcode summary: ${convertedCount} converted, ${removedCount} already-converted originals removed. ` +
    `${(bytesBefore / 1e6).toFixed(1)} MB -> ${(bytesAfter / 1e6).toFixed(1)} MB ` +
    `(-${((1 - bytesAfter / bytesBefore) * 100).toFixed(1)}%)`,
);