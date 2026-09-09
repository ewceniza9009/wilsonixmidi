/**
 * Ableton & Workstation Master FX Rack Manager
 * Chains: Tube Drive -> Phaser -> Korg Chorus -> Rotary -> Ping-Pong Delay -> Algorithmic Reverb -> EQ & Limiter
 */

import { GrandPianoAcoustics } from "./effects/piano-acoustics.js";
import { TubeDrive } from "./effects/tube-drive.js";
import { AutoPan } from "./effects/auto-pan.js";
import { StereoPhaser } from "./effects/phaser.js";
import { StereoFlanger } from "./effects/flanger.js";
import { KorgStereoChorus } from "./effects/chorus.js";
import { RotarySpeaker } from "./effects/rotary.js";
import { TremoloPulse } from "./effects/tremolo.js";
import { PingPongDelay } from "./effects/delay.js";
import { AlgorithmicReverb } from "./effects/reverb.js";
import { StudioEqLimiter } from "./effects/eq-limiter.js";
import { SpringReverb } from "./effects/spring-reverb.js";
import { SlapbackTapeDelay } from "./effects/slapback-delay.js";
import { GatedReverb } from "./effects/gated-reverb.js";
import { MasterTapeSaturation } from "./effects/tape-saturation.js";

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
    this.flanger = new StereoFlanger(ctx);
    this.chorus = new KorgStereoChorus(ctx);
    this.rotary = new RotarySpeaker(ctx);
    this.tremolo = new TremoloPulse(ctx);
    this.slapback = new SlapbackTapeDelay(ctx);
    this.delay = new PingPongDelay(ctx);
    this.springReverb = new SpringReverb(ctx);
    this.gatedReverb = new GatedReverb(ctx);
    this.reverb = new AlgorithmicReverb(ctx);
    this.tapeSat = new MasterTapeSaturation(ctx);

    this.presetTrimNode = ctx.createGain();
    this.presetTrimNode.gain.value = 1.0;

    this.masterEq = new StudioEqLimiter(ctx);
    this.onPresetChangeCallback = null;

    if (typeof window !== "undefined") {
      window.__pianoAcoustics = this.pianoAcoustics;
    }

    this.chainEffects();
  }

  // Wires an effect into the chain through a HARD-BYPASS slot.
  //
  // WHY: the render thread must finish each audio quantum in real-time. Wiring
  // every effect permanently in series meant ALL 15 effects (two 4x-oversampled
  // waveshapers, spring/algorithmic reverbs, feedback delays, LFO banks...)
  // kept processing every quantum even when "bypassed" -- bypass only zeroed an
  // internal wet gain. That guaranteed render-thread overload -> the
  // hard-silence dropouts that sound like stutter/garble.
  //
  // HOW: audio flows through a dry continuity wire past the effect. The effect's
  // send tap is physically DISCONNECTED from the graph while bypassed, so the
  // browser stops pulling the effect's whole internal network (near-zero DSP).
  // Engaging restores the exact same signal path as before, with the same
  // internal dry/wet gains -> tone is bit-identical to the original wiring.
  _installBypassSlot(effect, sourceNode, targetNode) {
    const ctx = this.ctx;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1.0;
    sourceNode.connect(dryGain);
    dryGain.connect(targetNode);

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.0;
    const tap = ctx.createGain();
    tap.connect(effect.input);
    effect.output.connect(wetGain);
    wetGain.connect(targetNode);

    let engaged = false;
    const setEngaged = on => {
      if (on === engaged) return;
      engaged = on;
      const now = ctx.currentTime;
      dryGain.gain.setTargetAtTime(on ? 0.0 : 1.0, now, 0.015);
      wetGain.gain.setTargetAtTime(on ? 1.0 : 0.0, now, 0.015);
      try {
        sourceNode.disconnect(tap);
      } catch (e) {}
      if (on) sourceNode.connect(tap);
    };
    setEngaged(false);

    // Route every setBypass caller (rack presets, FX UI, engine patches)
    // through the hard-bypass so they disconnect the physical link too.
    const originalSetBypass = effect.setBypass ? effect.setBypass.bind(effect) : null;
    effect.setBypass = bypassed => {
      if (originalSetBypass) originalSetBypass(bypassed);
      setEngaged(!bypassed);
    };

    return { effect, setEngaged };
  }

  chainEffects() {
    // Clean Studio Serial chain, hard-bypassed per slot:
    // Input -> PianoAcoustics -> TubeDrive -> AutoPan -> Phaser -> Flanger ->
    // Chorus -> Rotary -> Tremolo -> Slapback -> Delay -> SpringReverb ->
    // GatedReverb -> AlgorithmicReverb -> TapeSaturation -> PresetTrim ->
    // MasterEQ -> Output
    const chain = [
      this.pianoAcoustics,
      this.tube,
      this.autopan,
      this.phaser,
      this.flanger,
      this.chorus,
      this.rotary,
      this.tremolo,
      this.slapback,
      this.delay,
      this.springReverb,
      this.gatedReverb,
      this.reverb,
      this.tapeSat,
    ];

    let cursor = this.input;
    chain.forEach(effect => {
      const junction = this.ctx.createGain();
      this._installBypassSlot(effect, cursor, junction);
      cursor = junction;
    });

    cursor.connect(this.presetTrimNode);
    this.presetTrimNode.connect(this.masterEq.input);
    this.masterEq.output.connect(this.output);

    // Default: 100% Clean Studio Concert Grand (Pure pristine samples)
    this.pianoAcoustics.setBypass(true);
    this.tube.setBypass(true);
    this.autopan.setBypass(true);
    this.phaser.setBypass(true);
    this.flanger.setBypass(true);
    this.rotary.setBypass(true);
    this.tremolo.setBypass(true);
    this.slapback.setBypass(true);
    this.delay.setBypass(true);
    this.chorus.setBypass(true);
    this.springReverb.setBypass(true);
    this.gatedReverb.setBypass(true);
    this.tapeSat.setBypass(true);
    this.reverb.setBypass(false);
    this.reverb.setMix(0.12);
    this.reverb.setDecay(1.6);
  }

  setPresetTrim(val) {
    if (!this.presetTrimNode) return;
    const g = Math.max(0.2, Math.min(1.5, val));
    this.presetTrimNode.gain.setTargetAtTime(g, this.ctx.currentTime, 0.02);
  }

  applyPreset(presetName) {
    // Newer units default bypassed on every preset change (cases below may enable them)
    this.flanger.setBypass(true);
    this.tremolo.setBypass(true);
    this.slapback.setBypass(true);
    this.springReverb.setBypass(true);
    this.gatedReverb.setBypass(true);
    this.tapeSat.setBypass(true);
    switch (presetName) {
      case "synthesizer_you_surf":
      case "surf_guitar":
      case "surf_synth":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.phaser.setBypass(true);
        this.chorus.setBypass(true);
        this.rotary.setBypass(true);
        this.slapback.setBypass(true);
        this.delay.setBypass(true);
        this.reverb.setBypass(true);
        this.gatedReverb.setBypass(true);
        this.springReverb.setBypass(false);
        this.springReverb.setTone(3400);
        this.springReverb.setDecay(2.4);
        this.springReverb.setMix(0.40);
        this.tapeSat.setBypass(false);
        this.tapeSat.setDrive(0.30);
        this.tapeSat.setWarmth(0.65);
        this.masterEq.setLowGain(1.0);
        this.masterEq.setHighGain(2.0);
        break;

      case "synthesizer_you_pad":
      case "juno_synth_pad":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.slapback.setBypass(true);
        this.delay.setBypass(true);
        this.springReverb.setBypass(true);
        this.gatedReverb.setBypass(true);
        this.chorus.setBypass(false);
        this.chorus.setRate(0.85);
        this.chorus.setDepth(0.8);
        this.chorus.setMix(0.45);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.20);
        this.reverb.setDecay(2.2);
        this.tapeSat.setBypass(false);
        this.tapeSat.setDrive(0.25);
        this.tapeSat.setWarmth(0.70);
        break;

      case "synthesizer_you_vocal":
      case "slapback_vocal":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.chorus.setBypass(true);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.springReverb.setBypass(true);
        this.gatedReverb.setBypass(true);
        this.slapback.setBypass(false);
        this.slapback.setDelayTime(0.095);
        this.slapback.setTone(3200);
        this.slapback.setMix(0.40);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.10);
        this.tapeSat.setBypass(false);
        this.tapeSat.setDrive(0.35);
        break;

      case "synthesizer_you_gated":
      case "gated_snare_room":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.chorus.setBypass(true);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.slapback.setBypass(true);
        this.delay.setBypass(true);
        this.reverb.setBypass(true);
        this.springReverb.setBypass(true);
        this.gatedReverb.setBypass(false);
        this.gatedReverb.setGateTime(180);
        this.gatedReverb.setMix(0.50);
        this.tapeSat.setBypass(false);
        this.tapeSat.setDrive(0.40);
        break;

      case "whitney_ballad":
      case "foster_ballad":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.chorus.setBypass(true);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.15);
        this.reverb.setDecay(2.0);
        this.masterEq.setLowGain(1.0);
        this.masterEq.setHighGain(2.2);
        break;

      case "triton_ep":
      case "rnb_ep":
      case "triton_dyno_ep":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.chorus.setBypass(true);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.10);
        this.reverb.setDecay(1.5);
        break;

      case "distortion_guitar":
      case "rock_lead":
      case "shreddage_lead_guitar":
        this.setPresetTrim(1.0);
        this.tube.setBypass(false);
        this.tube.setDrive(0.50);
        this.tube.setMix(0.55);
        this.tube.setTone(5000);
        this.autopan.setBypass(true);
        this.chorus.setBypass(true);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.12);
        this.reverb.setDecay(1.5);
        break;

      case "m1_organ":
      case "m1_rock_organ":
      case "drawbar_organ":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.chorus.setBypass(true);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.12);
        this.reverb.setDecay(1.6);
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
        this.chorus.setBypass(true);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.15);
        this.reverb.setDecay(2.0);
        break;

      case "synth_lead":
      case "fat_brass_horns":
      case "brass_section":
      case "m1_fresh_air":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.phaser.setBypass(true);
        this.chorus.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.12);
        this.reverb.setDecay(1.5);
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
        this.reverb.setMix(0.12);
        this.reverb.setDecay(1.6);
        this.masterEq.setLowGain(1.0);
        this.masterEq.setHighGain(1.8);
        break;
    }

    if (this.onPresetChangeCallback) {
      try { this.onPresetChangeCallback(); } catch (e) {}
    }
  }
}
