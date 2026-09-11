/**
 * WILSONIX MIDIKEY Elite - Pro License & 30-Day Trial Modal
 * Displays hardware fingerprint, trial remaining time, activation form, and license status.
 */

import { licenseManager } from "../security/license-manager.js";

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
    let statusDesc = `Full access enabled. <strong>${access.daysRemaining} days remaining</strong> (Expires: ${access.expires || "in 30 days"}).`;

    if (access.isLicensed) {
      statusCardClass = "status-pro";
      statusTitle = "PRO LICENSE ACTIVE";
      statusDesc = `Registered to: <strong>${access.licensee}</strong> &bull; Access: <strong>${access.expires}</strong>`;
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
              <span class="lock-icon">🔒</span>
              <h3>WILSONIX PRO ACTIVATION & ACCESS</h3>
            </div>
            <button class="dialog-close-btn" id="license-close-btn">✕</button>
          </div>

          <div class="dialog-body">
            ${
              this.promptReason
                ? `
              <div class="license-reason-alert" style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #fbbf24; padding: 8px 12px; border-radius: 6px; font-size: 0.76rem; font-weight: 700; margin-bottom: 12px;">
                ⚠️ ${this.promptReason}
              </div>
            `
                : ""
            }

            <!-- Hardware ID Card -->
            <div class="hardware-id-card">
              <label>MACHINE HARDWARE FINGERPRINT:</label>
              <div class="fingerprint-box">
                <code id="hw-fingerprint-val">${devId}</code>
                <button class="copy-hw-btn" id="copy-hw-btn">COPY ID</button>
              </div>
              <p class="hw-tip">Give this ID to your administrator to receive an authorized signed license key.</p>
            </div>

            <!-- Access Status Card -->
            <div class="license-status-card ${statusCardClass}">
              <div class="status-indicator-dot"></div>
              <div class="status-meta">
                <div class="status-title">${statusTitle}</div>
                <div class="status-desc">${statusDesc}</div>
              </div>
            </div>

            <!-- Feature Tier Comparison (Option A Soft Gating) -->
            <div class="license-tier-box" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 0.70rem;">
              <div style="font-weight: 800; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Feature Comparison:</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div style="color: #cbd5e1;">
                  <strong style="color: #38bdf8;">✓ Free / Standard:</strong>
                  <ul style="margin: 4px 0 0 16px; padding: 0; line-height: 1.4;">
                    <li>88-Key Virtual Piano</li>
                    <li>Full Synth Engine & Soundbanks</li>
                    <li>Keyboard Split & Octave Controls</li>
                  </ul>
                </div>
                <div style="color: #cbd5e1;">
                  <strong style="color: #f59e0b;">★ Pro Unlocked:</strong>
                  <ul style="margin: 4px 0 0 16px; padding: 0; line-height: 1.4;">
                    <li>Lossless Master WAV Recording</li>
                    <li>Custom Stage Rig Memory Storage</li>
                    <li>4-Timbre Combi Mixer Stacks</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Activation / Deactivation -->
            ${
              !access.isLicensed
                ? `
              <div class="activation-form">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <label style="margin: 0;">ENTER YOUR PRO LICENSE KEY:</label>
                  <button type="button" id="btn-prefill-demo-key" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); font-size: 0.60rem; font-weight: 800; padding: 2px 7px; border-radius: 3px; cursor: pointer;">⚡ FILL DEMO KEY</button>
                </div>
                <div class="key-input-row">
                  <input type="text" id="license-key-input" placeholder="MKPRO-NAME-LIFETIME-XXXXXXXX" spellcheck="false" autocomplete="off" />
                  <button class="activate-submit-btn" id="activate-submit-btn">ACTIVATE</button>
                </div>
                <div class="key-help-hint">Format: MKPRO-NAME-EXPIRY-SIGNATURE or Built-in VIP Key: MKPRO-VIP-MASTER-ACCESS</div>
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
    const demoKeyBtn = document.getElementById("btn-prefill-demo-key");

    demoKeyBtn?.addEventListener("click", () => {
      if (keyInput) {
        keyInput.value = "MKPRO-VIP-MASTER-ACCESS";
        keyInput.focus();
      }
    });

    closeBtn?.addEventListener("click", () => this.close());
    backdrop?.addEventListener("click", e => {
      if (e.target === backdrop) this.close();
    });

    copyBtn?.addEventListener("click", () => {
      navigator.clipboard.writeText(licenseManager.deviceFingerprint);
      copyBtn.innerText = "COPIED!";
      setTimeout(() => (copyBtn.innerText = "COPY ID"), 2000);
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

      activateBtn.disabled = true;
      activateBtn.innerText = "VERIFYING...";

      const res = await licenseManager.activate(key);

      activateBtn.disabled = false;
      activateBtn.innerText = "ACTIVATE";

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
