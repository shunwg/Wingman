import { describe, expect, it } from 'vitest';
import { asCircleId, asPersonId, type Person } from '@domain/index';
import type { ISODateTime } from '@domain/time';
import { SEED_CIRCLES } from '@data/seed/circles';
import { SEED_PEOPLE } from '@data/seed/people';
import { ME } from '@data/seed/trips';
import { listedMembers } from './circles';
import { eventBoards } from './event';

const at = (s: string) => s as ISODateTime;
const membership = (circleId: string, display: 'show_badge' | 'match_only' | 'paused') => ({
  circleId: asCircleId(circleId),
  personId: asPersonId('you'),
  display,
  joinedAt: at('2026-03-01T09:00:00Z'),
  admittedBy: 'email_domain' as const,
  role: 'member' as const,
});
const inGridWeek: Person = { ...ME, memberships: [membership('gridweek', 'match_only')] };

describe('eventBoards', () => {
  it('a member with no flight sees Grid Week while it runs', () => {
    const boards = eventBoards(inGridWeek, SEED_CIRCLES, at('2026-09-03T08:00:00Z'));
    expect(boards).toHaveLength(1);
    expect(boards[0]!.circle.shortName).toBe('Grid Week');
    expect(boards[0]!.daysLeft).toBe(3);
    expect(boards[0]!.members.length).toBeGreaterThan(0);
    // Only those who chose to be seen; never the viewer.
    for (const m of boards[0]!.members) expect(String(m.id)).not.toBe('you');
  });

  it('a finished event yields nothing', () => {
    expect(eventBoards(inGridWeek, SEED_CIRCLES, at('2026-09-20T08:00:00Z'))).toEqual([]);
  });

  it('a paused membership yields nothing', () => {
    const paused: Person = { ...ME, memberships: [membership('gridweek', 'paused')] };
    expect(eventBoards(paused, SEED_CIRCLES, at('2026-09-03T08:00:00Z'))).toEqual([]);
  });

  it('a school is not an event', () => {
    const insead: Person = { ...ME, memberships: [membership('insead', 'show_badge')] };
    expect(eventBoards(insead, SEED_CIRCLES, at('2026-09-03T08:00:00Z'))).toEqual([]);
  });
});

/**
 * Round 4 (privacy): the member list and the event board asked nothing but
 * "did they choose to be listed". A person you hid stayed on the event you
 * were both at, and a verified-only member was listed to anyone.
 */
describe('a listing honours hides and the member’s own audience', () => {
  const now = at('2026-09-03T08:00:00Z');
  const ids = (people: { id: unknown }[]) => people.map((p) => String(p.id));
  const listed = ids(listedMembers('gridweek', inGridWeek, now, SEED_CIRCLES));
  const someone = listed[0]!;

  it('lists someone before any hide', () => {
    expect(someone).toBeDefined();
  });

  it('drops a person you hid from the circle list and the event board', () => {
    const hiding: Person = { ...inGridWeek, blocked: [asPersonId(someone)] };
    expect(ids(listedMembers('gridweek', hiding, now, SEED_CIRCLES))).not.toContain(someone);
    expect(ids(eventBoards(hiding, SEED_CIRCLES, now)[0]!.members)).not.toContain(someone);
  });

  it('drops a member who hid you', () => {
    const people = SEED_PEOPLE.find((p) => String(p.id) === someone)!;
    const original = people.blocked;
    people.blocked = [asPersonId('you')];
    try {
      expect(ids(listedMembers('gridweek', inGridWeek, now, SEED_CIRCLES))).not.toContain(someone);
    } finally {
      people.blocked = original;
    }
  });

  it('keeps a member whose audience needs a verified viewer off the list for someone unverified', () => {
    // Mira's audience floor is "verified" (the default); round 4 found her
    // listed, photo and bio, to a viewer with no stamps at all.
    expect(listed).toContain('mira');
    const unverified: Person = { ...inGridWeek, verifications: [] };
    expect(ids(listedMembers('gridweek', unverified, now, SEED_CIRCLES))).not.toContain('mira');
  });
});
