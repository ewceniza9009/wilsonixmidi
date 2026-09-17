/**
 * Ableton-Style Synchronized 4-Track Clip Looper — CHAMPION BUILD
 *
 * - Count-in start, manual STOP, beat-snapped loop length
 * - Orphan off events filtered (count-in key holds no longer poison the loop)
 * - Orphan sustain releases cleaned up
 * - Seam guard never cancels the first note of an iteration
 * - PER-TRACK PRESET PRESERVATION: each track snapshots the full 4-layer
 *   combi (instruments, gains, octaves, per-layer FX) at record time and
 *   replays through dedicated looper buses. Live playing uses whatever
 *   preset you switch to and never collides with the loop's sound.
 */

import { audioCore } from "../audio/audio-core.js";
import { synthEngine } from "../audio/synth-engine.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";
import { noteScheduler } from "../audio/lookahead-scheduler.js";

let __clipLooperHooked = false;

export class ClipLooper {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.bpm = options.bpm ?? 120;
    this.beatsPerBar = options.beatsPerBar ?? 4;
    this.countInBars = options.countInBars ?? 1;
    this.snapToBeats = options.snapToBeats ?? true;
    this.seamGuardSec = options.seamGuardSec ?? 0.03;
    this.startLeadSec = options.startLeadSec ?? 0.05;
    this.looperGain = typeof options.looperGain === "number" ? options.looperGain : 0.55;

    this.tracks = [
      this._blankTrack(0),
      this._blankTrack(1),
      this._blankTrack(2),
      this._blankTrack(3),
    ];

    this.recordingTrackId = null;
    this.recordStartTime = 0;
    this.countInNodes = [];

