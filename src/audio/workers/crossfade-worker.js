/**
 * Crossfade Loop Buffer Worker
 * Offloads peak detection, zero-crossing correlation, and crossfade processing from the main thread.
 * Pure TypedArray DSP - zero DOM / OfflineAudioContext dependencies.
 */

function isDroneInstrument(instId) {
  if (!instId) return false;
  const droneKeywords = [
    "string", "pad", "choir", "organ", "voice", "vox", "universe",
    "sax", "bass", "flute", "clarinet", "trumpet", "trombone",
    "violin", "cello", "brass", "saw", "extacy", "vocoder", "synth",
    "lead", "square", "thicksaw", "sweeppad", "warmpad", "seq_", "dreamn"
  ];
  return droneKeywords.some((k) => instId.includes(k)) && !instId.startsWith("tekk_");
}

function fadeEndInPlace(channelData, numChannels, totalSamples, sampleRate, seconds) {
  const fadeLen = Math.min(
    Math.floor(sampleRate * seconds),
    Math.floor(totalSamples * 0.25)
  );
  if (fadeLen < 32) return;
  for (let c = 0; c < numChannels; c++) {
    const d = channelData[c];
    for (let i = 0; i < fadeLen; i++) {
      const t = i / fadeLen;
      d[totalSamples - fadeLen + i] *= 0.5 * (1 + Math.cos(t * Math.PI));
    }
  }
}

self.onmessage = (e) => {
  const { type, id, payload } = e.data || {};
  if (type === "process" && payload) {
    try {
      const {
        numChannels,
        length: totalSamples,
        sampleRate,
        instId,
        channelData, // Array of Float32Array transferred from main thread
      } = payload;

      if (!channelData || channelData.length === 0) {
        throw new Error("Missing channelData in crossfade worker payload");
      }

      // 1. Check if this is a drone instrument
      const isDrone = isDroneInstrument(instId);
      if (!isDrone || totalSamples / sampleRate < 0.8) {
        fadeEndInPlace(channelData, numChannels, totalSamples, sampleRate, 0.4);
        self.postMessage(
          {
            type: "result",
            id,
            payload: {
              channelData,
              numChannels,
              length: totalSamples,
              sampleRate,
              isLoopable: false,
              loopStartSec: 0,
              loopEndSec: 0,
            },
          },
          channelData.map((d) => d.buffer)
        );
        return;
      }

      // 2. Loop & Crossfade calculation
      const fadeSamples = Math.min(
        Math.floor(sampleRate * 0.06),
        Math.floor(totalSamples * 0.06)
      );
      const loopEndSample = totalSamples - fadeSamples;
      const minLoopLen = Math.min(
        Math.floor(sampleRate * 0.5),
        Math.floor(totalSamples * 0.2)
      );
      const searchFrom = Math.floor(totalSamples * 0.15);
      const searchTo = loopEndSample - minLoopLen;

      if (searchTo <= searchFrom || fadeSamples < 64) {
        fadeEndInPlace(channelData, numChannels, totalSamples, sampleRate, 0.3);
        self.postMessage(
          {
            type: "result",
            id,
            payload: {
              channelData,
              numChannels,
              length: totalSamples,
              sampleRate,
              isLoopable: false,
              loopStartSec: 0,
              loopEndSec: 0,
            },
          },
          channelData.map((d) => d.buffer)
        );
        return;
      }

      const ref = channelData[0];
      let sum = 0;
      let cnt = 0;
      for (let i = searchFrom; i < loopEndSample; i += 7) {
        sum += ref[i] * ref[i];
        cnt++;
      }
      const rms = Math.sqrt(sum / Math.max(1, cnt));
      if (rms < 0.001) {
        fadeEndInPlace(channelData, numChannels, totalSamples, sampleRate, 0.3);
        self.postMessage(
          {
            type: "result",
            id,
            payload: {
              channelData,
              numChannels,
              length: totalSamples,
              sampleRate,
              isLoopable: false,
              loopStartSec: 0,
              loopEndSec: 0,
            },
          },
          channelData.map((d) => d.buffer)
        );
        return;
      }

      const W = Math.min(1024, fadeSamples * 2);
      const endBase = loopEndSample - W;
      const threshold = rms * 0.45;
      let loopStartSample = -1;

      for (let s = searchFrom; s <= searchTo; s += 256) {
        let diff = 0;
        for (let i = 0; i < W; i += 2) {
          const d = ref[s + i] - ref[endBase + i];
          diff += d * d;
        }
        diff = Math.sqrt(diff / (W / 2));
        if (diff < threshold) {
          loopStartSample = s;
          break;
        }
      }

      if (loopStartSample < 0) {
        fadeEndInPlace(channelData, numChannels, totalSamples, sampleRate, 0.3);
        self.postMessage(
          {
            type: "result",
            id,
            payload: {
              channelData,
              numChannels,
              length: totalSamples,
              sampleRate,
              isLoopable: false,
              loopStartSec: 0,
              loopEndSec: 0,
            },
          },
          channelData.map((d) => d.buffer)
        );
        return;
      }

      // 3. Build crossfaded output channels
      const outChannels = [];
      for (let ch = 0; ch < numChannels; ch++) {
        const srcCh = Math.min(ch, channelData.length - 1);
        const src = channelData[srcCh];
        const dst = new Float32Array(loopEndSample);

        // Pre-loop
        for (let i = 0; i < loopStartSample; i++) dst[i] = src[i];

        // Crossfade blend region
        for (let i = 0; i < fadeSamples; i++) {
          const t = i / fadeSamples;
          const gainTail = Math.cos(t * Math.PI * 0.5);
          const gainHead = Math.sin(t * Math.PI * 0.5);
          const headIdx = loopStartSample + i;
          const tailIdx = loopEndSample + i;
          dst[headIdx] = src[tailIdx] * gainTail + src[headIdx] * gainHead;
        }

        // Post-loop
        for (let i = loopStartSample + fadeSamples; i < loopEndSample; i++) {
          dst[i] = src[i];
        }
        outChannels.push(dst);
      }

      // 4. Stereo rescue for panned-mono sources
      if (outChannels.length >= 2) {
        const ch0 = outChannels[0];
        const ch1 = outChannels[1];
        let ch0Sum = 0;
        let ch1Sum = 0;
        for (let i = 0; i < Math.min(1000, ch0.length); i += 10) {
          ch0Sum += Math.abs(ch0[i]);
          ch1Sum += Math.abs(ch1[i]);
        }
        if (ch0Sum > 0.001 && ch1Sum < 0.00005) {
          ch1.set(ch0);
        }
      }

      self.postMessage(
        {
          type: "result",
          id,
          payload: {
            channelData: outChannels,
            numChannels,
            length: loopEndSample,
            sampleRate,
            isLoopable: true,
            loopStartSec: loopStartSample / sampleRate,
            loopEndSec: loopEndSample / sampleRate,
          },
        },
        outChannels.map((d) => d.buffer)
      );
    } catch (err) {
      self.postMessage({ type: "error", id, error: err.message || String(err) });
    }
  }
};
