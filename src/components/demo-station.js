/**
 * Demo Station - 30-Second Song Clip Player
 * Live interactive playback through the MIDIKey engine (pedal + note events),
 * driving both the audible engine and the on-screen key visual bridge.
 */

import { DEMO_SONGS } from "../audio/demo-songs/index.js";
import { MidiConverterEngine } from "../audio/midi-converter-engine.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";
import { audioCore } from "../audio/audio-core.js";
import { noteScheduler } from "../audio/lookahead-scheduler.js";
import { escapeHtml } from "../utils/escape-html.js";

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
    this.volume = 0.70;
    this.customSongs = this.loadCustomSongs();

    this.render();
    this.renderList();
    this.bindEvents();

    if (typeof multiLayerEngine?.registerPanicHook === "function") {
      multiLayerEngine.registerPanicHook(() => this.stop(false));
    }
    if (typeof window !== "undefined") {
      window.addEventListener("wilsonix:panic", () => this.stop(false));
    }
  }

  loadCustomSongs() {
    try {
      const saved = localStorage.getItem("wilsonix_custom_demo_songs");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  saveCustomSongs() {
    try {
      localStorage.setItem("wilsonix_custom_demo_songs", JSON.stringify(this.customSongs));
    } catch (e) {}
  }

  get allSongs() {
    return [...this.customSongs, ...DEMO_SONGS];
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="demo-station-card" id="demo-station-card">
        <div class="demo-station-header">
          <div class="station-title-group">
            <span class="station-badge">🎬 DEMO STATION</span>
            <span class="genre-tag">INTERACTIVE SONG CLIPS</span>
          </div>
          <span class="demo-hint">Clips play live on the current stage rig — watch the keys!</span>
        </div>
        <div class="demo-toolbar">
          <div class="demo-search-wrap">
            <input type="text" class="demo-search-input" id="demo-search" placeholder="Search songs..." value="" autocomplete="off" />
            <div class="demo-volume-control">
              <span class="demo-vol-icon">🔉</span>
              <span class="demo-vol-label">VOL</span>
              <input type="range" class="demo-vol-slider" id="demo-volume-slider" min="15" max="100" value="70" title="Demo playback volume" />
              <span class="demo-vol-pct" id="demo-vol-pct">70%</span>
            </div>
          </div>
          <div class="demo-actions-bar">
            <button class="demo-import-btn" id="demo-import-midi-btn" title="Convert and play any standard .mid or .midi file">
              ➕ IMPORT MIDI FILE
            </button>
            <input type="file" id="demo-midi-file-input" accept=".mid,.midi" style="display:none" />
            <span class="demo-drop-hint">or drop any .mid here</span>
          </div>
        </div>
        <div class="demo-song-list" id="demo-song-list"></div>
      </div>
    `;
  }

  renderList() {
    const list = this.container.querySelector("#demo-song-list");
    if (!list) return;

    const q = this.searchQuery.toLowerCase().trim();
    const songs = this.allSongs;
    const filtered = q
      ? songs.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.subtitle.toLowerCase().includes(q),
        )
      : songs;

    list.innerHTML = filtered
      .map(
        (song) => `
      <div class="demo-song-row ${song.isCustom ? "demo-custom-row" : ""}" data-song="${song.id}">
        <div class="demo-song-label">
          <div class="demo-title-line">
            <span class="demo-song-title">${escapeHtml(song.title)}</span>
            ${song.isCustom ? '<span class="demo-custom-badge">USER MIDI</span>' : ""}
          </div>
          <span class="demo-song-subtitle">${escapeHtml(song.subtitle)}</span>
        </div>
        <div class="demo-song-controls">
          <div class="demo-progress-track">
            <div class="demo-progress-fill" id="demo-progress-${song.id}"></div>
          </div>
          <button class="demo-station-play-btn" id="demo-play-${song.id}" title="Play demo clip">
            ▶ PLAY
          </button>
          ${
            song.isCustom
              ? `<button class="demo-song-delete-btn" data-delete-id="${song.id}" title="Remove custom song">✕</button>`
              : ""
          }
        </div>
      </div>
    `,
      )
      .join("");

    // Bind play buttons
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

    // Bind delete buttons for custom songs
    list.querySelectorAll(".demo-song-delete-btn").forEach((delBtn) => {
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = delBtn.getAttribute("data-delete-id");
        if (id) this.deleteCustomSong(id);
      });
    });
  }

  deleteCustomSong(id) {
    if (this.isPlaying && this.currentSong === id) {
      this.stop();
    }
    this.customSongs = this.customSongs.filter((s) => s.id !== id);
    this.saveCustomSongs();
    this.renderList();
  }

  bindEvents() {
    const searchInput = this.container.querySelector("#demo-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value;
        this.renderList();
      });
    }

    const volSlider = this.container.querySelector("#demo-volume-slider");
    const volPct = this.container.querySelector("#demo-vol-pct");
    if (volSlider) {
      volSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10) || 70;
        this.volume = val / 100;
        if (volPct) volPct.textContent = `${val}%`;
      });
    }

    const importBtn = this.container.querySelector("#demo-import-midi-btn");
    const fileInput = this.container.querySelector("#demo-midi-file-input");
    if (importBtn && fileInput) {
      importBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          this.handleMidiFile(file);
          fileInput.value = "";
        }
      });
    }

    // Drag-and-drop MIDI file onto card
    const card = this.container.querySelector("#demo-station-card");
    if (card) {
      ["dragenter", "dragover"].forEach((eventName) => {
        card.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          card.classList.add("drag-over");
        });
      });
      ["dragleave", "drop"].forEach((eventName) => {
        card.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          card.classList.remove("drag-over");
        });
      });
      card.addEventListener("drop", (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file) this.handleMidiFile(file);
      });
    }
  }

  async handleMidiFile(file) {
    if (!file || !file.name.match(/\.(mid|midi)$/i)) {
      alert("Please choose or drop a valid .mid or .midi file.");
      return;
    }

    try {
      const song = await MidiConverterEngine.fromFile(file, {
        combi: "clean_electric_piano",
        mode: "30s",
        velocityScale: 0.80,
        stripPedal: true,
      });

      this.customSongs.unshift(song);
      this.saveCustomSongs();
      this.renderList();
      this.play(song);
    } catch (err) {
      console.error("MIDI conversion error:", err);
      alert(`Could not convert MIDI file: ${err.message}`);
    }
  }

  async play(song) {
    if (this.isPlaying) {
      this.stop();
    }

    // Nuclear cleanup: discard ALL demo authors to prevent bleed from previous songs
    // (discard only removes queued events; already-dispatched noteOffs still fire)
    noteScheduler.queue = noteScheduler.queue.filter(
      ev => !String(ev.author).startsWith("demo-")
    );

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

      // Fire-and-forget preloads - don't block UI thread
      if (multiLayerEngine.pcmEngine) {
        const pcm = multiLayerEngine.pcmEngine;
        const insts = [];
        if (multiLayerEngine.layers) {
          multiLayerEngine.layers.forEach((layer) => {
            if (layer.enabled && layer.inst && !layer.inst.startsWith("va:")) {
              insts.push(multiLayerEngine.resolveBankKey(layer.inst));
            }
          });
        }
        (song.embeddedInsts || []).forEach((inst) => insts.push(inst));
        (song.soundfontInsts || []).forEach((inst) => insts.push(inst));
        const unique = [...new Set(insts)];
        unique.forEach((inst) => {
          if (inst.startsWith("soundfont:") || inst.endsWith("-mp3")) {
            pcm.loadSoundfont(inst).catch(() => {});
          } else {
            pcm.preloadInstrument(inst).catch(() => {});
          }
        });
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

    const volRatio = typeof this.volume === "number" ? this.volume : 0.70;

    song.events.forEach((ev) => {
      if (ev.type === "pedal") {
        const at = songStart + ev.time / 1000;
        noteScheduler.pedal(ev.down, at, "demo-" + song.id);
      } else if (ev.note) {
        const at = songStart + ev.time / 1000;
        const scaledVel = Math.max(1, Math.min(127, Math.round((ev.vel || 80) * volRatio)));
        noteScheduler.noteOn(ev.note, scaledVel, at, "demo-" + song.id);
        this.activeMidiNotes.add(ev.note);
        const offAt = songStart + (ev.time + (ev.dur || 600)) / 1000;
        noteScheduler.noteOff(ev.note, offAt, "demo-" + song.id);
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

  stop(triggerEnginePanic = true) {
    if (this._isStopping) return;
    this._isStopping = true;
    try {
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
      this.emitKeyVisual([], false, 0);

      if (triggerEnginePanic) {
        try {
          multiLayerEngine.setSustainPedal(false);
          multiLayerEngine.panic();
        } catch (e) {}
      }

      this.updateButtons();
      if (this.currentSong) {
        this.updateProgress(this.currentSong, 0, 30000);
      }
    } finally {
      this._isStopping = false;
    }
  }

  clearTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }

  updateButtons() {
    this.allSongs.forEach((song) => {
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
