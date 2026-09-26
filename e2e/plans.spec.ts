import { test, expect } from '@playwright/test';

/**
 * Agreeing a plan, and being said yes to — the two halves of the product the
 * native prototype could show and the app could not.
 */

test('a room agrees a plan, the trip shows it, and calling it off takes it away', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/inbox');
  await page.getByRole('button', { name: 'Yes', exact: true }).first().click();
  await page.getByRole('button', { name: 'Yes, meet' }).click();
  await page.waitForURL(/#\/inbox\/meet:/);

  // Priya opens with a time. Nothing is agreed yet.
  await expect(page.locator('.plan')).toHaveCount(0);
  await page.getByRole('button', { name: 'That works' }).click();

  // Agreed: the strip, in Heathrow's own clock (18:10Z is 19:10 in September).
  const plan = page.locator('.plan');
  await expect(plan).toContainText('Agreed');
  await expect(plan).toContainText('19:10');
  await expect(page.locator('.proposal--agreed')).toHaveCount(1);

  // On the trip, where you look for your evening.
  const room = page.url();
  await page.goto('/#/trip');
  await expect(page.locator('.tripplans')).toContainText('Coffee at the gate with Priya');
  // And agreeing did not take the journey rail away.
  await expect(page.locator('.tripblock').first().locator('.jrail')).toBeVisible();

  // Calling it off asks first, then takes it off the trip too.
  await page.goto(room);
  await page.getByRole('button', { name: 'Call it off' }).first().click();
  await page.locator('.sheet').getByRole('button', { name: 'Call it off' }).click();
  await expect(page.locator('.plan')).toHaveCount(0);
  await page.goto('/#/trip');
  await expect(page.locator('.tripplans')).toHaveCount(0);
});

test('in the demo, a hello you send is answered, and Home says so', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/person/jonas');
  await page.getByRole('button', { name: 'Say hello' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Share the ride in', exact: true }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Say hello' }).click();
  // Honest about being a demo.
  await expect(page.getByText(/they will answer on their own/)).toBeVisible();

  await page.goto('/#/');
  const yes = page.locator('.homerow--yes');
  await expect(yes).toContainText('Jonas said yes', { timeout: 10_000 });
  await yes.click();

  await page.waitForURL(/#\/inbox\/meet:/);
  await expect(page.locator('.room__presence--arrive')).toBeVisible();
  // His suggestion is about the landing at Changi, in Changi's clock — not
  // the next ninety minutes in London.
  await expect(page.locator('.proposal').first()).toContainText('SIN');
  await expect(page.locator('.proposal').first()).toContainText('17:30');

  // Opening the room is what clears the notice.
  await page.goto('/#/');
  await expect(page.locator('.homerow--yes')).toHaveCount(0);
});
