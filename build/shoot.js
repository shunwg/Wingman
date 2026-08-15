/* Screenshot + interaction test of the assembled prototype (v2) */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  const url = 'file://' + path.join(__dirname, '..', 'wingman.html');

  const shot = async name => { await page.screenshot({ path: path.join(__dirname, name + '.png') }); };
  const shotFull = async name => { await page.screenshot({ path: path.join(__dirname, name + '.png'), fullPage: true }); };

  // 1. landing
  await page.goto(url); await page.waitForTimeout(1800);
  await shotFull('01-landing');

  // 2. trip form (arriving) — includes About you + verification card
  await page.click('button[data-dir="arriving"]');
  await page.waitForTimeout(600);
  await shotFull('02-trip-form');

  // 3. demo flight + submit → board (unverified: 3 visible, privacy row shows)
  await page.click('[data-action="demo-flight"]');
  await page.waitForTimeout(300);
  await page.click('#submit-trip');
  await page.waitForTimeout(7500);
  await shot('03-board-unverified');

  // 4. join jonas → verification modal intercepts
  await page.goto(url + '#/match/jonas'); await page.waitForTimeout(600);
  await shotFull('04-match-detail');
  await page.click('[data-action="join-open"]');
  await page.waitForTimeout(500);
  await shot('05-verify-modal');

  // 5. run BankID mock
  await page.click('[data-m="bankid"]');
  await page.waitForTimeout(2000);
  await shot('06-bankid-running');
  await page.waitForTimeout(2500);
  await page.click('[data-action="verify-done"]');
  await page.waitForTimeout(500);
  await shot('07-join-templates');

  // 6. join → wait for reciprocation (jonas 14s) → pass-lock
  await page.click('[data-action="join"]');
  await page.waitForTimeout(800);
  await page.waitForTimeout(15000);
  await page.waitForTimeout(4200);
  await shot('08-passlock');
  await page.click('[data-action="lock-continue"]');
  await page.waitForTimeout(700);
  await shotFull('09-shared-plan');

  // 7. gate check → boarding
  await page.click('[data-action="gate-open"]');
  await page.waitForTimeout(500);
  await page.click('[data-i="0"]'); await page.click('[data-i="1"]'); await page.click('[data-i="2"]');
  await page.waitForTimeout(300);
  await shot('10-gatecheck');
  await page.click('#gc-confirm');
  await page.waitForTimeout(7500);
  await shotFull('11-boarding-together');

  // 8. board now verified — ingrid revealed (4 on route)
  await page.goto(url + '#/matches'); await page.waitForTimeout(900);
  await shot('12-board-verified');
  await page.click('[data-action="set-view"][data-v="list"]');
  await page.waitForTimeout(700);
  await shotFull('13-list-view');

  // 9. trips
  await page.goto(url + '#/trips'); await page.waitForTimeout(600);
  await shotFull('14-trips');

  console.log('console errors:', errors.length ? errors : 'none');
  await browser.close();
})();
