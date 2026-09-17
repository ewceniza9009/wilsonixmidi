import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "android/**",
      "node_modules/**",
      "src/audio/korg-pcm-data.js",
    ],
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        Buffer: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-dupe-class-members": "error",
      "no-redeclare": "error",
      "no-dupe-keys": "error",
      "no-func-assign": "error",
      "no-import-assign": "error",
      "no-duplicate-imports": "error",
      "no-unreachable": "error",
      "no-undef": "warn",
      // Graceful-degradation catch blocks (`try { ... } catch (e) {}`) are used
      // intentionally throughout the audio engine when optional browser APIs
      // are unavailable. Allow them, but keep flagging empty blocks elsewhere.
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-case-declarations": "warn",
      "no-unused-vars": ["warn", { caughtErrors: "none", argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-self-assign": "warn",
    },
  },
  {
    // AudioWorklet modules execute in AudioWorkletGlobalScope, which exposes
    // AudioWorkletProcessor / registerProcessor rather than the DOM globals.
    files: ["src/audio/worklet/**/*.js"],
    languageOptions: {
      globals: {
        AudioWorkletProcessor: "readonly",
        registerProcessor: "readonly",
      },
    },
  },
];