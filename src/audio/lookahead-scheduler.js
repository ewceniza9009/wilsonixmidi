/**
 * Shared audio-clock note scheduler (M2 lookahead).
 *
 * Timed sources (arpeggiator, clip looper, demo players) push note events with
 * an absolute Web Audio clock time instead of triggering notes "right now".
 * A single schedule loop flushes events whose target time falls inside a small
 * lookahead window, so main-thread jank no longer shifts their audible moment:
 * the event is dispatched up to `scheduleAheadSec` earlier and the engine
 * places it exactly at `when` via src.start(when) / param automation.
 *
 * Live key / pad / MIDI input is NOT routed here — those stay on the
 * as-fast-as-possible path, which is the lowest possible latency.
 */

import { audioCore } from "./audio-core.js";
import { multiLayerEngine } from "./multi-layer-engine.js";

export class LookaheadScheduler {
  constructor({ lookaheadMs = 25, scheduleAheadSec = 0.1 } = {}) {
    this.lookaheadMs = lookaheadMs;
    this.scheduleAheadSec = scheduleAheadSec;
    this.timerId = null;
    this.running = false;
    this.queue = [];
    this._refills = [];
    this.warned = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.queue = [];
    this._refills = [];
  }

  clear() {
    this.queue = [];
  }

  addRefill(fn) {
    if (typeof fn === "function" && !this._refills.includes(fn)) {
      this._refills.push(fn);
    }
  }

  removeRefill(fn) {
    const i = this._refills.indexOf(fn);
    if (i !== -1) this._refills.splice(i, 1);
  }

  noteOn(note, vel, when, author = "") {
    this._insert({ when, type: "on", note, vel, author });
  }

  noteOff(note, when, author = "") {
    this._insert({ when, type: "off", note, author });
  }

  pedal(down, when, author = "") {
    this._insert({ when, type: "pedal", down, author });
  }

  // Drop all not-yet-dispatched events for one consumer (e.g. arp.stop() or
  // looper track stop) without touching other consumers sharing the queue.
  discard(author) {
    if (!author) return;
    this.queue = this.queue.filter(ev => ev.author !== author);
  }

  _insert(ev) {
    if (!Number.isFinite(ev.when)) return;
    let i = this.queue.length;
    while (i > 0 && this.queue[i - 1].when > ev.when) i--;
    this.queue.splice(i, 0, ev);
  }

  _dispatch(ev) {
    // Tag the engine so consumers (e.g. the clip looper's record hook) can
    // tell scheduled playback apart from live input. Cleared synchronously
    // after dispatch — single-threaded, so no async leakage.
    multiLayerEngine._schedAuthor = ev.author || "";
    try {
      switch (ev.type) {
        case "on":
          multiLayerEngine.noteOn(ev.note, ev.vel, ev.when);
          break;
        case "off":
          multiLayerEngine.noteOff(ev.note, ev.when);
          break;
        case "pedal":
          multiLayerEngine.setSustainPedal(ev.down, ev.when);
          break;
      }
    } finally {
      multiLayerEngine._schedAuthor = "";
    }
  }

  _loop() {
    if (!this.running) return;
    const ctx = audioCore.ctx;
    if (!ctx) {
      this.stop();
      return;
    }

    // Consumers that generate an infinite stream (arpeggiator, looper) re-fill
    // the queue here so the horizon stays populated one lookahead at a time.
    for (const fn of this._refills) {
      try { fn(this); } catch (e) {}
    }

    const horizon = ctx.currentTime + this.scheduleAheadSec;
    let guard = 0;
    while (this.queue.length && this.queue[0].when <= horizon && guard++ < 512) {
      const ev = this.queue.shift();
      this._dispatch(ev);
    }

    this.timerId = setTimeout(() => this._loop(), this.lookaheadMs);
  }
}

export const noteScheduler = new LookaheadScheduler();