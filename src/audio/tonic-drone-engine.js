/**
 * Tonic Drone Engine
 * A dedicated virtual analog engine that plays an infinite ambient drone.
 * Isolated from the main synth engine so it persists across patch changes.
 */

import { audioCore } from "./audio-core.js";

export const DRONE_SOUND_PROFILES = {
  warm: {
    id: "warm",
    name: "Warm Analog",
    shortName: "Warm",
    description: "Classic smooth worship pad with warm analog filter sweep",
    createVoice: (ctx, freq, destGain, crossfadeSec) => {
      const now = ctx.currentTime;
      const droneVoice = ctx.createGain();
      droneVoice.gain.setValueAtTime(0, now);
      droneVoice.gain.linearRampToValueAtTime(0.3, now + crossfadeSec);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(420, now);

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.1;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 280;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      const freqs = [freq / 2, freq, freq * 1.501];
      const types = ["sine", "sawtooth", "triangle"];
      const oscs = freqs.map((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = types[i];
        osc.frequency.value = f + (Math.random() * 1.8 - 0.9);
        osc.connect(filter);
        osc.start();
        return osc;
      });

      filter.connect(droneVoice);
      droneVoice.connect(destGain);
      return { gain: droneVoice, oscs, filter, lfo };
    },
  },
  shimmer: {
    id: "shimmer",
    name: "Celestial Shimmer",
    shortName: "Shimmer",
    description: "Bright octave sparkle with gentle airy sweep",
    createVoice: (ctx, freq, destGain, crossfadeSec) => {
      const now = ctx.currentTime;
      const droneVoice = ctx.createGain();
      droneVoice.gain.setValueAtTime(0, now);
      droneVoice.gain.linearRampToValueAtTime(0.24, now + crossfadeSec);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400, now);

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.18;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 450;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      const freqs = [freq, freq * 2.003, freq * 3.002, freq / 2];
      const types = ["triangle", "sawtooth", "sine", "sine"];
      const oscs = freqs.map((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = types[i];
        osc.frequency.value = f + (Math.random() * 2.2 - 1.1);
        osc.connect(filter);
        osc.start();
        return osc;
      });

      filter.connect(droneVoice);
      droneVoice.connect(destGain);
      return { gain: droneVoice, oscs, filter, lfo };
    },
  },
  sub: {
    id: "sub",
    name: "Deep Foundation",
    shortName: "Deep Sub",
    description: "Dark, weighty sub-bass anchor for piano & guitars",
    createVoice: (ctx, freq, destGain, crossfadeSec) => {
      const now = ctx.currentTime;
      const droneVoice = ctx.createGain();
      droneVoice.gain.setValueAtTime(0, now);
      droneVoice.gain.linearRampToValueAtTime(0.35, now + crossfadeSec);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(240, now);

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 60;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      const freqs = [freq / 2, (freq / 2) * 1.002, freq];
      const types = ["sine", "sine", "triangle"];
      const oscs = freqs.map((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = types[i];
        osc.frequency.value = f;
        osc.connect(filter);
        osc.start();
        return osc;
      });

      filter.connect(droneVoice);
      droneVoice.connect(destGain);
      return { gain: droneVoice, oscs, filter, lfo };
    },
  },
  air: {
    id: "air",
    name: "Air Glass Pad",
    shortName: "Air Glass",
    description: "Whispering acoustic glass tone with soft harmonics",
    createVoice: (ctx, freq, destGain, crossfadeSec) => {
      const now = ctx.currentTime;
      const droneVoice = ctx.createGain();
      droneVoice.gain.setValueAtTime(0, now);
      droneVoice.gain.linearRampToValueAtTime(0.22, now + crossfadeSec);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(800, now);
      filter.Q.value = 0.8;

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.12;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 350;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      const freqs = [freq, freq * 1.5, freq * 2, freq * 4];
      const oscs = freqs.map((f) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f + (Math.random() * 0.8 - 0.4);
        osc.connect(filter);
        osc.start();
        return osc;
      });

      filter.connect(droneVoice);
      droneVoice.connect(destGain);
      return { gain: droneVoice, oscs, filter, lfo };
    },
  },
  cathedral: {
    id: "cathedral",
    name: "Cathedral Organ",
    shortName: "Organ",
    description: "Rich pipe organ harmonic drawbar foundation",
    createVoice: (ctx, freq, destGain, crossfadeSec) => {
      const now = ctx.currentTime;
      const droneVoice = ctx.createGain();
      droneVoice.gain.setValueAtTime(0, now);
      droneVoice.gain.linearRampToValueAtTime(0.26, now + crossfadeSec);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(850, now);

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 1.2;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.04;
      lfo.connect(lfoGain);
      lfoGain.connect(droneVoice.gain);
      lfo.start();

      const freqs = [freq / 2, freq, freq * 2, freq * 3];
      const types = ["sine", "triangle", "sine", "triangle"];
      const oscs = freqs.map((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = types[i];
        osc.frequency.value = f + (Math.random() * 0.6 - 0.3);
        osc.connect(filter);
        osc.start();
        return osc;
      });

      filter.connect(droneVoice);
      droneVoice.connect(destGain);
      return { gain: droneVoice, oscs, filter, lfo };
    },
  },
};

