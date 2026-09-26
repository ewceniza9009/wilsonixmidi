/**
 * FX AudioWorkletProcessor
 * Runs the FX chain on the audio thread to eliminate main-thread graph rebuilds
 */

const MAX_DELAY_SAMPLES = 48000 * 2; // 2 seconds at 48kHz

class DelayLine {
  constructor(maxSamples = MAX_DELAY_SAMPLES) {
    this.buffer = new Float32Array(maxSamples);
    this.writeIndex = 0;
    this.maxSamples = maxSamples;
    this.delaySamples = 0;
    this.feedback = 0;
    this.lowpassFreq = 0;
    this.lowpassState = 0;
  }

  setDelayTime(seconds, sampleRate) {
    this.delaySamples = Math.floor(seconds * sampleRate);
  }

  setFeedback(fb) {
    this.feedback = Math.max(0, Math.min(0.99, fb));
  }

  setLowpass(freq, sampleRate) {
    this.lowpassFreq = freq;
    if (freq > 0 && freq < sampleRate * 0.49) {
      this.lowpassCoeff = Math.exp(-2 * Math.PI * freq / sampleRate);
    } else {
      this.lowpassCoeff = 0;
    }
  }

  process(input) {
    const readIndex = (this.writeIndex - this.delaySamples + this.maxSamples) % this.maxSamples;
    let output = this.buffer[readIndex];

    if (this.lowpassCoeff > 0) {
      this.lowpassState = this.lowpassState * this.lowpassCoeff + output * (1 - this.lowpassCoeff);
      output = this.lowpassState;
    }

    this.buffer[this.writeIndex] = input + output * this.feedback;
    this.writeIndex = (this.writeIndex + 1) % this.maxSamples;

    return output;
  }

  clear() {
    this.buffer.fill(0);
    this.lowpassState = 0;
  }
}

class AllpassFilter {
  constructor() {
    this.state = 0;
    this.coeff = 0;
  }

  setFreq(freq, sampleRate) {
    this.coeff = Math.tan(Math.PI * freq / sampleRate);
  }

  process(input) {
    const output = -input + this.state * this.coeff;
    this.state = input + output * this.coeff;
    return output;
  }
}

class LFO {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.phase = 0;
    this.freq = 1;
    this.depth = 1;
  }

  setFreq(hz) {
    this.freq = hz;
  }

  setDepth(d) {
    this.depth = d;
  }

  process() {
    this.phase += this.freq / this.sampleRate;
    if (this.phase >= 1) this.phase -= 1;
    return Math.sin(this.phase * 2 * Math.PI) * this.depth;
  }
}

class BiquadFilter {
  constructor(type = "lowpass") {
    this.type = type;
    this.freq = 1000;
    this.Q = 1;
    this.gain = 0;
    this.x1 = 0; this.x2 = 0;
    this.y1 = 0; this.y2 = 0;
    this.b0 = 1; this.b1 = 0; this.b2 = 0;
    this.a1 = 0; this.a2 = 0;
  }

  setParams(freq, Q, gain, sampleRate) {
    this.freq = freq;
    this.Q = Q;
    this.gain = gain;
    const w0 = 2 * Math.PI * freq / sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * Q);
    const A = Math.pow(10, gain / 40);

    switch (this.type) {
      case "lowpass":
        this.b0 = (1 - cosw0) / 2;
        this.b1 = 1 - cosw0;
        this.b2 = (1 - cosw0) / 2;
        this.a1 = -2 * cosw0;
        this.a2 = 1 - alpha;
        break;
      case "highpass":
        this.b0 = (1 + cosw0) / 2;
        this.b1 = -(1 + cosw0);
        this.b2 = (1 + cosw0) / 2;
        this.a1 = -2 * cosw0;
        this.a2 = 1 - alpha;
        break;
      case "allpass":
        this.b0 = 1 - alpha;
        this.b1 = -2 * cosw0;
        this.b2 = 1 + alpha;
        this.a1 = -2 * cosw0;
        this.a2 = 1 - alpha;
        break;
      case "peaking":
        this.b0 = 1 + alpha * A;
        this.b1 = -2 * cosw0;
        this.b2 = 1 - alpha * A;
        this.a1 = -2 * cosw0;
        this.a2 = 1 - alpha * A;
        break;
    }
    const a0 = 1 + alpha;
    this.b0 /= a0; this.b1 /= a0; this.b2 /= a0;
    this.a1 /= a0; this.a2 /= a0;
  }

  process(input) {
    const output = this.b0 * input + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = input;
    this.y2 = this.y1; this.y1 = output;
    return output;
  }
}

