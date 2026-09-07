/**
 * Ableton-Style Synchronized 4-Track Clip Looper
 * Records MIDI event streams, quantizes loop seams, and supports real-time multi-track overdubbing.
 */

import { synthEngine } from "../audio/synth-engine.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";

export class ClipLooper {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.bpm = 120;
    this.bars = 4; // 4-bar loop standard

    this.tracks = [
      { id: 0, state: "empty", events: [], timer: null, activeNotes: new Set() },
      { id: 1, state: "empty", events: [], timer: null, activeNotes: new Set() },
      { id: 2, state: "empty", events: [], timer: null, activeNotes: new Set() },
      { id: 3, state: "empty", events: [], timer: null, activeNotes: new Set() },
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

  hookSynthEngine() {
    const originalNoteOn = synthEngine.noteOn.bind(synthEngine);
    const originalNoteOff = synthEngine.noteOff.bind(synthEngine);

    synthEngine.noteOn = (midiNote, velocity) => {
      // Call original for heldNotes tracking + visual callbacks (oscillators are permanently muted)
      originalNoteOn(midiNote, velocity);
      // Route through multiLayerEngine for actual PCM sample playback
      multiLayerEngine.noteOn(midiNote, velocity);
      if (this.recordingTrackId !== null) {
        const offset = performance.now() - this.recordStartTime;
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
        const offset = performance.now() - this.recordStartTime;
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
        else if (action === "clear") this.clearTrack(trackId);
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
      this.recordStartTime = performance.now();
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

    const loopLen = this.getLoopDurationMs();

    const runLoopIteration = () => {
      track.events.forEach(e => {
        const timer = setTimeout(() => {
          if (track.state !== "playing") return;
          if (e.type === "on") {
            multiLayerEngine.noteOn(e.note, e.vel);
            track.activeNotes.add(e.note);
          } else {
            multiLayerEngine.noteOff(e.note);
            track.activeNotes.delete(e.note);
          }
        }, e.time);
      });

      track.timer = setTimeout(runLoopIteration, loopLen);
    };

    runLoopIteration();
  }

  stopPlayback(trackId) {
    const track = this.tracks[trackId];
    if (track.timer) {
      clearTimeout(track.timer);
      track.timer = null;
    }
    track.activeNotes.forEach(n => multiLayerEngine.noteOff(n));
    track.activeNotes.clear();
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
