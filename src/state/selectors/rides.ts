import { useMemo } from 'react';
import type { RedactedPerson, Ride, RideClaim, Trip } from '@domain/index';
import { riders, rideRoute, seatsLeft, tripIsListed, tripIsOver } from '@domain/index';
import { addMinutes, intersectWindows } from '@domain/time';
import { filterRides, type RideNeed } from '@matching/index';
import { bucketPhrase } from '@lib/bucket';
import { tripFor } from '@data/seed/trips';
import { personById } from '@data/seed/people';
import { redact } from '@privacy/index';
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
      // Your own cars only. A code someone sent you is not "held" just because
      // the car is on this device — the link route passes it in for the one
      // evaluation that needs it.
      heldCodes: rides
        .filter((r) => r.inviteCode && String(r.hostPersonId) === String(me.id))
        .map((r) => String(r.inviteCode)),
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
  /*
   * The board's filters apply here too, and two of them mean something for a
   * car: which trip, and how far from where you are going. They rendered in
   * selected states above the car list and did nothing at all — the exact
   * dead-control failure this project just spent a QA round removing from the
   * native prototype. The rest of the row is hidden on this lens rather than
   * left inert, in `BoardFilters`.
   */
  const filters = useStore((s) => s.filters);

  return useMemo(() => {
    /*
     * A car on a hidden trip is hidden.
     *
     * `tripIsOpen` gates the *person* board in `hardFilters`, and rides never
     * consulted it — so "Hide this trip" left the car from that same trip on
     * everyone's board, with the hide button and the car row rendering inside
     * the same card. Whatever else that is, it is not what the button says.
     */
    const others = rides.filter((r) => {
      if (String(r.hostPersonId) === String(v.me.id)) return false;
      const hostTrip = tripFor(String(r.hostPersonId));
      // Hidden hides the car; settled does not — a host who agreed to a coffee
      // on the same trip still wants the car filled.
      return !hostTrip || String(hostTrip.id) !== String(r.tripId) || tripIsListed(hostTrip);
    });
    const seen = new Map<string, RideRow>();
    let hidden = 0;

    /*
     * Every trip you are still taking — not only the ones still looking for
     * people. Scoping this to `tripIsOpen` meant that agreeing to meet anyone
     * on a trip hid every car going its way, and the board then said nobody
     * had offered one: false, and on the one screen that should get you into
     * town for the meet you just agreed.
     */
    const live = (t: (typeof myTrips)[number]) => !tripIsOver(t, v.now);
    const scoped =
      filters.tripId === 'all'
        ? myTrips.filter(live)
        : myTrips.filter((t) => live(t) && String(t.id) === filters.tripId);

    for (const trip of scoped) {
      for (const need of needsForTrip(trip)) {
        for (const match of filterRides(others, need, v.now, filters.withinKm ?? undefined)) {
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
  }, [rides, myTrips, v, filters.tripId, filters.withinKm]);
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

/**
 * Which of *your* trips a car belongs to.
 *
 * For a host, the trip the car was offered on. For a passenger it cannot be
 * `ride.tripId` — that is the host's trip, which is not in your list — and
 * filtering on it is why a seat you took never appeared on your own trip, and
 * why "Tell the car" never appeared for anyone but the host. A passenger's car
 * belongs to the trip it serves: same airport, same direction, a window that
 * overlaps when you land or leave. Joinability is deliberately not checked —
 * a full car you are in is still your car.
 */
export function tripForRide(ride: Ride, myTrips: readonly Trip[], meId: string): Trip | undefined {
  if (String(ride.hostPersonId) === meId) return myTrips.find((t) => String(t.id) === String(ride.tripId));
  return myTrips.find((t) =>
    needsForTrip(t).some(
      (need) =>
        need.direction === ride.direction &&
        String(need.airportIata) === String(ride.airportIata) &&
        intersectWindows(need.window, ride.window) !== null,
    ),
  );
}


/**
 * The car a channel belongs to, if it belongs to one.
 *
 * Keyed off the derived `ride:<id>` channel id rather than a field on the
 * channel, so a room and its car cannot disagree about which car it is.
 */
export function useRideForChannel(channelId: string): RideRow | undefined {
  const v = useRideViewer();
  const rides = useStore((s) => s.rides);

  return useMemo(() => {
    if (!channelId.startsWith('ride:')) return undefined;
    const rideId = channelId.slice('ride:'.length);
    const ride = rides.find((r) => String(r.id) === rideId);
    return ride ? rowFor(ride, v) : undefined;
  }, [channelId, rides, v]);
}


/** Somebody asked for a seat in a car you host, and is waiting on you. */
export interface SeatAsk {
  ride: Ride;
  claim: RideClaim;
  route: { from: string; to: string };
  /** Rung 0 — what the ladder allows before you have said anything. */
  card: RedactedPerson;
}

/**
 * Every seat request waiting on you, across your cars.
 *
 * A host used to learn of one only by opening the car — nothing on Home,
 * nothing in the inbox — so an open car's "you approve each person" was a
 * promise that depended on the host happening to look.
 */
export function useSeatAsks(): SeatAsk[] {
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const rides = useStore((s) => s.rides);
  return useMemo(
    () =>
      rides.flatMap((ride) => {
        if (String(ride.hostPersonId) !== String(me.id)) return [];
        if (ride.status === 'cancelled' || String(now) >= String(ride.expiresAt)) return [];
        return ride.claims
          .filter((c) => c.status === 'requested')
          .flatMap((claim) => {
            const p = personById(String(claim.personId));
            return p ? [{ ride, claim, route: rideRoute(ride), card: redact(p, 0) }] : [];
          });
      }),
    [rides, me.id, now],
  );
}
