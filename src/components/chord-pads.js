/**
 * Workstation 8-Pad Harmony & Chord Trigger Bank
 * Triggers lush multi-note voicings across 10 authentic musical genres
 * (Worship Ballad, Neo-Soul, Gospel Praise, 90s R&B, Jazz Fusion, Pop Anthems, City Pop, Lofi Chill, Latin Bossa, Synthwave)
 * with single laptop keys (1-8) or touch.
 */

import { multiLayerEngine } from "../audio/multi-layer-engine.js";

export const CHORD_GENRES = [
  { id: "worship_ballad", name: "WORSHIP & BALLAD", icon: "🕊️" },
  { id: "neo_soul", name: "NEO-SOUL", icon: "✨" },
  { id: "gospel_praise", name: "GOSPEL PRAISE", icon: "🙌" },
  { id: "rnb_90s", name: "90s R&B & SOUL", icon: "🎙️" },
  { id: "jazz_fusion", name: "JAZZ FUSION", icon: "🎷" },
  { id: "pop_anthems", name: "POP & ANTHEMS", icon: "⚡" },
  { id: "city_pop", name: "CITY POP", icon: "🌃" },
  { id: "lofi_chill", name: "LO-FI CHILL", icon: "☕" },
  { id: "latin_bossa", name: "LATIN BOSSA", icon: "🌴" },
  { id: "synthwave_retro", name: "80s SYNTHWAVE", icon: "🌌" },
];

