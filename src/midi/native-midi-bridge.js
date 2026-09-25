/**
 * Native MIDI Bridge (Android Capacitor)
 *
 * Android System WebView does NOT implement the Web MIDI API
 * (navigator.requestMIDIAccess is undefined) — USB/Bluetooth MIDI keyboards
 * are invisible to the web layer. This module uses the MidiBridge Capacitor
 * plugin (android.media.midi) and feeds every incoming message into
 * MidiManager's EXISTING handleMidiMessage pipeline: the same velocity
 * shaping, scale lock, arpeggiator, CC/pedal/pitch-bend and Program-Change
 * handling as desktop WebView and Tauri.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

const MidiBridge = registerPlugin("MidiBridge");

export const nativeMidiBridge = {
  available: false,
  devices: [],
  _handler: null,
  _listenersBound: false,

  async init(onDeviceChange) {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      // Subscribe BEFORE opening so no early messages are lost
      if (!this._listenersBound) {
        this._listenersBound = true;
        MidiBridge.addListener("midiMessage", (msg) => {
          if (!msg || !Array.isArray(msg.data) || msg.data.length < 2) return;
          const data = new Uint8Array(msg.data);
          this._dispatch({ data, deviceId: msg.device });
        });
        MidiBridge.addListener("deviceChange", async () => {
          this.devices = await this.enumerate();
          if (onDeviceChange) onDeviceChange(this.devices);
          // Hotplug: re-open "all" so a newly plugged keyboard feeds us
          MidiBridge.openDevice({ id: "all" }).catch(() => {});
        });
      }
      // API 31+ MidiManager hides BLE devices until the Bluetooth runtime
      // grants are held, so request them before the first enumerate/open.
      await MidiBridge.ensureBluetoothPermissions().catch(() => {});
      this.devices = await this.enumerate();
      await MidiBridge.openDevice({ id: "all" }).catch(() => {});
      this.available = true;
      return true;
    } catch (e) {
      console.warn("[NativeMidi] bridge init failed:", e);
      return false;
    }
  },

  async enumerate() {
    try {
      const res = await MidiBridge.enumerate();
      return (res?.devices || []).map((d) => ({
        id: d.id,
        name: d.name || "MIDI Device",
        manufacturer: d.manufacturer || "Generic",
        state: "connected",
      }));
    } catch (e) {
      return [];
    }
  },

  _dispatch(event) {
    if (this._handler) {
      try {
        this._handler(event);
      } catch (e) {
        console.warn("[NativeMidi] handler error:", e);
      }
    }
  },

  setHandler(fn) {
    this._handler = fn;
  },

  close() {
    MidiBridge.closeAll().catch(() => {});
    this.available = false;
  },

  // ── MIDI OUT (web MIDI parity): open output ports + send ──

  outputsAvailable: false,
  _outputListenersBound: false,

  async initOutputs(onOutputChange) {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      if (!this._outputListenersBound) {
        this._outputListenersBound = true;
        MidiBridge.addListener("outputOpened", () => {
          if (onOutputChange) onOutputChange();
        });
        MidiBridge.addListener("deviceChange", () => {
          // Self-healing: re-open output ports for hotplugged gear
          MidiBridge.openOutputs().catch(() => {});
          if (onOutputChange) onOutputChange();
        });
      }
      await MidiBridge.ensureBluetoothPermissions().catch(() => {});
      await MidiBridge.openOutputs().catch(() => {});
      this.outputsAvailable = true;
      return true;
    } catch (e) {
      console.warn("[NativeMidi] outputs init failed:", e);
      return false;
    }
  },

  async enumerateOutputs() {
    try {
      const res = await MidiBridge.enumerate();
      return (res?.devices || [])
        .filter((d) => d.hasInput)
        .map((d) => ({
          id: d.id,
          name: d.name || "MIDI Output",
          manufacturer: d.manufacturer || "Generic",
          state: "connected",
        }));
    } catch (e) {
      return [];
    }
  },

  async sendRaw(data, ids) {
    if (!this.outputsAvailable) return;
    try {
      await MidiBridge.send({
        data: Array.from(data, (v) => v & 0xff),
        ids: ids && ids.length ? ids : null,
      });
    } catch (e) {}
  },
};
