# WILSONIX MIDIKEY 🎹✨

> **Professional Ultra-Low Latency Live Performance Workstation, Hybrid Rompler & Synthesizer**
> _Engineered for high-pressure live stage gigs, touring keyboardists, bands, session players, and mobile performance. Built Android-first, with Windows desktop and web/PWA builds from the same unified codebase._

[![Platform: Android](https://img.shields.io/badge/Platform-Android%207.0%2B%20%7C%20ARM64-3DDC84?style=for-the-badge&logo=android)](https://github.com/ewceniza9009/wilsonixmidi/releases)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011%20(x64)-0078D6?style=for-the-badge&logo=windows)](https://github.com/ewceniza9009/wilsonixmidi/releases)
[![Audio: Web Audio API](https://img.shields.io/badge/Audio-Direct%20PCM%20%2B%20VA%20Engine-FF6F00?style=for-the-badge&logo=audio)](https://github.com/ewceniza9009/wilsonixmidi)
[![Framework: Tauri v2 + Vite](https://img.shields.io/badge/Framework-Tauri%20v2%20%7C%20Rust-673AB7?style=for-the-badge)](https://tauri.app/)
[![License: Proprietary](https://img.shields.io/badge/License-WILSONIX%20Commercial-red?style=for-the-badge)](https://github.com/ewceniza9009/wilsonixmidi)
[![Version: v2.2.5](https://img.shields.io/badge/Version-v2.2.5%20(Build%2029)-blue?style=for-the-badge)](https://github.com/ewceniza9009/wilsonixmidi/releases)

---

## 🎯 The Vision: A Pro Live Stage Rig in Your Backpack Without the $3,000 Price Tag

Traditional live keyboard rigs are heavy, fragile, and absurdly expensive:
- Dragging a 45-lb, $3,000 workstation keyboard or a fragile $1,500 laptop with tangled dongles, external power bricks, and audio interfaces.
- Spending 15 minutes setting up cables, worrying about whether an OS update or a 3rd-party plugin will crash in the middle of a live set.
- Paying **hundreds of dollars every year** on predatory subscriptions just to keep live host apps running.

### The WILSONIX MIDIKEY Solution:
**A complete, concert-grade live workstation running on an affordable Android tablet ($100–$150) or lightweight Windows laptop paired with any simple, compact MIDI keyboard.**

- 🏷️ **One-Time Purchase, Zero Subscriptions** — Buy it once, own it forever. Works 100% offline without needing an internet connection at the venue.
- 📱 **The Tablet IS the Control Center** — You don't need a heavy keyboard with dozens of expensive motorized knobs and faders. Place an Android tablet on your music stand and connect a single USB cable.
- 🎚️ **Tactile Live Touch Mixing** — Real-time touch faders to balance Concert Grand Piano, Warm Ambient Pad, Shimmer Strings, and Sub Bass on the fly.
- 🧘 **Continuous Tonic Drone Pad** — Integrated ambient pad engine with smooth 1.5-second crossfades and per-patch key sync. Keeps sound beds flowing with zero dead silence between songs.
- 🎬 **8 Combi Scene Snapshots Per Patch** — Effortlessly transition from a delicate verse (soft piano + felt pad) straight into an explosive chorus (full layer stack + shimmer swell) with a single tap.
- ⚡ **Instant 2-Second Boot** — No waiting 3 to 5 minutes for 50GB sample libraries to load into RAM. Ready to play before the band counts in the intro.
- ☀️ **High-Visibility Sunlight Mode** — Crystal-clear stage visibility whether under blazing outdoor afternoon sun or dark stage spotlights.

---

## 🚀 Official Production Downloads (v2.2.5 Latest Release)

| Package / Distribution        | Target Operating System           |  Architecture  | Download |
| :---------------------------- | :-------------------------------- | :------------: | :------: |
| **Android Package (APK)**      | Android 7.0+ (Nougat and later)  | ARM64 / x86_64 | [⬇️ Releases page](https://github.com/ewceniza9009/wilsonixmidi/releases) |
| **Windows Desktop Installer** | Windows 10 / 11                   |      x64       | [⬇️ Releases page](https://github.com/ewceniza9009/wilsonixmidi/releases) |

_Official binaries and checksums are hosted on the [GitHub Releases page](https://github.com/ewceniza9009/wilsonixmidi/releases). Grab the latest `wilsonix-midikey.apk` or the NSIS `.exe` setup from there._

---

## 🆕 What's New in v2.2.5

A full stability, audio, and security hardening pass across the entire engine:

### 🔒 License & Security Hardening
- **ECDSA-first boot revalidation** — stored licenses are cryptographically re-verified against the embedded P-256 public key on every launch; forged or tampered records revert to the correct state automatically.
- **Expiry is enforced forever**, not just at activation — time-limited keys stop granting access the moment their signed expiry passes.
- **Trial tamper protection** — trial records with impossible durations or forged signatures are detected and rejected (30-day window, hard-capped).
- **Capability-level Pro gates** — master WAV recording, setlist & custom patch storage, and rig export/import are enforced at the engine/storage layer, not just in the UI.
- **XSS hardening** — all modal dialogs and log panes entity-escape user/file-derived strings.

### 🎚️ Audio & Combi Engine Enhancements
- **Per-Patch Scene Persistence** — all 8 Combi scene snapshots and macro states auto-sync directly to your custom patches in IndexedDB and restore seamlessly across app reloads.
- **Real Latency & Acoustic Benchmarking** — live input delivery & dispatch tracking (MIDI, Touch, QWERTY) plus an acoustic speaker→mic loopback test bench to evaluate physical audio paths accurately.
- **Voice pool recycling** can no longer create duplicate node pairs during panic/all-notes-off.
- Note-off release semantics fixed for held pitches, layered combi voices, and looper bus routing (no more stuck or prematurely cut notes).
- Insert FX `flush` now restores dry/wet gains after the choke window instead of leaving the chain muted.
- Sustain-pedal release on insert FX now ramps to silence (no clicks), and parked `pendingReuse` voices are cleared on note-off.
- Arpeggiator held-note bookkeeping drains correctly on re-strikes (scale-lock snapped pitches no longer leave the arp running).

### 🎹 UI & Input Fixes
- QWERTY keyboard ignores text-entry surfaces, keeps Space operable on focused buttons (WCAG 2.1.1), and defers Escape to open dialogs instead of triggering panic.
- Fixed duplicate DOM ids that made Split Console controls drive the Combi console.
- Eliminated listener/`requestAnimationFrame` leaks on view re-render and dispose.
- Panic cleanup hooks now register exactly once (no double stop cascades).
- Scale-lock octave snapping corrected (worst-case distance: 2 semitones).

### 🧪 Developer Infrastructure
- **217 unit tests** passing (`node --test`, zero dependencies on real audio hardware).
- **Strict ESLint**: warnings are errors, including a custom rule banning CSP-breaking inline event handlers.
- **CI on every push**: unit tests + lint + production web build, plus a dedicated **Android job that assembles the APK** (`cap sync` + `gradlew assembleDebug`) so Android — the primary target — is continuously verified.
- Removed leaked signing material from the repository tree and untracked `node_modules`.

---

## ✨ Key Features at a Glance

- 🎹 **Hybrid Dual-Core Sound Engine** — Direct multi-layer PCM Rompler, dual-oscillator Virtual Analog subtractive synth (TVA/TVF, hard-sync leads), and physical-modeling brass, reeds, drums & percussion, engineered for stage-calibrated ultra-low-latency live performance.
- 🔌 **Web MIDI OUT & Master Clock Forwarding** — Turn WILSONIX MIDIKEY into a master stage controller. Multi-port simultaneous output routing, channel assignment (Ch 1–16), and master MIDI Clock pulse transmission synced to live tap tempo.
- 🎛️ **Elite TouchView Tablet UI** — Balanced 3-column workstation cockpit with centered workspace tabs, high-precision master studio fader with live dB readout, and enlarged tactile Rig Bank/Slot keypads optimized for Android touchscreens.
- 🎚️ **4-Timbre Combi Stacking** — Stack up to four layers with per-layer volume, pan, octave, semitone and velocity control, plus a dual-zone split console with dynamic split point selection.
- 🎛️ **23-Device Hardware Master FX Rack** — Optical compressor, auto-wah, talkbox formant filter, tube drive, bitcrusher, vinyl lo-fi tape, Haas stereo widener, auto-pan, 6-stage phaser, flanger, Dimension-D chorus, Leslie rotary, tremolo, slapback, dub echo, ping-pong delay, spring/shimmer/gated/algorithmic reverb, tape saturation, and a master EQ-limiter.
- 🎧 **Binaural Stage Monitor — 3D Spatial Audio** — HRTF-based 3D spatialization for in-ear headphones simulating concert hall, studio, stadium, and cathedral acoustic environments.
- 🥁 **Physical-Modeling Drums & Percussion** — Acoustic kick, wood-shell snare, bronze hi-hats, and chromatically tuned Latin percussion with immediate tactile response.
- 💾 **Stage Registration Memory (32 Rigs)** — 4 Banks × 8 Slots with instant recall, full live-state snapshots, and schema-validated JSON setlist import/export.
- 🎹 **12-Pad MPC Chord Matrix & Scale Engine** — One-touch Jazz, Gospel, Neo-Soul and Pop voicings with quantizing scale/key lock.
- 🔁 **Clock-Anchored Arpeggiator & Multi-Track Looper** — Web Audio look-ahead scheduling keeps tempo rock-solid under heavy stage load.
- 🎙️ **Lossless WAV Master Recorder + Media Player** — Pre-DAC waveform capture with a zero-gain monitor sink; MP3/WAV/FLAC/OGG/M4A/AAC backing-track deck.
- 🔒 **Crypto-Hardened Security & Licensing** — ECDSA P-256 signature verification with optional hardware machine binding, strict CSP, boot-time license re-validation, and a tamper-evident trial vault.

---

## 🌟 Master Feature Catalog & Core Capabilities

### 🎹 1. Dual-Core DSP Sound Engines

- **Direct Multi-Layer PCM Rompler**: 16-bit 44.1kHz sample streaming engine with multi-velocity soundboard modeling, sympathetic string resonance, and round-robin voice allocation.
- **Dual-Oscillator Virtual Analog (VA) Subtractive Synthesizer**: Time-Variant Filters (TVF) and Time-Variant Amplifiers (TVA), hard-sync oscillators (Brian's Sync Lead), multi-waveform generation (Saw, Square, Triangle, Sine, Pulse Width Modulation), and rich analog unison detune.
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

- **Chain & Per-Layer Insert FX (80+ Algorithm Choices)**: Dynamically rebuilt serial FX chain with direct hardware fast-path bypass, plus 22 Triton IFX/MFX algorithms and 35 per-layer insert FX.
- **IFX Opto-Compressor (Studio Dynamics)**: Optical-style peak leveling, threshold, ratio, attack, release, and makeup gain for drum punch and piano sustain.
- **IFX Rhodes Auto-Pan**: Dynamic stereo ping-pong panning with speed and depth modulation.
- **IFX Dimension D Stereo Chorus**: Multi-voice Dimension-D style analog chorus widening.
- **IFX Valve Force Tube Drive**: Hyperbolic tangent soft-clipping tube saturation with tone control.
- **IFX 6-Stage Vintage Phaser**: Sweeping phase notch filters with feedback resonance for funk and clavinet.
- **IFX Leslie 122 Rotary Speaker Cabinet**: Authentic dual-rotor Doppler acceleration with Chorale (slow) and Tremolo (fast) brake switching.
- **IFX Stereo Tape Flanger**: Resonant comb-filter jet flanging with polarity inversion.
- **IFX Vintage Optical Tremolo**: Photocell amplitude pulsing for surf guitars and vintage keys.
- **IFX Retro Bitcrusher / Decimator**: 2-bit to 16-bit word length reduction and downsampling (1kHz to 20kHz) for vintage sampler grit.
- **IFX Heil Formant Talk Box**: Triple formant vocal cavity filter (F1 650Hz, F2 1550Hz, F3 2850Hz) with dynamic vowel morphing (Roger Troutman style).
- **IFX Haas Stereo Spatial Widener**: Psychoacoustic stereo delay widening without mono phase cancellation.
- **MFX Ping-Pong Tape Delay**: Tempo-synchronized cross-feedback stereo delay lines.
- **MFX Concert Hall & Plate Reverb**: Lush diffusion reverberation with customizable decay, pre-delay, and high-frequency damping.
- **Spring, Shimmer & Gated Reverbs**: Retro spring tank, celestial octave shimmer, and 80s gated-snare cannon algorithms.
- **Vinyl Lo-Fi Tape & Master Tape Saturation**: Wow/flutter pitch wobble with warm HF rolloff, and a master glue tape curve with output trimming.
- **Dynamic Auto-Wah**: Envelope-follower filter sweep from clean to funky nasal tone.
- **Master 3-Band Parametric EQ & Limiter**: Low shelf (80–90Hz), sweepable mid peaking (1.4kHz), high shelf (8.5–10kHz), and a brickwall lookahead limiter calibrated to -1.0 dB.
- **Master Kaoss Dynamic Filter**: Real-time lowpass filter frequency and resonance modulation via touch/mouse X/Y pad.

### 🥁 5. Real Acoustic Drum Kit & Physical Modeling Percussion

- **Direct Physical Modeling Synthesis**: Immediate strike response with sample-level AudioWorklet synthesis.
- **Acoustic Sub-Kick**: Dual-layer 52Hz/36Hz resonant pitch envelope with acoustic wood beater transient.
- **Wood Shell Snare**: Dual-band filtered wire rattle (>3.8kHz) with rimshot impact dynamics.
- **Optical Choke Bronze Hi-Hats**: Dynamic open-hat decay with instant sub-millisecond optical choking on closed hits or pedal triggers.
- **Full Percussion Palette**: Afro-Cuban congas (slap/open), Latin cowbell (chromatically tuned across keys), cascara timbales, crash cymbals, ride bells, and Simmons SDSV space drums.
- **Full 88-Key Drum Mapping**: Chromatic pitch tracking or General MIDI drum key mapping across all 88 keys.

### 💾 6. Stage Registration Memory & Live Setlist Manager

- **32 Live Rig Snapshots**: 4 Banks (A, B, C, D) × 8 Slots (1–8) for instant 1-touch sound switching during live gigs.
- **Full State Snapshot**: Stores and recalls Combi 4-timbre stacks, Rompler instruments, Triton VA programs, split points, FX parameters, master octave, and velocity curves.
- **Hardware Keyboard Hotkeys**: Direct slot recalls via `F1`–`F8` keys, bank cycling, and `Ctrl+F4` piano collapse.
- **JSON Setlist Import & Export**: Export entire performance setlists to `.mkgig` files and import on any stage device with pure schema verification.

### 🎛️ 7. 12-Pad MPC Chord Trigger Matrix & Scale Engine

- **12 Velocity-Sensitive Chord Pads per Bank**: 11 banks — Basic Chords (all 24 major/minor triads), Ambient Ballad & Cinematic, Neo-Soul, Gospel Praise, 90s R&B, Jazz Fusion, Pop Anthems, City Pop, Lo-Fi Chill, Latin Bossa, and 80s Synthwave — each triggering rich multi-note voicings with a single touch.
- **Custom Voicings & Strumming**: Realistic humanized strum offsets, adjustable velocity curves, and chord editing.
- **Scale & Key Lock Engine**: Quantize all incoming keyboard and pad notes to Chromatic (off), Major, Natural Minor, Harmonic Minor, Pentatonic Major, Pentatonic Minor, Gospel Blues, or Dorian scales.

### 🔁 8. Live Groove Arpeggiator & Performance Looper

- **High-Precision Clock Look-Ahead**: Web Audio clock anchoring eliminates tempo drift under heavy system load.
- **6 Arp Patterns**: Up, Down, Up/Down, Random, Chord Strum, and Live Groove.
- **Multi-Track Live Looper**: Overdub live performance layers, synchronize with master BPM, and clear or bounce loops on the fly.

### 🎙️ 9. Lossless Master WAV Recorder & Media Player

- **Pre-DAC True Waveform Tap**: Direct capture of the master audio stream into uncompressed 16-bit stereo WAV at the live engine sample rate (AudioWorklet ring-buffer tap with ScriptProcessor fallback for legacy WebViews).
- **Zero-Gain Monitor Sink**: Audio recorder runs completely silently without double-monitoring or altering stage mix levels.
- **Backing Track Media Player**: Built-in audio deck supporting MP3, WAV, FLAC, OGG, M4A, and AAC with playlist queues, pitch/speed shifts, and background playback.

### 📊 10. Hardware HUD & Real-Time Diagnostics

- **60 FPS VU Meter**: Dual-channel stereo peak and RMS level indicators.
- **Latency & CPU Engine Profiler**: Live monitoring of Web Audio base latency, output latency, and buffer stability with 3 switchable latency profiles (Stage Ultra-Low ~2.9ms, Balanced Studio ~5.8ms, Safe Stage ~11.6ms).
- **Master Kaoss X/Y Pad**: Multi-touch and mouse gesture control for real-time filter sweeps and effects modulation.
- **Panic Engine Reset**: Instant one-click kill switch for stuck MIDI notes and DSP node recovery — runs every registered cleanup exactly once and always clears all layers, loops, and scheduled notes.
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
- **Dry/Wet Mix Control**: Blends spatialized wet signal with dry source based on room size.
- **Headphone-Optimized**: Designed specifically for in-ear monitors and closed-back headphones (HRTF requires binaural rendering).

---

## 🔐 Licensing & Pro Edition

WILSONIX MIDIKEY ships with all sound engine features enabled for evaluation:

- **30-Day Full-Access Trial** — every Pro capability is unlocked from first launch. The trial clock is device-anchored and tamper-evident: reinstalling, wiping browser storage, or forging the trial record does not restart or extend it.
- **Pro License Keys** — `MKPRO-<NAME>-<EXPIRY>-<SIGNATURE>` keys are ECDSA P-256 signed (IEEE-P1363, SHA-256) and verified offline against the public key embedded in the app. Two forms:
  - **Portable** — works on any device.
  - **Hardware-locked** — bound to one machine fingerprint (`MKPRO-...-DEV_XXXXXXXX-...`).
- **Activation Codes** — on platforms where direct WebCrypto verification is unavailable (some Android WebViews), an admin-issued `MKACT-<DEVID>-<SIG>` code binds a key to a specific device. The key's signed expiry still applies.
- **Boot-Time Revalidation** — the stored license is cryptographically re-verified on every launch. A tampered or forged record is detected and access is corrected automatically, with the UI updated in place.
- **Pro-Gated Capabilities** — Master WAV recording, custom patch & setlist storage, stage rig saving/export/import, and 4-timbre combi selection from the Gig HUD require Pro access (trial or license). Enforcement lives at the capability layer, not just in buttons.

The signing private key never ships with the app — only the public verification key is embedded, so licenses can be verified anywhere but only minted by the issuer.

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
- **`A044` Abletunes Studio Upright Piano**: Intimate, felted upright piano for lo-fi, film score, and acoustic ballads.

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

### 4. 🎚️ Signature 4-Timbre Combi Presets (Selection)

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
+---------------------------------------------------------------------------------------+
|                                     DSP AUDIO ENGINE                                  |
|  +-------------------------------------+  +-----------------------------------------+ |
|  | Direct Multi-Layer PCM Rompler      |  | Dual-Oscillator Virtual Analog (VA)     | |
|  | (16-bit 44.1kHz High-Density Banks) |  | Subtractive Synthesizer with TVA & TVF  | |
|  +-------------------------------------+  +-----------------------------------------+ |
|                        (AudioWorklet render-thread DSP + ring-buffer taps)            |
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
|                    Web / PWA (Vite static bundle, offline service worker)             |
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

- **Mobile Host**: [Capacitor 8.x](https://capacitorjs.com/) (Android SDK 36, minSdk 24 / Android 7.0, Gradle 8.x)
- **Desktop Host**: [Tauri v2](https://v2.tauri.app/) (Rust 1.70+, Windows MSVC 64-bit, NSIS installer builder)
- **Web**: Static Vite bundle + PWA service worker (offline-capable, self-hosted fonts)
- **Audio DSP Architecture**: Direct HTML5 Web Audio API Graph, AudioWorklet render-thread processors, custom PCM buffer streaming & Virtual Analog oscillators
- **Security Engine**: Web Crypto API (`crypto.subtle`) with ECDSA P-256 / SHA-256 SPKI public key verification
- **Frontend Architecture**: Vanilla ES6+ modular architecture, zero UI framework bloat, hardware-accelerated CSS3
- **Quality Infrastructure**: 207 unit tests (`node --test`), strict ESLint (warnings are errors), GitHub Actions CI with a dedicated Android APK assembly job

---

## 💻 Building from Source

### Prerequisites

- **Node.js**: `v20.x` or `v22.x`
- **Android Studio & SDK**: (required for the `.apk`)
- **Rust Toolchain**: `1.70+` with `x86_64-pc-windows-msvc` (desktop only)
- **Visual Studio 2022**: C++ Build Tools & Windows 10/11 SDK (desktop only)

### Build Commands

```bash
# 1. Clone repository
git clone https://github.com/ewceniza9009/wilsonixmidi.git
cd wilsonixmidi
npm ci

# 2. Start Live Development Server (http://localhost:3000)
npm run dev

# 3. Quality gate — 207 unit tests + strict lint (0 warnings allowed)
npm test
npm run lint

# 4. Production web bundle (also what the APK/desktop app ships)
npm run build

# 5. Build Android APK (asset pipeline + web build + cap sync + gradle)
npm run build:apk
# Output: dist-apk/wilsonix-midikey.apk

# 6. Build Windows Desktop NSIS Setup Installer
npm run build:desktop
# Output: src-tauri/target/release/bundle/nsis/

# 7. Build All Platforms Simultaneously
npm run build:all
```

### Continuous Integration

Every push and pull request runs (`.github/workflows/ci.yml`):
- **verify** job — `npm test` (207 tests) → `npm run lint` (warnings are errors) → `npm run build` (catches import cycles and bundling regressions).
- **android** job — builds the web bundle, syncs it into the Capacitor project, and assembles the debug APK with Gradle, so the primary target platform is verified on every change.

---

## 📜 License & Intellectual Property

Copyright © 2026 **Erwin Wilson Ceniza / WILSONIX**. All rights reserved.
All custom DSP algorithms, soundbank binaries, and interface designs are proprietary. Unauthorized reverse engineering, distribution of cracked binaries, or extraction of cryptographic keys is strictly prohibited.
