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
import { MULTISAMPLE_BANKS } from "../audio/multisample-manifest.js";

export const SFX_CATEGORIES = [
  { id: "sax", icon: "🎷", label: "GENUINE SAX" },
  { id: "synthesizer_you", icon: "🏄", label: "SYNTH YOU FX" },
  { id: "crowd", icon: "👏", label: "CONCERT CROWD" },
  { id: "vox", icon: "🗣️", label: "HUMAN VOX" },
  { id: "nature", icon: "🌿", label: "NATURE SOUNDS" },
  { id: "percussion", icon: "🥁", label: "PERCUSSIONS" },
  { id: "drums", icon: "🪘", label: "DRUM KITS" },
  { id: "dj", icon: "🎧", label: "DJ & CINEMATIC" },
  { id: "weird", icon: "🛸", label: "WEIRD SCI-FI" },
];

export const DRUM_KITS = [
  {id: "rx7_drums",  label: "RX7 1987"},
  {id: "mth_std1",   label: "STN 1"},
  {id: "mth_std2",   label: "STN 2"},
  {id: "mth_room88", label: "ROOM 88"},
  {id: "mth_room55", label: "ROOM 55"},
  {id: "mth_power",  label: "POWER"},
  {id: "mth_electronic", label: "ELEC"},
  {id: "mth_tr909",  label: "TR-909"},
  {id: "mth_dance",  label: "DANCE"},
  {id: "mth_jazz",   label: "JAZZ"},
  {id: "mth_brush",  label: "BRUSH"},
  {id: "mth_orchestra",label: "ORCH"},
  {id: "mth_kicksnare",label: "K&S"},
  {id: "mth_chaos",  label: "CHAOS"},
  {id: "mth_cm64",   label: "CM-64"},
  {id: "dsp",        label: "DSP (old)"},
];

const GM_DRUM_PADS = [
  {key: 36, name: "Kick"},
  {key: 37, name: "Rim Shot"},
  {key: 38, name: "Snare"},
  {key: 39, name: "Hand Clap"},
  {key: 42, name: "Closed Hat"},
  {key: 44, name: "Pedal Hat"},
  {key: 46, name: "Open Hat"},
  {key: 45, name: "Low Tom"},
  {key: 47, name: "Mid Tom"},
  {key: 48, name: "Hi-Mid Tom"},
  {key: 50, name: "High Tom"},
  {key: 49, name: "Crash"},
  {key: 51, name: "Ride"},
  {key: 56, name: "Cowbell"},
];

const PERC_FAMILIES = {
  latin: [
    {key: 63, name: "Conga Open"},
    {key: 64, name: "Conga Low"},
    {key: 60, name: "Bongo Hi"},
    {key: 61, name: "Bongo Low"},
    {key: 65, name: "Timbale Hi"},
    {key: 66, name: "Timbale Low"},
    {key: 67, name: "Agogo Hi"},
    {key: 68, name: "Agogo Low"},
    {key: 56, name: "Cowbell"},
    {key: 69, name: "Cabasa"},
    {key: 70, name: "Maracas"},
    {key: 82, name: "Shaker"},
    {key: 75, name: "Claves"},
    {key: 58, name: "Vibraslap"},
  ],
  world: [
    {key: 71, name: "Whistle Short"},
    {key: 72, name: "Whistle Long"},
    {key: 73, name: "Guiro Short"},
    {key: 74, name: "Guiro Long"},
    {key: 78, name: "Cuica Mute"},
    {key: 79, name: "Cuica Open"},
    {key: 84, name: "Bell Tree"},
    {key: 86, name: "Surdo Mute"},
    {key: 87, name: "Surdo Open"},
    {key: 85, name: "Castanets"},
  ],
  orchestra: [
    {inst: "rx7_timpani", key: 63, name: "Timpani"},
    {inst: "mth_orchestra", key: 48, name: "Timpani SC-88"},
    {inst: "mth_orchestra", key: 55, name: "Orchestral Crash"},
    {inst: "mth_orchestra", key: 39, name: "Orchestral Castanets"},
  ],
  synth: [
    {id: "percussion_taiko",       name: "Taiko Thunder Drum"},
    {id: "percussion_synthdrum",   name: "Analog Synth Drum"},
    {id: "tr808_kick",             name: "808 Sub Kick"},
    {id: "tr808_snare",            name: "808 Snare Drum"},
    {id: "tr808_hat_c",            name: "808 Closed Hat"},
    {id: "tr808_hat_o",            name: "808 Open Hat"},
    {id: "percussion_conga_hi",    name: "High Conga Slap"},
    {id: "percussion_shaker",      name: "Latin Shaker"},
  ],
};

