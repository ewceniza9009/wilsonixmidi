import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BANK_KEYS,
  isPlainObject,
  isValidSlot,
  isValidBanksShape,
} from "../src/security/setlist-validation.js";

const validSlot = () => ({
  slot: 1,
  type: "single",
  name: "My Rig",
  savedAt: "2026-09-14T00:00:00.000Z",
  isCombiMode: false,
  activeSingleInst: "acoustic_grand_piano",
});

const validBanks = () => ({
  A: [validSlot(), { slot: 2, type: "combi", name: 'Bell "Lead"' }],
  B: [],
  C: [],
  D: [],
});

test("isPlainObject", () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);
  assert.equal(isPlainObject("x"), false);
  assert.equal(isPlainObject(42), false);
  assert.equal(isPlainObject(undefined), false);
});

test("isValidSlot accepts a well-formed slot", () => {
  assert.equal(isValidSlot(validSlot()), true);
});

test("isValidSlot rejects non-object and arrays", () => {
  assert.equal(isValidSlot(null), false);
  assert.equal(isValidSlot(undefined), false);
  assert.equal(isValidSlot("combi"), false);
  assert.equal(isValidSlot([]), false);
  assert.equal(isValidSlot(7), false);
});

test("isValidSlot rejects bad slot number", () => {
  assert.equal(isValidSlot({ ...validSlot(), slot: 0 }), false);
  assert.equal(isValidSlot({ ...validSlot(), slot: 1.5 }), false);
  assert.equal(isValidSlot({ ...validSlot(), slot: "1" }), false);
});

test("isValidSlot rejects unknown slot type", () => {
  assert.equal(isValidSlot({ ...validSlot(), type: "granular" }), false);
});

test("isValidSlot rejects oversized name but allows quotes/long strings within cap", () => {
  assert.equal(isValidSlot({ ...validSlot(), name: "x".repeat(200) }), true);
  assert.equal(isValidSlot({ ...validSlot(), name: "x".repeat(201) }), false);
});

test("isValidSlot validates numeric and boolean fields", () => {
  assert.equal(isValidSlot({ ...validSlot(), splitPointMidi: NaN }), false);
  assert.equal(isValidSlot({ ...validSlot(), splitPointMidi: 60 }), true);
  assert.equal(isValidSlot({ ...validSlot(), isCombiMode: "yes" }), false);
  assert.equal(isValidSlot({ ...validSlot(), isCombiMode: true }), true);
});

test("isValidSlot validates layers array", () => {
  assert.equal(isValidSlot({ ...validSlot(), layers: [] }), true);
  const many = new Array(33).fill({ enabled: true });
  assert.equal(isValidSlot({ ...validSlot(), layers: many }), false);
  assert.equal(isValidSlot({ ...validSlot(), layers: ["not-an-object"] }), false);
});

test("isValidSlot requires splitZones/tritonProg to be objects", () => {
  assert.equal(isValidSlot({ ...validSlot(), splitZones: { lower: { inst: "bass" } } }), true);
  assert.equal(isValidSlot({ ...validSlot(), splitZones: [] }), false);
  assert.equal(isValidSlot({ ...validSlot(), tritonProg: { id: "x" } }), true);
  assert.equal(isValidSlot({ ...validSlot(), tritonProg: 42 }), false);
});

test("isValidBanksShape accepts a minimal valid bank set", () => {
  assert.equal(isValidBanksShape(validBanks()), true);
});

test("isValidBanksShape requires all four bank keys as arrays", () => {
  assert.equal(isValidBanksShape({ A: [], B: [], C: [], D: [] }), false); // empty set
  assert.equal(isValidBanksShape({ ...validBanks(), A: "oops" }), false);
  assert.equal(isValidBanksShape({ A: [validSlot()], B: [], C: [] }), false); // missing D
});

test("isValidBanksShape enforces the 256-slot ceiling", () => {
  const tooMany = new Array(257).fill(validSlot());
  const banks = { A: tooMany, B: [], C: [], D: [] };
  assert.equal(isValidBanksShape(banks), false);
});

test("isValidBanksShape rejects non-object input", () => {
  assert.equal(isValidBanksShape(null), false);
  assert.equal(isValidBanksShape([]), false);
  assert.equal(isValidBanksShape("json"), false);
});

test("bank keys export matches the internal contract", () => {
  assert.deepEqual(BANK_KEYS, ["A", "B", "C", "D"]);
});