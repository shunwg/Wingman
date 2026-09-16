import type { PersonId, Ride, RideClaim, RideClaimEvent, RideClaimStatus, RideEvent, RideStatus } from '@domain/index';
import type { ISODateTime } from '@domain/time';

/**
 * The seat machine, and the ride machine beside it.
 *
 * Same contract as `meetRequest.ts`, for the same reason: every write to a seat
 * goes through here, the table is the only definition of what is legal, and an
 * illegal move throws instead of quietly writing a bad status. A seat that is
 * somehow both `declined` and `confirmed` is not a display bug — it is a person
 * standing at a taxi rank at 05:40 expecting a car that has no room for them.
 *
 * Two tables rather than one, because a seat and a car have genuinely different
 * lives. Four seats can each be settled separately while the car itself is still
 * `open`, and the car can be cancelled out from under all four.
 */

export const CLAIM_TRANSITIONS: Record<RideClaimStatus, RideClaimStatus[]> = {
  requested: ['confirmed', 'declined', 'withdrawn', 'expired', 'revoked_by_policy'],
  // A confirmed passenger can still pull out, and the host can still take the
  // seat back. Both directions matter and for the same reason: a shared car is
  // a favour between people who mostly do not know each other, not a
  // commitment device — and unlike every other meet in this app, you cannot
  // leave it once it is moving.
  confirmed: ['withdrawn', 'removed_by_host', 'expired', 'revoked_by_policy'],
  declined: [],
  withdrawn: [],
  removed_by_host: [],
  expired: [],
  revoked_by_policy: [],
};

export const RIDE_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  open: ['confirmed', 'departed', 'cancelled'],
  confirmed: ['departed', 'cancelled'],
  // Cancellable right up to the end of the journey: a car that never turned up
  // has to be sayable, and "departed" is the state where that is discovered.
  departed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const claimIsTerminal = (s: RideClaimStatus): boolean => CLAIM_TRANSITIONS[s].length === 0;

export const canTransitionClaim = (from: RideClaimStatus, to: RideClaimStatus): boolean =>
  CLAIM_TRANSITIONS[from].includes(to);

export const canTransitionRide = (from: RideStatus, to: RideStatus): boolean =>
  RIDE_TRANSITIONS[from].includes(to);

export class IllegalSeatTransitionError extends Error {
  constructor(
    readonly from: RideClaimStatus,
    readonly to: RideClaimStatus,
  ) {
    super(
      `Illegal seat transition: ${from} → ${to}. Legal from ${from}: ${
        CLAIM_TRANSITIONS[from].join(', ') || '(terminal)'
      }`,
    );
    this.name = 'IllegalSeatTransitionError';
  }
}

export class IllegalRideTransitionError extends Error {
  constructor(
    readonly from: RideStatus,
    readonly to: RideStatus,
  ) {
    super(
      `Illegal ride transition: ${from} → ${to}. Legal from ${from}: ${
        RIDE_TRANSITIONS[from].join(', ') || '(terminal)'
      }`,
    );
    this.name = 'IllegalRideTransitionError';
  }
}

export interface SeatTransitionInput {
  to: RideClaimStatus;
  by: PersonId | 'system';
  at: ISODateTime;
  note?: string;
}

/**
 * Apply a seat transition, returning a new claim.
 *
 * History is append-only and is the machine's only source of truth; `status` is
 * a cache of the last event. Who confirmed a seat, and when, is exactly the sort
 * of thing that matters after something goes wrong in a car.
 */
export function transitionClaim(claim: RideClaim, input: SeatTransitionInput): RideClaim {
  if (!canTransitionClaim(claim.status, input.to)) {
    throw new IllegalSeatTransitionError(claim.status, input.to);
  }

  const event: RideClaimEvent = {
    at: input.at,
    by: input.by,
    from: claim.status,
    to: input.to,
    ...(input.note ? { note: input.note } : {}),
  };

  return { ...claim, status: input.to, history: [...claim.history, event] };
}

export interface RideTransitionInput {
  to: RideStatus;
  by: PersonId | 'system';
  at: ISODateTime;
}

export function transitionRide(ride: Ride, input: RideTransitionInput): Ride {
  if (!canTransitionRide(ride.status, input.to)) {
    throw new IllegalRideTransitionError(ride.status, input.to);
  }

  const event: RideEvent = { at: input.at, by: input.by, from: ride.status, to: input.to };
  return { ...ride, status: input.to, history: [...ride.history, event] };
}

/** Expire a seat once the car's pickup window has closed. Idempotent. */
export function expireClaimIfDue(claim: RideClaim, ride: Ride, now: ISODateTime): RideClaim {
  if (claimIsTerminal(claim.status)) return claim;
  if (Date.parse(now) < Date.parse(ride.expiresAt)) return claim;
  return transitionClaim(claim, { to: 'expired', by: 'system', at: now });
}

/**
 * Kill a seat because visibility changed underneath it.
 *
 * The profile-level equivalent in `meetRequest.ts` exists because a policy
 * change has to invalidate an open invitation instantly. It matters more here:
 * if the host turns a car women-only, or a block lands, a seat claimed under the
 * old rule is someone expecting to get into a stranger's taxi on terms that no
 * longer hold.
 */
export function revokeClaimByPolicy(claim: RideClaim, now: ISODateTime): RideClaim {
  if (claimIsTerminal(claim.status)) return claim;
  return transitionClaim(claim, { to: 'revoked_by_policy', by: 'system', at: now });
}

/**
 * What the person who asked for a seat is allowed to learn.
 *
 * `declined`, `withdrawn`, `expired` and `revoked_by_policy` collapse to one
 * neutral outcome, exactly as `senderView()` does for requests. A host who
 * declines a seat should not have to justify it, and a claimant who can tell
 * "she said no" from "it expired" will ask why.
 */
export type ClaimantVisibleStatus = 'pending' | 'confirmed' | 'closed';

export function claimantView(status: RideClaimStatus): ClaimantVisibleStatus {
  switch (status) {
    case 'requested':
      return 'pending';
    case 'confirmed':
      return 'confirmed';
    case 'declined':
    case 'withdrawn':
    case 'removed_by_host':
    case 'expired':
    case 'revoked_by_policy':
      return 'closed';
  }
}
