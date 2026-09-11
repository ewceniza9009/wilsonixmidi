/**
 * Ableton & Workstation Master FX Rack Manager
 * Chains: Tube Drive -> Phaser -> Korg Chorus -> Rotary -> Ping-Pong Delay -> Algorithmic Reverb -> EQ & Limiter
 */

import { audioCore } from "./audio-core.js";
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
import { ShimmerReverb } from "./effects/shimmer-reverb.js";
import { DubSpaceEcho } from "./effects/dub-echo.js";
import { DynamicAutoWah } from "./effects/auto-wah.js";
import { TalkboxFormantFilter } from "./effects/talkbox-filter.js";
import { VinylLoFiTape } from "./effects/vinyl-lofi.js";

export class FxRackManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    // Instantiate all elite effects
    this.pianoAcoustics = new GrandPianoAcoustics(ctx);
    this.autoWah = new DynamicAutoWah(ctx);
    this.talkbox = new TalkboxFormantFilter(ctx);
    this.tube = new TubeDrive(ctx);
    this.vinylLoFi = new VinylLoFiTape(ctx);
    this.autopan = new AutoPan(ctx);
    this.phaser = new StereoPhaser(ctx);
    this.flanger = new StereoFlanger(ctx);
    this.chorus = new KorgStereoChorus(ctx);
    this.rotary = new RotarySpeaker(ctx);
    this.tremolo = new TremoloPulse(ctx);
    this.slapback = new SlapbackTapeDelay(ctx);
    this.dubEcho = new DubSpaceEcho(ctx);
    this.delay = new PingPongDelay(ctx);
    this.springReverb = new SpringReverb(ctx);
    this.shimmerReverb = new ShimmerReverb(ctx);
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

  // DYNAMIC SERIES CHAIN. Instead of permanently wiring all 14 effect slots
  // (their 14 dry-gain junctions stayed in the graph whenever ANY effect was
  // engaged — wasted render threads on modest laptops → overrun static), the
  // audio graph is rebuilt from ONLY the engaged effects, in rack order.
  //
  //   all bypassed:  input ─► fastPathGain ─► presetTrim ─► masterEq ─► output
  //   some engaged:  input ─► fx1.input ─► fx1.output ─► fx2.input ─► ... ─► presetTrim ─► masterEq ─► output
  //
  // Whole-graph rebuilds happen only on FX toggle / preset load (UI actions),
  // never on the audio-note hot path, so cost is irrelevant. Bypassed effects
  // are physically absent from the graph → zero render-thread pull.
  _updateChainRouting() {
    const engaged = this._chainEffects.filter(e => e.enabled);

    // Tear down the previous topology completely (disconnect all outputs).
    try { this.input.disconnect(); } catch (e) {}
    if (this._chainEngaged) {
      this._chainEngaged.forEach(e => {
        try { e.output.disconnect(); } catch (err) {}
      });
    }

    if (engaged.length === 0) {
      // FAST PATH: single unity gain — the absolute minimum graph.
      this.input.connect(this.fastPathGain);
    } else {
      // SERIES PATH: only engaged effects, in rack order.
      this.input.connect(engaged[0].input);
      for (let i = 0; i < engaged.length - 1; i++) {
        engaged[i].output.connect(engaged[i + 1].input);
      }
      engaged[engaged.length - 1].output.connect(this.presetTrimNode);
    }

    this._chainEngaged = engaged;
    this.chainConnected = engaged.length > 0;
  }

  chainEffects() {
    // FAST PATH: direct unity route used when every effect is bypassed.
    // input -> fastPathGain -> presetTrim -> masterEq -> output
    this.fastPathGain = this.ctx.createGain();
    this.fastPathGain.gain.value = 1.0;
    this.input.connect(this.fastPathGain);
    this.fastPathGain.connect(this.presetTrimNode);
    this.presetTrimNode.connect(this.masterEq.input);
    this.masterEq.output.connect(this.output);

    const chain = [
      this.pianoAcoustics,
      this.autoWah,
      this.talkbox,
      this.tube,
      this.vinylLoFi,
      this.autopan,
      this.phaser,
      this.flanger,
      this.chorus,
      this.rotary,
      this.tremolo,
      this.slapback,
      this.dubEcho,
      this.delay,
      this.springReverb,
      this.shimmerReverb,
      this.gatedReverb,
      this.reverb,
      this.tapeSat,
    ];
    this._chainEffects = chain;
    this._chainEngaged = null;
    this.chainConnected = false;

    // Route every setBypass caller (rack presets, FX UI, engine patches) through
    // a single point that rebuilds the dynamic series chain.
    chain.forEach(effect => {
      const orig = effect.setBypass ? effect.setBypass.bind(effect) : null;
      effect.setBypass = bypassed => {
        if (orig) orig(bypassed);
        this._updateChainRouting();
      };
    });

    // Defer wiring until all defaults are applied, so the fast path engages once.
    this._bootstrapping = true;

    // Default: 100% Clean Studio Concert Grand (Pure pristine samples)
    this.pianoAcoustics.setBypass(true);
    this.autoWah.setBypass(true);
    this.talkbox.setBypass(true);
    this.tube.setBypass(true);
    this.vinylLoFi.setBypass(true);
    this.autopan.setBypass(true);
    this.phaser.setBypass(true);
    this.flanger.setBypass(true);
    this.rotary.setBypass(true);
    this.tremolo.setBypass(true);
    this.slapback.setBypass(true);
    this.dubEcho.setBypass(true);
    this.delay.setBypass(true);
    this.chorus.setBypass(true);
    this.springReverb.setBypass(true);
    this.shimmerReverb.setBypass(true);
    this.gatedReverb.setBypass(true);
    this.tapeSat.setBypass(true);
    // Default: 100% clean, ALL effects (incl. reverb) bypassed → the FX fast-path
    // short-circuit stays active for instant touch-to-sound. Enable any effect in
    // the UI when you want ambience/tone shaping (that engages the series chain).
    this.reverb.setBypass(true);
    this.reverb.setMix(0.12);
    this.reverb.setDecay(1.6);

    // Apply the default topology once (fast path).
    this._bootstrapping = false;
    this._updateChainRouting();
  }

  triggerDubThrow(durationSec = 2.5) {
    if (this.dubEcho) this.dubEcho.triggerDubThrow(durationSec);
  }

  setPresetTrim(val) {
    if (!this.presetTrimNode) return;
    const g = Math.max(0.2, Math.min(1.5, val));
    this.presetTrimNode.gain.setTargetAtTime(g, this.ctx.currentTime, 0.02);
  }

  applyPreset(presetName) {
    // Reset all modulation/time-based units
    this.autoWah.setBypass(true);
    this.talkbox.setBypass(true);
    this.vinylLoFi.setBypass(true);
    this.flanger.setBypass(true);
    this.tremolo.setBypass(true);
    this.slapback.setBypass(true);
    this.dubEcho.setBypass(true);
    this.springReverb.setBypass(true);
    this.shimmerReverb.setBypass(true);
    this.gatedReverb.setBypass(true);
    this.tapeSat.setBypass(true);

    switch (presetName) {
      case "dub_space_echo":
      case "reggae_dub":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.chorus.setBypass(true);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.dubEcho.setBypass(false);
        this.dubEcho.setFeedback(0.32);
        this.dubEcho.setMix(0.24);
        this.springReverb.setBypass(false);
        this.springReverb.setMix(0.18);
        this.reverb.setBypass(true);
        this.masterEq.setLowGain(0.5);
        this.masterEq.setHighGain(0.5);
        break;

      case "shimmer_ethereal":
      case "worship_shimmer":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.chorus.setBypass(false);
        this.chorus.setMix(0.20);
        this.phaser.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.shimmerReverb.setBypass(false);
        this.shimmerReverb.setShimmer(0.40);
        this.shimmerReverb.setDecay(2.0);
        this.shimmerReverb.setMix(0.25);
        this.reverb.setBypass(true);
        break;

      case "funk_auto_wah":
      case "reggae_wah":
        this.setPresetTrim(1.0);
        this.autoWah.setBypass(false);
        this.autoWah.setSensitivity(1.0);
        this.autoWah.setResonance(2.2);
        this.tube.setBypass(true);
        this.chorus.setBypass(true);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.10);
        break;

      case "talkbox_vocal":
        this.setPresetTrim(1.0);
        this.talkbox.setBypass(false);
        this.talkbox.setMix(0.40);
        this.tube.setBypass(true);
        this.delay.setBypass(true);
        break;

      case "lofi_vinyl_tape":
        this.setPresetTrim(1.0);
        this.vinylLoFi.setBypass(false);
        this.vinylLoFi.setWobble(0.45);
        this.vinylLoFi.setMix(0.60);
        this.tapeSat.setBypass(false);
        this.tapeSat.setDrive(0.20);
        this.springReverb.setBypass(false);
        this.springReverb.setMix(0.12);
        break;
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

      case "rooftop_cathedral":
      case "dx7_ep1":
        this.setPresetTrim(1.0);
        this.tube.setBypass(true);
        this.autopan.setBypass(true);
        this.phaser.setBypass(true);
        this.flanger.setBypass(true);
        this.rotary.setBypass(true);
        this.delay.setBypass(true);
        this.slapback.setBypass(true);
        this.springReverb.setBypass(true);
        this.gatedReverb.setBypass(true);
        this.tapeSat.setBypass(true);
        this.chorus.setBypass(false);
        this.chorus.setRate(0.65);
        this.chorus.setDepth(1.0);
        this.chorus.setMix(0.65);
        this.reverb.setBypass(false);
        this.reverb.setMix(0.35);
        this.reverb.setDecay(2.1);
        this.masterEq.setLowGain(1.0);
        this.masterEq.setHighGain(1.8);
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
        this.reverb.setBypass(true);
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
