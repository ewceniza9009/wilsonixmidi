/**
 * Ground-truth spectral check for a single anchor file.
 *
 * Both tools that came before this one gave answers I could not trust:
 *   - tools/verify-sc55-banks.mjs uses NSDF, which on the harmonically rich
 *     Juno waveforms can report nonsense (it reads note 55 as 89, three
 *     octaves up, while reporting other notes in the same file as flat).
 *   - the first FFT checker binned a Goertzel transform only at semitone
 *     centres, so it compared quantised bins rather than real local peaks and
 *     flagged an SC-55 file as broken when the verifier called it in tune.
 *
 * This one takes a plain radix-2 FFT over a long window, parabolically
 * interpolates each spectral peak for sub-bin accuracy, and prints the top N
 * peaks with their MIDI values. The truth for "does file 64 actually play E4"
 * is then visible directly: if the strongest low partial sits at MIDI 64, the
 * file is right and the NSDF detector is wrong.
 *
 * usage: node tools/spectrum-peek.mjs <file.mp3> [peakCount]
 */
import { execFileSync } from "node:child_process";

const file = process.argv[2];
const wantPeaks = Number(process.argv[3] || 8);
if (!file) {
  console.error("usage: node tools/spectrum-peek.mjs <file.mp3> [peaks]");
  process.exit(1);
}

const NN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nn = (m) => NN[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const toMidi = (hz) => 69 + 12 * Math.log2(hz / 440);

const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", "44100", "-"],
  { encoding: "buffer", maxBuffer: 1 << 28 });
const pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);

// Average the magnitude spectrum across several windows over the sustained
// body. A single window can catch the attack transient or a loop-seam
// discontinuity, which on these looped banks shows up as an inaudible low
// rumble that dwarfs every musical partial and distorts the dB scale.
const N = 1 << 15;
const step = Math.max(N, Math.floor((pcm.length - N) / 4));
const starts = [];
for (let i = Math.floor(N * 0.1); i + N <= pcm.length && starts.length < 5; i += step) starts.push(i);
if (!starts.length) starts.push(Math.max(0, pcm.length - N));

const mag = new Float64Array(N / 2);
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
  for (let k = 0; k < N / 2; k++) mag[k] += Math.hypot(re[k], im[k]);
}

const bins = N / 2;
let maxMag = 0;
for (let k = 1; k < bins; k++) if (mag[k] > maxMag) maxMag = mag[k];

// Local maxima with parabolic interpolation for sub-bin frequency accuracy.
const peaks = [];
for (let k = 2; k < bins - 1; k++) {
  if (mag[k] > mag[k - 1] && mag[k] >= mag[k + 1]) {
    const a = mag[k - 1], b = mag[k], c = mag[k + 1];
    const denom = a - 2 * b + c;
    const delta = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
    const bin = k + Math.max(-0.5, Math.min(0.5, delta));
    const hz = (bin * 44100) / N;
    if (hz < 30 || hz > 6000) continue;
    peaks.push({ hz, midi: toMidi(hz), mag: mag[k] });
  }
}
// Re-reference to the loudest in-band peak: these lo-fi banks carry strong
// downsample aliasing near Nyquist, which would otherwise dominate the scale
// and hide the fundamental's true relative level.
let bandMax = 0;
for (const p of peaks) if (p.mag > bandMax) bandMax = p.mag;
for (const p of peaks) p.db = 20 * Math.log10((p.mag + 1e-12) / (bandMax + 1e-12));
// Strongest first: magnitude order (not frequency order) reveals the real
// fundamental candidates.
peaks.sort((x, y) => y.db - x.db);

const note = parseInt(file.replace(/\\/g, "/").split("/").pop(), 10);
console.log(`${file}`);
if (Number.isFinite(note)) {
  const targetHz = 440 * Math.pow(2, (note - 69) / 12);
  const best = peaks.filter((p) => p.hz >= targetHz * 0.99 && p.hz <= targetHz * 1.01);
  console.log(`target: ${nn(note)} (${note}) = ${targetHz.toFixed(2)} Hz` +
    (best.length ? ` | peak found at ${best[0].hz.toFixed(2)} Hz, ${best[0].db.toFixed(1)} dB` : " | NO PEAK AT TARGET"));
}
console.log("top peaks (low -> high fundamental candidates):");
for (const p of peaks.slice(0, wantPeaks))
  console.log(`  ${p.hz.toFixed(2).padStart(10)} Hz  ${nn(Math.round(p.midi)).padStart(4)} (${p.midi.toFixed(2)})  ${p.db.toFixed(1)} dB`);

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
