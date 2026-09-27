import { describe, expect, it } from 'vitest';
import { MY_TRIPS } from '@data/seed/trips';
import type { ISODateTime } from './time';
import { tripIsOver } from './trip';

const t = (s: string) => s as ISODateTime;

describe('tripIsOver', () => {
  // The Copenhagen trip lands on the 18th and the stay runs to the 20th.
  const cph = MY_TRIPS[1]!;

  it('is not over during the stay — "back to the airport" happens at its end', () => {
    expect(tripIsOver(cph, t('2026-09-19T12:00:00Z'))).toBe(false);
  });

  it('is over after the stay and its grace', () => {
    expect(tripIsOver(cph, t('2026-09-25T12:00:00Z'))).toBe(true);
  });
});
