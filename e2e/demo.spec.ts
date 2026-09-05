import { test, expect } from '@playwright/test';
import { inviteCodeFor, SEED_CIRCLES } from '../src/data/seed/circles';

test('the demo link seeds Alex with three trips and a request waiting', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'Around you' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Which trip' }).getByRole('button')).toHaveCount(4); // All + 3 trips
  await expect(page.getByText(/need you/)).toBeAttached();
});

test('an invitation opened on a fresh install survives the welcome screen', async ({ page }) => {
  const gridweek = SEED_CIRCLES.find((c) => String(c.id) === 'gridweek')!;
  await page.goto(`/#/join/${inviteCodeFor(gridweek)}`);
  await page.waitForURL(/#\/welcome/);
  await page.getByRole('button', { name: 'Try the demo as Alex' }).click();
  await page.waitForURL(/#\/join\//);
  await expect(page.getByRole('heading', { name: 'Invitation' })).toBeVisible();
});
