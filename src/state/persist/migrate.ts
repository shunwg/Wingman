import type { ISODateTime } from '@domain/index';
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
 */
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
    const p = persisted as Omit<PersistedSlice, 'account'>;
    return {
      ...p,
      onboarded: true,
      account: { mode: 'demo', deviceId: mint(), provider: 'device', createdAt: now },
    };
  }
  return persisted as unknown as PersistedSlice;
}
