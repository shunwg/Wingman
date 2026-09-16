/**
 * Screenshot the app.
 *
 *     npm run shoot -- [url] [outDir]
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
      { name: 'mobile', width: 402, height: 874 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1440, height: 900 },
    ]
  : [{ name: 'mobile', width: 402, height: 874 }];

const THEMES = (process.env.SHOOT_ALL || process.env.SHOOT_DARK ? ['light', 'dark'] : ['light']) as ('light' | 'dark')[];

/**
 * `fresh` routes are the doors: they need a blank store, and signup needs the
 * person to have pressed "Create my profile" first. Everything else is shot
 * as the seeded demo, entered through #/demo.
 */
const ROUTES: {
  name: string;
  hash: string;
  fresh?: boolean;
  /**
   * A button to press after arriving, before capturing.
   *
   * The board's lens is store state rather than part of the URL, so the only
   * honest way to photograph the shared-cars board is to press the chip a
   * person would press. A query parameter would have photographed a screen
   * that does not exist.
   */
  press?: string;
}[] = [
  { name: 'welcome', hash: '#/welcome', fresh: true },
  { name: 'signup-about', hash: '#/signup/about', fresh: true },
  { name: 'signup-privacy', hash: '#/signup/privacy', fresh: true },
  { name: 'signup-verify', hash: '#/signup/verify', fresh: true },
  { name: 'signup-trip', hash: '#/signup/trip', fresh: true },
  { name: 'home', hash: '#/' },
  { name: 'discover', hash: '#/discover' },
  { name: 'person', hash: '#/person/jonas' },
  { name: 'inbox', hash: '#/inbox' },
  { name: 'channel-circle', hash: '#/inbox/circle:insead' },
  { name: 'channel-group', hash: '#/inbox/group:insead-singapore' },
  { name: 'trip', hash: '#/trip' },
  { name: 'trip-new', hash: '#/trip/new' },
  // Shared cars. The board lens is a separate shot from the default board
  // because it renders a different kind of card, and a persona reviewing
  // screenshots can only react to what is actually in one.
  { name: 'discover-cars', hash: '#/discover', press: 'Shared cars' },
  { name: 'car-join', hash: '#/car/ride_mira_tiong' },
  { name: 'car-circle', hash: '#/car/ride_jonas_marina' },
  { name: 'car-host', hash: '#/car/ride_you_cph' },
  { name: 'circles', hash: '#/circles' },
  { name: 'circle', hash: '#/circles/gridweek' },
  { name: 'circles-new', hash: '#/circles/new' },
  { name: 'you', hash: '#/you' },
  { name: 'you-edit', hash: '#/you/edit' },
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
      // 1x keeps a full-page capture under 300 KB, which is what docs/media/
      // wants. SHOOT_RETINA=1 for pixel-peeping.
      deviceScaleFactor: process.env.SHOOT_RETINA ? 2 : 1,
    });
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${vp.name}] ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`[${vp.name}] ${String(e)}`));

    let mode: 'fresh' | 'demo' | null = null;
    for (const route of ROUTES) {
      const want = route.fresh ? 'fresh' : 'demo';
      if (mode !== want) {
        if (want === 'fresh') {
          await page.goto(`${BASE}/#/welcome`, { waitUntil: 'networkidle' });
          await page.evaluate(() => localStorage.clear());
          await page.goto(`${BASE}/#/welcome`, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'Create my profile' }).click();
          await page.waitForURL(/signup/);
        } else {
          await page.goto(`${BASE}/#/demo`, { waitUntil: 'networkidle' });
          await page.waitForURL(/#\/$/);
        }
        mode = want;
      }
      await page.goto(`${BASE}/${route.hash}`, { waitUntil: 'networkidle' });
      if (route.press) {
        await page.getByRole('button', { name: route.press, exact: true }).click();
        await page.waitForTimeout(150);
      }
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
