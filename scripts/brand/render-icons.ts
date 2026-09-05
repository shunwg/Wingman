/**
 * The app icons, rendered from the one SVG that is the brand mark.
 *
 *     npm run brand:icons
 *
 * A PNG in the repo that nobody can regenerate is a PNG nobody dares change.
 * So the icons are built from src/design/brand/logo.svg with the same Chromium
 * the screenshots use, on the canvas token, and the maskable variant keeps the
 * mark inside the 40 % safe zone Android crops to.
 */

import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const svg = readFileSync(join(root, 'src', 'design', 'brand', 'logo.svg'), 'utf8')
  // The favicon swaps stroke colour with the OS theme; an app icon is always on
  // the light canvas, so pin the ink.
  .replace(/<style>[\s\S]*?<\/style>/, '<style>path{stroke:#141110}</style>');

const ICONS: { file: string; size: number; markRatio: number }[] = [
  { file: 'icon-192.png', size: 192, markRatio: 0.62 },
  { file: 'icon-512.png', size: 512, markRatio: 0.62 },
  { file: 'apple-touch-icon.png', size: 180, markRatio: 0.62 },
  { file: 'maskable-512.png', size: 512, markRatio: 0.42 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

for (const icon of ICONS) {
  const mark = Math.round(icon.size * icon.markRatio);
  const sized = svg.replace('<svg ', `<svg width="${mark}" height="${mark}" `);
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:#fbf9f7;width:${icon.size}px;height:${icon.size}px;display:grid;place-items:center">` +
      `<div style="width:${mark}px;height:${mark}px">${sized}</div></body></html>`,
  );
  const out = join(root, 'public', 'icons', icon.file);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: icon.size, height: icon.size } });
  console.log(`  public/icons/${icon.file} (${icon.size}px)`);
}

await browser.close();
