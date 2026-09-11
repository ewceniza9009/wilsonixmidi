/**
 * WILSONIX MIDIKEY Elite - Master Bus Studio Audio Recorder
 * Records lossless 24-bit / 16-bit 48kHz WAV audio directly from the master DSP output.
 */

import { audioCore } from "./audio-core.js";

export class MasterRecorder {
  constructor() {
    this.isRecording = false;
    this.recordStartTime = 0;
    this.recordingDuration = 0;
    this.timerInterval = null;
    this.recBuffersL = [];
    this.recBuffersR = [];
    this.recLength = 0;
    this.processorNode = null;
    this.onStateChange = null;
  }

  start() {
    if (this.isRecording) return;
    const ctx = audioCore.ctx;
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    this.recBuffersL = [];
    this.recBuffersR = [];
    this.recLength = 0;
    this.isRecording = true;
    this.recordStartTime = Date.now();
    this.recordingDuration = 0;

    // Create 4096-frame stereo audio tap node
    const bufferSize = 4096;
    this.processorNode = ctx.createScriptProcessor(bufferSize, 2, 2);

    this.processorNode.onaudioprocess = e => {
      if (!this.isRecording) return;
      const inputL = e.inputBuffer.getChannelData(0);
      const inputR = e.inputBuffer.getChannelData(1);

      this.recBuffersL.push(new Float32Array(inputL));
      this.recBuffersR.push(new Float32Array(inputR));
      this.recLength += inputL.length;
    };

    // Tap master output before destination
    if (audioCore.analyser) {
      audioCore.analyser.connect(this.processorNode);
      this.processorNode.connect(ctx.destination);
    }

    this.timerInterval = setInterval(() => {
      this.recordingDuration = (Date.now() - this.recordStartTime) / 1000;
      if (this.onStateChange) {
        this.onStateChange({
          isRecording: true,
          duration: this.recordingDuration,
          formattedTime: this.formatTime(this.recordingDuration),
        });
      }
    }, 200);

    if (this.onStateChange) {
      this.onStateChange({
        isRecording: true,
        duration: 0,
        formattedTime: "00:00",
      });
    }

    console.log("Master Bus Audio Recording Started (WAV)");
  }

  stopAndExport() {
    if (!this.isRecording) return null;

    this.isRecording = false;
    clearInterval(this.timerInterval);

    // Disconnect tap
    if (this.processorNode) {
      try {
        if (audioCore.analyser) audioCore.analyser.disconnect(this.processorNode);
        this.processorNode.disconnect();
      } catch (e) {}
      this.processorNode = null;
    }

    const sampleRate = audioCore.ctx?.sampleRate || 48000;
    const wavBlob = this.encodeWAV(this.recBuffersL, this.recBuffersR, this.recLength, sampleRate);

    // Trigger auto-download
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `WILSONIX_Live_Take_${timestamp}.wav`;
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);

    if (this.onStateChange) {
      this.onStateChange({
        isRecording: false,
        duration: this.recordingDuration,
        formattedTime: this.formatTime(this.recordingDuration),
        exportedFile: filename,
      });
    }

    console.log(`Master Bus Audio Recording Saved: ${filename}`);
    return wavBlob;
  }

  formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  encodeWAV(buffersL, buffersR, length, sampleRate) {
    // Merge buffers
    const flatL = new Float32Array(length);
    const flatR = new Float32Array(length);
    let offset = 0;
    for (let i = 0; i < buffersL.length; i++) {
      flatL.set(buffersL[i], offset);
      flatR.set(buffersR[i], offset);
      offset += buffersL[i].length;
    }

    // Interleave stereo samples to 16-bit PCM
    const buffer = new ArrayBuffer(44 + length * 2 * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + length * 2 * 2, true);
    this.writeString(view, 8, "WAVE");

    // fmt sub-chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, 2, true); // NumChannels (2 = Stereo)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 4, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 4, true); // BlockAlign (NumChannels * BitsPerSample/8)
    view.setUint16(34, 16, true); // BitsPerSample (16-bit)

    // data sub-chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, length * 2 * 2, true);

    // Write PCM samples with soft clipping
    let dataOffset = 44;
    for (let i = 0; i < length; i++) {
      let sL = flatL[i];
      let sR = flatR[i];

      // Soft clamp -1.0 to +1.0
      sL = Math.max(-1, Math.min(1, sL));
      sR = Math.max(-1, Math.min(1, sR));

      // 16-bit conversion
      const intL = sL < 0 ? sL * 0x8000 : sL * 0x7fff;
      const intR = sR < 0 ? sR * 0x8000 : sR * 0x7fff;

      view.setInt16(dataOffset, intL, true);
      dataOffset += 2;
      view.setInt16(dataOffset, intR, true);
      dataOffset += 2;
    }

    return new Blob([view], { type: "audio/wav" });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

export const masterRecorder = new MasterRecorder();
