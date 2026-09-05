import type {
  CircleId, CityKey, IataCode, MeetId, MeetRequestId, PersonId, RatingId, TripId } from './ids';
import type { GuardianSessionId } from './ids';
import type { ISODateTime, TimeWindow } from './time';
import type { MeetKind } from './intent';

/**
 * The request lifecycle.
 *
 * `denied` is a first-class state rather than an absence, because the brief is
 * explicit that a request may be refused after it has been sent, and because
 * "declined" and "never answered" have to be distinguishable to the *system*
 * even though they are deliberately indistinguishable to the *sender*.
 */
export type MeetRequestStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'countered'
  | 'accepted'
  | 'denied'
  | 'withdrawn'
  | 'expired'
  | 'revoked_by_policy';

/**
 * Somewhere public, always.
 *
 * `isPublicGround` is a literal `true` rather than a boolean, so a place that
 * is not public ground is not merely discouraged — it fails to typecheck. The
 * only way to build one is `makePublicPlace()` in guards.ts, which vets the
 * kind. A home address cannot be represented by this type at all.
 */
export interface PublicPlace {
  kind:
    | 'gate'
    | 'lounge'
    | 'terminal_landmark'
    | 'cafe'
    | 'restaurant'
    | 'taxi_rank'
    | 'station'
    | 'hotel_lobby';
  airportIata?: IataCode;
  cityKey?: CityKey;
  /** Human wayfinding, e.g. "Gate C12 — the window bench". */
  label: string;
  lat?: number;
  lon?: number;
  isPublicGround: true;
}

export interface MeetProposal {
  kind: MeetKind;
  window: TimeWindow;
  /** Optional when requesting, mandatory when accepting. */
  place?: PublicPlace;
}

/** Which travel overlap justified this request existing at all. */
export interface OverlapRef {
  kind: 'same_flight' | 'shared_layover' | 'same_airport_window' | 'same_city_night' | 'overlapping_stay';
  airport?: IataCode;
  cityKey?: CityKey;
  window?: TimeWindow;
}

export interface MeetRequestEvent {
  at: ISODateTime;
  by: PersonId | 'system';
  from: MeetRequestStatus;
  to: MeetRequestStatus;
  note?: string;
}

/**
 * Why a request was refused.
 *
 * The sender is shown a neutral phrase from data/copy/denial.ts and nothing
 * else — not the reason, not the timing, not whether it was read first.
 * `uncomfortable` in particular is retained purely as a trust-and-safety
 * signal; surfacing it, or letting it be inferred, would make people choose the
 * softer option to avoid a confrontation, which destroys the signal exactly
 * when it matters most.
 */
export interface DenialRecord {
  at: ISODateTime;
  reason: 'not_this_trip' | 'different_plans' | 'not_a_fit' | 'uncomfortable';
  alsoBlock: boolean;
  alsoReport: boolean;
}

export interface MeetRequest {
  id: MeetRequestId;
  fromPersonId: PersonId;
  toPersonId: PersonId;
  /**
   * Which of the sender's own trips this was sent from.
   *
   * Needed because accepting closes that trip and no other. Without it, saying
   * yes to someone on next month's flight would silently stop suggestions for
   * the one you are boarding tonight.
   */
  tripId: TripId;
  /** Set when both people share a live circle at send time; the organiser's report counts it. */
  circleId?: CircleId;
  overlapRef: OverlapRef;
  proposal: MeetProposal;
  /** <=200 chars, template-seeded so nobody has to cold-write to a stranger. */
  message: string;
  status: MeetRequestStatus;
  /** Append-only. The FSM's only source of truth. */
  history: MeetRequestEvent[];
  createdAt: ISODateTime;
  /** Pinned to the end of the travel overlap — requests cannot outlive the trip. */
  expiresAt: ISODateTime;
  denial?: DenialRecord;
}

/**
 * Where someone has got to in an airport.
 *
 * The ordered spine of the meet room, and the reason it is a fixed list rather
 * than free text. "Through security" is the single most useful thing two people
 * can tell each other before meeting at a gate, it is the same sentence every
 * time, and typing it out is exactly the friction that stops people sending it.
 * One tap, no composition, no ambiguity about what was meant.
 *
 * It is also the moderation story. A room whose primary vocabulary is nine
 * buttons is a room where the overwhelming majority of traffic cannot be abuse,
 * which matters a great deal for App Store Guideline 1.2 and rather more for
 * the people using it.
 */
export type JourneyStage =
  | 'checked_in'
  | 'through_security'
  | 'in_lounge'
  | 'at_gate'
  | 'boarded'
  | 'landed'
  | 'through_immigration'
  | 'through_baggage'
  | 'at_meeting_point'
  | 'running_late'
  | 'cannot_make_it';

/** Ordered, for rendering a progress rail. The last two are out-of-band. */
export const STAGE_ORDER: JourneyStage[] = [
  'checked_in',
  'through_security',
  'in_lounge',
  'at_gate',
  'boarded',
  'landed',
  'through_immigration',
  'through_baggage',
  'at_meeting_point',
];

export interface StageUpdate {
  stage: JourneyStage;
  at: ISODateTime;
  /** Terminal at the time, when the trip knows it — "T2". */
  terminal?: string;
  airportIata?: IataCode;
}

export type MeetMessageBody =
  | { kind: 'stage'; stage: JourneyStage; terminal?: string; airportIata?: IataCode }
  /**
   * Free text, capped short.
   *
   * Present because arranging where exactly to stand needs words, and absent as
   * the *default* because a blank box is an invitation to write something a
   * structured update would have said better. 240 characters is enough to name
   * a landmark and not enough to hold a conversation that should be happening
   * in person twenty minutes later.
   */
  | { kind: 'text'; text: string };

export interface MeetMessage {
  id: string;
  /** The accepted request this room belongs to. */
  requestId: MeetRequestId;
  from: PersonId;
  at: ISODateTime;
  body: MeetMessageBody;
}

export type MeetStatus = 'scheduled' | 'live' | 'completed' | 'no_show' | 'cancelled';

export interface Meet {
  id: MeetId;
  participants: [PersonId, PersonId];
  fromRequestId: MeetRequestId;
  kind: MeetKind;
  place: PublicPlace;
  window: TimeWindow;
  status: MeetStatus;
  checkIns: Partial<Record<PersonId, ISODateTime>>;
  guardianSessionIds: GuardianSessionId[];
  ratingIds: RatingId[];
  cancelledBy?: PersonId;
  cancelledAt?: ISODateTime;
}
