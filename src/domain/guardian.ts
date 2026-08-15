import type { GuardianSessionId, MeetId, PersonId } from './ids';
import type { ISODateTime } from './time';

/**
 * Guardian — letting a third person watch over a meet.
 *
 * The design constraint that shapes everything here: a guardian is *scoped and
 * temporary*, never a standing permission. "My sister can see where I am"
 * forever is a surveillance feature; "my sister can see where I am for the
 * ninety minutes of this dinner, and then the link is dead" is a safety one.
 *
 * A guardian need not have an account. They hold a capability URL that expires
 * with the session, which means the person most likely to be asked — a parent,
 * a flatmate — can actually help without being sold an app first.
 */

export interface GuardianContact {
  /** Set when the guardian is also a Wingman user. */
  personId?: PersonId;
  /** What the traveller calls them: "Mum", "Priya". */
  label: string;
  channel: 'in_app' | 'link';
}

/**
 * Exactly what the guardian may see. Every field is a deliberate narrowing —
 * the default posture is that a guardian needs to know enough to raise an alarm
 * and no more than that.
 */
export interface GuardianScope {
  liveLocation: boolean;
  meetDetails: 'full' | 'place_and_time' | 'time_only';
  /** Whether the guardian learns who the other person is. */
  counterpartIdentity: 'name_and_photo' | 'first_name' | 'none';
  autoEscalateIfNoCheckOut: boolean;
  /** The deadline that triggers escalation if no check-out has happened. */
  checkOutBy: ISODateTime;
}

export interface LocationPing {
  at: ISODateTime;
  lat: number;
  lon: number;
  accuracyM: number;
}

export type GuardianStatus = 'armed' | 'active' | 'ended' | 'escalated' | 'declined';

export interface GuardianSession {
  id: GuardianSessionId;
  meetId: MeetId;
  travellerId: PersonId;
  guardian: GuardianContact;
  scope: GuardianScope;
  status: GuardianStatus;
  startsAt: ISODateTime;
  /**
   * Hard expiry — the meet window plus a grace period. Enforced in the engine,
   * not in the UI, so an old link cannot be replayed.
   */
  endsAt: ISODateTime;
  /** Capability URL fragment. Single-purpose, dies with the session. */
  shareToken: string;
  /** Ring buffer, purged at `endsAt` plus the retention window. */
  pings: LocationPing[];
  escalation?: {
    at: ISODateTime;
    trigger: 'manual' | 'no_check_out';
    acknowledged: boolean;
  };
}

/** What the guardian's own screen actually renders — already scoped down. */
export interface GuardianView {
  travellerFirstName: string;
  status: GuardianStatus;
  endsAt: ISODateTime;
  meetWindow?: { from: ISODateTime; to: ISODateTime };
  placeLabel?: string;
  counterpart?: { firstName?: string; avatarSeed?: string };
  lastPing?: LocationPing;
  canRaiseAlarm: boolean;
}
