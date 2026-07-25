import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const iconsDir = path.join(root, 'apps/web/public/brand/icons');
const assetsDir = path.join(root, 'apps/mobile/ios/App/App/Assets.xcassets');

const iconStyles = [
  { style: 'mono-dark', appiconset: 'AppIcon.appiconset', prefix: 'AppIcon' },
  { style: 'mono-light', appiconset: 'MonoLightIcon.appiconset', prefix: 'MonoLightIcon' },
];

/** Opaque backgrounds for flattening — iOS alternate icons must not have alpha. */
const styleBackgrounds = {
  'mono-dark': '#0B0B0C',
  'mono-light': '#F4F4F3',
};

/** All iOS icon slots — alternate icons need every size, not just 1024. */
const iosIconSlots = [
  { idiom: 'iphone', size: '20x20', scale: '2x', px: 40 },
  { idiom: 'iphone', size: '20x20', scale: '3x', px: 60 },
  { idiom: 'iphone', size: '29x29', scale: '2x', px: 58 },
  { idiom: 'iphone', size: '29x29', scale: '3x', px: 87 },
  { idiom: 'iphone', size: '40x40', scale: '2x', px: 80 },
  { idiom: 'iphone', size: '40x40', scale: '3x', px: 120 },
  { idiom: 'iphone', size: '60x60', scale: '2x', px: 120 },
  { idiom: 'iphone', size: '60x60', scale: '3x', px: 180 },
  { idiom: 'ipad', size: '20x20', scale: '1x', px: 20 },
  { idiom: 'ipad', size: '20x20', scale: '2x', px: 40 },
  { idiom: 'ipad', size: '29x29', scale: '1x', px: 29 },
  { idiom: 'ipad', size: '29x29', scale: '2x', px: 58 },
  { idiom: 'ipad', size: '40x40', scale: '1x', px: 40 },
  { idiom: 'ipad', size: '40x40', scale: '2x', px: 80 },
  { idiom: 'ipad', size: '76x76', scale: '1x', px: 76 },
  { idiom: 'ipad', size: '76x76', scale: '2x', px: 152 },
  { idiom: 'ipad', size: '83.5x83.5', scale: '2x', px: 167 },
  { idiom: 'ios-marketing', size: '1024x1024', scale: '1x', px: 1024 },
];

const webOutputs = [
  { file: path.join(root, 'apps/web/public/brand/apple-touch-icon.png'), svg: 'mono-dark.svg', size: 180 },
  { file: path.join(root, 'apps/web/public/brand/favicon-32.png'), svg: 'mono-dark.svg', size: 32 },
  { file: path.join(root, 'apps/desktop/build/icon.png'), svg: 'mono-dark.svg', size: 1024 },
];

for (const { style, appiconset, prefix } of iconStyles) {
  const svgPath = path.join(iconsDir, `${style}.svg`);
  const outDir = path.join(assetsDir, appiconset);
  await mkdir(outDir, { recursive: true });
  const bg = styleBackgrounds[style] ?? '#0B0B0C';

  const contentsImages = [];
  for (const slot of iosIconSlots) {
    const filename = `${prefix}-${slot.size}@${slot.scale}.png`;
    const outFile = path.join(outDir, filename);
    let pipeline = sharp(svgPath).resize(slot.px, slot.px).flatten({ background: bg });
    await pipeline.png().toFile(outFile);
    contentsImages.push({
      filename,
      idiom: slot.idiom,
      scale: slot.scale,
      size: slot.size,
    });
    console.log(`wrote ${path.relative(root, outFile)} (${slot.px}px, ${style})`);
  }

  const contents = {
    images: contentsImages,
    info: { author: 'xcode', version: 1 },
  };
  await writeFile(path.join(outDir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);
}

for (const { file, svg, size } of webOutputs) {
  const svgPath = path.join(iconsDir, svg);
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(svgPath).resize(size, size).png().toFile(file);
  console.log(`wrote ${path.relative(root, file)} (${size}px)`);
}

await copyFile(
  path.join(iconsDir, 'mono-dark.svg'),
  path.join(root, 'apps/web/public/brand/app-icon.svg'),
);

console.log('Brand icons generated.');