class FXChain {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.effects = [];
    this.dryGain = 1;
    this.wetGain = 0;
  }

  addEffect(type, params = {}) {
    const effect = { type, params, state: {} };
    this.effects.push(effect);
    this._initEffect(effect);
    return effect;
  }

  _initEffect(effect) {
    const { type, params, state } = effect;
    const sr = this.sampleRate;

    switch (type) {
      case "reverb":
        state.delays = [];
        state.allpasses = [];
        for (let i = 0; i < 6; i++) {
          const d = new DelayLine();
          d.setDelayTime(params.delayTimes?.[i] || (0.02 + i * 0.03), sr);
          d.setFeedback(params.feedback || 0.3);
          d.setLowpass(params.lowpass || 3000, sr);
          state.delays.push(d);
        }
        for (let i = 0; i < 3; i++) {
          const ap = new AllpassFilter();
          ap.setFreq(params.allpassFreq?.[i] || (1000 + i * 500), sr);
          state.allpasses.push(ap);
        }
        state.mixer = { gain: 0.5 };
        break;

      case "delay":
        state.delayL = new DelayLine();
        state.delayR = new DelayLine();
        state.delayL.setDelayTime(params.time || 0.3, sr);
        state.delayR.setDelayTime((params.time || 0.3) * 1.333, sr);
        state.delayL.setFeedback(params.feedback || 0.3);
        state.delayR.setFeedback(params.feedback || 0.3);
        state.delayL.setLowpass(params.lowpass || 3000, sr);
        state.delayR.setLowpass(params.lowpass || 3000, sr);
        state.hpf = new BiquadFilter("highpass");
        state.hpf.setParams(100, 0.7, 0, sr);
        state.lpf = new BiquadFilter("lowpass");
        state.lpf.setParams(params.lowpass || 3000, 0.7, 0, sr);
        break;

      case "chorus":
        state.delayL = new DelayLine(4800);
        state.delayR = new DelayLine(4800);
        state.delayL.setDelayTime(params.delayL || 0.02, sr);
        state.delayR.setDelayTime(params.delayR || 0.025, sr);
        state.lfo = new LFO(sr);
        state.lfo.setFreq(params.rate || 0.7);
        state.lfo.setDepth(params.depth || 0.0005);
        state.hpf = new BiquadFilter("highpass");
        state.hpf.setParams(120, 0.7, 0, sr);
        state.lpf = new BiquadFilter("lowpass");
        state.lpf.setParams(8000, 0.7, 0, sr);
        break;

      case "phaser":
        state.ap1 = new AllpassFilter();
        state.ap2 = new AllpassFilter();
        state.ap1.setFreq(params.freq1 || 900, sr);
        state.ap2.setFreq(params.freq2 || 1800, sr);
        state.lfo = new LFO(sr);
        state.lfo.setFreq(params.rate || 0.8);
        state.lfo.setDepth(params.depth || 300);
        break;

      case "flanger":
        state.delay = new DelayLine(2400);
        state.delay.setDelayTime(params.delay || 0.003, sr);
        state.lfo = new LFO(sr);
        state.lfo.setFreq(params.rate || 0.45);
        state.lfo.setDepth(params.depth || 0.0018);
        state.hpf = new BiquadFilter("highpass");
        state.hpf.setParams(140, 0.7, 0, sr);
        state.lpf = new BiquadFilter("lowpass");
        state.lpf.setParams(4500, 0.7, 0, sr);
        state.feedback = new BiquadFilter("highpass");
        state.feedback.setParams(80, 0.7, 0, sr);
        state.fbGain = params.feedback || 0.22;
        break;

      case "rotary":
        state.filter = new BiquadFilter("peaking");
        state.filter.setParams(850, 1.0, 1.4, sr);
        state.lfo = new LFO(sr);
        state.lfo.setFreq(params.rate || 4.0);
        state.lfo.setDepth(params.depth || 0.15);
        break;

      case "tremolo":
        state.lfo = new LFO(sr);
        state.lfo.setFreq(params.rate || 4.0);
        state.lfo.setDepth(params.depth || 0.35);
        break;

      case "autopan":
        state.lfo = new LFO(sr);
        state.lfo.setFreq(params.rate || 1.2);
        state.lfo.setDepth(params.depth || 0.25);
        break;

      case "waveshaper":
        state.curve = params.curve || null;
        state.hpf = new BiquadFilter("highpass");
        state.hpf.setParams(params.hpf || 80, 0.7, 0, sr);
        state.lpf = new BiquadFilter("lowpass");
        state.lpf.setParams(params.lpf || 6000, 0.7, 0, sr);
        break;

      case "compressor":
        state.threshold = params.threshold || -16;
        state.ratio = params.ratio || 2.8;
        state.attack = params.attack || 0.012;
        state.release = params.release || 0.14;
        state.env = 0;
        break;
    }
  }

  process(inputL, inputR) {
    let l = inputL;
    let r = inputR;

    for (const effect of this.effects) {
      const { type, params, state } = effect;
      const sr = this.sampleRate;

      switch (type) {
        case "reverb":
          let revL = 0, revR = 0;
          for (const d of state.delays) {
            revL += d.process(l);
            revR += d.process(r);
          }
          for (const ap of state.allpasses) {
            revL = ap.process(revL);
            revR = ap.process(revR);
          }
          l = l * (1 - this.wetGain) + revL * state.mixer.gain * this.wetGain;
          r = r * (1 - this.wetGain) + revR * state.mixer.gain * this.wetGain;
          break;

        case "delay":
          l = state.hpf.process(l);
          r = state.hpf.process(r);
          l = state.lpf.process(l);
          r = state.lpf.process(r);
          const dl = state.delayL.process(l);
          const dr = state.delayR.process(r);
          l = l * (1 - this.wetGain) + dl * this.wetGain;
          r = r * (1 - this.wetGain) + dr * this.wetGain;
          break;

        case "chorus":
          l = state.hpf.process(l);
          r = state.hpf.process(r);
          l = state.lpf.process(l);
          r = state.lpf.process(r);
          const mod = state.lfo.process();
          state.delayL.setDelayTime((params.delayL || 0.02) + mod, sr);
          state.delayR.setDelayTime((params.delayR || 0.025) - mod, sr);
          const cl = state.delayL.process(l);
          const cr = state.delayR.process(r);
          l = l + cl * this.wetGain;
          r = r + cr * this.wetGain;
          break;

        case "phaser":
          const lfoVal = state.lfo.process();
          state.ap1.setFreq(params.freq1 || 900 + lfoVal, sr);
          state.ap2.setFreq(params.freq2 || 1800 + lfoVal * 1.5, sr);
          l = state.ap1.process(l);
          l = state.ap2.process(l);
          r = state.ap1.process(r);
          r = state.ap2.process(r);
          l = l * (1 - this.wetGain) + l * this.wetGain;
          r = r * (1 - this.wetGain) + r * this.wetGain;
          break;

        case "flanger":
          l = state.hpf.process(l);
          r = state.hpf.process(r);
          l = state.lpf.process(l);
          r = state.lpf.process(r);
          const fmod = state.lfo.process();
          state.delay.setDelayTime((params.delay || 0.003) + fmod, sr);
          const fl = state.delay.process(l);
          const fr = state.delay.process(r);
          state.delay.process(fl * state.fbGain);
          state.delay.process(fr * state.fbGain);
          l = l + fl * this.wetGain;
          r = r + fr * this.wetGain;
          break;

        case "rotary":
          const rmod = state.lfo.process() * 0.5 + 0.5;
          l = l * (1 - rmod) + r * rmod;
          r = r * (1 - rmod) + l * rmod;
          l = state.filter.process(l);
          r = state.filter.process(r);
          break;

        case "tremolo":
          const tgain = 1 - state.lfo.process() * state.lfo.depth;
          l *= tgain;
          r *= tgain;
          break;

        case "autopan":
          const pan = state.lfo.process() * state.lfo.depth;
          const panL = Math.max(0, 1 - pan);
          const panR = Math.max(0, 1 + pan);
          l *= panL;
          r *= panR;
          break;

        case "waveshaper":
          l = state.hpf.process(l);
          r = state.hpf.process(r);
          if (state.curve) {
            const idxL = Math.floor((l + 1) * (state.curve.length - 1) / 2);
            const idxR = Math.floor((r + 1) * (state.curve.length - 1) / 2);
            l = state.curve[Math.max(0, Math.min(state.curve.length - 1, idxL))];
            r = state.curve[Math.max(0, Math.min(state.curve.length - 1, idxR))];
          }
          l = state.lpf.process(l);
          r = state.lpf.process(r);
          break;

        case "compressor":
          const level = Math.abs(l) > Math.abs(r) ? Math.abs(l) : Math.abs(r);
          const db = level > 0 ? 20 * Math.log10(level) : -100;
          if (db > state.threshold) {
            const reduction = (db - state.threshold) * (1 - 1/state.ratio);
            const gain = Math.pow(10, -reduction / 20);
            state.env = state.env * 0.99 + gain * 0.01;
            l *= state.env;
            r *= state.env;
          } else {
            state.env = state.env * 0.999 + 1 * 0.001;
          }
          break;
      }
    }

    return [l * this.dryGain, r * this.dryGain];
  }
}

