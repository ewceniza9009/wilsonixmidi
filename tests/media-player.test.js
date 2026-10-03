import { test } from "node:test";
import assert from "node:assert/strict";
import { MediaPlayerEngine } from "../src/audio/media-player-engine.js";

test("MediaPlayerEngine: restore cleanses duplicates and does not double tracks", async () => {
  const engine = new MediaPlayerEngine();

  // Mock global localStorage with doubled entries (the exact bug state)
  const mockStorage = {
    "midikey.mediaPlayer.playlist.v1": JSON.stringify([
      { id: "mp-1", name: "worship_backing.mp3", ext: "mp3", mime: "audio/mpeg", size: 1024, duration: 180 },
      { id: "mp-1", name: "worship_backing.mp3", ext: "mp3", mime: "audio/mpeg", size: 1024, duration: 180 }, // Duplicate ID & name
      { id: "mp-2", name: "worship_backing.mp3", ext: "mp3", mime: "audio/mpeg", size: 1024, duration: 180 }, // Same file, different ID
    ]),
  };

  globalThis.localStorage = {
    getItem: (key) => mockStorage[key] || null,
    setItem: (key, val) => { mockStorage[key] = val; },
    removeItem: (key) => { delete mockStorage[key]; },
  };

  // Perform first restore
  await engine.restore();

  // Must only have 1 entry (not 2 or 3)
  assert.equal(engine.playlist.length, 1, "Duplicate tracks must be cleansed on restore");
  assert.equal(engine.playlist[0].name, "worship_backing.mp3");

  // Call restore a second time (e.g. view switch or restart)
  await engine.restore();

  // Must STILL have exactly 1 entry (no doubling)
  assert.equal(engine.playlist.length, 1, "Playlist must not double on subsequent restore calls");
});

test("MediaPlayerEngine: addFiles rebinds existing tracks instead of creating duplicates", async () => {
  const engine = new MediaPlayerEngine();
  engine.playlist = [
    {
      id: "mp-track-1",
      name: "song.wav",
      ext: "wav",
      mime: "audio/wav",
      size: 0,
      duration: 0,
      url: null,
      missing: true,
      placeholder: true,
      source: "blob",
    },
  ];

  // Mock URL.createObjectURL & URL.revokeObjectURL
  globalThis.URL.createObjectURL = () => "blob:mock-url-1";
  globalThis.URL.revokeObjectURL = () => {};

  const fakeFile = {
    name: "song.wav",
    size: 2048,
    type: "audio/wav",
    arrayBuffer: async () => new ArrayBuffer(2048),
  };

  const added = await engine.addFiles([fakeFile]);

  // Playlist length must remain 1 (rebound in-place)
  assert.equal(engine.playlist.length, 1, "Should rebind existing track instead of adding duplicate row");
  assert.equal(engine.playlist[0].id, "mp-track-1");
  assert.equal(engine.playlist[0].missing, false);
  assert.equal(engine.playlist[0].placeholder, false);
  assert.equal(engine.playlist[0].size, 2048);
  assert.equal(engine.playlist[0].url, "blob:mock-url-1");
});
