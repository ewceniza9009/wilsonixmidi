# WILSONIX MIDIKEY 🎹✨

> **Professional Zero-Latency Live Performance Digital Audio Workstation, Hybrid Rompler & Synthesizer**  
> _Engineered for high-pressure live stage gigs, church worship, recording studios, and mobile performance across Windows Desktop and Android._

[![Platform: Windows](<https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011%20(x64)-0078D6?style=for-the-badge&logo=windows>)](https://github.com/ewceniza9009/wilsonixmidi/releases)
[![Platform: Android](https://img.shields.io/badge/Platform-Android%208.0%2B%20%7C%20ARM64-3DDC84?style=for-the-badge&logo=android)](https://github.com/ewceniza9009/wilsonixmidi/releases)
[![Audio: Web Audio API](https://img.shields.io/badge/Audio-Direct%20PCM%20%2B%20VA%20Engine-FF6F00?style=for-the-badge&logo=audio)](https://github.com/ewceniza9009/wilsonixmidi)
[![Framework: Tauri v2 + Vite](https://img.shields.io/badge/Framework-Tauri%20v2%20%7C%20Rust-673AB7?style=for-the-badge)](https://tauri.app/)
[![License: Proprietary](https://img.shields.io/badge/License-WILSONIX%20Commercial-red?style=for-the-badge)](https://github.com/ewceniza9009/wilsonixmidi)
[![Version: v2.0.2](https://img.shields.io/badge/Version-v2.0.2%20Build%2021%20Production-blue?style=for-the-badge)](https://github.com/ewceniza9009/wilsonixmidi/releases)

---

## 🚀 Official Production Downloads (v2.0.2 Build 21 Latest Release)

| Package / Distribution        | Target Operating System           |  Architecture  |                                                             Direct Download Link                                                              |
| :---------------------------- | :-------------------------------- | :------------: | :-------------------------------------------------------------------------------------------------------------------------------------------: |
| **Windows Desktop Installer** | Windows 10 / 11                   |      x64       | [⬇️ Download NSIS Setup (`.exe`)](https://github.com/ewceniza9009/wilsonixmidi/releases/latest/download/WILSONIX.MIDIKEY_2.0.2_x64-setup.exe) |
| **Android Package (APK)**     | Android 8.0+ (Oreo to Android 15) | ARM64 / x86_64 |        [⬇️ Download Android APK (`.apk`)](https://github.com/ewceniza9009/wilsonixmidi/releases/latest/download/wilsonix-midikey.apk)         |

_Official binaries and checksums are verified and hosted on the [GitHub Releases page](https://github.com/ewceniza9009/wilsonixmidi/releases)._

---

## ✨ Key Features at a Glance

- 🎹 **Hybrid Dual-Core Sound Engine** — Direct multi-layer PCM Rompler, dual-oscillator Virtual Analog subtractive synth (TVA/TVF, hard-sync leads), and physical-modeling brass, reeds, drums & percussion, engineered for zero-latency live performance.
- 🎚️ **4-Timbre Combi Stacking** — Stack up to four layers with per-layer volume, pan, octave, semitone and velocity control, plus a dual-zone split console with dynamic split point selection.
- 🎛️ **23-Device Hardware Master FX Rack** — Optical compressor, auto-wah, talkbox formant filter, tube drive, bitcrusher, vinyl lo-fi tape, Haas stereo widener, auto-pan, 6-stage phaser, flanger, Dimension-D chorus, Leslie rotary, tremolo, slapback, dub echo, ping-pong delay, spring/shimmer/gated/algorithmic reverb, tape saturation, and a master EQ-limiter — plus 22 Triton IFX/MFX algorithms and 35 per-layer insert FX for 80+ named algorithm choices.
- 🎧 **Binaural Stage Monitor — 3D Spatial Audio** — HRTF-based 3D spatialization for in-ear headphones. Simulates concert hall, studio, stadium, intimate club, and cathedral environments using synthetic room impulse responses. Zero-latency head tracking with real-time source positioning.
- 🥁 **Physical-Modeling Drums & Percussion** — Acoustic kick, wood-shell snare, bronze hi-hats, and chromatically tuned Latin percussion (cowbell, cascara timbales, congas) with true zero-latency strike response.
- 💾 **Stage Registration Memory (32 Rigs)** — 4 Banks × 8 Slots with `F1`–`F8` instant recall, full live-state snapshots, and schema-validated JSON setlist import/export.
- 🎹 **12-Pad MPC Chord Matrix & Scale Engine** — One-touch Jazz, Gospel, Neo-Soul and Pop voicings (24-chord learn bank, 11 genre banks) with a quantizing scale/key lock engine.
- 🔁 **Clock-Anchored Arpeggiator & Multi-Track Looper** — Web Audio look-ahead scheduling keeps tempo rock-solid under heavy stage load.
- 🎹 **Standard MIDI File Import** — Drag-and-drop `.mid`/`.midi` demo playback with tempo, velocity, and duration parsing plus a dedicated playback volume and persistent custom song library.
- ⏱️ **Held-Note Max-Sustain Limiter** — Auto-resets runaway held notes (2–60s configurable ceiling) silently in the audio engine to stop drone notes and stuck sustains mid-gig.
- 🎙️ **Lossless WAV Master Recorder + Media Player** — Pre-DAC waveform capture with a zero-gain monitor sink; MP3/WAV/FLAC/OGG/M4A/AAC backing-track deck with playlist support.
- 📊 **Hardware HUD & Diagnostics** — 60 FPS VU metering, real-time latency/CPU profiling, panic reset, and an 8-second pre-DAC waveform diagnostic tap.
- 🔒 **Crypto-Hardened Security & Licensing** — ECDSA P-256 signature verification with hardware machine binding, strict CSP, and boot-time re-validation of stored licenses.

_For the full deep-dive, see the [Master Feature Catalog](#-master-feature-catalog--core-capabilities) below._

---

## 📑 Granular Changelog & Release Notes (v2.0.2 • Build 21)

### 1. ☀️ Light Theme — Keyboard Deck Strip

- **Full Light-Mode Keyboard HUD**: New `light-app.css` (400 lines) provides complete light-theme coverage for the keyboard deck strip — pitch bend / mod / air wheels, octave mini-picker, velocity accent pills, curve accent strip, hide-keys toggle, and the sustain latch + pedal LED. All styles are 100% scoped to `[data-theme="light"]` with zero runtime cost in dark mode.

### 2. 🔊 Session Clip Looper Volume Control

- **Dedicated Loop Volume Slider**: New **LOOP VOL** fader (10–100%, default 55%) in the looper header lets performers ride the clip playback level under their live preset without affecting the master mix or individual layer gains.
- **Per-Note Gain Scaling**: The looper gain multiplier is applied at the note-scheduling layer (`L.gain * this.looperGain`), keeping the audio worklet sample loop untouched for zero added latency.

### 3. 🎛️ New Live SFX Instruments

- **⚡ Sound System Laser Zap** (`laser_zap`): Punchy electronic laser sweep for DJ transitions and drops.
- **🎺 Dancehall Stage Airhorn Blast** (`dub_horn`): Classic dancehall/reggae airhorn one-shot for live hype.
- **💣 Heavy 808 Sub-Boom / Bass Drop** (`sub_boom`): Deep 808-style sub-bass boom for trap and EDM drops.
- **🌊 White Noise Sweep & Transition Riser** (`noise_riser`): Building white noise riser for tension and transitions.

### 4. 🧹 Codebase Formatting & Hygiene

- **Prettier Standardization**: Applied consistent code formatting across `gig-hud.js` — object literals expanded to multi-line, arrow function parentheses normalized, string quotes standardized to double-quotes. Zero logic changes.

---

## 📑 Prior Release Notes (v2.0.1 • Build 20)

### 1. 🔁 Clip Looper Sustain-Playback Fix

- **Sticky Sustain Flag Elimination**: Resolved a critical looper bug where a clip played back with sustain would latch the per-bus `sustainActive` flag onto all 4 buses of that track — meaning any clip subsequently recorded with the damper pedal **up** still played back with sustain. Looper buses now reset to the recorded initial-sustain state at every loop iteration and on playback start/stop, so clips always faithfully reproduce exactly what was played during recording.
- **Accurate Initial-Sustain Capture**: Recording now reads the real-time pedal state from the correct engine property (`multiLayerEngine.sustainPedalActive`) instead of a dead accessor, ensuring clips recorded with the pedal held down correctly open with sustain.

### 2. 📱 Rig Bank Touch-Size Overhaul (Tablet & Mobile)

- **Bigger Tap Targets**: Rig bank/slot pills grew from ~12–16px to comfortable **34px desktop / 36px tablet** touch targets with proper flex-centering, so performers can hit register recalls reliably on tablets and phones.
- **Tablet No-Longer-Shrinks**: The ≤1200px media query previously shrank rig buttons with `!important`; it now enforces the roomier 36px sizes instead.
- **Drawer Height Raised**: The tools drawer expanded height was bumped from 48/44px to **56px** so the larger pills fully fit.

---

## 📑 Prior Release Notes (v2.0.0 • Build 19)

### 1. 🎹 MIDI File Import & Smart Demo Station Playback

- **Drag-and-Drop Standard MIDI File Import**: Import `.mid`/`.midi` files directly into the Demo Station — a zero-dependency MIDI parser (`midi-converter-engine.js`) reads Note On/Off, velocity, duration, tempo, and time signatures, converting them into live sequenced playback with correct timing.
- **Playback Volume Control**: Imported MIDI songs and built-in demos now have a dedicated demo volume fader, letting performers blend backing arrangements against the live keyboard mix.
- **Custom Song Library Persistence**: Imported MIDI demos are saved to `localStorage` as a personal custom demo collection, reloaded on next launch.
- **Clean Stage EP Combi (`clean_electric_piano`)**: New signature 4-timbre stack pairing a clean stage electric piano with warm companion layers for polished worship/gospel ballad work.

### 2. 🎚️ Held-Note Auto-Reset & Max-Sustain Limiter

- **Max-Sustain Protection**: Any note held longer than the configurable **Held Note Max** (2–60 seconds, default 15s) is automatically, silently released in the audio engine — eliminating runaway drone notes, hanging sustained pads, and stuck sustains during chaotic live segments.
- **Per-Note Arsenal Timer**: Each held note arms its own limiter; releasing the key cancels it while the damper pedal continues normally for intentional lyrical sustains.
- **Fully Audio-Only Reset**: The auto-reset pathway bypasses visuals/midi-out so it never flashes UI or retriggers hardware — just clean silence.
- **HUD Control**: New **Held Note Max** slider in the Gig HUD to dial the sustain ceiling live.

### 3. 🔊 Master-Bus Buzz/Hiss Elimination

- **Complete Master-Bus Noise Overhaul**: Eliminated persistent buzzing/hissing and high-freq artifacts across the entire chain — master recorder (WAV) sink, lookahead limiter detector, and router/synth sum buses — for a dead-silent rest state and cleaner recordings.

### 4. 🧱 Demo Song Engine Modularization

- **Per-Song Module Split**: The monolithic demo-song bank was refactored into 20 dedicated per-song ES modules under `src/audio/demo-songs/` — dramatically improving maintainability, tree-shaking, and hot-reload speed without changing song content.

---

## 📑 Prior Release Notes (v1.1.7 • Build 18)

### 1. 🔁 Champion 4-Track Synchronized Clip Looper & Preset Freezing

- **Per-Track Preset Snapshot & Dedicated Looper Buses**: Freezes the full 4-layer Combi configuration at record time and routes playback through 16 dedicated stereo sub-buses (`looperInserts[trackId][layerSlot]`), allowing live performers to freely switch instruments/presets on the keyboard without altering the sound of playing loops.
- **Beat-Snapped Loop Seams & Count-In Metronome**: Clean 1-bar count-in audio clicks, automatic beat-length quantization, 30ms seam guard, and orphan note-off filtering for glitch-free loop turnarounds.
- **Isolated Looper Sustain**: Looper tracks maintain their own independent sustain state without colliding with live damper pedal releases.

### 2. 🎸 New Combi Presets & Sound Staging

- **The Final Countdown** (`final_countdown`): Signature Europe Supersaw Lead + M1 Universe Pad layer.
- **Europe Ambient** (`europe_ambient`): Celestial M1 Universe Pad with cathedral reverb diffusion.
- **Synthesizer You Gain Calibration**: Tuned lead layers to 0.85 gain for safe multi-layer chord summing without master limiter squashing.

### 3. 🎛️ DSP Headroom & Effect Filter Optimization

- **`warm_eq` Low Shelf**: Calibrated low-shelf gain to 1.0dB to eliminate sub-bass rumble on heavy chords.
- **`spring_surf` & `opto_tremolo_16th`**: Refined resonance Q (2.5) and tremolo pulse speed (5.5Hz) for organic vintage acoustic tone.

---

## 📑 Prior Release Notes (v1.1.6 • Build 17)

### 1. 🎚️ Expanded Signature 4-Timbre Combi Presets

- **Curated Multi-Genre Sound Stacks**: Added and finely calibrated 7 signature 4-timbre combis:
  - **Neo-Soul Chill**: Studio DX7 FM Piano + Warm Strings + Celestial Universe Pad + Finger Sub Bass.
  - **Lo-Fi Study Beats**: Abletunes Felt Upright Piano + Vibraphone + Mellow Upright Bass + Korg M1 Universe Air.
  - **Lo-Fi Vintage Tape Rhodes**: Vintage Stage Rhodes + Organic Kalimba Bell + Upright Bass + Vinyl String Pad.
  - **Bossa Nova Sunset**: Abletunes Upright Piano + Acoustic Bass + Vibraphone + Soft Air Pad.
  - **Acid Jazz Groove**: Dyno FM EP + Resonant Synth Bass + Bright Brass Stabs + Triton Lead.
  - **Blue Note Trio**: 24-bit Abletunes Upright Grand + Upright Bass + Jazz Organ + Soft Pad.
  - **Synthesizer You**: 4-Layer Triton Analog Poly Synth stack.
- **Dynamic Headroom Equalization**: Integrated automated `1 / sqrt(N)` combi scaling and bus pad protection (`0.45`), preventing master limiter clipping on dense multi-voice chords.

### 2. 🎛️ Gig HUD & Preset Ribbon Interactive Integration

- **Direct Ribbon Recall**: Updated the **★ SIGNATURE 4-TIMBRE COMBIS** bank in `gig-hud.js` with instant category indexing and one-touch loading.
- **Visual Status Feedback**: Instant HUD badge synchronization with active combi layers and split configurations.

### 3. 🎹 Virtual Keyboard Touch Tracking & Hardware Acceleration

- **Smooth 60 FPS Rendering**: Applied CSS hardware-accelerated transforms (`transform: translateZ(0)` and `will-change: transform`) to virtual piano keys.
- **Multi-Touch Precision**: Retained pointer and touch event maps for fluid, chord-ready performance on Android tablets and touch monitors.

### 4. 🔒 Pro License Manager & Android WebView Robustness

- **Software Hash Fallback**: Resilient device-bound activation key generation even when Android WebView disables WebGL/Canvas fingerprinting.
- **Null-Safe Setlist Validator**: Seamless loading of external JSON setlist files without crashes from uninitialized or null layer properties.

---

## 📑 Prior Release Notes (v1.1.5 • Build 16)

### 1. 🛡️ Robust Setlist Schema & Null-Safety Validation

- **Deep Null-Safety Handling**: Updated `isValidSlot` in `setlist-validation.js` to use loose null checks (`!= null`), safely tolerating explicitly serialized `null` properties in external setlists without rejecting valid configuration snapshots.
- **Enhanced JSON Compatibility**: Allows seamless interoperability with third-party DAW bank exports and diverse cloud backup representations.

### 2. 🎶 Extended Multi-Genre Demo Song Bank & Live Arrangements

- **High-Energy Funk & Pop Arrangements**: Expanded the interactive Demo Station catalog with rich multi-section songs (including rolled chords, funk stabs, rising brass hits, and dynamic velocity profiling).
- **Zero-Latency Sequenced Preview**: Demonstrates acoustic Rompler polyphony, physical-modeled brass, and real-time DSP layering under realistic live performance conditions.

---

## 🌟 Master Feature Catalog & Core Capabilities

### 🎹 1. Dual-Core DSP Sound Engines

- **Direct Multi-Layer PCM Rompler**: 16-bit 44.1kHz sample streaming engine with multi-velocity soundboard modeling, sympathetic string resonance, and round-robin voice allocation.
- **Dual-Oscillator Virtual Analog (VA) Subtractive Synthesizer**: Features Time-Variant Filters (TVF) and Time-Variant Amplifiers (TVA), hard-sync oscillators (Brian's Sync Lead), multi-waveform generation (Saw, Square, Triangle, Sine, Pulse Width Modulation), and rich analog unison detune.
- **Physical Modeling Synthesizers**: Real-time physical acoustics for alto saxophone, breathy tenor sax, talkbox vocal tract formants, acoustic drums, cascara timbales, and Latin percussion.

### 🎚️ 2. 4-Timbre Multi-Layer Combinations (Combi)

- **4-Layer Stacking Architecture**: Stack up to four simultaneous timbres across PCM Rompler banks, Virtual Analog presets, and Soundfont instruments.
- **Per-Layer Controls**: Individual volume fader, stereo pan, octave transposition (-2 to +2), semitone fine-tune, velocity curve response, solo, and mute switches.
- **Instant Search & Categorized Preset Library**: 56 production combi combinations (32 starred signature stacks) with fast category filtering and single-click recall.

### ✂️ 3. Split Keyboard Performance Console

- **Dual Performance Zones**: Divide the 88-key keybed into independent Lower Zone (bass/accompaniment) and Upper Zone (lead/piano/brass).
- **Dynamic Split Point Selection**: Select split points via direct visual keyboard clicking or quick numeric MIDI key selection.
- **Independent Zone Sound Selection**: Assign any Rompler instrument, Triton VA program, or custom stack to either zone with distinct octave transpositions.

### 🎛️ 4. 23-Device Hardware Master FX Rack

- **Chain & Per-Layer Insert FX (80+ Algorithm Choices)**: A dynamically rebuilt serial FX chain with zero-latency fast-path bypass, plus 22 Triton IFX/MFX algorithms and 35 per-layer insert FX for a total of 80+ named DSP algorithms.
- **IFX Opto-Compressor (Studio Dynamics)**: Optical-style peak leveling, threshold, ratio, attack, release, and makeup gain for drum punch and piano sustain.
- **IFX Rhodes Auto-Pan**: Dynamic stereo ping-pong panning with speed and depth modulation.
- **IFX Dimension D Stereo Chorus**: Multi-voice Roland/Dimension-D style analog chorus widening.
- **IFX Valve Force Tube Drive**: Hyperbolic tangent soft-clipping tube saturation with tone control.
- **IFX 6-Stage Vintage Phaser**: Sweeping phase notch filters with feedback resonance for funk and clavinet.
- **IFX Leslie 122 Rotary Speaker Cabinet**: Authentic dual-rotor Doppler acceleration with Chorale (slow) and Tremolo (fast) brake switching.
- **IFX Stereo Tape Flanger**: Resonant comb-filter jet flanging with polarity inversion.
- **IFX Vintage Optical Tremolo**: Photocell amplitude pulsing for surf guitars and vintage keys.
- **IFX Retro Bitcrusher / Decimator**: 2-bit to 16-bit word length reduction and downsampling (1kHz to 20kHz) for vintage sampler grit.
- **IFX Heil Formant Talk Box**: Triple formant vocal cavity filter (F1 650Hz, F2 1550Hz, F3 2850Hz) with dynamic vowel morphing (Roger Troutman style).
- **IFX Haas Stereo Spatial Widener**: Psychoacoustic psycho-stereo delay widening without mono phase cancellation.
- **MFX Ping-Pong Tape Delay**: Tempo-synchronized cross-feedback stereo delay lines.
- **MFX Concert Hall & Plate Reverb**: Lush diffusion reverberation with customizable decay, pre-delay, and high-frequency damping.
- **Spring, Shimmer & Gated Reverbs**: Retro spring tank, celestial octave shimmer, and 80s gated-snare cannon algorithms.
- **Vinyl Lo-Fi Tape & Master Tape Saturation**: Wow/flutter pitch wobble with warm HF rolloff, and a master glue tape curve with output trimming.
- **Dynamic Auto-Wah**: Envelope-follower filter sweep from clean to funky nasal tone.
- **Master 3-Band Parametric EQ & Limiter**: Low shelf (80–90Hz), sweepable mid peaking (1.4kHz), high shelf (8.5–10kHz), and a brickwall lookahead limiter calibrated to -1.0 dB.
- **Master Kaoss Dynamic Filter**: Real-time lowpass filter frequency and resonance modulation via touch/mouse X/Y pad.

### 🥁 5. Real Acoustic Drum Kit & Physical Modeling Percussion

- **Zero-Latency Physical Synthesis**: Instant strike response with 0.00ms latency.
- **Acoustic Sub-Kick**: Dual-layer 52Hz/36Hz resonant pitch envelope with acoustic wood beater transient.
- **Wood Shell Snare**: Dual-band filtered wire rattle (>3.8kHz) with rimshot impact dynamics.
- **Optical Choke Bronze Hi-Hats**: Dynamic open-hat decay with instant sub-millisecond optical choking on closed hits or pedal triggers.
- **Full Percussion Palette**: Afro-Cuban congas (slap/open), Latin cowbell (chromatically tuned across keys), cascara timbales, crash cymbals, ride bells, and Simmons SDSV space drums.
- **Full 88-Key Drum Mapping**: Chromatic pitch tracking or General MIDI drum key mapping across all 88 keys.

### 💾 6. Stage Registration Memory & Live Setlist Manager

- **32 Live Rig Snapshots**: 4 Banks (A, B, C, D) × 8 Slots (1–8) for instant 1-touch sound switching during live gigs.
- **Full State Snapshot**: Stores and recalls Combi 4-timbre stacks, Rompler instruments, Triton VA programs, split points, FX parameters, master octave, and velocity curves.
- **Hardware Keyboard Hotkeys**: Direct slot recalls via `F1`–`F8` keys, bank cycling, and `Ctrl+F4` piano collapse.
- **JSON Setlist Import & Export**: Export entire performance setlists to JSON files and import on any stage device with pure schema verification.

### 🎛️ 7. 12-Pad MPC Chord Trigger Matrix & Scale Engine

- **12 Velocity-Sensitive Chord Pads per Bank**: 11 banks — Basic Chords (all 24 major/minor triads), Worship & Ballad, Neo-Soul, Gospel Praise, 90s R&B, Jazz Fusion, Pop Anthems, City Pop, Lo-Fi Chill, Latin Bossa, and 80s Synthwave — each triggering rich multi-note voicings with a single touch.
- **Custom Voicings & Strumming**: Realistic humanized strum offsets, adjustable velocity curves, and chord editing.
- **Scale & Key Lock Engine**: Quantize all incoming keyboard and pad notes to Chromatic (off), Major, Natural Minor, Harmonic Minor, Pentatonic Major, Pentatonic Minor, Gospel Blues, or Dorian scales.

### 🔁 8. Live Groove Arpeggiator & Performance Looper

- **High-Precision Clock Look-Ahead**: Web Audio clock anchoring eliminates tempo drift under heavy system load.
- **6 Arp Patterns**: Up, Down, Up/Down, Random, Chord Strum, and Live Groove.
- **Multi-Track Live Looper**: Overdub live performance layers, synchronize with master BPM, and clear or bounce loops on the fly.

### 🎙️ 9. Lossless Master WAV Recorder & Media Player

- **Pre-DAC True Waveform Tap**: Direct capture of the master audio stream into uncompressed 16-bit stereo WAV at the live engine sample rate.
- **Zero-Gain Monitor Sink**: Audio recorder runs completely silently without double-monitoring or altering stage mix levels.
- **Backing Track Media Player**: Built-in audio deck supporting MP3, WAV, FLAC, OGG, M4A, and AAC with playlist queues, pitch/speed shifts, and background playback.

### 📊 10. Hardware HUD & Real-Time Diagnostics

- **60 FPS VU Meter**: Dual-channel stereo peak and RMS level indicators.
- **Latency & CPU Engine Profiler**: Live monitoring of Web Audio base latency, output latency, and buffer stability with 3 switchable latency profiles (Stage Ultra-Low ~2.9ms, Balanced Studio ~5.8ms, Safe Stage ~11.6ms).
- **Master Kaoss X/Y Pad**: Multi-touch and mouse gesture control for real-time filter sweeps and effects modulation.
- **Panic Engine Reset**: Instant one-click kill switch for stuck MIDI notes and DSP node recovery.
- **8-Second WAV Waveform Diagnostic Tap**: Instant capture and download of real-time audio output for signal diagnosis.

### 🔌 11. MIDI Hardware Connectivity & MIDI Learn

- **Web MIDI API**: Plug-and-play USB/Bluetooth MIDI keyboard controller support.
- **MIDI Learn & CC Mapping**: Map any hardware knob, fader, or modulation wheel to filter cutoff, volume, pan, or FX dry/wet.
- **Velocity Curve Shaping**: 3 selectable velocity response profiles (Linear, Punch, Soft).

### 🎧 12. Binaural Stage Monitor — 3D Spatial Audio Engine

- **HRTF Head-Related Transfer Function**: Web Audio `PannerNode` with HRTF spatialization places sound sources in true 3D space over headphones.
- **Synthetic Room Impulse Responses**: Procedurally generated stereo convolution reverbs — no external IR files required. Each environment is computed in real-time from acoustic parameters (room size, decay time, early reflections, damping, pre-delay).
- **5 Studio-Grade Environments**:
  - **Concert Hall** — Large symphony hall with wide stereo image and 2.2s reverb tail.
  - **Studio** — Treated recording room with tight 0.6s decay and controlled early reflections.
  - **Stadium** — Massive arena with 3.5s decay and long pre-delay slapback.
  - **Intimate** — Small jazz club with warm 0.4s decay and close mic feel.
  - **Cathedral** — Infinite 5.0s reverb with shimmering high-frequency diffusion.
- **Dry/Wet Mix Control**: Blends spatialized wet signal with dry source based on room size — smaller rooms = more dry, larger rooms = more wet.
- **Real-Time Source Positioning**: `positionSource(x, y, z)` API for per-voice spatialization — pan sounds across the stereo field with HRTF precision.
- **Zero-Latency Processing**: Entirely in-line on the Web Audio graph — no additional latency added to the signal chain.
- **Headphone-Optimized**: Designed specifically for in-ear monitors and closed-back headphones. Not for speaker playback (HRTF requires binaural rendering).

### 🔒 13. Enterprise-Grade Security & Licensing Architecture

- **ECDSA P-256 SPKI Cryptographic Verification**: Offline cryptographic license signature verification using public key cryptography.
- **Boot-Time License Re-Validation**: Stored licenses are cryptographically re-verified against the embedded public key on every launch, auto-reverting forged or tampered records.
- **Hardware Machine Fingerprinting**: Secure, non-invasive device ID generation for authorized workstation deployments.
- **Tauri Security Boundary**: Strict Content Security Policy (CSP), directory traversal protection, and file path verification.

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
14. **★ Clean Stage Electric Piano**: Suit & Stage EP + FM Bell Tine + Warm Soft Strings + Pocket Bass.

---

## 🏗️ Architectural Overview & Signal Flow

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
|                                  MASTER OUTPUT CHAIN                                  |
|  +-----------------------------------+  +-------------------------------------------+ |
|  | 23-Device Master FX Rack          |  | Binaural Stage Monitor                    | |
|  | (Compressor → Drive → Chorus →    |  | (HRTF PannerNode → ConvolverNode →       | |
|  |  Delay → Reverb → EQ → Limiter)   |  |  Synthetic IR → Dry/Wet Mix)             | |
|  +-----------------------------------+  +-------------------------------------------+ |
+---------------------------------------------------------------------------------------+
|                                  HARDWARE PLATFORMS                                   |
|       Windows Desktop (Tauri v2 / Rust)       |        Android Mobile & Tablet        |
+---------------------------------------------------------------------------------------+
```

---

## 📱 Android Tablet & Xiaomi HyperOS Configuration Tip

Xiaomi tablets (MIUI / HyperOS) have a system-wide gesture enabled by default that intercepts 3 simultaneous touches to capture screenshots. To play 3+ finger chords freely without interruption:

1. Open **Settings** on your tablet.
2. Navigate to **Additional settings** → **Gesture shortcuts**.
3. Under **Take a screenshot**, select **None** (or disable _Slide 3 fingers down_).
4. Under **Partial screenshot**, disable _Press and hold with 3 fingers_.
5. _(Optional)_: Add MIDIKey to Xiaomi's **Game Turbo** app and enable **"Turn off 3-finger screenshot"** for automatic stage isolation.

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

# 3. Run Automated Unit Test Suite & Linter
npm test
npm run lint

# 4. Build Windows Desktop NSIS Setup Installer (.exe)
npm run build:desktop
# Output: src-tauri/target/release/bundle/nsis/WILSONIX MIDIKEY_2.0.2_x64-setup.exe

# 5. Build Android APK (.apk)
npm run build:apk
# Output: dist-apk/wilsonix-midikey.apk

# 6. Build All Platforms Simultaneously
npm run build:all
```

---

## 📜 License & Intellectual Property

Copyright © 2026 **Erwin Wilson Ceniza / WILSONIX**. All rights reserved.  
All custom DSP algorithms, soundbank binaries, and interface designs are proprietary. Unauthorized reverse engineering, distribution of cracked binaries, or extraction of cryptographic keys is strictly prohibited.
