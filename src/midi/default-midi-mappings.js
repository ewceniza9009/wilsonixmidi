/**
 * Factory-default MIDI CC mappings for the MIDI Learn manager.
 *
 * Kept in its own dependency-free module so the CC contract (uniqueness and
 * non-collision with General MIDI reserved controllers) can be unit-tested
 * without booting the Web Audio engine.
 *
 * Notes on controller choice:
 * - CC 7  is the GM master volume (also handled directly in midi-manager.js).
 * - CC 71-74 are the layer faders.
 * - CC 18/19 (General Purpose Controller 3/4) are used for filter
 *   cutoff/resonance. Earlier builds reused CC 71/74 for these, which made a
 *   single knob move both a layer fader and a filter parameter.
 * - GM-reserved / channel-mode controllers (1, 64, 120-127) are avoided.
 */

export const DEFAULT_MIDI_MAPPINGS = {
  master_vol: { cc: 7, channel: 0, min: 0, max: 100 },
  layer_1_vol: { cc: 71, channel: 0, min: 0, max: 100 },
  layer_2_vol: { cc: 72, channel: 0, min: 0, max: 100 },
  layer_3_vol: { cc: 73, channel: 0, min: 0, max: 100 },
  layer_4_vol: { cc: 74, channel: 0, min: 0, max: 100 },
  fx_cutoff: { cc: 18, channel: 0, min: 20, max: 20000 },
  fx_resonance: { cc: 19, channel: 0, min: 0, max: 20 },
};
