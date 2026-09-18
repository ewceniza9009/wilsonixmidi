import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    watch: {
      ignored: [
        "**/android/**",
        "**/src-tauri/**",
        "**/dist/**",
        "**/dist-apk/**",
        "**/dist-installer/**",
        "**/scratch/**",
        "**/.git/**",
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-core': ['@capacitor/core', '@capacitor/android'],
          'vendor-audio': ['soundfont-player'],
          // View chunks (lazy-loaded)
          'view-combi': ['src/components/multi-layer-ui.js'],
          'view-split': ['src/components/split-console-ui.js'],
          'view-chords': ['src/components/chord-pads.js', 'src/components/looper.js'],
          'view-demo': ['src/components/demo-station.js'],
          'view-grooves': ['src/components/groove-player-ui.js'],
          'view-player': ['src/components/media-player-ui.js'],
          'view-fx': ['src/components/fx-rack-ui.js'],
          'view-keys': ['src/components/virtual-keyboard.js'],
          // Triton is large - separate it
          'view-triton': ['src/components/triton-workstation-ui.js'],
          // Audio engine chunks
          'audio-engine': ['src/audio/multi-layer-engine.js', 'src/audio/native-pcm-engine.js'],
          'audio-synth': ['src/audio/synth-engine.js', 'src/audio/triton-va-engine.js'],
          'audio-worklet': ['src/audio/worklet/synth-worklet-node.js', 'src/audio/worklet/pcm-worklet-node.js'],
        },
      },
    },
  },
});
