import type { Person, PersonId, Ride } from '@domain/index';
import { riders, rideIsJoinable, seatsLeft } from '@domain/index';
import type { ISODateTime } from '@domain/time';
import { compilePolicy, evaluateRideAudience, type RideAudienceVerdict } from '@privacy/index';
import type { PersonFacets } from '@privacy/types';
import { selfFacets } from '@matching/index';
import { seedPool } from '@data/seed/trips';

/**
 * May I see this car, and may I take a seat in it?
 *
 * Deliberately not a hook and deliberately not inside the store: the selectors
 * need it to decide what to render, and `claimSeat` needs it to decide whether
 * to honour a write. If those two asked different questions — a screen that
 * offers a seat over a store that would have refused it, or worse the reverse —
 * the bug would look like a broken button rather than a privacy hole.
 *
 * Nothing here is stored. Every answer is recomputed from the ride, the viewer
 * and the clock, which is rule 2 doing its job: the host flips a car to
 * women-only and the next read tells the truth.
 */

export interface RideViewer {
  me: Person;
  /** Circle ids the viewer is actually in, from their live memberships. */
  myCircleIds: string[];
  now: ISODateTime;
  /** Invite codes this viewer has followed a link for, this session or stored. */
  heldCodes?: string[];
}

/** The host's facets and policy, from the seed pool or the viewer themselves. */
function hostSubject(ride: Ride, v: RideViewer): { facets: PersonFacets; policy: ReturnType<typeof compilePolicy> } {
  if (String(ride.hostPersonId) === String(v.me.id)) {
    const facets = selfFacets(v.me, v.myCircleIds, { proximity: 'none', channel: 'app', onTrip: true });
    return { facets, policy: compilePolicy(v.me.privacy, v.myCircleIds) };
  }
  const entry = seedPool().find((e) => String(e.person.id) === String(ride.hostPersonId));
  if (!entry) {
    // A car whose host this device knows nothing about. Treated as invisible
    // rather than as unrestricted — an unknown host is not a permissive one.
    const facets = selfFacets(v.me, [], { proximity: 'none', channel: 'app', onTrip: true });
    return { facets, policy: compilePolicy(v.me.privacy, []) };
  }
  const them = entry.person as unknown as Person;
  const circleIds = entry.circleIds ?? [];
  return {
    facets: selfFacets(them, circleIds, { proximity: 'none', channel: 'app', onTrip: true }),
    policy: compilePolicy(them.privacy, circleIds),
  };
}

/** Whether the host is someone this device can actually resolve. */
function hostIsKnown(ride: Ride, v: RideViewer): boolean {
  if (String(ride.hostPersonId) === String(v.me.id)) return true;
  return seedPool().some((e) => String(e.person.id) === String(ride.hostPersonId));
}

/**
 * Somebody in this car the viewer has hidden, or who has hidden them.
 *
 * The audience rules answer "may this viewer see the *host*", which is the
 * question a profile asks and exactly the wrong one for a car: a car has
 * passengers, and a rider row renders a face and a first name. So hiding
 * someone did nothing once they took a seat in a third party's car — their
 * photograph came back on your board, next to a named airport and a one-hour
 * window. An adversarial persona walked straight through it.
 *
 * A block is symmetric and absolute here, as it is in `blockEither`.
 */
function blockedRider(ride: Ride, v: RideViewer): boolean {
  const mine = new Set(v.me.blocked.map(String));
  for (const id of riders(ride)) {
    if (String(id) === String(v.me.id)) continue;
    if (mine.has(String(id))) return true;
    const them = seedPool().find((e) => String(e.person.id) === String(id));
    if (them?.person.blocked.some((b) => String(b) === String(v.me.id))) return true;
  }
  return false;
}

export function rideVisibility(ride: Ride, v: RideViewer): RideAudienceVerdict {
  if (!hostIsKnown(ride, v)) {
    return { visible: false, seatsAutomatically: false, deniedBy: [], reasons: [] };
  }
  if (blockedRider(ride, v)) {
    return {
      visible: false,
      seatsAutomatically: false,
      deniedBy: ['block.either'],
      reasons: [{ ruleId: 'block.either', side: 'yours', text: 'Not available.' }],
    };
  }
  const host = hostSubject(ride, v);
  const viewer = selfFacets(v.me, v.myCircleIds, { proximity: 'none', channel: 'app', onTrip: true });
  return evaluateRideAudience({
    audience: ride.audience,
    viewer,
    host: host.facets,
    hostPolicy: host.policy,
    now: v.now,
    holdsInviteCode: ride.inviteCode ? (v.heldCodes ?? []).includes(ride.inviteCode) : false,
  });
}

export type ClaimRefusal =
  | 'not_visible'
  | 'own_car'
  | 'already_claimed'
  | 'no_seats'
  | 'closed';

/**
 * Whether this viewer may claim a seat, and if not, why.
 *
 * The refusal is a code rather than a sentence because the caller decides how
 * much to say: a screen can explain "no seats left", while the store only
 * needs to know it must not write.
 */
export function claimRefusal(ride: Ride, v: RideViewer): ClaimRefusal | null {
  if (String(ride.hostPersonId) === String(v.me.id)) return 'own_car';
  if (!rideVisibility(ride, v).visible) return 'not_visible';
  const mine = ride.claims.find((c) => String(c.personId) === String(v.me.id));
  if (mine && (mine.status === 'requested' || mine.status === 'confirmed')) return 'already_claimed';
  if (!rideIsJoinable(ride, v.now)) return seatsLeft(ride) === 0 ? 'no_seats' : 'closed';
  return null;
}

export const canClaim = (ride: Ride, v: RideViewer): boolean => claimRefusal(ride, v) === null;

/** The seat this person holds in this car, if any. */
export const myClaim = (ride: Ride, meId: PersonId) =>
  ride.claims.find((c) => String(c.personId) === String(meId));
