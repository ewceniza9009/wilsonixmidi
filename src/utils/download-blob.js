/**
 * Universal blob download helper.
 * On native (Capacitor/Android): writes to cache and opens the system share
 * sheet (fallback to <a download> if anything fails).
 * On desktop/web: standard <a download>; returns "download".
 */

import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const isNative = () =>
  typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(typeof result === "string" ? result.split(",")[1] : "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function triggerAnchorDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

export async function downloadBlob(filename, blob) {
  if (isNative()) {
    try {
      const data = await blobToBase64(blob);
      const path = "exports/" + filename;
      await Filesystem.writeFile({
        path,
        data,
        directory: Directory.Cache,
        recursive: true,
      });
      const { uri } = await Filesystem.getUri({
        path,
        directory: Directory.Cache,
      });
      await Share.share({ title: filename, files: [uri] });
      return "shared";
    } catch (e) {
      console.warn("Native export failed, falling back to download link:", e);
    }
  }
  triggerAnchorDownload(filename, blob);
  return "download";
}