/**
 * WILSONIX MIDIKEY Elite - Live Gig HUD & Stage Performance Dashboard
 * Floating lightweight latency analysis popover (anchored, non-blocking),
 * GIG mode, sound & layer selectors, Rig snapshots, WAV recorder, and workspace tabs.
 */

import { synthEngine } from "../audio/synth-engine.js";
import {
  multiLayerEngine,
  HD_SOUNDBANKS,
  COMBI_PRESETS,
} from "../audio/multi-layer-engine.js";
import { audioCore } from "../audio/audio-core.js";
import { licenseManager } from "../security/license-manager.js";
import { masterRecorder } from "../audio/master-recorder.js";
import { registrationManager } from "./registration-manager.js";
import { getTritonProgramById } from "../triton/combi-timbres.js";
import { arpeggiator } from "../audio/arpeggiator.js";
import { midiManager } from "../midi/midi-manager.js";
import { midiOutManager } from "../midi/midi-out.js";
import {
  APP_VERSION,
  BUILD_NUMBER,
  BUILD_DATE,
  getFullVersionString,
} from "../version.js";
import { getComponent } from "./component-registry.js";
import { escapeHtml } from "../utils/escape-html.js";
import { LoggerUI } from "./logger-ui.js";

export class GigHudUI {
  constructor(containerId, onOpenLicenseModal) {
    this.container = document.getElementById(containerId);
    this.onOpenLicenseModal = onOpenLicenseModal;
    this.bpm = 120;
    this.lastTapTimes = [];
    this._latencySmoothed = null;
    this.gigMode = localStorage.getItem("midikey_gig_mode") === "1";

    if (typeof window !== "undefined") {
      window.WILSONIX_VERSION = {
        version: APP_VERSION,
        build: BUILD_NUMBER,
        date: BUILD_DATE,
      };
      console.log(
        `%c[WILSONIX MIDIKEY]%c ${getFullVersionString()}`,
        "color: #ff764d; font-weight: bold;",
        "color: #94a3b8;",
      );
    }
    this.sunlightMode = localStorage.getItem("wilsonix_sunlight_mode") === "1";
    this._vuRunning = false;
    this.vuAnimationId = null;

    const savedTools = localStorage.getItem("midikey_tools_expanded");
    if (savedTools !== null) {
      this.toolsExpanded = savedTools === "1";
    } else {
      this.toolsExpanded = window.innerWidth > 1024;
    }

    if (this.sunlightMode) {
      document.body.classList.add("stage-sunlight-mode");
    }

    this.render();
    this.bindPillInteractions();
    this.bindRecorder();
    this.bindRegistration();
    this.syncToolsIndicator();

    // Bidirectional sync: keep HUD sound dropdown updated with whatever sound is loaded
    multiLayerEngine.addLayerChangeListener(() => {
      this.syncSoundDisplay();
      this.syncToolsIndicator();
    });

    if (!this.gigMode) {
      this.startVuMonitor();
    }
    this.startMemoryLogger();
  }

  refresh() {
    this.render();
    this.bindPillInteractions();
    this.bindRecorder();
    this.bindRegistration();
    this._vuRunning = false;
    if (this.vuAnimationId) cancelAnimationFrame(this.vuAnimationId);
    if (!this.gigMode) {
      this.startVuMonitor();
    }
  }

