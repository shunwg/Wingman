import { useMemo } from 'react';
import type { Circle, Trip } from '@domain/index';
import { tripIsOpen, tripStart } from '@domain/trip';
import { circleIsLive } from '@data/seed/circles';
import { useStore } from '../store';
import { allCircles } from './circles';
import { useBoard, type BoardCandidate } from './board';

/**
 * Home, computed on read.
 *
 * Home answers one question — who should I meet because our paths are about
 * to cross — so it reads the same board the Discover screen reads and picks
 * the one row that matters. Nothing here is stored (rule 2), and nothing here
 * ranks: the engine ranked, the stable pick was made there, this only chooses
 * which journey to lead with.
 */

/** The next open trip by first departure. Insertion order is not an order. */
export function nextTrip(trips: Trip[]): Trip | undefined {
  return trips
    .filter(tripIsOpen)
    .map((t) => ({ t, at: tripStart(t) ?? '' }))
    .sort((a, b) => a.at.localeCompare(b.at))[0]?.t;
}

/**
 * The one person worth meeting on a trip: the stable pick when the engine
 * found one, else the top of the ranking. Both come from the board's order,
 * which is the score's only job.
 */
export function topMatch(candidates: BoardCandidate[], tripId: string): BoardCandidate | undefined {
  const onTrip = candidates.filter((c) => c.viaTripId === tripId);
  return onTrip.find((c) => c.mostCompatible) ?? onTrip[0];
}

/**
 * Events at the destination: conference circles held in a city the trip stays
 * in, still running when the stay does. Membership is not required — this is
 * what is *on*, which is exactly what a delegate who has not joined yet needs.
 */
export function destinationEvents(trip: Trip | undefined, circles: Circle[]): Circle[] {
  if (!trip) return [];
  const cities = new Set(trip.stays.map((s) => String(s.cityKey)));
  return circles.filter((c) => {
    if (c.kind !== 'conference' || !c.venue || !c.runs) return false;
    if (!cities.has(String(c.venue.cityKey))) return false;
    // Any day of the stay inside the event's run.
    return trip.stays.some(
      (s) => String(s.cityKey) === String(c.venue!.cityKey) && s.dates.from <= c.runs!.to && s.dates.to >= c.runs!.from,
    );
  });
}

export interface Home {
  trip: Trip | undefined;
  match: BoardCandidate | undefined;
  /** Everyone else on that trip, for "see all" counts. */
  othersOnTrip: number;
  events: Circle[];
  /** Whether an event above is live today. */
  liveEventIds: Set<string>;
}

export function useHome(): Home {
  const myTrips = useStore((s) => s.myTrips);
  const myCircles = useStore((s) => s.myCircles);
  const now = useStore((s) => s.now);
  const board = useBoard();

  return useMemo(() => {
    const trip = nextTrip(myTrips);
    const match = trip ? topMatch(board.candidates, String(trip.id)) : undefined;
    const othersOnTrip = trip
      ? board.candidates.filter((c) => c.viaTripId === String(trip.id)).length - (match ? 1 : 0)
      : 0;
    const events = destinationEvents(trip, allCircles(myCircles));
    const today = String(now).slice(0, 10);
    const liveEventIds = new Set(events.filter((c) => circleIsLive(c, today)).map((c) => String(c.id)));
    return { trip, match, othersOnTrip, events, liveEventIds };
  }, [myTrips, myCircles, now, board]);
}
