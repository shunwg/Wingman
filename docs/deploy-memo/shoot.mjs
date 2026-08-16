/**
 * Look at the memo before shipping it. Screens in both themes, plus a print-media
 * capture so the A4 is checked as paper rather than as a web page.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const url = `file://${join(here, 'memo.html').replace(/\\/g, '/')}`;
const shot = (n) => join(here, 'shots', n);

const browser = await chromium.launch();

for (const [name, scheme] of [
  ['light', 'light'],
  ['dark', 'dark'],
]) {
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: shot(`memo-${name}-top.png`) });
  // The calculator is the one piece that has to be looked at, not reasoned about.
  await page.locator('#costs').scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await page.screenshot({ path: shot(`memo-${name}-costs.png`) });
  await page.close();
}

// Paper check: print media, light tokens, no interactive chrome.
const p = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await p.emulateMedia({ media: 'print', colorScheme: 'light' });
await p.goto(url, { waitUntil: 'networkidle' });
await p.screenshot({ path: shot('memo-print-top.png') });
await p.close();

await browser.close();
console.log('shots written');
