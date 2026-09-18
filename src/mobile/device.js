/**
 * Mobile device lifecycle glue for Capacitor (Android).
 * - Android system Back button: close open overlay/drawer, else minimize.
 * - Screen wake lock while the app tab is visible (native KeepAwake + Web API fallback).
 */

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { KeepAwake } from "@capacitor-community/keep-awake";

let wakeLockEnabled = true;
let webWakeLock = null;

export function setWakeLockEnabled(enabled) {
  wakeLockEnabled = !!enabled;
}

async function requestWebWakeLock() {
  if (!wakeLockEnabled || document.hidden) return;
  try {
    if (!webWakeLock && navigator.wakeLock?.request) {
      webWakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (e) {}
}

async function keepScreenAwake() {
  if (Capacitor.isNativePlatform()) {
    try {
      await KeepAwake.keepAwake();
    } catch (e) {
      console.warn("KeepAwake:", e);
    }
  } else {
    await requestWebWakeLock();
  }
}

async function handleBackButton() {
  const backdrop = document.getElementById("license-backdrop");
  if (backdrop && backdrop.classList.contains("open")) {
    backdrop.classList.remove("open");
    return;
  }
  const openBackdrop = document.querySelector(".license-modal-backdrop.open, .modal-backdrop.open");
  if (openBackdrop) {
    openBackdrop.classList.remove("open");
    return;
  }
  const drawer = document.getElementById("hud-tools-drawer");
  if (drawer && drawer.classList.contains("expanded")) {
    drawer.classList.remove("expanded");
    drawer.classList.add("collapsed");
    return;
  }
  if (Capacitor.isNativePlatform()) {
    try {
      await App.minimizeApp();
    } catch (e) {}
  }
}

export function initMobileDevice() {
  if (!Capacitor.isNativePlatform()) {
    if (wakeLockEnabled) {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          webWakeLock = null;
        } else {
          requestWebWakeLock();
        }
      });
      requestWebWakeLock();
    }
    return;
  }

  App.addListener("backButton", handleBackButton);

  if (wakeLockEnabled) {
    keepScreenAwake();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        KeepAwake.allowSleep().catch(() => {});
      } else {
        keepScreenAwake();
      }
    });
  }
}