## 🚀 WILSONIX MIDIKEY v2.0.2 (Build 21 Production Release)

**Activation modal redesign, keyboard controls HUD strip overhaul, split console theme fix, looper sustain bugfix, session looper volume control, 4 new live SFX instruments, and tablet touch-target overhaul.**

### What's New / Fixed

#### 🎨 Pro Activation & Access Modal Redesign
- **Glassmorphic Hardware Dialog**: Replaced plain modal with a glassmorphic container featuring gradient borders, backdrop blur, and depth drop-shadows.
- **Illuminated Status & Hardware ID**: Monospace terminal capsule (`HWID: DEV_...`) with cyan glow and animated copy feedback; pulsing amber/green status LEDs for Evaluation and Pro tiers.
- **2-Column Feature Comparison**: Replaced raw bullet points with structured standard vs pro feature cards with custom icon badges.
- **Responsive Stacking**: Seamlessly scales and stacks on mobile/tablets without clipping soft keyboards.

#### 🎹 Keyboard Controls HUD Strip Overhaul
- **Unified DAW Hardware Dock**: Replaced mismatched white button boxes with a unified DAW top bar with segmented control bays.
- **Modular Grouping**: Expression wheels bay, Octave segment (`- OCT` | `C4` | `+ OCT` | `C3-C5`), Scale lock & performance tools, Dynamics & velocity presets (`PP` · `MP` · `MF` · `FF` · `SFZ`), and illuminated Sustain latch LED.
- **Clean Scale Selectors**: Borderless transparent dropdowns for Root and Scale modes that blend directly into the module pill.

#### 🌓 Split Keyboard Console Theme Harmonization
- **Dark Studio Console Integrity**: Scoped `.split-console-view` and `.split-keyboard-console` under `[data-theme="light"]` so all labels, hints, and subtexts retain high-contrast readability (`#cbd5e1` / `#94a3b8`) over dark hardware surfaces.
- **High-Visibility Controls**: Inset search inputs, effect selectors, and octave buttons (`-12`, `+12`) styled for maximum stage visibility.

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
