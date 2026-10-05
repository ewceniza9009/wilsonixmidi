package com.wilsonix.midikey;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/**
 * Native Audio Bridge Plugin (Oboe/AAudio output).
 *
 * Replaces only the WebView's ~45ms output pipeline: the JS synth renders as
 * always, PCM chunks arrive here as base64 float32 (10ms per chunk, ~100/s),
 * and a lock-free ring feeds an Oboe LowLatency stream (~3ms burst). The web
 * path stays intact and is the automatic fallback for EVERY failure - this
 * plugin must never throw past Capacitor, and a missing .so is a soft reject,
 * not a crash.
 *
 * Threading: Capacitor runs all @PluginMethod calls serially on its
 * "CapacitorPlugins" HandlerThread (off the WebView/main thread), so the
 * write() hot path never touches the UI thread, and configure/write/stats/
 * never race each other - only the Oboe real-time callback is concurrent.
 */
@CapacitorPlugin(name = "AudioBridge")
public class AudioBridgePlugin extends Plugin {

    private static final String TAG = "AudioBridge";
    private static final boolean NATIVE_LOADED;

    static {
        boolean loaded = false;
        try {
            System.loadLibrary("wilsonix-audio");
            loaded = true;
        } catch (Throwable t) {
            android.util.Log.e(TAG, "wilsonix-audio native lib unavailable - bridge disabled", t);
        }
        NATIVE_LOADED = loaded;
    }

    private long handle = 0;
    private int channels = 2;

    private native long nativeCreate();
    private native String nativeConfigure(long h, int sampleRate);
    private native int nativeWrite(long h, byte[] data, int frames);
    private native String nativeStats(long h);
    private native void nativeStop(long h);
    private native void nativeDestroy(long h);

    /**
     * Opens the Oboe output stream at the context's sample rate.
     * {sampleRate: int} -> {ok, sampleRate, channels, burst, latencyMs} |
     * rejects with a reason the web layer logs before falling back.
     */
    @PluginMethod
    public void configure(PluginCall call) {
        if (!NATIVE_LOADED) {
            call.reject("native audio engine unavailable");
            return;
        }
        Integer sampleRate = call.getInt("sampleRate", 0);
        try {
            if (handle == 0) handle = nativeCreate();
            String json = nativeConfigure(handle, sampleRate != null ? sampleRate : 0);
            JSObject ret = parseJson(json);
            if (ret == null) {
                call.reject("native configure failed");
                return;
            }
            channels = ret.optInt("channels", 2);
            if (!ret.optBoolean("ok", false)) {
                call.reject("stream open failed: " + ret.optString("error", "unknown"));
                return;
            }
            call.resolve(ret);
        } catch (Throwable t) {
            android.util.Log.e(TAG, "configure error", t);
            call.reject("configure error: " + t.getMessage());
        }
    }

    /**
     * Pushes one interleaved float32 stereo chunk (base64, no line wraps).
     * {data: string} -> {written: int} (frames accepted by the ring).
     */
    @PluginMethod
    public void write(PluginCall call) {
        if (handle == 0) {
            call.reject("not configured");
            return;
        }
        String b64 = call.getString("data");
        if (b64 == null) {
            call.reject("no data");
            return;
        }
        try {
            byte[] bytes = Base64.decode(b64, Base64.NO_WRAP);
            int frameBytes = channels * 4;
            if (bytes.length < frameBytes) {
                call.resolve(written(0));
                return;
            }
            int frames = bytes.length / frameBytes;
            int written = nativeWrite(handle, bytes, frames);
            call.resolve(written(written));
        } catch (IllegalArgumentException e) {
            call.reject("bad base64");
        } catch (Throwable t) {
            android.util.Log.e(TAG, "write error", t);
            call.reject("write error: " + t.getMessage());
        }
    }

    /**
     * -> {ok, running, error, sampleRate, burst, latencyMs, fillMs, xruns,
     *     droppedFrames}. The JS watchdog polls this every second to decide
     *     whether to keep the bridge or fall back to the web output path.
     */
    @PluginMethod
    public void stats(PluginCall call) {
        if (handle == 0) {
            call.reject("not configured");
            return;
        }
        try {
            JSObject ret = parseJson(nativeStats(handle));
            if (ret == null) {
                call.reject("stats unavailable");
                return;
            }
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("stats error: " + t.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (handle != 0 && NATIVE_LOADED) {
            try { nativeStop(handle); } catch (Throwable ignored) {}
        }
        call.resolve();
    }

    @Override
    public void handleOnDestroy() {
        if (handle != 0 && NATIVE_LOADED) {
            try { nativeDestroy(handle); } catch (Throwable ignored) {}
        }
        handle = 0;
        super.handleOnDestroy();
    }

    private JSObject written(int frames) {
        JSObject o = new JSObject();
        o.put("written", frames);
        return o;
    }

    private JSObject parseJson(String json) {
        if (json == null) return null;
        try {
            JSONObject obj = new JSONObject(json);
            JSObject ret = new JSObject();
            java.util.Iterator<String> keys = obj.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                ret.put(key, obj.get(key));
            }
            return ret;
        } catch (Throwable t) {
            return null;
        }
    }
}
