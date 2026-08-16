import { describe, expect, it } from 'vitest';
import { MATCH_CONFIG_V1, findCandidates } from '@matching/index';
import { airportIndex } from '@data/airports/index';
import { tripCode, tripIsOpen } from '@domain/trip';
import { distanceKm } from '@lib/geo';
import { RESPONSE_RATES } from './people';
import { ME, MY_TRIPS, SEED_NOW, seedPool } from './trips';

/**
 * Three trips, and what has to stay true across them.
 *
 * The single-trip tests could not catch any of this, because with one trip
 * there is nothing to attribute a suggestion *to*. These are the invariants the
 * board's tagging, filtering and closing rules depend on.
 */

const boardFor = (tripIndex: number) =>
  findCandidates({
    me: ME,
    myTrip: MY_TRIPS[tripIndex]!,
    myCircleIds: ['insead'],
    pool: seedPool().map((e) => ({
      ...e,
      ...(RESPONSE_RATES[String(e.person.id)] !== undefined
        ? { responseRate: RESPONSE_RATES[String(e.person.id)]! }
        : {}),
    })),
    now: SEED_NOW,
    airports: airportIndex,
    config: MATCH_CONFIG_V1,
    seenCounts: {},
    requestHistory: { active: [], denied: [] },
  });

const idsFor = (i: number) => boardFor(i).candidates.map((c) => String(c.person.id));

describe('three trips', () => {
  it('gives you three, all open to begin with', () => {
    expect(MY_TRIPS).toHaveLength(3);
    expect(MY_TRIPS.every(tripIsOpen)).toBe(true);
  });

  it('labels each one with something short enough for a chip', () => {
    const codes = MY_TRIPS.map(tripCode);
    expect(codes).toEqual(['SQ317', 'SK1465', 'BA767']);
    for (const c of codes) expect(c.length).toBeLessThanOrEqual(7);
  });

  it('lets a frequent traveller be relevant to more than one of them', () => {
    /*
     * This test originally asserted the opposite — that no person could appear
     * on two trips — and it failed, correctly. Tobias flies to Singapore this
     * week and Copenhagen in a fortnight; both are real chances to meet him,
     * and they are not the same chance recorded twice.
     *
     * The bug it exposed was in the board, which deduped by person and so kept
     * the higher-scoring row and silently dropped the other. It now keys on
     * person *and* trip, and each row carries its own flight code — which is
     * the whole point of tagging them.
     */
    const sets = [0, 1, 2].map((i) => new Set(idsFor(i)));
    const shared = [...sets[0]!].filter((id) => sets[1]!.has(id));
    expect(shared.length).toBeGreaterThan(0);
  });

  it('finds people on every trip, not just the first', () => {
    // A later trip with an empty board would demonstrate the tagging and prove
    // nothing about it.
    for (const i of [0, 1, 2]) {
      expect(idsFor(i).length, `trip ${i} has nobody`).toBeGreaterThan(0);
    }
  });

  it('puts the right people on the right trip', () => {
    expect(idsFor(0)).toContain('jonas'); // Singapore red-eye
    expect(idsFor(1)).toContain('tobias'); // Copenhagen
    expect(idsFor(2)).toContain('amelie'); // London

    // Someone with no travel anywhere near a journey must not appear on it.
    // Jonas only ever flies to Singapore, so London should not know him.
    expect(idsFor(2)).not.toContain('jonas');
    // And the Copenhagen board is genuinely a different set, not the same
    // people relabelled.
    expect(new Set(idsFor(1))).not.toEqual(new Set(idsFor(0)));
  });
});

describe('where people are headed after they land', () => {
  const destOf = (personId: string, cityKey: string) =>
    seedPool()
      .filter((e) => String(e.person.id) === personId)
      .flatMap((e) => e.trip.stays)
      .find((s) => String(s.cityKey) === cityKey)?.destination;

  it('gives the Singapore cast a spread, not one downtown cluster', () => {
    // If everyone were headed to the same place the radius filter would be
    // decoration. This asserts it actually separates people.
    const mine = MY_TRIPS[0]!.stays[0]!.destination!;
    const others = ['jonas', 'lucas', 'theo', 'ingrid']
      .map((id) => destOf(id, 'singapore-sg'))
      .filter((d): d is NonNullable<typeof d> => Boolean(d));

    expect(others).toHaveLength(4);
    const distances = others.map((d) => distanceKm(mine, d));
    // Someone essentially with you, and someone genuinely across the island.
    expect(Math.min(...distances)).toBeLessThan(2);
    expect(Math.max(...distances)).toBeGreaterThan(10);
  });

  it('keeps destinations coarse enough to be a neighbourhood, not an address', () => {
    for (const entry of seedPool()) {
      for (const stay of entry.trip.stays) {
        if (!stay.destination) continue;
        // A label, and coordinates rounded to roughly 10m at most — anything
        // more precise is a doorstep.
        expect(stay.destination.label.length).toBeGreaterThan(0);
        expect(String(stay.destination.lat).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
      }
    }
  });

  it('measures the distance symmetrically and sanely', () => {
    const a = { lat: 1.283, lon: 103.8607 };
    const b = { lat: 1.3329, lon: 103.7436 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 6);
    // Marina Bay to Jurong East is about 14km as the crow flies.
    expect(distanceKm(a, b)).toBeGreaterThan(11);
    expect(distanceKm(a, b)).toBeLessThan(17);
    expect(distanceKm(a, a)).toBe(0);
  });
});
