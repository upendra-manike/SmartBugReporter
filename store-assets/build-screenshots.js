'use strict';

// Simple CLI:
//   node store-assets/build-screenshots.js /absolute/path/to/source.png
//
// It will produce two files next to the source:
//   - <name>-1280x800.png
//   - <name>-640x400.png
//
// Both are 24‑bit PNG (no alpha), suitable for Chrome Web Store screenshots.

const path = require('path');
const sharp = require('sharp');

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node store-assets/build-screenshots.js /absolute/path/to/source.png');
    process.exit(1);
  }

  const srcPath = path.resolve(input);
  const dir = path.dirname(srcPath);
  const base = path.basename(srcPath, path.extname(srcPath));

  const targets = [
    { width: 1280, height: 800 },
    { width: 640, height: 400 }
  ];

  for (const t of targets) {
    const outPath = path.join(dir, `${base}-${t.width}x${t.height}.png`);
    // Resize and remove alpha (flatten to white background) so it is 24‑bit PNG.
    // fit: 'cover' keeps aspect ratio and fills the whole size.
    await sharp(srcPath)
      .resize(t.width, t.height, { fit: 'cover' })
      .flatten({ background: '#ffffff' })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    // eslint-disable-next-line no-console
    console.log('Written:', outPath);
  }
}

main().catch((err) => {
  console.error('Failed to build screenshots:', err && err.message ? err.message : err);
  process.exit(1);
});

