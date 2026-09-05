import type { ISODateTime, Message } from '@domain/index';
import { meetChannelId } from '@domain/index';
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
  };
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
  if (version === 2) {
    const p = persisted as unknown as Omit<PersistedSlice, 'account'>;
    return {
      ...p,
      ...v4Fields(persisted),
      onboarded: true,
      account: { mode: 'demo', deviceId: mint(), provider: 'device', createdAt: now },
    };
  }
  if (version === 3) {
    return { ...(persisted as unknown as PersistedSlice), ...v4Fields(persisted) };
  }
  // Later additive fields default here too, so an older v4 blob is whole.
  return { ...(persisted as unknown as PersistedSlice), ...v4Fields(persisted) };
}
