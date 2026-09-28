#!/usr/bin/env node
/**
 * sc55-bank-builder.mjs
 * ---------------------------------------------------------------------------
 * Builds distinct Yamaha-EOS preset banks from a Roland SC-55 / MV30 SoundFont 2.
 *
 * WHY THIS EXISTS
 * The Triton soundbank table maps ~258 preset names onto ~83 real sample banks,
 * so 19 names render byte-identical audio. SC-55 fonts store the true pitch in
 * the *zone* (keyRange + rootNote generators), not in shdr.byOriginalPitch --
 * every sample claims MIDI 60. So the builder measures the real fundamental of
 * each sample with NSDF autocorrelation and resamples from the measured pitch.
 *
 * OUTPUT CONTRACT (must match src/audio/native-pcm-engine.js)
 *   - public/banks/yamaha-eos/<bank>/<midiNote>.mp3
 *   - the file is a recording of *exactly* that midi note, because the engine
 *     computes playbackRate = 2^((playedNote - anchorMidi) / 12).
 *   - loop points are auto-detected at load (src/audio/sample-loop-helper.js),
 *     so we only need clean, correctly pitched, well-terminated audio.
 *
 * USAGE
 *   node tools/sc55-bank-builder.mjs --probe <font.sf2>
 *   node tools/sc55-bank-builder.mjs --build <font.sf2> [--out public/banks/yamaha-eos]
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// ---------------------------------------------------------------------------
// SF2 container parsing
// ---------------------------------------------------------------------------

/** Walk RIFF chunks in [start,end); yields {id, body, size}. */
function* riffChunks(buf, start, end) {
  let pos = start;
  while (pos + 8 <= end) {
    const id = buf.toString("latin1", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    yield { id, body, size };
    pos = body + size + (size & 1);
  }
}

function findLists(buf) {
  const out = {};
  for (const { id, body, size } of riffChunks(buf, 12, buf.length)) {
    if (id === "LIST") out[buf.toString("latin1", body, body + 4)] = { body: body + 4, size: size - 4 };
  }
  return out;
}

/**
 * SF2 generator records are 4 bytes: WORD destOper, SHORT genAmount.
 * (Modulator wiring lives in pmod/imod, not here.)
 */
const GEN = {
  keyRange: 43, velRange: 44, startAddrsOffset: 45, endAddrsOffset: 46,
  startloopAddrsOffset: 47, endloopAddrsOffset: 48,
  sampleID: 53, rootKey: 58, fineTune: 52, coarseTune: 51,
  initialAttenuation: 48 + 0, // 48 is endloop; 48 is also initialAttenuation? no:
};
// SF2 destOper values (the ones we need), for clarity:
// 41 instrument, 43 keyRange, 44 velRange, 51 coarseTune, 52 fineTune,
// 53 sampleID, 54 sampleModes, 58 rootKey, 33/34 delayVolEnv, 48 endloopOffsets

function parseSF2(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "sfbk") {
    throw new Error("Not a SoundFont 2 (RIFF/sfbk): " + file);
  }
  const lists = findLists(buf);
  const pdta = lists.pdta;
  if (!pdta) throw new Error("Missing pdta list -- not a v2 font");

  const sub = {};
  for (const { id, body, size } of riffChunks(buf, pdta.body, pdta.body + pdta.size)) sub[id] = { body, size };

  // sample data chunk
  let smpl = null;
  for (const { id, body, size } of riffChunks(buf, lists.sdta.body, lists.sdta.body + lists.sdta.size)) {
    if (id === "smpl") smpl = { body, size };
  }
  if (!smpl) throw new Error("Missing sdta/smpl chunk");

  const gen4 = (o) => {
    const n = Math.floor(o.size / 4);
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = { dest: buf.readUInt16LE(o.body + i * 4), amt: buf.readInt16LE(o.body + i * 4 + 2) };
    }
    return out;
  };

  const pgen = gen4(sub.pgen), igen = gen4(sub.igen);
  const pbag = [], ibag = [];
  for (let i = 0; i < sub.pbag.size / 2; i++) pbag.push(buf.readUInt16LE(sub.pbag.body + i * 2));
  for (let i = 0; i < sub.ibag.size / 2; i++) ibag.push(buf.readUInt16LE(sub.ibag.body + i * 2));

  const presets = [];
  for (let i = 0; i < Math.floor(sub.phdr.size / 38); i++) {
    const o = sub.phdr.body + i * 38;
    presets.push({
      name: buf.toString("latin1", o, o + 20).replace(/\0.*$/, ""),
      bank: buf.readUInt16LE(o + 22), preset: buf.readUInt16LE(o + 20), bag: pbag[i],
    });
  }
  const insts = [];
  for (let i = 0; i < Math.floor(sub.inst.size / 22); i++) {
    const o = sub.inst.body + i * 22;
    insts.push({ name: buf.toString("latin1", o, o + 20).replace(/\0.*$/, ""), bag: ibag[i] });
  }
  const samples = [];
  for (let i = 0; i < Math.floor(sub.shdr.size / 46); i++) {
    const o = sub.shdr.body + i * 46;
    samples.push({
      index: i,
      name: buf.toString("latin1", o, o + 20).replace(/\0.*$/, ""),
      start: buf.readUInt32LE(o + 20), end: buf.readUInt32LE(o + 24),
      loopStart: buf.readUInt32LE(o + 28), loopEnd: buf.readUInt32LE(o + 32),
      rate: buf.readUInt32LE(o + 36),
      originalPitch: buf.readInt8(o + 40), pitchCorrection: buf.readInt8(o + 41),
      type: buf.readUInt16LE(o + 44),
    });
  }

  // flatten every zone (preset + instrument) into sample references
  const zones = [];
  for (let p = 0; p < presets.length - 1; p++) {
    let instIdx = null;
    for (let g = presets[p].bag; g < (pbag[p + 1] ?? pgen.length); g++) {
      if (pgen[g].dest === 41) instIdx = pgen[g].amt;
    }
    if (instIdx === null || !insts[instIdx]) continue;
    for (let b = insts[instIdx].bag; b < (ibag[instIdx + 1] ?? igen.length); b++) {
      let lo = 0, hi = 127, sid = null, root = 60;
      for (let g = ibag[b]; g < ibag[b + 1]; g++) {
        const { dest, amt } = igen[g];
        if (dest === 53) sid = amt;
        else if (dest === 43) { lo = amt & 0xff; hi = (amt >> 8) & 0xff; }
        else if (dest === 58) root = amt;
      }
      if (sid !== null && samples[sid]) zones.push({ preset: presets[p].name, inst: insts[instIdx].name, lo, hi, root, sample: samples[sid] });
    }
  }

  return { buf, smpl, samples, zones, presets, insts };
}

/** Extract one sample's mono float PCM in [-1,1]. */
function samplePCM(sf, s) {
  const n = s.end - s.start;
  const out = new Float32Array(Math.max(0, n));
  for (let i = 0; i < n; i++) out[i] = sf.buf.readInt16LE(sf.smpl.body + (s.start + i) * 2) / 32768;
  return out;
}

