/**
 * WILSONIX MIDIKEY Elite - Android Performance Logger
 * Monitors memory, CPU frame time, audio latency, and crash clues.
 * Android-first: uses performance.memory where available, provider-based decoded RAM,
 * and frame timing for CPU spikes. Desktop fallback uses same metrics.
 */

import { getMemoryStats } from "../audio/memory-manager.js";
import { audioCore } from "../audio/audio-core.js";
import { getDeviceConfig } from "../audio/device-capabilities.js";
import { synthEngine } from "../audio/synth-engine.js";
import { multiLayerEngine } from "../audio/multi-layer-engine.js";

const LOG_MAX_ROWS = 500;
const SAMPLE_INTERVAL_MS = 1000;
const PRUNE_INTERVAL_MS = 20 * 60 * 1000; // auto-clean non-critical logs every 20 min

export class LoggerUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.logs = [];
    this._rafId = null;
    this._lastFrame = performance.now();
    this._frameTimes = [];
    this._samples = [];
    this._isRunning = false;
    this._interval = null;
    this.deviceConfig = getDeviceConfig();
    this._loadCrashLog();
    this.render();
    this.bind();
    this.start();
  }

  // Loads crash details persisted SYNCHRONOUSLY by the global error reporter
  // (localStorage "wilsonix_crash_log"). Survives WebView kills — so on the
  // next app open the previous session's errors appear here with full
  // context (timestamp, heap MB, active sound).
  _loadCrashLog() {
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem("wilsonix_crash_log")) || [];
    } catch (e) {}
    if (Array.isArray(saved) && saved.length > 0) {
      for (const c of saved.slice(-50).reverse()) {
        this.logs.push({
          ts: c.ts || "—",
          message:
            `CRASH (prev session): ${c.msg}` +
            (c.heap ? ` | heap ${c.heap}MB` : "") +
            (c.sound ? ` | sound ${c.sound}` : ""),
          level: "error",
        });
      }
      this._hadPrevCrash = true;
    }
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <style>
        .logger-console{background:#0b0e14;color:#e5e7eb;padding:12px;border-radius:12px;font-family:system-ui;height:100%;display:flex;flex-direction:column;gap:10px}
        .logger-header{display:flex;justify-content:space-between;align-items:center}
        .logger-badge{background:#ff764d;color:#000;padding:4px 8px;border-radius:6px;font-weight:800;font-size:12px}
        .logger-meta span{margin-right:10px;font-size:12px;color:#94a3b8}
        .logger-btn{background:#1f2937;border:1px solid #374151;color:#e5e7eb;padding:4px 8px;border-radius:6px;margin-left:6px}
        .logger-log{border:1px solid #1f2937;border-radius:8px;background:#0f172a;display:flex;flex-direction:column;min-height:0;flex:1}
        .logger-log-head{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#111827;font-size:12px;color:#94a3b8}
        .logger-search{flex:1;max-width:220px;background:#0b0e14;border:1px solid #374151;color:#e5e7eb;padding:6px 10px;border-radius:6px;font-size:12px;outline:none;transition:border-color .15s}
        .logger-search::placeholder{color:#64748b}
        .logger-search:focus{border-color:#ff764d;box-shadow:0 0 0 2px rgba(255,118,77,.15)}
        .logger-log-body{overflow:auto;flex:1}
        .logger-row{display:flex;flex-direction:column;gap:4px;padding:6px 10px;font-size:12px;border-bottom:1px solid #1a2333;cursor:pointer}
        .logger-row:hover{background:#111827}
        .logger-row-details{font-size:10px;color:#94a3b8;white-space:pre-wrap;max-height:0;overflow:hidden;transition:max-height .2s ease}
        .logger-row-details.open{max-height:200px;margin-top:4px}
        .logger-ts{color:#64748b;min-width:70px}
        .logger-info{color:#22d3ee}
        .logger-warn{color:#f59e0b}
        .logger-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px}
        .stat-card{background:#111827;border:1px solid #1f2937;padding:6px;border-radius:6px;text-align:center}
        .stat-label{font-size:9px;color:#94a3b8;text-transform:uppercase}
        .stat-value{font-size:16px;font-weight:800;color:#fff;margin:2px 0}
        .stat-sub{font-size:9px;color:#64748b}
        .logger-chart{height:100px;overflow:hidden;margin-top:4px}
        .logger-chart canvas{width:100%;height:100px}
        .logger-modal{position:fixed;inset:0;background:rgba(0,0,0,.7);display:none;align-items:center;justify-content:center;z-index:9999}
        .logger-modal.open{display:flex}
        .logger-modal-content{background:#0b0e14;border:1px solid #374151;color:#e5e7eb;padding:16px;border-radius:8px;max-width:90vw;max-height:80vh;overflow:auto;position:relative}
        .logger-modal-close{position:absolute;top:8px;right:12px;cursor:pointer;font-size:20px}
      </style>
      <div class="logger-console">
        <div class="logger-header">
          <span class="logger-badge">PERFORMANCE LOGGER</span>
          <div class="logger-meta">
            ${this._hadPrevCrash ? `<span class="logger-badge" style="background:#f87171;color:#000;" title="Errors from the previous session — click CLEAR after review">⚠ PREV CRASH</span>` : ""}
            <span id="logger-device">${this.deviceConfig.isAndroid ? "ANDROID" : this.deviceConfig.isMobile ? "MOBILE" : "DESKTOP"}</span>
            <span id="logger-tier">${this.deviceConfig.tier.toUpperCase()}</span>
            <button id="logger-copy" class="logger-btn">COPY</button>
            <button id="logger-clear" class="logger-btn">CLEAR</button>
            <button id="logger-export" class="logger-btn">EXPORT</button>
            <button id="logger-pause" class="logger-btn">PAUSE</button>
          </div>
        </div>

        <div class="logger-log">
          <div class="logger-log-head">
            <span>EVENTS</span>
            <input id="logger-search" class="logger-search" placeholder="Search..." />
            <span id="logger-count">0</span>
          </div>
          <div class="logger-log-body" id="logger-body"></div>
        </div>

        <div class="logger-stats">
          <div class="stat-card">
            <div class="stat-label">JS HEAP</div>
            <div class="stat-value" id="stat-heap">—</div>
            <div class="stat-sub" id="stat-heap-sub">used / limit</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">DECODED RAM</div>
            <div class="stat-value" id="stat-decoded">—</div>
            <div class="stat-sub">PCM buffers</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">AUDIO LATENCY</div>
            <div class="stat-value" id="stat-latency">—</div>
            <div class="stat-sub">round-trip ms</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">FRAME TIME</div>
            <div class="stat-value" id="stat-frame">—</div>
            <div class="stat-sub">avg / max ms</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">FPS</div>
            <div class="stat-value" id="stat-fps">—</div>
            <div class="stat-sub">real-time</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">SPikes</div>
            <div class="stat-value" id="stat-spikes">0</div>
            <div class="stat-sub">>50ms frames</div>
          </div>
        </div>

        <div class="logger-chart">
          <canvas id="logger-canvas" width="1200" height="100"></canvas>
        </div>

        <div id="logger-modal" class="logger-modal">
          <div class="logger-modal-content">
            <span class="logger-modal-close">&times;</span>
            <pre id="logger-modal-body"></pre>
          </div>
        </div>
      </div>
    `;
  }

  bind() {
    this.container.querySelector("#logger-copy")?.addEventListener("click", () => this.copyLogs());
    this.container.querySelector("#logger-clear")?.addEventListener("click", () => {
      this.logs = [];
      this._samples = [];
      try { localStorage.removeItem("wilsonix_crash_log"); } catch (e) {}
      const badge = this.container.querySelector(".logger-badge[style*='f87171']");
      if (badge) badge.remove();
      this._renderLog();
    });
    this.container.querySelector("#logger-export")?.addEventListener("click", () => this.exportLogs());
    this.container.querySelector("#logger-pause")?.addEventListener("click", (e) => {
      this._isRunning = !this._isRunning;
      e.target.textContent = this._isRunning ? "PAUSE" : "RESUME";
      if (this._isRunning) this.start();
      else this.stop();
    });
    const search = this.container.querySelector("#logger-search");
    if (search) {
      search.addEventListener("input", (e) => {
        this._searchTerm = e.target.value.toLowerCase();
        this._renderLog();
      });
    }
    const body = document.getElementById("logger-body");
    if (body) {
      body.addEventListener("click", (e) => {
        const row = e.target.closest(".logger-row");
        if (!row) return;
        const idx = Number(row.dataset.idx);
        const entry = this.logs[idx];
        if (!entry) return;
        const modal = document.getElementById("logger-modal");
        const modalBody = document.getElementById("logger-modal-body");
        if (modal && modalBody) {
          modalBody.textContent = `[${entry.ts}] ${entry.level.toUpperCase()}\n\n${entry.message}`;
          modal.classList.add("open");
        }
      });
    }
    const modal = document.getElementById("logger-modal");
    const modalClose = document.querySelector(".logger-modal-close");
    if (modalClose) {
      modalClose.addEventListener("click", () => modal?.classList.remove("open"));
    }
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("open");
      });
    }
  }

  start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this._lastFrame = performance.now();
    this._frameLoop();
    this._interval = setInterval(() => this.sample(), SAMPLE_INTERVAL_MS);
    if (!this._pruneTimer) {
      this._pruneTimer = setInterval(() => this._pruneOldLogs(), PRUNE_INTERVAL_MS);
    }
    this._setupLongTaskObserver();
    this.log("Logger started", "info");
  }

  stop() {
    this._isRunning = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._interval) clearInterval(this._interval);
    if (this._pruneTimer) {
      clearInterval(this._pruneTimer);
      this._pruneTimer = null;
    }
    if (this._longTaskObserver) {
      this._longTaskObserver.disconnect();
      this._longTaskObserver = null;
    }
    this.log("Logger paused", "warn");
  }

  _setupLongTaskObserver() {
    if (!('PerformanceObserver' in window)) return;
    try {
      this._longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const mem = getMemoryStats();
          const heap = mem.usedMB ?? '—';
          this.log(`Long task ${entry.duration.toFixed(1)}ms @ ${entry.startTime.toFixed(1)}ms | heap ${heap}MB`, "warn");
        }
      });
      this._longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch(e) {}
  }

  _frameLoop() {
    if (!this._isRunning) return;
    const now = performance.now();
    const dt = now - this._lastFrame;
    this._lastFrame = now;
    this._frameTimes.push(dt);
    if (this._frameTimes.length > 60) this._frameTimes.shift();

    // Spike detection with context
    if (dt > 50) {
      const mem = getMemoryStats();
      const latency = audioCore.measureLatency?.() || {};
      const heap = mem.usedMB ?? '—';
      const lat = latency.measuredMs ?? latency.reportedMs ?? '—';
      let soundInfo = '—';
      let voiceInfo = '—';
      let suggestion = '';
      try {
        const soundId = synthEngine?.getActiveSoundId?.() || multiLayerEngine?.layers?.[0]?.inst || '—';
        soundInfo = soundId;
        const activeVoices = synthEngine?.getActiveVoiceCount?.() ?? multiLayerEngine?.getActiveVoiceCount?.() ?? '—';
        voiceInfo = activeVoices;
        if (voiceInfo > 32) suggestion = 'High polyphony';
        else if (heap > 150) suggestion = 'Memory pressure';
        else if (lat > 30) suggestion = 'Audio buffer underrun risk';
        else suggestion = 'Long frame task';
      } catch(e){}
      const stackSnippet = (new Error().stack?.split('\n').slice(2,5).join(' | ') || '—');
      this.log(`CPU spike ${dt.toFixed(1)}ms | heap ${heap}MB | latency ${lat}ms | fps ${(1000/dt).toFixed(0)} | sound ${soundInfo} | voices ${voiceInfo} | why ${suggestion} | stack ${stackSnippet}`, "warn");
    }

    this._updateFrameStats();
    this._rafId = requestAnimationFrame(() => this._frameLoop());
  }

  _updateFrameStats() {
    if (this._frameTimes.length === 0) return;
    const avg = this._frameTimes.reduce((a,b)=>a+b,0)/this._frameTimes.length;
    const max = Math.max(...this._frameTimes);
    const fps = 1000 / avg;
    const spikes = this._frameTimes.filter(t=>t>50).length;

    document.getElementById("stat-frame").textContent = `${avg.toFixed(1)} / ${max.toFixed(1)}`;
    document.getElementById("stat-fps").textContent = fps.toFixed(0);
    document.getElementById("stat-spikes").textContent = spikes;
  }

  sample() {
    if (!this._isRunning) return;
    const mem = getMemoryStats();
    const latency = audioCore.measureLatency?.() || {};
    const heapUsed = mem.usedMB ?? 0;
    const heapLimit = mem.limitMB ?? 0;

    // Decoded RAM estimate via window.__memoryManager? Fall back to provider usage.
    let decodedMB = "—";
    try {
      const provider = window.__midikeyMemoryProvider?.();
      if (provider && provider.bytes) decodedMB = Math.round(provider.bytes/1024/1024);
    } catch(e){}
    // fallback: try to read from sampleCache? skip.

    const latencyMs = latency.measuredMs ?? latency.reportedMs ?? 0;
    const sample = {
      t: Date.now(),
      heapUsed,
      heapLimit,
      decodedMB,
      latencyMs
    };
    // Detect memory spike
    if (this._samples.length > 0) {
      const prev = this._samples[this._samples.length - 1];
      if (heapUsed - (prev.heapUsed || 0) > 20) {
        let soundInfo = '—';
        let why = 'Heap growth';
        try { soundInfo = synthEngine?.getActiveSoundId?.() || multiLayerEngine?.layers?.[0]?.inst || '—'; } catch(e){}
        if (decodedMB !== '—' && typeof decodedMB === 'number' && decodedMB > 80) why = 'Large decoded samples';
        else why = 'Allocation burst';
        this.log(`Memory spike +${(heapUsed - prev.heapUsed).toFixed(0)}MB → ${heapUsed}MB | decoded ${decodedMB}MB | sound ${soundInfo} | why ${why}`, "warn");
      }
      if (latencyMs && prev.latencyMs && (latencyMs - prev.latencyMs) > 10) {
        this.log(`Audio latency jump +${(latencyMs - prev.latencyMs).toFixed(1)}ms → ${latencyMs.toFixed(1)}ms | why buffer pressure`, "warn");
      }
    }
    this._samples.push(sample);
    if (this._samples.length > 200) this._samples.shift();

    document.getElementById("stat-heap").textContent = `${heapUsed} MB`;
    document.getElementById("stat-heap-sub").textContent = heapLimit ? `/${heapLimit} MB` : "";
    document.getElementById("stat-decoded").textContent = typeof decodedMB === "number" ? `${decodedMB} MB` : decodedMB;
    document.getElementById("stat-latency").textContent = latencyMs ? `${latencyMs.toFixed(1)}` : "—";

    this._drawChart();
  }

  _drawChart() {
    const canvas = document.getElementById("logger-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0,0,w,h);

    // background
    ctx.fillStyle = "#0b0e14";
    ctx.fillRect(0,0,w,h);

    if (this._samples.length < 2) return;

    const maxHeap = Math.max(...this._samples.map(s=>s.heapUsed), 1);
    const maxLat = Math.max(...this._samples.map(s=>s.latencyMs), 1);

    ctx.lineWidth = 2;
    // heap line
    ctx.strokeStyle = "#ff764d";
    ctx.beginPath();
    this._samples.forEach((s,i)=>{
      const x = (i/(this._samples.length-1))*w;
      const y = h - (s.heapUsed/maxHeap)*h*0.7 - 20;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    // latency line
    ctx.strokeStyle = "#22d3ee";
    ctx.beginPath();
    this._samples.forEach((s,i)=>{
      const x = (i/(this._samples.length-1))*w;
      const y = h - (s.latencyMs/maxLat)*h*0.7 - 20;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  }

  // Auto-clean every 20 minutes: removes info/warn noise but PRESERVES all
  // critical error/crash entries (and the persisted localStorage crash log,
  // which is only wiped by the CLEAR button).
  _pruneOldLogs() {
    this.logs = this.logs.filter((l) => l.level === "error");
    this._renderLog();
    this.log("Log auto-cleaned (20 min) — crash/error entries preserved", "info");
  }

  log(message, level="info") {
    const ts = new Date().toLocaleTimeString();
    const entry = { ts, message, level };
    this.logs.unshift(entry);
    if (this.logs.length > LOG_MAX_ROWS) this.logs.pop();
    this._renderLog();
  }

  _renderLog() {
    const body = document.getElementById("logger-body");
    if (!body) return;
    const term = (this._searchTerm || "").toLowerCase();
    const filtered = term ? this.logs.filter(l => l.message.toLowerCase().includes(term) || l.level.toLowerCase().includes(term) || l.ts.toLowerCase().includes(term)) : this.logs;
    body.innerHTML = filtered.map((l)=>`
      <div class="logger-row logger-${l.level}" data-idx="${this.logs.indexOf(l)}">
        <span class="logger-ts">${l.ts}</span>
        <span class="logger-msg">${this.escapeHtml(l.message)}</span>
      </div>
    `).join("");
    document.getElementById("logger-count").textContent = filtered.length;
  }

  escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  copyLogs() {
    const text = this.logs.map(l => `[${l.ts}] ${l.level.toUpperCase()} ${l.message}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      this.log("Logs copied to clipboard", "info");
    }).catch(() => {
      this.log("Copy failed", "warn");
    });
  }

  exportLogs() {
    const data = {
      device: this.deviceConfig,
      samples: this._samples,
      logs: this.logs
    };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `midikey-logger-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.log("Logs exported", "info");
  }
}
