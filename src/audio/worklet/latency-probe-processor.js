/**
 * Acoustic loopback probe (AudioWorklet).
 *
 * Sits on the microphone capture stream and posts the precise AudioWorklet
 * clock time of every transient it hears. The main thread schedules click
 * bursts at known ctx.currentTime values and subtracts them from these
 * detection times — that difference is the REAL speaker→mic audio path,
 * measured end to end instead of guessed from API reports.
 *
 * Detection strategy:
 *  - The first CALIBRATION_SEC of stream audio sets the ambient noise peak.
 *  - A detection fires when a block peak exceeds max(ambient*4, 0.02).
 *  - A refractory window suppresses re-triggers on click tails/room bounce.
 */

const CALIBRATION_SEC = 0.35;
const REFRACTORY_SEC = 0.18;

class LatencyProbeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._start = currentTime;
    this._ambientPeak = 0.004;
    this._lastDetect = -10;
  }

  process(inputs) {
    const input = inputs[0];
    const ch = input && input[0];
    if (!ch) return true;

    let peak = 0;
    for (let i = 0; i < ch.length; i++) {
      const a = ch[i] < 0 ? -ch[i] : ch[i];
      if (a > peak) peak = a;
    }

    const t = currentTime;

    if (t - this._start < CALIBRATION_SEC) {
      if (peak > this._ambientPeak) this._ambientPeak = peak;
      return true;
    }

    const threshold = Math.max(this._ambientPeak * 4, 0.02);
    if (peak >= threshold && t - this._lastDetect >= REFRACTORY_SEC) {
      this._lastDetect = t;
      this.port.postMessage({ type: "detect", t, peak });
    }
    return true;
  }
}

registerProcessor("wilsonix-latency-probe", LatencyProbeProcessor);