// ---------------------------------------------------------------------------
// DSP: pitch detection, resampling, colouring
// ---------------------------------------------------------------------------

/**
 * NSDF (McLeod) pitch detector. Returns Hz of the fundamental, or 0.
 * Strongest peak + sub-harmonic check; see tools/verify-sc55-banks.mjs for why
 * the naive "first peak above threshold" rule is not usable on these samples.
 */
function detectPitch(x, sampleRate, fmin = 55, fmax = 1400) {
  const N = Math.min(x.length, 16384);
  if (N < 1024) return 0;
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (peak < 1e-4) return 0;

  const minLag = Math.max(2, Math.floor(sampleRate / fmax));
  const maxLag = Math.min(Math.floor(sampleRate / fmin), N - 1);
  if (maxLag <= minLag) return 0;

  // NSDF via brute-force correlation (inputs here are <= 16k samples, fine)
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0, m = 0;
    for (let i = 0; i < N - lag; i++) { ac += x[i] * x[i + lag]; m += x[i] * x[i] + x[i + lag] * x[i + lag]; }
    nsdf[lag] = m > 0 ? (2 * ac) / m : 0;
  }
  let gmax = 0, best = -1;
  for (let l = minLag; l <= maxLag; l++) if (nsdf[l] > gmax) { gmax = nsdf[l]; best = l; }
  if (best < 0 || gmax <= 0) return 0;
  // octave-ambiguous candidates -> let the harmonic product choose
  const cands = [];
  for (let l = minLag; l <= maxLag; l++) {
    if (nsdf[l] > nsdf[l - 1] && nsdf[l] >= nsdf[l + 1] && nsdf[l] >= gmax * 0.55) cands.push(l);
    if (cands.length > 12) break;
  }
  if (cands.length) best = refineByHarmonics(x, sampleRate, cands) ?? best;
  // parabolic interpolation around the peak
  const y0 = nsdf[best - 1] ?? nsdf[best], y1 = nsdf[best], y2 = nsdf[best + 1] ?? nsdf[best];
  const denom = y0 - 2 * y1 + y2;
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  return sampleRate / (best + shift);
}

// --- FFT / harmonic-sum pitch refinement ------------------------------------

/** In-place iterative radix-2 FFT (real input, real/imag output). */
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

/**
 * Pick the true fundamental among octave-ambiguous NSDF candidates.
 * Autocorrelation alone cannot tell a note from its own octave/fifth, so we
 * score each candidate with a harmonic product over its own FFT magnitude:
 * a true fundamental has energy at f, 2f and 3f, while 2f (an octave up)
 * has nothing at f/2 and so scores worse.
 */
function refineByHarmonics(x, sampleRate, candLags) {
  let N = 1;
  while (N < Math.min(x.length, 32768)) N <<= 1;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N && i < x.length; i++) re[i] = x[i];
  fft(re, im);
  const mag = (hz) => {
    const bin = Math.round((hz * N) / sampleRate);
    if (bin < 1 || bin >= N / 2) return 0;
    return Math.hypot(re[bin], im[bin]);
  };
  let bestL = null, bestS = -1;
  for (const lag of candLags) {
    const f = sampleRate / lag;
    if (f < 30) continue;
    const m1 = mag(f), m2 = mag(2 * f), m3 = mag(3 * f), m4 = mag(4 * f);
    if (m1 <= 0) continue;
    // harmonic product with a mild bias toward the LOWER candidate, so a
    // strong 2nd/3rd partial cannot drag the estimate an octave/fifth up
    const score = Math.pow(m1, 1) * Math.pow(m2 + 1e-9, 0.5) * Math.pow(m3 + 1e-9, 0.35) /
      (1 + 0.05 * Math.log2(f / 65.4));
    if (score > bestS) { bestS = score; bestL = lag; }
    void m4;
  }
  return bestL;
}

/**
 * Octave-tolerant self-check. Single-note pitch detection cannot resolve the
 * octave on a decaying piano (the fundamental fades fastest, so the sustain
 * reports the 2nd partial as the "fundamental"). Instead of trusting the
 * detected octave, assert that the expected pitch class is actually present in
 * the spectrum: a bin at f, 2f, 3f, f/2, 2f/3 or f/3 must be within `floor` of
 * the loudest bin. A file built from the wrong sample, or off by an octave
 * throughout, has no energy at any of those and fails.
 */
function pitchClassPresent(x, sampleRate, note, floor = 0.02) {
  let N = 1;
  while (N < Math.min(x.length, 32768)) N <<= 1;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N && i < x.length; i++) re[i] = x[i];
  fft(re, im);
  const half = N / 2;
  const mag = (hz) => {
    const bin = Math.round((hz * N) / sampleRate);
    if (bin < 1 || bin >= half) return 0;
    return Math.hypot(re[bin], im[bin]);
  };
  let gmax = 0;
  for (let b = Math.round((55 * N) / sampleRate); b < Math.min(half - 1, Math.round((6000 * N) / sampleRate)); b++)
    gmax = Math.max(gmax, Math.hypot(re[b], im[b]));
  if (gmax <= 0) return { ok: false, ratio: 0 };
  const f0 = midiToHz(note);
  let best = 0;
  for (const f of [f0, 2 * f0, 3 * f0, f0 / 2, (2 * f0) / 3, f0 / 3, 4 * f0]) best = Math.max(best, mag(f));
  const ratio = best / gmax;
  return { ok: ratio >= floor, ratio };
}

const hzToMidi = (hz) => 69 + 12 * Math.log2(hz / 440);
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Pick the analysis window: skip the attack transient, use the sustain body. */
function analysisWindow(pcm, rate) {
  const n = pcm.length;
  if (n < 512) return pcm;
  const win = Math.min(16384, n);
  const skip = Math.min(Math.floor(n * 0.12), Math.max(0, n - win));
  return pcm.subarray(skip, skip + win);
}

/** Linear-interpolation resampler, with optional fractional read offset. */
function resample(x, fromRate, toRate) {
  if (fromRate === toRate) return x;
  const ratio = toRate / fromRate;
  const n = Math.max(1, Math.floor(x.length * ratio));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = i / ratio;
    const i0 = Math.floor(s), f = s - i0;
    const a = x[i0] ?? 0, b = x[i0 + 1] ?? a;
    out[i] = a + (b - a) * f;
  }
  return out;
}

/** One-pole high-pass (DC / rumble removal). */
function dcBlock(x, rate, hz = 25) {
  const rc = 1 / (2 * Math.PI * hz);
  const a = rc / (rc + 1 / rate);
  let x1 = 0, y1 = 0;
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const v = x[i] - x1 + a * y1;
    x1 = x[i]; y1 = v; out[i] = v;
  }
  return out;
}

/** Soft saturation for warmth / 80s grit. drive 1 = clean. */
function saturate(x, drive = 1.4) {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = Math.tanh(x[i] * drive) / Math.tanh(drive);
  return out;
}

