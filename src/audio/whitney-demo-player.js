import { multiLayerEngine } from "./multi-layer-engine.js";
import { audioCore } from "./audio-core.js";
import { noteScheduler } from "./lookahead-scheduler.js";

// "I Have Nothing" - Whitney Houston (David Foster / Linda Thompson)
// Real arrangement: Key of E major. Intro E - B/D# - C#m7 - A.
// Verse melody in the upper register, chorus lifts to A - E/G# - F#m7 - B.
export const WHITNEY_30S_EVENTS = [
  { time: 0, type: "pedal", down: true },

  // ===== INTRO: E - B/D# - C#m7 - A =====
  // E (E2 B2 E3 G#3 B3)
  { time: 20, note: 40, vel: 76, dur: 3400 },
  { time: 120, note: 47, vel: 70, dur: 3300 },
  { time: 220, note: 52, vel: 68, dur: 3200 },
  { time: 320, note: 56, vel: 66, dur: 3100 },
  { time: 420, note: 59, vel: 68, dur: 3000 },

  // melody pickup
  { time: 1400, note: 71, vel: 84, dur: 380 },
  { time: 1800, note: 68, vel: 82, dur: 380 },
  { time: 2200, note: 64, vel: 80, dur: 380 },
  { time: 2600, note: 63, vel: 78, dur: 500 },

  { time: 3700, type: "pedal", down: false },
  { time: 3740, type: "pedal", down: true },

  // B/D# (D#2 B2 D#3 F#3 B3)
  { time: 3760, note: 39, vel: 78, dur: 3400 },
  { time: 3860, note: 47, vel: 72, dur: 3300 },
  { time: 3960, note: 51, vel: 70, dur: 3200 },
  { time: 4060, note: 54, vel: 68, dur: 3100 },
  { time: 4160, note: 59, vel: 70, dur: 3000 },

  { time: 5140, note: 71, vel: 85, dur: 380 },
  { time: 5540, note: 68, vel: 82, dur: 380 },
  { time: 5940, note: 64, vel: 80, dur: 380 },
  { time: 6340, note: 63, vel: 78, dur: 500 },

  { time: 7440, type: "pedal", down: false },
  { time: 7480, type: "pedal", down: true },

  // C#m7 (C#2 G#2 B2 E3 G#3)
  { time: 7500, note: 37, vel: 78, dur: 3400 },
  { time: 7600, note: 44, vel: 72, dur: 3300 },
  { time: 7700, note: 47, vel: 70, dur: 3200 },
  { time: 7800, note: 52, vel: 68, dur: 3100 },
  { time: 7900, note: 56, vel: 70, dur: 3000 },

  { time: 8880, note: 68, vel: 84, dur: 380 },
  { time: 9280, note: 64, vel: 82, dur: 380 },
  { time: 9680, note: 61, vel: 80, dur: 380 },
  { time: 10080, note: 59, vel: 78, dur: 500 },

  { time: 11180, type: "pedal", down: false },
  { time: 11220, type: "pedal", down: true },

  // A (A2 E3 A3 C#4 E4)
  { time: 11240, note: 45, vel: 80, dur: 3400 },
  { time: 11340, note: 52, vel: 74, dur: 3300 },
  { time: 11440, note: 57, vel: 72, dur: 3200 },
  { time: 11540, note: 61, vel: 70, dur: 3100 },
  { time: 11640, note: 64, vel: 72, dur: 3000 },

  // melody - "share my life..."
  { time: 12640, note: 68, vel: 86, dur: 600 },
  { time: 13340, note: 66, vel: 84, dur: 400 },
  { time: 13840, note: 64, vel: 82, dur: 400 },
  { time: 14340, note: 61, vel: 80, dur: 600 },

  { time: 14850, type: "pedal", down: false },
  { time: 14890, type: "pedal", down: true },

  // ===== VERSE 1: E - B/D# - C#m7 - A =====
  { time: 14910, note: 40, vel: 80, dur: 3400 },
  { time: 15010, note: 47, vel: 74, dur: 3300 },
  { time: 15110, note: 52, vel: 70, dur: 3200 },
  { time: 15210, note: 56, vel: 68, dur: 3100 },
  { time: 15310, note: 59, vel: 70, dur: 3000 },

  // verse melody - "take my love, I'll never ask for more..."
  { time: 15750, note: 71, vel: 86, dur: 500 },
  { time: 16350, note: 68, vel: 84, dur: 400 },
  { time: 16850, note: 64, vel: 82, dur: 400 },
  { time: 17350, note: 63, vel: 84, dur: 600 },

  { time: 18350, type: "pedal", down: false },
  { time: 18390, type: "pedal", down: true },

  // B/D#
  { time: 18410, note: 39, vel: 80, dur: 3400 },
  { time: 18510, note: 47, vel: 74, dur: 3300 },
  { time: 18610, note: 51, vel: 70, dur: 3200 },
  { time: 18710, note: 54, vel: 68, dur: 3100 },
  { time: 18810, note: 59, vel: 70, dur: 3000 },

  { time: 19350, note: 71, vel: 86, dur: 500 },
  { time: 19850, note: 68, vel: 84, dur: 400 },
  { time: 20350, note: 64, vel: 82, dur: 400 },
  { time: 20850, note: 63, vel: 84, dur: 600 },

  { time: 21750, type: "pedal", down: false },
  { time: 21790, type: "pedal", down: true },

  // C#m7
  { time: 21810, note: 37, vel: 78, dur: 3400 },
  { time: 21910, note: 44, vel: 72, dur: 3300 },
  { time: 22010, note: 47, vel: 70, dur: 3200 },
  { time: 22110, note: 52, vel: 68, dur: 3100 },
  { time: 22210, note: 56, vel: 70, dur: 3000 },

  { time: 22750, note: 68, vel: 84, dur: 500 },
  { time: 23250, note: 64, vel: 82, dur: 400 },
  { time: 23750, note: 61, vel: 80, dur: 400 },
  { time: 24250, note: 59, vel: 82, dur: 600 },

  { time: 25150, type: "pedal", down: false },
  { time: 25190, type: "pedal", down: true },

  // A
  { time: 25210, note: 45, vel: 80, dur: 3400 },
  { time: 25310, note: 52, vel: 74, dur: 3300 },
  { time: 25410, note: 57, vel: 72, dur: 3200 },
  { time: 25510, note: 61, vel: 70, dur: 3100 },
  { time: 25610, note: 64, vel: 72, dur: 3000 },

  { time: 26210, note: 68, vel: 86, dur: 600 },
  { time: 26810, note: 66, vel: 84, dur: 500 },
  { time: 27310, note: 64, vel: 82, dur: 500 },
  { time: 27810, note: 61, vel: 80, dur: 800 },

  { time: 28700, type: "pedal", down: false },
  { time: 28740, type: "pedal", down: true },

  // ===== PRE-CHORUS: F#m7 - B - A - B =====
  // F#m7 (F#2 C#3 E3 A3 C#4)
  { time: 28760, note: 42, vel: 82, dur: 2200 },
  { time: 28860, note: 49, vel: 76, dur: 2200 },
  { time: 28960, note: 52, vel: 74, dur: 2100 },
  { time: 29060, note: 57, vel: 72, dur: 2000 },
  { time: 29160, note: 61, vel: 74, dur: 1900 },

  // B (B2 F#3 B3 D#4)
  { time: 31000, note: 47, vel: 84, dur: 1600 },
  { time: 31100, note: 54, vel: 78, dur: 1600 },
  { time: 31200, note: 59, vel: 76, dur: 1500 },
  { time: 31300, note: 63, vel: 74, dur: 1400 },

  // melody rising
  { time: 29600, note: 71, vel: 90, dur: 400 },
  { time: 30100, note: 73, vel: 90, dur: 400 },
  { time: 30600, note: 75, vel: 92, dur: 500 },
  { time: 31100, note: 76, vel: 94, dur: 600 },

  { time: 32600, type: "pedal", down: false },
  { time: 32640, type: "pedal", down: true },

  // ===== CHORUS CLIMAX: E - B/D# - C#m7 - A - E/G# - F#m7 - B - E =====
  { time: 32660, note: 40, vel: 104, dur: 3200 },
  { time: 32760, note: 47, vel: 100, dur: 3200 },
  { time: 32860, note: 52, vel: 98, dur: 3200 },
  { time: 32960, note: 56, vel: 100, dur: 3200 },
  { time: 33060, note: 59, vel: 102, dur: 3200 },
  { time: 33160, note: 64, vel: 104, dur: 3200 },
  { time: 33260, note: 71, vel: 108, dur: 3200 },

  { time: 35000, type: "pedal", down: false },
];

