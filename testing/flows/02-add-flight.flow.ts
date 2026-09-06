import { test } from '@playwright/test';
import { flowShots } from './_shot';

/**
 * 02 · Add a flight.
 *
 * The happy path first, exactly as a person would take it: a known flight
 * number fills the form from the schedule. Then the deviation on a second
 * visit — a flight number that is not one (`S`) and a date in the past —
 * so the persona sees how the form refuses.
 */
test('02 add flight', async ({ page }) => {
  const { shot, key } = flowShots('02-add-flight');

  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/trip/new');
  await key(page.getByLabel('Flight number'), 'the trip form');
  await shot(page, 'trip-empty');

  await page.getByLabel('Flight number').fill('SK1461');
  await page.getByLabel('Date').fill('2026-09-25');
  await key(page.getByText('From the schedule. Change it if yours differs.').first(), 'the schedule prefill');
  await shot(page, 'trip-prefilled-from-schedule');

  await page.getByRole('button', { name: 'Work' }).click();
  await shot(page, 'trip-purpose-work');
  await page.getByRole('button', { name: 'List this trip' }).click();
  await page.waitForURL(/#\/trip$/);
  await key(page.getByText('SK1461'), 'the listed trip');
  await shot(page, 'trip-listed');

  // Deviation: a second trip with a nonsense flight number and a past date.
  await page.goto('/#/trip/new');
  await page.getByLabel('Flight number').fill('S');
  await page.getByLabel('Date').fill('2024-01-01');
  await page.getByLabel('From').fill('OSL');
  await page.getByRole('option', { name: /OSL/ }).click();
  await page.getByLabel('To').fill('CPH');
  await page.getByRole('option', { name: /CPH/ }).click();
  await page.getByLabel('Departs').fill('08:40');
  await page.getByLabel('Arrives').fill('10:00');
  await shot(page, 'trip-invalid-filled');
  await page.getByRole('button', { name: 'List this trip' }).click();
  await key(page.getByRole('alert').first(), 'a validation error');
  await shot(page, 'trip-validation-errors');

  await page.goto('/#/');
  await key(page.getByRole('heading', { name: 'Around you' }), 'the board');
  await shot(page, 'board-with-new-trip');
});
