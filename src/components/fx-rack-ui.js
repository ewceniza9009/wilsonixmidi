/**
 * Ableton-Style Interactive Device FX Rack UI
 * Rotary knobs with vertical drag tracking, circular indicators, and device bypass toggles.
 */

import { audioCore } from "../audio/audio-core.js";

export class FxRackUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
    this.bindKnobs();
    this.bindToggles();

    if (audioCore.fxRack) {
      audioCore.fxRack.onPresetChangeCallback = () => {
        this.syncWithRack();
      };
      this.syncWithRack();
    }
  }

  updateKnobVisual(param, v) {
    const knob = this.container?.querySelector(`.rotary-knob[data-param="${param}"]`);
    if (!knob) return;
    const min = parseFloat(knob.getAttribute("data-min"));
    const max = parseFloat(knob.getAttribute("data-max"));
    const unit = knob.getAttribute("data-unit");
    const pointer = knob.querySelector(".knob-pointer");
    const valEl = knob.querySelector(".knob-value");

    const norm = (v - min) / (max - min);
    const deg = -140 + norm * 280;
    if (pointer) pointer.style.transform = `rotate(${deg}deg)`;
    if (valEl) {
      if (unit === "%") valEl.innerText = `${Math.round(norm * 100)}%`;
      else if (unit === "dB") valEl.innerText = `${v >= 0 ? "+" : ""}${v.toFixed(1)}dB`;
      else valEl.innerText = `${v.toFixed(1)}${unit}`;
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="fx-rack-strip">
        <div class="fx-rack-header">
          <span class="rack-title">ABLETON & WORKSTATION DEVICE RACK</span>
          <span class="rack-tag">ZERO-BUFFER ARCHITECTURE</span>
        </div>

        <div class="devices-scroll-bay">
          <!-- Device 0: Grand Piano Physical Acoustics & Resonance Modeling -->
          <div class="ableton-device-box" id="dev-piano-acoustics">
            <div class="device-bar">
              <button class="dev-power-btn active" data-dev="piano-acoustics">ON</button>
              <span class="dev-name">GRAND PIANO ACOUSTICS & MODELING</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <button class="piano-lid-toggle" id="piano-lid-btn" title="Concert Grand Lid Position (Open, Half, Closed)">LID: OPEN</button>
                <div class="rotary-knob" data-param="piano-sympathetic" data-min="0" data-max="1" data-val="0.55" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">SYMP RESO</span>
                  <span class="knob-value">55%</span>
                </div>
                <div class="rotary-knob" data-param="piano-soundboard" data-min="0" data-max="1" data-val="0.65" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">SOUNDBOARD</span>
                  <span class="knob-value">65%</span>
                </div>
                <div class="rotary-knob" data-param="piano-hammer" data-min="0" data-max="1" data-val="0.50" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">HAMMER FELT</span>
                  <span class="knob-value">50%</span>
                </div>
                <div class="rotary-knob" data-param="piano-pedal-noise" data-min="0" data-max="1" data-val="0.40" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">PEDAL NOISE</span>
                  <span class="knob-value">40%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 1: 1973 Rhodes Suitcase Auto-Pan & Tremolo -->
          <div class="ableton-device-box" id="dev-autopan">
            <div class="device-bar">
              <button class="dev-power-btn" data-dev="autopan">OFF</button>
              <span class="dev-name">RHODES STEREO AUTO-PAN</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="autopan-rate" data-min="0.2" data-max="8" data-val="2.1" data-unit="Hz">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">RATE</span>
                  <span class="knob-value">2.1Hz</span>
                </div>
                <div class="rotary-knob" data-param="autopan-depth" data-min="0" data-max="1" data-val="0.85" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">DEPTH</span>
                  <span class="knob-value">85%</span>
                </div>
                <div class="rotary-knob" data-param="autopan-mix" data-min="0" data-max="1" data-val="0.85" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">MIX</span>
                  <span class="knob-value">85%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 2: Korg Chorus -->
          <div class="ableton-device-box" id="dev-chorus">
            <div class="device-bar">
              <button class="dev-power-btn" data-dev="chorus">OFF</button>
              <span class="dev-name">KORG ENSEMBLE CHORUS</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="chorus-mix" data-min="0" data-max="1" data-val="0.4" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">MIX</span>
                  <span class="knob-value">40%</span>
                </div>
                <div class="rotary-knob" data-param="chorus-rate" data-min="0.1" data-max="8" data-val="1.4" data-unit="Hz">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">RATE</span>
                  <span class="knob-value">1.4Hz</span>
                </div>
                <div class="rotary-knob" data-param="chorus-depth" data-min="0.1" data-max="1" data-val="0.6" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">DEPTH</span>
                  <span class="knob-value">60%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 3: Algorithmic Reverb -->
          <div class="ableton-device-box" id="dev-reverb">
            <div class="device-bar">
              <button class="dev-power-btn active" data-dev="reverb">ON</button>
              <span class="dev-name">STUDIO CONVOLUTION HALL</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="reverb-mix" data-min="0" data-max="1" data-val="0.15" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">WET/DRY</span>
                  <span class="knob-value">15%</span>
                </div>
                <div class="rotary-knob" data-param="reverb-decay" data-min="0.4" data-max="7" data-val="1.8" data-unit="s">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">DECAY</span>
                  <span class="knob-value">1.8s</span>
                </div>
                <div class="rotary-knob" data-param="reverb-size" data-min="0.1" data-max="0.95" data-val="0.5" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">ROOM</span>
                  <span class="knob-value">50%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 4: Ping Pong Delay -->
          <div class="ableton-device-box" id="dev-delay">
            <div class="device-bar">
              <button class="dev-power-btn" data-dev="delay">OFF</button>
              <span class="dev-name">PING-PONG TAPE DELAY</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="delay-mix" data-min="0" data-max="1" data-val="0.25" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">MIX</span>
                  <span class="knob-value">25%</span>
                </div>
                <div class="rotary-knob" data-param="delay-feedback" data-min="0" data-max="0.85" data-val="0.45" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">FDBK</span>
                  <span class="knob-value">45%</span>
                </div>
                <div class="rotary-knob" data-param="delay-time" data-min="0.125" data-max="1.0" data-val="0.375" data-unit="note">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">TIME</span>
                  <span class="knob-value">3/8</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 5: Leslie Rotary Speaker -->
          <div class="ableton-device-box" id="dev-rotary">
            <div class="device-bar">
              <button class="dev-power-btn" data-dev="rotary">OFF</button>
              <span class="dev-name">LESLIE ROTARY SPEAKER</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <button class="rotary-speed-toggle" id="rotary-speed-btn">SPEED: SLOW</button>
                <div class="rotary-knob" data-param="rotary-mix" data-min="0" data-max="1" data-val="0.6" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">DRIVE/MIX</span>
                  <span class="knob-value">60%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 6: Tube Warmth & Drive -->
          <div class="ableton-device-box" id="dev-tube">
            <div class="device-bar">
              <button class="dev-power-btn" data-dev="tube">OFF</button>
              <span class="dev-name">TUBE WARMTH & DRIVE</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="tube-drive" data-min="0" data-max="1" data-val="0.35" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">DRIVE</span>
                  <span class="knob-value">35%</span>
                </div>
                <div class="rotary-knob" data-param="tube-tone" data-min="1000" data-max="16000" data-val="12000" data-unit="Hz">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">TONE</span>
                  <span class="knob-value">12kHz</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 7: Stereo Phaser -->
          <div class="ableton-device-box" id="dev-phaser">
            <div class="device-bar">
              <button class="dev-power-btn" data-dev="phaser">OFF</button>
              <span class="dev-name">6-STAGE PHASER</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="phaser-mix" data-min="0" data-max="1" data-val="0.5" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">MIX</span>
                  <span class="knob-value">50%</span>
                </div>
                <div class="rotary-knob" data-param="phaser-rate" data-min="0.1" data-max="5" data-val="0.6" data-unit="Hz">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">RATE</span>
                  <span class="knob-value">0.6Hz</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 8: Studio EQ & Limiter -->
          <div class="ableton-device-box" id="dev-eq">
            <div class="device-bar">
              <button class="dev-power-btn active" data-dev="eq" disabled>LOCK</button>
              <span class="dev-name">3-BAND EQ & LIMITER</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="eq-low" data-min="-10" data-max="10" data-val="1.5" data-unit="dB">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">LOW (90Hz)</span>
                  <span class="knob-value">+1.5dB</span>
                </div>
                <div class="rotary-knob" data-param="eq-mid" data-min="-10" data-max="10" data-val="0" data-unit="dB">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">MID (1.4k)</span>
                  <span class="knob-value">0.0dB</span>
                </div>
                <div class="rotary-knob" data-param="eq-high" data-min="-10" data-max="10" data-val="2.0" data-unit="dB">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">AIR (8.5k)</span>
                  <span class="knob-value">+2.0dB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindKnobs() {
    const knobs = this.container.querySelectorAll(".rotary-knob");

    knobs.forEach(knob => {
      const param = knob.getAttribute("data-param");
      const min = parseFloat(knob.getAttribute("data-min"));
      const max = parseFloat(knob.getAttribute("data-max"));
      let val = parseFloat(knob.getAttribute("data-val"));
      const unit = knob.getAttribute("data-unit");
      const pointer = knob.querySelector(".knob-pointer");
      const valEl = knob.querySelector(".knob-value");

      const updateKnobUi = v => {
        const norm = (v - min) / (max - min);
        const deg = -140 + norm * 280; // -140 deg to +140 deg
        if (pointer) pointer.style.transform = `rotate(${deg}deg)`;
        if (valEl) {
          if (unit === "%") valEl.innerText = `${Math.round(norm * 100)}%`;
          else if (unit === "dB") valEl.innerText = `${v >= 0 ? "+" : ""}${v.toFixed(1)}dB`;
          else valEl.innerText = `${v.toFixed(1)}${unit}`;
        }
      };

      updateKnobUi(val);

      let isDragging = false;
      let startY = 0;
      let startVal = val;

      const onMouseDown = e => {
        isDragging = true;
        startY = e.clientY || (e.touches && e.touches[0].clientY);
        startVal = val;
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        window.addEventListener("touchmove", onMouseMove);
        window.addEventListener("touchend", onMouseUp);
      };

      const onMouseMove = e => {
        if (!isDragging) return;
        const currentY = e.clientY || (e.touches && e.touches[0].clientY);
        const delta = startY - currentY; // Up is positive
        const sensitivity = 0.005;
        const range = max - min;
        val = Math.max(min, Math.min(max, startVal + delta * range * sensitivity));
        updateKnobUi(val);
        this.dispatchParam(param, val);
      };

      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("touchmove", onMouseMove);
        window.removeEventListener("touchend", onMouseUp);
      };

      knob.addEventListener("mousedown", onMouseDown);
      knob.addEventListener("touchstart", onMouseDown, { passive: true });
    });
  }

  dispatchParam(param, val) {
    if (!audioCore.fxRack) return;
    const fx = audioCore.fxRack;

    switch (param) {
      case "piano-sympathetic":
        fx.pianoAcoustics?.setSympatheticResonance(val);
        break;
      case "piano-soundboard":
        fx.pianoAcoustics?.setSoundboardBloom(val);
        break;
      case "piano-hammer":
        fx.pianoAcoustics?.setHammerHardness(val);
        break;
      case "piano-pedal-noise":
        fx.pianoAcoustics?.setPedalNoise(val);
        break;

      case "autopan-rate":
        fx.autopan.setRate(val);
        break;
      case "autopan-depth":
        fx.autopan.setDepth(val);
        break;
      case "autopan-mix":
        fx.autopan.setMix(val);
        break;

      case "chorus-mix":
        fx.chorus.setMix(val);
        break;
      case "chorus-rate":
        fx.chorus.setRate(val);
        break;
      case "chorus-depth":
        fx.chorus.setDepth(val);
        break;

      case "reverb-mix":
        fx.reverb.setMix(val);
        break;
      case "reverb-decay":
        fx.reverb.setDecay(val);
        break;
      case "reverb-size":
        fx.reverb.setRoomSize(val);
        break;

      case "delay-mix":
        fx.delay.setMix(val);
        break;
      case "delay-feedback":
        fx.delay.setFeedback(val);
        break;
      case "delay-time":
        fx.delay.setDivision(val);
        break;

      case "rotary-mix":
        fx.rotary.setMix(val);
        break;

      case "tube-drive":
        fx.tube.setDrive(val);
        break;
      case "tube-tone":
        fx.tube.setTone(val);
        break;

      case "phaser-mix":
        fx.phaser.setMix(val);
        break;
      case "phaser-rate":
        fx.phaser.setRate(val);
        break;

      case "eq-low":
        fx.masterEq.setLowGain(val);
        break;
      case "eq-mid":
        fx.masterEq.setMidGain(val);
        break;
      case "eq-high":
        fx.masterEq.setHighGain(val);
        break;
    }
  }

  bindToggles() {
    const powerBtns = this.container.querySelectorAll(".dev-power-btn");
    powerBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const dev = btn.getAttribute("data-dev");
        const isActive = btn.classList.toggle("active");
        btn.innerText = isActive ? "ON" : "OFF";
        const bypassed = !isActive;

        if (!audioCore.fxRack) return;
        const fx = audioCore.fxRack;

        if (dev === "piano-acoustics") fx.pianoAcoustics?.setBypass(bypassed);
        if (dev === "autopan") fx.autopan.setBypass(bypassed);
        if (dev === "chorus") fx.chorus.setBypass(bypassed);
        if (dev === "reverb") fx.reverb.setBypass(bypassed);
        if (dev === "delay") fx.delay.setBypass(bypassed);
        if (dev === "rotary") fx.rotary.setBypass(bypassed);
        if (dev === "tube") fx.tube.setBypass(bypassed);
        if (dev === "phaser") fx.phaser.setBypass(bypassed);
      });
    });

    const lidBtn = document.getElementById("piano-lid-btn");
    lidBtn?.addEventListener("click", () => {
      if (audioCore.fxRack && audioCore.fxRack.pianoAcoustics) {
        const cur = audioCore.fxRack.pianoAcoustics.lidPosition;
        const next = cur === "open" ? "half" : cur === "half" ? "closed" : "open";
        audioCore.fxRack.pianoAcoustics.setLidPosition(next);
        lidBtn.innerText = `LID: ${next.toUpperCase()}`;
      }
    });

    const rotaryBtn = document.getElementById("rotary-speed-btn");
    rotaryBtn?.addEventListener("click", () => {
      if (audioCore.fxRack) {
        audioCore.fxRack.rotary.toggleSpeed();
        rotaryBtn.innerText = `SPEED: ${audioCore.fxRack.rotary.speedMode.toUpperCase()}`;
      }
    });
  }

  syncWithRack() {
    if (!audioCore.fxRack || !this.container) return;
    const fx = audioCore.fxRack;

    const devMap = {
      "piano-acoustics": fx.pianoAcoustics?.enabled,
      autopan: fx.autopan?.enabled,
      chorus: fx.chorus?.enabled,
      reverb: fx.reverb?.enabled,
      delay: fx.delay?.enabled,
      rotary: fx.rotary?.enabled,
      tube: fx.tube?.enabled,
      phaser: fx.phaser?.enabled,
    };

    Object.entries(devMap).forEach(([dev, isEnabled]) => {
      const btn = this.container.querySelector(`.dev-power-btn[data-dev="${dev}"]`);
      if (btn) {
        btn.classList.toggle("active", !!isEnabled);
        btn.innerText = isEnabled ? "ON" : "OFF";
      }
    });

    const lidBtn = document.getElementById("piano-lid-btn");
    if (lidBtn && fx.pianoAcoustics) {
      lidBtn.innerText = `LID: ${fx.pianoAcoustics.lidPosition.toUpperCase()}`;
    }

    const rotaryBtn = document.getElementById("rotary-speed-btn");
    if (rotaryBtn && fx.rotary) {
      rotaryBtn.innerText = `SPEED: ${fx.rotary.speedMode.toUpperCase()}`;
    }

    // Sync all knob parameters
    if (fx.autopan) {
      this.updateKnobVisual("autopan-rate", fx.autopan.rate);
      this.updateKnobVisual("autopan-depth", fx.autopan.depth);
      this.updateKnobVisual("autopan-mix", fx.autopan.mix);
    }
    if (fx.chorus) {
      this.updateKnobVisual("chorus-mix", fx.chorus.mix);
      this.updateKnobVisual("chorus-rate", fx.chorus.rate);
    }
    if (fx.reverb) {
      this.updateKnobVisual("reverb-mix", fx.reverb.mix);
      this.updateKnobVisual("reverb-decay", fx.reverb.decay);
    }
    if (fx.delay) {
      this.updateKnobVisual("delay-mix", fx.delay.mix);
      this.updateKnobVisual("delay-feedback", fx.delay.feedback);
    }
    if (fx.rotary) {
      this.updateKnobVisual("rotary-mix", fx.rotary.mix);
    }
    if (fx.tube) {
      this.updateKnobVisual("tube-drive", fx.tube.drive);
      this.updateKnobVisual("tube-tone", fx.tube.tone);
    }
    if (fx.phaser) {
      this.updateKnobVisual("phaser-mix", fx.phaser.mix);
      this.updateKnobVisual("phaser-rate", fx.phaser.rate);
    }
  }
}
