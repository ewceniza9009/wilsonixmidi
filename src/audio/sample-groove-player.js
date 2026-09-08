/**
 * MidiKey Elite - Synchronized Backing Groove & Sample Music Player
 * Generates tempo-synchronized multi-track backing rhythm loops across 5 genres
 * (90s House, Neo-Soul Chillhop, Worship Ballad, Funk Groove, Trap 808)
 * for live jamming, keyboard accompaniment, and solo performance.
 */

import { audioCore } from "./audio-core.js";

export const GROOVE_TRACKS = [
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
    this.bpm = 124;
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
  }

  init() {
    if (this.gainNode) return;
    const ctx = audioCore.ctx;
    if (!ctx) return;
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.volume;
    this.gainNode.connect(audioCore.masterGain || ctx.destination);
    this.bpm = GROOVE_TRACKS[this.activeTrackIndex].bpm;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1.0, vol));
    if (this.gainNode && audioCore.ctx) {
      this.gainNode.gain.setTargetAtTime(this.volume, audioCore.ctx.currentTime, 0.03);
    }
  }

  setBpm(bpm) {
    this.bpm = Math.max(50, Math.min(220, bpm));
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
    this.nextStepTime = audioCore.ctx.currentTime + 0.05;
    this.scheduleLoop();

    if (this.onStateChange) this.onStateChange();
  }

  stop() {
    this.isPlaying = false;
    clearTimeout(this.timerId);
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

    while (this.nextStepTime < ctx.currentTime + this.scheduleAheadSec) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }

    this.timerId = setTimeout(() => this.scheduleLoop(), this.lookaheadMs);
  }

  advanceStep() {
    const secondsPerBeat = 60.0 / this.bpm;
    const stepDuration = 0.25 * secondsPerBeat; // 16th note
    this.nextStepTime += stepDuration;
    this.currentStep = (this.currentStep + 1) % 64;
  }

  scheduleStep(step, time) {
    const track = GROOVE_TRACKS[this.activeTrackIndex];
    const trackId = track.id;

    // Trigger rhythm elements according to track genre pattern
    if (trackId === "house_90s") {
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
}

export const sampleGroovePlayer = new SampleGroovePlayer();
