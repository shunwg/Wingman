import { describe, expect, it } from 'vitest';
import { compilePolicy } from '../compile';
import { canSee, resolveMutual } from '../resolve';
import { ALL_RULES } from '../rules/registry';
import { COPY_KEYS, policyCopy } from '../copy';
import { ctx, idVerified, makePerson, man, subjectOf, withPolicy, woman } from './fixtures';

describe('two-way visibility', () => {
  it('lets two open people see each other', () => {
    const v = resolveMutual(subjectOf(woman()), subjectOf(man()), ctx());
    expect(v.mutual).toBe(true);
    expect(v.aSeesB.visible).toBe(true);
    expect(v.bSeesA.visible).toBe(true);
  });

  describe('the women_only preset', () => {
    // This is the bug the preset system exists to prevent: setting only the
    // "who can see me" half leaves your own feed full of the people you were
    // trying to exclude.
    it('hides her from men AND removes men from her feed', () => {
      const her = withPolicy(woman(), { presets: ['women_only'] });
      const him = man();

      const v = resolveMutual(subjectOf(her), subjectOf(him), ctx());

      expect(v.mutual).toBe(false);
      // He cannot see her — her audience rule.
      expect(v.bSeesA.visible).toBe(false);
      expect(v.bSeesA.deniedBy).toContain('gender.audience');
      // And she does not see him — her seeking rule, applied atomically.
      expect(v.aSeesB.visible).toBe(false);
      expect(v.aSeesB.deniedBy).toContain('gender.seeking');
    });

    it('still lets two women in the preset see each other', () => {
      const a = withPolicy(woman(), { presets: ['women_only'] });
      const b = withPolicy(makePerson({ id: 'w2', gender: 'woman' }), { presets: ['women_only'] });
      expect(resolveMutual(subjectOf(a), subjectOf(b), ctx()).mutual).toBe(true);
    });

    it('attributes the reason to the right side', () => {
      const her = withPolicy(woman(), { presets: ['women_only'] });
      const v = canSee(subjectOf(man()), subjectOf(her), ctx());
      const reason = v.reasons.find((r) => r.ruleId === 'gender.audience');
      // He is being told about HER choice, not his own.
      expect(reason?.side).toBe('theirs');
      expect(reason?.text).toMatch(/they chose/i);
    });
  });

  describe('assurance floors', () => {
    it('hides an ID-verified-only person from an unverified viewer', () => {
      const strict = withPolicy(idVerified('s1'), { presets: ['id_verified_only'] });
      const casual = makePerson({ id: 'c1', verifications: [] });

      const v = resolveMutual(subjectOf(casual), subjectOf(strict), ctx());
      expect(v.mutual).toBe(false);
      expect(v.aSeesB.deniedBy).toContain('assurance.floor');
    });

    it('admits a viewer who clears the floor', () => {
      const strict = withPolicy(idVerified('s1'), { presets: ['id_verified_only'] });
      const alsoStrict = idVerified('s2', 'man');
      expect(resolveMutual(subjectOf(alsoStrict), subjectOf(strict), ctx()).mutual).toBe(true);
    });
  });

  describe('blocks', () => {
    it('are absolute and symmetric', () => {
      const a = woman();
      const b = { ...man(), blocked: [a.id] };
      const v = resolveMutual(subjectOf(a), subjectOf(b), ctx());
      expect(v.mutual).toBe(false);
      expect(v.aSeesB.deniedBy).toContain('block.either');
      expect(v.bSeesA.deniedBy).toContain('block.either');
    });
  });

  describe('discoverability surfaces', () => {
    // Proximity describes the pair, so both sides carry the same value. The
    // surface rule reads it from the viewer: "how close is this person to me".
    const cityOnlyOff = () =>
      withPolicy(woman(), {
        discoverability: { onFlight: true, inTerminal: true, inCity: false, offTrip: false },
      });

    it('hides someone who turned off being found in a city', () => {
      const v = canSee(
        subjectOf(man(), { proximity: 'same_city' }),
        subjectOf(cityOnlyOff(), { proximity: 'same_city' }),
        ctx(),
      );
      expect(v.visible).toBe(false);
      expect(v.deniedBy).toContain('proximity.surface');
    });

    it('still shows them on a shared flight', () => {
      const v = canSee(
        subjectOf(man(), { proximity: 'same_flight' }),
        subjectOf(cityOnlyOff(), { proximity: 'same_flight' }),
        ctx(),
      );
      expect(v.visible).toBe(true);
    });

    it('hides someone who is not on a trip, by default', () => {
      const v = canSee(
        subjectOf(man(), { proximity: 'none' }),
        subjectOf(woman(), { proximity: 'none', onTrip: false }),
        ctx(),
      );
      expect(v.visible).toBe(false);
      expect(v.deniedBy).toEqual(expect.arrayContaining(['trip.offTrip']));
    });
  });

  it('collects every reason rather than only the first', () => {
    const strict = withPolicy(idVerified('s1'), { presets: ['women_only', 'id_verified_only'] });
    const casualMan = makePerson({ id: 'c1', gender: 'man', verifications: [] });
    const v = canSee(subjectOf(casualMan), subjectOf(strict), ctx());
    // Both gender and assurance closed the door; the screen should be able to
    // say so rather than reporting one and hiding the other.
    expect(v.deniedBy).toEqual(expect.arrayContaining(['gender.audience', 'assurance.floor']));
  });
});

describe('registry hygiene', () => {
  it('gives every rule a copy entry in both voices', () => {
    for (const rule of ALL_RULES) {
      expect(COPY_KEYS, `missing copy for ${rule.id}`).toContain(rule.copyKey);
      expect(policyCopy(rule.copyKey, 'yours')).not.toMatch(/^Hidden by a privacy setting\.$/);
      expect(policyCopy(rule.copyKey, 'theirs')).not.toMatch(/^Hidden by a privacy setting\.$/);
    }
  });

  it('uses unique rule ids', () => {
    const ids = ALL_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('compilePolicy', () => {
  it('reports gender as referenced only when a rule reads it', () => {
    expect(compilePolicy(woman().privacy).audienceFacets).not.toContain('gender');
    const strict = withPolicy(woman(), { presets: ['women_only'] });
    expect(compilePolicy(strict.privacy).audienceFacets).toContain('gender');
  });

  it('keeps seeking-only facets out of the audience set', () => {
    // A seeking-side gender rule shapes my feed, not their view of me.
    const p = withPolicy(woman(), {
      seeking: { ...woman().privacy.seeking, genders: ['woman'] },
    });
    const compiled = compilePolicy(p.privacy);
    expect(compiled.referencedFacets).toContain('gender');
    expect(compiled.audienceFacets).not.toContain('gender');
  });
});
