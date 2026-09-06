import { describe, expect, it } from 'vitest';
import { MY_TRIPS } from '@data/seed/trips';
import { SEED_CIRCLES } from '@data/seed/circles';
import { destinationEvents, nextTrip, topMatch } from './home';
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
