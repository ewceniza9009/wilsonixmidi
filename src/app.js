/**
 * MidiKey Elite - Application Orchestrator
 * Bootstraps audio engine, MIDI, QWERTY input, Ableton device rack, and UI stations.
 */

import { audioCore } from "./audio/audio-core.js";
import { synthEngine } from "./audio/synth-engine.js";
import { midiManager } from "./midi/midi-manager.js";
import { qwertyKeyboard } from "./midi/qwerty-keyboard.js";
import { GigHudUI } from "./components/gig-hud.js";
import { FxRackUI } from "./components/fx-rack-ui.js";
import { ChordPadsUI } from "./components/chord-pads.js";
import { ClipLooper } from "./components/looper.js";
import { VirtualKeyboardUI } from "./components/virtual-keyboard.js";
import { LicenseModalUI } from "./components/license-modal.js";
import { TritonWorkstationUI } from "./components/triton-workstation-ui.js";
import { MultiLayerUI } from "./components/multi-layer-ui.js";
import { GroovePlayerUI } from "./components/groove-player-ui.js";
import { DemoStationUI } from "./components/demo-station.js";
import { MediaPlayerUI } from "./components/media-player-ui.js";
import { multiLayerEngine } from "./audio/multi-layer-engine.js";

class MidiKeyEliteApp {
  constructor() {
    this.gigHud = null;
    this.tritonConsole = null;
    this.multiLayerConsole = null;
    this.fxRack = null;
    this.chordPads = null;
    this.looper = null;
    this.grooveStation = null;
    this.mediaPlayer = null;
    this.virtualKeyboard = null;
    this.licenseModal = null;
    this.unlocked = false;
  }

