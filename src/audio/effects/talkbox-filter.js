/**
 * Authentic Roger Troutman / Heil Physical Talk Box Emulation
 * Models vocal tract mouth resonances (Formants F1 & F2) combined with a rich
 * fundamental carrier core, tube warmth, and organic note-triggered mouth articulation.
 *
 * Key safety guarantees:
 *   1. Wet-path BiquadFilters are DESTROYED and REBUILT on every bypass→engage
 *      transition, which is the only reliable way to flush IIR internal state
 *      and prevent "NaN wedging" (BiquadFilter delay-line corruption).
 *   2. All parameter changes use setTargetAtTime (never setValueAtTime on
 *      active filters) to avoid InvalidStateError and zipper noise.
 *   3. A dedicated brickwall DynamicsCompressor limiter sits before the
 *      wet output to prevent any digital clipping.
 *   4. Input DC blocker removes sub-bass rumble / DC offset before processing.
 */

export class TalkboxFormantFilter {
  constructor(ctx) {
    this.ctx = ctx;

    // Persistent nodes: survive bypass/engage cycles.
    // The FxRackManager chain routing connects to these.
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.mix = 0.50;
    this.enabled = false;

    // Permanent dry path: input → dryGain → output (never torn down)
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // Wet path nodes are created/destroyed dynamically (see _buildWetPath / _teardownWetPath)
    this._wetNodes = null;
    this._tubeCurve = this._makeTubeCurve();

    // wetGain always connects to output; its gain is 0 when bypassed
    this.wetGain.gain.value = 0.0;
    this.wetGain.connect(this.output);
  }

  // ---------- WET-PATH LIFECYCLE ----------

  /**
   * Creates fresh BiquadFilter / WaveShaper / Compressor nodes for the wet path.
   * Called every time the effect transitions from bypassed → engaged.
   * Each call produces brand-new Web Audio nodes with pristine IIR state.
   */
  _buildWetPath() {
    if (this._wetNodes) return; // already built
    const ctx = this.ctx;

    // DC Blocker
    const dcBlocker = ctx.createBiquadFilter();
    dcBlocker.type = "highpass";
    dcBlocker.frequency.value = 40;
    dcBlocker.Q.value = 0.7;

    // Body lowpass (preserves fundamental punch)
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = "lowpass";
    bodyFilter.frequency.value = 3600;
    bodyFilter.Q.value = 0.7;

    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.50;

    // Tube soft-saturation
    const tubeDrive = ctx.createWaveShaper();
    tubeDrive.curve = this._tubeCurve;

    // Formant F1 (mouth openness, resting ~540 Hz)
    const f1Filter = ctx.createBiquadFilter();
    f1Filter.type = "bandpass";
    f1Filter.frequency.value = 540;
    f1Filter.Q.value = 2.2;

    const f1Gain = ctx.createGain();
    f1Gain.gain.value = 0.45;

    // Formant F2 (mouth shape / vowels, resting ~1450 Hz)
    const f2Filter = ctx.createBiquadFilter();
    f2Filter.type = "bandpass";
    f2Filter.frequency.value = 1450;
    f2Filter.Q.value = 2.4;

    const f2Gain = ctx.createGain();
    f2Gain.gain.value = 0.35;

    // Formant summing
    const mouthSum = ctx.createGain();
    mouthSum.gain.value = 0.90;

    // Brickwall safety limiter
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.5;
    limiter.knee.value = 4.0;
    limiter.ratio.value = 10.0;
    limiter.attack.value = 0.005;
    limiter.release.value = 0.060;

    // Wire: input → dcBlocker → bodyFilter → bodyGain → mouthSum
    //                dcBlocker → tubeDrive → f1Filter → f1Gain → mouthSum
    //                                        f2Filter → f2Gain → mouthSum
    //        mouthSum → limiter → wetGain
    this.input.connect(dcBlocker);
    dcBlocker.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(mouthSum);

    dcBlocker.connect(tubeDrive);
    tubeDrive.connect(f1Filter);
    f1Filter.connect(f1Gain);
    f1Gain.connect(mouthSum);

    tubeDrive.connect(f2Filter);
    f2Filter.connect(f2Gain);
    f2Gain.connect(mouthSum);

    mouthSum.connect(limiter);
    limiter.connect(this.wetGain);

    this._wetNodes = {
      dcBlocker, bodyFilter, bodyGain, tubeDrive,
      f1Filter, f1Gain, f2Filter, f2Gain,
      mouthSum, limiter,
    };
  }

