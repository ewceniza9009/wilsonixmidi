# WILSONIX MIDIKEY 🎹✨

> **Professional Zero-Latency Live Performance Digital Audio Workstation & Rompler**  
> *Engineered for High-Pressure Live Gigs, Church & Studio Performances across Windows Desktop and Android.*

[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%20x64-0078D6?style=for-the-badge&logo=windows)](https://github.com/ewceniza9009/wilsonixmidi/releases)
[![Platform: Android](https://img.shields.io/badge/Platform-Android%2014+-3DDC84?style=for-the-badge&logo=android)](https://github.com/ewceniza9009/wilsonixmidi/releases)
[![Audio: Web Audio API](https://img.shields.io/badge/Audio-Direct%20PCM%20Engine-FF6F00?style=for-the-badge&logo=audio)](https://github.com/ewceniza9009/wilsonixmidi)
[![Framework: Tauri v2 + Vite](https://img.shields.io/badge/Framework-Tauri%20v2%20%7C%20Rust-673AB7?style=for-the-badge)](https://tauri.app/)
[![License: Proprietary](https://img.shields.io/badge/License-WILSONIX%20Commercial-red?style=for-the-badge)](https://github.com/ewceniza9009/wilsonixmidi)

---

## 🚀 Quick Downloads

| Installer / Package | Target System | Direct Link | File Size |
|:---|:---|:---:|:---:|
| **Windows Desktop Installer** | Windows 10 / 11 (x64) | [⬇️ Download `.exe` Setup](https://github.com/ewceniza9009/wilsonixmidi/releases/latest/download/WILSONIX.MIDIKEY_1.0.0_x64-setup.exe) | ~207 MB |
| **Android Package** | Android 8.0+ (ARM64 / x86_64) | [⬇️ Download `.apk`](https://github.com/ewceniza9009/wilsonixmidi/releases/latest/download/wilsonix-midikey.apk) | ~221 MB |

*Or inspect all installer builds and assets on the official [GitHub Releases page](https://github.com/ewceniza9009/wilsonixmidi/releases).*

---

## 🌟 Overview & Key Features

**WILSONIX MIDIKEY** is a stage-ready digital workstation designed to eliminate the latency, bloat, and crashes of traditional software synths. Built with a direct Web Audio API pipeline, Rust backend via Tauri v2, and high-density native PCM multisamples, it gives keyboardists and live performers instant response and studio sound quality.

### 1. 🎹 Multi-Layer PCM Rompler & Legendary Soundbanks
- **Acoustic & Electric Pianos**: Korg Triton Grand Pianos, Dark Ballad Grands, Fender Rhodes Mark I & II, Wurlitzer 200A, and Dyno-My-Piano EP layers.
- **Organs & Keyboards**: B3 Tonewheel Jazz & Rock organs with Leslie rotary simulation, pipe organs, harpsichords, and clavichords.
- **Strings & Orchestral**: Fast staccato violins, lush symphonic string ensembles, tremolo strings, pizzicato, and cellos.
- **Brass & Reeds**: Brass sections, punchy synth stabs, trumpets, tenor sax, flutes, and clarinets.
- **Synth Leads & Resonators**: Oberheim/Moog-style leads, punchy basslines, and custom sub-bass resonators.

### 2. 🗣️ Human Vox & Formant Synthesis
- **Authentic Korg M1 `ooh_ahh` Multisamples**: Classic 90s house and gospel vocal textures.
- **Angelic Soprano Choir**: 5-pole formant vocal tract modeling simulating vowel formant frequencies ($F_1, F_2, F_3, F_4, F_5$) with natural singer vibrato.
- **Warm Male Hum**: Rich fundamental baritone hum with subtle chest resonance.
- **Live Performance Vocal Shouts**: Genuine sampled vocal shouts ("Yeah!", "Hey!") ready for real-time live drop-ins.

### 3. 🔔 Orchestral & Crystal Chimes
- **Tubular Church Chimes**: Physical modeling based on Euler-Bernoulli beam equations with realistic inharmonic non-integer partial modes ($f \times [1, 2.76, 5.4, 8.93]$).
- **Mark Tree Wind Chimes**: 12-bar chromatic high-register cascading glissando with randomized wind velocity.
- **Crystal Shimmer Chimes**: Crystalline glassy bells with lingering shimmering decay.

### 4. 🎛️ High-Density Master FX Rack
An 8-processor master FX rack featuring a compact, ergonomic UI designed for live performance laptops:
- **Studio Reverb**: Convolution & Schroeder algorithmic reverb with decay and wet/dry blend.
- **Tempo-Synced Delay**: Multi-tap echo delay with feedback and sync ratios.
- **3-Band Parametric EQ**: Low Shelf, Parametric Mid (with Q control), and High Shelf mastering EQ.
- **Tube Overdrive**: Asymmetric hyperbolic tangent soft-clipping for analog warmth.
- **Stereo Chorus**: Dual LFO phase-modulated chorus for widening string and pad layers.
- **Master Compressor / Limiter**: Dynamic peak limiting to prevent digital clipping during fortissimo passages.
- **Stereo Widener**: Mid/Side phase-offset spatial enhancer.
- **Lo-Fi Bitcrusher**: Variable sample-rate reduction and bit-depth decimation for vintage digital textures.

### 5. ⚡ Live Gig Performance HUD
- **Instant Transpose**: One-click chromatic transposition (±12 semitones) without touching MIDI controllers.
- **Chord Pads & Split Keyboard**: Pre-programmed chord voicings and customizable keyboard split-zones.
- **Velocity Sensitivity Curves**: Linear, Exponential, Compressed, and Fixed velocity response curves.
- **Multi-Engine Voice Pooling**: Dynamic voice allocation preventing voice-stealing artifacts or audio dropouts.

---

## 🛠️ Technology Stack

- **Desktop Framework**: [Tauri v2](https://v2.tauri.app/) (Rust 1.70+, Windows MSVC 64-bit, NSIS bundler)
- **Mobile Framework**: [Capacitor](https://capacitorjs.com/) 8.x (Android SDK 34, Java 17, Gradle)
- **Audio Engine**: Direct HTML5 Web Audio API Graph with Custom PCM Rompler and DSP Shapers
- **Frontend Architecture**: Vanilla ES6+ Modules, High-Performance DOM Virtualization, Hardware-Accelerated CSS3

---

## 💻 Building from Source

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **Rust**: `1.70+` with `x86_64-pc-windows-msvc` toolchain
- **Visual Studio 2022**: C++ Build Tools & Windows SDK
- **NSIS**: `3.x` (installed automatically by Tauri or via Chocolatey/winget)
- **Android Studio / SDK**: (Only needed for building the Android `.apk`)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ewceniza9009/wilsonixmidi.git
cd wilsonixmidi
npm install
```

### 2. Development Mode
```bash
# Run web live preview on http://localhost:3000
npm run dev

# Run desktop app in Tauri dev environment
npm run dev:desktop
```

### 3. Build Windows Desktop Installer (.exe)
```bash
npm run build:desktop
```
> The output NSIS installer will be generated in:  
> `src-tauri/target/release/bundle/nsis/WILSONIX MIDIKEY_1.0.0_x64-setup.exe`

### 4. Build Android APK
```bash
npm run build:android
```
> The output APK will be placed in:  
> `dist-apk/wilsonix-midikey.apk`

---

## 🧹 Cache Cleaning Utility

To prevent disk saturation when working on flash drives or partitioned disks (e.g. Drive `X:`), custom safe cache cleanup utilities are included:

```bash
# Clean local project build artifacts (target/, dist/, .vite/)
npm run clean

# Clean Drive X safe build caches
npm run clean:drive-x
```
*Guaranteed safe: Strictly whitelisted against target build artifacts; never deletes source files, git histories, or configuration.*

---

## 📜 License & Copyright

Copyright © 2026 **Erwin Wilson Ceniza / WILSONIX**. All rights reserved.  
Unauthorized copying, reverse engineering, redistribution, or modification of proprietary soundbank binaries and DSP algorithms is strictly prohibited.
