/**
 * Detect loop-join clicks: decode an anchor to raw float PCM and report how
 * large the biggest single-sample step is relative to the normal waveform
 * slope. A discontinuity shows up as a step far above the 99.9th percentile.
 */
import { spawnSync } from "node:child_process";

// ffmpeg from PATH by default; override with FFMPEG_PATH if it is not installed system-wide.
const FF = process.env.FFMPEG_PATH || "ffmpeg";

function decode(file) {
  const r = spawnSync(FF, ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-"],
    { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${file}: ${r.stderr}`);
  const buf = r.stdout;
  const n = Math.floor(buf.length / 4);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readFloatLE(i * 4);
  return out;
}

function stats(x) {
  const steps = [];
  for (let i = 1; i < x.length; i++) steps.push(Math.abs(x[i] - x[i - 1]));
  steps.sort((a, b) => a - b);
  const q = (p) => steps[Math.min(steps.length - 1, Math.floor(p * steps.length))];
  return { max: steps[steps.length - 1], p999: q(0.999), p99: q(0.99) };
}

for (const file of process.argv.slice(2)) {
  const x = decode(file);
  const s = stats(x);
  const ratio = s.max / (s.p999 || 1e-9);
  const flag = ratio > 3 ? "  <-- CLICK?" : "  ok";
  console.log(`${file.padEnd(46)} maxStep=${s.max.toExponential(2)} p999=${s.p999.toExponential(2)} ratio=${ratio.toFixed(1)}${flag}`);
}
