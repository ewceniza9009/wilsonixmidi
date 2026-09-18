/**
 * HTML entity escaping for values interpolated into innerHTML templates.
 * Use for any user- or file-derived string (imported MIDI titles, setlist
 * rig names, playlist names, layer names) before it reaches the DOM.
 */

const ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  if (value == null) return "";
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
