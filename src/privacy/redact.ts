import type {
  DisclosureLevel,
  Person,
  PolicyReasonCode,
  ProfessionalCard,
  PublicCircleBadge,
  PublicReputation,
  PublicStamp,
  Redacted,
  RedactedPerson,
  SocialLink,
} from '@domain/index';
import {
  FIELD_LEVEL,
  PROFESSIONAL_FIELD_LEVEL,
  effectiveLevel,
  linkLevel,
  type LadderField,
} from './ladder';

/**
 * Person → RedactedPerson.
 *
 * The one function that turns a full record into something a component is
 * allowed to hold. Everything downstream — every card, every screen, the
 * preview-as feature, the audience report's field diff — goes through here, so
 * there is a single place where a field can leak and a single place to test.
 *
 * The `Redacted` marker is left *in place of* a withheld value rather than the
 * key being dropped. That is deliberate: the UI can then say "shown once you
 * accept" instead of rendering an unexplained gap, and a test can assert that a
 * field is absent for the right reason rather than merely absent.
 */

const hide = (reason: PolicyReasonCode): Redacted => ({ __redacted: true, reason });

/** Which reason to give for a field the ladder has not yet released. */
function reasonForLevel(required: DisclosureLevel): PolicyReasonCode {
  return required >= 3 ? 'not_yet_meeting' : 'not_yet_accepted';
}

export interface RedactContext {
  /** Rules that produced this view — surfaced as "why am I seeing this?". */
  appliedRules?: string[];
  /**
   * Circle ids the viewer belongs to. A circle badge set to `match_only` stays
   * hidden regardless; this only affects which `show_badge` circles are
   * meaningful to surface.
   */
  viewerCircleIds?: string[];
}

export function redact(
  person: Person,
  level: DisclosureLevel,
  ctx: RedactContext = {},
): RedactedPerson {
  const ov = person.privacy.disclosure;
  const at = (field: LadderField): boolean =>
    level >= effectiveLevel(field, FIELD_LEVEL[field], ov);

  /*
   * Name: first name from the ladder's rung onward, full name only at 2.
   *
   * Ordered so that raising `displayName` via a disclosure override still hides
   * the name entirely — the override is checked first, and only then does the
   * first-name / full-name split apply. Getting this backwards would let
   * someone who asked for their name to be private leak their first name to
   * every browser.
   */
  const nameLevel = effectiveLevel('displayName', FIELD_LEVEL.displayName, ov);
  const displayName: string | Redacted =
    level < nameLevel
      ? hide(reasonForLevel(nameLevel))
      : level >= 2
        ? person.displayName
        : person.firstName;

  /* Professional card: unbundled, each sub-field on its own rung. */
  const professional: Partial<ProfessionalCard> | Redacted = (() => {
    if (ov.professionalLate && level < 3) return hide('not_yet_meeting');
    const out: Partial<ProfessionalCard> = {};
    let any = false;
    for (const [key, required] of Object.entries(PROFESSIONAL_FIELD_LEVEL) as [
      keyof ProfessionalCard,
      DisclosureLevel,
    ][]) {
      if (level >= required) {
        const v = person.professional[key];
        // `lookingFor` is a string[]; the rest are strings.
        (out as Record<string, unknown>)[key] = v;
        any = true;
      }
    }
    return any ? out : hide('not_yet_accepted');
  })();

  /* Links: the ladder and the link's own visibility, whichever is stricter. */
  const links: (SocialLink | Redacted)[] = person.links.map((l) => {
    const required = linkLevel(l);
    if (required === 'never') return hide('subject_choice');
    return level >= required ? l : hide(reasonForLevel(required));
  });

  /* Stamps are public by design — proving something is the point of proving it. */
  const stamps: PublicStamp[] = person.verifications
    .filter((v) => !v.revokedAt)
    .map((v) => ({
      kind: v.kind,
      display: {
        label: v.providerId,
        iconKey: v.kind,
        tone: v.kind === 'government_eid' ? 'trust' : 'social',
        explainer: '',
        publicLabel: '',
      },
      // The handle is only shown once the ladder releases links.
      ...(level >= 2 && v.evidence?.handle ? { handle: v.evidence.handle } : {}),
    }));

  /**
   * Circles: `match_only` and `paused` never render, at any level. This is the
   * opt-in the brief asked for, and it is enforced here rather than in a
   * component so it cannot be forgotten on one screen out of six.
   */
  const circles: PublicCircleBadge[] = person.memberships
    .filter((m) => m.display === 'show_badge')
    .map((m) => ({
      circleId: m.circleId,
      shortName: '',
      crestSeed: String(m.circleId),
      kind: 'community' as const,
    }));

  /* Reputation: a bucket and a phrase. There is no number to withhold. */
  const reputation: PublicReputation | Redacted = person.reputation.hasEnoughSignal
    ? {
        reliability: person.reputation.reliability,
        activityLabel: activityLabel(person.reputation.meetsCompleted),
      }
    : hide('subject_choice');

  return {
    id: person.id,
    avatar: person.avatar,
    displayName,
    headline: at('headline') ? person.headline : hide('not_yet_accepted'),
    bio: at('bio') ? person.bio : hide(reasonForLevel(FIELD_LEVEL.bio)),
    ...(at('pronouns') && person.pronouns ? { pronouns: person.pronouns } : {}),
    links,
    stamps,
    circles,
    reputation,
    professional,
    _level: level,
    _appliedRules: ctx.appliedRules ?? [],
  };
}

/**
 * A phrase, never a figure.
 *
 * "Meets often" carries the useful signal; "47 meets" invites a leaderboard and
 * makes a number the thing people optimise. The bucket boundaries are coarse on
 * purpose.
 */
function activityLabel(meets: number): string {
  if (meets >= 25) return 'meets often';
  if (meets >= 10) return 'meets regularly';
  if (meets >= 5) return 'a few meets so far';
  return 'new here';
}

/**
 * A fully-hidden person.
 *
 * Used where something must occupy a slot without revealing anything — the
 * preview-as screen showing "this persona cannot see you", for instance. The
 * avatar still renders, because the shape of a card with nothing in it is
 * itself the message.
 */
export function redactFully(person: Person): RedactedPerson {
  return {
    id: person.id,
    avatar: person.avatar,
    displayName: hide('subject_choice'),
    headline: hide('subject_choice'),
    bio: hide('subject_choice'),
    links: [],
    stamps: [],
    circles: [],
    reputation: hide('subject_choice'),
    professional: hide('subject_choice'),
    _level: 0,
    _appliedRules: [],
  };
}
