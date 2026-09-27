import { describe, expect, it } from 'vitest';
import { asCircleId, asIata, asPersonId, asRideId, asTripId } from './ids';
import type { ISODateTime } from './time';
import { PICKUP_NOTE_CAP, fareEach, latestClaim, makeRide, roomMembers, rideIsJoinable, seatsLeft, seatsPending, sharesDirection, type Ride } from './ride';
import { anyAudience } from './privacy';

const t = (s: string) => s as ISODateTime;

function base(patch: Partial<Parameters<typeof makeRide>[0]> = {}): Ride {
  return makeRide({
    id: asRideId('r1'),
    hostPersonId: asPersonId('you'),
    tripId: asTripId('t1'),
    direction: 'from_airport',
    airportIata: asIata('CDG'),
    point: { lat: 48.4084, lon: 2.7019, label: 'Fontainebleau' },
    window: { from: t('2026-09-19T14:00:00Z'), to: t('2026-09-19T15:00:00Z') },
    seatsTotal: 4,
    audience: { kind: 'open', rules: anyAudience() },
    createdAt: t('2026-09-16T09:00:00Z'),
    ...patch,
  });
}

const claim = (id: string, status: Ride['claims'][number]['status']) => ({
  personId: asPersonId(id),
  status,
  askedAt: t('2026-09-16T10:00:00Z'),
  history: [],
});

describe('makeRide', () => {
  it('opens with no claims, no history and an expiry pinned to the window', () => {
    const r = base();
    expect(r.claims).toEqual([]);
    expect(r.history).toEqual([]);
    expect(r.status).toBe('open');
    expect(r.expiresAt).toBe('2026-09-19T15:00:00Z');
  });

  it('refuses a car with no room for a passenger', () => {
    expect(() => base({ seatsTotal: 1 })).toThrow(/at least one passenger/i);
  });

  it('refuses a window that ends before it starts', () => {
    expect(() =>
      base({ window: { from: t('2026-09-19T15:00:00Z'), to: t('2026-09-19T14:00:00Z') } }),
    ).toThrow(/ends before/i);
  });

  it('refuses a pickup point with no label — a lat/lon alone is not a place anyone can find', () => {
    expect(() => base({ point: { lat: 48.4, lon: 2.7, label: '  ' } })).toThrow(/label/i);
  });

  it('refuses a circles audience with an empty list, rather than admitting everyone', () => {
    expect(() => base({ audience: { kind: 'circles', circleIds: [] } })).toThrow(/nobody/i);
  });
});

describe('seatsLeft', () => {
  it('counts the host against the total', () => {
    expect(seatsLeft(base())).toBe(3);
  });

  it('does NOT count a requested seat — the count would otherwise leak a decline', () => {
    // Deliberate, and the reason is a leak rather than a preference. If a
    // pending ask consumed a seat, the count would fall when somebody asked
    // and rise again when the host said no — telling the person refused
    // exactly the thing claimantView() exists to keep from them.
    const r = base();
    r.claims.push(claim('a', 'requested'));
    expect(seatsLeft(r)).toBe(3);
  });

  it('tells the host how many are asking, which the public count no longer shows', () => {
    const r = base();
    r.claims.push(claim('a', 'requested'), claim('b', 'requested'), claim('c', 'confirmed'));
    expect(seatsPending(r)).toBe(2);
    expect(seatsLeft(r)).toBe(2);
  });

  it('ignores every settled claim, however it settled', () => {
    const r = base();
    r.claims.push(
      claim('a', 'confirmed'),
      claim('b', 'declined'),
      claim('c', 'withdrawn'),
      claim('d', 'removed_by_host'),
      claim('e', 'expired'),
      claim('f', 'revoked_by_policy'),
    );
    expect(seatsLeft(r)).toBe(2);
  });

  it('never goes negative', () => {
    const r = base({ seatsTotal: 2 });
    r.claims.push(claim('a', 'confirmed'), claim('b', 'confirmed'));
    expect(seatsLeft(r)).toBe(0);
  });
});

describe('rideIsJoinable', () => {
  const now = t('2026-09-16T10:00:00Z');

  it('is true while open, seated and in time', () => {
    expect(rideIsJoinable(base(), now)).toBe(true);
  });

  it('is false once the seats are gone', () => {
    const r = base({ seatsTotal: 2 });
    r.claims.push(claim('a', 'confirmed'));
    expect(rideIsJoinable(r, now)).toBe(false);
  });

  it('is false after the pickup window has passed', () => {
    expect(rideIsJoinable(base(), t('2026-09-20T00:00:00Z'))).toBe(false);
  });

  it('is false once the ride has left, been completed or cancelled', () => {
    for (const status of ['departed', 'completed', 'cancelled'] as const) {
      expect(rideIsJoinable({ ...base(), status }, now)).toBe(false);
    }
  });
});

