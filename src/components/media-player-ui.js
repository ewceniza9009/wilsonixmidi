import { mediaPlayer } from "../audio/media-player-engine.js";

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
  return EXT_META[ext] || { icon: "●", color: "#9ca3af", label: (ext || "?").toUpperCase() };
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
            <span class="media-header-badge">MASTER PLAYBACK</span>
            <h2 class="media-station-title">AUDIO & VIDEO MEDIA DECK</h2>
          </div>
          <div class="media-header-right">
            <button class="media-btn media-btn-primary" id="btn-media-open">
              ${mediaPlayer.isTauri ? "📂 OPEN MEDIA" : "📂 BROWSE FILES"}
            </button>
            <button class="media-btn media-btn-danger" id="btn-media-clear">CLEAR ALL</button>
          </div>
        </div>

        <div class="media-body">
          <!-- LEFT: Player Console -->
          <div class="media-player-panel">
            <div class="media-dropzone" id="media-dropzone">
              <div class="media-drop-inner">
                <span class="media-drop-icon">⬇</span>
                <span class="media-drop-text">DROP AUDIO / VIDEO FILES ANYWHERE IN THIS BAY</span>
                <span class="media-drop-sub">mp3 · mp4 · wav · flac · m4a · ogg · opus · aac · webm + more</span>
              </div>
            </div>

            <div class="media-nowplaying">
              <div class="media-np-top">
                <span class="media-np-tag" id="media-np-ext-badge">—</span>
                <div class="media-np-title-wrap">
                  <span class="media-np-title" id="media-np-title">NO MEDIA LOADED</span>
                  <span class="media-np-sub" id="media-np-sub">Add files or drop them into the bay</span>
                </div>
                <span class="media-np-status" id="media-np-status"></span>
              </div>

              <canvas class="media-waveform" id="media-wave-canvas" width="900" height="120"></canvas>

              <div class="media-meters">
                <div class="media-meter">
                  <div class="media-meter-fill" id="media-meter-l"></div>
                </div>
                <div class="media-meter">
                  <div class="media-meter-fill" id="media-meter-r"></div>
                </div>
              </div>

              <div class="media-seek-row">
                <span class="media-time" id="media-time-cur">0:00</span>
                <input type="range" class="media-seek" id="media-seek" min="0" max="1000" value="0" />
                <span class="media-time" id="media-time-total">0:00</span>
              </div>

              <div class="media-transport">
                <div class="media-transport-left">
                  <button class="media-tbtn" id="btn-media-prev" title="Previous">⏮</button>
                  <button class="media-tbtn media-tbtn-play" id="btn-media-play" title="Play / Pause">▶</button>
                  <button class="media-tbtn" id="btn-media-stop" title="Stop">⏹</button>
                  <button class="media-tbtn" id="btn-media-next" title="Next">⏭</button>
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
                  <input type="range" class="media-volume" id="media-volume" min="0" max="100" value="100" title="Volume" />
                  <span class="media-vol-text" id="media-vol-text">100%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT: Playlist Rail -->
          <div class="media-playlist">
            <div class="media-pl-header">
              <span>PLAYLIST</span>
              <span class="media-pl-count" id="media-pl-count">0 TRACKS</span>
            </div>
            <div class="media-pl-tools">
              <button class="media-pl-tool" id="btn-media-move-up" title="Move up" disabled>▲</button>
              <button class="media-pl-tool" id="btn-media-move-down" title="Move down" disabled>▼</button>
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
    this.els.seek.addEventListener("input", (e) => {
      const track = mediaPlayer.current;
      if (!track || !Number.isFinite(track.duration) || track.duration <= 0) return;
      const ratio = parseInt(e.target.value, 10) / 1000;
      mediaPlayer.seek(ratio * track.duration);
    });

    ["dragenter", "dragover"].forEach((ev) => {
      this.els.dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.els.dropzone.classList.add("media-dropzone-over");
      });
    });
    ["dragleave", "drop"].forEach((ev) => {
      this.els.dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.els.dropzone.classList.remove("media-dropzone-over");
      });
    });
    this.els.dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length) {
        mediaPlayer.addFiles(e.dataTransfer.files);
      }
    });

    // Global drop: graceful anywhere in the bay
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length) {
        mediaPlayer.addFiles(e.dataTransfer.files).then((added) => {
          const pending = this._pendingPick;
          if (pending) {
            this._pendingPick = null;
            const rebound = mediaPlayer.playlist.find(
              (t) => t.id === pending && !t.missing && !t.placeholder
            );
            if (rebound) {
              mediaPlayer.play(rebound.id);
              return;
            }
          }
          if (added.length && !mediaPlayer.isPlaying) {
            this._selectTrack(added[0].id);
          }
        });
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        mediaPlayer.toggle();
      }
    });
  }

  /* ===================== Internal actions ===================== */

  async _open() {
    if (mediaPlayer.isTauri) {
      try {
        const paths = await mediaPlayer._invoke("pick_media");
        if (paths.length) {
          await mediaPlayer.addPaths(paths);
          if (mediaPlayer.currentIndex < 0) {
            this._selectTrack(mediaPlayer.playlist[mediaPlayer.playlist.length - paths.length].id);
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
          ? mediaPlayer.playlist.find((t) => t.id === pending && !t.missing && !t.placeholder)
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
    this.els.plCount.textContent = `${tracks.length} TRACK${tracks.length === 1 ? "" : "S"}`;
    this.els.moveUp.disabled = mediaPlayer.currentIndex <= 0;
    this.els.moveDown.disabled =
      mediaPlayer.currentIndex < 0 || mediaPlayer.currentIndex >= tracks.length - 1;

    list.innerHTML = "";
    tracks.forEach((t, i) => {
      const meta = extMeta(t.ext);
      const row = document.createElement("div");
      row.className = "media-pl-row";
      if (i === mediaPlayer.currentIndex) row.classList.add("media-pl-row-active");
      if (t.missing) row.classList.add("media-pl-row-missing");
      const playing = i === mediaPlayer.currentIndex && mediaPlayer.isPlaying;

      row.innerHTML = `
        <span class="media-pl-idx">${String(i + 1).padStart(2, "0")}</span>
        <span class="media-pl-icon" style="color:${meta.color}">${playing ? "►" : meta.icon}</span>
        <div class="media-pl-info">
          <span class="media-pl-name">${this._esc(t.name)}</span>
          <span class="media-pl-meta">${meta.label} · ${fmtTime(t.duration)} · ${fmtSize(t.size)}</span>
        </div>
        <span class="media-pl-status" title="${t.missing ? (t.placeholder ? "Browser build: re-drop this file to play again" : "File not found on disk") : t.source === "session" ? "Session file (re-add after restart in browser)" : "Saved path"}">${t.missing ? (t.placeholder ? "↪" : "✕") : "✓"}</span>
        <button class="media-pl-del" data-id="${t.id}" title="Remove">✕</button>
      `;

      const idxEl = row.querySelector(".media-pl-idx");
      idxEl.addEventListener("click", () => this._selectTrack(t.id));

      list.appendChild(row);

      const delBtn = row.querySelector(".media-pl-del");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        mediaPlayer.remove(t.id);
      });

      // Drag reorder
      row.draggable = true;
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", String(i));
        row.classList.add("media-pl-row-dragging");
      });
      row.addEventListener("dragend", () => row.classList.remove("media-pl-row-dragging"));
      row.addEventListener("dragover", (e) => e.preventDefault());
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (Number.isInteger(from) && from !== i) {
          mediaPlayer.reorder(from, i);
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
    status.className = "media-np-status " +
      (track.missing ? "media-np-status-missing" : mediaPlayer.isPlaying ? "media-np-status-playing" : "media-np-status-ready");
    status.textContent = track.missing
      ? (track.placeholder ? "RE-ADD FILE" : "MISSING FILE")
      : mediaPlayer.isPlaying
        ? "PLAYING"
        : "READY";
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
    // Seek position + time readouts + meters
    const track = mediaPlayer.current;
    const timeCur = this.container.querySelector("#media-time-cur");
    const timeTotal = this.container.querySelector("#media-time-total");
    const seek = this.els.seek;
    const playBtn = this.els.play;

    if (track && mediaPlayer.audioEl && Number.isFinite(track.duration)) {
      const ct = mediaPlayer.getCurrentTime();
      timeCur.textContent = fmtTime(ct);
      timeTotal.textContent = fmtTime(track.duration);
      if (track.duration > 0) {
        seek.value = String(Math.min(1000, Math.round((ct / track.duration) * 1000)));
      }
      if (playBtn && mediaPlayer.isPlaying) {
        playBtn.textContent = "❚❚";
        playBtn.classList.add("media-tbtn-playing");
      } else if (playBtn) {
        playBtn.textContent = "▶";
        playBtn.classList.remove("media-tbtn-playing");
      }
    } else {
      if (timeCur) timeCur.textContent = "0:00";
      if (timeTotal) timeTotal.textContent = "0:00";
      if (playBtn) {
        playBtn.textContent = mediaPlayer.isPlaying ? "❚❚" : "▶";
      }
    }

    // Meter fills
    const freq = mediaPlayer.getFrequencyData();
    if (freq) {
      const avg = (arr, from, to) => {
        let s = 0;
        const n = Math.max(1, arr.length / 10);
        for (let i = from; i < to && i < arr.length; i++) s += arr[i];
        return s / n;
      };
      const lvl = Math.min(100, avg(freq, 0, freq.length / 2) / 255 * 100);
      this.meterL.style.height = `${lvl}%`;
      this.meterR.style.height = `${lvl}%`;
    }

    this._raf = requestAnimationFrame(() => this._tick());
  }

  _esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
}