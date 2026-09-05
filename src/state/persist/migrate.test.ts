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
  return { ...blob, onboarded: false };
}

describe('migratePersisted', () => {
  it('discards v1 and earlier', () => {
    const s = migratePersisted({ myTrip: {} }, 1, mint, NOW);
    expect(s.account.mode).toBe('none');
    expect(s.me.displayName).toBe('');
  });

  it('turns a v2 blob into demo mode with the session intact', () => {
    const s = migratePersisted(v2Blob(), 2, mint, NOW);
    expect(s.account.mode).toBe('demo');
    expect(s.account.deviceId).toBe('dev-minted');
    expect(s.onboarded).toBe(true);
    expect(s.myTrips).toHaveLength(3);
    expect(s.me.displayName).toBe('Alex Ferrand');
  });

  it('passes a v3 blob through untouched', () => {
    const v3 = demoState('dev-3');
    expect(migratePersisted(v3, 3, mint, NOW)).toBe(v3);
  });

  it('treats garbage as a fresh install', () => {
    expect(migratePersisted('nope', 3, mint, NOW).account.mode).toBe('none');
    expect(migratePersisted({ me: null }, 3, mint, NOW).account.mode).toBe('none');
    expect(migratePersisted([], 2, mint, NOW).account.mode).toBe('none');
  });
});
