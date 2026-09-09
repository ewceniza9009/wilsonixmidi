/**
 * MidiKey Elite - Synchronized Backing Groove & Sample Music Player
 * Generates tempo-synchronized multi-track backing rhythm loops across 5 genres
 * (90s House, Neo-Soul Chillhop, Worship Ballad, Funk Groove, Trap 808)
 * for live jamming, keyboard accompaniment, and solo performance.
 */

import { audioCore } from "./audio-core.js";

export const GROOVE_TRACKS = [
  {
    id: "synthesizer_you",
    name: "★ Synthesizer You (80s Surf & Synth-Pop)",
    bpm: 129.2,
    genre: "Surf / Synth-Pop",
    bars: 4,
    color: "#06b6d4",
    description: "Authentic ripped 80s spring reverb surf lead, gated snare cannon, Juno chorus pads & driving bass groove",
    sampleUrl: "/samples/synthesizer_you/synthesizer_you_4bar_groove.wav",
  },
  {
    id: "house_90s",
    name: "★ 90s House Anthem Beat",
    bpm: 124,
    genre: "House / Dance",
    bars: 4,
    color: "#f59e0b",
    description: "Classic M1 4-on-the-floor kick, swung 909 hats, and pump groove",
  },
  {
    id: "lofi_neosoul",
    name: "★ Neo-Soul & Lo-Fi Chillhop",
    bpm: 85,
    genre: "R&B / Neo-Soul",
    bars: 4,
    color: "#ec4899",
    description: "Dusty vinyl swung beat, rimshot, and deep acoustic sub groove",
  },
  {
    id: "worship_ballad",
    name: "★ Cinematic Worship Ballad",
    bpm: 68,
    genre: "Worship / Ballad",
    bars: 4,
    color: "#3b82f6",
    description: "Slow expressive power ballad kick, cross-stick, and ambient space",
  },
  {
    id: "funk_groove",
    name: "★ 70s Funk & Disco Groove",
    bpm: 112,
    genre: "Funk / Fusion",
    bars: 4,
    color: "#10b981",
    description: "Tight syncopated 16th-note drums, shakers, and slap bass accents",
  },
  {
    id: "trap_808",
    name: "★ Modern Trap & 808 Beat",
    bpm: 140,
    genre: "Hip-Hop / Trap",
    bars: 4,
    color: "#8b5cf6",
    description: "Rolling 32nd-note hi-hats, hard 808 sub punch, and snappy clap",
  },
];

export class SampleGroovePlayer {
  constructor() {
    this.isPlaying = false;
    this.activeTrackIndex = 0;
    this.bpm = 129.2;
    this.volume = 0.75;
    this.timerId = null;
    this.currentStep = 0; // 0 to 63 (4 bars of 16th notes = 64 steps)
    this.lookaheadMs = 25.0;
    this.scheduleAheadSec = 0.1;
    this.nextStepTime = 0.0;
    this.onStepChange = null;
    this.onStateChange = null;

    this.gainNode = null;
    this.outNode = null;
    this.activeLoopSource = null;
    this.syGrooveBuffer = null;
    this.syLoading = false;
  }