/** Short fade-in (de-click) and fade-out (avoid truncation click). */
function fadeEdges(x, rate, inMs = 2, outMs = 12) {
  const nIn = Math.min(x.length, Math.floor((inMs / 1000) * rate));
  const nOut = Math.min(x.length, Math.floor((outMs / 1000) * rate));
  for (let i = 0; i < nIn; i++) x[i] *= i / nIn;
  for (let i = 0; i < nOut; i++) x[x.length - 1 - i] *= i / nOut;
  return x;
}

/** Peak-normalise to a target dBFS with a soft ceiling. */
function normalize(x, targetDb = -3.0) {
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (peak < 1e-6) return x;
  const g = Math.pow(10, targetDb / 20) / peak;
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * g * 1.05) * 0.98;
  return x;
}

function rmsDb(x) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return 20 * Math.log10(Math.sqrt(s / Math.max(1, x.length)) + 1e-12);
}

// --- filters / colour -------------------------------------------------------

/** One-pole lowpass. */
function lowpass(x, rate, hz) {
  if (hz >= rate / 2) return x;
  const a = 1 - Math.exp((-2 * Math.PI * hz) / rate);
  const out = new Float32Array(x.length);
  let y = 0;
  for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); out[i] = y; }
  return out;
}

/** 2-pole (biquad) resonant lowpass, for character (vintage / lofi tone control). */
function biquadLP(x, rate, hz, q = 0.707) {
  if (hz >= rate / 2) return x;
  const w0 = (2 * Math.PI * hz) / rate;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  const alpha = sw / (2 * Math.max(0.5, q));
  const b0 = (1 - cw) / 2, b1 = 1 - cw, b2 = (1 - cw) / 2;
  const a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;
  const out = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = (b0 / a0) * xi + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = yi;
    out[i] = yi;
  }
  return out;
}

/** Bitcrush + downsample for lo-fi colour. */
function bitcrush(x, rate, bits = 8, downsample = 4) {
  const levels = Math.pow(2, bits) / 2;
  const out = new Float32Array(x.length);
  let hold = 0, holdV = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % downsample === 0) holdV = Math.round(x[i] * levels) / levels;
    out[i] = holdV; hold = i;
  }
  void hold;
  return out;
}

/** Stereo chorus by mixing the signal with a short modulated delay. */
function chorus(chL, chR, rate, depthMs = 3.5, rateHz = 0.6, mix = 0.5) {
  const n = chL.length;
  const d = Math.max(1, Math.floor((depthMs / 1000) * rate));
  const outL = new Float32Array(n), outR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const m = 0.5 + 0.5 * Math.sin(2 * Math.PI * rateHz * t);
    const dl = Math.floor(m * d);
    const dr = Math.floor((1 - m) * d);
    const sl = chL[Math.max(0, i - dl)] ?? 0;
    const sr = chR[Math.max(0, i - dr)] ?? 0;
    outL[i] = chL[i] * (1 - mix) + sl * mix;
    outR[i] = chR[i] * (1 - mix) + sr * mix;
  }
  return [outL, outR];
}

/**
 * Extend a looped sample to a longer playable length by repeating its SF2 loop
 * region with an equal-power crossfade at each join (no clicks, no pitch change).
 */
function extendLoop(pcm, rate, loopStart, loopEnd, targetSec) {
  const target = Math.floor(targetSec * rate);
  if (target <= pcm.length) return pcm.subarray(0, target);
  let ls = Math.max(0, Math.min(pcm.length - 2, Math.floor(loopStart)));
  let le = Math.floor(loopEnd);
  if (le <= ls) { ls = Math.floor(pcm.length * 0.1); le = Math.floor(pcm.length * 0.9); }
  if (le <= ls + 64) { ls = 0; le = pcm.length; }
  const loopLen = le - ls;
  const xf = Math.min(Math.floor(loopLen * 0.5), Math.floor(rate * 0.02));
  const out = new Float32Array(target);
  // seed with the head of the sample (keeps the attack)
  const head = Math.min(ls, Math.floor(rate * 0.05));
  out.set(pcm.subarray(0, head), 0);
  let w = head;
  while (w < target) {
    const copyStart = w;
    for (let i = 0; i < loopLen && w < target; i++, w++) {
      let v = pcm[ls + i];
      // Blend ACROSS the join: the first xf samples of this copy fade in over
      // the last xf samples of the previous copy. Fading inside the tail
      // instead (the old code) left a full-amplitude step at the actual
      // boundary, which is the click/roar heard on sustained notes.
      if (xf > 0 && i < xf) {
        const pi = copyStart - xf + i;
        if (pi >= 0) {
          const t = (i + 1) / xf;
          v = v * t + out[pi] * (1 - t);
        }
      }
      out[w] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// WAV output
// ---------------------------------------------------------------------------

function writeWav(file, channels, rate) {
  const ch = channels.length, frames = channels[0].length;
  const blockAlign = ch * 2, dataBytes = frames * blockAlign;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * blockAlign, 28);
  buf.writeUInt16LE(blockAlign, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(dataBytes, 40);
  let o = 44;
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i]));
      buf.writeInt16LE(Math.round(v * 32767), o); o += 2;
    }
  fs.writeFileSync(file, buf);
}

function ffmpeg() {
  for (const c of ["ffmpeg", "ffmpeg.exe"]) {
    const r = spawnSync(process.platform === "win32" ? "where" : "which", [c], { encoding: "utf8" });
    if (r.status === 0) return r.stdout.split(/\r?\n/)[0].trim();
  }
  throw new Error("ffmpeg not found on PATH");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) {
      const key = t.slice(2);
      const nxt = argv[i + 1];
      // a flag is boolean unless the next token is a value (not another flag)
      if (nxt === undefined || nxt.startsWith("--")) a[key] = true;
      else { a[key] = nxt; i++; }
    } else a._.push(t);
  }
  return a;
}

// ---------------------------------------------------------------------------
// Bank manifest
// ---------------------------------------------------------------------------
//
// One entry per redundant preset name found by tools/audit-pcm-collisions.mjs.
// `pool` lists candidate SC-55 samples; for each anchor note the builder picks
// the pool entry whose *measured* pitch is nearest, so every file is in tune by
// construction. Each bank gets a distinct character so no two banks collide
// audibly even when built from the same font.

