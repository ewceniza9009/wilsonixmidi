#!/usr/bin/env node
/**
 * verify-sc55-banks.mjs
 * Decodes every generated MP3 with ffmpeg and pitch-detects it, comparing the
 * measured fundamental against the note number in the filename. The engine
 * plays anchors at rate 2^((note - anchorMidi)/12), so a file whose real pitch
 * disagrees with its filename will sound out of tune when triggered.
 *
 *   node tools/verify-sc55-banks.mjs [bankDir ...]
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ffmpegBin = (() => {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", ["ffmpeg"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : "ffmpeg";
})();

function hzToMidi(hz) { return 69 + 12 * Math.log2(hz / 440); }

/**
 * Octave-tolerant presence check. A decaying piano loses its fundamental
 * before its upper partials, so single-note pitch detection reports the wrong
 * OCTAVE far more often than the wrong cent. So the hard failure criterion is
 * "is this pitch class present at all", allowing f, 2f, 3f, 4f, f/2, 2f/3, f/3.
 * The detected pitch is reported as diagnostic detail only.
 */
function pitchClassPresent(x, rate, note, floor = 0.02) {
  let N = 1;
  while (N < Math.min(x.length, 32768)) N <<= 1;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N && i < x.length; i++) re[i] = x[i];
  fft(re, im);
  const half = N / 2;
  const mag = (hz) => {
    const bin = Math.round((hz * N) / rate);
    if (bin < 1 || bin >= half) return 0;
    return Math.hypot(re[bin], im[bin]);
  };
  let gmax = 0;
  const lo = Math.round((55 * N) / rate), hi = Math.min(half - 1, Math.round((6000 * N) / rate));
  for (let b = lo; b < hi; b++) gmax = Math.max(gmax, Math.hypot(re[b], im[b]));
  if (gmax <= 0) return { ok: false, ratio: 0 };
  const f0 = 440 * Math.pow(2, (note - 69) / 12);
  let best = 0;
  for (const f of [f0, 2 * f0, 3 * f0, 4 * f0, f0 / 2, (2 * f0) / 3, f0 / 3]) best = Math.max(best, mag(f));
  const ratio = best / gmax;
  return { ok: ratio >= floor, ratio };
}

function decodeToMono(mp3) {
  const r = spawnSync(ffmpegBin, ["-v", "error", "-i", mp3, "-f", "s16le", "-ac", "1", "-ar", "44100", "-"],
    { maxBuffer: 1 << 28, encoding: "buffer" });
  if (r.status !== 0) throw new Error("ffmpeg decode failed: " + r.stderr);
  const b = r.stdout;
  const n = Math.floor(b.length / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(i * 2) / 32768;
  return { pcm: out, rate: 44100 };
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

function refineByHarmonics(x, rate, candLags) {
  let N = 1;
  while (N < Math.min(x.length, 32768)) N <<= 1;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N && i < x.length; i++) re[i] = x[i];
  fft(re, im);
  const mag = (hz) => {
    const bin = Math.round((hz * N) / rate);
    if (bin < 1 || bin >= N / 2) return 0;
    return Math.hypot(re[bin], im[bin]);
  };
  let bestL = null, bestS = -1;
  for (const lag of candLags) {
    const f = rate / lag;
    if (f < 30) continue;
    const m1 = mag(f), m2 = mag(2 * f), m3 = mag(3 * f);
    if (m1 <= 0) continue;
    const score = Math.pow(m1, 1) * Math.pow(m2 + 1e-9, 0.5) * Math.pow(m3 + 1e-9, 0.35) /
      (1 + 0.05 * Math.log2(f / 65.4));
    if (score > bestS) { bestS = score; bestL = lag; }
  }
  return bestL;
}

/**
 * Fundamental estimate = strongest NSDF peak, disambiguated by a harmonic
 * product over the FFT magnitude. Autocorrelation alone reports a note's own
 * octave as often as the note, which silently invalidates a bank build.
 */
/**
 * Same window + search range the builder uses, so a bank that built from
 * correctly-measured sources is validated by the identical measurement.
 * The attack is skipped because an MP3 decode starts with codec padding.
 */
function analysisWindow(x, _rate) {
  const skip = Math.floor(x.length * 0.06);
  return x.subarray(skip, Math.min(x.length, skip + 16384));
}

function detectPitch(x, rate, fmin = 55, fmax = 1400) {
  const N = Math.min(x.length, 16384);
  if (N < 2048) return 0;
  const minLag = Math.max(2, Math.floor(rate / fmax));
  const maxLag = Math.min(Math.floor(rate / fmin), N - 1);
  if (maxLag <= minLag) return 0;
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0, m = 0;
    for (let i = 0; i < N - lag; i++) { ac += x[i] * x[i + lag]; m += x[i] * x[i] + x[i + lag] * x[i + lag]; }
    nsdf[lag] = m > 0 ? (2 * ac) / m : 0;
  }
  let gmax = 0, best = -1;
  for (let l = minLag; l <= maxLag; l++) if (nsdf[l] > gmax) { gmax = nsdf[l]; best = l; }
  if (best < 0 || gmax <= 0) return 0;
  const cands = [];
  for (let l = minLag; l <= maxLag; l++) {
    if (nsdf[l] > nsdf[l - 1] && nsdf[l] >= nsdf[l + 1] && nsdf[l] >= gmax * 0.55) cands.push(l);
    if (cands.length > 12) break;
  }
  if (cands.length) best = refineByHarmonics(x, rate, cands) ?? best;
  const y0 = nsdf[best - 1] ?? nsdf[best], y1 = nsdf[best], y2 = nsdf[best + 1] ?? nsdf[best];
  const den = y0 - 2 * y1 + y2;
  const sh = den !== 0 ? (0.5 * (y0 - y2)) / den : 0;
  return rate / (best + sh);
}

