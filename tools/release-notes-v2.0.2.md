## 🚀 WILSONIX MIDIKEY v2.0.2 (Build 21 Production Release)

**Looper sustain bugfix, light theme keyboard deck, session looper volume control, 4 new live SFX instruments, and tablet touch-target overhaul.**

### What's New / Fixed

#### 🔁 Clip Looper Sustain-Playback Fix
- **Sticky sustain flag eliminated**: Looper buses now reset to the recorded initial-sustain state at every loop iteration and on playback start/stop, so clips always faithfully reproduce exactly what was played during recording.
- **Accurate initial-sustain capture**: Recording now reads the real-time pedal state from the correct engine property (`multiLayerEngine.sustainPedalActive`).

#### 📱 Rig Bank Touch-Size Overhaul (Tablet & Mobile)
- **Bigger tap targets**: Rig bank/slot pills grew from ~12–16px to comfortable **34px desktop / 36px tablet** touch targets.
- **Tablet no-longer-shrinks**: The ≤1200px media query now enforces the roomier 36px sizes.
- **Drawer height raised**: Tools drawer expanded height bumped from 48/44px to 56px.

#### ☀️ Light Theme — Keyboard Deck Strip
- **Full light-mode keyboard HUD**: New `light-app.css` provides complete light-theme coverage for pitch bend / mod / air wheels, octave mini-picker, velocity accent pills, curve accent strip, hide-keys toggle, and sustain latch + pedal LED. 100% scoped to `[data-theme="light"]`.

#### 🔊 Session Clip Looper Volume Control
- **Dedicated LOOP VOL fader** (10–100%, default 55%) lets performers ride clip playback level under their live preset without affecting the master mix.

#### 🎛️ New Live SFX Instruments
- ⚡ **Sound System Laser Zap** (`laser_zap`)
- 🎺 **Dancehall Stage Airhorn Blast** (`dub_horn`)
- 💣 **Heavy 808 Sub-Boom / Bass Drop** (`sub_boom`)
- 🌊 **White Noise Sweep & Transition Riser** (`noise_riser`)

#### 🧹 Codebase Formatting & Hygiene
- Prettier standardization across `gig-hud.js` — zero logic changes.

### Downloads

| Package | Target OS | Architecture | Direct Download |
|:---|:---|:---:|:---|
| **Windows Desktop Installer** | Windows 10 / 11 | x64 | `WILSONIX.MIDIKEY_2.0.2_x64-setup.exe` |
| **Android APK** | Android 8.0+ | ARM64 / x86_64 | `wilsonix-midikey.apk` |

### Full Changelog
See the [README](https://github.com/ewceniza9009/wilsonixmidi#-granular-changelog--release-notes-v202--build-21) for granular feature details.

_Built with Tauri v2 + Rust | Web Audio API | Capacitor Android_