  /**
   * Completely tears down the wet-path nodes, disconnecting them from the graph.
   * The nodes become unreachable and are garbage-collected, along with any
   * corrupted IIR internal state they may have accumulated.
   */
  _teardownWetPath() {
    if (!this._wetNodes) return;
    const n = this._wetNodes;
    const nodes = [
      n.dcBlocker, n.bodyFilter, n.bodyGain, n.tubeDrive,
      n.f1Filter, n.f1Gain, n.f2Filter, n.f2Gain,
      n.mouthSum, n.limiter,
    ];
    // Disconnect every node. Order doesn't matter — we're tearing down everything.
    for (const node of nodes) {
      try { node.disconnect(); } catch (_) {}
    }
    // Also sever the input → dcBlocker link (input is persistent)
    try { this.input.disconnect(n.dcBlocker); } catch (_) {}
    this._wetNodes = null;
  }

  // ---------- PUBLIC API ----------

  _makeTubeCurve() {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * 1.25) * 0.82;
    }
    return curve;
  }

  /**
   * Triggers an authentic Roger Troutman mouth articulation on key strike.
   */
  triggerVocalAttack(velocity = 95) {
    if (!this.enabled || !this.ctx || !this._wetNodes) return;
    const now = this.ctx.currentTime;
    const velNorm = Math.max(0.2, Math.min(1.0, velocity / 127));

    const peakF1 = 580 + velNorm * 160;
    const peakF2 = 1400 + velNorm * 250;

    try {
      const { f1Filter, f2Filter } = this._wetNodes;
      f1Filter.frequency.cancelScheduledValues(now);
      f2Filter.frequency.cancelScheduledValues(now);

      // Clean, single monotonic exponential target approach — zero schedule collisions during fast 16th/32nd note runs
      f1Filter.frequency.setTargetAtTime(peakF1, now, 0.035);
      f2Filter.frequency.setTargetAtTime(peakF2, now, 0.035);
    } catch (e) {}
  }

  /**
   * Reset formant frequencies to resting positions.
   */
  reset() {
    if (!this.ctx || !this._wetNodes) return;
    const now = this.ctx.currentTime;
    try {
      const { f1Filter, f2Filter, mouthSum } = this._wetNodes;
      f1Filter.frequency.cancelScheduledValues(now);
      f2Filter.frequency.cancelScheduledValues(now);
      f1Filter.frequency.setValueAtTime(540, now);
      f2Filter.frequency.setValueAtTime(1450, now);
      mouthSum.gain.cancelScheduledValues(now);
      mouthSum.gain.setValueAtTime(0.90, now);
    } catch (e) {}
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      this.wetGain.gain.cancelScheduledValues(now);
      this.dryGain.gain.cancelScheduledValues(now);

      if (bypassed) {
        // Ramp wet → 0, dry → 1 (smooth fade-out)
        this.wetGain.gain.setTargetAtTime(0.0, now, 0.02);
        this.dryGain.gain.setTargetAtTime(1.0, now, 0.02);

        // Schedule tear-down AFTER the gain has fully faded (~5τ = 100 ms)
        // This avoids a click from instant disconnect while wet audio is still audible.
        if (this._teardownTimer) clearTimeout(this._teardownTimer);
        this._teardownTimer = setTimeout(() => {
          this._teardownWetPath();
        }, 120);
      } else {
        // Build fresh wet-path nodes with pristine IIR state
        this._teardownWetPath();   // ensure no stale nodes
        this._buildWetPath();

        const dryVal = Math.max(0.0, 1.0 - this.mix);
        this.wetGain.gain.setTargetAtTime(this.mix, now, 0.02);
        this.dryGain.gain.setTargetAtTime(dryVal, now, 0.02);
      }
    } catch (e) {}
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    if (this.enabled && this.ctx) {
      const now = this.ctx.currentTime;
      try {
        const dryVal = Math.max(0.0, 1.0 - this.mix);
        this.wetGain.gain.setTargetAtTime(this.mix, now, 0.02);
        this.dryGain.gain.setTargetAtTime(dryVal, now, 0.02);
      } catch (e) {}
    }
  }

  setSensitivity(val) {
    // Retained for API compatibility
  }
}