export class GroovePlayerUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.groovePlayer = new SampleGroovePlayer();
    this.sfxGen = null;

    let savedCat = "sax";
    try {
      const stored = localStorage.getItem("midikey_groove_sfx_cat");
      if (stored && SFX_CATEGORIES.some(c => c.id === stored)) {
        savedCat = stored;
      }
    } catch (e) {}
    this.activeSfxCategory = savedCat;
    this.sfxTabsExpanded = false;

    this.activeDrumKit   = localStorage.getItem("midikey_groove_drumkit")   || "rx7_drums";
    this.activePercFamily = localStorage.getItem("midikey_groove_perc_family") || "latin";
    this._activeTimeouts = new Set();

    multiLayerEngine.loadInstrument(this.activeDrumKit).catch(() => {});

    this.initSfx();
    this.render();
    this.bindEvents();
    this.setupGrooveCallbacks();

    if (typeof window !== "undefined") {
      window.addEventListener("wilsonix:panic", () => {
        this.stopAll();
      });
    }
  }

  _scheduleSfxNote(fn, delay) {
    if (!this._activeTimeouts) this._activeTimeouts = new Set();
    const id = setTimeout(() => {
      this._activeTimeouts.delete(id);
      fn();
    }, delay);
    this._activeTimeouts.add(id);
    return id;
  }

  _clearActiveTimeouts() {
    if (this._activeTimeouts) {
      for (const id of this._activeTimeouts) {
        clearTimeout(id);
      }
      this._activeTimeouts.clear();
    }
  }

  stopAll() {
    this.cancelLongSfx();
    if (this.groovePlayer && this.groovePlayer.isPlaying) {
      this.groovePlayer.stop();
      this.updatePlayState();
    }
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

            <!-- SFX Category Tabs Bar with More/Less Toggle -->
            <div class="sfx-cat-tabs-row">
              <div class="sfx-cat-tabs ${this.sfxTabsExpanded ? "expanded" : ""}" id="sfx-cat-tabs-cont">
                ${SFX_CATEGORIES.map(cat => `
                  <button class="sfx-cat-btn ${this.activeSfxCategory === cat.id ? "active" : ""}" data-sfx-cat="${cat.id}">
                    ${cat.icon} ${cat.label}
                  </button>
                `).join("")}
              </div>
              <button class="sfx-tab-toggle-btn ${this.sfxTabsExpanded ? "active" : ""}" id="btn-sfx-tab-toggle" title="Toggle full category list">
                ${this.sfxTabsExpanded ? "▴ LESS" : "▾ MORE"}
              </button>
            </div>

            <!-- Drum Kit Pill Row (shown only for drums category) -->
            ${this.activeSfxCategory === "drums" ? `
              <div class="drumkit-pill-row">
                ${DRUM_KITS.map(kit => `
                  <button class="drumkit-pill-btn ${this.activeDrumKit === kit.id ? "active" : ""}" data-drum-kit="${kit.id}">
                    ${kit.label}
                  </button>
                `).join("")}
              </div>
            ` : ""}

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
    const percussionFamily = this.activePercFamily || "latin";
    const isDrumsCategory = this.activeSfxCategory === "drums";
    const isPercussionCategory = this.activeSfxCategory === "percussion";

    // Drum kit pads (GM map) - shown for drums category
    const drumPads = GM_DRUM_PADS.map(pad => {
      const kitSamples = MULTISAMPLE_BANKS[this.activeDrumKit]?.samples || [];
      const hasSample = kitSamples.some(s => s.m === pad.key);
      return `
    <div class="sfx-pad-card" data-sfx-id="dkit_${this.activeDrumKit}_${pad.key}">
      <span class="sfx-pad-icon">🥁</span>
      <div class="sfx-pad-info">
        <div class="sfx-pad-name">${pad.name} (${pad.key})</div>
        <div class="sfx-pad-desc">${hasSample ? "Studio sample" : "Acoustic GM drum"}</div>
      </div>
      <button class="sfx-trigger-btn" data-sfx-id="dkit_${this.activeDrumKit}_${pad.key}">TRIGGER</button>
    </div>
`;
    }).join("");

    // Percussion family pads - shown for percussion category
    const percFamilyPads = (PERC_FAMILIES[percussionFamily] || PERC_FAMILIES.latin).map(pad => {
      if (pad.id) {
        return `
    <div class="sfx-pad-card" data-sfx-id="${pad.id}">
      <span class="sfx-pad-icon">🥁</span>
      <div class="sfx-pad-info">
        <div class="sfx-pad-name">${pad.name}</div>
        <div class="sfx-pad-desc">Electronic & 808 percussion</div>
      </div>
      <button class="sfx-trigger-btn" data-sfx-id="${pad.id}">TRIGGER</button>
    </div>`;
      }
      const inst = pad.inst || this.activeDrumKit;
      const kitSamples = MULTISAMPLE_BANKS[inst]?.samples || [];
      const hasSample = kitSamples.some(s => s.m === pad.key);
      return `
    <div class="sfx-pad-card" data-sfx-id="perc_${inst}_${pad.key}">
      <span class="sfx-pad-icon">🥁</span>
      <div class="sfx-pad-info">
        <div class="sfx-pad-name">${pad.name}</div>
        <div class="sfx-pad-desc">${hasSample ? "Percussion sample" : "Acoustic GM percussion"}</div>
      </div>
      <button class="sfx-trigger-btn" data-sfx-id="perc_${inst}_${pad.key}">TRIGGER</button>
    </div>
`;
    }).join("");

    if (isDrumsCategory) {
      return drumPads;
    }
    if (isPercussionCategory) {
      return percFamilyPads;
    }

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
        { id: "drum_kick", icon: "🥁", name: "Acoustic Kick", desc: "Studio maple kick with beater snap & sub thump" },
        { id: "drum_snare", icon: "🥁", name: "Acoustic Snare", desc: "14in brass/wood snare with snappy wire crack" },
        { id: "drum_hhclosed", icon: "🥢", name: "Closed Hi-Hat", desc: "Instant metallic 0.00ms closed-hat tick (Zero Latency)" },
        { id: "drum_hhopen", icon: "🔔", name: "Open Hi-Hat", desc: "Sizzling bronze open-hat wash with instant choke" },
        { id: "drum_tom_hi", icon: "🪘", name: "Rack Tom", desc: "Tuned high rack tom with warm acoustic resonance" },
        { id: "drum_tom_low", icon: "🪘", name: "Floor Tom", desc: "Deep thunderous 16in floor tom punch" },
        { id: "drum_crash", icon: "💥", name: "Crash Cymbal", desc: "18in explosive bronze crash splash with long shimmer" },
        { id: "drum_ride", icon: "✨", name: "Ride Cymbal & Bell", desc: "Crisp stick tip ping with resonant bell ping" },
        { id: "drum_cowbell", icon: "🔔", name: "Latin Cowbell", desc: "Authentic Latin/Rock acoustic cowbell strike" },
        { id: "drum_chimes", icon: "🎐", name: "Studio Wind Chimes", desc: "12-note cascading metallic bar chimes glissando" },
        { id: "drum_conga_hi", icon: "🪘", name: "High Conga Slap", desc: "Crisp Afro-Cuban high palm slap" },
        { id: "drum_conga_low", icon: "🪘", name: "Low Conga Open", desc: "Deep resonant open conga drum tone" },
        { id: "drum_synth_analog", icon: "⚡", name: "Analog Synth Drum", desc: "Classic 80s Simmons SDSV space drum pitch sweep" },
        { id: "drum_tambourine", icon: "🪇", name: "Tambourine", desc: "Acoustic jingle tambourine slap" },
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
        <button class="sfx-trigger-btn" data-sfx-id="${pad.id}">
          TRIGGER
        </button>
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
      elem.addEventListener("click", () => {
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

    // SFX Category Tabs toggle (More / Less)
    const toggleBtn = this.container.querySelector("#btn-sfx-tab-toggle");
    const tabsCont = this.container.querySelector("#sfx-cat-tabs-cont");
    toggleBtn?.addEventListener("click", () => {
      this.sfxTabsExpanded = !this.sfxTabsExpanded;
      if (tabsCont) {
        tabsCont.classList.toggle("expanded", this.sfxTabsExpanded);
      }
      if (toggleBtn) {
        toggleBtn.innerHTML = this.sfxTabsExpanded ? "▴ LESS" : "▾ MORE";
        toggleBtn.classList.toggle("active", this.sfxTabsExpanded);
      }
    });

    // Horizontal wheel scroll when tabs row is collapsed
    tabsCont?.addEventListener("wheel", (e) => {
      if (!this.sfxTabsExpanded && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        tabsCont.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // 5. SFX Category switchers
    this.container.querySelectorAll(".sfx-cat-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-sfx-cat");
        this.activeSfxCategory = cat;
        try { localStorage.setItem("midikey_groove_sfx_cat", cat); } catch (e) {}
        this.render();
        this.bindEvents();
      });
    });

    // 5b. Cancel / stop all running sound effects & long samples
    const cancelBtn = this.container.querySelector("#btn-sfx-cancel");
    if (cancelBtn) {
      const doCancel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        audioCore.ensureRunning();
        this.cancelLongSfx();
        cancelBtn.classList.add("active");
        setTimeout(() => cancelBtn.classList.remove("active"), 200);
      };
      cancelBtn.addEventListener("pointerdown", doCancel);
      cancelBtn.addEventListener("click", doCancel);
    }

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
    this._clearActiveTimeouts();
    try { multiLayerEngine.pcmEngine?.stopSfxSamples?.(); } catch (e) {}
    try { multiLayerEngine.pcmEngine?.allNotesOff?.(true); } catch (e) {}
    if (this.sfxGen) {
      try { this.sfxGen.stopAll(); } catch (e) {}
    }
    try { synthesizerYouEngine.stopAll?.(); } catch (e) {}
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

    // Kit pill click handlers
    this.container.querySelectorAll(".drumkit-pill-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const newKit = btn.getAttribute("data-drum-kit");
        if (newKit && newKit !== this.activeDrumKit) {
          this.activeDrumKit = newKit;
          localStorage.setItem("midikey_groove_drumkit", newKit);
          multiLayerEngine.loadInstrument(newKit).catch(() => {});
          // Re-render to update pad availability
          const padsCont = this.container.querySelector("#sfx-pads-container");
          if (padsCont) {
            padsCont.innerHTML = this.renderSfxPads();
            this.bindSfxPads();
          }
          // Update button active state
          this.container.querySelectorAll(".drumkit-pill-btn").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-drum-kit") === newKit);
          });
        }
      });
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

    // Handle drum kit pads: dkit_${kitId}_${key}
    if (sfxId.startsWith("dkit_")) {
      const lastUnderscore = sfxId.lastIndexOf("_");
      const kitId = sfxId.substring(5, lastUnderscore);
      const note = parseInt(sfxId.substring(lastUnderscore + 1), 10);
      const pcm = multiLayerEngine.pcmEngine;
      let played = false;
      if (pcm) {
        try {
          const v = pcm.playNote(kitId, note, 118, 1.25);
          if (v) played = true;
        } catch (e) {}
      }
      if (!played && this.sfxGen) {
        // Zero-latency acoustic DSP fallback so drums never fail to trigger
        this.sfxGen.trigger("real_drum_kit", note, 118, 1.25);
      }
      return;
    }

    // Handle percussion family pads: perc_${inst}_${key}
    if (sfxId.startsWith("perc_")) {
      const lastUnderscore = sfxId.lastIndexOf("_");
      const inst = sfxId.substring(5, lastUnderscore);
      const note = parseInt(sfxId.substring(lastUnderscore + 1), 10);
      const pcm = multiLayerEngine.pcmEngine;
      let played = false;
      if (pcm) {
        try {
          const v = pcm.playNote(inst, note, 118, 1.25);
          if (v) played = true;
        } catch (e) {}
      }
      if (!played && this.sfxGen) {
        // Zero-latency acoustic DSP fallback
        this.sfxGen.trigger("real_drum_kit", note, 118, 1.25);
      }
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

      // 4. Percussion families (LATIN/WORLD/ORCHESTRA/SYNTH)
      case "perc_latin":
        multiLayerEngine.pcmEngine?.playNote("conga_low", 64, 125, 1.3);
        multiLayerEngine.pcmEngine?.playNote("cowbell", 56, 120, 1.2);
        break;
      case "perc_world":
        multiLayerEngine.pcmEngine?.playNote("bird_tweet", 72, 110, 1.2);
        break;
      case "perc_orchestra":
        multiLayerEngine.pcmEngine?.playNote("orchestra_timpani", 63, 125, 1.3);
        break;
      case "perc_synth":
        this.sfxGen.trigger("tr808_kick", 36, 120, 1.25);
        break;

      // 4a. Electronic & 808 Percussion Pads (Synth Family)
      case "percussion_taiko":
        multiLayerEngine.pcmEngine?.playNote("taiko_drum", 60, 125, 1.3) ||
        this.sfxGen.trigger("percussion_taiko", 48, 120, 1.25);
        break;
      case "percussion_synthdrum":
        this.sfxGen.trigger("percussion_synthdrum", 60, 118, 1.25);
        break;
      case "tr808_kick":
        this.sfxGen.trigger("tr808_kick", 36, 120, 1.25);
        break;
      case "tr808_snare":
        this.sfxGen.trigger("tr808_snare", 38, 118, 1.2);
        break;
      case "tr808_hat_c":
        this.sfxGen.trigger("tr808_hat_c", 42, 110, 1.15);
        break;
      case "tr808_hat_o":
        this.sfxGen.trigger("tr808_hat_o", 46, 115, 1.2);
        break;
      case "percussion_conga_hi":
        this.sfxGen.trigger("percussion_conga", 63, 118, 1.25);
        break;
      case "percussion_shaker":
        this.sfxGen.trigger("percussion_shaker", 69, 115, 1.2);
        break;

      // 4b. REAL Acoustic Drum Kit, Chimes, Cowbell & Congas (0.00ms Zero Latency DSP)
      case "drum_kick":
        this.sfxGen.triggerAcousticKick(118, 1.25);
        break;
      case "drum_snare":
        this.sfxGen.triggerAcousticSnare(112, 1.2);
        break;
      case "drum_hhclosed":
        this.sfxGen.triggerAcousticHiHat(true, 108, 1.15);
        break;
      case "drum_hhopen":
        this.sfxGen.triggerAcousticHiHat(false, 112, 1.2);
        break;
      case "drum_tom_hi":
        this.sfxGen.triggerAcousticTom("high", 110, 1.2);
        break;
      case "drum_tom_low":
        this.sfxGen.triggerAcousticTom("low", 115, 1.25);
        break;
      case "drum_crash":
        this.sfxGen.triggerAcousticCrash(115, 1.25);
        break;
      case "drum_ride":
        this.sfxGen.triggerAcousticRide(108, 1.2);
        break;
      case "drum_cowbell":
        this.sfxGen.triggerCowbell(118, 1.25);
        break;
      case "drum_chimes":
        this.sfxGen.triggerWindChimes(110, 1.3);
        break;
      case "drum_conga_hi":
        this.sfxGen.triggerConga(true, 112, 1.2);
        break;
      case "drum_conga_low":
        this.sfxGen.triggerConga(false, 115, 1.25);
        break;
      case "drum_synth_analog":
        this.sfxGen.triggerAnalogSynthDrum(115, 1.25);
        break;
      case "drum_tambourine":
        this.sfxGen.triggerTambourine(108, 1.15);
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
          this._scheduleSfxNote(() => pcm.playNote("alto_sax", 67, 115, 1.25), 140);
          this._scheduleSfxNote(() => pcm.playNote("alto_sax", 70, 118, 1.25), 290);
          this._scheduleSfxNote(() => pcm.playNote("alto_sax", 72, 125, 1.35), 460);
        }
        break;
      }
      case "sax_sensual": {
        const pcm = multiLayerEngine.pcmEngine;
        if (pcm) {
          pcm.playNote("breath_noise", 60, 90, 0.5);
          pcm.playNote("tenor_sax", 62, 105, 1.2);
          this._scheduleSfxNote(() => pcm.playNote("tenor_sax", 65, 110, 1.2), 150);
          this._scheduleSfxNote(() => pcm.playNote("tenor_sax", 69, 115, 1.25), 300);
          this._scheduleSfxNote(() => pcm.playNote("tenor_sax", 67, 108, 1.15), 460);
          this._scheduleSfxNote(() => pcm.playNote("tenor_sax", 65, 115, 1.25), 630);
        }
        break;
      }
      case "sax_blues_growl": {
        const pcm = multiLayerEngine.pcmEngine;
        if (pcm) {
          pcm.playNote("tenor_sax", 58, 115, 1.25);
          this._scheduleSfxNote(() => pcm.playNote("tenor_sax", 60, 118, 1.25), 120);
          this._scheduleSfxNote(() => pcm.playNote("tenor_sax", 63, 122, 1.25), 260);
          this._scheduleSfxNote(() => pcm.playNote("tenor_sax", 65, 125, 1.3), 420);
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
          this._scheduleSfxNote(() => pcm.playNote("alto_sax", 74, 115, 1.1), 80);
          this._scheduleSfxNote(() => pcm.playNote("alto_sax", 72, 105, 0.9), 160);
          this._scheduleSfxNote(() => pcm.playNote("alto_sax", 69, 90, 0.7), 240);
          this._scheduleSfxNote(() => pcm.playNote("alto_sax", 65, 75, 0.5), 320);
        }
        break;
      }
      case "sax_scoop": {
        const pcm = multiLayerEngine.pcmEngine;
        if (pcm) {
          pcm.playNote("breath_noise", 60, 90, 0.5);
          pcm.playNote("alto_sax", 64, 95, 0.9);
          this._scheduleSfxNote(() => pcm.playNote("alto_sax", 65, 125, 1.3), 70);
        }
        break;
      }

      default:
        break;
    }
  }
}
