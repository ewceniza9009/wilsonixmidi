import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockAudioContext } from "./helpers/mock-audio-context.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeVoice(over = {}) {
  return {
    midiNote: 60,
    instId: "inst_a",
    layerIndex: 0,
    dest: undefined,
    src: { onended: null, loop: false, stop: () => {}, disconnect: () => {} },
    filter: null,
    voiceGain: null,
    vibLfo: null,
    growlLfo: null,
    _isRemoved: false,
    _isRecycled: false,
    ...over,
  };
}

async function makeEngine() {
  const { NativePcmEngine } = await import("../src/audio/native-pcm-engine.js");
  const ctx = createMockAudioContext();
  const engine = new NativePcmEngine(ctx, ctx.destination, { deferAssetLoading: true });
  return { engine, ctx };
}

const poolCount = (engine, filter, voiceGain) =>
  engine._voiceNodePool.filter((p) => p.filter === filter && p.voiceGain === voiceGain).length;

test("allNotesOff kills each voice once - no duplicate node pairs in the voice pool", async () => {
  const { engine, ctx } = await makeEngine();
  const filter = ctx.createBiquadFilter();
  const voiceGain = ctx.createGain();
  const voice = makeVoice({ filter, voiceGain });

  engine.activeVoices.set(60, [voice]);
  engine.heldNotes.add(60);
  engine._allActiveVoices.add(voice);

  engine.allNotesOff();
  await delay(60);

  assert.equal(
    poolCount(engine, filter, voiceGain),
    1,
    "killVoice is visited twice per voice - it must stay idempotent",
  );
  assert.equal(engine._allActiveVoices.size, 0, "dead records must leave _allActiveVoices");
  assert.equal(engine.heldNotes.size, 0);
});

test("_disconnectAndRecycle releases the record from _allActiveVoices", async () => {
  const { engine, ctx } = await makeEngine();
  const filter = ctx.createBiquadFilter();
  const voiceGain = ctx.createGain();
  const voice = makeVoice({ filter, voiceGain });

  engine._allActiveVoices.add(voice);
  engine._disconnectAndRecycle(60, voice);

  assert.equal(engine._allActiveVoices.has(voice), false);
  assert.equal(voice._isRecycled, true);
  assert.equal(poolCount(engine, filter, voiceGain), 1);
});

test("stopNote releases only the matching instrument while the pitch is held", async () => {
  const { engine, ctx } = await makeEngine();
  const voiceA = makeVoice({ instId: "inst_a", filter: ctx.createBiquadFilter(), voiceGain: ctx.createGain() });
  const voiceB = makeVoice({ instId: "inst_b", filter: ctx.createBiquadFilter(), voiceGain: ctx.createGain() });

  engine.activeVoices.set(60, [voiceA, voiceB]);
  engine.heldNotes.add(60);

  engine.stopNote("inst_a", 60);

  const remaining = engine.activeVoices.get(60) || [];
  assert.equal(remaining.length, 1, "the other instrument must keep ringing");
  assert.equal(remaining[0].instId, "inst_b");
  assert.equal(engine.heldNotes.has(60), false, "the released pitch must be unflagged");
});

test("stopNote with a layerIndex releases only that layer", async () => {
  const { engine, ctx } = await makeEngine();
  const layer0 = makeVoice({ layerIndex: 0, filter: ctx.createBiquadFilter(), voiceGain: ctx.createGain() });
  const layer1 = makeVoice({ layerIndex: 1, filter: ctx.createBiquadFilter(), voiceGain: ctx.createGain() });

  engine.activeVoices.set(60, [layer0, layer1]);
  engine.heldNotes.add(60);

  engine.stopNote("inst_a", 60, 0, 1);

  const remaining = engine.activeVoices.get(60) || [];
  assert.equal(remaining.length, 1, "layer 0 must keep sounding");
  assert.equal(remaining[0].layerIndex, 0);
});