  getPerformancePresetGroups() {
    return [
      {
        label: "★ SIGNATURE 4-TIMBRE COMBIS",
        items: [
          {
            id: "combi:neo_soul_chill",
            name: "★ Neo-Soul Chill (Studio Rhodes + Universe Pad + Nylon + Sub)",
            type: "combi",
            combiId: "neo_soul_chill",
          },
          {
            id: "combi:lofi_study_beats",
            name: "★ Lo-Fi Study Beats (Felt Upright Piano + Vibraphone + Upright Bass)",
            type: "combi",
            combiId: "lofi_study_beats",
          },
          {
            id: "combi:lofi_vinyl_ep",
            name: "★ Lo-Fi Vintage Tape Rhodes (Vintage EP + Kalimba + Wow & Flutter)",
            type: "combi",
            combiId: "lofi_vinyl_ep",
          },
          {
            id: "combi:bossa_nova_sunset",
            name: "★ Bossa Nova Sunset (Nylon Guitar + Grand + Vibraphone)",
            type: "combi",
            combiId: "bossa_nova_sunset",
          },
          {
            id: "combi:acid_jazz_groove",
            name: "★ Acid Jazz Groove (Rhodes + B3 Rotary + Slap Bass)",
            type: "combi",
            combiId: "acid_jazz_afterhours",
          },
          {
            id: "combi:blue_note_trio",
            name: "★ Blue Note Trio (Upright + Nylon + Upright Bass)",
            type: "combi",
            combiId: "bebop_quartet",
          },
          {
            id: "combi:reggae_bubble",
            name: "★ Kingston Bubble & Reggae Skank (B3 + Piano + Guitar)",
            type: "combi",
            combiId: "reggae_bubble",
          },
          {
            id: "combi:shimmer_worship_celestial",
            name: "★ Celestial Shimmer & Grand (Octave Reverb)",
            type: "combi",
            combiId: "shimmer_worship_celestial",
          },
          {
            id: "combi:talkbox_funk_master",
            name: "★ Roger Troutman Talkbox Lead (Zapp & Roger)",
            type: "combi",
            combiId: "talkbox_funk_master",
          },
          {
            id: "combi:ballad_master",
            name: "★ Concert Grand & Triton Strings",
            type: "combi",
            combiId: "ballad_master",
          },
          {
            id: "combi:tokyo_city_pop",
            name: "★ Tokyo City Pop (FM + Strat + Sax)",
            type: "combi",
            combiId: "tokyo_city_pop",
          },
          {
            id: "combi:chicago_blues_rock",
            name: "★ Chicago Blues (Strat + B3 + Bass)",
            type: "combi",
            combiId: "chicago_blues_rock",
          },
          {
            id: "combi:sunday_pipe_praise",
            name: "★ Sunday Pipe Praise (Organ + Choir)",
            type: "combi",
            combiId: "sunday_pipe_praise",
          },
          {
            id: "combi:gospel_praise",
            name: "★ Gospel Praise (Grand + B3 + Strings)",
            type: "combi",
            combiId: "gospel_praise",
          },
          {
            id: "combi:neo_classical_ambient",
            name: "★ Neo-Classical (Grand + Nylon + Strings)",
            type: "combi",
            combiId: "neo_classical_ambient",
          },
          {
            id: "combi:synthesizer_you",
            name: "★ Synthesizer You (Neo-Soul Rhodes Bed)",
            type: "combi",
            combiId: "synthesizer_you",
          },
          {
            id: "combi:animal_festival_stack",
            name: "🦁 Animal Festival Anthem (Drop Pluck + Festival Lead + Sub)",
            type: "combi",
            combiId: "animal_festival_stack",
          },
          {
            id: "combi:bloom_future_bass_stack",
            name: "🌸 Bloom Future Bass Anthem (Hyper Saw + Vocal Lead + Flume Chord + Reese)",
            type: "combi",
            combiId: "bloom_future_bass_stack",
          },
        ],
      },
      {
        label: "🦁 STICKZ ANIMAL FESTIVAL EDM SOUNDS",
        items: [
          {
            id: "combi:animal_festival_stack",
            name: "🦁 Animal Festival Anthem Stack",
            type: "combi",
            combiId: "animal_festival_stack",
          },
          {
            id: "inst:animal_drop_pluck_1",
            name: "🦁 Animal Drop Pluck 1 (Martin Garrix)",
            type: "inst",
            instId: "animal_drop_pluck_1",
          },
          {
            id: "inst:animal_garrix_pluck",
            name: "🦁 Animal Garrix Drop Pluck",
            type: "inst",
            instId: "animal_garrix_pluck",
          },
          {
            id: "inst:animal_festival_lead_1",
            name: "🦁 Animal Festival Lead 1",
            type: "inst",
            instId: "animal_festival_lead_1",
          },
          {
            id: "inst:animal_dutch_pluck",
            name: "🦁 Animal Dutch Drop Pluck",
            type: "inst",
            instId: "animal_dutch_pluck",
          },
          {
            id: "inst:animal_screamer_lead",
            name: "🦁 Animal Screamer Lead",
            type: "inst",
            instId: "animal_screamer_lead",
          },
          {
            id: "inst:animal_punch_bass_1",
            name: "🦁 Animal Punchy Synth Bass",
            type: "inst",
            instId: "animal_punch_bass_1",
          },
          {
            id: "inst:animal_sub_drop_bass_1",
            name: "🦁 Animal Sub Drop Bass",
            type: "inst",
            instId: "animal_sub_drop_bass_1",
          },
          {
            id: "inst:animal_rave_stab",
            name: "🦁 Animal Rave Drop Stab",
            type: "inst",
            instId: "animal_rave_stab",
          },
        ],
      },
      {
        label: "🌸 STICKZ BLOOM FUTURE BASS SOUNDS",
        items: [
          {
            id: "combi:bloom_future_bass_stack",
            name: "🌸 Bloom Chainsmokers Anthem Stack",
            type: "combi",
            combiId: "bloom_future_bass_stack",
          },
          {
            id: "inst:bloom_closer_lead",
            name: "🌸 Bloom LEAD - Closer",
            type: "inst",
            instId: "bloom_closer_lead",
          },
          {
            id: "inst:bloom_roses_lead",
            name: "🌸 Bloom LEAD - Roses",
            type: "inst",
            instId: "bloom_roses_lead",
          },
          {
            id: "inst:bloom_inside_out_lead",
            name: "🌸 Bloom LEAD - Inside Out",
            type: "inst",
            instId: "bloom_inside_out_lead",
          },
          {
            id: "inst:bloom_let_you_go_lead",
            name: "🌸 Bloom LEAD - Let You Go",
            type: "inst",
            instId: "bloom_let_you_go_lead",
          },
          {
            id: "inst:bloom_wise_lead",
            name: "🌸 Bloom LEAD - Wise",
            type: "inst",
            instId: "bloom_wise_lead",
          },
          {
            id: "inst:bloom_paris_pad",
            name: "🌸 Bloom PAD - Paris",
            type: "inst",
            instId: "bloom_paris_pad",
          },
          {
            id: "inst:bloom_knowledge_pad",
            name: "🌸 Bloom PAD - Knowledge",
            type: "inst",
            instId: "bloom_knowledge_pad",
          },
          {
            id: "inst:bloom_outside_in_pad",
            name: "🌸 Bloom PAD - Outside In",
            type: "inst",
            instId: "bloom_outside_in_pad",
          },
          {
            id: "inst:bloom_all_we_know_pluck",
            name: "🌸 Bloom PLUCK - All We Know",
            type: "inst",
            instId: "bloom_all_we_know_pluck",
          },
          {
            id: "inst:bloom_breakdown_bass",
            name: "🌸 Bloom BASS - Breakdown",
            type: "inst",
            instId: "bloom_breakdown_bass",
          },
          {
            id: "inst:bloom_crushed_sub",
            name: "🌸 Bloom BASS - Crushed Sub",
            type: "inst",
            instId: "bloom_crushed_sub",
          },
          {
            id: "inst:bloom_so_far_pad",
            name: "🌸 Bloom PAD - So Far",
            type: "inst",
            instId: "bloom_so_far_pad",
          },
        ],
      },
      {
        label: "✂️ KEYBOARD SPLIT PRESETS",
        items: [
          {
            id: "split:dub_roots",
            name: "✂️ Split: Roots Dub Sub / Bubble Organ (G3)",
            type: "split",
            splitPoint: 55,
            lower: {
              inst: "synth_bass_1",
              name: "Deep Dub Sub Bass",
              fx: "warm_eq",
              gain: 1.0,
              oct: -1,
            },
            upper: {
              inst: "drawbar_organ",
              name: "Bubble Organ & Chop",
              fx: "reggae_dub",
              gain: 1.0,
              oct: 0,
            },
          },
          {
            id: "split:moog_ep",
            name: "✂️ Split: Moog Bass / Suitcase EP (C4)",
            type: "split",
            splitPoint: 60,
            lower: {
              inst: "synth_bass_1",
              name: "Moog Punch Bass",
              fx: "punch_comp",
              gain: 1.0,
              oct: 0,
            },
            upper: {
              inst: "electric_piano_1",
              name: "Suitcase EP",
              fx: "autopan_wide",
              gain: 1.0,
              oct: 0,
            },
          },
          {
            id: "split:slap_brass",
            name: "✂️ Split: 90s Slap Bass / Fat Brass (A3)",
            type: "split",
            splitPoint: 57,
            lower: {
              inst: "m1_slap_bass",
              name: "Korg M1 Slap Bass",
              fx: "punch_comp",
              gain: 1.0,
              oct: 0,
            },
            upper: {
              inst: "brass_section",
              name: "Triton Fat Brass",
              fx: "tube_warm",
              gain: 1.0,
              oct: 0,
            },
          },
          {
            id: "split:upright_piano",
            name: "✂️ Split: Upright Bass / Concert Grand (C4)",
            type: "split",
            splitPoint: 60,
            lower: {
              inst: "acoustic_bass",
              name: "Upright Walking Bass",
              fx: "warm_eq",
              gain: 1.0,
              oct: 0,
            },
            upper: {
              inst: "acoustic_grand_piano",
              name: "Concert Grand",
              fx: "clean",
              gain: 1.0,
              oct: 0,
            },
          },
          {
            id: "split:synth_sync",
            name: "✂️ Split: Sub Bass / Brian's Sync Lead (C4)",
            type: "split",
            splitPoint: 60,
            lower: {
              inst: "synth_bass_1",
              name: "Analog Sub Bass",
              fx: "punch_comp",
              gain: 1.0,
              oct: 0,
            },
            upper: {
              inst: "va:A017",
              name: "Brian's Sync Lead",
              fx: "tube_warm",
              gain: 1.0,
              oct: 0,
            },
          },
        ],
      },
      {
        label: "🚨 REGGAE, DUB & STAGE SOUND EFFECTS",
        items: [
          {
            id: "inst:dub_siren",
            name: "🚨 Jamaican Dub Siren (Tape Echo Feedback)",
            type: "inst",
            instId: "dub_siren",
          },
          {
            id: "inst:spring_splash",
            name: "💥 Vintage Spring Reverb Splash (Dub Crash)",
            type: "inst",
            instId: "spring_splash",
          },
          {
            id: "inst:laser_zap",
            name: "⚡ Sound System Laser Zap",
            type: "inst",
            instId: "laser_zap",
          },
          {
            id: "inst:dub_horn",
            name: "🎺 Dancehall Stage Airhorn Blast",
            type: "inst",
            instId: "dub_horn",
          },
          {
            id: "inst:sub_boom",
            name: "💣 Heavy 808 Sub-Boom / Bass Drop",
            type: "inst",
            instId: "sub_boom",
          },
          {
            id: "inst:noise_riser",
            name: "🌊 White Noise Sweep & Transition Riser",
            type: "inst",
            instId: "noise_riser",
          },
        ],
      },
      {
        label: "🎷 STAGE SOLO RIGS & FAMOUS SOUNDS",
        items: [
          {
            id: "inst:sax_genuine_solo",
            name: "🎷 Solo Alto Sax (Expressive Breath & Vibrato)",
            type: "inst",
            instId: "sax_genuine_solo",
          },
          {
            id: "inst:sax_sensual",
            name: "🎷 Sensual 80s Breathy Sax",
            type: "inst",
            instId: "sax_sensual",
          },
          {
            id: "inst:sax_blues_growl",
            name: "🎷 Dirty Blues Sax Growl",
            type: "inst",
            instId: "sax_blues_growl",
          },
          {
            id: "va:A045",
            name: "🎤 Roger Troutman Zapp Talkbox Lead (Solo)",
            type: "va",
            progId: "A045",
          },
          {
            id: "va:A017",
            name: "⚡ Brian's Sync Lead (Triton VA)",
            type: "va",
            progId: "A017",
          },
          {
            id: "va:A010",
            name: "⚡ Smooth Sine Lead (Triton VA)",
            type: "va",
            progId: "A010",
          },
          {
            id: "inst:abletunes_upright",
            name: "🎹 Abletunes Studio Upright Piano",
            type: "inst",
            instId: "abletunes_upright",
          },
          {
            id: "inst:abletunes_fm_piano",
            name: "🎹 Abletunes Studio FM DX7 Piano",
            type: "inst",
            instId: "abletunes_fm_piano",
          },
          {
            id: "inst:m1_organ_2",
            name: "🎹 Korg M1 House Organ 2",
            type: "inst",
            instId: "m1_organ_2",
          },
          {
            id: "inst:m1_universe",
            name: "🌌 Korg M1 Universe Celestial Pad",
            type: "inst",
            instId: "m1_universe",
          },
          {
            id: "inst:m1_ooh_ahh",
            name: "🎙️ Korg M1 03 Ooh-Ahh Formant Choir",
            type: "inst",
            instId: "m1_ooh_ahh",
          },
          {
            id: "inst:church_organ",
            name: "⛪ Cathedral Pipe Organ",
            type: "inst",
            instId: "church_organ",
          },
        ],
      },
    ];
  }

  getActiveSoundId() {
    if (multiLayerEngine.isSplitMode) {
      return "split:custom";
    }
    if (
      multiLayerEngine.isTritonVaMode &&
      multiLayerEngine.activeTritonVaProg
    ) {
      return `va:${multiLayerEngine.activeTritonVaProg.id}`;
    }
    if (multiLayerEngine.isCombiMode && multiLayerEngine.activeCombi) {
      return `combi:${multiLayerEngine.activeCombi.id}`;
    }
    const id =
      multiLayerEngine.activeSingleInst ||
      synthEngine.activePatch?.id ||
      "acoustic_grand_piano";
    return `inst:${id}`;
  }

