package com.wilsonix.midikey;

import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
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
