import { useMemo } from 'react';
import { MATCH_CONFIG_V1, findCandidates, relaxations } from '@matching/index';
import type { MatchInput, MatchResult, RelaxationOutcome } from '@matching/types';
import type { Candidate } from '@matching/types';
import type { Circle, Trip } from '@domain/index';
import { tripCode, tripIsOpen, tripLabel } from '@domain/trip';
import { airportIndex } from '@data/airports/index';
import { RESPONSE_RATES } from '@data/seed/people';
import { seedPool } from '@data/seed/trips';
import { allCircles, decoratePerson } from './circles';
import { distanceKm } from '@lib/geo';
import { useStore } from '../store';
import type { BoardFilters } from '../store';

/**
 * The board, computed on read.
 *
 * Nothing here is stored. Every render recomputes visibility from the current
 * policy, which is what makes a privacy change take effect *now* rather than at
 * the next refresh. Caching this list would be the single easiest way to turn
 * a correct privacy engine into a leak.
 *
 * The engine still answers one question about one trip — that is why it stays
 * pure and testable. Running it once per open trip and stitching the results
 * together is this file's job, not the engine's.
 */

const EMPTY_SUPPRESSED: MatchResult['suppressed'] = {
  byPrivacy: { kind: 'none' },
  byIntent: { kind: 'none' },
  byCircle: { kind: 'none' },
  byAssurance: { kind: 'none' },
  byFeasibility: { kind: 'none' },
};

/** A candidate, plus which of your journeys produced it. */
export interface BoardCandidate extends Candidate {
  viaTripId: string;
  /** Hue key and stable identity — never includes the destination. */
  tripCode: string;
  /** What the card shows: "SQ317 → SIN". */
  tripLabel: string;
  /** Kilometres between where the two of you are headed. Undefined if unknown. */
  destinationKm?: number;
}

export interface Board {
  candidates: BoardCandidate[];
  suppressed: MatchResult['suppressed'];
  context: MatchResult['context'];
  /** Open trips, in departure order — what the trip selector renders. */
  openTrips: Trip[];
  /** Settled trips, so the board can say why they are not producing anyone. */
  settledTrips: Trip[];
  /** How many candidates the *filters* removed, as opposed to privacy. */
  hiddenByFilters: number;
  /** Industries on the unfiltered board, for the chips. */
  industries: { name: string; n: number }[];
  /** Survivor counts per trip, for the timeline. Bucketed before they are shown. */
  perTrip: Record<string, MatchResult['context']>;
}

function baseInput(
  me: ReturnType<typeof useStore.getState>['me'],
  trip: Trip,
  now: string,
  seenCounts: Record<string, number>,
  requests: ReturnType<typeof useStore.getState>['requests'],
): MatchInput {
  const active: MatchInput['requestHistory'] = { active: [], denied: [] };
  for (const r of requests) {
    const other = r.fromPersonId === me.id ? r.toPersonId : r.fromPersonId;
    if (['sent', 'viewed', 'countered', 'accepted'].includes(r.status)) active.active.push(other);
    if (r.status === 'denied') active.denied.push(other);
  }

  return {
    me,
    myTrip: trip,
    myCircleIds: me.memberships.map((m) => String(m.circleId)),
    pool: seedPool().map((e) => ({
      ...e,
      ...(RESPONSE_RATES[String(e.person.id)] !== undefined
        ? { responseRate: RESPONSE_RATES[String(e.person.id)]! }
        : {}),
    })),
    now: now as MatchInput['now'],
    airports: airportIndex,
    config: MATCH_CONFIG_V1,
    seenCounts,
    requestHistory: active,
  };
}

/**
 * Fill in circle display names and badges.
 *
 * `redact()` cannot do this: the privacy engine may not import from `data/`,
 * and rightly so — a visibility rule should never be able to reach a lookup
 * table. So the badge crosses the boundary carrying only ids, and the labels
 * are resolved here, in the layer that is allowed to know both.
 */
function withCircleNames(c: Candidate, circles: Circle[]): Candidate {
  return { ...c, person: decoratePerson(c.person, circles) };
}

/**
 * Where this person is headed after they land, if they said.
 *
 * Matched on the city rather than on a trip id, because the candidate carries
 * no reference to which of *their* trips produced the overlap. Since a person's
 * trips do not overlap in time, sharing a city with the journey in question
 * identifies the right one.
 */
function destinationOf(personId: string, myTrip: Trip) {
  const cities = new Set(myTrip.stays.map((s) => String(s.cityKey)));
  for (const entry of seedPool()) {
    if (String(entry.person.id) !== personId) continue;
    const match = entry.trip.stays.find(
      (s) => s.destination && cities.has(String(s.cityKey)),
    );
    if (match) return match.destination;
  }
  return undefined;
}