export const SC55_BANKS = [
  { id: "sc55_midi_grand", name: "SC55:Midi Grand", pool: ["SC55 Piano C1m","SC55 Piano C2m","SC55 Piano G2m","SC55 Piano A2m","SC55 Piano E3m","SC55 Piano A3m","SC55 Piano C4m","SC55 Piano E4m","SC55 Piano G4m","SC55 Piano A4m","SC55 Piano C5m","SC55 Piano E5m"],
    notes: [36,43,48,55,60,64,67,72,76,79,84], sustain: false, color: { hp: 60, targetDb: -3 } },
  { id: "sc55_vintage_ep", name: "SC55:Vintage EP", pool: ["Bright EP C2 3L","Bright EP C3 3L","Bright EP C4 3L","Bright EP C5 3L","Bright EP C6 3L"],
    notes: [36,48,55,60,64,67,72,76,79,84], sustain: true, dur: 3.2, color: { hp: 90, lp: 2600, q: 0.8, drive: 1.5, chorus: 0.18, targetDb: -4 } },
  { id: "sc55_rnb_tine", name: "SC55:R&B Tine", pool: ["Bright EP C2 3L","Bright EP C3 3L","Bright EP C4 3L","Bright EP C5 3L"],
    notes: [36,43,48,55,60,64,67,72,76], sustain: true, dur: 3.0, color: { hp: 110, drive: 2.0, lp: 7000, targetDb: -4 } },
  { id: "sc55_phantom_ep", name: "SC55:Phantom EP", pool: ["Bright EP C3 3L","Bright EP C4 3L","Bright EP C5 3L","Bright EP C6 3L"],
    notes: [48,55,60,64,67,72,76,79,84], sustain: true, dur: 2.6, color: { hp: 140, drive: 1.3, chorus: 0.34, targetDb: -4.5 } },
  { id: "sc55_samba_ep", name: "SC55:Samba EP", pool: ["Bright EP C4 3L","Bright EP C5 3L","Bright EP C6 3L"],
    notes: [55,60,64,67,72,76,79,84], sustain: true, dur: 2.4, color: { hp: 130, lp: 9000, drive: 1.35, chorus: 0.45, targetDb: -4.5 } },
  { id: "sc55_lofi_rhodes", name: "SC55:Lo-Fi Rhodes", pool: ["Bright EP C2 3L","Bright EP C3 3L","Bright EP C4 3L"],
    notes: [36,43,48,55,60,64,67,72], sustain: true, dur: 2.8, color: { hp: 70, lp: 2000, q: 0.9, drive: 1.7, crush: 7, downsample: 5, targetDb: -5 } },
  // bright, present tine EP: full-length recordings, so no loop extension
  { id: "sc55_bright_ep", name: "SC55:Bright EP", pool: ["Bright EP C2 3L","Bright EP C3 3L","Bright EP C4 3L","Bright EP C5 3L","Bright EP C6 3L","Bright EP C7 3L"],
    notes: [48,55,60,64,67,72,76,79,84], sustain: false, color: { hp: 90, lp: 11000, q: 0.9, drive: 1.25, chorus: 0.3, targetDb: -3.5 } },
  { id: "sc55_deep_world", name: "SC55:Deep World", pool: ["ChoirU20-03","ChoirU20-04","ChoirU20-09","ChoirU20-10","ChoirU20-01","ChoirU20-02","ChoirU20-05","ChoirU20-06"],
    notes: [36,48,55,60,64,67,72,79], sustain: true, dur: 4.0, color: { hp: 120, lp: 3000, chorus: 0.5, targetDb: -6 } },
  { id: "sc55_soft_vibes", name: "SC55:Soft Vibes", pool: ["VIBE_52A","VIBE_64A","Krd Vib","Lrd Vib","VIBE_76A","Mrd Vib","Nrd Vib"],
    notes: [52,58,60,62,64,67,70,72,76,78,82], sustain: true, dur: 2.4, color: { hp: 150, lp: 8000, chorus: 0.28, targetDb: -4.5 } },
  { id: "sc55_nylon_jazz", name: "SC55:Nylon Jazz Gt", pool: ["SC88Nylon-strGt C3","SC88Nylon-strGt F#3","SC88Nylon-strGt C4","SC88Nylon-strGt F#4","SC88Nylon-strGt C5","SC88Nylon-strGt F#5","Muted Guitar A4","Muted Guitar E5"],
    notes: [48,54,60,66,72,78], sustain: true, dur: 2.0, color: { hp: 110, lp: 6500, targetDb: -4 } },
  { id: "sc55_fretless_bass", name: "SC55:Fretless Bass", pool: ["Fretless Bass C2 2L","Fretless Bass C3 2L","Fretless Bass C4 2L"],
    notes: [36,43,48,55,60], sustain: true, dur: 4.0, color: { hp: 45, lp: 2200, targetDb: -4 } },
  { id: "sc55_acid_resonator", name: "SC55:Acid Resonator", pool: ["Saw Wave 2","Saw Wave 2 A","Saw Wave 3","Saw Wave 4","Saw Wave 5","Saw Wave 6","Saw Wave 7","Saw Wave 8","Saw Wave 9","Saw Wave 10","Saw Wave 11","Saw Wave 12","Saw Wave 13"],
    notes: [36,43,47,52,55,59,62,65,67,69,74,86], sustain: true, dur: 2.0, color: { hp: 80, lp: 4200, q: 4.0, drive: 1.8, targetDb: -5 } },
  { id: "sc55_techno_organ", name: "SC55:Techno Organ", pool: ["Roland Rock Organ2","Roland Rock Organ3","Roland Rock Organ4","Roland Rock Organ5","Roland Rock Organ6"],
    notes: [40,43,49,52,57,63,68,74], sustain: true, dur: 2.2, color: { hp: 90, lp: 5200, drive: 1.45, targetDb: -4.5 } },
  { id: "sc55_rave_stab", name: "SC55:Rave Stab", pool: ["Brass Section-C4","Brass Section-G4","Brass Section-C5","Brass Section-E5","Brass Section-G5","Brass Section-C6"],
    notes: [60,64,67,72,76,79,84], sustain: true, dur: 1.6, color: { hp: 120, lp: 8000, drive: 1.6, targetDb: -4 } },
  { id: "sc55_trance_oct", name: "SC55:Trance Oct", pool: ["Saw Wave 6","Saw Wave 7","Saw Wave 8","Saw Wave 9","Saw Wave 10","Saw Wave 11","Saw Wave 12","Saw Wave 13"],
    notes: [57,59,62,65,67,69,74,86], sustain: true, dur: 1.8, color: { hp: 100, lp: 7500, drive: 1.4, chorus: 0.3, targetDb: -5 } },
  { id: "sc55_marsh_lead", name: "SC55:Marshmallow Lead", pool: ["Polysynth D","Polysynth E","Polysynth F","Polysynth G","Polysynth H"],
    notes: [60,64,67,69,72,76,79], sustain: true, dur: 3.0, color: { hp: 130, lp: 6500, chorus: 0.4, targetDb: -5 } },
  { id: "sc55_angelic_choir", name: "SC55:Angelic Choir", pool: ["Choir Aaahs 1","Choir Aaahs 2","Choir Aaahs 3","Choir Aaahs 4","Choir Aaahs 5","Voice Ooohs 1","Voice Ooohs 2"],
    notes: [48,55,57,60,67,72], sustain: true, dur: 3.2, color: { hp: 150, lp: 6500, chorus: 0.5, targetDb: -6 } },
  { id: "sc55_space_dream", name: "SC55:Space Dream", pool: ["ChoirU20-09","ChoirU20-10","ChoirU20-03","ChoirU20-04","ChoirU20-11","ChoirU20-12","Bowed Glass 9L","Bowed Glass 9R"],
    notes: [48,57,62,67,72,79], sustain: true, dur: 4.2, color: { hp: 100, lp: 3400, chorus: 0.6, targetDb: -6.5 } },
  { id: "sc55_breathy_sax", name: "SC55:Breathy Sax", pool: ["Sax C2","Sax E2","Sax G2","Sax C4","Sax D#4","Hard Alto Sax D2","EHORN82A","S_SAX95"],
    notes: [56,60,63,70,73,80,83], sustain: true, dur: 2.2, color: { hp: 190, lp: 3200, q: 1.4, drive: 1.2, targetDb: -5 } },
  { id: "sc55_scoop_sax", name: "SC55:Scoop Sax", pool: ["Trumpet 1 48","Trumpet 1 54","Trumpet 1 60","Trumpet 1 66","Trumpet 1 72","Trumpet 1 78","Trumpet 1 84","Trumpet 1 90","Trumpet 1 96"],
    notes: [48,54,60,66,72,78,84], sustain: true, dur: 2.4, color: { hp: 160, lp: 6000, drive: 1.35, chorus: 0.3, targetDb: -5 } },
  { id: "sc55_sax_fall", name: "SC55:Sax Fall", pool: ["Trombone 2 f 48","Trombone 2 f 54","Trombone 2 f 60","Trombone 2 f 66","Trombone 2 f 72","Trombone 2 f 78","Trombone 2 f 84","Trombone 2 f 90"],
    notes: [48,54,60,66,72,78,84], sustain: true, dur: 2.0, color: { hp: 140, lp: 4500, drive: 1.3, targetDb: -5 } },
  // 5th distinct voice for the sax group: the raw Sax C2/E2/G2/C4 samples are
  // only ~60 ms, so this is the sustained Trumpet 1 low range pushed dark and
  // breathy instead - a fifth colouring of the same family, not a reuse.
  { id: "sc55_tenor_sax", name: "SC55:Tenor Sax", pool: ["Trumpet 1 36","Trumpet 1 42","Trumpet 1 48","Trumpet 1 54","Trumpet 1 60","Trumpet 1 66","Trumpet 1 72","Trumpet 1 78","Trumpet 1 84"],
    notes: [48,54,60,66,72,78,84], sustain: true, dur: 2.6, color: { hp: 150, lp: 2600, q: 1.6, drive: 1.5, targetDb: -5 } },
  { id: "sc55_funk_stab", name: "SC55:Funk Stab", pool: ["Muted Guitar G3","Muted Guitar A4","Muted Guitar D4","Muted Guitar E5","Gt.Harmonics G3","Gt.Harmonics G4","Gt.Harmonics C5","Brass Section-C5"],
    notes: [43,50,57,64,74,77,79], sustain: true, dur: 1.4, color: { hp: 180, lp: 8000, drive: 1.7, targetDb: -4.5 } },
];

