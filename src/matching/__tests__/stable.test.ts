import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { blockingPairs, deferredAcceptance, type Preferences } from '../rank/stable';

describe('deferredAcceptance', () => {
  it('solves the textbook case', () => {
    const prefs: Preferences = {
      proposers: { a: ['x', 'y', 'z'], b: ['y', 'x', 'z'], c: ['x', 'y', 'z'] },
      receivers: { x: ['b', 'a', 'c'], y: ['a', 'b', 'c'], z: ['a', 'b', 'c'] },
    };
    const m = deferredAcceptance(prefs);
    expect(m.pairs).toEqual({ a: 'x', b: 'y', c: 'z' });
    expect(blockingPairs(prefs, m)).toEqual([]);
  });

  it('leaves people unmatched rather than pairing them with someone unacceptable', () => {
    const prefs: Preferences = { proposers: { a: ['x'] }, receivers: { x: [] } };
    expect(deferredAcceptance(prefs).pairs).toEqual({});
  });

  const arbPrefs = fc
    .tuple(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 }))
    .chain(([np, nr]) => {
      const P = Array.from({ length: np }, (_, i) => `p${i}`);
      const R = Array.from({ length: nr }, (_, i) => `r${i}`);
      const sub = (xs: string[]) => fc.shuffledSubarray(xs);
      return fc.record({
        proposers: fc.tuple(...P.map(() => sub(R))).map((ls) => Object.fromEntries(P.map((p, i) => [p, ls[i]!]))),
        receivers: fc.tuple(...R.map(() => sub(P))).map((ls) => Object.fromEntries(R.map((r, i) => [r, ls[i]!]))),
      });
    });

  it('terminates with no blocking pair and each side matched at most once', () => {
    fc.assert(
      fc.property(arbPrefs, (prefs) => {
        const m = deferredAcceptance(prefs);
        expect(blockingPairs(prefs, m)).toEqual([]);
        const receivers = Object.values(m.pairs);
        expect(new Set(receivers).size).toBe(receivers.length);
      }),
      { numRuns: 200 },
    );
  });

  it('is independent of the order the lists arrive in', () => {
    fc.assert(
      fc.property(arbPrefs, (prefs) => {
        const shuffled: Preferences = {
          proposers: Object.fromEntries(Object.entries(prefs.proposers).reverse()),
          receivers: Object.fromEntries(Object.entries(prefs.receivers).reverse()),
        };
        expect(deferredAcceptance(shuffled).pairs).toEqual(deferredAcceptance(prefs).pairs);
      }),
      { numRuns: 100 },
    );
  });
});
