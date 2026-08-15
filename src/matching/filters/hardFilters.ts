import type { AirportIndex, ISODateTime, MeetKind, Person, Trip } from '@domain/index';
import { compilePolicy, resolveMutual } from '@privacy/index';
import type { PersonFacets, PolicySubject } from '@privacy/types';
import { epoch } from '@domain/time';
import type { MatchConfig, PoolEntry, RequestHistory, TravelOverlap } from '../types';
import { classifyOverlap } from '../travel/overlap';
import { activeAxes, effectiveOpenTo, proposableKinds } from './intent';
import { proximityFor } from '../travel/proximity';

/**
 * Hard filters.
 *
 * These **remove**, never down-rank. A person who fails any of them does not
 * appear at position 40 — they do not appear. Down-ranking an ineligible
 * candidate is how a system ends up showing someone a person they are not
 * allowed to contact, or one they cannot physically meet.
 *
 * Evaluated in order, cheapest and most absolute first. The first denial
 * short-circuits and increments a bucketed suppression counter so the board can
 * be honest about what it is not showing, without ever revealing who.
 */

export type DenialReason =
  | 'self'
  | 'blocked'
  | 'trip_hidden'
  | 'trip_past'
  | 'no_overlap'
  | 'privacy'
  | 'assurance'
  | 'circle'
  | 'intent'
  | 'feasibility'
  | 'request_history';

export interface FilterOutcome {
  ok: boolean;
  reason?: DenialReason;
  overlaps: TravelOverlap[];
  proposable: MeetKind[];
}

export interface FilterInput {
  me: Person;
  myTrip: Trip;
  myFacets: PersonFacets;
  mySubject: PolicySubject;
  myCircleIds: string[];
  entry: PoolEntry;
  airports: AirportIndex;
  config: MatchConfig;
  now: ISODateTime;
  requestHistory?: RequestHistory;
}

const deny = (reason: DenialReason, overlaps: TravelOverlap[] = []): FilterOutcome => ({
  ok: false,
  reason,
  overlaps,
  proposable: [],
});

export function applyHardFilters(input: FilterInput): FilterOutcome {
  const { me, myTrip, entry, airports, config, now } = input;
  const them = entry.person;
  const theirTrip = entry.trip;

  /* 1. Self. */
  if (them.id === me.id) return deny('self');

  /* 2. Blocks, both directions. Absolute, and checked before anything else
        that might leak information through timing or counts. */
  if (me.blocked.includes(them.id) || them.blocked.includes(me.id)) return deny('blocked');

  /* 3. The trip has to be listed, and still in the future. */
  if (theirTrip.visibility.listing === 'hidden') return deny('trip_hidden');
  const lastArrival = [...theirTrip.segments].sort(
    (a, b) => epoch(b.arriveUtc) - epoch(a.arriveUtc),
  )[0];
  if (lastArrival && epoch(lastArrival.arriveUtc) < epoch(now)) return deny('trip_past');

  /* 4. The itineraries have to actually touch. */
  const overlaps = classifyOverlap(myTrip, theirTrip, airports, config);
  if (overlaps.length === 0) return deny('no_overlap');

  /* 5. Privacy, delegated wholesale to the privacy engine. Matching does not
        get to have an opinion about visibility — it asks and obeys. */
  const proximity = proximityFor(overlaps);
  const theirFacets: PersonFacets = {
    id: them.id,
    gender: them.gender,
    assurance: maxAssurance(them),
    stampKinds: them.verifications.filter((v) => !v.revokedAt).map((v) => v.kind),
    circleIds: (entry.circleIds ?? []) as PersonFacets['circleIds'],
    intents: activeAxes(them.intent),
    blocked: them.blocked,
    proximity,
    channel: 'app',
    onTrip: true,
  };
  const theirSubject: PolicySubject = {
    facets: theirFacets,
    policy: compilePolicy(them.privacy, entry.circleIds ?? []),
  };

  // My own facets need the pair's proximity, which is only known now.
  const mySubject: PolicySubject = {
    facets: { ...input.myFacets, proximity },
    policy: input.mySubject.policy,
  };

  const verdict = resolveMutual(mySubject, theirSubject, { now });
  if (!verdict.mutual) {
    // Attribute the suppression to the most specific cause available, so the
    // board's honest note ("some people limit who can see them") is accurate.
    const denied = [...verdict.aSeesB.deniedBy, ...verdict.bSeesA.deniedBy];
    if (denied.some((d) => d.startsWith('assurance'))) return deny('assurance', overlaps);
    if (denied.some((d) => d.startsWith('circle'))) return deny('circle', overlaps);
    if (denied.some((d) => d.startsWith('intent'))) return deny('intent', overlaps);
    return deny('privacy', overlaps);
  }

  /* 6. Something has to be arrangeable. Geometry first, then both people's
        openness — an empty intersection is a filter, not a low score. */
  const mine = effectiveOpenTo(me.intent, myTrip);
  const theirs = effectiveOpenTo(them.intent, theirTrip);
  const proposable = proposableKinds(overlaps, mine, theirs, config);
  if (proposable.length === 0) return deny('feasibility', overlaps);

  /* 7. Do not re-surface someone with a live request, or anyone who declined.
        A no is a no for the trip, whatever the pretext. */
  const history = input.requestHistory;
  if (history) {
    if (history.active.includes(them.id)) return deny('request_history', overlaps);
    if (history.denied.includes(them.id)) return deny('request_history', overlaps);
  }

  return { ok: true, overlaps, proposable };
}

export function maxAssurance(p: Person): PersonFacets['assurance'] {
  return p.verifications
    .filter((v) => !v.revokedAt)
    .reduce<PersonFacets['assurance']>((max, v) => (v.assurance > max ? v.assurance : max), 0);
}
