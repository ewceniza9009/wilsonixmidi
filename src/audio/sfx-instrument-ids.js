/**
 * WILSONIX MIDIKEY Elite - SFX instrument id classification.
 * Standalone (stateless) SFX catalog check so the noteOn hot path and preset
 * loaders can classify instruments WITHOUT importing the 3,274-line
 * SfxSoundGenerator class — which is lazily bootstrapped via dynamic import on
 * first SFX use (P1 code splitting).
 */

export function isSfxInstrumentId(instId) {
  if (!instId) return false;
  if (instId.endsWith("_r")) return false;
  const id = String(instId).toLowerCase();
  if (id === "percussion_taiko" || id === "taiko_drum" || id === "thunder_taiko") return false;
  if (id === "voice_oohs" || id === "choir_aahs") return false;
  if (id === "tubular_bells" || id === "wind_chimes" || id === "crystal_chimes") return true;
  if (id === "angelic_choir") return true;
  if (id.startsWith("sy_")) return true;
  if (id.startsWith("nature_")) return true;
  if (id.startsWith("vox_")) return true;
  if (id.startsWith("fx_")) return true;
  if (id.startsWith("percussion_")) return true;
  if (id.startsWith("drum_")) return true;
  if (id === "synth_drum" || id === "analog_synth_drum" || id === "real_drum_kit" || id === "percussion_conga" || id === "congas") return true;
  if (id === "tr808_kit" || id === "tr909_kit" || id === "drums1" || id === "m1_drums") return true;
  if (id === "dub_siren" || id === "reggae_siren" || id === "spring_splash" || id === "dub_splash") return true;
  if (id === "laser_zap" || id === "dub_laser" || id === "dub_horn" || id === "airhorn" || id === "sub_boom" || id === "sub_drop" || id === "noise_riser") return true;
  if (id === "kalimba" || id === "m1_kalimba") return true;
  return false;
}
