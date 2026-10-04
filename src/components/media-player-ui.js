import { mediaPlayer } from "../audio/media-player-engine.js";

const SVG_PLAY = `<svg class="media-svg-icon media-svg-play" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5-.86z"/></svg>`;
const SVG_PAUSE = `<svg class="media-svg-icon media-svg-pause" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M7 5a1 1 0 011 1v12a1 1 0 11-2 0V6a1 1 0 011-1zm10 0a1 1 0 011 1v12a1 1 0 11-2 0V6a1 1 0 011-1z"/></svg>`;
const SVG_STOP = `<svg class="media-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
const SVG_PREV = `<svg class="media-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6a1 1 0 012 0v12a1 1 0 11-2 0V6zm4.5 6.75l7.5 5.25a1 1 0 001.5-.82V6.82a1 1 0 00-1.5-.82L10.5 11.25a1 1 0 000 1.5z"/></svg>`;
const SVG_NEXT = `<svg class="media-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18 6a1 1 0 00-2 0v12a1 1 0 102 0V6zm-4.5 6.75L6 18a1 1 0 01-1.5-.82V6.82a1 1 0 011.5-.82l7.5 5.25a1 1 0 010 1.5z"/></svg>`;
const SVG_VOLUME = `<svg class="media-svg-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;

const EXT_META = {
  mp3: { icon: "♪", color: "#f59e0b", label: "MP3" },
  mp2: { icon: "♪", color: "#f59e0b", label: "MP2" },
  wav: { icon: "≋", color: "#22d3ee", label: "WAV" },
  aif: { icon: "≋", color: "#22d3ee", label: "AIFF" },
  aiff: { icon: "≋", color: "#22d3ee", label: "AIFF" },
  flac: { icon: "≈", color: "#34d399", label: "FLAC" },
  ogg: { icon: "≈", color: "#34d399", label: "OGG" },
  oga: { icon: "≈", color: "#34d399", label: "OGG" },
  opus: { icon: "≈", color: "#34d399", label: "OPUS" },
  m4a: { icon: "◆", color: "#a78bfa", label: "M4A" },
  aac: { icon: "◆", color: "#a78bfa", label: "AAC" },
  mp4: { icon: "▶", color: "#fb7185", label: "MP4" },
  m4v: { icon: "▶", color: "#fb7185", label: "M4V" },
  mov: { icon: "▶", color: "#fb7185", label: "MOV" },
  webm: { icon: "▶", color: "#fb7185", label: "WEBM" },
  wma: { icon: "◆", color: "#a78bfa", label: "WMA" },
};

