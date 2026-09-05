import { describe, expect, it } from 'vitest';
import { asCircleId } from '@domain/index';
import { SEED_CIRCLES } from '@data/seed/circles';
import { eventBoards } from './event';

const inGridWeek = {
  id: 'you',
  memberships: [{ circleId: asCircleId('gridweek'), display: 'match_only' }],
};

describe('eventBoards', () => {
  it('a member with no flight sees Grid Week while it runs', () => {
    const boards = eventBoards(inGridWeek, SEED_CIRCLES, '2026-09-03');
    expect(boards).toHaveLength(1);
    expect(boards[0]!.circle.shortName).toBe('Grid Week');
    expect(boards[0]!.daysLeft).toBe(3);
    expect(boards[0]!.members.length).toBeGreaterThan(0);
    // Only those who chose to be seen; never the viewer.
    for (const m of boards[0]!.members) expect(String(m.id)).not.toBe('you');
  });

  it('a finished event yields nothing', () => {
    expect(eventBoards(inGridWeek, SEED_CIRCLES, '2026-09-20')).toEqual([]);
  });

  it('a paused membership yields nothing', () => {
    const paused = { ...inGridWeek, memberships: [{ circleId: asCircleId('gridweek'), display: 'paused' }] };
    expect(eventBoards(paused, SEED_CIRCLES, '2026-09-03')).toEqual([]);
  });

  it('a school is not an event', () => {
    const insead = { id: 'you', memberships: [{ circleId: asCircleId('insead'), display: 'show_badge' }] };
    expect(eventBoards(insead, SEED_CIRCLES, '2026-09-03')).toEqual([]);
  });
});
