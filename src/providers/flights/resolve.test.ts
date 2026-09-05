import { describe, expect, it } from 'vitest';
import { resolveFlight } from './resolve';
import { SCHEDULE, scheduled } from './schedule';

describe('the bundled schedule', () => {
  it('holds every seeded flight with local wall clocks', () => {
    const sk = scheduled('sk 1465')!;
    expect(sk.from).toBe('OSL');
    expect(sk.to).toBe('CPH');
    expect(sk.departLocal).toBe('08:40');
    expect(sk.arriveLocal).toBe('10:00');
    expect(sk.terminalTo).toBe('T3');
    expect(sk.overnight).toBe(false);
  });

  it('marks a red-eye as overnight', () => {
    const sq = scheduled('SQ317')!;
    expect(sq.departLocal).toBe('21:00');
    expect(sq.arriveLocal).toBe('17:00');
    expect(sq.overnight).toBe(true);
    expect(sq.terminalFrom).toBe('T2');
  });

  it('has no duplicates', () => {
    expect(new Set(SCHEDULE.map((f) => f.flightNo)).size).toBe(SCHEDULE.length);
  });
});

describe('resolveFlight', () => {
  it('returns the bundled flight, or unknown', async () => {
    await expect(resolveFlight('BA767')).resolves.toMatchObject({ status: 'bundled' });
    await expect(resolveFlight('ZZ9999')).resolves.toEqual({ status: 'unknown' });
  });
});
