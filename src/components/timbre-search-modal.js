/**
 * Soundbank & Timbre Search Popup Modal
 *
 * Provides a dedicated, touch-optimized modal dialog for browsing and searching
 * all 180+ PCM multi-samples and Triton VA oscillator programs.
 *
 * Eliminates inline inputs on layer channel strips so Android's virtual keyboard
 * never pops up unexpectedly when playing virtual keyboard keys or touching cards.
 */

import { COMBI_TIMBRES } from "../audio/multi-layer-engine.js";
import { escapeHtml as esc } from "../utils/escape-html.js";

const CATEGORY_TABS = [
  { id: "ALL", label: "ALL" },
  { id: "Acoustic Piano", label: "🎹 Acoustic Piano" },
  { id: "Electric Piano", label: "⚡ Electric Piano" },
  { id: "Organ", label: "🎶 Organ" },
  { id: "Strings", label: "🎻 Strings & Choir" },
  { id: "Brass", label: "🎺 Brass" },
  { id: "Woodwind", label: "🎷 Woodwind / Sax" },
  { id: "Guitar", label: "🎸 Guitar & Bass" },
  { id: "Synth Pad", label: "🌌 Synth Pad" },
  { id: "VA Synth", label: "⚙ VA Synth" },
  { id: "Bells & Mallet", label: "🔔 Bells & Mallets" },
  { id: "Percussion", label: "🥁 Drums & Percussion" },
];

export class TimbreSearchModal {
  constructor() {
    this.isOpen = false;
    this.currentTarget = null; // { layerIndex, zoneKey, currentInst, currentName, onSelect }
    this.searchQuery = "";
    this.activeCategory = "ALL";
    this.container = null;
    this.initDOM();
  }

  initDOM() {
    let existing = document.getElementById("timbre-search-modal-root");
    if (!existing) {
      existing = document.createElement("div");
      existing.id = "timbre-search-modal-root";
      document.body.appendChild(existing);
    }
    this.container = existing;
    this.container.innerHTML = `
      <div class="timbre-modal-backdrop" id="timbre-modal-backdrop">
        <div class="timbre-search-dialog" role="dialog" aria-modal="true">
          <div class="timbre-modal-header">
            <div class="timbre-modal-title-group">
              <h3 class="timbre-modal-title" id="timbre-modal-title">SELECT TIMBRE</h3>
              <span class="timbre-modal-sub" id="timbre-modal-sub">Browse PCM Multi-Samples & VA Synthesizer Voices</span>
            </div>
            <button type="button" class="timbre-modal-close" id="timbre-modal-close" aria-label="Close dialog">✕</button>
          </div>

          <div class="timbre-modal-search-row">
            <div class="timbre-modal-input-wrap">
              <svg class="search-lens-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="timbre-modal-input" class="timbre-modal-search-input"
                     placeholder="Search by preset name, bank, or code..." autocomplete="off" spellcheck="false" />
              <button type="button" class="timbre-modal-clear" id="timbre-modal-clear" style="display:none;" title="Clear search">✕</button>
            </div>
          </div>

          <div class="timbre-category-bar">
            <button type="button" class="timbre-pills-arrow prev" id="timbre-pills-prev" title="Scroll left" aria-label="Previous categories">‹</button>
            <div class="timbre-category-pills" id="timbre-category-pills">
              ${CATEGORY_TABS.map(
                (cat) => `
                <button type="button" class="timbre-cat-chip ${cat.id === "ALL" ? "active" : ""}" data-category="${esc(cat.id)}">
                  ${esc(cat.label)}
                </button>
              `
              ).join("")}
            </div>
            <button type="button" class="timbre-pills-arrow next" id="timbre-pills-next" title="Scroll right" aria-label="Next categories">›</button>
          </div>

          <div class="timbre-modal-meta-row">
            <span class="timbre-count-text" id="timbre-count-text">Showing all sounds</span>
            <span class="timbre-current-badge" id="timbre-current-badge"></span>
          </div>

          <div class="timbre-results-scroll" id="timbre-results-scroll">
            <div class="timbre-results-grid" id="timbre-results-grid"></div>
          </div>
        </div>
      </div>
    `;

    this.backdrop = this.container.querySelector("#timbre-modal-backdrop");
    this.titleEl = this.container.querySelector("#timbre-modal-title");
    this.subEl = this.container.querySelector("#timbre-modal-sub");
    this.inputEl = this.container.querySelector("#timbre-modal-input");
    this.clearBtn = this.container.querySelector("#timbre-modal-clear");
    this.countEl = this.container.querySelector("#timbre-count-text");
    this.badgeEl = this.container.querySelector("#timbre-current-badge");
    this.gridEl = this.container.querySelector("#timbre-results-grid");
    this.scrollEl = this.container.querySelector("#timbre-results-scroll");
    this.pillsContainer = this.container.querySelector("#timbre-category-pills");

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector("#timbre-modal-close")?.addEventListener("click", () => this.close());
    this.backdrop?.addEventListener("click", (e) => {
      if (e.target === this.backdrop) this.close();
    });

    // Category navigation arrows
    const prevBtn = this.container.querySelector("#timbre-pills-prev");
    const nextBtn = this.container.querySelector("#timbre-pills-next");
    prevBtn?.addEventListener("click", () => {
      this.pillsContainer?.scrollBy({ left: -220, behavior: "smooth" });
    });
    nextBtn?.addEventListener("click", () => {
      this.pillsContainer?.scrollBy({ left: 220, behavior: "smooth" });
    });

    // Desktop mouse wheel horizontal scroll
    this.pillsContainer?.addEventListener(
      "wheel",
      (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          this.pillsContainer.scrollLeft += e.deltaY;
        }
      },
      { passive: false }
    );

