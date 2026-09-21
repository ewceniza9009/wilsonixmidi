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
        super.onCreate(savedInstanceState);

        // Native MIDI bridge: Android WebView lacks the Web MIDI API, so this
        // plugin (android.media.midi) streams USB/Bluetooth MIDI into the web
        // pipeline — same behavior as desktop WebView/Tauri.
        registerPlugin(MidiBridgePlugin.class);

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

    // Native → web touch forwarding: feeds the raw dispatchTouchEvent stream to
    // the page (window.__nativeTouch) so the piano can be driven from native
    // events — immune to the Xiaomi/HyperOS cancel storm that kills the
    // WebView's page-touch pipeline. Pointer ids match web touch identifiers
    // (WebView maps Android pointers 1:1). MOVEs throttle to ~125Hz; other
    // actions forward immediately.
    private android.webkit.WebView mBridgeWebView;
    private long mLastMoveForward = 0;

    private void forwardTouchToWeb(MotionEvent ev, String actionName, int actionIndex) {
        if (mBridgeWebView == null) return;
        try {
            int pc = ev.getPointerCount();
            StringBuilder sb = new StringBuilder("{\"action\":\"").append(actionName)
                .append("\",\"i\":").append(actionIndex).append(",\"pointers\":[");
            for (int i = 0; i < pc; i++) {
                if (i > 0) sb.append(',');
                sb.append("{\"id\":").append(ev.getPointerId(i))
                  .append(",\"x\":").append(ev.getX(i))
                  .append(",\"y\":").append(ev.getY(i)).append('}');
            }
            sb.append("]}");
            mBridgeWebView.evaluateJavascript(
                "window.__nativeTouch&&window.__nativeTouch(" + sb + ")", null);
        } catch (Exception ignored) {}
    }

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

        int pc = ev.getPointerCount();
        int action = ev.getActionMasked();
        int actionIndex = ev.getActionIndex();

        // Touch diagnostic logging (throttled to pointer-count transitions)
        if (action == MotionEvent.ACTION_CANCEL || pc != mLastLoggedPointerCount) {
            mLastLoggedPointerCount = (action == MotionEvent.ACTION_CANCEL) ? 0 : pc;
            String actionName;
            switch (action) {
                case MotionEvent.ACTION_DOWN: actionName = "DOWN"; break;
                case MotionEvent.ACTION_POINTER_DOWN: actionName = "POINTER_DOWN"; break;
                case MotionEvent.ACTION_MOVE: actionName = "MOVE"; break;
                case MotionEvent.ACTION_UP: actionName = "UP"; break;
                case MotionEvent.ACTION_POINTER_UP: actionName = "POINTER_UP"; break;
                case MotionEvent.ACTION_CANCEL: actionName = "CANCEL"; break;
                default: actionName = "0x" + Integer.toHexString(action); break;
            }
            Log.d("MIDIKEY_TOUCH", "pointers=" + pc + " action=" + actionName);
        }

        // Forward the raw stream to the web layer (native touch bridge)
        if (mBridgeWebView == null && getBridge() != null) {
            mBridgeWebView = getBridge().getWebView();
        }
        String fwdName;
        switch (action) {
            case MotionEvent.ACTION_DOWN: fwdName = "DOWN"; break;
            case MotionEvent.ACTION_POINTER_DOWN: fwdName = "POINTER_DOWN"; break;
            case MotionEvent.ACTION_MOVE: fwdName = "MOVE"; break;
            case MotionEvent.ACTION_UP: fwdName = "UP"; break;
            case MotionEvent.ACTION_POINTER_UP: fwdName = "POINTER_UP"; break;
            case MotionEvent.ACTION_CANCEL: fwdName = "CANCEL"; break;
            default: fwdName = null; break;
        }
        if (fwdName != null) {
            long now = android.os.SystemClock.uptimeMillis();
            if (action != MotionEvent.ACTION_MOVE || (now - mLastMoveForward) >= 8) {
                if (action == MotionEvent.ACTION_MOVE) mLastMoveForward = now;
                forwardTouchToWeb(ev, fwdName, actionIndex);
            }
        }
        return super.dispatchTouchEvent(ev);
    }
}
