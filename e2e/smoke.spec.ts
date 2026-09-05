import { test, expect } from '@playwright/test';

test('five tabs are reachable and the board renders people', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Around you' })).toBeVisible();
  for (const tab of ['Trip', 'Requests', 'Circles', 'You', 'Discover']) {
    await page.getByRole('link', { name: tab }).click();
  }
  await expect(page.locator('.pcard').first()).toBeVisible();
});
