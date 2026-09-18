/**
 * MIDI Output Manager
 * Handles MIDI output ports, message sending, and MIDI Clock sync.
 */

export class MidiOutManager {
  constructor() {
    this.midiAccess = null;
    this.outputs = new Map(); // id -> MIDIOutput
    this.selectedOutputIds = new Set(); // multi-output support
    this.isSupported = typeof navigator !== "undefined" && !!navigator.requestMIDIAccess;

    // Clock state
    this.clockRunning = false;
    this.clockInterval = null;
    this.ppq = 24; // pulses per quarter note (MIDI standard)
    this.bpm = 120;
    this.clockCallback = null; // optional callback for external clock consumers
    this.channel = 0; // 0-indexed (Channel 1-16)
  }

  async init() {
    if (!this.isSupported) return false;
    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.updateOutputList();
      this.midiAccess.onstatechange = () => this.updateOutputList();
      return true;
    } catch (err) {
      console.warn("MIDI OUT: permission denied or unavailable:", err);
      return false;
    }
  }

  updateOutputList() {
    if (!this.midiAccess) return;
    const newOutputs = new Map();
    for (const output of this.midiAccess.outputs.values()) {
      newOutputs.set(output.id, output);
    }
    this.outputs = newOutputs;
    // Auto-clean selected outputs that no longer exist
    for (const id of this.selectedOutputIds) {
      if (!this.outputs.has(id)) this.selectedOutputIds.delete(id);
    }
  }

  getOutputList() {
    return Array.from(this.outputs.values()).map((o) => ({
      id: o.id,
      name: o.name || `MIDI Output ${o.id}`,
      manufacturer: o.manufacturer || "Generic",
      state: o.state,
    }));
  }

  selectOutput(id, add = false) {
    if (!add) this.selectedOutputIds.clear();
    if (this.outputs.has(id)) this.selectedOutputIds.add(id);
  }

  deselectOutput(id) {
    this.selectedOutputIds.delete(id);
  }

  clearOutputs() {
    this.selectedOutputIds.clear();
  }

  getSelectedOutputs() {
    return Array.from(this.selectedOutputIds)
      .map((id) => this.outputs.get(id))
      .filter(Boolean);
  }

  // Low-level send
  _send(data) {
    for (const output of this.getSelectedOutputs()) {
      try {
        output.send(data);
      } catch (e) {
        console.warn("MIDI OUT send error:", e);
      }
    }
  }

  // High-level message helpers
  noteOn(channel, note, velocity) {
    const rawCh = channel !== undefined && channel !== null ? channel : this.channel;
    const ch = Math.max(0, Math.min(15, rawCh));
    const n = Math.max(0, Math.min(127, note));
    const v = Math.max(0, Math.min(127, velocity));
    this._send([0x90 | ch, n, v]);
  }

  noteOff(channel, note, velocity = 0) {
    const rawCh = channel !== undefined && channel !== null ? channel : this.channel;
    const ch = Math.max(0, Math.min(15, rawCh));
    const n = Math.max(0, Math.min(127, note));
    const v = Math.max(0, Math.min(127, velocity));
    this._send([0x80 | ch, n, v]);
  }

  controlChange(channel, ccNumber, ccValue) {
    const ch = Math.max(0, Math.min(15, channel));
    const cc = Math.max(0, Math.min(127, ccNumber));
    const val = Math.max(0, Math.min(127, ccValue));
    this._send([0xB0 | ch, cc, val]);
  }

  programChange(channel, program) {
    const ch = Math.max(0, Math.min(15, channel));
    const pgm = Math.max(0, Math.min(127, program));
    this._send([0xC0 | ch, pgm]);
  }

  pitchBend(channel, lsb, msb) {
    const ch = Math.max(0, Math.min(15, channel));
    const l = Math.max(0, Math.min(127, lsb));
    const m = Math.max(0, Math.min(127, msb));
    this._send([0xE0 | ch, l, m]);
  }

  // System Real-time messages
  clock() {
    this._send([0xF8]);
  }

  start() {
    this._send([0xFA]);
  }

  continuePlay() {
    this._send([0xFB]);
  }

  stop() {
    this._send([0xFC]);
  }

  activeSensing() {
    this._send([0xFE]);
  }

  systemReset() {
    this._send([0xFF]);
  }

  // MIDI Clock sync
  setBpm(bpm) {
    this.bpm = Math.max(1, Math.min(999, bpm));
    if (this.clockRunning) this._restartClock();
  }

  startClock(bpm) {
    if (bpm !== undefined) this.setBpm(bpm);
    if (this.clockRunning) return;
    this.clockRunning = true;
    this._startClock();
    this.start();
  }

  stopClock() {
    if (!this.clockRunning) return;
    this.clockRunning = false;
    this._stopClock();
    this.stop();
  }

  _startClock() {
    const intervalMs = 60000 / (this.bpm * this.ppq); // ms per tick
    this.clockInterval = setInterval(() => {
      this.clock();
      if (this.clockCallback) this.clockCallback();
    }, intervalMs);
    // Compensate for setInterval drift
    this._nextTick = Date.now() + intervalMs;
  }

  _stopClock() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  _restartClock() {
    this._stopClock();
    this._startClock();
  }

  setClockCallback(cb) {
    this.clockCallback = cb;
  }
}

export const midiOutManager = new MidiOutManager();