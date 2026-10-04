import fs from "node:fs";
import path from "node:path";

/**
 * Collects statically written DOM ids (`id="foo"` / `id='foo'`) from every
 * `.js` file under `rootDir`.
 *
 * Returns a Map of id -> ["relative/path.js:line", ...]. Template
 * interpolations (`id="${x}"`) are skipped because they resolve at runtime.
 */
const ID_ATTR = /(?<![\w-])id=(["'])([^"']+)\1/g;

export function collectJsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

export function collectIds(rootDir) {
  const byId = new Map();
  for (const file of collectJsFiles(rootDir)) {
    const rel = path.relative(rootDir, file).split(path.sep).join("/");
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, idx) => {
      for (const match of line.matchAll(ID_ATTR)) {
        const id = match[2];
        if (id.includes("${")) continue;
        if (!byId.has(id)) byId.set(id, []);
        byId.get(id).push(`${rel}:${idx + 1}`);
      }
    });
  }
  return byId;
}

/** Ids claimed by more than one file: [{ id, sites }]. */
export function crossFileCollisions(byId) {
  const collisions = [];
  for (const [id, sites] of byId) {
    const files = new Set(sites.map((s) => s.split(":")[0]));
    if (files.size > 1) collisions.push({ id, sites });
  }
  return collisions;
}
