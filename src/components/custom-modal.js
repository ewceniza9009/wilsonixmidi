import { escapeHtml } from "../utils/escape-html.js";

export class CustomModal {
  static createOverlay() {
    const existing = document.getElementById("custom-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "custom-modal-overlay";
    overlay.className = "custom-modal-overlay";
    document.body.appendChild(overlay);
    return overlay;
  }

  static close() {
    const overlay = document.getElementById("custom-modal-overlay");
    if (overlay) overlay.remove();
  }

  static prompt(title, message, placeholder = "", defaultValue = "") {
    return new Promise((resolve) => {
      const overlay = this.createOverlay();
      
      overlay.innerHTML = `
        <div class="custom-modal-card">
          <h3 class="custom-modal-title">${escapeHtml(title)}</h3>
          <p class="custom-modal-message">${escapeHtml(message)}</p>
          <input type="text" id="custom-modal-input" class="custom-modal-input" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue)}" autocomplete="off" spellcheck="false" />
          <div class="custom-modal-actions">
            <button class="custom-modal-btn secondary" id="custom-modal-cancel">CANCEL</button>
            <button class="custom-modal-btn primary" id="custom-modal-ok">OK</button>
          </div>
        </div>
      `;

      const input = overlay.querySelector("#custom-modal-input");
      const cancelBtn = overlay.querySelector("#custom-modal-cancel");
      const okBtn = overlay.querySelector("#custom-modal-ok");

      setTimeout(() => input.focus(), 50);

      const submit = () => {
        const val = input.value.trim();
        this.close();
        resolve(val.length > 0 ? val : null);
      };

      const cancel = () => {
        this.close();
        resolve(null);
      };

      okBtn.addEventListener("click", submit);
      cancelBtn.addEventListener("click", cancel);
      
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") cancel();
      });
    });
  }

  static confirm(title, message) {
    return new Promise((resolve) => {
      const overlay = this.createOverlay();
      
      overlay.innerHTML = `
        <div class="custom-modal-card">
          <h3 class="custom-modal-title">${escapeHtml(title)}</h3>
          <p class="custom-modal-message">${escapeHtml(message)}</p>
          <div class="custom-modal-actions">
            <button class="custom-modal-btn secondary" id="custom-modal-cancel">CANCEL</button>
            <button class="custom-modal-btn danger" id="custom-modal-ok">CONFIRM</button>
          </div>
        </div>
      `;

      overlay.querySelector("#custom-modal-ok").addEventListener("click", () => {
        this.close();
        resolve(true);
      });
      overlay.querySelector("#custom-modal-cancel").addEventListener("click", () => {
        this.close();
        resolve(false);
      });
    });
  }

  static alert(title, message) {
    return new Promise((resolve) => {
      const overlay = this.createOverlay();
      
      overlay.innerHTML = `
        <div class="custom-modal-card">
          <h3 class="custom-modal-title">${escapeHtml(title)}</h3>
          <p class="custom-modal-message">${escapeHtml(message)}</p>
          <div class="custom-modal-actions">
            <button class="custom-modal-btn primary" id="custom-modal-ok">OK</button>
          </div>
        </div>
      `;

      overlay.querySelector("#custom-modal-ok").addEventListener("click", () => {
        this.close();
        resolve();
      });
    });
  }
}
