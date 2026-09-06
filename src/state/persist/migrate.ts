import type { Gender, ISODateTime, Message, Person, PrivacyPresetId, ProfessionalCard, TagId } from '@domain/index';
import { meetChannelId, normaliseTag } from '@domain/index';
import { withMeetPreference } from '@privacy/index';
import { blankState, type PersistedSlice } from '../account/reducers';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Bring a persisted blob up to the current shape.
 *
 * v0/v1 had shapes this store cannot read and are discarded rather than
 * guessed at — a half-migrated privacy policy is worse than a fresh one.
 *
 * v2 is, by construction, the seeded demo: nobody could create a profile in
 * that version. So it becomes demo mode with its session intact, and a
 * stakeholder who opened the app last week is not bounced into a sign-up they
 * never asked for.
 *
 * v3 → v4: meet messages become messages in a `meet:<requestId>` channel and
 * the safety slices appear, empty.
 *
 * v4 → v5: the intent profile gains interests, seeking, offering and the
 * open switch. These are nested inside `me`, which the top-level backfill
 * cannot reach, so `repairPerson` walks in. Free-text topics the vocabulary
 * knows are lifted into interests — the same `normaliseTag` the form uses,
 * so "covered by the vocabulary" and "migrates cleanly" are one property.
 * The `women_only` preset becomes the meet preference `['woman']`, once:
 * that rewrite is why the version number moves rather than a backfill
 * running on every load.
 */

interface LegacyMeetMessage {
  id: string;
  requestId: string;
  from: string;
  at: string;
  body: Message['body'];
}

function v4Fields(p: Record<string, unknown>): Partial<PersistedSlice> {
  const messages = Array.isArray(p.messages) ? (p.messages as (LegacyMeetMessage | Message)[]) : [];
  return {
    channels: Array.isArray(p.channels) ? (p.channels as PersistedSlice['channels']) : [],
    messages: messages.map((x) =>
      'requestId' in x
        ? ({ id: x.id, channelId: meetChannelId(x.requestId), from: x.from, at: x.at, body: x.body } as Message)
        : x,
    ),
    readAt: isRecord(p.readAt) ? (p.readAt as PersistedSlice['readAt']) : {},
    reports: Array.isArray(p.reports) ? (p.reports as PersistedSlice['reports']) : [],
    muted: Array.isArray(p.muted) ? (p.muted as string[]) : [],
    guardian: (p.guardian as PersistedSlice['guardian']) ?? null,
    ratings: Array.isArray(p.ratings) ? (p.ratings as PersistedSlice['ratings']) : [],
    announcements: isRecord(p.announcements) ? (p.announcements as PersistedSlice['announcements']) : {},
    saved: Array.isArray(p.saved) ? (p.saved as PersistedSlice['saved']) : [],
  };
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** The nested v5 fields on `me`, filled in place. Never throws on a thin blob. */
export function repairPerson(raw: Person, rewriteWomenOnly: boolean): Person {
  const intent: Record<string, unknown> = isRecord(raw.intent) ? raw.intent : {};
  const pro: Partial<ProfessionalCard> = isRecord(raw.professional) ? (raw.professional as Partial<ProfessionalCard>) : {};
  const legacyTopics = strings(intent.topics);
  const lifted = legacyTopics.map((t) => normaliseTag(t));
  const alreadyTagged = Array.isArray(intent.interests);

  const repaired: Person = {
    ...raw,
    professional: { title: '', company: '', industry: '', workingOn: '', lookingFor: [], ...pro },
    intent: {
      appetite: { social: 0.7, professional: 0.7 },
      openTo: [],
      languages: ['en'],
      ...intent,
      // Lift what the vocabulary knows; keep only the rest as free text.
      interests: alreadyTagged
        ? (intent.interests as TagId[])
        : [...new Set(lifted.filter((x): x is TagId => x !== undefined))],
      topics: alreadyTagged ? legacyTopics : legacyTopics.filter((_, i) => lifted[i] === undefined),
      // Empty is neutral, never zero: nobody is buried on the day this ships.
      seeking: Array.isArray(intent.seeking) ? (intent.seeking as TagId[]) : [],
      offering: Array.isArray(intent.offering) ? (intent.offering as TagId[]) : [],
      openToAnyone: intent.openToAnyone === true,
    } as Person['intent'],
  };

  if (rewriteWomenOnly && isRecord(raw.privacy) && Array.isArray(raw.privacy.presets)) {
    const presets = raw.privacy.presets as PrivacyPresetId[];
    if (presets.includes('women_only')) {
      const wide = withMeetPreference(raw.privacy, ['woman'] as Gender[]);
      repaired.privacy = { ...wide, presets: presets.filter((p) => p !== 'women_only') };
    }
  }
  return repaired;
}

export function migratePersisted(
  persisted: unknown,
  version: number,
  mint: () => string,
  now: ISODateTime,
): PersistedSlice {
  if (version < 2 || !isRecord(persisted) || !isRecord(persisted.me)) {
    return blankState(mint(), now);
  }
  const me = repairPerson(persisted.me as unknown as Person, version < 5);
  if (version === 2) {
    const p = persisted as unknown as Omit<PersistedSlice, 'account'>;
    return {
      ...p,
      ...v4Fields(persisted),
      me,
      onboarded: true,
      account: { mode: 'demo', deviceId: mint(), provider: 'device', createdAt: now },
    };
  }
  // v3, v4 and v5+: the top-level slices default, and `me` is made whole.
  return { ...(persisted as unknown as PersistedSlice), ...v4Fields(persisted), me };
}
