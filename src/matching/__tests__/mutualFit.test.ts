import { describe, expect, it } from 'vitest';
import { asTagId, type IntentProfile, type Person } from '@domain/index';
import { findCandidates } from '../engine';
import { MATCH_CONFIG_V1 } from '../config';
import type { MatchInput, PoolEntry } from '../types';
import { NOW, openPerson, segment, stay, stubAirports, trip } from '../__fixtures__/world';

const t = asTagId;

/* The same shared long-haul engine.test.ts uses, so every pair overlaps. */
const LEG = () => segment('SQ317', 'LHR', 'SIN', '2026-09-02T11:00:00Z', '2026-09-02T23:45:00Z');
const STAY = () =>
  stay('singapore-sg', '2026-09-03', '2026-09-06', '2026-09-02T23:45:00Z', '2026-09-06T10:00:00Z');

function world(others: Person[]): MatchInput {
  const me = openPerson('me');
  const myTrip = trip(me, [LEG()], [STAY()]);
  const pool: PoolEntry[] = others.map((p) => ({ person: p, trip: trip(p, [LEG()], [STAY()]) }));
  return { me, myTrip, pool, now: NOW, airports: stubAirports, config: MATCH_CONFIG_V1 };
}

/** Run the real pipeline and read one candidate's signals. */
function signalsFor(mine: Partial<IntentProfile>, theirs: Partial<IntentProfile>) {
  const them = openPerson('them', { intent: theirs as IntentProfile });
  const input = world([them]);
  input.me = { ...input.me, intent: { ...input.me.intent, ...mine } };
  const c = findCandidates(input).candidates[0];
  if (!c) throw new Error('candidate was filtered out; the fixture is broken');
  return c.signals;
}

describe('mutualFit', () => {
  it('scores a two-sided fit high', () => {
    const s = signalsFor(
      { seeking: [t('energy-finance')], offering: [t('markets')] },
      { seeking: [t('markets')], offering: [t('energy-finance')] },
    );
    expect(s.mutualFit).toBe(1);
  });

  it('drags a one-sided fit down: a lookup is not a match', () => {
    const twoSided = signalsFor(
      { seeking: [t('energy-finance')], offering: [t('markets')] },
      { seeking: [t('markets')], offering: [t('energy-finance')] },
    ).mutualFit;
    const oneSided = signalsFor(
      { seeking: [t('energy-finance')], offering: [t('markets')] },
      { seeking: [t('opera')], offering: [t('energy-finance')] },
    ).mutualFit;
    expect(oneSided).toBeLessThan(twoSided);
    // A stated ask that goes unmet ranks below silence — but not at zero.
    expect(oneSided).toBeLessThan(0.5);
    expect(oneSided).toBeGreaterThan(0);
  });

  it('is neutral, never zero, when a side has said nothing', () => {
    const blank = signalsFor({}, {}).mutualFit;
    expect(blank).toBe(0.5);
    const halfBlank = signalsFor({ seeking: [t('energy-finance')], offering: [t('markets')] }, {}).mutualFit;
    expect(halfBlank).toBe(0.5);
  });

  it('never penalises someone open to anyone', () => {
    const open = signalsFor(
      { seeking: [t('opera')], offering: [t('opera')], openToAnyone: true },
      { seeking: [t('markets')], offering: [t('energy-finance')] },
    ).mutualFit;
    const closed = signalsFor(
      { seeking: [t('opera')], offering: [t('opera')], openToAnyone: false },
      { seeking: [t('markets')], offering: [t('energy-finance')] },
    ).mutualFit;
    expect(open).toBeGreaterThanOrEqual(closed);
    expect(open).toBe(0.5);
  });

  it('is the same from either chair', () => {
    const a = { seeking: [t('energy-finance'), t('cities')], offering: [t('markets')] };
    const b = { seeking: [t('markets')], offering: [t('energy'), t('infrastructure')] };
    expect(signalsFor(a, b).mutualFit).toBe(signalsFor(b, a).mutualFit);
  });
});

describe('interestAffinity', () => {
  it('rewards adjacent tags, not only identical ones', () => {
    const exact = signalsFor({ interests: [t('cycling')] }, { interests: [t('cycling')] }).interestAffinity;
    const near = signalsFor({ interests: [t('cycling')] }, { interests: [t('running')] }).interestAffinity;
    const none = signalsFor({ interests: [t('cycling')] }, { interests: [t('law')] }).interestAffinity;
    expect(exact).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(none);
  });
});

describe('the weight table', () => {
  it('sums to exactly one', () => {
    const sum = Object.values(MATCH_CONFIG_V1.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('has a weight for every registered signal, and no orphan weights', async () => {
    const { SIGNALS } = await import('../rank/signals');
    expect(Object.keys(MATCH_CONFIG_V1.weights).sort()).toEqual(Object.keys(SIGNALS).sort());
  });
});
