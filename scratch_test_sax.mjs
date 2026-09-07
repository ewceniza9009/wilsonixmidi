import fs from 'fs';

const sfContent = fs.readFileSync('./public/soundfonts/alto_sax-mp3.js', 'utf8');
const fn = new Function('MIDI', sfContent);
const MIDI = { Soundfont: {} };
fn(MIDI);
const sf = MIDI.Soundfont.alto_sax;

const firstVal = Object.values(sf)[0];
let identicalCount = 0;
let total = 0;
for (const [k, v] of Object.entries(sf)) {
  total++;
  if (v === firstVal) {
    identicalCount++;
  }
}
console.log(`Out of ${total} notes in alto_sax-mp3.js, ${identicalCount} are identical to the first note!`);
