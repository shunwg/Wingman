import { test, expect } from '@playwright/test';

/**
 * On a desktop the ID provider shows a reference to compare against your
 * phone and polls; the mock goes ready after 3.5 s. Specs are lint-exempt and
 * may name the provider the screens may not.
 */
test('BankID on desktop shows a reference and connects', async ({ page }) => {
  await page.goto('/#/welcome');
  await page.getByRole('button', { name: 'Create my profile' }).click();
  await page.getByLabel('Your name').fill('Desk Person');
  await page.getByLabel('One sentence').fill('Testing from a laptop.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForURL(/#\/signup\/verify/);

  const reco = page.locator('.verifystep__reco');
  await expect(reco).toContainText('BankID');
  await reco.getByRole('button', { name: 'Connect' }).click();

  await expect(page.locator('.verify__refcode')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('connected', { timeout: 8_000 });

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForURL(/#\/signup\/trip/);
  await page.getByRole('button', { name: 'Add a flight later' }).click();
  await page.goto('/#/you');
  // The public label, never the provider: that is the whole point of a stamp.
  await expect(page.locator('.youhead__stamps')).toContainText('ID verified');
});
