/**
 * Precomputed Effect Curves
 * Generated at startup to avoid Float32Array allocation on the main thread during FX switching
 */

const CURVE_SAMPLES = 4096;

export const PRECOMPUTED_CURVES = {
  tube_warm: null,
  tube_lead: null,
  distortion_metal: null,
  shred_stack: null,
  tape_sat_master: null,
};

function generateTubeCurve(drive) {
  const curve = new Float32Array(CURVE_SAMPLES);
  const k = 1.0 + drive * 3.5;
  for (let i = 0; i < CURVE_SAMPLES; ++i) {
    const x = (i * 2) / CURVE_SAMPLES - 1;
    curve[i] = Math.tanh(x * k) * 0.85;
  }
  return curve;
}

function generateDistortionCurve() {
  const curve = new Float32Array(CURVE_SAMPLES);
  for (let i = 0; i < CURVE_SAMPLES; ++i) {
    const x = (i * 2) / CURVE_SAMPLES - 1;
    curve[i] = Math.tanh(x * 3.6) * 0.8;
  }
  return curve;
}

function generateShredCurve() {
  const curve = new Float32Array(CURVE_SAMPLES);
  for (let i = 0; i < CURVE_SAMPLES; ++i) {
    const x = (i * 2) / CURVE_SAMPLES - 1;
    curve[i] = Math.tanh(x * 4.2) * 0.78;
  }
  return curve;
}

function generateTapeSatCurve() {
  const curve = new Float32Array(2048);
  const k = 2.2;
  for (let i = 0; i < 2048; i++) {
    const x = (i * 2) / 2048 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

export function precomputeAllCurves() {
  PRECOMPUTED_CURVES.tube_warm = generateTubeCurve(0.35);
  PRECOMPUTED_CURVES.tube_lead = generateTubeCurve(0.7);
  PRECOMPUTED_CURVES.distortion_metal = generateDistortionCurve();
  PRECOMPUTED_CURVES.shred_stack = generateShredCurve();
  PRECOMPUTED_CURVES.tape_sat_master = generateTapeSatCurve();
  console.log("[PrecomputedCurves] All curves generated");
}

export function getCurve(name) {
  return PRECOMPUTED_CURVES[name] || null;
}