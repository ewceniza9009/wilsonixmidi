package com.wilsonix.midikey;

import android.content.Context;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiInputPort;
import android.media.midi.MidiManager;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Native MIDI Bridge Plugin
 *
 * Android System WebView does NOT implement the Web MIDI API
 * (navigator.requestMIDIAccess is undefined), so USB/Bluetooth MIDI keyboards
 * are invisible to the web layer. This plugin bridges Android's native
 * android.media.midi stack to JS: it enumerates devices, opens them, and
 * streams every incoming MIDI message to the "midiMessage" listener, which
 * the web MidiManager feeds into its existing handleMidiMessage pipeline.
 */
@CapacitorPlugin(name = "MidiBridge")
public class MidiBridgePlugin extends Plugin {
    private MidiManager midiManager;
    private final Map<String, MidiDevice> openDevices = new HashMap<>();
    private final Map<String, MidiDevice> sendDevices = new HashMap<>();
    private final Map<String, MidiInputPort> openOutputPorts = new HashMap<>();
    private MidiManager.DeviceCallback deviceCallback;
    private boolean deviceCallbackRegistered = false;

    @Override
    public void load() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            midiManager = (MidiManager) getContext().getSystemService(Context.MIDI_SERVICE);
        }
    }

    private String deviceName(MidiDeviceInfo info) {
        String name = info.getProperties().getString(MidiDeviceInfo.PROPERTY_NAME);
        if (name == null || name.isEmpty()) {
            name = info.getProperties().getString(MidiDeviceInfo.PROPERTY_PRODUCT, "MIDI Device");
        }
        return name;
    }

    @PluginMethod
    public void enumerate(PluginCall call) {
        JSObject ret = new JSObject();
        JSArray devices = new JSArray();
        if (midiManager != null) {
            for (MidiDeviceInfo info : midiManager.getDevices()) {
                if (info.getOutputPortCount() > 0 || info.getInputPortCount() > 0) {
                    JSObject d = new JSObject();
                    d.put("id", String.valueOf(info.getId()));
                    d.put("name", deviceName(info));
                    d.put("manufacturer", info.getProperties()
                        .getString(MidiDeviceInfo.PROPERTY_MANUFACTURER, "Generic"));
                    // hasOutput = we can RECEIVE from it (its output port feeds
                    // MIDI IN). hasInput = we can SEND to it (MIDI OUT).
                    d.put("hasOutput", info.getOutputPortCount() > 0);
                    d.put("hasInput", info.getInputPortCount() > 0);
                    devices.put(d);
                }
            }
        }
        ret.put("devices", devices);
        call.resolve(ret);
    }

    @PluginMethod
    public void openDevice(PluginCall call) {
        String deviceId = call.getString("id", "all");
        if (midiManager == null) {
            call.reject("MIDI service unavailable on this device");
            return;
        }
        closeAllInternal();

        if ("all".equals(deviceId)) {
            // Web MIDI parity: bind EVERY connected device with an output port,
            // not just the first — multi-keyboard rigs get all inputs.
            int opened = 0;
            for (MidiDeviceInfo info : midiManager.getDevices()) {
                if (info.getOutputPortCount() > 0) {
                    if (openAndConnect(info)) opened++;
                }
            }
            JSObject ret = new JSObject();
            ret.put("opened", opened);
            call.resolve(ret);
            return;
        }

        MidiDeviceInfo target = null;
        try {
            int id = Integer.parseInt(deviceId);
            for (MidiDeviceInfo info : midiManager.getDevices()) {
                if (info.getId() == id) { target = info; break; }
            }
        } catch (NumberFormatException ignored) {}
        if (target == null) {
            // Nothing plugged yet — the hotplug deviceChange callback fires when
            // a keyboard is connected, and the web layer re-opens then.
            call.resolve();
            return;
        }
        openAndConnect(target);
        call.resolve();
    }

    private boolean openAndConnect(MidiDeviceInfo target) {
        final String key = String.valueOf(target.getId());
        if (openDevices.containsKey(key)) return false;
        final MidiDeviceInfo targetInfo = target;
        midiManager.openDevice(targetInfo, device -> {
            if (device == null) return;
            openDevices.put(key, device);
            MidiOutputPort port = device.openOutputPort(0);
            if (port == null) return;
            port.connect(new MidiReceiver() {
                @Override
                public void onSend(byte[] msg, int offset, int count, long timestamp) {
                    if (count <= 0) return;
                    JSObject obj = new JSObject();
                    JSArray data = new JSArray();
                    for (int i = 0; i < count; i++) {
                        data.put(msg[offset + i] & 0xff);
                    }
                    obj.put("data", data);
                    obj.put("device", key);
                    obj.put("timestamp", timestamp / 1000);
                    notifyListeners("midiMessage", obj);
                }
            });
            JSObject opened = new JSObject();
            opened.put("id", key);
            opened.put("name", deviceName(targetInfo));
            notifyListeners("deviceOpened", opened);
        }, null);
        return true;
    }

    @PluginMethod
    public void closeAll(PluginCall call) {
        closeAllInternal();
        call.resolve();
    }

    // ── MIDI OUT: open every device with an input port (web MIDI parity) ──

    @PluginMethod
    public void openOutputs(PluginCall call) {
        if (midiManager == null) {
            call.reject("MIDI service unavailable on this device");
            return;
        }
        closeOutputsInternal();
        int opened = 0;
        for (MidiDeviceInfo info : midiManager.getDevices()) {
            if (info.getInputPortCount() > 0) {
                if (openInputFor(info)) opened++;
            }
        }
        JSObject ret = new JSObject();
        ret.put("opened", opened);
        call.resolve(ret);
    }

    private boolean openInputFor(MidiDeviceInfo info) {
        final String key = String.valueOf(info.getId());
        if (openOutputPorts.containsKey(key)) return false;
        final MidiDeviceInfo targetInfo = info;
        midiManager.openDevice(info, device -> {
            if (device == null) return;
            MidiInputPort port = device.openInputPort(0);
            if (port == null) return;
            openOutputPorts.put(key, port);
            sendDevices.put(key, device);
            JSObject obj = new JSObject();
            obj.put("id", key);
            obj.put("name", deviceName(targetInfo));
            notifyListeners("outputOpened", obj);
        }, null);
        return true;
    }

    @PluginMethod
    public void send(PluginCall call) {
        JSArray data = call.getArray("data");
        if (data == null) {
            call.resolve();
            return;
        }
        try {
            java.util.List<Object> raw = data.toList();
            if (raw.isEmpty()) {
                call.resolve();
                return;
            }
            byte[] msg = new byte[raw.size()];
            for (int i = 0; i < raw.size(); i++) {
                Object o = raw.get(i);
                int v = o instanceof Number ? ((Number) o).intValue() : 0;
                msg[i] = (byte) (v & 0xff);
            }
            // Optional device-id filter (multi-output selection parity). Null or
            // empty sends to every open output port.
            JSArray ids = call.getArray("ids");
            java.util.Set<String> filter = null;
            if (ids != null) {
                filter = new java.util.HashSet<>();
                for (Object o : ids.toList()) {
                    filter.add(String.valueOf(o));
                }
            }
            for (Map.Entry<String, MidiInputPort> entry : openOutputPorts.entrySet()) {
                if (filter != null && !filter.contains(entry.getKey())) continue;
                try {
                    entry.getValue().send(msg, 0, msg.length, 0);
                } catch (IOException ignored) {}
            }
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void closeOutputs(PluginCall call) {
        closeOutputsInternal();
        call.resolve();
    }

    private void closeOutputsInternal() {
        for (MidiInputPort port : openOutputPorts.values()) {
            try { port.close(); } catch (IOException ignored) {}
        }
        openOutputPorts.clear();
        for (MidiDevice d : sendDevices.values()) {
            try { d.close(); } catch (IOException ignored) {}
        }
        sendDevices.clear();
    }

    private void closeAllInternal() {
        for (MidiDevice d : openDevices.values()) {
            try { d.close(); } catch (IOException ignored) {}
        }
        openDevices.clear();
    }

    @Override
    public void handleOnResume() {
        super.handleOnResume();
        if (midiManager != null && !deviceCallbackRegistered) {
            deviceCallbackRegistered = true;
            deviceCallback = new MidiManager.DeviceCallback() {
                @Override
                public void onDeviceAdded(MidiDeviceInfo device) {
                    JSObject obj = new JSObject();
                    obj.put("id", String.valueOf(device.getId()));
                    notifyListeners("deviceChange", obj);
                }

                @Override
                public void onDeviceRemoved(MidiDeviceInfo device) {
                    String key = String.valueOf(device.getId());
                    MidiDevice d = openDevices.remove(key);
                    if (d != null) {
                        try { d.close(); } catch (IOException ignored) {}
                    }
                    MidiInputPort port = openOutputPorts.remove(key);
                    if (port != null) {
                        try { port.close(); } catch (IOException ignored) {}
                    }
                    MidiDevice sendDev = sendDevices.remove(key);
                    if (sendDev != null) {
                        try { sendDev.close(); } catch (IOException ignored) {}
                    }
                    JSObject obj = new JSObject();
                    obj.put("id", key);
                    notifyListeners("deviceChange", obj);
                }
            };
            midiManager.registerDeviceCallback(deviceCallback, null);
        }
    }
}
