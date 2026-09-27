import { describe, expect, it } from 'vitest';
import type { IanaZone, ISODateTime } from '@domain/index';
import { windowLabel } from './whenLabel';

const t = (s: string) => s as ISODateTime;
const cph = 'Europe/Copenhagen' as IanaZone;
const now = t('2026-09-02T16:30:00Z');

describe('windowLabel', () => {
  it('reads "Tonight 17:30 – 18:30" inside the day', () => {
    expect(windowLabel(t('2026-09-02T15:30:00Z'), t('2026-09-02T16:30:00Z'), cph, now)).toMatch(/^(Today|Tonight) 17:30 – 18:30$/);
  });

  it('keeps both ends a week and more out — it used to drop the start', () => {
    expect(windowLabel(t('2026-09-20T11:30:00Z'), t('2026-09-20T12:30:00Z'), cph, now)).toBe('20 Sept, 13:30 – 14:30');
  });

  it('reads a day gone by as its date, never "Today" (round 4)', () => {
    const later = t('2026-09-20T10:00:00Z');
    expect(windowLabel(t('2026-09-06T13:00:00Z'), t('2026-09-06T14:00:00Z'), cph, later)).toBe('6 Sept 15:00 – 16:00');
  });
});