export class TonicDroneEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.voices = []; // Array of active oscillator nodes
    this.activeKey = null;
    this.volume = 0.5;
    let savedProfile = "warm";
    try {
      savedProfile = localStorage.getItem("wilsonix_drone_profile") || "warm";
    } catch (e) {}
    this.currentProfile = DRONE_SOUND_PROFILES[savedProfile] ? savedProfile : "warm";
  }

  init() {
    this.ctx = audioCore.ctx;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;

    // Connect directly to the master output (or FX input) so it's not affected by patch volume
    if (audioCore.fxRack && audioCore.fxRack.presetTrimNode) {
      this.masterGain.connect(audioCore.fxRack.presetTrimNode);
    } else {
      this.masterGain.connect(audioCore.masterOut);
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setProfile(profileId, { crossfade = true } = {}) {
    if (!DRONE_SOUND_PROFILES[profileId]) return;
    this.currentProfile = profileId;
    try {
      localStorage.setItem("wilsonix_drone_profile", profileId);
    } catch (e) {}

    // If a drone is active, smoothly crossfade into the new sound profile on that key!
    if (this.activeKey && crossfade) {
      this.playDrone(this.activeKey, { crossfadeSec: 1.4, forceRetrigger: true });
    }
  }

  playDrone(noteName, { crossfadeSec = 1.6, forceRetrigger = false } = {}) {
    if (!this.ctx) this.init();

    // If playing the same note and not forcing retrigger, toggle off
    if (this.activeKey === noteName && !forceRetrigger) {
      this.stopDrone({ fadeSec: 1.5 });
      return;
    }

    const now = this.ctx.currentTime;

    // Gracefully crossfade old voices out
    if (this.voices.length > 0) {
      this.voices.forEach((voice) => {
        try {
          voice.gain.gain.cancelScheduledValues(now);
          voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
          voice.gain.gain.linearRampToValueAtTime(0, now + crossfadeSec);
          setTimeout(() => {
            try {
              voice.oscs.forEach((osc) => osc.stop());
              if (voice.lfo) voice.lfo.stop();
              voice.gain.disconnect();
            } catch (e) {}
          }, (crossfadeSec + 0.5) * 1000);
        } catch (e) {}
      });
      this.voices = [];
    }

    this.activeKey = noteName;
    const freq = this.getFrequency(noteName);

    const profile =
      DRONE_SOUND_PROFILES[this.currentProfile] || DRONE_SOUND_PROFILES.warm;
    const voice = profile.createVoice(
      this.ctx,
      freq,
      this.masterGain,
      crossfadeSec,
    );
    this.voices = [voice];
  }

  stopDrone({ fadeSec = 2.0 } = {}) {
    if (this.voices.length === 0) {
      this.activeKey = null;
      return;
    }
    
    const now = this.ctx.currentTime;
    this.voices.forEach(voice => {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + fadeSec);
        
        setTimeout(() => {
          try {
            voice.oscs.forEach(osc => osc.stop());
            voice.lfo.stop();
            voice.gain.disconnect();
          } catch (e) {}
        }, (fadeSec + 0.5) * 1000);
      } catch (e) {}
    });
    
    this.voices = [];
    this.activeKey = null;
  }

  getFrequency(noteName) {
    // Map standard drone keys to frequencies (C2 octave)
    const map = {
      "C": 65.41,
      "C#": 69.30,
      "D": 73.42,
      "Eb": 77.78,
      "E": 82.41,
      "F": 87.31,
      "F#": 92.50,
      "G": 98.00,
      "Ab": 103.83,
      "A": 110.00,
      "Bb": 116.54,
      "B": 123.47
    };
    return map[noteName] || 65.41;
  }
}

export const tonicDroneEngine = new TonicDroneEngine();
if (typeof window !== "undefined") {
  window.tonicDroneEngine = tonicDroneEngine;
}
