/**
 * Web MIDI API Manager
 * Handles plug-and-play USB MIDI controllers, hotplugging, velocity response,
 * sustain pedals (CC 64), pitch bend (14-bit), and modulation wheels (CC 1).
 */

import { synthEngine } from "../audio/synth-engine.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";
import { shapeVelocity } from "./velocity-curve.js";

export class MidiManager {
  constructor() {
    this.midiAccess = null;
    this.connectedDevices = [];
    this.selectedInputId = "all";
    this.onDeviceChangeCallback = null;
    this.isSupported = typeof navigator !== "undefined" && !!navigator.requestMIDIAccess;
  }

  async init() {
    if (!this.isSupported) {
      console.warn("Web MIDI API not supported in this browser environment.");
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.updateDeviceList();

      // Listen for hotplug connect / disconnect
      this.midiAccess.onstatechange = e => {
        this.updateDeviceList();
        if (this.onDeviceChangeCallback) {
          this.onDeviceChangeCallback(this.connectedDevices);
        }
      };

      this.bindInputs();
      return true;
    } catch (err) {
      console.warn("Web MIDI permission denied or unavailable:", err);
      return false;
    }
  }

  updateDeviceList() {
    if (!this.midiAccess) return;
    this.connectedDevices = [];

    for (const input of this.midiAccess.inputs.values()) {
      this.connectedDevices.push({
        id: input.id,
        name: input.name || `MIDI Device ${input.id}`,
        manufacturer: input.manufacturer || "Generic",
        state: input.state,
      });
    }

    this.bindInputs();
  }

  bindInputs() {
    if (!this.midiAccess) return;

    for (const input of this.midiAccess.inputs.values()) {
      input.onmidimessage = this.handleMidiMessage.bind(this);
    }
  }

  handleMidiMessage(event) {
    const data = event.data;
    if (!data || data.length < 2) return;

    const statusByte = data[0];
    const command = statusByte >> 4;
    const channel = statusByte & 0xf;
    const note = data[1];
    const velocity = data.length > 2 ? data[2] : 0;

    switch (command) {
      case 0x9: // Note On
        if (velocity > 0) {
          const shaped = shapeVelocity(velocity);
          multiLayerEngine.noteOn(note, shaped);
        } else {
          // Note On with velocity 0 is standard MIDI Note Off
          multiLayerEngine.noteOff(note);
        }
        break;

      case 0x8: // Note Off
        multiLayerEngine.noteOff(note);
        break;

      case 0xb: // Control Change (CC)
        const ccNumber = note;
        const ccValue = velocity;

        if (ccNumber === 64) {
          // Damper / Sustain Pedal (0-63 Off, 64-127 On)
          const isDown = ccValue >= 64;
          synthEngine.setSustainPedal(isDown);
          multiLayerEngine.setSustainPedal(isDown);
        } else if (ccNumber === 1) {
          // Modulation Wheel
          const modNorm = ccValue / 127;
          synthEngine.setModWheel(modNorm);
          multiLayerEngine.setModWheel(modNorm);
        } else if (ccNumber === 7) {
          // Volume CC: Control master audio core volume
          audioCore.setMasterVolume(ccValue / 127);
        } else if (ccNumber === 120 || ccNumber === 123) {
          // All Sound Off / All Notes Off
          synthEngine.panic();
          multiLayerEngine.panic();
          if (audioCore.fxRack?.delay) audioCore.fxRack.delay.flush();
        }
        break;

      case 0xe: // Pitch Bend (14-bit precision)
        const lsb = data[1];
        const msb = data[2];
        const bendValue = (msb << 7) | lsb; // 0 to 16383, 8192 is center
        const semitones = ((bendValue - 8192) / 8192) * 2; // +/- 2 semitones standard
        synthEngine.setPitchBend(semitones);
        break;
    }
  }
}

export const midiManager = new MidiManager();