  start() {
    console.log("Initializing MidiKey Elite Workstation...");

    // 0. Pre-arm AudioContext and pre-decode PCM buffers into RAM on page boot
    try {
      audioCore.init();
      multiLayerEngine.init();
    } catch (e) {
      console.warn("Pre-arm audio:", e);
    }

    // 0b. Restore working session (survives accidental refresh mid-gig)
    let restoredSession = null;
    try {
      restoredSession = multiLayerEngine.restoreSession();
    } catch (e) {
      console.warn("Session restore:", e);
    }

    // 1. Immediate Audio Unlock Setup (Bound synchronously FIRST so clicks ALWAYS work)
    const unlockGesture = () => {
      if (!this.unlocked) {
        audioCore.unlock();
        this.unlocked = true;
        try { multiLayerEngine.init(); } catch (e) { console.warn("Engine init:", e); }
        if (this.tritonConsole && this.tritonConsole.activeProg) {
          try { this.tritonConsole.applyTritonProgram(this.tritonConsole.activeProg); } catch (e) {}
        }
        if (this.fxRack) {
          try { this.fxRack.syncWithRack(); } catch (e) {}
        }
        const splash = document.getElementById("audio-unlock-overlay");
        if (splash) {
          splash.classList.add("hidden");
          setTimeout(() => { splash.style.display = "none"; }, 300);
        }
      }
    };

    window.addEventListener("pointerdown", unlockGesture, { passive: true });
    window.addEventListener("keydown", unlockGesture, { passive: true });
    window.addEventListener("touchstart", unlockGesture, { passive: true });

    const unlockBannerBtn = document.getElementById("btn-engine-unlock");
    if (unlockBannerBtn) {
      unlockBannerBtn.addEventListener("click", e => {
        e.stopPropagation();
        unlockGesture();
      });
    }

    // 2. License Modal
    try {
      this.licenseModal = new LicenseModalUI("license-modal-mount", () => {
        if (this.gigHud) this.gigHud.render();
      });
    } catch (e) {
      console.warn("LicenseModalUI init:", e);
    }

    // 3. Stage Gig HUD
    try {
      this.gigHud = new GigHudUI("gig-hud-mount", () => {
        this.licenseModal?.open();
      });
    } catch (e) {
      console.warn("GigHudUI init:", e);
    }

    // 3b. Apply restored master volume to engine + slider UI
    try {
      const pct = restoredSession && typeof restoredSession.masterPct === "number"
        ? restoredSession.masterPct
        : 50;
      multiLayerEngine.setMasterVolumePct(pct);
      const volSlider = document.getElementById("hud-master-vol");
      const volReadout = document.getElementById("hud-master-vol-val");
      if (volSlider) volSlider.value = pct;
      if (volReadout) volReadout.innerText = `${pct}%`;
    } catch (e) {
      console.warn("Volume restore:", e);
    }

    // 4. Korg Triton Hardware TouchView Console
    try {
      this.tritonConsole = new TritonWorkstationUI("triton-workstation-mount");
    } catch (e) {
      console.warn("TritonWorkstationUI init:", e);
    }

    // 5. Combi 4-Timbre Multi-Layer Mixer
    try {
      this.multiLayerConsole = new MultiLayerUI("multi-layer-mount");
    } catch (e) {
      console.warn("MultiLayerUI init:", e);
    }

    // 6. Middle Station: Chord Pads & Clip Looper
    try {
      this.chordPads = new ChordPadsUI("chord-pads-mount");
      this.looper = new ClipLooper("looper-mount");
    } catch (e) {
      console.warn("ChordPads / Looper init:", e);
    }

    // 6b. Demo Station: 30s Interactive Song Clips
    try {
      this.demoStation = new DemoStationUI("demo-station-mount");
    } catch (e) {
      console.warn("DemoStationUI init:", e);
    }

    // 6c. Groove Station & SFX Performance Soundboard
    try {
      this.grooveStation = new GroovePlayerUI("groove-station-mount");
    } catch (e) {
      console.warn("GroovePlayerUI init:", e);
    }

    // 6d. Media Player Deck (Audio/Video playback with persistent playlist)
    try {
      this.mediaPlayer = new MediaPlayerUI("media-player-mount");
      this.mediaPlayer.render();
    } catch (e) {
      console.warn("MediaPlayerUI init:", e);
    }

    // 7. Ableton Device FX Rack
    try {
      this.fxRack = new FxRackUI("fx-rack-mount");
    } catch (e) {
      console.warn("FxRackUI init:", e);
    }

    // 8. Elite Virtual Keyboard Instrument
    try {
      this.virtualKeyboard = new VirtualKeyboardUI("virtual-keyboard-mount");
    } catch (e) {
      console.warn("VirtualKeyboardUI init:", e);
    }

    // 9. Non-blocking Web MIDI API Background Connect
    midiManager.init().catch(err => console.warn("MIDI init:", err));

    // 10. Default View Mode: Triton VST Console
    const appRoot = document.getElementById("app-root");
    if (appRoot) {
      appRoot.classList.add("view-triton");
    }

    // 11. Workspace View Tabs Switcher
    const wsTabBtns = document.querySelectorAll(".ws-tab-btn[data-view]");
    wsTabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        wsTabBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const view = btn.getAttribute("data-view");

        if (appRoot) {
          appRoot.classList.remove(
            "view-all",
            "view-triton",
            "view-combi",
            "view-keys",
            "view-chords",
            "view-demo",
            "view-fx",
            "view-looper",
            "view-grooves",
            "view-player"
          );
          appRoot.classList.add(`view-${view}`);
        }

        if (view === "combi") {
          multiLayerEngine.toggleCombiMode(true);
        }

        // Snap smoothly to stage deck when switching stage views
        const stageDeck = document.getElementById("studio-stage-deck");
        if (stageDeck && window.scrollY > 50) {
          stageDeck.scrollIntoView({ behavior: "smooth" });
        }
      });
    });


    // 13. Fullscreen Toggle
    const fullscreenBtn = document.getElementById("btn-toggle-fullscreen");
    fullscreenBtn?.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
        fullscreenBtn.classList.add("active");
      } else {
        document.exitFullscreen?.().catch(() => {});
        fullscreenBtn.classList.remove("active");
      }
    });

    console.log("MidiKey Elite Ready. Zero-lag pipeline armed.");
  }
}

// Immediate execution supporting both loaded and loading states
function bootstrap() {
  const app = new MidiKeyEliteApp();
  app.start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
