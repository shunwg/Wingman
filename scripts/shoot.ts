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

type Step = { press: string; within?: string; exact?: boolean } | { goto: string } | { wait: number };

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
  /**
   * Shoot this route as a real signed-up account rather than the demo.
   *
   * Three persona walks independently concluded the app had lost its account
   * deletion control. It had not — `YouScreen` shows "Reset the demo" in demo
   * mode and "Delete my profile" plus a confirmation sheet for a real profile,
   * which is exactly what the previous round asked for. Every screenshot was
   * demo-mode, so the review set could not show the control that exists, and
   * three reviewers agreed on the same wrong answer.
   *
   * A blind spot three independent reviewers share is not a reviewer problem.
   */
  account?: boolean;
  /**
   * A short walk to reach a state no URL can name — a plan agreed in a room, a
   * seat taken, a yes arriving. Run in order after arriving at `hash`, and the
   * demo's state carries forward to the routes after it, so their order is
   * part of the script.
   */
  steps?: Step[];
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
  // The same screen as a real profile: this is the one that carries "Delete my
  // profile" and the confirmation sheet behind it.
  // v9 — states reached by doing, in the order a person would do them.
  // First: saying yes to Priya settles tonight's trip, and a settled trip
  // stops suggesting people — by design — so Jonas must be greeted before.
  {
    name: 'home-said-yes',
    hash: '#/person/jonas',
    steps: [
      { press: 'Say hello' },
      { press: 'Share the ride in', within: '.sheet', exact: true },
      { press: 'Say hello', within: '.sheet' },
      { goto: '#/' },
      // The demo answers after DEMO_ANSWER_MS; give it a margin.
      { wait: 5500 },
    ],
  },
  {
    name: 'room-offer',
    hash: '#/inbox',
    steps: [{ press: 'Yes', exact: true }, { press: 'Yes, meet', within: '.sheet' }],
  },
  { name: 'room-plan', hash: '#/inbox/meet:req_seed_priya', steps: [{ press: 'That works' }] },
  { name: 'propose', hash: '#/inbox/meet:req_seed_priya', steps: [{ press: 'Change time' }] },
  // A change agreed: the plan moves and the old card steps back.
  {
    name: 'room-changed',
    hash: '#/inbox/meet:req_seed_priya',
    steps: [{ press: 'Change time' }, { press: 'Suggest', within: '.sheet', exact: true }],
  },
  // "Can't make it" with a plan standing: the strip says so, the call-off is offered.
  { name: 'room-cant', hash: '#/inbox/meet:req_seed_priya', steps: [{ press: "Can't make it" }] },
  { name: 'car-seated', hash: '#/car/ride_jonas_marina', steps: [{ press: 'Take the seat' }] },
  { name: 'trip-plans', hash: '#/trip' },
  { name: 'room-car', hash: '#/inbox/ride:ride_jonas_marina' },
  { name: 'car-fare', hash: '#/car/ride_you_cph', steps: [{ press: 'Add an estimate' }] },
  // Last, because it ends your car for every route after it.
  {
    name: 'car-called-off',
    hash: '#/car/ride_you_cph',
    steps: [{ press: 'Call off the car' }, { press: 'Call it off', within: '.sheet', exact: true }],
  },
  { name: 'you-account', hash: '#/you', account: true },
  // The internal component gallery — every primitive and animation on one
  // tall page. Not a product screen, and it crashes the renderer at full-page
  // size; SHOOT_GALLERY=1 to include it.
  ...(process.env.SHOOT_GALLERY ? [{ name: 'design', hash: '#/_design' }] : []),
];

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, theme);
  // Let the token swap paint before capturing.
  await page.waitForTimeout(120);
}

/**
 * Wait until the screen has actually rendered.
 *
 * A hash change is a same-document navigation, so `networkidle` resolves
 * before the route's lazy chunk has even been requested — and the router's
 * Suspense boundary paints nothing in that gap. Fourteen light captures came
 * out as the same blank 2,835-byte frame that way, and two persona walks were
 * run against them before anyone noticed. Wait for text on the page instead.
 */
