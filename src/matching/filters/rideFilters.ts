import type { IataCode, Ride, RideDirection } from '@domain/index';
import { rideIsJoinable, sharesDirection } from '@domain/index';
import type { ISODateTime, TimeWindow } from '@domain/time';
import { intersectWindows } from '@domain/time';
import { distanceKm, type LatLon } from '@lib/geo';

/**
 * Which cars are going my way.
 *
 * The privacy half — may I see this car at all — lives in
 * `privacy/ride/audience.ts` and is a different question with a different
 * answer. This file only knows about geometry and clocks, which is why it can
 * be a handful of pure predicates with no notion of who anybody is.
 *
 * `now` is a parameter, never `Date.now()`. ESLint bans the clock inside the
 * engines, and this is why: a filter that reads the wall clock cannot be tested
 * against a fixed scenario, and a ride sitting exactly on its expiry boundary is
 * the case most likely to be wrong.
 */

/** What a traveller needs a car for. */
export interface RideNeed {
  direction: RideDirection;
  /** The airport they are flying from or into. */
  airportIata: IataCode;
  /**
   * Where they are coming from or going to, coarsely.
   *
   * Optional, because plenty of people have not said. An unstated destination
   * does not silently pass a distance filter — see `rideMatchesNeed`.
   */
  point?: LatLon;
  /** When they could leave. */
  window: TimeWindow;
}

export interface RideMatch {
  ride: Ride;
  /** How far apart the two non-airport ends are. Undefined when unstated. */
  apartKm?: number;
  /** The slice of time both parties could travel in. */
  sharedWindow: TimeWindow;
}

/**
 * Whether a car is any use to a traveller, geometrically.
 *
 * `withinKm` is deliberately explicit rather than defaulted: "cars near me"
 * with an implicit radius is a filter whose answer nobody can predict, and the
 * board already learned this lesson — an unknown destination fails an explicit
 * radius, because someone who has not said where they are going is not evidence
 * that they are going your way.
 */
export function rideMatchesNeed(
  ride: Ride,
  need: RideNeed,
  now: ISODateTime,
  withinKm?: number,
): RideMatch | null {
  if (!rideIsJoinable(ride, now)) return null;
  if (!sharesDirection(ride.direction, need.direction)) return null;
  if (String(ride.airportIata) !== String(need.airportIata)) return null;

  const sharedWindow = intersectWindows(ride.window, need.window);
  if (!sharedWindow) return null;

  const apartKm = need.point ? distanceKm(ride.point, need.point) : undefined;
  if (withinKm !== undefined) {
    if (apartKm === undefined) return null;
    if (apartKm > withinKm) return null;
  }

  return { ride, ...(apartKm === undefined ? {} : { apartKm }), sharedWindow };
}

/**
 * Cars a traveller could join, nearest end first.
 *
 * Nearest-first because the question a passenger is actually asking is "who is
 * going closest to where I am going", and a car leaving from the same
 * neighbourhood is worth more than one leaving ten minutes later from further
 * away. Cars with an unstated distance sort last rather than being dropped —
 * they are still joinable, just unrankable on that axis.
 */
export function filterRides(
  rides: Ride[],
  need: RideNeed,
  now: ISODateTime,
  withinKm?: number,
): RideMatch[] {
  const matches: RideMatch[] = [];
  for (const ride of rides) {
    const m = rideMatchesNeed(ride, need, now, withinKm);
    if (m) matches.push(m);
  }
  return matches.sort((a, b) => {
    if (a.apartKm === undefined && b.apartKm === undefined) return 0;
    if (a.apartKm === undefined) return 1;
    if (b.apartKm === undefined) return -1;
    return a.apartKm - b.apartKm;
  });
}

/** The need implied by a leg of a journey: land at X, head to Y. */
export function needFromArrival(input: {
  airportIata: IataCode;
  arriveUtc: ISODateTime;
  /** How long after landing someone would still share a car. */
  window: TimeWindow;
  point?: LatLon;
}): RideNeed {
  return {
    direction: 'from_airport',
    airportIata: input.airportIata,
    window: input.window,
    ...(input.point ? { point: input.point } : {}),
  };
}

/** The need implied by a departure: get from Y to X in time for a flight. */
export function needFromDeparture(input: {
  airportIata: IataCode;
  window: TimeWindow;
  point?: LatLon;
}): RideNeed {
  return {
    direction: 'to_airport',
    airportIata: input.airportIata,
    window: input.window,
    ...(input.point ? { point: input.point } : {}),
  };
}
