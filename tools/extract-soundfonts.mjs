/**
 * P1 — Build-time binary soundfont extraction.
 *
 * Transforms each `public/soundfonts/<id>-mp3.js` JSONP soundfont
 * (MusyngKite/FluidR3: `MIDI.Soundfont.<id> = { "A0": "data:audio/mp3;base64,…" }`)
 * into:
 *   - `public/soundfonts-bin/<id>.pack` — every sample's raw MP3 bytes
 *     concatenated into one binary file (~25% smaller than the base64 source),
 *   - `public/soundfonts-bin/<id>.json` — manifest mapping each note to its
 *     byte offset/length inside the pack: `{ id, count, samples: [{ n, m, o, l }] }`.
 *
 * Why: the runtime JSONP pipeline cost a fetch of a 1.5–3MB text file, a
 * megabyte-scale JSON.parse on the main thread, and ~88 sequential `atob`
 * decodes per instrument selection (seconds on Android WebView). The binary
 * path is one fetch + `ArrayBuffer.slice` per sample with zero base64/JSON
 * work, and one IndexedDB cache entry per instrument instead of ~88.
 *
 * Safety: every entry is validated (base64 decodes cleanly, MP3 container
 * magic bytes, pack size == sum of lens) before the JSONP source is removed.
 * The JSONP files stay in git history and the loader falls back to them when
 * a pack is missing (see NativePcmEngine._loadSoundfontJsonp).
 *
 * Usage: node tools/extract-soundfonts.mjs   (run from the repo root)
 * Idempotent: instruments whose pack already exists are skipped.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SF_DIR = join(ROOT, "public", "soundfonts");
const OUT_DIR = join(ROOT, "public", "soundfonts-bin");

const NOTE_MAP = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

function noteNameToMidi(noteStr) {
  const match = noteStr.match(/^([A-G][b#]?)([0-9])$/);
  if (!match) return null;
  return (parseInt(match[2], 10) + 1) * 12 + NOTE_MAP[match[1]];
}

/**
 * Same extraction contract as NativePcmEngine.parseSoundfontJsonp: locate the
 * last `MIDI.Soundfont` marker, slice the object literal, strip JSON-illegal
 * trailing commas, parse as strict JSON.
 */
function parseSoundfontJsonp(text) {
  if (typeof text !== "string" || !text.includes("MIDI.Soundfont")) return null;
  const markerIdx = text.lastIndexOf("MIDI.Soundfont");
  const eqIdx = text.indexOf("= {", markerIdx);
  if (eqIdx < 0) return null;
  const start = text.indexOf("{", eqIdx);
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let json = text.slice(start, end + 1);
  json = json.replace(/,(\s*})/g, "$1");
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function looksLikeMp3(buf) {
  if (buf.length < 4) return false;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true; // "ID3"
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true; // MPEG frame sync
  return false;
}

function base64ToBuffer(dataUri) {
  const commaIdx = dataUri.indexOf(",");
  if (commaIdx < 0) throw new Error("data URI missing base64 payload");
  return Buffer.from(dataUri.slice(commaIdx + 1), "base64");
}

let extracted = 0;
let skipped = 0;
let bytesBefore = 0;
let bytesAfter = 0;
let failures = 0;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const jsonpFiles = existsSync(SF_DIR)
  ? readdirSync(SF_DIR).filter((f) => /-mp3\.js$/i.test(f))
  : [];

for (const file of jsonpFiles) {
  const instId = file.replace(/-mp3\.js$/i, "");
  const packPath = join(OUT_DIR, `${instId}.pack`);
  const manifestPath = join(OUT_DIR, `${instId}.json`);
  const srcPath = join(SF_DIR, file);

  // Idempotent: valid pack already extracted.
  if (existsSync(packPath) && existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (
        manifest &&
        manifest.count > 0 &&
        statSync(packPath).size === manifest.totalBytes
      ) {
        skipped++;
        bytesAfter += statSync(packPath).size;
        rmSync(srcPath, { force: true });
        continue;
      }
    } catch {
      // Corrupt/legacy manifest — fall through and re-extract.
    }
  }

  let samples;
  try {
    samples = parseSoundfontJsonp(readFileSync(srcPath, "utf8"));
  } catch (err) {
    console.error(`FAILED read/parse: ${file}\n${err}`);
    failures++;
    continue;
  }
  if (!samples) {
    console.error(`FAILED parse: ${file} (no MIDI.Soundfont payload)`);
    failures++;
    continue;
  }

  // Decode every entry, validate, and concatenate into the pack.
  const parts = [];
  const manifestSamples = [];
  let offset = 0;
  let badEntries = 0;
  for (const [noteName, dataUri] of Object.entries(samples)) {
    const midi = noteNameToMidi(noteName);
    if (midi === null) {
      badEntries++;
      continue;
    }
    let buf;
    try {
      buf = base64ToBuffer(dataUri);
    } catch (err) {
      console.error(`FAILED base64 decode: ${file}[${noteName}] ${err}`);
      badEntries++;
      continue;
    }
    if (!looksLikeMp3(buf)) {
      console.error(`FAILED magic check (not MP3): ${file}[${noteName}]`);
      badEntries++;
      continue;
    }
    parts.push(buf);
    manifestSamples.push({ n: noteName, m: midi, o: offset, l: buf.length });
    offset += buf.length;
  }

  if (manifestSamples.length === 0) {
    console.error(`FAILED: ${file} produced zero valid samples`);
    failures++;
    continue;
  }
  if (badEntries > 0) {
    console.warn(`warn: ${file} skipped ${badEntries} invalid entries`);
  }

  const pack = Buffer.concat(parts);
  writeFileSync(packPath, pack);
  writeFileSync(
    manifestPath,
    JSON.stringify({
      id: instId,
      count: manifestSamples.length,
      totalBytes: pack.length,
      samples: manifestSamples,
    }),
  );

  bytesBefore += statSync(srcPath).size;
  bytesAfter += pack.length;
  // Only remove the source after the pack + manifest are safely on disk and
  // the pack size matches the manifest total.
  if (statSync(packPath).size === pack.length) {
    rmSync(srcPath, { force: true });
    extracted++;
    console.log(
      `extracted ${instId}: ${manifestSamples.length} samples, ${(pack.length / 1e6).toFixed(2)} MB pack`,
    );
  } else {
    failures++;
    console.error(`FAILED pack write: ${packPath}`);
  }
}

console.log(
  `\nP1 soundfont extraction summary: ${extracted} extracted, ${skipped} already present, ${failures} failed. ` +
    `JSONP ${((bytesBefore / 1e6) || 0).toFixed(1)} MB -> pack ${(bytesAfter / 1e6).toFixed(1)} MB`,
);

if (failures > 0) process.exit(1);
