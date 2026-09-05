import { describe, expect, it } from 'vitest';
import type { Circle, PublicCircleBadge, RedactedPerson } from '@domain/index';
import { asCircleId, asPersonId, asUtc } from '@domain/index';
import { generateAvatar } from '@design/avatar/generate';
import { SEED_CIRCLES } from '@data/seed/circles';
import { allCircles, decorateBadge, decoratePerson } from './circles';

const raw = (circleId: string, badgeIds?: string[]): PublicCircleBadge => ({
  circleId: asCircleId(circleId),
  shortName: '',
  crestSeed: circleId,
  kind: 'community',
  ...(badgeIds ? { badgeIds } : {}),
});

describe('decorateBadge', () => {
  it('fills in the name, kind and the first badge worn', () => {
    const b = decorateBadge(raw('gridweek', ['speaker']), SEED_CIRCLES);
    expect(b.shortName).toBe('Grid Week');
    expect(b.kind).toBe('conference');
    expect(b.badge).toEqual({ label: 'Speaker', tone: 'accent' });
  });

  it('leaves an unknown circle alone and an unknown badge unlabelled', () => {
    expect(decorateBadge(raw('nope'), SEED_CIRCLES).shortName).toBe('');
    expect(decorateBadge(raw('gridweek', ['ghost']), SEED_CIRCLES).badge).toBeUndefined();
  });

  it('carries an uploaded mark, and your own circles come first', () => {
    const mine: Circle = {
      id: asCircleId('obf'),
      name: 'Oslo Business Forum 2026',
      shortName: 'OBF',
      kind: 'conference',
      admission: { kind: 'invite_code' },
      crestSeed: 'obf',
      crestUrl: 'data:image/jpeg;base64,xyz',
      badges: [{ id: 'organiser', label: 'Organiser', tone: 'guard' }],
      membersOnly: false,
      memberCount: 1,
      createdAt: asUtc('2026-09-05T10:00:00Z'),
    };
    const circles = allCircles([mine]);
    expect(circles[0]).toBe(mine);
    const b = decorateBadge(raw('obf', ['organiser']), circles);
    expect(b.crestUrl).toBe('data:image/jpeg;base64,xyz');
    expect(b.badge?.label).toBe('Organiser');
  });
});

describe('decoratePerson', () => {
  it('only touches people who show a circle', () => {
    const person: RedactedPerson = {
      id: asPersonId('x'),
      avatar: generateAvatar('x'),
      displayName: 'X',
      headline: '',
      bio: '',
      links: [],
      stamps: [],
      circles: [],
      reputation: { __redacted: true, reason: 'subject_choice' },
      professional: {},
      _level: 0,
      _appliedRules: [],
    };
    expect(decoratePerson(person, SEED_CIRCLES)).toBe(person);
  });
});
