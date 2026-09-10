import { audioCore } from "./audio-core.js";

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
  }

  init() {
    if (this.audioEl) return;
    audioCore.ensureRunning();
    this.audioEl = new Audio();
    this.audioEl.preload = "metadata";
    this.audioEl.crossOrigin = "anonymous";
    this.audioEl.addEventListener("loadedmetadata", () => {
      this._loadedMeta = true;
      const trk = this.playlist[this.currentIndex];
      if (trk && Number.isFinite(this.audioEl.duration)) {
        trk.duration = this.audioEl.duration;
      }
      this.persist();
      this._onState();
    });
    this.audioEl.addEventListener("timeupdate", () => {
      this._onTime({
        currentTime: this.audioEl.currentTime,
        duration: this._loadedMeta ? this.audioEl.duration : 0,
      });
    });
    this.audioEl.addEventListener("ended", () => this._handleEnded());
    this.audioEl.volume = this.volume;
    this.audioEl.playbackRate = this.rate;

    this.mediaSource = undefined;
    this.gainNode = audioCore.ctx.createGain();
    this.gainNode.gain.value = this.volume;
    this.analyser = audioCore.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;
  }

  setOnState(cb) {
    this._onState = cb;
  }

  setOnTime(cb) {
    this._onTime = cb;
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
      // Web mode: if a persisted placeholder with the same filename exists,
      // rebind it in-place (same slot, same id) instead of adding a duplicate.
      const reuse = this.playlist.find(
        (t) => t.missing && t.placeholder && t.name.toLowerCase() === file.name.toLowerCase()
      );
      if (reuse) {
        reuse.url = url;
        reuse.mime = meta.mime;
        reuse.ext = meta.ext;
        reuse.size = file.size || 0;
        reuse.duration = 0;
        reuse.missing = false;
        reuse.placeholder = false;
        reuse.source = "session";
        added.push(reuse);
        continue;
      }
      const track = {
        ...meta,
        path: null,
        size: file.size || 0,
        duration: 0,
        url,
        missing: false,
        placeholder: false,
        source: "session",
      };
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
      const lowerName = name.toLowerCase();
      // Rebind a missing/placeholder entry with the same filename in-place
      const reuse = this.playlist.find(
        (t) =>
          t.name.toLowerCase() === lowerName &&
          (t.missing || t.placeholder)
      );
      let track = null;
      try {
        const buf = await this._invoke("read_media", { path });
        const url = URL.createObjectURL(
          new Blob([buf], { type: MIME_BY_EXT[meta.ext] || "audio/mpeg" })
        );
        track = {
          ...meta,
          path,
          size: 0,
          duration: 0,
          url,
          missing: false,
          source: "disk",
        };
        if (reuse) {
          const keepId = reuse.id;
          Object.assign(reuse, track);
          reuse.id = keepId;
          added.push(reuse);
          continue;
        }
      } catch (err) {
        track = {
          ...meta,
          path,
          size: 0,
          duration: 0,
          url: null,
          missing: true,
          source: "disk",
        };
        if (reuse) {
          reuse.path = path;
          reuse.missing = true;
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (!Array.isArray(stored)) return;
      for (const item of stored) {
        const track = {
          id: nextUid(),
          name: item.name || "Untitled",
          ext: item.ext || "",
          mime: item.mime || "audio/mpeg",
          path: item.path || null,
          size: item.size || 0,
          duration: item.duration || 0,
          url: null,
          missing: false,
          placeholder: false,
          source: item.path ? "disk" : "placeholder",
        };
        if (this.isTauri && item.path) {
          try {
            const buf = await this._invoke("read_media", { path: item.path });
            track.url = URL.createObjectURL(
              new Blob([buf], { type: track.mime })
            );
          } catch {
            track.missing = true;
          }
        } else if (this.isTauri && !item.path) {
          track.missing = true;
        } else {
          // Browser / PWA: absolute paths cannot be reopened by a web app.
          // Keep the row as a placeholder so the user can re-drop the file.
          track.missing = true;
          track.placeholder = true;
        }
        this.playlist.push(track);
      }
      this.persist();
      this._onState();
    } catch {
      /* corrupted storage — ignore */
    }
  }

  persist() {
    try {
      const plain = this.playlist.map((t) => ({
        name: t.name,
        ext: t.ext,
        mime: t.mime,
        path: t.source === "disk" ? t.path : null,
        size: t.size,
        duration: t.duration,
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
    if (removed.url) URL.revokeObjectURL(removed.url);
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
    const nextUrl = track.url;
    if (this.audioEl.src !== nextUrl) {
      this._loadedMeta = false;
      this.audioEl.src = nextUrl;
      this.audioEl.load();
    }
    await audioCore.ensureRunning();
    if (!this.mediaSource) this._buildGraph();
    this.audioEl.playbackRate = this.rate;
    this.audioEl.volume = this.volume;
    try {
      await this.audioEl.play();
      this.isPlaying = true;
    } catch {
      this.isPlaying = false;
    }
    this._onState();
  }

  pause() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.isPlaying = false;
    }
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
    if (this.gainNode) this.gainNode.gain.value = this.volume * 0.85;
    this._onState();
  }

  setRate(r) {
    this.rate = r;
    if (this.audioEl) this.audioEl.playbackRate = r;
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

  _buildGraph() {
    const ctx = audioCore.ctx;
    this.mediaSource = ctx.createMediaElementSource(this.audioEl);
    this.mediaSource.connect(this.gainNode);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;
    this.gainNode.connect(this.analyser);
    this.analyser.connect(audioCore.fxRack.input);
  }

  getWaveformData() {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  getFrequencyData() {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
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