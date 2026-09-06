import { ALL_MEET_KINDS, asPersonId, type ISODateTime, type Person, type PrivacyPolicy } from '@domain/index';
import { generateAvatar } from '@design/avatar/generate';
import { defaultPolicy } from '@privacy/index';

/**
 * The id every local profile gets.
 *
 * The same alias the seed uses for Alex, on purpose: every `=== me.id`
 * comparison in the engines and the screens keeps working, and the id is
 * never shown to anyone. When a backend arrives this becomes the anonymous
 * account id and the comparisons still hold.
 */
export const LOCAL_ME_ID = asPersonId('you');

/**
 * The privacy a new account starts with.
 *
 * `verified_only`, in both directions: the strictest preset that still gives
 * someone who has not verified yet a board to look at, and the one that turns
 * the verify step into a stated exchange — "verify, and the people who chose
 * this can see you back" — rather than a request for data. Women-only is
 * offered first to women on the privacy step and is off until they say so;
 * that is their decision, not a default.
 */
export function conservativePolicy(): PrivacyPolicy {
  return { ...defaultPolicy(), presets: ['verified_only'] };
}

/**
 * A person with nothing filled in yet.
 *
 * Every meet kind is open: an empty `openTo` makes a person invisible
 * (domain/intent.ts), and someone who skips the work step must still appear.
 * Appetite sits in the middle on both axes until they say otherwise.
 */
export function blankPerson(seed: string, now: ISODateTime): Person {
  return {
    id: LOCAL_ME_ID,
    displayName: '',
    firstName: '',
    gender: 'undisclosed',
    headline: '',
    bio: '',
    avatar: generateAvatar(seed),
    professional: { title: '', company: '', industry: '', workingOn: '', lookingFor: [] },
    intent: {
      appetite: { social: 0.7, professional: 0.7 },
      openTo: [...ALL_MEET_KINDS],
      topics: [],
      languages: ['en'],
      interests: [],
      seeking: [],
      offering: [],
      openToAnyone: false,
    },
    links: [],
    verifications: [],
    memberships: [],
    privacy: conservativePolicy(),
    reputation: { reliability: 'unproven', meetsCompleted: 0, hasEnoughSignal: false },
    blocked: [],
    createdAt: now,
  };
}
