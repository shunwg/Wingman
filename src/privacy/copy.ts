/**
 * The human sentence for every rule.
 *
 * This lives inside the engine rather than in `data/copy/` for a reason: a rule
 * that cannot explain itself is not finished. Pairing the id with its sentence
 * here means adding a rule forces you to write the explanation in the same
 * commit, and the audience screen gets a real reason for free instead of
 * falling back to "hidden by privacy settings".
 *
 * Two voices per rule — whose choice caused this. Saying "you chose" when it
 * was the other person's setting is both wrong and quietly blame-shifting, so
 * the side is always explicit.
 */

type Side = 'yours' | 'theirs';

const COPY: Record<string, Record<Side, string>> = {
  'block.either': {
    yours: 'You blocked this person.',
    theirs: 'Not available.',
  },
  'gender.audience': {
    yours: 'Your settings limit who can see you by gender.',
    theirs: 'They chose to be visible only to people of a particular gender.',
  },
  'gender.seeking': {
    yours: 'You chose to see only people of a particular gender.',
    theirs: 'They chose to see only people of a particular gender.',
  },
  'assurance.floor': {
    yours: 'You require people to be verified before they can see you.',
    theirs: 'They only appear to verified people.',
  },
  'assurance.seeking': {
    yours: 'You chose to see only verified people.',
    theirs: 'They chose to see only verified people.',
  },
  'stamp.required': {
    yours: 'You require a specific verification before someone can see you.',
    theirs: 'They require a specific verification you have not added.',
  },
  'circle.scope': {
    yours: 'You limited yourself to your circles.',
    theirs: 'They are only visible inside a circle you are not in.',
  },
  'circle.membersOnly': {
    yours: 'This circle is members-only.',
    theirs: 'This circle is members-only.',
  },
  'intent.axis': {
    yours: 'You limited yourself to one kind of meet.',
    theirs: 'They are open to a different kind of meet than you are.',
  },
  'proximity.surface': {
    yours: 'You turned off this way of being found.',
    theirs: 'They turned off this way of being found.',
  },
  'trip.hidden': {
    yours: 'You hid this trip.',
    theirs: 'Their trip is not listed.',
  },
  'trip.offTrip': {
    yours: 'You only appear while you are travelling.',
    theirs: 'They only appear while they are travelling.',
  },
};

/**
 * Resolve a rule's copy.
 *
 * The fallback is deliberately vague rather than technical. If a rule is added
 * without copy, a user should see something calm and honest, not a rule id —
 * and the missing entry gets caught by the registry test, not by a user.
 */
export function policyCopy(copyKey: string, side: Side): string {
  return COPY[copyKey]?.[side] ?? 'Hidden by a privacy setting.';
}

/** Every key with copy — used by the registry test to catch omissions. */
export const COPY_KEYS = Object.keys(COPY);
