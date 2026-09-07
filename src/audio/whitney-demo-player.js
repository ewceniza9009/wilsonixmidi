import { multiLayerEngine } from "./multi-layer-engine.js";
import { audioCore } from "./audio-core.js";

export const WHITNEY_30S_EVENTS = [
  { time: 0, type: "pedal", down: true },

  { time: 20, note: 43, vel: 78, dur: 3600 },
  { time: 220, note: 50, vel: 72, dur: 3400 },
  { time: 420, note: 55, vel: 70, dur: 3200 },
  { time: 620, note: 59, vel: 68, dur: 3000 },
  { time: 820, note: 62, vel: 70, dur: 2800 },

  { time: 1400, note: 74, vel: 85, dur: 320 },
  { time: 1720, note: 72, vel: 82, dur: 320 },
  { time: 2040, note: 71, vel: 80, dur: 320 },
  { time: 2360, note: 67, vel: 78, dur: 500 },

  { time: 3050, note: 74, vel: 86, dur: 200 },
  { time: 3250, note: 66, vel: 82, dur: 200 },
  { time: 3450, note: 79, vel: 90, dur: 1200 },

  { time: 3700, type: "pedal", down: false },
  { time: 3740, type: "pedal", down: true },

  { time: 3760, note: 40, vel: 78, dur: 3600 },
  { time: 3960, note: 47, vel: 72, dur: 3400 },
  { time: 4160, note: 52, vel: 70, dur: 3200 },
  { time: 4360, note: 55, vel: 68, dur: 3000 },
  { time: 4560, note: 59, vel: 70, dur: 2800 },

  { time: 5140, note: 74, vel: 85, dur: 320 },
  { time: 5460, note: 72, vel: 82, dur: 320 },
  { time: 5780, note: 71, vel: 80, dur: 320 },
  { time: 6100, note: 66, vel: 78, dur: 500 },

  { time: 6790, note: 74, vel: 86, dur: 200 },
  { time: 6990, note: 66, vel: 82, dur: 200 },
  { time: 7190, note: 79, vel: 90, dur: 1200 },

  { time: 7440, type: "pedal", down: false },
  { time: 7480, type: "pedal", down: true },

  { time: 7500, note: 36, vel: 78, dur: 3600 },
  { time: 7700, note: 43, vel: 72, dur: 3400 },
  { time: 7900, note: 48, vel: 70, dur: 3200 },
  { time: 8100, note: 52, vel: 68, dur: 3000 },
  { time: 8300, note: 55, vel: 70, dur: 2800 },

  { time: 8880, note: 71, vel: 84, dur: 320 },
  { time: 9200, note: 69, vel: 82, dur: 320 },
  { time: 9520, note: 67, vel: 80, dur: 320 },
  { time: 9840, note: 64, vel: 78, dur: 500 },

  { time: 10530, note: 74, vel: 86, dur: 200 },
  { time: 10730, note: 66, vel: 82, dur: 200 },
  { time: 10930, note: 79, vel: 90, dur: 1200 },

  { time: 11180, type: "pedal", down: false },
  { time: 11220, type: "pedal", down: true },

  { time: 11240, note: 38, vel: 80, dur: 3600 },
  { time: 11440, note: 45, vel: 74, dur: 3400 },
  { time: 11640, note: 50, vel: 72, dur: 3200 },

  { time: 11840, note: 55, vel: 72, dur: 1400 },
  { time: 11840, note: 60, vel: 74, dur: 1400 },
  { time: 11840, note: 62, vel: 76, dur: 1400 },

  { time: 13240, note: 54, vel: 76, dur: 1600 },
  { time: 13240, note: 57, vel: 74, dur: 1600 },
  { time: 13240, note: 62, vel: 76, dur: 1600 },
  { time: 13240, note: 66, vel: 80, dur: 1600 },

  { time: 14850, type: "pedal", down: false },
  { time: 14890, type: "pedal", down: true },

  { time: 14910, note: 43, vel: 80, dur: 3600 },
  { time: 15110, note: 50, vel: 74, dur: 3400 },
  { time: 15310, note: 55, vel: 70, dur: 3200 },

  { time: 15550, note: 59, vel: 64, dur: 1400 },
  { time: 15550, note: 62, vel: 64, dur: 1400 },

  { time: 15750, note: 71, vel: 86, dur: 350 },
  { time: 16150, note: 69, vel: 84, dur: 350 },
  { time: 16550, note: 67, vel: 82, dur: 700 },

  { time: 17350, note: 74, vel: 84, dur: 280 },
  { time: 17700, note: 72, vel: 82, dur: 280 },
  { time: 18050, note: 71, vel: 80, dur: 280 },
  { time: 18400, note: 69, vel: 78, dur: 350 },
  { time: 18800, note: 67, vel: 80, dur: 700 },

  { time: 19600, type: "pedal", down: false },
  { time: 19640, type: "pedal", down: true },

  { time: 19660, note: 47, vel: 80, dur: 3600 },
  { time: 19860, note: 54, vel: 74, dur: 3400 },
  { time: 20060, note: 59, vel: 70, dur: 3200 },

  { time: 20300, note: 62, vel: 64, dur: 1400 },
  { time: 20300, note: 66, vel: 64, dur: 1400 },

  { time: 20500, note: 71, vel: 84, dur: 300 },
  { time: 20850, note: 69, vel: 82, dur: 300 },
  { time: 21200, note: 67, vel: 80, dur: 300 },
  { time: 21550, note: 66, vel: 78, dur: 300 },
  { time: 21900, note: 64, vel: 80, dur: 600 },

  { time: 22650, type: "pedal", down: false },
  { time: 22690, type: "pedal", down: true },

  { time: 22710, note: 48, vel: 80, dur: 3600 },
  { time: 22910, note: 55, vel: 74, dur: 3400 },
  { time: 23110, note: 60, vel: 70, dur: 3200 },

  { time: 23350, note: 64, vel: 64, dur: 1400 },
  { time: 23350, note: 67, vel: 64, dur: 1400 },

  { time: 23550, note: 67, vel: 82, dur: 300 },
  { time: 23900, note: 66, vel: 80, dur: 300 },
  { time: 24250, note: 64, vel: 78, dur: 300 },
  { time: 24600, note: 67, vel: 80, dur: 300 },
  { time: 24950, note: 69, vel: 82, dur: 380 },
  { time: 25400, note: 67, vel: 84, dur: 700 },

  { time: 26150, type: "pedal", down: false },
  { time: 26190, type: "pedal", down: true },

  { time: 26210, note: 40, vel: 82, dur: 3600 },
  { time: 26410, note: 47, vel: 76, dur: 3400 },
  { time: 26610, note: 52, vel: 72, dur: 3200 },

  { time: 26850, note: 55, vel: 66, dur: 1400 },
  { time: 26850, note: 59, vel: 66, dur: 1400 },

  { time: 27050, note: 67, vel: 84, dur: 350 },
  { time: 27450, note: 69, vel: 86, dur: 350 },
  { time: 27850, note: 71, vel: 88, dur: 800 },

  { time: 28700, type: "pedal", down: false },
  { time: 28740, type: "pedal", down: true },

  { time: 28760, note: 45, vel: 82, dur: 2200 },
  { time: 28960, note: 52, vel: 76, dur: 2200 },
  { time: 29160, note: 57, vel: 72, dur: 1800 },

  { time: 29400, note: 60, vel: 66, dur: 1000 },
  { time: 29400, note: 64, vel: 66, dur: 1000 },

  { time: 29600, note: 74, vel: 88, dur: 280 },
  { time: 29950, note: 72, vel: 86, dur: 280 },
  { time: 30300, note: 71, vel: 84, dur: 280 },
  { time: 30650, note: 69, vel: 82, dur: 280 },
  { time: 31000, note: 67, vel: 80, dur: 450 },

  { time: 31500, note: 38, vel: 86, dur: 1800 },
  { time: 31520, note: 45, vel: 80, dur: 1800 },
  { time: 31540, note: 50, vel: 78, dur: 1800 },

  { time: 31600, note: 55, vel: 76, dur: 900 },
  { time: 31600, note: 60, vel: 78, dur: 900 },
  { time: 31600, note: 74, vel: 90, dur: 900 },

  { time: 32600, type: "pedal", down: false },
  { time: 32640, type: "pedal", down: true },

  { time: 32660, note: 26, vel: 100, dur: 3500 },
  { time: 32680, note: 38, vel: 102, dur: 3500 },
  { time: 32700, note: 45, vel: 96, dur: 3500 },

  { time: 32720, note: 50, vel: 96, dur: 3500 },
  { time: 32720, note: 57, vel: 98, dur: 3500 },
  { time: 32720, note: 62, vel: 100, dur: 3500 },
  { time: 32720, note: 66, vel: 104, dur: 3500 },
  { time: 32720, note: 74, vel: 110, dur: 3500 },

  { time: 35000, type: "pedal", down: false }
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
          multiLayerEngine.pcmEngine.decodeEmbeddedAnchors("acoustic_grand_piano"),
          multiLayerEngine.pcmEngine.decodeEmbeddedAnchors("string_ensemble_1"),
          multiLayerEngine.pcmEngine.decodeEmbeddedAnchors("electric_piano_1"),
        ]);
      }
    } catch (e) {
      console.warn("Demo player audio setup:", e);
    }

    this.isPlaying = true;
    this.startTime = performance.now();
    this.activeMidiNotes.clear();
    this.clearTimers();

    WHITNEY_30S_EVENTS.forEach(ev => {
      if (ev.type === "pedal") {
        const t = setTimeout(() => {
          if (!this.isPlaying) return;
          multiLayerEngine.setSustainPedal(ev.down);
        }, ev.time);
        this.timers.push(t);
      } else if (ev.note) {
        const tOn = setTimeout(() => {
          if (!this.isPlaying) return;
          this.activeMidiNotes.add(ev.note);
          multiLayerEngine.noteOn(ev.note, ev.vel);
          if (this.onNoteTriggerCallback) {
            this.onNoteTriggerCallback(ev.note, true, ev.vel);
          }
        }, ev.time);
        this.timers.push(tOn);

        const tOff = setTimeout(() => {
          if (!this.isPlaying) return;
          this.activeMidiNotes.delete(ev.note);
          multiLayerEngine.noteOff(ev.note);
          if (this.onNoteTriggerCallback) {
            this.onNoteTriggerCallback(ev.note, false, 0);
          }
        }, ev.time + (ev.dur || 600));
        this.timers.push(tOff);
      }
    });

    this.progressInterval = setInterval(() => {
      if (!this.isPlaying) return;
      const elapsed = performance.now() - this.startTime;
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
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    for (const note of this.activeMidiNotes) {
      try { multiLayerEngine.noteOff(note); } catch (e) {}
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
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
  }
}

export const whitneyDemoPlayer = new WhitneyDemoPlayer();