test("stopNote releases everything at the pitch when the pitch is not tracked as held", async () => {
  const { engine, ctx } = await makeEngine();
  const voiceA = makeVoice({ instId: "inst_a", filter: ctx.createBiquadFilter(), voiceGain: ctx.createGain() });
  const voiceB = makeVoice({ instId: "inst_b", filter: ctx.createBiquadFilter(), voiceGain: ctx.createGain() });

  engine.activeVoices.set(60, [voiceA, voiceB]);
  assert.equal(engine.heldNotes.has(60), false);

  engine.stopNote("inst_a", 60);

  assert.equal(engine.activeVoices.has(60), false, "untracked pitch - all voices are released");
});

test("stopNote never cuts a looper-bus voice", async () => {
  const { engine, ctx } = await makeEngine();
  const bus = engine.looperInserts[0][0];
  const looperVoice = makeVoice({
    instId: "inst_a",
    dest: bus.input,
    filter: ctx.createBiquadFilter(),
    voiceGain: ctx.createGain(),
  });

  engine.activeVoices.set(60, [looperVoice]);
  engine.heldNotes.add(60);

  engine.stopNote("inst_a", 60);

  const remaining = engine.activeVoices.get(60) || [];
  assert.equal(remaining.length, 1, "looper playback must survive a keyboard note-off");
  assert.equal(remaining[0].dest, bus.input);
});

test("stopLooperNote clears the pitch from heldNotes", async () => {
  const { engine, ctx } = await makeEngine();
  const bus = engine.looperInserts[0][0];
  const looperVoice = makeVoice({
    instId: "inst_a",
    dest: bus.input,
    filter: ctx.createBiquadFilter(),
    voiceGain: ctx.createGain(),
  });

  engine.activeVoices.set(60, [looperVoice]);
  engine.heldNotes.add(60);

  engine.stopLooperNote(0, 0, "inst_a", 60);

  assert.equal(engine.activeVoices.has(60), false, "the looper voice must be released");
  assert.equal(engine.heldNotes.has(60), false, "a looper release must not leave the pitch flagged held");
});

test("insert flush() restores dry/wet levels after the choke window", async () => {
  const { LayerInsertProcessor } = await import("../src/audio/native-pcm-engine.js");
  const ctx = createMockAudioContext();
  const ins = new LayerInsertProcessor(ctx, ctx.destination);

  ins.input.gain.value = 0.7; // ducked level
  ins.dryGain.gain.value = 0.0; // serial insert (dry must stay 0)
  ins.wetGain.gain.value = 1.0;

  ins.flush();
  assert.equal(ins.wetGain.gain.value, 0, "flush must still choke the wet path");
  assert.equal(ins.dryGain.gain.value, 0);

  await delay(70);

  assert.equal(ins.wetGain.gain.value, 1, "the wet path must come back (panic used to mute FX permanently)");
  assert.equal(ins.dryGain.gain.value, 0, "serial insert dry must not be forced back to 1.0");
  assert.equal(ins.input.gain.value, 0.7, "the pre-choke insert level must be restored");
});

test("setEffect() wins over a pending flush() restore", async () => {
  const { LayerInsertProcessor } = await import("../src/audio/native-pcm-engine.js");
  const ctx = createMockAudioContext();
  const ins = new LayerInsertProcessor(ctx, ctx.destination);

  ins.dryGain.gain.value = 0.0;
  ins.wetGain.gain.value = 0.5;
  ins.flush();

  ins.setEffect("clean"); // authoritative: dry 1.0, wet 0.0

  await delay(70);

  assert.equal(ins.dryGain.gain.value, 1, "the stale flush timer must not clobber setEffect()");
  assert.equal(ins.wetGain.gain.value, 0);
});

test("arpeggiator heldNotes drains when the same pitch is struck twice", async () => {
  const { Arpeggiator } = await import("../src/audio/arpeggiator.js");
  const arp = new Arpeggiator();
  let stops = 0;
  arp.stop = () => { stops += 1; };

  arp.handleNoteOn(60);
  arp.handleNoteOn(60); // re-strike or two keys snapped to one pitch by scale lock

  assert.equal(arp.heldNotes.size, 1, "duplicate note-ons must not stack entries");

  arp.handleNoteOff(60);

  assert.equal(arp.heldNotes.size, 0, "one note-off must fully drain the pitch");
  assert.equal(stops, 1, "the arp must stop once every key is released");
});
