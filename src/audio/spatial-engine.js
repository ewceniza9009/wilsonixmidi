/**
 * Binaural Stage Monitor — 3D Spatial Audio Engine
 * Creates the illusion of playing in physical spaces (concert hall, studio, etc.)
 * using HRTF Head-Related Transfer Function via Web Audio PannerNode +
 * synthetic room impulse responses via ConvolverNode.
 *
 * For use with headphones / in-ear monitors.
 */

const ENVIRONMENTS = {
  off: { id: "off", name: "OFF", description: "No spatial processing (dry signal)" },
  concert_hall: {
    id: "concert_hall",
    name: "Concert Hall",
    description: "Large symphony hall — wide stereo, lush reverb tail",
    roomSize: 0.85,
    decayTime: 2.2,
    earlyReflections: 0.4,
    damping: 0.3,
    preDelay: 0.025,
    spread: 120,
    distance: 12,
  },
  studio: {
    id: "studio",
    name: "Studio",
    description: "Treated recording room — tight, controlled, intimate",
    roomSize: 0.35,
    decayTime: 0.6,
    earlyReflections: 0.6,
    damping: 0.7,
    preDelay: 0.008,
    spread: 60,
    distance: 3,
  },
  stadium: {
    id: "stadium",
    name: "Stadium",
    description: "Massive arena — enormous space, long slapback",
    roomSize: 1.0,
    decayTime: 3.5,
    earlyReflections: 0.25,
    damping: 0.15,
    preDelay: 0.045,
    spread: 180,
    distance: 25,
  },
  intimate: {
    id: "intimate",
    name: "Intimate",
    description: "Small jazz club — close, warm, subtle room feel",
    roomSize: 0.25,
    decayTime: 0.4,
    earlyReflections: 0.7,
    damping: 0.8,
    preDelay: 0.005,
    spread: 45,
    distance: 2,
  },
  cathedral: {
    id: "cathedral",
    name: "Cathedral",
    description: "Massive stone cathedral — infinite reverb, shimmering highs",
    roomSize: 0.95,
    decayTime: 5.0,
    earlyReflections: 0.15,
    damping: 0.1,
    preDelay: 0.06,
    spread: 160,
    distance: 20,
  },
};

/**
 * Generate a synthetic stereo impulse response for the ConvolverNode.
 * No external IR files needed — entirely procedural.
 */
function generateImpulseResponse(ctx, preset) {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(preset.decayTime * sampleRate));
  const IRLength = length + Math.floor(preset.preDelay * sampleRate);
  const buffer = ctx.createBuffer(2, IRLength, sampleRate);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);

  // Pre-delay silence
  const preDelaySamples = Math.floor(preset.preDelay * sampleRate);

  // Exponential decay envelope
  const roomFactor = preset.roomSize;
  const dampFactor = preset.damping;
  const earlyCount = Math.floor(12 + preset.earlyReflections * 24);

  // Early reflections — distinct taps for spatial width
  const earlyGains = [];
  for (let i = 0; i < earlyCount; i++) {
    const t = (i + 1) / earlyCount;
    const gain = preset.earlyReflections * (1 - t * 0.6) * (0.3 + roomFactor * 0.7);
    const delayRatio = t * (0.1 + roomFactor * 0.4);
    earlyGains.push({ ratio: delayRatio, gain });
  }

  for (let i = 0; i < IRLength; i++) {
    const t = i / sampleRate;

    // Late reverb tail — exponentially decaying noise
    const decayEnvelope = Math.exp(-t * (3.0 / Math.max(0.1, preset.decayTime * (1 - dampFactor * 0.5))));
    const noise = Math.random() * 2 - 1;
    const late = noise * decayEnvelope * roomFactor * 0.35;

    // Mix in early reflections
    let earlyL = 0;
    let earlyR = 0;
    for (const er of earlyGains) {
      const erSample = Math.floor(preDelaySamples + er.ratio * length);
      if (i === erSample) {
        // Stochastic early reflection pattern (not identical L/R for width)
        const sigL = (Math.random() * 2 - 1) * er.gain;
        const sigR = (Math.random() * 2 - 1) * er.gain;
        earlyL += sigL;
        earlyR += sigR;
      }
    }

    // Frequency-dependent damping (low-pass the tail slightly)
    const freqDamp = dampFactor * 0.4;
    const tailFiltered = late * (1 - freqDamp * (Math.sin(t * 1200) * 0.3 + 0.7));

    L[i] = earlyL + tailFiltered + (late * 0.15 * Math.sin(i * 0.003)); // subtle width modulation
    R[i] = earlyR + tailFiltered + (late * 0.15 * Math.cos(i * 0.003));

    // Soft clip
    L[i] = Math.max(-0.99, Math.min(0.99, L[i]));
    R[i] = Math.max(-0.99, Math.min(0.99, R[i]));
  }

  return buffer;
}