export const CHORD_BANKS = {
  worship_ballad: [
    { name: "D2 (add9)", notes: [38, 50, 57, 62, 64, 69], key: "1" },
    { name: "G/B", notes: [35, 47, 55, 59, 62, 67], key: "2" },
    { name: "A/C#", notes: [37, 49, 57, 61, 64, 69], key: "3" },
    { name: "Bm7", notes: [35, 47, 54, 59, 62, 66], key: "4" },
    { name: "Gmaj9", notes: [43, 50, 55, 59, 62, 66], key: "5" },
    { name: "D/F#", notes: [42, 49, 54, 57, 62, 66], key: "6" },
    { name: "Em7(9)", notes: [40, 47, 52, 55, 59, 62], key: "7" },
    { name: "A9sus4", notes: [45, 52, 57, 62, 64, 69], key: "8" },
  ],
  neo_soul: [
    { name: "Cmaj9", notes: [36, 48, 55, 59, 62, 64], key: "1" },
    { name: "Am11", notes: [45, 52, 55, 60, 62, 67], key: "2" },
    { name: "Dm9", notes: [38, 50, 57, 60, 64, 65], key: "3" },
    { name: "G13sus", notes: [43, 53, 55, 59, 64, 67], key: "4" },
    { name: "Em9", notes: [40, 52, 59, 62, 66, 67], key: "5" },
    { name: "Fmaj7#11", notes: [41, 53, 60, 64, 65, 71], key: "6" },
    { name: "E7(#9)", notes: [40, 52, 58, 62, 67, 75], key: "7" },
    { name: "Abmaj9", notes: [44, 51, 55, 58, 60, 63], key: "8" },
  ],
  gospel_praise: [
    { name: "Db2 (add9)", notes: [37, 49, 56, 61, 63, 68], key: "1" },
    { name: "Bbm9", notes: [46, 53, 56, 60, 65, 68], key: "2" },
    { name: "Gbmaj9", notes: [42, 49, 54, 58, 61, 65], key: "3" },
    { name: "Ab7(b9)", notes: [44, 52, 56, 59, 62, 66], key: "4" },
    { name: "Ebm11", notes: [39, 51, 58, 61, 64, 68], key: "5" },
    { name: "Fm7", notes: [41, 53, 60, 63, 68, 72], key: "6" },
    { name: "Bb7alt", notes: [46, 52, 56, 62, 67, 70], key: "7" },
    { name: "Eb9sus", notes: [39, 51, 58, 61, 65, 70], key: "8" },
  ],
  rnb_90s: [
    { name: "F#m9", notes: [42, 49, 54, 57, 61, 64], key: "1" },
    { name: "B13sus", notes: [35, 47, 54, 57, 61, 66], key: "2" },
    { name: "Emaj9", notes: [40, 47, 51, 54, 59, 63], key: "3" },
    { name: "C#m11", notes: [37, 49, 56, 59, 63, 66], key: "4" },
    { name: "Amaj9", notes: [45, 52, 56, 59, 63, 68], key: "5" },
    { name: "G#m7", notes: [44, 51, 54, 59, 63, 66], key: "6" },
    { name: "F#m11", notes: [42, 49, 52, 56, 61, 64], key: "7" },
    { name: "B7(b13)", notes: [47, 55, 57, 63, 67, 71], key: "8" },
  ],
  jazz_fusion: [
    { name: "Fmaj9#11", notes: [41, 48, 55, 60, 64, 65, 71], key: "1" },
    { name: "D7alt", notes: [38, 50, 56, 60, 64, 68], key: "2" },
    { name: "Gm11", notes: [43, 50, 53, 57, 62, 65], key: "3" },
    { name: "C13(b9)", notes: [36, 48, 55, 58, 62, 65, 69], key: "4" },
    { name: "Am9", notes: [45, 52, 55, 59, 64, 67], key: "5" },
    { name: "Ab7#11", notes: [44, 50, 56, 62, 66, 70], key: "6" },
    { name: "Dbmaj9", notes: [37, 49, 56, 60, 63, 68], key: "7" },
    { name: "C7alt", notes: [48, 54, 58, 62, 66, 70], key: "8" },
  ],
  pop_anthems: [
    { name: "C (I)", notes: [36, 48, 55, 60, 64, 67], key: "1" },
    { name: "G/B (V)", notes: [35, 47, 55, 59, 62, 67], key: "2" },
    { name: "Am7 (vi)", notes: [45, 52, 57, 60, 64, 67], key: "3" },
    { name: "Fadd9 (IV)", notes: [41, 48, 53, 57, 60, 67], key: "4" },
    { name: "Em7 (iii)", notes: [40, 47, 52, 55, 59, 64], key: "5" },
    { name: "Dm7 (ii)", notes: [38, 50, 57, 60, 65, 69], key: "6" },
    { name: "Gsus4", notes: [43, 50, 55, 60, 62, 67], key: "7" },
    { name: "G7 (V7)", notes: [43, 50, 53, 59, 62, 67], key: "8" },
  ],
  city_pop: [
    { name: "Fmaj7", notes: [41, 48, 53, 57, 60, 64], key: "1" },
    { name: "E7(b9)", notes: [40, 47, 52, 56, 59, 65], key: "2" },
    { name: "Am9", notes: [45, 52, 55, 59, 64, 67], key: "3" },
    { name: "Gm7-C7", notes: [43, 50, 53, 58, 62, 67], key: "4" },
    { name: "Dm9", notes: [38, 50, 57, 60, 64, 67], key: "5" },
    { name: "G13", notes: [43, 50, 53, 57, 62, 65], key: "6" },
    { name: "Em7", notes: [40, 47, 52, 55, 59, 62], key: "7" },
    { name: "A7alt", notes: [45, 51, 55, 61, 65, 69], key: "8" },
  ],
  lofi_chill: [
    { name: "Ebmaj9", notes: [39, 46, 51, 55, 58, 62], key: "1" },
    { name: "Cm11", notes: [36, 48, 55, 58, 62, 65, 70], key: "2" },
    { name: "Fm9", notes: [41, 48, 51, 55, 58, 63], key: "3" },
    { name: "Bb13sus", notes: [46, 53, 56, 60, 65, 68], key: "4" },
    { name: "Gm7", notes: [43, 50, 53, 58, 62, 65], key: "5" },
    { name: "Abmaj7#11", notes: [44, 51, 55, 58, 62, 67], key: "6" },
    { name: "G7(#9)", notes: [43, 49, 53, 58, 66, 70], key: "7" },
    { name: "Bb7(b9)", notes: [46, 52, 56, 60, 65, 68], key: "8" },
  ],
  latin_bossa: [
    { name: "Dm7(9)", notes: [38, 50, 57, 60, 64, 65], key: "1" },
    { name: "G7(13)", notes: [43, 50, 53, 57, 62, 65], key: "2" },
    { name: "Cmaj7(9)", notes: [36, 48, 55, 59, 62, 64, 67], key: "3" },
    { name: "C#dim7", notes: [37, 49, 55, 58, 61, 64], key: "4" },
    { name: "Dm9", notes: [50, 57, 60, 64, 69, 72], key: "5" },
    { name: "G7(b9)", notes: [43, 49, 53, 59, 62, 65], key: "6" },
    { name: "Em7(b5)", notes: [40, 46, 52, 55, 58, 62], key: "7" },
    { name: "A7(b13)", notes: [45, 52, 55, 61, 65, 69], key: "8" },
  ],
  synthwave_retro: [
    { name: "Am(add9)", notes: [45, 52, 57, 60, 64, 71], key: "1" },
    { name: "Fmaj7", notes: [41, 48, 53, 57, 60, 64], key: "2" },
    { name: "C(add9)", notes: [36, 48, 55, 60, 62, 64, 67], key: "3" },
    { name: "G(sus4)", notes: [43, 50, 55, 59, 62, 67], key: "4" },
    { name: "Dm7", notes: [38, 50, 57, 60, 65, 69], key: "5" },
    { name: "Em7", notes: [40, 47, 52, 55, 59, 64], key: "6" },
    { name: "Bbmaj7", notes: [46, 53, 57, 60, 65, 69], key: "7" },
    { name: "E7sus4", notes: [40, 47, 52, 57, 59, 64], key: "8" },
  ],
};