/**
 * Roland Juno-60 bank set, built from E3Kay_s_Roland_Juno-60_Soundfont_v2.0.sf2.
 *
 * Source pitches are the MEASURED pitches of that font, not the sample names
 * (byOriginalPitch is 60 for nearly every sample in every SF2, so it carries
 * no information). Pools deliberately avoid six L/R pairs whose members
 * disagree by an octave -- 15 Organ 2, PWM Chorus, Funk, 36 Pizzicato Sound,
 * Space Harp and Space Sound 2 -- because there the detector cannot settle
 * which channel is correct, and a wrong octave is worse than a missing bank.
 *
 * `vibes`/`jazz`/`lofi` families get distinct pools and distinct colouring so
 * no two banks in this set resolve to the same audio.
 */
export const JUNO_BANKS = [
  // ---- LO-FI / 80s-90s nostalgic: the Juno tine EP and clav families --------
  { id: "juno_lofi_ep", name: "Juno:Lo-Fi EP", pool: ["Juno-60 Synth 05 C2", "Juno-60 Synth 05 C3", "Juno-60 Synth 05 C4"],
    notes: [36, 43, 48, 55, 60, 64, 67, 72], sustain: true, dur: 3.0, color: { hp: 80, lp: 2400, q: 0.9, drive: 1.5, crush: 7, downsample: 5, targetDb: -5 } },
  { id: "juno_lofi_clav", name: "Juno:Lo-Fi Clav", pool: ["33 Clavichord 1L", "33 Clavichord 1R", "34 Clavichord 2L", "34 Clavichord 2R"],
    notes: [36, 43, 48, 55, 60, 64, 67, 72], sustain: false, color: { hp: 100, lp: 3200, q: 1.2, drive: 1.8, crush: 8, downsample: 6, targetDb: -5.5 } },
  { id: "juno_tape_pad", name: "Juno:Tape Pad", pool: ["Juno-60 Synth 02 a", "Juno-60 Synth 02 b", "Juno-60 Synth 02 c", "Juno-60 Synth 02 d", "Juno-60 Synth 02 e"],
    notes: [36, 43, 48, 55, 60, 64, 67, 72, 76, 79], sustain: true, dur: 3.4, color: { hp: 60, lp: 3000, q: 0.7, drive: 1.2, crush: 5, downsample: 4, targetDb: -6 } },
  { id: "juno_90s_lead", name: "Juno:90s Lead", pool: ["Juno-60 Synth 07 C2", "Juno-60 Synth 07 C3", "Juno-60 Synth 07 G2", "Juno-60 Synth 07 G3", "Juno-60 Saw G2L", "Juno-60 Saw G2R"],
    notes: [48, 55, 60, 64, 67, 72, 76, 79, 84], sustain: true, dur: 2.2, color: { hp: 140, lp: 9000, drive: 1.7, targetDb: -4.5 } },

  // ---- JAZZ: reeds, brass, upright bass, clean keys ------------------------
  { id: "juno_jazz_ep", name: "Juno:Jazz EP", pool: ["Juno-60 Synth 04 C2", "Juno-60 Synth 08 C2", "Juno-60 Synth 08 E2", "Juno-60 Synth 08 G2"],
    notes: [36, 43, 48, 55, 60, 64, 67, 72, 76], sustain: true, dur: 2.8, color: { hp: 90, lp: 6000, q: 0.8, drive: 1.2, targetDb: -4.5 } },
  { id: "juno_jazz_flute", name: "Juno:Jazz Flute", pool: ["45 FluteL", "45 FluteR"],
    notes: [55, 60, 64, 67, 72, 76, 79, 84], sustain: true, dur: 2.4, color: { hp: 150, lp: 7000, targetDb: -5 } },
  { id: "juno_jazz_horn", name: "Juno:Jazz Horn", pool: ["42 TrumpetL", "42 TrumpetR", "43 HornL", "43 HornR"],
    notes: [48, 55, 60, 64, 67, 72, 76, 79], sustain: true, dur: 2.2, color: { hp: 120, lp: 6500, drive: 1.3, targetDb: -4.5 } },
  { id: "juno_jazz_bass", name: "Juno:Jazz Bass", pool: ["31 Bass 1L", "31 Bass 1R", "Juno-60 Bass 2 C2", "Juno-60 Bass 2 C3", "Juno-60 Bass 2 E2"],
    notes: [28, 31, 36, 40, 43, 47, 48], sustain: true, dur: 3.0, color: { hp: 45, lp: 2400, targetDb: -4 } },
  { id: "juno_jazz_strings", name: "Juno:Jazz Strings", pool: ["Strings 1L", "Strings 1R", "12 Strings 2L", "12 Strings 2R", "Strings 3L", "Strings 3R"],
    notes: [48, 55, 60, 64, 67, 72, 76, 79, 84], sustain: true, dur: 3.2, color: { hp: 110, lp: 8000, chorus: 0.3, targetDb: -5.5 } },

  // ---- VIBES: bells, harp, whistle ----------------------------------------
  { id: "juno_vibes_bell", name: "Juno:Vibes", pool: ["23 CelestaL", "23 CelestaR", "37 XylophoneL", "37 XylophoneR", "38 GlockenspielL", "38 GlockenspielR"],
    notes: [60, 64, 67, 72, 76, 79, 84, 88], sustain: true, dur: 3.0, color: { hp: 180, lp: 9000, tremolo: 5.2, targetDb: -5 } },
  { id: "juno_vibes_harp", name: "Juno:Space Harp", pool: ["Synthesizer HarpL", "Synthesizer HarpR", "Harpsi1 L", "Harpsi1R", "66 Space Sound 1L", "66 Space Sound 1R"],
    notes: [48, 55, 60, 64, 67, 72, 76, 79], sustain: true, dur: 3.4, color: { hp: 200, lp: 8000, tremolo: 4.6, targetDb: -6 } },
  { id: "juno_vibes_dream", name: "Juno:Dream Pad", pool: ["Mysterious InventioL", "Mysterious InventioR", "Phase CombinationL", "Phase CombinationR", "Juno-60 Synth 01"],
    notes: [36, 43, 48, 55, 60, 64, 67, 72], sustain: true, dur: 4.0, color: { hp: 70, lp: 3400, q: 0.7, chorus: 0.5, tremolo: 3.2, targetDb: -6.5 } },

  // ---- 80s/90s: organ, brass stabs, synth bass, bells ---------------------
  { id: "juno_organ_80s", name: "Juno:80s Organ", pool: ["Org1L", "Org1R", "61 Synthesizer OrgaL", "61 Synthesizer OrgaR"],
    notes: [36, 43, 48, 55, 60, 64, 67, 72], sustain: true, dur: 2.6, color: { hp: 90, lp: 5200, q: 0.9, drive: 1.4, targetDb: -4.5 } },
  { id: "juno_brass_stab", name: "Juno:Brass Stab", pool: ["17 Brass-1L", "17 Brass-1R", "Phase BrassL", "Phase BrassR", "Wah BrassL", "Wah BrassR"],
    notes: [48, 55, 60, 64, 67, 72, 76, 79], sustain: true, dur: 1.6, color: { hp: 110, lp: 7500, q: 1.2, drive: 1.8, targetDb: -4 } },
  { id: "juno_80s_synthbass", name: "Juno:80s Synth Bass", pool: ["Juno-60 Bass 1 G3", "Juno-60 Bass 2 G2", "Juno-60 Bass 2 G3", "Juno-60 Synth 11 E2", "Juno-60 Synth 11 G3"],
    notes: [28, 31, 36, 40, 43, 47, 48, 52], sustain: true, dur: 2.4, color: { hp: 40, lp: 1800, drive: 2.0, targetDb: -4 } },
  { id: "juno_80s_polysynth", name: "Juno:Polysynth", pool: ["Juno-60 Synth 09 C2", "Juno-60 Synth 09 C3", "Juno-60 Synth 09 C4", "Juno-60 Synth 10 C3", "Juno-60 Synth 10 E2", "Juno-60 Synth 10 G3"],
    notes: [48, 55, 60, 64, 67, 72, 76, 79, 84], sustain: true, dur: 2.6, color: { hp: 130, lp: 7500, drive: 1.35, chorus: 0.3, targetDb: -5 } },
  { id: "juno_80s_pizz", name: "Juno:80s Pizz", pool: ["35 Pizzicato Sound1L", "35 Pizzicato Sound1R", "27 GuitarL", "27 GuitarR"],
    notes: [48, 55, 60, 64, 67, 72, 76, 79], sustain: true, dur: 1.4, color: { hp: 190, lp: 7000, q: 1.0, drive: 1.4, targetDb: -4.5 } },
  { id: "juno_whistle", name: "Juno:Whistle", pool: ["73 WhistleL", "73 WhistleR", "75 UFOL", "75 UFOR", "56 Reed 2L", "56 Reed 2R"],
    notes: [60, 64, 67, 72, 76, 79, 84], sustain: true, dur: 2.2, color: { hp: 400, lp: 9000, tremolo: 5.4, targetDb: -5.5 } },

  // ---- Split banks: one distinct pool per preset so no two presets on these
  // ---- lists can ever resolve to the same audio (the collision audit is the
  // ---- authority on that; these exist to give the duplicated slots real
  // ---- source material instead of a second name for an existing bank).
  { id: "juno_tx_ep", name: "Juno:Lo-Fi TX EP", pool: ["Juno-60 Synth 08 C2", "Juno-60 Synth 08 E2", "Juno-60 Synth 08 G2"],
    notes: [36, 43, 48, 55, 60, 64, 67, 72], sustain: true, dur: 2.7, color: { hp: 110, lp: 2800, q: 1.0, drive: 1.6, crush: 6, downsample: 5, targetDb: -5 } },
  { id: "juno_clavinet", name: "Juno:Chorus Clavinet", pool: ["34 Clavichord 2L", "34 Clavichord 2R"],
    notes: [36, 43, 48, 55, 60, 64, 67, 72], sustain: false, color: { hp: 160, lp: 4200, q: 1.4, drive: 1.7, chorus: 0.4, targetDb: -5 } },
  { id: "juno_kalimba_lofi", name: "Juno:Lo-Fi Kalimba", pool: ["55 PopcornL", "55 PopcornR", "46 ClarinetL", "46 ClarinetR"],
    notes: [48, 55, 60, 64, 67, 72, 76, 79], sustain: true, dur: 2.2, color: { hp: 220, lp: 3600, q: 1.2, drive: 1.4, crush: 7, downsample: 5, tremolo: 4.4, targetDb: -5.5 } },
  { id: "juno_x_brass", name: "Juno:X-Brass", pool: ["44 TubaL", "44 TubaR", "43 HornL", "43 HornR"],
    notes: [40, 48, 55, 60, 64, 67, 72], sustain: true, dur: 1.9, color: { hp: 130, lp: 6200, q: 1.4, drive: 2.1, targetDb: -4.5 } },
  { id: "juno_jazz_guitar", name: "Juno:Jazz Guitar", pool: ["27 GuitarL", "27 GuitarR"],
    notes: [40, 48, 55, 60, 64, 67, 72, 76, 79], sustain: true, dur: 2.4, color: { hp: 170, lp: 8200, q: 0.9, drive: 1.3, targetDb: -4.5 } },
  { id: "juno_house_piano", name: "Juno:90s House Piano", pool: ["21 Piano 1L", "21 Piano 1R"],
    notes: [36, 43, 48, 55, 60, 64, 67, 72], sustain: true, dur: 2.5, color: { hp: 120, lp: 7000, q: 0.9, drive: 1.9, targetDb: -4 } },
  { id: "juno_midnight_ep", name: "Juno:Midnight Rhodes", pool: ["Juno-60 Synth 11 E2", "Juno-60 Synth 11 G3"],
    notes: [36, 43, 48, 55, 60, 64, 67, 72], sustain: true, dur: 3.2, color: { hp: 70, lp: 2100, q: 1.0, drive: 1.45, crush: 8, downsample: 6, tremolo: 3.6, targetDb: -5.5 } },
  { id: "juno_vibes_vibraphone", name: "Juno:Jazz Vibraphone", pool: ["38 GlockenspielL", "38 GlockenspielR", "37 XylophoneL", "37 XylophoneR"],
    notes: [55, 59, 62, 67, 71, 74, 79, 83], sustain: true, dur: 2.8, color: { hp: 200, lp: 7600, q: 1.0, tremolo: 4.8, targetDb: -5.5 } },
  { id: "juno_jazz_guitar_2", name: "Juno:Jazz Guitar 2", pool: ["35 Pizzicato Sound1L", "35 Pizzicato Sound1R", "27 GuitarL", "27 GuitarR"],
    notes: [40, 48, 55, 60, 64, 67, 72, 76, 79], sustain: true, dur: 2.6, color: { hp: 140, lp: 6400, q: 1.3, drive: 1.5, targetDb: -4.5 } },
];

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * Pool entries are matched by name, but several samples in this font share a
 * name (different takes/velocities). So every instance is measured and the
 * caller keeps the winning sample *index* -- `samples.find(name)` would
 * silently grab a different instance than the one that was analysed.
 */
