/**
 * Final-bus safety soft-clip.
 *
 * The hardware DynamicsCompressor (audio-core.js) has a 3ms attack, so fast
 * transients (piano hammer attacks, FX makeup-gain overshoot) pass through
 * before gain reduction kicks in and can exceed 0dBFS — the DAC then hard-clips
 * them, which is audible as crackles. This WaveShaper sits right after the
 * limiter and guarantees |y| < 1:
 *   - identity below `knee` (default 0.9): everything the limiter already
 *     handles passes bit-exact, zero waveform modulation
 *   - tanh rolloff above `knee`, slope-continuous at the knee (no kink), so
 *     overshoots are rounded instead of clipped
 */

export function buildSoftClipCurve(samples = 8192, knee = 0.9) {
  const curve = new Float32Array(samples);
  const span = 1 - knee;
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    const v = Math.abs(x);
    const y = v <= knee ? v : knee + span * Math.tanh((v - knee) / span);
    curve[i] = x < 0 ? -y : y;
  }
  return curve;
}
