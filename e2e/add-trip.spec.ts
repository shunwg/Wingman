import { test, expect } from '@playwright/test';

/** Type a known flight number and the trip writes itself. */
test('a known flight number fills the form from the schedule', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/trip/new');

  await page.getByLabel('Flight number').fill('SK1461');
  await page.getByLabel('Date').fill('2026-09-25');
  await expect(page.getByLabel('From')).toHaveValue(/OSL/);
  await expect(page.getByLabel('To')).toHaveValue(/CPH/);
  await expect(page.getByLabel('Departs')).toHaveValue('09:10');
  await expect(page.getByLabel('Arrives')).toHaveValue('10:30');
  await expect(page.getByText('From the schedule. Change it if yours differs.').first()).toBeVisible();

  await page.getByRole('button', { name: 'Work' }).click();
  await page.getByRole('button', { name: 'List this trip' }).click();
  await page.waitForURL(/#\/trip$/);
  await expect(page.getByText('SK1461').first()).toBeVisible();
  await expect(page.getByText('Work', { exact: true })).toBeVisible();

  // Edit keeps the id and the values.
  await page.getByRole('button', { name: 'Edit' }).last().click();
  await page.waitForURL(/#\/trip\/.*\/edit/);
  await expect(page.getByLabel('Flight number')).toHaveValue('SK1461');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForURL(/#\/trip$/);
});
