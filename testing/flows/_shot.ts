import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Screenshots named for state, not step.
 *
 * `signup-validation-error` tells a persona what it is looking at;
 * `step-03` tells it nothing. One folder per run date, one per flow, so a
 * persona can be handed a flow's folder in order and nothing else.
 *
 * Driver-agnostic on purpose: a flow calls `shot()` and `key()` and never
 * the Playwright page API for capture, so swapping in another driver later
 * touches this file, not the flows.
 */
export const RUN_DATE = process.env.PERSONA_RUN ?? new Date().toISOString().slice(0, 10);

const ROOT = join(process.cwd(), 'testing', 'screenshots', RUN_DATE);

export function flowShots(flow: string) {
  const dir = join(ROOT, flow);
  mkdirSync(dir, { recursive: true });
  let n = 0;
  return {
    /** Capture the current state. The counter keeps the on-disk order = the walk order. */
    async shot(page: Page, state: string) {
      n += 1;
      const file = join(dir, `${String(n).padStart(2, '0')}-${state}.png`);
      await page.screenshot({ path: file, fullPage: true });
    },
    /** Every screen names its key element: a wrong screen fails loudly, not as a screenshot of the wrong thing. */
    async key(locator: Locator, what: string) {
      await expect(locator, `expected to see ${what}`).toBeVisible();
    },
  };
}
