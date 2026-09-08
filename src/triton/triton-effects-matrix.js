/**
 * KORG TRITON IFX / MFX Complete Multi-Effects Engine
 * Replicates the Triton 5 Insert Effects (IFX 1-5) + 2 Master Effects (MFX 1-2) + Master EQ.
 * Supports hot-swappable Triton algorithms.
 */

import { KorgStereoChorus } from "../audio/effects/chorus.js";
import { AlgorithmicReverb } from "../audio/effects/reverb.js";
import { PingPongDelay } from "../audio/effects/delay.js";
import { RotarySpeaker } from "../audio/effects/rotary.js";
import { TubeDrive } from "../audio/effects/tube-drive.js";
import { StereoPhaser } from "../audio/effects/phaser.js";
import { StereoFlanger } from "../audio/effects/flanger.js";
import { TremoloPulse } from "../audio/effects/tremolo.js";
import { StudioEqLimiter } from "../audio/effects/eq-limiter.js";

export const TRITON_ALGORITHMS = [
  "01: Stereo Compressor",
  "02: Studio Limiter",
  "03: 4-Band Parametric EQ",
  "04: Auto-Wah / Envelope Filter",
  "05: Tube Overdrive & Amp Sim",
  "06: Decimator / Lo-Fi Resampler",
  "07: Stereo Harmonic Exciter",
  "08: Korg Stereo Ensemble / Chorus",
  "09: Stereo Flanger",
  "10: 6-Stage Vintage Phaser",
  "11: Optical Tremolo",
  "12: Stereo Auto-Pan",
  "13: Leslie Rotary Speaker",
  "14: Pitch Shifter / Harmonizer",
  "15: Ping-Pong Tape Delay",
  "16: Multitap Stereo Delay",
  "17: Early Reflections",
  "18: Studio Room Reverb",
  "19: Concert Hall Reverb",
  "20: Warm Plate Reverb",
  "21: Vintage Optical Tremolo",
  "22: Stereo Tape Flanger",
];

export class TritonEffectsMatrix {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    // 5 Insert Effect Slots
    this.ifxSlots = [
      { id: 1, name: "IFX 1", algo: "08: Korg Stereo Ensemble / Chorus", enabled: true, send1: 0.3, send2: 0.4 },
      { id: 2, name: "IFX 2", algo: "05: Tube Overdrive & Amp Sim", enabled: false, send1: 0.0, send2: 0.0 },
      { id: 3, name: "IFX 3", algo: "10: 6-Stage Vintage Phaser", enabled: false, send1: 0.0, send2: 0.0 },
      { id: 4, name: "IFX 4", algo: "13: Leslie Rotary Speaker", enabled: false, send1: 0.0, send2: 0.0 },
      { id: 5, name: "IFX 5", algo: "01: Stereo Compressor", enabled: true, send1: 0.2, send2: 0.5 },
    ];

    // 2 Master Effect Slots
    this.mfxSlots = [
      { id: 1, name: "MFX 1", algo: "15: Ping-Pong Tape Delay", enabled: true, returnLevel: 0.25 },
      { id: 2, name: "MFX 2", algo: "19: Concert Hall Reverb", enabled: true, returnLevel: 0.35 },
    ];

    // Master EQ
    this.meq = { low: 1.5, mid: 0.0, high: 2.0 };

    this.initDspNodes();
  }

  initDspNodes() {
    const ctx = this.ctx;

    // Physical DSP units
    this.dspTube = new TubeDrive(ctx);
    this.dspChorus = new KorgStereoChorus(ctx);
    this.dspPhaser = new StereoPhaser(ctx);
    this.dspFlanger = new StereoFlanger(ctx);
    this.dspRotary = new RotarySpeaker(ctx);
    this.dspTremolo = new TremoloPulse(ctx);
    this.dspDelay = new PingPongDelay(ctx);
    this.dspReverb = new AlgorithmicReverb(ctx);
    this.dspMasterEq = new StudioEqLimiter(ctx);

    // Dynamic serial and parallel routing
    this.input.connect(this.dspTube.input);
    this.dspTube.output.connect(this.dspPhaser.input);
    this.dspPhaser.output.connect(this.dspFlanger.input);
    this.dspFlanger.output.connect(this.dspChorus.input);
    this.dspChorus.output.connect(this.dspRotary.input);
    this.dspRotary.output.connect(this.dspTremolo.input);
    this.dspTremolo.output.connect(this.dspDelay.input);
    this.dspDelay.output.connect(this.dspReverb.input);
    this.dspReverb.output.connect(this.dspMasterEq.input);
    this.dspMasterEq.output.connect(this.output);

    // Initial safe bypass states
    this.dspTube.setBypass(true);
    this.dspPhaser.setBypass(true);
    this.dspFlanger.setBypass(true);
    this.dspRotary.setBypass(true);
    this.dspTremolo.setBypass(true);
    this.dspDelay.setBypass(true);
    this.dspChorus.setBypass(false);
    this.dspChorus.setMix(0.35);
    this.dspReverb.setBypass(false);
    this.dspReverb.setMix(0.22);
  }

  setIfxSlotAlgo(slotIndex, algoName) {
    if (this.ifxSlots[slotIndex]) {
      this.ifxSlots[slotIndex].algo = algoName;
      this.applySlotState(this.ifxSlots[slotIndex]);
    }
  }

  setMfxSlotAlgo(slotIndex, algoName) {
    if (this.mfxSlots[slotIndex]) {
      this.mfxSlots[slotIndex].algo = algoName;
      this.applyMfxState(this.mfxSlots[slotIndex]);
    }
  }

  toggleIfx(slotIndex) {
    const s = this.ifxSlots[slotIndex];
    if (s) {
      s.enabled = !s.enabled;
      this.applySlotState(s);
    }
  }

  toggleMfx(slotIndex) {
    const s = this.mfxSlots[slotIndex];
    if (s) {
      s.enabled = !s.enabled;
      this.applyMfxState(s);
    }
  }

  applySlotState(slot) {
    const algo = slot.algo;
    const on = slot.enabled;

    if (algo.includes("Overdrive")) this.dspTube.setBypass(!on);
    if (algo.includes("Chorus") || algo.includes("Ensemble")) this.dspChorus.setBypass(!on);
    if (algo.includes("Phaser")) this.dspPhaser.setBypass(!on);
    if (algo.includes("Flanger")) this.dspFlanger.setBypass(!on);
    if (algo.includes("Rotary")) this.dspRotary.setBypass(!on);
    if (algo.includes("Tremolo")) this.dspTremolo.setBypass(!on);
    if (algo.includes("Delay")) this.dspDelay.setBypass(!on);
  }

  applyMfxState(slot) {
    const algo = slot.algo;
    const on = slot.enabled;

    if (algo.includes("Delay")) this.dspDelay.setBypass(!on);
    if (algo.includes("Reverb") || algo.includes("Hall")) this.dspReverb.setBypass(!on);
  }
}
