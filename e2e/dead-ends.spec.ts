import { test, expect } from '@playwright/test';

/**
 * Zero dead ends (Jobs scorecard, criterion 3).
 *
 * Every screen, including every not-found and empty state, ends in something
 * to do. The tab bar does not count: a screen whose only way out is the
 * navigation is a screen that gave up.
 */
const ROUTES = [
  '#/',
  '#/discover',
  '#/inbox',
  '#/trip',
  '#/trip/new',
  '#/circles',
  '#/circles/new',
  '#/circles/gridweek',
  '#/circles/gridweek/invite',
  '#/circles/gridweek/admin',
  '#/you',
  '#/you/edit',
  '#/verify',
  '#/person/jonas',
  '#/inbox/circle:insead',
  '#/car/ride_jonas_marina',
  '#/car/ride_you_cph',
  // Not-found states.
  '#/person/nobody',
  '#/inbox/meet:nothing',
  '#/circles/nothing',
  '#/join/NOPE00',
  // A car that does not exist, and a key that matches no car. Both have to
  // end somewhere other than the tab bar — someone who followed a dead link
  // from a group chat is exactly the person least able to guess what to do.
  '#/car/ride_nothing',
  '#/car/ZZZZZZ',
];

test('every route, found or not, offers an action outside the tab bar', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  for (const hash of ROUTES) {
    await page.goto(`/${hash}`);
    const actions = page.locator('main button:enabled, main a[href], main [role="button"]');
    await expect(actions.first(), `${hash} has no action`).toBeVisible();
  }
});
