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
    if (typeof v !== "number" || isNaN(v)) return;
    const knob = this.container?.querySelector(`.rotary-knob[data-param="${param}"]`);
    if (!knob) return;
    const min = parseFloat(knob.getAttribute("data-min")) || 0;
    const max = parseFloat(knob.getAttribute("data-max")) || 1;
    const unit = knob.getAttribute("data-unit") || "";
    const pointer = knob.querySelector(".knob-pointer");
    const valEl = knob.querySelector(".knob-value");

    const range = max - min;
    const norm = range === 0 ? 0 : Math.max(0, Math.min(1, (v - min) / range));
    const deg = -140 + norm * 280;
    if (pointer) pointer.style.transform = `rotate(${deg}deg)`;
    if (valEl) {
      if (unit === "%") valEl.innerText = `${Math.round(norm * 100)}%`;
      else if (unit === "dB") valEl.innerText = `${v >= 0 ? "+" : ""}${v.toFixed(1)}dB`;
      else if (unit === "Hz") valEl.innerText = v >= 1000 ? `${(v / 1000).toFixed(1)}kHz` : `${Math.round(v)}Hz`;
      else if (unit === "ms") valEl.innerText = `${Math.round(v)}ms`;
      else if (unit === "s") valEl.innerText = v < 0.2 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(1)}s`;
      else valEl.innerText = `${v.toFixed(1)}${unit}`;
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="fx-rack-strip">
        <div class="fx-rack-header">
          <span class="rack-title">WORKSTATION DEVICE RACK</span>
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

          <!-- Device 8: Vintage Spring Reverb (The Surf Foundation) -->
          <div class="ableton-device-box" id="dev-spring-reverb">
            <div class="device-bar">
              <button class="dev-power-btn" data-dev="spring-reverb">OFF</button>
              <span class="dev-name">VINTAGE SPRING REVERB (SURF DRIP)</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="spring-mix" data-min="0" data-max="1" data-val="0.35" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">MIX</span>
                  <span class="knob-value">35%</span>
                </div>
                <div class="rotary-knob" data-param="spring-tone" data-min="1800" data-max="5500" data-val="3200" data-unit="Hz">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">DRIP TONE</span>
                  <span class="knob-value">3.2kHz</span>
                </div>
                <div class="rotary-knob" data-param="spring-decay" data-min="0.6" data-max="4.5" data-val="2.2" data-unit="s">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">DECAY</span>
                  <span class="knob-value">2.2s</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 9: Slapback Tape Delay (Vocal Attitude) -->
          <div class="ableton-device-box" id="dev-slapback">
            <div class="device-bar">
              <button class="dev-power-btn" data-dev="slapback">OFF</button>
              <span class="dev-name">SLAPBACK TAPE DELAY</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="slapback-mix" data-min="0" data-max="1" data-val="0.35" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">MIX</span>
                  <span class="knob-value">35%</span>
                </div>
                <div class="rotary-knob" data-param="slapback-time" data-min="0.065" data-max="0.140" data-val="0.095" data-unit="s">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">DELAY</span>
                  <span class="knob-value">95ms</span>
                </div>
                <div class="rotary-knob" data-param="slapback-tone" data-min="1800" data-max="8000" data-val="3400" data-unit="Hz">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">TAPE TONE</span>
                  <span class="knob-value">3.4kHz</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 10: 80s Non-Linear Gated Reverb -->
          <div class="ableton-device-box" id="dev-gated-reverb">
            <div class="device-bar">
              <button class="dev-power-btn" data-dev="gated-reverb">OFF</button>
              <span class="dev-name">80s GATED REVERB (CANNON)</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="gated-mix" data-min="0" data-max="1" data-val="0.45" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">MIX</span>
                  <span class="knob-value">45%</span>
                </div>
                <div class="rotary-knob" data-param="gated-time" data-min="80" data-max="300" data-val="180" data-unit="ms">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">GATE TIME</span>
                  <span class="knob-value">180ms</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 11: Optical Tremolo Pulse -->
          <div class="ableton-device-box" id="dev-tremolo">
            <div class="device-bar">
              <button class="dev-power-btn" data-dev="tremolo">OFF</button>
              <span class="dev-name">OPTICAL TREMOLO PULSE</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="tremolo-mix" data-min="0" data-max="1" data-val="0.60" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">MIX</span>
                  <span class="knob-value">60%</span>
                </div>
                <div class="rotary-knob" data-param="tremolo-rate" data-min="0.5" data-max="12" data-val="4.5" data-unit="Hz">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">RATE</span>
                  <span class="knob-value">4.5Hz</span>
                </div>
                <div class="rotary-knob" data-param="tremolo-depth" data-min="0" data-max="1" data-val="0.55" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">DEPTH</span>
                  <span class="knob-value">55%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 12: Master Bus Tape Saturation -->
          <div class="ableton-device-box" id="dev-tape-sat">
            <div class="device-bar">
              <button class="dev-power-btn" data-dev="tape-sat">OFF</button>
              <span class="dev-name">MASTER TAPE SATURATION</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="tape-drive" data-min="0.05" data-max="1" data-val="0.35" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">DRIVE</span>
                  <span class="knob-value">35%</span>
                </div>
                <div class="rotary-knob" data-param="tape-warmth" data-min="0.1" data-max="1" data-val="0.60" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">WARMTH</span>
                  <span class="knob-value">60%</span>
                </div>
                <div class="rotary-knob" data-param="tape-mix" data-min="0" data-max="1" data-val="0.85" data-unit="%">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">MIX</span>
                  <span class="knob-value">85%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Device 13: 3-Band Master Studio EQ -->
          <div class="ableton-device-box" id="dev-eq">
            <div class="device-bar">
              <button class="dev-power-btn active" data-dev="eq">ON</button>
              <span class="dev-name">STUDIO MASTER EQ</span>
            </div>
            <div class="dev-body">
              <div class="knob-group">
                <div class="rotary-knob" data-param="eq-low" data-min="-12" data-max="12" data-val="1.0" data-unit="dB">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">LOW (100Hz)</span>
                  <span class="knob-value">+1.0dB</span>
                </div>
                <div class="rotary-knob" data-param="eq-mid" data-min="-12" data-max="12" data-val="0.0" data-unit="dB">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">MID (1.2kHz)</span>
                  <span class="knob-value">0.0dB</span>
                </div>
                <div class="rotary-knob" data-param="eq-high" data-min="-12" data-max="12" data-val="1.8" data-unit="dB">
                  <div class="knob-face"><div class="knob-pointer"></div></div>
                  <span class="knob-label">HIGH (8kHz)</span>
                  <span class="knob-value">+1.8dB</span>
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

      case "spring-mix":
        fx.springReverb?.setMix(val);
        break;
      case "spring-tone":
        fx.springReverb?.setTone(val);
        break;
      case "spring-decay":
        fx.springReverb?.setDecay(val);
        break;

      case "slapback-mix":
        fx.slapback?.setMix(val);
        break;
      case "slapback-time":
        fx.slapback?.setDelayTime(val);
        break;
      case "slapback-tone":
        fx.slapback?.setTone(val);
        break;

      case "gated-mix":
        fx.gatedReverb?.setMix(val);
        break;
      case "gated-time":
        fx.gatedReverb?.setGateTime(val);
        break;

      case "tremolo-mix":
        fx.tremolo?.setMix(val);
        break;
      case "tremolo-rate":
        fx.tremolo?.setRate(val);
        break;
      case "tremolo-depth":
        fx.tremolo?.setDepth(val);
        break;

      case "tape-drive":
        fx.tapeSat?.setDrive(val);
        break;
      case "tape-warmth":
        fx.tapeSat?.setWarmth(val);
        break;
      case "tape-mix":
        fx.tapeSat?.setMix(val);
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
        if (dev === "spring-reverb") fx.springReverb?.setBypass(bypassed);
        if (dev === "slapback") fx.slapback?.setBypass(bypassed);
        if (dev === "gated-reverb") fx.gatedReverb?.setBypass(bypassed);
        if (dev === "tremolo") fx.tremolo?.setBypass(bypassed);
        if (dev === "tape-sat") fx.tapeSat?.setBypass(bypassed);
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
      "spring-reverb": fx.springReverb?.enabled,
      slapback: fx.slapback?.enabled,
      "gated-reverb": fx.gatedReverb?.enabled,
      tremolo: fx.tremolo?.enabled,
      "tape-sat": fx.tapeSat?.enabled,
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
    if (fx.springReverb) {
      this.updateKnobVisual("spring-mix", fx.springReverb.mix);
      this.updateKnobVisual("spring-tone", fx.springReverb.toneFreq);
      this.updateKnobVisual("spring-decay", fx.springReverb.decay);
    }
    if (fx.slapback) {
      this.updateKnobVisual("slapback-mix", fx.slapback.mix);
      this.updateKnobVisual("slapback-time", fx.slapback.delayTime);
      this.updateKnobVisual("slapback-tone", fx.slapback.tapeTone);
    }
    if (fx.gatedReverb) {
      this.updateKnobVisual("gated-mix", fx.gatedReverb.mix);
      this.updateKnobVisual("gated-time", fx.gatedReverb.gateHoldMs);
    }
    if (fx.tremolo) {
      this.updateKnobVisual("tremolo-mix", fx.tremolo.mix);
      this.updateKnobVisual("tremolo-rate", fx.tremolo.rate);
      this.updateKnobVisual("tremolo-depth", fx.tremolo.depth);
    }
    if (fx.tapeSat) {
      this.updateKnobVisual("tape-drive", fx.tapeSat.drive);
      this.updateKnobVisual("tape-warmth", fx.tapeSat.warmth);
      this.updateKnobVisual("tape-mix", fx.tapeSat.mix);
    }
  }
}
