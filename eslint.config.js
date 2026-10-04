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
      "no-undef": "error",
      // Graceful-degradation catch blocks (`try { ... } catch (e) {}`) are used
      // intentionally throughout the audio engine when optional browser APIs
      // are unavailable. Allow them, but keep flagging empty blocks elsewhere.
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-case-declarations": "error",
      "no-unused-vars": ["error", { caughtErrors: "none", argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-self-assign": "error",
      // Our own CSP (script-src 'self') strips inline event handlers, so
      // `onclick="..."` in a template is dead code that also breaks keyboard
      // and screen-reader access. Bind a real listener instead.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\son[a-z]+\\s*=/]",
          message:
            "Inline HTML event handlers are blocked by CSP and unreachable by keyboard. Use addEventListener instead.",
        },
      ],
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
        currentTime: "readonly",
        currentFrame: "readonly",
        sampleRate: "readonly",
      },
    },
  },
  {
    // Node-side code: unit tests, build/asset tooling.
    files: ["tests/**/*.js", "tools/**/*.js", "tools/**/*.mjs", "*.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-case-declarations": "error",
      "no-unused-vars": ["error", { caughtErrors: "none", argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-self-assign": "error",
      "no-console": "off",
    },
  },
];
