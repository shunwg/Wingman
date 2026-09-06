import type { IntentAxis, IntentProfile, MeetKind, ProfessionalCard, TagId } from '@domain/index';
import { useStore } from '@state/store';

/**
 * What the profile forms hold while someone is typing.
 *
 * Drafts, not `Person`: screens may not import the full record, and a form
 * should commit on Save rather than on every keystroke into persisted state.
 * The two helpers at the bottom are the only translation in either direction.
 */

export interface ProfileDraft {
  displayName: string;
  firstName: string;
  pronouns: string;
  headline: string;
  bio: string;
  photoUrl?: string;
}

/** Social-vs-professional in three words rather than two sliders. */
export type Posture = 'social' | 'leisure' | 'both' | 'work';

export interface WorkDraft extends ProfessionalCard {
  openTo: MeetKind[];
  posture: Posture;
  interests: TagId[];
  seeking: TagId[];
  offering: TagId[];
  openToAnyone: boolean;
  /** Free text the vocabulary does not have. */
  topics: string[];
}

/**
 * Caps on the three lists. A ranking decision: an uncapped list makes any
 * overlap-shaped signal trivially maximal for whoever ticks everything.
 */
export const CAPS = { interests: 12, seeking: 6, offering: 6 } as const;
export const LOOKING_FOR_MAX = 3;

export const HEADLINE_MIN = 8;
export const HEADLINE_MAX = 80;

export function validateProfile(d: ProfileDraft): Partial<Record<keyof ProfileDraft, string>> {
  const errs: Partial<Record<keyof ProfileDraft, string>> = {};
  if (d.displayName.trim().length < 2) errs.displayName = 'At least two characters.';
  const h = d.headline.trim().length;
  if (h < HEADLINE_MIN) errs.headline = 'One real sentence, eight characters or more.';
  else if (h > HEADLINE_MAX) errs.headline = `Keep it under ${HEADLINE_MAX} characters.`;
  return errs;
}

export function postureToAppetite(p: Posture): Record<IntentAxis, number> {
  switch (p) {
    case 'social':
    case 'leisure':
      return { social: 0.85, professional: 0.35 };
    case 'work':
      return { social: 0.35, professional: 0.9 };
    default:
      return { social: 0.7, professional: 0.7 };
  }
}

export function appetiteToPosture(a: Record<IntentAxis, number>): Posture {
  if (a.professional - a.social > 0.25) return 'work';
  if (a.social - a.professional > 0.25) return 'social';
  return 'both';
}

/** First name from a display name, until the person edits it themselves. */
export const firstNameOf = (displayName: string): string =>
  displayName.trim().split(/\s+/)[0] ?? '';

const uniq = <T,>(xs: readonly T[]): T[] => [...new Set(xs)];

/** The store's `me`, read into the two drafts. */
export function useProfileDrafts(): { profile: ProfileDraft; work: WorkDraft } {
  const me = useStore((s) => s.me);
  return {
    profile: {
      displayName: me.displayName,
      firstName: me.firstName,
      pronouns: me.pronouns ?? '',
      headline: me.headline,
      bio: me.bio,
      ...(me.avatar.photoUrl ? { photoUrl: me.avatar.photoUrl } : {}),
    },
    work: {
      ...me.professional,
      lookingFor: [...me.professional.lookingFor],
      openTo: [...me.intent.openTo],
      posture: appetiteToPosture(me.intent.appetite),
      interests: [...me.intent.interests],
      seeking: [...me.intent.seeking],
      offering: [...me.intent.offering],
      openToAnyone: me.intent.openToAnyone,
      topics: [...me.intent.topics],
    },
  };
}

/** Everything a profile save writes, in one call, through the store's actions. */
export function useSaveProfile() {
  const setMe = useStore((s) => s.setMe);
  const setProfessional = useStore((s) => s.setProfessional);
  const setIntent = useStore((s) => s.setIntent);
  const setPhoto = useStore((s) => s.setPhoto);

  return {
    saveProfile(d: ProfileDraft) {
      const firstName = d.firstName.trim() || firstNameOf(d.displayName);
      setMe({
        displayName: d.displayName.trim(),
        firstName,
        headline: d.headline.trim(),
        bio: d.bio.trim(),
        ...(d.pronouns.trim() ? { pronouns: d.pronouns.trim() } : { pronouns: undefined }),
      });
      setPhoto(d.photoUrl ?? null);
    },
    saveWork(w: WorkDraft) {
      const { openTo, posture, interests, seeking, offering, openToAnyone, topics, ...card } = w;
      setProfessional({
        title: card.title.trim(),
        company: card.company.trim(),
        industry: card.industry.trim(),
        workingOn: card.workingOn.trim(),
        // Every line survives. An earlier version wrote index 0 only.
        lookingFor: card.lookingFor.map((s) => s.trim()).filter(Boolean).slice(0, LOOKING_FOR_MAX),
      });
      const intent: Partial<IntentProfile> = {
        appetite: postureToAppetite(posture),
        interests: uniq(interests).slice(0, CAPS.interests),
        seeking: uniq(seeking).slice(0, CAPS.seeking),
        offering: uniq(offering).slice(0, CAPS.offering),
        openToAnyone,
        topics: uniq(topics.map((t) => t.trim()).filter(Boolean)),
      };
      // Never write an empty list: an empty openTo makes a person invisible.
      if (openTo.length > 0) intent.openTo = openTo;
      setIntent(intent);
    },
  };
}