async function painted(page: Page): Promise<void> {
  // The screen's own content, not the page's: once Suspense moved inside the
  // shell, the tab bar's labels alone passed a whole-page text check and seven
  // captures came out as a header and a tab bar. `#main` holds only the screen.
  // Door screens (welcome, signup) render without the shell, so fall back to
  // the root for those.
  await page.waitForFunction(
    () => {
      const main = document.getElementById('main');
      const text = (main ?? document.getElementById('root'))?.innerText.trim() ?? '';
      return text.length > 20;
    },
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForLoadState('networkidle');
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

    let mode: 'fresh' | 'demo' | 'account' | null = null;
    for (const route of ROUTES) {
      const want = route.fresh ? 'fresh' : route.account ? 'account' : 'demo';
      if (mode !== want) {
        if (want === 'fresh') {
          await page.goto(`${BASE}/#/welcome`, { waitUntil: 'networkidle' });
          await page.evaluate(() => localStorage.clear());
          await page.goto(`${BASE}/#/welcome`, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'Create my profile' }).click();
          await page.waitForURL(/signup/);
        } else if (want === 'account') {
          /*
           * The seeded world, held by a real profile rather than the demo.
           *
           * Set on the persisted blob instead of walked through signup: the
           * only thing this mode exists to photograph is a screen whose
           * content depends on `account.mode`, and driving six signup steps
           * to get there made the capture depend on the welcome carousel's
           * animation timing — which is how it broke the first time.
           */
          await page.goto(`${BASE}/#/demo`, { waitUntil: 'networkidle' });
          await page.waitForURL(/#\/$/);
          await page.evaluate(() => {
            const raw = localStorage.getItem('wingman');
            if (!raw) throw new Error('no persisted store to promote');
            const blob = JSON.parse(raw) as { state: { account: { mode: string } } };
            blob.state.account.mode = 'local';
            localStorage.setItem('wingman', JSON.stringify(blob));
          });
          await page.reload({ waitUntil: 'networkidle' });
        } else {
          await page.goto(`${BASE}/#/demo`, { waitUntil: 'networkidle' });
          // Over a real profile the demo link now asks first — which is the
          // point of it. The script is replacing its own capture account.
          const replace = page.getByRole('button', { name: 'Replace it with the demo' });
          // Whichever comes first: straight through to the board, or the question.
          await Promise.race([
            page.waitForURL(/#\/$/, { timeout: 15_000 }),
            replace.waitFor({ state: 'visible', timeout: 15_000 }).then(() => replace.click()),
          ]);
          await page.waitForURL(/#\/$/);
        }
        mode = want;
      }
      // Same hash as the page is on: a same-document navigation remounts
      // nothing, so a sheet left open by the previous shot stays open and
      // swallows the next tap. Leave first, then come back.
      if (page.url().endsWith(route.hash)) {
        await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
        await painted(page);
      }
      await page.goto(`${BASE}/${route.hash}`, { waitUntil: 'networkidle' });
      await painted(page);
      if (route.press) {
        await page.getByRole('button', { name: route.press, exact: true }).click();
        await page.waitForTimeout(150);
      }
      for (const step of route.steps ?? []) {
        if ('goto' in step) {
          await page.goto(`${BASE}/${step.goto}`, { waitUntil: 'networkidle' });
          await painted(page);
        } else if ('wait' in step) {
          await page.waitForTimeout(step.wait);
        } else {
          const scope = step.within ? page.locator(step.within) : page;
          await scope.getByRole('button', { name: step.press, exact: step.exact ?? false }).first().click();
          await page.waitForTimeout(250);
        }
      }
      // Webfonts change metrics; waiting avoids capturing a fallback-font frame.
      await page.evaluate(() => document.fonts.ready);
      /*
       * Wait for the screen transition to finish, not for a guessed 200ms.
       *
       * A design review caught `car-join` captured mid-fade — `<main>`
       * composited at exactly 65% opacity, every token visibly washed out.
       * The review set is the render-and-inspect gate, so a frame that is not
       * the shipped state means the gate inspected something that never
       * existed. `getAnimations()` knows when it is actually done.
       */
      await page.evaluate(async () => {
        const running = document
          .getAnimations()
          .filter((a) => a.playState === 'running')
          .map((a) => a.finished.catch(() => undefined));
        await Promise.all(running);
      });
      await page.waitForTimeout(120);

      const heights: number[] = [];
      for (const theme of THEMES) {
        await setTheme(page, theme);
        heights.push(await page.evaluate(() => document.documentElement.scrollHeight));
        const file = join(OUT, `${route.name}-${vp.name}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`  ${file.replace(OUT, 'docs/shots')}`);
      }
      // Two themes of one screen are the same height. When they are not, one
      // was captured while the screen was still loading — fail loudly rather
      // than hand reviewers a frame that never existed.
      if (heights.length > 1 && Math.abs(heights[0]! - heights[1]!) > 40) {
        errors.push(`[${vp.name}] ${route.name}: light ${heights[0]}px vs dark ${heights[1]}px — captured mid-load`);
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