  getActiveSoundName() {
    if (multiLayerEngine.isSplitMode) {
      const lower = multiLayerEngine.splitZones?.lower?.name || "Bass";
      const upper = multiLayerEngine.splitZones?.upper?.name || "Upper";
      return `Split: ${lower} / ${upper}`;
    }
    if (
      multiLayerEngine.isTritonVaMode &&
      multiLayerEngine.activeTritonVaProg
    ) {
      return multiLayerEngine.activeTritonVaProg.name;
    }
    if (multiLayerEngine.isCombiMode && multiLayerEngine.activeCombi) {
      return multiLayerEngine.activeCombi.name;
    }
    const id =
      multiLayerEngine.activeSingleInst ||
      synthEngine.activePatch?.id ||
      "acoustic_grand_piano";
    return HD_SOUNDBANKS[id]?.name || id;
  }

  getSoundIcon() {
    if (multiLayerEngine.isSplitMode) return "✂️";
    if (
      multiLayerEngine.activeTritonVaProg?.id === "A045" ||
      multiLayerEngine.activeCombi?.id === "talkbox_funk_master"
    )
      return "🎤";
    if (multiLayerEngine.isTritonVaMode) return "⚡";
    if (multiLayerEngine.isCombiMode) return "★";
    const inst = (multiLayerEngine.activeSingleInst || "").toLowerCase();
    if (inst.includes("sax")) return "🎷";
    if (inst.includes("organ")) return "⛪";
    if (inst.includes("guitar")) return "🎸";
    if (inst.includes("brass") || inst.includes("trumpet")) return "🎺";
    if (inst.includes("choir") || inst.includes("ooh_ahh")) return "🎙️";
    if (inst.includes("drum") || inst.includes("808")) return "🥁";
    return "🎹";
  }

