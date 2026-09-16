import { describe, expect, it } from 'vitest';
import { ARRIVAL_RAIL, DEPARTURE_RAIL, STAGE_ORDER } from './meet';
import { STAGE_COPY } from '@data/copy/stages';

/**
 * The two journey rails.
 *
 * These are ordered lists a person reads left to right while standing in an
 * airport, so the properties worth asserting are about the *shape* of the
 * sequence rather than its contents — a rail that loops, repeats, or ends
 * where it started is wrong in a way no screenshot review would catch.
 */

describe('the rails', () => {
  it('share exactly one stage, and it is the car', () => {
    /*
     * This is the property the whole direction bug turned on. `in_car` is on
     * both rails deliberately — it is the same act going out and coming back,
     * which is the point of the feature — and being shared is what made it
     * useless for deciding *which* direction someone is travelling. Anything
     * else appearing on both rails would need the same treatment, so the test
     * pins the count rather than the member.
     */
    const shared = DEPARTURE_RAIL.filter((s) => ARRIVAL_RAIL.includes(s));
    expect(shared).toEqual(['in_car']);
  });

  it('runs the car first leaving and last arriving', () => {
    // The mirror image, which is what "the other way round" means: you get
    // out of a car into a terminal, and out of a terminal into a car.
    expect(DEPARTURE_RAIL.indexOf('in_car')).toBe(1);
    expect(ARRIVAL_RAIL.indexOf('in_car')).toBe(ARRIVAL_RAIL.length - 1);
  });

  it('never repeats a stage within one rail', () => {
    for (const rail of [DEPARTURE_RAIL, ARRIVAL_RAIL]) {
      expect(new Set(rail).size).toBe(rail.length);
    }
  });

  it('keeps every rail stage in the canonical order', () => {
    // A rail is a subsequence of STAGE_ORDER, not its own opinion about time.
    for (const rail of [DEPARTURE_RAIL, ARRIVAL_RAIL]) {
      const positions = rail.map((s) => STAGE_ORDER.indexOf(s));
      expect(positions.every((p) => p >= 0)).toBe(true);
      // `in_car` is the one stage that legitimately runs backwards against the
      // canonical order, because it happens at both ends of the journey.
      const withoutCar = rail.filter((s) => s !== 'in_car').map((s) => STAGE_ORDER.indexOf(s));
      expect([...withoutCar].sort((a, b) => a - b)).toEqual(withoutCar);
    }
  });

  it('gives every stage on a rail something to say in both voices', () => {
    for (const stage of [...DEPARTURE_RAIL, ...ARRIVAL_RAIL]) {
      const copy = STAGE_COPY[stage];
      expect(copy.button.length).toBeGreaterThan(0);
      expect(copy.mine).toMatch(/^You/);
      // "is on their way", "has landed" — a fragment the room prefixes with a
      // name, so it must not start with a capital or a pronoun of its own.
      expect(copy.theirs[0]).toBe(copy.theirs[0]!.toLowerCase());
    }
  });

  it('does not put the lounge on the way to a gate', () => {
    // A real stage and an optional detour. On the rail it would mark everyone
    // who walked past the lounge as behind.
    expect(DEPARTURE_RAIL).not.toContain('in_lounge');
    expect(STAGE_ORDER).toContain('in_lounge');
  });
});
