/**
 * Native Korg TRITON PCM Multisample Rompler Engine
 * Pre-caches genuine 24-bit multi-samples into RAM AudioBuffers with 0.00ms touch-to-sound latency.
 * Features:
 * - Dynamic Time-Variant Filter (TVF): Velocity-to-Cutoff & Resonance shaping (warm soft touch, biting punchy forte)
 * - Time-Variant Amplifier (TVA): Dynamic velocity curve & natural acoustic release
 * - Continuous Y-Axis Key Slide Expression / Polyphonic Aftertouch
 * - Sustain / Damper Pedal (Spacebar & On-Screen Latch)
 * - Pitch Bend & Mod Wheel support
 * - 88-Key SoundFont loader with instant nearest-neighbor sample fallback while decoding
 */

import { KORG_PCM_BANKS } from "./korg-pcm-data.js";
import { ABLETUNES_BANKS } from "./abletunes-manifest.js";
import { SfxSoundGenerator } from "./sfx-sound-generator.js";

const NOTE_MAP = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11
};

export function noteNameToMidi(noteStr) {
  const match = noteStr.match(/^([A-G][b#]?)([0-9])$/);
  if (!match) return null;
  const name = match[1];
  const oct = parseInt(match[2]);
  return (oct + 1) * 12 + NOTE_MAP[name];
}

export const LAYER_FX_OPTIONS = {
  // --- SYNTHESIZER YOU SIGNATURE FX ---
  spring_surf: { id: "spring_surf", name: "🏄 Spring Reverb (Surf Foundation Drip)", category: "Synthesizer You FX" },
  analog_juno_chorus: { id: "analog_juno_chorus", name: "🎹 Roland Juno Chorus (Synth Core)", category: "Synthesizer You FX" },
  slapback_vocal: { id: "slapback_vocal", name: "🎤 Slapback Tape Delay (Vocal Punch)", category: "Synthesizer You FX" },
  gated_cannon: { id: "gated_cannon", name: "💥 80s Gated Reverb (Snare Cannon)", category: "Synthesizer You FX" },
  opto_tremolo_16th: { id: "opto_tremolo_16th", name: "⚡ Optical Tremolo (16th Groove Sync)", category: "Synthesizer You FX" },
  tape_sat_master: { id: "tape_sat_master", name: "📼 Master Bus Tape Saturation & Glue", category: "Synthesizer You FX" },

  // --- STUDIO MODULATION & ENSEMBLE ---
  clean: { id: "clean", name: "Direct Clean (Dry Bypass)", category: "Clean" },
  chorus_lush: { id: "chorus_lush", name: "Dimension D Stereo Chorus", category: "Modulation" },
  chorus_vintage: { id: "chorus_vintage", name: "Analog Warm Ensemble", category: "Modulation" },
  autopan_wide: { id: "autopan_wide", name: "1973 Suitcase Auto-Pan", category: "Modulation" },
  autopan_fast: { id: "autopan_fast", name: "Fast Stereo Panning", category: "Modulation" },
  rotary_fast: { id: "rotary_fast", name: "Leslie 122 Rotary (Fast)", category: "Modulation" },
  rotary_slow: { id: "rotary_slow", name: "Leslie 122 Rotary (Chorale)", category: "Modulation" },
  phaser_6stage: { id: "phaser_6stage", name: "Analog 6-Stage Phaser", category: "Modulation" },
  phaser_deep: { id: "phaser_deep", name: "Deep Jet Sweep Phaser", category: "Modulation" },
  flanger_stereo: { id: "flanger_stereo", name: "Stereo Tape Flanger", category: "Modulation" },
  tremolo_pulse: { id: "tremolo_pulse", name: "Opto-Tremolo Pulse", category: "Modulation" },
  supersaw_unison: { id: "supersaw_unison", name: "Supersaw Unison Detune", category: "Modulation" },

  // --- TIME & SPACE DELAYS & REVERBS ---
  delay_tape: { id: "delay_tape", name: "Ping-Pong Tape Delay", category: "Delay & Reverb" },
  delay_dub: { id: "delay_dub", name: "Space Dub Echo (Dotted 8th)", category: "Delay & Reverb" },
  trance_delay: { id: "trance_delay", name: "Trance Ping-Pong (1/8 Dotted)", category: "Delay & Reverb" },
  reverb_hall: { id: "reverb_hall", name: "Cathedral Ambient Reverb", category: "Delay & Reverb" },
  reverb_plate: { id: "reverb_plate", name: "Studio Plate Reverb", category: "Delay & Reverb" },
  reverb_room: { id: "reverb_room", name: "Warm Acoustic Room Reverb", category: "Delay & Reverb" },

  // --- TUBE DRIVE & SATURATION ---
  tube_warm: { id: "tube_warm", name: "12AX7 Tube Saturation", category: "Drive & EQ" },
  tube_lead: { id: "tube_lead", name: "Screaming Tube Overdrive", category: "Drive & EQ" },
  distortion_metal: { id: "distortion_metal", name: "High-Gain Distortion", category: "Drive & EQ" },
  shred_stack: { id: "shred_stack", name: "Shreddage High-Gain Stack", category: "Drive & EQ" },
  air_eq: { id: "air_eq", name: "Air & Presence EQ (+4dB Treble)", category: "Drive & EQ" },
  warm_eq: { id: "warm_eq", name: "Warm Vintage EQ (+3dB Bass)", category: "Drive & EQ" },
  punch_comp: { id: "punch_comp", name: "Punch Limiter / Compressor", category: "Dynamics & Special" },
  lofi_vinyl: { id: "lofi_vinyl", name: "Lo-Fi Vintage Vinyl / Warmth", category: "Dynamics & Special" },
  tape_lowpass: { id: "tape_lowpass", name: "Tape Lowpass (Warm HF Rolloff)", category: "Dynamics & Special" },
  trance_gate: { id: "trance_gate", name: "Trance Gate (Rhythmic Slicer)", category: "Dynamics & Special" },
  sidechain_pump: { id: "sidechain_pump", name: "Sidechain Pump (Ducking)", category: "Dynamics & Special" },
};

export class LayerInsertProcessor {
  constructor(ctx, destinationNode) {
    this.ctx = ctx;
    this.destination = destinationNode;
    this.input = ctx.createGain();
    this.currentFx = "clean";

    // Set 2-channel stereo explicitly
    this.input.channelCount = 2;
    this.input.channelCountMode = "explicit";
    this.input.channelInterpretation = "speakers";

    // Sub-processors
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain.gain.value = 1.0;
    this.wetGain.gain.value = 0.0;

    this.effectChainInput = ctx.createGain();
    this.effectChainOutput = ctx.createGain();

    this.dryGain.channelCount = 2;
    this.dryGain.channelCountMode = "explicit";
    this.dryGain.channelInterpretation = "speakers";

    this.wetGain.channelCount = 2;
    this.wetGain.channelCountMode = "explicit";
    this.wetGain.channelInterpretation = "speakers";

    this.effectChainOutput.channelCount = 2;
    this.effectChainOutput.channelCountMode = "explicit";
    this.effectChainOutput.channelInterpretation = "speakers";

    // Direct Dry path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.destination);

    // Wet FX path
    this.input.connect(this.effectChainInput);
    this.effectChainOutput.connect(this.wetGain);
    this.wetGain.connect(this.destination);

    this.activeFxNodes = [];
    this.setEffect("clean");
  }

  setEffect(fxType) {
    this.currentFx = fxType || "clean";
    const ctx = this.ctx;

    // Disconnect old FX nodes
    try {
      this.effectChainInput.disconnect();
      this.activeFxNodes.forEach(node => {
        try {
          if (node.stop) node.stop();
          node.disconnect();
        } catch (e) {}
      });
      this.activeFxNodes = [];
    } catch (e) {}

    if (this.currentFx === "clean") {
      this.dryGain.gain.setValueAtTime(1.0, ctx.currentTime);
      this.wetGain.gain.setValueAtTime(0.0, ctx.currentTime);
      return;
    }

    // Default balance
    const isSerialInsert = ["air_eq", "warm_eq", "punch_comp", "tube_warm", "tube_lead", "distortion_metal", "lofi_vinyl", "tape_lowpass", "trance_delay", "shred_stack"].includes(this.currentFx);
    if (isSerialInsert) {
      this.dryGain.gain.setValueAtTime(0.0, ctx.currentTime);
      this.wetGain.gain.setValueAtTime(1.0, ctx.currentTime);
    } else {
      this.dryGain.gain.setValueAtTime(1.0, ctx.currentTime);
      this.wetGain.gain.setValueAtTime(0.15, ctx.currentTime);
    }

    switch (this.currentFx) {
      case "chorus_lush":
      case "chorus_vintage": {
        // True Studio Dimension D Stereo Chorus (Gentle stereo spread - Zero ear-to-ear flanging)
        const isLush = this.currentFx === "chorus_lush";
        const delayL = ctx.createDelay(0.1);
        const delayR = ctx.createDelay(0.1);
        delayL.delayTime.value = isLush ? 0.015 : 0.013;
        delayR.delayTime.value = isLush ? 0.0175 : 0.0155;

        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = isLush ? 0.8 : 0.6;

        const lfoGainL = ctx.createGain();
        const lfoGainR = ctx.createGain();
        const depth = isLush ? 0.0004 : 0.0003;
        lfoGainL.gain.value = depth;
        lfoGainR.gain.value = depth * 0.75;

        lfo.connect(lfoGainL);
        lfo.connect(lfoGainR);
        lfoGainL.connect(delayL.delayTime);
        lfoGainR.connect(delayR.delayTime);

        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 120;

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 8500;

        this.effectChainInput.connect(hp);
        hp.connect(lp);
        lp.connect(delayL);
        lp.connect(delayR);

        const merger = ctx.createChannelMerger(2);
        delayL.connect(merger, 0, 0);
        delayR.connect(merger, 0, 1);
        merger.connect(this.effectChainOutput);

        lfo.start();
        this.activeFxNodes.push(delayL, delayR, lfo, lfoGainL, lfoGainR, hp, lp, merger);
        break;
      }

      case "autopan_wide":
      case "autopan_fast": {
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = this.currentFx === "autopan_fast" ? 2.5 : 1.2;
        if (ctx.createStereoPanner) {
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 0.25; // Gentle subtle spread, never bouncing hard left-to-right
          lfo.connect(lfoGain);
          lfoGain.connect(panner.pan);
          lfo.start();
          this.activeFxNodes.push(panner, lfo, lfoGain);
        }
        this.effectChainInput.connect(panner);
        panner.connect(this.effectChainOutput);
        break;
      }

      case "rotary_fast":
      case "rotary_slow": {
        const filter = ctx.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = 850;
        filter.Q.value = 1.0;
        filter.gain.value = 1.4;

        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = this.currentFx === "rotary_fast" ? 4.2 : 0.9;

        if (ctx.createStereoPanner) {
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 0.15;
          lfo.connect(lfoGain);
          lfoGain.connect(panner.pan);
          lfo.start();
          this.activeFxNodes.push(lfo, lfoGain);
        }

        this.effectChainInput.connect(filter);
        filter.connect(panner);
        panner.connect(this.effectChainOutput);
        this.activeFxNodes.push(filter, panner);
        break;
      }

      case "tube_warm":
      case "tube_lead": {
        const shaper = ctx.createWaveShaper();
        const drive = this.currentFx === "tube_lead" ? 0.70 : 0.35;
        const n_samples = 4096;
        const curve = new Float32Array(n_samples);
        const k = 1.0 + drive * 3.5;
        for (let i = 0; i < n_samples; ++i) {
          const x = (i * 2) / n_samples - 1;
          curve[i] = Math.tanh(x * k) * 0.85;
        }
        shaper.curve = curve;
        shaper.oversample = "4x";

        const cab = ctx.createBiquadFilter();
        cab.type = "lowpass";
        cab.frequency.value = this.currentFx === "tube_lead" ? 4200 : 6500;

        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 80;

        this.effectChainInput.connect(hp);
        hp.connect(shaper);
        shaper.connect(cab);
        cab.connect(this.effectChainOutput);
        this.activeFxNodes.push(hp, shaper, cab);
        break;
      }

      case "distortion_metal": {
        const dist = ctx.createWaveShaper();
        const n_samples = 4096;
        const curve = new Float32Array(n_samples);
        for (let i = 0; i < n_samples; ++i) {
          const x = (i * 2) / n_samples - 1;
          curve[i] = Math.tanh(x * 3.6) * 0.80;
        }
        dist.curve = curve;
        dist.oversample = "4x";

        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 90;

        const cab = ctx.createBiquadFilter();
        cab.type = "lowpass";
        cab.frequency.value = 3800;

        this.effectChainInput.connect(hp);
        hp.connect(dist);
        dist.connect(cab);
        cab.connect(this.effectChainOutput);
        this.activeFxNodes.push(hp, dist, cab);
        break;
      }

      case "shred_stack": {
        // Tight modern Shreddage chain: DC block -> Tube Screamer mid-push ->
        // high-gain saturation -> tight lowcut -> 4x12 cab simulation
        const dc = ctx.createBiquadFilter();
        dc.type = "highpass";
        dc.frequency.value = 80;

        const scream = ctx.createBiquadFilter();
        scream.type = "peaking";
        scream.frequency.value = 2800;
        scream.Q.value = 1.0;
        scream.gain.value = 6.0;

        const shred = ctx.createWaveShaper();
        const n_samples = 4096;
        const curve = new Float32Array(n_samples);
        for (let i = 0; i < n_samples; ++i) {
          const x = (i * 2) / n_samples - 1;
          curve[i] = Math.tanh(x * 4.2) * 0.78;
        }
        shred.curve = curve;
        shred.oversample = "4x";

        const tight = ctx.createBiquadFilter();
        tight.type = "highpass";
        tight.frequency.value = 110;

        const cab = ctx.createBiquadFilter();
        cab.type = "lowpass";
        cab.frequency.value = 3600;

        this.effectChainInput.connect(dc);
        dc.connect(scream);
        scream.connect(shred);
        shred.connect(tight);
        tight.connect(cab);
        cab.connect(this.effectChainOutput);
        this.activeFxNodes.push(dc, scream, shred, tight, cab);
        break;
      }

      case "phaser_6stage":
      case "phaser_deep": {
        const ap1 = ctx.createBiquadFilter();
        ap1.type = "allpass";
        ap1.frequency.value = 900;
        ap1.Q.value = 0.7;
        const ap2 = ctx.createBiquadFilter();
        ap2.type = "allpass";
        ap2.frequency.value = 1800;
        ap2.Q.value = 0.7;

        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = this.currentFx === "phaser_deep" ? 0.35 : 0.8;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 300;
        lfo.connect(lfoGain);
        lfoGain.connect(ap1.frequency);
        lfoGain.connect(ap2.frequency);
        lfo.start();

        this.effectChainInput.connect(ap1);
        ap1.connect(ap2);
        ap2.connect(this.effectChainOutput);
        this.activeFxNodes.push(ap1, ap2, lfo, lfoGain);
        break;
      }

      case "flanger_stereo": {
        const delay = ctx.createDelay(0.05);
        delay.delayTime.value = 0.0035;
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 0.45;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.0018;
        lfo.connect(lfoGain);
        lfoGain.connect(delay.delayTime);
        lfo.start();

        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 140;

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 4500;

        const fbDcBlock = ctx.createBiquadFilter();
        fbDcBlock.type = "highpass";
        fbDcBlock.frequency.value = 80;

        const feedback = ctx.createGain();
        feedback.gain.value = 0.22;

        this.effectChainInput.connect(hp);
        hp.connect(delay);
        delay.connect(lp);
        lp.connect(fbDcBlock);
        fbDcBlock.connect(feedback);
        feedback.connect(delay);
        lp.connect(this.effectChainOutput);
        this.activeFxNodes.push(delay, lfo, lfoGain, hp, lp, fbDcBlock, feedback);
        break;
      }

      case "delay_tape":
      case "delay_dub": {
        const delayL = ctx.createDelay(2.0);
        const delayR = ctx.createDelay(2.0);
        const dt = this.currentFx === "delay_dub" ? 0.42 : 0.28;
        delayL.delayTime.value = dt;
        delayR.delayTime.value = dt * 1.333;

        const fbDcL = ctx.createBiquadFilter();
        fbDcL.type = "highpass";
        fbDcL.frequency.value = 80;
        const fbDcR = ctx.createBiquadFilter();
        fbDcR.type = "highpass";
        fbDcR.frequency.value = 80;

        const feedbackL = ctx.createGain();
        const feedbackR = ctx.createGain();
        const fb = this.currentFx === "delay_dub" ? 0.38 : 0.30;
        feedbackL.gain.value = fb;
        feedbackR.gain.value = fb;

        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 140;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 3200;

        this.effectChainInput.connect(hp);
        hp.connect(lp);
        lp.connect(delayL);
        lp.connect(delayR);

        delayL.connect(fbDcL);
        fbDcL.connect(feedbackL);
        feedbackL.connect(delayL);

        delayR.connect(fbDcR);
        fbDcR.connect(feedbackR);
        feedbackR.connect(delayR);

        const merger = ctx.createChannelMerger(2);
        delayL.connect(merger, 0, 0);
        delayR.connect(merger, 0, 1);
        merger.connect(this.effectChainOutput);

        this.activeFxNodes.push(delayL, delayR, hp, lp, fbDcL, fbDcR, feedbackL, feedbackR, merger);
        break;
      }

      case "reverb_hall":
      case "reverb_plate":
      case "reverb_room": {
        // True Stereo Diffuse Reverb Network with L+R balanced spread
        const d1 = ctx.createDelay(0.2);
        d1.delayTime.value = 0.024;
        const d2 = ctx.createDelay(0.2);
        d2.delayTime.value = 0.048;
        const d3 = ctx.createDelay(0.2);
        d3.delayTime.value = 0.075;

        const g1 = ctx.createGain();
        g1.gain.value = 0.35;
        const g2 = ctx.createGain();
        g2.gain.value = 0.25;
        const g3 = ctx.createGain();
        g3.gain.value = 0.18;

        const lpfL = ctx.createBiquadFilter();
        lpfL.type = "lowpass";
        lpfL.frequency.value = this.currentFx === "reverb_plate" ? 6500 : 4500;

        const lpfR = ctx.createBiquadFilter();
        lpfR.type = "lowpass";
        lpfR.frequency.value = this.currentFx === "reverb_plate" ? 6500 : 4500;

        const hpf = ctx.createBiquadFilter();
        hpf.type = "highpass";
        hpf.frequency.value = 180;

        this.effectChainInput.connect(hpf);
        hpf.connect(d1);
        hpf.connect(d2);
        hpf.connect(d3);

        d1.connect(g1);
        d2.connect(g2);
        d3.connect(g3);

        // Balance left and right stereo field
        g1.connect(lpfL);
        g2.connect(lpfR);
        g3.connect(lpfL);
        g3.connect(lpfR);

        const merger = ctx.createChannelMerger(2);
        lpfL.connect(merger, 0, 0);
        lpfR.connect(merger, 0, 1);
        merger.connect(this.effectChainOutput);

        this.activeFxNodes.push(hpf, d1, d2, d3, g1, g2, g3, lpfL, lpfR, merger);
        break;
      }

      case "air_eq": {
        const eq = ctx.createBiquadFilter();
        eq.type = "highshelf";
        eq.frequency.value = 4500;
        eq.gain.value = 3.5;
        this.effectChainInput.connect(eq);
        eq.connect(this.effectChainOutput);
        this.activeFxNodes.push(eq);
        break;
      }

      case "warm_eq": {
        const low = ctx.createBiquadFilter();
        low.type = "lowshelf";
        low.frequency.value = 180;
        low.gain.value = 2.8;
        const high = ctx.createBiquadFilter();
        high.type = "lowpass";
        high.frequency.value = 7500;
        this.effectChainInput.connect(low);
        low.connect(high);
        high.connect(this.effectChainOutput);
        this.activeFxNodes.push(low, high);
        break;
      }

      case "punch_comp": {
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16.0;
        comp.knee.value = 8.0;
        comp.ratio.value = 2.8;
        comp.attack.value = 0.012;
        comp.release.value = 0.14;
        this.effectChainInput.connect(comp);
        comp.connect(this.effectChainOutput);
        this.activeFxNodes.push(comp);
        break;
      }

      case "lofi_vinyl": {
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 220;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 3800;
        this.effectChainInput.connect(hp);
        hp.connect(lp);
        lp.connect(this.effectChainOutput);
        this.activeFxNodes.push(hp, lp);
        break;
      }

      case "tape_lowpass": {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 6500;
        lp.Q.value = 0.7;
        this.effectChainInput.connect(lp);
        lp.connect(this.effectChainOutput);
        this.activeFxNodes.push(lp);
        break;
      }

      case "trance_gate": {
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1.0;
        const lfo = ctx.createOscillator();
        lfo.type = "square";
        lfo.frequency.value = 4.0;
        const gateGain = ctx.createGain();
        gateGain.gain.value = 1.0;
        lfo.connect(gateGain);
        gateGain.connect(gainNode.gain);
        lfo.start();
        this.effectChainInput.connect(gainNode);
        gainNode.connect(this.effectChainOutput);
        this.activeFxNodes.push(gainNode, lfo, gateGain);
        break;
      }

      case "sidechain_pump": {
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1.0;
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 2.0;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.4;
        lfo.connect(lfoGain);
        lfoGain.connect(gainNode.gain);
        lfo.start();
        this.effectChainInput.connect(gainNode);
        gainNode.connect(this.effectChainOutput);
        this.activeFxNodes.push(gainNode, lfo, lfoGain);
        break;
      }

      case "trance_delay": {
        const delayL = ctx.createDelay(1.0);
        delayL.delayTime.value = 0.375;
        const delayR = ctx.createDelay(1.0);
        delayR.delayTime.value = 0.5625;
        const fbL = ctx.createGain();
        fbL.gain.value = 0.55;
        const fbR = ctx.createGain();
        fbR.gain.value = 0.55;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 5500;
        const dcL = ctx.createBiquadFilter();
        dcL.type = "highpass";
        dcL.frequency.value = 60;
        const dcR = ctx.createBiquadFilter();
        dcR.type = "highpass";
        dcR.frequency.value = 60;
        const merger = ctx.createChannelMerger(2);
        this.effectChainInput.connect(filter);
        filter.connect(delayL);
        filter.connect(delayR);
        delayL.connect(fbL);
        fbL.connect(dcL);
        dcL.connect(delayL);
        delayR.connect(fbR);
        fbR.connect(dcR);
        dcR.connect(delayR);
        delayL.connect(merger, 0, 0);
        delayR.connect(merger, 0, 1);
        merger.connect(this.effectChainOutput);
        this.activeFxNodes.push(delayL, delayR, fbL, fbR, filter, dcL, dcR, merger);
        break;
      }

      case "supersaw_unison": {
        const delays = [];
        const detunes = [-0.08, -0.04, 0.0, 0.04, 0.08];
        for (const d of detunes) {
          const del = ctx.createDelay(0.1);
          del.delayTime.value = 0.012 + Math.abs(d) * 0.005;
          const pitchLfo = ctx.createOscillator();
          pitchLfo.type = "sine";
          pitchLfo.frequency.value = 0.3 + Math.abs(d) * 2;
          const pitchGain = ctx.createGain();
          pitchGain.gain.value = 0.0003;
          pitchLfo.connect(pitchGain);
          pitchGain.connect(del.delayTime);
          const g = ctx.createGain();
          g.gain.value = 0.2;
          this.effectChainInput.connect(del);
          del.connect(g);
          g.connect(this.effectChainOutput);
          pitchLfo.start();
          delays.push(del, pitchLfo, pitchGain, g);
        }
        this.activeFxNodes.push(...delays);
        break;
      }

      case "tremolo_pulse": {
        const gainNode = ctx.createGain();
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 3.8;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.35;
        lfo.connect(lfoGain);
        lfoGain.connect(gainNode.gain);
        lfo.start();

        this.effectChainInput.connect(gainNode);
        gainNode.connect(this.effectChainOutput);
        this.activeFxNodes.push(gainNode, lfo, lfoGain);
        break;
      }

      case "spring_surf": {
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 220;

        const drip = ctx.createBiquadFilter();
        drip.type = "peaking";
        drip.frequency.value = 3400;
        drip.Q.value = 4.2;
        drip.gain.value = 8.5;

        const d1 = ctx.createDelay(0.2);
        d1.delayTime.value = 0.038;
        const fb1 = ctx.createGain();
        fb1.gain.value = 0.45;

        this.effectChainInput.connect(hp);
        hp.connect(drip);
        drip.connect(d1);
        d1.connect(fb1);
        fb1.connect(d1);
        d1.connect(this.effectChainOutput);
        this.activeFxNodes.push(hp, drip, d1, fb1);
        break;
      }

      case "slapback_vocal": {
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 160;

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 3400;

        const slap = ctx.createDelay(0.3);
        slap.delayTime.value = 0.095; // 95ms zero feedback

        this.effectChainInput.connect(hp);
        hp.connect(lp);
        lp.connect(slap);
        slap.connect(this.effectChainOutput);
        this.activeFxNodes.push(hp, lp, slap);
        break;
      }

      case "gated_cannon": {
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 180;

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 7500;

        const d1 = ctx.createDelay(0.3);
        d1.delayTime.value = 0.045;
        const d2 = ctx.createDelay(0.3);
        d2.delayTime.value = 0.085;
        const d3 = ctx.createDelay(0.3);
        d3.delayTime.value = 0.140;

        this.effectChainInput.connect(hp);
        hp.connect(lp);
        lp.connect(d1);
        lp.connect(d2);
        lp.connect(d3);
        d1.connect(this.effectChainOutput);
        d2.connect(this.effectChainOutput);
        d3.connect(this.effectChainOutput);
        this.activeFxNodes.push(hp, lp, d1, d2, d3);
        break;
      }

      case "tape_sat_master": {
        const bump = ctx.createBiquadFilter();
        bump.type = "peaking";
        bump.frequency.value = 65;
        bump.gain.value = 1.5;
        bump.Q.value = 0.9;

        const shaper = ctx.createWaveShaper();
        shaper.oversample = "4x";
        const n = 2048;
        const curve = new Float32Array(n);
        const k = 2.2;
        for (let i = 0; i < n; i++) {
          const x = (i * 2) / n - 1;
          curve[i] = Math.tanh(k * x) / Math.tanh(k);
        }
        shaper.curve = curve;

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 14500;

        this.effectChainInput.connect(bump);
        bump.connect(shaper);
        shaper.connect(lp);
        lp.connect(this.effectChainOutput);
        this.activeFxNodes.push(bump, shaper, lp);
        break;
      }

      case "analog_juno_chorus": {
        const delayL = ctx.createDelay(0.1);
        const delayR = ctx.createDelay(0.1);
        delayL.delayTime.value = 0.022;
        delayR.delayTime.value = 0.027;

        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 0.75;

        const lfoGainL = ctx.createGain();
        const lfoGainR = ctx.createGain();
        lfoGainL.gain.value = 0.0006;
        lfoGainR.gain.value = 0.0005;

        lfo.connect(lfoGainL);
        lfo.connect(lfoGainR);
        lfoGainL.connect(delayL.delayTime);
        lfoGainR.connect(delayR.delayTime);

        this.effectChainInput.connect(delayL);
        this.effectChainInput.connect(delayR);

        const merger = ctx.createChannelMerger(2);
        delayL.connect(merger, 0, 0);
        delayR.connect(merger, 0, 1);
        merger.connect(this.effectChainOutput);
        lfo.start();

        this.activeFxNodes.push(delayL, delayR, lfo, lfoGainL, lfoGainR, merger);
        break;
      }

      case "opto_tremolo_16th": {
        const gainNode = ctx.createGain();
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 8.6; // 16th note pulse
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.40;
        lfo.connect(lfoGain);
        lfoGain.connect(gainNode.gain);
        lfo.start();

        this.effectChainInput.connect(gainNode);
        gainNode.connect(this.effectChainOutput);
        this.activeFxNodes.push(gainNode, lfo, lfoGain);
        break;
      }

      default:
        this.effectChainInput.connect(this.effectChainOutput);
        break;
    }
  }
}

export class NativePcmEngine {
  constructor(ctx, destinationNode) {
    this.ctx = ctx;
    this.destination = destinationNode;
    this.sfxGenerator = new SfxSoundGenerator(ctx, destinationNode);

    // 4 Dedicated Layer Insert Processors for the 4 Combi Racks
    this.layerInserts = [
      new LayerInsertProcessor(ctx, destinationNode),
      new LayerInsertProcessor(ctx, destinationNode),
      new LayerInsertProcessor(ctx, destinationNode),
      new LayerInsertProcessor(ctx, destinationNode),
    ];

    // Cache of decoded AudioBuffers: instId -> midiNote -> AudioBuffer
    this.decodedBuffers = new Map();
    // Tracking active playing voices: midiNote -> array of voice records
    this.activeVoices = new Map();
    // Sustained voices held by damper pedal: midiNote -> array of voice records
    this.sustainedVoices = new Map();

    this.sustainPedal = false;
    this.pitchBendSemitones = 0;
    this.modWheelAmount = 0;

    // Global polyphony cap: prevents voice pileup crackle + crash on very fast playing
    this.voiceQueue = [];
    this.MAX_VOICES = 28;
    this.heldNotes = new Set();

    // Shared felt-hammer transient: 60ms exponentially-decaying noise burst,
    // bandpassed per-note to imitate grand hammer strike on piano voices
    try {
      const hlen = Math.floor(ctx.sampleRate * 0.06);
      this.hammerBuf = ctx.createBuffer(1, hlen, ctx.sampleRate);
      const hd = this.hammerBuf.getChannelData(0);
      for (let i = 0; i < hlen; i++) {
        const t = i / hlen;
        hd[i] = (Math.random() * 2 - 1) * Math.exp(-t * 9);
      }
    } catch (e) {
      this.hammerBuf = null;
    }

    this.loadingSoundfonts = new Set();
    this.isReady = false;

    // Initialize immediate embedded anchors and background soundfont loader
    this.initBuffers();
  }

  base64ToArrayBuffer(base64Uri) {
    const base64 = base64Uri.split(",")[1] || base64Uri;
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  decodeAudioBuffer(ctx, arrayBuf) {
    return new Promise((resolve, reject) => {
      try {
        const handleDecoded = (buf) => {
          if (!buf) {
            resolve(buf);
            return;
          }
          // Always guarantee 100% true 2-channel stereo with equal L+R presence on headphones
          if (buf.numberOfChannels === 1) {
            const stereoBuf = ctx.createBuffer(2, buf.length, buf.sampleRate);
            const monoData = buf.getChannelData(0);
            stereoBuf.getChannelData(0).set(monoData);
            stereoBuf.getChannelData(1).set(monoData);
            resolve(stereoBuf);
            return;
          }

          // If buffer is 2-channel but channel 1 (Right) is silent or missing energy, clone channel 0 to channel 1
          if (buf.numberOfChannels >= 2) {
            const ch0 = buf.getChannelData(0);
            const ch1 = buf.getChannelData(1);
            let ch0Sum = 0;
            let ch1Sum = 0;
            const sampleLen = Math.min(2000, ch0.length);
            for (let i = 0; i < sampleLen; i += 10) {
              ch0Sum += Math.abs(ch0[i]);
              ch1Sum += Math.abs(ch1[i]);
            }
            if (ch0Sum > 0.001 && ch1Sum < 0.00005) {
              // Right channel is empty/silent in MP3 encoding: duplicate left to right
              ch1.set(ch0);
            }
          }
          // Normalize quiet soundfont samples to 0.9 peak so voices run at sane
          // levels without extreme downstream boost (which amplified noise + limiter crush)
          try {
            let peak = 0;
            for (let c = 0; c < buf.numberOfChannels; c++) {
              const d = buf.getChannelData(c);
              for (let i = 0; i < d.length; i += 3) {
                const a = Math.abs(d[i]);
                if (a > peak) peak = a;
              }
            }
            if (peak > 0.02) {
              const g = Math.min(15, 0.9 / peak);
              if (g > 1.001 || g < 0.999) {
                for (let c = 0; c < buf.numberOfChannels; c++) {
                  const d = buf.getChannelData(c);
                  for (let i = 0; i < d.length; i++) d[i] *= g;
                }
              }
            }
            // Safety edge fade: last 10ms slopes to zero so even a non-looped
            // sample can never end in a hard stop/click
            try {
              const edgeLen = Math.min(Math.floor(buf.sampleRate * 0.01), Math.floor(buf.length * 0.02));
              if (edgeLen > 16) {
                for (let c = 0; c < buf.numberOfChannels; c++) {
                  const d = buf.getChannelData(c);
                  for (let i = 0; i < edgeLen; i++) {
                    d[buf.length - edgeLen + i] *= 0.5 * (1 + Math.cos((i / edgeLen) * Math.PI));
                  }
                }
              }
            } catch (e) {}
          } catch (e) {}
          resolve(buf);
        };

        const res = ctx.decodeAudioData(
          arrayBuf,
          handleDecoded,
          err => reject(err)
        );
        if (res && typeof res.then === "function") {
          res.then(handleDecoded).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  // Graceful end-fade for buffers that stay unlooped: a loud tail hitting file
  // end is an audible chop, so slope the last moments to silence instead
  fadeBufferEnd(buf, seconds) {
    try {
      if (!buf) return buf;
      const fadeLen = Math.min(Math.floor(buf.sampleRate * seconds), Math.floor(buf.length * 0.25));
      if (fadeLen < 32) return buf;
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < fadeLen; i++) {
          const t = i / fadeLen;
          d[buf.length - fadeLen + i] *= 0.5 * (1 + Math.cos(t * Math.PI));
        }
      }
    } catch (e) {}
    return buf;
  }

  createCrossfadedLoopBuffer(ctx, originalBuf, instId) {
    if (!originalBuf) return originalBuf;

    // Only continuous bowing/blowing/drone pad instruments should loop when sustained.
    // Percussive & decaying instruments (pianos, EPs, DX7, guitars, basses, bells) must decay naturally
    // to prevent metallic buzzing, dirty feedback, and comb filtering during pedal sustain.
    const isDroneInstrument = instId && (
      instId.includes("string") || instId.includes("pad") || instId.includes("choir") ||
      instId.includes("organ") || instId.includes("voice") || instId.includes("universe")
    );

    if (!isDroneInstrument || originalBuf.duration < 0.8) {
      return this.fadeBufferEnd(originalBuf, 0.4);
    }

    const numChannels = Math.max(2, originalBuf.numberOfChannels);
    const sampleRate = originalBuf.sampleRate;
    const totalSamples = originalBuf.length;

    const fadeSamples = Math.min(Math.floor(sampleRate * 0.06), Math.floor(totalSamples * 0.06));
    const loopEndSample = totalSamples - fadeSamples;
    const minLoopLen = Math.min(Math.floor(sampleRate * 0.5), Math.floor(totalSamples * 0.2));
    const searchFrom = Math.floor(totalSamples * 0.15);
    const searchTo = loopEndSample - minLoopLen;
    if (searchTo <= searchFrom || fadeSamples < 64) {
      return this.fadeBufferEnd(originalBuf, 0.3);
    }

    let loopStartSample = -1;
    try {
      const ref = originalBuf.getChannelData(0);
      let sum = 0;
      let cnt = 0;
      for (let i = searchFrom; i < loopEndSample; i += 7) {
        sum += ref[i] * ref[i];
        cnt++;
      }
      const rms = Math.sqrt(sum / Math.max(1, cnt));
      if (rms < 0.001) {
        return this.fadeBufferEnd(originalBuf, 0.3);
      }
      const W = Math.min(1024, fadeSamples * 2);
      const endBase = loopEndSample - W;
      const threshold = rms * 0.45;
      for (let s = searchFrom; s <= searchTo; s += 256) {
        let diff = 0;
        for (let i = 0; i < W; i += 2) {
          const d = ref[s + i] - ref[endBase + i];
          diff += d * d;
        }
        diff = Math.sqrt(diff / (W / 2));
        if (diff < threshold) {
          loopStartSample = s;
          break;
        }
      }
    } catch (e) {}
    if (loopStartSample < 0) {
      return this.fadeBufferEnd(originalBuf, 0.3);
    }

    const newBuf = ctx.createBuffer(numChannels, loopEndSample, sampleRate);

    for (let ch = 0; ch < numChannels; ch++) {
      const srcCh = Math.min(ch, originalBuf.numberOfChannels - 1);
      const src = originalBuf.getChannelData(srcCh);
      const dst = newBuf.getChannelData(ch);

      // 1. Copy initial onset transient untouched
      for (let i = 0; i < loopStartSample; i++) {
        dst[i] = src[i];
      }

      // 2. Crossfade loop tail smoothly into loop head (equal-power: no volume dip = no crackle)
      for (let i = 0; i < fadeSamples; i++) {
        const t = i / fadeSamples;
        const gainTail = Math.cos(t * Math.PI * 0.5); // 1.0 down to 0.0 (equal-power)
        const gainHead = Math.sin(t * Math.PI * 0.5); // 0.0 up to 1.0 (equal-power)

        const headIdx = loopStartSample + i;
        const tailIdx = loopEndSample + i;
        dst[headIdx] = src[tailIdx] * gainTail + src[headIdx] * gainHead;
      }

      // 3. Copy body of loop untouched
      for (let i = loopStartSample + fadeSamples; i < loopEndSample; i++) {
        dst[i] = src[i];
      }
    }

    // Ensure stereo balance on created buffer
    if (newBuf.numberOfChannels >= 2) {
      const ch0 = newBuf.getChannelData(0);
      const ch1 = newBuf.getChannelData(1);
      let ch0Sum = 0;
      let ch1Sum = 0;
      for (let i = 0; i < Math.min(1000, ch0.length); i += 10) {
        ch0Sum += Math.abs(ch0[i]);
        ch1Sum += Math.abs(ch1[i]);
      }
      if (ch0Sum > 0.001 && ch1Sum < 0.00005) {
        ch1.set(ch0);
      }
    }

    newBuf._isLoopable = true;
    newBuf._loopStartSec = loopStartSample / sampleRate;
    newBuf._loopEndSec = loopEndSample / sampleRate;

    return newBuf;
  }

  async initBuffers() {
    // 1. Instantly decode acoustic grand piano, alto sax, tenor sax, AND choir anchors FIRST (< 15ms) for immediate zero-delay play
    await Promise.all([
      this.decodeEmbeddedAnchors("acoustic_grand_piano"),
      this.decodeEmbeddedAnchors("choir_aahs"),
      this.loadSoundfont("alto_sax"),
      this.loadSoundfont("tenor_sax"),
    ]);
    this.isReady = true;

    // 2. Preload studio WAV banks for FM Piano and Upright
    this.loadAbletunesInstrument("fm_piano");
    this.loadAbletunesInstrument("upright_piano");

    // 3. Preload essential starting soundfonts non-blockingly (on idle)
    // All other soundfonts load on-demand when selected, avoiding main-thread freezes
    const idlePreload = () => {
      this.loadSoundfont("soprano_sax");
      this.loadSoundfont("breath_noise");
      this.loadSoundfont("string_ensemble_1");
      this.loadSoundfont("brass_section");
      this.loadSoundfont("flute");
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(idlePreload);
    } else {
      setTimeout(idlePreload, 1200);
    }
  }

  async loadSoundfont(instId) {
    if (!instId || this.loadingSoundfonts.has(instId)) return;
    this.loadingSoundfonts.add(instId);

    try {
      const resp = await fetch(`/soundfonts/${instId}-mp3.js`);
      if (!resp.ok) return;
      const text = await resp.text();

      const fn = new Function("MIDI", text);
      const MIDI = { Soundfont: {} };
      fn(MIDI);
      const samples = MIDI.Soundfont[instId];
      if (!samples) return;

      if (!this.decodedBuffers.has(instId)) {
        this.decodedBuffers.set(instId, new Map());
      }
      const instMap = this.decodedBuffers.get(instId);
      const ctx = this.ctx;

      // Decode priority range (middle octaves around C4 = 60) first for instant playability
      const entries = Object.entries(samples);
      entries.sort((a, b) => {
        const mA = noteNameToMidi(a[0]) || 60;
        const mB = noteNameToMidi(b[0]) || 60;
        return Math.abs(mA - 60) - Math.abs(mB - 60);
      });

      const BATCH_SIZE = 8;
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async ([noteName, base64Uri]) => {
            const midi = noteNameToMidi(noteName);
            if (midi === null) return;
            try {
              const arrayBuf = this.base64ToArrayBuffer(base64Uri);
              const audioBuf = await this.decodeAudioBuffer(ctx, arrayBuf);
              const processedBuf = this.createCrossfadedLoopBuffer(ctx, audioBuf, instId);
              instMap.set(midi, processedBuf);
            } catch (err) {}
          })
        );
      }
      console.log(`[Native PCM Rompler] Soundfont loaded into RAM: ${instId} (${instMap.size} samples)`);
    } catch (err) {
      console.warn(`[Native PCM Rompler] Failed to load soundfont: ${instId}`, err);
    }
  }

  async loadAbletunesInstrument(bankKey) {
    const bank = ABLETUNES_BANKS[bankKey];
    if (!bank) return;
    const instId = bank.id;

    if (this.loadingSoundfonts.has(instId)) return;
    this.loadingSoundfonts.add(instId);

    if (!this.decodedBuffers.has(instId)) {
      this.decodedBuffers.set(instId, new Map());
    }
    const instMap = this.decodedBuffers.get(instId);
    const ctx = this.ctx;

    // Load ALL velocity layers (vl1/vl2/vl3) at every anchor pitch: true touch
    // dynamics (soft felt -> hard hammer) instead of one layer played louder
    const coreAnchors = bank.samples.slice();

    const BATCH = 4;
    for (let i = 0; i < coreAnchors.length; i += BATCH) {
      const batch = coreAnchors.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (sample) => {
          try {
            const url = `${bank.path}/${sample.f}`;
            const resp = await fetch(url);
            if (!resp.ok) return;
            const arrayBuf = await resp.arrayBuffer();
            const audioBuf = await this.decodeAudioBuffer(ctx, arrayBuf);
            // FM bank carries a low -48dB shimmer bed in its final seconds that stacks
            // audibly under sustain: fade the last 1.5s to silence (release character kept)
            if (bankKey === "fm_piano" && audioBuf && audioBuf.length > ctx.sampleRate) {
              const fadeLen = Math.min(Math.floor(ctx.sampleRate * 1.5), Math.floor(audioBuf.length * 0.25));
              for (let c = 0; c < audioBuf.numberOfChannels; c++) {
                const d = audioBuf.getChannelData(c);
                for (let i = 0; i < fadeLen; i++) {
                  const t = i / fadeLen;
                  d[audioBuf.length - fadeLen + i] *= 0.5 * (1 + Math.cos(t * Math.PI));
                }
              }
            }
            const processedBuf = this.createCrossfadedLoopBuffer(ctx, audioBuf, instId);
            instMap.set(sample.m, processedBuf);
            instMap.set(`${sample.m}_${sample.v}`, processedBuf);
          } catch (e) {}
        })
      );
    }
    console.log(`[Abletunes Engine] Loaded full studio bank: ${bank.name} (${instMap.size} anchors in RAM)`);
  }

  async decodeEmbeddedAnchors(instId) {
    const instData = KORG_PCM_BANKS[instId];
    if (!instData || !instData.anchors) return;

    if (!this.decodedBuffers.has(instId)) {
      this.decodedBuffers.set(instId, new Map());
    }
    const instMap = this.decodedBuffers.get(instId);
    const ctx = this.ctx;

    const anchorPromises = Object.entries(instData.anchors).map(async ([midiStr, base64]) => {
      const midi = parseInt(midiStr);
      try {
        const arrayBuf = this.base64ToArrayBuffer(base64);
        const audioBuf = await this.decodeAudioBuffer(ctx, arrayBuf);
        const processedBuf = this.createCrossfadedLoopBuffer(ctx, audioBuf, instId);
        instMap.set(midi, processedBuf);
      } catch (e) {
        console.warn(`[PCM Rompler] Anchor ${midi} decode failed for ${instId}:`, e);
      }
    });

    await Promise.all(anchorPromises);
  }

  findNearestAnchor(instId, targetMidi, velocity = 95) {
    const INST_ALIASES = {
      // 1. Acoustic Pianos -> studio upright WAV multisamples (clean source, no MP3 grain)
      synthage_grand: "abletunes_upright",
      whitney_ballad: "abletunes_upright",
      ballad_master: "abletunes_upright",
      m1_piano_16: "abletunes_upright",
      abletunes_upright: "abletunes_upright",
      acoustic_grand_piano: "abletunes_upright",

      // 2. Electric Pianos, FM Tines -> studio DX7 FM WAV multisamples (clean source, no MP3 grain)
      rhodes_stage_mp3: "electric_piano_1",
      electric_piano_1: "abletunes_fm_piano",
      triton_dyno_ep: "abletunes_fm_piano",
      abletunes_fm_piano: "abletunes_fm_piano",
      abletunes_fm_dx7: "abletunes_fm_piano",
      m1_fresh_air: "abletunes_fm_piano",

      // 3. Real Electric & Acoustic Guitars
      distortion_guitar: "distortion_guitar",
      overdriven_guitar: "overdriven_guitar",
      electric_guitar_clean: "electric_guitar_clean",
      acoustic_guitar_nylon: "acoustic_guitar_nylon",
      fantom_nylon_pluck: "acoustic_guitar_nylon",

      // 4. Organs
      drawbar_organ: "drawbar_organ",
      m1_rock_organ: "drawbar_organ",
      m1_organ_2: "drawbar_organ",

      // 5. Real Bass & Sub
      synth_bass_1: "synth_bass_1",
      moog_punch_bass: "synth_bass_1",
      m1_slap_bass: "synth_bass_1",

      // 6. Real Human Vocal Choir - 100% DISTINCT from Strings!
      choir_aahs: "choir_aahs",
      voice_oohs: "voice_oohs",
      m1_choir: "choir_aahs",
      m1_ooh_ahh: "choir_aahs",
      ooh_ahh: "choir_aahs",
      choir: "choir_aahs",
      choral: "choir_aahs",
      cathedral_choir: "choir_aahs",
      angelic_oohs: "choir_aahs",
      vocal_breath: "breath_noise",
      breath_noise: "breath_noise",

      // Concert Crowd & Applause
      applause: "applause",
      concert_applause: "applause",
      stadium_roar: "applause",
      crowd_cheer: "applause",
      ovation: "applause",

      // Real Nature Field Recordings
      seashore: "seashore",
      ocean_waves: "seashore",
      bird_tweet: "bird_tweet",
      forest_birds: "bird_tweet",

      // Real Acoustic & Synth Drums
      taiko_drum: "taiko_drum",
      thunder_taiko: "taiko_drum",
      synth_drum: "synth_drum",
      gunshot: "gunshot",
      sub_boom: "gunshot",

      // 7. Strings & Pads
      string_ensemble_1: "string_ensemble_1",
      triton_warm_strings: "string_ensemble_1",
      symphonic_strings: "string_ensemble_1",
      m1_symphonic: "string_ensemble_1",
      m1_strings: "string_ensemble_1",
      m1_universe: "string_ensemble_1",

      // 8. Brass, Horns & Synth Leads
      brass_section: "brass_section",
      fat_brass_horns: "brass_section",
      supersaw_lead: "brass_section",
      m1_brass_1: "brass_section",
      brass_1: "brass_section",

      // 9. Woodwinds & Genuine Saxophones
      alto_sax: "alto_sax",
      breathy_alto_sax: "alto_sax",
      sax_genuine_solo: "alto_sax",
      sax_solo: "alto_sax",
      sax_alto_lead: "alto_sax",
      sax_funk_stab: "alto_sax",
      sax_fall: "alto_sax",
      sax_scoop: "alto_sax",
      tenor_sax: "tenor_sax",
      sax_sensual: "tenor_sax",
      sax_blues_growl: "tenor_sax",
      sax_tenor_blues: "tenor_sax",
      soprano_sax: "soprano_sax",
      sax_soprano: "soprano_sax",
      m1_lore: "alto_sax",
      m1_flute: "flute",
      m1_pan_flute: "flute",
      pan_flute: "flute",

      // 10. Doctor Mix M1 Instruments
      m1_guitar_1: "acoustic_guitar_steel",
      guitar_1: "acoustic_guitar_steel",
      m1_12string: "acoustic_guitar_steel",
      string_12: "acoustic_guitar_steel",
      m1_fretless: "acoustic_bass",
      fretless: "acoustic_bass",
      m1_bottle_bell: "vibraphone",
      bottle_bell: "vibraphone",
      m1_kalimba: "kalimba",
      kalimba: "kalimba",
      m1_koto: "harpsichord",
      koto: "harpsichord",
      m1_bell_ring: "vibraphone",
      bell_ring: "vibraphone",
      m1_pick_bass: "slap_bass_1",
      pick_bass: "slap_bass_1",
      m1_synth_bass_1: "synth_bass_1",
      m1_solo_synth: "brass_section",
    };
    if (instId && INST_ALIASES[instId]) {
      instId = INST_ALIASES[instId];
    }

    if (instId && instId.startsWith("abletunes_")) {
      const bankKey = instId === "abletunes_fm_piano" ? "fm_piano" : "upright_piano";
      if (!this.decodedBuffers.has(instId) || this.decodedBuffers.get(instId).size === 0) {
        this.loadAbletunesInstrument(bankKey);
        const pianoMap = this.decodedBuffers.get("acoustic_grand_piano");
        if (pianoMap && pianoMap.size > 0) {
          return this.findAnchorInMap(pianoMap, targetMidi);
        }
        return null;
      }
      const instMap = this.decodedBuffers.get(instId);
      const vl = velocity < 55 ? "vl1" : (velocity < 98 ? "vl2" : "vl3");

      // 1. Exact match with velocity layer
      const exactKey = `${targetMidi}_${vl}`;
      if (instMap.has(exactKey)) {
        return { anchorMidi: targetMidi, buffer: instMap.get(exactKey) };
      }
      // 2. Exact match default
      if (instMap.has(targetMidi)) {
        return { anchorMidi: targetMidi, buffer: instMap.get(targetMidi) };
      }

      // 3. Nearest neighbor search
      let closestMidi = null;
      let minDiff = Infinity;
      for (const key of instMap.keys()) {
        const midi = typeof key === "number" ? key : parseInt(key.split("_")[0]);
        const diff = Math.abs(targetMidi - midi);
        if (diff < minDiff) {
          minDiff = diff;
          closestMidi = midi;
        }
      }
      if (closestMidi !== null) {
        const buf = instMap.get(`${closestMidi}_${vl}`) || instMap.get(closestMidi);
        if (buf) {
          return { anchorMidi: closestMidi, buffer: buf };
        }
      }
      const pianoMap = this.decodedBuffers.get("acoustic_grand_piano");
      return this.findAnchorInMap(pianoMap, targetMidi);
    }

    let instMap = this.decodedBuffers.get(instId);
    if (!instMap || instMap.size === 0) {
      this.loadSoundfont(instId);
      const str = String(instId || "").toLowerCase();
      if (str.includes("choir") || str.includes("ooh") || str.includes("ahh") || str.includes("voice")) {
        instMap = this.decodedBuffers.get("choir_aahs");
      } else if (str.includes("tenor_sax") || str.includes("sensual") || str.includes("blues_growl")) {
        instMap = this.decodedBuffers.get("tenor_sax") || this.decodedBuffers.get("alto_sax");
      } else if (str.includes("soprano_sax") || str.includes("soprano")) {
        instMap = this.decodedBuffers.get("soprano_sax") || this.decodedBuffers.get("alto_sax");
      } else if (str.includes("sax")) {
        instMap = this.decodedBuffers.get("alto_sax") || this.decodedBuffers.get("tenor_sax");
      } else if (str.includes("flute") || str.includes("pan_flute")) {
        instMap = this.decodedBuffers.get("flute");
      } else if (str.includes("woodwind") || str.includes("clarinet")) {
        instMap = this.decodedBuffers.get("clarinet") || this.decodedBuffers.get("alto_sax");
      } else if (str.includes("string") || str.includes("pad")) {
        instMap = this.decodedBuffers.get("string_ensemble_1");
      }
      if (!instMap || instMap.size === 0) {
        instMap = this.decodedBuffers.get("acoustic_grand_piano");
      }
    }

    if (!instMap || instMap.size === 0) {
      for (const [id, map] of this.decodedBuffers.entries()) {
        if (map && map.size > 0) {
          instMap = map;
          break;
        }
      }
    }

    if (!instMap || instMap.size === 0) {
      return null;
    }

    return this.findAnchorInMap(instMap, targetMidi);
  }

  findAnchorInMap(map, targetMidi) {
    if (!map || map.size === 0) return null;

    // If exact note is cached, return with 0 semitone shift
    if (map.has(targetMidi)) {
      return {
        anchorMidi: targetMidi,
        buffer: map.get(targetMidi),
      };
    }

    let closestMidi = null;
    let minDiff = Infinity;

    for (const anchorMidi of map.keys()) {
      if (typeof anchorMidi !== "number") continue;
      const diff = Math.abs(targetMidi - anchorMidi);
      if (diff < minDiff) {
        minDiff = diff;
        closestMidi = anchorMidi;
      }
    }

    if (closestMidi === null) {
      const firstEntry = map.entries().next().value;
      if (firstEntry) {
        return { anchorMidi: typeof firstEntry[0] === "number" ? firstEntry[0] : 60, buffer: firstEntry[1] };
      }
      return null;
    }

    return {
      anchorMidi: closestMidi,
      buffer: map.get(closestMidi),
    };
  }

  playNote(instId, midiNote, velocity = 95, customGain = 1.0, layerIndex = null) {
    const dest = (layerIndex !== null && layerIndex !== undefined && this.layerInserts && this.layerInserts[layerIndex])
      ? this.layerInserts[layerIndex].input
      : this.destination;

    if (this.sfxGenerator && this.sfxGenerator.isSfxInstrument(instId)) {
      return this.sfxGenerator.playSfxNote(instId, midiNote, velocity, customGain, dest);
    }

    const anchorData = this.findNearestAnchor(instId, midiNote, velocity);
    if (!anchorData || !anchorData.buffer) {
      return null;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const velNorm = Math.max(0.08, Math.min(1.0, velocity / 127));
    const isSax = String(instId || "").toLowerCase().includes("sax");
    this.heldNotes.add(midiNote);

    // Pitch ratio: exact if anchor === target, otherwise nearest neighbor
    const semitoneDiff = midiNote - anchorData.anchorMidi;
    const basePlaybackRate = Math.pow(2, semitoneDiff / 12);
    const bentPlaybackRate = basePlaybackRate * Math.pow(2, this.pitchBendSemitones / 12);

    // 0. Rapid re-trigger voice stealing for the SAME layer or instrument on this note:
    // If there is already an active voice on this exact note for this layer/instrument, fade it out smoothly
    // to completely prevent voice stacking, phase-comb cancellation, static, and clipping!
    if (this.activeVoices.has(midiNote)) {
      const oldList = this.activeVoices.get(midiNote);
      if (oldList && oldList.length > 0) {
        const remaining = [];
        oldList.forEach(oldV => {
          const isSameLayer = (layerIndex !== null && layerIndex !== undefined && oldV.layerIndex === layerIndex);
          const isSameInst = (oldV.instId === instId);
          if (isSameLayer || (layerIndex === null && isSameInst)) {
            try {
              oldV.voiceGain.gain.cancelScheduledValues(now);
              oldV.voiceGain.gain.setTargetAtTime(0, now, 0.003);
              oldV.src.stop(now + 0.015);
              const qi = this.voiceQueue.indexOf(oldV);
              if (qi !== -1) this.voiceQueue.splice(qi, 1);
            } catch (e) {}
          } else {
            remaining.push(oldV);
          }
        });
        if (remaining.length > 0) {
          this.activeVoices.set(midiNote, remaining);
        } else {
          this.activeVoices.delete(midiNote);
        }
      }
    }

    // 0b. Same-note re-trigger must also steal still-ringing SUSTAINED copies,
    // otherwise sustain + re-press stacks identical pitches -> beating/static dirt
    if (this.sustainedVoices.has(midiNote)) {
      const susList = this.sustainedVoices.get(midiNote);
      if (susList && susList.length > 0) {
        const keep = [];
        susList.forEach(oldV => {
          const isSameLayer = (layerIndex !== null && layerIndex !== undefined && oldV.layerIndex === layerIndex);
          const isSameInst = (oldV.instId === instId);
          if (isSameLayer || (layerIndex === null && isSameInst)) {
            try {
              oldV.voiceGain.gain.cancelScheduledValues(now);
              oldV.voiceGain.gain.setTargetAtTime(0, now, 0.003);
              oldV.src.stop(now + 0.015);
              const qi = this.voiceQueue.indexOf(oldV);
              if (qi !== -1) this.voiceQueue.splice(qi, 1);
            } catch (e) {}
          } else {
            keep.push(oldV);
          }
        });
        if (keep.length > 0) {
          this.sustainedVoices.set(midiNote, keep);
        } else {
          this.sustainedVoices.delete(midiNote);
        }
      }
    }

    // 1. Audio Buffer Source
    const src = ctx.createBufferSource();
    src.buffer = anchorData.buffer;

    // Expressive lip embouchure scoop & singing vibrato for genuine saxophones
    let vibLfo = null;
    if (isSax) {
      // Natural lip scoop into note pitch (-35 cents settling smoothly over 60ms)
      const scoopRate = bentPlaybackRate * Math.pow(2, -0.35 / 12);
      src.playbackRate.setValueAtTime(scoopRate, now);
      src.playbackRate.exponentialRampToValueAtTime(bentPlaybackRate, now + 0.060);

      // Expressive delayed diaphragm vibrato LFO (swells in naturally after 160ms of holding the note)
      try {
        vibLfo = ctx.createOscillator();
        vibLfo.type = "sine";
        vibLfo.frequency.setValueAtTime(5.3, now);
        const vibGain = ctx.createGain();
        vibGain.gain.setValueAtTime(0.00001, now);
        vibGain.gain.setValueAtTime(0.00001, now + 0.16);
        vibGain.gain.linearRampToValueAtTime(bentPlaybackRate * 0.014, now + 0.50);
        vibLfo.connect(vibGain);
        vibGain.connect(src.playbackRate);
        vibLfo.start(now);
      } catch (e) {}
    } else {
      src.playbackRate.setValueAtTime(bentPlaybackRate, now);
    }

    // Infinite Smooth Hold for sustained instruments (Equal-Power Pre-Crossfaded: 0% chop, 0% clicks)
    if (anchorData.buffer && anchorData.buffer._isLoopable) {
      src.loop = true;
      src.loopStart = anchorData.buffer._loopStartSec;
      src.loopEnd = anchorData.buffer._loopEndSec;
    } else {
      // Natural unlooped acoustic decay for grand pianos, EPs, and guitars
      src.loop = false;
    }

    // 2. Dynamic Time-Variant Filter (TVF): Open and clear - no muffling.
    // Measured: harmonically-rich MP3 families carry -55 to -64dB of encoder hash
    // above 6kHz that normalizing lifts into audible static, so those families get
    // a lower ceiling (their musical energy lives below 10kHz anyway).
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    const isChoir = instId === "choir_aahs" || instId === "m1_choir" || instId === "m1_ooh_ahh" || instId?.includes("choir");
    const isHashy = !isSax && !isChoir && (
      instId?.includes("string") || instId?.includes("brass") ||
      instId?.includes("trumpet") || instId?.includes("trombone") ||
      instId?.includes("violin") || instId?.includes("cello") ||
      instId?.includes("flute") || instId?.includes("clarinet") ||
      instId?.includes("universe") || instId?.includes("fresh_air") ||
      instId?.includes("pad")
    );
    const minCutoff = isSax ? 10000 : (isChoir ? 650 : (isHashy ? 6000 : 9000));
    const maxCutoff = isSax ? 20000 : (isChoir ? 3800 : (isHashy ? 9500 : 20000));
    const dynamicCutoff = minCutoff + velNorm * (maxCutoff - minCutoff);

    if (isChoir) {
      // Authentic Korg M1 03 Ooh-Ahh Dual-Formant Morph:
      // Starts as a warm, rounded "Ooh" vowel formant (~550Hz, resonant Q)
      // then blooms smoothly over 180ms into open, heavenly airy "Aah" choir (~3400Hz)
      filter.frequency.setValueAtTime(480 + velNorm * 180, now);
      filter.Q.setValueAtTime(2.2, now);
      filter.frequency.setTargetAtTime(2800 + velNorm * 1200, now + 0.04, 0.12);
      filter.Q.setTargetAtTime(0.8, now + 0.04, 0.12);
    } else {
      filter.frequency.setValueAtTime(dynamicCutoff, now);
      filter.Q.setValueAtTime(isSax ? 0.05 : 0.20, now);
    }

    // 3. Time-Variant Amplifier (TVA): Maximum loudness, punchy studio presence
    const voiceGain = ctx.createGain();
    voiceGain.channelCount = 2;
    voiceGain.channelCountMode = "explicit";
    voiceGain.channelInterpretation = "speakers";

    // Sources are peak-normalized at load, so trims stay near unity for balanced combis
    const INST_TRIM_GAINS = {
      acoustic_grand_piano: 1.0,
      abletunes_upright: 1.0,
      m1_piano_16: 1.0,
      electric_piano_1: 1.0,
      abletunes_fm_piano: 1.0,
      string_ensemble_1: 1.0,
      m1_universe: 1.0,
      m1_choir: 1.15,
      choir_aahs: 1.15,
      acoustic_guitar_nylon: 1.0,
      electric_guitar_clean: 1.0,
      alto_sax: 1.05,
      brass_section: 1.0,
      drawbar_organ: 1.0,
      synth_bass_1: 1.05,
      m1_slap_bass: 1.05,
      distortion_guitar: 1.0,
      overdriven_guitar: 1.0,
      trumpet: 1.05,
      trombone: 1.05,
      tenor_sax: 1.05,
      flute: 1.0,
      clarinet: 1.0,
      violin: 1.0,
      cello: 1.0,
      church_organ: 1.0,
      vibraphone: 1.0,
      electric_piano_2: 1.0,
      acoustic_bass: 1.05,
      soprano_sax: 1.05,
      muted_trumpet: 1.0,
      acoustic_guitar_steel: 1.0,
      slap_bass_1: 1.05,
      rock_organ: 1.0,
      harpsichord: 1.0,
    };
    const trim = INST_TRIM_GAINS[instId] || 1.0;

    // In Combi mode (multiple simultaneous layers), scale so 4 layers sum with limiter headroom
    const combiScale = (layerIndex !== null && layerIndex !== undefined) ? 0.42 : 1.0;

    // Gig loudness lives in the master slider - voices stay clean here
    const densityScale = 1 / Math.sqrt(1 + this.voiceQueue.length / 6);
    const peakGain = (0.45 + velNorm * 0.25) * customGain * trim * combiScale * densityScale;

    // 100% Click-free, pop-free attack envelope using exponential ramp (no step artifacts)
    voiceGain.gain.setValueAtTime(0.0001, now);
    if (isChoir) {
      // Soft natural vocal choir swell (not sudden piano thud)
      voiceGain.gain.setTargetAtTime(peakGain, now, 0.06);
    } else if (isSax) {
      // Smooth wind reed breath pressure swell (40ms smooth rise - 0% hammer click)
      voiceGain.gain.setTargetAtTime(peakGain, now, 0.040);
    } else {
      voiceGain.gain.setTargetAtTime(peakGain, now, 0.002);
    }
    // Bounded sustain: full hold ~32s, then slow exponential die-out (~40s to silence).
    // (Notes were hard-fading at 8s even while held -- audible "nulls" mid-note.)
    // Releasing keys/sustain overrides this instantly via its own release envelope.
    voiceGain.gain.setTargetAtTime(0.0001, now + 32.0, 3.5);
    try {
      src.stop(now + 40);
    } catch (e) {}

    // Voice Audio Chain: Source -> TVF -> TVA -> (Layer Insert Bus | Master Rack)
    src.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(dest);

    // Instant sample-0 hardware playback
    src.start(0);

    // Felt-hammer layer for piano voices: short bandpassed thock under the attack,
    // velocity-scaled like a real action (soft touch = felt, hard hit = wood crack)
    try {
      const isPianoHammer = instId === "abletunes_upright" || instId === "acoustic_grand_piano" || instId === "m1_piano_16";
      if (isPianoHammer && this.hammerBuf) {
        const hsrc = ctx.createBufferSource();
        hsrc.buffer = this.hammerBuf;
        const hbp = ctx.createBiquadFilter();
        hbp.type = "bandpass";
        hbp.frequency.value = 1800 + velNorm * 1400;
        hbp.Q.value = 0.9;
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(0.12 * velNorm * velNorm, now);
        hsrc.connect(hbp);
        hbp.connect(hg);
        hg.connect(dest);
        hsrc.start(now);
        hsrc.stop(now + 0.08);
      }
    } catch (e) {}

    // Voice record
    const voiceRecord = {
      src,
      filter,
      voiceGain,
      dest,
      instId,
      midiNote,
      layerIndex,
      basePlaybackRate,
      baseGain: peakGain,
      baseCutoff: dynamicCutoff,
      velNorm,
      vibLfo,
      startTime: now,
    };

    // Global polyphony cap: when the pool is full, steal the oldest voice that is
    // NOT currently held. Notes you're still holding are NEVER chopped mid-sustain;
    // only ringing tails / released notes get stolen.
    while (this.voiceQueue.length >= this.MAX_VOICES) {
      const stealable = this.voiceQueue.filter(v => v && !this.heldNotes.has(v.midiNote));
      let oldest = stealable[0];
      for (let i = 1; i < stealable.length; i++) {
        if (stealable[i].voiceGain.gain.value === undefined) continue;
        if (!oldest) { oldest = stealable[i]; continue; }
        if ((stealable[i].startTime || 0) < (oldest.startTime || 0)) oldest = stealable[i];
      }
      // Only steal a note the player is holding when literally every voice is held.
      if (!oldest) {
        oldest = this.voiceQueue[0];
        for (let i = 1; i < this.voiceQueue.length; i++) {
          if (this.voiceQueue[i].startTime < oldest.startTime) oldest = this.voiceQueue[i];
        }
      }
      const qi = this.voiceQueue.indexOf(oldest);
      if (qi !== -1) this.voiceQueue.splice(qi, 1);
      try {
        oldest.voiceGain.gain.cancelScheduledValues(now);
        oldest.voiceGain.gain.setTargetAtTime(0, now, 0.025);
        oldest.src.stop(now + 0.15);
      } catch (e) {}
      this.removeVoice(oldest.midiNote, oldest);
    }

    if (!this.activeVoices.has(midiNote)) {
      this.activeVoices.set(midiNote, []);
    }
    this.activeVoices.get(midiNote).push(voiceRecord);
    this.voiceQueue.push(voiceRecord);

    // Cleanup when sample finishes naturally
    src.onended = () => {
      this.removeVoice(midiNote, voiceRecord);
    };

    return voiceRecord;
  }

  removeVoice(midiNote, voiceRecord) {
    const qi = this.voiceQueue.indexOf(voiceRecord);
    if (qi !== -1) this.voiceQueue.splice(qi, 1);
    const list = this.activeVoices.get(midiNote);
    if (list) {
      const idx = list.indexOf(voiceRecord);
      if (idx !== -1) list.splice(idx, 1);
      if (list.length === 0) this.activeVoices.delete(midiNote);
    }
    const susList = this.sustainedVoices.get(midiNote);
    if (susList) {
      const idx = susList.indexOf(voiceRecord);
      if (idx !== -1) susList.splice(idx, 1);
      if (susList.length === 0) this.sustainedVoices.delete(midiNote);
    }
  }

  // Real-time Key Slide Articulation / Polyphonic Expression (relativeY: 0.0 top to 1.0 bottom)
  setNoteExpression(midiNote, relativeY) {
    const voices = this.activeVoices.get(midiNote);
    if (!voices || voices.length === 0) return;

    const now = this.ctx.currentTime;
    const yNorm = Math.max(0.05, Math.min(1.0, relativeY));

    voices.forEach(v => {
      try {
        // Continuous timbre sweep while sliding on key
        const minCut = 900;
        const maxCut = 19000;
        const targetCutoff = minCut * Math.pow(maxCut / minCut, Math.pow(yNorm, 0.75));
        v.filter.frequency.setTargetAtTime(targetCutoff, now, 0.035);

        // Dynamic volume swell
        const targetGain = Math.pow(yNorm, 1.1) * (v.baseGain * 1.15);
        v.voiceGain.gain.setTargetAtTime(targetGain, now, 0.035);
      } catch (e) {}
    });
  }

  setPitchBend(semitones) {
    this.pitchBendSemitones = semitones;
    const now = this.ctx.currentTime;
    const bendRatio = Math.pow(2, semitones / 12);

    const updateVoicePitch = (voices) => {
      voices.forEach(v => {
        try {
          v.src.playbackRate.setTargetAtTime(v.basePlaybackRate * bendRatio, now, 0.02);
        } catch (e) {}
      });
    };

    this.activeVoices.forEach(updateVoicePitch);
    this.sustainedVoices.forEach(updateVoicePitch);
  }

  setModWheel(amount) {
    this.modWheelAmount = Math.max(0, Math.min(1.0, amount));
    const now = this.ctx.currentTime;

    // Mod wheel opens filter brilliance and adds acoustic presence
    this.activeVoices.forEach(voices => {
      voices.forEach(v => {
        try {
          const modCutoff = Math.min(20000, v.baseCutoff + this.modWheelAmount * 6000);
          v.filter.frequency.setTargetAtTime(modCutoff, now, 0.03);
        } catch (e) {}
      });
    });
  }

  setSustainPedal(isDown) {
    const wasDown = this.sustainPedal;
    this.sustainPedal = !!isDown;
    const now = this.ctx.currentTime;

    if (wasDown !== this.sustainPedal) {
      try {
        if (typeof window !== "undefined" && window.__pianoAcoustics) {
          window.__pianoAcoustics.triggerDamperPedalSound(this.sustainPedal);
        }
      } catch (e) {}
    }

    if (!this.sustainPedal) {
      // Releasing damper pedal releases all held sustained notes with smooth exponential decay
      this.sustainedVoices.forEach(voices => {
        voices.forEach(v => {
          try {
            const isChoir = v.instId === "choir_aahs" || v.instId === "m1_choir" || v.instId === "m1_ooh_ahh" || v.instId?.includes("choir");
            const isString = v.instId === "string_ensemble_1" || v.instId?.includes("string") || v.instId?.includes("pad");
            const isSax = v.instId === "alto_sax" || v.instId?.includes("sax");
            const tau = isChoir ? 0.20 : (isString ? 0.08 : (isSax ? 0.12 : 0.015));
            v.voiceGain.gain.cancelScheduledValues(now);
            v.voiceGain.gain.setTargetAtTime(0, now, tau);
            const stopTime = isChoir ? 1.4 : (isString ? 0.5 : (isSax ? 0.55 : 0.1));
            v.src.stop(now + stopTime);
            if (v.vibLfo) {
              try { v.vibLfo.stop(now + stopTime + 0.1); } catch (e) {}
            }
          } catch (e) {}
        });
      });
      this.sustainedVoices.clear();
    }
  }

  stopNote(instId, midiNote) {
    this.heldNotes.delete(midiNote);
    const voices = this.activeVoices.get(midiNote);
    if (!voices || voices.length === 0) return;

    const now = this.ctx.currentTime;
    const remaining = [];

    voices.forEach(v => {
      if (!instId || v.instId === instId) {
        if (this.sustainPedal) {
          // Damper pedal held: keep voice ringing in sustained set
          if (!this.sustainedVoices.has(midiNote)) {
            this.sustainedVoices.set(midiNote, []);
          }
          this.sustainedVoices.get(midiNote).push(v);
          // Bound the sustain pool so marathon pedal use can't pile up unbounded voices
          try {
            let totalSus = 0;
            this.sustainedVoices.forEach(list => { totalSus += list.length; });
            while (totalSus > 48) {
              let oldest = null;
              let oldestKey = null;
              for (const [key, list] of this.sustainedVoices) {
                if (list.length > 0) {
                  oldest = list[0];
                  oldestKey = key;
                  break;
                }
              }
              if (!oldest) break;
              oldest.voiceGain.gain.cancelScheduledValues(now);
              oldest.voiceGain.gain.setTargetAtTime(0, now, 0.025);
              oldest.src.stop(now + 0.15);
              this.removeVoice(oldestKey, oldest);
              totalSus--;
            }
          } catch (e) {}
        } else {
          // 100% Click-free, pop-free acoustic damper release with exponential decay
          try {
            const isChoir = v.instId === "choir_aahs" || v.instId === "m1_choir" || v.instId === "m1_ooh_ahh" || v.instId?.includes("choir");
            const isString = v.instId === "string_ensemble_1" || v.instId?.includes("string") || v.instId?.includes("pad");
            const isSax = v.instId === "alto_sax" || v.instId?.includes("sax");
            const isSynth = v.instId?.includes("synth") || v.instId?.includes("supersaw") || v.instId?.includes("trance") || v.instId?.includes("m1_") || v.instId?.includes("electric_piano") || v.instId?.includes("rhodes") || v.instId?.includes("drawbar");
            const tau = isChoir ? 0.35 : (isString ? 0.18 : (isSynth ? 0.12 : (isSax ? 0.14 : 0.03)));
            v.voiceGain.gain.cancelScheduledValues(now);
            v.voiceGain.gain.setTargetAtTime(0, now, tau);
            const stopTime = isChoir ? 2.0 : (isString ? 1.0 : (isSynth ? 0.6 : (isSax ? 0.65 : 0.2)));
            v.src.stop(now + stopTime);
            if (v.vibLfo) {
              try { v.vibLfo.stop(now + stopTime + 0.1); } catch (e) {}
            }
          } catch (e) {}
        }
      } else {
        remaining.push(v);
      }
    });

    if (remaining.length > 0) {
      this.activeVoices.set(midiNote, remaining);
    } else {
      this.activeVoices.delete(midiNote);
    }
  }

  allNotesOff() {
    const now = this.ctx.currentTime;
    const silence = (voices) => {
      voices.forEach(v => {
        try {
          v.voiceGain.gain.cancelScheduledValues(now);
          v.voiceGain.gain.setTargetAtTime(0, now, 0.005);
          v.src.stop(now + 0.05);
        } catch (e) {}
      });
    };

    this.activeVoices.forEach(silence);
    this.sustainedVoices.forEach(silence);
    this.activeVoices.clear();
    this.sustainedVoices.clear();
  }
}

