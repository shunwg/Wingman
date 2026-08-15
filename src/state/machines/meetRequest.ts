import type { DenialRecord, MeetRequest, MeetRequestEvent, MeetRequestStatus, PersonId } from '@domain/index';
import type { ISODateTime } from '@domain/time';

/**
 * The meet-request state machine.
 *
 * Every write to a request goes through here. The transition table is the only
 * definition of what is legal, and an illegal move throws rather than quietly
 * writing a bad status — a request that is somehow both `denied` and `accepted`
 * is not a display bug, it is two people with different ideas about whether
 * they are meeting.
 *
 * `denied` is a first-class state, not an absence. The brief is explicit that a
 * request may be refused after it has been sent, and the system has to be able
 * to tell "declined" from "never answered" even though the sender deliberately
 * cannot.
 */

export const TRANSITIONS: Record<MeetRequestStatus, MeetRequestStatus[]> = {
  draft: ['sent', 'withdrawn'],
  sent: ['viewed', 'accepted', 'denied', 'withdrawn', 'expired', 'revoked_by_policy'],
  viewed: ['countered', 'accepted', 'denied', 'withdrawn', 'expired', 'revoked_by_policy'],
  countered: ['accepted', 'denied', 'withdrawn', 'expired', 'revoked_by_policy'],
  // Terminal. Cancelling an agreed meet is the Meet machine's business, not
  // this one's — reopening a request after a yes would let someone un-agree
  // without the other side ever being told.
  accepted: [],
  denied: [],
  withdrawn: [],
  expired: [],
  revoked_by_policy: [],
};

export const isTerminal = (s: MeetRequestStatus): boolean => TRANSITIONS[s].length === 0;

export const canTransition = (from: MeetRequestStatus, to: MeetRequestStatus): boolean =>
  TRANSITIONS[from].includes(to);

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: MeetRequestStatus,
    readonly to: MeetRequestStatus,
  ) {
    super(
      `Illegal request transition: ${from} → ${to}. Legal from ${from}: ${
        TRANSITIONS[from].join(', ') || '(terminal)'
      }`,
    );
    this.name = 'IllegalTransitionError';
  }
}

export interface TransitionInput {
  to: MeetRequestStatus;
  by: PersonId | 'system';
  at: ISODateTime;
  note?: string;
  denial?: DenialRecord;
}

/**
 * Apply a transition, returning a new request.
 *
 * History is append-only and is the machine's only source of truth — the
 * `status` field is a cache of the last event. That ordering matters for trust
 * and safety: you can reconstruct exactly who did what and when, and a status
 * that disagrees with its own history is detectable rather than invisible.
 */
export function transition(request: MeetRequest, input: TransitionInput): MeetRequest {
  if (!canTransition(request.status, input.to)) {
    throw new IllegalTransitionError(request.status, input.to);
  }

  const event: MeetRequestEvent = {
    at: input.at,
    by: input.by,
    from: request.status,
    to: input.to,
    ...(input.note ? { note: input.note } : {}),
  };

  return {
    ...request,
    status: input.to,
    history: [...request.history, event],
    ...(input.denial ? { denial: input.denial } : {}),
  };
}

/** Expire anything whose travel window has closed. Idempotent. */
export function expireIfDue(request: MeetRequest, now: ISODateTime): MeetRequest {
  if (isTerminal(request.status)) return request;
  if (Date.parse(now) < Date.parse(request.expiresAt)) return request;
  return transition(request, { to: 'expired', by: 'system', at: now });
}

/**
 * Kill a request because visibility changed underneath it.
 *
 * If someone turns on women-only, or a stamp lapses, or a block lands, an open
 * request between those two people has to die — leaving it alive would be a
 * standing invitation created under conditions that no longer hold.
 */
export function revokeByPolicy(request: MeetRequest, now: ISODateTime): MeetRequest {
  if (isTerminal(request.status)) return request;
  return transition(request, { to: 'revoked_by_policy', by: 'system', at: now });
}

/**
 * What the *sender* is allowed to learn.
 *
 * Denied, withdrawn, expired and revoked all collapse to one neutral outcome.
 * The sender is never told which, and never told the reason — including by
 * inference from timing, which is why `viewed` is not distinguishable here
 * either. Anything else turns a decline into a negotiation.
 */
export type SenderVisibleStatus = 'pending' | 'accepted' | 'closed';

export function senderView(status: MeetRequestStatus): SenderVisibleStatus {
  switch (status) {
    case 'draft':
    case 'sent':
    case 'viewed':
      return 'pending';
    case 'countered':
      return 'pending';
    case 'accepted':
      return 'accepted';
    case 'denied':
    case 'withdrawn':
    case 'expired':
    case 'revoked_by_policy':
      return 'closed';
  }
}
