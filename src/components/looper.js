/**
 * Ableton-Style Synchronized 4-Track Clip Looper
 * Records MIDI event streams, quantizes loop seams, and supports real-time multi-track overdubbing.
 */

import { audioCore } from "../audio/audio-core.js";
import { synthEngine } from "../audio/synth-engine.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";
import { noteScheduler } from "../audio/lookahead-scheduler.js";

export class ClipLooper {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.bpm = 120;
    this.bars = 4; // 4-bar loop standard

    this.tracks = [
      { id: 0, state: "empty", events: [], activeNotes: new Set(), refill: null, nextIterStart: 0 },
      { id: 1, state: "empty", events: [], activeNotes: new Set(), refill: null, nextIterStart: 0 },
      { id: 2, state: "empty", events: [], activeNotes: new Set(), refill: null, nextIterStart: 0 },
      { id: 3, state: "empty", events: [], activeNotes: new Set(), refill: null, nextIterStart: 0 },
    ];

    this.recordingTrackId = null;
    this.recordStartTime = 0;

    this.render();
    this.bindEvents();
    this.hookSynthEngine();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="looper-station">
        <div class="looper-header">
          <span class="looper-title">SESSION CLIP LOOPER</span>
          <div class="looper-tempo-badge">
            <span id="looper-bpm-display">${this.bpm} BPM</span>
            <span class="bar-count-badge">4 BARS</span>
          </div>
        </div>

