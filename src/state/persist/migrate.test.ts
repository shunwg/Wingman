import { describe, expect, it } from 'vitest';
import type { ISODateTime } from '@domain/index';
import { demoState } from '../account/reducers';
import { migratePersisted } from './migrate';

const NOW = '2026-09-02T16:30:00Z' as ISODateTime;
const mint = () => 'dev-minted';

/** What a v2 blob looked like: Alex, no account slice, onboarded never set true. */
function v2Blob() {
  const blob: Partial<ReturnType<typeof demoState>> = { ...demoState('ignored') };
  delete blob.account;
  delete blob.channels;
  delete blob.readAt;
  delete blob.reports;
  delete blob.muted;
  delete blob.guardian;
  delete blob.ratings;
  return { ...blob, onboarded: false };
}

/** A v3 blob: account present, meet messages keyed by request. */
function v3Blob() {
  const rest: Partial<ReturnType<typeof demoState>> = { ...demoState('dev-3') };
  for (const k of ['channels', 'readAt', 'reports', 'muted', 'guardian', 'ratings'] as const) delete rest[k];
  return {
    ...rest,
    messages: [
      {
        id: 'm_1',
        requestId: 'req_seed_priya',
        from: 'you',
        at: '2026-09-02T16:31:00Z',
        body: { kind: 'stage', stage: 'at_gate', terminal: 'T2' },
      },
    ],
  };
}

describe('migratePersisted', () => {
  it('discards v1 and earlier', () => {
    const s = migratePersisted({ myTrip: {} }, 1, mint, NOW);
    expect(s.account.mode).toBe('none');
    expect(s.me.displayName).toBe('');
  });

  it('turns a v2 blob into demo mode with the session intact and the v4 slices empty', () => {
    const s = migratePersisted(v2Blob(), 2, mint, NOW);
    expect(s.account.mode).toBe('demo');
    expect(s.account.deviceId).toBe('dev-minted');
    expect(s.onboarded).toBe(true);
    expect(s.myTrips).toHaveLength(3);
    expect(s.me.displayName).toBe('Alex Ferrand');
    expect(s.channels).toEqual([]);
    expect(s.reports).toEqual([]);
    expect(s.guardian).toBeNull();
  });

  it('moves v3 meet messages into meet channels', () => {
    const s = migratePersisted(v3Blob(), 3, mint, NOW);
    expect(s.messages).toHaveLength(1);
    expect(String(s.messages[0]!.channelId)).toBe('meet:req_seed_priya');
    expect(s.messages[0]!.body).toEqual({ kind: 'stage', stage: 'at_gate', terminal: 'T2' });
    expect(s.readAt).toEqual({});
    expect(s.account.deviceId).toBe('dev-3');
  });

  it('passes a v4 blob through untouched', () => {
    const v4 = demoState('dev-4');
    expect(migratePersisted(v4, 4, mint, NOW)).toBe(v4);
  });

  it('treats garbage as a fresh install', () => {
    expect(migratePersisted('nope', 4, mint, NOW).account.mode).toBe('none');
    expect(migratePersisted({ me: null }, 4, mint, NOW).account.mode).toBe('none');
    expect(migratePersisted([], 2, mint, NOW).account.mode).toBe('none');
  });
});