function measurePool(sf, needed) {
  const measured = new Map();
  for (const s of sf.samples) {
    if (!needed.has(s.name) || s.end <= s.start) continue;
    const pcm = samplePCM(sf, s);
    if (pcm.length < 512) continue;
    const hz = detectPitch(analysisWindow(pcm, s.rate), s.rate);
    if (!hz) continue;
    if (!measured.has(s.name)) measured.set(s.name, []);
    measured.get(s.name).push({ i: s.index, midi: hzToMidi(hz), hz, dur: pcm.length / s.rate, rms: rmsDb(pcm) });
  }
  return measured;
}

function pickSource(pool, note, measured) {
  let best = null;
  for (const name of pool) {
    for (const m of measured.get(name) || []) {
      const d = Math.abs(m.midi - note);
      if (!best || d < best.d) best = { name, m, d };
    }
  }
  return best;
}

function renderNote(sf, measured, spec, note) {
  const pick = pickSource(spec.pool, note, measured);
  if (!pick) throw new Error(`no source sample for ${spec.id} note ${note}`);
  const s = sf.samples[pick.m.i];
  let src = samplePCM(sf, s);
  const srcRate = s.rate;
  const shift = note - pick.m.midi;
  const ratio = Math.pow(2, shift / 12);

  // Pitch shifting: time-compress by `ratio` while KEEPING the declared sample
  // rate, so the result sounds `shift` semitones above the source.
  // (Resampling to rate*ratio and declaring rate*ratio would keep the pitch.)
  const OUT_RATE = 44100;
  if (srcRate !== OUT_RATE) src = resample(src, srcRate, OUT_RATE);
  let x = resample(src, OUT_RATE, OUT_RATE / ratio);
  const outRate = OUT_RATE;

  const c = spec.color || {};
  if (c.hp) x = dcBlock(x, outRate, c.hp);
  if (c.drive) x = saturate(x, c.drive);
  if (c.lp) x = c.q ? biquadLP(x, outRate, c.lp, c.q) : lowpass(x, outRate, c.lp);
  if (c.crush) x = bitcrush(x, outRate, c.crush, c.downsample || 4);
  if (c.tremolo) {
    const t = new Float32Array(x.length);
    const d = 0.35;
    for (let i = 0; i < x.length; i++) t[i] = x[i] * (1 - d + d * Math.sin((2 * Math.PI * (c.tremolo * i)) / outRate));
    x = t;
  }

  if (spec.sustain) {
    // loop points in source-time, converted into the shifted signal
    const ls = (s.loopStart - s.start) / srcRate;
    const le = (s.loopEnd - s.start) / srcRate;
    const pre = srcRate === OUT_RATE ? 1 : OUT_RATE / srcRate;
    x = extendLoop(x, outRate, ls * pre * ratio, le * pre * ratio, spec.dur || 3.0);
  } else if (x.length > Math.floor(0.9 * outRate)) {
    x = x.subarray(0, Math.floor(0.9 * outRate));
  }

  x = fadeEdges(x, outRate, 2, 14);
  x = normalize(x, c.targetDb ?? -3.5);

  // slight stereo width from a fixed micro-delay so it sits nicer in the mix
  const w = Math.floor(outRate * 0.004);
  let R = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) R[i] = x[Math.max(0, i - w)];

  // Chorus is a stereo effect, so it runs last on both channels. It was defined
  // but never called, so every `chorus:` value in earlier bank specs was a
  // silent no-op. `chorus` is the wet mix (0-1); depth/rate stay musical.
  let outL = x;
  if (c.chorus) {
    const [cl, cr] = chorus(x, R, outRate, 3.5, 0.6, Math.min(0.9, c.chorus));
    outL = cl;
    R = cr;
  }

  return { left: outL, right: R, rate: Math.round(outRate), source: pick.name,
           sourceMidi: Math.round(pick.m.midi * 10) / 10, shift: Math.round(shift * 10) / 10 };
}

