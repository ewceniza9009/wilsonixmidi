/**
 * Velocity Response Curve
 * Springy synth-action keybeds (shallow travel, light springs) and resistive
 * touchscreens make soft hits feel mushy. This lets the player reshape how
 * incoming velocity from PERFORMANCE inputs (hardware MIDI keyboard + touch
 * keys) maps through graduated power curves, WITHOUT touching programmed
 * velocities from pads/arpeggiators/loops or the QWERTY accents.
 *
 *   linear  : v' = v                        (flat, default, honest as played)
 *   punch   : v' = 127*(v/127)^0.62         (early bite — soft hits jump up)
 *   soft    : v' = 127*(v/127)^1.5          (late bloom — soft hits stay soft)
 */

const POWER = {
  linear: 1.0,
  punch: 0.62,
  soft: 1.5,
};

let currentCurve = "linear";

export function setVelocityCurve(name) {
  currentCurve = POWER[name] !== undefined ? name : "linear";
  try { localStorage.setItem("midikey_vel_curve", currentCurve); } catch (e) {}
}

export function getVelocityCurve() {
  return currentCurve;
}

export function shapeVelocity(v) {
  const raw = Math.max(1, Math.min(127, v | 0));
  const p = POWER[currentCurve];
  if (p === 1.0) return raw;
  return Math.max(1, Math.min(127, Math.round(127 * Math.pow(raw / 127, p))));
}