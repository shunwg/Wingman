import { describe, expect, it } from 'vitest';
import type { Person } from '@domain/index';
import { isRedacted } from '@domain/person';
import { MATCH_CONFIG_V1 } from '../config';
import { findCandidates } from '../engine';
import { feasibleMeetKinds } from '../filters/intent';
import { relaxations, whatIfRelaxed } from '../relax';
import type { MatchInput, PoolEntry } from '../types';
import { NOW, openPerson, segment, stay, stubAirports, trip } from '../__fixtures__/world';

const cfg = MATCH_CONFIG_V1;

/* A shared long-haul so every test starts from a real overlap. */
const LEG = () => segment('SQ317', 'LHR', 'SIN', '2026-09-02T11:00:00Z', '2026-09-02T23:45:00Z');
const STAY = () =>
  stay('singapore-sg', '2026-09-03', '2026-09-06', '2026-09-02T23:45:00Z', '2026-09-06T10:00:00Z');

function world(others: Person[]): MatchInput {
  const me = openPerson('me');
  const myTrip = trip(me, [LEG()], [STAY()]);
  const pool: PoolEntry[] = others.map((p) => ({
    person: p,
    trip: trip(p, [LEG()], [STAY()]),
  }));
  return { me, myTrip, pool, now: NOW, airports: stubAirports, config: cfg };
}

describe('findCandidates', () => {
  it('returns people you genuinely overlap with', () => {
    const res = findCandidates(world([openPerson('a'), openPerson('b')]));
    expect(res.candidates).toHaveLength(2);
    expect(res.candidates[0]!.overlap.kind).toBe('same_flight');
  });

  it('never returns you to yourself', () => {
    const input = world([openPerson('a')]);
    const withSelf: MatchInput = {
      ...input,
      pool: [...input.pool, { person: input.me, trip: input.myTrip }],
    };
    expect(findCandidates(withSelf).candidates).toHaveLength(1);
  });

  it('returns redacted people, at the browse rung', () => {
    const res = findCandidates(world([openPerson('a')]));
    const c = res.candidates[0]!;
    expect(c.person._level).toBe(0);
    // A stranger gets a face, a headline and a first name — never the full
    // name, the bio, or the links. "Ada" narrows nobody down; "Ada Lovelace"
    // is a search query.
    expect(c.person.avatar).toBeDefined();
    expect(isRedacted(c.person.headline)).toBe(false);
    expect(c.person.displayName).toBe('Ada');
    expect(isRedacted(c.person.bio)).toBe(true);
    expect(c.person.links.every((l) => isRedacted(l))).toBe(true);
  });

  it('explains itself without a score', () => {
    const c = findCandidates(world([openPerson('a')])).candidates[0]!;
    expect(c.receipt.headline).toContain('SQ317');
    expect(c.receipt.lines.length).toBeGreaterThan(0);
    expect(c.receipt.suggestion).toBeTruthy();
    // The score exists for ordering, but nothing in the receipt exposes it.
    expect(JSON.stringify(c.receipt)).not.toContain(String(c.score));
  });

  it('reports travel context from survivors only', () => {
    const res = findCandidates(world([openPerson('a'), openPerson('b'), openPerson('c')]));
    expect(res.context.onYourFlight).toBe(3);
  });
});