class FXWorkletProcessor extends AudioWorkletProcessor {
  constructor(_options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.fxChain = new FXChain(this.sampleRate);
    this.bypass = true;
    this.presetName = "clean";

    this.port.onmessage = e => {
      try { this.handleMessage(e.data); } catch (err) { console.error("[FXWorklet]", err); }
    };
  }

  handleMessage(data) {
    if (!data) return;
    switch (data.type) {
      case "setBypass":
        this.bypass = !!data.bypassed;
        break;
      case "setPreset":
        this.loadPreset(data.preset);
        break;
      case "setParam":
        this.setParam(data.effectIndex, data.param, data.value);
        break;
      case "setDryWet":
        this.fxChain.dryGain = data.dry ?? 1;
        this.fxChain.wetGain = data.wet ?? 0;
        break;
    }
  }

  loadPreset(presetName) {
    this.presetName = presetName;
    this.fxChain.effects = [];

    if (presetName === "clean") {
      this.bypass = true;
      this.fxChain.dryGain = 1;
      this.fxChain.wetGain = 0;
      return;
    }

    this.bypass = false;
    this.fxChain.dryGain = 1;
    this.fxChain.wetGain = 0.3;

    const presets = {
      reverb_hall: () => {
        this.fxChain.addEffect("reverb", {
          delayTimes: [0.023, 0.045, 0.078, 0.112, 0.156, 0.201],
          feedback: 0.35,
          lowpass: 5000,
          allpassFreq: [1200, 2200, 3400],
        });
      },
      delay_tape: () => {
        this.fxChain.addEffect("delay", {
          time: 0.28,
          feedback: 0.3,
          lowpass: 3200,
        });
      },
      chorus_lush: () => {
        this.fxChain.addEffect("chorus", {
          delayL: 0.022,
          delayR: 0.026,
          rate: 0.65,
          depth: 0.0028,
        });
      },
      phaser_6stage: () => {
        this.fxChain.addEffect("phaser", {
          freq1: 900,
          freq2: 1800,
          rate: 0.8,
          depth: 300,
        });
      },
    };

    const loader = presets[presetName];
    if (loader) loader();
  }

  setParam(effectIndex, param, value) {
    const effect = this.fxChain.effects[effectIndex];
    if (!effect) return;
    effect.params[param] = value;
    this.fxChain._initEffect(effect);
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !output || input.length < 2) return true;

    const inL = input[0];
    const inR = input[1];
    const outL = output[0];
    const outR = output[1];
    const len = inL.length;

    if (this.bypass) {
      outL.set(inL);
      outR.set(inR);
      return true;
    }

    for (let i = 0; i < len; i++) {
      const [l, r] = this.fxChain.process(inL[i], inR[i]);
      outL[i] = l;
      outR[i] = r;
    }

    return true;
  }
}

registerProcessor("wilsonix-fx-processor", FXWorkletProcessor);