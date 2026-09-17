/**
 * Wilsonix MIDIKey - Studio-Grade Sample Sustain Looper & Zero-Crossing Alignment
 * Produces imperceptible, smooth sustain loops on one-shot synth samples (Leads, Saws,
 * Pads, Vocal Synths, Reeses, Basses) using:
 * 1. Pitch-synchronous fundamental period detection (Autocorrelation)
 * 2. Phase-locked integer-multiple cycle boundaries
 * 3. Positive-slope zero-crossing snapping
 * 4. Equal-power symmetrical crossfading (cos/sin curve, zero volume dip)
 * 5. Steady-state RMS energy leveling across the loop body
 */

/**
 * Configure seamless sustain looping on an AudioBuffer if it is a sustaining instrument.
 * @param {AudioBuffer} audioBuf - Decoded AudioBuffer
 * @param {string} subCategory - Instrument subCategory or category string
 * @param {string} instId - Instrument identifier
 * @returns {AudioBuffer}
 */
export function configureSustainLoop(audioBuf, subCategory = "", instId = "") {
  if (!audioBuf) return audioBuf;

  const sub = String(subCategory || "").toLowerCase();
  const id = String(instId || "").toLowerCase();

  // One-shot percussive sounds & FX should naturally decay rather than loop
  const isOneShot =
    sub.includes("pluck") ||
    sub.includes("impact") ||
    sub.includes("downlifter") ||
    sub.includes("riser") ||
    sub.includes("fx") ||
    sub.includes("drum") ||
    sub.includes("kick") ||
    sub.includes("snare") ||
    sub.includes("hihat") ||
    id.includes("drop_pluck") ||
    id.includes("glassy_pluck") ||
    id.includes("fx_");

  if (isOneShot) {
    audioBuf._isLoopable = false;
    return audioBuf;
  }

  const duration = audioBuf.duration;
  // If sample is reasonably long enough to establish a sustain body (> 0.45s)
  if (duration >= 0.45) {
    const sr = audioBuf.sampleRate;
    const totalFrames = audioBuf.length;
    const dataL = audioBuf.getChannelData(0);
    const numChannels = audioBuf.numberOfChannels;

    // Probe steady-state body after attack transient settles (~22% to 28%)
    const probeStart = Math.max(Math.floor(sr * 0.22), Math.floor(totalFrames * 0.25));
    const winLen = Math.floor(sr * 0.04); // 40ms analysis window
    const minLag = Math.floor(sr / 1500); // 1500 Hz
    const maxLag = Math.floor(sr / 40);   // 40 Hz

    // 1. Detect fundamental pitch period via autocorrelation
    let bestPeriod = Math.floor(sr / 261.63); // default ~C4 (168 samples at 44.1k)
    let maxR = -1;

    if (probeStart + winLen + maxLag < totalFrames) {
      for (let lag = minLag; lag <= maxLag; lag++) {
        let num = 0, den1 = 0, den2 = 0;
        for (let i = 0; i < winLen; i++) {
          const x1 = dataL[probeStart + i];
          const x2 = dataL[probeStart + i + lag];
          num += x1 * x2;
          den1 += x1 * x1;
          den2 += x2 * x2;
        }
        const r = num / (Math.sqrt(den1 * den2) + 1e-9);
        if (r > maxR) {
          maxR = r;
          bestPeriod = lag;
        }
      }
    }

    // 2. Snap startFrame to rising zero-crossing near probeStart
    let startFrame = probeStart;
    const zcSearchRange = Math.min(bestPeriod * 2, Math.floor(sr * 0.05));
    for (let i = startFrame; i < startFrame + zcSearchRange && i < totalFrames - 1; i++) {
      if (dataL[i] <= 0 && dataL[i + 1] > 0) {
        startFrame = i;
        break;
      }
    }

    // 3. Find endFrame that is an exact integer multiple of bestPeriod (phase-locked)
    const targetEnd = Math.min(totalFrames - Math.floor(sr * 0.05), Math.floor(totalFrames * 0.85));
    const numPeriods = Math.max(2, Math.round((targetEnd - startFrame) / bestPeriod));
    let endFrame = startFrame + numPeriods * bestPeriod;

    // Fine-tune endFrame to rising zero crossing within +/- half period
    const halfPeriod = Math.floor(bestPeriod / 2);
    let minDelta = Infinity;
    let bestZc = endFrame;
    for (let i = endFrame - halfPeriod; i <= endFrame + halfPeriod && i < totalFrames - 1; i++) {
      if (dataL[i] <= 0 && dataL[i + 1] > 0) {
        if (Math.abs(i - endFrame) < minDelta) {
          minDelta = Math.abs(i - endFrame);
          bestZc = i;
        }
      }
    }
    endFrame = bestZc;

    if (endFrame > startFrame + Math.floor(sr * 0.20)) {
      const loopLen = endFrame - startFrame;

      // 4. RMS Energy Leveling across the loop body to prevent periodic volume pumping
      const halfLoop = Math.floor(loopLen / 2);
      let sumRms1 = 0, sumRms2 = 0;
      for (let i = 0; i < halfLoop; i++) {
        sumRms1 += dataL[startFrame + i] ** 2;
        sumRms2 += dataL[startFrame + halfLoop + i] ** 2;
      }
      const rms1 = Math.sqrt(sumRms1 / halfLoop);
      const rms2 = Math.sqrt(sumRms2 / halfLoop);

      // If the natural one-shot decays over the loop body, compensate with smooth slope
      if (rms1 > 0.01 && rms2 > 0.005) {
        const decayRatio = rms1 / rms2;
        // Clamp gain compensation between 0.75 and 1.5 to prevent over-boosting background noise
        const targetGain = Math.max(0.75, Math.min(1.5, decayRatio));
        if (Math.abs(targetGain - 1.0) > 0.04) {
          for (let ch = 0; ch < numChannels; ch++) {
            const chData = audioBuf.getChannelData(ch);
            for (let i = 0; i < loopLen; i++) {
              const prog = i / loopLen;
              const gain = 1.0 + (targetGain - 1.0) * prog;
              chData[startFrame + i] = Math.max(-1.0, Math.min(1.0, chData[startFrame + i] * gain));
            }
          }
        }
      }

      // 5. Phase-aligned equal-power crossfade at the seam (endFrame into startFrame)
      // Target 60ms to 120ms crossfade, locked to integer multiple of wave period
      const targetXfadeSec = 0.085;
      const numXfadePeriods = Math.max(2, Math.floor((sr * targetXfadeSec) / bestPeriod));
      const xfadeLen = Math.min(Math.floor(loopLen * 0.28), numXfadePeriods * bestPeriod);

      if (xfadeLen > 16 && startFrame >= xfadeLen) {
        for (let ch = 0; ch < numChannels; ch++) {
          const chData = audioBuf.getChannelData(ch);
          for (let k = 0; k < xfadeLen; k++) {
            const t = k / xfadeLen;
            // Equal-power crossfade curve: cos^2 + sin^2 = 1.0 (zero volume dip)
            const wOut = Math.cos(t * Math.PI * 0.5);
            const wIn = Math.sin(t * Math.PI * 0.5);

            const endIdx = endFrame - xfadeLen + k;
            const refIdx = startFrame - xfadeLen + k;

            if (endIdx < chData.length) {
              const sOut = chData[endIdx];
              const sIn = refIdx >= 0 ? chData[refIdx] : chData[startFrame + k];
              chData[endIdx] = sOut * wOut + sIn * wIn;
            }
          }
        }
      }

      audioBuf._isLoopable = true;
      audioBuf._loopStartSec = startFrame / sr;
      audioBuf._loopEndSec = endFrame / sr;
    }
  }

  return audioBuf;
}
