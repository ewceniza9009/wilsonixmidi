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
    this.render();
    this.bindEvents();
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
      statusTitle = "TRIAL EXPIRED";
      statusDesc = "Your 30-day trial period has concluded. Enter a valid license key below to unlock lifetime stage access.";
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

            <!-- Activation / Deactivation -->
            ${
              !access.isLicensed
                ? `
              <div class="activation-form">
                <label>ENTER YOUR PRO LICENSE KEY:</label>
                <div class="key-input-row">
                  <input type="text" id="license-key-input" placeholder="MKPRO-NAME-LIFETIME-XXXXXXXX" spellcheck="false" autocomplete="off" />
                  <button class="activate-submit-btn" id="activate-submit-btn">ACTIVATE</button>
                </div>
                <div class="key-help-hint">Keys follow the format: MKPRO-NAME-EXPIRY-SIGNATURE</div>
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

  open() {
    this.isOpen = true;
    this.render();
    this.bindEvents();
  }

  close() {
    this.isOpen = false;
    const backdrop = document.getElementById("license-backdrop");
    if (backdrop) backdrop.classList.remove("open");
  }
}
