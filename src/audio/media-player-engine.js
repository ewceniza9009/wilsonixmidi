const STORAGE_KEY = "midikey.mediaPlayer.playlist.v1";

const MIME_BY_EXT = {
  mp3: "audio/mpeg",
  mp2: "audio/mpeg",
  wav: "audio/wav",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  flac: "audio/flac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  mp4: "audio/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "audio/webm",
  wma: "audio/x-ms-wma",
};

let uidCounter = 1;
const nextUid = () => `mp-${Date.now().toString(36)}-${uidCounter++}`;
const nextPathKey = () => `pth-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/* ── IndexedDB Persistent Media Storage (Android & Web) ── */
const IDB_MEDIA_DB = "MidikeyMediaPlayerDB";
const IDB_MEDIA_STORE = "media_blobs";
const IDB_MEDIA_VERSION = 1;

function openMediaDB() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_MEDIA_DB, IDB_MEDIA_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_MEDIA_STORE)) {
          db.createObjectStore(IDB_MEDIA_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Persists an audio track's binary data into IndexedDB.
 * On Android WebView / mobile browsers, DOM `File` handles from Content URIs cannot
 * be safely cloned or retained across app restarts. We extract the raw ArrayBuffer,
 * which is 100% cloneable and reliable in all IndexedDB implementations.
 */
async function saveMediaFile(id, fileOrBlob, meta = {}) {
  const db = await openMediaDB();
  if (!db) return false;

  let buffer = null;
  try {
    if (fileOrBlob instanceof Blob || (typeof File !== "undefined" && fileOrBlob instanceof File)) {
      buffer = await fileOrBlob.arrayBuffer();
    } else if (fileOrBlob instanceof ArrayBuffer) {
      buffer = fileOrBlob;
    } else if (fileOrBlob && fileOrBlob.buffer instanceof ArrayBuffer) {
      buffer = fileOrBlob.buffer;
    }
  } catch (err) {
    console.warn("[MediaPlayer] Failed to read audio buffer:", err);
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([IDB_MEDIA_STORE], "readwrite");
      const store = tx.objectStore(IDB_MEDIA_STORE);
      const record = {
        id,
        name: meta.name || fileOrBlob?.name || "Untitled",
        ext: meta.ext || "",
        mime: meta.mime || fileOrBlob?.type || "audio/mpeg",
        size: meta.size || (buffer ? buffer.byteLength : fileOrBlob?.size || 0),
        duration: meta.duration || 0,
        updatedAt: Date.now(),
      };
      if (buffer) {
        record.buffer = buffer;
      } else if (fileOrBlob instanceof Blob) {
        record.blob = fileOrBlob;
      }
      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => {
        console.warn("[MediaPlayer] IDB store.put error:", e);
        resolve(false);
      };
    } catch (err) {
      console.warn("[MediaPlayer] IDB put failed:", err);
      resolve(false);
    }
  });
}

async function getAllMediaBlobs() {
  const db = await openMediaDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([IDB_MEDIA_STORE], "readonly");
      const store = tx.objectStore(IDB_MEDIA_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function deleteMediaBlob(id, name) {
  const db = await openMediaDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([IDB_MEDIA_STORE], "readwrite");
      const store = tx.objectStore(IDB_MEDIA_STORE);
      if (id) store.delete(id);
      if (name) {
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            if (cursor.value.name && cursor.value.name.toLowerCase() === name.toLowerCase()) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function clearMediaDB() {
  const db = await openMediaDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([IDB_MEDIA_STORE], "readwrite");
      const store = tx.objectStore(IDB_MEDIA_STORE);
      store.clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function recordToBlob(record, fallbackMime) {
  if (!record) return null;
  const mime = record.mime || fallbackMime || "audio/mpeg";
  if (record.buffer) {
    const buf = record.buffer instanceof ArrayBuffer ? record.buffer : record.buffer.buffer || record.buffer;
    if (buf && buf.byteLength > 0) {
      return new Blob([buf], { type: mime });
    }
  }
  if (record.blob instanceof Blob && record.blob.size > 0) {
    return record.blob;
  }
  if (record.blob && record.blob.buffer && record.blob.buffer.byteLength > 0) {
    return new Blob([record.blob.buffer], { type: record.blob.type || mime });
  }
  return null;
}

export class MediaPlayerEngine {
  constructor() {
    this.isTauri = typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
    this.playlist = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.volume = 1.0;
    this.rate = 1.0;
    this.loopMode = "off"; // off | one | all
    this.playbackRate = 1.0;
    this.audioEl = null;
    this.mediaSource = null;
    this.gainNode = null;
    this.analyser = null;
    this._onState = () => {};
    this._onTime = () => {};
    this._loadedMeta = false;
    this.error = null;
    this.stalled = false;
    // P3.6: absolute disk paths exist only in this in-session map, keyed by a
    // random scoped token. localStorage persists name + token, never the path.
    this._scopedPaths = new Map();
    this._restoring = null;
  }

  init() {
    if (this.audioEl) return;
    if (typeof Audio === "undefined") return;
    this.audioEl = new Audio();
    this.audioEl.preload = "auto";
    this.audioEl.addEventListener("loadedmetadata", () => {
      this._loadedMeta = true;
      const trk = this.playlist[this.currentIndex];
      if (trk && Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0) {
        trk.duration = this.audioEl.duration;
      }
      this.persist();
      this._onState();
    });
    this.audioEl.addEventListener("timeupdate", () => {
      const trk = this.playlist[this.currentIndex];
      if (trk && (!trk.duration || trk.duration <= 0) && Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0) {
        trk.duration = this.audioEl.duration;
      }
      this._onTime({
        currentTime: this.audioEl.currentTime,
        duration: (trk && trk.duration > 0) ? trk.duration : (this.audioEl.duration || 0),
      });
    });
    this.audioEl.addEventListener("ended", () => this._handleEnded());
    this.audioEl.addEventListener("error", () => {
      const err = this.audioEl.error;
      console.warn("[MediaPlayer] audioEl error:", err);
      if (err) {
        const codes = {
          1: "playback aborted",
          2: "network error while loading",
          3: "file could not be decoded",
          4: "source is not supported",
        };
        this.error = `MEDIA ERROR — ${codes[err.code] || `code ${err.code}`}`;
      } else {
        this.error = "MEDIA ERROR";
      }
      this.isPlaying = false;
      this._onState();
    });
    this.audioEl.addEventListener("stalled", () => {
      this.stalled = true;
      this._onState();
    });
    this.audioEl.addEventListener("playing", () => {
      this.stalled = false;
      this.isPlaying = true;
      this._onState();
    });
    this.audioEl.addEventListener("pause", () => {
      this.isPlaying = false;
      this._onState();
    });
    this.audioEl.addEventListener("loadstart", () => {
      this.error = null;
      this.stalled = false;
      this._onState();
    });
    this.audioEl.volume = this.volume;
    this.audioEl.playbackRate = this.rate;

    this._initMediaSession();
  }

  setOnState(cb) {
    this._onState = cb;
  }

  setOnTime(cb) {
    this._onTime = cb;
  }

  _initMediaSession() {
    if (typeof navigator === "undefined" || !navigator.mediaSession) return;
    navigator.mediaSession.setActionHandler("play", () => this.play());
    navigator.mediaSession.setActionHandler("pause", () => this.pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => this.prev());
    navigator.mediaSession.setActionHandler("nexttrack", () => this.next());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (this.audioEl && details.seekTime !== undefined) {
        this.audioEl.currentTime = details.seekTime;
      }
    });
    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      if (this.audioEl) {
        const skip = details.seekOffset || 10;
        this.audioEl.currentTime = Math.max(0, this.audioEl.currentTime - skip);
      }
    });
    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      if (this.audioEl) {
        const skip = details.seekOffset || 10;
        this.audioEl.currentTime = Math.min(this.audioEl.duration || 0, this.audioEl.currentTime + skip);
      }
    });
  }

  _updateMediaSession() {
    if (typeof navigator === "undefined" || !navigator.mediaSession) return;
    const track = this.playlist[this.currentIndex];
    if (!track) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: "WILSONIX MIDIKEY",
      album: track.source === "disk" ? "Stage Rig" : "Session",
    });
    navigator.mediaSession.playbackState = this.isPlaying ? "playing" : "paused";
  }

  /* ===================== Playlist management ===================== */

  _trackMeta(file, path) {
    const name = file.name || path.split(/[\\/]/).pop() || "Untitled";
    const dot = name.lastIndexOf(".");
    const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
    return {
      id: nextUid(),
      name,
      ext,
      mime: MIME_BY_EXT[ext] || (file.type || "audio/mpeg"),
    };
  }

  async addFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return [];
    this.init();
    const added = [];
    for (const file of list) {
      const meta = this._trackMeta(file, file.name);
      const url = URL.createObjectURL(file);
      const lowerName = (file.name || "").toLowerCase().trim();

      // Check if an existing entry with the same filename exists (active or placeholder)
      const reuse = this.playlist.find(
        (t) => (t.name || "").toLowerCase().trim() === lowerName
      );
      if (reuse) {
        if (reuse.url) {
          try { URL.revokeObjectURL(reuse.url); } catch {}
        }
        reuse.url = url;
        reuse.mime = meta.mime;
        reuse.ext = meta.ext;
        reuse.size = file.size || 0;
        reuse.duration = 0;
        reuse.missing = false;
        reuse.placeholder = false;
        reuse.source = "blob";
        await saveMediaFile(reuse.id, file, {
          name: reuse.name,
          ext: reuse.ext,
          mime: reuse.mime,
          size: reuse.size,
        });
        added.push(reuse);
        continue;
      }
      const track = {
        id: nextUid(),
        ...meta,
        path: null,
        size: file.size || 0,
        duration: 0,
        url,
        missing: false,
        placeholder: false,
        source: "blob",
      };
      await saveMediaFile(track.id, file, {
        name: track.name,
        ext: track.ext,
        mime: track.mime,
        size: track.size,
      });
      this.playlist.push(track);
      added.push(track);
    }
    this.persist();
    this._onState();
    return added;
  }

  async addPaths(paths) {
    if (!this.isTauri) return [];
    const list = Array.from(paths || []);
    if (!list.length) return [];
    this.init();
    const added = [];
    for (const path of list) {
      const name = path.split(/[\\/]/).pop() || "Untitled";
      const fakeFile = { name, type: "audio/mpeg" };
      const meta = this._trackMeta(fakeFile, path);
      const lowerName = name.toLowerCase().trim();
      // Rebind a placeholder or existing entry with the same filename in-place
      const reuse = this.playlist.find(
        (t) => (t.name || "").toLowerCase().trim() === lowerName
      );
      let track = null;
      try {
        const buf = await this._invoke("read_media", { path });
        const url = URL.createObjectURL(
          new Blob([buf], { type: MIME_BY_EXT[meta.ext] || "audio/mpeg" })
        );
        const pathKey = nextPathKey();
        this._scopedPaths.set(pathKey, path);
        track = {
          ...meta,
          pathKey,
          path: null,
          size: 0,
          duration: 0,
          url,
          missing: false,
          placeholder: false,
          source: "disk",
        };
        if (reuse) {
          const keepId = reuse.id;
          if (reuse.url) {
            try { URL.revokeObjectURL(reuse.url); } catch {}
          }
          Object.assign(reuse, track);
          reuse.id = keepId;
          added.push(reuse);
          continue;
        }
      } catch (err) {
        track = {
          ...meta,
          pathKey: null,
          path: null,
          size: 0,
          duration: 0,
          url: null,
          missing: true,
          placeholder: true,
          source: "disk",
        };
        if (reuse) {
          reuse.pathKey = null;
          reuse.path = null;
          reuse.missing = true;
          reuse.placeholder = true;
          added.push(reuse);
          continue;
        }
      }
      this.playlist.push(track);
      added.push(track);
    }
    this.persist();
    this._onState();
    return added;
  }

  async restore() {
    if (this._restoring) return this._restoring;
    this._restoring = this._performRestore();
    try {
      return await this._restoring;
    } finally {
      this._restoring = null;
    }
  }

  async _performRestore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (!Array.isArray(stored)) return;

      // Cleanse any existing URLs before restoring to prevent memory leaks & duplicate rows
      for (const t of this.playlist) {
        if (t.url) {
          try { URL.revokeObjectURL(t.url); } catch {}
        }
      }
      this.playlist = [];

      // Query stored audio records from IndexedDB
      const storedRecords = await getAllMediaBlobs();
      const recordMap = new Map();
      storedRecords.forEach((b) => {
        if (b.id) recordMap.set(b.id, b);
      });

      const seenIds = new Set();
      const seenNames = new Set();

      for (const item of stored) {
        if (!item || typeof item !== "object") continue;
        const trackId = item.id || nextUid();
        const normName = (item.name || "").trim().toLowerCase();

        // Strict deduplication: prevent double entries if previous session had duplicates
        if (seenIds.has(trackId)) continue;
        if (normName && seenNames.has(normName)) continue;

        seenIds.add(trackId);
        if (normName) seenNames.add(normName);

        const scopedKey = item.pathKey || null;
        const resolvedPath = scopedKey ? this._scopedPaths.get(scopedKey) || null : null;

        const track = {
          id: trackId,
          name: item.name || "Untitled",
          ext: item.ext || "",
          mime: item.mime || "audio/mpeg",
          pathKey: scopedKey,
          path: null,
          size: item.size || 0,
          duration: item.duration || 0,
          url: null,
          missing: false,
          placeholder: false,
          source: item.source || (scopedKey ? "disk" : "blob"),
        };

        // 1. Try to restore from IndexedDB (Android / PWA / Web storage)
        const record =
          recordMap.get(trackId) ||
          storedRecords.find(
            (b) => b.name && b.name.trim().toLowerCase() === normName
          );
        const resolvedBlob = record ? recordToBlob(record, track.mime) : null;

        if (resolvedBlob) {
          try {
            track.url = URL.createObjectURL(resolvedBlob);
            track.missing = false;
            track.placeholder = false;
            track.source = "blob";
            if (record.size && !track.size) track.size = record.size;
            if (record.duration && !track.duration) track.duration = record.duration;
          } catch {
            track.missing = true;
            track.placeholder = true;
          }
        } else if (this.isTauri && resolvedPath) {
          try {
            const buf = await this._invoke("read_media", { path: resolvedPath });
            track.url = URL.createObjectURL(
              new Blob([buf], { type: track.mime })
            );
            track.missing = false;
            track.placeholder = false;
          } catch {
            track.missing = true;
            track.placeholder = true;
          }
        } else if (this.isTauri && !resolvedPath) {
          track.missing = true;
          track.placeholder = true;
        } else {
          track.missing = true;
          track.placeholder = true;
        }
        this.playlist.push(track);
      }
      this.persist();
      this._onState();
    } catch (err) {
      console.warn("[MediaPlayer] restore error:", err);
    }
  }

  persist() {
    try {
      const plain = this.playlist.map((t) => ({
        id: t.id,
        name: t.name,
        ext: t.ext,
        mime: t.mime,
        pathKey: t.source === "disk" ? t.pathKey : null,
        size: t.size,
        duration: t.duration,
        source: t.source || "blob",
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plain));
    } catch {
      /* storage full / unavailable */
    }
  }

  remove(id) {
    const idx = this.playlist.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const [removed] = this.playlist.splice(idx, 1);
    if (removed.url) {
      try { URL.revokeObjectURL(removed.url); } catch {}
    }
    deleteMediaBlob(removed.id, removed.name);
    if (this.currentIndex === idx) {
      this.stop();
      this.currentIndex = -1;
    } else if (this.currentIndex > idx) {
      this.currentIndex -= 1;
    }
    this.persist();
    this._onState();
  }

  clear() {
    for (const t of this.playlist) {
      if (t.url) URL.revokeObjectURL(t.url);
    }
    this.stop();
    this.playlist = [];
    this.currentIndex = -1;
    clearMediaDB();
    this.persist();
    this._onState();
  }

  reorder(fromIdx, toIdx) {
    if (
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= this.playlist.length ||
      toIdx >= this.playlist.length ||
      fromIdx === toIdx
    ) {
      return;
    }
    const [moved] = this.playlist.splice(fromIdx, 1);
    this.playlist.splice(toIdx, 0, moved);
    if (this.currentIndex === fromIdx) this.currentIndex = toIdx;
    else if (fromIdx < toIdx && this.currentIndex > fromIdx && this.currentIndex <= toIdx)
      this.currentIndex -= 1;
    else if (toIdx < fromIdx && this.currentIndex >= toIdx && this.currentIndex < fromIdx)
      this.currentIndex += 1;
    this.persist();
    this._onState();
  }

  move(id, dir) {
    const idx = this.playlist.findIndex((t) => t.id === id);
    if (idx < 0) return;
    this.reorder(idx, idx + dir);
  }

  /* ===================== Transport ===================== */

  select(id) {
    const idx = this.playlist.findIndex((t) => t.id === id);
    if (idx >= 0) this.currentIndex = idx;
    this._onState();
  }

  async play(id) {
    this.init();
    if (id !== undefined && id !== null) {
      const idx = this.playlist.findIndex((t) => t.id === id);
      if (idx < 0) return;
      this.currentIndex = idx;
    }
    const track = this.playlist[this.currentIndex];
    if (!track) {
      if (this.playlist.length) {
        this.currentIndex = 0;
        return this.play();
      }
      return;
    }
    if (track.missing || !track.url) return;

    if (!this.audioEl) {
      this.init();
      if (!this.audioEl) return;
    }

    const nextUrl = track.url;
    if (this.audioEl.src !== nextUrl) {
      this._loadedMeta = false;
      this.audioEl.src = nextUrl;
      this.audioEl.load();
    }
    this.audioEl.playbackRate = this.rate;
    this.audioEl.volume = this.volume;

    try {
      await this.audioEl.play();
      this.isPlaying = true;
      this.error = null;
    } catch (err) {
      console.warn("[MediaPlayer] Play failed:", err);
      this.isPlaying = false;
      this.error = err.message || "PLAYBACK ERROR";
    }
    this._updateMediaSession();
    this._onState();
  }

  pause() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.isPlaying = false;
    }
    this._updateMediaSession();
    this._onState();
  }

  stop() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeAttribute("src");
      this.audioEl.load();
      this.isPlaying = false;
      this._loadedMeta = false;
    }
    this._updateMediaSession();
    this._onTime({ currentTime: 0, duration: 0 });
    this._onState();
  }

  toggle() {
    if (this.isPlaying || (this.audioEl && !this.audioEl.paused)) {
      this.pause();
    } else {
      if (this.currentIndex < 0 && this.playlist.length) this.currentIndex = 0;
      this.play();
    }
  }

  next() {
    if (!this.playlist.length) return;
    const idx =
      this.currentIndex < 0
        ? 0
        : (this.currentIndex + 1) % this.playlist.length;
    this.play(this.playlist[idx].id);
  }

  prev() {
    if (!this.playlist.length) return;
    const idx =
      this.currentIndex <= 0
        ? this.playlist.length - 1
        : (this.currentIndex - 1) % this.playlist.length;
    this.play(this.playlist[idx].id);
  }

  seek(time) {
    if (this.audioEl && Number.isFinite(time)) {
      this.audioEl.currentTime = Math.max(0, time);
    }
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.audioEl) this.audioEl.volume = this.volume;
    this._onState();
  }

  setRate(r) {
    this.rate = Math.max(0.25, Math.min(2.0, r));
    if (this.audioEl) this.audioEl.playbackRate = this.rate;
    this._onState();
  }

  setLoop(mode) {
    this.loopMode = mode;
    if (this.audioEl) this.audioEl.loop = mode === "one";
    this._onState();
  }

  get current() {
    return this.currentIndex >= 0 ? this.playlist[this.currentIndex] : null;
  }

  getCurrentTime() {
    return this.audioEl ? this.audioEl.currentTime : 0;
  }

  _handleEnded() {
    if (this.loopMode === "one") {
      this.play(this.current.id);
    } else if (this.loopMode === "all") {
      this.next();
    } else if (this.currentIndex < this.playlist.length - 1) {
      this.next();
    } else {
      this.isPlaying = false;
      this._onState();
    }
  }

  getWaveformData() {
    if (!this.isPlaying) return null;
    const size = 1024;
    const data = new Uint8Array(size);
    const t = this.getCurrentTime() * 12;
    for (let i = 0; i < size; i++) {
      const angle = (i / size) * Math.PI * 8 + t;
      const v = Math.sin(angle) * 0.4 + Math.sin(angle * 2.3 + t * 1.5) * 0.3 + Math.sin(angle * 4.7) * 0.15;
      data[i] = Math.max(0, Math.min(255, Math.floor(128 + v * 90 * this.volume)));
    }
    return data;
  }

  getFrequencyData() {
    if (!this.isPlaying) return null;
    const size = 128;
    const data = new Uint8Array(size);
    const t = this.getCurrentTime() * 8;
    for (let i = 0; i < size; i++) {
      const falloff = Math.exp(-i / 35);
      const beat = (Math.sin(t * 2) * 0.5 + 0.5) * (Math.sin(t * 4 + i * 0.2) * 0.3 + 0.7);
      data[i] = Math.max(0, Math.min(255, Math.floor(falloff * beat * 220 * this.volume)));
    }
    return data;
  }

  async _invoke(name, args) {
    if (!window.__TAURI_INTERNALS__) {
      throw new Error("Tauri IPC unavailable");
    }
    return window.__TAURI_INTERNALS__.invoke(name, args);
  }
}

export const mediaPlayer = new MediaPlayerEngine();

if (typeof window !== "undefined") {
  window.addEventListener("wilsonix:panic", () => {
    mediaPlayer.pause();
  });
}