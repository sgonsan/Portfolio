// Generates public/assets/preview.png — the Open Graph / Twitter card image.
// Synthesises a terminal-style card from the site's own content (defaults.js)
// and the current profile photo, so the share preview always matches the
// landing's branding. Runs in the build step; no headless browser needed.

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { DEFAULT_CONTENT } = require('../server/lib/defaults');

const WIDTH = 1200;
const HEIGHT = 630;
const ASSETS = path.join(__dirname, '../public/assets');
const PHOTO = path.join(ASSETS, 'personal-foto.jpg');
const OUT = path.join(ASSETS, 'preview.png');

// Palette lifted from src/styles/global.css (dark theme).
const C = {
  bg: '#0a0a0a',
  card: '#161616',
  border: '#2a2a2a',
  text: '#e5e5e5',
  dim: '#888888',
  accent: '#ad58df',
  green: '#5fff87'
};

const PHOTO_D = 300; // circular photo diameter

// XML-escape any string that lands inside the SVG.
const esc = (s) =>
  String(s).replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])
  );

function buildSvg({ name, languages, url, hasPhoto }) {
  const textRight = hasPhoto ? WIDTH - PHOTO_D - 160 : WIDTH - 160;
  // librsvg ignores textLength, so size the name to fit the available width.
  // Monospace advance width ≈ 0.6em, so width ≈ chars * 0.6 * fontSize.
  const avail = textRight - 80;
  const nameSize = Math.min(66, Math.floor(avail / (Math.max(name.length, 1) * 0.6)));
  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"
       xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${C.bg}"/>
  <rect x="40" y="40" width="${WIDTH - 80}" height="${HEIGHT - 80}" rx="16"
        fill="${C.card}" stroke="${C.border}" stroke-width="2"/>

  <!-- window chrome -->
  <circle cx="80"  cy="84" r="9" fill="#ff5f5f"/>
  <circle cx="112" cy="84" r="9" fill="#ffd95f"/>
  <circle cx="144" cy="84" r="9" fill="#5fff87"/>
  <text x="184" y="90" font-family="monospace" font-size="22" fill="${C.dim}">~/portfolio</text>

  <g font-family="monospace">
    <text x="80" y="220" font-size="30">
      <tspan fill="${C.accent}">sergio@elbiti</tspan><tspan fill="${C.dim}">:</tspan><tspan fill="${C.green}">~</tspan><tspan fill="${C.dim}">$ whoami</tspan>
    </text>
    <text x="80" y="320" font-size="${nameSize}" font-weight="bold" fill="${C.text}">${esc(name)}</text>
    <text x="80" y="384" font-size="30" fill="${C.dim}">${esc(languages)}</text>
    <text x="80" y="${HEIGHT - 90}" font-size="26" fill="${C.accent}">${esc(url)}</text>
  </g>
</svg>`;
}

async function circularPhoto() {
  if (!fs.existsSync(PHOTO)) return null;
  const mask = Buffer.from(
    `<svg width="${PHOTO_D}" height="${PHOTO_D}"><circle cx="${PHOTO_D / 2}" cy="${PHOTO_D / 2}" r="${PHOTO_D / 2}" fill="#fff"/></svg>`
  );
  return sharp(PHOTO)
    .resize(PHOTO_D, PHOTO_D, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function main() {
  const name = DEFAULT_CONTENT.about.name;
  const langs = DEFAULT_CONTENT.skills.groups[0]?.items ?? [];
  const languages = langs.join(' · ');
  const url = (DEFAULT_CONTENT.meta.site_url || 'https://elbiti.com').replace(/^https?:\/\//, '');

  const photo = await circularPhoto();
  const svg = Buffer.from(buildSvg({ name, languages, url, hasPhoto: !!photo }));

  const composites = [];
  if (photo) {
    composites.push({
      input: photo,
      left: WIDTH - PHOTO_D - 110,
      top: Math.round((HEIGHT - PHOTO_D) / 2)
    });
  }

  await sharp(svg).composite(composites).png().toFile(OUT);
  console.log(`preview.png generated (${WIDTH}x${HEIGHT})${photo ? '' : ' — no photo found, text-only'}`);
}

main().catch((err) => {
  // Never fail the build over a preview image; warn and move on.
  console.error('preview.png generation failed:', err.message);
});
