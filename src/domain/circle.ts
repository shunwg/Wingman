import type { CircleId, PersonId } from './ids';
import type { ISODate, ISODateTime } from './time';

/**
 * Closed loops — a school, an employer, an alumni body, a conference.
 *
 * A circle is a private membership pool that can scope who you match with.
 * "Everyone at INSEAD" and "everyone on the @tidecapital.no domain" are the two
 * shapes that matter.
 */

export type AdmissionRule =
  /** Anyone who verifies an email on one of these domains gets in. */
  | { kind: 'email_domain'; domains: string[] }
  /** An invite code, for bodies without a clean domain (alumni, conferences). */
  | { kind: 'invite_code' }
  /** Manual approval by a circle admin. */
  | { kind: 'admin_approval' }
  /** Any member may vouch for one non-member. */
  | { kind: 'member_vouch'; vouchesRequired: number };

export interface Circle {
  id: CircleId;
  name: string;
  /** e.g. "INSEAD" — shown on the badge when a member opts to display it. */
  shortName: string;
  kind: 'school' | 'employer' | 'alumni' | 'conference' | 'community';
  admission: AdmissionRule;
  /** Deterministic crest seed — circles get generated marks, like people get photos. */
  crestSeed: string;
  /** Members may only ever be discovered by other members. */
  membersOnly: boolean;
  memberCount: number;
  /**
   * When a circle only exists for a while.
   *
   * A school is permanent; a conference is four days. Without this, a delegate
   * list keeps matching people to each other months after the event, which is
   * both useless and a slow privacy leak — nobody consented to being findable
   * as "someone who attended Grid Week" indefinitely. Absent means permanent.
   */
  runs?: { from: ISODate; to: ISODate };
  createdAt: ISODateTime;
}

/**
 * How a member's membership behaves — the opt-in the brief specifically asked
 * for.
 *
 * The distinction that matters is between *using* a circle and *advertising*
 * it. `match_only` lets someone be matched within their school without wearing
 * the school on their profile, which is the setting most people actually want
 * and which almost no product offers.
 */
export type MembershipDisplay =
  | 'show_badge'   // visible on the card
  | 'match_only'   // used for scoping and matching, never rendered
  | 'paused';      // temporarily neither

export interface CircleMembership {
  circleId: CircleId;
  personId: PersonId;
  display: MembershipDisplay;
  joinedAt: ISODateTime;
  /** How they got in — an audit trail the circle admin can verify. */
  admittedBy: AdmissionRule['kind'];
  /** Present for email_domain admission. The local part is never stored. */
  domain?: string;
  role: 'member' | 'admin';
}

/** A circle badge as a viewer sees it — only ever built from `show_badge`. */
export interface PublicCircleBadge {
  circleId: CircleId;
  shortName: string;
  crestSeed: string;
  kind: Circle['kind'];
}