export class ChordPadsUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeBank = "worship_ballad";
    this.activeNotesMap = new Map(); // PadIndex -> Array of active midi notes

    this.render();
    this.bindEvents();
  }

  render() {
    if (!this.container) return;

    const chords = CHORD_BANKS[this.activeBank] || CHORD_BANKS.worship_ballad;

    this.container.innerHTML = `
      <div class="chord-station-header">
        <div class="station-title-group">
          <span class="station-badge">CHORD HARMONY PADS</span>
          <span class="genre-tag">${CHORD_GENRES.find(g => g.id === this.activeBank)?.name || "GENRE"}</span>
        </div>
        <div class="bank-selector-scroll">
          <div class="bank-selector">
            ${CHORD_GENRES.map(
              g => `
              <button class="bank-btn ${this.activeBank === g.id ? "active" : ""}" data-bank="${g.id}">
                ${g.icon} ${g.name}
              </button>
            `
            ).join("")}
          </div>
        </div>
      </div>
      <div class="chord-pads-grid">
        ${chords
          .map(
            (c, i) => `
          <div class="chord-pad" id="chord-pad-${i}" data-index="${i}" title="Trigger chord ${c.name} (Key: ${c.key})">
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
  }

  playChord(index) {
    const chords = CHORD_BANKS[this.activeBank] || CHORD_BANKS.worship_ballad;
    const chord = chords[index];
    if (!chord) return;

    // Release any previous chord from this pad
    this.releaseChord(index);

    const activeNotes = [...chord.notes];
    this.activeNotesMap.set(index, activeNotes);

    activeNotes.forEach(m => {
      multiLayerEngine.noteOn(m, 105);
    });
    this.emitKeyVisual(activeNotes, true, 105);
  }

  releaseChord(index) {
    const notes = this.activeNotesMap.get(index);
    if (notes) {
      notes.forEach(m => multiLayerEngine.noteOff(m));
      this.activeNotesMap.delete(index);
      this.emitKeyVisual(notes, false);
    }
  }

  emitKeyVisual(notes, pressed, velocity = 95) {
    try {
      window.dispatchEvent(
        new CustomEvent("wilsonix-keys-visual", { detail: { notes, pressed, velocity } })
      );
    } catch (e) {}
  }
}
