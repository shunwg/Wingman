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
});
