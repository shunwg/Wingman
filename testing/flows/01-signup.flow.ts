import { test } from '@playwright/test';
import { flowShots } from './_shot';

/**
 * 01 · Sign up.
 *
 * Welcome → about → work → privacy → verify → trip → board. The deliberate
 * deviation: submitting About empty, so the persona sees what the app says
 * when a person gives it nothing.
 */
test('01 signup', async ({ page }) => {
  const { shot, key } = flowShots('01-signup');

  await page.goto('/#/');
  await page.waitForURL(/#\/welcome/);
  await key(page.getByRole('button', { name: 'Create my profile' }), 'the welcome screen');
  await shot(page, 'welcome');

  await page.getByRole('button', { name: 'Create my profile' }).click();
  await page.waitForURL(/#\/signup\/about/);
  await key(page.getByLabel('Your name'), 'the About step');
  await shot(page, 'signup-empty');

  // Deviation: give it nothing.
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await key(page.getByRole('alert').first(), 'a validation error');
  await shot(page, 'signup-validation-error');

  await page.getByLabel('Your name').fill('Test Person');
  await page.getByLabel('One sentence').fill('Here for the layover coffee.');
  await shot(page, 'signup-about-filled');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await page.waitForURL(/#\/signup\/work/);
  await key(page.getByLabel('Title'), 'the Work step');
  await shot(page, 'signup-work');
  await page.getByRole('button', { name: 'Skip for now' }).click();

  await page.waitForURL(/#\/signup\/privacy/);
  await key(page.getByRole('button', { name: /Verified people only/ }), 'the privacy step');
  await shot(page, 'signup-privacy-defaults');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await page.waitForURL(/#\/signup\/verify/);
  await key(page.getByRole('button', { name: 'Skip for now' }), 'the verify step');
  await shot(page, 'signup-verify');
  await page.getByRole('button', { name: 'Skip for now' }).click();

  await page.waitForURL(/#\/signup\/trip/);
  await key(page.getByLabel('Flight number'), 'the trip step');
  await shot(page, 'signup-trip-empty');
  await page.getByRole('button', { name: 'Add a flight later' }).click();

  await page.waitForURL(/#\/$/);
  await key(page.getByRole('heading', { name: 'Your board is waiting for a flight' }), 'the empty board');
  await shot(page, 'signup-success');
});
