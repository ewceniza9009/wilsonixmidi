# WILSONIX MIDIKEY 🎹✨

> **Professional Zero-Latency Live Performance Digital Audio Workstation, Hybrid Rompler & Synthesizer**  
> *Engineered for high-pressure live stage gigs, church worship, recording studios, and mobile performance across Windows Desktop and Android.*

[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011%20(x64)-0078D6?style=for-the-badge&logo=windows)](https://github.com/ewceniza9009/wilsonixmidi/releases)
[![Platform: Android](https://img.shields.io/badge/Platform-Android%208.0%2B%20%7C%20ARM64-3DDC84?style=for-the-badge&logo=android)](https://github.com/ewceniza9009/wilsonixmidi/releases)
[![Audio: Web Audio API](https://img.shields.io/badge/Audio-Direct%20PCM%20%2B%20VA%20Engine-FF6F00?style=for-the-badge&logo=audio)](https://github.com/ewceniza9009/wilsonixmidi)
[![Framework: Tauri v2 + Vite](https://img.shields.io/badge/Framework-Tauri%20v2%20%7C%20Rust-673AB7?style=for-the-badge)](https://tauri.app/)
[![License: Proprietary](https://img.shields.io/badge/License-WILSONIX%20Commercial-red?style=for-the-badge)](https://github.com/ewceniza9009/wilsonixmidi)
[![Version: v1.1.5](https://img.shields.io/badge/Version-v1.1.5%20Build%2016%20Production-blue?style=for-the-badge)](https://github.com/ewceniza9009/wilsonixmidi/releases)

---

## 🚀 Official Production Downloads (v1.1.5 Build 16 Latest Release)

| Package / Distribution | Target Operating System | Architecture | Direct Download Link |
|:---|:---|:---:|:---:|
| **Windows Desktop Installer** | Windows 10 / 11 | x64 | [⬇️ Download NSIS Setup (`.exe`)](https://github.com/ewceniza9009/wilsonixmidi/releases/latest/download/WILSONIX.MIDIKEY_1.1.5_x64-setup.exe) |
| **Android Package (APK)** | Android 8.0+ (Oreo to Android 15) | ARM64 / x86_64 | [⬇️ Download Android APK (`.apk`)](https://github.com/ewceniza9009/wilsonixmidi/releases/latest/download/wilsonix-midikey.apk) |

*Official binaries and checksums are verified and hosted on the [GitHub Releases page](https://github.com/ewceniza9009/wilsonixmidi/releases).*

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
- 🎙️ **Lossless WAV Master Recorder + Media Player** — Pre-DAC waveform capture with a zero-gain monitor sink; MP3/WAV/FLAC/OGG/M4A/AAC backing-track deck with playlist support.
- 📊 **Hardware HUD & Diagnostics** — 60 FPS VU metering, real-time latency/CPU profiling, panic reset, and an 8-second pre-DAC waveform diagnostic tap.
- 🔒 **Crypto-Hardened Security & Licensing** — ECDSA P-256 signature verification with hardware machine binding, strict CSP, and boot-time re-validation of stored licenses.

*For the full deep-dive, see the [Master Feature Catalog](#-master-feature-catalog--core-capabilities) below.*

---

## 📑 Granular Changelog & Release Notes (v1.1.5 • Build 16)

### 1. 🛡️ Robust Setlist Schema & Null-Safety Validation
- **Deep Null-Safety Handling**: Updated `isValidSlot` in `setlist-validation.js` to use loose null checks (`!= null`), safely tolerating explicitly serialized `null` properties in external setlists without rejecting valid configuration snapshots.
- **Enhanced JSON Compatibility**: Allows seamless interoperability with third-party DAW bank exports and diverse cloud backup representations.

### 2. 🎶 Extended Multi-Genre Demo Song Bank & Live Arrangements
- **High-Energy Funk & Pop Arrangements**: Expanded the interactive Demo Station catalog with rich multi-section songs (including rolled chords, funk stabs, rising brass hits, and dynamic velocity profiling).
- **Zero-Latency Sequenced Preview**: Demonstrates acoustic Rompler polyphony, physical-modeled brass, and real-time DSP layering under realistic live performance conditions.

---

## 📑 Prior Release Notes (v1.1.4 • Build 15)

### 1. ⚙️ Real-Time Performance Settings & Damper Envelope Customization
- **Custom Sustain Damper Envelope**: Added configurable `sustainDecayTau` (0.5s–8.0s) and `sustainHoldSec` (3s–30s) controls to the Gig HUD Settings panel, giving performers custom acoustic damping response for both rapid chordal comps and soaring atmospheric pads.
- **Dynamic Polyphony Cap Governor**: Added a real-time voice limit slider (16–128 voices) dynamically binding `pcmEngine.MAX_VOICES`, optimizing CPU headroom for lower-powered mobile devices or opening up massive polyphony on high-performance desktop rigs.
- **Persistent Hardware Defaults**: Automatically stores and restores master volume, default velocity, default base octave (`C1`–`C7`), UI theme, and last active workspace tab in persistent storage.

### 2. 🔇 Layer Insert FX Instant Wet Flush & Zero-Tail Bleed
- **Immediate Wet Path Clamping**: `LayerInsertProcessor.flush()` and `setFx()` now instantly cancel scheduled automation curves and clamp wet gain (`setValueAtTime(0, now)`), preventing leftover reverb/delay tails when switching programs mid-performance.
- **Clean Combi Preset Transitions**: Combi patches without insert FX automatically apply clean bypass states with zero audio artifacts.

### 3. 🎼 Desktop Chord Genre Expand/Collapse Architecture
- **Multi-Row Genre Grid on Desktop**: Added an adaptive "More / Less" toggle button to the Chord Pad genre selector on desktop (`hover: hover` and `pointer: fine`), wrapping all genre banks into a clean, zero-scroll grid without clipping.
- **100% Touch Tablet Isolation**: Mobile and tablet interfaces retain their fluid horizontal swipe interaction pattern without layout shifts.

### 4. 🎨 Light/Dark Studio Themes & Draggable License Pill
- **High-Contrast Light Theme**: Added studio daylight mode with tailored neutral surfaces, maintaining crystal-clear readability under bright stage lighting.
- **Enhanced Touch/Pointer Pill Dragging**: Added `touch-action: none` and `user-select: none` to the floating license widget for silky-smooth dragging on both touchscreens and mouse input.

---

## 📑 Prior Release Notes (v1.1.3 • Build 14)

### 1. 🔇 Zero-Bleed Preset Switching & Buffer Flush
- **Master Output Muting During Rebuild**: Mutes output briefly during `applyPreset()` transitions to prevent residual reverbs, delays, or modulation tails from bleeding across preset changes.
- **Comprehensive FX State Reset**: Added `resetAllEffects()` to zero all modulation parameters, flush delay feedback buffers, zero reverb wet gains, and reset EQ/compressor to safe defaults before building new preset signal chains.
- **Instant Trim Gain Configuration**: Added instant gain value setting (`setPresetTrim(val, instant)`) during engine bootstrap to eliminate ramp-up latency.

### 2. 🎹 Preset Switch Sustain Auto-Clear & HUD Sync
- **Damper Pedal Auto-Release**: Force-clears active sustain pedal states when switching single instruments, synth programs, Triton VA patches, or Combi multi-layer setups.
- **Real-Time HUD State Synchronization**: Subscribes to `onSustainForceOffCallback` to immediately update `sustainPedal`, unlatch `sustainLatched`, and visually update the virtual keyboard HUD sustain button.

---

## 📑 Prior Release Notes (v1.1.2 • Build 13)

### 1. 🎧 Integrated Binaural Stage Monitor in Gig HUD
- **Real-Time Environment Switching**: Added in-ear stage monitor selector directly inside the Gig HUD Latency & Audio popover.
- **Persistent Spatial State**: Preserves and restores active spatial acoustic settings across latency profile toggles and Web Audio engine resets.
- **AudioWorklet Hardware Limiter Routing**: Cleanly routed all AudioWorklet synthesizer audio streams through the master hardware brickwall limiter.

---

## 📑 Prior Release Notes (v1.1.1 • Build 12)

### 0. 🎧 Binaural Stage Monitor — 3D Spatial Audio Engine
- **HRTF Spatialization**: Web Audio `PannerNode` with Head-Related Transfer Function places sound in true 3D space over headphones.
- **Synthetic Room Impulse Responses**: 5 procedural environments (Concert Hall, Studio, Stadium, Intimate, Cathedral) generated in real-time from acoustic parameters — no external IR files needed.
- **Dry/Wet Mix**: Room-size-dependent wet/dry blending with smooth crossfade between environments.
- **Real-Time Source Positioning**: `positionSource(x, y, z)` API for per-voice spatialization across the stereo field.
- **Zero-Latency Pipeline**: In-line Web Audio graph processing — no additional latency added to the signal chain.

### 1. 🎹 Same-Note Rapid Re-Trigger Voice Stealing & De-Click Micro-Fade
- **Zero Phase Flanging / Comb Filtering**: Rapid note repetitions (fast 16th notes, trills, repeated piano stabs) steal existing same-layer voices smoothly instead of piling up identical out-of-phase sample buffers.
- **4ms Anti-Click Micro-Fade**: Applies a sub-audible 4ms linear gain ramp-down (`linearRampToValueAtTime(0.0001, now + 0.004)`) before voice termination, eliminating audio pops and DC offset thumps.
- **Strict Multi-Layer Isolation**: Preserves independent voices on other layers during 4-timbre Combi stacking.
- **Sustained Voice Ringing Protection**: Prevents voice runaway when playing fast repetitive passages with the damper sustain pedal engaged.

### 2. 🖥️ Desktop Zero-Scroll Keyboard Toolbar Architecture
- **Adaptive Auto-Wrapping DAW Ribbon**: Toolbar responds dynamically to desktop viewports with a compact 26px height layout, ensuring all 13 performance modules are visible without horizontal scrolling.
- **Tablet Touch Workflow Intact**: Touch and tablet media queries (`pointer: coarse`) remain completely untouched and preserved.

---

## 📑 Prior Release Notes (v1.1.0 • Build 11)

### 1. 🎚️ Master Recorder Audio Tap Isolation & Zero-Gain Monitor Sink
- **Zero-Gain Sink Routing**: ScriptProcessor capture node now feeds an isolated zero-gain sink (`tapMute.gain = 0.0`) to keep audio buffer rendering active without double-monitoring or bypassing the master hardware limiter.
- **True Pre-DAC Waveform Capture**: Recorded output is completely clean and faithful without doubling the live monitor mix or altering gain staging during recording.

### 2. ⏱️ Audio-Clock Look-Ahead Arpeggiator Scheduling
- **Web Audio Timeline Grid**: Replaced naive cumulative `setTimeout` scheduling with high-precision Web Audio clock (`ctx.currentTime`) anchoring.
- **Zero Tempo Drift**: Eliminates timing jitter and tempo drift caused by main-thread UI repaints or background task scheduling during complex live performances.

### 3. 🛡️ Security Hardening, XSS Mitigation & Setlist Schema Validation
- **Pure Schema Validation**: Added `src/security/setlist-validation.js` with comprehensive validation (`isValidBanksShape`, `isValidSlot`, bounds and structure checking) for registration setlist imports and local storage.
- **UI Injection Protection**: Added HTML escaping (`esc()`) across layer names, combi presets, setlist entries, split zones, and hardware ID values.
- **Tauri Path Traversal Protection**: Added `is_safe_media_path()` in Rust backend to enforce media format whitelist, prevent path traversal (`..`), and reject control characters.
- **Content Security Policy (CSP)**: Configured strict production and development CSP headers in Tauri configuration.

### 4. 🪘 SFX DSP Engine Deduplication & Pitched Percussion
- **DSP Engine Cleanup**: Deduplicated legacy duplicate methods in `SfxSoundGenerator`, ensuring modern physical modeling synthesizers are consistently active.
- **Chromatic Cowbell Tuning**: Dynamic pitch ratio scaling (`587 * pitchMul`, `845 * pitchMul`) enables properly tuned percussion across all keys.
- **Pitch Bend Range Clamping**: Safely restricted pitch bend semitones strictly to `[-12, +12]` to prevent arithmetic overflow in voice oscillators.

### 5. 🧠 Event Listener Memory Optimization & Hotkey Separation
- **Pad Event Pooling**: Consolidated per-pad window mouseup listeners into a single shared handler (`_globalPadMouseUp`), preventing memory leakage during frequent UI re-renders.
- **Hotkey Collision Fix**: Assigned virtual piano keyboard collapse to `Ctrl+F4`, preserving `F1`–`F8` for dedicated 1-touch registration bank switching.

---

## 🌟 Master Feature Catalog & Core Capabilities

### 🎹 1. Dual-Core DSP Sound Engines
- **Direct Multi-Layer PCM Rompler**: 16-bit 44.1kHz sample streaming engine with multi-velocity soundboard modeling, sympathetic string resonance, and round-robin voice allocation.
- **Dual-Oscillator Virtual Analog (VA) Subtractive Synthesizer**: Features Time-Variant Filters (TVF) and Time-Variant Amplifiers (TVA), hard-sync oscillators (Brian's Sync Lead), multi-waveform generation (Saw, Square, Triangle, Sine, Pulse Width Modulation), and rich analog unison detune.
- **Physical Modeling Synthesizers**: Real-time physical acoustics for alto saxophone, breathy tenor sax, talkbox vocal tract formants, acoustic drums, cascara timbales, and Latin percussion.

### 🎚️ 2. 4-Timbre Multi-Layer Combinations (Combi)
- **4-Layer Stacking Architecture**: Stack up to four simultaneous timbres across PCM Rompler banks, Virtual Analog presets, and Soundfont instruments.
- **Per-Layer Controls**: Individual volume fader, stereo pan, octave transposition (-2 to +2), semitone fine-tune, velocity curve response, solo, and mute switches.
- **Instant Search & Categorized Preset Library**: 53 production combi combinations (13 starred signature stacks) with fast category filtering and single-click recall.

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

# 3. Run Automated Unit Test Suite & Linter
npm test
npm run lint

# 4. Build Windows Desktop NSIS Setup Installer (.exe)
npm run build:desktop
# Output: src-tauri/target/release/bundle/nsis/WILSONIX MIDIKEY_1.1.0_x64-setup.exe

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
