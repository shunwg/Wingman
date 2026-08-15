import type {
  GuardianContact,
  GuardianScope,
  GuardianSession,
  GuardianSessionId,
  GuardianView,
  ISODateTime,
  LocationPing,
  MeetId,
  PersonId,
} from '@domain/index';
import { addMinutes, epoch, isAfter } from '@domain/time';

/**
 * The guardian session state machine.
 *
 * Pure, with the clock injected, because every safety-relevant property here is
 * a claim about time: the link dies at `endsAt`, escalation fires if nobody
 * checked out by `checkOutBy`, pings are purged after retention. A machine that
 * read the wall clock directly could not be tested for any of that, which is
 * exactly the code you least want untested.
 *
 * The design commitment: a guardian permission is **scoped and temporary**.
 * "My sister can see where I am" as a standing setting is a surveillance
 * feature. "My sister can see where I am for the duration of this dinner, and
 * then the link is dead" is a safety one. Expiry is enforced in this engine
 * rather than by hiding a screen, so an old link cannot be replayed.
 */

/** Grace after the meet window before the link dies. */
export const GRACE_MINUTES = 45;

/** How long pings survive after a session ends, before purging. */
export const PING_RETENTION_MINUTES = 60;

/** Most recent pings kept. A guardian needs a trail, not a history. */
export const MAX_PINGS = 60;

export interface ArmInput {
  id: GuardianSessionId;
  meetId: MeetId;
  travellerId: PersonId;
  guardian: GuardianContact;
  scope: GuardianScope;
  meetWindow: { from: ISODateTime; to: ISODateTime };
  /** Injected — engines do not generate randomness. */
  shareToken: string;
  now: ISODateTime;
}

export function armGuardian(input: ArmInput): GuardianSession {
  return {
    id: input.id,
    meetId: input.meetId,
    travellerId: input.travellerId,
    guardian: input.guardian,
    scope: input.scope,
    status: 'armed',
    startsAt: input.meetWindow.from,
    endsAt: addMinutes(input.meetWindow.to, GRACE_MINUTES),
    shareToken: input.shareToken,
    pings: [],
  };
}

/**
 * Advance a session to `now`.
 *
 * Returns a new session; never mutates. The ordering matters — expiry is
 * checked before escalation so a session that quietly ran past its window ends
 * rather than alarming someone's mother at three in the morning about a dinner
 * that finished fine four hours ago.
 */
export function tickGuardian(
  session: GuardianSession,
  now: ISODateTime,
  opts: { checkedOut?: boolean } = {},
): GuardianSession {
  if (session.status === 'ended' || session.status === 'declined') {
    return purgeIfDue(session, now);
  }

  if (session.status === 'escalated') return session;

  // Past the hard expiry: the link is dead regardless of anything else.
  if (isAfter(now, session.endsAt)) {
    if (
      session.scope.autoEscalateIfNoCheckOut &&
      !opts.checkedOut &&
      isAfter(now, session.scope.checkOutBy)
    ) {
      return {
        ...session,
        status: 'escalated',
        escalation: { at: now, trigger: 'no_check_out', acknowledged: false },
      };
    }
    return purgeIfDue({ ...session, status: 'ended' }, now);
  }

  // Missed the check-out deadline while the session is still live.
  if (
    session.scope.autoEscalateIfNoCheckOut &&
    !opts.checkedOut &&
    isAfter(now, session.scope.checkOutBy)
  ) {
    return {
      ...session,
      status: 'escalated',
      escalation: { at: now, trigger: 'no_check_out', acknowledged: false },
    };
  }

  if (session.status === 'armed' && !isAfter(session.startsAt, now)) {
    return { ...session, status: 'active' };
  }

  return session;
}

/** The traveller says they are fine. Ends the session cleanly. */
export function endGuardian(session: GuardianSession, now: ISODateTime): GuardianSession {
  return purgeIfDue({ ...session, status: 'ended' }, now);
}

/** The traveller raises an alarm themselves. */
export function escalateGuardian(session: GuardianSession, now: ISODateTime): GuardianSession {
  return {
    ...session,
    status: 'escalated',
    escalation: { at: now, trigger: 'manual', acknowledged: false },
  };
}

/** The guardian declines the responsibility — the traveller should know. */
export function declineGuardian(session: GuardianSession): GuardianSession {
  return { ...session, status: 'declined', pings: [] };
}

export function addPing(
  session: GuardianSession,
  ping: LocationPing,
  now: ISODateTime,
): GuardianSession {
  if (!isLive(session, now) || !session.scope.liveLocation) return session;
  const pings = [...session.pings, ping].slice(-MAX_PINGS);
  return { ...session, pings };
}

/** Whether the session currently grants any access at all. */
export function isLive(session: GuardianSession, now: ISODateTime): boolean {
  if (session.status === 'ended' || session.status === 'declined') return false;
  if (session.status === 'escalated') return true;
  return !isAfter(now, session.endsAt);
}

/** Drop location history once the retention window has passed. */
function purgeIfDue(session: GuardianSession, now: ISODateTime): GuardianSession {
  const purgeAt = addMinutes(session.endsAt, PING_RETENTION_MINUTES);
  if (session.pings.length > 0 && epoch(now) >= epoch(purgeAt)) {
    return { ...session, pings: [] };
  }
  return session;
}

/**
 * Resolve a share token to what the guardian may actually see.
 *
 * Returns null for a dead or unknown token — the guardian screen renders an
 * expired state rather than a stale location. Every field is gated on the scope
 * the traveller chose, so "time only" really is time only.
 */
export function guardianView(
  session: GuardianSession | undefined,
  token: string,
  now: ISODateTime,
  ctx: {
    travellerFirstName: string;
    counterpartFirstName?: string;
    counterpartAvatarSeed?: string;
    placeLabel?: string;
    meetWindow?: { from: ISODateTime; to: ISODateTime };
  },
): GuardianView | null {
  if (!session) return null;
  if (session.shareToken !== token) return null;
  if (!isLive(session, now)) return null;

  const scope = session.scope;

  const counterpart =
    scope.counterpartIdentity === 'none'
      ? undefined
      : scope.counterpartIdentity === 'first_name'
        ? { firstName: ctx.counterpartFirstName }
        : { firstName: ctx.counterpartFirstName, avatarSeed: ctx.counterpartAvatarSeed };

  return {
    travellerFirstName: ctx.travellerFirstName,
    status: session.status,
    endsAt: session.endsAt,
    ...(scope.meetDetails !== 'time_only' && ctx.placeLabel ? { placeLabel: ctx.placeLabel } : {}),
    ...(ctx.meetWindow ? { meetWindow: ctx.meetWindow } : {}),
    ...(counterpart ? { counterpart } : {}),
    ...(scope.liveLocation && session.pings.length > 0
      ? { lastPing: session.pings[session.pings.length - 1]! }
      : {}),
    canRaiseAlarm: true,
  };
}
