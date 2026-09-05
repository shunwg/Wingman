import { describe, expect, it } from 'vitest';
import type { ISODateTime } from '@domain/index';
import { applyBeginSignup, applyCompleteOnboarding, applyStartDemo, blankState } from './reducers';

const NOW = '2026-09-02T16:30:00Z' as ISODateTime;

describe('account reducers', () => {
  it('a fresh install has nobody on it and is not onboarded', () => {
    const s = blankState('dev-1', NOW);
    expect(s.onboarded).toBe(false);
    expect(s.account).toEqual({ mode: 'none', deviceId: 'dev-1', provider: 'device' });
    expect(s.me.displayName).toBe('');
    expect(s.myTrips).toEqual([]);
  });

  it('startDemo yields Alex, three trips and one inbound request', () => {
    const s = applyStartDemo(blankState('dev-1', NOW));
    expect(s.me.displayName).toBe('Alex Ferrand');
    expect(s.myTrips).toHaveLength(3);
    expect(s.requests).toHaveLength(1);
    expect(s.onboarded).toBe(true);
    expect(s.account.mode).toBe('demo');
    expect(s.account.deviceId).toBe('dev-1');
  });

  it('beginSignup from the demo yields a blank, visible, conservative person', () => {
    const s = applyBeginSignup(applyStartDemo(blankState('dev-1', NOW)), 'dev-1', NOW);
    expect(s.myTrips).toEqual([]);
    expect(s.requests).toEqual([]);
    expect(s.me.intent.openTo.length).toBeGreaterThan(0);
    expect(s.me.privacy.presets).toEqual(['verified_only']);
    expect(s.me.privacy.discoverability.offTrip).toBe(false);
    expect(s.me.avatar.seed).not.toBe('you');
    expect(s.me.verifications).toEqual([]);
    expect(s.account.mode).toBe('local');
  });

  it('beginSignup on a half-made local profile keeps what was typed', () => {
    const started = applyBeginSignup(blankState('dev-1', NOW), 'dev-1', NOW);
    const typed = { ...started, me: { ...started.me, displayName: 'Test Person' } };
    expect(applyBeginSignup(typed, 'dev-1', NOW)).toBe(typed);
  });

  it('completeOnboarding returns and clears returnTo, and marks the account local', () => {
    const s0 = {
      ...blankState('dev-1', NOW),
      account: { mode: 'none', deviceId: 'dev-1', provider: 'device', returnTo: '#/join/ABC' } as const,
    };
    const [s, to] = applyCompleteOnboarding(s0, NOW);
    expect(to).toBe('#/join/ABC');
    expect(s.onboarded).toBe(true);
    expect(s.account.returnTo).toBeUndefined();
    expect(s.account.mode).toBe('local');
    expect(s.account.createdAt).toBe(NOW);
  });

  it('completeOnboarding defaults to the board', () => {
    const [, to] = applyCompleteOnboarding(blankState('dev-1', NOW), NOW);
    expect(to).toBe('#/');
  });

  it('the return-to survives the demo path too', () => {
    const s0 = {
      ...blankState('dev-1', NOW),
      account: { mode: 'none', deviceId: 'dev-1', provider: 'device', returnTo: '#/join/ABC' } as const,
    };
    expect(applyStartDemo(s0).account.returnTo).toBe('#/join/ABC');
  });
});
