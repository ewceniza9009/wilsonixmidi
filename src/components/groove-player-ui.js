/**
 * MidiKey Elite - Groove Station & SFX Performance Soundboard UI
 * Provides full controls for:
 * 1. Synchronized Backing Groove & Sample Music Player (5 Genres, BPM tempo, volume, live 16-step LED visualizer)
 * 2. Instant Soundboard for Nature Sounds, Human Vox, Weird Sci-Fi FX, DJ Drops, and TR-808/World Percussions.
 */

import { SampleGroovePlayer, GROOVE_TRACKS } from "../audio/sample-groove-player.js";
import { SfxSoundGenerator } from "../audio/sfx-sound-generator.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";
import { audioCore } from "../audio/audio-core.js";
import { synthesizerYouEngine, SYNTHESIZER_YOU_EFFECTS } from "../audio/synthesizer-you-samples.js";

export class GroovePlayerUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.groovePlayer = new SampleGroovePlayer();
    this.sfxGen = null;
    this.activeSfxCategory = "synthesizer_you"; // 'synthesizer_you' | 'crowd' | 'vox' | 'nature' | 'percussion' | 'dj' | 'weird'

    this.initSfx();
    this.render();
    this.bindEvents();
    this.setupGrooveCallbacks();
  }

  initSfx() {
    try {
      audioCore.init();
      audioCore.ensureRunning();
      if (audioCore.ctx) {
        this.sfxGen = new SfxSoundGenerator(audioCore.ctx, audioCore.masterGain || audioCore.ctx.destination);
        synthesizerYouEngine.preload();
      }
    } catch (e) {
      console.warn("GroovePlayerUI sfxGen init:", e);
    }
  }

  setupGrooveCallbacks() {
    this.groovePlayer.onStepChange = (step) => {
      const step16 = step % 16;
      const leds = this.container?.querySelectorAll(".groove-step-led");
      if (leds) {
        leds.forEach((led, idx) => {
          led.classList.toggle("active", idx === step16);
        });
      }
    };

    this.groovePlayer.onStateChange = () => {
      this.updatePlayState();
    };
  }

  updatePlayState() {
    if (!this.container) return;
    const playBtn = this.container.querySelector("#btn-groove-play-toggle");
    if (playBtn) {
      if (this.groovePlayer.isPlaying) {
        playBtn.innerHTML = "⏹ STOP GROOVE";
        playBtn.classList.add("playing");
      } else {
        playBtn.innerHTML = "▶ START GROOVE";
        playBtn.classList.remove("playing");
      }
    }

    const cards = this.container.querySelectorAll(".groove-track-card");
    cards.forEach((card, idx) => {
      card.classList.toggle("active", idx === this.groovePlayer.activeTrackIndex);
    });

    const bpmDisplay = this.container.querySelector("#groove-bpm-display");
    if (bpmDisplay) {
      bpmDisplay.innerText = `${this.groovePlayer.bpm} BPM`;
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="groove-station-console">
        <!-- Header Banner -->
        <div class="groove-station-header">
          <div class="groove-header-left">
            <span class="groove-header-badge">LIVE PERFORMANCE ENGINE</span>
            <h2 class="groove-station-title">SAMPLE GROOVES & SFX SOUNDBOARD</h2>
          </div>
          <div class="groove-header-right">
            <!-- Global Groove Transport Controls -->
            <button class="groove-transport-btn ${this.groovePlayer.isPlaying ? "playing" : ""}" id="btn-groove-play-toggle">
              ${this.groovePlayer.isPlaying ? "⏹ STOP GROOVE" : "▶ START GROOVE"}
            </button>
            <div class="groove-tempo-capsule">
              <button class="bpm-step-btn" id="btn-groove-bpm-down">-</button>
              <span class="groove-bpm-text" id="groove-bpm-display">${this.groovePlayer.bpm} BPM</span>
              <button class="bpm-step-btn" id="btn-groove-bpm-up">+</button>
            </div>
            <div class="groove-vol-capsule">
              <span class="groove-vol-icon">🔊</span>
              <input type="range" class="groove-vol-slider" id="groove-vol-slider" min="0" max="100" value="${Math.round(this.groovePlayer.volume * 100)}" />
              <span class="groove-vol-text" id="groove-vol-display">${Math.round(this.groovePlayer.volume * 100)}%</span>
            </div>
          </div>
        </div>

        <!-- 16-Step Synchronized Beat Sequencer Visualizer -->
        <div class="groove-step-tracker">
          <span class="step-tracker-label">4-BAR LOOP SYNC:</span>
          <div class="groove-step-leds-bar">
            ${Array.from({ length: 16 })
              .map(
                (_, i) => `
              <div class="groove-step-led ${i % 4 === 0 ? "downbeat" : ""}" data-step="${i}">
                <span class="step-num">${i + 1}</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>

        <!-- Main Body: Two Columns (Left: Backing Grooves / Sample Music, Right: SFX Soundboard) -->
        <div class="groove-station-body">
          <!-- Left Column: 5 Genre Backing Grooves -->
          <div class="groove-tracks-panel">
            <div class="panel-subhead">
              <span>🎵 SYNCHRONIZED BACKING GROOVE LOOPS</span>
              <span class="panel-hint">Select a track to play backing music while you perform</span>
            </div>
            <div class="groove-tracks-grid">
              ${GROOVE_TRACKS.map(
                (track, idx) => `
                <div class="groove-track-card ${idx === this.groovePlayer.activeTrackIndex ? "active" : ""}" data-track-index="${idx}" style="--track-accent: ${track.color}">
                  <div class="track-card-top">
                    <span class="track-genre-pill">${track.genre}</span>
                    <span class="track-bpm-pill">${track.bpm} BPM</span>
                  </div>
                  <div class="track-card-title">${track.name}</div>
                  <div class="track-card-desc">${track.description}</div>
                  <button class="track-card-select-btn" data-track-index="${idx}">
                    ${idx === this.groovePlayer.activeTrackIndex && this.groovePlayer.isPlaying ? "⏹ PLAYING" : "▶ LOAD & PLAY"}
                  </button>
                </div>
              `
              ).join("")}
            </div>
          </div>

          <!-- Right Column: SFX & Soundboard Studio -->
          <div class="sfx-soundboard-panel">
            <div class="panel-subhead">
              <span>⚡ LIVE SOUND EFFECTS & VOX PADS</span>
              <span class="panel-hint">Instant zero-latency trigger pads</span>
              <button class="sfx-cancel-btn" id="btn-sfx-cancel" title="Stop all running sound effects & long samples">⏹ CANCEL FX</button>
            </div>

            <!-- SFX Category Tabs -->
            <div class="sfx-cat-tabs">
              <button class="sfx-cat-btn ${this.activeSfxCategory === "sax" ? "active" : ""}" data-sfx-cat="sax">🎷 GENUINE SAX</button>
              <button class="sfx-cat-btn ${this.activeSfxCategory === "synthesizer_you" ? "active" : ""}" data-sfx-cat="synthesizer_you">🏄 SYNTH YOU FX</button>
              <button class="sfx-cat-btn ${this.activeSfxCategory === "crowd" ? "active" : ""}" data-sfx-cat="crowd">👏 CONCERT CROWD</button>
              <button class="sfx-cat-btn ${this.activeSfxCategory === "vox" ? "active" : ""}" data-sfx-cat="vox">🗣️ HUMAN VOX</button>
              <button class="sfx-cat-btn ${this.activeSfxCategory === "nature" ? "active" : ""}" data-sfx-cat="nature">🌿 NATURE SOUNDS</button>
              <button class="sfx-cat-btn ${this.activeSfxCategory === "percussion" ? "active" : ""}" data-sfx-cat="percussion">🥁 PERCUSSIONS</button>
              <button class="sfx-cat-btn ${this.activeSfxCategory === "drums" ? "active" : ""}" data-sfx-cat="drums">🪘 REAL DRUM KIT</button>
              <button class="sfx-cat-btn ${this.activeSfxCategory === "dj" ? "active" : ""}" data-sfx-cat="dj">🎧 DJ & CINEMATIC</button>
              <button class="sfx-cat-btn ${this.activeSfxCategory === "weird" ? "active" : ""}" data-sfx-cat="weird">🛸 WEIRD SCI-FI</button>
            </div>

            <!-- SFX Trigger Pads Grid -->
            <div class="sfx-pads-container" id="sfx-pads-container">
              ${this.renderSfxPads()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderSfxPads() {
    const sfxMap = {
      sax: [
        { id: "sax_genuine_solo", icon: "🎷", name: "Solo Alto Sax", desc: "Genuine expressive solo with natural reed breath & delayed vibrato" },
        { id: "sax_sensual", icon: "💋", name: "Sensual 80s Sax", desc: "80s Careless Whisper style breathy tenor sax with warm plate reverb" },
        { id: "sax_blues_growl", icon: "🔥", name: "Dirty Blues Growl", desc: "Authentic throat flutter growl with raspy overtones" },
        { id: "sax_funk_stab", icon: "💥", name: "Funk Section Stab", desc: "Explosive tight brass & horn section stab for grooves" },
        { id: "sax_fall", icon: "📉", name: "Big Band Sax Fall", desc: "Classic expressive pitch fall and slide off note" },
        { id: "sax_scoop", icon: "📈", name: "Sax Pitch Scoop", desc: "Deep expressive pitch scoop into warm acoustic reed sustain" },
      ],
      synthesizer_you: SYNTHESIZER_YOU_EFFECTS,
      crowd: [
        { id: "applause_clapping", icon: "👏", name: "Concert Clapping", desc: "Real rhythmic concert audience applause" },
        { id: "applause_roar", icon: "🏟️", name: "Stadium Crowd Roar", desc: "Massive roaring arena ovation" },
        { id: "applause_cheers", icon: "🎉", name: "Cheering & Whistles", desc: "Excited concert fan cheers & whistles" },
        { id: "applause_ovation", icon: "🌟", name: "Encore Ovation", desc: "Full standing ovation & celebration" },
      ],
      vox: [
        { id: "m1_ooh_ahh", icon: "🎶", name: "Korg M1 Ooh-Ahh", desc: "Doctor Mix authentic dual-formant choir" },
        { id: "choir_aahs", icon: "⛪", name: "Cathedral Choir Aahs", desc: "Multi-sampled angelic sacred choir" },
        { id: "voice_oohs", icon: "✨", name: "Angelic Voice Oohs", desc: "Warm recorded human 'Ooh' voices" },
        { id: "vox_breath", icon: "💨", name: "Human Breath", desc: "Real recorded breath & atmospheric air" },
        { id: "vox_hey", icon: "🔥", name: "Hype Vocal 'Hey!'", desc: "Real recorded group vocal shout" },
        { id: "vox_yeah", icon: "🎤", name: "Vocal 'Yeah!'", desc: "Real recorded passionate shout" },
        { id: "vox_sigh", icon: "😮‍💨", name: "Real Human Sigh", desc: "Genuine field-recorded woman sigh" },
        { id: "vox_beatbox_kick", icon: "🥊", name: "Beatbox Kick", desc: "Vocal throat sub kick" },
        { id: "vox_beatbox_snare", icon: "💥", name: "Beatbox Snare", desc: "Vocal crack snare 'kchhh'" },
        { id: "vox_beatbox_hat", icon: "🎩", name: "Beatbox Hat", desc: "Vocal crisp hat 'ts-ts'" },
      ],
      nature: [
        { id: "nature_ocean", icon: "🌊", name: "Ocean Waves", desc: "Real multi-sampled tidal surf swell" },
        { id: "nature_birds", icon: "🐦", name: "Forest Birdsong", desc: "Real field recording of wild birds" },
        { id: "nature_thunder", icon: "⛈️", name: "Thunder Clap & Lightning", desc: "REAL field-recorded thunder clap with lightning crack" },
        { id: "nature_thunderstorm", icon: "🌩️", name: "Full Thunderstorm", desc: "REAL full rainstorm with rolling thunder" },
        { id: "nature_rain", icon: "🌧️", name: "Rainstorm", desc: "Continuous soothing natural rainfall" },
        { id: "nature_wind", icon: "💨", name: "Wind Gusts", desc: "Atmospheric resonant breeze" },
      ],
      percussion: [
        { id: "percussion_taiko", icon: "🪘", name: "Taiko Thunder Drum", desc: "Real Japanese heavy acoustic drum" },
        { id: "percussion_synthdrum", icon: "⚡", name: "Analog Synth Drum", desc: "Real 80s punchy synth percussion" },
        { id: "tr808_kick", icon: "🥁", name: "808 Sub Kick", desc: "Deep punchy analog sub kick" },
        { id: "tr808_snare", icon: "🎯", name: "808 Snare Drum", desc: "Crisp white-noise tone snap" },
        { id: "tr808_hat_c", icon: "🥢", name: "808 Closed Hat", desc: "Tight metallic 16th hat" },
        { id: "tr808_hat_o", icon: "🔔", name: "808 Open Hat", desc: "Sizzling high-frequency ring" },
        { id: "percussion_conga_hi", icon: "🪘", name: "High Conga Slap", desc: "Afro-Cuban slap tone" },
        { id: "percussion_shaker", icon: "🪇", name: "Latin Shaker", desc: "Dynamic forward & back shake" },
      ],
      drums: [
        { id: "drum_kick", icon: "🥁", name: "Acoustic Kick", desc: "REAL studio kick drum hit" },
        { id: "drum_snare", icon: "🥁", name: "Acoustic Snare", desc: "REAL 14in brass snare crack" },
        { id: "drum_hhclosed", icon: "🥁", name: "Closed Hi-Hat", desc: "REAL tight closed-hat tick" },
        { id: "drum_hhopen", icon: "🥁", name: "Open Hi-Hat", desc: "REAL sizzling open-hat wash" },
        { id: "drum_crash", icon: "🥁", name: "Crash Cymbal", desc: "REAL 18in crash splash" },
        { id: "drum_ride", icon: "🥁", name: "Ride Cymbal", desc: "REAL ride cymbal ring" },
      ],
      dj: [
        { id: "fx_subboom", icon: "💣", name: "Cinematic Sub-Boom", desc: "Real sub-bass explosive impact" },
        { id: "fx_scratch", icon: "💿", name: "Vinyl Scratch", desc: "Hip-hop turntable needle scrub" },
        { id: "fx_tapestop", icon: "🛑", name: "Tape Stop", desc: "Analog motor speed-down" },
        { id: "fx_airhorn", icon: "🎺", name: "Reggae Airhorn", desc: "Stadium dancehall blast" },
        { id: "fx_siren", icon: "🚨", name: "Police Siren", desc: "REAL police siren wail" },
        { id: "fx_whistle", icon: "🥅", name: "Referee Whistle", desc: "REAL sharp referee whistle blast" },
        { id: "fx_cheer", icon: "📣", name: "Crowd Cheer", desc: "REAL excited audience cheer" },
        { id: "fx_boom", icon: "💥", name: "Explosion Boom", desc: "REAL heavy explosion impact" },
        { id: "fx_partyhorn", icon: "🎉", name: "Party Horn", desc: "REAL blower party horn" },
        { id: "fx_scratchreal", icon: "💿", name: "Real Vinyl Scratch", desc: "REAL turntable needle scrub" },
      ],
      weird: [
        { id: "fx_laser", icon: "⚡", name: "Laser Beam Zap", desc: "Resonant sci-fi pitch drop" },
        { id: "fx_alien", icon: "👽", name: "Alien Drone", desc: "Metallic modulation hyperspace" },
        { id: "fx_bionic", icon: "🤖", name: "Bionic Glitch", desc: "High-speed frequency cascade" },
        { id: "fx_heartbeat", icon: "🫀", name: "Human Heartbeat", desc: "REAL deep heartbeat pound" },
        { id: "fx_sonar", icon: "📡", name: "Submarine Sonar", desc: "REAL sonar ping" },
        { id: "fx_ufo", icon: "🛸", name: "UFO Whoosh", desc: "REAL UFO flyby whoosh" },
        { id: "fx_static", icon: "📻", name: "Radio Static", desc: "REAL crackling radio static" },
        { id: "fx_ghost", icon: "👻", name: "Ghostly Whisper", desc: "REAL eerie ghost whispering" },
        { id: "fx_robot", icon: "🤖", name: "Cyber Robot Voice", desc: "REAL robotic voice FX" },
        { id: "fx_zombie", icon: "🧟", name: "Zombie Moan", desc: "REAL groaning zombie moan" },
        { id: "fx_mystic", icon: "🔮", name: "Mystical Whisper", desc: "REAL mysterious chanting whisper" },
        { id: "fx_laserreal", icon: "✨", name: "Retro Laser Shot", desc: "REAL 80s arcade laser zap" },
      ],
    };

    const pads = sfxMap[this.activeSfxCategory] || [];
    return pads
      .map(
        pad => `
      <div class="sfx-pad-card" data-sfx-id="${pad.id}">
        <span class="sfx-pad-icon">${pad.icon}</span>
        <div class="sfx-pad-info">
          <div class="sfx-pad-name">${pad.name}</div>
          <div class="sfx-pad-desc">${pad.desc}</div>
        </div>
        <button class="sfx-trigger-btn" data-sfx-id="${pad.id}">TRIGGER</button>
      </div>
    `
      )
      .join("");
  }

  bindEvents() {
    if (!this.container) return;

    // 1. Play / Stop master toggle
    const playToggleBtn = this.container.querySelector("#btn-groove-play-toggle");
    playToggleBtn?.addEventListener("click", () => {
      audioCore.ensureRunning();
      if (this.groovePlayer.isPlaying) {
        this.groovePlayer.stop();
      } else {
        this.groovePlayer.start();
      }
    });

    // 2. Track selection cards
    this.container.querySelectorAll(".groove-track-card, .track-card-select-btn").forEach(elem => {
      elem.addEventListener("click", (e) => {
        const idx = parseInt(elem.getAttribute("data-track-index"), 10);
        if (!isNaN(idx)) {
          audioCore.ensureRunning();
          if (this.groovePlayer.activeTrackIndex === idx && this.groovePlayer.isPlaying) {
            this.groovePlayer.stop();
          } else {
            this.groovePlayer.selectTrack(idx);
            this.groovePlayer.start();
          }
        }
      });
    });

    // 3. BPM buttons
    const bpmDown = this.container.querySelector("#btn-groove-bpm-down");
    const bpmUp = this.container.querySelector("#btn-groove-bpm-up");
    bpmDown?.addEventListener("click", () => {
      this.groovePlayer.setBpm(this.groovePlayer.bpm - 2);
      this.updatePlayState();
    });
    bpmUp?.addEventListener("click", () => {
      this.groovePlayer.setBpm(this.groovePlayer.bpm + 2);
      this.updatePlayState();
    });

    // 4. Volume slider
    const volSlider = this.container.querySelector("#groove-vol-slider");
    const volText = this.container.querySelector("#groove-vol-display");
    volSlider?.addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10) / 100;
      this.groovePlayer.setVolume(v);
      if (volText) volText.innerText = `${Math.round(v * 100)}%`;
    });

    // 5. SFX Category switchers
    this.container.querySelectorAll(".sfx-cat-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-sfx-cat");
        this.activeSfxCategory = cat;
        this.container.querySelectorAll(".sfx-cat-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const padsCont = this.container.querySelector("#sfx-pads-container");
        if (padsCont) {
          padsCont.innerHTML = this.renderSfxPads();
          this.bindSfxPads();
        }
      });
    });

    // 5b. Cancel / stop all running sound effects & long samples
    this.container.querySelector("#btn-sfx-cancel")?.addEventListener("click", () => {
      audioCore.ensureRunning();
      this.cancelLongSfx();
    });

    this.bindSfxPads();
  }

  toggleRealSample(instId, midi, vel, gain) {
    const pcm = multiLayerEngine.pcmEngine;
    if (!pcm) return;
    if (pcm.hasActiveSfxSample(instId)) {
      pcm.stopSfxSamples(instId);
      return;
    }
    pcm.playNote(instId, midi, vel, gain);
  }

  cancelLongSfx() {
    multiLayerEngine.pcmEngine?.stopSfxSamples();
    if (this.sfxGen) this.sfxGen.stopAll();
    synthesizerYouEngine.stopAll();
  }

  bindSfxPads() {
    if (!this.container) return;

    this.container.querySelectorAll(".sfx-pad-card").forEach(pad => {
      const sfxId = pad.getAttribute("data-sfx-id");

      const triggerAction = (e) => {
        e.preventDefault();
        e.stopPropagation();
        audioCore.ensureRunning();
        if (!this.sfxGen) this.initSfx();

        // Visual trigger pulse
        pad.classList.add("firing");
        setTimeout(() => pad.classList.remove("firing"), 250);

        this.triggerSfx(sfxId);
      };

      pad.addEventListener("pointerdown", triggerAction);
    });
  }

  triggerSfx(sfxId) {
    audioCore.ensureRunning();
    if (!this.sfxGen) this.initSfx();
    if (!this.sfxGen) return;

    if (sfxId.startsWith("sy_")) {
      synthesizerYouEngine.trigger(sfxId, 115, 1.0);
      return;
    }

    switch (sfxId) {
      // 1. Concert & Crowd (REAL recorded stadium applause & concert crowd)
      case "applause_clapping":
        multiLayerEngine.pcmEngine?.playNote("applause", 60, 115, 1.2);
        break;
      case "applause_roar":
        multiLayerEngine.pcmEngine?.playNote("applause", 48, 125, 1.3);
        break;
      case "applause_cheers":
        multiLayerEngine.pcmEngine?.playNote("applause", 72, 115, 1.2);
        break;
      case "applause_ovation":
        multiLayerEngine.pcmEngine?.playNote("applause", 65, 120, 1.3);
        break;

      // 2. Human Vox & Choir (REAL multi-sampled human choirs & vocal air)
      case "m1_ooh_ahh":
        multiLayerEngine.pcmEngine?.playNote("voice_oohs", 60, 105, 1.1);
        multiLayerEngine.pcmEngine?.playNote("choir_aahs", 60, 95, 0.9);
        break;
      case "choir_aahs":
        multiLayerEngine.pcmEngine?.playNote("choir_aahs", 60, 110, 1.2);
        break;
      case "voice_oohs":
        multiLayerEngine.pcmEngine?.playNote("voice_oohs", 64, 110, 1.2);
        break;
      case "vox_breath":
        multiLayerEngine.pcmEngine?.playNote("breath_noise", 60, 105, 1.2);
        break;
      case "vox_hey":
        this.toggleRealSample("vox_hey_r", 60, 118, 1.3);
        break;
      case "vox_yeah":
        this.toggleRealSample("vox_yeah_r", 62, 118, 1.3);
        break;
      case "vox_sigh":
        this.toggleRealSample("vox_sigh_r", 60, 110, 1.3);
        break;
      case "vox_beatbox_kick":
        this.sfxGen.triggerBeatbox("kick", 110, 1.0);
        break;
      case "vox_beatbox_snare":
        this.sfxGen.triggerBeatbox("snare", 100, 1.0);
        break;
      case "vox_beatbox_hat":
        this.sfxGen.triggerBeatbox("hat", 90, 1.0);
        break;

      // 3. Real Nature Field Recordings
      case "nature_ocean":
        multiLayerEngine.pcmEngine?.playNote("seashore", 60, 115, 1.3);
        break;
      case "nature_birds":
        multiLayerEngine.pcmEngine?.playNote("bird_tweet", 60, 110, 1.2);
        multiLayerEngine.pcmEngine?.playNote("bird_tweet", 72, 95, 1.0);
        break;
      case "nature_thunder":
        this.toggleRealSample("thunder_clap", 60, 125, 1.5);
        this.toggleRealSample("lightning_bolt", 72, 95, 0.9);
        break;
      case "nature_thunderstorm":
        this.toggleRealSample("thunder_storm", 60, 120, 1.5);
        break;
      case "nature_rain":
        this.sfxGen.triggerRain(4.5, 95, 1.0);
        break;
      case "nature_wind":
        this.sfxGen.triggerWind(4.5, 90, 1.0);
        break;

      // 4. Percussions & Drums (Real Taiko, Synth Drum soundfonts + 808 DSP)
      case "percussion_taiko":
        multiLayerEngine.pcmEngine?.playNote("taiko_drum", 48, 125, 1.3);
        break;
      case "percussion_synthdrum":
        multiLayerEngine.pcmEngine?.playNote("synth_drum", 60, 115, 1.2);
        break;
      case "tr808_kick":
        this.sfxGen.trigger808Kick(110, 1.0);
        break;
      case "tr808_snare":
        this.sfxGen.trigger808Snare(100, 1.0);
        break;
      case "tr808_hat_c":
        this.sfxGen.trigger808Hat(true, 95, 1.0);
        break;
      case "tr808_hat_o":
        this.sfxGen.trigger808Hat(false, 95, 1.0);
        break;
      case "percussion_conga_hi":
        this.sfxGen.triggerConga(true, 100, 1.0);
        break;
      case "percussion_shaker":
        this.sfxGen.triggerShaker(95, 1.0);
        break;

      // 4b. REAL Acoustic Drum Kit (field-recorded one-shots)
      case "drum_kick":
        this.toggleRealSample("drum_kick_r", 60, 122, 1.3);
        break;
      case "drum_snare":
        this.toggleRealSample("drum_snare_r", 60, 118, 1.3);
        break;
      case "drum_hhclosed":
        this.toggleRealSample("drum_hhclosed_r", 60, 110, 1.1);
        break;
      case "drum_hhopen":
        this.toggleRealSample("drum_hhopen_r", 60, 116, 1.2);
        break;
      case "drum_crash":
        this.toggleRealSample("drum_crash_r", 60, 125, 1.3);
        break;
      case "drum_ride":
        this.toggleRealSample("drum_ride_r", 60, 122, 1.3);
        break;

      // 5. DJ & Cinematic
      case "fx_subboom":
        multiLayerEngine.pcmEngine?.playNote("gunshot", 48, 125, 1.4);
        this.sfxGen.triggerSubBoom(110, 1.0);
        break;
      case "fx_scratch":
        this.sfxGen.triggerVinylScratch(105, 1.0);
        break;
      case "fx_tapestop":
        this.sfxGen.triggerTapeStop(100, 1.0);
        break;
      case "fx_airhorn":
        this.sfxGen.triggerReggaeAirhorn(100, 1.0);
        break;
      case "fx_siren":
        this.toggleRealSample("dj_siren_r", 60, 122, 1.3);
        break;
      case "fx_whistle":
        this.toggleRealSample("dj_whistle_r", 60, 115, 1.25);
        break;
      case "fx_cheer":
        this.toggleRealSample("dj_cheer_r", 60, 125, 1.3);
        break;
      case "fx_boom":
        this.toggleRealSample("fx_boom_r", 48, 125, 1.5);
        break;
      case "fx_partyhorn":
        this.toggleRealSample("dj_partyhorn_r", 60, 118, 1.25);
        break;
      case "fx_scratchreal":
        this.toggleRealSample("dj_scratch_r", 60, 118, 1.3);
        break;

      // 6. Weird Sci-Fi
      case "fx_laser":
        this.sfxGen.triggerLaserZap(100, 1.0);
        break;
      case "fx_alien":
        this.sfxGen.triggerAlienDrone(48, 95, 1.0);
        break;
      case "fx_bionic":
        this.sfxGen.triggerBionicGlitch(100, 1.0);
        break;
      case "fx_heartbeat":
        this.toggleRealSample("fx_heartbeat_r", 60, 122, 1.3);
        break;
      case "fx_sonar":
        this.toggleRealSample("fx_sonar_r", 60, 118, 1.25);
        break;
      case "fx_ufo":
        this.toggleRealSample("fx_ufo_r", 60, 122, 1.3);
        break;
      case "fx_static":
        this.toggleRealSample("fx_static_r", 60, 118, 1.25);
        break;
      case "fx_ghost":
        this.toggleRealSample("fx_ghost_r", 60, 112, 1.2);
        break;
      case "fx_robot":
        this.toggleRealSample("fx_robot_r", 60, 118, 1.25);
        break;
      case "fx_zombie":
        this.toggleRealSample("fx_zombie_r", 60, 112, 1.2);
        break;
      case "fx_mystic":
        this.toggleRealSample("fx_mystic_r", 60, 118, 1.25);
        break;
      case "fx_laserreal":
        this.toggleRealSample("fx_laser_r", 60, 118, 1.25);
        break;

      // 7. Genuine Saxophone Effects (Authentic Studio Acoustic Soundfonts)
      case "sax_genuine_solo":
      case "sax_solo": {
        const pcm = multiLayerEngine.pcmEngine;
        if (pcm) {
          pcm.playNote("breath_noise", 60, 80, 0.4);
          pcm.playNote("alto_sax", 65, 110, 1.25);
          setTimeout(() => pcm.playNote("alto_sax", 67, 115, 1.25), 140);
          setTimeout(() => pcm.playNote("alto_sax", 70, 118, 1.25), 290);
          setTimeout(() => pcm.playNote("alto_sax", 72, 125, 1.35), 460);
        }
        break;
      }
      case "sax_sensual": {
        const pcm = multiLayerEngine.pcmEngine;
        if (pcm) {
          pcm.playNote("breath_noise", 60, 90, 0.5);
          pcm.playNote("tenor_sax", 62, 105, 1.2);
          setTimeout(() => pcm.playNote("tenor_sax", 65, 110, 1.2), 150);
          setTimeout(() => pcm.playNote("tenor_sax", 69, 115, 1.25), 300);
          setTimeout(() => pcm.playNote("tenor_sax", 67, 108, 1.15), 460);
          setTimeout(() => pcm.playNote("tenor_sax", 65, 115, 1.25), 630);
        }
        break;
      }
      case "sax_blues_growl": {
        const pcm = multiLayerEngine.pcmEngine;
        if (pcm) {
          pcm.playNote("tenor_sax", 58, 115, 1.25);
          setTimeout(() => pcm.playNote("tenor_sax", 60, 118, 1.25), 120);
          setTimeout(() => pcm.playNote("tenor_sax", 63, 122, 1.25), 260);
          setTimeout(() => pcm.playNote("tenor_sax", 65, 125, 1.3), 420);
        }
        break;
      }
      case "sax_funk_stab": {
        const pcm = multiLayerEngine.pcmEngine;
        if (pcm) {
          pcm.playNote("alto_sax", 65, 125, 1.2);
          pcm.playNote("alto_sax", 69, 125, 1.2);
          pcm.playNote("alto_sax", 72, 127, 1.3);
          pcm.playNote("brass_section", 53, 120, 0.85);
          pcm.playNote("brass_section", 65, 120, 0.85);
        }
        break;
      }
      case "sax_fall": {
        const pcm = multiLayerEngine.pcmEngine;
        if (pcm) {
          pcm.playNote("alto_sax", 76, 125, 1.3);
          setTimeout(() => pcm.playNote("alto_sax", 74, 115, 1.1), 80);
          setTimeout(() => pcm.playNote("alto_sax", 72, 105, 0.9), 160);
          setTimeout(() => pcm.playNote("alto_sax", 69, 90, 0.7), 240);
          setTimeout(() => pcm.playNote("alto_sax", 65, 75, 0.5), 320);
        }
        break;
      }
      case "sax_scoop": {
        const pcm = multiLayerEngine.pcmEngine;
        if (pcm) {
          pcm.playNote("breath_noise", 60, 90, 0.5);
          pcm.playNote("alto_sax", 64, 95, 0.9);
          setTimeout(() => pcm.playNote("alto_sax", 65, 125, 1.3), 70);
        }
        break;
      }

      default:
        break;
    }
  }
}