function extMeta(ext) {
  return (
    EXT_META[ext] || {
      icon: "●",
      color: "#9ca3af",
      label: (ext || "?").toUpperCase(),
    }
  );
}

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtSize(bytes) {
  if (!bytes) return "—";
  const mb = bytes / 1048576;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export class MediaPlayerUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.fileInput = null;
    this.dragDepth = 0;
    this._raf = 0;
    this._renderQueue = [];
    this.searchQuery = "";
  }

  render() {
    if (!this.container) return;
    this.mount();
  }

  mount() {
    if (!this.container) return;
    mediaPlayer.init();
    mediaPlayer.setOnState(() => this._refresh());
    mediaPlayer.setOnTime(() => this._drawTransient());

    this.container.innerHTML = `
      <div class="media-console">
        <div class="media-header">
          <div class="media-header-left">
            <span class="media-header-badge">LIVE STAGE PLAYER</span>
            <h2 class="media-station-title">MEDIA DECK</h2>
          </div>
          <div class="media-header-right">
            <button class="media-btn media-btn-primary" id="btn-media-open">
              ${mediaPlayer.isTauri ? "📂 OPEN" : "📂 ADD FILES"}
            </button>
            <button class="media-btn media-btn-danger" id="btn-media-clear">CLEAR</button>
          </div>
        </div>

        <div class="media-body">
          <div class="media-player-panel">
            <div class="media-dropzone" id="media-dropzone">
              <div class="media-drop-inner">
                <span class="media-drop-icon">⬇</span>
                <span class="media-drop-text">DROP AUDIO / VIDEO FILES HERE</span>
                <span class="media-drop-sub">mp3 · wav · flac · m4a · mp4 · ogg · opus + more</span>
              </div>
            </div>

            <div class="media-nowplaying">
              <div class="media-np-top">
                <span class="media-np-tag" id="media-np-ext-badge">—</span>
                <div class="media-np-title-wrap">
                  <span class="media-np-title" id="media-np-title">NO MEDIA LOADED</span>
                  <span class="media-np-sub" id="media-np-sub">Drop files or click ADD FILES</span>
                </div>
                <span class="media-np-status" id="media-np-status"></span>
              </div>

              <canvas class="media-waveform" id="media-wave-canvas" width="900" height="160"></canvas>

              <div class="media-meters">
                <div class="media-meter-ch">
                  <span class="media-meter-lbl">L</span>
                  <div class="media-meter">
                    <div class="media-meter-fill" id="media-meter-l"></div>
                  </div>
                </div>
                <div class="media-meter-ch">
                  <span class="media-meter-lbl">R</span>
                  <div class="media-meter">
                    <div class="media-meter-fill" id="media-meter-r"></div>
                  </div>
                </div>
              </div>

              <div class="media-seek-row">
                <span class="media-time" id="media-time-cur">0:00</span>
                <input type="range" class="media-seek" id="media-seek" min="0" max="1000" value="0" />
                <span class="media-time" id="media-time-total">0:00</span>
              </div>

              <div class="media-transport">
                <div class="media-transport-left">
                  <button class="media-tbtn" id="btn-media-prev" aria-label="Previous" title="Previous">${SVG_PREV}</button>
                  <button class="media-tbtn media-tbtn-play" id="btn-media-play" aria-label="Play / Pause" title="Play / Pause">${SVG_PLAY}</button>
                  <button class="media-tbtn" id="btn-media-stop" aria-label="Stop" title="Stop">${SVG_STOP}</button>
                  <button class="media-tbtn" id="btn-media-next" aria-label="Next" title="Next">${SVG_NEXT}</button>
                </div>
                <div class="media-transport-right">
                  <button class="media-chip" id="btn-media-loop" title="Loop mode">🔁 OFF</button>
                  <select class="media-select" id="media-rate" title="Playback speed">
                    <option value="0.5">0.5×</option>
                    <option value="0.75">0.75×</option>
                    <option value="1" selected>1.0×</option>
                    <option value="1.25">1.25×</option>
                    <option value="1.5">1.5×</option>
                    <option value="2">2.0×</option>
                  </select>
                  <div class="media-vol-wrap">
                    <span class="media-vol-icon">${SVG_VOLUME}</span>
                    <input type="range" class="media-volume" id="media-volume" min="0" max="100" value="100" title="Volume" />
                    <span class="media-vol-text" id="media-vol-text">100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="media-playlist">
            <div class="media-pl-header">
              <span>PLAYLIST</span>
              <span class="media-pl-count" id="media-pl-count">0 TRACKS</span>
            </div>
            <div class="media-pl-tools">
              <button class="media-pl-tool" id="btn-media-move-up" title="Move up" disabled>▲</button>
              <button class="media-pl-tool" id="btn-media-move-down" title="Move down" disabled>▼</button>
            </div>
            <div class="media-pl-search-wrap">
              <input type="text" class="media-pl-search" id="media-pl-search" placeholder="Search tracks..." />
            </div>
            <div class="media-pl-list" id="media-pl-list"></div>
          </div>
        </div>
      </div>
    `;

    this.fileInput = document.createElement("input");
    this.fileInput.type = "file";
    this.fileInput.multiple = true;
    this.fileInput.accept =
      ".mp3,.mp4,.m4a,.m4v,.mov,.wav,.aac,.ogg,.oga,.opus,.flac,.webm,.aiff,.wma,audio/*,video/*";
    this.fileInput.style.display = "none";
    document.body.appendChild(this.fileInput);

    this.canvas = this.container.querySelector("#media-wave-canvas");
    this.ctx2d = this.canvas.getContext("2d");
    this.meterL = this.container.querySelector("#media-meter-l");
    this.meterR = this.container.querySelector("#media-meter-r");

    this._bind();
    this._drawStaticWave();
    // Re-starting the loop must not orphan a previously scheduled rAF chain.
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this._tick());

    mediaPlayer.restore().then(() => {
      this.renderPlaylist();
      const first = mediaPlayer.playlist.find((t) => !t.missing);
      if (first && mediaPlayer.currentIndex < 0) {
        mediaPlayer.select(first.id);
      }
    });
  }

  _bind() {
    this.els = {
      open: this.container.querySelector("#btn-media-open"),
      clear: this.container.querySelector("#btn-media-clear"),
      dropzone: this.container.querySelector("#media-dropzone"),
      play: this.container.querySelector("#btn-media-play"),
      stop: this.container.querySelector("#btn-media-stop"),
      prev: this.container.querySelector("#btn-media-prev"),
      next: this.container.querySelector("#btn-media-next"),
      seek: this.container.querySelector("#media-seek"),
      volume: this.container.querySelector("#media-volume"),
      volText: this.container.querySelector("#media-vol-text"),
      rate: this.container.querySelector("#media-rate"),
      loop: this.container.querySelector("#btn-media-loop"),
      list: this.container.querySelector("#media-pl-list"),
      plCount: this.container.querySelector("#media-pl-count"),
      moveUp: this.container.querySelector("#btn-media-move-up"),
      moveDown: this.container.querySelector("#btn-media-move-down"),
    };

    this.els.moveUp.addEventListener("click", () => {
      const cur = mediaPlayer.current;
      if (cur && mediaPlayer.currentIndex > 0) mediaPlayer.move(cur.id, -1);
    });
    this.els.moveDown.addEventListener("click", () => {
      const cur = mediaPlayer.current;
      if (cur && mediaPlayer.currentIndex < mediaPlayer.playlist.length - 1)
        mediaPlayer.move(cur.id, 1);
    });
    this.els.open.addEventListener("click", () => this._open());
    this.els.clear.addEventListener("click", () => this._clearAll());
    this.els.play.addEventListener("click", () => mediaPlayer.toggle());
    this.els.stop.addEventListener("click", () => mediaPlayer.stop());
    this.els.prev.addEventListener("click", () => mediaPlayer.prev());
    this.els.next.addEventListener("click", () => mediaPlayer.next());
    this.els.volume.addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10);
      mediaPlayer.setVolume(v / 100);
      this.els.volText.textContent = `${v}%`;
    });
    this.els.rate.addEventListener("change", (e) => {
      mediaPlayer.setRate(parseFloat(e.target.value));
    });
    this.els.loop.addEventListener("click", () => {
      const order = ["off", "one", "all"];
      const cur = order.indexOf(mediaPlayer.loopMode);
      mediaPlayer.setLoop(order[(cur + 1) % 3]);
    });
    this.els.search = this.container.querySelector("#media-pl-search");
    if (this.els.search) {
      this.els.search.addEventListener("input", (e) => {
        this.searchQuery = e.target.value;
        this.renderPlaylist();
      });
    }
    this.els.seek.addEventListener("input", (e) => {
      const track = mediaPlayer.current;
      if (!track || !Number.isFinite(track.duration) || track.duration <= 0)
        return;
      const ratio = parseInt(e.target.value, 10) / 1000;
      mediaPlayer.seek(ratio * track.duration);
    });

    const handleFiles = (fileList) => {
      if (!fileList || !fileList.length) return;
      mediaPlayer.addFiles(fileList).then((added) => {
        const pending = this._pendingPick;
        if (pending) {
          this._pendingPick = null;
          const rebound = mediaPlayer.playlist.find(
            (t) => t.id === pending && !t.missing && !t.placeholder,
          );
          if (rebound) {
            mediaPlayer.play(rebound.id);
            return;
          }
        }
        if (added.length && !mediaPlayer.isPlaying && mediaPlayer.currentIndex < 0) {
          this._selectTrack(added[0].id);
        }
      });
    };

    ["dragenter", "dragover"].forEach((ev) => {
      this.els.dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.els.dropzone.classList.add("media-dropzone-over");
      });
    });
    this.els.dropzone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.els.dropzone.classList.remove("media-dropzone-over");
    });
    this.els.dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.els.dropzone.classList.remove("media-dropzone-over");
      if (e.dataTransfer && e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    });

    // Global drop + Space shortcut: bound exactly once. mount() rewrites
    // container HTML, but window/document listeners would stack on every
    // re-render (handleFiles only touches instance state, so the first
    // closure stays valid).
    if (!this._globalEventsBound) {
      this._globalEventsBound = true;
      window.addEventListener("dragover", (e) => e.preventDefault());
      window.addEventListener("drop", (e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files.length) {
          handleFiles(e.dataTransfer.files);
        }
      });

      document.addEventListener("keydown", (e) => {
        if (e.defaultPrevented) return;
        if (e.code === "Space" && e.target === document.body) {
          e.preventDefault();
          mediaPlayer.toggle();
        }
      });
    }
  }

  /* ===================== Internal actions ===================== */

  async _open() {
    if (mediaPlayer.isTauri) {
      try {
        const paths = await mediaPlayer._invoke("pick_media");
        if (paths.length) {
          await mediaPlayer.addPaths(paths);
          if (mediaPlayer.currentIndex < 0) {
            this._selectTrack(
              mediaPlayer.playlist[mediaPlayer.playlist.length - paths.length]
                .id,
            );
          }
        }
      } catch (err) {
        console.error("pick_media failed:", err);
      }
      return;
    }
    this.fileInput.value = "";
    this.fileInput.onchange = async () => {
      if (this.fileInput.files.length) {
        const added = await mediaPlayer.addFiles(this.fileInput.files);
        const pending = this._pendingPick;
        this._pendingPick = null;
        const rebound = pending
          ? mediaPlayer.playlist.find(
              (t) => t.id === pending && !t.missing && !t.placeholder,
            )
          : null;
        if (rebound) {
          mediaPlayer.play(rebound.id);
        } else if (added.length && mediaPlayer.currentIndex < 0) {
          this._selectTrack(added[0].id);
        }
      }
    };
    this.fileInput.click();
  }

  _clearAll() {
    if (!confirm("Clear entire playlist? This cannot be undone.")) return;
    mediaPlayer.clear();
  }

  _selectTrack(id) {
    const track = mediaPlayer.playlist.find((t) => t.id === id);
    if (track && (track.missing || track.placeholder)) {
      this._pendingPick = id;
      this._open();
      return;
    }
    this._pendingPick = null;
    mediaPlayer.play(id);
  }

  /* ===================== Rendering ===================== */

  _refresh() {
    if (!this.els) return;
    this.renderPlaylist();
    this._renderNowPlaying();
    this._drawStaticWave();
  }

  renderPlaylist() {
    const list = this.els.list;
    if (!list) return;
    const tracks = mediaPlayer.playlist;
    const q = this.searchQuery.trim().toLowerCase();
    const visible = q
      ? tracks.filter((t) => t.name.toLowerCase().includes(q))
      : tracks;
    this.els.plCount.textContent = `${tracks.length} TRACK${tracks.length === 1 ? "" : "S"}`;
    this.els.moveUp.disabled = mediaPlayer.currentIndex <= 0;
    this.els.moveDown.disabled =
      mediaPlayer.currentIndex < 0 ||
      mediaPlayer.currentIndex >= tracks.length - 1;

    if (this.els.dropzone) {
      this.els.dropzone.classList.toggle(
        "media-dropzone-compact",
        tracks.length > 0,
      );
    }

    list.innerHTML = "";
    visible.forEach((t) => {
      const meta = extMeta(t.ext);
      const realIdx = mediaPlayer.playlist.indexOf(t);
      const row = document.createElement("div");
      row.className = "media-pl-row";
      if (realIdx === mediaPlayer.currentIndex)
        row.classList.add("media-pl-row-active");
      if (t.missing) row.classList.add("media-pl-row-missing");
      const playing =
        realIdx === mediaPlayer.currentIndex && mediaPlayer.isPlaying;

      const playIconHtml = playing
        ? `<span class="media-pl-eq" title="Playing"><span class="eq-bar b1"></span><span class="eq-bar b2"></span><span class="eq-bar b3"></span></span>`
        : `<span class="media-pl-badge" style="color:${meta.color};border-color:${meta.color}44">${meta.label}</span>`;

      row.innerHTML = `
        <span class="media-pl-idx">${String(realIdx + 1).padStart(2, "0")}</span>
        <div class="media-pl-icon-box">${playIconHtml}</div>
        <div class="media-pl-info">
          <span class="media-pl-name">${this._esc(t.name)}</span>
          <span class="media-pl-meta">${fmtTime(t.duration)} · ${fmtSize(t.size)}</span>
        </div>
        <span class="media-pl-status" title="${t.missing ? (t.placeholder ? "File path is not stored (privacy): re-add this file to play again" : "File not found on disk") : t.source === "session" ? "Session file (re-add after restart in browser)" : "Ready"}">${t.missing ? (t.placeholder ? "↪" : "✕") : "✓"}</span>
        <button class="media-pl-del" data-id="${this._esc(t.id)}" title="Remove">✕</button>
      `;

      row.addEventListener("click", () => this._selectTrack(t.id));

      list.appendChild(row);

      const delBtn = row.querySelector(".media-pl-del");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        mediaPlayer.remove(t.id);
      });

      // Drag reorder
      row.draggable = true;
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", String(realIdx));
        row.classList.add("media-pl-row-dragging");
      });
      row.addEventListener("dragend", () =>
        row.classList.remove("media-pl-row-dragging"),
      );
      row.addEventListener("dragover", (e) => e.preventDefault());
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (Number.isInteger(from) && from !== realIdx) {
          mediaPlayer.reorder(from, realIdx);
        }
      });
    });
  }

  _renderNowPlaying() {
    const track = mediaPlayer.current;
    const title = this.container.querySelector("#media-np-title");
    const sub = this.container.querySelector("#media-np-sub");
    const badge = this.container.querySelector("#media-np-ext-badge");
    const status = this.container.querySelector("#media-np-status");
    if (!track) {
      title.textContent = "NO MEDIA LOADED";
      sub.textContent = "Add files or drop them into the bay";
      badge.textContent = "—";
      status.textContent = "";
      return;
    }
    const meta = extMeta(track.ext);
    title.textContent = track.name;
    sub.textContent = `${meta.label} · ${fmtSize(track.size)} · ${track.source === "disk" ? "DESKTOP FILE" : "SESSION FILE"}`;
    badge.textContent = meta.label;
    badge.style.color = meta.color;
    badge.style.borderColor = meta.color;
    status.className =
      "media-np-status " +
      (mediaPlayer.error
        ? "media-np-status-error"
        : mediaPlayer.stalled
          ? "media-np-status-stalled"
          : track.missing
            ? "media-np-status-missing"
            : mediaPlayer.isPlaying
              ? "media-np-status-playing"
              : "media-np-status-ready");
    status.textContent = mediaPlayer.error
      ? mediaPlayer.error
      : mediaPlayer.stalled
        ? "BUFFERING…"
        : track.missing
          ? track.placeholder
            ? "RE-ADD FILE"
            : "MISSING FILE"
          : mediaPlayer.isPlaying
            ? "PLAYING"
            : "READY";
    this._updatePlayButtonState();
  }

  _updatePlayButtonState() {
    const playBtn = this.els ? this.els.play : null;
    if (!playBtn) return;
    const isPlaying = mediaPlayer && mediaPlayer.isPlaying;
    if (isPlaying) {
      if (!playBtn.classList.contains("media-tbtn-playing") || !playBtn.querySelector(".media-svg-pause")) {
        playBtn.innerHTML = SVG_PAUSE;
        playBtn.classList.add("media-tbtn-playing");
        playBtn.setAttribute("title", "Pause");
        playBtn.setAttribute("aria-label", "Pause");
      }
    } else {
      if (playBtn.classList.contains("media-tbtn-playing") || !playBtn.querySelector(".media-svg-play")) {
        playBtn.innerHTML = SVG_PLAY;
        playBtn.classList.remove("media-tbtn-playing");
        playBtn.setAttribute("title", "Play");
        playBtn.setAttribute("aria-label", "Play");
      }
    }
  }

  _drawStaticWave() {
    if (!this.ctx2d) return;
    const { width, height } = this.canvas;
    const grad = this.ctx2d.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, "rgba(34,211,238,0.5)");
    grad.addColorStop(1, "rgba(245,158,11,0.5)");
    this.ctx2d.clearRect(0, 0, width, height);
    const mid = height / 2;
    this.ctx2d.lineWidth = 2;
    this.ctx2d.strokeStyle = grad;
    this.ctx2d.beginPath();
    const n = 84;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * width;
      const bar = 6 + (Math.abs(Math.sin(i * 0.55) * 16) + (i % 7)) * 1.6;
      const y = mid + Math.sin(i * 0.35 + 1) * bar * 0.5;
      if (i === 0) this.ctx2d.moveTo(x, y);
      else this.ctx2d.lineTo(x, y);
    }
    this.ctx2d.stroke();
  }

  _drawTransient() {
    if (!mediaPlayer.isPlaying) return;
    const data = mediaPlayer.getWaveformData();
    if (!data) return;
    const { width, height } = this.canvas;
    this.ctx2d.clearRect(0, 0, width, height);
    const mid = height / 2;
    this.ctx2d.lineWidth = 2;
    this.ctx2d.strokeStyle = "rgba(34,211,238,0.9)";
    this.ctx2d.beginPath();
    const step = Math.floor(data.length / width) || 1;
    for (let x = 0; x < width; x++) {
      const v = data[x * step] / 128 - 1;
      const y = mid + v * (height * 0.45);
      if (x === 0) this.ctx2d.moveTo(x, y);
      else this.ctx2d.lineTo(x, y);
    }
    this.ctx2d.stroke();
  }

  _tick() {
    if (document.hidden) {
      this._raf = requestAnimationFrame(() => this._tick());
      return;
    }
    const now = performance.now();
    const isPlaying = mediaPlayer && mediaPlayer.isPlaying;
    const interval = isPlaying ? 33.0 : 200.0;

    if (now - (this._lastTick || 0) < interval) {
      this._raf = requestAnimationFrame(() => this._tick());
      return;
    }
    this._lastTick = now;

    // Seek position + time readouts + meters
    const track = mediaPlayer.current;
    const timeCur = this.container.querySelector("#media-time-cur");
    const timeTotal = this.container.querySelector("#media-time-total");
    const seek = this.els.seek;

    if (track && mediaPlayer.audioEl) {
      const ct = mediaPlayer.getCurrentTime();
      const dur = (track.duration > 0)
        ? track.duration
        : (Number.isFinite(mediaPlayer.audioEl.duration) && mediaPlayer.audioEl.duration > 0)
          ? mediaPlayer.audioEl.duration
          : 0;

      if (timeCur) timeCur.textContent = fmtTime(ct);
      if (timeTotal) timeTotal.textContent = fmtTime(dur);
      if (dur > 0 && seek) {
        seek.value = String(
          Math.min(1000, Math.round((ct / dur) * 1000)),
        );
      }
    } else {
      if (timeCur) timeCur.textContent = "0:00";
      if (timeTotal) timeTotal.textContent = "0:00";
    }

    this._updatePlayButtonState();

    // Stereo meter fills with frequency tracking
    if (isPlaying) {
      const freq = mediaPlayer.getFrequencyData();
      if (freq && this.meterL && this.meterR) {
        const avg = (arr, from, to) => {
          let s = 0;
          const count = Math.max(1, to - from);
          for (let i = from; i < to && i < arr.length; i++) s += arr[i];
          return s / count;
        };
        const half = Math.floor(freq.length / 2);
        const lvlL = Math.min(100, Math.round((avg(freq, 0, half) / 255) * 125));
        const lvlR = Math.min(100, Math.round((avg(freq, Math.floor(half / 2), freq.length) / 255) * 125));
        this.meterL.style.width = `${lvlL}%`;
        this.meterR.style.width = `${lvlR}%`;
      }
    } else if (
      this.meterL &&
      this.meterR &&
      (this.meterL.style.width !== "0%" || this.meterR.style.width !== "0%")
    ) {
      this.meterL.style.width = "0%";
      this.meterR.style.width = "0%";
    }

    this._raf = requestAnimationFrame(() => this._tick());
  }

  _esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
}
