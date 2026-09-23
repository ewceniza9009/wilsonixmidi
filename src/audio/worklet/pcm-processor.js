/**
 * WILSONIX MIDIKEY Elite - PCM Sample Playback AudioWorkletProcessor
 * Runs on the dedicated high-priority Web Audio render thread.
 * Eliminates main-thread jank by handling all voice allocation, gain envelopes,
 * sample-accurate playback, and voice stealing on the audio thread.
 *
 * Architecture mirrors synth-processor.js but reads decoded Float32Array sample
 * data instead of generating oscillator waveforms.
 */

const MAX_VOICES = 128;
const PI = Math.PI;

class PcmWorkletVoice {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate;
    this.active = false;
    this.midiNote = 0;
    this.velocity = 0;
    this.gain = 0;
    this.instId = 0;
    this.layerIndex = -1;

    // Sample playback state
    this.sampleBuffer = null; // Float32Array (mono or interleaved L/R)
    this.sampleBufferL = null; // Float32Array (left channel)
    this.sampleBufferR = null; // Float32Array (right channel)
    this.isStereo = false;
    this.playbackPosition = 0; // fractional sample position
    this.playbackRate = 1.0; // pitch ratio (e.g. 1 semitone up = 2^(1/12))
    this.startTime = 0;
    this.maxLife = 8.0; // seconds

    // Looping
    this.isLoopable = false;
    this.loopStart = 0;
    this.loopEnd = 0;

    // Envelope: 0=idle, 1=attack, 2=decay, 3=sustain, 4=release
    this.envStage = 0;
    this.envLevel = 0.0;
    this.attackTime = 0.003;
    this.decayTime = 0.25;
    this.sustainLevel = 0.65;
    this.releaseTime = 0.15;

    // Pedal
    this.pedalHeld = false;
    this.sustainStartTime = 0;
    this.sustainDecayRate = 0;

    // Low-pass filter (1-pole, cheap)
    this.filterCutoff = 0.5; // normalized 0-1
    this.filterPrevL = 0;
    this.filterPrevR = 0;

    // Trim (heldNotes map key for steal logic)
    this.held = false;

    this.forceStop();
  }

  noteOn(instId, midiNote, velocity, gain, layerIndex, sampleBufferL, sampleBufferR,
    playbackRate, isLoopable, loopStart, loopEnd, attackTime, decayTime, sustainLevel,
    releaseTime, filterCutoff, maxLife) {
    this.active = true;
    this.instId = instId;
    this.midiNote = midiNote;
    this.velocity = velocity;
    this.gain = gain;
    this.layerIndex = layerIndex;
    this.sampleBufferL = sampleBufferL;
    this.sampleBufferR = sampleBufferR;
    this.isStereo = !!(sampleBufferR);
    this.playbackPosition = 0;
    this.playbackRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1.0;
    this.startTime = 0;
    this.maxLife = maxLife || 8.0;
    this.isLoopable = !!isLoopable;
    this.loopStart = (loopStart || 0) * this.sampleRate;
    this.loopEnd = (loopEnd || 0) * this.sampleRate;
    this.envStage = 1;
    this.envLevel = 0.0;
    this.attackTime = attackTime || 0.003;
    this.decayTime = decayTime || 0.25;
    this.sustainLevel = sustainLevel || 0.65;
    this.releaseTime = releaseTime || 0.15;
    this.filterCutoff = filterCutoff || 0.5;
    // Smooth filter transition if stealing an active voice
    this.filterPrevL = Number.isFinite(this.filterPrevL) ? this.filterPrevL * 0.15 : 0;
    this.filterPrevR = Number.isFinite(this.filterPrevR) ? this.filterPrevR * 0.15 : 0;
    this.pedalHeld = false;
    this.held = true;
  }

  noteOff(pedal, currentTime = 0) {
    if (!this.active || this.envStage === 0) return;
    if (pedal) {
      this.pedalHeld = true;
      this.held = false;
      this.sustainStartTime = currentTime;
    } else {
      this.envStage = 4;
      this.held = false;
    }
  }

  fastRelease(fadeSec = 0.015) {
    if (!this.active || this.envStage === 0) return;
    this.held = false;
    this.pedalHeld = false;
    this.envStage = 4;
    this.releaseTime = Math.min(this.releaseTime, fadeSec);
  }

  forceStop() {
    this.active = false;
    this.envStage = 0;
    this.envLevel = 0;
    this.held = false;
    this.pedalHeld = false;
    this.sustainStartTime = 0;
    this.sampleBufferL = null;
    this.sampleBufferR = null;
    this.filterPrevL = 0;
    this.filterPrevR = 0;
  }

  readSample(position) {
    if (!this.sampleBufferL || !Number.isFinite(position)) return 0;
    const len = this.sampleBufferL.length;
    const idx = position | 0;
    const frac = position - idx;
    if (idx >= len - 1) {
      return this.sampleBufferL[len - 1] || 0;
    }
    if (idx < 0) return this.sampleBufferL[0] || 0;
    const s = this.sampleBufferL[idx] * (1 - frac) + this.sampleBufferL[idx + 1] * frac;
    return Number.isFinite(s) ? Math.max(-1.0, Math.min(1.0, s)) : 0;
  }

  readSampleR(position) {
    if (!this.isStereo || !this.sampleBufferR) return this.readSample(position);
    if (!Number.isFinite(position)) return 0;
    const len = this.sampleBufferR.length;
    const idx = position | 0;
    const frac = position - idx;
    if (idx >= len - 1) return this.sampleBufferR[len - 1] || 0;
    if (idx < 0) return this.sampleBufferR[0] || 0;
    const s = this.sampleBufferR[idx] * (1 - frac) + this.sampleBufferR[idx + 1] * frac;
    return Number.isFinite(s) ? Math.max(-1.0, Math.min(1.0, s)) : 0;
  }
}

class WilsonixPcmProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.invSampleRate = 1.0 / this.sampleRate;

    this.voices = [];
    for (let i = 0; i < MAX_VOICES; i++) {
      this.voices.push(new PcmWorkletVoice(this.sampleRate));
    }

    // Shared RingBuffer reader setup (same pattern as synth-processor.js)
    const sharedBuffer = options?.processorOptions?.sharedBuffer;
    this.hasSAB = !!(sharedBuffer && typeof SharedArrayBuffer !== "undefined" && sharedBuffer instanceof SharedArrayBuffer);
    if (this.hasSAB) {
      this.header = new Int32Array(sharedBuffer, 0, 2);
      this.payload = new Float32Array(sharedBuffer, 8, 256 * 4);
    }

    this.currentTime = 0;

    // Sample buffer catalog: instId -> Map<anchorMidi, {L: Float32Array, R: Float32Array|null}>
    this.bufferCatalog = new Map();

    // Held notes tracking for voice stealing
    this.heldNotes = new Set();

    // Sustain pedal & voice duration state (configured via Latency/Performance modal)
    this.pedalDown = false;
    this.sustainHoldSec = 7.0;
    this.sustainDecayTau = 2.4;
    this.heldNoteSec = 15.0;

    // Poly scale (single-instrument; exact original law)
    this.polyScale = 1.0;
    // Combi-layer trim: a 4-layer stack multiplies the voice count, so the
    // 1/sqrt(N) law ducks a combi far below single-instrument level. Floor it
    // for combi layer voices only; single instruments keep the original law.
    this.polyScaleCombi = 1.0;

    // Active polyphony ceiling (syncs with performance settings / device tier)
    this.polyphonyCap = 64;

    this.reusableEvent = { status: 0, note: 0, velocity: 0, time: 0 };

    this.port.onmessage = e => {
      // Armored dispatch: one bad message must never take down the audio-thread
      // message handling (that would silently mute everything after it).
      try {
        this.handleMessage(e.data);
      } catch (err) {
        try { console.error("[PCM-processor] message error:", err); } catch (_) {}
      }
    };
  }

  handleMessage(data) {
    if (!data) return;
    switch (data.type) {
      case "midi":
        this.processMidiEvent(data.status, data.note, data.velocity);
        break;
      case "noteOn":
        this.handleNoteOn(data);
        break;
      case "noteOff":
        this.handleNoteOff(data);
        break;
      case "fastNoteOff":
        this.handleFastNoteOff(data);
        break;
      case "polyphonyCap":
        if (Number.isFinite(data.cap)) {
          this.polyphonyCap = Math.max(16, Math.min(MAX_VOICES, data.cap | 0));
        }
        break;
      case "loadBuffer":
        this.handleLoadBuffer(data);
        break;
      case "sustainSettings":
        if (Number.isFinite(data.sustainHoldSec)) {
          this.sustainHoldSec = Math.max(2.0, Math.min(60.0, data.sustainHoldSec));
        }
        if (Number.isFinite(data.sustainDecayTau)) {
          this.sustainDecayTau = Math.max(0.5, Math.min(15.0, data.sustainDecayTau));
        }
        if (Number.isFinite(data.heldNoteSec)) {
          this.heldNoteSec = Math.max(2.0, Math.min(60.0, data.heldNoteSec));
        }
        break;
      case "sustain":
        this.pedalDown = !!data.down;
        if (!data.down) {
          // Stagger pedal release: spread release across ~4ms to prevent mass
          // transient that causes limiter breathing (buzzing/hissing)
          let delay = 0;
          for (let i = 0; i < MAX_VOICES; i++) {
            const v = this.voices[i];
            if (v.active && v.pedalHeld) {
              v.pedalHeld = false;
              v.held = false;
              // Quick ramp down before entering release to avoid DC jump
              v.envLevel *= Math.max(0.01, 1.0 - delay * 0.003);
              v.envStage = 4;
              delay++;
            }
          }
        }
        break;
      case "allNotesOff":
        for (let i = 0; i < MAX_VOICES; i++) {
          this.voices[i].forceStop();
        }
        this.heldNotes.clear();
        break;
      case "dropInstrument":
        if (this.bufferCatalog && data.instId) {
          this.bufferCatalog.delete(data.instId);
        }
        break;
      case "pitchBend":
        // Handled per-note via noteOn messages from main thread
        break;
    }
  }

  handleLoadBuffer(data) {
    const { instId, anchorMidi, bufferL, bufferR } = data;
    if (!this.bufferCatalog.has(instId)) {
      this.bufferCatalog.set(instId, new Map());
    }
    this.bufferCatalog.get(instId).set(anchorMidi, { L: bufferL, R: bufferR || null });
  }

  handleNoteOn(data) {
    const {
      instId, midiNote, velocity, gain, layerIndex,
      anchorMidi, playbackRate, isLoopable, loopStart, loopEnd,
      attackTime, decayTime, sustainLevel, releaseTime,
      filterCutoff, maxLife,
    } = data;

    // Look up sample buffer
    const instMap = this.bufferCatalog.get(instId);
    if (!instMap) return;
    const bufEntry = instMap.get(anchorMidi);
    if (!bufEntry || !bufEntry.L) return;

    this.heldNotes.add(midiNote);

    const maxV = this.polyphonyCap || MAX_VOICES;

    // Re-trigger: if same note+layer already active, release old voice cleanly
    for (let i = 0; i < maxV; i++) {
      const v = this.voices[i];
      if (v.active && v.midiNote === midiNote && v.layerIndex === layerIndex && v.instId === instId) {
        v.fastRelease();
      }
    }

    // Allocate voice: prefer free, then released & quiet, then quietest non-held, then quietest
    let voice = null;
    for (let i = 0; i < maxV; i++) {
      if (!this.voices[i].active) { voice = this.voices[i]; break; }
    }
    if (!voice) {
      for (let i = 0; i < maxV; i++) {
        const v = this.voices[i];
        if (v.envStage === 4 && v.envLevel < 0.05) { voice = v; break; }
      }
    }
    if (!voice) {
      let bestTarget = null;
      let bestScore = Infinity;
      let oldest = null;
      let oldestTime = Infinity;
      for (let i = 0; i < maxV; i++) {
        const v = this.voices[i];
        const t = v.startTime || 0;
        if (t < oldestTime) { oldest = v; oldestTime = t; }
        if (!this.heldNotes.has(v.midiNote)) {
          const score = v.envLevel * 1000 + t;
          if (score < bestScore) { bestTarget = v; bestScore = score; }
        }
      }
      if (!bestTarget) {
        for (let i = 0; i < maxV; i++) {
          const v = this.voices[i];
          const t = v.startTime || 0;
          const score = v.envLevel * 1000 + t;
          if (score < bestScore) { bestTarget = v; bestScore = score; }
        }
      }
      voice = bestTarget || oldest;
    }

    voice.noteOn(instId, midiNote, velocity, gain, layerIndex,
      bufEntry.L, bufEntry.R, playbackRate,
      isLoopable, loopStart, loopEnd,
      attackTime, decayTime, sustainLevel, releaseTime,
      filterCutoff, maxLife);
    voice.startTime = this.currentTime;
  }

  handleNoteOff(data) {
    const { midiNote, layerIndex } = data;
    this.heldNotes.delete(midiNote);
    const maxV = this.polyphonyCap || MAX_VOICES;
    for (let i = 0; i < maxV; i++) {
      const v = this.voices[i];
      if (v.active && v.midiNote === midiNote) {
        if (layerIndex === undefined || layerIndex === null || v.layerIndex === layerIndex) {
          v.noteOff(this.pedalDown, this.currentTime);
        }
      }
    }
  }

  handleFastNoteOff(data) {
    const { midiNote, layerIndex } = data;
    this.heldNotes.delete(midiNote);
    const maxV = this.polyphonyCap || MAX_VOICES;
    for (let i = 0; i < maxV; i++) {
      const v = this.voices[i];
      if (v.active && v.midiNote === midiNote) {
        if (layerIndex === undefined || layerIndex === null || v.layerIndex === layerIndex) {
          v.fastRelease();
        }
      }
    }
  }

  processMidiEvent(status, note, velocity) {
    const cmd = status & 0xf0;
    if (cmd === 0x90 && velocity > 0) {
      // MIDI note on — but PCM notes come via handleNoteOn with full params
      // This path is only for fallback/SFX
    } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
      this.handleNoteOff({ midiNote: note });
    } else if (cmd === 0xb0 && note === 123) {
      for (let i = 0; i < MAX_VOICES; i++) this.voices[i].forceStop();
      this.heldNotes.clear();
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

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;

    const outL = output[0];
    const outR = output[1];
    const numFrames = outL.length;

    this.readRingBuffer();

    outL.fill(0);
    outR.fill(0);

    const maxV = this.polyphonyCap || MAX_VOICES;

    // Polyphony-aware output trim
    let activeCount = 0;
    for (let v = 0; v < maxV; v++) {
      const vv = this.voices[v];
      // Only voices that are actually audible count toward the polyphony trim.
      // Near-silent sustained tails (envLevel ~0.02) must not drag the 1/sqrt(N)
      // gain down and mute freshly played notes ("sound disappears after a
      // while of pounding/pads/sustain").
      if (vv.active && vv.envLevel > 0.05) activeCount++;
    }

    // Overload safety: if active voices exceed 80% of polyphonyCap (e.g. dense sustain sweeps),
    // accelerate decaying release-stage voices to protect audio thread buffer deadlines
    if (activeCount > maxV * 0.8) {
      for (let v = 0; v < maxV; v++) {
        const vv = this.voices[v];
        if (vv.active && vv.envStage === 4) {
          vv.envLevel *= 0.75;
          if (vv.envLevel < 0.001) vv.forceStop();
        }
      }
    }

    // Floored polyphony trim so rapid glissando sweeps and dense arpeggios
    // don't aggressively duck volume down to 10-15% (whisper/toy sound).
    const targetScale = Math.max(0.45, 1.0 / Math.sqrt(Math.max(1, activeCount)));
    this.polyScale += (targetScale - this.polyScale) * 0.12;
    const masterScale = this.polyScale;

    // Combi layer voices get a floored trim so a stacked Combi stays at a
    // healthy level instead of ducking toward silence/whisper under chords.
    const combiTarget = Math.max(0.6, targetScale);
    this.polyScaleCombi += (combiTarget - this.polyScaleCombi) * 0.12;

    for (let v = 0; v < maxV; v++) {
      const voice = this.voices[v];
      if (!voice.active) continue;

      const bufLen = voice.sampleBufferL ? voice.sampleBufferL.length : 0;
      if (bufLen === 0) { voice.forceStop(); continue; }

      // Maximum voice lifetime guard: release voice after maxLife (60s loop, or duration)
      if (voice.startTime > 0 && (this.currentTime - voice.startTime > voice.maxLife)) {
        voice.forceStop();
        continue;
      }

      const attackRate = 1.0 / Math.max(0.001, voice.attackTime * this.sampleRate);
      const decayRate = 1.0 / Math.max(0.001, voice.decayTime * this.sampleRate);
      const releaseDecay = Math.exp(-4.605 / Math.max(0.001, voice.releaseTime * this.sampleRate));
      const cutoffHz = Math.max(200, Math.min(20000, voice.filterCutoff * 20000));
      const filterAlpha = Math.exp(-2.0 * PI * cutoffHz * this.invSampleRate);

      for (let i = 0; i < numFrames; i++) {
        switch (voice.envStage) {
          case 1: // Attack
            voice.envLevel += attackRate;
            if (voice.envLevel >= 1.0) {
              voice.envLevel = 1.0;
              voice.envStage = 2;
            }
            break;
          case 2: // Decay
            voice.envLevel -= (1.0 - voice.sustainLevel) * decayRate;
            if (voice.envLevel <= voice.sustainLevel) {
              voice.envLevel = voice.sustainLevel;
              voice.envStage = 3;
            }
            break;
          case 3: // Sustain
            if (voice.pedalHeld) {
              // 1. Auto-release timeout governed by sustainHoldSec from latency popover modal
              if (voice.sustainStartTime > 0 && (this.currentTime - voice.sustainStartTime >= this.sustainHoldSec)) {
                voice.pedalHeld = false;
                voice.envStage = 4; // Smooth release
                break;
              }
              // 2. Gentle natural tone decay governed by sustainDecayTau from latency popover modal
              const decayPerSample = 1.0 / Math.max(0.001, this.sustainDecayTau * this.sampleRate * 6.0);
              voice.envLevel = Math.max(0.02, voice.envLevel - decayPerSample);
            } else if (voice.held) {
              // 3. Key held without pedal: auto-release after heldNoteSec from latency popover modal
              if (voice.startTime > 0 && (this.currentTime - voice.startTime >= this.heldNoteSec)) {
                voice.held = false;
                voice.envStage = 4; // Smooth release
                break;
              }
            }
            break;
          case 4: // Release (Natural acoustic exponential decay - no abrupt cliff/cutoff)
            voice.envLevel *= releaseDecay;
            if (voice.envLevel <= 0.0008) {
              voice.forceStop();
              break;
            }
            break;
        }
        if (!voice.active) break;

        const pos = voice.playbackPosition;
        let sampleL = voice.readSample(pos);
        let sampleR = voice.readSampleR(pos);

        let nextPos = pos + voice.playbackRate;
        let sampleEnded = false;
        if (voice.isLoopable && voice.loopEnd > voice.loopStart) {
          while (nextPos >= voice.loopEnd) {
            nextPos -= (voice.loopEnd - voice.loopStart);
          }
        } else if (nextPos >= bufLen) {
          sampleEnded = true;
          if (voice.held || voice.pedalHeld) {
            // Sample finished but note is still held/sustained: gracefully release
            // the envelope instead of repeating the last sample with aggressive gain drop.
            // This prevents rapid 0.5 gain steps that create hissing/click artifacts.
            if (voice.envStage !== 4) {
              voice.envStage = 4;
              voice.held = false;
            }
            nextPos = pos;
          } else {
            voice.forceStop();
            break;
          }
        }
        voice.playbackPosition = nextPos;

        if (sampleEnded) { sampleL = 0; sampleR = 0; }

        const amp = voice.envLevel * voice.gain *
          (typeof voice.layerIndex === "number" ? this.polyScaleCombi : masterScale);
        voice.filterPrevL = voice.filterPrevL * filterAlpha + sampleL * (1.0 - filterAlpha);
        voice.filterPrevR = voice.filterPrevR * filterAlpha + sampleR * (1.0 - filterAlpha);
        // Denormal flush: prevents CPU spikes from subnormal floats in filter state
        if (voice.filterPrevL > -1e-18 && voice.filterPrevL < 1e-18) voice.filterPrevL = 0;
        if (voice.filterPrevR > -1e-18 && voice.filterPrevR < 1e-18) voice.filterPrevR = 0;
        outL[i] += voice.filterPrevL * amp;
        outR[i] += voice.filterPrevR * amp;
      }
    }

    // Brickwall NaN / Infinity protection: prevent corrupted audio registers in downstream nodes
    for (let i = 0; i < numFrames; i++) {
      if (!Number.isFinite(outL[i])) outL[i] = 0;
      else if (outL[i] > 1.5) outL[i] = 1.5;
      else if (outL[i] < -1.5) outL[i] = -1.5;

      if (!Number.isFinite(outR[i])) outR[i] = 0;
      else if (outR[i] > 1.5) outR[i] = 1.5;
      else if (outR[i] < -1.5) outR[i] = -1.5;
    }

    this.currentTime += numFrames * this.invSampleRate;
    return true;
  }
}

if (typeof globalThis.registerProcessor === "function" && !globalThis.__wilsonixPcmRegistered) {
  globalThis.__wilsonixPcmRegistered = true;
  registerProcessor("wilsonix-pcm-processor", WilsonixPcmProcessor);
}
