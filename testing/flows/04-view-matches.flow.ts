import { test } from '@playwright/test';
import { flowShots } from './_shot';

/**
 * 04 · View matches.
 *
 * The board, the density toggle, an industry filter, a person. The
 * deviation: filters stacked until the board has nobody on it.
 */
test('04 view matches', async ({ page }) => {
  const { shot, key } = flowShots('04-view-matches');

  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await key(page.getByRole('heading', { name: 'Around you' }), 'the board');
  await shot(page, 'board-cards');

  await page.getByRole('button', { name: 'Rows' }).click();
  await key(page.locator('.pcard--row').first(), 'rows');
  await shot(page, 'board-rows');

  const chips = page.getByRole('group', { name: 'Industry' }).getByRole('button');
  await chips.first().click();
  await shot(page, 'board-one-industry');

  // Deviation: keep narrowing until nobody is left.
  await page.getByRole('button', { name: 'Women only' }).click();
  await page.getByRole('button', { name: /Within 5 kilometres/ }).click();
  await shot(page, 'board-filtered-to-nobody');

  await page.getByRole('button', { name: 'Clear' }).first().click();
  await page.getByRole('button', { name: 'Cards' }).click();
  await shot(page, 'board-cleared');

  await page.locator('.pcard').first().click();
  await page.waitForURL(/#\/person\//);
  await key(page.getByRole('button', { name: 'Send request' }), 'a person');
  await shot(page, 'person');
});
