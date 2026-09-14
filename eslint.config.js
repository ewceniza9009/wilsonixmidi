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
      "no-empty": "warn",
      "no-case-declarations": "warn",
      "no-unused-vars": "warn",
      "no-self-assign": "warn",
    },
  },
];