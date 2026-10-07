package com.wilsonix.midikey;

import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewParent;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import java.util.Collections;
import java.util.List;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Plugin registration MUST happen BEFORE super.onCreate().
        // BridgeActivity.onCreate() -> load() -> Bridge constructor registers
        // the collected plugin list and injects window.Capacitor.PluginHeaders
        // all inside super. Anything registered after super only reaches the
        // builder's already-consumed list and is SILENTLY dropped, making the
        // JS side throw '"<name>" plugin is not implemented on android'.
        //
        // Native MIDI bridge: Android WebView lacks the Web MIDI API, so this
        // plugin (android.media.midi) streams USB/Bluetooth MIDI into the web
        // pipeline — same behavior as desktop WebView/Tauri.
        registerPlugin(MidiBridgePlugin.class);

        // Native low-latency output bridge (latency popover toggle / ?bridge=1):
        // streams the web mix to an Oboe/AAudio stream, bypassing Chromium's
        // ~45ms output buffer. Soft-fails to the untouched web path on any
        // device that can't open it.
        registerPlugin(AudioBridgePlugin.class);

        super.onCreate(savedInstanceState);

        // FLAG_SECURE: blocks MIUI 3-finger screenshot & screen capture
        if (getWindow() != null) {
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            );
        }
        
        setupImmersiveMode();
        setupGestureExclusion();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            setupImmersiveMode();
            setupGestureExclusion();
        }
    }

    private void setupImmersiveMode() {
        if (getWindow() != null) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            View decorView = getWindow().getDecorView();
            if (decorView != null) {
                decorView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                );
            }
        }
    }

    private void setupGestureExclusion() {
        // Exclude window from system navigation gestures (Android 10+ / API 29+)
        // This prevents OS gestures from hijacking multi-touch piano chords
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && getWindow() != null) {
            View decorView = getWindow().getDecorView();
            if (decorView != null) {
                decorView.post(() -> {
                    try {
                        Rect rect = new Rect(0, 0, decorView.getWidth(), decorView.getHeight());
                        List<Rect> exclusionRects = Collections.singletonList(rect);
                        decorView.setSystemGestureExclusionRects(exclusionRects);
                    } catch (Exception ignored) {}
                });
            }
        }
    }

    // Touch diagnostics: logs pointer-count transitions + system cancels to
    // logcat (tag MIDIKEY_TOUCH). Tells us definitively whether Xiaomi/HyperOS
    // swallows the 3rd finger BEFORE the app (native never sees it) or the
    // events arrive and something else eats them. Logs only on pointer-count
    // changes / ACTION_CANCEL — negligible cost, no hot-path spam.
    private int mLastLoggedPointerCount = -1;

    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        // Prevent system or parent views from intercepting multi-finger chord playing
        if (ev.getPointerCount() >= 2 && getWindow() != null) {
            View decorView = getWindow().getDecorView();
            if (decorView != null) {
                ViewParent parent = decorView.getParent();
                if (parent != null) {
                    parent.requestDisallowInterceptTouchEvent(true);
                }
            }
        }
        return super.dispatchTouchEvent(ev);
    }
}
