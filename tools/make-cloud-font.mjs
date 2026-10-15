// Converts a .woff font into the three.js "typeface" JSON used for the cloud lettering, keeping only the
// characters we need (small file). Usage: node tools/make-cloud-font.mjs "До свадьбы осталось" [font package] [weight]
import { readFileSync, writeFileSync } from 'node:fs';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';

const text = process.argv[2] || 'До свадьбы осталось';
const family = process.argv[3] || 'nunito', weight = process.argv[4] || '900';
const sources = ['cyrillic', 'latin'].map((sub) => `node_modules/@fontsource/${family}/files/${family}-${sub}-${weight}-normal.woff`);
const out = { glyphs: {} };
for (const file of sources) {
  const buf = readFileSync(file);
  const json = new TTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  for (const ch of new Set(text)) if (json.glyphs[ch] && !out.glyphs[ch]) out.glyphs[ch] = json.glyphs[ch];
  for (const k of ['familyName', 'ascender', 'descender', 'underlinePosition', 'underlineThickness', 'boundingBox', 'resolution', 'original_font_information']) {
    if (out[k] === undefined) out[k] = json[k];
  }
}
// space: no outline, only an advance
if (!out.glyphs[' ']) out.glyphs[' '] = { ha: Math.round(out.resolution * 0.28), x_min: 0, x_max: 0, o: '' };
const missing = [...new Set(text)].filter((c) => !out.glyphs[c]);
writeFileSync('public/assets/fonts/cloud-title.typeface.json', JSON.stringify(out));
console.log(`glyphs: ${Object.keys(out.glyphs).join('')}  missing: ${missing.join('') || 'none'}`);
