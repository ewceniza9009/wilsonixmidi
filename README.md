# WILSONIX MIDIKEY 🎹✨

> **Professional Zero-Latency Live Performance Digital Audio Workstation, Hybrid Rompler & Synthesizer**  
> *Engineered for high-pressure live stage gigs, church worship, recording studios, and mobile performance across Windows Desktop and Android.*

[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011%20(x64)-0078D6?style=for-the-badge&logo=windows)](https://github.com/ewceniza9009/wilsonixmidi/releases)
[![Platform: Android](https://img.shields.io/badge/Platform-Android%208.0%2B%20%7C%20ARM64-3DDC84?style=for-the-badge&logo=android)](https://github.com/ewceniza9009/wilsonixmidi/releases)
[![Audio: Web Audio API](https://img.shields.io/badge/Audio-Direct%20PCM%20%2B%20VA%20Engine-FF6F00?style=for-the-badge&logo=audio)](https://github.com/ewceniza9009/wilsonixmidi)
[![Framework: Tauri v2 + Vite](https://img.shields.io/badge/Framework-Tauri%20v2%20%7C%20Rust-673AB7?style=for-the-badge)](https://tauri.app/)
[![License: Proprietary](https://img.shields.io/badge/License-WILSONIX%20Commercial-red?style=for-the-badge)](https://github.com/ewceniza9009/wilsonixmidi)
[![Version: v1.0.9](https://img.shields.io/badge/Version-v1.0.9%20Build%2010%20Production-blue?style=for-the-badge)](https://github.com/ewceniza9009/wilsonixmidi/releases)

---

## 🚀 Official Production Downloads (v1.0.9 Build 10 Latest Release)

| Package / Distribution | Target Operating System | Architecture | Direct Download Link |
|:---|:---|:---:|:---:|
| **Windows Desktop Installer** | Windows 10 / 11 | x64 | [⬇️ Download NSIS Setup (`.exe`)](https://github.com/ewceniza9009/wilsonixmidi/releases/latest/download/WILSONIX.MIDIKEY_1.0.9_x64-setup.exe) |
| **Android Package (APK)** | Android 8.0+ (Oreo to Android 15) | ARM64 / x86_64 | [⬇️ Download Android APK (`.apk`)](https://github.com/ewceniza9009/wilsonixmidi/releases/latest/download/wilsonix-midikey.apk) |

*Official binaries and checksums are verified and hosted on the [GitHub Releases page](https://github.com/ewceniza9009/wilsonixmidi/releases).*

---

## 📑 Granular Changelog & Release Notes (v1.0.9 • Build 10)

### 1. 🎤 Authentic Roger Troutman / Heil Physical Talkbox Emulation (`A045`)
- **Triple Formant Resonance Peaks**: High-gain series resonant peaking filters precisely tuned to physical human vocal tract cavities:
  - **F1 (Throat / Jaw Height)**: 650 Hz (+15 dB)
  - **F2 (Mouth Cavity / Tongue Shape)**: 1550 Hz (+14 dB)
  - **F3 (Nasal / Teeth Resonance)**: 2850 Hz (+10 dB)
- **Dynamic Vowel Articulation Morphing**: Key strikes trigger an organic vowel shape sweep (closed-mouth "W" consonant opening dynamically into "AH / OH / EE" singing vowels depending on velocity).
- **Physical Driver Saturation & Damping**: Heil Talk Box compression driver tube saturation curve with 5.4 kHz vinyl acoustic tube damping and brickwall vocal safety limiting.

### 2. 🥁 Real Acoustic Drum Kit & Physical Modeling Synthesis (Grooves & Soundbanks)
- **Zero-Latency 0.00ms Physical Modeling**: Instant strike response without heavyweight sample buffering.
- **Punchy Acoustic Sub-Kick**: Dual-layer 52 Hz / 36 Hz resonant sub-bass pitch envelope + acoustic wood beater attack click.
- **Crisp Acoustic Snare**: Resonant wood shell body + dual-band filtered wire rattle (>3.8 kHz) + rim/stick impact.
- **Metallic Bronze Hi-Hats with Instant Optical Choke**: Pure high-frequency bronze shimmer (>8.5 kHz) with natural decay on open hits and instant sub-millisecond choke when striking closed hats or pedal.
- **Cymbals & Latin Percussion**: Natural bell ping acoustic ride cymbal, explosive crash cymbal, resonant toms, Latin cowbell, and multi-tone wind chimes.

### 3. 🪘 Dedicated Congas & Analog Synth Drum Presets
- **Afro-Cuban Congas**: Open/slap acoustic conga synthesis mapped across soundbank `PRC07`, `C007`, and Combi preset `afro_cuban_congas`.
- **Analog Synth Drum (Simmons SDSV Space Drum)**: Classic 80s downward pitch-sweep space drum synth with sub-punch on `PRC11`, `C008`, `C009`, and Combi `analog_synth_drum_space`.
- **Studio Acoustic Kit**: Full General MIDI mapped acoustic kit preset on `PRC12` and Combi `studio_acoustic_kit`.

### 4. 🎹 Full Chromatic Pitch Tracking Across 88 Keys for Drums & Percussions
- Every key across all 88 keys now features distinct chromatic pitch tracking or General MIDI drum key mapping (from B0 to C6), replacing previous monotone percussions.

### 5. ⚡ Permanent Zero-Drop Web Audio Architecture
- Redesigned the entire FX rack routing with permanent static audio graph nodes.
- Eliminated dynamic node recreation and teardown disconnect timers, achieving zero audio dropouts, 0.00% CPU overhead when bypassed, and zero garbage collection memory spikes.

### 6. 🎛️ Live Preset Selection & TouchView Highlighting Fixes
- Resolved audio node connection exceptions across rotary speakers and chorus processors during rapid preset switching.

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
4. **★ Afro-Cuban Congas & Percussion**: Open/Slap Acoustic Congas + Latin Percussion + Grand Piano.
5. **★ Analog Synth Drum Space**: Simmons SDSV Synth Drum + 80s Analog Bass + Synth Brass.
6. **★ Studio Acoustic Drum Kit**: Full GM Acoustic Drum Set + Electric Bass + Rhodes EP.
7. **★ Lo-Fi Vintage Tape Rhodes**: Vintage Rhodes + Wow & Flutter Tape Saturation + 8-bit Vinyl Decimator.
8. **★ Tokyo City Pop**: Studio FM Piano + Stratocaster Guitar + Breathy Alto Sax.
9. **★ Chicago Blues Rock**: Overdriven Blues Strat + B3 Drawbar Organ + Walking Bass.
10. **★ Sunday Pipe Praise**: Cathedral Pipe Organ + Angelic Soprano Choir + Grand Piano.
11. **★ Neo-Soul Chill**: DX7 FM Tines + Breathy Sax + Lo-Fi Auto-Pan Rhodes.
12. **★ Gospel Praise**: Concert Grand + Hammond B3 Organ + Symphonic Strings.
13. **★ Acid Jazz Groove**: Dyno Tine EP + 90s Slap Bass + Leslie Rotary Organ.

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
| **IFX 9** | Heil Formant Talk Box | Formants F1/F2/F3, Vowel Morph, Tube Drive, Mix | Roger Troutman vocal articulation & Heil mouth tube modeling |
| **IFX 10** | Haas Stereo Spatial Widener | Width (0–250%), Haas Delay (1–35ms), Mix | Mid/Side psychoacoustic stereo widening without phase cancel |
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
# Output: src-tauri/target/release/bundle/nsis/WILSONIX MIDIKEY_1.0.9_x64-setup.exe

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
