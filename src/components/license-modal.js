/**
 * Pro License & Access Control Modal
 * Allows entering cryptographically signed license keys and displays hardware fingerprint.
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

    const isPro = licenseManager.isLicensed();
    const info = licenseManager.getLicenseInfo();
    const devId = licenseManager.deviceFingerprint;

    this.container.innerHTML = `
      <div class="license-modal-backdrop ${this.isOpen ? "open" : ""}" id="license-backdrop">
        <div class="license-dialog">
          <div class="dialog-header">
            <div class="dialog-title">
              <span class="lock-icon">🔒</span>
              <h3>MIDIKEY ELITE PRO ACTIVATION</h3>
            </div>
            <button class="dialog-close-btn" id="license-close-btn">✕</button>
          </div>

          <div class="dialog-body">
            <div class="hardware-id-card">
              <label>YOUR MACHINE HARDWARE FINGERPRINT:</label>
              <div class="fingerprint-box">
                <code id="hw-fingerprint-val">${devId}</code>
                <button class="copy-hw-btn" id="copy-hw-btn">COPY ID</button>
              </div>
              <p class="hw-tip">Give this ID to your administrator to receive your signed offline license key.</p>
            </div>

            <div class="license-status-card ${isPro ? "status-pro" : "status-demo"}">
              <div class="status-indicator-dot"></div>
              <div class="status-meta">
                <div class="status-title">${isPro ? "PRO LICENSE ACTIVE" : "TRIAL / DEMO MODE"}</div>
                <div class="status-desc">
                  ${
                    isPro
                      ? `Registered to: <strong>${info?.licensee || "Pro User"}</strong> (${info?.expires || "Lifetime"})`
                      : "Soundbanks and live looper are running in demo preview mode."
                  }
                </div>
              </div>
            </div>

            ${
              !isPro
                ? `
              <div class="activation-form">
                <label>ENTER YOUR PRO LICENSE KEY:</label>
                <div class="key-input-row">
                  <input type="text" id="license-key-input" placeholder="MKPRO-NAME-LIFETIME-XXXXXXXX" spellcheck="false" autocomplete="off" />
                  <button class="activate-submit-btn" id="activate-submit-btn">ACTIVATE</button>
                </div>
                <div class="key-help-hint">Format: MKPRO-NAME-EXPIRY-SIGNATURE (e.g. MKPRO-VIP-MASTER-ACCESS)</div>
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
          msgEl.innerText = "✓ Activation Successful! Welcome to MidiKey Elite Pro.";
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
