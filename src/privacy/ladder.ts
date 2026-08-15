import type { DisclosureLevel, ProfessionalCard, RedactedPerson, SocialLink } from '@domain/index';

/**
 * The disclosure ladder, as data.
 *
 * Which field appears at which rung, in one table, so there is exactly one
 * source of truth about it. `redact()` reads this; the audience screen diffs
 * against it; a property test walks every field at every level. If the ladder
 * and the redactor could disagree, they eventually would.
 *
 * The shape of it: identity is earned by mutuality, detail is earned by
 * commitment. What a stranger gets is enough to decide whether to ask — a face,
 * a line about you, what you have proved, whether you turn up. Not enough to
 * find you elsewhere on the internet.
 */

export type LadderField = keyof Omit<RedactedPerson, '_level' | '_appliedRules' | 'id'>;

export const FIELD_LEVEL: Record<LadderField, DisclosureLevel> = {
  /** Always. A card without a photo is not a card. */
  avatar: 0,
  /** "Grid engineer, mostly airports lately" — evocative, not identifying. */
  headline: 0,
  stamps: 0,
  circles: 0,
  reputation: 0,
  /** First name at 1, full name at 2 — handled specially in redact(). */
  displayName: 1,
  pronouns: 1,
  professional: 0, // sub-fields have their own rungs, see below
  bio: 2,
  links: 2, // each link also carries its own `visibility`, applied on top
};

/**
 * The professional card, unbundled.
 *
 * Splitting it matters. `industry` and `workingOn` are what make someone worth
 * meeting; `company` plus a face is what makes them findable. A networking app
 * that leads with the employer logo is one search away from being a directory
 * of strangers' workplaces, so the useful half comes early and the identifying
 * half waits for a mutual yes.
 */
export const PROFESSIONAL_FIELD_LEVEL: Record<keyof ProfessionalCard, DisclosureLevel> = {
  industry: 0,
  workingOn: 1,
  lookingFor: 1,
  title: 1,
  company: 2,
};

/** Human labels for the audience screen's per-field exposure rows. */
export const FIELD_LABEL: Record<LadderField, string> = {
  avatar: 'Your photo',
  headline: 'Your headline',
  stamps: 'What you have verified',
  circles: 'Your circle badges',
  reputation: 'Whether you turn up',
  displayName: 'Your name',
  pronouns: 'Your pronouns',
  professional: 'Your work',
  bio: 'Your bio',
  links: 'Your social links',
};

/** When a link becomes visible, combining its own setting with the ladder. */
export function linkLevel(link: SocialLink): DisclosureLevel | 'never' {
  switch (link.visibility) {
    case 'public':
      return 0;
    case 'on_accept':
      return 2;
    case 'on_meet':
      return 3;
    case 'never':
      return 'never';
  }
}

/**
 * Apply the owner's own overrides.
 *
 * People are not uniform about this. Someone may want their name shown from the
 * start, or their employer withheld until a meet is actually happening. The
 * overrides move a field along the ladder; they cannot remove it from the
 * ladder entirely.
 */
export function effectiveLevel(
  field: LadderField,
  base: DisclosureLevel,
  overrides: { nameEarly?: boolean; professionalLate?: boolean; bioLate?: boolean },
): DisclosureLevel {
  if (field === 'displayName' && overrides.nameEarly) return 0;
  if (field === 'professional' && overrides.professionalLate) return 3;
  if (field === 'bio' && overrides.bioLate) return 2;
  return base;
}
