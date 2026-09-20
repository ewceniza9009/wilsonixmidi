/**
 * Wilsonix MIDIKEY - Loop Detection Worker
 * Offloads CPU-intensive sustain loop detection (autocorrelation, zero-crossing,
 * RMS leveling) from the main thread to prevent audio thread jitter under heavy
 * polyphonic load. Returns loop parameters; buffer modification is handled by
 * the caller on the main thread.
 */

self.onmessage = function(e) {
  try {
    const { audioBufferL, sampleRate, subCategory = "", instId = "" } = e.data || {};

    if (!audioBufferL || !sampleRate || sampleRate <= 0) {
      self.postMessage({ isLoopable: false, success: false, error: "Invalid audio data" });
      return;
    }

    const sub = String(subCategory || "").toLowerCase();
    const id = String(instId || "").toLowerCase();
    const duration = audioBufferL.length / sampleRate;
    const totalFrames = audioBufferL.length;

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
      self.postMessage({ isLoopable: false, success: true });
      return;
    }

    // If sample is reasonably long enough to establish a sustain body (> 0.45s)
    if (duration >= 0.45) {
      const sr = sampleRate;
      const dataL = audioBufferL;

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

      const result = {
        isLoopable: false,
        success: true
      };

      if (endFrame > startFrame + Math.floor(sr * 0.20)) {
        result.isLoopable = true;
        result.loopStart = startFrame / sr;
        result.loopEnd = endFrame / sr;
        result.loopLength = (endFrame - startFrame) / sr;

        // 4. RMS Energy Leveling (compensation data for main thread)
        const halfLoop = Math.floor((endFrame - startFrame) / 2);
        let sumRms1 = 0, sumRms2 = 0;
        for (let i = 0; i < halfLoop; i++) {
          sumRms1 += dataL[startFrame + i] ** 2;
          sumRms2 += dataL[startFrame + halfLoop + i] ** 2;
        }
        const rms1 = Math.sqrt(sumRms1 / halfLoop);
        const rms2 = Math.sqrt(sumRms2 / halfLoop);

        if (rms1 > 0.01 && rms2 > 0.005) {
          const decayRatio = rms1 / rms2;
          const targetGain = Math.max(0.75, Math.min(1.5, decayRatio));
          result.rmsCompensation = {
            targetGain,
            needsAdjustment: Math.abs(targetGain - 1.0) > 0.04
          };
        }

        // 5. Crossfade parameters (for main thread application)
        const targetXfadeSec = 0.085;
        const numXfadePeriods = Math.max(2, Math.floor((sr * targetXfadeSec) / bestPeriod));
        result.xfadeLen = Math.min(Math.floor((endFrame - startFrame) * 0.28), numXfadePeriods * bestPeriod);
        result.xfadeStart = startFrame;
        result.xfadeEnd = endFrame;
      }

      self.postMessage(result);
      return;
    }

    self.postMessage({ isLoopable: false, success: true });
  } catch (err) {
    self.postMessage({ isLoopable: false, success: false, error: err.message || String(err) });
  }
};