import { test, expect } from '@playwright/test';

test('rows, an industry, a saved person, and a custom line', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/discover');

  // Scan.
  await page.getByRole('button', { name: 'Rows' }).click();
  await expect(page.locator('.pcard--row').first()).toBeVisible();

  // Narrow by industry: the chip row shows the industries on the board.
  const before = await page.locator('.pcard').count();
  const chips = page.getByRole('group', { name: 'Industry' }).getByRole('button');
  await chips.first().click();
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('.pcard').count()).toBeLessThan(before);
  await page.getByRole('button', { name: 'Clear' }).click();

  // Save one, then see only them.
  await page.locator('.pcard').first().click();
  await page.waitForURL(/#\/person\//);
  await page.getByRole('button', { name: 'Save for later' }).click();
  await expect(page.getByRole('button', { name: 'Saved for later' })).toBeVisible();

  await page.goto('/#/discover');
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(page.locator('.pcard')).toHaveCount(1);
  await expect(page.locator('.pcard').first()).toContainText('Saved');

  // Ask in your own words. A live request takes them off the board — correctly.
  await page.locator('.pcard').first().click();
  await page.waitForURL(/#\/person\//);
  await page.getByRole('button', { name: 'Say hello' }).click();
  await page.getByRole('button', { name: 'Coffee at the gate' }).first().click();
  await page.getByLabel('In your own words').fill('Saw you are working on interconnectors. Fifteen minutes?');
  await page.getByRole('dialog').getByRole('button', { name: 'Say hello' }).click();
  await expect(page.getByText('Request sent.')).toBeVisible();

  await page.goto('/#/inbox');
  await expect(page.getByText(/Saw you are working on interconnectors/)).toBeVisible();
});
