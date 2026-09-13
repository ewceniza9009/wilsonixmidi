#!/usr/bin/env node
/**
 * Unified Cross-Platform Version Bumper & Synchronizer
 * Synchronizes version and build numbers simultaneously across:
 *  1. Web: package.json & src/version.js
 *  2. Android: android/app/build.gradle (versionCode & versionName)
 *  3. Desktop: src-tauri/tauri.conf.json (version)
 *
 * Usage:
 *  node tools/bump-version.js patch    -> 1.0.0 -> 1.0.1 (Build++)
 *  node tools/bump-version.js minor    -> 1.0.0 -> 1.1.0 (Build++)
 *  node tools/bump-version.js major    -> 1.0.0 -> 2.0.0 (Build++)
 *  node tools/bump-version.js 1.2.3    -> sets explicit version (Build++)
 *  node tools/bump-version.js sync     -> keeps version, updates all targets & date
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const PKG_PATH = path.join(ROOT, "package.json");
const GRADLE_PATH = path.join(ROOT, "android", "app", "build.gradle");
const TAURI_PATH = path.join(ROOT, "src-tauri", "tauri.conf.json");
const VERSION_JS_PATH = path.join(ROOT, "src", "version.js");

function getTodayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseSemVer(v) {
  const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) throw new Error(`Invalid SemVer format: "${v}"`);
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || "",
  };
}

function calculateNextVersion(currentVersion, bumpType) {
  if (bumpType === "sync") return currentVersion;
  if (/^\d+\.\d+\.\d+/.test(bumpType)) return bumpType;

  const { major, minor, patch } = parseSemVer(currentVersion);
  switch (bumpType) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

function readAndroidBuildGradle() {
  if (!fs.existsSync(GRADLE_PATH)) return { versionCode: 1, versionName: "1.0.0" };
  const content = fs.readFileSync(GRADLE_PATH, "utf-8");
  const codeMatch = content.match(/versionCode\s+(\d+)/);
  const nameMatch = content.match(/versionName\s+["']([^"']+)["']/);
  return {
    versionCode: codeMatch ? parseInt(codeMatch[1], 10) : 1,
    versionName: nameMatch ? nameMatch[1] : "1.0.0",
  };
}

function updateAndroidBuildGradle(nextCode, nextVersion) {
  if (!fs.existsSync(GRADLE_PATH)) {
    console.warn("⚠️  android/app/build.gradle not found, skipping Android.");
    return false;
  }
  let content = fs.readFileSync(GRADLE_PATH, "utf-8");
  content = content.replace(/versionCode\s+\d+/, `versionCode ${nextCode}`);
  content = content.replace(/versionName\s+["'][^"']+["']/, `versionName "${nextVersion}"`);
  fs.writeFileSync(GRADLE_PATH, content, "utf-8");
  return true;
}

function updateTauriConf(nextVersion) {
  if (!fs.existsSync(TAURI_PATH)) {
    console.warn("⚠️  src-tauri/tauri.conf.json not found, skipping Desktop Tauri.");
    return false;
  }
  const raw = fs.readFileSync(TAURI_PATH, "utf-8");
  const json = JSON.parse(raw);
  json.version = nextVersion;
  fs.writeFileSync(TAURI_PATH, JSON.stringify(json, null, 2) + "\n", "utf-8");
  return true;
}

function updateVersionJs(nextVersion, nextCode, today) {
  const content = `/**
 * Centralized Global Version & Build Metadata for WILSONIX MIDIKEY
 * Auto-synchronized across Main Web, Android (Capacitor/Gradle), and Desktop (Tauri).
 * Updated via: npm run version:patch | npm run version:minor | npm run version:major
 */

export const APP_VERSION = "${nextVersion}";
export const BUILD_NUMBER = ${nextCode};
export const BUILD_DATE = "${today}";
export const APP_TITLE = "WILSONIX MIDIKEY";
export const APP_ID = "com.wilsonix.midikey";

export function getFullVersionString() {
  return \`\${APP_TITLE} v\${APP_VERSION} (Build \${BUILD_NUMBER} • \${BUILD_DATE})\`;
}
`;
  fs.writeFileSync(VERSION_JS_PATH, content, "utf-8");
}

function main() {
  const arg = process.argv[2] || "patch";

  // 1. Read current package.json
  const pkgRaw = fs.readFileSync(PKG_PATH, "utf-8");
  const pkg = JSON.parse(pkgRaw);
  const currentVersion = pkg.version || "1.0.0";

  // 2. Read current Android versionCode
  const { versionCode: currentCode } = readAndroidBuildGradle();

  // 3. Compute next version & versionCode
  const nextVersion = calculateNextVersion(currentVersion, arg);
  const isSync = arg === "sync";
  const nextCode = isSync ? currentCode : currentCode + 1;
  const today = getTodayString();

  console.log(`\n======================================================`);
  console.log(`🚀 WILSONIX MIDIKEY - GLOBAL VERSION SYNCHRONIZER`);
  console.log(`======================================================`);
  console.log(`Mode:           ${arg}`);
  console.log(`Version:        ${currentVersion} -> ${nextVersion}`);
  console.log(`Build Number:   ${currentCode} -> ${nextCode}`);
  console.log(`Build Date:     ${today}`);
  console.log(`------------------------------------------------------`);

  // 4. Update package.json
  pkg.version = nextVersion;
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  console.log(`✓ Updated package.json (${nextVersion})`);

  // 5. Update android/app/build.gradle
  if (updateAndroidBuildGradle(nextCode, nextVersion)) {
    console.log(`✓ Updated android/app/build.gradle (versionCode ${nextCode}, versionName "${nextVersion}")`);
  }

  // 6. Update src-tauri/tauri.conf.json
  if (updateTauriConf(nextVersion)) {
    console.log(`✓ Updated src-tauri/tauri.conf.json (${nextVersion})`);
  }

  // 7. Update src/version.js
  updateVersionJs(nextVersion, nextCode, today);
  console.log(`✓ Updated src/version.js (v${nextVersion}b${nextCode})`);

  console.log(`------------------------------------------------------`);
  console.log(`🎉 All platforms (Web, Android, Desktop) successfully synchronized!`);
  console.log(`======================================================\n`);
}

main();