  init() {
    if (this.gainNode) return;
    const ctx = audioCore.ctx;
    if (!ctx) return;
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.volume;
    this.gainNode.connect(audioCore.masterGain || ctx.destination);
    this.bpm = GROOVE_TRACKS[this.activeTrackIndex].bpm;
    this.loadSynthesizerYouSample();
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1.0, vol));
    if (this.gainNode && audioCore.ctx) {
      this.gainNode.gain.setTargetAtTime(this.volume, audioCore.ctx.currentTime, 0.03);
    }
  }

  setBpm(bpm) {
    this.bpm = Math.max(50, Math.min(220, bpm));
    if (this.activeLoopSource && audioCore.ctx) {
      try {
        this.activeLoopSource.playbackRate.setValueAtTime(this.bpm / 129.19921875, audioCore.ctx.currentTime);
      } catch (e) {}
    }
    if (this.onStateChange) this.onStateChange();
  }

  selectTrack(index) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.stop();
    this.activeTrackIndex = (index + GROOVE_TRACKS.length) % GROOVE_TRACKS.length;
    this.bpm = GROOVE_TRACKS[this.activeTrackIndex].bpm;
    if (this.onStateChange) this.onStateChange();
    if (wasPlaying) this.start();
  }

  start() {
    audioCore.ensureRunning();
    this.init();
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentStep = 0;
    const ctx = audioCore.ctx;
    this.nextStepTime = ctx.currentTime + 0.05;

    const track = GROOVE_TRACKS[this.activeTrackIndex];
    if (track.id === "synthesizer_you") {
      this.startSynthesizerYouLoop(this.nextStepTime);
    }

    this.scheduleLoop();

    if (this.onStateChange) this.onStateChange();
  }

  startSynthesizerYouLoop(startTime) {
    const ctx = audioCore.ctx;
    if (!ctx || !this.syGrooveBuffer) return;

    this.stopActiveLoopSource();

    try {
      const src = ctx.createBufferSource();
      src.buffer = this.syGrooveBuffer;
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = this.syGrooveBuffer.duration;
      src.playbackRate.value = this.bpm / 129.19921875;
      src.connect(this.gainNode);
      src.start(startTime);
      this.activeLoopSource = src;
    } catch (e) {
      console.warn("Start loop source failed:", e);
    }
  }

  stopActiveLoopSource() {
    if (this.activeLoopSource) {
      try {
        this.activeLoopSource.stop();
        this.activeLoopSource.disconnect();
      } catch (e) {}
      this.activeLoopSource = null;
    }
  }

  stop() {
    this.isPlaying = false;
    clearTimeout(this.timerId);
    this.stopActiveLoopSource();
    this.currentStep = 0;
    if (this.onStateChange) this.onStateChange();
    if (this.onStepChange) this.onStepChange(0);
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }

  scheduleLoop() {
    if (!this.isPlaying) return;
    const ctx = audioCore.ctx;
    if (!ctx) return;

    if (this.nextStepTime < ctx.currentTime - 0.2) {
      this.nextStepTime = ctx.currentTime;
    }

    let safety = 0;
    while (this.nextStepTime < ctx.currentTime + this.scheduleAheadSec && safety < 16) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
      safety++;
    }

    this.timerId = setTimeout(() => this.scheduleLoop(), this.lookaheadMs);
  }

  advanceStep() {
    const bpm = Math.max(40, this.bpm || 120);
    const secondsPerBeat = 60.0 / bpm;
    const stepDuration = 0.25 * secondsPerBeat; // 16th note
    this.nextStepTime += stepDuration;
    this.currentStep = (this.currentStep + 1) % 64;
  }

  scheduleStep(step, time) {
    const track = GROOVE_TRACKS[this.activeTrackIndex];
    const trackId = track.id;

    // Trigger rhythm elements according to track genre pattern
    if (trackId === "synthesizer_you") {
      this.playSynthesizerYouPattern(step, time);
    } else if (trackId === "house_90s") {
      this.playHousePattern(step, time);
    } else if (trackId === "lofi_neosoul") {
      this.playLofiPattern(step, time);
    } else if (trackId === "worship_ballad") {
      this.playWorshipPattern(step, time);
    } else if (trackId === "funk_groove") {
      this.playFunkPattern(step, time);
    } else if (trackId === "trap_808") {
      this.playTrapPattern(step, time);
    }

    // Notify UI (scheduled on animation frame / timeout)
    const ctx = audioCore.ctx;
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (this.isPlaying && this.onStepChange) {
        this.onStepChange(step);
      }
    }, delayMs);
  }

  // =========================================================================
  // DRUM SYNTHESIZERS (Accurate Analog Modeling for Jam Tracks)
  // =========================================================================

  synthKick(time, punch = 150, sub = 42, decay = 0.35, gainVal = 0.9) {
    const ctx = audioCore.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(punch, time);
    osc.frequency.exponentialRampToValueAtTime(sub, time + 0.08);

    g.gain.setValueAtTime(gainVal, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + decay);

    osc.connect(g);
    g.connect(this.gainNode);

    osc.start(time);
    osc.stop(time + decay + 0.05);
  }

  synthSnare(time, toneFreq = 190, decay = 0.22, gainVal = 0.7) {
    const ctx = audioCore.ctx;

    // Body
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(toneFreq, time);
    osc.frequency.exponentialRampToValueAtTime(70, time + 0.05);
    og.gain.setValueAtTime(gainVal * 0.7, time);
    og.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(og);
    og.connect(this.gainNode);
    osc.start(time);
    osc.stop(time + 0.15);

    // Noise burst
    const length = ctx.sampleRate * decay;
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1600;

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gainVal, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + decay);

    noise.connect(hp);
    hp.connect(ng);
    ng.connect(this.gainNode);

    noise.start(time);
    noise.stop(time + decay + 0.05);
  }

  synthHat(time, closed = true, gainVal = 0.45) {
    const ctx = audioCore.ctx;
    const dur = closed ? 0.05 : 0.28;
    const length = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 9500;
    bp.Q.value = 3.0;

    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(bp);
    bp.connect(g);
    g.connect(this.gainNode);

    noise.start(time);
    noise.stop(time + dur + 0.02);
  }

  synthBassTone(time, noteMidi, dur = 0.25, gainVal = 0.65) {
    const ctx = audioCore.ctx;
    const freq = 440 * Math.pow(2, (noteMidi - 69) / 12);

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, time);
    filter.frequency.exponentialRampToValueAtTime(320, time + dur);
    filter.Q.value = 3.5;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(gainVal, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.gainNode);

    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  // =========================================================================
  // GENRE PATTERNS (64 16th-note steps per 4-bar loop)
  // =========================================================================

  playHousePattern(step, time) {
    // 4-on-the-floor kick every quarter note (steps 0, 4, 8, 12, ...)
    if (step % 4 === 0) {
      this.synthKick(time, 150, 48, 0.35, 0.95);
    }
    // Clap/snare on 4, 12, 20, 28... (beats 2 and 4)
    if (step % 8 === 4) {
      this.synthSnare(time, 190, 0.22, 0.75);
    }
    // Off-beat open hi-hat (steps 2, 6, 10, 14...)
    if (step % 4 === 2) {
      this.synthHat(time, false, 0.55);
    } else if (step % 2 === 0) {
      this.synthHat(time, true, 0.30);
    }
    // Bassline groove (Classic 90s House in A minor)
    const houseBass = [
      { s: 0, n: 45 }, { s: 3, n: 45 }, { s: 6, n: 48 }, { s: 10, n: 43 },
      { s: 14, n: 45 }, { s: 16, n: 45 }, { s: 19, n: 45 }, { s: 22, n: 50 },
      { s: 26, n: 48 }, { s: 30, n: 47 }, { s: 32, n: 45 }, { s: 35, n: 45 },
      { s: 38, n: 48 }, { s: 42, n: 43 }, { s: 46, n: 45 }, { s: 48, n: 41 },
      { s: 52, n: 43 }, { s: 56, n: 45 }, { s: 60, n: 47 }
    ];
    const b = houseBass.find(e => e.s === step);
    if (b) this.synthBassTone(time, b.n, 0.22, 0.70);
  }

  playLofiPattern(step, time) {
    // Swung Neo-Soul / Chillhop beat
    const kicks = [0, 6, 16, 22, 32, 38, 48, 54, 58];
    if (kicks.includes(step)) this.synthKick(time, 110, 42, 0.40, 0.85);

    // Rimshot on 4, 12, 20...
    if (step % 8 === 4) this.synthSnare(time, 240, 0.15, 0.65);

    // Dusty hi-hat with groove velocity
    if (step % 2 === 0) {
      const vel = (step % 4 === 2) ? 0.45 : 0.30;
      this.synthHat(time, true, vel);
    }

    // Sub bass pulse
    const lofiBass = [
      { s: 0, n: 36 }, { s: 12, n: 41 }, { s: 20, n: 43 }, { s: 32, n: 38 },
      { s: 44, n: 43 }, { s: 52, n: 36 }
    ];
    const b = lofiBass.find(e => e.s === step);
    if (b) this.synthBassTone(time, b.n, 0.45, 0.75);
  }

  playWorshipPattern(step, time) {
    // 68 BPM Ballad: Slow cinematic heartbeat
    if (step === 0 || step === 10 || step === 16 || step === 26 || step === 32 || step === 42 || step === 48 || step === 58) {
      this.synthKick(time, 95, 36, 0.50, 0.85);
    }
    // Cross-stick on 8, 24, 40, 56
    if (step % 16 === 8) {
      this.synthSnare(time, 320, 0.12, 0.60);
    }
    // Gentle 8th-note shaker/hat
    if (step % 2 === 0) {
      this.synthHat(time, true, 0.22);
    }
  }

  playFunkPattern(step, time) {
    // 112 BPM Funk groove
    const kicks = [0, 6, 10, 16, 22, 26, 32, 38, 42, 48, 54, 58];
    if (kicks.includes(step)) this.synthKick(time, 140, 50, 0.30, 0.90);

    if (step % 8 === 4) this.synthSnare(time, 200, 0.25, 0.80);

    // Syncopated 16th hats
    this.synthHat(time, step % 4 !== 2, (step % 4 === 2) ? 0.50 : 0.32);

    // Slap bass accents (E minor funk)
    const funkBass = [
      { s: 0, n: 40 }, { s: 3, n: 40 }, { s: 6, n: 52 }, { s: 10, n: 43 },
      { s: 14, n: 45 }, { s: 16, n: 40 }, { s: 19, n: 40 }, { s: 22, n: 47 },
      { s: 26, n: 45 }, { s: 30, n: 43 }
    ];
    const b = funkBass.find(e => e.s === step % 32);
    if (b) this.synthBassTone(time, b.n, 0.18, 0.75);
  }

  playTrapPattern(step, time) {
    // 140 BPM Trap Beat
    if (step === 0 || step === 14 || step === 18 || step === 32 || step === 46 || step === 50) {
      this.synthKick(time, 130, 32, 0.60, 1.0); // Hard 808 sub kick
    }
    // Sharp trap clap on 8, 24, 40, 56 (beats 3 in half-time)
    if (step % 16 === 8) {
      this.synthSnare(time, 260, 0.18, 0.85);
    }
    // Rolling rapid hi-hats
    const isRoll = (step >= 24 && step <= 28) || (step >= 56 && step <= 60);
    this.synthHat(time, true, isRoll ? 0.40 : (step % 2 === 0 ? 0.35 : 0.20));
  }

  playSynthesizerYouPattern(step, time) {
    // 129.2 BPM 80s Surf & Synth-Pop: Gated Snare Cannon, Punchy Kicks, Analog Bass & Spring Lead
    if (!this.syGrooveBuffer && !this.syLoading) {
      this.loadSynthesizerYouSample();
    }

    // If authentic audio loop is actively running, step sequencer only updates visual UI state (0 duplicate audio)
    if (this.activeLoopSource) {
      return;
    }

    // If buffer just finished decoding and we are at step 0, start the hardware loop immediately
    if (this.syGrooveBuffer && !this.activeLoopSource && step === 0) {
      this.startSynthesizerYouLoop(time);
      return;
    }

    // Fallback analog synthesis pattern ONLY if buffer is still loading from network:
    // 4-on-the-floor kick with 80s punch
    if (step % 4 === 0) {
      this.synthKick(time, 155, 45, 0.28, 0.95);
    }
    // Gated Snare Cannon on steps 4, 12, 20, 28, 36, 44, 52, 60 (beats 2 & 4)
    if (step % 8 === 4) {
      this.synthSnare(time, 210, 0.26, 0.90);
    }
    // Driving 16th-note hi-hats
    this.synthHat(time, step % 2 === 0, step % 4 === 2 ? 0.48 : 0.28);

    // Driving 80s synth bass pulse
    const syBassNotes = [
      { s: 0, n: 36 }, { s: 3, n: 36 }, { s: 6, n: 36 }, { s: 8, n: 36 }, { s: 11, n: 36 }, { s: 14, n: 38 },
      { s: 16, n: 41 }, { s: 19, n: 41 }, { s: 22, n: 41 }, { s: 24, n: 41 }, { s: 27, n: 43 }, { s: 30, n: 43 }
    ];
    const b = syBassNotes.find(e => e.s === step % 32);
    if (b) {
      this.synthBassTone(time, b.n, 0.22, 0.85);
    }
  }

  async loadSynthesizerYouSample() {
    if (this.syGrooveBuffer || this.syLoading) return;
    this.syLoading = true;
    try {
      const ctx = audioCore.ctx;
      if (!ctx) return;
      const resp = await fetch("/samples/synthesizer_you/synthesizer_you_4bar_groove.wav");
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        this.syGrooveBuffer = await ctx.decodeAudioData(arrayBuf);
        // If user already pressed play while loading, start the loop right now
        if (this.isPlaying && GROOVE_TRACKS[this.activeTrackIndex].id === "synthesizer_you" && !this.activeLoopSource) {
          this.startSynthesizerYouLoop(ctx.currentTime + 0.02);
        }
      }
    } catch (e) {
      console.warn("Synthesizer You groove load:", e);
    } finally {
      this.syLoading = false;
    }
  }
}

export const sampleGroovePlayer = new SampleGroovePlayer();

