/**
 * Estimates the fundamental of an anchor file with a harmonic product spectrum
 * (HPS), which is the standard defence against exactly the confusion that
 * tripped up two earlier checkers:
 *
 *   - NSDF (tools/verify-sc55-banks.mjs) can lock onto a subharmonic or a
 *     strong upper partial: it reads juno_lofi_ep/55 as 89 and /60 as 57,
 *     which cannot both be true, while other notes in the same file read fine.
 *   - "strongest local max" (the first spectrum checker) reports whichever
 *     partial is loudest, which for a weak fundamental is an upper harmonic --
 *     it flagged a known-good SC-55 anchor as broken.
 *
 * HPS multiplies the spectrum by its octaved-down copies, so only a frequency
 * whose octave, fifths and other harmonics are ALL present can win. A single
 * loud harmonic cannot, because its own harmonics are missing.
 *
 * usage: node tools/find-fundamental.mjs <file.mp3> [note] [peaks]
 *   note is optional; when given, the report says how far off it is in cents.
 */
import { execFileSync } from "node:child_process";

const NN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nn = (m) => NN[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
const toMidi = (hz) => 69 + 12 * Math.log2(hz / 440);
const toHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function decodeMp3(file) {
  const raw = execFileSync("ffmpeg",
    ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", "44100", "-"],
    { encoding: "buffer", maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}

/** HPS over the sustained body of a signal. Returns midi or null. */
export function hpsMidi(pcm, { N = 1 << 15, harmonics = 5, fmin = 40, fmax = 2500 } = {}) {
  if (!pcm || pcm.length < N * 0.5) return null;
  // Average over up to 4 windows across the signal so a single transient (or
  // a loop seam) cannot dominate the estimate.
  const step = Math.max(N, Math.floor((pcm.length - N) / 3));
  const starts = [];
  for (let s = 0; s + N <= pcm.length && starts.length < 4; s += step) starts.push(s);
  if (!starts.length) return null;

  const bins = N / 2;
  const avg = new Float64Array(bins);
  for (const start of starts) {
    let mean = 0;
    for (let i = 0; i < N; i++) mean += pcm[start + i];
    mean /= N;
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
      re[i] = (pcm[start + i] - mean) * w;
    }
    fft(re, im);
    for (let k = 0; k < bins; k++) avg[k] += Math.hypot(re[k], im[k]);
  }

  const binHz = 44100 / N;
  const kmin = Math.max(2, Math.floor(fmin / binHz));
  const kmax = Math.min(Math.floor(fmax / binHz), Math.floor(bins / harmonics));
  if (kmax <= kmin) return null;

  const scored = [];
  for (let k = kmin; k <= kmax; k++) {
    let p = 1;
    for (let h = 1; h <= harmonics; h++) p *= avg[k * h] + 1e-12;
    scored.push({ k, hz: k * binHz, score: Math.log(p) });
  }
  scored.sort((a, b) => b.score - a.score);
  return { midi: toMidi(scored[0].hz), hz: scored[0].hz, top: scored.slice(0, 6) };
}

export { fft, toMidi, toHz, nn };

function fft(x, y) {
  const n = x.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [x[i], x[j]] = [x[j], x[i]];
      [y[i], y[j]] = [y[j], y[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = x[i + k], ui = y[i + k];
        const vr = x[i + k + len / 2] * cr - y[i + k + len / 2] * ci;
        const vi = x[i + k + len / 2] * ci + y[i + k + len / 2] * cr;
        x[i + k] = ur + vr;
        y[i + k] = ui + vi;
        x[i + k + len / 2] = ur - vr;
        y[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// Run directly when invoked as a script (import.meta.main is not available on
// this Node build, so match on argv the way the bank builder does).
const isMain = process.argv[1] && /find-fundamental\.mjs$/.test(process.argv[1].replace(/\\/g, "/"));
if (isMain) {
  const [, , file, noteArg, peaksArg] = process.argv;
  if (!file) {
    console.error("usage: node tools/find-fundamental.mjs <file.mp3> [note] [peaks]");
    process.exit(1);
  }
  const pcm = decodeMp3(file);
  const r = hpsMidi(pcm);
  if (!r) { console.log(`${file}: could not estimate (signal too short/quiet)`); process.exit(0); }
  console.log(file);
  if (noteArg && /^\d+$/.test(noteArg)) {
    const note = Number(noteArg);
    const cents = (r.midi - note) * 100;
    const inTune = Math.abs(cents) <= 35;
    console.log(`  target ${nn(note)} (${note})  measured ${nn(r.midi)} (${r.midi.toFixed(2)})  ` +
      `${cents >= 0 ? "+" : ""}${cents.toFixed(0)}c  ${inTune ? "IN TUNE" : "OUT OF TUNE"}`);
  } else {
    console.log(`  measured ${nn(r.midi)} (${r.midi.toFixed(2)})`);
  }
  const top = Number(peaksArg || 5);
  console.log("  HPS candidates:");
  for (const c of r.top.slice(0, top))
    console.log(`    ${c.hz.toFixed(2).padStart(9)} Hz  ${nn(c.midi ?? toMidi(c.hz))}  score ${c.score.toFixed(1)}`);
}
