/**
 * MIDI Converter Engine
 *
 * Browser-native, zero-dependency standard MIDI file (.mid / .midi) parser & converter.
 * Converts any standard MIDI file into Wilsonix MIDIKey interactive song clips ({ time, note, vel, dur }),
 * ready for DemoStation, LookaheadScheduler, and live multi-layer engine playback.
 */

export class MidiConverterEngine {
  /**
   * Parse a raw MIDI binary buffer (ArrayBuffer or Uint8Array) into tracks & events.
   * @param {ArrayBuffer|Uint8Array} input
   * @returns {{ format: number, numTracks: number, ticksPerBeat: number, tracks: Array<Array<object>> }}
   */
  static parse(input) {
    const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
    let offset = 0;

    function readStr(len) {
      let s = "";
      for (let i = 0; i < len; i++) s += String.fromCharCode(buffer[offset++]);
      return s;
    }

    function readUInt32() {
      const v = (buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
      offset += 4;
      return v >>> 0;
    }

    function readUInt16() {
      const v = (buffer[offset] << 8) | buffer[offset + 1];
      offset += 2;
      return v;
    }

    function readVarLen() {
      let val = 0;
      let b = 0;
      do {
        b = buffer[offset++];
        val = (val << 7) | (b & 0x7F);
      } while (b & 0x80);
      return val;
    }

    const chunkType = readStr(4);
    if (chunkType !== "MThd") {
      throw new Error(`Invalid MIDI file header: expected "MThd", got "${chunkType}"`);
    }

    const headerLen = readUInt32();
    const format = readUInt16();
    const numTracks = readUInt16();
    const division = readUInt16();
    if (headerLen > 6) offset += headerLen - 6;

    const ticksPerBeat = division & 0x8000 ? 480 : division;
    const tracks = [];

    for (let t = 0; t < numTracks; t++) {
      if (offset >= buffer.length) break;
      readStr(4); // "MTrk"
      const tLen = readUInt32();
      const tEnd = offset + tLen;
      const events = [];
      let curTicks = 0;
      let runningStatus = 0;

      while (offset < tEnd && offset < buffer.length) {
        const delta = readVarLen();
        curTicks += delta;
        let status = buffer[offset];

        if (status >= 0x80) {
          offset++;
          runningStatus = status;
        } else {
          status = runningStatus;
        }

        if (status === 0xFF) {
          // Meta Event
          const metaType = buffer[offset++];
          const mLen = readVarLen();
          const mData = buffer.subarray(offset, offset + mLen);
          offset += mLen;

          if (metaType === 0x51 && mLen === 3) {
            // Tempo: microseconds per beat
            const uspb = (mData[0] << 16) | (mData[1] << 8) | mData[2];
            events.push({ ticks: curTicks, type: "tempo", uspb });
          } else if (metaType === 0x03) {
            // Track / Sequence Name
            let text = "";
            for (let i = 0; i < mLen; i++) text += String.fromCharCode(mData[i]);
            events.push({ ticks: curTicks, type: "name", text: text.trim() });
          }
        } else if (status === 0xF0 || status === 0xF7) {
          // SysEx
          const sLen = readVarLen();
          offset += sLen;
        } else {
          const msgType = status & 0xF0;
          const channel = status & 0x0F;

          if (msgType === 0x90) {
            const note = buffer[offset++];
            const vel = buffer[offset++];
            if (vel > 0) {
              events.push({ ticks: curTicks, type: "noteOn", note, vel, ch: channel });
            } else {
              events.push({ ticks: curTicks, type: "noteOff", note, vel: 0, ch: channel });
            }
          } else if (msgType === 0x80) {
            const note = buffer[offset++];
            const vel = buffer[offset++];
            events.push({ ticks: curTicks, type: "noteOff", note, vel, ch: channel });
          } else if (msgType === 0xB0) {
            const cc = buffer[offset++];
            const val = buffer[offset++];
            if (cc === 64) {
              events.push({ ticks: curTicks, type: "pedal", down: val >= 64, ch: channel });
            }
          } else if (msgType === 0xC0) {
            const program = buffer[offset++];
            events.push({ ticks: curTicks, type: "program", program, ch: channel });
          } else if (msgType === 0xD0) {
            offset++;
          } else if (msgType === 0xE0) {
            offset += 2;
          }
        }
      }
      tracks.push(events);
    }

    return { format, numTracks, ticksPerBeat, tracks };
  }

  /**
   * Build millisecond timing map from tempo change events.
   */
  static buildTempoMap(tracks, ticksPerBeat) {
    const tempoChanges = [];
    tracks.forEach((tr) => {
      tr.forEach((ev) => {
        if (ev.type === "tempo") tempoChanges.push({ ticks: ev.ticks, uspb: ev.uspb });
      });
    });

    tempoChanges.sort((a, b) => a.ticks - b.ticks);
    if (tempoChanges.length === 0 || tempoChanges[0].ticks > 0) {
      tempoChanges.unshift({ ticks: 0, uspb: 500000 }); // Default 120 BPM
    }

    const cleanTempos = [];
    tempoChanges.forEach((tc) => {
      if (cleanTempos.length > 0 && cleanTempos[cleanTempos.length - 1].ticks === tc.ticks) {
        cleanTempos[cleanTempos.length - 1] = tc;
      } else {
        cleanTempos.push(tc);
      }
    });

    let cumMs = 0;
    for (let i = 0; i < cleanTempos.length; i++) {
      cleanTempos[i].timeMs = cumMs;
      if (i < cleanTempos.length - 1) {
        const dt = cleanTempos[i + 1].ticks - cleanTempos[i].ticks;
        cumMs += (dt * cleanTempos[i].uspb) / (ticksPerBeat * 1000);
      }
    }

    return function ticksToMs(ticks) {
      let i = cleanTempos.length - 1;
      while (i > 0 && cleanTempos[i].ticks > ticks) i--;
      const tc = cleanTempos[i];
      const dt = ticks - tc.ticks;
      return tc.timeMs + (dt * tc.uspb) / (ticksPerBeat * 1000);
    };
  }

  /**
   * Convert an ArrayBuffer or Uint8Array into a full Wilsonix playable song.
   *
   * @param {ArrayBuffer|Uint8Array} buffer
   * @param {object} [options]
   * @param {string} [options.title] Custom title
   * @param {string} [options.subtitle] Custom subtitle
   * @param {string} [options.combi] Combi preset (default: "clean_electric_piano")
   * @param {string|null} [options.fxPreset] FX preset (default: null)
   * @param {string} [options.mode] "30s" (hook/densest window), "start" (0s-30s), or "full"
   * @param {number} [options.durationMs] Target duration in ms (default: 30000)
   * @param {number} [options.velocityScale] Scale velocities (default: 0.80)
   * @param {boolean} [options.stripPedal] Remove sustain pedal events (default: true)
   * @param {boolean} [options.ignoreDrums] Ignore channel 9 percussion (default: true)
   * @returns {object} Song object { id, title, subtitle, combi, fxPreset, durationMs, embeddedInsts, events }
   */
  static convert(buffer, options = {}) {
    const {
      title = "",
      subtitle = "",
      combi = "clean_electric_piano",
      fxPreset = null,
      mode = "30s",
      durationMs = 30000,
      velocityScale = 0.80,
      stripPedal = true,
      ignoreDrums = true,
    } = options;

    const midi = this.parse(buffer);
    const ticksToMs = this.buildTempoMap(midi.tracks, midi.ticksPerBeat);

    // Scan for track names to construct title if not provided
    let detectedTitle = title;
    if (!detectedTitle) {
      for (const tr of midi.tracks) {
        const nameEv = tr.find((e) => e.type === "name" && e.text && !e.text.toLowerCase().includes("track"));
        if (nameEv) {
          detectedTitle = nameEv.text;
          break;
        }
      }
    }
    if (!detectedTitle) detectedTitle = "Custom MIDI Clip";

    // Extract all noteOn / noteOff pairs
    const notes = [];
    midi.tracks.forEach((tr) => {
      const active = {};
      tr.forEach((ev) => {
        if (ev.type === "noteOn") {
          const k = `${ev.ch}_${ev.note}`;
          if (!active[k]) active[k] = [];
          active[k].push({ ticks: ev.ticks, vel: ev.vel, ch: ev.ch, note: ev.note });
        } else if (ev.type === "noteOff") {
          const k = `${ev.ch}_${ev.note}`;
          if (active[k] && active[k].length > 0) {
            const on = active[k].shift();
            const startMs = ticksToMs(on.ticks);
            const endMs = ticksToMs(ev.ticks);
            const dur = Math.max(80, Math.round(endMs - startMs));
            if (!ignoreDrums || on.ch !== 9) {
              notes.push({ timeMs: startMs, note: on.note, vel: on.vel, dur });
            }
          }
        }
      });
    });

    notes.sort((a, b) => a.timeMs - b.timeMs);

    if (notes.length === 0) {
      throw new Error("No playable musical notes found in this MIDI file.");
    }

    const totalDuration = notes[notes.length - 1].timeMs;
    let windowStart = 0;
    let windowLen = durationMs;

    if (mode === "full") {
      windowStart = notes[0].timeMs;
      windowLen = Math.max(durationMs, totalDuration - windowStart + 1000);
    } else if (mode === "start") {
      windowStart = notes[0].timeMs;
      windowLen = durationMs;
    } else {
      // mode === "30s": search for the densest, most energetic 30s window
      const firstNoteTime = notes[0].timeMs;
      const searchStart = Math.max(0, firstNoteTime);
      const searchEnd = Math.max(searchStart, totalDuration - durationMs);
      let maxNotes = 0;
      let bestT = searchStart;

      for (let t = searchStart; t <= searchEnd; t += 2000) {
        const cnt = notes.filter((n) => n.timeMs >= t && n.timeMs < t + durationMs).length;
        if (cnt > maxNotes && cnt >= 25) {
          maxNotes = cnt;
          bestT = t;
        }
      }
      windowStart = bestT;
      windowLen = durationMs;
    }

    const windowEnd = windowStart + windowLen;
    const windowNotes = notes.filter((n) => n.timeMs >= windowStart && n.timeMs < windowEnd);
    const shift = windowNotes.length > 0 ? windowNotes[0].timeMs - 100 : 0;

    // Build event list
    const events = [];
    windowNotes.forEach((n) => {
      const relTime = Math.max(0, Math.round(n.timeMs - shift));
      if (mode !== "full" && relTime > windowLen - 100) return;
      const scaledVel = Math.max(25, Math.min(105, Math.round(n.vel * velocityScale)));
      events.push({
        time: relTime,
        note: n.note,
        vel: scaledVel,
        dur: Math.min(3500, n.dur),
      });
    });

    // Optional pedal events
    if (!stripPedal) {
      midi.tracks.forEach((tr) => {
        tr.forEach((ev) => {
          if (ev.type === "pedal") {
            const pMs = ticksToMs(ev.ticks);
            if (pMs >= windowStart && pMs < windowEnd) {
              events.push({
                time: Math.max(0, Math.round(pMs - shift)),
                type: "pedal",
                down: ev.down,
              });
            }
          }
        });
      });
      events.sort((a, b) => a.time - b.time);
    }

    const songId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const embeddedInsts = ["electric_piano_1", "string_ensemble_1", "synth_bass_1"];

    return {
      id: songId,
      title: detectedTitle,
      subtitle: subtitle || "Custom Imported MIDI • 30s Interactive Clip",
      combi,
      fxPreset,
      durationMs: windowLen,
      embeddedInsts,
      events,
      isCustom: true,
    };
  }

  /**
   * Helper to read a browser File or Blob object into a Wilsonix song.
   * @param {File|Blob} file
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  static async fromFile(file, options = {}) {
    const buffer = await file.arrayBuffer();
    const title = options.title || file.name.replace(/\.(mid|midi)$/i, "").replace(/[-_]/g, " ");
    return this.convert(buffer, { ...options, title });
  }

  /**
   * Format a song object as copyable ES module source code.
   * @param {object} song
   * @returns {string}
   */
  static toSourceCode(song) {
    const evLines = song.events
      .map((e) => `    { time: ${e.time}, note: ${e.note}, vel: ${e.vel}, dur: ${e.dur} },`)
      .join("\n");

    return `/**
 * Custom Demo Song: ${song.title}
 */
export const song = {
  id: ${JSON.stringify(song.id)},
  title: ${JSON.stringify(song.title)},
  subtitle: ${JSON.stringify(song.subtitle)},
  combi: ${JSON.stringify(song.combi)},
  fxPreset: ${song.fxPreset ? JSON.stringify(song.fxPreset) : "null"},
  durationMs: ${song.durationMs},
  embeddedInsts: ${JSON.stringify(song.embeddedInsts)},
  events: [
${evLines}
  ],
};
`;
  }
}
