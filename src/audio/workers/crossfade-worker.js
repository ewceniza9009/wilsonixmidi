/**
 * Crossfade Loop Buffer Worker
 * Offloads peak detection, loop finding, and crossfade processing from main thread
 */

// Message types
const MSG_TYPES = {
  PROCESS: 'process',
  RESULT: 'result',
  ERROR: 'error'
};

// Detect drone instruments (sustained sounds that need loop points)
function isDroneInstrument(instId) {
  if (!instId) return false;
  const droneKeywords = [
    'string', 'pad', 'choir', 'organ', 'voice', 'vox', 'universe',
    'sax', 'bass', 'flute', 'clarinet', 'trumpet', 'trombone',
    'violin', 'cello', 'brass', 'saw', 'extacy', 'vocoder', 'synth',
    'lead', 'square', 'thicksaw', 'sweeppad', 'warmpad', 'seq_', 'dreamn'
  ];
  return droneKeywords.some(k => instId.includes(k)) || instId.startsWith('tekk_');
}

async function fadeBufferEnd(originalBuf, fadeSec) {
  const ctx = new OfflineAudioContext(originalBuf.numberOfChannels, originalBuf.length, originalBuf.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = originalBuf;
  const gain = ctx.createGain();
  const fadeTime = Math.min(fadeSec, originalBuf.duration * 0.5);
  gain.gain.setValueAtTime(1, 0);
  gain.gain.linearRampToValueAtTime(0, originalBuf.duration - fadeTime);
  src.connect(gain).connect(ctx.destination);
  src.start(0);
  return ctx.startRendering();
}

async function processCrossfade(audioData, sampleRate, instId, numChannels, fadeDuration = 0.06) {
  // Reconstruct AudioBuffer from channel data
  const audioCtx = new OfflineAudioContext(audioData.numChannels, audioData.length, audioData.sampleRate);
  for (let ch = 0; ch < audioData.numChannels; ch++) {
    audioCtx.getChannelData(ch).set(audioData[ch]);
  }
  const originalBuf = audioCtx.getBuffer();

  let loopable = false;
  let loopStartSec = 0;
  let loopEndSec = 0;
  const fadeSamples = Math.min(
    Math.floor(sampleRate * 0.06),
    Math.floor(audioData.length * 0.06)
  );
  const totalSamples = audioData.length;

  const loopEndSample = totalSamples - fadeSamples;

  // For non-drone or short buffers, just fade the end
  const isDrone = isDroneInstrument(instId);
  if (!isDrone || totalSamples / sampleRate < 0.8) {
    const buf = await fadeBufferEnd(originalBuf, 0.3);
    return { audioBuffer: buf, loopable: false };
  }

  // Find loop start using zero-crossing correlation
  const ref = audioData[0];
  let sum = 0, cnt = 0;
  const searchFrom = Math.floor(totalSamples * 0.15);
  const searchTo = loopEndSample - Math.min(
    Math.floor(sampleRate * 0.5),
    Math.floor(totalSamples * 0.2)
  );

  if (searchTo <= searchFrom || fadeSamples < 64) {
    const buf = await fadeBufferEnd(originalBuf, 0.3);
    return { audioBuffer: buf, loopable: false };
  }

  for (let i = 0; i < loopEndSample; i += 7) {
    sum += ref[i] * ref[i];
    cnt++;
  }
  const rms = Math.sqrt(sum / Math.max(1, cnt));
  if (rms < 0.001) {
    const buf = await fadeBufferEnd(originalBuf, 0.3);
    return { audioBuffer: buf, loopable: false };
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
    diff = Math.sqrt(diff / Math.max(1, W / 2));
    if (diff < threshold) {
      loopStartSample = s;
      break;
    }
  }

  if (loopStartSample < 0) {
    const buf = await fadeBufferEnd(originalBuf, 0.3);
    return { audioBuffer: buf, loopable: false };
  }

  // Create crossfaded buffer
  const newCtx = new OfflineAudioContext(numChannels, loopEndSample, sampleRate);
  for (let ch = 0; ch < numChannels; ch++) {
    const src = audioData[ch];
    const dst = newCtx.getChannelData(ch);

    // Pre-loop
    for (let i = 0; i < loopStartSample; i++) dst[i] = audioData[ch][i];

    // Crossfade
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const gainTail = Math.cos(i / fadeSamples * Math.PI * 0.5);
      const gainHead = Math.sin(i / fadeSamples * Math.PI * 0.5);
      const headIdx = loopStartSample + i;
      const tailIdx = loopEndSample + i;
      dst[headIdx] = audioData[ch][tailIdx] * gainTail + audioData[ch][headIdx] * gainHead;
    }

    // Post-loop
    for (let i = loopStartSample + fadeSamples; i < loopEndSample; i++) {
      dst[i] = audioData[ch][i];
    }
  }

  const newBuf = await newCtx.startRendering();
  newBuf._isLoopable = true;
  newBuf._loopStartSec = loopStartSample / sampleRate;
  newBuf._loopEndSec = loopEndSample / sampleRate;

  // Transfer back channel data
  const channelData = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(newBuf.getChannelData(ch));
  }

  return {
    channelData,
    sampleRate,
    numChannels,
    length: loopEndSample,
    loopable: true,
    loopStartSec: loopStartSample / sampleRate,
    loopEndSec: loopEndSample / sampleRate
  };
}

// Message handler
self.onmessage = async (e) => {
  const { type, payload, id } = e.data;

  if (type === MSG_TYPES.PROCESS) {
    try {
      const [audioData, sampleRate, instId, numChannels] = payload;
      const result = await processCrossfade(audioData, sampleRate, instId, numChannels);
      self.postMessage({ type: MSG_TYPES.RESULT, id, payload: result });
    } catch (err) {
      self.postMessage({ type: MSG_TYPES.ERROR, id, error: err.message });
    }
  }
};

export {}; // Make this a module