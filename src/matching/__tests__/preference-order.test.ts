import { describe, expect, it } from 'vitest';
import type { Gender, Person } from '@domain/index';
import { withMeetPreference } from '@privacy/index';
import { MATCH_CONFIG_V1 } from '../config';
import { findCandidates } from '../engine';
import type { MatchInput, PoolEntry } from '../types';
import { NOW, openPerson, segment, stay, stubAirports, trip } from '../__fixtures__/world';

/**
 * The companion to the invariance test.
 *
 * That one proves gender is not a ranking signal. This one proves the meet
 * preference is *eligibility* and nothing more: it changes who is in the
 * pool and leaves the relative order — and the exact score — of everyone who
 * survives untouched. If someone later adds gender to `SignalContext` "to
 * help the preference along", the survivors' scores drift and this fails.
 */

const LEG = () => segment('SQ317', 'LHR', 'SIN', '2026-09-02T11:00:00Z', '2026-09-02T23:45:00Z');
const STAY = () =>
  stay('singapore-sg', '2026-09-03', '2026-09-06', '2026-09-02T23:45:00Z', '2026-09-06T10:00:00Z');

function world(others: Person[]): MatchInput {
  const me = openPerson('me', { gender: 'woman' });
  const myTrip = trip(me, [LEG()], [STAY()]);
  const pool: PoolEntry[] = others.map((p) => ({ person: p, trip: trip(p, [LEG()], [STAY()]) }));
  return { me, myTrip, pool, now: NOW, airports: stubAirports, config: MATCH_CONFIG_V1 };
}

const cast = (): Person[] =>
  (['woman', 'man', 'nonbinary', 'undisclosed', 'woman', 'man'] as Gender[]).map((gender, i) =>
    openPerson(`p${i}`, { gender }),
  );

describe('the meet preference changes membership, never order', () => {
  it('survivors keep their relative order and their exact scores', () => {
    const open = world(cast());
    const preferred: MatchInput = {
      ...open,
      me: { ...open.me, privacy: withMeetPreference(open.me.privacy, ['woman', 'nonbinary']) },
    };

    const before = findCandidates(open).candidates;
    const after = findCandidates(preferred).candidates;

    // The preference did something.
    expect(after.length).toBeGreaterThan(0);
    expect(after.length).toBeLessThan(before.length);

    // Subsequence: same relative order.
    const beforeIds = before.map((c) => String(c.person.id));
    const afterIds = after.map((c) => String(c.person.id));
    let cursor = 0;
    for (const id of afterIds) {
      const at = beforeIds.indexOf(id, cursor);
      expect(at).toBeGreaterThanOrEqual(cursor);
      cursor = at + 1;
    }

    // Bit-identical scores and signals for everyone who survived.
    for (const c of after) {
      const twin = before.find((b) => String(b.person.id) === String(c.person.id))!;
      expect(c.score).toBe(twin.score);
      expect(c.signals).toEqual(twin.signals);
    }
  });

  it('removes people in both directions, and never as an exact count', () => {
    const open = world(cast());
    const preferred: MatchInput = {
      ...open,
      me: { ...open.me, privacy: withMeetPreference(open.me.privacy, ['woman']) },
    };
    const res = findCandidates(preferred);
    expect(res.candidates.every((c) => c.person.id !== ('p1' as never))).toBe(true);
    // Four people were hidden by the preference; the count must be bucketed.
    expect(res.suppressed.byPrivacy.kind).not.toBe('exact');
  });
});
