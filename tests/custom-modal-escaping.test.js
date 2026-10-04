import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { CustomModal } from "../src/components/custom-modal.js";

/**
 * CustomModal writes title/message/placeholder straight into innerHTML, so
 * anything it renders must be entity-escaped — patch names and error strings
 * come from user input and imported files.
 */

let rendered = [];
const originalDocument = globalThis.document;

function makeElement() {
  const el = {
    id: "",
    className: "",
    innerHTML: "",
    listeners: {},
    querySelector: () => ({ addEventListener: () => {}, focus: () => {} }),
    addEventListener: (type, fn) => {
      el.listeners[type] = fn;
    },
    remove: () => {},
  };
  rendered.push(el);
  return el;
}

function installFakeDocument() {
  rendered = [];
  globalThis.document = {
    getElementById: () => null,
    createElement: () => makeElement(),
    body: { appendChild: () => {} },
  };
}

afterEach(() => {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  rendered = [];
});

test("alert() escapes markup in the title and message", async () => {
  installFakeDocument();

  CustomModal.alert(
    'Patch "Sunday <img src=x onerror=alert(1)>"',
    "Failed & <b>bold</b> 'quote'",
  );

  const html = rendered.at(-1).innerHTML;
  assert.ok(html.includes("&lt;img"), "raw <img> must never reach innerHTML");
  assert.ok(!html.includes("<img src=x"), "no live element from the message");
  assert.ok(!html.includes("<b>bold</b>"), "markup stays literal text");
  assert.ok(html.includes("&lt;b&gt;bold&lt;/b&gt;"));
  assert.ok(html.includes("&amp;"), "ampersands are escaped");
  assert.ok(html.includes("&#39;"), "single quotes are escaped");
});

test("prompt() escapes placeholder and default value attributes", async () => {
  installFakeDocument();

  const pending = CustomModal.prompt(
    "Title",
    "Message",
    '" onfocus="alert(1)',
    '"><script>alert(2)</script>',
  );

  const html = rendered.at(-1).innerHTML;
  assert.ok(!html.includes('placeholder="" onfocus="'), "attribute breakout must be neutralized");
  assert.ok(html.includes("&quot; onfocus=&quot;alert(1)"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));

  pending.catch(() => {});
});

test("confirm() escapes both interpolated fields", async () => {
  installFakeDocument();

  const pending = CustomModal.confirm("<svg onload=alert(1)>", "Are you <i>sure</i>?");

  const html = rendered.at(-1).innerHTML;
  assert.ok(!html.includes("<svg"));
  assert.ok(html.includes("&lt;svg onload=alert(1)&gt;"));

  pending.catch(() => {});
});
