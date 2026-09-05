import { test, expect } from '@playwright/test';

/**
 * The signature moment: saying yes opens the room and plays the arrival once.
 */
test('accepting a request lands in the room, animates once, and never again', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/inbox');
  await page.getByRole('button', { name: 'Yes', exact: true }).first().click();
  await page.getByRole('button', { name: 'Yes, meet' }).click();

  await page.waitForURL(/#\/inbox\/meet:/);
  await expect(page.locator('.room__presence--arrive')).toBeVisible();

  const room = page.url();
  await page.goto('/#/inbox');
  await page.goto(room);
  await expect(page.locator('.room__presence')).toBeVisible();
  await expect(page.locator('.room__presence--arrive')).toHaveCount(0);
});
