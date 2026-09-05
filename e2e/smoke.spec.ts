import { test, expect } from '@playwright/test';

test('five tabs are reachable and the board renders people', async ({ page }) => {
  // The demo entry seeds Alex; a fresh context would land on Welcome otherwise.
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'Around you' })).toBeVisible();
  for (const tab of ['Trip', 'Inbox', 'Circles', 'You', 'Discover']) {
    // The Inbox tab's accessible name carries its badge text, so match the start.
    await page.getByRole('link', { name: new RegExp('^' + tab) }).click();
  }
  await expect(page.locator('.pcard').first()).toBeVisible();
  // A page wider than the phone makes mobile Chrome zoom out and drops the
  // fixed tab bar out of the visual viewport. Never.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
