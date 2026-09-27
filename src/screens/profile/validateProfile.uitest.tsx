import { describe, expect, it } from 'vitest';
import { validateProfile, type ProfileDraft } from './useProfileDraft';

/**
 * Round 4: a fresh account could be named with zero-width spaces — two
 * "characters" to the form, nothing on anyone else's screen — and the store,
 * which keeps the previous name for a blank one, had no previous name to keep.
 */
describe('validateProfile — the name', () => {
  const draft = (displayName: string) =>
    ({ displayName, firstName: '', headline: 'Here for the week, happy to share a cab.', bio: '', pronouns: '' }) as unknown as ProfileDraft;

  it('refuses a name nobody could read', () => {
    expect(validateProfile(draft('\u200B\u200B\u200B')).displayName).toBeDefined();
  });

  it('accepts a real one', () => {
    expect(validateProfile(draft('Alex Ferrand')).displayName).toBeUndefined();
  });
});
