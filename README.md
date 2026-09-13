# WILSONIX MIDIKEY 🎹✨

> **Professional Zero-Latency Live Performance Digital Audio Workstation, Hybrid Rompler & Synthesizer**  
> *Engineered for high-pressure live stage gigs, church worship, recording studios, and mobile performance across Windows Desktop and Android.*

[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011%20(x64)-0078D6?style=for-the-badge&logo=windows)](https://github.com/ewceniza9009/wilsonixmidi/releases)
[![Platform: Android](https://img.shields.io/badge/Platform-Android%208.0%2B%20%7C%20ARM64-3DDC84?style=for-the-badge&logo=android)](https://github.com/ewceniza9009/wilsonixmidi/releases)
[![Audio: Web Audio API](https://img.shields.io/badge/Audio-Direct%20PCM%20%2B%20VA%20Engine-FF6F00?style=for-the-badge&logo=audio)](https://github.com/ewceniza9009/wilsonixmidi)
[![Framework: Tauri v2 + Vite](https://img.shields.io/badge/Framework-Tauri%20v2%20%7C%20Rust-673AB7?style=for-the-badge)](https://tauri.app/)
[![License: Proprietary](https://img.shields.io/badge/License-WILSONIX%20Commercial-red?style=for-the-badge)](https://github.com/ewceniza9009/wilsonixmidi)
[![Version: v1.0.6](https://img.shields.io/badge/Version-v1.0.6%20Production-blue?style=for-the-badge)](https://github.com/ewceniza9009/wilsonixmidi/releases)

---

## 🚀 Official Production Downloads (v1.0.6 Latest Release)

| Package / Distribution | Target Operating System | Architecture | Direct Download Link | File Size |
|:---|:---|:---:|:---:|:---:|
| **Windows Desktop Installer** | Windows 10 / 11 | x64 | [⬇️ Download NSIS Setup (`.exe`)](https://github.com/ewceniza9009/wilsonixmidi/releases/latest/download/WILSONIX_MIDIKEY_1.0.6_x64-setup.exe) | `~217 MB` |
| **Android Package (APK)** | Android 8.0+ (Oreo to Android 15) | ARM64 / x86_64 | [⬇️ Download Android APK (`.apk`)](https://github.com/ewceniza9009/wilsonixmidi/releases/latest/download/wilsonix-midikey.apk) | `~233 MB` |

*Official binaries and checksums are verified and hosted on the [GitHub Releases page](https://github.com/ewceniza9009/wilsonixmidi/releases).*

---

## 📑 Granular Changelog & Release Notes (v1.0.6)

### 1. 🎹 Live Stage Rig Snapshots & Instant Performance Recall
- **8-Slot Rig Memory per Bank**: Store and recall entire multi-layer combinations, active FX chains, master EQ curves, transpositions, and split points with a single keypress (`F1`–`F8`) or touch.
- **Seamless Live Patch Switching**: Voice-pool preservation ensures sustained chords do not abruptly cut off when switching rigs or instruments mid-song.
- **Dedicated Setlist Manager**: Sequence complex song arrangements with custom tempo markers, layer mutes, and instantaneous pedal triggers.

### 2. ⚡ Live Preset Selection & TouchView Highlighting
- **Reactivity & Engine Synchronization**: Fixed cross-component state desynchronization between `multiLayerEngine`, `GigHudUI`, and `TritonWorkstationUI`. Selecting any sound (e.g. `USER A 015 R&B E.Piano`) from the grid, top HUD badge, combi mixer, or registration rig instantaneously:
  - Updates the blue Triton LCD display (`BANK: USER A 015`, `CATEGORY: ELECTRIC PIANO`, Title: `R&B E.Piano`).
  - Illuminates the corresponding grid cell with a bright neon blue highlight (`.triton-prog-cell.active`).
  - Refreshes the top Performance HUD dropdown without stale option mismatches.
- **Sub-Millisecond Touch Response**: Migrated all program grid cells, bank selectors, chord pads, and FX toggles to native `pointerdown` / `touchstart` event listeners, eliminating the 300ms mobile touch delay.
- **Pointer-Events Shielding**: Child labels (`.prog-name-label`, `.prog-num`, `.prog-star`, `.prog-bank-code`) are shielded with `pointer-events: none;` to ensure 100% reliable tap hit-testing across tablets and touchscreen laptops.

### 3. ⏳ Animated Startup Stage Boot Loader
- **Stage-Ready Visual Booting**: Replaced blank black startup screen transitions with an animated hardware console bootloader featuring a spinning neon ring, brand crest, dynamic progress track, and stage status readout.
- **Smooth Fade-Out**: Seamlessly dissolves when sound engines and PCM buffers finish bootstrapping.

### 4. 🎹 Expressive Dynamic Touch Velocity & TVF Filtering
- **Dynamic TVA / TVF Tracking**:
  - **Soft Touch (Velocity 1–40)**: Natural warm harmonic response with low-pass filter cutoff seated at 1,000 Hz and smooth acoustic decay.
  - **Medium Velocity (Velocity 41–90)**: Balanced studio clarity with full dynamic presence.
  - **Hard Strike (Velocity 91–127)**: Complete overtone excitation up to 20,000 Hz brilliance with punchy transient attack.
- **Stage Velocity Curves**: One-tap toggle on the HUD and keyboard between:
  - **LIN**: Linear 1:1 natural acoustic response.
  - **PUNCH**: Power exponent (0.50) designed to cut through dense band mixes and live concert speakers.
  - **SOFT**: Intimate exponential curve (1.85) tailored for ballads, expressive neo-soul chords, and delicate classical passages.

---

## 🌟 Architectural Overview & Core Capabilities

```
+---------------------------------------------------------------------------------------+
|                                  WILSONIX MIDIKEY ELITE                               |
+---------------------------------------------------------------------------------------+
|  [Hardware HUD] Master Vol | Transpose | 60FPS VU Meter | Rig Snapshots | Workspace  |
+---------------------------------------------------------------------------------------+
|                                    WORKSPACE CONSOLES                                 |
|  +------------------+  +------------------+  +------------------+  +----------------+ |
|  | KORG TouchView   |  | 4-Timbre Combi   |  | Split Keyboard   |  | Ableton Device | |
|  | Workstation Main |  | Layer Mixer Rack |  | Console (Upper/L)|  | Master FX Rack | |
|  +------------------+  +------------------+  +------------------+  +----------------+ |
+---------------------------------------------------------------------------------------+
|                                     DSP AUDIO ENGINE                                  |
|  +-------------------------------------+  +-----------------------------------------+ |
|  | Direct Multi-Layer PCM Rompler      |  | Dual-Oscillator Virtual Analog (VA)     | |
|  | (16-bit 44.1kHz High-Density Banks) |  | Subtractive Synthesizer with TVA & TVF  | |
|  +-------------------------------------+  +-----------------------------------------+ |
+---------------------------------------------------------------------------------------+
|                                  HARDWARE PLATFORMS                                   |
|       Windows Desktop (Tauri v2 / Rust)       |        Android Mobile & Tablet        |
+---------------------------------------------------------------------------------------+
```

---

## 🎹 Comprehensive Soundbanks & Instrument Library

### 1. 🎛️ Bank A: Workstation Main & Iconic Stage Hits
- **`A036` Velo Piano ST**: Multi-velocity Concert Grand Piano with physical soundboard and sympathetic string resonance modeling.
- **`A015` R&B E.Piano**: Warm, bell-like 90s electric piano with harmonic tine harmonics.
- **`A001` Fat Brass**: Multi-timbre analog brass section with punchy envelope stabs.
- **`A005` Dark Jazz-Organ**: B3 jazz drawbar organ with authentic Leslie 122 rotary speaker emulation.
- **`A006` SG Hybrid Piano**: Acoustic grand layered with crystal DX7 FM digital tines.
- **`A010` Smooth Sine Lead**: Pure analog gliding mono/poly lead for west coast and R&B solos.
- **`A017` Brian's Sync Lead**: High-gain synchronized oscillator lead cutting through dense live drums.
- **`A020` Studio Stage EP**: Vintage Fender Rhodes Mark I suitcase with stereo auto-pan.
- **`A025` Phantom of Tine**: Ethereal bell-tine EP with shimmering modulation.
- **`A026` Breathy Alto Sax**: Expressive acoustic alto saxophone with authentic breath vibrato.
- **`A045` Roger Troutman Talkbox Lead**: Authentic vocal formant talkbox lead inspired by Zapp & Roger.
- **`A037` Overdriven Guitar**: Tube-driven rock guitar with natural harmonic feedback.
- **`A042` Distortion Guitar**: Heavy power-chord distortion guitar for rock and metal accompaniment.
- **`A043` Abletunes FM DX7 Piano**: Crisp 6-operator FM electric piano.
- **`A044` Abletunes Studio Upright Piano**: Intimate, felted upright piano for lo-fi and worship ballads.

### 2. 🌌 Korg M1 Legendary Soundbank
- **M1 Piano 16'**: Iconic 90s house and dance acoustic piano.
- **M1 03 Ooh-Ahh**: Legendary formant vocal choir multisample (Queen / 90s House staple).
- **M1 Organ 2**: Deep club house and gospel organ.
- **M1 Universe**: Sweeping celestial ambient pad with crystalline air.
- **M1 Slap Bass**: Punchy thumb-slap bass with fast percussive transients.

### 3. 🎷 Genuine Sax & Expressive Reeds
- **Solo Alto Sax**: Full-register acoustic saxophone with dynamic breath pressure sensitivity.
- **Sensual 80s Breathy Sax**: Warm sub-tone saxophone for smooth jazz and ballad melodies.
- **Dirty Blues Growl**: High-velocity guttural saxophone growl for blues and rock solos.

### 4. 🎚️ 4-Timbre Multi-Layer Combinations (Combi)
1. **★ Kingston Bubble & Reggae Skank**: B3 Tonewheel Organ + Concert Grand + Muted Reggae Guitar Skank.
2. **★ Celestial Shimmer & Grand**: Concert Grand Piano + Octave Shimmer Reverb + Ambient String Pad.
3. **★ Roger Troutman Talkbox Funk**: Talkbox Lead + Moog Punch Bass + Strat Funk Chank.
4. **★ Lo-Fi Vintage Tape Rhodes**: Vintage Rhodes + Wow & Flutter Tape Saturation + 8-bit Vinyl Decimator.
5. **★ Tokyo City Pop**: Studio FM Piano + Stratocaster Guitar + Breathy Alto Sax.
6. **★ Chicago Blues Rock**: Overdriven Blues Strat + B3 Drawbar Organ + Walking Bass.
7. **★ Sunday Pipe Praise**: Cathedral Pipe Organ + Angelic Soprano Choir + Grand Piano.
8. **★ Neo-Soul Chill**: DX7 FM Tines + Breathy Sax + Lo-Fi Auto-Pan Rhodes.
9. **★ Gospel Praise**: Concert Grand + Hammond B3 Organ + Symphonic Strings.
10. **★ Acid Jazz Groove**: Dyno Tine EP + 90s Slap Bass + Leslie Rotary Organ.
11. **★ Blue Note Trio**: Studio Upright Piano + Acoustic Nylon Guitar + Upright Walking Bass.
12. **★ Neo-Classical Ambient**: Concert Grand + Nylon Guitar + Lush Cello Ensemble.
13. **★ Synthesizer You**: Signature Neo-Soul Tape Rhodes with wide chorus and plate reverb.

### 5. 🚨 Sound Effects, Dub Siren & Reggae FX
- **🚨 Jamaican Dub Siren**: Oscillating square/sine dub siren with tempo-synced tape feedback echo.
- **💥 Vintage Spring Reverb Splash**: Dub crash spring tank kick effect.
- **⚡ Sound System Laser Zap**: High-frequency downward frequency sweep for dancehall transitions.
- **🎺 Dancehall Airhorn Blast**: Multi-voiced brass airhorn fanfare.
- **💣 808 Sub-Boom**: Subterranean 30Hz bass drop with soft saturation.
- **🌊 White Noise Sweep Riser**: 4-bar ascending transition riser for live drops.

---

## 🎛️ 102 Algorithm Hardware Master FX Rack

| FX Slot | Processor Name | Core Parameters | Character & Target Instruments |
| :--- | :--- | :--- | :--- |
| **IFX 0** | Studio Dynamics Compressor | Thresh, Ratio, Attack, Release, Makeup, Mix | Peak leveling, punchy drum bus, acoustic piano sustain |
| **IFX 1** | Rhodes Stereo Auto-Pan | Rate (0.2–8Hz), Depth, Mix | Ping-pong stereo field modulation for Rhodes & Wurli |
| **IFX 2** | Dimension D Stereo Chorus | Rate, Depth, Wet/Dry Mix | Rich analog ensemble widening for strings & pads |
| **IFX 3** | Valve Force Tube Drive | Drive, Tone (2k–16kHz), Mix | Hyperbolic tangent soft-clipping for guitars, organs & leads |
| **IFX 4** | 6-Stage Vintage Phaser | Rate (0.1–5Hz), Mix, Feedback | Sweeping phase notches for funk guitars & clavs |
| **IFX 5** | Leslie 122 Rotary Cabinet | Slow (Chorale) / Fast (Tremolo), Drive, Mix | Authentic dual-rotor Doppler acceleration for B3 organs |
| **IFX 6** | Stereo Tape Flanger | Rate, Feedback, Mix | Jet-plane resonant comb-filtering for leads & synth stabs |
| **IFX 7** | Vintage Optical Tremolo | Rate (0.5–12Hz), Depth, Mix | Photocell amplitude pulsing for surf guitars & vintage keys |
| **IFX 8** | Retro Bitcrusher / Decimator | Bits (2–16), Downsample (1k–20kHz), Drive, Mix | 8-bit / 12-bit vintage sampler crunch and aliasing |
| **IFX 9** | Haas Stereo Spatial Widener | Width (0–250%), Haas Delay (1–35ms), Mix | Mid/Side psychoacoustic stereo widening without phase cancel |
| **MFX 1** | Ping-Pong Tape Delay | Division (1/16 to 1/1), Feedback, Mix | Dual-channel tempo-synchronized stereo echo |
| **MFX 2** | Concert Hall / Plate Reverb | Decay (0.5–5s), Room Size, Pre-Delay, Mix | Smooth diffusion reverberation for live stage ambiance |
| **MEQ** | Master 3-Band Parametric EQ | Low (80Hz), Mid (1.4kHz), High (10kHz) | Master console output sweetening and stage tone balancing |

---

## 📱 Android Tablet & Xiaomi HyperOS Configuration Tip

Xiaomi tablets (MIUI / HyperOS) have a system-wide gesture enabled by default that intercepts 3 simultaneous touches to capture screenshots. To play 3+ finger chords freely without interruption:

1. Open **Settings** on your tablet.
2. Navigate to **Additional settings** → **Gesture shortcuts**.
3. Under **Take a screenshot**, select **None** (or disable *Slide 3 fingers down*).
4. Under **Partial screenshot**, disable *Press and hold with 3 fingers*.
5. *(Optional)*: Add MIDIKey to Xiaomi's **Game Turbo** app and enable **"Turn off 3-finger screenshot"** for automatic stage isolation.

---

## 🛠️ Technology Stack & Dependencies

- **Desktop Host**: [Tauri v2](https://v2.tauri.app/) (Rust 1.70+, Windows MSVC 64-bit, NSIS installer builder)
- **Mobile Host**: [Capacitor 8.x](https://capacitorjs.com/) (Android SDK 34, Java 17, Gradle)
- **Audio DSP Architecture**: Direct HTML5 Web Audio API Graph, Custom PCM Buffer Streaming & Virtual Analog Oscillators
- **Security Engine**: Web Crypto API (`crypto.subtle`) with ECDSA P-256 / SHA-256 SPKI Public Key Verification
- **Frontend Architecture**: Vanilla ES6+ Modular Architecture, Zero UI Framework Bloat, Hardware-Accelerated CSS3

---

## 💻 Building from Source

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **Rust Toolchain**: `1.70+` with `x86_64-pc-windows-msvc`
- **Visual Studio 2022**: C++ Build Tools & Windows 10/11 SDK
- **NSIS**: `3.x` (managed automatically by Tauri)
- **Android Studio & SDK**: (Required only when compiling the `.apk`)

### Build Commands
```bash
# 1. Clone repository
git clone https://github.com/ewceniza9009/wilsonixmidi.git
cd wilsonixmidi
npm install

# 2. Start Live Development Server
npm run dev

# 3. Build Windows Desktop NSIS Setup Installer (.exe)
npm run build:desktop
# Output: src-tauri/target/release/bundle/nsis/WILSONIX MIDIKEY_1.0.6_x64-setup.exe

# 4. Build Android APK (.apk)
npm run build:apk
# Output: dist-apk/wilsonix-midikey.apk

# 5. Build All Platforms Simultaneously
npm run build:all
```

---

## 📜 License & Intellectual Property

Copyright © 2026 **Erwin Wilson Ceniza / WILSONIX**. All rights reserved.  
All custom DSP algorithms, soundbank binaries, and interface designs are proprietary. Unauthorized reverse engineering, distribution of cracked binaries, or extraction of cryptographic keys is strictly prohibited.