const BANK_SETS = { sc55: SC55_BANKS, juno: JUNO_BANKS };

function build(args) {
  const font = args._[0];
  const setName = args.set || "sc55";
  const all = BANK_SETS[setName];
  if (!all) {
    console.error(`unknown --set "${setName}" (known: ${Object.keys(BANK_SETS).join(", ")})`);
    process.exit(1);
  }
  const outRoot = args.out || path.join("public", "banks", "yamaha-eos");
  const only = args.only ? String(args.only).split(",") : null;
  const specs = only ? all.filter((b) => only.includes(b.id)) : all;

  const sf = parseSF2(font);
  const ff = ffmpeg();
  console.log(`font   : ${path.basename(font)}`);
  console.log(`set    : ${setName}`);
  console.log(`ffmpeg : ${ff}`);
  console.log(`banks  : ${specs.length}\n`);

  // measure every pool sample once
  const needed = new Set(specs.flatMap((s) => s.pool));
  const measured = measurePool(sf, needed);
  const instCount = [...measured.values()].reduce((n, a) => n + a.length, 0);
  console.log(`measured ${measured.size}/${needed.size} pool names (${instCount} instances)\n`);

  // a bank with an unresolvable source cannot be trusted: refuse up front
  const missing = [];
  for (const spec of specs) {
    for (const name of spec.pool) {
      if (!measured.has(name) || !measured.get(name).length) missing.push(`${spec.id}: ${name}`);
    }
    for (const note of spec.notes) {
      if (!pickSource(spec.pool, note, measured))
        missing.push(`${spec.id}: no source within reach of note ${note}`);
    }
  }
  if (missing.length) {
    console.error(`ERROR: ${missing.length} unresolved source(s) in the font:`);
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }

  const manifest = {};
  const verbose = !!args.verbose;
  let totalFailures = 0;
  for (const spec of specs) {
    const dir = path.join(outRoot, spec.id);
    // drop stale renders so a shortened bank can never keep orphaned anchors
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    fs.mkdirSync(dir, { recursive: true });
    const anchors = {};
    let total = 0;
    let failures = 0;
    for (const note of spec.notes) {
      let r;
      try { r = renderNote(sf, measured, spec, note); }
      catch (e) { console.error(`  !! ${spec.id} ${note}: ${e.message}`); if (verbose) console.error(e.stack); failures++; continue; }
      const wav = path.join(dir, `${note}.wav`);
      writeWav(wav, [r.left, r.right], r.rate);
      // verify the rendered PCM *before* encoding: the declared rate is exact
      // here, so this check is trustworthy even where pitch detection is not
      const chk = pitchClassPresent(r.left, r.rate, note);
      if (!chk.ok) {
        console.error(`  !! ${spec.id} ${note}: pitch class absent (${(chk.ratio * 100).toFixed(1)}% of peak) - dropped`);
        fs.unlinkSync(wav);
        failures++;
        continue;
      }
      const mp3 = path.join(dir, `${note}.mp3`);
      const q = spawnSync(ff, ["-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame",
        "-b:a", "288k", "-ar", "44100", "-ac", "2", mp3], { encoding: "utf8" });
      if (q.status !== 0) { console.error(`  !! ffmpeg ${note}: ${q.stderr}`); fs.unlinkSync(wav); failures++; continue; }
      fs.unlinkSync(wav);
      anchors[String(note)] = `banks/yamaha-eos/${spec.id}/${note}.mp3`;
      total += fs.statSync(mp3).size;
      if (verbose) {
        console.log(`      ${String(note).padStart(3)} <- ${r.source} ` +
          `(${r.sourceMidi} -> ${note}, shift ${r.shift > 0 ? "+" : ""}${r.shift}) ` +
          `${r.rate}Hz ${(fs.statSync(mp3).size / 1024).toFixed(0)}KB`);
      }
    }
    manifest[spec.id] = { id: spec.id, name: spec.name, anchors };
    console.log(`  ${spec.id.padEnd(22)} ${String(Object.keys(anchors).length).padStart(2)} notes  ` +
      `${(total / 1024).toFixed(0)}KB  (${spec.colorLabel || ""})`);
    if (Object.keys(anchors).length !== spec.notes.length) {
      console.error(`  !! ${spec.id}: only ${Object.keys(anchors).length}/${spec.notes.length} notes built`);
    }
    totalFailures += failures;
  }
  const manifestName = `_${setName}-manifest.json`;
  fs.writeFileSync(path.join(outRoot, manifestName), JSON.stringify(manifest, null, 2));
  console.log(`\nwrote ${outRoot}/${manifestName}`);
  if (totalFailures) {
    console.error(`\nFAILED: ${totalFailures} note(s) could not be built or verified`);
    process.exit(1);
  }
}

