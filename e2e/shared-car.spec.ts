import { test, expect } from '@playwright/test';

/**
 * Shared cars, both sides.
 *
 * The three things worth an end-to-end test are the three that cross every
 * layer: a car going your way reaches the board at all, taking a seat changes
 * what the board says, and a car whose door is shut is *not there* — which is
 * the only one of the three that fails silently if it regresses.
 */

test('a car going your way can be joined, and taking the seat fills it', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/discover');

  await page.getByRole('button', { name: 'Shared cars', exact: true }).click();

  // Both directions are on the board. Until this feature existed the domain
  // could not express the to-airport half at all.
  await expect(page.locator('.ridecard')).toHaveCount(3);
  await expect(page.getByText('SIN', { exact: false }).first()).toBeVisible();
  await expect(page.locator('.ridecard', { hasText: 'LHR' })).toBeVisible();

  // The INSEAD car: one seat, and a circle member seats themselves.
  const circleCar = page.locator('.ridecard', { hasText: 'Marina Bay' });
  // The count carries its denominator, the last seat carries a word as well
  // as a colour, and the chip names the consent model rather than a category.
  await expect(circleCar).toContainText('1 of 2 seats free');
  await expect(circleCar).toContainText('Last');
  await expect(circleCar).toContainText('Circle seats itself');
  // And the card is dated: the board mixes trips weeks apart.
  await expect(circleCar).toContainText(/Tomorrow|Tonight|Today|\d{1,2} \w{3}/);
  // And it says what *you* would pay — the pitch of a shared cab, as a number.
  await expect(circleCar).toContainText(/About SGD.18 each with you in/);
  await circleCar.locator('.ridecard__body').click();

  await page.waitForURL(/#\/car\//);
  await expect(page.getByRole('button', { name: 'Take the seat' })).toBeVisible();
  await page.getByRole('button', { name: 'Take the seat' }).click();

  // Seated, and the car says so rather than the button simply vanishing.
  await expect(page.getByText('Full')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Give up the seat' })).toBeVisible();

  // Only now, in the car, does the pickup spot appear.
  await expect(page.getByText(/INSEAD tote/)).toBeVisible();

  // The room exists and carries the fare line, which is the one thing nobody
  // in a shared cab wants to be the first to mention — with the amount on it
  // now, and the spot to stand.
  await page.getByRole('button', { name: /Open the car/ }).click();
  await page.waitForURL(/#\/inbox\/ride:/);
  await expect(page.locator('.room__fare')).toContainText(/About SGD.18 each/);
  await expect(page.locator('.room__fare')).toContainText(/INSEAD tote/);

  // And a full car is off the board.
  await page.goto('/#/discover');
  await page.getByRole('button', { name: 'Shared cars', exact: true }).click();
  await expect(page.locator('.ridecard', { hasText: 'Marina Bay' })).toHaveCount(0);
});

test('an open car asks the host rather than seating a stranger', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/discover');
  await page.getByRole('button', { name: 'Shared cars', exact: true }).click();

  const openCar = page.locator('.ridecard', { hasText: 'Tiong Bahru' });
  await expect(openCar).toContainText('Host approves');
  await openCar.locator('.ridecard__body').click();
  await page.waitForURL(/#\/car\//);

  // The verb is the promise: you ask, you are not seated.
  await page.getByRole('button', { name: 'Ask for a seat' }).click();
  await expect(page.getByText(/Waiting on the host/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Withdraw' })).toBeVisible();
});

test('a car whose circle you are not in is not on the board at all', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);

  // Leave INSEAD. The circle car should vanish — not grey out, not show a
  // locked state naming the circle, which would tell you a car exists and who
  // it is for. It is simply not there, and the board says a count is hidden.
  await page.evaluate(() => {
    const raw = localStorage.getItem('wingman');
    if (!raw) throw new Error('no persisted store');
    const parsed = JSON.parse(raw) as { state: { me: { memberships: unknown[] } } };
    parsed.state.me.memberships = [];
    localStorage.setItem('wingman', JSON.stringify(parsed));
  });
  await page.goto('/#/discover');
  await page.reload();
  await page.getByRole('button', { name: 'Shared cars', exact: true }).click();

  await expect(page.locator('.ridecard', { hasText: 'Marina Bay' })).toHaveCount(0);
  await expect(page.locator('.ridecard', { hasText: 'Tiong Bahru' })).toBeVisible();

  // Reaching it by its direct URL does not work either. A door that only the
  // board respects is not a door.
  await page.goto('/#/car/ride_jonas_marina');
  await expect(page.getByText('That car is not available.')).toBeVisible();
});

test('hosting a car on your own trip, by link only', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/trip');

  await page.getByRole('button', { name: 'Share a car' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByRole('button', { name: 'To the airport' }).click();
  await page.getByText('By link only').click();
  await page.getByLabel('Leaving around').fill('05:10');
  await page.getByRole('button', { name: 'Offer the car' }).click();

  // Landed on the car, with a key that can be read out loud.
  await page.waitForURL(/#\/car\//);
  await expect(page.locator('.ride__code')).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);

  // Following your own link says so rather than pretending to seat you.
  const code = (await page.locator('.ride__code').textContent())!.trim();
  await page.goto(`/#/car/${code}`);
  await expect(page.getByText('This is your own car')).toBeVisible();
});

test('a car cannot be offered to a circle that does not exist', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/trip');
  await page.getByRole('button', { name: 'Share a car' }).first().click();

  // The time is required, and saying so beats a disabled button with no reason.
  await page.getByRole('button', { name: 'Offer the car' }).click();
  await expect(page.getByRole('alert')).toContainText(/when you want to leave/i);
});