    this.render();
    this.bindEvents();
    this.hookSynthEngine();
  }

  _blankTrack(id) {
    return {
      id,
      state: "empty",
      events: [],
      activeNotes: new Set(),
      refill: null,
      nextIterStart: 0,
      loopLen: 0,
      countIn: null,
      preset: null, // snapshot taken at record start
      initialSustain: false,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // UI
  // ──────────────────────────────────────────────────────────────────────

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="looper-station">
        <div class="looper-header">
          <span class="looper-title">SESSION CLIP LOOPER</span>
          <div class="demo-vol-control">
            <span class="demo-vol-label">LOOP VOL</span>
            <input
              type="range"
              class="demo-vol-slider"
              id="looper-volume-slider"
              min="10"
              max="100"
              value="${Math.round(this.looperGain * 100)}"
              title="Session clip playback volume (rides under your live preset)"
            />
            <span class="demo-vol-pct" id="looper-vol-pct">${Math.round(this.looperGain * 100)}%</span>
          </div>
          <div class="looper-tempo-badge">
            <span id="looper-bpm-display">${this.bpm} BPM</span>
            <span class="bar-count-badge">${this.beatsPerBar}/4</span>
          </div>
        </div>
        <div class="looper-tracks-grid">
          ${this.tracks
            .map(
              (t) => `
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
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  bindEvents() {
    if (!this.container) return;
    const volSlider = this.container.querySelector("#looper-volume-slider");
    const volPct = this.container.querySelector("#looper-vol-pct");
    if (volSlider) {
      volSlider.addEventListener("input", (e) => {
        const v = parseFloat(e.target.value) / 100;
        this.looperGain = v;
        if (volPct) volPct.textContent = `${Math.round(v * 100)}%`;
      });
    }
    this.container.querySelectorAll(".slot-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const trackId = parseInt(btn.getAttribute("data-track"));
        const action = btn.getAttribute("data-action");
        if (action === "rec") this.toggleRecord(trackId);
        else if (action === "play") this.togglePlay(trackId);
        else if (action === "clear") {
          const st = this.tracks[trackId].state;
          if (st === "recording" || st === "counting")
            this.stopRecording(trackId);
          else this.clearTrack(trackId);
        }
      });
    });
  }

  updateTrackUi(trackId) {
    const track = this.tracks[trackId];
    const card = document.getElementById(`loop-slot-${trackId}`);
    const pill = document.getElementById(`slot-status-${trackId}`);
    if (!card || !pill) return;

    card.className = `loop-slot-card state-${track.state}`;
    pill.innerText = track.state.toUpperCase();

    const recBtn = card.querySelector(".rec-btn");
    if (recBtn) {
      recBtn.innerText =
        track.state === "recording"
          ? "■ STOP"
          : track.state === "counting"
            ? "… WAIT"
            : "● REC";
    }
    const playBtn = card.querySelector(".play-btn");
    if (playBtn) {
      playBtn.innerText = track.state === "playing" ? "❚❚ PAUSE" : "▶ PLAY";
    }
  }

  beatSec() {
    return 60 / this.bpm;
  }
  barSec() {
    return this.beatSec() * this.beatsPerBar;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Preset snapshot / restore
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Capture the current 4-layer combi state (or single-instrument state as a
   * 1-layer snapshot) at record time. Replayed by startPlayback through the
   * dedicated looper buses, so switching presets live never touches the loop.
   */
  _snapshotPreset() {
    const snap = { layers: [], isCombiMode: false, isTritonVaMode: false };

    if (
      multiLayerEngine.isCombiMode &&
      Array.isArray(multiLayerEngine.layers)
    ) {
      snap.isCombiMode = true;
      for (let i = 0; i < 4; i++) {
        const L = multiLayerEngine.layers[i] || {};
        snap.layers.push({
          inst: L.inst || "acoustic_grand_piano",
          gain: typeof L.gain === "number" ? L.gain : 1.0,
          oct: typeof L.oct === "number" ? L.oct : 0,
          fx: L.fx || "clean",
          enabled: L.enabled !== false,
          vaProg: L.vaProg ? L.vaProg.id : null,
        });
      }
    } else if (
      multiLayerEngine.isTritonVaMode &&
      multiLayerEngine.activeTritonVaProg
    ) {
      snap.isTritonVaMode = true;
      snap.layers.push({
        inst: "va:" + multiLayerEngine.activeTritonVaProg.id,
        gain: 1.0,
        oct: 0,
        fx: "clean",
        enabled: true,
        vaProg: multiLayerEngine.activeTritonVaProg.id,
      });
    } else {
      snap.layers.push({
        inst: multiLayerEngine.activeSingleInst || "acoustic_grand_piano",
        gain: 1.0,
        oct: 0,
        fx: "clean",
        enabled: true,
        vaProg: null,
      });
    }
    return snap;
  }

  _applyPresetToLooperBuses(trackId, preset) {
    const pcm = multiLayerEngine.pcmEngine;
    if (!pcm || !pcm.setLooperTrackFx) return;
    for (let slot = 0; slot < 4; slot++) {
      const L = preset.layers[slot];
      const fx = L ? L.fx : "clean";
      const g = L ? L.gain : 0.0;
      try {
        pcm.setLooperTrackFx(trackId, slot, fx);
        pcm.setLooperTrackGain(trackId, slot, g);
      } catch (e) {}
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Engine hooks — capture live input
  // ──────────────────────────────────────────────────────────────────────

  hookSynthEngine() {
    if (__clipLooperHooked) return;
    __clipLooperHooked = true;

    // Pass-through synthEngine → multiLayerEngine (unchanged behavior).
    const origSynthOn = synthEngine.noteOn.bind(synthEngine);
    const origSynthOff = synthEngine.noteOff.bind(synthEngine);
    synthEngine.noteOn = (n, v, w) => {
      origSynthOn(n, v, w);
      multiLayerEngine.noteOn(n, v, w);
    };
    synthEngine.noteOff = (n, w) => {
      origSynthOff(n, w);
      multiLayerEngine.noteOff(n, w);
    };

    const origMlOn = multiLayerEngine.noteOn.bind(multiLayerEngine);
    const origMlOff = multiLayerEngine.noteOff.bind(multiLayerEngine);
    const origMlSus = multiLayerEngine.setSustainPedal.bind(multiLayerEngine);

    multiLayerEngine.noteOn = (note, vel, when) => {
      origMlOn(note, vel, when);
      if (this.recordingTrackId !== null && !multiLayerEngine._schedAuthor) {
        const ctx = audioCore.ctx;
        if (!ctx) return;
        const offset = ctx.currentTime - this.recordStartTime;
        if (offset >= 0) {
          this.tracks[this.recordingTrackId].events.push({
            type: "on",
            note,
            vel,
            time: offset,
          });
        }
      }
    };

    multiLayerEngine.noteOff = (note, when) => {
      origMlOff(note, when);
      if (this.recordingTrackId !== null && !multiLayerEngine._schedAuthor) {
        const ctx = audioCore.ctx;
        if (!ctx) return;
        const offset = ctx.currentTime - this.recordStartTime;
        if (offset >= 0) {
          this.tracks[this.recordingTrackId].events.push({
            type: "off",
            note,
            time: offset,
          });
        }
      }
    };

    if (typeof multiLayerEngine.fastNoteOff === "function") {
      const origMlFastOff = multiLayerEngine.fastNoteOff.bind(multiLayerEngine);
      multiLayerEngine.fastNoteOff = (note, when) => {
        origMlFastOff(note, when);
        if (this.recordingTrackId !== null && !multiLayerEngine._schedAuthor) {
          const ctx = audioCore.ctx;
          if (!ctx) return;
          const offset = ctx.currentTime - this.recordStartTime;
          if (offset >= 0) {
            this.tracks[this.recordingTrackId].events.push({
              type: "off",
              note,
              time: offset,
            });
          }
        }
      };
    }

    multiLayerEngine.setSustainPedal = (down, when) => {
      origMlSus(down, when);
      if (this.recordingTrackId !== null && !multiLayerEngine._schedAuthor) {
        const ctx = audioCore.ctx;
        if (!ctx) return;
        const offset = ctx.currentTime - this.recordStartTime;
        if (offset >= 0) {
          this.tracks[this.recordingTrackId].events.push({
            type: "sustain",
            down,
            time: offset,
          });
        }
      }
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Recording
  // ──────────────────────────────────────────────────────────────────────

  toggleRecord(trackId) {
    const track = this.tracks[trackId];

    if (this.recordingTrackId === trackId || track.state === "counting") {
      this.stopRecording(trackId);
      return;
    }

    if (this.recordingTrackId !== null)
      this.finishRecording(this.recordingTrackId);
    this.tracks.forEach((t, i) => {
      if (t.state === "counting") this._cancelCountIn(i);
    });

    if (track.state === "playing") {
      this.stopPlayback(trackId);
      track.state = "stopped";
    }

    track.events = [];
    track.loopLen = 0;
    track.preset = null;

    if (this.countInBars > 0) {
      this._startCountIn(trackId);
    } else {
      const ctx = audioCore.ctx;
      if (!ctx) return;
      this._beginRecordingAt(trackId, ctx.currentTime);
    }
  }

  _startCountIn(trackId) {
    const track = this.tracks[trackId];
    const ctx = audioCore.ctx;
    if (!ctx) return;

    track.state = "counting";
    this.updateTrackUi(trackId);

    const beat = this.beatSec();
    const countInBeats = this.countInBars * this.beatsPerBar;
    const startAt = ctx.currentTime + 0.1;
    const recordAt = startAt + countInBeats * beat;

    this._scheduleCountInClicks(startAt, countInBeats, beat);

    const delayMs = Math.max(0, (recordAt - ctx.currentTime) * 1000);
    track.countIn = {
      timerId: setTimeout(() => {
        track.countIn = null;
        if (track.state !== "counting") return;
        this._beginRecordingAt(trackId, recordAt);
      }, delayMs),
    };
  }

  _cancelCountIn(trackId) {
    const track = this.tracks[trackId];
    if (track.countIn) {
      clearTimeout(track.countIn.timerId);
      track.countIn = null;
    }
    this._stopCountInClicks();
    track.state = track.events.length > 0 ? "stopped" : "empty";
    this.updateTrackUi(trackId);
  }

  _scheduleCountInClicks(startAt, beats, beatSec) {
    const ctx = audioCore.ctx;
    if (!ctx) return;
    this._stopCountInClicks();
    for (let i = 0; i < beats; i++) {
      const t = startAt + i * beatSec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const downbeat = i % this.beatsPerBar === 0;
      osc.type = "square";
      osc.frequency.value = downbeat ? 1600 : 1000;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(downbeat ? 0.35 : 0.2, t + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
      this.countInNodes.push(osc);
    }
  }

  _stopCountInClicks() {
    this.countInNodes.forEach((o) => {
      try {
        o.stop();
      } catch (_) {}
    });
    this.countInNodes = [];
  }

  _beginRecordingAt(trackId, startAt) {
    const track = this.tracks[trackId];
    const ctx = audioCore.ctx;
    if (!ctx) return;

    this.recordingTrackId = trackId;
    this.recordStartTime = startAt;

    // FREEZE THE PRESET NOW — this is what the loop will always sound like.
    track.preset = this._snapshotPreset();

    // Initial sustain state.
    let initialSustain = false;
    if (typeof multiLayerEngine.getSustainPedal === "function") {
      initialSustain = !!multiLayerEngine.getSustainPedal();
    } else if (typeof multiLayerEngine.sustainPedalActive === "boolean") {
      initialSustain = multiLayerEngine.sustainPedalActive;
    } else if (typeof multiLayerEngine.sustainPedal === "boolean") {
      initialSustain = multiLayerEngine.sustainPedal;
    } else if (multiLayerEngine.pcmEngine?.sustainPedal) {
      initialSustain = true;
    }
    track.initialSustain = initialSustain;
    if (initialSustain) {
      track.events.push({ type: "sustain", down: true, time: 0 });
    }

    // Start this track's looper buses from the current pedal state so a clip
    // recorded with sustain OFF never inherits a leftover sustain flag from a
    // previously played clip (each bus holds its own sticky sustainActive bit).
    const pcm = multiLayerEngine.pcmEngine;
    if (pcm && typeof pcm.setLooperTrackSustain === "function") {
      pcm.setLooperTrackSustain(trackId, initialSustain);
    }

    track.state = "recording";
    this.updateTrackUi(trackId);
  }

  stopRecording(trackId) {
    const track = this.tracks[trackId];

    if (track.countIn) {
      clearTimeout(track.countIn.timerId);
      track.countIn = null;
      this._stopCountInClicks();
      track.state = track.events.length > 0 ? "stopped" : "empty";
      this.updateTrackUi(trackId);
      return;
    }
    if (this.recordingTrackId !== trackId) return;
    this.finishRecording(trackId);
  }

  finishRecording(trackId) {
    const track = this.tracks[trackId];
    const ctx = audioCore.ctx;
    if (!ctx) return;

    const elapsed = Math.max(0, ctx.currentTime - this.recordStartTime);
    this.recordingTrackId = null;
    this.recordStartTime = 0;
    this._stopCountInClicks();

    if (track.events.length === 0) {
      track.loopLen = 0;
      track.preset = null;
      track.state = "empty";
      this.updateTrackUi(trackId);
      return;
    }

    // 1) Loop length.
    let loopLen = elapsed;
    if (this.snapToBeats) {
      const beat = this.beatSec();
      const beats = Math.max(1, Math.round(elapsed / beat));
      loopLen = beats * beat;
    }
    loopLen = Math.max(loopLen, this.beatSec());

    // 2) Release sustain if held at STOP.
    const lastSus = [...track.events]
      .reverse()
      .find((e) => e.type === "sustain");
    if (lastSus && lastSus.down) {
      track.events.push({ type: "sustain", down: false, time: loopLen });
    }

    // 3) Close open notes 30ms before seam.
    const open = new Map();
    track.events.forEach((e) => {
      if (e.type === "on") open.set(e.note, true);
      else if (e.type === "off") open.delete(e.note);
    });
    open.forEach((_, note) => {
      track.events.push({
        type: "off",
        note,
        time: Math.max(0, loopLen - 0.03),
      });
    });

    // 4) Drop orphan off events (releases with no matching on).
    const seen = new Set();
    const cleaned = [];
    track.events.forEach((e) => {
      if (e.type === "on") {
        seen.add(e.note);
        cleaned.push(e);
      } else if (e.type === "off") {
        if (seen.has(e.note)) {
          seen.delete(e.note);
          cleaned.push(e);
        }
      } else {
        cleaned.push(e);
      }
    });
    track.events = cleaned;

    // 5) Trim to loop.
    track.events = track.events.filter((e) => e.time < loopLen);

    // 6) Sort.
    track.events.sort((a, b) => a.time - b.time);

    track.loopLen = Math.round(loopLen * 1000) / 1000;
    track.state = "playing";
    this.startPlayback(trackId);
    this.updateTrackUi(trackId);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Playback — routed through dedicated looper buses with the frozen preset
  // ──────────────────────────────────────────────────────────────────────

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
    if (!track.preset) track.preset = this._snapshotPreset();

    const loopLen = track.loopLen > 0 ? track.loopLen : this.barSec();
    const events = track.events.slice();
    const preset = track.preset;

    // Push the frozen preset FX + gains into this track's dedicated buses.
    this._applyPresetToLooperBuses(trackId, preset);

    const lead = Math.min(
      this.startLeadSec,
      noteScheduler.scheduleAheadSec * 0.5,
    );
    track.nextIterStart = audioCore.ctx.currentTime + lead;

    const scheduleIter = () => {
      if (track.state !== "playing") return;
      const ctx = audioCore.ctx;
      if (!ctx) return;

      while (
        track.nextIterStart <
        ctx.currentTime + noteScheduler.scheduleAheadSec
      ) {
        // Start every iteration from a neutral sustain state so a clip that was
        // recorded with the pedal UP never inherits a leftover sustain flag
        // (each looper bus keeps its own sticky sustainActive bit once set).
        const pcmReset = multiLayerEngine.pcmEngine;
        if (pcmReset && typeof pcmReset.setLooperTrackSustain === "function") {
          pcmReset.setLooperTrackSustain(trackId, !!track.initialSustain);
        }

        events.forEach((e) => {
          let eventTime = e.time;

          if (e.type === "off" && eventTime > 0) {
            const distToSeam = loopLen - eventTime;
            if (distToSeam >= 0 && distToSeam < this.seamGuardSec) {
              eventTime = Math.max(0, eventTime - this.seamGuardSec);
            }
          }
          const at = track.nextIterStart + eventTime;

          if (e.type === "on") {
            this._playLooperEvent(trackId, preset, e.note, e.vel, at);
            track.activeNotes.add(e.note);
          } else if (e.type === "off") {
            this._stopLooperEvent(trackId, preset, e.note, at);
            track.activeNotes.delete(e.note);
          } else if (e.type === "sustain") {
            // Sustain handled per-bus inside the engine; hook if present.
            const pcm = multiLayerEngine.pcmEngine;
            if (pcm && typeof pcm.setLooperTrackSustain === "function") {
              pcm.setLooperTrackSustain(trackId, e.down, at);
            }
          }
        });
        track.nextIterStart += loopLen;
      }
    };

    track.refill = scheduleIter;
    noteScheduler.addRefill(track.refill);
    scheduleIter();
    noteScheduler.start();
  }

  _playLooperEvent(trackId, preset, midiNote, velocity, at) {
    const pcm = multiLayerEngine.pcmEngine;
    if (!pcm || typeof pcm.playLooperNote !== "function") return;

    for (let slot = 0; slot < 4; slot++) {
      const L = preset.layers[slot];
      if (!L || !L.enabled) continue;
      const transposed = Math.max(
        21,
        Math.min(108, midiNote + (L.oct || 0) * 12),
      );
      try {
        pcm.playLooperNote(
          trackId,
          slot,
          L.inst,
          transposed,
          velocity,
          L.gain * this.looperGain,
          at,
        );
      } catch (e) {}
    }
  }

  _stopLooperEvent(trackId, preset, midiNote, at) {
    const pcm = multiLayerEngine.pcmEngine;
    if (!pcm || typeof pcm.stopLooperNote !== "function") return;

    for (let slot = 0; slot < 4; slot++) {
      const L = preset.layers[slot];
      if (!L || !L.enabled) continue;
      const transposed = Math.max(
        21,
        Math.min(108, midiNote + (L.oct || 0) * 12),
      );
      try {
        pcm.stopLooperNote(trackId, slot, L.inst, transposed, at);
      } catch (e) {}
    }
  }

  stopPlayback(trackId) {
    const track = this.tracks[trackId];

    if (track.refill) {
      noteScheduler.removeRefill(track.refill);
      track.refill = null;
    }

    // Cancel any events this track had scheduled.
    noteScheduler.discard("looper-" + trackId);

    // Kill voices on this track's dedicated looper buses.
    const pcm = multiLayerEngine.pcmEngine;
    if (pcm && pcm.looperInserts && pcm.looperInserts[trackId]) {
      // Release every note that is currently open on this track.
      track.activeNotes.forEach((note) => {
        for (let slot = 0; slot < 4; slot++) {
          const L = track.preset?.layers?.[slot];
          if (!L) continue;
          const transposed = Math.max(
            21,
            Math.min(108, note + (L.oct || 0) * 12),
          );
          try {
            pcm.stopLooperNote(trackId, slot, L.inst, transposed);
          } catch (e) {}
        }
      });
      try {
        pcm.clearLooperTrack(trackId);
      } catch (e) {}
      // Clear the sticky per-bus sustain flag so a future clip recorded with
      // the pedal UP never inherits sustain from this (or any prior) session.
      if (pcm && typeof pcm.setLooperTrackSustain === "function") {
        pcm.setLooperTrackSustain(trackId, false);
      }
    }
    track.activeNotes.clear();
  }

  clearTrack(trackId) {
    const track = this.tracks[trackId];
    this.stopPlayback(trackId);
    if (track.countIn) {
      clearTimeout(track.countIn.timerId);
      track.countIn = null;
    }
    this._stopCountInClicks();
    track.events = [];
    track.loopLen = 0;
    track.preset = null;
    track.state = "empty";
    this.updateTrackUi(trackId);
  }
}