describe('hard filters remove rather than down-rank', () => {
  it('drops a blocked person entirely', () => {
    const input = world([openPerson('a')]);
    const blocked: MatchInput = {
      ...input,
      me: { ...input.me, blocked: [input.pool[0]!.person.id] },
    };
    expect(findCandidates(blocked).candidates).toHaveLength(0);
  });

  it('drops a hidden trip', () => {
    const input = world([openPerson('a')]);
    input.pool[0]!.trip = { ...input.pool[0]!.trip, visibility: { listing: 'hidden' } };
    expect(findCandidates(input).candidates).toHaveLength(0);
  });

  it('drops a trip that has already happened', () => {
    const input = world([openPerson('a')]);
    expect(findCandidates({ ...input, now: '2027-01-01T00:00:00Z' as never }).candidates).toHaveLength(0);
  });

  it('drops someone with no arrangeable meet kind', () => {
    // Both on the same flight, but he only wants to cowork — and nobody
    // coworks on a 737.
    const coworkerOnly = openPerson('a', {
      intent: {
        appetite: { social: 0, professional: 1 },
        openTo: ['coworking'],
        topics: [],
        languages: ['en'],
        interests: [],
        seeking: [],
        offering: [],
        openToAnyone: false,
      },
    });
    const input = world([coworkerOnly]);
    input.me = {
      ...input.me,
      intent: { ...input.me.intent, openTo: ['coworking'] },
    };
    // Strip the city stay so only the flight remains.
    input.myTrip = trip(input.me, [LEG()]);
    input.pool[0]!.trip = trip(coworkerOnly, [LEG()]);

    expect(findCandidates(input).candidates).toHaveLength(0);
  });

  it('applies the women-only preset through the privacy engine', () => {
    const input = world([openPerson('m', { gender: 'man' })]);
    input.me = {
      ...input.me,
      gender: 'woman',
      privacy: { ...input.me.privacy, presets: ['women_only'] },
    };
    const res = findCandidates(input);
    expect(res.candidates).toHaveLength(0);
    // Reported as a bucket, never as a number or an identity.
    expect(res.suppressed.byPrivacy.kind).not.toBe('exact');
  });

  it('does not re-surface someone with a live request', () => {
    const input = world([openPerson('a')]);
    const withHistory: MatchInput = {
      ...input,
      requestHistory: { active: [input.pool[0]!.person.id], denied: [] },
    };
    expect(findCandidates(withHistory).candidates).toHaveLength(0);
  });

  it('does not re-surface someone who declined, under any other pretext', () => {
    // This pair overlaps four different ways — same flight, the same airport at
    // the far end, the same night, and three days in the city. A decline has to
    // remove them from all of it, not just the one that was asked about.
    const input = world([openPerson('a')]);
    const withHistory: MatchInput = {
      ...input,
      requestHistory: { active: [], denied: [input.pool[0]!.person.id] },
    };
    expect(findCandidates(input).candidates[0]!.allOverlaps.length).toBeGreaterThan(1);
    expect(findCandidates(withHistory).candidates).toHaveLength(0);
  });
});

describe('suppression counts never identify anyone', () => {
  it('buckets small numbers instead of reporting them exactly', () => {
    // Three people hidden by privacy. On a small flight, "3" plus the context
    // would identify them; "a few" does not.
    const men = [openPerson('m1', { gender: 'man' }), openPerson('m2', { gender: 'man' }), openPerson('m3', { gender: 'man' })];
    const input = world(men);
    input.me = {
      ...input.me,
      gender: 'woman',
      privacy: { ...input.me.privacy, presets: ['women_only'] },
    };
    const res = findCandidates(input);
    expect(res.suppressed.byPrivacy.kind).toBe('few');
    expect(JSON.stringify(res.suppressed)).not.toContain('m1');
  });
});

describe('ranking', () => {
  it('is deterministic — the same input gives the same order', () => {
    const input = world([openPerson('a'), openPerson('b'), openPerson('c'), openPerson('d')]);
    const once = findCandidates(input).candidates.map((c) => c.person.id);
    const twice = findCandidates(input).candidates.map((c) => c.person.id);
    expect(twice).toEqual(once);
  });

  it('does not depend on the order the pool arrived in', () => {
    const input = world([openPerson('a'), openPerson('b'), openPerson('c')]);
    const forward = findCandidates(input).candidates.map((c) => c.person.id);
    const reversed = findCandidates({ ...input, pool: [...input.pool].reverse() }).candidates.map(
      (c) => c.person.id,
    );
    expect(reversed).toEqual(forward);
  });

  /**
   * The load-bearing test. If someone adds an appearance-shaped signal later,
   * this fails — which is the whole reason it exists.
   */
  it('ignores avatar, photo, gender and name entirely', () => {
    const plain = openPerson('a');
    const restyled: Person = {
      ...plain,
      gender: 'man',
      displayName: 'Someone Else Entirely',
      firstName: 'Someone',
      avatar: {
        ...plain.avatar,
        seed: 'totally-different',
        palette: { ...plain.avatar.palette, skin: '#000000' },
        // Having a photograph must not be worth a single point. Otherwise the
        // seeded cast would quietly out-rank every real user who has not
        // uploaded one, and the board would be sorted by who looks the part.
        photoUrl: '/assets/some-photograph.jpg',
      },
    };

    const base = findCandidates(world([plain])).candidates[0]!;
    const permuted = findCandidates(world([restyled])).candidates[0]!;

    expect(permuted.score).toBe(base.score);
    expect(permuted.signals).toEqual(base.signals);
  });

  /**
   * The negative control. A ranking that ignored everything would pass the
   * invariance test above; this proves it still reads what a person wants.
   */
  it('does notice what a candidate is seeking and offering', () => {
    const plain = openPerson('a');
    const wanting: Person = {
      ...plain,
      intent: {
        ...plain.intent,
        seeking: ['energy-finance' as never],
        offering: ['energy-markets' as never],
      },
    };
    const input = world([wanting]);
    input.me = {
      ...input.me,
      intent: { ...input.me.intent, seeking: ['energy-markets' as never], offering: ['energy-finance' as never] },
    };
    const base = findCandidates(world([plain])).candidates[0]!;
    const fit = findCandidates(input).candidates[0]!;
    expect(fit.score).not.toBe(base.score);
    expect(fit.signals.mutualFit).toBeGreaterThan(base.signals.mutualFit);
  });

  it('ranks a shared flight above merely sharing a city', () => {
    const me = openPerson('me');
    const flightMate = openPerson('flight');
    const cityMate = openPerson('city');

    const input: MatchInput = {
      me,
      myTrip: trip(me, [LEG()], [STAY()]),
      pool: [
        { person: cityMate, trip: trip(cityMate, [], [STAY()]) },
        { person: flightMate, trip: trip(flightMate, [LEG()], [STAY()]) },
      ],
      now: NOW,
      airports: stubAirports,
      config: cfg,
    };

    expect(findCandidates(input).candidates[0]!.person.id).toBe(flightMate.id);
  });

  it('pushes down someone shown repeatedly and ignored', () => {
    const a = openPerson('aaa');
    const b = openPerson('bbb');
    const input = world([a, b]);

    const fresh = findCandidates(input).candidates.map((c) => c.person.id);
    const fatigued = findCandidates({ ...input, seenCounts: { [fresh[0]!]: 8 } }).candidates.map(
      (c) => c.person.id,
    );
    expect(fatigued[0]).not.toBe(fresh[0]);
  });
});

