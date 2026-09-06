import { test } from '@playwright/test';
import { flowShots } from './_shot';

/**
 * 06 · Delete the account.
 *
 * An App Store requirement, so it is its own flow. Today the account is the
 * device, and "Sign out and start over" wipes it; when a server arrives this
 * becomes a server call and the flow is already here to catch the change.
 * The deviation: press "Keep my profile" first and confirm nothing was lost.
 */
test('06 delete account', async ({ page }) => {
  const { shot, key } = flowShots('06-delete-account');

  // A real local account, not the demo — the demo offers a reset instead.
  await page.goto('/#/welcome');
  await page.getByRole('button', { name: 'Create my profile' }).click();
  await page.getByLabel('Your name').fill('Delete Me');
  await page.getByLabel('One sentence').fill('Here for one flight, then gone.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Add a flight later' }).click();
  await page.waitForURL(/#\/$/);

  await page.goto('/#/you');
  await key(page.getByRole('button', { name: 'Sign out and start over' }), 'the You screen');
  await shot(page, 'you-signed-in');

  await page.getByRole('button', { name: 'Sign out and start over' }).click();
  await key(page.getByRole('dialog', { name: 'Start over?' }), 'the confirm sheet');
  await shot(page, 'delete-confirm-sheet');

  // Deviation: change your mind.
  await page.getByRole('button', { name: 'Keep my profile' }).click();
  await key(page.getByText('Delete Me'), 'the profile still here');
  await shot(page, 'delete-cancelled-profile-intact');

  await page.getByRole('button', { name: 'Sign out and start over' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL(/#\/welcome/);
  await key(page.getByRole('button', { name: 'Create my profile' }), 'the welcome screen');
  await shot(page, 'delete-done-welcome');

  // Nothing survives a reload.
  await page.reload();
  await page.waitForURL(/#\/welcome/);
  await shot(page, 'delete-done-after-reload');
});
