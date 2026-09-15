## 🚀 WILSONIX MIDIKEY v2.0.0 (Build 19 Production Release)

### 1. 🎹 Standard MIDI File Import & Button-Controlled Demo Playback
- **Drag-and-Drop MIDI Import**: Import `.mid` / `.midi` files into the Demo Station — a new zero-dependency MIDI parser (`midi-converter-engine.js`) decodes Note On/Off, velocity, duration, tempo, and time signatures into live sequenced playback with rock-solid timing.
- **Playback Volume Control**: Imported MIDI songs and built-in demos now have a dedicated demo volume fader so backing arrangements sit perfectly in the live keyboard mix.
- **Persistent Custom Song Library**: Imported MIDI demos are saved locally and survive restart for instant recall on stage.
- **New Clean Stage EP Combi**: Signature `clean_electric_piano` 4-timbre stack — Suit & Stage EP + FM Bell Tine + Warm Soft Strings + Pocket Bass, now the default demo instrument.

### 2. ⏱️ Held-Note Auto-Reset & Max-Sustain Limiter
- **Runaway-Note Protection**: Any note held past the configurable **Held Note Max** (2–60 s, default 15 s) is automatically and silently released in the audio engine — no more drone notes, hanging sus-pedal pads, or stuck sustain during chaotic live sets.
- **Per-Note Armed Timers**: Each held note arms its own limiter; key release cancels it, and the damper pedal keeps working normally for intentional lyrical sustains.
- **Audio-Only Reset**: The auto-reset path is pure audio — it never flashes the UI or retriggers hardware MIDI out.
- **HUD Control**: New **Held Note Max** slider in the Gig HUD to set the sustain ceiling live.

### 3. 🔊 Master-Bus Buzz/Hiss Elimination
- **Dead-Silent Rest State**: Eliminated persistent buzzing/hissing and high-frequency artifacts across the master WAV recorder sink, lookahead limiter detector, and router/synth sum buses — cleaner recordings and honest silence when idle.

### 4. 🧱 Demo Song Bank Modularization
- **20 Per-Song ES Modules**: The monolithic demo-song bank was refactored into individual modules under `src/audio/demo-songs/`, improving maintainability, tree-shaking, and dev hot-reload speed with identical song content.

---

### 📦 Release Binaries
- **Windows Desktop Setup**: `WILSONIX MIDIKEY_2.0.0_x64-setup.exe` (207 MB) — Windows 10 / 11 x64
- **Android APK**: `wilsonix-midikey.apk` — Android 8.0+ (ARM64 / x86_64)
- **Source Code**: Full source archive attached to this release

### ✅ Build Verification
- 63 automated unit tests — all passing
- ESLint — 0 errors
- Vite production build, Tauri Rust (NSIS) bundle, and Capacitor Android (Gradle) APK — all clean