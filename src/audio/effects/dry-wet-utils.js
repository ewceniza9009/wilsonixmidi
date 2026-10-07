/**
 * Shared dry/wet gain computation utilities for audio effects.
 * Extracts the duplicated constant-power and linear crossfade logic
 * used across all 23 effects in the FX rack.
 */

/**
 * Constant-power crossfade: sin for wet, cos for dry.
 * Returns { wet, dry } as linear gain fractions.
 */
export function constantPowerMix(mix) {
  const m = Math.max(0, Math.min(1, mix));
  return {
    wet: Math.sin(m * Math.PI * 0.5),
    dry: Math.cos(m * Math.PI * 0.5),
  };
}

/**
 * Constant-power crossfade with an optional wet-side scaling factor.
 * Used by reverb (0.75), gated-reverb (0.75), slapback (0.85),
 * spring-reverb (0.70).
 */
export function constantPowerMixScaled(mix, wetScale) {
  const { wet, dry } = constantPowerMix(mix);
  return { wet: wet * wetScale, dry };
}

/**
 * Applies dry/wet gains immediately (setValueAtTime) for bypass toggle.
 * When bypassed: wet=0, dry=1.
 * When active: uses the supplied mixFn to compute gains.
 */
export function applyBypassGains(wetGain, dryGain, bypassed, mix, mixFn, ctx) {
  const now = ctx ? ctx.currentTime : 0;
  const targetWet = bypassed ? 0.0 : mixFn(mix).wet;
  const targetDry = bypassed ? 1.0 : mixFn(mix).dry;
  if (ctx) {
    wetGain.gain.setTargetAtTime(targetWet, now, 0.012);
    dryGain.gain.setTargetAtTime(targetDry, now, 0.012);
  } else {
    wetGain.gain.setValueAtTime(targetWet, now);
    dryGain.gain.setValueAtTime(targetDry, now);
  }
}

/**
 * Applies dry/wet gains with smoothing (setTargetAtTime) for real-time
 * mix knob adjustments while the effect is active.
 */
export function applyMixGains(wetGain, dryGain, mix, mixFn, ctx, timeConstant = 0.02) {
  const now = ctx.currentTime;
  const { wet, dry } = mixFn(mix);
  wetGain.gain.setTargetAtTime(wet, now, timeConstant);
  dryGain.gain.setTargetAtTime(dry, now, timeConstant);
}
