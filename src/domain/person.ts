import type { PersonId } from './ids';
import type { ISODateTime } from './time';
import type { AvatarSpec } from './avatar';
import type { IntentProfile } from './intent';
import type { PublicStamp, SocialLink, VerificationRecord } from './verification';
import type { CircleMembership, PublicCircleBadge } from './circle';
import type { PrivacyPolicy } from './privacy';

/**
 * Gender, and why it is here at all.
 *
 * It exists for exactly one reason: to make "I will only be seen by, and only
 * see, other women" enforceable. It is not a matching signal — a test asserts
 * that permuting it leaves every candidate's score bit-identical — and it is
 * never rendered on a card. If the women-only preset were removed, this field
 * would come out with it.
 */
export type Gender = 'woman' | 'man' | 'nonbinary' | 'undisclosed';

export interface ProfessionalCard {
  title: string;
  company: string;
  industry: string;
  /** What they'd actually like to talk about — the useful half of a LinkedIn. */
  workingOn: string;
  /** Explicit asks, e.g. "hiring a plant engineer", "raising a Series A". */
  lookingFor: string[];
}

/**
 * Reputation, deliberately crippled.
 *
 * There is no number here. Not a rounded one, not a hidden one. The pressure to
 * surface "92% would meet again" will be real and the defence has to be
 * structural: the only public value is a three-way conduct bucket, computed
 * from whether people turned up, and withheld entirely below five meets so a
 * single bad night cannot brand someone.
 */
export type ReliabilityBucket = 'reliable' | 'mixed' | 'unproven';

export interface ReputationSummary {
  reliability: ReliabilityBucket;
  /** Bucketed for display; never the raw count when it is small. */
  meetsCompleted: number;
  /** False until n>=5, and the UI shows nothing at all when false. */
  hasEnoughSignal: boolean;
}

/** Reputation as a viewer sees it. Note the absence of any numeric score. */
export interface PublicReputation {
  reliability: ReliabilityBucket;
  /** A phrase, not a figure — "meets often", "new here". */
  activityLabel: string;
}

/**
 * The full private record. Reachable from exactly two places: the owner's own
 * profile slice, and privacy/redact.ts. An ESLint rule stops screens and
 * components importing this type at all.
 */
export interface Person {
  id: PersonId;
  displayName: string;
  firstName: string;
  pronouns?: string;
  gender: Gender;
  headline: string;
  bio: string;
  avatar: AvatarSpec;
  professional: ProfessionalCard;
  intent: IntentProfile;
  links: SocialLink[];
  verifications: VerificationRecord[];
  memberships: CircleMembership[];
  privacy: PrivacyPolicy;
  reputation: ReputationSummary;
  blocked: PersonId[];
  homeCity?: string;
  createdAt: ISODateTime;
}

/** Marker left in place of a field the viewer has not earned. */
export interface Redacted {
  __redacted: true;
  reason: PolicyReasonCode;
}

export type PolicyReasonCode =
  | 'not_yet_accepted'
  | 'not_yet_meeting'
  | 'subject_choice'
  | 'insufficient_assurance'
  | 'outside_circle';

export const isRedacted = (v: unknown): v is Redacted =>
  typeof v === 'object' && v !== null && (v as Redacted).__redacted === true;

/**
 * The ONLY person-shaped type any screen or component may accept.
 *
 * Making redaction a type rather than a convention means a leak requires
 * deliberately defeating the compiler, instead of merely forgetting a
 * conditional in one branch of one component.
 */
export interface RedactedPerson {
  id: PersonId;
  /** Always present. A card without a photo is not a card. */
  avatar: AvatarSpec;
  displayName: string | Redacted;
  headline: string | Redacted;
  bio: string | Redacted;
  pronouns?: string;
  links: (SocialLink | Redacted)[];
  stamps: PublicStamp[];
  circles: PublicCircleBadge[];
  reputation: PublicReputation | Redacted;
  professional: Partial<ProfessionalCard> | Redacted;
  /** Which rung of the disclosure ladder produced this view. */
  _level: 0 | 1 | 2 | 3;
  /** Which rules applied — powers the "why am I seeing this?" affordance. */
  _appliedRules: string[];
}
