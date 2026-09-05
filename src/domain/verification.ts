import type { PersonId, VerificationId } from './ids';
import type { ISODateTime } from './time';

/**
 * Approval stamps.
 *
 * A stamp answers one question: how much has this person proved about
 * themselves, and to whom does that matter. The privacy engine reads exactly
 * one derived value from all of this — `AssuranceLevel` — which is what makes
 * providers swappable. Nothing downstream of `assurance.ts` knows that BankID
 * exists.
 */

export type StampKind =
  | 'government_eid'   // BankID and equivalents — a real legal identity
  | 'social_account'   // LinkedIn / Facebook / Instagram
  | 'email_domain'     // an institution or employer vouching by domain
  | 'phone';

/**
 * The assurance ladder, ordered and comparable.
 *
 * Ordering claim worth stating explicitly, because it drives who can hide from
 * whom: a verified social account proves a *persistent* identity, an email
 * domain proves an *affiliation*, and a government eID proves a *legal person*.
 * Only the last one is much use if something goes wrong, which is why the
 * women-only and id-verified-only presets key on level 3.
 */
export type AssuranceLevel = 0 | 1 | 2 | 3;

export const ASSURANCE: Record<'none' | 'social' | 'institution' | 'identity', AssuranceLevel> = {
  none: 0,
  social: 1,
  institution: 2,
  identity: 3,
};

/**
 * Everything the UI needs to render a stamp, supplied by the provider.
 *
 * `StampBadge` renders from this and never switches on a provider id — which
 * is the mechanism that makes adding a provider a zero-screen-edit change.
 */
export interface StampDisplay {
  label: string;
  /** Key into design/icons. Providers never ship markup. */
  iconKey: string;
  tone: 'trust' | 'neutral' | 'social';
  /** One plain sentence: what this proves. Shown on tap, not hidden in help. */
  explainer: string;
  // Note: "what connecting this buys you" is deliberately NOT here. This type
  // is what a *viewer* sees on someone else's card, and a viewer has no use for
  // the sales pitch. It lives on `StampProvider.unlocks` instead.
  /** What the *viewer* is told, which is deliberately vaguer than the truth. */
  publicLabel: string;
}

export interface VerificationRecord {
  id: VerificationId;
  personId: PersonId;
  providerId: string;
  kind: StampKind;
  assurance: AssuranceLevel;
  verifiedAt: ISODateTime;
  /** Undefined means it does not lapse. Social links are re-checked periodically. */
  expiresAt?: ISODateTime;
  revokedAt?: ISODateTime;
  /**
   * Provider-specific public evidence — a profile handle, a domain. Never a
   * token, never a national identity number. BankID stores nothing here beyond
   * the fact that it succeeded.
   */
  /**
   * Earned against a stand-in provider, not a real check. The owner sees it
   * with a Stand-in chip; a viewer never sees it as a stamp at all.
   */
  mocked?: boolean;
  evidence?: { handle?: string; domain?: string; url?: string };
}

/** A stamp as a viewer sees it — no timestamps, no evidence, no provider internals. */
export interface PublicStamp {
  kind: StampKind;
  display: StampDisplay;
  /** Present only when the subject chose to show which account was verified. */
  handle?: string;
}

/** A social link on a profile, with its own disclosure timing. */
export interface SocialLink {
  network: 'linkedin' | 'instagram' | 'facebook' | 'website';
  handle: string;
  url: string;
  verified: boolean;
  /**
   * When this link becomes visible. Defaults to `on_accept`, because handing a
   * stranger your Instagram at browse time is the thing people are most right
   * to be nervous about.
   */
  visibility: 'public' | 'on_accept' | 'on_meet' | 'never';
}
