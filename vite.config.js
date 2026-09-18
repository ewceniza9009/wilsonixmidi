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
          'vendor-core': ['@capacitor/core'],
        },
      },
    },
  },
});
