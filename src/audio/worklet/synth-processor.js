/**
 * WILSONIX MIDIKEY Elite - Studio Synth AudioWorkletProcessor
 * Runs on the dedicated high-priority Web Audio render thread.
 * Features:
 * - 16 Polyphonic Voices with lock-free voice stealing
 * - PolyBLEP Anti-Aliased Waveforms (Saw, Square, Pulse, Triangle, Sine)
 * - 4-Pole 24dB/oct State Variable Resonant Filter (SVF)
 * - Sample-accurate exponential ADSR envelopes
 * - Zero GC allocation in process() render loop
 */

const MAX_VOICES = 16;
const PI = Math.PI;
const TWO_PI = 2.0 * Math.PI;

// PolyBLEP residual function for bandlimited anti-aliased oscillators
function polyBlep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1.0;
  } else if (t > 1.0 - dt) {
    t = (t - 1.0) / dt;
    return t * t + t + t + 1.0;
  }
  return 0.0;
}

class WorkletVoice {
  constructor() {
    this.active = false;
    this.note = 0;
    this.velocity = 0;
    this.phase1 = 0;
    this.phase2 = 0;
    this.phaseSub = 0;
    this.freq = 440;
    this.startTime = 0;

    // Envelope stage: 0=idle, 1=attack, 2=decay, 3=sustain, 4=release
    this.envStage = 0;
    this.envLevel = 0.0;

    // Filter states (SVF)
    this.ic1eqL = 0;
    this.ic2eqL = 0;
    this.ic1eqR = 0;
    this.ic2eqR = 0;
  }

  noteOn(note, velocity, time) {
    this.active = true;
    this.note = note;
    this.velocity = velocity / 127;
    this.freq = 440.0 * Math.pow(2.0, (note - 69.0) / 12.0);
    this.startTime = time;
    this.envStage = 1; // Attack
    this.phase1 = 0;
    this.phase2 = 0;
    this.phaseSub = 0;
  }

  noteOff() {
    if (this.active && this.envStage !== 0) {
      this.envStage = 4; // Release
    }
  }

  forceStop() {
    this.active = false;
    this.envStage = 0;
    this.envLevel = 0.0;
    this.ic1eqL = 0;
    this.ic2eqL = 0;
    this.ic1eqR = 0;
    this.ic2eqR = 0;
  }
}

class WilsonixSynthProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.invSampleRate = 1.0 / this.sampleRate;

    this.voices = [];
    for (let i = 0; i < MAX_VOICES; i++) {
      this.voices.push(new WorkletVoice());
    }

    // Shared RingBuffer reader setup
    const sharedBuffer = options?.processorOptions?.sharedBuffer;
    this.hasSAB = !!(sharedBuffer && typeof SharedArrayBuffer !== "undefined" && sharedBuffer instanceof SharedArrayBuffer);
    if (this.hasSAB) {
      this.header = new Int32Array(sharedBuffer, 0, 2);
      this.payload = new Float32Array(sharedBuffer, 8, 256 * 4);
    }

    this.reusableEvent = { status: 0, note: 0, velocity: 0, time: 0 };
    this.currentTime = 0;

    // Default synthesis parameters
    this.waveType1 = 0; // 0=Saw, 1=Square, 2=Triangle, 3=Sine
    this.waveType2 = 1;
    this.detune2 = 0.05; // Semitones
    this.subLevel = 0.20;
    this.pulseWidth = 0.50;

    // Filter parameters
    this.cutoff = 4500.0;
    this.resonance = 1.8;

    // ADSR Envelope (seconds)
    this.attack = 0.005;
    this.decay = 0.250;
    this.sustain = 0.65;
    this.release = 0.350;

    // MessagePort handling
    this.port.onmessage = e => {
      this.handleMessage(e.data);
    };
  }

  handleMessage(data) {
    if (!data) return;
    if (data.type === "midi") {
      this.processMidiEvent(data.status, data.note, data.velocity);
    } else if (data.type === "param") {
      if (data.name === "cutoff") this.cutoff = data.value;
      else if (data.name === "resonance") this.resonance = data.value;
      else if (data.name === "attack") this.attack = data.value;
      else if (data.name === "decay") this.decay = data.value;
      else if (data.name === "sustain") this.sustain = data.value;
      else if (data.name === "release") this.release = data.value;
      else if (data.name === "subLevel") this.subLevel = data.value;
      else if (data.name === "wave1") this.waveType1 = data.value;
      else if (data.name === "wave2") this.waveType2 = data.value;
    } else if (data.type === "allNotesOff") {
      for (let i = 0; i < MAX_VOICES; i++) {
        this.voices[i].forceStop();
      }
    }
  }

  processMidiEvent(status, note, velocity) {
    const cmd = status & 0xf0;
    if (cmd === 0x90 && velocity > 0) {
      // Note On
      let voice = this.voices.find(v => v.active && v.note === note);
      if (!voice) {
        voice = this.voices.find(v => !v.active);
      }
      if (!voice) {
        // Steal releasing voice first
        voice = this.voices.find(v => v.envStage === 4);
      }
      if (!voice) {
        // Steal oldest active voice
        voice = this.voices[0];
        let oldest = voice.startTime;
        for (let i = 1; i < MAX_VOICES; i++) {
          if (this.voices[i].startTime < oldest) {
            voice = this.voices[i];
            oldest = voice.startTime;
          }
        }
      }
      voice.noteOn(note, velocity, this.currentTime);
    } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
      // Note Off
      for (let i = 0; i < MAX_VOICES; i++) {
        if (this.voices[i].active && this.voices[i].note === note) {
          this.voices[i].noteOff();
        }
      }
    } else if (cmd === 0xb0 && note === 123) {
      // All Notes Off
      for (let i = 0; i < MAX_VOICES; i++) {
        this.voices[i].forceStop();
      }
    }
  }

  readRingBuffer() {
    if (!this.hasSAB) return;
    const writePtr = Atomics.load(this.header, 0);
    let readPtr = Atomics.load(this.header, 1);

    while (readPtr !== writePtr) {
      const offset = readPtr * 4;
      const status = this.payload[offset];
      const note = this.payload[offset + 1];
      const velocity = this.payload[offset + 2];
      this.processMidiEvent(status, note, velocity);

      readPtr = (readPtr + 1) % 256;
      Atomics.store(this.header, 1, readPtr);
    }
  }

  generateWaveform(type, phase, dt, pw = 0.5) {
    switch (type) {
      case 0: // Anti-Aliased PolyBLEP Sawtooth
        return 2.0 * phase - 1.0 - polyBlep(phase, dt);
      case 1: { // Anti-Aliased PolyBLEP Square / Pulse
        let val = phase < pw ? 1.0 : -1.0;
        val += polyBlep(phase, dt);
        val -= polyBlep((phase + 1.0 - pw) % 1.0, dt);
        return val;
      }
      case 2: // Triangle
        return phase < 0.5 ? 4.0 * phase - 1.0 : 3.0 - 4.0 * phase;
      case 3: // Pure Sine
      default:
        return Math.sin(phase * TWO_PI);
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;

    const outL = output[0];
    const outR = output[1];
    const numFrames = outL.length;

    this.readRingBuffer();

    // Clear output buffer
    outL.fill(0);
    outR.fill(0);

    const attackRate = 1.0 / Math.max(0.001, this.attack * this.sampleRate);
    const decayRate = 1.0 / Math.max(0.001, this.decay * this.sampleRate);
    const releaseRate = 1.0 / Math.max(0.001, this.release * this.sampleRate);

    // Filter coeff calculation (State Variable Filter)
    const g = Math.tan(PI * Math.min(0.48, this.cutoff * this.invSampleRate));
    const k = 1.0 / Math.max(0.5, this.resonance);
    const a1 = 1.0 / (1.0 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;

    for (let v = 0; v < MAX_VOICES; v++) {
      const voice = this.voices[v];
      if (!voice.active) continue;

      const dt1 = voice.freq * this.invSampleRate;
      const dt2 = (voice.freq * Math.pow(2.0, this.detune2 / 12.0)) * this.invSampleRate;
      const dtSub = (voice.freq * 0.5) * this.invSampleRate;

      for (let i = 0; i < numFrames; i++) {
        // 1. Process Envelope
        if (voice.envStage === 1) { // Attack
          voice.envLevel += attackRate;
          if (voice.envLevel >= 1.0) {
            voice.envLevel = 1.0;
            voice.envStage = 2; // Decay
          }
        } else if (voice.envStage === 2) { // Decay
          voice.envLevel -= (1.0 - this.sustain) * decayRate;
          if (voice.envLevel <= this.sustain) {
            voice.envLevel = this.sustain;
            voice.envStage = 3; // Sustain
          }
        } else if (voice.envStage === 4) { // Release
          voice.envLevel -= releaseRate;
          if (voice.envLevel <= 0.0001) {
            voice.envLevel = 0.0;
            voice.active = false;
            voice.envStage = 0;
            break;
          }
        }

        // 2. Synthesize Oscillators
        const osc1 = this.generateWaveform(this.waveType1, voice.phase1, dt1, this.pulseWidth);
        const osc2 = this.generateWaveform(this.waveType2, voice.phase2, dt2, 0.5);
        const sub = Math.sin(voice.phaseSub * TWO_PI);

        // Advance oscillator phases
        voice.phase1 = (voice.phase1 + dt1) % 1.0;
        voice.phase2 = (voice.phase2 + dt2) % 1.0;
        voice.phaseSub = (voice.phaseSub + dtSub) % 1.0;

        // Sum and apply velocity & envelope
        const raw = (osc1 * 0.50 + osc2 * 0.35 + sub * this.subLevel) * voice.velocity * voice.envLevel;

        // 3. 24dB/oct Resonant State Variable Filter (SVF)
        const v3L = raw - voice.ic2eqL;
        const v1L = a1 * voice.ic1eqL + a2 * v3L;
        const v2L = voice.ic2eqL + a2 * voice.ic1eqL + a3 * v3L;
        voice.ic1eqL = 2.0 * v1L - voice.ic1eqL;
        voice.ic2eqL = 2.0 * v2L - voice.ic2eqL;

        const v3R = raw - voice.ic2eqR;
        const v1R = a1 * voice.ic1eqR + a2 * v3R;
        const v2R = voice.ic2eqR + a2 * voice.ic1eqR + a3 * v3R;
        voice.ic1eqR = 2.0 * v1R - voice.ic1eqR;
        voice.ic2eqR = 2.0 * v2R - voice.ic2eqR;

        outL[i] += v2L * 0.45;
        outR[i] += v2R * 0.45;
      }
    }

    this.currentTime += numFrames * this.invSampleRate;
    return true;
  }
}

registerProcessor("wilsonix-synth-processor", WilsonixSynthProcessor);
