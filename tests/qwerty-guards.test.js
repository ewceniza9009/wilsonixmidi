import { test } from "node:test";
import assert from "node:assert/strict";
import { QwertyKeyboard } from "../src/midi/qwerty-keyboard.js";

const proto = QwertyKeyboard.prototype;

test("typing surfaces are never hijacked as piano keys", () => {
  assert.equal(proto._isTypingTarget.call(null, { tagName: "INPUT" }), true);
  assert.equal(proto._isTypingTarget.call(null, { tagName: "TEXTAREA" }), true);
  assert.equal(proto._isTypingTarget.call(null, { tagName: "SELECT" }), true);
  assert.equal(
    proto._isTypingTarget.call(null, { tagName: "DIV", isContentEditable: true }),
    true,
    "contenteditable hosts are text entry too",
  );
});

test("non-text targets keep playing notes", () => {
  assert.equal(proto._isTypingTarget.call(null, { tagName: "DIV" }), false);
  assert.equal(proto._isTypingTarget.call(null, { tagName: "CANVAS" }), false);
  assert.equal(proto._isTypingTarget.call(null, null), false, "null target must not throw");
  assert.equal(proto._isTypingTarget.call(null, undefined), false);
  assert.equal(proto._isTypingTarget.call(null, "INPUT"), false, "primitive targets are not elements");
});

test("Space stays operable on focused controls (WCAG 2.1.1)", () => {
  const buttonish = { closest: (selector) => (selector.includes("button") ? {} : null) };
  assert.equal(proto._isInteractiveTarget.call(null, buttonish), true);

  const plainDiv = { closest: () => null };
  assert.equal(proto._isInteractiveTarget.call(null, plainDiv), false);

  assert.equal(
    proto._isInteractiveTarget.call(null, { tagName: "BUTTON" }),
    false,
    "targets without closest() must not be treated as interactive",
  );
  assert.equal(proto._isInteractiveTarget.call(null, null), false);
});

test("Escape defers to an open modal (no panic while a dialog is up)", () => {
  assert.equal(
    proto._modalIsOpen.call(null),
    false,
    "no document means no modal — Escape still triggers panic",
  );

  const fakeDoc = { querySelector: (sel) => (sel.includes("custom-modal-overlay") ? {} : null) };
  const originalDoc = globalThis.document;
  globalThis.document = fakeDoc;
  try {
    assert.equal(proto._modalIsOpen.call(null), true, "open overlay owns Escape");
  } finally {
    if (originalDoc === undefined) delete globalThis.document;
    else globalThis.document = originalDoc;
  }
});
