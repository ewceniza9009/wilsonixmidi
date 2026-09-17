import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NativePcmEngine } from "../src/audio/native-pcm-engine.js";

// parseSoundfontJsonp does not rely on instance state, so call it directly off
// the prototype without booting a Web Audio context.
const parse = (text) => NativePcmEngine.prototype.parseSoundfontJsonp.call({}, text);

const GUARDS =
  "if (typeof(MIDI) === 'undefined') var MIDI = {};\n" +
  "if (typeof(MIDI.Soundfont) === 'undefined') MIDI.Soundfont = {};\n";

test("parseSoundfontJsonp extracts samples from a JSONP payload", () => {
  const text =
    GUARDS +
    'MIDI.Soundfont.acoustic_bass = {\n' +
    '  "A0": "data:audio/mp3;base64,AAAA",\n' +
    '  "B0": "data:audio/mp3;base64,BBBB",\n' +
    "};\n";

  const parsed = parse(text);
  assert.ok(parsed, "expected a parsed object");
  assert.deepEqual(parsed.A0, "data:audio/mp3;base64,AAAA");
  assert.deepEqual(parsed.B0, "data:audio/mp3;base64,BBBB");
});

test("parseSoundfontJsonp tolerates the trailing comma before the closing brace", () => {
  const text =
    GUARDS +
    'MIDI.Soundfont.foo = {\n' +
    '  "A0": "data:audio/mp3;base64,AAAA",\n' +
    "};\n";
  const parsed = parse(text);
  assert.equal(parsed.A0, "data:audio/mp3;base64,AAAA");
});

test("parseSoundfontJsonp skips the typeof guard lines (uses the last marker)", () => {
  const text =
    GUARDS +
    'MIDI.Soundfont.inst = { "C4": "data:audio/mp3;base64,CCCC" };';
  const parsed = parse(text);
  assert.deepEqual(Object.keys(parsed), ["C4"]);
});

test("parseSoundfontJsonp returns null for non-string / missing payloads", () => {
  assert.equal(parse(null), null);
  assert.equal(parse(undefined), null);
  assert.equal(parse(42), null);
  assert.equal(parse(""), null);
  assert.equal(parse("no soundfont here"), null);
});

test("parseSoundfontJsonp returns null for malformed JSON / HTML error pages", () => {
  assert.equal(parse("<html><body>404</body></html>"), null);
  assert.equal(parse(GUARDS + "MIDI.Soundfont.x = { oops: ; };"), null);
  assert.equal(parse(GUARDS + "MIDI.Soundfont.x = {};"), null);
});

test("parseSoundfontJsonp parses a real shipped soundfont file", () => {
  const file = fileURLToPath(
    new URL("../public/soundfonts/acoustic_bass-mp3.js", import.meta.url),
  );
  if (!existsSync(file)) {
    return; // asset not present in this checkout
  }
  const parsed = parse(readFileSync(file, "utf8"));
  assert.ok(parsed, "expected the real soundfont to parse");
  const keys = Object.keys(parsed);
  assert.ok(keys.length > 0, "expected at least one sample");
  for (const key of keys) {
    assert.equal(typeof parsed[key], "string");
    assert.match(parsed[key], /^data:audio\/mp3;base64,/);
  }
});
