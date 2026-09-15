/**
 * Minimal Web Audio API mocks for unit tests.
 * Provides a fake AudioContext with createGain/createBiquadFilter/
 * createDynamicsCompressor/createDelay/createWaveShaper etc. sufficient
 * to exercise the FX effect classes' setter logic without a browser.
 */

function createParam(value = 0) {
  const target = { value, _calls: [] };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop === "cancelScheduledValues") return () => {};
      if (prop === "setValueAtTime" || prop === "setTargetAtTime") {
        return (v) => { obj.value = v; obj._calls.push([prop, v]); };
      }
      if (prop === "connect") return () => {};
      if (prop === "disconnect") return () => {};
      return obj[prop];
    },
    set(obj, prop, val) {
      if (prop === "value") obj.value = val;
      return true;
    },
  });
}

function createNode() {
  return {
    connect: () => {},
    disconnect: () => {},
    gain: createParam(1),
    frequency: createParam(0),
    Q: createParam(0),
    delayTime: createParam(0),
    threshold: createParam(0),
    knee: createParam(0),
    ratio: createParam(0),
    attack: createParam(0),
    release: createParam(0),
    curve: null,
    oversample: "none",
    reduction: 0,
    start: () => {},
    stop: () => {},
  };
}

export function createMockAudioContext() {
  return {
    currentTime: 0,
    createGain: () => {
      const n = createNode();
      n.gain.value = 1.0;
      return n;
    },
    createBiquadFilter: () => createNode(),
    createDynamicsCompressor: () => createNode(),
    createDelay: () => createNode(),
    createWaveShaper: () => createNode(),
    createOscillator: () => createNode(),
    createChannelMerger: () => createNode(),
    createChannelSplitter: () => createNode(),
    createGainNode: () => createNode(),
    createScriptProcessor: () => createNode(),
    createAnalyser: () => createNode(),
    createConvolver: () => createNode(),
    destination: createNode(),
  };
}