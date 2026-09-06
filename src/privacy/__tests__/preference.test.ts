import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Gender } from '@domain/index';
import { compilePolicy } from '../compile';
import { meetPreference, withMeetPreference } from '../presets';
import { resolveMutual } from '../resolve';
import { ctx, makePerson, man, subjectOf, woman } from './fixtures';

const GENDERS: Gender[] = ['woman', 'man', 'nonbinary', 'undisclosed'];

/** A person with a stored meet preference. */
const prefers = (p: ReturnType<typeof woman>, g: Gender[] | 'any') => ({
  ...p,
  privacy: withMeetPreference(p.privacy, g),
});

describe('the meet preference', () => {
  it('is written to both halves, whatever the list', () => {
    fc.assert(
      fc.property(fc.subarray(GENDERS), (list) => {
        const policy = withMeetPreference(woman().privacy, list);
        expect(policy.audience.genders).toEqual(policy.seeking.genders);
        expect(meetPreference(policy)).toEqual([...new Set(list)]);
      }),
    );
  });

  it('a woman who wants to meet only men sees them, and they see her', () => {
    const her = prefers(woman(), ['man']);
    expect(resolveMutual(subjectOf(her), subjectOf(man()), ctx()).mutual).toBe(true);
  });

  it('… and neither she nor another woman sees the other — both directions', () => {
    const her = prefers(woman(), ['man']);
    const other = makePerson({ id: 'w2', gender: 'woman' });
    const v = resolveMutual(subjectOf(her), subjectOf(other), ctx());
    expect(v.mutual).toBe(false);
    // Her seeking rule removed the other woman from her feed.
    expect(v.aSeesB.visible).toBe(false);
    expect(v.aSeesB.deniedBy).toContain('gender.seeking');
    // And her audience rule hides her from the other woman.
    expect(v.bSeesA.visible).toBe(false);
    expect(v.bSeesA.deniedBy).toContain('gender.audience');
  });

  it('a mixed set admits each member and nobody else', () => {
    const me = prefers(woman(), ['woman', 'nonbinary']);
    const nb = makePerson({ id: 'nb', gender: 'nonbinary' });
    const quiet = makePerson({ id: 'q', gender: 'undisclosed' });
    expect(resolveMutual(subjectOf(me), subjectOf(nb), ctx()).mutual).toBe(true);
    expect(resolveMutual(subjectOf(me), subjectOf(man()), ctx()).mutual).toBe(false);
    // Not on the list means not seen — including people who have not said.
    expect(resolveMutual(subjectOf(me), subjectOf(quiet), ctx()).mutual).toBe(false);
  });

  it('"anyone" clears both halves', () => {
    const p = withMeetPreference(withMeetPreference(woman().privacy, ['man']), 'any');
    expect(p.audience.genders).toBe('any');
    expect(p.seeking.genders).toBe('any');
  });

  it('composes with the women_only preset: the preset narrows, never widens', () => {
    const wide = withMeetPreference(woman().privacy, ['woman', 'man']);
    const compiled = compilePolicy({ ...wide, presets: ['women_only'] });
    expect(compiled.audience.genders).toEqual(['woman']);
    expect(compiled.seeking.genders).toEqual(['woman']);
  });
});