function main() {
  const args = parseArgs(process.argv);
  const font = args._[0] || args.font;
  if (!font) {
    console.error("usage: node tools/sc55-bank-builder.mjs <font.sf2> [--set sc55|juno] [--names] [--build] [--only ids] [--out dir]");
    process.exit(1);
  }
  if (args.build) { build(args); return; }

  const sf = parseSF2(font);
  console.log(`font: ${path.basename(font)}`);
  console.log(`  samples=${sf.samples.length - 1}  zones=${sf.zones.length}  presets=${sf.presets.length - 1}\n`);

  // --names: cheap listing of every sample, no pitch analysis (fast)
  if (args.names) {
    const used = new Map();
    for (const z of sf.zones) used.set(z.sample.name, (used.get(z.sample.name) || 0) + 1);
    for (const s of sf.samples) {
      if (!s.end || s.end <= s.start) continue;
      const dur = (s.end - s.start) / s.rate;
      if (dur < 0.05) continue;
      console.log(
        `${s.name.slice(0, 28).padEnd(28)} rate=${String(s.rate).padStart(6)} ` +
        `dur=${dur.toFixed(2).padStart(5)}s loop=${s.loopEnd > s.loopStart ? "y" : "n"} ` +
        `zones=${used.get(s.name) || 0}`,
      );
    }
    return;
  }

  // Probe: measure real pitch of every sample so we can pick genuinely in-tune
  // source material. shdr.byOriginalPitch is 60 for nearly everything in this
  // font, so it cannot be trusted.
  const groups = [
    ["PIANO",   (n) => /piano|^pnf|pflt/i.test(n)],
    ["EP",      (n) => /^ep1|bright ep/i.test(n)],
    ["CLAV",    (n) => /clavinet/i.test(n)],
    ["VIBE",    (n) => /vibe_|^krd vib|^lrd vib|^mrd vib|^nrd vib|raslap/i.test(n)],
    ["ORGAN",   (n) => /rock organ/i.test(n)],
    ["BRASS",   (n) => /brass section/i.test(n)],
    ["POLY",    (n) => /polysynth/i.test(n)],
    ["CHOIR",   (n) => /choir|aaahs|^voice ooohs/i.test(n)],
    ["GUITAR",  (n) => /nylon-str|steelstr|strat|muted guitar|gt\.harmonics|harmon/i.test(n)],
    ["BASS",    (n) => /fretless bass|pick bass|contrabass|slapbass|sawbass|bassoon/i.test(n)],
    ["HORN",    (n) => /^trumpet 1|^trombone 2|^tuba f|alto sax|^sax |_sax|ehorn/i.test(n)],
    ["SAW",     (n) => /^saw|^01-rock|^sft |fantasia/i.test(n)],
    ["MELODIC", (n) => /^bowed|flute|marimba|harmonica|accordion|shaku|tubebell|synth harp/i.test(n)],
  ];
  for (const [label, test] of groups) {
    const rows = [];
    for (const s of sf.samples) {
      if (!test(s.name) || s.end <= s.start) continue;
      const pcm = samplePCM(sf, s);
      if (pcm.length < 1024) continue;
      const hz = detectPitch(analysisWindow(pcm, s.rate), s.rate);
      if (!hz) continue;
      rows.push({ name: s.name, midi: hzToMidi(hz), hz, dur: pcm.length / s.rate, rate: s.rate, rms: rmsDb(pcm) });
    }
    if (!rows.length) continue;
    console.log(`### ${label}`);
    for (const r of rows.sort((a, b) => a.midi - b.midi)) {
      const nn = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
      const m = Math.round(r.midi);
      console.log(
        `   ${r.name.slice(0, 26).padEnd(26)} midi=${String(m).padStart(3)}(${nn[m % 12]}${Math.floor(m / 12) - 1})` +
        `  hz=${r.hz.toFixed(1).padStart(7)}  dur=${r.dur.toFixed(2)}s  rms=${r.rms.toFixed(1)}dB`,
      );
    }
    console.log();
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("sc55-bank-builder.mjs")) {
  main();
}
