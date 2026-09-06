import { describe, expect, it } from 'vitest';
import type { ISODateTime, Person } from '@domain/index';
import { meetPreference } from '@privacy/index';
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

/** A v4 blob: everything top-level present; the intent has only the old four fields. */
function v4Blob(overrides: { topics?: string[]; presets?: string[] } = {}) {
  const s = demoState('dev-4');
  const { appetite, openTo, topics, languages } = s.me.intent;
  const oldIntent = { appetite, openTo, topics, languages };
  const me = {
    ...s.me,
    intent: { ...oldIntent, topics: overrides.topics ?? ['energy', 'quantum knitting'] },
    privacy: { ...s.me.privacy, presets: overrides.presets ?? s.me.privacy.presets },
  } as unknown as Person;
  return { ...s, me };
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

  describe('v4 → v5: the intent fields', () => {
    it('lifts free-text topics the vocabulary knows into interests and keeps the rest', () => {
      const s = migratePersisted(v4Blob(), 4, mint, NOW);
      expect(s.me.intent.interests).toEqual(['energy']);
      expect(s.me.intent.topics).toEqual(['quantum knitting']);
    });

    it('defaults seeking and offering to empty — neutral, never zero — and the switch to off', () => {
      const s = migratePersisted(v4Blob(), 4, mint, NOW);
      expect(s.me.intent.seeking).toEqual([]);
      expect(s.me.intent.offering).toEqual([]);
      expect(s.me.intent.openToAnyone).toBe(false);
    });

    it('converts women_only into the meet preference, once', () => {
      const s = migratePersisted(v4Blob({ presets: ['women_only', 'verified_only'] }), 4, mint, NOW);
      expect(meetPreference(s.me.privacy)).toEqual(['woman']);
      expect(s.me.privacy.audience.genders).toEqual(['woman']);
      expect(s.me.privacy.presets).toEqual(['verified_only']);
    });

    it('never throws when the intent is thin or missing', () => {
      const thin = { ...v4Blob(), me: { ...v4Blob().me, intent: undefined } } as unknown;
      const s = migratePersisted(thin, 4, mint, NOW);
      expect(s.me.intent.interests).toEqual([]);
      expect(s.me.intent.openTo).toEqual([]);
    });
  });

  it('passes a v5 blob through whole', () => {
    const v5 = demoState('dev-5');
    expect(migratePersisted(v5, 5, mint, NOW)).toEqual(v5);
  });

  it('treats garbage as a fresh install', () => {
    expect(migratePersisted('nope', 5, mint, NOW).account.mode).toBe('none');
    expect(migratePersisted({ me: null }, 5, mint, NOW).account.mode).toBe('none');
    expect(migratePersisted([], 2, mint, NOW).account.mode).toBe('none');
  });
});
