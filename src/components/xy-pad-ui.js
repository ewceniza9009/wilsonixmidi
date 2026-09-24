/**
 * WILSONIX Kaoss-Style Multi-Touch X/Y Expression Pad UI
 * Controls:
 * - X-Axis: Master Filter Cutoff Sweep (180 Hz to 18,000 Hz)
 * - Y-Axis: Space / Reverb / Shimmer Wet Blend (0% to 100%)
 * - Features: Glowing neon crosshairs, hold latch, reset, and touch particles
 */

import { multiLayerEngine } from "../audio/multi-layer-engine.js";

export class XyPadUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.xVal = 0.5; // Normalized 0..1 (Center)
    this.yVal = 0.5;
    this.isHolding = false;
    this.isDragging = false;
    this.isVisible = true;

    this.render();
    this.bindEvents();
    this.applyModulation();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="xy-pad-widget" id="xy-pad-widget">
        <div class="xy-pad-header">
          <span class="xy-pad-title">KAOSS X/Y</span>
          <div class="xy-pad-actions">
            <button class="xy-mini-btn ${this.isHolding ? "active" : ""}" id="xy-hold-btn" title="Hold / Lock Current X/Y Modulation">HOLD</button>
            <button class="xy-mini-btn" id="xy-reset-btn" title="Reset X/Y to Neutral Center">RESET</button>
          </div>
        </div>

        <div class="xy-touch-surface" id="xy-surface">
          <div class="xy-grid-bg"></div>
          <div class="xy-crosshair-x" id="xy-cross-x"></div>
          <div class="xy-crosshair-y" id="xy-cross-y"></div>
          <div class="xy-touch-puck" id="xy-puck">
            <div class="xy-puck-glow"></div>
          </div>
          <div class="xy-readout-strip">
            <span id="xy-x-label">CUTOFF: 5.2k</span>
            <span id="xy-y-label">SPACE: 50%</span>
          </div>
        </div>
      </div>
    `;

    this.updatePuckVisual();
  }

  bindEvents() {
    const surface = document.getElementById("xy-surface");
    const holdBtn = document.getElementById("xy-hold-btn");
    const resetBtn = document.getElementById("xy-reset-btn");

    if (!surface) return;
    this._surface = surface;
    this._holdBtn = holdBtn;
    this._resetBtn = resetBtn;

    const setFromPoint = (clientX, clientY) => {
      const rect = surface.getBoundingClientRect();
      const rawX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const rawY = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height)); // Bottom = 0, Top = 1

      this.xVal = rawX;
      this.yVal = rawY;
      this.updatePuckVisual();
      this.applyModulation();
    };

    let activePointerId = null;

    this._onPointerDown = (e) => {
      if (e.cancelable) e.preventDefault();
      activePointerId = e.pointerId;
      try {
        surface.setPointerCapture(e.pointerId);
      } catch (_) {}
      this.isDragging = true;
      setFromPoint(e.clientX, e.clientY);
    };

    this._onPointerMove = (e) => {
      if (this.isDragging && e.pointerId === activePointerId) {
        if (e.cancelable) e.preventDefault();
        setFromPoint(e.clientX, e.clientY);
      }
    };

    this._onPointerUp = (e) => {
      if (this.isDragging && (activePointerId === null || e.pointerId === activePointerId)) {
        this.isDragging = false;
        activePointerId = null;
        try {
          surface.releasePointerCapture(e.pointerId);
        } catch (_) {}
        if (!this.isHolding) {
          this.reset(true);
        }
      }
    };

    this._onHoldClick = () => {
      this.isHolding = !this.isHolding;
      holdBtn?.classList.toggle("active", this.isHolding);
    };

    this._onResetClick = () => {
      this.isHolding = false;
      holdBtn?.classList.remove("active");
      this.reset(false);
    };

    surface.addEventListener("pointerdown", this._onPointerDown);
    surface.addEventListener("pointermove", this._onPointerMove);
    surface.addEventListener("pointerup", this._onPointerUp);
    surface.addEventListener("pointercancel", this._onPointerUp);
    window.addEventListener("pointerup", this._onPointerUp);

    holdBtn?.addEventListener("click", this._onHoldClick);
    resetBtn?.addEventListener("click", this._onResetClick);
  }

  destroy() {
    window.removeEventListener("pointerup", this._onPointerUp);

    if (this._surface) {
      this._surface.removeEventListener("pointerdown", this._onPointerDown);
      this._surface.removeEventListener("pointermove", this._onPointerMove);
      this._surface.removeEventListener("pointerup", this._onPointerUp);
      this._surface.removeEventListener("pointercancel", this._onPointerUp);
    }
    this._holdBtn?.removeEventListener("click", this._onHoldClick);
    this._resetBtn?.removeEventListener("click", this._onResetClick);

    this._surface = null;
    this._holdBtn = null;
    this._resetBtn = null;
    this._onPointerDown = null;
    this._onPointerMove = null;
    this._onPointerUp = null;
    this._onHoldClick = null;
    this._onResetClick = null;
  }

  updatePuckVisual() {
    const puck = document.getElementById("xy-puck");
    const crossX = document.getElementById("xy-cross-x");
    const crossY = document.getElementById("xy-cross-y");
    const xLabel = document.getElementById("xy-x-label");
    const yLabel = document.getElementById("xy-y-label");

    const pctX = this.xVal * 100;
    const pctY = (1 - this.yVal) * 100; // Top is 0% in CSS top

    if (puck) {
      puck.style.left = `${pctX}%`;
      puck.style.top = `${pctY}%`;
    }

    if (crossX) crossX.style.top = `${pctY}%`;
    if (crossY) crossY.style.left = `${pctX}%`;

    // Real-world value readouts
    // Filter Cutoff: Log scale from 180 Hz to 18,000 Hz
    const cutoffHz = Math.round(180 * Math.pow(100, this.xVal));
    const formattedCutoff = cutoffHz >= 1000 ? `${(cutoffHz / 1000).toFixed(1)}k` : `${cutoffHz}Hz`;
    const spacePct = Math.round(this.yVal * 100);

    if (xLabel) xLabel.textContent = `CUT: ${formattedCutoff}`;
    if (yLabel) yLabel.textContent = `SPACE: ${spacePct}%`;
  }

  applyModulation() {
    // Cutoff: 180 Hz to 18,000 Hz
    const cutoffHz = Math.round(180 * Math.pow(100, this.xVal));
    // Resonance boosts slightly at higher cutoffs for authentic synth sweep
    const res = 0.5 + this.xVal * 2.5;

    multiLayerEngine.setMasterFilter(cutoffHz, res);
    multiLayerEngine.setSpaceSend(this.yVal);
  }

  reset(_smooth = true) {
    this.xVal = 0.5;
    this.yVal = 0.5;
    this.updatePuckVisual();
    this.applyModulation();
  }
}