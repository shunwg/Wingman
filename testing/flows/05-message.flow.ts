import { test } from '@playwright/test';
import { flowShots } from './_shot';

/**
 * 05 · Message.
 *
 * A request waiting, a yes, the room, an update, a line. The deviation:
 * sending nothing, then more than the room allows.
 */
test('05 message', async ({ page }) => {
  const { shot, key } = flowShots('05-message');

  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/inbox');
  await key(page.getByText('Priya asked to meet'), 'a pending request');
  await shot(page, 'inbox-request-waiting');

  await page.getByRole('button', { name: 'Yes', exact: true }).first().click();
  await key(page.getByRole('dialog', { name: 'Meet Priya?' }), 'the accept sheet');
  await shot(page, 'accept-sheet-what-is-revealed');
  await page.getByRole('button', { name: 'Yes, meet' }).click();

  await page.waitForURL(/#\/inbox\/meet:/);
  await key(page.getByText('Location appears once they post an update'), 'the room');
  await shot(page, 'room-opened');

  // Deviation 1: nothing to send.
  const input = page.getByLabel('Say something');
  await input.fill('');
  await key(page.getByRole('button', { name: 'Send' }), 'the send button');
  await shot(page, 'room-send-disabled-empty');

  // Deviation 2: more than the room allows (240 in a meet).
  await input.fill('x'.repeat(300));
  await shot(page, 'room-over-cap');
  await input.fill('');

  await page.getByRole('button', { name: 'Through security' }).click();
  await key(page.getByText(/You're through security/).first(), 'the stage update');
  await shot(page, 'room-stage-update');

  await input.fill('By the coffee place near gate 12.');
  await page.getByRole('button', { name: 'Send' }).click();
  await key(page.getByText('By the coffee place near gate 12.'), 'the sent line');
  await shot(page, 'room-line-sent');

  await page.goto('/#/inbox');
  await key(page.getByRole('button', { name: /^Priya/ }), 'the meet row');
  await shot(page, 'inbox-with-meet-row');
});
