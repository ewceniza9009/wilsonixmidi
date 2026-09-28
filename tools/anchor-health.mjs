/**
 * Perceptual health check for one anchor file: where the energy actually sits,
 * and what the pitch is once the sub-audio rumble is excluded.
 *
 * Why this exists: on Pf:LoFi Piano the earlier detectors disagreed wildly
 * (NSDF said G3 was 89, HPS said it was D#2) because the files carry a strong
 * component near 35-70 Hz whose harmonics land on top of the musical tone.
 * HPS trusts harmonic stacks, so a rumble with 7+ harmonics wins the vote even
 * though a listener would hear the piano tone, not the rumble. This reports
 * both facts side by side so neither can hide the other:
 *
 *   - low/mid energy split: is there a loud buzz under the note?
 *   - in-band pitch: strongest peak above `floor` Hz, where a piano/EP
 *     fundamental for these anchors actually lives.
 *
 * usage: node tools/anchor-health.mjs <file.mp3> [note]
 */
import { execFileSync } from "node:child_process";

const NN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nn = (m) => NN[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
const toMidi = (hz) => 69 + 12 * Math.log2(hz / 440);

function decode(file) {
  const raw = execFileSync("ffmpeg",
    ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", "44100", "-"],
    { encoding: "buffer", maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}

export function analyse(pcm, { N = 1 << 15, lowHz = 100, floorHz = 120, peakHz = 2000 } = {}) {
  if (!pcm || pcm.length < N) return null;
  const step = Math.max(N, Math.floor((pcm.length - N) / 3));
  const starts = [];
  for (let s = 0; s + N <= pcm.length && starts.length < 4; s += step) starts.push(s);
  if (!starts.length) return null;

  const bins = N / 2;
  const mag = new Float64Array(bins);
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
    for (let k = 0; k < bins; k++) mag[k] += Math.hypot(re[k], im[k]);
  }

  const binHz = 44100 / N;
  let lowE = 0, midE = 0, totE = 0;
  for (let k = 1; k < bins; k++) {
    const hz = k * binHz;
    const p = mag[k] * mag[k];
    totE += p;
    if (hz < lowHz) lowE += p;
    if (hz >= floorHz && hz <= peakHz) midE += p;
  }

  // Strongest peak inside the musical band, with parabolic refinement.
  let bestK = -1, bestM = 0;
  for (let k = Math.ceil(floorHz / binHz); k < Math.floor(peakHz / binHz); k++) {
    if (mag[k] > bestM) { bestM = mag[k]; bestK = k; }
  }
  let hz = bestK * binHz;
  if (bestK > 1 && bestK < bins - 1) {
    const a = mag[bestK - 1], b = mag[bestK], c = mag[bestK + 1];
    const d = a - 2 * b + c;
    if (d !== 0) hz += Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / d)) * binHz;
  }
  // How dominant is that peak vs the loudest sub-audio component?
  let rumbleK = -1, rumbleM = 0;
  for (let k = 1; k < Math.floor(lowHz / binHz); k++) {
    if (mag[k] > rumbleM) { rumbleM = mag[k]; rumbleK = k; }
  }
  const rumbleDb = 20 * Math.log10((rumbleM + 1e-12) / (bestM + 1e-12));

  return {
    midi: toMidi(hz),
    hz,
    lowRatio: Math.sqrt(lowE / (totE + 1e-12)),
    midRatio: Math.sqrt(midE / (totE + 1e-12)),
    rumbleHz: rumbleK > 0 ? rumbleK * binHz : null,
    rumbleDb, // >0 means the rumble is LOUDER than the note's strongest partial
  };
}

export { fft, nn, toMidi, decode };

function fft(x, y) {
  const n = x.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [x[i], x[j]] = [x[j], x[i]]; [y[i], y[j]] = [y[j], y[i]]; }
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

const isMain = process.argv[1] && /anchor-health\.mjs$/.test(process.argv[1].replace(/\\/g, "/"));
if (isMain) {
  const [, , file, noteArg] = process.argv;
  if (!file) { console.error("usage: node tools/anchor-health.mjs <file.mp3> [note]"); process.exit(1); }
  const r = analyse(decode(file));
  if (!r) { console.log(`${file}: too short`); process.exit(0); }
  const note = noteArg && /^\d+$/.test(noteArg) ? Number(noteArg) : null;
  const cents = note !== null ? (r.midi - note) * 100 : null;
  console.log(`${file}`);
  console.log(`  in-band peak : ${r.hz.toFixed(2)} Hz  ${nn(r.midi)} (${r.midi.toFixed(2)})` +
    (cents !== null ? `   ${cents >= 0 ? "+" : ""}${cents.toFixed(0)}c vs ${nn(note)}` : ""));
  console.log(`  rumble       : ${r.rumbleHz !== null ? r.rumbleHz.toFixed(1) + " Hz" : "none"}  ` +
    `${r.rumbleDb >= 0 ? "+" : ""}${r.rumbleDb.toFixed(1)} dB vs note peak`);
  console.log(`  energy       : ${(r.lowRatio * 100).toFixed(1)}% below ${100}Hz  ` +
    `${(r.midRatio * 100).toFixed(1)}% in 120-2000Hz`);
}
