import sharp from 'sharp';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const logoPath = join(root, 'logo.png');
const outRes = join(root, 'res');

const BRAND = '#141210';
const ACCENT = '#e85d04';
const LOGO_SCALE_LEGACY = 0.80;
const LOGO_SCALE_FOREGROUND = 0.67;
const LOGO_SCALE_SPLASH = 0.38;

const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const LAUNCHER_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FG_SIZES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

const SPLASH = {
  'drawable': [480, 320],
  'drawable-land-mdpi': [480, 320],
  'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960],
  'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920],
};

const logo = sharp(logoPath);

function maskSvg(size, shape) {
  const r = Math.round(size * 0.2);
  if (shape === 'circle') {
    const c = size / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${c}" cy="${c}" r="${c}" fill="white"/>
    </svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${r}"/>
  </svg>`;
}

function coloredCanvas(size, color) {
  return sharp({
    create: { width: size, height: size, channels: 4, background: color },
  }).png();
}

async function generateLegacy(size, shape, file) {
  const logoSize = Math.round(size * LOGO_SCALE_LEGACY);
  const logoBuf = await logo
    .clone()
    .resize(logoSize, logoSize, { fit: 'cover' })
    .toBuffer();
  const mask = await sharp(Buffer.from(maskSvg(size, shape))).toBuffer();
  const canvas = await coloredCanvas(size, BRAND).png().toBuffer();
  await sharp(canvas)
    .composite([{ input: logoBuf, gravity: 'center' }])
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(file);
}

async function generateForeground(size, file) {
  const logoSize = Math.round(size * LOGO_SCALE_FOREGROUND);
  const logoBuf = await logo
    .clone()
    .resize(logoSize, logoSize, { fit: 'cover' })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: '#00000000' },
  })
    .composite([{ input: logoBuf, gravity: 'center' }])
    .png()
    .toFile(file);
}

async function generateSplash(dir, w, h, file) {
  const min = Math.min(w, h);
  const logoSize = Math.round(min * LOGO_SCALE_SPLASH);
  const logoBuf = await logo
    .clone()
    .resize(logoSize, logoSize, { fit: 'cover' })
    .toBuffer();
  await sharp({
    create: { width: w, height: h, channels: 4, background: BRAND },
  })
    .composite([{ input: logoBuf, gravity: 'center' }])
    .png()
    .toFile(file);
}

async function main() {
  for (const d of DENSITIES) {
    const mip = join(outRes, `mipmap-${d}`);
    mkdirSync(mip, { recursive: true });
    await generateLegacy(LAUNCHER_SIZES[d], 'rect', join(mip, 'ic_launcher.png'));
    await generateLegacy(LAUNCHER_SIZES[d], 'circle', join(mip, 'ic_launcher_round.png'));
    await generateForeground(FG_SIZES[d], join(mip, 'ic_launcher_foreground.png'));
    console.log(`res/mipmap-${d}: launcher ${LAUNCHER_SIZES[d]}px, round ${LAUNCHER_SIZES[d]}px, foreground ${FG_SIZES[d]}px`);
  }
  for (const [dir, [w, h]] of Object.entries(SPLASH)) {
    mkdirSync(join(outRes, dir), { recursive: true });
    await generateSplash(dir, w, h, join(outRes, dir, 'splash.png'));
  }
  console.log('splash: generated ' + Object.keys(SPLASH).length + ' variants');
  console.log('done -> ' + outRes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});