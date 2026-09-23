/**
 * Centralized Global Version & Build Metadata for WILSONIX MIDIKEY
 * Auto-synchronized across Main Web, Android (Capacitor/Gradle), and Desktop (Tauri).
 * Updated via: npm run version:patch | npm run version:minor | npm run version:major
 */

export const APP_VERSION = "2.2.0";
export const BUILD_NUMBER = 24;
export const BUILD_DATE = "2026-09-24";
export const APP_TITLE = "WILSONIX MIDIKEY";
export const APP_ID = "com.wilsonix.midikey";

export function getFullVersionString() {
  return `${APP_TITLE} v${APP_VERSION} (Build ${BUILD_NUMBER} • ${BUILD_DATE})`;
}
