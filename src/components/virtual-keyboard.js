/**
 * Elite Virtual Keyboard UI Instrument (88-Key Concert Grand Layout)
 * Interactive piano keybed for laptops & touchscreens with:
 * - Full 88 Keys (A0 = MIDI 21 to C8 = MIDI 108)
 * - Zero-lag GPU hardware-accelerated visuals with state deduplication
 * - Dynamic vertical hit velocity (Top = Pianissimo soft touch, Bottom = Fortissimo punchy bite)
 * - Real-time vertical key slide articulation (Y-axis timbre modulation & filter swell)
 * - Horizontal legato glissando
 * - Spacebar & on-screen Damper / Sustain Pedal
 * - Spring-loaded Pitch Bend & Modulation wheels
 * - Live Velocity & Dynamic Accent HUD
 * - Smart Chord Voicings (Single key 7th, 9th/11th Neo-Soul, and Diminished)
 * - QWERTY Layout Switcher (Melody Q-P vs DAW Home-Row)
 * - Auto-centering on Middle C (C4)
 */

import { synthEngine } from "../audio/synth-engine.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";
import { qwertyKeyboard } from "../midi/qwerty-keyboard.js";
import { whitneyDemoPlayer } from "../audio/whitney-demo-player.js";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const WHITE_NOTES = [0, 2, 4, 5, 7, 9, 11];

