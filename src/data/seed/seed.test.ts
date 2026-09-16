import { describe, expect, it } from 'vitest';
import { MATCH_CONFIG_V1, findCandidates, relaxations } from '@matching/index';
import { airportIndex } from '@data/airports/index';
import { SEED_PEOPLE, RESPONSE_RATES } from './people';
import { ME, MY_TRIPS, SEED_NOW, seedPool } from './trips';
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
    myTrip: MY_TRIPS[0]!,
    myCircleIds: circleIds,
    pool: seedPool(),
    now: SEED_NOW,
    airports: airportIndex,
    config: MATCH_CONFIG_V1,
    seenCounts: {},
    requestHistory: { active: [], denied: [] },
  });

const ids = (r: ReturnType<typeof run>) => r.candidates.map((c) => String(c.person.id));

/** The same person, with the default verified-only floor taken off. */
const withoutVerifiedOnly = (p: typeof ME): typeof ME => ({
  ...p,
  privacy: {
    ...p.privacy,
    presets: p.privacy.presets.filter((x) => x !== 'verified_only'),
    audience: { ...p.privacy.audience, minAssurance: 0 },
    seeking: { ...p.privacy.seeking, minAssurance: 0 },
  },
});

describe('the seeded world', () => {
  it('gives a first-run board that is worth looking at', () => {
    const res = run();
    expect(res.candidates.length).toBeGreaterThanOrEqual(6);
  });

  it('gives every seeded person a photograph', () => {
    // The photo map is keyed by person id, and a typo in either place fails
    // silently — the person simply falls through to a generated portrait and
    // nobody notices until the board looks half-finished in a screenshot.
    const missing = SEED_PEOPLE.filter((p) => !p.avatar.photoUrl).map((p) => String(p.id));
    expect(missing).toEqual([]);
  });

  it('keeps the generated portrait underneath the photograph', () => {
    // The photo is an addition, not a replacement: it is what renders if an
    // image 404s, and its palette still tints the card.
    for (const p of SEED_PEOPLE) {
      expect(p.avatar.palette.bgFrom).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.avatar.seed).toBe(String(p.id));
    }
  });

  it('puts someone on your actual flight first, and the rest of them high', () => {
    const res = run();

    // The single strongest thing that can be true of a stranger is that you are
    // both about to spend thirteen hours on the same aircraft.
    expect(res.candidates[0]!.overlap.kind).toBe('same_flight');

    // The rest of the flight ranks in the top half, but is not guaranteed to
    // own the podium outright. Asserting that it did would freeze the ordering
    // against exactly the signal this product sells — someone who shares your
    // school, has proved who they are and works on what you work on can and
    // should out-rank a weak match who happens to be in seat 42K. What must
    // stay true is that the flight is never buried.
    const ids = res.candidates.map((c) => String(c.person.id));
    const half = Math.ceil(ids.length / 2);
    const topHalf = new Set(ids.slice(0, half));
    // Jonas and Mira share the flight and fit what Alex is looking for.
    for (const id of ['jonas', 'mira']) expect(topHalf).toContain(id);
    // Lucas shares the flight and nothing else. Since matching v2 he can be
    // out-ranked by people who fit — but never buried: no same-flight
    // person sits in the bottom third.
    const floor = Math.floor((ids.length * 2) / 3);
    for (const c of res.candidates) {
      if (c.overlap.kind === 'same_flight') expect(ids.indexOf(String(c.person.id))).toBeLessThan(floor);
    }
  });

  it('offers only what the overlap can physically support', () => {
    const res = run();
    const theo = res.candidates.find((c) => String(c.person.id) === 'theo');
    const lucas = res.candidates.find((c) => String(c.person.id) === 'lucas');

    // Six days in one city is the only thing that makes coworking real.
    expect(theo?.proposableKinds).toContain('coworking');
    // A shared flight does not.
    expect(lucas?.proposableKinds ?? []).not.toContain('coworking');
  });

  it('drops the terminal-change connection instead of ranking it low', () => {
    // Hassan has 85 usable minutes at Heathrow across two terminals. That is
    // not a coffee, and offering it anyway is how somebody misses a flight.
    expect(ids(run())).not.toContain('omar');
    expect(run().suppressed.byFeasibility.kind).not.toBe('none');
  });

  it('keeps the same-terminal connection, which genuinely works', () => {
    expect(ids(run())).toContain('priya');
  });

  it('finds someone landing at Changi just after you, once the default lets her in', () => {
    /*
     * Ayla is the seed's deliberate newcomer — `stamps: []`, "First time
     * through Changi", `reliability: 'unproven'` — and `verified_only` is on
     * by default, so she is correctly not on the board. That is the default
     * doing its job, not a broken overlap: the travel maths is fine and the
     * privacy floor is what removes her.
     *
     * So this asserts both halves, because either one alone would be
     * misleading. Without the first, a genuinely broken overlap would look
     * like a privacy decision. Without the second, a default that hid her
     * with no way back would look correct.
     */
    expect(ids(run())).not.toContain('ayla');

    const openToUnverified = withoutVerifiedOnly(ME);
    const ayla = run(openToUnverified).candidates.find((c) => String(c.person.id) === 'ayla');
    expect(ayla).toBeDefined();
    expect(ayla?.allOverlaps.some((o) => o.kind === 'same_airport_window')).toBe(true);
  });

  it('offers dropping the verified floor when that is what is hiding people', () => {
    // The relaxation exists so an empty board can name the one setting that
    // would fill it. An offer that unlocks nobody is never shown, so the
    // presence of this one is itself the evidence that Ayla is reachable.
    const offers = relaxations({
      me: ME,
      myTrip: MY_TRIPS[0]!,
      myCircleIds: ['insead'],
      pool: seedPool(),
      now: SEED_NOW,
      airports: airportIndex,
      config: MATCH_CONFIG_V1,
      seenCounts: {},
      requestHistory: { active: [], denied: [] },
    });
    const floor = offers.find((o) => o.relaxation.kind === 'drop_assurance_floor');
    expect(floor).toBeDefined();
    expect(floor!.after).toBeGreaterThan(floor!.before);
    expect(floor!.label).toMatch(/not verified an account/i);
  });
});

describe('privacy is visible in the seed, not theoretical', () => {
  it('shows the women-only traveller to a woman', () => {
    expect(ids(run())).toContain('nina');
  });

  it('hides her from a man, and says so only as a bucket', () => {
    const asMan = run({ ...ME, gender: 'man' });
    expect(ids(asMan)).not.toContain('nina');
    expect(asMan.suppressed.byPrivacy.kind).not.toBe('none');
    // Never an identity, and never an exact small number.
    expect(JSON.stringify(asMan.suppressed)).not.toContain('nina');
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

  it('shows first names on the board and never full names', () => {
    // The old form of this test asserted `typeof displayName !== 'string'` —
    // no name at all. That is stricter than the invariant its own title
    // describes, and it would also have passed if the field were dropped
    // entirely. Asserting the exact value catches both regressions: a surname
    // leaking, and the name silently disappearing.
    for (const c of run().candidates) {
      expect(c.person._level).toBe(0);
      const real = SEED_PEOPLE.find((p) => String(p.id) === String(c.person.id))!;
      expect(c.person.displayName).toBe(real.firstName);
      expect(c.person.displayName).not.toBe(real.displayName);
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