  render() {
    if (!this.container) return;

    const presetGroups = this.getPerformancePresetGroups();
    const soundbanksList = Object.values(HD_SOUNDBANKS);
    const activeSoundId = this.getActiveSoundId();
    const activeSoundName = this.getActiveSoundName();
    const soundIcon = this.getSoundIcon();

    const isLayerActive =
      multiLayerEngine.isCombiMode &&
      (multiLayerEngine.layers[1]?.enabled ?? true);
    const activeLayerBank =
      multiLayerEngine.layers[1]?.inst || "string_ensemble_1";

    const curBank = registrationManager.currentBank || "A";
    const curSlot = registrationManager.currentSlot || 1;
    const currentBankSlots = registrationManager.banks[curBank] || [];

    this.container.innerHTML = `
      <div class="gig-hud-wrapper">
        <!-- 1. PRIMARY TOP BAR (Balanced 3-column workstation cockpit) -->
        <header class="gig-hud-bar">
          <!-- LEFT: Brand & Live Performance Readout + Stacks Selector -->
          <div class="hud-section hud-left-group">
            <div class="brand-logo">
              <span class="logo-accent">WILSONIX</span><span class="brand-sub"> PRO</span>
            </div>

            <!-- Integrated Master Sound Cockpit (Touch-friendly, zero collisions) -->
            <div class="hud-sound-cockpit" id="hud-sound-cockpit" title="Active Sound & Performance Preset Selector">
              <span class="sound-cockpit-icon" id="hud-live-icon">${soundIcon}</span>
              <span class="sound-cockpit-text" id="hud-live-text">${escapeHtml(activeSoundName)}</span>
              <select class="hud-perf-select" id="hud-perf-select" title="Switch Signature Combis, Keyboard Splits & Solo Rigs">
                ${presetGroups
                  .map(
                    (grp) => `
                  <optgroup label="${grp.label}">
                    ${grp.items
                      .map(
                        (s) => `
                      <option value="${s.id}" ${s.id === activeSoundId ? "selected" : ""}>
                        ${escapeHtml(s.name)}
                      </option>
                    `,
                      )
                      .join("")}
                  </optgroup>
                `,
                  )
                  .join("")}
              </select>
              <span class="sound-cockpit-chevron">▾</span>
            </div>
          </div>

          <!-- CENTER: Workspace Navigation Engine (Fills the center void) -->
          <div class="hud-section hud-center-group">
            <nav class="ws-tabs-bar" id="hud-workspace-tabs">
              <select class="ws-tabs-dropdown" id="hud-ws-tabs-select" title="Switch Workspace View">
                <option value="triton">🎛️ MAIN</option>
                <option value="combi">🎚️ COMBI</option>
                <option value="split">🎹 SPLIT</option>
                <option value="fx">⚡ FX RACK</option>
                <option value="chords">🎼 CHORDS</option>
                <option value="grooves">🥁 GROOVES</option>
                <option value="demo">🎬 DEMO</option>
                <option value="player">🎵 PLAYER</option>
              </select>
              <div class="ws-tabs-buttons">
                <button class="ws-tab-btn active" data-view="triton" title="Main Workstation Console">MAIN</button>
                <button class="ws-tab-btn" data-view="combi" title="4-Timbre Combi Mixer">COMBI</button>
                <button class="ws-tab-btn" data-view="split" title="Split Keyboard Console">SPLIT</button>
                <button class="ws-tab-btn" data-view="fx" title="Master FX Rack">FX</button>
                <button class="ws-tab-btn" data-view="chords" title="Chord Harmony Pads">CHORDS</button>
                <button class="ws-tab-btn" data-view="grooves" title="Backing Grooves">GROOVES</button>
                <button class="ws-tab-btn" data-view="demo" title="30s Interactive Song Clips">DEMO</button>
                <button class="ws-tab-btn" data-view="player" title="Media Player">PLAYER</button>
                <span class="hud-mem-logger" id="hud-mem-logger" title="Memory Logger: decoded sample RAM vs budget (green = healthy, yellow = warning, red = over budget)">MEM --</span>
              </div>
            </nav>
          </div>

          <!-- RIGHT: Master Volume, Keys, Tools Drawer Toggle & Fullscreen -->
          <div class="hud-section hud-right-group">
            <!-- Master Volume Console (Proper studio fader + readout) -->
            <div class="hud-volume-unit" data-midi-param="master_vol" title="Master Volume (Right-click to MIDI Learn)">
              <span class="hud-vol-icon">🔊</span>
              <input type="range" id="hud-master-vol" min="0" max="100" value="50" class="hud-vol-slider" />
              <span class="hud-vol-readout" id="hud-master-vol-val">50%</span>
            </div>

            <div class="hud-quick-actions">
              <button class="ws-tab-btn keys-toggle-btn active" id="btn-hud-toggle-keys" title="Toggle Piano Keyboard (F4)">🎹 KEYS</button>

              <!-- Collapsible Tools Shelf Toggle Button -->
              <button class="hud-tools-toggle ${this.toolsExpanded ? "active" : ""}" id="btn-hud-toggle-tools" title="Toggle Rig Snapshots, Sound Layers, Arp & Transport">
                <span class="tools-btn-icon">${this.toolsExpanded ? "▲" : "⚙️"}</span>
                <span class="tools-btn-label">TOOLS</span>
                ${isLayerActive || arpeggiator.enabled || multiLayerEngine.isPadDuckingEnabled ? `<span class="tools-active-dot"></span>` : ""}
              </button>

              <button class="ws-tab-btn fullscreen-btn" id="btn-toggle-fullscreen" title="Toggle Fullscreen">⛶</button>
            </div>
          </div>
        </header>

        <!-- 2. COLLAPSIBLE SECONDARY STAGE TOOLS SHELF -->
        <div class="hud-tools-drawer ${this.toolsExpanded ? "expanded" : "collapsed"}" id="hud-tools-drawer">
          <div class="tools-drawer-inner">
            <!-- Bay 1: Live Stage Rig Quick Bar -->
            <div class="hud-drawer-bay rig-bay">
              <div class="hud-rig-widget" title="Live Stage Rig Snapshot (Press F1-F8 to switch, Shift+F1-F8 or STORE to save)">
                <span class="rig-label">RIG:</span>
                <div class="rig-bank-pills">
                  <button class="rig-bank-pill ${curBank === "A" ? "active" : ""}" data-bank="A" title="Bank A: Pop / Ballad Stage Set (F9)">A</button>
                  <button class="rig-bank-pill ${curBank === "B" ? "active" : ""}" data-bank="B" title="Bank B: Studio & Groove Set (F10)">B</button>
                  <button class="rig-bank-pill ${curBank === "C" ? "active" : ""}" data-bank="C" title="Bank C: Gospel & Worship Set (F11)">C</button>
                  <button class="rig-bank-pill ${curBank === "D" ? "active" : ""}" data-bank="D" title="Bank D: Solo Leads & Sax Set (F12)">D</button>
                </div>
                <div class="rig-slot-pills">
                  ${[1, 2, 3, 4, 5, 6, 7, 8]
                    .map((num) => {
                      const slotData = currentBankSlots[num - 1];
                      const slotTitle =
                        slotData?.name || `Rig ${curBank}-${num}`;
                      return `
                          <button class="rig-slot-pill ${curSlot === num ? "active" : ""}" data-slot="${num}" title="Rig ${curBank}-${num}: ${escapeHtml(slotTitle)} (Press F${num}, Shift+F${num} to Store)">${num}</button>
                        `;
                    })
                    .join("")}
                </div>
                <div class="rig-actions-capsule">
                  <button class="rig-save-btn" id="hud-rig-save-btn" title="Store Current Sound & FX to Active Slot (Shift+F${curSlot})">💾</button>
                  <button class="rig-save-btn" id="hud-setlist-export" title="Export Rigs & Setlist (.mkgig)">⬇️</button>
                  <button class="rig-save-btn" id="hud-setlist-import-btn" title="Import Rigs & Setlist (.mkgig)">⬆️</button>
                </div>
                <input type="file" id="hud-setlist-import" accept=".mkgig,application/json,.json" hidden />
              </div>
            </div>

            <!-- Bay 2: Sound Layer 2 & Pad Ducking -->
            <div class="hud-drawer-bay layer-bay">
              <div class="hud-layer-box">
                <button class="layer-toggle-btn ${isLayerActive ? "active" : ""}" id="btn-toggle-layer" title="Toggle 2nd Sound Layer">
                  ${isLayerActive ? "LAYER ON" : "LAYER"}
                </button>
                <select class="hud-layer-select ${isLayerActive ? "active" : ""}" id="hud-layer-select" title="Choose 2nd Layer Instrument">
                  ${soundbanksList
                    .map(
                      (b) => `
                    <option value="${b.id}" ${activeLayerBank === b.id ? "selected" : ""}>
                      + ${escapeHtml(b.name)}
                    </option>
                  `,
                    )
                    .join("")}
                </select>
              </div>

              <!-- Ambient Pad Sidechain Ducking Toggle -->
              <button class="duck-toggle-btn ${multiLayerEngine.isPadDuckingEnabled ? "active" : ""}" id="btn-toggle-duck" title="Auto Ambient Pad Sidechain Ducker (Smoothly dips background pad/strings when piano strikes)">
                <span class="duck-led"></span>
                DUCK
              </button>
            </div>

            <!-- Bay 3: Master Lossless WAV Recorder & Arpeggiator -->
            <div class="hud-drawer-bay transport-bay">
              <button class="hud-rec-btn" id="hud-master-rec-btn" title="Record Master Bus to Lossless WAV">
                <span class="rec-dot"></span>
                <span class="rec-label" id="hud-rec-label">REC</span>
              </button>

              <div class="tempo-control-box">
                <button class="arp-btn ${arpeggiator.enabled ? "active" : ""}" id="btn-toggle-arp" title="Live Groove Arpeggiator (Rhythmic Chord Rolls)">
                  <span class="arp-led"></span>
                  ARP
                </button>
                <button class="tempo-tap-btn" id="btn-tap-tempo" title="Tap Tempo">TAP</button>
                <span class="bpm-counter" id="bpm-val">${this.bpm}</span>
                <span class="bpm-label">BPM</span>
              </div>
            </div>

            <!-- Bay 5: Live Status Cluster -->
            <div class="hud-drawer-bay status-bay">
              <div class="hud-status-cluster">
                <!-- GIG Mode Pill -->
                <button class="gig-mode-btn ${this.gigMode ? "active" : ""}" id="hud-gig-btn" title="GIG MODE: Disables background UI meters to eliminate audio jitter during live stage gigs">
                  GIG
                </button>

                <!-- Floating Anchored Latency Pill (Click for analysis popover) -->
                <div class="latency-hud-pill interactive" id="hud-latency-pill" title="Click for round-trip latency analysis">
                  <span class="latency-dot"></span>
                  <span id="hud-latency-val">--</span>
                </div>

                <!-- MIDI Status Pill -->
                <div class="midi-status-pill" id="hud-midi-pill" title="Hardware MIDI Status">
                  <span class="midi-indicator"></span>
                  <span>MIDI</span>
                </div>

                <!-- Sunlight / Dark Mode -->
                <button class="sunlight-mode-btn ${this.sunlightMode ? "active" : ""}" id="hud-sunlight-btn" title="Toggle Stage Sunlight Contrast">
                  ${this.sunlightMode ? "☀️" : "🌙"}
                </button>

                <!-- Global Build & Version Badge -->
                <div class="hud-drawer-version" id="hud-drawer-version" title="${getFullVersionString()}">
                  <span class="version-dot"></span>
                  <span class="version-text">v${APP_VERSION}b${BUILD_NUMBER}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindRecorder() {
    const recBtn = document.getElementById("hud-master-rec-btn");
    const recLabel = document.getElementById("hud-rec-label");

    recBtn?.addEventListener("click", () => {
      if (!licenseManager.hasProAccess()) {
        licenseManager.requirePro("Master WAV Audio Recording");
        return;
      }

      if (!masterRecorder.isRecording) {
        masterRecorder.start();
        recBtn.classList.add("recording");
      } else {
        masterRecorder.stopAndExport();
        recBtn.classList.remove("recording");
        if (recLabel) recLabel.innerText = "REC";
      }
    });

    masterRecorder.onStateChange = (state) => {
      if (state.isRecording) {
        if (recLabel) recLabel.innerText = state.formattedTime;
      } else {
        if (recLabel) recLabel.innerText = "REC";
      }
      this.syncToolsIndicator();
    };
  }

  bindRegistration() {
    const bankBtns = this.container.querySelectorAll(".rig-bank-pill");
    const slotBtns = this.container.querySelectorAll(".rig-slot-pill");

    bankBtns.forEach((btn) => {
      let lastTap = 0;
      const handleBank = (e) => {
        if (e && e.type === "pointerdown") {
          e.preventDefault();
        }
        const now = performance.now();
        if (now - lastTap < 80) return;
        lastTap = now;

        bankBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const bank = btn.getAttribute("data-bank");
        registrationManager.currentBank = bank;
        registrationManager.recallSlot(bank, registrationManager.currentSlot);
      };
      btn.addEventListener("pointerdown", handleBank);
      btn.addEventListener("click", handleBank);
    });

    slotBtns.forEach((btn) => {
      let lastTap = 0;
      const handleSlot = (e) => {
        if (e && e.type === "pointerdown") {
          e.preventDefault();
        }
        const now = performance.now();
        if (now - lastTap < 80) return;
        lastTap = now;

        slotBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const slot = parseInt(btn.getAttribute("data-slot"), 10);
        registrationManager.recallSlot(registrationManager.currentBank, slot);
      };
      btn.addEventListener("pointerdown", handleSlot);
      btn.addEventListener("click", handleSlot);
    });

    document
      .getElementById("hud-rig-save-btn")
      ?.addEventListener("click", () => {
        if (!licenseManager.hasProAccess()) {
          licenseManager.requirePro("Storing Custom Stage Rigs");
          return;
        }
        const saved = registrationManager.saveCurrentToSlot(
          registrationManager.currentBank,
          registrationManager.currentSlot,
        );
        if (registrationManager.onRecallCallback) {
          registrationManager.onRecallCallback({
            bank: registrationManager.currentBank,
            slot: registrationManager.currentSlot,
            preset: saved,
          });
        }
      });

    // P3.7: Export/Import setlist (.mkgig) — Pro-gated, validated via importSetlist
    document
      .getElementById("hud-setlist-export")
      ?.addEventListener("click", () => {
        if (!licenseManager.hasProAccess()) {
          licenseManager.requirePro("Exporting Stage Rigs & Setlist");
          return;
        }
        registrationManager.exportSetlist();
      });

    const importInput = document.getElementById("hud-setlist-import");
    document
      .getElementById("hud-setlist-import-btn")
      ?.addEventListener("click", () => {
        if (!licenseManager.hasProAccess()) {
          licenseManager.requirePro("Importing Stage Rigs & Setlist");
          return;
        }
        importInput?.click();
      });
    importInput?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const ok = registrationManager.importSetlist(text);
      if (ok) {
        this.render();
        this.syncSoundDisplay();
      } else {
        alert("Invalid .mkgig file — could not import setlist.");
      }
      e.target.value = "";
    });

    // P3.8: MIDI OUT bindings
    const midiOutSelect = document.getElementById("hud-midi-out-select");
    midiOutSelect?.addEventListener("change", (e) => {
      const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
      midiManager.clearMidiOutputs();
      selected.forEach((id, i) => midiManager.selectMidiOutput(id, i > 0));
    });

    document
      .getElementById("btn-midi-clock")
      ?.addEventListener("click", () => {
        if (midiOutManager.clockRunning) {
          midiOutManager.stopClock();
        } else {
          midiOutManager.startClock(this.bpm);
        }
        this.syncToolsIndicator();
      });

    registrationManager.onRecallCallback = ({ bank, slot, preset }) => {
      bankBtns.forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-bank") === bank),
      );
      slotBtns.forEach((b) =>
        b.classList.toggle(
          "active",
          parseInt(b.getAttribute("data-slot")) === slot,
        ),
      );
      this.syncSoundDisplay();
      // P3.8: Send Program Change on registration recall (Bank A=0..7, B=8..15, C=16..23, D=24..31)
      const bankLetters = ["A", "B", "C", "D"];
      const bankIdx = bankLetters.indexOf(bank);
      if (bankIdx >= 0) {
        const program = bankIdx * 8 + (slot - 1);
        try { midiOutManager.programChange(0, program); } catch (e) {}
      }

      const layerBtn = document.getElementById("btn-toggle-layer");
      const layerSelect = document.getElementById("hud-layer-select");
      const isLayerOn =
        preset?.isCombiMode ||
        (multiLayerEngine.isCombiMode &&
          (multiLayerEngine.layers[1]?.enabled ?? false));
      if (layerBtn) {
        layerBtn.classList.toggle("active", !!isLayerOn);
        layerBtn.innerText = isLayerOn ? "LAYER ON" : "LAYER";
      }
      if (layerSelect) {
        layerSelect.classList.toggle("active", !!isLayerOn);
      }
    };
  }

  applySelectedSound(selectedId) {
    if (!selectedId) return;

    if (selectedId.startsWith("combi:")) {
      if (!licenseManager.hasProAccess()) {
        licenseManager.requirePro("4-Timbre Layered Combi Presets");
        this.syncSoundDisplay();
        return;
      }
      const combiId = selectedId.slice(6);
      multiLayerEngine.setCombiPreset(combiId);
      this.syncSoundDisplay();
      getComponent("tritonConsole")?.syncLcdFromRigSelection?.();
      return;
    }

    if (selectedId.startsWith("split:")) {
      const splitType = selectedId.slice(6);
      if (splitType === "dub_roots") {
        multiLayerEngine.toggleSplitMode(true);
        multiLayerEngine.setSplitPointMidi(55);
        multiLayerEngine.setSplitZoneInstrument("lower", "synth_bass_1");
        multiLayerEngine.setSplitZoneInstrument("upper", "drawbar_organ");
        multiLayerEngine.setSplitZoneFx("lower", "warm_eq");
        multiLayerEngine.setSplitZoneFx("upper", "reggae_dub");
      } else if (splitType === "moog_ep") {
        multiLayerEngine.toggleSplitMode(true);
        multiLayerEngine.setSplitPointMidi(60);
        multiLayerEngine.setSplitZoneInstrument("lower", "synth_bass_1");
        multiLayerEngine.setSplitZoneInstrument("upper", "electric_piano_1");
        multiLayerEngine.setSplitZoneFx("lower", "punch_comp");
        multiLayerEngine.setSplitZoneFx("upper", "autopan_wide");
      } else if (splitType === "slap_brass") {
        multiLayerEngine.toggleSplitMode(true);
        multiLayerEngine.setSplitPointMidi(57);
        multiLayerEngine.setSplitZoneInstrument("lower", "m1_slap_bass");
        multiLayerEngine.setSplitZoneInstrument("upper", "brass_section");
        multiLayerEngine.setSplitZoneFx("lower", "punch_comp");
        multiLayerEngine.setSplitZoneFx("upper", "tube_warm");
      } else if (splitType === "upright_piano") {
        multiLayerEngine.toggleSplitMode(true);
        multiLayerEngine.setSplitPointMidi(60);
        multiLayerEngine.setSplitZoneInstrument("lower", "acoustic_bass");
        multiLayerEngine.setSplitZoneInstrument(
          "upper",
          "acoustic_grand_piano",
        );
        multiLayerEngine.setSplitZoneFx("lower", "warm_eq");
        multiLayerEngine.setSplitZoneFx("upper", "clean");
      } else if (splitType === "synth_sync") {
        multiLayerEngine.toggleSplitMode(true);
        multiLayerEngine.setSplitPointMidi(60);
        multiLayerEngine.setSplitZoneInstrument("lower", "synth_bass_1");
        multiLayerEngine.setSplitZoneInstrument("upper", "va:A017");
      }
      this.syncSoundDisplay();
      getComponent("tritonConsole")?.syncLcdFromRigSelection?.();
      return;
    }

    if (selectedId.startsWith("va:")) {
      const progId = selectedId.slice(3);
      const prog = getTritonProgramById(progId);
      if (prog) {
        multiLayerEngine.setTritonVaProgram(prog);
        getComponent("tritonConsole")?.selectProgramById?.(progId);
      }
      this.syncSoundDisplay();
      return;
    }

    if (selectedId.startsWith("inst:")) {
      const instId = selectedId.slice(5);
      multiLayerEngine.setSingleInstrument(instId);
      synthEngine.setPatch(instId);
      this.syncSoundDisplay();
      getComponent("tritonConsole")?.syncLcdFromRigSelection?.();
      return;
    }

    // Direct fallback
    if (COMBI_PRESETS[selectedId]) {
      multiLayerEngine.setCombiPreset(selectedId);
      this.syncSoundDisplay();
      getComponent("tritonConsole")?.syncLcdFromRigSelection?.();
      return;
    }
    const tritonProg = getTritonProgramById(selectedId);
    if (tritonProg) {
      multiLayerEngine.setTritonVaProgram(tritonProg);
      getComponent("tritonConsole")?.selectProgramById?.(selectedId);
      this.syncSoundDisplay();
      return;
    }
    multiLayerEngine.setSingleInstrument(selectedId);
    synthEngine.setPatch(selectedId);
    this.syncSoundDisplay();
    getComponent("tritonConsole")?.syncLcdFromRigSelection?.();
  }

  syncSoundDisplay() {
    // 1. Update Live Active Sound Badge (Instant, zero lag readout)
    const liveText = document.getElementById("hud-live-text");
    const liveIcon = document.getElementById("hud-live-icon");
    if (liveText) liveText.innerText = this.getActiveSoundName();
    if (liveIcon) liveIcon.innerText = this.getSoundIcon();

    // 2. Sync Performance Stacks / Combi / Split select dropdown
    const perfSelect = document.getElementById("hud-perf-select");
    if (perfSelect) {
      const activeId = this.getActiveSoundId();
      let found = false;
      for (let i = 0; i < perfSelect.options.length; i++) {
        if (perfSelect.options[i].value === activeId) {
          perfSelect.selectedIndex = i;
          found = true;
          break;
        }
      }
      if (!found) {
        let customOpt = perfSelect.querySelector(
          'option[data-dynamic-active="true"]',
        );
        if (!customOpt) {
          customOpt = document.createElement("option");
          customOpt.setAttribute("data-dynamic-active", "true");
          perfSelect.appendChild(customOpt);
        }
        customOpt.value = activeId;
        customOpt.innerText = `${this.getSoundIcon()} ${this.getActiveSoundName()}`;
        customOpt.selected = true;
      } else {
        const customOpt = perfSelect.querySelector(
          'option[data-dynamic-active="true"]',
        );
        if (customOpt) customOpt.remove();
      }
    }

    // 3. Refresh rig slot pill titles and tooltips for current bank
    const curBank = registrationManager.currentBank || "A";
    const bankSlots = registrationManager.banks[curBank] || [];
    const slotBtns = this.container.querySelectorAll(".rig-slot-pill");
    slotBtns.forEach((btn) => {
      const slotNum = parseInt(btn.getAttribute("data-slot"));
      const slotData = bankSlots[slotNum - 1];
      const slotTitle = slotData?.name || `Rig ${curBank}-${slotNum}`;
      btn.title = `Rig ${curBank}-${slotNum}: ${slotTitle} (Press F${slotNum}, Shift+F${slotNum} to Store)`;
    });
  }

  updateMemoryLogger() {
    const pill = document.getElementById("hud-mem-logger");
    if (!pill) return;
    let usedMB = null;
    let budgetMB = null;
    try {
      const s = multiLayerEngine.pcmEngine?.getDecodedBufferStats?.();
      if (s && Number.isFinite(s.bytes) && Number.isFinite(s.budget) && s.budget > 0) {
        usedMB = Math.round(s.bytes / 1024 / 1024);
        budgetMB = Math.round(s.budget / 1024 / 1024);
      }
    } catch (e) {}
    if (usedMB === null) {
      pill.textContent = "MEM --";
      pill.className = pill.classList.contains("logger-open")
        ? "hud-mem-logger logger-open"
        : "hud-mem-logger";
      return;
    }
    const pct = (usedMB / budgetMB) * 100;
    const state = pct > 100 ? "error" : pct > 70 ? "warn" : "good";
    pill.textContent = `MEM ${usedMB}/${budgetMB}MB`;
    pill.className = pill.classList.contains("logger-open")
      ? `hud-mem-logger logger-open ${state}`
      : `hud-mem-logger ${state}`;
  }

  startMemoryLogger() {
    if (this._memLoggerTimer) return;
    this.updateMemoryLogger();
    this._memLoggerTimer = setInterval(() => this.updateMemoryLogger(), 2000);
  }

  toggleLoggerPanel() {
    let overlay = document.getElementById("logger-panel-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "logger-panel-overlay";
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,0.78);display:none;align-items:center;justify-content:center;z-index:9998;padding:24px;";
      const close = document.createElement("div");
      close.textContent = "\u00d7";
      close.style.cssText =
        "position:absolute;top:10px;right:22px;color:#e5e7eb;font-size:30px;cursor:pointer;z-index:9999;line-height:1;";
      close.addEventListener("click", () => this.toggleLoggerPanel());
      const mount = document.createElement("div");
      mount.id = "logger-mount";
      mount.style.cssText =
        "width:min(1500px,98vw);height:min(950px,96vh);";
      overlay.appendChild(close);
      overlay.appendChild(mount);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) this.toggleLoggerPanel();
      });
      document.body.appendChild(overlay);
      this._loggerUI = new LoggerUI("logger-mount");
    }
    const isOpen = overlay.style.display !== "none";
    overlay.style.display = isOpen ? "none" : "flex";
    const pill = document.getElementById("hud-mem-logger");
    if (pill) pill.classList.toggle("logger-open", !isOpen);
  }

  bindPillInteractions() {
    // 0. Memory Logger pill — opens the Performance Logger panel
    document
      .getElementById("hud-mem-logger")
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleLoggerPanel();
      });

    // 1. License modal
    document
      .getElementById("hud-license-btn")
      ?.addEventListener("click", () => {
        if (this.onOpenLicenseModal) this.onOpenLicenseModal();
      });

    // 2. Performance Stacks & Signature Sounds Picker
    const perfSelect = document.getElementById("hud-perf-select");
    perfSelect?.addEventListener("change", (e) => {
      this.applySelectedSound(e.target.value);
      this.syncSoundDisplay();
    });

    // 3. Layer Toggle & Sound Selection
    const layerBtn = document.getElementById("btn-toggle-layer");
    const layerSelect = document.getElementById("hud-layer-select");

    layerBtn?.addEventListener("click", () => {
      const isCurrentlyActive =
        multiLayerEngine.isCombiMode &&
        (multiLayerEngine.layers[1]?.enabled ?? true);
      const nextActive = !isCurrentlyActive;

      multiLayerEngine.toggleCombiMode(nextActive);
      if (multiLayerEngine.layers[1]) {
        multiLayerEngine.layers[1].enabled = nextActive;
      }

      layerBtn.classList.toggle("active", nextActive);
      layerBtn.innerText = nextActive ? "LAYER ON" : "LAYER";
      if (layerSelect) {
        layerSelect.classList.toggle("active", nextActive);
      }
      this.syncToolsIndicator();
    });

    layerSelect?.addEventListener("change", (e) => {
      const bankId = e.target.value;
      if (multiLayerEngine.layers[1]) {
        multiLayerEngine.layers[1].inst = bankId;
        multiLayerEngine.layers[1].enabled = true;
      }
      multiLayerEngine.toggleCombiMode(true);
      if (layerBtn) {
        layerBtn.classList.add("active");
        layerBtn.innerText = "LAYER ON";
      }
      layerSelect.classList.add("active");
      this.syncToolsIndicator();
    });

    // Ambient Pad Sidechain Ducking Toggle
    const duckBtn = document.getElementById("btn-toggle-duck");
    duckBtn?.addEventListener("click", () => {
      multiLayerEngine.togglePadDucking();
      const isActive = multiLayerEngine.isPadDuckingEnabled;
      duckBtn.classList.toggle("active", isActive);
      this.syncToolsIndicator();
    });

    // Arpeggiator Toggle
    const arpBtn = document.getElementById("btn-toggle-arp");
    arpBtn?.addEventListener("click", () => {
      arpeggiator.setEnabled();
      const isActive = arpeggiator.enabled;
      arpBtn.classList.toggle("active", isActive);
      this.syncToolsIndicator();
    });

    // Sync Arpeggiator callback
    arpeggiator.onStateChangeCallback = (enabled, bpm) => {
      const b = document.getElementById("btn-toggle-arp");
      if (b) b.classList.toggle("active", enabled);
      const bpmEl = document.getElementById("bpm-val");
      if (bpmEl && typeof bpm === "number") {
        bpmEl.innerText = bpm;
        this.bpm = bpm;
      }
      if (midiOutManager.clockRunning && typeof bpm === "number") {
        midiOutManager.setBpm(bpm);
      }
      this.syncToolsIndicator();
    };

    // Tap Tempo Interaction
    const tapBtn = document.getElementById("btn-tap-tempo");
    const bpmVal = document.getElementById("bpm-val");
    tapBtn?.addEventListener("click", () => {
      const now = performance.now();
      this.lastTapTimes.push(now);
      if (this.lastTapTimes.length > 4) this.lastTapTimes.shift();

      if (this.lastTapTimes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < this.lastTapTimes.length; i++) {
          intervals.push(this.lastTapTimes[i] - this.lastTapTimes[i - 1]);
        }
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (avg > 150 && avg < 2000) {
          this.bpm = Math.round(60000 / avg);
          if (bpmVal) bpmVal.innerText = this.bpm;
          arpeggiator.setBpm(this.bpm);
          if (midiOutManager.clockRunning) midiOutManager.setBpm(this.bpm);
        }
      }
    });

    // 4. GIG Mode Toggle
    const gigBtn = document.getElementById("hud-gig-btn");
    gigBtn?.addEventListener("click", () => {
      this.gigMode = !this.gigMode;
      localStorage.setItem("midikey_gig_mode", this.gigMode ? "1" : "0");
      gigBtn.classList.toggle("active", this.gigMode);
      if (this.gigMode) {
        this._vuRunning = false;
        if (this.vuAnimationId) cancelAnimationFrame(this.vuAnimationId);
      } else {
        this.startVuMonitor();
      }
    });

    // 5. Floating Anchored Latency Popover (Old Non-Blocking Implementation)
    const latencyVal = document.getElementById("hud-latency-val");
    const latencyPill = document.getElementById("hud-latency-pill");

    const paintLatency = (l) => {
      const shown = l.measuredMs || l.reportedMs;
      if (!shown || !latencyVal) return;
      this._latencySmoothed =
        this._latencySmoothed === null
          ? shown
          : this._latencySmoothed * 0.6 + shown * 0.4;
      latencyVal.innerText = `${this._latencySmoothed.toFixed(1)}ms`;
      latencyPill?.classList.toggle("latency-warm", this._latencySmoothed > 20);
      latencyPill?.classList.toggle("latency-hot", this._latencySmoothed > 50);
    };

    latencyPill?.addEventListener("click", (e) => {
      e.stopPropagation();
      const l = audioCore.measureLatency();
      this._renderLatencyPopover(l, this._latencySmoothed);
      paintLatency(l);
    });

    // Keep the latency pill active state in sync whenever the profile changes
    // from any surface (picker here, settings, future devices), and reflect
    // the "applies next launch" state the moment it is saved.
    audioCore.onLatencyProfileChange((prof) => {
      const newL = audioCore.measureLatency();
      paintLatency(newL);
      this._pendingLatencyProfile = prof;
    });

    window.addEventListener("click", () => this._closeLatencyPopover());

    // 7. Sunlight Mode Toggle
    const sunBtn = document.getElementById("hud-sunlight-btn");
    sunBtn?.addEventListener("click", () => {
      this.sunlightMode = !this.sunlightMode;
      document.body.classList.toggle("stage-sunlight-mode", this.sunlightMode);
      localStorage.setItem(
        "wilsonix_sunlight_mode",
        this.sunlightMode ? "1" : "0",
      );
      if (sunBtn) {
        sunBtn.innerText = this.sunlightMode ? "☀️" : "🌙";
        sunBtn.classList.toggle("active", this.sunlightMode);
      }
    });

    // 8. Master Volume Slider
    const volSlider = document.getElementById("hud-master-vol");
    const volReadout = document.getElementById("hud-master-vol-val");
    volSlider?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      multiLayerEngine.setMasterVolumePct(val);
      if (volReadout) volReadout.innerText = `${val}%`;
    });

    // 9. Top HUD Piano Keys Toggle Button
    const topKeysBtn = document.getElementById("btn-hud-toggle-keys");
    topKeysBtn?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("wilsonix-toggle-piano-collapse"));
    });

    // 10. Tools Drawer Toggle Button
    const toolsBtn = document.getElementById("btn-hud-toggle-tools");
    toolsBtn?.addEventListener("click", () => {
      this.toggleToolsDrawer();
    });
  }

  toggleToolsDrawer() {
    this.toolsExpanded = !this.toolsExpanded;
    localStorage.setItem(
      "midikey_tools_expanded",
      this.toolsExpanded ? "1" : "0",
    );
    const drawer = document.getElementById("hud-tools-drawer");
    const btn = document.getElementById("btn-hud-toggle-tools");
    if (drawer) {
      drawer.classList.toggle("expanded", this.toolsExpanded);
      drawer.classList.toggle("collapsed", !this.toolsExpanded);
    }
    if (btn) {
      btn.classList.toggle("active", this.toolsExpanded);
      const icon = btn.querySelector(".tools-btn-icon");
      if (icon) icon.innerText = this.toolsExpanded ? "▲" : "⚙️";
    }
  }

  syncToolsIndicator() {
    const btn = document.getElementById("btn-hud-toggle-tools");
    if (!btn) return;
    const isLayerActive =
      multiLayerEngine.isCombiMode &&
      (multiLayerEngine.layers[1]?.enabled ?? false);
    const isArpActive = arpeggiator.enabled;
    const isDuckActive = multiLayerEngine.isPadDuckingEnabled;
    const isRecActive = masterRecorder.isRecording;
    const hasActiveTools =
      isLayerActive || isArpActive || isDuckActive || isRecActive;

    let dot = btn.querySelector(".tools-active-dot");
    if (hasActiveTools) {
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "tools-active-dot";
        btn.appendChild(dot);
      }
    } else if (dot) {
      dot.remove();
    }

    // P3.8: MIDI Clock button sync
    const clockBtn = document.getElementById("btn-midi-clock");
    if (clockBtn) {
      clockBtn.classList.toggle("active", midiOutManager.clockRunning);
    }
  }

  startVuMonitor() {
    if (this._vuRunning) return;
    this._vuRunning = true;

    const latencyVal = document.getElementById("hud-latency-val");
    const latencyPill = document.getElementById("hud-latency-pill");
    let lastUpdate = 0;

    const updateFrame = (now) => {
      if (!this._vuRunning) return;

      // Throttle to ~10Hz, matching the original setInterval(100) cadence.
      // requestAnimationFrame lets the tab pause the loop when backgrounded
      // instead of burning CPU for a hidden HUD.
      if (now - lastUpdate >= 100) {
        lastUpdate = now;
        const l = audioCore.measureLatency();
        const shown = l.measuredMs || l.reportedMs;
        if (shown) {
          this._latencySmoothed =
            this._latencySmoothed === null
              ? shown
              : this._latencySmoothed * 0.6 + shown * 0.4;
          if (latencyVal) {
            latencyVal.innerText = `${this._latencySmoothed.toFixed(1)}ms`;
            latencyPill?.classList.toggle(
              "latency-warm",
              this._latencySmoothed > 20,
            );
            latencyPill?.classList.toggle(
              "latency-hot",
              this._latencySmoothed > 50,
            );
          }
        }
      }
      this.vuAnimationId = requestAnimationFrame(updateFrame);
    };

    this.vuAnimationId = requestAnimationFrame(updateFrame);
  }

  stopVuMonitor() {
    this._vuRunning = false;
    if (this.vuAnimationId) {
      cancelAnimationFrame(this.vuAnimationId);
      this.vuAnimationId = null;
    }
  }

  _renderLatencyPopover(l, smoothed) {
    this._closeLatencyPopover();

    const pill = document.getElementById("hud-latency-pill");
    if (!pill) return;
    const rect = pill.getBoundingClientRect();

    const pop = document.createElement("div");
    pop.className = "latency-popover";
    pop.id = "hud-latency-popover";

    const shown = l.measuredMs || l.reportedMs;
    const primary =
      smoothed !== null
        ? `${smoothed.toFixed(1)}ms`
        : `${(shown ?? 0).toFixed(1)}ms`;
    const bufferMs = l.baseMs;
    const bufferSamples = l.sampleRate
      ? Math.round((bufferMs / 1000) * l.sampleRate)
      : 0;
    const measuredFrames = l.measuredFrames || bufferSamples;
    const stalled = l.lockMs !== null && Math.abs(l.lockMs) > 50;
    const currentProf = l.profile || "balanced";
    const recom = l.recommendedProfile;

    const rows = [
      ["BUFFER PROFILE", l.profileLabel || "Balanced Studio"],
      ["ROUND-TRIP (Buffer+Output)", `${(l.measuredMs ?? 7.6).toFixed(1)} ms`],
      ["SMOOTHED (10Hz avg)", primary],
      [
        "Base buffer (input side)",
        `${(l.baseMs ?? 2.6).toFixed(1)} ms (${bufferSamples} samples @ ${((l.sampleRate || 48000) / 1000).toFixed(1)} kHz)`,
      ],
      [
        "Negotiated buffer",
        measuredFrames > 0 ? `${measuredFrames} frames` : "—",
      ],
      [
        "Audio clock lock (drift)",
        l.lockMs === null ? "—" : `${l.lockMs.toFixed(1)} ms`,
      ],
      ["Engine state", l.state || "running"],
    ]
      .map(
        ([k, v]) => `
      <div class="latency-pop-row">
        <span class="latency-pop-key">${k}</span>
        <span class="latency-pop-val">${v}</span>
      </div>`,
      )
      .join("");

    pop.innerHTML = `
      <div class="latency-pop-head">
        <span>ROUND-TRIP LATENCY & BUFFER CONTROL</span>
        <button class="latency-pop-close" id="hud-latency-close" title="Close">✕</button>
      </div>
      <div class="latency-pop-columns">
        <!-- COLUMN 1: AUDIO ENGINE & HARDWARE OUTPUT -->
        <div class="latency-pop-col">
          <div class="latency-profile-section">
            <div class="latency-profile-title">BUFFER / LATENCY PROFILE</div>
            <div class="latency-profile-pills">
              <button class="latency-prof-btn ${currentProf === "ultra-low" ? "active" : ""}" data-profile="ultra-low" title="64–128 frames / Fastest response for dedicated audio interfaces">
                <span class="prof-title">STAGE ULTRA-LOW</span>
                <span class="prof-sub">≤128 frames</span>
              </button>
              <button class="latency-prof-btn ${currentProf === "balanced" ? "active" : ""}" data-profile="balanced" title="256 frames / Stable performance for general laptop audio">
                <span class="prof-title">BALANCED STUDIO</span>
                <span class="prof-sub">256 frames</span>
              </button>
              <button class="latency-prof-btn ${currentProf === "safe" ? "active" : ""}" data-profile="safe" title="512 frames / Maximum glitch-free headroom for heavy polyphony">
                <span class="prof-title">SAFE STAGE</span>
                <span class="prof-sub">512 frames</span>
              </button>
            </div>
          </div>
          <div class="latency-pop-body">${rows}</div>
          ${
            recom
              ? `<div class="latency-pop-reco ${recom.isActive ? "reco-active" : ""}">
                  ${
                    recom.isActive
                      ? "✔ Negotiated buffer matches this profile."
                      : `💡 Device negotiated ${measuredFrames} frames — closest: <b>${recom.label}</b>.`
                  }
                </div>`
              : ""
          }
          <div class="latency-pop-tip">
            <span>${
              stalled
                ? "⚠️ Audio clock stalled — play a note to re-lock."
                : l.pendingRestart
                  ? "🔄 Saved — buffer profile applies on next launch (no audio restart needed)."
                  : "🔹 Real latency = base buffer + OS output buffer."
            }</span>
          </div>

          <!-- Audio Output Device -->
          <div class="latency-device-section" id="latency-device-section">
            <div class="latency-profile-title">🔈 AUDIO OUTPUT DEVICE</div>
            <select class="latency-device-select" id="latency-device-select">
              <option value="">Default</option>
            </select>
            <div class="latency-pop-reco">
              🔌 Select USB audio interface or wired output.
              ⚠️ Never use Bluetooth for live keyboards.
            </div>
          </div>

          <!-- Binaural Monitor -->
          <div class="latency-device-section" id="latency-spatial-section">
            <div class="latency-profile-title">🎧 BINAURAL MONITOR</div>
            <select class="latency-device-select" id="latency-spatial-select">
              <option value="off" selected>OFF (Dry Signal)</option>
            </select>
            <div class="latency-pop-reco">
              🎧 HRTF 3D spatial for headphones. Best with wired IEMs.
            </div>
          </div>
        </div>

        <!-- COLUMN 2: CONTROLLER & PERFORMANCE -->
        <div class="latency-pop-col">
          <!-- MIDI OUT & SYNC -->
          <div class="latency-device-section" id="latency-midi-section">
            <div class="latency-profile-title">🔌 MIDI OUT & SYNC</div>
            <div class="midi-out-popover-widget">
              <div class="midi-out-row">
                <label for="latency-midi-out-select" class="midi-out-label">
                  <span>OUTPUT PORTS:</span>
                  <span class="midi-out-subhint">Ctrl+Click for multi</span>
                </label>
                <select id="latency-midi-out-select" class="midi-out-select" title="Select MIDI Output Port(s)" multiple>
                  ${
                    midiManager.getMidiOutputList().length > 0
                      ? midiManager.getMidiOutputList()
                          .map(
                            (o) => `<option value="${o.id}" ${midiManager.getSelectedMidiOutputs().some(s => s.id === o.id) ? "selected" : ""}>${escapeHtml(o.name)}</option>`
                          )
                          .join("")
                      : `<option value="" disabled>(No MIDI outputs detected)</option>`
                  }
                </select>
              </div>
              <div class="midi-out-controls-row">
                <div class="midi-out-row">
                  <label for="latency-midi-channel" class="midi-out-label">CHANNEL:</label>
                  <select id="latency-midi-channel" class="midi-out-select">
                    ${Array.from({length: 16}, (_, i) => `<option value="${i}" ${i === 0 ? "selected" : ""}>Ch ${i+1}</option>`).join("")}
                  </select>
                </div>
                <div class="midi-out-row">
                  <label class="midi-out-label">CLOCK SYNC:</label>
                  <div class="midi-out-sync-row">
                    <button class="midi-clock-btn ${midiOutManager.clockRunning ? "active" : ""}" id="latency-btn-midi-clock" title="Toggle MIDI Clock Sync (Start/Stop sends MIDI Start/Stop)">
                      <span class="clock-led"></span>
                      <span>CLK</span>
                    </button>
                    <span class="midi-clock-bpm" id="latency-midi-clock-bpm">${this.bpm} BPM</span>
                  </div>
                </div>
              </div>
              <div class="midi-out-status ${midiManager.getSelectedMidiOutputs().length > 0 ? "has-output" : ""}" id="latency-midi-status">
                ${midiManager.getSelectedMidiOutputs().length > 0
                  ? midiManager.getSelectedMidiOutputs().map(o => escapeHtml(o.name)).join(", ")
                  : "No output selected"}
              </div>
            </div>
          </div>

          <!-- PERFORMANCE SETTINGS -->
          <div class="latency-device-section" id="latency-settings-section">
            <div class="latency-profile-title">⚙️ PERFORMANCE SETTINGS</div>
            <div class="settings-grid">
              <label class="settings-row">
                <span class="settings-label">Sustain Hold</span>
                <input type="range" class="settings-slider" id="settings-sustain-hold" min="3" max="30" step="1" value="${multiLayerEngine.settings.sustainHoldSec}">
                <span class="settings-val" id="settings-sustain-hold-val">${multiLayerEngine.settings.sustainHoldSec}s</span>
              </label>
              <label class="settings-row">
                <span class="settings-label">Sustain Tone</span>
                <input type="range" class="settings-slider" id="settings-sustain-decay" min="0.5" max="8" step="0.1" value="${multiLayerEngine.settings.sustainDecayTau}">
                <span class="settings-val" id="settings-sustain-decay-val">${multiLayerEngine.settings.sustainDecayTau.toFixed(1)}</span>
              </label>
              <label class="settings-row">
                <span class="settings-label">Held Note Max</span>
                <input type="range" class="settings-slider" id="settings-held-note" min="2" max="60" step="1" value="${multiLayerEngine.settings.heldNoteSec}">
                <span class="settings-val" id="settings-held-note-val">${multiLayerEngine.settings.heldNoteSec}s</span>
              </label>
              <label class="settings-row">
                <span class="settings-label">Polyphony Cap</span>
                <input type="range" class="settings-slider" id="settings-polyphony" min="16" max="128" step="16" value="${multiLayerEngine.settings.polyphonyCap}">
                <span class="settings-val" id="settings-polyphony-val">${multiLayerEngine.settings.polyphonyCap}</span>
              </label>
              <label class="settings-row">
                <span class="settings-label">Velocity</span>
                <input type="range" class="settings-slider" id="settings-velocity" min="1" max="127" step="1" value="${multiLayerEngine.settings.defaultVelocity}">
                <span class="settings-val" id="settings-velocity-val">${multiLayerEngine.settings.defaultVelocity}</span>
              </label>
              <label class="settings-row">
                <span class="settings-label">Octave</span>
                <input type="range" class="settings-slider" id="settings-octave" min="1" max="7" step="1" value="${multiLayerEngine.settings.defaultOctave}">
                <span class="settings-val" id="settings-octave-val">C${multiLayerEngine.settings.defaultOctave}</span>
              </label>
              <label class="settings-row">
                <span class="settings-label">Theme</span>
                <select class="latency-device-select settings-select" id="settings-theme">
                  <option value="dark" ${multiLayerEngine.settings.theme === "dark" ? "selected" : ""}>Dark</option>
                  <option value="light" ${multiLayerEngine.settings.theme === "light" ? "selected" : ""}>Light</option>
                </select>
              </label>
              <label class="settings-row">
                <span class="settings-label">Restore Tab</span>
                <input type="checkbox" class="settings-check" id="settings-tab-restore" ${multiLayerEngine.settings.tabRestore ? "checked" : ""}>
              </label>
            </div>
            <div class="latency-pop-reco">
              💾 Settings save instantly and persist across sessions.
            </div>
          </div>
        </div>
      </div>
    `;

    pop.style.position = "fixed";
    pop.style.top = `${rect.bottom + 6}px`;
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 868, (window.innerWidth - 860) / 2))}px`;
    pop.style.zIndex = "10000";

    pop.addEventListener("click", (e) => e.stopPropagation());

    document.body.appendChild(pop);

    pop.querySelectorAll(".latency-prof-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const prof = btn.getAttribute("data-profile");
        if (prof) {
          audioCore.setLatencyProfile(prof);
          const newL = audioCore.measureLatency();
          this._renderLatencyPopover(newL, this._latencySmoothed);
        }
      });
    });

    pop.querySelector("#hud-latency-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._closeLatencyPopover();
    });

    // Populate output device list
    const deviceSelect = pop.querySelector("#latency-device-select");
    if (deviceSelect && audioCore.enumerateOutputDevices) {
      const currentSink = audioCore.currentSinkId;
      audioCore.enumerateOutputDevices().then((devices) => {
        if (!devices.length || !deviceSelect.isConnected) return;
        deviceSelect.innerHTML =
          `<option value="">Default</option>` +
          devices
            .map(
              (d) =>
                `<option value="${d.deviceId}" ${d.deviceId === currentSink ? "selected" : ""}>${d.label || "Speaker " + d.deviceId.slice(0, 6)}</option>`,
            )
            .join("");
      });
      deviceSelect.addEventListener("change", (e) => {
        e.stopPropagation();
        audioCore.setSinkId(deviceSelect.value);
      });
    }

    // Populate spatial environment list
    const spatialSelect = pop.querySelector("#latency-spatial-select");
    if (spatialSelect && audioCore.getSpatialEnvironments) {
      const envs = audioCore.getSpatialEnvironments();
      const currentEnv = audioCore.getCurrentSpatialEnv();
      if (envs.length) {
        spatialSelect.innerHTML = envs
          .map(
            (env) =>
              `<option value="${env.id}" ${env.id === currentEnv ? "selected" : ""}>${env.name}</option>`,
          )
          .join("");
      }
      spatialSelect.addEventListener("change", (e) => {
        e.stopPropagation();
        audioCore.setSpatialEnvironment(spatialSelect.value);
      });
    }

    // MIDI OUT popover controls
    const midiOutSelectPop = pop.querySelector("#latency-midi-out-select");
    midiOutSelectPop?.addEventListener("change", (e) => {
      e.stopPropagation();
      const selected = Array.from(e.target.selectedOptions).map((o) => o.value).filter(Boolean);
      midiManager.clearMidiOutputs();
      selected.forEach((id, i) => midiManager.selectMidiOutput(id, i > 0));
      const statusEl = pop.querySelector("#latency-midi-status");
      if (statusEl) {
        const hasOut = midiManager.getSelectedMidiOutputs().length > 0;
        statusEl.textContent = hasOut
          ? midiManager.getSelectedMidiOutputs().map(o => escapeHtml(o.name)).join(", ")
          : "No output selected";
        statusEl.classList.toggle("has-output", hasOut);
      }
    });

    const midiChannelSelectPop = pop.querySelector("#latency-midi-channel");
    if (midiChannelSelectPop) {
      midiChannelSelectPop.value = String(midiOutManager.channel || 0);
      midiChannelSelectPop.addEventListener("change", (e) => {
        e.stopPropagation();
        midiOutManager.channel = parseInt(e.target.value, 10) || 0;
      });
    }

    const midiClockBtn = pop.querySelector("#latency-btn-midi-clock");
    midiClockBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (midiOutManager.clockRunning) {
        midiOutManager.stopClock();
      } else {
        midiOutManager.startClock(this.bpm);
      }
      this.syncToolsIndicator();
      midiClockBtn.classList.toggle("active", midiOutManager.clockRunning);
    });

    // Settings sliders
    const bindSlider = (id, valId, key, fmt) => {
      const slider = pop.querySelector(`#${id}`);
      const valEl = pop.querySelector(`#${valId}`);
      if (!slider) return;
      slider.addEventListener("input", (e) => {
        const v = parseFloat(e.target.value);
        multiLayerEngine.updateSetting(key, v);
        if (valEl) valEl.textContent = fmt(v);
      });
    };
    bindSlider(
      "settings-sustain-hold",
      "settings-sustain-hold-val",
      "sustainHoldSec",
      (v) => `${v}s`,
    );
    bindSlider(
      "settings-sustain-decay",
      "settings-sustain-decay-val",
      "sustainDecayTau",
      (v) => v.toFixed(1),
    );
    bindSlider(
      "settings-held-note",
      "settings-held-note-val",
      "heldNoteSec",
      (v) => `${v}s`,
    );
    bindSlider(
      "settings-polyphony",
      "settings-polyphony-val",
      "polyphonyCap",
      (v) => `${v}`,
    );
    bindSlider(
      "settings-velocity",
      "settings-velocity-val",
      "defaultVelocity",
      (v) => `${v}`,
    );
    bindSlider(
      "settings-octave",
      "settings-octave-val",
      "defaultOctave",
      (v) => `C${v}`,
    );

    // Theme select
    const themeSelect = pop.querySelector("#settings-theme");
    if (themeSelect) {
      themeSelect.addEventListener("change", (e) => {
        e.stopPropagation();
        multiLayerEngine.updateSetting("theme", e.target.value);
      });
    }

    // Tab restore checkbox
    const tabRestoreCheck = pop.querySelector("#settings-tab-restore");
    if (tabRestoreCheck) {
      tabRestoreCheck.addEventListener("change", (e) => {
        e.stopPropagation();
        multiLayerEngine.updateSetting("tabRestore", e.target.checked);
      });
    }
  }

  _closeLatencyPopover() {
    const pop = document.getElementById("hud-latency-popover");
    if (pop) pop.remove();
  }
}
