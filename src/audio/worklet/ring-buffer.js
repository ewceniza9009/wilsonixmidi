/**
 * WILSONIX MIDIKEY Elite - Lock-Free Real-Time Audio RingBuffer
 * High-speed, zero-allocation MIDI event transport from UI thread to AudioWorkletProcessor.
 * Uses SharedArrayBuffer + Atomics when available, with automatic MessagePort fallback.
 */

export const RING_BUFFER_CAPACITY = 256; // Max queued MIDI events per audio frame
const EVENT_STRIDE = 4; // [status, data1, data2, timestampMs]

export class MidiRingBufferWriter {
  constructor(sharedBuffer = null) {
    this.hasSAB = !!(sharedBuffer && typeof SharedArrayBuffer !== "undefined" && sharedBuffer instanceof SharedArrayBuffer);
    
    if (this.hasSAB) {
      this.header = new Int32Array(sharedBuffer, 0, 2); // [writePtr, readPtr]
      this.payload = new Float32Array(sharedBuffer, 8, RING_BUFFER_CAPACITY * EVENT_STRIDE);
    } else {
      // Fallback message port handler
      this.port = null;
      this.eventPool = [];
      for (let i = 0; i < 64; i++) {
        this.eventPool.push({ type: "midi", status: 0, note: 0, velocity: 0, time: 0 });
      }
      this.poolIdx = 0;
    }
  }

  setPort(port) {
    this.port = port;
  }

  static createSharedBuffer() {
    if (typeof SharedArrayBuffer === "undefined") return null;
    try {
      // Header: 2x 32-bit ints (8 bytes) + Payload: 256 * 4 * 4 bytes (4096 bytes) = 4104 bytes
      const byteLength = 8 + RING_BUFFER_CAPACITY * EVENT_STRIDE * 4;
      return new SharedArrayBuffer(byteLength);
    } catch (e) {
      return null;
    }
  }

  writeMidi(status, note, velocity, time = 0) {
    if (this.hasSAB) {
      const writePtr = Atomics.load(this.header, 0);
      const readPtr = Atomics.load(this.header, 1);
      const nextWrite = (writePtr + 1) % RING_BUFFER_CAPACITY;

      if (nextWrite === readPtr) {
        // Buffer full - drop oldest event to avoid lockups
        return false;
      }

      const offset = writePtr * EVENT_STRIDE;
      this.payload[offset] = status;
      this.payload[offset + 1] = note;
      this.payload[offset + 2] = velocity;
      this.payload[offset + 3] = time;

      Atomics.store(this.header, 0, nextWrite);
      return true;
    } else if (this.port) {
      // Fallback: fast port message
      const ev = this.eventPool[this.poolIdx];
      this.poolIdx = (this.poolIdx + 1) % this.eventPool.length;
      ev.status = status;
      ev.note = note;
      ev.velocity = velocity;
      ev.time = time;
      this.port.postMessage(ev);
      return true;
    }
    return false;
  }
}

export class MidiRingBufferReader {
  constructor(sharedBuffer = null) {
    this.hasSAB = !!(sharedBuffer && typeof SharedArrayBuffer !== "undefined" && sharedBuffer instanceof SharedArrayBuffer);

    if (this.hasSAB) {
      this.header = new Int32Array(sharedBuffer, 0, 2);
      this.payload = new Float32Array(sharedBuffer, 8, RING_BUFFER_CAPACITY * EVENT_STRIDE);
    }
  }

  readMidi(outEvent) {
    if (!this.hasSAB) return false;

    const writePtr = Atomics.load(this.header, 0);
    const readPtr = Atomics.load(this.header, 1);

    if (readPtr === writePtr) {
      return false; // Empty
    }

    const offset = readPtr * EVENT_STRIDE;
    outEvent.status = this.payload[offset];
    outEvent.note = this.payload[offset + 1];
    outEvent.velocity = this.payload[offset + 2];
    outEvent.time = this.payload[offset + 3];

    const nextRead = (readPtr + 1) % RING_BUFFER_CAPACITY;
    Atomics.store(this.header, 1, nextRead);
    return true;
  }
}
