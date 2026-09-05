import { test, expect } from '@playwright/test';

/**
 * A stranger installs the app. Six taps to an empty board is the promise;
 * this spec takes the longer road through a real trip so the board has people.
 */
test('a fresh install walks from welcome to a board with people', async ({ page }) => {
  await page.goto('/#/');
  await page.waitForURL(/#\/welcome/);
  await expect(page.getByRole('button', { name: 'Create my profile' })).toBeVisible();

  await page.getByRole('button', { name: 'Create my profile' }).click();
  await page.waitForURL(/#\/signup\/about/);
  await page.getByLabel('Your name').fill('Test Person');
  await page.getByLabel('One sentence').fill('Here for the layover coffee.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await page.waitForURL(/#\/signup\/work/);
  await page.getByRole('button', { name: 'Skip for now' }).click();

  await page.waitForURL(/#\/signup\/privacy/);
  await expect(page.getByRole('button', { name: /Verified people only/, pressed: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await page.waitForURL(/#\/signup\/verify/);
  await page.getByRole('button', { name: 'Skip for now' }).click();

  await page.waitForURL(/#\/signup\/trip/);
  await page.getByLabel('Flight number').fill('SK1465');
  await page.getByLabel('Date').fill('2026-09-18');
  await page.getByLabel('From').fill('OSL');
  await page.getByRole('option', { name: /OSL/ }).click();
  await page.getByLabel('To').fill('CPH');
  await page.getByRole('option', { name: /CPH/ }).click();
  await page.getByLabel('Departs').fill('08:40');
  await page.getByLabel('Arrives').fill('10:00');
  await page.getByRole('button', { name: 'List it' }).click();

  await page.waitForURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'Around you' })).toBeVisible();
  // Ingrid, Tobias and Elin overlap in Copenhagen on those dates. With one trip
  // there is nothing to disambiguate, so the card carries the overlap, not a tag.
  await expect(page.locator('.pcard').first()).toContainText(/Same city|Copenhagen|Oslo|overlap/);
});

test('six taps reach an empty board that says what to do', async ({ page }) => {
  await page.goto('/#/welcome');
  await page.getByRole('button', { name: 'Create my profile' }).click();
  await page.getByLabel('Your name').fill('Quick Person');
  await page.getByLabel('One sentence').fill('Coffee, if the gate is near.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Add a flight later' }).click();

  await page.waitForURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'Your board is waiting for a flight' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add a flight' })).toBeVisible();
});