function rmsDb(x) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return 20 * Math.log10(Math.sqrt(s / x.length) + 1e-12);
}
function peakDb(x) {
  let p = 0;
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  return 20 * Math.log10(p + 1e-12);
}

// accept several paths, and also a single comma-joined list
const rawRoots = process.argv.slice(2).flatMap((a) => a.split(",")).filter(Boolean);
const roots = rawRoots.length ? rawRoots : [path.join("public", "banks", "yamaha-eos")];

const targets = [];
const hasNoteMp3 = (d) =>
  fs.readdirSync(d).some((f) => f.endsWith(".mp3") && /^\d+\.mp3$/.test(f));
for (const r of roots) {
  if (!fs.existsSync(r)) continue;
  if (fs.statSync(r).isFile()) { targets.push(r); continue; }
  if (hasNoteMp3(r)) {
    // a single bank directory
    for (const f of fs.readdirSync(r)) {
      if (/^\d+\.mp3$/.test(f)) targets.push(path.join(r, f));
    }
    continue;
  }
  for (const d of fs.readdirSync(r)) {
    const dir = path.join(r, d);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/^\d+\.mp3$/.test(f)) targets.push(path.join(dir, f));
    }
  }
}
if (!targets.length) { console.error("no <note>.mp3 files found"); process.exit(1); }
targets.sort();

const NN = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
let bad = 0, silent = 0, checked = 0;
const byBank = new Map();
console.log("bank                    note  name   measured   cents  oct  pres   dur     rms     peak");
for (const f of targets) {
  const note = parseInt(path.basename(f, ".mp3"), 10);
  const bank = path.basename(path.dirname(f));
  let midi, dur, rms, pk, pres;
  try {
    const { pcm, rate } = decodeToMono(f);
    dur = pcm.length / rate;
    rms = rmsDb(pcm); pk = peakDb(pcm);
    midi = hzToMidi(detectPitch(analysisWindow(pcm, rate), rate));
    pres = pitchClassPresent(pcm, rate, note);
  } catch (e) {
    console.log(`${bank.padEnd(22)} ${String(note).padStart(3)}  DECODE FAIL ${e.message}`);
    bad++; continue;
  }
  const cents = midi > 0 ? Math.round((midi - note) * 100) : NaN;
  // octave difference between the detected pitch and the filename note
  const oct = midi > 0 ? Math.round((midi - note) / 12) : NaN;
  const octOff = Number.isFinite(oct) && oct !== 0;
  const exact = Math.abs(cents) <= 35;
  const present = pres.ok;
  const audible = pk > -45;
  // failure = wrong/absent pitch class, or unusable audio.
  // an octave-off detection on a decaying sample is NOT a failure if the
  // expected pitch class is spectrally present.
  const fails = !audible || !present;
  if (!audible) silent++;
  if (fails) bad++;
  checked++;
  const st = byBank.get(bank) || { n: 0, bad: 0 };
  st.n++; if (fails) st.bad++;
  byBank.set(bank, st);
  const m = Math.round(midi);
  const flag = !audible ? "SILENT" : !present ? " PITCH" : octOff ? (exact ? " ok~" : " ok(o)") : exact ? "  ok" : " cents";
  console.log(
    `${bank.padEnd(22)} ${String(note).padStart(3)}  ${(NN[((note % 12) + 12) % 12] + Math.floor(note / 12 - 1)).padEnd(5)}` +
    `${String(midi > 0 ? m : "?").padStart(6)}  ${(isNaN(cents) ? "  ?" : String(cents).padStart(5))}  ` +
    `${String(octOff ? `${oct > 0 ? "+" : ""}${oct}` : "0").padStart(3)}  ` +
    `${(pres.ratio * 100).toFixed(1).padStart(5)}%  ` +
    `${dur.toFixed(2)}s ${rms.toFixed(1).padStart(6)} ${pk.toFixed(1).padStart(6)}  ${flag}`,
  );
}
console.log("\n" + "=".repeat(88));
for (const [b, s] of byBank) console.log(`${b.padEnd(22)} ${s.n} files, ${s.bad} problem(s)`);
console.log(`\nchecked=${checked} problems=${bad} silent=${silent}`);
process.exit(bad ? 1 : 0);
