import { describe, expect, it } from 'vitest';
import { asIata, asPersonId, asRideId, asTripId } from '@domain/ids';
import { anyAudience, makeRide, type Ride, type RideDirection } from '@domain/index';
import type { ISODateTime } from '@domain/time';
import { filterRides, needFromArrival, needFromDeparture, rideMatchesNeed, type RideNeed } from './rideFilters';

const t = (s: string) => s as ISODateTime;
const now = t('2026-09-19T09:00:00Z');

/** Fontainebleau — the flagship scenario's non-airport end. */
const FONTAINEBLEAU = { lat: 48.4084, lon: 2.7019 };
/** Paris centre, ~55 km from Fontainebleau. */
const PARIS = { lat: 48.8566, lon: 2.3522 };
/** Melun, ~11 km from Fontainebleau. */
const MELUN = { lat: 48.5392, lon: 2.6603 };

function ride(patch: Partial<Parameters<typeof makeRide>[0]> = {}): Ride {
  return makeRide({
    id: asRideId('r1'),
    hostPersonId: asPersonId('you'),
    tripId: asTripId('t1'),
    direction: 'from_airport',
    airportIata: asIata('CDG'),
    point: { ...FONTAINEBLEAU, label: 'Fontainebleau' },
    window: { from: t('2026-09-19T14:00:00Z'), to: t('2026-09-19T15:00:00Z') },
    seatsTotal: 4,
    audience: { kind: 'open', rules: anyAudience() },
    createdAt: t('2026-09-16T09:00:00Z'),
    ...patch,
  });
}

function need(patch: Partial<RideNeed> = {}): RideNeed {
  return {
    direction: 'from_airport',
    airportIata: asIata('CDG'),
    point: FONTAINEBLEAU,
    window: { from: t('2026-09-19T14:15:00Z'), to: t('2026-09-19T16:00:00Z') },
    ...patch,
  };
}

describe('rideMatchesNeed', () => {
  it('matches the same airport, direction and an overlapping window', () => {
    const m = rideMatchesNeed(ride(), need(), now);
    expect(m).not.toBeNull();
    // intersectWindows() normalises through toISOString(), so the shared slice
    // carries milliseconds even when neither input did.
    expect(m!.sharedWindow).toEqual({ from: '2026-09-19T14:15:00.000Z', to: '2026-09-19T15:00:00.000Z' });
    expect(m!.apartKm).toBe(0);
  });

  it('refuses a different airport', () => {
    expect(rideMatchesNeed(ride(), need({ airportIata: asIata('ORY') }), now)).toBeNull();
  });

  it('refuses the opposite direction — a car leaving CDG is no use to someone catching a flight', () => {
    expect(rideMatchesNeed(ride(), need({ direction: 'to_airport' }), now)).toBeNull();
  });

  it('matches in the to-airport direction too', () => {
    const toAirport = ride({ direction: 'to_airport' as RideDirection });
    const m = rideMatchesNeed(toAirport, need({ direction: 'to_airport' }), now);
    expect(m).not.toBeNull();
  });

  it('refuses a window that does not overlap', () => {
    const later = need({ window: { from: t('2026-09-19T16:00:00Z'), to: t('2026-09-19T17:00:00Z') } });
    expect(rideMatchesNeed(ride(), later, now)).toBeNull();
  });

  it('refuses a car with no seats left', () => {
    const full = ride({ seatsTotal: 2 });
    full.claims.push({
      personId: asPersonId('amelie'),
      status: 'confirmed',
      askedAt: t('2026-09-18T09:00:00Z'),
      history: [],
    });
    expect(rideMatchesNeed(full, need(), now)).toBeNull();
  });

  it('refuses a car whose pickup window has already closed', () => {
    expect(rideMatchesNeed(ride(), need(), t('2026-09-19T15:30:00Z'))).toBeNull();
  });

  it('refuses a cancelled car even while its window is open', () => {
    expect(rideMatchesNeed({ ...ride(), status: 'cancelled' }, need(), now)).toBeNull();
  });
});

describe('the distance filter', () => {
  it('passes a nearby end and fails a far one at the same radius', () => {
    expect(rideMatchesNeed(ride(), need({ point: MELUN }), now, 15)).not.toBeNull();
    expect(rideMatchesNeed(ride(), need({ point: PARIS }), now, 15)).toBeNull();
  });

  it('passes the far one once the radius is wide enough', () => {
    expect(rideMatchesNeed(ride(), need({ point: PARIS }), now, 80)).not.toBeNull();
  });

  it('fails an unstated destination against an explicit radius, and passes with no radius', () => {
    // The board's existing rule, deliberately reproduced: someone who has not
    // said where they are going is not evidence that they are going your way.
    const silent = need({ point: undefined });
    expect(rideMatchesNeed(ride(), silent, now, 15)).toBeNull();
    const m = rideMatchesNeed(ride(), silent, now);
    expect(m).not.toBeNull();
    expect(m!.apartKm).toBeUndefined();
  });
});

describe('filterRides', () => {
  it('returns nearest-end-first, with unstated distances last', () => {
    const near = ride({ id: asRideId('near'), point: { ...MELUN, label: 'Melun' } });
    const far = ride({ id: asRideId('far'), point: { ...PARIS, label: 'Paris' } });
    const sorted = filterRides([far, near], need(), now);
    expect(sorted.map((m) => String(m.ride.id))).toEqual(['near', 'far']);
  });

  it('drops everything that does not match and keeps what does', () => {
    const wrongAirport = ride({ id: asRideId('orly'), airportIata: asIata('ORY') });
    const good = ride({ id: asRideId('good') });
    expect(filterRides([wrongAirport, good], need(), now).map((m) => String(m.ride.id))).toEqual(['good']);
  });

  it('is empty rather than throwing when nothing is on offer', () => {
    expect(filterRides([], need(), now)).toEqual([]);
  });
});

describe('the two need constructors', () => {
  it('read the direction off which end of the journey you are at', () => {
    const w = { from: t('2026-09-19T14:00:00Z'), to: t('2026-09-19T15:00:00Z') };
    expect(
      needFromArrival({ airportIata: asIata('CDG'), arriveUtc: t('2026-09-19T13:40:00Z'), window: w }).direction,
    ).toBe('from_airport');
    expect(needFromDeparture({ airportIata: asIata('OSL'), window: w }).direction).toBe('to_airport');
  });
});
