/**
 * Screenshot the app.
 *
 *     npx tsx scripts/shoot.ts [url] [outDir]
 *
 * Assumes a dev server is already running (`npm run dev`). Shoots each route at
 * three viewports in both themes, because a design that has only ever been seen
 * at one width in one theme is a design with two untested halves.
 */

import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const OUT =
  process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'shots');

const VIEWPORTS = process.env.SHOOT_ALL
  ? [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1440, height: 900 },
    ]
  : [{ name: 'mobile', width: 390, height: 844 }];

const THEMES = (process.env.SHOOT_ALL ? ['light', 'dark'] : ['light']) as ('light' | 'dark')[];

const ROUTES = [
  { name: 'discover', hash: '#/' },
  { name: 'person', hash: '#/person/jonas' },
  { name: 'requests', hash: '#/requests' },
  { name: 'trip', hash: '#/trip' },
  { name: 'circles', hash: '#/circles' },
  { name: 'you', hash: '#/you' },
  { name: 'design', hash: '#/_design' },
];

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, theme);
  // Let the token swap paint before capturing.
  await page.waitForTimeout(120);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const errors: string[] = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${vp.name}] ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`[${vp.name}] ${String(e)}`));

    for (const route of ROUTES) {
      await page.goto(`${BASE}/${route.hash}`, { waitUntil: 'networkidle' });
      // Webfonts change metrics; waiting avoids capturing a fallback-font frame.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);

      for (const theme of THEMES) {
        await setTheme(page, theme);
        const file = join(OUT, `${route.name}-${vp.name}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`  ${file.replace(OUT, 'docs/shots')}`);
      }
    }

    await context.close();
  }

  await browser.close();

  if (errors.length > 0) {
    console.error(`\nConsole errors (${errors.length}):`);
    for (const e of errors) console.error(`  · ${e}`);
    process.exit(1);
  }
  console.log('\nNo console errors.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
