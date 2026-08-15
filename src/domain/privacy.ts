import type { CircleId, PersonId } from './ids';
import type { Gender } from './person';
import type { AssuranceLevel, StampKind } from './verification';
import type { IntentAxis } from './intent';

/**
 * The privacy contract.
 *
 * The single idea that makes this work: visibility is **two rules, not one**.
 * `audience` says who may see me. `seeking` says who I want in my feed. Almost
 * every privacy bug in social software comes from conflating them.
 *
 * Concretely — a woman who sets only `audience.genders = ['woman']` becomes
 * invisible to men but still has men in her feed. That is not what she asked
 * for and it is what a naive implementation gives her. So the UI never edits
 * the two rules directly; it edits *presets*, which compile to both halves
 * atomically.
 */

export type PrivacyPresetId =
  | 'women_only'
  | 'verified_only'
  | 'id_verified_only'
  | 'professional_only'
  | 'circles_only';

export interface AudienceRule {
  genders: Gender[] | 'any';
  minAssurance: AssuranceLevel;
  requiredStampKinds: StampKind[];
  circles: 'any' | { onlyCircles: CircleId[] };
  intents: IntentAxis[] | 'any';
  blocked: PersonId[];
}

/**
 * The disclosure ladder.
 *
 * Identity is earned by mutuality; location is earned by confirmation; an exact
 * address is never shared at all. Meeting points are always public ground.
 */
export type DisclosureLevel = 0 | 1 | 2 | 3;

export const DISCLOSURE = {
  /** Browsing — avatar, first initial, headline, overlap shape, stamps. */
  browsing: 0,
  /** A request exists — first name, intent, topics, rough overlap times. */
  requested: 1,
  /** Accepted — full name, `on_accept` links, exact overlap window. */
  accepted: 2,
  /** Meeting — meeting point, live ETA, guardian handshake, `on_meet` links. */
  meeting: 3,
} as const satisfies Record<string, DisclosureLevel>;

/** Per-field escape hatches, for people who want to reveal more or less. */
export interface DisclosureOverrides {
  /** Show the full name from browse. Off by default. */
  nameEarly?: boolean;
  /** Withhold the professional card until a meet is confirmed. */
  professionalLate?: boolean;
  /** Never show the bio to anyone below `accepted`. */
  bioLate?: boolean;
}

export interface GuardianPolicy {
  /** Offer to arm a guardian whenever a meet is confirmed. */
  promptOnEveryMeet: boolean;
  /** Default contact, if one has been chosen. */
  defaultContactLabel?: string;
  /** Escalate automatically if the traveller never checks out. */
  autoEscalateDefault: boolean;
}

/**
 * Which surfaces you exist on.
 *
 * `offTrip` defaults to false, and that default is a product decision worth
 * defending: off a trip, you are not on this app at all. It makes Wingman a
 * thing you appear on because you are travelling, rather than a permanent
 * public listing of yourself, and it removes an entire category of ambient
 * exposure without the user having to think about it.
 */
export interface Discoverability {
  onFlight: boolean;
  inTerminal: boolean;
  inCity: boolean;
  offTrip: boolean;
}

export interface PrivacyPolicy {
  presets: PrivacyPresetId[];
  audience: AudienceRule;
  seeking: AudienceRule;
  disclosure: DisclosureOverrides;
  guardian: GuardianPolicy;
  discoverability: Discoverability;
  version: 1;
}

/**
 * Stable rule identifiers.
 *
 * Every visibility verdict carries the id of the rule that closed the door,
 * which is what lets the audience screen name a reason per segment and the
 * empty state be honest, without a single hand-written conditional in the UI.
 */
export type PolicyRuleId =
  | 'block.either'
  | 'gender.audience'
  | 'gender.seeking'
  | 'assurance.floor'
  | 'assurance.seeking'
  | 'stamp.required'
  | 'circle.scope'
  | 'circle.membersOnly'
  | 'intent.axis'
  | 'proximity.surface'
  | 'trip.hidden'
  | 'trip.offTrip';

export interface PolicyReason {
  ruleId: PolicyRuleId;
  /** Whose rule stopped this — the viewer's own, or the other person's. */
  side: 'yours' | 'theirs';
  /** Resolved human sentence from data/copy/privacy.ts. */
  text: string;
}

/** How close two people currently are, in travel terms. */
export type ProximityClass =
  | 'same_flight'
  | 'same_terminal'
  | 'same_airport'
  | 'same_city'
  | 'same_dates'
  | 'none';
