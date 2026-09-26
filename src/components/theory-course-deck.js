/**
 * Wilsonix MIDIKey - Music Theory & Pro Keyboardist Crash Course Deck
 * Interactive visual learning studio embedded directly inside the DEMO station tab.
 *
 * Curriculum:
 * Module 1: 🗺️ Keyboard Geography & Finding Middle C
 * Module 2: 🎹 How Chords Form (Major vs Minor Triads & Formulas)
 * Module 3: ✨ The "4 Magic Chords" (Play 100+ Pop Hits Fast)
 * Module 4: 🧠 Inside the Mind of a Pro Keyboardist (Nashville Numbers & Lazy Hand)
 * Module 5: 🎨 Pro Color Chords (Add9, Sus4, Slash Chords)
 * Module 6: ⚡ The Improvisation Cheat Code (Pentatonic Scale)
 */

import { escapeHtml as _escapeHtml } from "../utils/escape-html.js";

export class TheoryCourseDeck {
  /**
   * @param {HTMLElement} container
   * @param {Object} [options]
   */
  constructor(container, options = {}) {
    this.container = container;
    this.engine = options.engine || options.audioEngine || null;
    this.onLaunchExercise = options.onLaunchExercise || null;
    this.activeModule = 1;
    this._highlightTimers = [];

    this.render();
  }

  setModule(modNumber) {
    this.activeModule = Math.max(1, Math.min(12, modNumber));
    this.render();
  }

  playChordPreview(midiNotes, durationMs = 1200) {
    if (!this.engine) return;
    this._clearHighlightTimers();

    midiNotes.forEach((note) => {
      try {
        this.engine.noteOn(note, 90);
        // Highlight keys on virtual keyboard
        const el = document.getElementById(`key-midi-${note}`);
        if (el) el.classList.add("tutor-target-key");
      } catch (e) {}
    });

    const timer = setTimeout(() => {
      midiNotes.forEach((note) => {
        try {
          this.engine.noteOff(note);
          const el = document.getElementById(`key-midi-${note}`);
          if (el) el.classList.remove("tutor-target-key");
        } catch (e) {}
      });
    }, durationMs);

    this._highlightTimers.push(timer);
  }

  highlightKeys(midiNotes, durationMs = 2500) {
    this._clearHighlightTimers();
    if (typeof document === "undefined") return;

    // Remove any existing highlights
    document.querySelectorAll(".tutor-target-key").forEach((el) => el.classList.remove("tutor-target-key"));

    midiNotes.forEach((note) => {
      const el = document.getElementById(`key-midi-${note}`);
      if (el) el.classList.add("tutor-target-key");
    });

    const timer = setTimeout(() => {
      document.querySelectorAll(".tutor-target-key").forEach((el) => el.classList.remove("tutor-target-key"));
    }, durationMs);
    this._highlightTimers.push(timer);
  }

  _clearHighlightTimers() {
    this._highlightTimers.forEach((t) => clearTimeout(t));
    this._highlightTimers = [];
  }

