/**
 * MidiKey Elite - Application Orchestrator
 * Bootstraps audio engine, MIDI, QWERTY input, Ableton device rack, and UI stations.
 */

import { audioCore } from "./audio/audio-core.js";
import { synthEngine } from "./audio/synth-engine.js";
import { midiManager } from "./midi/midi-manager.js";
import { GigHudUI } from "./components/gig-hud.js";
import { VirtualKeyboardUI } from "./components/virtual-keyboard.js";
import { LicenseModalUI } from "./components/license-modal.js";
import { licenseManager } from "./security/license-manager.js";
import { TritonWorkstationUI } from "./components/triton-workstation-ui.js";
import { multiLayerEngine } from "./audio/multi-layer-engine.js";
import { registerComponent } from "./components/component-registry.js";
import { initMobileDevice } from "./mobile/device.js";
import { initMemoryMonitor, emergencyFlushAll, onMemoryPressure } from "./audio/memory-manager.js";

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

  installGlobalErrorReporter() {
    if (window.__midikeyErrorReporterInstalled) return;
    window.__midikeyErrorReporterInstalled = true;

    const report = (msg) => {
      if (!msg) return;
      console.error("[MIDIKEY]", msg);
      // Persist crash detail SYNCHRONOUSLY to localStorage — if the crash kills
      // the WebView right after, the Performance Logger can still retrieve it
      // on the next app open (window.* dies with the WebView; disk does not).
      try {
        if (!window.__midikeyCrashLog) window.__midikeyCrashLog = [];
        const entry = {
          ts: new Date().toLocaleTimeString(),
          msg: String(msg).slice(0, 300),
          heap: (() => { try { return Math.round(performance.memory?.usedJSHeapSize / 1024 / 1024) || null; } catch (e) { return null; } })(),
          sound: (() => { try { return multiLayerEngine?.activeSingleInst || multiLayerEngine?.activeCombi?.id || null; } catch (e) { return null; } })(),
        };
        window.__midikeyCrashLog.push(entry);
        if (window.__midikeyCrashLog.length > 50) window.__midikeyCrashLog.shift();
        localStorage.setItem("wilsonix_crash_log", JSON.stringify(window.__midikeyCrashLog));
      } catch (e) {}
      const now = Date.now();
      if (
        this._lastErrorMsg === msg &&
        now - (this._lastErrorAt || 0) < 5000
      ) {
        return;
      }
      this._lastErrorMsg = msg;
      this._lastErrorAt = now;
      try {
        audioCore._diagToast?.("⚠ " + String(msg).slice(0, 140));
      } catch (e) {}
    };

    window.addEventListener("error", (e) => report(e.message || "Unknown error"));
    window.addEventListener("unhandledrejection", (e) => {
      const r = e.reason;
      let msg = "";
      if (r instanceof Error) msg = r.message;
      else if (r && r.message) msg = r.message;
      else if (typeof r === "string") msg = r;
      else msg = "Unhandled promise rejection";
      report(msg);
    });
  }

  start() {
    console.log("Initializing MidiKey Elite Workstation...");
    this.installGlobalErrorReporter();
    initMobileDevice();

    // Memory pressure monitor - MUST start early to catch OOM
    try { initMemoryMonitor(); } catch (e) { console.warn("Memory monitor:", e); }
    // Free cold decoded instruments on pressure so the heap never balloons
    // into GC thrash (scrolling/switching lag).
    try {
      onMemoryPressure((/* level */) => {
        const pcm = multiLayerEngine.pcmEngine;
        if (pcm && typeof pcm._maybeEvictDecodedBuffers === "function") {
          pcm._maybeEvictDecodedBuffers();
        }
      });
    } catch (e) {};

    // P3.5: Register Service Worker for PWA offline support
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Lazy-render flags
    this._viewsRendered = new Set();

    // 0. Pre-arm AudioContext and pre-decode PCM buffers into RAM on page boot
    try {
      audioCore.init();
      multiLayerEngine.init();
    } catch (e) {
      console.warn("Pre-arm audio:", e);
    }

    // Emergency flush on unload
    window.addEventListener("pagehide", () => emergencyFlushAll());
    window.addEventListener("beforeunload", () => emergencyFlushAll());

    // 0b. Restore working session (survives accidental refresh mid-gig)
    let restoredSession = null;
    const wasCrashed = multiLayerEngine.checkCrashRecovery();
    if (wasCrashed) {
      console.warn("[App] Detected previous crash - attempting session recovery");
    }
    try {
      restoredSession = multiLayerEngine.restoreSession();
    } catch (e) {
      console.warn("Session restore:", e);
    }

    // Mark clean shutdown on unload
    window.addEventListener("beforeunload", () => multiLayerEngine.markCleanShutdown());

    // 1. Immediate Audio Unlock & Auto-Close Setup
    const unlockGesture = () => {
      if (!this.unlocked) {
        try { audioCore.unlock(); } catch (e) {}
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
          splash.style.display = "none";
        }
      }
    };

    // Auto-attempt unlock immediately on startup
    unlockGesture();

    // Background passive unlock on first interaction if browser requires user gesture
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

    // 2. License Modal & Floating Status Pill
    const syncFloatingLicense = () => {
      const btn = document.getElementById("floating-license-btn");
      const label = document.getElementById("floating-license-label");
      if (!btn || !label) return;
      const access = licenseManager.getAccessStatus();
      label.textContent = access.badgeText;
      btn.className = `floating-license-pill ${access.badgeClass}`;
    };

    try {
      this.licenseModal = new LicenseModalUI("license-modal-mount", () => {
        if (this.gigHud) this.gigHud.refresh();
        syncFloatingLicense();
      });
      syncFloatingLicense();

      // Draggable license pill — restore saved position, distinguish drag vs click
      const pill = document.getElementById("floating-license-btn");
      if (pill) {
        const STORAGE_KEY = "wilsonix_license_pill_pos";
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
          if (saved && typeof saved.top === "number" && typeof saved.right === "number") {
            const safeTop = Math.max(46, Math.min(window.innerHeight - 36, saved.top));
            const safeRight = Math.max(8, Math.min(window.innerWidth - 100, saved.right));
            pill.style.top = safeTop + "px";
            pill.style.right = safeRight + "px";
          }
        } catch (e) {}

        let dragStartX = 0, dragStartY = 0, startTop = 0, startRight = 0;
        let didDrag = false;

        const onPointerDown = (e) => {
          if (e.button && e.button !== 0) return;
          dragStartX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
          dragStartY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
          startTop = parseInt(pill.style.top || "46", 10);
          startRight = parseInt(pill.style.right || "14", 10);
          didDrag = false;
          pill.classList.add("dragging");
          document.addEventListener("pointermove", onPointerMove);
          document.addEventListener("pointerup", onPointerUp);
        };

        const onPointerMove = (e) => {
          const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
          const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
          const dx = x - dragStartX;
          const dy = y - dragStartY;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
          const maxTop = window.innerHeight - pill.offsetHeight - 4;
          const maxRight = window.innerWidth - pill.offsetWidth - 4;
          pill.style.top = Math.max(46, Math.min(maxTop, startTop + dy)) + "px";
          pill.style.right = Math.max(8, Math.min(maxRight, startRight - dx)) + "px";
        };

        const onPointerUp = () => {
          pill.classList.remove("dragging");
          document.removeEventListener("pointermove", onPointerMove);
          document.removeEventListener("pointerup", onPointerUp);
          if (didDrag) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify({
                top: parseInt(pill.style.top, 10),
                right: parseInt(pill.style.right, 10),
              }));
            } catch (e) {}
          }
        };

        pill.addEventListener("pointerdown", onPointerDown);
        pill.addEventListener("click", () => {
          if (!didDrag) this.licenseModal?.open();
        });
      }
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
        : multiLayerEngine.settings.masterVolumePct;
      multiLayerEngine.setMasterVolumePct(pct);
      const volSlider = document.getElementById("hud-master-vol");
      const volReadout = document.getElementById("hud-master-vol-val");
      if (volSlider) volSlider.value = pct;
      if (volReadout) volReadout.innerText = `${pct}%`;
    } catch (e) {
      console.warn("Volume restore:", e);
    }

    // 4. Korg Triton Hardware TouchView Console (render immediately - default view)
    try {
      this.tritonConsole = new TritonWorkstationUI("triton-workstation-mount");
      registerComponent("tritonConsole", this.tritonConsole);
      this._viewsRendered.add("triton");
    } catch (e) {
      console.warn("TritonWorkstationUI init:", e);
    }

    // Virtual Keyboard - render immediately (always visible at bottom)
    try {
      this.virtualKeyboard = new VirtualKeyboardUI("virtual-keyboard-mount");
      this._viewsRendered.add("keys");
    } catch (e) {
      console.warn("VirtualKeyboardUI init:", e);
    }

    // Other views - lazy init on first activation with dynamic imports
    this._lazyViews = {
      combi: async () => {
        if (this._viewsRendered.has("combi")) return;
        try {
          const { MultiLayerUI } = await import("./components/multi-layer-ui.js");
          this.multiLayerConsole = new MultiLayerUI("multi-layer-mount");
          registerComponent("multiLayerConsole", this.multiLayerConsole);
          this._viewsRendered.add("combi");
        } catch (e) { console.warn("MultiLayerUI lazy init:", e); }
      },
      split: async () => {
        if (this._viewsRendered.has("split")) return;
        try {
          const { SplitConsoleUI } = await import("./components/split-console-ui.js");
          this.splitConsole = new SplitConsoleUI("split-console-mount");
          this._viewsRendered.add("split");
        } catch (e) { console.warn("SplitConsoleUI lazy init:", e); }
      },
      chords: async () => {
        if (this._viewsRendered.has("chords")) return;
        try {
          const { ChordPadsUI } = await import("./components/chord-pads.js");
          const { ClipLooper } = await import("./components/looper.js");
          this.chordPads = new ChordPadsUI("chord-pads-mount");
          this.looper = new ClipLooper("looper-mount");
          this._viewsRendered.add("chords");
        } catch (e) { console.warn("ChordPads/Looper lazy init:", e); }
      },
      demo: async () => {
        if (this._viewsRendered.has("demo")) return;
        try {
          const { DemoStationUI } = await import("./components/demo-station.js");
          this.demoStation = new DemoStationUI("demo-station-mount");
          this._viewsRendered.add("demo");
        } catch (e) { console.warn("DemoStationUI lazy init:", e); }
      },
      grooves: async () => {
        if (this._viewsRendered.has("grooves")) return;
        try {
          const { GroovePlayerUI } = await import("./components/groove-player-ui.js");
          this.grooveStation = new GroovePlayerUI("groove-station-mount");
          this._viewsRendered.add("grooves");
        } catch (e) { console.warn("GroovePlayerUI lazy init:", e); }
      },
      player: async () => {
        if (this._viewsRendered.has("player")) return;
        try {
          const { MediaPlayerUI } = await import("./components/media-player-ui.js");
          this.mediaPlayer = new MediaPlayerUI("media-player-mount");
          this.mediaPlayer.render();
          this._viewsRendered.add("player");
        } catch (e) { console.warn("MediaPlayerUI lazy init:", e); }
      },
      fx: async () => {
        if (this._viewsRendered.has("fx")) return;
        try {
          const { FxRackUI } = await import("./components/fx-rack-ui.js");
          this.fxRack = new FxRackUI("fx-rack-mount");
          this._viewsRendered.add("fx");
        } catch (e) { console.warn("FxRackUI lazy init:", e); }
      }
    };

    // 9. Non-blocking Web MIDI API Background Connect
    midiManager.init().catch(err => console.warn("MIDI init:", err));

    // 10. Apply saved theme
    document.documentElement.setAttribute("data-theme", multiLayerEngine.settings.theme);

    // 10b. Default View Mode: Triton VST Console
    const appRoot = document.getElementById("app-root");
    if (appRoot) {
      appRoot.classList.add("view-triton");
    }

    // 11. Workspace View Switcher (Delegated — survives HUD re-renders)
    const switchView = (view) => {
      if (!view) return;
      document.querySelectorAll(".ws-tab-btn[data-view]").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-view") === view);
      });

      const wsSelect = document.getElementById("hud-ws-tabs-select");
      if (wsSelect && wsSelect.value !== view) {
        wsSelect.value = view;
      }

      // Lazy-render the view on first activation
      if (this._lazyViews && this._lazyViews[view]) {
        this._lazyViews[view]();
      }

      if (appRoot) {
        appRoot.classList.remove(
          "view-all",
          "view-triton",
          "view-combi",
          "view-split",
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

      // SPLIT tab is the master split switch: select it → split ON, leave → OFF
      const splitOn = view === "split";
      multiLayerEngine.toggleSplitMode(splitOn);
      synthEngine.toggleSplitMode(splitOn);

      // Snap smoothly to stage deck when switching stage views
      const stageDeck = document.getElementById("studio-stage-deck");
      if (stageDeck && window.scrollY > 50) {
        stageDeck.scrollIntoView({ behavior: "smooth" });
      }

      // Remember last tab for restore
      multiLayerEngine.updateSetting("lastTab", view);
    };

    // Delegated click listener on document — handles .ws-tab-btn[data-view] and #btn-toggle-fullscreen
    document.addEventListener("click", (e) => {
      const tabBtn = e.target.closest(".ws-tab-btn[data-view]");
      if (tabBtn) {
        const view = tabBtn.getAttribute("data-view");
        switchView(view);
        return;
      }

      const fullBtn = e.target.closest("#btn-toggle-fullscreen");
      if (fullBtn) {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    });

    // Delegated dropdown change listener on document
    document.addEventListener("change", (e) => {
      if (e.target && e.target.id === "hud-ws-tabs-select") {
        switchView(e.target.value);
      }
    });

    // Restore last tab if enabled
    if (multiLayerEngine.settings.tabRestore) {
      let lastTab = multiLayerEngine.settings.lastTab;
      if (!lastTab || lastTab === "keys") lastTab = "triton";
      if (this._lazyViews && this._lazyViews[lastTab]) {
        this._lazyViews[lastTab]();
      }
      switchView(lastTab);
    }

    // 13. Fullscreen state sync from fullscreenchange
    const syncFullscreenState = () => {
      const fullBtn = document.getElementById("btn-toggle-fullscreen");
      if (fullBtn) {
        fullBtn.classList.toggle("active", !!document.fullscreenElement);
      }
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);

    // 14. Mobile Orientation & Resize Adaptation
    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        const rollContainer = document.getElementById("piano-roll-container");
        if (rollContainer) {
          const middleC = document.getElementById("key-midi-60");
          if (middleC) {
            rollContainer.scrollTo({
              left: Math.max(0, middleC.offsetLeft - (rollContainer.clientWidth / 2) + (middleC.offsetWidth / 2)),
              behavior: "smooth"
            });
          }
        }
      }, 150);
    });

    console.log("MidiKey Elite Ready. Zero-lag pipeline armed.");

    // Background suspend/resume for Android/iOS
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        audioCore.suspend();
        if (multiLayerEngine.looper) multiLayerEngine.looper.stopAllPlayback();
      } else {
        audioCore.resume();
      }
    });
    window.addEventListener("pagehide", () => audioCore.suspend());
    window.addEventListener("pageshow", () => audioCore.resume());

    // Dismiss startup stage boot loader smoothly
    setTimeout(() => {
      const loader = document.getElementById("app-startup-loader");
      if (loader) {
        loader.classList.add("fade-out");
        setTimeout(() => loader.remove(), 500);
      }
    }, 200);
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
