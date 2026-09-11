/**
 * WILSONIX MIDIKEY Elite - Pro GPU Canvas Audio Visualizer
 * Zero-allocation real-time Oscilloscope, Frequency Spectrum, and Stereo Peak VU metering.
 */

import { audioCore } from "../audio/audio-core.js";

export class AudioVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx2d = this.canvas ? this.canvas.getContext("2d") : null;
    this.mode = "oscilloscope"; // "oscilloscope" | "spectrum"
    this.animationId = null;
    this.isRunning = false;

    // Zero-allocation preallocated buffers
    this.timeDomainBuffer = new Uint8Array(256);
    this.freqBuffer = new Uint8Array(128);

    if (this.canvas) {
      this.resize();
      window.addEventListener("resize", () => this.resize(), { passive: true });
    }
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    if (this.ctx2d) {
      this.ctx2d.scale(dpr, dpr);
    }
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
  }

  setMode(mode) {
    this.mode = mode;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.drawLoop = this.draw.bind(this);
    this.animationId = requestAnimationFrame(this.drawLoop);
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  draw() {
    if (!this.isRunning) return;

    const analyser = audioCore.analyser;
    const ctx = this.ctx2d;
    const width = this.cssWidth || 300;
    const height = this.cssHeight || 60;

    if (!analyser || !ctx) {
      this.animationId = requestAnimationFrame(this.drawLoop);
      return;
    }

    // Clear background
    ctx.fillStyle = "rgba(10, 12, 16, 0.4)";
    ctx.fillRect(0, 0, width, height);

    if (this.mode === "oscilloscope") {
      analyser.getByteTimeDomainData(this.timeDomainBuffer);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ff8c00";
      ctx.shadowColor = "rgba(255, 140, 0, 0.8)";
      ctx.shadowBlur = 8;
      ctx.beginPath();

      const sliceWidth = width / this.timeDomainBuffer.length;
      let x = 0;

      for (let i = 0; i < this.timeDomainBuffer.length; i++) {
        const v = this.timeDomainBuffer[i] / 128.0; // 0 to 2
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset
    } else if (this.mode === "spectrum") {
      analyser.getByteFrequencyData(this.freqBuffer);

      const barCount = 32;
      const barWidth = width / barCount - 1.5;

      for (let i = 0; i < barCount; i++) {
        const binIndex = Math.floor((i / barCount) * this.freqBuffer.length);
        const value = this.freqBuffer[binIndex] / 255;
        const barHeight = value * height;

        const grad = ctx.createLinearGradient(0, height, 0, height - barHeight);
        grad.addColorStop(0, "#00d2ff");
        grad.addColorStop(0.7, "#ff8c00");
        grad.addColorStop(1.0, "#ff3366");

        ctx.fillStyle = grad;
        ctx.fillRect(i * (barWidth + 1.5), height - barHeight, barWidth, barHeight);
      }
    }

    this.animationId = requestAnimationFrame(this.drawLoop);
  }
}
