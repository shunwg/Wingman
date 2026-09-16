import { useMemo } from 'react';
import type { Ride, RideClaim, Trip } from '@domain/index';
import { riders, rideRoute, seatsLeft, tripIsOpen } from '@domain/index';
import { addMinutes } from '@domain/time';
import { filterRides, type RideNeed } from '@matching/index';
import { bucketPhrase } from '@lib/bucket';
import { useStore } from '@state/store';
import { claimRefusal, myClaim, rideVisibility, type ClaimRefusal, type RideViewer } from '@state/rides/eligibility';

/**
 * Shared cars, as the screens need them.
 *
 * Nothing in here is persisted. Which cars a person may see is recomputed on
 * every read, from the cars, their own memberships and the clock — so a host
 * narrowing a door takes effect on the next render rather than whenever a cache
 * happens to be invalidated.
 */

/** How long after landing, or before a departure, a shared car is plausible. */
const AFTER_LANDING_MIN = 180;
const BEFORE_DEPARTURE_MIN = 180;

export interface RideRow {
  ride: Ride;
  /** "SIN → Marina Bay", in travel order. */
  route: { from: string; to: string };
  seatsLeft: number;
  /** Everyone in the car, host first. */
  riders: ReturnType<typeof riders>;
  /** How far the car's end is from where the viewer is headed, when both said. */
  apartKm?: number;
  /** Null when the viewer may take a seat; otherwise why not. */
  refusal: ClaimRefusal | null;
  /** True when taking a seat needs no confirmation from the host. */
  seatsAutomatically: boolean;
  /** The viewer's own seat in this car, if they have one. */
  mine?: RideClaim;
}

function useRideViewer(): RideViewer {
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const rides = useStore((s) => s.rides);
  const memberKey = me.memberships
    .filter((m) => m.display !== 'paused')
    .map((m) => String(m.circleId))
    .join(',');
  return useMemo(
    () => ({
      me,
      myCircleIds: memberKey ? memberKey.split(',') : [],
      now,
      // A code is "held" once a car carrying it is on this device — which is
      // what following an invite link does. Nothing else grants it.
      heldCodes: rides.filter((r) => r.inviteCode).map((r) => String(r.inviteCode)),
    }),
    [me, memberKey, now, rides],
  );
}

function rowFor(ride: Ride, v: RideViewer, apartKm?: number): RideRow {
  const mine = myClaim(ride, v.me.id);
  return {
    ride,
    route: rideRoute(ride),
    seatsLeft: seatsLeft(ride),
    riders: riders(ride),
    ...(apartKm === undefined ? {} : { apartKm }),
    refusal: claimRefusal(ride, v),
    seatsAutomatically: rideVisibility(ride, v).seatsAutomatically,
    ...(mine ? { mine } : {}),
  };
}

/**
 * The needs a trip implies.
 *
 * Both ends of the journey, because the feature is explicitly two-directional:
 * landing somewhere means wanting a car *out* of that airport, and a departure
 * means wanting one *to* it. The departure end carries no destination — the app
 * does not know where someone starts their day from, and inventing a point
 * there would quietly filter out cars that are perfectly usable.
 */
export function needsForTrip(trip: Trip): RideNeed[] {
  const needs: RideNeed[] = [];
  const first = trip.segments[0];
  const last = trip.segments.at(-1);

  if (last) {
    const point = trip.stays.find((s) => s.destination)?.destination;
    needs.push({
      direction: 'from_airport',
      airportIata: last.to,
      window: { from: last.arriveUtc, to: addMinutes(last.arriveUtc, AFTER_LANDING_MIN) },
      ...(point ? { point: { lat: point.lat, lon: point.lon } } : {}),
    });
  }

  if (first) {
    needs.push({
      direction: 'to_airport',
      airportIata: first.from,
      window: { from: addMinutes(first.departUtc, -BEFORE_DEPARTURE_MIN), to: first.departUtc },
    });
  }

  return needs;
}

/**
 * Cars the viewer could take a seat in, across every open trip.
 *
 * Two gates, in this order: matching decides which cars are going the viewer's
 * way, then privacy decides which of those may be shown at all. Order matters
 * for the count below — "hidden by someone's settings" must mean exactly that,
 * not "was never going your way in the first place".
 */
export function useJoinableRides(): { rows: RideRow[]; hiddenNote?: string } {
  const v = useRideViewer();
  const rides = useStore((s) => s.rides);
  const myTrips = useStore((s) => s.myTrips);

  return useMemo(() => {
    const others = rides.filter((r) => String(r.hostPersonId) !== String(v.me.id));
    const seen = new Map<string, RideRow>();
    let hidden = 0;

    for (const trip of myTrips.filter(tripIsOpen)) {
      for (const need of needsForTrip(trip)) {
        for (const match of filterRides(others, need, v.now)) {
          const id = String(match.ride.id);
          if (seen.has(id)) continue;
          if (!rideVisibility(match.ride, v).visible) {
            hidden += 1;
            continue;
          }
          seen.set(id, rowFor(match.ride, v, match.apartKm));
        }
      }
    }

    const rows = [...seen.values()].sort((a, b) => {
      if (a.apartKm === undefined && b.apartKm === undefined) return 0;
      if (a.apartKm === undefined) return 1;
      if (b.apartKm === undefined) return -1;
      return a.apartKm - b.apartKm;
    });

    // Bucketed, per rule 3. On a four-passenger flight an exact "2 hidden"
    // names both of them.
    return hidden > 0
      ? { rows, hiddenNote: `${bucketPhrase(hidden, 'car', 'cars')} hidden by someone's settings.` }
      : { rows };
  }, [rides, myTrips, v]);
}

/** Cars the viewer hosts, plus any where they hold a live seat. */
export function useMyRides(): { hosting: RideRow[]; riding: RideRow[] } {
  const v = useRideViewer();
  const rides = useStore((s) => s.rides);

  return useMemo(() => {
    const hosting: RideRow[] = [];
    const riding: RideRow[] = [];
    for (const ride of rides) {
      if (String(ride.hostPersonId) === String(v.me.id)) {
        hosting.push(rowFor(ride, v));
        continue;
      }
      const mine = myClaim(ride, v.me.id);
      if (mine && (mine.status === 'requested' || mine.status === 'confirmed')) {
        riding.push(rowFor(ride, v));
      }
    }
    return { hosting, riding };
  }, [rides, v]);
}

/** One car, for its own screen. Undefined when it is not this viewer's to see. */
export function useRide(rideId: string | undefined): RideRow | undefined {
  const v = useRideViewer();
  const rides = useStore((s) => s.rides);

  return useMemo(() => {
    if (!rideId) return undefined;
    const ride = rides.find((r) => String(r.id) === rideId);
    if (!ride) return undefined;
    const own = String(ride.hostPersonId) === String(v.me.id);
    const mine = myClaim(ride, v.me.id);
    if (!own && !mine && !rideVisibility(ride, v).visible) return undefined;
    return rowFor(ride, v);
  }, [rideId, rides, v]);
}

/** Seats waiting on the host, for the car's own screen. */
export const pendingSeats = (ride: Ride): RideClaim[] =>
  ride.claims.filter((c) => c.status === 'requested');

/** The per-person share, as an estimate and never a charge. */
export function fareShare(ride: Ride, estimateMinor: number): number | undefined {
  if (ride.fareSplit === 'host_pays') return 0;
  const n = riders(ride).length;
  return n > 0 ? Math.round(estimateMinor / n) : undefined;
}