export class WhitneyDemoPlayer {
  constructor() {
    this.isPlaying = false;
    this.startTime = 0;
    this.timers = [];
    this.activeMidiNotes = new Set();
    this.onProgressCallback = null;
    this.onNoteTriggerCallback = null;
    this.progressInterval = null;
    this.totalDurationMs = 35000;
  }

  async play() {
    if (this.isPlaying) {
      this.stop();
      return;
    }

    try {
      const ctx = audioCore.init();
      if (ctx && ctx.state === "suspended") {
        await ctx.resume();
      }
      audioCore.unlock();
      multiLayerEngine.init();
      multiLayerEngine.toggleCombiMode(true);
      multiLayerEngine.setCombiPreset("whitney_ballad");
      if (audioCore.fxRack) {
        audioCore.fxRack.applyPreset("whitney_ballad");
      }

      if (multiLayerEngine.pcmEngine && !multiLayerEngine.pcmEngine.isReady) {
        await Promise.all([
          multiLayerEngine.pcmEngine.decodeEmbeddedAnchors(
            "acoustic_grand_piano",
          ),
          multiLayerEngine.pcmEngine.decodeEmbeddedAnchors("string_ensemble_1"),
          multiLayerEngine.pcmEngine.decodeEmbeddedAnchors("electric_piano_1"),
        ]);
      }
    } catch (e) {
      console.warn("Demo player audio setup:", e);
    }

    this.isPlaying = true;
    const ctx = audioCore.ctx;
    const songStart = (ctx ? ctx.currentTime : 0) + 0.08;
    this.startTime = ctx ? ctx.currentTime : 0;
    this.activeMidiNotes.clear();
    this.clearTimers();

    WHITNEY_30S_EVENTS.forEach((ev) => {
      if (ev.type === "pedal") {
        noteScheduler.pedal(ev.down, songStart + ev.time / 1000, "whitney");
      } else if (ev.note) {
        const at = songStart + ev.time / 1000;
        const offAt = songStart + (ev.time + (ev.dur || 600)) / 1000;
        noteScheduler.noteOn(ev.note, ev.vel, at, "whitney");
        noteScheduler.noteOff(ev.note, offAt, "whitney");
        this.activeMidiNotes.add(ev.note);

        const onDelay = Math.max(0, (at - ctx.currentTime) * 1000);
        const visOn = setTimeout(
          () => {
            if (!this.isPlaying) return;
            if (this.onNoteTriggerCallback) {
              this.onNoteTriggerCallback(ev.note, true, ev.vel);
            }
          },
          Math.max(0, onDelay - 12),
        );
        this.timers.push(visOn);

        const offDelay = Math.max(0, (offAt - ctx.currentTime) * 1000);
        const visOff = setTimeout(
          () => {
            if (!this.isPlaying) return;
            this.activeMidiNotes.delete(ev.note);
            if (this.onNoteTriggerCallback) {
              this.onNoteTriggerCallback(ev.note, false, 0);
            }
          },
          Math.max(0, offDelay - 12),
        );
        this.timers.push(visOff);
      }
    });

    noteScheduler.start();

    this.progressInterval = setInterval(() => {
      if (!this.isPlaying) return;
      const elapsed = ((ctx ? ctx.currentTime : 0) - this.startTime) * 1000;
      if (elapsed >= this.totalDurationMs) {
        this.stop();
        return;
      }
      if (this.onProgressCallback) {
        this.onProgressCallback(elapsed, this.totalDurationMs);
      }
    }, 100);

    if (this.onProgressCallback) {
      this.onProgressCallback(0, this.totalDurationMs);
    }
  }

  stop() {
    this.isPlaying = false;
    this.clearTimers();
    noteScheduler.discard("whitney");
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    for (const note of this.activeMidiNotes) {
      try {
        multiLayerEngine.noteOff(note);
      } catch (e) {}
      if (this.onNoteTriggerCallback) {
        this.onNoteTriggerCallback(note, false, 0);
      }
    }
    this.activeMidiNotes.clear();
    try {
      multiLayerEngine.setSustainPedal(false);
      multiLayerEngine.panic();
    } catch (e) {}

    if (this.onProgressCallback) {
      this.onProgressCallback(0, this.totalDurationMs);
    }
  }

  clearTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }
}

export const whitneyDemoPlayer = new WhitneyDemoPlayer();
