import { describe, expect, it } from 'vitest';
import { MATCH_CONFIG_V1, findCandidates } from '@matching/index';
import { airportIndex } from '@data/airports/index';
import { SEED_PEOPLE, RESPONSE_RATES } from './people';
import { ME, MY_TRIP, SEED_NOW, seedPool } from './trips';
import { SEED_CIRCLES } from './circles';

/**
 * The seed world, run through the real engine.
 *
 * These are as much a check on the *fixtures* as on the code: a seed set where
 * everybody matches everybody would make the board look impressive and prove
 * nothing. Each case below is a shape the product has to get right.
 */

const run = (me = ME, circleIds = ['insead']) =>
  findCandidates({
    me,
    myTrip: MY_TRIP,
    myCircleIds: circleIds,
    pool: seedPool(),
    now: SEED_NOW,
    airports: airportIndex,
    config: MATCH_CONFIG_V1,
    seenCounts: {},
    requestHistory: { active: [], denied: [] },
  });

const ids = (r: ReturnType<typeof run>) => r.candidates.map((c) => String(c.person.id));

describe('the seeded world', () => {
  it('gives a first-run board that is worth looking at', () => {
    const res = run();
    expect(res.candidates.length).toBeGreaterThanOrEqual(6);
  });

  it('puts the people on your actual flight at the top', () => {
    const top = run().candidates.slice(0, 3);
    expect(top.every((c) => c.overlap.kind === 'same_flight')).toBe(true);
  });

  it('offers only what the overlap can physically support', () => {
    const res = run();
    const wei = res.candidates.find((c) => String(c.person.id) === 'wei');
    const lukas = res.candidates.find((c) => String(c.person.id) === 'lukas');

    // Six days in one city is the only thing that makes coworking real.
    expect(wei?.proposableKinds).toContain('coworking');
    // A shared flight does not.
    expect(lukas?.proposableKinds ?? []).not.toContain('coworking');
  });

  it('drops the terminal-change connection instead of ranking it low', () => {
    // Hassan has 85 usable minutes at Heathrow across two terminals. That is
    // not a coffee, and offering it anyway is how somebody misses a flight.
    expect(ids(run())).not.toContain('hassan');
    expect(run().suppressed.byFeasibility.kind).not.toBe('none');
  });

  it('keeps the same-terminal connection, which genuinely works', () => {
    expect(ids(run())).toContain('priya');
  });

  it('finds someone landing at Changi just after you', () => {
    const amara = run().candidates.find((c) => String(c.person.id) === 'amara');
    expect(amara?.allOverlaps.some((o) => o.kind === 'same_airport_window')).toBe(true);
  });
});

describe('privacy is visible in the seed, not theoretical', () => {
  it('shows the women-only traveller to a woman', () => {
    expect(ids(run())).toContain('noor');
  });

  it('hides her from a man, and says so only as a bucket', () => {
    const asMan = run({ ...ME, gender: 'man' });
    expect(ids(asMan)).not.toContain('noor');
    expect(asMan.suppressed.byPrivacy.kind).not.toBe('none');
    // Never an identity, and never an exact small number.
    expect(JSON.stringify(asMan.suppressed)).not.toContain('noor');
    expect(asMan.suppressed.byPrivacy.kind).not.toBe('exact');
  });

  it('hides the ID-verified-only traveller from someone unverified', () => {
    const unverified = { ...ME, verifications: [] };
    expect(ids(run(unverified))).not.toContain('sofia');
    expect(ids(run())).toContain('sofia');
  });

  it('hides the professional-only traveller from a purely social viewer', () => {
    const social = {
      ...ME,
      intent: { ...ME.intent, appetite: { social: 0.9, professional: 0 } },
    };
    expect(ids(run(social))).not.toContain('tobias');
  });

  it('never leaks a full name onto the board', () => {
    for (const c of run().candidates) {
      expect(c.person._level).toBe(0);
      expect(typeof c.person.displayName).not.toBe('string');
    }
  });

  it('keeps a match_only circle off the card while still matching on it', () => {
    // Jonas is in Northwind as match_only and INSEAD as show_badge.
    const jonas = run().candidates.find((c) => String(c.person.id) === 'jonas');
    const shown = jonas?.person.circles.map((c) => String(c.circleId)) ?? [];
    expect(shown).toContain('insead');
    expect(shown).not.toContain('northwind');
  });
});

describe('fixture hygiene', () => {
  it('gives every person a photo', () => {
    for (const p of SEED_PEOPLE) expect(p.avatar.seed).toBe(String(p.id));
  });

  it('gives every person a response rate', () => {
    for (const p of SEED_PEOPLE) expect(RESPONSE_RATES[String(p.id)]).toBeGreaterThan(0);
  });

  it('withholds a reputation bucket below five meets', () => {
    for (const p of SEED_PEOPLE) {
      expect(p.reputation.hasEnoughSignal).toBe(p.reputation.meetsCompleted >= 5);
    }
  });

  it('covers both admission shapes the brief names', () => {
    const kinds = SEED_CIRCLES.map((c) => c.admission.kind);
    expect(kinds).toContain('email_domain');
    expect(kinds).toContain('invite_code');
  });

  it('explains every candidate without exposing a score', () => {
    for (const c of run().candidates) {
      expect(c.receipt.headline.length).toBeGreaterThan(0);
      expect(JSON.stringify(c.receipt)).not.toContain(String(c.score));
    }
  });
});
