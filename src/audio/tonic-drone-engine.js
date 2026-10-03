/**
 * Tonic Drone Engine
 * A dedicated virtual analog engine that plays an infinite ambient drone.
 * Isolated from the main synth engine so it persists across patch changes.
 */

import { audioCore } from "./audio-core.js";

export class TonicDroneEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.voices = []; // Array of active oscillator nodes
    this.activeKey = null;
    this.volume = 0.5;
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

  playDrone(noteName) {
    if (!this.ctx) this.init();
    
    // If playing the same note, toggle off
    if (this.activeKey === noteName) {
      this.stopDrone();
      return;
    }

    // Stop current drone gracefully
    this.stopDrone();

    this.activeKey = noteName;
    const freq = this.getFrequency(noteName);

    // Create a lush 3-oscillator drone
    const now = this.ctx.currentTime;
    
    const droneVoice = this.ctx.createGain();
    droneVoice.gain.setValueAtTime(0, now);
    // Very slow, swelling attack (3 seconds)
    droneVoice.gain.linearRampToValueAtTime(0.3, now + 3.0);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, now); // Warm, muffled start
    
    // Slowly sweep the filter open and closed using an LFO
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.1; // 10 seconds per cycle
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    // 3 detuned oscillators (Sub, Root, Fifth)
    const freqs = [freq / 2, freq, freq * 1.501]; 
    const types = ["sine", "sawtooth", "triangle"];
    
    const oscs = freqs.map((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = types[i];
      // Slight detune for thickness
      osc.frequency.value = f + (Math.random() * 2 - 1); 
      osc.connect(filter);
      osc.start();
      return osc;
    });

    filter.connect(droneVoice);
    droneVoice.connect(this.masterGain);

    this.voices = [{ gain: droneVoice, oscs, filter, lfo }];
  }

  stopDrone() {
    if (this.voices.length === 0) return;
    
    const now = this.ctx.currentTime;
    this.voices.forEach(voice => {
      // Long beautiful release tail (4 seconds)
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + 4.0);
      
      setTimeout(() => {
        try {
          voice.oscs.forEach(osc => osc.stop());
          voice.lfo.stop();
          voice.gain.disconnect();
        } catch (e) {}
      }, 4500);
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