describe('feasibleMeetKinds', () => {
  it('offers nothing at all for a terminal-change layover with little time', () => {
    expect(
      feasibleMeetKinds(
        {
          kind: 'shared_layover',
          airport: 'LHR' as never,
          window: { from: NOW, to: NOW },
          bothAirside: false,
          sameTerminal: false,
          usableMin: 70,
        },
        cfg,
      ),
    ).toEqual([]);
  });

  it('offers a meal only when there is real time in one terminal', () => {
    const short = feasibleMeetKinds(
      { kind: 'shared_layover', airport: 'LHR' as never, window: { from: NOW, to: NOW }, bothAirside: true, sameTerminal: true, usableMin: 40 },
      cfg,
    );
    const long = feasibleMeetKinds(
      { kind: 'shared_layover', airport: 'LHR' as never, window: { from: NOW, to: NOW }, bothAirside: true, sameTerminal: true, usableMin: 150 },
      cfg,
    );
    expect(short).not.toContain('meal');
    expect(long).toContain('meal');
  });

  it('only offers coworking on a multi-day overlap', () => {
    const oneDay = feasibleMeetKinds(
      { kind: 'overlapping_stay', cityKey: 'singapore-sg' as never, overlap: { from: '2026-09-03' as never, to: '2026-09-03' as never }, days: 1 },
      cfg,
    );
    const threeDays = feasibleMeetKinds(
      { kind: 'overlapping_stay', cityKey: 'singapore-sg' as never, overlap: { from: '2026-09-03' as never, to: '2026-09-05' as never }, days: 3 },
      cfg,
    );
    expect(oneDay).not.toContain('coworking');
    expect(threeDays).toContain('coworking');
  });
});

describe('whatIfRelaxed', () => {
  it('never returns fewer people than before', () => {
    const input = world([openPerson('a')]);
    for (const r of [
      { kind: 'widen_days', days: 2 },
      { kind: 'allow_shorter_layovers', minUsableMin: 15 },
      { kind: 'broaden_meet_kinds' },
      { kind: 'drop_circle_scope' },
    ] as const) {
      const out = whatIfRelaxed(input, r);
      expect(out.after).toBeGreaterThanOrEqual(out.before);
    }
  });

  it('only offers relaxations that actually unlock somebody', () => {
    // Everyone already matches, so no widening can add anyone.
    expect(relaxations(world([openPerson('a')]))).toEqual([]);
  });

  it('phrases the unlock honestly', () => {
    const me = openPerson('me');
    const other = openPerson('other');
    const input: MatchInput = {
      me,
      myTrip: trip(me, [], [stay('singapore-sg', '2026-09-03', '2026-09-04', '2026-09-03T00:00:00Z', '2026-09-04T23:00:00Z')]),
      pool: [
        {
          person: other,
          trip: trip(other, [], [stay('singapore-sg', '2026-09-06', '2026-09-08', '2026-09-06T00:00:00Z', '2026-09-08T00:00:00Z')]),
        },
      ],
      now: NOW,
      airports: stubAirports,
      config: cfg,
    };

    expect(findCandidates(input).candidates).toHaveLength(0);
    const out = whatIfRelaxed(input, { kind: 'widen_days', days: 3 });
    expect(out.after).toBeGreaterThan(0);
    expect(out.label).toMatch(/±3 days would put 1 more person in range/);
  });
});
