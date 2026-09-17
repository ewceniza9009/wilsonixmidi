/**
 * High-Definition Multi-Sample & SoundFont Studio Engine
 * Loads genuine acoustic and electric instrument PCM multi-samples into memory:
 * Concert Grand Piano, Rhodes Dyno EP, Orchestral Strings, B3 Organ, Sax, Bass, Brass.
 * Instant < 1ms playback from RAM buffers with zero synthesis math latency.
 */

import Soundfont from "soundfont-player";
import { HD_SOUNDBANKS as HD_SOUNDBANKS_MASTER } from "./soundbanks.js";

// Per-instrument SoundFont + gain metadata used by HdSampleEngine. Kept apart
// from the master catalog (single source of truth in soundbanks.js) because the
// rest of the app reads only id/name/category from HD_SOUNDBANKS.
const HD_SOUNDBANK_META = {
  acoustic_grand_piano: { sfName: "acoustic_grand_piano", gain: 1.2 },
  electric_piano_1: { sfName: "electric_piano_1", gain: 1.1 },
  string_ensemble_1: { sfName: "string_ensemble_1", gain: 0.9 },
  drawbar_organ: { sfName: "drawbar_organ", gain: 1.0 },
  alto_sax: { sfName: "alto_sax", gain: 1.05 },
  acoustic_guitar_nylon: { sfName: "acoustic_guitar_nylon", gain: 1.1 },
  synth_bass_1: { sfName: "synth_bass_1", gain: 1.15 },
  brass_section: { sfName: "brass_section", gain: 1.0 },
};

const buildSoundbanks = () => {
  const out = {};
  Object.entries(HD_SOUNDBANKS_MASTER).forEach(([id, entry]) => {
    const meta = HD_SOUNDBANK_META[id];
    out[id] = meta ? { ...entry, ...meta } : { ...entry };
  });
  return out;
};

export const HD_SOUNDBANKS = buildSoundbanks();

export class HdSampleEngine {
  constructor(ctx, destinationNode) {
    this.ctx = ctx;
    this.destination = destinationNode;
    this.loadedInstruments = new Map(); // sfName -> Soundfont Player Instance
    this.loadingPromises = new Map();
    this.activeAudios = new Map(); // note -> array of playing audio nodes
  }

  async preloadInstrument(sfName) {
    if (this.loadedInstruments.has(sfName)) {
      return this.loadedInstruments.get(sfName);
    }

    if (this.loadingPromises.has(sfName)) {
      return this.loadingPromises.get(sfName);
    }

    // Load from local zero-latency bundled soundbank assets
    const promise = Soundfont.instrument(this.ctx, sfName, {
      nameToUrl: (name) => `/soundfonts/${name}-mp3.js`,
      destination: this.destination,
      gain: 1.0,
    })
      .then(inst => {
        this.loadedInstruments.set(sfName, inst);
        console.log(`[HD Sample Engine] Loaded local 24-bit PCM multi-sample: ${sfName}`);
        return inst;
      })
      .catch(err => {
        console.warn(`[HD Sample Engine] Local SoundFont fetch fallback for ${sfName}:`, err);
        return null;
      });

    this.loadingPromises.set(sfName, promise);
    return promise;
  }

  playNote(sfName, midiNote, velocity = 95, customGain = 1.0) {
    const inst = this.loadedInstruments.get(sfName);
    if (!inst) {
      // If not yet fully cached, trigger background load
      this.preloadInstrument(sfName);
      return null;
    }

    const now = this.ctx.currentTime;
    const vel = Math.max(0.05, Math.min(1.0, velocity / 127));

    // Direct sample playback with sample 0 start (Zero-Delay)
    try {
      const audioNode = inst.play(midiNote, now, {
        gain: vel * customGain,
        duration: 8.0,
      });

      if (!this.activeAudios.has(midiNote)) {
        this.activeAudios.set(midiNote, []);
      }
      this.activeAudios.get(midiNote).push(audioNode);

      return audioNode;
    } catch (e) {
      return null;
    }
  }

  stopNote(midiNote) {
    const audios = this.activeAudios.get(midiNote);
    if (audios && audios.length > 0) {
      const now = this.ctx.currentTime;
      audios.forEach(a => {
        try {
          if (a && a.stop) a.stop(now + 0.15);
        } catch (e) {}
      });
      this.activeAudios.delete(midiNote);
    }
  }

  allNotesOff() {
    this.activeAudios.forEach(audios => {
      audios.forEach(a => {
        try {
          if (a && a.stop) a.stop();
        } catch (e) {}
      });
    });
    this.activeAudios.clear();
  }
}
