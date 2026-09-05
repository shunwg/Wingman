import { test, expect } from '@playwright/test';

/** The organiser's ten minutes: create, paste a list, QR, pin a welcome, see it on General. */
test('the organiser path has no dead end', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/circles/new');

  await page.getByLabel('What is it called?').fill('Oslo Business Forum 2026');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Paste the list').fill('anna@obf-guest.no\nbjorn@obf-guest.no');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Open the circle' }).click();
  await expect(page.getByText(/is open/)).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.goto('/#/circles/oslo-business-forum-2026');
  await page.getByRole('button', { name: 'Invite people' }).click();
  await page.waitForURL(/\/invite$/);
  await expect(page.getByRole('img', { name: /Invitation to Oslo Business Forum 2026/ })).toBeVisible();
  await expect(page.locator('.invitecode')).toHaveText(/^[A-Z0-9]{6}$/);
  await expect(page.getByText('Speaker').first()).toBeVisible();

  await page.goto('/#/circles/oslo-business-forum-2026/admin');
  await page.getByLabel('Announcement').fill('Badges at the desk from 07:30. Lounge on level 3.');
  await page.getByRole('button', { name: 'Pin it' }).click();
  await expect(page.getByRole('button', { name: 'Pinned' })).toBeVisible();

  await page.goto('/#/inbox/circle:oslo-business-forum-2026');
  await expect(page.getByText('Badges at the desk from 07:30. Lounge on level 3.')).toBeVisible();
});

test('a delegate in the city sees the event with no flight', async ({ page }) => {
  await page.goto('/#/welcome');
  await page.getByRole('button', { name: 'Create my profile' }).click();
  await page.getByLabel('Your name').fill('Local Delegate');
  await page.getByLabel('One sentence').fill('Here for Grid Week, live in Singapore.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Add a flight later' }).click();
  await page.waitForURL(/#\/$/);

  // Join Grid Week through its link, as a speaker.
  await page.goto('/#/circles/gridweek');
  await page.goto('/#/circles');
  const code = await page.evaluate(async () => {
    const mod = await import('/src/data/seed/circles.ts');
    return mod.inviteCodeFor(mod.SEED_CIRCLES.find((c: { id: string }) => String(c.id) === 'gridweek'));
  });
  await page.goto(`/#/join/${code}-speaker`);
  await expect(page.getByText('You join as Speaker')).toBeVisible();
  await page.getByRole('button', { name: /^Join/ }).click();
  await page.waitForURL(/#\/circles$/);

  await page.goto('/#/');
  await expect(page.getByText('At Grid Week').first()).toBeVisible();
  await expect(page.locator('.eventboard .pcard').first()).toBeVisible();
});
