/**
 * WILSONIX MIDIKEY Elite - Pro License & 30-Day Trial Modal
 * Displays hardware fingerprint, trial remaining time, activation form, and license status.
 */

import { licenseManager } from "../security/license-manager.js";

const esc = s => String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

export class LicenseModalUI {
  constructor(containerId, onActivationSuccess) {
    this.container = document.getElementById(containerId);
    this.onActivationSuccess = onActivationSuccess;
    this.isOpen = false;
    this.promptReason = null;
    this.render();
    this.bindEvents();

    window.addEventListener("wilsonix-open-license-modal", e => {
      this.open(e.detail?.reason || null);
    });
  }

  render() {
    if (!this.container) return;

    const access = licenseManager.getAccessStatus();
    const devId = licenseManager.deviceFingerprint;

    let statusCardClass = "status-trial";
    let statusTitle = "30-DAY PRO TRIAL ACTIVE";
    let statusDesc = `Full access enabled. <strong>${access.daysRemaining} days remaining</strong> (Expires: ${esc(access.expires || "in 30 days")}).`;

    if (access.isLicensed) {
      statusCardClass = "status-pro";
      statusTitle = "PRO LICENSE ACTIVE";
      statusDesc = `Registered to: <strong>${esc(access.licensee)}</strong> &bull; Access: <strong>${esc(access.expires)}</strong>`;
    } else if (access.isExpired) {
      statusCardClass = "status-expired";
      statusTitle = "FREE MODE (TRIAL EXPIRED)";
      statusDesc = "Basic piano, synths, and split keys remain 100% playable. Pro features (WAV Recording, Custom Rigs, 4-Timbre Combis) require activation.";
    }

    this.container.innerHTML = `
      <div class="license-modal-backdrop ${this.isOpen ? "open" : ""}" id="license-backdrop">
        <div class="license-dialog">
          <div class="dialog-header">
            <div class="dialog-title">
              <div class="dialog-title-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div class="dialog-title-meta">
                <h3>WILSONIX PRO ACTIVATION</h3>
                <span class="dialog-subtitle">Hardware License & Pro Feature Access</span>
              </div>
            </div>
            <button class="dialog-close-btn" id="license-close-btn" aria-label="Close dialog">✕</button>
          </div>

          <div class="dialog-body">
            ${
              this.promptReason
                ? `
              <div class="license-reason-alert">
                <span class="alert-icon">⚠️</span>
                <span>${esc(this.promptReason)}</span>
              </div>
            `
                : ""
            }

            <!-- Hardware ID Card -->
            <div class="license-card hardware-id-card">
              <div class="card-header-row">
                <label>MACHINE HARDWARE FINGERPRINT</label>
                <span class="hw-badge">UNIQUE ID</span>
              </div>
              <div class="fingerprint-box">
                <div class="fingerprint-code-wrap">
                  <span class="fingerprint-prefix">HWID:</span>
                  <code id="hw-fingerprint-val">${esc(devId)}</code>
                </div>
                <button class="copy-hw-btn" id="copy-hw-btn" title="Copy Hardware ID to Clipboard">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span class="copy-text">COPY ID</span>
                </button>
              </div>
              <p class="hw-tip">Give this ID to your administrator to receive an authorized signed license key.</p>
            </div>

            <!-- Access Status Card -->
            <div class="license-card license-status-card ${statusCardClass}">
              <div class="status-indicator-dot"></div>
              <div class="status-meta">
                <div class="status-title-row">
                  <span class="status-title">${statusTitle}</span>
                  <span class="status-tag">${access.isLicensed ? "PRO UNLOCKED" : (access.isExpired ? "FREE MODE" : "30-DAY TRIAL")}</span>
                </div>
                <div class="status-desc">${statusDesc}</div>
              </div>
            </div>

            <!-- Feature Tier Comparison -->
            <div class="license-card license-tier-box">
              <div class="tier-box-title">FEATURE ACCESS COMPARISON</div>
              <div class="tier-grid">
                <div class="tier-col tier-standard">
                  <div class="tier-badge standard-badge">✓ Free / Standard</div>
                  <ul class="tier-feature-list">
                    <li><span class="chk-icon">✓</span> 88-Key Virtual Piano</li>
                    <li><span class="chk-icon">✓</span> Full Synth & Soundbanks</li>
                    <li><span class="chk-icon">✓</span> Split & Octave Controls</li>
                  </ul>
                </div>
                <div class="tier-col tier-pro">
                  <div class="tier-badge pro-badge">★ Pro Unlocked</div>
                  <ul class="tier-feature-list">
                    <li><span class="star-icon">★</span> Lossless WAV Recording</li>
                    <li><span class="star-icon">★</span> Custom Stage Rig Storage</li>
                    <li><span class="star-icon">★</span> 4-Timbre Combi Mixer</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Activation / Deactivation -->
            ${
              !access.isLicensed
                ? `
              <div class="activation-form">
                <div class="form-group">
                  <label for="license-key-input">ENTER YOUR PRO LICENSE KEY</label>
                  <div class="key-input-row">
                    <input type="text" id="license-key-input" placeholder="MKPRO-NAME-LIFETIME-XXXXXXXX" spellcheck="false" autocomplete="off" />
                    <button class="activate-submit-btn" id="activate-submit-btn">ACTIVATE</button>
                  </div>
                  <div class="key-help-hint">Format: <code>MKPRO-&lt;LICENSEE&gt;-&lt;EXPIRY&gt;-&lt;SIGNATURE&gt;</code></div>
                </div>

                <div class="form-group" style="margin-top: 10px;">
                  <label for="activation-code-input">DEVICE ACTIVATION CODE <span class="optional-hint">(only if required)</span></label>
                  <div class="key-input-row">
                    <input type="text" id="activation-code-input" placeholder="MKACT-DEV-XXXXXXXX-..." spellcheck="false" autocomplete="off" />
                  </div>
                  <div class="key-help-hint">If your administrator provided a device code, paste it here. Desktop users typically do not need this.</div>
                </div>

                <div class="activation-msg" id="activation-msg"></div>
              </div>
            `
                : `
              <div class="deactivation-row">
                <button class="deactivate-btn" id="deactivate-btn">DEACTIVATE THIS MACHINE</button>
              </div>
            `
            }
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const backdrop = document.getElementById("license-backdrop");
    const closeBtn = document.getElementById("license-close-btn");
    const copyBtn = document.getElementById("copy-hw-btn");
    const activateBtn = document.getElementById("activate-submit-btn");
    const keyInput = document.getElementById("license-key-input");
    const deactivateBtn = document.getElementById("deactivate-btn");
    const msgEl = document.getElementById("activation-msg");

    closeBtn?.addEventListener("click", () => this.close());
    backdrop?.addEventListener("click", e => {
      if (e.target === backdrop) this.close();
    });

    copyBtn?.addEventListener("click", () => {
      navigator.clipboard.writeText(licenseManager.deviceFingerprint);
      const textSpan = copyBtn.querySelector(".copy-text");
      if (textSpan) {
        textSpan.innerText = "COPIED!";
        setTimeout(() => (textSpan.innerText = "COPY ID"), 2000);
      } else {
        copyBtn.innerText = "COPIED!";
        setTimeout(() => (copyBtn.innerText = "COPY ID"), 2000);
      }
    });

    activateBtn?.addEventListener("click", async () => {
      const key = keyInput?.value?.trim();
      if (!key) {
        if (msgEl) {
          msgEl.className = "activation-msg error";
          msgEl.innerText = "Please enter a license key.";
        }
        return;
      }

      const actCodeInput = document.getElementById("activation-code-input");
      const activationCode = actCodeInput?.value?.trim() || null;

      activateBtn.disabled = true;
      activateBtn.innerText = "VERIFYING...";

      let res;
      try {
        res = await licenseManager.activate(key, activationCode);
      } catch (e) {
        res = { success: false, error: "License validation failed unexpectedly. Please try again." };
      } finally {
        activateBtn.disabled = false;
        activateBtn.innerText = "ACTIVATE";
      }

      if (res.success) {
        if (msgEl) {
          msgEl.className = "activation-msg success";
          msgEl.innerText = "✓ Activation Successful! Welcome to WILSONIX MIDIKEY Pro.";
        }
        setTimeout(() => {
          this.promptReason = null;
          this.render();
          this.bindEvents();
          if (this.onActivationSuccess) this.onActivationSuccess();
        }, 1200);
      } else {
        if (msgEl) {
          msgEl.className = "activation-msg error";
          msgEl.innerText = `✗ ${res.error}`;
        }
      }
    });

    deactivateBtn?.addEventListener("click", () => {
      if (confirm("Are you sure you want to deactivate this machine?")) {
        licenseManager.deactivate();
        this.render();
        this.bindEvents();
        if (this.onActivationSuccess) this.onActivationSuccess();
      }
    });
  }

  open(reason = null) {
    this.isOpen = true;
    this.promptReason = reason;
    this.render();
    this.bindEvents();
  }

  close() {
    this.isOpen = false;
    this.promptReason = null;
    const backdrop = document.getElementById("license-backdrop");
    if (backdrop) backdrop.classList.remove("open");
  }
}
