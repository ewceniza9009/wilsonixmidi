import fs from "fs";
import path from "path";

const content = fs.readFileSync("src/audio/demo-songs.js", "utf8");
const lines = content.split("\n");

const songs = [];
let songStart = null;
let currentId = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const idMatch = line.match(/^\s+id:\s*"([^"]+)"/);
  if (idMatch) {
    if (!songStart) songStart = i - 1;
    currentId = idMatch[1];
  }
  if (currentId && songStart !== null && lines[i].trim() === "},") {
    songs.push({ id: currentId, start: songStart, end: i });
    songStart = null;
    currentId = null;
  }
}

const outDir = "src/audio/demo-songs";
fs.mkdirSync(outDir, { recursive: true });

const imports = [];
for (const song of songs) {
  let songLines = lines.slice(song.start, song.end + 1).join("\n");
  // Strip trailing comma from "}," to make standalone object valid
  songLines = songLines.replace(/,\s*$/, "");
  const exportStr = `/**\n * Demo: ${song.id}\n */\nexport const song = ${songLines.trimEnd()};\n`;
  fs.writeFileSync(path.join(outDir, `${song.id}.js`), exportStr);
  imports.push(song.id);
}

const indexLines = [
  "/**",
  " * Demo Song Library — index",
  " */",
  ...imports.map(id => `import { song as ${id.replace(/[^a-z0-9]/gi, "_")} } from "./${id}.js";`),
  "",
  "export const DEMO_SONGS = [",
  ...imports.map(id => `  ${id.replace(/[^a-z0-9]/gi, "_")},`),
  "];",
  "",
];
fs.writeFileSync(path.join(outDir, "index.js"), indexLines.join("\n"));

console.log(`Wrote ${songs.length} song files + index.js`);