  dispose() {
    this._clearHighlightTimers();
    if (typeof document !== "undefined") {
      document.querySelectorAll(".tutor-target-key").forEach((el) => el.classList.remove("tutor-target-key"));
    }
    this.container = null;
    this.engine = null;
    this.onLaunchExercise = null;
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="theory-course-container" id="theory-course-container">
        <!-- Module Selector Ribbon -->
        <div class="theory-nav-ribbon">
          <button class="theory-module-tab ${this.activeModule === 1 ? "active" : ""}" data-mod="1">
            <span class="mod-icon">🗺️</span>
            <div class="mod-meta">
              <span class="mod-num">MODULE 1</span>
              <span class="mod-title">Keyboard Geography</span>
            </div>
          </button>
          <button class="theory-module-tab ${this.activeModule === 2 ? "active" : ""}" data-mod="2">
            <span class="mod-icon">🎹</span>
            <div class="mod-meta">
              <span class="mod-num">MODULE 2</span>
              <span class="mod-title">How Chords Form</span>
            </div>
          </button>
          <button class="theory-module-tab ${this.activeModule === 3 ? "active" : ""}" data-mod="3">
            <span class="mod-icon">✨</span>
            <div class="mod-meta">
              <span class="mod-num">MODULE 3</span>
              <span class="mod-title">The 4 Magic Chords</span>
            </div>
          </button>
          <button class="theory-module-tab ${this.activeModule === 4 ? "active" : ""}" data-mod="4">
            <span class="mod-icon">🧠</span>
            <div class="mod-meta">
              <span class="mod-num">MODULE 4</span>
              <span class="mod-title">Inside a Pro's Mind</span>
            </div>
          </button>
          <button class="theory-module-tab ${this.activeModule === 5 ? "active" : ""}" data-mod="5">
            <span class="mod-icon">🎨</span>
            <div class="mod-meta">
              <span class="mod-num">MODULE 5</span>
              <span class="mod-title">Pro Color Chords</span>
            </div>
          </button>
          <button class="theory-module-tab ${this.activeModule === 6 ? "active" : ""}" data-mod="6">
            <span class="mod-icon">⚡</span>
            <div class="mod-meta">
              <span class="mod-num">MODULE 6</span>
              <span class="mod-title">Soloing Cheat Code</span>
            </div>
          </button>
          <button class="theory-module-tab ${this.activeModule === 7 ? "active" : ""}" data-mod="7">
            <span class="mod-icon">🎷</span>
            <div class="mod-meta">
              <span class="mod-num">MODULE 7</span>
              <span class="mod-title">2-5-1 Jazz Turnaround</span>
            </div>
          </button>
          <button class="theory-module-tab ${this.activeModule === 8 ? "active" : ""}" data-mod="8">
            <span class="mod-icon">🌊</span>
            <div class="mod-meta">
              <span class="mod-num">MODULE 8</span>
              <span class="mod-title">Left-Hand Ballad Flow</span>
            </div>
          </button>
          <button class="theory-module-tab ${this.activeModule === 9 ? "active" : ""}" data-mod="9">
            <span class="mod-icon">⛪</span>
            <div class="mod-meta">
              <span class="mod-num">MODULE 9</span>
              <span class="mod-title">Gospel Passing Chords</span>
            </div>
          </button>
          <button class="theory-module-tab ${this.activeModule === 10 ? "active" : ""}" data-mod="10">
            <span class="mod-icon">💎</span>
            <div class="mod-meta">
              <span class="mod-num">MODULE 10</span>
              <span class="mod-title">Neo-Soul 9ths & Slurs</span>
            </div>
          </button>
          <button class="theory-module-tab ${this.activeModule === 11 ? "active" : ""}" data-mod="11">
            <span class="mod-icon">🎸</span>
            <div class="mod-meta">
              <span class="mod-num">MODULE 11</span>
              <span class="mod-title">The Blues Scale & Riffs</span>
            </div>
          </button>
          <button class="theory-module-tab ${this.activeModule === 12 ? "active" : ""}" data-mod="12">
            <span class="mod-icon">🏆</span>
            <div class="mod-meta">
              <span class="mod-num">MODULE 12</span>
              <span class="mod-title">Stage Mastery & Climax</span>
            </div>
          </button>
        </div>

        <!-- Active Module Content Viewport -->
        <div class="theory-content-viewport" id="theory-content-viewport">
          ${this._getModuleContentHtml(this.activeModule)}
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // Module tabs
    this.container.querySelectorAll(".theory-module-tab[data-mod]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mod = parseInt(btn.getAttribute("data-mod"), 10);
        if (mod) this.setModule(mod);
      });
    });

    // Audio preview buttons
    this.container.querySelectorAll(".theory-btn-preview").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rawNotes = btn.getAttribute("data-notes");
        if (rawNotes) {
          const notes = rawNotes.split(",").map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
          this.playChordPreview(notes);
        }
      });
    });

    // Highlight keys on piano buttons
    this.container.querySelectorAll(".theory-btn-highlight").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rawNotes = btn.getAttribute("data-notes");
        if (rawNotes) {
          const notes = rawNotes.split(",").map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
          this.highlightKeys(notes);
        }
      });
    });

    // Launch Exercise in Interactive Tutor
    this.container.querySelectorAll(".theory-btn-launch-exercise").forEach((btn) => {
      btn.addEventListener("click", () => {
        const exerciseKey = btn.getAttribute("data-exercise");
        if (exerciseKey && typeof this.onLaunchExercise === "function") {
          this.onLaunchExercise(exerciseKey);
        }
      });
    });
  }

  _getModuleContentHtml(mod) {
    switch (mod) {
      case 1:
        return this._renderModule1();
      case 2:
        return this._renderModule2();
      case 3:
        return this._renderModule3();
      case 4:
        return this._renderModule4();
      case 5:
        return this._renderModule5();
      case 6:
        return this._renderModule6();
      case 7:
        return this._renderModule7();
      case 8:
        return this._renderModule8();
      case 9:
        return this._renderModule9();
      case 10:
        return this._renderModule10();
      case 11:
        return this._renderModule11();
      case 12:
        return this._renderModule12();
      default:
        return this._renderModule1();
    }
  }

  _renderModule1() {
    return `
      <div class="theory-lesson-card">
        <div class="lesson-header">
          <span class="lesson-badge">LESSON 1</span>
          <h2 class="lesson-title">🗺️ Piano Geography: Finding Any Note in 2 Seconds</h2>
          <span class="lesson-subtitle">Stop guessing keys — unlock the landmark pattern every pianist uses</span>
        </div>

        <div class="theory-grid-2col">
          <div class="theory-panel">
            <h3 class="panel-heading">1. The Repeating Pattern of 12 Notes</h3>
            <p class="theory-p">
              The piano keyboard looks intimidating with 88 keys, but here is the secret:
              <strong>it is just 12 notes repeated over and over again!</strong>
            </p>
            <p class="theory-p">
              Look at the black keys. Notice how they alternate in groups of <strong>TWO (2)</strong> and <strong>THREE (3)</strong>:
            </p>
            <div class="pattern-callout-box">
              <span class="callout-tag">THE GOLDEN LANDMARK</span>
              <p>Find ANY group of <strong>2 black keys</strong>. The white key immediately to the left is <strong>ALWAYS C</strong>!</p>
            </div>
            <p class="theory-p">
              From C, the white keys simply follow the alphabet in order:
              <span class="key-sequence-tag">C - D - E - F - G - A - B</span> ...and then it repeats at C again!
            </p>
          </div>

          <div class="theory-panel">
            <h3 class="panel-heading">2. Finding "Middle C" (C4)</h3>
            <p class="theory-p">
              <strong>Middle C (C4)</strong> is home base for both hands. On standard 88-key pianos, it sits right under the brand logo near the center.
            </p>
            <ul class="theory-checklist">
              <li><strong>Right Hand</strong> usually plays notes from Middle C upwards (treble/melody).</li>
              <li><strong>Left Hand</strong> usually plays notes from Middle C downwards (bass/harmony).</li>
            </ul>
            <div class="theory-action-row">
              <button class="theory-action-btn theory-btn-highlight" data-notes="60">
                🎹 SHOW MIDDLE C ON PIANO
              </button>
              <button class="theory-action-btn theory-btn-preview" data-notes="60">
                🔊 LISTEN (C4)
              </button>
            </div>
          </div>
        </div>

        <div class="theory-divider"></div>

        <div class="theory-grid-2col">
          <div class="theory-panel">
            <h3 class="panel-heading">3. The 1 to 5 Hand Numbering System</h3>
            <p class="theory-p">
              Sheet music and tutorials use universal finger numbers so you never tangle your hands:
            </p>
            <div class="finger-legend-grid">
              <div class="finger-pill"><span class="f-num">1</span> Thumb</div>
              <div class="finger-pill"><span class="f-num">2</span> Index</div>
              <div class="finger-pill"><span class="f-num">3</span> Middle</div>
              <div class="finger-pill"><span class="f-num">4</span> Ring</div>
              <div class="finger-pill"><span class="f-num">5</span> Pinky</div>
            </div>
            <p class="theory-hint">Both hands mirror each other: Thumb is always 1, Pinky is always 5.</p>
          </div>

          <div class="theory-panel">
            <h3 class="panel-heading">4. Half-Steps vs Whole-Steps</h3>
            <p class="theory-p">
              <strong>Half-Step (Semitone):</strong> The exact next closest key with zero keys in between (e.g. C to C#, or E to F).
            </p>
            <p class="theory-p">
              <strong>Whole-Step (Tone):</strong> Exactly 2 half-steps (skipping 1 key in between, e.g. C to D, or F to G).
            </p>
            <div class="theory-action-row">
              <button class="theory-exercise-launch-btn theory-btn-launch-exercise" data-exercise="c_scale_intro">
                🎓 PRACTICE LESSON 1 EXERCISE IN TUTOR
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderModule2() {
    return `
      <div class="theory-lesson-card">
        <div class="lesson-header">
          <span class="lesson-badge">LESSON 2</span>
          <h2 class="lesson-title">🎹 How Chords Form: The Universal Triad Formula</h2>
          <span class="lesson-subtitle">Why notes sound happy or sad together — and the 3-step formula to build any chord</span>
        </div>

        <div class="theory-formula-banner">
          <div class="formula-item">
            <span class="formula-label">MAJOR CHORD (HAPPY / BRIGHT)</span>
            <span class="formula-math">ROOT + 4 Half-Steps + 3 Half-Steps</span>
            <span class="formula-desc">1st (Root) • 3rd (Major 3rd) • 5th (Perfect 5th)</span>
          </div>
          <div class="formula-item formula-minor">
            <span class="formula-label">MINOR CHORD (EMOTIONAL / SAD)</span>
            <span class="formula-math">ROOT + 3 Half-Steps + 4 Half-Steps</span>
            <span class="formula-desc">1st (Root) • ♭3rd (Minor 3rd) • 5th (Perfect 5th)</span>
          </div>
        </div>

        <h3 class="section-title">Essential Beginner Chords (Click to Hear & See)</h3>
        <div class="chords-interactive-grid">
          <!-- C Major -->
          <div class="chord-card">
            <div class="chord-card-header">
              <span class="chord-name">C Major</span>
              <span class="chord-type-pill major">MAJOR</span>
            </div>
            <span class="chord-notes-line">C • E • G (60, 64, 67)</span>
            <span class="chord-finger-line">Fingers: 1 (Thumb) - 3 (Mid) - 5 (Pinky)</span>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="60,64,67">🔊 LISTEN</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="60,64,67">🎹 SHOW</button>
            </div>
          </div>

          <!-- G Major -->
          <div class="chord-card">
            <div class="chord-card-header">
              <span class="chord-name">G Major</span>
              <span class="chord-type-pill major">MAJOR</span>
            </div>
            <span class="chord-notes-line">G • B • D (55, 59, 62)</span>
            <span class="chord-finger-line">Fingers: 1 - 3 - 5</span>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="55,59,62">🔊 LISTEN</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="55,59,62">🎹 SHOW</button>
            </div>
          </div>

          <!-- A Minor -->
          <div class="chord-card">
            <div class="chord-card-header">
              <span class="chord-name">A Minor</span>
              <span class="chord-type-pill minor">MINOR</span>
            </div>
            <span class="chord-notes-line">A • C • E (57, 60, 64)</span>
            <span class="chord-finger-line">Fingers: 1 - 3 - 5</span>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="57,60,64">🔊 LISTEN</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="57,60,64">🎹 SHOW</button>
            </div>
          </div>

          <!-- F Major -->
          <div class="chord-card">
            <div class="chord-card-header">
              <span class="chord-name">F Major</span>
              <span class="chord-type-pill major">MAJOR</span>
            </div>
            <span class="chord-notes-line">F • A • C (53, 57, 60)</span>
            <span class="chord-finger-line">Fingers: 1 - 3 - 5</span>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="53,57,60">🔊 LISTEN</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="53,57,60">🎹 SHOW</button>
            </div>
          </div>

          <!-- D Minor -->
          <div class="chord-card">
            <div class="chord-card-header">
              <span class="chord-name">D Minor</span>
              <span class="chord-type-pill minor">MINOR</span>
            </div>
            <span class="chord-notes-line">D • F • A (50, 53, 57)</span>
            <span class="chord-finger-line">Fingers: 1 - 3 - 5</span>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="50,53,57">🔊 LISTEN</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="50,53,57">🎹 SHOW</button>
            </div>
          </div>

          <!-- E Minor -->
          <div class="chord-card">
            <div class="chord-card-header">
              <span class="chord-name">E Minor</span>
              <span class="chord-type-pill minor">MINOR</span>
            </div>
            <span class="chord-notes-line">E • G • B (52, 55, 59)</span>
            <span class="chord-finger-line">Fingers: 1 - 3 - 5</span>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="52,55,59">🔊 LISTEN</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="52,55,59">🎹 SHOW</button>
            </div>
          </div>
        </div>

        <div class="theory-action-row mt-12">
          <button class="theory-exercise-launch-btn theory-btn-launch-exercise" data-exercise="triads_intro">
            🎓 PRACTICE CHORD TRIADS IN TUTOR (WAIT-FOR-KEY MODE)
          </button>
        </div>
      </div>
    `;
  }

  _renderModule3() {
    return `
      <div class="theory-lesson-card">
        <div class="lesson-header">
          <span class="lesson-badge">LESSON 3</span>
          <h2 class="lesson-title">✨ The "4 Magic Chords" (Play 100+ Pop Hits Fast)</h2>
          <span class="lesson-subtitle">The I - V - vi - IV progression that powers 80% of popular music</span>
        </div>

        <div class="magic-progression-banner">
          <div class="prog-step"><span class="step-num">I</span><span class="step-chord">C Major</span><span class="step-desc">Home / Stable</span></div>
          <span class="prog-arrow">→</span>
          <div class="prog-step"><span class="step-num">V</span><span class="step-chord">G Major</span><span class="step-desc">Bright / Dynamic</span></div>
          <span class="prog-arrow">→</span>
          <div class="prog-step"><span class="step-num">vi</span><span class="step-chord">A Minor</span><span class="step-desc">Emotional / Sad</span></div>
          <span class="prog-arrow">→</span>
          <div class="prog-step"><span class="step-num">IV</span><span class="step-chord">F Major</span><span class="step-desc">Lifting / Resolving</span></div>
        </div>

        <div class="theory-grid-2col">
          <div class="theory-panel">
            <h3 class="panel-heading">Iconic Songs Using This Exact Progression:</h3>
            <ul class="famous-songs-list">
              <li><strong>Let It Be</strong> — The Beatles</li>
              <li><strong>Someone Like You</strong> — Adele</li>
              <li><strong>Don't Stop Believin'</strong> — Journey</li>
              <li><strong>With or Without You</strong> — U2</li>
              <li><strong>Perfect</strong> — Ed Sheeran</li>
              <li><strong>Where Is The Love?</strong> — Black Eyed Peas</li>
              <li><strong>Can You Feel The Love Tonight</strong> — Elton John</li>
            </ul>
          </div>

          <div class="theory-panel">
            <h3 class="panel-heading">The Smooth Inversion Shortcut</h3>
            <p class="theory-p">
              Beginners lift their whole hand and jump up and down. That sounds choppy and disjointed.
            </p>
            <p class="theory-p">
              <strong>The Pro Inversion:</strong>
            </p>
            <ul class="theory-checklist">
              <li><strong>C:</strong> C - E - G (Root position)</li>
              <li><strong>G:</strong> B - D - G (1st inversion: move only 2 fingers!)</li>
              <li><strong>Am:</strong> A - C - E (Root position: thumb slides 1 key)</li>
              <li><strong>F:</strong> A - C - F (2nd inversion: pinky slides 1 key)</li>
            </ul>
            <p class="theory-hint">Your hand moves less than 1 inch between all 4 chords!</p>
          </div>
        </div>

        <div class="theory-action-row mt-12">
          <button class="theory-action-btn theory-btn-preview" data-notes="48,60,64,67">
            🔊 PREVIEW 4-CHORD PROGRESSION
          </button>
          <button class="theory-exercise-launch-btn theory-btn-launch-exercise" data-exercise="four_magic_chords">
            🎓 PRACTICE 4 MAGIC CHORDS IN TUTOR (WITH CONNECTED CHORDS)
          </button>
        </div>
      </div>
    `;
  }

  _renderModule4() {
    return `
      <div class="theory-lesson-card">
        <div class="lesson-header">
          <span class="lesson-badge">LESSON 4</span>
          <h2 class="lesson-title">🧠 Inside the Mind of a Pro Keyboardist</h2>
          <span class="lesson-subtitle">How live stage and studio session players think, transpose, and play in the pocket</span>
        </div>

        <div class="pro-mindset-grid">
          <!-- Secret 1 -->
          <div class="pro-mindset-card">
            <div class="mindset-header">
              <span class="mindset-icon">🔢</span>
              <h4 class="mindset-title">1. Think in Numbers, Not Letters</h4>
            </div>
            <p class="mindset-p">
              Pros don't memorize note letters for every song. They think in <strong>Scale Degrees (The Nashville Number System)</strong>:
            </p>
            <div class="nashville-example-box">
              <span>Key of C: 1=C, 2=D, 3=E, 4=F, 5=G, 6=Am, 7=Bdim</span>
            </div>
            <p class="mindset-p">
              If a vocalist says: <em>"Hey, C is too high for my voice, can we do it in G?"</em>
              A beginner panics. A pro simply plays the exact same <strong>1 - 5 - 6 - 4</strong> in the new key of G (<code>G - D - Em - C</code>) with zero hesitation!
            </p>
          </div>

          <!-- Secret 2 -->
          <div class="pro-mindset-card">
            <div class="mindset-header">
              <span class="mindset-icon">🤝</span>
              <h4 class="mindset-title">2. Voice Leading & "The Lazy Hand" Rule</h4>
            </div>
            <p class="mindset-p">
              The golden law of professional piano: <strong>The best chord change is the one where fingers move the shortest physical distance.</strong>
            </p>
            <p class="mindset-p">
              Keep common notes between chords anchored in place, and only move the voices that need to change by a half-step or whole-step. This creates that silky smooth, radio-ready studio connection.
            </p>
          </div>

          <!-- Secret 3 -->
          <div class="pro-mindset-card">
            <div class="mindset-header">
              <span class="mindset-icon">🦶</span>
              <h4 class="mindset-title">3. Pedal Hygiene (Clean vs Muddy Sound)</h4>
            </div>
            <p class="mindset-p">
              The #1 mistake beginners make: holding the sustain pedal down the entire song. This blurs multiple chords together into a harsh, muddy wash.
            </p>
            <div class="pedal-rule-box">
              <strong>THE PRO RULE:</strong> Lift and immediately re-press the pedal on the <em>exact instant</em> you strike each new chord! Clear the air before the next chord rings.
            </div>
          </div>

          <!-- Secret 4 -->
          <div class="pro-mindset-card">
            <div class="mindset-header">
              <span class="mindset-icon">🥁</span>
              <h4 class="mindset-title">4. Comping & "The Pocket" (Stay Off the Bass)</h4>
            </div>
            <p class="mindset-p">
              When playing with a band or backing track:
            </p>
            <ul class="theory-checklist">
              <li><strong>Do NOT play heavy low chords with your left hand!</strong> That is the bass player's frequency space. Low chords clash and muddy the mix.</li>
              <li>Play light single bass root notes or octaves in your left hand.</li>
              <li>Keep chord rhythms locked to the snare and hi-hat. <em>Less is more!</em></li>
            </ul>
          </div>
        </div>

        <div class="theory-action-row mt-12">
          <button class="theory-exercise-launch-btn theory-btn-launch-exercise" data-exercise="nashville_numbers">
            🎓 PRACTICE NUMBER SYSTEM PROGRESSIONS IN TUTOR
          </button>
        </div>
      </div>
    `;
  }

  _renderModule5() {
    return `
      <div class="theory-lesson-card">
        <div class="lesson-header">
          <span class="lesson-badge">LESSON 5</span>
          <h2 class="lesson-title">🎨 Pro Color Chords: The Modern Studio Sound</h2>
          <span class="lesson-subtitle">How to transform basic plain triads into lush, emotional cinematic masterpieces</span>
        </div>

        <div class="theory-grid-3col">
          <!-- Add9 -->
          <div class="color-chord-card">
            <div class="color-header">
              <span class="color-badge add9">THE "ADD9" SECRET</span>
              <h4 class="color-title">C(add9)</h4>
            </div>
            <p class="color-p">
              Take a plain C chord (<code>C - E - G</code>) and slip in the <strong>2nd note (D)</strong>:
            </p>
            <span class="color-notes">C • D • E • G (48, 60, 62, 64, 67)</span>
            <p class="color-desc">
              Instantly sounds like modern Ed Sheeran, Coldplay, and John Legend. Rich, warm, and singing!
            </p>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="48,60,62,64,67">🔊 LISTEN C(add9)</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="48,60,62,64,67">🎹 SHOW</button>
            </div>
          </div>

          <!-- Sus4 -->
          <div class="color-chord-card">
            <div class="color-header">
              <span class="color-badge sus4">TENSION & RELEASE</span>
              <h4 class="color-title">Csus4 → C</h4>
            </div>
            <p class="color-p">
              Replace the 3rd (E) with the <strong>4th (F)</strong>: <code>C - F - G</code>.
            </p>
            <span class="color-notes">C • F • G → C • E • G</span>
            <p class="color-desc">
              The F creates delicious musical tension that begs to resolve back down to E. Used in thousands of dramatic song intros!
            </p>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="48,60,65,67">🔊 LISTEN Csus4</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="48,60,65,67">🎹 SHOW</button>
            </div>
          </div>

          <!-- Slash Chords -->
          <div class="color-chord-card">
            <div class="color-header">
              <span class="color-badge slash">WALKING BASS</span>
              <h4 class="color-title">C/E & G/B</h4>
            </div>
            <p class="color-p">
              A <strong>Slash Chord</strong> means: Right Hand plays the chord, Left Hand plays the bass note after the slash!
            </p>
            <span class="color-notes">C/E = C chord over E bass</span>
            <p class="color-desc">
              Enables smooth step-by-step moving basslines: <code>C → G/B → Am → C/E → F</code> without jumping!
            </p>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="40,60,64,67">🔊 LISTEN C/E</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="40,60,64,67">🎹 SHOW</button>
            </div>
          </div>
        </div>

        <div class="theory-action-row mt-12">
          <button class="theory-exercise-launch-btn theory-btn-launch-exercise" data-exercise="color_chords_ballad">
            🎓 PRACTICE COLOR CHORDS IN TUTOR (WAIT-FOR-KEY MODE)
          </button>
        </div>
      </div>
    `;
  }

  _renderModule6() {
    return `
      <div class="theory-lesson-card">
        <div class="lesson-header">
          <span class="lesson-badge">LESSON 6</span>
          <h2 class="lesson-title">⚡ The Improvisation Cheat Code (The Pentatonic Scale)</h2>
          <span class="lesson-subtitle">5 magical notes that NEVER sound wrong over a song — instant piano soloing</span>
        </div>

        <div class="pentatonic-formula-box">
          <span class="penta-title">THE MAJOR PENTATONIC FORMULA: 1 - 2 - 3 - 5 - 6</span>
          <div class="penta-notes-display">
            <span class="penta-note">C</span>
            <span class="penta-note">D</span>
            <span class="penta-note">E</span>
            <span class="penta-note">G</span>
            <span class="penta-note">A</span>
          </div>
          <p class="penta-why">
            <strong>Why it works:</strong> The pentatonic scale deliberately removes the 4th (F) and 7th (B) notes — the only two notes in the major scale that can clash dissonantly.
            <strong>You can press ANY of these 5 notes in ANY order, and they will sound melodious and clean!</strong>
          </p>
        </div>

        <div class="theory-grid-2col">
          <div class="theory-panel">
            <h3 class="panel-heading">Pro Riff Techniques to Try:</h3>
            <ul class="theory-checklist">
              <li><strong>The 2-Note Half-Step Slide:</strong> Slide your middle finger from D# (black key) onto E (white key) right before striking G! Instant blues/gospel flavor.</li>
              <li><strong>The Octave Call & Response:</strong> Play a low C-D-E motif, then answer it an octave higher.</li>
              <li><strong>The Rolling Wave:</strong> Step up C-D-E-G and step back down G-E-D-C with gentle pedal.</li>
            </ul>
            <div class="theory-action-row">
              <button class="theory-action-btn theory-btn-preview" data-notes="60,62,64,67,69">
                🔊 LISTEN PENTATONIC RUN
              </button>
              <button class="theory-action-btn theory-btn-highlight" data-notes="60,62,64,67,69">
                🎹 SHOW ON PIANO
              </button>
            </div>
          </div>

          <div class="theory-panel">
            <h3 class="panel-heading">Your Practice Blueprint</h3>
            <p class="theory-p">
              1. Keep your Left Hand holding a simple C or Am bass note with the pedal.
            </p>
            <p class="theory-p">
              2. With your Right Hand, freely explore C, D, E, G, and A. Try short 3-note phrases, leave a pause to breathe, and repeat.
            </p>
            <div class="theory-action-row">
              <button class="theory-exercise-launch-btn theory-btn-launch-exercise" data-exercise="pentatonic_solo_jam">
                🎓 LAUNCH PENTATONIC SOLO JAM IN TUTOR
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderModule7() {
    return `
      <div class="theory-lesson-card">
        <div class="lesson-header">
          <span class="lesson-badge">LESSON 7</span>
          <h2 class="lesson-title">🎷 The 2 - 5 - 1 Turnaround (Jazz, R&B & Soul Foundation)</h2>
          <span class="lesson-subtitle">The gold standard progression powering jazz, neo-soul, R&B, and gospel music</span>
        </div>

        <div class="theory-formula-banner">
          <span class="formula-label">THE 2 - 5 - 1 CHORD MOVEMENT IN C:</span>
          <div class="formula-math">
            <span class="f-part">ii (Dm7)</span>
            <span class="f-op">➔</span>
            <span class="f-part">V (G7 / G9)</span>
            <span class="f-op">➔</span>
            <span class="f-part">I (Cmaj7 / Cmaj9)</span>
          </div>
        </div>

        <div class="theory-grid-3col">
          <div class="theory-chord-card">
            <div class="chord-card-top">
              <span class="chord-title">1. Dm7 (ii Chord)</span>
              <span class="chord-badge">TENSION PREP</span>
            </div>
            <p class="chord-formula">D bass + F - A - C</p>
            <span class="color-notes">Notes: D3 | F4 - A4 - C5</span>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="50,65,69,72">🔊 LISTEN</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="50,65,69,72">🎹 SHOW</button>
            </div>
          </div>

          <div class="theory-chord-card">
            <div class="chord-card-top">
              <span class="chord-title">2. G7 (V Chord)</span>
              <span class="chord-badge">MAX TENSION</span>
            </div>
            <p class="chord-formula">G bass + F - B - D</p>
            <span class="color-notes">Notes: G2 | F4 - B4 - D5</span>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="43,65,71,74">🔊 LISTEN</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="43,65,71,74">🎹 SHOW</button>
            </div>
          </div>

          <div class="theory-chord-card">
            <div class="chord-card-top">
              <span class="chord-title">3. Cmaj7 (I Chord)</span>
              <span class="chord-badge">LUSH HOME</span>
            </div>
            <p class="chord-formula">C bass + E - G - B</p>
            <span class="color-notes">Notes: C3 | E4 - G4 - B4</span>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="48,64,67,71">🔊 LISTEN</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="48,64,67,71">🎹 SHOW</button>
            </div>
          </div>
        </div>

        <div class="theory-panel mt-12">
          <h3 class="panel-heading">The Smooth Voice Leading Secret:</h3>
          <p class="theory-p">
            Look at what happens between Dm7 (F-A-C) and G7 (F-B-D): <strong>F stays anchored in place</strong> while A moves up one half-step to B, and C moves up a whole step to D! Your hand glides like silk.
          </p>
        </div>

        <div class="theory-action-row mt-12">
          <button class="theory-exercise-launch-btn theory-btn-launch-exercise" data-exercise="two_five_one_turnaround">
            🎓 PRACTICE 2-5-1 TURNAROUND IN TUTOR
          </button>
        </div>
      </div>
    `;
  }

  _renderModule8() {
    return `
      <div class="theory-lesson-card">
        <div class="lesson-header">
          <span class="lesson-badge">LESSON 8</span>
          <h2 class="lesson-title">🌊 Left-Hand Independence & Ballad Comping Flow</h2>
          <span class="lesson-subtitle">Unlock rich, wide accompaniment patterns without muddying low frequencies</span>
        </div>

        <div class="theory-formula-banner">
          <span class="formula-label">THE 1 - 5 - 10 OPEN ARPEGGIO SECRET:</span>
          <div class="formula-math">
            <span class="f-part">Root (1)</span>
            <span class="f-op">➔</span>
            <span class="f-part">Fifth (5)</span>
            <span class="f-op">➔</span>
            <span class="f-part">Tenth (3rd + 8va)</span>
          </div>
        </div>

        <div class="theory-grid-2col">
          <div class="theory-panel">
            <h3 class="panel-heading">Why Beginners Sound Muddy vs Pro Clarity:</h3>
            <p class="theory-p">
              <strong>The Low-Interval Limit Rule:</strong> Never play closed 3rds or triads below C3 (middle C is C4). Acoustic piano strings below C3 generate heavy harmonic overtones that clash into acoustic mud.
            </p>
            <p class="theory-p">
              Pros keep the left hand <strong>open and wide</strong>: Play 1 (Root), 5 (Fifth), and 10 (the 3rd played one octave higher, e.g. C2 - G2 - E3). It fills the room with warm concert grandeur!
            </p>
            <div class="theory-action-row">
              <button class="theory-action-btn theory-btn-preview" data-notes="36,43,52">
                🔊 LISTEN 1-5-10 ARPEGGIO
              </button>
              <button class="theory-action-btn theory-btn-highlight" data-notes="36,43,52">
                🎹 SHOW ON PIANO
              </button>
            </div>
          </div>

          <div class="theory-panel">
            <h3 class="panel-heading">3 Comping Styles Every Keyboardist Needs:</h3>
            <ul class="theory-checklist">
              <li><strong>The Ballad Roll:</strong> Gently roll 1-5-10 with pedal while right hand provides melody.</li>
              <li><strong>The Pop Quarter-Note Pulse:</strong> Solid octaves on beats 1 and 3, right hand strikes syncopated 8th notes.</li>
              <li><strong>The Offbeat Pocket:</strong> Wait for the drummer's snare on 2 and 4 to drop syncopated stabs.</li>
            </ul>
            <div class="theory-action-row">
              <button class="theory-exercise-launch-btn theory-btn-launch-exercise" data-exercise="ballad_arpeggio_comp">
                🎓 PRACTICE 1-5-10 BALLAD COMPING IN TUTOR
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderModule9() {
    return `
      <div class="theory-lesson-card">
        <div class="lesson-header">
          <span class="lesson-badge">LESSON 9</span>
          <h2 class="lesson-title">⛪ Gospel Passing Chords & Diminished 7ths</h2>
          <span class="lesson-subtitle">How pros effortlessly connect distant chords using chromatic tension</span>
        </div>

        <div class="theory-formula-banner">
          <span class="formula-label">THE CHROMATIC PASSING FORMULA (C to Dm):</span>
          <div class="formula-math">
            <span class="f-part">C Major (I)</span>
            <span class="f-op">➔</span>
            <span class="f-part" style="color:#f59e0b">C#dim7 (Passing)</span>
            <span class="f-op">➔</span>
            <span class="f-part">Dm7 (ii)</span>
          </div>
        </div>

        <div class="theory-grid-2col">
          <div class="theory-panel">
            <h3 class="panel-heading">The Diminished 7th Magic:</h3>
            <p class="theory-p">
              Whenever you want to transition between two chords separated by a whole step (like C to Dm, or F to Gm), insert a <strong>diminished 7th chord built on the half-step between them</strong>.
            </p>
            <p class="theory-p">
              C#dim7 (C# - E - G - Bb) contains intense tension that practically pulls your fingers right into Dm7 with deep emotional weight!
            </p>
            <div class="theory-action-row">
              <button class="theory-action-btn theory-btn-preview" data-notes="49,58,61,64,67">
                🔊 LISTEN C#dim7
              </button>
              <button class="theory-action-btn theory-btn-highlight" data-notes="49,58,61,64,67">
                🎹 SHOW C#dim7
              </button>
            </div>
          </div>

          <div class="theory-panel">
            <h3 class="panel-heading">Secondary Dominants (V of V):</h3>
            <p class="theory-p">
              Before resolving to any target chord, play its own Dominant 7th chord!
              Example: Before moving to G (V), play <strong>D7 (F# - A - C - D)</strong>. The listener anticipates the landing note instinctively.
            </p>
            <div class="theory-action-row">
              <button class="theory-exercise-launch-btn theory-btn-launch-exercise" data-exercise="gospel_passing_chords">
                🎓 PRACTICE GOSPEL PASSING CHORDS IN TUTOR
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderModule10() {
    return `
      <div class="theory-lesson-card">
        <div class="lesson-header">
          <span class="lesson-badge">LESSON 10</span>
          <h2 class="lesson-title">💎 Modern R&B / Neo-Soul 9ths & Grace Note Slurs</h2>
          <span class="lesson-subtitle">Capture the smooth harmonic warmth of D'Angelo, Erykah Badu & Robert Glasper</span>
        </div>

        <div class="theory-grid-2col">
          <div class="theory-chord-card">
            <div class="chord-card-top">
              <span class="chord-title">Dm9 (Minor 9th)</span>
              <span class="chord-badge">ULTRA-SMOOTH</span>
            </div>
            <p class="chord-formula">D bass + C - E - F - A</p>
            <span class="color-notes">Notes: D3 | C4 - E4 - F4 - A4</span>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="50,60,64,65,69">🔊 LISTEN Dm9</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="50,60,64,65,69">🎹 SHOW</button>
            </div>
          </div>

          <div class="theory-chord-card">
            <div class="chord-card-top">
              <span class="chord-title">Cmaj9 (Major 9th)</span>
              <span class="chord-badge">ETHEREAL GLOW</span>
            </div>
            <p class="chord-formula">C bass + B - D - E - G</p>
            <span class="color-notes">Notes: C3 | B3 - D4 - E4 - G4</span>
            <div class="chord-btn-group">
              <button class="chord-mini-btn theory-btn-preview" data-notes="48,59,62,64,67">🔊 LISTEN Cmaj9</button>
              <button class="chord-mini-btn theory-btn-highlight" data-notes="48,59,62,64,67">🎹 SHOW</button>
            </div>
          </div>
        </div>

        <div class="theory-panel mt-12">
          <h3 class="panel-heading">The Signature Soul Grace-Note "Crush":</h3>
          <p class="theory-p">
            On electric piano, quickly slide finger 2 off the black Eb key onto the white E natural key while holding C and G. That momentary half-step slur is the unmistakable DNA of vintage soul and funk.
          </p>
          <div class="theory-action-row">
            <button class="theory-exercise-launch-btn theory-btn-launch-exercise" data-exercise="neo_soul_extensions">
              🎓 PRACTICE NEO-SOUL 9THS IN TUTOR
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderModule11() {
    return `
      <div class="theory-lesson-card">
        <div class="lesson-header">
          <span class="lesson-badge">LESSON 11</span>
          <h2 class="lesson-title">🎸 The Blues Scale & Expressive Blues Licks</h2>
          <span class="lesson-subtitle">The 6-note scale with the gritty "Blue Note" for rock, funk, blues & gospel soloing</span>
        </div>

        <div class="pentatonic-formula-box">
          <span class="penta-title">THE C BLUES SCALE FORMULA: 1 - b3 - 4 - b5 - 5 - b7</span>
          <div class="penta-notes-display blues-notes-display">
            <div class="penta-note-item">
              <span class="penta-note">C</span>
              <span class="penta-degree">1 (Root)</span>
            </div>
            <div class="penta-note-item">
              <span class="penta-note">Eb</span>
              <span class="penta-degree">b3</span>
            </div>
            <div class="penta-note-item">
              <span class="penta-note">F</span>
              <span class="penta-degree">4</span>
            </div>
            <div class="penta-note-item blue-note-item">
              <span class="penta-note penta-blue-note">F#</span>
              <span class="penta-note-sub">★ BLUE NOTE (b5)</span>
            </div>
            <div class="penta-note-item">
              <span class="penta-note">G</span>
              <span class="penta-degree">5</span>
            </div>
            <div class="penta-note-item">
              <span class="penta-note">Bb</span>
              <span class="penta-degree">b7</span>
            </div>
          </div>
          <p class="penta-why">
            <strong>The Blue Note Secret (F# / Gb):</strong> The flatted fifth (F#) is the tritone — the tension note. Don't sit on it for long: <strong>slur quickly from F# into G!</strong>
          </p>
        </div>

        <div class="theory-grid-2col">
          <div class="theory-panel">
            <h3 class="panel-heading">Blues Solos in Action:</h3>
            <p class="theory-p">
              Blues soloing is about <strong>Call and Response</strong>. Play a quick, expressive 3-note riff, pause and leave room for the beat, then answer yourself with a descending resolution to the root note C.
            </p>
            <div class="theory-action-row">
              <button class="theory-action-btn theory-btn-preview" data-notes="60,63,65,66,67,70,72">
                🔊 LISTEN BLUES SCALE
              </button>
              <button class="theory-action-btn theory-btn-highlight" data-notes="60,63,65,66,67,70,72">
                🎹 SHOW ON PIANO
              </button>
            </div>
          </div>

          <div class="theory-panel">
            <h3 class="panel-heading">Interactive Practice</h3>
            <p class="theory-p">
              Strike and hold the low C octave with your left hand, then run through the blues scale with the tutor guiding your fingers.
            </p>
            <div class="theory-action-row">
              <button class="theory-exercise-launch-btn theory-btn-launch-exercise" data-exercise="blues_scale_groove">
                🎓 LAUNCH BLUES SCALE GROOVE IN TUTOR
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderModule12() {
    return `
      <div class="theory-lesson-card">
        <div class="lesson-header">
          <span class="lesson-badge">LESSON 12</span>
          <h2 class="lesson-title">🏆 Live Stage Mastery: Key Changes & The Art of Less</h2>
          <span class="lesson-subtitle">Essential live performance wisdom, split layers, and explosive final chorus modulations</span>
        </div>

        <div class="theory-formula-banner">
          <span class="formula-label">THE FINAL CHORUS KEY MODULATION (+1 SEMITONE):</span>
          <div class="formula-math">
            <span class="f-part">Verse in C Maj</span>
            <span class="f-op">➔</span>
            <span class="f-part" style="color:#00e5ff">Pivot on Ab7</span>
            <span class="f-op">➔</span>
            <span class="f-part" style="color:#10b981; font-weight:800;">Explode in Db Maj!</span>
          </div>
        </div>

        <div class="theory-grid-2col">
          <div class="theory-panel">
            <h3 class="panel-heading">The "Truck Driver's" Modulation Hack:</h3>
            <p class="theory-p">
              In stadium pop and ballads, lifting the final chorus up a half-step (+1 semitone, from C to Db) or whole-step (+2 semitones, C to D) injects immense energy.
            </p>
            <p class="theory-p">
              <strong>The Pivot Dominant:</strong> To enter Db smoothly, hit the V7 of Db — which is <strong>Ab7 (Ab - C - Eb - Gb)</strong> — right before dropping the big Db chord on beat 1!
            </p>
            <div class="theory-action-row">
              <button class="theory-action-btn theory-btn-preview" data-notes="44,56,60,63,66">
                🔊 LISTEN Ab7 PIVOT
              </button>
              <button class="theory-action-btn theory-btn-preview" data-notes="49,61,65,68">
                🔊 LISTEN Db MAJ CLIMAX
              </button>
            </div>
          </div>

          <div class="theory-panel">
            <h3 class="panel-heading">The 3 Golden Rules of a Pro Stage Player:</h3>
            <ul class="theory-checklist">
              <li><strong>The Rule of Less:</strong> Never play with all 10 fingers at once. Leave sonic space for the vocalist and guitar solo.</li>
              <li><strong>Lock with the Snare:</strong> Sync your rhythmic stabs strictly with the drummer's backbeat (beats 2 & 4).</li>
              <li><strong>Split-Zone Discipline:</strong> When splitting bass in your left hand, play single notes with authority — don't overplay chords down low.</li>
            </ul>
            <div class="theory-action-row">
              <button class="theory-exercise-launch-btn theory-btn-launch-exercise" data-exercise="epic_final_chorus_mod">
                🎓 PRACTICE STAGE CLIMAX MODULATION IN TUTOR
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

export const THEORY_MODULES = [
  {
    id: "mod1",
    num: 1,
    title: "Keyboard Geography & Finding Middle C",
    intro: "Understand the 2-and-3 black key pattern, navigate all 88 keys, assign proper 1-5 fingering, and master semitones vs tones.",
    html: "",
  },
  {
    id: "mod2",
    num: 2,
    title: "How Chords Form: Triad Formulas",
    intro: "Learn the universal chord formula: Root + 3rd + 5th. Major (Happy) vs Minor (Moody) triads explained simply.",
    html: "",
  },
  {
    id: "mod3",
    num: 3,
    title: "The 4 Magic Chords",
    intro: "Unlock the I-V-vi-IV (C-G-Am-F) progression that powers over 100+ global billboard hits.",
    html: "",
  },
  {
    id: "mod4",
    num: 4,
    title: "Inside the Mind of a Pro Keyboardist",
    intro: "Nashville Number System, Voice Leading, the Lazy Hand rule, pedal hygiene, and comping in the pocket.",
    html: "",
  },
  {
    id: "mod5",
    num: 5,
    title: "Pro Color Chords (Add9, Sus4, Slash Chords)",
    intro: "Transform plain campfire chords into lush, modern studio sounds with Add9, Sus4, and Slash chords.",
    html: "",
  },
  {
    id: "mod6",
    num: 6,
    title: "The Improvisation Cheat Code (Pentatonic Scale)",
    intro: "Solo freely over any song without hitting a single wrong note using the Pentatonic scale.",
    html: "",
  },
  {
    id: "mod7",
    num: 7,
    title: "The 2-5-1 Jazz & Neo-Soul Turnaround",
    intro: "Master the iconic ii-V-I progression that forms the musical backbone of jazz, R&B, and gospel.",
    html: "",
  },
  {
    id: "mod8",
    num: 8,
    title: "Left-Hand Independence & Ballad Flow",
    intro: "The 1-5-10 broken arpeggio technique, frequency management, and pop pocket comping.",
    html: "",
  },
  {
    id: "mod9",
    num: 9,
    title: "Gospel Passing Chords & Diminished 7ths",
    intro: "Glide between distant chords with chromatic diminished passing chords and secondary dominants.",
    html: "",
  },
  {
    id: "mod10",
    num: 10,
    title: "Modern R&B / Neo-Soul 9ths & Grace Slurs",
    intro: "Capture the rich harmonic warmth of D'Angelo and Robert Glasper with lush 9ths and hammer-on slurs.",
    html: "",
  },
  {
    id: "mod11",
    num: 11,
    title: "The Blues Scale & Expressive Riffs",
    intro: "The 6-note formula, the gritty Blue Note, crushed grace notes, and call-and-response blues solos.",
    html: "",
  },
  {
    id: "mod12",
    num: 12,
    title: "Live Stage Mastery: Modulations & The Art of Less",
    intro: "The truck-driver key modulation lift, split layer performance, and pro live gig discipline.",
    html: "",
  },
];

const _deckInstance = new TheoryCourseDeck(null);
THEORY_MODULES[0].html = _deckInstance._renderModule1();
THEORY_MODULES[1].html = _deckInstance._renderModule2();
THEORY_MODULES[2].html = _deckInstance._renderModule3();
THEORY_MODULES[3].html = _deckInstance._renderModule4();
THEORY_MODULES[4].html = _deckInstance._renderModule5();
THEORY_MODULES[5].html = _deckInstance._renderModule6();
THEORY_MODULES[6].html = _deckInstance._renderModule7();
THEORY_MODULES[7].html = _deckInstance._renderModule8();
THEORY_MODULES[8].html = _deckInstance._renderModule9();
THEORY_MODULES[9].html = _deckInstance._renderModule10();
THEORY_MODULES[10].html = _deckInstance._renderModule11();
THEORY_MODULES[11].html = _deckInstance._renderModule12();