export class VirtualKeyboardUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.startMidi = 21; // A0 (Standard 88-Key Grand Piano)
    this.endMidi = 108; // C8
    this.activeTouches = new Map(); // TouchId -> { midi, rect, chordNotes }
    this.keyElements = new Map(); // MidiNote -> DOMElement
    this.labelElements = new Map(); // MidiNote -> DOMElement
    this.keyStates = new Uint8Array(128); // Fast state deduplication cache
    this.activeMouseChord = null;

    this.render();
    this.bindMouseAndTouch();
    this.bindWheels();
    this.updateHudState();

    // Auto-center view on Middle C (C4 = MIDI 60) on startup
    requestAnimationFrame(() => {
      this.centerOnMiddleC(false);
    });

    // Subscribe to engine note triggers for bidirectional feedback
    synthEngine.onNoteChangeCallback = (midiNote, isPressed, velocity) => {
      this.setKeyVisualState(midiNote, isPressed, velocity);
    };

    qwertyKeyboard.onStateChangeCallback = () => {
      this.updateHudState();
      this.updateQwertyLabels();
    };

    qwertyKeyboard.onChordVisualCallback = (notes, isPressed, velocity = 95) => {
      notes.forEach(m => this.setKeyVisualState(m, isPressed, velocity));
    };

    whitneyDemoPlayer.onNoteTriggerCallback = (midi, isPressed, vel) => {
      this.setKeyVisualState(midi, isPressed, vel);
    };

    // Chord pads -> virtual key highlight bridge
    window.addEventListener("wilsonix-keys-visual", e => {
      const { notes, pressed, velocity } = e.detail || {};
      if (!Array.isArray(notes)) return;
      notes.forEach(m => this.setKeyVisualState(m, !!pressed, velocity || 95));
    });

    whitneyDemoPlayer.onProgressCallback = (elapsed) => {
      const btn = document.getElementById("hud-whitney-demo-btn");
      const hudBtn = document.getElementById("hud-whitney-play-btn");
      const isPlaying = whitneyDemoPlayer.isPlaying;
      const sec = Math.min(30, Math.floor(elapsed / 1000));
      const secStr = sec < 10 ? `0${sec}` : `${sec}`;
      const text = isPlaying ? `⏹ STOP (00:${secStr} / 00:30)` : `▶ WHITNEY 30s DEMO`;
      if (btn) {
        btn.innerText = text;
        btn.classList.toggle("playing", isPlaying);
      }
      if (hudBtn) {
        hudBtn.innerText = isPlaying ? `⏹ STOP (${secStr}s)` : `▶ WHITNEY 30s`;
        hudBtn.classList.toggle("playing", isPlaying);
      }
    };
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="virtual-instrument-station">
        <!-- Controller Strip: Wheels, Octave, Velocity & Sustain HUD -->
        <div class="keyboard-controls-bar">
          <div class="wheel-bay">
            <div class="wheel-unit">
              <label>PITCH</label>
              <div class="wheel-track" id="pitch-bend-track">
                <div class="wheel-thumb" id="pitch-bend-thumb"></div>
              </div>
            </div>
            <div class="wheel-unit">
              <label>MOD / AIR</label>
              <div class="wheel-track" id="mod-wheel-track">
                <div class="wheel-thumb" id="mod-wheel-thumb"></div>
              </div>
            </div>
          </div>

          <div class="octave-hud-unit">
            <button class="hud-btn" id="oct-down-btn" title="Octave Down (Minus)">- OCT</button>
            <div class="octave-readout" id="oct-display">C${qwertyKeyboard.baseOctave}</div>
            <button class="hud-btn" id="oct-up-btn" title="Octave Up (Plus)">+ OCT</button>
          </div>

          <!-- Smart Chord Voicing Button -->
          <div class="chord-hud-unit">
            <button class="hud-btn chord-btn" id="hud-chord-btn" title="Cycle Smart Chords: 7th, 9th/11th, Diminished (HotKey: ~ / Backquote)">
              CHORD: ${qwertyKeyboard.chordMode.toUpperCase()}
            </button>
          </div>

          <!-- QWERTY Layout Selector Button -->
          <div class="layout-hud-unit">
            <button class="hud-btn layout-btn" id="hud-layout-btn" title="Switch QWERTY Layout (F2)">
              LAYOUT: ${qwertyKeyboard.layoutMode === "melody" ? "MELODY (Q-P)" : "DAW (A-')"}
            </button>
          </div>

          <!-- Whitney 30s Interactive Demo Player -->
          <div class="demo-song-unit">
            <button class="hud-btn demo-play-btn" id="hud-whitney-demo-btn" title="Listen to Whitney Houston's 'I Have Nothing' First 30s with Full Foster Voicing">
              ▶ WHITNEY 30s DEMO
            </button>
          </div>

          <!-- Dynamic Velocity & Expression HUD -->
          <div class="velocity-accent-unit" title="Dynamic Velocity (Use Shift for FF accent, Alt/Ctrl for PP soft)">
            <span class="accent-badge" id="hud-accent-badge">MF</span>
            <span class="velocity-readout" id="hud-velocity-readout">VEL: ${qwertyKeyboard.velocity}</span>
            <div class="accent-preset-btns">
              <button class="accent-mini-btn" data-vel="35" title="Pianissimo (1)">PP</button>
              <button class="accent-mini-btn" data-vel="60" title="Mezzo-Piano">MP</button>
              <button class="accent-mini-btn active" data-vel="95" title="Mezzo-Forte (4)">MF</button>
              <button class="accent-mini-btn" data-vel="120" title="Fortissimo (8)">FF</button>
              <button class="accent-mini-btn" data-vel="127" title="Sforzando (Shift)">SFZ</button>
            </div>
          </div>

          <!-- Sustain / Damper Pedal -->
          <div class="sustain-latch-unit">
            <button class="hud-btn sustain-btn" id="sustain-latch-btn" title="Acoustic Damper Pedal (Hold SPACEBAR)">
              <span class="pedal-led"></span>
              SUSTAIN (SPACE)
            </button>
          </div>

          <!-- Key Zoom Controls for 88 Keys -->
          <div class="key-zoom-unit">
            <span class="zoom-label">KEYS:</span>
            <div class="zoom-pill-group">
              <button class="zoom-btn active" data-zoom="wide">WIDE (TOUCH)</button>
              <button class="zoom-btn" data-zoom="compact">COMPACT</button>
              <button class="zoom-btn" data-zoom="full">88 FULL</button>
            </div>
          </div>

          <div class="qwerty-toggle-unit">
            <label class="toggle-pill">
              <input type="checkbox" id="show-qwerty-labels" checked />
              <span>QWERTY HUD</span>
            </label>
          </div>

          <div class="panic-unit">
            <button class="hud-btn panic-btn" id="master-panic-btn" title="Silence All Notes (ESC)">PANIC</button>
          </div>
        </div>

        <!-- Interactive Piano Bed (88 Keys) -->
        <div class="piano-roll-container zoom-wide" id="piano-roll-container">
          <div class="piano-bed" id="piano-keys-track">
            ${this.buildKeysHtml()}
          </div>
        </div>
      </div>
    `;

    // Cache key and label element references
    this.keyElements.clear();
    this.labelElements.clear();
    for (let m = this.startMidi; m <= this.endMidi; m++) {
      const el = document.getElementById(`key-midi-${m}`);
      if (el) this.keyElements.set(m, el);
      const labelEl = document.getElementById(`key-label-${m}`);
      if (labelEl) this.labelElements.set(m, labelEl);
    }

    this.bindHudButtons();
    this.updateQwertyLabels();
  }

  buildKeysHtml() {
    let html = "";
    for (let midi = this.startMidi; midi <= this.endMidi; midi++) {
      const noteInOct = midi % 12;
      const isBlack = !WHITE_NOTES.includes(noteInOct);
      const noteName = NOTE_NAMES[noteInOct];
      const octave = Math.floor(midi / 12) - 1;

      html += `
        <div class="piano-key ${isBlack ? "black-key" : "white-key"}" 
             id="key-midi-${midi}" 
             data-midi="${midi}">
          <div class="key-strike-zone" title="Top: Soft (Pianissimo) | Bottom: Hard (Fortissimo)"></div>
          <span class="key-qwerty-label" id="key-label-${midi}"></span>
          <span class="key-note-name">${isBlack ? "" : `${noteName}${octave}`}</span>
        </div>
      `;
    }
    return html;
  }

  bindMouseAndTouch() {
    const track = document.getElementById("piano-keys-track");
    if (!track) return;

    const getKeyFromPoint = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const keyEl = el ? el.closest(".piano-key") : null;
      if (!keyEl) return null;
      const midi = parseInt(keyEl.getAttribute("data-midi"));
      const rect = keyEl.getBoundingClientRect();
      return { midi, rect, el: keyEl };
    };

    const calculateVelocity = (clientY, rect) => {
      const relativeY = Math.max(0, Math.min(1.0, (clientY - rect.top) / rect.height));
      return Math.round(35 + relativeY * 92); // 35 to 127 dynamic range
    };

    let isMouseDown = false;

    track.addEventListener("mousedown", e => {
      e.preventDefault();
      isMouseDown = true;
      const key = getKeyFromPoint(e.clientX, e.clientY);
      if (key) {
        const vel = calculateVelocity(e.clientY, key.rect);
        const notes = qwertyKeyboard.generateSmartVoicing(key.midi, qwertyKeyboard.chordMode);
        this.activeMouseChord = notes;

        notes.forEach(n => {
          this.setKeyVisualState(n, true, vel);
          multiLayerEngine.noteOn(n, vel);
        });
      }
    });

    window.addEventListener("mousemove", e => {
      if (!isMouseDown) return;
      const key = getKeyFromPoint(e.clientX, e.clientY);
      if (key) {
        const primaryNote = this.activeMouseChord ? this.activeMouseChord[0] : null;
        if (key.midi !== primaryNote) {
          // Horizontal Glissando / Legato Slide to adjacent note
          if (this.activeMouseChord) {
            this.activeMouseChord.forEach(n => {
              this.setKeyVisualState(n, false);
              multiLayerEngine.noteOff(n);
            });
          }
          const vel = calculateVelocity(e.clientY, key.rect);
          const notes = qwertyKeyboard.generateSmartVoicing(key.midi, qwertyKeyboard.chordMode);
          this.activeMouseChord = notes;

          notes.forEach(n => {
            this.setKeyVisualState(n, true, vel);
            multiLayerEngine.noteOn(n, vel);
          });
        } else {
          // Vertical Key Slide Expression (Y-Axis Timbre Modulation & Filter Swell)
          const relativeY = Math.max(0, Math.min(1.0, (e.clientY - key.rect.top) / key.rect.height));
          multiLayerEngine.setNoteExpression(key.midi, relativeY);
        }
      }
    });

    window.addEventListener("mouseup", () => {
      if (isMouseDown && this.activeMouseChord) {
        this.activeMouseChord.forEach(n => {
          this.setKeyVisualState(n, false);
          multiLayerEngine.noteOff(n);
        });
        this.activeMouseChord = null;
      }
      isMouseDown = false;
    });

    // Multi-touch for mobile / tablet / touchscreen laptops
    track.addEventListener(
      "touchstart",
      e => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const key = getKeyFromPoint(t.clientX, t.clientY);
          if (key) {
            const vel = calculateVelocity(t.clientY, key.rect);
            const notes = qwertyKeyboard.generateSmartVoicing(key.midi, qwertyKeyboard.chordMode);
            this.activeTouches.set(t.identifier, { midi: key.midi, rect: key.rect, chordNotes: notes });

            notes.forEach(n => {
              this.setKeyVisualState(n, true, vel);
              multiLayerEngine.noteOn(n, vel);
            });
          }
        }
      },
      { passive: false }
    );

    track.addEventListener(
      "touchmove",
      e => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const prevTouch = this.activeTouches.get(t.identifier);
          const key = getKeyFromPoint(t.clientX, t.clientY);

          if (key) {
            if (!prevTouch || key.midi !== prevTouch.midi) {
              // Glissando / slide to new key
              if (prevTouch && prevTouch.chordNotes) {
                prevTouch.chordNotes.forEach(n => {
                  this.setKeyVisualState(n, false);
                  multiLayerEngine.noteOff(n);
                });
              }
              const vel = calculateVelocity(t.clientY, key.rect);
              const notes = qwertyKeyboard.generateSmartVoicing(key.midi, qwertyKeyboard.chordMode);
              this.activeTouches.set(t.identifier, { midi: key.midi, rect: key.rect, chordNotes: notes });

              notes.forEach(n => {
                this.setKeyVisualState(n, true, vel);
                multiLayerEngine.noteOn(n, vel);
              });
            } else {
              // Continuous Vertical Slide on held key (Expressive Aftertouch)
              const relativeY = Math.max(0, Math.min(1.0, (t.clientY - key.rect.top) / key.rect.height));
              multiLayerEngine.setNoteExpression(key.midi, relativeY);
            }
          }
        }
      },
      { passive: false }
    );

    track.addEventListener("touchend", e => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const prevTouch = this.activeTouches.get(t.identifier);
        if (prevTouch && prevTouch.chordNotes) {
          prevTouch.chordNotes.forEach(n => {
            this.setKeyVisualState(n, false);
            multiLayerEngine.noteOff(n);
          });
          this.activeTouches.delete(t.identifier);
        }
      }
    });

    track.addEventListener("touchcancel", e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const prevTouch = this.activeTouches.get(t.identifier);
        if (prevTouch && prevTouch.chordNotes) {
          prevTouch.chordNotes.forEach(n => {
            this.setKeyVisualState(n, false);
            multiLayerEngine.noteOff(n);
          });
          this.activeTouches.delete(t.identifier);
        }
      }
    });
  }

  bindWheels() {
    const pitchTrack = document.getElementById("pitch-bend-track");
    const pitchThumb = document.getElementById("pitch-bend-thumb");
    const modTrack = document.getElementById("mod-wheel-track");
    const modThumb = document.getElementById("mod-wheel-thumb");

    // Spring-loaded Pitch Bend (-2 to +2 semitones)
    if (pitchTrack && pitchThumb) {
      let isDragging = false;
      const setPitchFromY = clientY => {
        const rect = pitchTrack.getBoundingClientRect();
        const norm = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        const semitones = (0.5 - norm) * 4;
        pitchThumb.style.top = `${norm * 100}%`;
        multiLayerEngine.setPitchBend(semitones);
        synthEngine.setPitchBend(semitones);
      };

      pitchTrack.addEventListener("mousedown", e => {
        isDragging = true;
        setPitchFromY(e.clientY);
      });

      window.addEventListener("mousemove", e => {
        if (isDragging) setPitchFromY(e.clientY);
      });

      window.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          // Spring back to center
          pitchThumb.style.top = "50%";
          multiLayerEngine.setPitchBend(0);
          synthEngine.setPitchBend(0);
        }
      });
    }

    // Latching Modulation / Air Brilliance Wheel
    if (modTrack && modThumb) {
      let isModDragging = false;
      const setModFromY = clientY => {
        const rect = modTrack.getBoundingClientRect();
        const norm = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        const amount = 1.0 - norm; // Top is 100%
        modThumb.style.top = `${norm * 100}%`;
        multiLayerEngine.setModWheel(amount);
        synthEngine.setModWheel(amount);
      };

      modTrack.addEventListener("mousedown", e => {
        isModDragging = true;
        setModFromY(e.clientY);
      });

      window.addEventListener("mousemove", e => {
        if (isModDragging) setModFromY(e.clientY);
      });

      window.addEventListener("mouseup", () => {
        isModDragging = false;
      });
    }
  }

  bindHudButtons() {
    const octDown = document.getElementById("oct-down-btn");
    const octUp = document.getElementById("oct-up-btn");
    const sustainBtn = document.getElementById("sustain-latch-btn");
    const panicBtn = document.getElementById("master-panic-btn");
    const qwertyToggle = document.getElementById("show-qwerty-labels");
    const chordBtn = document.getElementById("hud-chord-btn");
    const layoutBtn = document.getElementById("hud-layout-btn");

    octDown?.addEventListener("click", () => {
      qwertyKeyboard.shiftOctave(-1);
      this.scrollToMidi((qwertyKeyboard.baseOctave + 1) * 12 + 4, true);
    });

    octUp?.addEventListener("click", () => {
      qwertyKeyboard.shiftOctave(1);
      this.scrollToMidi((qwertyKeyboard.baseOctave + 1) * 12 + 4, true);
    });

    chordBtn?.addEventListener("click", () => {
      qwertyKeyboard.cycleChordMode();
      this.updateHudState();
    });

    layoutBtn?.addEventListener("click", () => {
      qwertyKeyboard.cycleLayoutMode();
      this.updateHudState();
      this.updateQwertyLabels();
    });

    const demoBtn = document.getElementById("hud-whitney-demo-btn");
    demoBtn?.addEventListener("click", () => {
      if (whitneyDemoPlayer.isPlaying) {
        whitneyDemoPlayer.stop();
      } else {
        whitneyDemoPlayer.play();
      }
    });

    sustainBtn?.addEventListener("click", () => {
      qwertyKeyboard.toggleSustainLatch();
      this.updateHudState();
    });

    panicBtn?.addEventListener("click", () => {
      multiLayerEngine.panic();
      synthEngine.panic();
      this.keyStates.fill(0);
      for (const el of this.keyElements.values()) {
        el.classList.remove("active");
      }
    });

    qwertyToggle?.addEventListener("change", () => {
      this.updateQwertyLabels();
    });

    // Accent mini buttons (PP, MP, MF, FF, SFZ)
    const accentBtns = this.container.querySelectorAll(".accent-mini-btn");
    accentBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        accentBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const vel = parseInt(btn.getAttribute("data-vel"));
        qwertyKeyboard.setVelocity(vel);
      });
    });

    // Mobile / Screen Key Zoom Mode Switcher
    const rollContainer = document.getElementById("piano-roll-container");
    const zoomBtns = this.container.querySelectorAll(".zoom-btn");
    zoomBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        zoomBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const mode = btn.getAttribute("data-zoom");
        if (rollContainer) {
          rollContainer.classList.remove("zoom-wide", "zoom-compact", "zoom-full");
          rollContainer.classList.add(`zoom-${mode}`);
          if (mode === "full") {
            rollContainer.scrollTo({ left: 0, behavior: "smooth" });
          } else {
            this.centerOnMiddleC(true);
          }
        }
      });
    });
  }

  scrollToMidi(midiNote, smooth = true) {
    const el = this.keyElements.get(midiNote);
    const container = document.getElementById("piano-roll-container");
    if (!el || !container) return;

    const elLeft = el.offsetLeft;
    const elWidth = el.offsetWidth;
    const containerWidth = container.clientWidth;
    const currentScroll = container.scrollLeft;

    if (elLeft < currentScroll + 40 || elLeft + elWidth > currentScroll + containerWidth - 40) {
      const targetScroll = Math.max(0, elLeft - (containerWidth / 2) + (elWidth / 2));
      container.scrollTo({
        left: targetScroll,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }

  centerOnMiddleC(smooth = false) {
    this.scrollToMidi(60, smooth); // Middle C = 60
  }

  updateQwertyLabels() {
    const show = document.getElementById("show-qwerty-labels")?.checked ?? true;
    const keyMap = qwertyKeyboard.activeKeyMap;
    const midiToKey = new Map();

    for (const mapping of Object.values(keyMap)) {
      const m = (qwertyKeyboard.baseOctave + 1 + mapping.octOffset) * 12 + mapping.noteOffset;
      midiToKey.set(m, mapping.label);
    }

    for (let m = this.startMidi; m <= this.endMidi; m++) {
      const labelEl = this.labelElements?.get(m);
      if (labelEl) {
        if (show && midiToKey.has(m)) {
          const text = midiToKey.get(m);
          if (labelEl.innerText !== text) labelEl.innerText = text;
          if (labelEl.style.display !== "block") labelEl.style.display = "block";
        } else {
          if (labelEl.innerText !== "") labelEl.innerText = "";
          if (labelEl.style.display !== "none") labelEl.style.display = "none";
        }
      }
    }
  }

  setKeyVisualState(midiNote, isPressed, velocity = 95) {
    if (midiNote < this.startMidi || midiNote > this.endMidi) return;
    const isNowPressed = !!isPressed;
    const wasPressed = this.keyStates[midiNote] > 0;
    if (wasPressed === isNowPressed) return; // Drop redundant DOM updates to eliminate lag

    this.keyStates[midiNote] = isNowPressed ? (velocity || 95) : 0;
    const el = this.keyElements.get(midiNote);
    if (!el) return;

    if (isNowPressed) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  }

  updateHudState() {
    const octDisplay = document.getElementById("oct-display");
    if (octDisplay) {
      octDisplay.innerText = `C${qwertyKeyboard.baseOctave}`;
    }

    const velReadout = document.getElementById("hud-velocity-readout");
    if (velReadout) {
      velReadout.innerText = `VEL: ${qwertyKeyboard.velocity}`;
    }

    const chordBtn = document.getElementById("hud-chord-btn");
    if (chordBtn) {
      chordBtn.innerText = `CHORD: ${qwertyKeyboard.chordMode.toUpperCase()}`;
      chordBtn.classList.toggle("active", qwertyKeyboard.chordMode !== "off");
    }

    const layoutBtn = document.getElementById("hud-layout-btn");
    if (layoutBtn) {
      layoutBtn.innerText = `LAYOUT: ${qwertyKeyboard.layoutMode === "melody" ? "MELODY (Q-P)" : "DAW (A-')"}`;
    }

    const accentBadge = document.getElementById("hud-accent-badge");
    if (accentBadge) {
      const v = qwertyKeyboard.velocity;
      let tag = "MF";
      if (v <= 40) tag = "PP";
      else if (v <= 70) tag = "MP";
      else if (v <= 100) tag = "MF";
      else if (v <= 120) tag = "FF";
      else tag = "SFZ";
      accentBadge.innerText = tag;
    }

    const sustainBtn = document.getElementById("sustain-latch-btn");
    if (sustainBtn) {
      const isDown = qwertyKeyboard.sustainPedal || qwertyKeyboard.sustainLatched;
      sustainBtn.classList.toggle("active", isDown);
      const led = sustainBtn.querySelector(".pedal-led");
      if (led) {
        led.classList.toggle("lit", isDown);
      }
    }

    this.updateQwertyLabels();
  }
}
