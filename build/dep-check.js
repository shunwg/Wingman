const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const url = 'file://' + path.join(__dirname, '..', 'wingman.html');
  await page.goto(url); await page.waitForTimeout(600);
  await page.click('button[data-dir="departing"]'); await page.waitForTimeout(400);
  await page.click('[data-action="demo-flight"]'); await page.waitForTimeout(300);
  await page.click('#submit-trip'); await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(__dirname, '17-departing-board.png') });
  // join noa (reciprocates 11s) → passlock
  await page.goto(url + '#/match/noa'); await page.waitForTimeout(600);
  await page.click('[data-action="join-open"]'); await page.waitForTimeout(300);
  await page.click('[data-action="join"]'); await page.waitForTimeout(13000 + 4200);
  await page.screenshot({ path: path.join(__dirname, '18-departing-lock.png') });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
