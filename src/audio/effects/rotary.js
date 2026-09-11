/**
 * Authentic Leslie 122 Rotary Speaker Cabinet Simulator
 * Powerful mechanical dual-rotor Doppler pitch shift and stereo panning tremolo.
 * Unmistakable swirling Hammond B3 organ & gospel Rhodes sound with dynamic Slow/Fast inertia.
 */

export class RotarySpeaker {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.speedMode = "slow"; // 'slow' (Chorale), 'fast' (Tremolo), 'brake'
    this.hornRate = 0.85; // Hz
    this.drumRate = 0.72; // Hz
    this.mix = 1.0; // 100% through Leslie cabinet
    this.enabled = false;

    this.buildNetwork();
  }

  buildNetwork() {
    const ctx = this.ctx;

    // Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.dryGain.gain.value = 1.0;

    // 800Hz Crossover Filter
    this.crossoverHigh = ctx.createBiquadFilter();
    this.crossoverHigh.type = "highpass";
    this.crossoverHigh.frequency.value = 800;

    this.crossoverLow = ctx.createBiquadFilter();
    this.crossoverLow.type = "lowpass";
    this.crossoverLow.frequency.value = 800;

    this.input.connect(this.crossoverHigh);
    this.input.connect(this.crossoverLow);

    // 1. Treble Horn Rotor: Doppler Pitch Vibrato + Stereo Panning
    this.hornDelay = ctx.createDelay(0.05);
    this.hornDelay.delayTime.value = 0.006;

    this.hornLfo = ctx.createOscillator();
    this.hornLfo.type = "sine";
    this.hornLfo.frequency.value = this.hornRate;

    // Doppler pitch modulation depth (ultra-subtle - no wow, no flutter)
    this.hornDoppler = ctx.createGain();
    this.hornDoppler.gain.value = 0.0006;
    this.hornLfo.connect(this.hornDoppler);
    this.hornDoppler.connect(this.hornDelay.delayTime);

    this.crossoverHigh.connect(this.hornDelay);

    // Horn Stereo Pan Tremolo
    this.hornPanner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (this.hornPanner) {
      this.hornPanGain = ctx.createGain();
      this.hornPanGain.gain.value = 0.35; // Gentle stereo movement
      this.hornLfo.connect(this.hornPanGain);
      this.hornPanGain.connect(this.hornPanner.pan);
      this.hornDelay.connect(this.hornPanner);
    }

    // 2. Bass Drum Rotor: Acoustic amplitude throb (calibrated for exact unity acoustic loudness)
    this.drumTremoloGain = ctx.createGain();
    this.drumTremoloGain.gain.value = 0.50;

    this.drumLfo = ctx.createOscillator();
    this.drumLfo.type = "sine";
    this.drumLfo.frequency.value = this.drumRate;

    this.drumDepth = ctx.createGain();
    this.drumDepth.gain.value = 0.20; // Rhythmic rotary throb
    this.drumLfo.connect(this.drumDepth);
    this.drumDepth.connect(this.drumTremoloGain.gain);

    this.crossoverLow.connect(this.drumTremoloGain);

    // Horn level for equal-power summing with drum
    this.hornLevel = ctx.createGain();
    this.hornLevel.gain.value = 0.50;

    // Combine Horn and Drum into Wet Output
    if (this.hornPanner) {
      this.hornPanner.connect(this.hornLevel);
    } else {
      this.hornDelay.connect(this.hornLevel);
    }
    this.hornLevel.connect(this.wetGain);
    this.drumTremoloGain.connect(this.wetGain);

    this.wetGain.gain.value = 0.0; // Bypassed by default
    this.wetGain.connect(this.output);

    this.hornLfo.start();
    this.drumLfo.start();
  }

  toggleSpeed() {
    this.setSpeed(this.speedMode === "slow" ? "fast" : "slow");
  }

  setSpeed(mode) {
    this.speedMode = mode;
    const now = this.ctx.currentTime;
    let targetHorn = 0.85;
    let targetDrum = 0.72;

    if (mode === "fast") {
      targetHorn = 6.8; // ~400 RPM
      targetDrum = 5.9; // ~350 RPM
    } else if (mode === "brake") {
      targetHorn = 0.001;
      targetDrum = 0.001;
    }

    // Realistic mechanical rotor inertia
    this.hornLfo.frequency.setTargetAtTime(targetHorn, now, 0.45);
    this.drumLfo.frequency.setTargetAtTime(targetDrum, now, 0.95);
  }

  setMix(val) {
    this.mix = Math.max(0, Math.min(1.0, val));
    const now = this.ctx.currentTime;
    if (this.enabled) {
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5);
      const dryFrac = Math.cos(this.mix * Math.PI * 0.5);
      this.wetGain.gain.setTargetAtTime(wetFrac, now, 0.02);
      this.dryGain.gain.setTargetAtTime(dryFrac, now, 0.02);
    }
  }

  setBypass(bypassed) {
    this.enabled = !bypassed;
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (bypassed) {
      this.wetGain.gain.setValueAtTime(0.0, now);
      this.dryGain.gain.setValueAtTime(1.0, now);
    } else {
      const wetFrac = Math.sin(this.mix * Math.PI * 0.5);
      const dryFrac = Math.cos(this.mix * Math.PI * 0.5);
      this.wetGain.gain.setValueAtTime(wetFrac, now);
      this.dryGain.gain.setValueAtTime(dryFrac, now);
    }
  }
}
