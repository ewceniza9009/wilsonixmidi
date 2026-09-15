/**
 * Demo Station - 30-Second Song Clip Player
 * Live interactive playback through the MIDIKey engine (pedal + note events),
 * driving both the audible engine and the on-screen key visual bridge.
 */

import { DEMO_SONGS } from "../audio/demo-songs/index.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";
import { audioCore } from "../audio/audio-core.js";
import { noteScheduler } from "../audio/lookahead-scheduler.js";

export class DemoStationUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentSong = null;
    this.isPlaying = false;
    this.startTime = 0;
    this.timers = [];
    this.progressInterval = null;
    this.activeMidiNotes = new Set();
    this.searchQuery = "";

    this.render();
    this.renderList();
    this.bindEvents();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="demo-station-card">
        <div class="demo-station-header">
          <div class="station-title-group">
            <span class="station-badge">🎬 DEMO STATION</span>
            <span class="genre-tag">30s INTERACTIVE SONG CLIPS</span>
          </div>
          <span class="demo-hint">Clips play live on the current stage rig — watch the keys!</span>
        </div>
        <div class="demo-search-wrap">
          <input type="text" class="demo-search-input" id="demo-search" placeholder="Search songs..." value="" autocomplete="off" />
        </div>
        <div class="demo-song-list" id="demo-song-list"></div>
      </div>
    `;
  }

  renderList() {
    const list = this.container.querySelector("#demo-song-list");
    if (!list) return;

    const q = this.searchQuery.toLowerCase().trim();
    const filtered = q
      ? DEMO_SONGS.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.subtitle.toLowerCase().includes(q),
        )
      : DEMO_SONGS;

    list.innerHTML = filtered
      .map(
        (song) => `
      <div class="demo-song-row" data-song="${song.id}">
        <div class="demo-song-label">
          <span class="demo-song-title">${song.title}</span>
          <span class="demo-song-subtitle">${song.subtitle}</span>
        </div>
        <div class="demo-song-controls">
          <div class="demo-progress-track">
            <div class="demo-progress-fill" id="demo-progress-${song.id}"></div>
          </div>
          <button class="demo-station-play-btn" id="demo-play-${song.id}" title="Play 30s demo">
            ▶ PLAY
          </button>
        </div>
      </div>
    `,
      )
      .join("");

    // Fresh button nodes each render — bind once, no duplicate listeners
    filtered.forEach((song) => {
      const btn = list.querySelector(`#demo-play-${song.id}`);
      btn?.addEventListener("click", () => {
        if (this.isPlaying && this.currentSong === song.id) {
          this.stop();
        } else {
          this.play(song);
        }
      });
    });
  }

  bindEvents() {
    const searchInput = this.container.querySelector("#demo-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value;
        this.renderList();
      });
    }
  }

  async play(song) {
    if (this.isPlaying) {
      this.stop();
    }

    // Always silence any lingering engine state before a new clip
    try {
      multiLayerEngine.panic();
    } catch (e) {}

    try {
      const ctx = audioCore.init();
      if (ctx && ctx.state === "suspended") {
        await ctx.resume();
      }
      audioCore.unlock();
      multiLayerEngine.init();
      multiLayerEngine.toggleCombiMode(true);
      multiLayerEngine.setCombiPreset(song.combi);
      if (audioCore.fxRack && song.fxPreset) {
        audioCore.fxRack.applyPreset(song.fxPreset);
      }

      // Pre-decode the song's instruments so playback starts instantly
      if (multiLayerEngine.pcmEngine) {
        const pcm = multiLayerEngine.pcmEngine;
        const embedded = song.embeddedInsts || [];
        const soundfonts = song.soundfontInsts || [];
        await Promise.all([
          ...embedded.map((inst) =>
            pcm.isReady ? pcm.decodeEmbeddedAnchors(inst) : Promise.resolve(),
          ),
          ...soundfonts.map((inst) => pcm.loadSoundfont(inst)),
        ]);
      }
    } catch (e) {
      console.warn("Demo player audio setup:", e);
    }

    this.currentSong = song.id;
    this.isPlaying = true;
    const ctx = audioCore.ctx;
    const songStart = (ctx ? ctx.currentTime : 0) + 0.08;
    this.startTime = ctx ? ctx.currentTime : performance.now() / 1000;
    this.activeMidiNotes.clear();
    this.clearTimers();
    this.updateButtons();

    song.events.forEach((ev) => {
      if (ev.type === "pedal") {
        const at = songStart + ev.time / 1000;
        noteScheduler.pedal(ev.down, at, "demo-" + song.id);
      } else if (ev.note) {
        const at = songStart + ev.time / 1000;
        noteScheduler.noteOn(ev.note, ev.vel, at, "demo-" + song.id);
        this.activeMidiNotes.add(ev.note);
        const offAt = songStart + (ev.time + (ev.dur || 600)) / 1000;
        noteScheduler.noteOff(ev.note, offAt, "demo-" + song.id);

        // Visual key lighting aligned to the audible moment (wall clock approx)
        const onDelay = Math.max(0, (at - ctx.currentTime) * 1000);
        const visTimer = setTimeout(
          () => {
            if (!this.isPlaying || this.currentSong !== song.id) return;
            this.emitKeyVisual([ev.note], true, ev.vel);
          },
          Math.max(0, onDelay - 12),
        );
        this.timers.push(visTimer);

        const offDelay = Math.max(0, (offAt - ctx.currentTime) * 1000);
        const visOffTimer = setTimeout(
          () => {
            if (!this.isPlaying || this.currentSong !== song.id) return;
            this.activeMidiNotes.delete(ev.note);
            this.emitKeyVisual([ev.note], false, 0);
          },
          Math.max(0, offDelay - 12),
        );
        this.timers.push(visOffTimer);
      }
    });

    noteScheduler.start();

    this.progressInterval = setInterval(() => {
      if (!this.isPlaying) return;
      const elapsed = ((ctx ? ctx.currentTime : 0) - this.startTime) * 1000;
      if (elapsed >= song.durationMs) {
        this.stop();
        return;
      }
      this.updateProgress(song.id, elapsed, song.durationMs);
    }, 100);

    this.updateProgress(song.id, 0, song.durationMs);
  }

  stop() {
    this.isPlaying = false;
    this.clearTimers();
    if (this.currentSong) {
      noteScheduler.discard("demo-" + this.currentSong);
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    for (const note of this.activeMidiNotes) {
      try {
        multiLayerEngine.noteOff(note);
      } catch (e) {}
      this.emitKeyVisual([note], false, 0);
    }
    this.activeMidiNotes.clear();
    try {
      multiLayerEngine.setSustainPedal(false);
      multiLayerEngine.panic();
    } catch (e) {}

    this.updateButtons();
    if (this.currentSong) {
      this.updateProgress(this.currentSong, 0, 30000);
    }
  }

  clearTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }

  updateButtons() {
    DEMO_SONGS.forEach((song) => {
      const btn = this.container.querySelector(`#demo-play-${song.id}`);
      if (!btn) return;
      const isThisSong = this.isPlaying && this.currentSong === song.id;
      btn.innerText = isThisSong ? "⏹ STOP" : "▶ PLAY";
      btn.classList.toggle("playing", isThisSong);
    });
  }

  updateProgress(songId, elapsed, durationMs) {
    const fill = this.container.querySelector(`#demo-progress-${songId}`);
    if (!fill) return;
    const pct = Math.min(100, (elapsed / durationMs) * 100);
    fill.style.width = `${pct}%`;
  }

  emitKeyVisual(notes, pressed, velocity = 95) {
    try {
      window.dispatchEvent(
        new CustomEvent("wilsonix-keys-visual", {
          detail: { notes, pressed, velocity },
        }),
      );
    } catch (e) {}
  }
}
