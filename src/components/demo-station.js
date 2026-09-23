/**
 * Demo Station - 30-Second Song Clip Player & Interactive Practice Studio
 * Live interactive playback through the MIDIKey engine (pedal + note events),
 * driving both the audible engine and the on-screen key visual bridge.
 * Features an integrated Synthesia-style interactive piano tutor canvas.
 */

import { DEMO_SONGS } from "../audio/demo-songs/index.js";
import { MidiConverterEngine } from "../audio/midi-converter-engine.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";
import { audioCore } from "../audio/audio-core.js";
import { noteScheduler } from "../audio/lookahead-scheduler.js";
import { escapeHtml } from "../utils/escape-html.js";
import { PianoTutorCanvas } from "./piano-tutor-canvas.js";

export class DemoStationUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentSong = null;
    this.isPlaying = false;
    this._isStarting = false;
    this.startTime = 0;
    this.timers = [];
    this.progressInterval = null;
    this.activeMidiNotes = new Set();
    this.searchQuery = "";
    this.volume = 0.70;
    this.customSongs = this.loadCustomSongs();

    // Interactive Practice Studio
    this.tutorCanvas = null;
    this.isPracticing = false;
    this.currentPracticeSong = null;
    this._unsubNoteHook = null;

    this.render();
    this.renderList();
    this.bindEvents();

    if (typeof multiLayerEngine?.registerPanicHook === "function") {
      multiLayerEngine.registerPanicHook(() => {
        this.stop(false);
        this.exitPractice();
      });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("wilsonix:panic", () => {
        this.stop(false);
        this.exitPractice();
      });
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
        <!-- Main Demo Song List View -->
        <div class="demo-main-view" id="demo-main-view">
          <div class="demo-station-header">
            <div class="station-title-group">
              <span class="station-badge">🎬 DEMO STATION</span>
              <span class="genre-tag">INTERACTIVE SONG CLIPS & LEARNING</span>
            </div>
            <span class="demo-hint">Listen to stage clips or hit 🎓 PRACTICE to learn notes with falling visuals!</span>
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

        <!-- Interactive Practice Studio Deck (Hidden until PRACTICE clicked) -->
        <div class="tutor-deck-container" id="tutor-deck-container" style="display:none;"></div>
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
          <button class="demo-station-practice-btn" id="demo-practice-${song.id}" title="Learn and practice this song interactively">
            🎓 PRACTICE
          </button>
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

    // Bind play and practice buttons
    filtered.forEach((song) => {
      const playBtn = list.querySelector(`#demo-play-${song.id}`);
      playBtn?.addEventListener("click", () => {
        if (this.isPlaying && this.currentSong === song.id) {
          this.stop();
        } else {
          this.play(song);
        }
      });

      const pracBtn = list.querySelector(`#demo-practice-${song.id}`);
      pracBtn?.addEventListener("click", () => {
        this.startPractice(song);
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
    if (this.isPracticing && this.currentPracticeSong?.id === id) {
      this.exitPractice();
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

  // =========================================================================
  // INTERACTIVE PRACTICE & LEARNING STUDIO METHODS
  // =========================================================================

  startPractice(song) {
    if (!song) return;
    if (this.isPlaying) {
      this.stop();
    }
    this.isPracticing = true;
    this.currentPracticeSong = song;

    // 1. Prepare stage audio rig for the song preset
    try {
      const ctx = audioCore.init();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      audioCore.unlock();
      multiLayerEngine.init();
      multiLayerEngine.toggleCombiMode(true);
      multiLayerEngine.setCombiPreset(song.combi);
      if (audioCore.fxRack && song.fxPreset) {
        audioCore.fxRack.applyPreset(song.fxPreset);
      }
    } catch (e) {
      console.warn("Practice audio preset setup:", e);
    }

    // 2. Switch views
    const mainView = this.container.querySelector("#demo-main-view");
    const tutorDeck = this.container.querySelector("#tutor-deck-container");
    if (mainView) mainView.style.display = "none";
    if (tutorDeck) {
      tutorDeck.style.display = "flex";
      this.renderPracticeDeck(song);
    }

    // 3. Initialize canvas
    const canvas = this.container.querySelector("#tutor-falling-canvas");
    const keyboardContainer = document.getElementById("piano-roll-container");

    if (this.tutorCanvas) {
      this.tutorCanvas.dispose();
    }

    this.tutorCanvas = new PianoTutorCanvas(canvas, keyboardContainer, {
      engine: multiLayerEngine,
      mode: "wait",
      speed: 1.0,
      hand: "both",
      onScoreUpdate: (stats) => this.updateTutorStats(stats),
      onSongComplete: (stats) => this.handleTutorComplete(stats),
      onWaitNotesChange: (notes) => this.updateTargetPrompt(notes),
    });

    // 4. Hook note triggers from all sources (USB MIDI, virtual keyboard, QWERTY)
    if (typeof multiLayerEngine.registerNoteHook === "function") {
      if (this._unsubNoteHook) this._unsubNoteHook();
      this._unsubNoteHook = multiLayerEngine.registerNoteHook((note, pressed, vel) => {
        if (this.tutorCanvas) {
          this.tutorCanvas.handleUserNote(note, pressed);
        }
      });
    }

    // 5. Load and start song
    this.tutorCanvas.loadSong(song);
    this.tutorCanvas.start();
  }

  exitPractice() {
    if (!this.isPracticing && !this.tutorCanvas) return;
    this.isPracticing = false;
    this.currentPracticeSong = null;

    if (this._unsubNoteHook) {
      this._unsubNoteHook();
      this._unsubNoteHook = null;
    }
    if (this.tutorCanvas) {
      this.tutorCanvas.dispose();
      this.tutorCanvas = null;
    }

    const mainView = this.container.querySelector("#demo-main-view");
    const tutorDeck = this.container.querySelector("#tutor-deck-container");
    if (mainView) mainView.style.display = "";
    if (tutorDeck) {
      tutorDeck.style.display = "none";
      tutorDeck.innerHTML = "";
    }
  }

  renderPracticeDeck(song) {
    const deck = this.container.querySelector("#tutor-deck-container");
    if (!deck) return;

    deck.innerHTML = `
      <div class="tutor-header-bar">
        <button class="tutor-back-btn" id="tutor-exit-btn" title="Back to song list">
          ◀ BACK TO SONGS
        </button>
        <div class="tutor-song-badge-group">
          <span class="tutor-badge">🎓 INTERACTIVE TUTOR</span>
          <span class="tutor-song-title">${escapeHtml(song.title)}</span>
          <span class="tutor-song-sub">${escapeHtml(song.subtitle || "")}</span>
        </div>
        <div class="tutor-target-prompt" id="tutor-target-prompt">
          <span class="tutor-prompt-label">TARGET NOTE:</span>
          <span class="tutor-prompt-keys" id="tutor-target-keys-text">Ready</span>
        </div>
      </div>

      <div class="tutor-controls-bar">
        <!-- Mode Selector -->
        <div class="tutor-control-group">
          <span class="tutor-grp-label">MODE:</span>
          <button class="tutor-pill-btn active" id="tutor-mode-wait" title="Pauses at the hit-line until you press the right key">
            ⏸ WAIT FOR KEY
          </button>
          <button class="tutor-pill-btn" id="tutor-mode-flow" title="Plays continuously — hit keys in rhythm">
            ▶ PLAY ALONG
          </button>
        </div>

        <!-- Speed Selector -->
        <div class="tutor-control-group">
          <span class="tutor-grp-label">SPEED:</span>
          <button class="tutor-pill-btn" data-speed="0.5">0.5x</button>
          <button class="tutor-pill-btn" data-speed="0.75">0.75x</button>
          <button class="tutor-pill-btn active" data-speed="1.0">1.0x</button>
        </div>

        <!-- Hand Splitting -->
        <div class="tutor-control-group">
          <span class="tutor-grp-label">HAND:</span>
          <button class="tutor-pill-btn active" data-hand="both" title="Practice both hands">BOTH</button>
          <button class="tutor-pill-btn" data-hand="right" title="Practice right hand melody (>= C4)">RIGHT</button>
          <button class="tutor-pill-btn" data-hand="left" title="Practice left hand bass (< C4)">LEFT</button>
        </div>

        <!-- Score & Streak HUD -->
        <div class="tutor-stats-hud">
          <div class="tutor-stat-item">
            <span class="tutor-stat-val text-green" id="tutor-stat-accuracy">100%</span>
            <span class="tutor-stat-lbl">ACCURACY</span>
          </div>
          <div class="tutor-stat-item">
            <span class="tutor-stat-val text-orange" id="tutor-stat-streak">0</span>
            <span class="tutor-stat-lbl">STREAK 🔥</span>
          </div>
          <div class="tutor-stat-item">
            <span class="tutor-stat-val text-cyan" id="tutor-stat-score">0</span>
            <span class="tutor-stat-lbl">SCORE</span>
          </div>
        </div>

        <!-- Transport -->
        <div class="tutor-transport-group">
          <button class="tutor-transport-btn" id="tutor-pause-btn" title="Pause / Resume">⏸ PAUSE</button>
          <button class="tutor-transport-btn" id="tutor-restart-btn" title="Restart from beginning">🔄 RESTART</button>
        </div>
      </div>

      <div class="tutor-canvas-wrapper" id="tutor-canvas-wrapper">
        <canvas id="tutor-falling-canvas" class="tutor-falling-canvas"></canvas>
      </div>
    `;

    // 1. Back button
    deck.querySelector("#tutor-exit-btn")?.addEventListener("click", () => this.exitPractice());

    // 2. Mode buttons
    const btnWait = deck.querySelector("#tutor-mode-wait");
    const btnFlow = deck.querySelector("#tutor-mode-flow");
    btnWait?.addEventListener("click", () => {
      btnWait.classList.add("active");
      btnFlow?.classList.remove("active");
      if (this.tutorCanvas) this.tutorCanvas.setMode("wait");
    });
    btnFlow?.addEventListener("click", () => {
      btnFlow.classList.add("active");
      btnWait?.classList.remove("active");
      if (this.tutorCanvas) this.tutorCanvas.setMode("flow");
    });

    // 3. Speed buttons
    deck.querySelectorAll("[data-speed]").forEach((btn) => {
      btn.addEventListener("click", () => {
        deck.querySelectorAll("[data-speed]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const speed = parseFloat(btn.getAttribute("data-speed")) || 1.0;
        if (this.tutorCanvas) this.tutorCanvas.setSpeed(speed);
      });
    });

    // 4. Hand buttons
    deck.querySelectorAll("[data-hand]").forEach((btn) => {
      btn.addEventListener("click", () => {
        deck.querySelectorAll("[data-hand]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const hand = btn.getAttribute("data-hand") || "both";
        if (this.tutorCanvas) this.tutorCanvas.setHand(hand);
      });
    });

    // 5. Transport buttons
    const pauseBtn = deck.querySelector("#tutor-pause-btn");
    pauseBtn?.addEventListener("click", () => {
      if (!this.tutorCanvas) return;
      if (this.tutorCanvas.isPaused) {
        this.tutorCanvas.resume();
        pauseBtn.innerText = "⏸ PAUSE";
        pauseBtn.classList.remove("paused");
      } else {
        this.tutorCanvas.pause();
        pauseBtn.innerText = "▶ RESUME";
        pauseBtn.classList.add("paused");
      }
    });

    const restartBtn = deck.querySelector("#tutor-restart-btn");
    restartBtn?.addEventListener("click", () => {
      if (this.tutorCanvas) {
        this.tutorCanvas.restart();
        if (pauseBtn) {
          pauseBtn.innerText = "⏸ PAUSE";
          pauseBtn.classList.remove("paused");
        }
      }
    });
  }

  updateTutorStats(stats) {
    const deck = this.container.querySelector("#tutor-deck-container");
    if (!deck) return;

    const accEl = deck.querySelector("#tutor-stat-accuracy");
    const streakEl = deck.querySelector("#tutor-stat-streak");
    const scoreEl = deck.querySelector("#tutor-stat-score");

    if (accEl) accEl.textContent = `${stats.accuracy}%`;
    if (streakEl) streakEl.textContent = `${stats.streak}`;
    if (scoreEl) scoreEl.textContent = `${stats.score}`;
  }

  updateTargetPrompt(notes) {
    const el = this.container.querySelector("#tutor-target-keys-text");
    if (!el) return;
    if (!notes || notes.length === 0) {
      el.textContent = "Great! Rolling...";
      el.classList.remove("active-wait");
    } else {
      const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      const noteNames = notes
        .sort((a, b) => a - b)
        .map((n) => `${names[n % 12]}${Math.floor(n / 12) - 1}`)
        .join(" + ");
      el.textContent = noteNames;
      el.classList.add("active-wait");
    }
  }

  handleTutorComplete(stats) {
    const prompt = this.container.querySelector("#tutor-target-keys-text");
    if (prompt) {
      prompt.textContent = `Completed! Acc: ${stats.accuracy}%, Best Streak: ${stats.bestStreak}`;
    }
  }

  // =========================================================================
  // STANDARD DEMO PLAYER METHODS
  // =========================================================================

  async play(song) {
    if (this.isPracticing) {
      this.exitPractice();
    }
    // Release any previously pinned demo instruments so they can be evicted
    if (this._pinnedDemoInsts && this.pcmEngine && typeof this.pcmEngine.removePinnedInstruments === "function") {
      this.pcmEngine.removePinnedInstruments(this._pinnedDemoInsts);
    }
    this._pinnedDemoInsts = new Set();
    if (this.isPlaying) {
      this.stop();
    }
    console.log("[Demo] play()", song?.id);
    if (this._isStarting) return;
    this._isStarting = true;

    try {
      noteScheduler.queue = noteScheduler.queue.filter(
        (ev) => !String(ev.author).startsWith("demo-"),
      );

      try {
        multiLayerEngine.panic();
      } catch (e) {}

      try {
        const ctx = audioCore.init();
        if (ctx && ctx.state === "suspended") {
          try { await ctx.resume(); } catch (e) {}
        }
        audioCore.unlock();
        multiLayerEngine.init();
        multiLayerEngine.toggleCombiMode(true);
        multiLayerEngine.setCombiPreset(song.combi);
        if (audioCore.fxRack && song.fxPreset) {
          audioCore.fxRack.applyPreset(song.fxPreset);
        }

        const ready = async (promise) => {
          try { await promise; } catch (e) {}
        };
        const allPromises = [];
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
              allPromises.push(ready(pcm.loadSoundfont(inst)));
            } else {
              allPromises.push(ready(pcm.preloadInstrument(inst)));
            }
          });
        }
        const deadline = new Promise((resolve) => setTimeout(resolve, 4500));
        await Promise.race([Promise.all(allPromises), deadline]);
      } catch (e) {
        console.warn("Demo player audio setup:", e);
      }

      this.currentSong = song.id;
      this.isPlaying = true;

      this._pinnedDemoInsts = new Set();
      if (multiLayerEngine.layers) {
        multiLayerEngine.layers.forEach((layer) => {
          if (layer.enabled && layer.inst && !layer.inst.startsWith("va:")) {
            this._pinnedDemoInsts.add(multiLayerEngine.resolveBankKey(layer.inst));
          }
        });
      }
      (song.embeddedInsts || []).forEach((i) => this._pinnedDemoInsts.add(i));
      (song.soundfontInsts || []).forEach((i) => this._pinnedDemoInsts.add(i));
      if (multiLayerEngine.pcmEngine && typeof multiLayerEngine.pcmEngine.addPinnedInstruments === "function") {
        multiLayerEngine.pcmEngine.addPinnedInstruments(this._pinnedDemoInsts);
      }

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
      console.log("[Demo] play() scheduled", song.events.length, "events");
    } catch (e) {
      console.error("[Demo] play() failed:", e);
    } finally {
      this._isStarting = false;
    }
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

      if (this._pinnedDemoInsts && multiLayerEngine.pcmEngine && typeof multiLayerEngine.pcmEngine.removePinnedInstruments === "function") {
        multiLayerEngine.pcmEngine.removePinnedInstruments(this._pinnedDemoInsts);
        this._pinnedDemoInsts = null;
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
