import { describe, expect, it } from 'vitest';
import { asISODate, localDate, localTime, utcFromLocal, type IanaZone } from './time';

const z = (s: string) => s as IanaZone;

describe('utcFromLocal', () => {
  it.each([
    ['Europe/Oslo', '2026-09-18', '08:40', '2026-09-18T06:40:00Z'],
    ['Asia/Singapore', '2026-09-03', '17:00', '2026-09-03T09:00:00Z'],
    // DST ends that morning in Los Angeles; 01:30 happens twice, and the
    // first one (still PDT, UTC-7) is the one a printed ticket means.
    ['America/Los_Angeles', '2026-11-01', '01:30', '2026-11-01T08:30:00Z'],
    ['UTC', '2026-01-01', '00:00', '2026-01-01T00:00:00Z'],
  ])('%s %s %s → %s', (zone, date, hhmm, expected) => {
    expect(utcFromLocal(asISODate(date), hhmm, z(zone))).toBe(expected);
  });

  it('round-trips through localDate/localTime', () => {
    const oslo = z('Europe/Oslo');
    const t = utcFromLocal(asISODate('2026-06-21'), '23:59', oslo);
    expect(localDate(t, oslo)).toBe('2026-06-21');
    expect(localTime(t, oslo)).toBe('23:59');
  });

  it('resolves a time inside the spring-forward gap to just after the jump', () => {
    const oslo = z('Europe/Oslo');
    // 02:30 on 2026-03-29 does not exist in Oslo; clocks go 02:00 → 03:00.
    const t = utcFromLocal(asISODate('2026-03-29'), '02:30', oslo);
    expect(localDate(t, oslo)).toBe('2026-03-29');
    expect(['03:30', '02:30']).toContain(localTime(t, oslo));
  });
});
