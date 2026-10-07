/**
 * shimmer-fx-processor.js
 * An AudioWorklet processor that implements a granular pitch shifter (+12 semitones)
 * mixed with a lush reverberation to create an angelic "Shimmer" effect.
 */

class ShimmerFxProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = 44100; // Will adapt to context, just default
    
    // Granular pitch shift parameters
    this.pitchRatio = 2.0; // +1 octave
    this.grainSizeMs = 60;
    this.overlap = 0.5;
    
    // Allocate buffer for 1 second max
    this.bufferSize = 48000; 
    this.bufferL = new Float32Array(this.bufferSize);
    this.bufferR = new Float32Array(this.bufferSize);
    this.writePointer = 0;
    
    this.grains = [
      this.createGrain(),
      this.createGrain()
    ];
    // Offset second grain by half the grain size
    this.grains[1].phase = 0.5;

    // Simple feedback/reverb state
    this.feedback = 0.6;
    this.mix = 0.5;

    this.port.onmessage = (e) => {
      if (e.data.type === "setMix") {
        this.mix = Math.max(0, Math.min(1, e.data.value));
      }
    };
  }

  createGrain() {
    return {
      phase: 0,
      readPointer: 0
    };
  }

  process(inputs, outputs, _parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;
    
    const inL = input[0];
    const inR = input[1] || input[0]; // mono fallback
    const outL = output[0];
    const outR = output[1] || output[0];
    
    const sr = typeof sampleRate !== "undefined" ? sampleRate : 44100;
    const grainFrames = Math.floor((this.grainSizeMs / 1000) * sr);
    const phaseInc = 1 / grainFrames;

    for (let i = 0; i < inL.length; i++) {
      // 1. Write to delay buffer (with feedback from previous output sample)
      this.bufferL[this.writePointer] = inL[i] + (this.prevOutL || 0) * this.feedback;
      this.bufferR[this.writePointer] = inR[i] + (this.prevOutR || 0) * this.feedback;
      
      let sumL = 0;
      let sumR = 0;

      // 2. Process Granular Pitch Shift
      for (let g = 0; g < this.grains.length; g++) {
        const grain = this.grains[g];
        
        // Hann window envelope
        const window = 0.5 * (1 - Math.cos(2 * Math.PI * grain.phase));
        
        // Read from delay buffer
        let readIdx = Math.floor(this.writePointer - grain.readPointer);
        if (readIdx < 0) readIdx += this.bufferSize;
        
        sumL += this.bufferL[readIdx] * window;
        sumR += this.bufferR[readIdx] * window;
        
        // Advance grain phase
        grain.phase += phaseInc;
        if (grain.phase >= 1.0) {
          grain.phase -= 1.0;
          grain.readPointer = 0; // reset to current write pointer
        } else {
          // Read pointer moves at pitchRatio relative to write pointer
          // If pitchRatio = 2.0 (octave up), read pointer moves twice as fast
          grain.readPointer += this.pitchRatio; 
        }
      }

      // 3. Mix and output
      const oL = (inL[i] * (1 - this.mix)) + (sumL * this.mix);
      const oR = (inR[i] * (1 - this.mix)) + (sumR * this.mix);
      outL[i] = oL;
      outR[i] = oR;
      this.prevOutL = oL;
      this.prevOutR = oR;
      
      this.writePointer = (this.writePointer + 1) % this.bufferSize;
    }

    return true;
  }
}

registerProcessor("shimmer-fx-processor", ShimmerFxProcessor);