describe('sharesDirection', () => {
  it('two people leaving the airport are going the same way', () => {
    expect(sharesDirection('from_airport', 'from_airport')).toBe(true);
  });

  it('someone heading to the airport cannot share a car leaving it', () => {
    expect(sharesDirection('from_airport', 'to_airport')).toBe(false);
  });
});

describe('the circles audience', () => {
  it('keeps its circle list', () => {
    const r = base({ audience: { kind: 'circles', circleIds: [asCircleId('insead')] } });
    expect(r.audience).toEqual({ kind: 'circles', circleIds: [asCircleId('insead')] });
  });
});

describe('the car\'s money — an estimate the host states, never a charge', () => {
  const fare = { amountMinor: 15000, currency: 'EUR' };

  it('keeps a stated estimate and a pickup note', () => {
    const r = base({ fare, pickupNote: 'Rank door 12, white estate' });
    expect(r.fare).toEqual(fare);
    expect(r.pickupNote).toBe('Rank door 12, white estate');
  });

  it('refuses an estimate that is not a positive whole amount', () => {
    expect(() => base({ fare: { amountMinor: 0, currency: 'EUR' } })).toThrow();
    expect(() => base({ fare: { amountMinor: -500, currency: 'EUR' } })).toThrow();
    expect(() => base({ fare: { amountMinor: 49.5, currency: 'EUR' } })).toThrow();
  });

  it('refuses a currency that is not an ISO code', () => {
    expect(() => base({ fare: { amountMinor: 15000, currency: 'euro' } })).toThrow();
    expect(() => base({ fare: { amountMinor: 15000, currency: 'eu' } })).toThrow();
  });

  it('caps the pickup note — a spot and a car, not a message thread', () => {
    expect(() => base({ pickupNote: 'x'.repeat(PICKUP_NOTE_CAP + 1) })).toThrow();
    expect(base({ pickupNote: '   ' }).pickupNote).toBeUndefined();
  });

  it('splits evenly across the people in the car, rounding up so nobody is quoted less than they pay', () => {
    const r = base({ fare: { amountMinor: 10000, currency: 'EUR' } });
    expect(fareEach(r, 3)).toBe(3400);
    expect(fareEach(r, 2)).toBe(5000);
    expect(fareEach(r, 4)).toBe(2500);
  });

  it('is nothing each when the host is paying, and unknown without an estimate', () => {
    expect(fareEach(base({ fare, fareSplit: 'host_pays' }), 3)).toBe(0);
    expect(fareEach(base(), 3)).toBeUndefined();
    expect(fareEach(base({ fare }), 0)).toBeUndefined();
  });
});

describe('roomMembers — who is in the car room, derived from the car', () => {
  const confirmed = (id: string) => ({
    personId: asPersonId(id),
    status: 'confirmed' as const,
    askedAt: t('2026-09-16T10:00:00Z'),
    history: [{ at: t('2026-09-16T10:00:00Z'), by: 'system' as const, from: 'requested' as const, to: 'confirmed' as const }],
  });

  it('is the host and everyone confirmed — and nobody who left or was removed', () => {
    const r = base();
    const withPeople: Ride = {
      ...r,
      claims: [
        confirmed('mira'),
        { ...confirmed('omar'), status: 'removed_by_host' },
        { ...confirmed('lucas'), status: 'withdrawn' },
        { ...confirmed('priya'), status: 'requested', history: [] },
      ],
    };
    expect(roomMembers(withPeople).map(String)).toEqual(['you', 'mira']);
  });

  it('keeps the riders of a called-off car, so they can read that it is off', () => {
    const r = base();
    const cancelled: Ride = {
      ...r,
      status: 'cancelled',
      claims: [
        {
          ...confirmed('mira'),
          status: 'revoked_by_policy',
          history: [
            ...confirmed('mira').history,
            { at: t('2026-09-17T10:00:00Z'), by: 'system', from: 'confirmed', to: 'revoked_by_policy' },
          ],
        },
        { ...confirmed('omar'), status: 'removed_by_host' },
      ],
    };
    expect(roomMembers(cancelled).map(String)).toEqual(['you', 'mira']);
  });
});

describe('latestClaim', () => {
  it('reads the newest seat a person has, not the first', () => {
    const r: Ride = {
      ...base(),
      claims: [
        { personId: asPersonId('mira'), status: 'withdrawn', askedAt: t('2026-09-16T10:00:00Z'), history: [] },
        { personId: asPersonId('mira'), status: 'confirmed', askedAt: t('2026-09-16T11:00:00Z'), history: [] },
      ],
    };
    expect(latestClaim(r, asPersonId('mira'))?.status).toBe('confirmed');
  });
});
