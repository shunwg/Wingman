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
});