    // Desktop mouse drag-to-scroll
    let isDragging = false;
    let dragStartX = 0;
    let dragScrollStart = 0;
    let hasDragged = false;

    this.pillsContainer?.addEventListener("mousedown", (e) => {
      isDragging = true;
      hasDragged = false;
      dragStartX = e.pageX - this.pillsContainer.offsetLeft;
      dragScrollStart = this.pillsContainer.scrollLeft;
      this.pillsContainer.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging || !this.pillsContainer) return;
      const x = e.pageX - this.pillsContainer.offsetLeft;
      const walk = x - dragStartX;
      if (Math.abs(walk) > 4) {
        hasDragged = true;
      }
      this.pillsContainer.scrollLeft = dragScrollStart - walk;
    });

    window.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      if (this.pillsContainer) {
        this.pillsContainer.style.cursor = "grab";
      }
    });

    this.clearBtn?.addEventListener("click", () => {
      if (this.inputEl) {
        this.inputEl.value = "";
        this.searchQuery = "";
        this.clearBtn.style.display = "none";
        this.renderResults();
      }
    });

    let debounceTimer = null;
    this.inputEl?.addEventListener("input", (e) => {
      this.searchQuery = (e.target.value || "").trim();
      if (this.clearBtn) {
        this.clearBtn.style.display = this.searchQuery.length > 0 ? "block" : "none";
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.renderResults(), 120);
    });

    this.pillsContainer?.addEventListener("click", (e) => {
      if (hasDragged) return; // Prevent selecting a category when ending a drag scroll
      const chip = e.target.closest(".timbre-cat-chip");
      if (!chip) return;
      const cat = chip.getAttribute("data-category");
      this.activeCategory = cat || "ALL";
      this.pillsContainer.querySelectorAll(".timbre-cat-chip").forEach((c) => {
        c.classList.toggle("active", c === chip);
      });
      this.renderResults();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
    });
  }

  open({ layerIndex, zoneKey, currentInst, currentName, onSelect }) {
    this.isOpen = true;
    this.currentTarget = { layerIndex, zoneKey, currentInst, currentName, onSelect };
    this.searchQuery = "";
    this.activeCategory = "ALL";

    if (this.inputEl) {
      this.inputEl.value = "";
      // On Android/Mobile, do NOT automatically focus to avoid popping the soft keyboard immediately.
      // The user can browse categories and presets visually, and only tap search if desired.
      this.inputEl.blur();
    }
    if (this.clearBtn) this.clearBtn.style.display = "none";

    // Set title
    if (layerIndex !== undefined && layerIndex !== null) {
      this.titleEl.textContent = `SELECT TIMBRE — LAYER ${layerIndex + 1}`;
      this.subEl.textContent = "Select from 180+ studio PCM samples & Triton VA synth voices";
    } else if (zoneKey) {
      this.titleEl.textContent = `SELECT SOUND — ${zoneKey.toUpperCase()} ZONE`;
      this.subEl.textContent = `Assign instrument for the ${zoneKey === "lower" ? "lower keys" : "upper keys"}`;
    }

    if (this.badgeEl) {
      this.badgeEl.textContent = currentName ? `Current: ${currentName}` : "";
    }

    // Reset active category chip
    this.pillsContainer?.querySelectorAll(".timbre-cat-chip").forEach((c) => {
      c.classList.toggle("active", c.getAttribute("data-category") === "ALL");
    });

    this.renderResults();

    this.backdrop?.classList.add("open");
    if (this.scrollEl) this.scrollEl.scrollTop = 0;
  }

  close() {
    this.isOpen = false;
    this.backdrop?.classList.remove("open");
    // Ensure keyboard is dismissed on Android
    if (this.inputEl) this.inputEl.blur();
    if (typeof document !== "undefined" && document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
  }

  renderResults() {
    if (!this.gridEl) return;
    const q = (this.searchQuery || "").toLowerCase();
    const cat = this.activeCategory;
    const currentInst = this.currentTarget?.currentInst;
    const currentName = this.currentTarget?.currentName;
    const isZone = !!this.currentTarget?.zoneKey;

    let filtered = COMBI_TIMBRES.filter((t) => {
      // Category filter
      if (cat !== "ALL") {
        const itemCat = (t.category || "").toLowerCase();
        const tabLower = cat.toLowerCase();
        if (cat === "Guitar" && !(itemCat.includes("guitar") || itemCat.includes("bass"))) return false;
        if (cat === "Percussion" && !(itemCat.includes("percussion") || itemCat.includes("drum") || itemCat.includes("sfx"))) return false;
        if (cat === "Woodwind" && !(itemCat.includes("woodwind") || itemCat.includes("sax") || itemCat.includes("flute"))) return false;
        if (cat === "Strings" && !(itemCat.includes("string") || itemCat.includes("choir") || itemCat.includes("vocal"))) return false;
        if (cat === "VA Synth" && t.kind !== "va") return false;
        if (!["Guitar", "Percussion", "Woodwind", "Strings", "VA Synth"].includes(cat)) {
          if (!itemCat.includes(tabLower)) return false;
        }
      }

      // Query filter
      if (q) {
        const matchesName = t.name && t.name.toLowerCase().includes(q);
        const matchesBank = (t.bank || "").toLowerCase().includes(q);
        const matchesCat = (t.category || "").toLowerCase().includes(q);
        const matchesCode = (t.code || "").toLowerCase().includes(q);
        if (!matchesName && !matchesBank && !matchesCat && !matchesCode) return false;
      }

      return true;
    });

    if (this.countEl) {
      this.countEl.textContent = `Showing ${filtered.length} sound${filtered.length === 1 ? "" : "s"}`;
    }

    let stackCardHtml = "";
    if (isZone) {
      const isStackSelected = !currentInst || currentInst === "current_stack";
      stackCardHtml = `
        <div class="timbre-card special-stack-card ${isStackSelected ? "selected" : ""}" data-val="current_stack" data-name="Follow Current Stack">
          <div class="timbre-card-top">
            <span class="timbre-card-name">▸ Follow Current Stack</span>
            <span class="timbre-kind-badge badge-auto">AUTO</span>
          </div>
          <div class="timbre-card-sub">Plays active combi / single program across zone keys</div>
        </div>
      `;
    }

    if (filtered.length === 0 && !stackCardHtml) {
      this.gridEl.innerHTML = `
        <div class="timbre-empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">No matching sounds found</div>
          <div class="empty-sub">Try searching by instrument name (e.g. Piano, Roads, Brass, Pad) or tap "ALL" to browse all categories.</div>
        </div>
      `;
      return;
    }

    const cardsHtml = filtered
      .map((t) => {
        const isSelected = t.value === currentInst || (currentName && t.name === currentName);
        const isVa = t.kind === "va";
        return `
          <div class="timbre-card ${isSelected ? "selected" : ""}" data-val="${esc(t.value)}" data-name="${esc(t.name)}">
            <div class="timbre-card-top">
              <span class="timbre-card-name" title="${esc(t.name)}">${esc(t.name)}</span>
              <span class="timbre-kind-badge ${isVa ? "badge-va" : "badge-pcm"}">${isVa ? "VA SYNTH" : "PCM"}</span>
            </div>
            <div class="timbre-card-sub">
              <span class="timbre-card-bank">${esc(t.bank)}</span>
              ${t.code ? `<span class="timbre-card-code">${esc(t.code)}</span>` : ""}
              <span class="timbre-card-cat">${esc(t.category || "Workstation")}</span>
              ${isSelected ? `<span class="timbre-selected-check">✓ ACTIVE</span>` : ""}
            </div>
          </div>
        `;
      })
      .join("");

    this.gridEl.innerHTML = stackCardHtml + cardsHtml;

    // Attach click handlers
    this.gridEl.querySelectorAll(".timbre-card").forEach((card) => {
      card.addEventListener("click", () => {
        const val = card.getAttribute("data-val");
        const name = card.getAttribute("data-name");
        if (this.currentTarget?.onSelect) {
          this.currentTarget.onSelect(val, name);
        }
        this.close();
      });
    });
  }
}

export const timbreSearchModal = new TimbreSearchModal();
