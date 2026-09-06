import { test } from '@playwright/test';
import { flowShots } from './_shot';

/**
 * 03 · Set visibility.
 *
 * Who you are, who you want to meet, who can see you, and what a stranger
 * would see. The deviation: the most restrictive preference the control
 * allows — one option only, leaving out people who have not said — so the
 * persona sees the warning and the board that results.
 */
test('03 set visibility', async ({ page }) => {
  const { shot, key } = flowShots('03-set-visibility');

  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/you');
  await key(page.getByRole('heading', { name: 'Who you want to meet' }), 'the You screen');
  const pref = page.locator('section', { has: page.getByRole('heading', { name: 'Who you want to meet' }) });
  await shot(page, 'you-preference-everyone');

  // Deviation: narrow to one option, dropping people who have not said.
  await pref.getByRole('button', { name: 'Men', exact: true }).click();
  await pref.getByRole('button', { name: 'Women', exact: true }).click();
  await pref.getByRole('button', { name: 'People who have not said' }).click();
  await key(page.getByText(/Most people have not said/), 'the undisclosed warning');
  await shot(page, 'you-preference-narrowed-warning');

  // The last one refuses to untick.
  await pref.getByRole('button', { name: 'Non-binary people' }).click();
  await key(pref.getByRole('button', { name: 'Non-binary people', pressed: true }), 'the last option still on');
  await shot(page, 'you-preference-last-refuses');

  await page.goto('/#/discover');
  await key(page.getByRole('heading', { name: 'Around you' }), 'the board');
  await shot(page, 'board-after-narrowing');

  // Back to everyone, then a preset.
  await page.goto('/#/you');
  const pref2 = page.locator('section', { has: page.getByRole('heading', { name: 'Who you want to meet' }) });
  for (const name of ['Men', 'Women', 'People who have not said']) {
    await pref2.getByRole('button', { name, exact: true }).click();
  }
  await page.getByRole('button', { name: /ID-verified only/ }).click();
  await shot(page, 'you-id-verified-only');

  // What a stranger sees: with ID-verified only on, nothing — and it says so.
  await page.getByRole('button', { name: 'An unverified stranger in your city' }).click();
  await key(page.getByText(/cannot see you/i).first(), 'the hidden-from-stranger state');
  await shot(page, 'you-preview-stranger-cannot-see-you');

  // And what someone who has proved who they are sees.
  await page.getByRole('button', { name: 'Someone ID-verified on your flight' }).click();
  await key(page.getByText(/preview/i).first(), 'the preview card');
  await shot(page, 'you-preview-as-id-verified');
});
