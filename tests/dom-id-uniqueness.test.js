import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectIds, crossFileCollisions } from "./helpers/dom-id-scan.js";

/**
 * Every view reaches its controls with getElementById / querySelector, so the
 * same id in two different files silently hands one of them to the other —
 * that is how the Split Console buttons ended up driving the COMBI console.
 * Same-file repeats are normal (mutually exclusive template branches), so only
 * cross-file collisions fail.
 */

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

test("no DOM element id is defined in more than one source file", () => {
  const byId = collectIds(SRC_ROOT);
  const collisions = crossFileCollisions(byId);

  assert.ok(byId.size > 100, "the scan must see the app's real template ids");
  assert.equal(
    collisions.length,
    0,
    `cross-file duplicate ids:\n${collisions
      .map((c) => `  #${c.id} -> ${c.sites.join(", ")}`)
      .join("\n")}`,
  );
});

test("the scanner reports a collision across two files and skips dynamic ids", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "id-scan-"));
  try {
    fs.writeFileSync(
      path.join(fixture, "a.js"),
      '<div id="shared"></div>\n<div id="only-a"></div>\n<div id="${dynamic}"></div>\n',
    );
    fs.mkdirSync(path.join(fixture, "sub"));
    fs.writeFileSync(path.join(fixture, "sub", "b.js"), "<p id='shared'></p>\n");

    const byId = collectIds(fixture);
    const collisions = crossFileCollisions(byId);

    assert.deepEqual(collisions.map((c) => c.id), ["shared"]);
    assert.deepEqual(collisions[0].sites.sort(), ["a.js:1", "sub/b.js:1"]);
    assert.equal(byId.has("only-a"), true);
    assert.equal(byId.has("${dynamic}"), false, "interpolated ids are runtime-only");
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
