/**
 * 6-Stage Feedforward Vintage Analog Stereo Phaser
 * 100% Feedforward Architecture (Zero Feedback Loops = 0% Risk of Ringing or Feedback Accumulation).
 * 4 staggered allpass poles per channel with quadrature phase-inverted stereo LFO sweep.
 *
 * Performance notes (Android/tablet):
 * - The source is split by a ChannelSplitter so each channel gets its own mono
 *   allpass chain: a stereo source keeps its image, and only 4 biquads (not 8
 *   stereo ones) run per side.
 * - The LFO is control-rate JS (~60Hz) writing `frequency.value` directly.
 *   Connecting an audio node to an AudioParam forces a-rate evaluation, which
 *   makes Chromium recompute every biquad's coefficients per sample (tan/sin x8
 *   x128 frames per render quantum) — that overruns the audio thread on
 *   mid-range mobile and shows up as xruns, crackles and delayed onset.
 */

const POLE_FREQUENCIES = [400, 800, 1600, 3200];
const LFO_TICK_MS = 16; // ~60Hz control rate

export class StereoPhaser {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.rate = 0.65; // Hz
    this.depth = 1400; // Hz sweep
    this.enabled = false;

    this._lfoRunning = false;
    this._lfoPhase = 0;
    this._lfoLastTs = 0;
    this._lfoTimer = null;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Per-channel split: mono chains, true stereo wet path. Splitter
    // channelCount is fixed at 2 (explicit), so a mono source is up-mixed
    // to L=R and both chains still receive it.
    this.splitter = ctx.createChannelSplitter(2);
    this.input.connect(this.splitter);

    this.leftFilters = [];
    this.rightFilters = [];
    let prevL = this.splitter;
    let prevR = this.splitter;

    for (let i = 0; i < POLE_FREQUENCIES.length; i++) {
      const baseF = POLE_FREQUENCIES[i];

      const apL = ctx.createBiquadFilter();
      apL.type = "allpass";
      apL.frequency.value = baseF;
      apL.Q.value = 1.6;
      prevL.connect(apL);
      prevL = apL;
      this.leftFilters.push(apL);

      const apR = ctx.createBiquadFilter();
      apR.type = "allpass";
      apR.frequency.value = baseF;
      apR.Q.value = 1.6;
      prevR.connect(apR);
      prevR = apR;
      this.rightFilters.push(apR);
    }

    // Stereo Merger: chain L -> output 0, chain R -> output 1
    this.merger = ctx.createChannelMerger(2);
    prevL.connect(this.merger, 0, 0);
    prevR.connect(this.merger, 0, 1);

    this.merger.connect(this.wetGain);
    this.wetGain.gain.value = 0.0; // Bypassed by default
    this.wetGain.connect(this.output);
  }

  _startLfo() {
    if (this._lfoRunning) return;
    this._lfoRunning = true;
    this._lfoLastTs = 0;
    const tick = () => {
      if (!this._lfoRunning) return;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (!this._lfoLastTs) this._lfoLastTs = now;
      const dt = Math.min(0.25, (now - this._lfoLastTs) / 1000);
      this._lfoLastTs = now;
      this._lfoPhase = (this._lfoPhase + 2 * Math.PI * this.rate * dt) % (2 * Math.PI);
      this._applyLfo();
      this._scheduleTick(tick);
    };
    this._applyLfo();
    this._scheduleTick(tick);
  }

  _scheduleTick(tick) {
    this._lfoTimer = setTimeout(tick, LFO_TICK_MS);
    // Node (tests): don't hold the process open. Browsers return a number.
    if (this._lfoTimer && typeof this._lfoTimer.unref === "function") {
      this._lfoTimer.unref();
    }
  }

  _stopLfo() {
    if (!this._lfoRunning) return;
    this._lfoRunning = false;
    if (this._lfoTimer) {
      clearTimeout(this._lfoTimer);
      this._lfoTimer = null;
    }
  }

  _applyLfo() {
    const s = Math.sin(this._lfoPhase);
    for (let i = 0; i < POLE_FREQUENCIES.length; i++) {
      const baseF = POLE_FREQUENCIES[i];
      this.leftFilters[i].frequency.value = baseF * (1 + 0.35 * s);
      this.rightFilters[i].frequency.value = baseF * (1 - 0.35 * s);
    }
  }

  setRate(hz) {
    this.rate = Math.max(0.05, Math.min(8.0, hz));
  }

  setFeedback(_val) {}

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    if (this.enabled) {
      this._applyMixGains(0.02);
    }
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    if (bypassed) {
      this._stopLfo();
      this._applyMixGains(0.015, true);
    } else {
      this._startLfo();
      this._applyMixGains(0.015, false);
    }
  }

  _applyMixGains(timeConstant, forceDryOnly = false) {
    const now = this.ctx ? this.ctx.currentTime : 0;
    let dryFrac = 1.0;
    let wetFrac = 0.0;
    if (!forceDryOnly) {
      const m = this.mix > 0 ? this.mix : 0.5;
      const makeup = 1.0 + m * 0.10;
      dryFrac = Math.cos(m * Math.PI * 0.5);
      wetFrac = Math.sin(m * Math.PI * 0.5) * 0.70 * makeup;
    }
    // Smoothed (setTargetAtTime) instead of instant setValueAtTime jumps:
    // hard gain changes click, which reads as crackle right at the toggle.
    this.wetGain.gain.setTargetAtTime(wetFrac, now, timeConstant);
    this.dryGain.gain.setTargetAtTime(dryFrac, now, timeConstant);
  }
}
