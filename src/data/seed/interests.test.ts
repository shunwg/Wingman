import { describe, expect, it } from 'vitest';
import { TAG_BY_ID } from '@domain/index';
import { SEED_PEOPLE } from './people';
import { ME } from './trips';

/**
 * Fixture hygiene for the interest half of the cast.
 *
 * The cast has to exercise the matching it demonstrates: every seeking and
 * offering id must be a real tag (a typo is a silent zero), everyone needs
 * something to be matched on, and at least one person must be deliberately
 * open — seeking nothing — because that is the case the engine promises not
 * to bury.
 */
describe('seed interests', () => {
  it('uses only real tag ids', () => {
    for (const p of [...SEED_PEOPLE, ME]) {
      for (const id of [...p.intent.interests, ...p.intent.seeking, ...p.intent.offering]) {
        expect(TAG_BY_ID.has(id), `${p.firstName}: ${id}`).toBe(true);
      }
    }
  });

  it('gives everyone interests and something to offer', () => {
    for (const p of SEED_PEOPLE) {
      expect(p.intent.interests.length, p.firstName).toBeGreaterThanOrEqual(2);
      expect(p.intent.offering.length, p.firstName).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps at least one person deliberately open', () => {
    expect(SEED_PEOPLE.some((p) => p.intent.seeking.length === 0)).toBe(true);
  });

  it('counts nothing twice: a resolved topic is an interest, not free text', () => {
    for (const p of SEED_PEOPLE) {
      for (const t of p.intent.topics) expect(TAG_BY_ID.has(t as never), `${p.firstName}: ${t}`).toBe(false);
    }
  });
});
