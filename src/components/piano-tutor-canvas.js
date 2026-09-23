/**
 * Wilsonix MIDIKey - Studio Interactive Piano Tutor Canvas
 * High-performance 2D canvas Synthesia-style falling notes visualizer and trainer.
 *
 * Features:
 * - Single-canvas zero-DOM architecture (60/120 FPS fluid rendering, 0 layout thrashing)
 * - Cached key geometry lookups (0 getBoundingClientRect calls during animation)
 * - Auto-aligns with virtual keyboard key coordinates (white and black key columns)
 * - "Wait For Key" Beginner Mode: pauses time at the hit-line until target notes are played
 * - "Play Along" Flow Mode: continuous practice with adjustable speed (0.5x, 0.75x, 1.0x)
 * - Hand splitting: Both Hands, Right Hand Only (>= C4), Left Hand Only (< C4)
 * - Auto-accompaniment for non-practiced hand
 * - Live scoring: Hit/Miss detection, accuracy percentage, and combo streak counter
 * - Instant disposal: cancels animation loops and releases memory on close (0% background CPU)
 */


export class PianoTutorCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} [keyboardContainer] - The #piano-roll-container element
   * @param {Object} [options]
   */
  constructor(canvas, keyboardContainer, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.keyboardContainer = keyboardContainer || (typeof document !== "undefined" ? document.getElementById("piano-roll-container") : null);
    this.engine = options.engine || null;

    this.song = null;
    this.events = [];
    this.accompanimentEvents = [];
    this.activeAccompanimentNotes = new Set();

    this.mode = options.mode || "wait"; // "wait" | "flow"
    this.speed = options.speed || 1.0;
    this.hand = options.hand || "both"; // "both" | "right" | "left"

    this.currentTimeMs = 0;
    this.durationMs = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.isWaitingForKey = false;
    this.pendingWaitNotes = new Set(); // MIDI notes waiting to be pressed

    // Pre-cached key geometries for 0-DOM overhead in 60fps loop
    this._keyGeometries = new Map();

    // Note velocity / time window
    this.pixelsPerSecond = 240; // speed of falling notes
    this.hitLineY = 0; // calculated on resize

    // Scoring & Stats
    this.stats = {
      hits: 0,
      misses: 0,
      streak: 0,
      bestStreak: 0,
      accuracy: 100,
      score: 0,
      lastRating: "",
    };

    // Hit effects animation pool
    this.hitEffects = []; // { x, y, width, color, radius, alpha }

    // Handlers & loop
    this.animId = null;
    this.lastFrameTime = 0;
    this._onScoreUpdate = options.onScoreUpdate || null;
    this._onSongComplete = options.onSongComplete || null;
    this._onWaitNotesChange = options.onWaitNotesChange || null;

    this.resize = this.resize.bind(this);
    this.updateKeyGeometries = this.updateKeyGeometries.bind(this);
    this._loop = this._loop.bind(this);
    this.handleUserNote = this.handleUserNote.bind(this);

    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.resize, { passive: true });
    }
    if (this.keyboardContainer) {
      this.keyboardContainer.addEventListener("scroll", this.updateKeyGeometries, { passive: true });
    }

    this.resize();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    const w = Math.max(300, Math.floor(rect.width || this.canvas.parentElement?.clientWidth || 800));
    const h = Math.max(160, Math.floor(rect.height || this.canvas.parentElement?.clientHeight || 260));

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvasWidth = w;
    this.canvasHeight = h;
    this.dpr = dpr;

    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }
    this.hitLineY = h - 22; // 22px above bottom border
    this.updateKeyGeometries();
  }

  /**
   * Pre-caches geometric positions of all 88 keys to guarantee 0 layout reflows in loop
   */
  updateKeyGeometries() {
    this._keyGeometries.clear();
    const container = this.keyboardContainer || (typeof document !== "undefined" ? document.getElementById("piano-roll-container") : null);
    const containerRect = container ? container.getBoundingClientRect() : null;

    const w = this.canvasWidth || 800;
    const whiteKeyWidth = w / 52;

    for (let m = 21; m <= 108; m++) {
      const el = typeof document !== "undefined" ? document.getElementById(`key-midi-${m}`) : null;
      if (el && containerRect) {
        const elRect = el.getBoundingClientRect();
        this._keyGeometries.set(m, {
          x: elRect.left - containerRect.left,
          width: elRect.width,
          isBlack: el.classList.contains("black-key"),
        });
      } else {
        const isBlack = [1, 3, 6, 8, 10].includes(m % 12);
        const approxX = ((m - 21) / 88) * w;
        this._keyGeometries.set(m, {
          x: approxX,
          width: isBlack ? whiteKeyWidth * 0.65 : whiteKeyWidth,
          isBlack,
        });
      }
    }
  }

  /**
   * Fast O(1) key geometry lookup
   * @param {number} midiNote
   */
  _getKeyGeometry(midiNote) {
    let geom = this._keyGeometries.get(midiNote);
    if (!geom) {
      const isBlack = [1, 3, 6, 8, 10].includes(midiNote % 12);
      const approxX = ((midiNote - 21) / 88) * (this.canvasWidth || 800);
      geom = {
        x: approxX,
        width: (this.canvasWidth || 800) / 52,
        isBlack,
      };
      this._keyGeometries.set(midiNote, geom);
    }
    return geom;
  }

  /**
   * Load and prepare a song for interactive practice
   * @param {Object} song
   */
  loadSong(song) {
    if (!song) return;
    this.song = song;
    this.durationMs = song.durationMs || 30000;
    this.currentTimeMs = 0;
    this.isWaitingForKey = false;
    this.pendingWaitNotes.clear();
    this.hitEffects = [];
    this._stopAllAccompanimentNotes();
    this.resetStats();

    // Clone and sort events by time
    const rawEvents = (song.events || []).filter(e => e.note).slice().sort((a, b) => a.time - b.time);

    // Filter events into practiced events vs background accompaniment
    this.events = [];
    this.accompanimentEvents = [];

    rawEvents.forEach((e) => {
      const isRight = e.note >= 60;
      let isPracticed = true;
      if (this.hand === "right" && !isRight) isPracticed = false;
      if (this.hand === "left" && isRight) isPracticed = false;

      const normEvent = {
        time: e.time,
        note: e.note,
        vel: e.vel || 90,
        dur: Math.max(120, e.dur || 300),
        hit: false,
        missed: false,
        triggeredAccomp: false,
      };

      if (isPracticed) {
        this.events.push(normEvent);
      } else {
        this.accompanimentEvents.push(normEvent);
      }
    });

    if (rawEvents.length > 0) {
      const last = rawEvents[rawEvents.length - 1];
      this.durationMs = Math.max(this.durationMs, last.time + (last.dur || 300) + 1200);
    }

    this.updateKeyGeometries();
  }

  setMode(mode) {
    this.mode = mode === "flow" ? "flow" : "wait";
    this.isWaitingForKey = false;
    this.pendingWaitNotes.clear();
    this._clearKeyboardGuides();
  }

  setSpeed(speed) {
    this.speed = Math.max(0.25, Math.min(2.0, Number(speed) || 1.0));
  }

  setHand(hand) {
    this.hand = hand;
    if (this.song) {
      const cur = this.currentTimeMs;
      this.loadSong(this.song);
      this.currentTimeMs = cur;
    }
  }

  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      streak: 0,
      bestStreak: 0,
      accuracy: 100,
      score: 0,
      lastRating: "",
    };
    if (this._onScoreUpdate) this._onScoreUpdate(this.stats);
  }

  start() {
    this.isPlaying = true;
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = requestAnimationFrame(this._loop);
  }

  pause() {
    this.isPaused = true;
    this._stopAllAccompanimentNotes();
  }

  resume() {
    if (!this.isPlaying) {
      this.start();
      return;
    }
    this.isPaused = false;
    this.lastFrameTime = performance.now();
  }

  restart() {
    if (this.song) {
      this.loadSong(this.song);
      this.start();
    }
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.isWaitingForKey = false;
    this.pendingWaitNotes.clear();
    this._stopAllAccompanimentNotes();
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this._clearKeyboardGuides();
  }

  dispose() {
    this.stop();
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.resize);
    }
    if (this.keyboardContainer) {
      this.keyboardContainer.removeEventListener("scroll", this.updateKeyGeometries);
    }
    this.canvas = null;
    this.ctx = null;
    this.song = null;
    this.events = [];
    this.accompanimentEvents = [];
    this.hitEffects = [];
    this._keyGeometries.clear();
    this._onScoreUpdate = null;
    this._onSongComplete = null;
    this._onWaitNotesChange = null;
  }

  /**
   * User pressed a key (via USB MIDI keyboard, virtual keyboard, or QWERTY)
   * @param {number} midiNote
   * @param {boolean} isPressed
   */
  handleUserNote(midiNote, isPressed) {
    if (!this.isPlaying || !isPressed) return;

    // 1. "Wait For Key" Mode check:
    if (this.mode === "wait" && this.isWaitingForKey) {
      if (this.pendingWaitNotes.has(midiNote)) {
        this.pendingWaitNotes.delete(midiNote);
        this._recordHit(midiNote, "PERFECT");

        // Mark corresponding note event as hit
        for (const ev of this.events) {
          if (!ev.hit && ev.note === midiNote && Math.abs(ev.time - this.currentTimeMs) <= 350) {
            ev.hit = true;
            break;
          }
        }

        if (this.pendingWaitNotes.size === 0) {
          this.isWaitingForKey = false;
          this._clearKeyboardGuides();
        } else {
          this._highlightKeyboardGuides(this.pendingWaitNotes);
        }

        if (this._onWaitNotesChange) {
          this._onWaitNotesChange(Array.from(this.pendingWaitNotes));
        }
        return;
      }
    }

    // 2. "Play Along" Flow Mode check:
    if (this.mode === "flow") {
      // Find closest un-hit note for this pitch within tolerance window (±160ms * speed)
      const hitWindow = 160 * this.speed;
      let closest = null;
      let minDiff = Infinity;

      for (const ev of this.events) {
        if (ev.hit || ev.missed) continue;
        if (ev.note === midiNote) {
          const diff = Math.abs(ev.time - this.currentTimeMs);
          if (diff < hitWindow && diff < minDiff) {
            minDiff = diff;
            closest = ev;
          }
        }
      }

      if (closest) {
        closest.hit = true;
        const rating = minDiff <= 65 ? "PERFECT" : "GOOD";
        this._recordHit(midiNote, rating);
      }
    }
  }

  _recordHit(midiNote, rating = "PERFECT") {
    this.stats.hits++;
    this.stats.streak++;
    if (this.stats.streak > this.stats.bestStreak) {
      this.stats.bestStreak = this.stats.streak;
    }
    const bonus = rating === "PERFECT" ? 100 : 70;
    this.stats.score += bonus + Math.min(50, this.stats.streak * 5);
    const total = this.stats.hits + this.stats.misses;
    this.stats.accuracy = total > 0 ? Math.round((this.stats.hits / total) * 100) : 100;
    this.stats.lastRating = rating;

    // Spawn hit visual ripple effect
    const geom = this._getKeyGeometry(midiNote);
    if (geom) {
      this.hitEffects.push({
        x: geom.x + geom.width / 2,
        y: this.hitLineY,
        width: geom.width,
        color: midiNote >= 60 ? "#10b981" : "#a855f7",
        radius: 6,
        alpha: 1.0,
      });
    }

    if (this._onScoreUpdate) this._onScoreUpdate(this.stats);
  }

  _recordMiss(midiNote) {
    this.stats.misses++;
    this.stats.streak = 0;
    const total = this.stats.hits + this.stats.misses;
    this.stats.accuracy = total > 0 ? Math.round((this.stats.hits / total) * 100) : 100;
    this.stats.lastRating = "MISS";
    if (this._onScoreUpdate) this._onScoreUpdate(this.stats);
  }

  _highlightKeyboardGuides(notes) {
    if (typeof document === "undefined") return;
    this._clearKeyboardGuides();
    for (const note of notes) {
      const el = document.getElementById(`key-midi-${note}`);
      if (el) el.classList.add("tutor-target-key");
    }
  }

  _clearKeyboardGuides() {
    if (typeof document === "undefined") return;
    const els = document.querySelectorAll(".tutor-target-key");
    els.forEach((el) => el.classList.remove("tutor-target-key"));
  }

  _stopAllAccompanimentNotes() {
    for (const note of this.activeAccompanimentNotes) {
      if (this.engine) {
        try {
          this.engine.noteOff(note);
        } catch (e) {}
      }
    }
    this.activeAccompanimentNotes.clear();
  }

  _triggerAccompanimentAt(currentTime) {
    if (this.accompanimentEvents.length === 0) return;

    for (let i = 0; i < this.accompanimentEvents.length; i++) {
      const ev = this.accompanimentEvents[i];
      if (!ev.triggeredAccomp && ev.time <= currentTime) {
        ev.triggeredAccomp = true;
        if (this.engine) {
          try {
            this.engine.noteOn(ev.note, Math.round(ev.vel * 0.75));
            this.activeAccompanimentNotes.add(ev.note);
            setTimeout(() => {
              try {
                this.engine.noteOff(ev.note);
                this.activeAccompanimentNotes.delete(ev.note);
              } catch (e) {}
            }, Math.max(100, ev.dur));
          } catch (e) {}
        }
      }
    }
  }

  _loop(now) {
    if (!this.isPlaying) return;

    const deltaMs = Math.min(80, now - this.lastFrameTime);
    this.lastFrameTime = now;

    if (!this.isPaused) {
      // 1. In Wait mode, check if any notes have reached the hit-line
      if (this.mode === "wait") {
        if (!this.isWaitingForKey) {
          const waitThreshold = 30; // ms before hit line to pause
          const dueNotes = new Set();
          for (const ev of this.events) {
            if (!ev.hit && !ev.missed && ev.time <= this.currentTimeMs + waitThreshold && ev.time >= this.currentTimeMs - 140) {
              dueNotes.add(ev.note);
            }
          }

          if (dueNotes.size > 0) {
            this.isWaitingForKey = true;
            this.pendingWaitNotes = dueNotes;
            this._highlightKeyboardGuides(dueNotes);
            if (this._onWaitNotesChange) {
              this._onWaitNotesChange(Array.from(dueNotes));
            }
          } else {
            this.currentTimeMs += deltaMs * this.speed;
            this._triggerAccompanimentAt(this.currentTimeMs);
          }
        }
      } else {
        // Flow Mode: advance time continuously
        this.currentTimeMs += deltaMs * this.speed;
        this._triggerAccompanimentAt(this.currentTimeMs);

        // Detect missed notes in flow mode
        const missThreshold = 180 * this.speed;
        for (const ev of this.events) {
          if (!ev.hit && !ev.missed && this.currentTimeMs - ev.time > missThreshold) {
            ev.missed = true;
            this._recordMiss(ev.note);
          }
        }
      }

      // Check song completion
      if (this.currentTimeMs >= this.durationMs && !this.isWaitingForKey) {
        this.stop();
        if (this._onSongComplete) this._onSongComplete(this.stats);
        return;
      }
    }

    this._draw();
    this.animId = requestAnimationFrame(this._loop);
  }

  _draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    const hitY = this.hitLineY;

    // 1. Stage background with sleek dark styling
    ctx.clearRect(0, 0, w, h);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#0b0e14");
    bgGrad.addColorStop(0.65, "#10141d");
    bgGrad.addColorStop(1, "#161b26");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Background key track lanes
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let m = 21; m <= 108; m++) {
      const geom = this._getKeyGeometry(m);
      if (geom && geom.x >= -geom.width && geom.x <= w + geom.width) {
        if (geom.isBlack) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
          ctx.fillRect(geom.x, 0, geom.width, hitY);
        }
        ctx.beginPath();
        ctx.moveTo(geom.x, 0);
        ctx.lineTo(geom.x, hitY);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 3. Falling Notes Stream
    const lookaheadMs = (hitY / this.pixelsPerSecond) * 1000;
    const minVisibleTime = this.currentTimeMs - 1200;
    const maxVisibleTime = this.currentTimeMs + lookaheadMs;

    // Render both active hand and ghost accompaniment notes
    const allRenderEvents = [...this.events, ...this.accompanimentEvents];

    for (let i = 0; i < allRenderEvents.length; i++) {
      const ev = allRenderEvents[i];
      if (ev.time + ev.dur < minVisibleTime || ev.time > maxVisibleTime) continue;

      const geom = this._getKeyGeometry(ev.note);
      if (!geom || geom.x < -geom.width - 20 || geom.x > w + 20) continue;

      // Distance from hit line
      const msUntilHit = ev.time - this.currentTimeMs;
      const noteY = hitY - (msUntilHit / 1000) * this.pixelsPerSecond;
      const noteHeight = Math.max(14, (ev.dur / 1000) * this.pixelsPerSecond);
      const topY = noteY - noteHeight;

      if (topY > h || noteY < -20) continue;

      const isRightHand = ev.note >= 60;
      const isTarget = this.isWaitingForKey && this.pendingWaitNotes.has(ev.note);
      const isAccompaniment = !this.events.includes(ev);

      ctx.save();
      const radius = 4;
      const blockWidth = Math.max(8, geom.width - 3);
      const blockX = geom.x + 1.5;

      // Shadow glow
      if (isTarget) {
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 18;
      } else if (!isAccompaniment) {
        ctx.shadowColor = isRightHand ? "rgba(16, 185, 129, 0.4)" : "rgba(168, 85, 247, 0.4)";
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }

      // Rounded rectangle note gradient
      const noteGrad = ctx.createLinearGradient(0, topY, 0, noteY);
      if (isAccompaniment) {
        noteGrad.addColorStop(0, "rgba(100, 116, 139, 0.25)");
        noteGrad.addColorStop(1, "rgba(71, 85, 105, 0.45)");
      } else if (ev.hit) {
        noteGrad.addColorStop(0, "rgba(52, 211, 153, 0.4)");
        noteGrad.addColorStop(1, "rgba(16, 185, 129, 0.85)");
      } else if (ev.missed) {
        noteGrad.addColorStop(0, "rgba(239, 68, 68, 0.3)");
        noteGrad.addColorStop(1, "rgba(220, 38, 38, 0.65)");
      } else if (isTarget) {
        noteGrad.addColorStop(0, "#fbbf24");
        noteGrad.addColorStop(1, "#f59e0b");
      } else if (isRightHand) {
        noteGrad.addColorStop(0, "#34d399");
        noteGrad.addColorStop(1, "#059669");
      } else {
        noteGrad.addColorStop(0, "#c084fc");
        noteGrad.addColorStop(1, "#7c3aed");
      }

      ctx.fillStyle = noteGrad;
      this._roundRect(ctx, blockX, topY, blockWidth, noteHeight, radius);
      ctx.fill();

      // Border stroke
      ctx.strokeStyle = isTarget ? "#ffffff" : isAccompaniment ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = isTarget ? 2 : 1;
      this._roundRect(ctx, blockX, topY, blockWidth, noteHeight, radius);
      ctx.stroke();

      // Pitch name label
      if (noteHeight >= 20 && blockWidth >= 16 && !isAccompaniment) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const noteName = this._midiToName(ev.note);
        ctx.fillText(noteName, blockX + blockWidth / 2, noteY - 10);
      }
      ctx.restore();
    }

    // 4. Target Hit-Line Bar (bottom border where notes meet keyboard)
    ctx.save();
    const hitLineGrad = ctx.createLinearGradient(0, hitY - 4, 0, hitY + 6);
    hitLineGrad.addColorStop(0, "rgba(255, 118, 77, 0.12)");
    hitLineGrad.addColorStop(0.5, this.isWaitingForKey ? "#f59e0b" : "#ff764d");
    hitLineGrad.addColorStop(1, "rgba(255, 118, 77, 0.12)");

    ctx.fillStyle = hitLineGrad;
    ctx.shadowColor = this.isWaitingForKey ? "#fbbf24" : "#ff764d";
    ctx.shadowBlur = this.isWaitingForKey ? 16 : 8;
    ctx.fillRect(0, hitY - 2, w, 4);
    ctx.restore();

    // 5. Active Hit Particles & Glowing Ripples
    if (this.hitEffects.length > 0) {
      ctx.save();
      for (let i = this.hitEffects.length - 1; i >= 0; i--) {
        const eff = this.hitEffects[i];
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
        ctx.strokeStyle = eff.color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = Math.max(0, eff.alpha);
        ctx.shadowColor = eff.color;
        ctx.shadowBlur = 10;
        ctx.stroke();

        eff.radius += 1.8;
        eff.alpha -= 0.055;
        if (eff.alpha <= 0) {
          this.hitEffects.splice(i, 1);
        }
      }
      ctx.restore();
    }
  }

  _roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _midiToName(midi) {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const oct = Math.floor(midi / 12) - 1;
    return `${names[midi % 12]}${oct}`;
  }
}
