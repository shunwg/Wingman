import { test, expect } from '@playwright/test';

/**
 * The organiser's motion, end to end: open a circle from a pasted list, get
 * the link; then, as a fresh person, open that link, prove the listed
 * address through the email-OTP stand-in, and be admitted.
 */
test('a circle opened from a pasted list gives the organiser a link', async ({ page }) => {
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/circles/new');

  await page.getByLabel('What is it called?').fill('Oslo Business Forum 2026');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Paste the list').fill('anna@obf-guest.no\nbjorn@obf-guest.no');
  await expect(page.getByRole('status')).toContainText('2 addresses');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Open the circle' }).click();

  await expect(page.getByText(/is open/)).toBeVisible();
  const link = (await page.locator('.invite__link').textContent())!.trim();
  expect(link).toMatch(/#\/join\/[A-Z0-9]{6}$/);

  // The organiser opening their own link sees they are already in.
  await page.goto(link);
  await page.waitForURL(/#\/join\//);
  await expect(page.getByText("Everyone here was on the organiser's list.")).toBeVisible();
  await expect(page.getByText(/already a member/)).toBeVisible();
});

test('an invitee proves a listed address and gets in', async ({ page }) => {
  // Build the circle as Alex, capture the link, then start over as a new person
  // on the same device — the only way two people share a store without a server.
  await page.goto('/#/demo');
  await page.waitForURL(/#\/$/);
  await page.goto('/#/circles/new');
  await page.getByLabel('What is it called?').fill('Guest List Test');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Paste the list').fill('guest@listed.example');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Open the circle' }).click();
  const link = (await page.locator('.invite__link').textContent())!.trim();

  // Leave the circle as Alex so the invitee path is exercised.
  await page.goto('/#/circles/guest-list-test');
  await page.getByRole('button', { name: /^Leave/ }).click();

  await page.goto(link);
  await page.waitForURL(/#\/join\//);
  await page.getByRole('button', { name: 'Prove your address' }).click();
  await page.getByLabel('Your work or school address').fill('guest@listed.example');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  const note = await page.locator('.verify__mocknote').textContent();
  const code = /(\d{6})/.exec(note ?? '')?.[1];
  expect(code).toBeTruthy();
  await page.getByLabel('Six-digit code').fill(code!);
  await page.getByRole('button', { name: 'Verify' }).click();

  await expect(page.getByRole('button', { name: /^Join/ })).toBeVisible();
  await page.getByRole('button', { name: /^Join/ }).click();
  await page.waitForURL(/#\/circles$/);
  await expect(page.getByText('Guest List Test')).toBeVisible();
});
