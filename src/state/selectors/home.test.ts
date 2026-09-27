import { describe, expect, it } from 'vitest';
import { MY_TRIPS } from '@data/seed/trips';
import { SEED_CIRCLES } from '@data/seed/circles';
import { destinationEvents, nextJourney, nextTrip, topMatch } from './home';
import { SEED_NOW } from '@data/seed/trips';
import type { BoardCandidate } from './board';

describe('nextTrip', () => {
  it('picks the earliest departure, not the first listed', () => {
    const reversed = [...MY_TRIPS].reverse();
    expect(String(nextTrip(reversed)?.id)).toBe(String(MY_TRIPS[0]!.id));
  });

  it('skips hidden and settled trips', () => {
    const hidden = { ...MY_TRIPS[0]!, visibility: { listing: 'hidden' as const } };
    expect(String(nextTrip([hidden, MY_TRIPS[1]!])?.id)).toBe(String(MY_TRIPS[1]!.id));
    expect(nextTrip([])).toBeUndefined();
  });

  it('skips a trip that is over once it knows the time (round 4)', () => {
    // Singapore, 2–6 Sept, read on the 20th.
    expect(String(nextTrip(MY_TRIPS, '2026-09-20T10:00:00Z' as never)?.id)).not.toBe(String(MY_TRIPS[0]!.id));
  });
});

describe('nextJourney', () => {
  it('keeps tonight’s flight as the next journey after it is settled — settling stops the board, not the trip', () => {
    const settled = { ...MY_TRIPS[0]!, outcome: { settledWith: 'jonas' as never, at: SEED_NOW } };
    expect(String(nextJourney([settled, MY_TRIPS[1]!], SEED_NOW)?.id)).toBe(String(MY_TRIPS[0]!.id));
    // …while the board's own pick moves on, as it should.
    expect(String(nextTrip([settled, MY_TRIPS[1]!])?.id)).toBe(String(MY_TRIPS[1]!.id));
  });

  it('moves on once a trip has landed', () => {
    const later = '2026-09-04T00:00:00Z' as never;
    expect(String(nextJourney([...MY_TRIPS], later)?.id)).toBe(String(MY_TRIPS[1]!.id));
  });
});

describe('topMatch', () => {
  const c = (id: string, trip: string, most = false) =>
    ({ person: { id }, viaTripId: trip, mostCompatible: most } as unknown as BoardCandidate);

  it('prefers the stable pick on the trip, else the first in ranking order', () => {
    expect(topMatch([c('a', 't1'), c('b', 't1', true), c('c', 't2', true)], 't1')?.person.id).toBe('b');
    expect(topMatch([c('a', 't1'), c('b', 't1')], 't1')?.person.id).toBe('a');
    expect(topMatch([c('a', 't1')], 't9')).toBeUndefined();
  });
});

describe('destinationEvents', () => {
  it('finds the conference held where the trip stays, while it stays', () => {
    const ids = destinationEvents(MY_TRIPS[0], SEED_CIRCLES).map((c) => String(c.id));
    expect(ids).toEqual(['gridweek']);
    expect(destinationEvents(MY_TRIPS[1], SEED_CIRCLES)).toEqual([]);
    expect(destinationEvents(undefined, SEED_CIRCLES)).toEqual([]);
  });
});
