/**
 * WILSONIX MIDIKEY - Tiny namespaced console logger.
 * Guards against missing console APIs (older webviews, test runners, exotic
 * mobile webviews) so error paths never throw while trying to log.
 *
 * Usage: logger.warn("PCM", "Failed to decode sample", err);
 */

const noop = () => {};

const rawConsole = typeof console !== "undefined" ? console : {};

const make = (level, fallback) => {
  const fn = typeof rawConsole[level] === "function" ? rawConsole[level].bind(rawConsole) : null;
  if (fn) return (tag, ...args) => fn(`[WILSONIX ${tag}]`, ...args);
  const fb = typeof fallback === "function" ? fallback : null;
  if (fb) return (tag, ...args) => fb(`[WILSONIX ${tag}]`, ...args);
  return noop;
};

export const logger = {
  debug: make("debug"),
  log: make("log"),
  info: make("info"),
  warn: make("warn", rawConsole.error),
  error: make("error"),
};

export default logger;