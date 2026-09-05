import { test, expect } from '@playwright/test';

/**
 * One inbox: accept Priya (through the sheet that says what a yes reveals),
 * post a stage in the room, say something in INSEAD's General, and see a
 * meet, a circle and a group as rows of the same list.
 */
test('a meet, a circle and a group all live in one inbox', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/inbox');

  await expect(page.getByText('Priya asked to meet')).toBeVisible();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByRole('dialog', { name: 'Meet Priya?' })).toBeVisible();
  await expect(page.getByText(/Your terminal/)).toBeVisible();
  await page.getByRole('button', { name: 'Yes, meet' }).click();

  // The meet is now a row; open it.
  await page.getByRole('button', { name: /^Priya/ }).first().click();
  await page.waitForURL(/#\/inbox\/meet:/);
  await expect(page.getByText('Location appears once they post an update')).toBeVisible();
  await page.getByRole('button', { name: 'Through security' }).click();
  await expect(page.getByText(/You're through security/).first()).toBeVisible();

  // A circle's General.
  await page.goto('/#/inbox/circle:insead');
  await expect(page.getByText('Pinned', { exact: true })).toBeVisible();
  await page.getByLabel('Say something').fill('Landing Wednesday too.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Landing Wednesday too.')).toBeVisible();

  // Back to the list: three kinds, unread cleared on the ones opened.
  await page.goto('/#/inbox');
  await expect(page.getByRole('button', { name: /INSEAD · General/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Singapore this week/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Priya/ })).toBeVisible();
  await page.getByRole('button', { name: 'Groups' }).click();
  await expect(page.getByRole('button', { name: /Singapore this week/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /INSEAD · General/ })).toHaveCount(0);
});

test('hide from the profile menu removes them from the board', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.locator('.pcard').first().click();
  await page.waitForURL(/#\/person\//);
  const name = (await page.locator('.person__name').first().textContent())?.trim() ?? '';
  await page.getByRole('button', { name: /^More about/ }).click();
  await page.getByRole('menuitem', { name: /^Hide/ }).click();
  await page.waitForURL(/#\/$/);
  if (name) await expect(page.locator('.pcard', { hasText: name })).toHaveCount(0);
});
