import { describe, expect, it } from 'vitest';
import { estimateAcceptance } from '../rank/reciprocity';

describe('estimateAcceptance', () => {
  const proven = { reliability: 'reliable' as const, meetsCompleted: 12, hasEnoughSignal: true };
  const unproven = { reliability: 'unproven' as const, meetsCompleted: 1, hasEnoughSignal: false };

  it('is neutral for someone new', () => {
    expect(estimateAcceptance({ reputation: unproven })).toBeCloseTo(0.5);
  });

  it('rises with answering and turning up, and never exceeds one', () => {
    expect(estimateAcceptance({ responseRate: 1, reputation: proven })).toBe(1);
    expect(estimateAcceptance({ responseRate: 0.2, reputation: proven })).toBeCloseTo(0.52);
    expect(estimateAcceptance({ responseRate: 0.2, reputation: { ...proven, reliability: 'mixed' } })).toBeCloseTo(0.32);
  });

  it('reads nothing but conduct: the input has no room for appearance, gender or popularity', () => {
    // The type is the test: ConductInput has two fields. This asserts the
    // function ignores anything else that might be spread onto it.
    const extra = { responseRate: 0.8, reputation: proven, gender: 'woman', photoUrl: 'x', askedCount: 900 };
    expect(estimateAcceptance(extra)).toBe(estimateAcceptance({ responseRate: 0.8, reputation: proven }));
  });
});
