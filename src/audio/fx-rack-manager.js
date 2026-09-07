/**
 * Ableton & Workstation Master FX Rack Manager
 * Chains: Tube Drive -> Phaser -> Korg Chorus -> Rotary -> Ping-Pong Delay -> Algorithmic Reverb -> EQ & Limiter
 */

import { GrandPianoAcoustics } from "./effects/piano-acoustics.js";
import { TubeDrive } from "./effects/tube-drive.js";
import { AutoPan } from "./effects/auto-pan.js";
import { StereoPhaser } from "./effects/phaser.js";
import { KorgStereoChorus } from "./effects/chorus.js";
import { RotarySpeaker } from "./effects/rotary.js";
import { PingPongDelay } from "./effects/delay.js";
import { AlgorithmicReverb } from "./effects/reverb.js";
import { StudioEqLimiter } from "./effects/eq-limiter.js";

export class FxRackManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    // Instantiate all elite effects
    this.pianoAcoustics = new GrandPianoAcoustics(ctx);
    this.tube = new TubeDrive(ctx);
    this.autopan = new AutoPan(ctx);
    this.phaser = new StereoPhaser(ctx);
    this.chorus = new KorgStereoChorus(ctx);
    this.rotary = new RotarySpeaker(ctx);
    this.delay = new PingPongDelay(ctx);
    this.reverb = new AlgorithmicReverb(ctx);

    this.presetTrimNode = ctx.createGain();
    this.presetTrimNode.gain.value = 1.0;

    this.masterEq = new StudioEqLimiter(ctx);
    this.onPresetChangeCallback = null;

    if (typeof window !== "undefined") {
      window.__pianoAcoustics = this.pianoAcoustics;
    }

    this.chainEffects();
  }

  chainEffects() {
    // Clean Studio Serial chain (Zero Distortion, Zero Compression squashing):
    // Input -> GrandPianoAcoustics -> TubeDrive -> AutoPan -> Phaser -> Chorus -> Rotary -> Delay -> Reverb -> PresetTrim -> MasterEQ -> Output
    this.input.connect(this.pianoAcoustics.input);
    this.pianoAcoustics.output.connect(this.tube.input);
    this.tube.output.connect(this.autopan.input);
    this.autopan.output.connect(this.phaser.input);
    this.phaser.output.connect(this.chorus.input);
    this.chorus.output.connect(this.rotary.input);
    this.rotary.output.connect(this.delay.input);
    this.delay.output.connect(this.reverb.input);
    this.reverb.output.connect(this.presetTrimNode);
    this.presetTrimNode.connect(this.masterEq.input);
    this.masterEq.output.connect(this.output);

    // Default: 100% Clean Studio Concert Grand (Pure pristine samples)
    this.pianoAcoustics.setBypass(true);
    this.tube.setBypass(true);
    this.autopan.setBypass(true);
    this.phaser.setBypass(true);
    this.rotary.setBypass(true);
    this.delay.setBypass(true);
    this.chorus.setBypass(true);
    this.reverb.setBypass(false);
    this.reverb.setMix(0.20);
    this.reverb.setDecay(2.0);
  }

  setPresetTrim(val) {
    if (!this.presetTrimNode) return;
    const g = Math.max(0.2, Math.min(1.5, val));
    this.presetTrimNode.gain.setTargetAtTime(g, this.ctx.currentTime, 0.02);
  }

  applyPreset(presetName) {
    switch (presetName) {
      case "whitney_ballad":
      case "foster_ballad":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.chorus.setBypass(true); // Master chorus bypassed: piano is crystal clear; strings/EP use dedicated layer chorus!
        this.reverb.setBypass(false); // Lexicon 480L Studio Concert Hall Reverb
        this.reverb.setMix(0.25);
        this.reverb.setDecay(2.8);
        this.masterEq.setLowGain(1.0);
        this.masterEq.setHighGain(2.2);
        break;

      case "triton_ep":
      case "rnb_ep":
      case "triton_dyno_ep":
        // Authentic 1973 Rhodes Suitcase 88 Neo-Soul / R&B (Stereo Auto-Pan Tremolo + Chorus)
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(false); // Iconic hypnotic stereo pan sway
        this.autopan.setRate(2.4);
        this.autopan.setDepth(0.95);
        this.autopan.setMix(1.0);
        this.chorus.setBypass(false);
        this.chorus.setMix(0.55);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.30);
        this.reverb.setDecay(2.2);
        break;

      case "distortion_guitar":
      case "rock_lead":
      case "shreddage_lead_guitar":
        this.setPresetTrim(1.0);
        this.tube.setBypass(false);
        this.tube.setDrive(0.55); // Dynamic guitar overdrive
        this.tube.setMix(0.60);
        this.tube.setTone(5000);
        this.autopan.setBypass(true);
        this.chorus.setBypass(true);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(false);
        this.delay.setMix(0.35);
        this.delay.setFeedback(0.40);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.20);
        this.reverb.setDecay(1.8);
        break;

      case "m1_organ":
      case "m1_rock_organ":
      case "drawbar_organ":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true); // Clean organ pre-amp
        this.autopan.setBypass(true);
        this.chorus.setBypass(true);
        this.phaser.setBypass(true);
        this.rotary.setBypass(false); // Rich Leslie Rotary swirl
        this.rotary.setSpeed("fast");
        this.rotary.setMix(0.85);
        this.delay.setBypass(true);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.25);
        this.reverb.setDecay(2.0);
        break;

      case "warm_strings":
      case "triton_warm_strings":
      case "string_ensemble_1":
      case "m1_universe":
      case "m1_choir":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.chorus.setBypass(false); // Deep ensemble chorus
        this.chorus.setMix(0.60);
        this.chorus.setRate(0.85);
        this.reverb.setBypass(false); // Cathedral Reverb
        this.reverb.setMix(0.35);
        this.reverb.setDecay(3.0);
        break;

      case "synth_lead":
      case "fat_brass_horns":
      case "brass_section":
      case "m1_fresh_air":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true); // Pure clean brass / synth
        this.autopan.setBypass(true);
        this.phaser.setBypass(true);
        this.chorus.setBypass(false);
        this.chorus.setMix(0.40);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.22);
        this.reverb.setDecay(2.0);
        break;

      default: // Acoustic Concert Grand Piano
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.phaser.setBypass(true);
        this.chorus.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.22);
        this.reverb.setDecay(2.2);
        this.masterEq.setLowGain(1.0);
        this.masterEq.setHighGain(1.8);
        break;
    }

    if (this.onPresetChangeCallback) {
      try { this.onPresetChangeCallback(); } catch (e) {}
    }
  }
}