export class SpatialEngine {
  constructor(ctx, sourceNode, destination) {
    this.ctx = ctx;
    this.sourceNode = sourceNode;
    this.destination = destination;
    this.enabled = false;
    this.currentEnv = "off";

    // HRTF Panner — positions sound in 3D space
    this.panner = ctx.createPanner();
    this.panner.panningModel = "HRTF";
    this.panner.distanceModel = "inverse";
    this.panner.refDistance = 1;
    this.panner.maxDistance = 100;
    this.panner.rolloffFactor = 0.5;
    this.panner.coneInnerAngle = 360;
    this.panner.coneOuterAngle = 360;
    this.panner.coneOuterGain = 0.4;

    // Convolver — applies room impulse response
    this.convolver = ctx.createConvolver();

    // Dry/wet mix
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain.gain.value = 1.0;
    this.wetGain.gain.value = 0.0;

    // Output merger
    this.merger = ctx.createGain();
    this.merger.gain.value = 1.0;

    // Current IR buffer
    this._currentIR = null;

    // Default listener position (center, ears forward)
    if (ctx.listener) {
      ctx.listener.positionX.value = 0;
      ctx.listener.positionY.value = 0;
      ctx.listener.positionZ.value = 0;
      ctx.listener.forwardX.value = 0;
      ctx.listener.forwardY.value = 0;
      ctx.listener.forwardZ.value = -1;
      ctx.listener.upX.value = 0;
      ctx.listener.upY.value = 1;
      ctx.listener.upZ.value = 0;
    }
  }

  /**
   * Connect the spatial chain into the audio graph:
   * source → panner → convolver → wetGain ─┐
   * source → dryGain ──────────────────────┤
   *                                         └→ merger → destination
   */
  connect() {
    // Dry path
    this.sourceNode.connect(this.dryGain);
    this.dryGain.connect(this.merger);

    // Wet path (spatialized)
    this.sourceNode.connect(this.panner);
    this.panner.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.merger);

    // Final output
    this.merger.connect(this.destination);
  }

  disconnect() {
    try { this.sourceNode.disconnect(this.dryGain); } catch (e) {}
    try { this.sourceNode.disconnect(this.panner); } catch (e) {}
    try { this.dryGain.disconnect(this.merger); } catch (e) {}
    try { this.panner.disconnect(this.convolver); } catch (e) {}
    try { this.convolver.disconnect(this.wetGain); } catch (e) {}
    try { this.wetGain.disconnect(this.merger); } catch (e) {}
    try { this.merger.disconnect(this.destination); } catch (e) {}
  }

  async setEnvironment(envId) {
    const env = ENVIRONMENTS[envId];
    if (!env) return;

    this.currentEnv = envId;
    const now = this.ctx.currentTime;

    if (envId === "off") {
      // Fade wet out, dry to full
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.05);
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.05);
      this.enabled = false;
      return;
    }

    this.enabled = true;

    // Generate impulse response
    const ir = generateImpulseResponse(this.ctx, env);
    this._currentIR = ir;
    this.convolver.buffer = ir;

    // Set panner position based on environment distance/angle
    const dist = env.distance || 5;
    const angle = 0; // center stage
    this.panner.positionX.setValueAtTime(
      Math.sin(angle * Math.PI / 180) * dist, now
    );
    this.panner.positionY.setValueAtTime(0, now);
    this.panner.positionZ.setValueAtTime(
      -Math.cos(angle * Math.PI / 180) * dist, now
    );

    // Wet/dry mix based on room size
    const wetAmount = Math.min(0.7, env.roomSize * 0.8);
    this.dryGain.gain.setTargetAtTime(1.0 - wetAmount * 0.5, now, 0.08);
    this.wetGain.gain.setTargetAtTime(wetAmount, now, 0.08);
  }

  /**
   * Position a sound source in 3D space (for future per-voice spatialization).
   * x: -1 (left) to 1 (right)
   * y: -1 (below) to 1 (above)
   * z: -1 (behind) to 1 (in front)
   */
  positionSource(x, y, z) {
    const now = this.ctx.currentTime;
    const dist = 5;
    this.panner.positionX.setTargetAtTime(x * dist, now, 0.02);
    this.panner.positionY.setTargetAtTime(y * dist, now, 0.02);
    this.panner.positionZ.setTargetAtTime(z * dist, now, 0.02);
  }

  getEnvironments() {
    return Object.values(ENVIRONMENTS);
  }

  getCurrentEnvironment() {
    return ENVIRONMENTS[this.currentEnv];
  }
}

export { ENVIRONMENTS };