export function applyBoardFilters(
  candidates: BoardCandidate[],
  filters: BoardFilters,
  genderOf: (id: string) => string | undefined,
  saved: string[] = [],
): BoardCandidate[] {
  return candidates.filter((c) => {
    if (filters.tripId !== 'all' && c.viaTripId !== filters.tripId) return false;

    // The lens: why now. Same flight and same airport are overlap kinds; same
    // event is a conference badge the person chose to show.
    if (filters.lens === 'same_flight' && c.overlap.kind !== 'same_flight') return false;
    if (filters.lens === 'same_airport' && c.overlap.kind !== 'shared_layover' && c.overlap.kind !== 'same_airport_window') return false;
    if (filters.lens === 'same_event' && !c.person.circles.some((x) => x.kind === 'conference')) return false;
    if (filters.savedOnly && !saved.includes(String(c.person.id))) return false;
    if (filters.industry !== 'any' && industryOf(c) !== filters.industry) return false;

    if (filters.circleId !== 'any') {
      // Matches on badges the viewer can actually see. A `match_only`
      // membership is deliberately invisible here — filtering by a circle
      // somebody chose not to display would leak exactly the fact they hid.
      const shown = c.person.circles.map((x) => String(x.circleId));
      if (!shown.includes(filters.circleId)) return false;
    }

    if (filters.womenOnly && genderOf(String(c.person.id)) !== 'woman') return false;

    if (filters.withinKm !== null) {
      // Unknown destination fails an explicit distance filter. Someone who has
      // not said where they are going is not evidence that they are going your
      // way, and silently including them would make the radius meaningless.
      if (c.destinationKm === undefined || c.destinationKm > filters.withinKm) return false;
    }

    return true;
  });
}

/** The industry on a card, when the ladder released it. */
export function industryOf(c: BoardCandidate): string | undefined {
  const p = c.person.professional;
  if (!p || (typeof p === 'object' && '__redacted' in p)) return undefined;
  const v = (p as { industry?: string }).industry;
  return v && v.length > 0 ? v : undefined;
}

/** Industries on the board, most common first, for the filter chips. */
export function industriesOn(candidates: BoardCandidate[], limit = 5): { name: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    const i = industryOf(c);
    if (i) counts.set(i, (counts.get(i) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function useBoard(): Board {
  const me = useStore((s) => s.me);
  const myTrips = useStore((s) => s.myTrips);
  const now = useStore((s) => s.now);
  const seenCounts = useStore((s) => s.seenCounts);
  const requests = useStore((s) => s.requests);
  const filters = useStore((s) => s.filters);
  const myCircles = useStore((s) => s.myCircles);
  const saved = useStore((s) => s.saved);

  return useMemo(() => {
    const circles = allCircles(myCircles);
    const openTrips = myTrips.filter(tripIsOpen);
    const settledTrips = myTrips.filter((t) => t.outcome);

    const genderById = new Map(
      seedPool().map((e) => [String(e.person.id), e.person.gender as string]),
    );

    const seen = new Set<string>();
    const merged: BoardCandidate[] = [];
    let suppressed = EMPTY_SUPPRESSED;
    const context = { onYourFlight: 0, inYourLayover: 0, inYourCity: 0, overlappingDates: 0 };
    const perTrip: Board['perTrip'] = {};

    for (const trip of openTrips) {
      const result = findCandidates(baseInput(me, trip, String(now), seenCounts, requests));
      const myDest = trip.stays.find((s) => s.destination)?.destination;
      perTrip[String(trip.id)] = result.context;

      context.onYourFlight += result.context.onYourFlight;
      context.inYourLayover += result.context.inYourLayover;
      context.inYourCity += result.context.inYourCity;
      context.overlappingDates += result.context.overlappingDates;
      // Suppression counts come from the trip currently in focus; summing
      // bucketed counts across trips would produce a number that is neither
      // a real total nor a real bucket.
      if (filters.tripId === String(trip.id) || openTrips.length === 1) {
        suppressed = result.suppressed;
      }

      for (const raw of result.candidates) {
        const id = String(raw.person.id);
        /*
         * One row per person *per trip*, not per person.
         *
         * Frequent travellers legitimately overlap more than one of your
         * journeys — Tobias is in Singapore this week and Copenhagen in a
         * fortnight — and those are two different opportunities to meet, not
         * one fact recorded twice. Collapsing them would keep the higher-scoring
         * row and silently discard the other, which is precisely the ambiguity
         * the trip tag exists to remove. Each row carries its own flight code,
         * so the repetition reads as "twice, differently" rather than as a bug.
         */
        const key = `${id}::${String(trip.id)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const theirDest = destinationOf(id, trip);
        const candidate: BoardCandidate = {
          ...withCircleNames(raw, circles),
          viaTripId: String(trip.id),
          tripCode: tripCode(trip),
          tripLabel: tripLabel(trip),
        };
        if (myDest && theirDest) candidate.destinationKm = distanceKm(myDest, theirDest);
        merged.push(candidate);
      }
    }

    merged.sort((a, b) => b.score - a.score);
    const filtered = applyBoardFilters(merged, filters, (id) => genderById.get(id), saved.map(String));

    return {
      candidates: filtered,
      suppressed,
      context,
      openTrips,
      settledTrips,
      hiddenByFilters: merged.length - filtered.length,
      industries: industriesOn(merged),
      perTrip,
    };
  }, [me, myTrips, now, seenCounts, requests, filters, myCircles, saved]);
}

/**
 * What widening would actually unlock.
 *
 * Computed by re-running the engine, not estimated, so the empty state's
 * promise is checkable. Only offered when it changes the answer — a suggestion
 * that unlocks nobody teaches people the suggestions are noise.
 */
export function useRelaxations(): RelaxationOutcome[] {
  const me = useStore((s) => s.me);
  const myTrips = useStore((s) => s.myTrips);
  const now = useStore((s) => s.now);
  const seenCounts = useStore((s) => s.seenCounts);
  const requests = useStore((s) => s.requests);

  return useMemo(() => {
    const first = myTrips.filter(tripIsOpen)[0];
    if (!first) return [];
    return relaxations(baseInput(me, first, String(now), seenCounts, requests));
  }, [me, myTrips, now, seenCounts, requests]);
}
