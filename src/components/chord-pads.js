/**
 * Workstation 8-Pad Harmony & Chord Trigger Bank
 * Triggers lush multi-note voicings (Jazz, Gospel, Neo-Soul, Pop) with single laptop keys (1-8) or touch.
 */

import { synthEngine } from "../audio/synth-engine.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";

export const CHORD_BANKS = {
  neo_soul: [
    { name: "Cmaj9", notes: [48, 55, 59, 62, 64], key: "1" },
    { name: "Am11", notes: [45, 52, 55, 60, 62], key: "2" },
    { name: "Dm9", notes: [50, 57, 60, 64, 65], key: "3" },
    { name: "G13sus", notes: [43, 53, 55, 59, 64], key: "4" },
    { name: "Em7", notes: [52, 59, 62, 67, 71], key: "5" },
    { name: "Fmaj7#11", notes: [53, 60, 64, 65, 71], key: "6" },
    { name: "E7(#9)", notes: [52, 58, 62, 67, 75], key: "7" },
    { name: "Abmaj9", notes: [44, 51, 55, 58, 60], key: "8" },
  ],
  gospel_praise: [
    { name: "Db2", notes: [49, 56, 61, 63, 68], key: "1" },
    { name: "Bbm9", notes: [46, 53, 56, 60, 65], key: "2" },
    { name: "Gbmaj9", notes: [42, 49, 54, 58, 61], key: "3" },
    { name: "Ab7(b9)", notes: [44, 52, 56, 59, 62], key: "4" },
    { name: "Ebm11", notes: [51, 58, 61, 64, 68], key: "5" },
    { name: "Fm7", notes: [53, 60, 63, 68, 72], key: "6" },
    { name: "Bb7alt", notes: [46, 52, 56, 62, 67], key: "7" },
    { name: "Eb9sus", notes: [51, 58, 61, 65, 70], key: "8" },
  ],
};

export class ChordPadsUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeBank = "neo_soul";
    this.activeNotesMap = new Map(); // PadIndex -> Array of active midi notes

    this.render();
    this.bindEvents();
  }

  render() {
    if (!this.container) return;

    const chords = CHORD_BANKS[this.activeBank];

    this.container.innerHTML = `
      <div class="chord-station-header">
        <span class="station-badge">CHORD HARMONY PADS</span>
        <div class="bank-selector">
          <button class="bank-btn ${this.activeBank === "neo_soul" ? "active" : ""}" data-bank="neo_soul">NEO-SOUL</button>
          <button class="bank-btn ${this.activeBank === "gospel_praise" ? "active" : ""}" data-bank="gospel_praise">GOSPEL & POP</button>
        </div>
      </div>
      <div class="chord-pads-grid">
        ${chords
          .map(
            (c, i) => `
          <div class="chord-pad" id="chord-pad-${i}" data-index="${i}">
            <div class="pad-num">[${c.key}]</div>
            <div class="pad-name">${c.name}</div>
            <div class="pad-light"></div>
          </div>
        `
          )
          .join("")}
      </div>
    `;

    this.bindBankButtons();
  }

  bindBankButtons() {
    this.container.querySelectorAll(".bank-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.activeBank = btn.getAttribute("data-bank");
        this.render();
        this.bindEvents();
      });
    });
  }

  bindEvents() {
    const pads = this.container.querySelectorAll(".chord-pad");

    pads.forEach(pad => {
      const idx = parseInt(pad.getAttribute("data-index"));

      const triggerOn = () => {
        this.playChord(idx);
        pad.classList.add("active");
      };

      const triggerOff = () => {
        this.releaseChord(idx);
        pad.classList.remove("active");
      };

      pad.addEventListener("mousedown", e => {
        e.preventDefault();
        triggerOn();
      });

      window.addEventListener("mouseup", () => {
        if (pad.classList.contains("active")) {
          triggerOff();
        }
      });

      pad.addEventListener("touchstart", e => {
        e.preventDefault();
        triggerOn();
      });

      pad.addEventListener("touchend", e => {
        e.preventDefault();
        triggerOff();
      });
    });

    // Chord pads trigger on click/touch directly on pad buttons
  }

  playChord(index) {
    const chord = CHORD_BANKS[this.activeBank][index];
    if (!chord) return;

    // Release any previous chord from this pad
    this.releaseChord(index);

    const activeNotes = [...chord.notes];
    this.activeNotesMap.set(index, activeNotes);

    activeNotes.forEach(m => {
      multiLayerEngine.noteOn(m, 105);
    });
  }

  releaseChord(index) {
    const notes = this.activeNotesMap.get(index);
    if (notes) {
      notes.forEach(m => multiLayerEngine.noteOff(m));
      this.activeNotesMap.delete(index);
    }
  }
}