        <div class="looper-tracks-grid">
          ${this.tracks
            .map(
              t => `
            <div class="loop-slot-card" id="loop-slot-${t.id}">
              <div class="slot-head">
                <span class="slot-num">TRACK ${t.id + 1}</span>
                <span class="slot-status-pill" id="slot-status-${t.id}">EMPTY</span>
              </div>
              <div class="slot-visualizer">
                <div class="slot-progress-bar" id="slot-progress-${t.id}"></div>
              </div>
              <div class="slot-actions">
                <button class="slot-btn rec-btn" data-track="${t.id}" data-action="rec">● REC</button>
                <button class="slot-btn play-btn" data-track="${t.id}" data-action="play">▶ PLAY</button>
                <button class="slot-btn clear-btn" data-track="${t.id}" data-action="clear">✕</button>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  getLoopDurationMs() {
    // 4 beats per bar * 4 bars = 16 beats
    return (60 / this.bpm) * 4 * this.bars * 1000;
  }

  getLoopDurationSec() {
    return this.getLoopDurationMs() / 1000;
  }

  hookSynthEngine() {
    const originalNoteOn = synthEngine.noteOn.bind(synthEngine);
    const originalNoteOff = synthEngine.noteOff.bind(synthEngine);

    synthEngine.noteOn = (midiNote, velocity) => {
      // Call original for heldNotes tracking + visual callbacks (oscillators are permanently muted)
      originalNoteOn(midiNote, velocity);
      // Route through multiLayerEngine for actual PCM sample playback
      multiLayerEngine.noteOn(midiNote, velocity);
      if (this.recordingTrackId !== null) {
        const ctx = audioCore.ctx;
        const offset = ctx ? ctx.currentTime - this.recordStartTime : 0;
        this.tracks[this.recordingTrackId].events.push({
          type: "on",
          note: midiNote,
          vel: velocity,
          time: offset,
        });
      }
    };

    synthEngine.noteOff = midiNote => {
      originalNoteOff(midiNote);
      multiLayerEngine.noteOff(midiNote);
      if (this.recordingTrackId !== null) {
        const ctx = audioCore.ctx;
        const offset = ctx ? ctx.currentTime - this.recordStartTime : 0;
        this.tracks[this.recordingTrackId].events.push({
          type: "off",
          note: midiNote,
          time: offset,
        });
      }
    };
  }

  bindEvents() {
    this.container.querySelectorAll(".slot-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const trackId = parseInt(btn.getAttribute("data-track"));
        const action = btn.getAttribute("data-action");

        if (action === "rec") this.toggleRecord(trackId);
        else if (action === "play") this.togglePlay(trackId);
        else if (action === "clear") {
          // If track is in recording state, stop recording early
          if (this.tracks[trackId].state === "recording") {
            this.stopRecording(trackId);
          } else {
            this.clearTrack(trackId);
          }
        }
      });
    });
  }

  toggleRecord(trackId) {
    const track = this.tracks[trackId];

    if (this.recordingTrackId === trackId) {
      // Finish recording and transition to playback loop
      this.finishRecording(trackId);
    } else {
      // Start recording on this track (overdub or fresh)
      if (this.recordingTrackId !== null) {
        this.finishRecording(this.recordingTrackId);
      }
      this.recordingTrackId = trackId;
      const ctx = audioCore.ctx;
      this.recordStartTime = ctx ? ctx.currentTime : 0;
      track.state = "recording";
      this.updateTrackUi(trackId);

      // Auto-finish after loop duration
      setTimeout(() => {
        if (this.recordingTrackId === trackId) {
          this.finishRecording(trackId);
        }
      }, this.getLoopDurationMs());
    }
  }

  finishRecording(trackId) {
    const track = this.tracks[trackId];
    this.recordingTrackId = null;
    if (track.events.length > 0) {
      track.state = "playing";
      this.startPlayback(trackId);
    } else {
      track.state = "empty";
    }
    this.updateTrackUi(trackId);
  }

  stopRecording(trackId) {
    const track = this.tracks[trackId];
    this.recordingTrackId = null;
    if (track.events.length > 0) {
      track.state = "playing";
      this.startPlayback(trackId);
    } else {
      track.state = "empty";
    }
    this.updateTrackUi(trackId);
  }

  togglePlay(trackId) {
    const track = this.tracks[trackId];
    if (track.state === "playing") {
      this.stopPlayback(trackId);
      track.state = "stopped";
    } else if (track.events.length > 0) {
      track.state = "playing";
      this.startPlayback(trackId);
    }
    this.updateTrackUi(trackId);
  }

  startPlayback(trackId) {
    const track = this.tracks[trackId];
    this.stopPlayback(trackId);

    if (!audioCore.ctx) return;
    const loopLen = this.getLoopDurationSec();

    // First audible iteration starts slightly ahead so the scheduler already
    // has events placed on the audio clock before they are audible.
    track.nextIterStart = audioCore.ctx.currentTime + 0.08;

    const scheduleIter = () => {
      if (track.state !== "playing") return;
      const ctx = audioCore.ctx;
      if (!ctx) return;
      const sec = loopLen;

      // Place the events of every iteration that falls inside the lookahead
      // horizon. Because events carry an absolute audio time, one main-thread
      // jank spike between iterations cannot stretch the loop seam.
      while (track.nextIterStart < ctx.currentTime + noteScheduler.scheduleAheadSec) {
        track.events.forEach(e => {
          const at = track.nextIterStart + e.time;
          if (e.type === "on") {
            noteScheduler.noteOn(e.note, e.vel, at, "looper-" + trackId);
            track.activeNotes.add(e.note);
          } else {
            noteScheduler.noteOff(e.note, at, "looper-" + trackId);
            track.activeNotes.delete(e.note);
          }
        });
        track.nextIterStart += sec;
      }
    };

    track.refill = scheduleIter;
    noteScheduler.addRefill(track.refill);
    scheduleIter();
    noteScheduler.start();
  }

  stopPlayback(trackId) {
    const track = this.tracks[trackId];
    if (track.refill) {
      noteScheduler.removeRefill(track.refill);
      track.refill = null;
    }
    noteScheduler.discard("looper-" + trackId);
    // Close every note that was open at the moment of stopping. Scheduled
    // events were already discarded; the engine still rings any that started.
    track.activeNotes.forEach(n => multiLayerEngine.noteOff(n));
    track.activeNotes.clear();
    const evNotes = new Set(track.events.filter(e => e.type === "on").map(e => e.note));
    evNotes.forEach(n => multiLayerEngine.noteOff(n));
  }

  clearTrack(trackId) {
    const track = this.tracks[trackId];
    this.stopPlayback(trackId);
    track.events = [];
    track.state = "empty";
    this.updateTrackUi(trackId);
  }

  updateTrackUi(trackId) {
    const track = this.tracks[trackId];
    const card = document.getElementById(`loop-slot-${trackId}`);
    const pill = document.getElementById(`slot-status-${trackId}`);
    if (!card || !pill) return;

    card.className = `loop-slot-card state-${track.state}`;
    pill.innerText = track.state.toUpperCase();
  }
}
