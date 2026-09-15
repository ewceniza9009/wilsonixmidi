## 🚀 WILSONIX MIDIKEY v2.0.1 (Build 20 Hotfix Release)

**Critical looper-sustain bugfix + tablet/mobile touch-target overhaul.**

### What's New / Fixed

#### 🔁 Clip Looper Sustain-Playback Fix
- **Sticky sustain flag eliminated**: A clip played back with sustain would latch the per-bus `sustainActive` flag onto all 4 buses of that track, meaning any clip subsequently recorded with the damper pedal **up** still played back with sustain. Looper buses now reset to the recorded initial-sustain state at every loop iteration and on playback start/stop.
- **Accurate initial-sustain capture**: Recording now reads the real-time pedal state from the correct engine property (`multiLayerEngine.sustainPedalActive`), ensuring clips recorded with the pedal held down correctly open with sustain.

#### 📱 Rig Bank Touch-Size Overhaul
- **Bigger tap targets**: Rig bank/slot pills grew from ~12–16px to comfortable **34px desktop / 36px tablet** touch targets with proper flex-centering, so performers can hit register recalls reliably on tablets and phones.
- **Tablet no-longer-shrinks**: The ≤1200px media query previously shrank rig buttons with `!important`; it now enforces the roomier 36px sizes instead.
- **Drawer height raised**: The tools drawer expanded height was bumped from 48/44px to 56px so the larger pills fully fit.

### Downloads

| Package | Target OS | Architecture | Direct Download |
|:---|:---|:---:|:---|
| **Windows Desktop Installer** | Windows 10 / 11 | x64 | `WILSONIX.MIDIKEY_2.0.1_x64-setup.exe` (207 MB) |
| **Android APK** | Android 8.0+ | ARM64 / x86_64 | `wilsonix-midikey.apk` (221 MB) |

### Full Changelog
See the [README](https://github.com/ewceniza9009/wilsonixmidi#-granular-changelog--release-notes-v201--build-20) for granular feature details.

_Built with Tauri v2 + Rust | Web Audio API | Capacitor Android_
