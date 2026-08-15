import { describe, expect, it } from 'vitest';
import { isRedacted } from '@domain/person';
import { compilePolicy } from '../compile';
import { whoCanSeeMe } from '../audience/report';
import { personasFromSegments, previewAs } from '../audience/previewAs';
import { segmentsFor } from '../audience/segments';
import { NOW, withPolicy, woman } from './fixtures';

const baseInput = (person: ReturnType<typeof woman>) => ({
  me: person,
  policy: compilePolicy(person.privacy),
  now: NOW,
  liveProximities: ['same_flight', 'same_city'] as const,
  liveContexts: [
    { kind: 'flight' as const, label: 'On SK4489 to Singapore', until: NOW },
  ],
  ownCircleIds: [],
  hasActiveGuardian: false,
  hasCircleAdmins: false,
});

describe('whoCanSeeMe', () => {
  it('answers about right now, not in principle', () => {
    const report = whoCanSeeMe({ ...baseInput(woman()), liveProximities: ['same_flight'] });
    const proximities = new Set(report.segments.map((s) => s.segment.facets.proximity));
    // Only the flight the person is actually on, plus the "not near you" row.
    expect(proximities).toEqual(new Set(['same_flight', 'none']));
  });

  it('shows an open profile as visible to the people around them', () => {
    const report = whoCanSeeMe(baseInput(woman()));
    const nearby = report.segments.filter((s) => s.segment.facets.proximity !== 'none');
    expect(nearby.every((s) => s.visible)).toBe(true);
    expect(report.visibleTotal).toBeGreaterThan(0);
  });

  describe('with women_only enabled', () => {
    const her = withPolicy(woman(), { presets: ['women_only'] });
    const report = () => whoCanSeeMe(baseInput(her));

    it('splits the population by gender, because the policy now reads it', () => {
      const genders = new Set(report().segments.map((s) => s.segment.facets.gender));
      expect(genders.has('woman')).toBe(true);
      expect(genders.has('man')).toBe(true);
    });

    it('blocks every male segment', () => {
      const men = report().segments.filter((s) => s.segment.facets.gender === 'man');
      expect(men.length).toBeGreaterThan(0);
      expect(men.every((s) => !s.visible)).toBe(true);
    });

    it('names the reason on every blocked row', () => {
      for (const s of report().segments.filter((x) => !x.visible)) {
        expect(s.deniedBy.length).toBeGreaterThan(0);
        expect(s.reasons.length).toBeGreaterThan(0);
        expect(s.reasons[0]!.text.length).toBeGreaterThan(0);
      }
    });

    it('leaves women near her still able to see her', () => {
      const womenNearby = report().segments.filter(
        (s) => s.segment.facets.gender === 'woman' && s.segment.facets.proximity !== 'none',
      );
      expect(womenNearby.every((s) => s.visible)).toBe(true);
    });

    it('cuts the estimated reach', () => {
      expect(whoCanSeeMe(baseInput(her)).visibleTotal).toBeLessThan(
        whoCanSeeMe(baseInput(woman())).visibleTotal,
      );
    });
  });

  it('lists a guardian holding a live link as someone who can see you', () => {
    const report = whoCanSeeMe({ ...baseInput(woman()), hasActiveGuardian: true });
    const guardian = report.segments.find((s) => s.segment.facets.channel === 'guardian_link');
    // An audience report that omits the person holding a live location link is
    // not an answer to "who can see me".
    expect(guardian).toBeDefined();
    expect(guardian!.visible).toBe(true);
    expect(guardian!.segment.label).toMatch(/guardian/i);
  });

  it('lists circle administrators separately', () => {
    const report = whoCanSeeMe({ ...baseInput(woman()), hasCircleAdmins: true });
    expect(report.segments.some((s) => s.segment.facets.channel === 'circle_admin')).toBe(true);
  });

  it('reports per-field exposure, derived from the real redactor', () => {
    const report = whoCanSeeMe(baseInput(woman()));
    const fields = report.fields.map((f) => f.field);
    // A stranger gets the browse rung.
    expect(fields).toContain('avatar');
    expect(fields).toContain('headline');
    // And not the things the ladder withholds.
    expect(fields).not.toContain('bio');
    expect(fields).not.toContain('links');
  });

  it('respects a nameEarly override in the exposure report', () => {
    const open = withPolicy(woman(), { disclosure: { nameEarly: true } });
    const report = whoCanSeeMe(baseInput(open));
    expect(report.fields.map((f) => f.field)).toContain('displayName');
  });
});

describe('previewAs', () => {
  const her = withPolicy(woman(), { presets: ['women_only'] });

  const personas = () => {
    const { segments } = segmentsFor({
      policy: compilePolicy(her.privacy),
      liveProximities: ['same_flight'],
      ownCircleIds: [],
      requiredStampKinds: [],
      hasActiveGuardian: false,
      hasCircleAdmins: false,
    });
    return personasFromSegments(segments, 20);
  };

  it('shows a blocked persona nothing, with a reason', () => {
    const male = personas().find((p) => p.facets.gender === 'man')!;
    const res = previewAs(her, compilePolicy(her.privacy), male, { now: NOW, ownCircleIds: [] });

    expect(res.visible).toBe(false);
    expect(res.reasons[0]?.text).toBeTruthy();
    expect(isRedacted(res.view.displayName)).toBe(true);
    expect(isRedacted(res.view.headline)).toBe(true);
    // The photo still renders — the shape of an empty card is the message.
    expect(res.view.avatar).toBeDefined();
  });

  it('shows an admitted persona exactly the browse rung', () => {
    const female = personas().find((p) => p.facets.gender === 'woman')!;
    const res = previewAs(her, compilePolicy(her.privacy), female, { now: NOW, ownCircleIds: [] });

    expect(res.visible).toBe(true);
    expect(res.view._level).toBe(0);
    expect(isRedacted(res.view.headline)).toBe(false);
    // Still a stranger: no bio, no links.
    expect(isRedacted(res.view.bio)).toBe(true);
    expect(res.view.links.every((l) => isRedacted(l))).toBe(true);
  });

  it('is the real pipeline, not a mock — it matches redact() exactly', () => {
    const female = personas().find((p) => p.facets.gender === 'woman')!;
    const res = previewAs(her, compilePolicy(her.privacy), female, { now: NOW, ownCircleIds: [] });
    const report = whoCanSeeMe(baseInput(her));
    const matching = report.segments.find((s) => s.segment.id === female.id);

    expect(matching?.visible).toBe(res.visible);
    expect(matching?.level).toBe(res.view._level);
  });

  it('can preview what an accepted match sees', () => {
    const female = personas().find((p) => p.facets.gender === 'woman')!;
    const res = previewAs(her, compilePolicy(her.privacy), female, {
      now: NOW,
      ownCircleIds: [],
      relationship: 'accepted',
    });
    expect(res.view._level).toBe(2);
    expect(res.view.displayName).toBe(her.displayName);
    // The on_accept link is released; the on_meet one is not.
    const linkedin = res.view.links[0];
    const instagram = res.view.links[1];
    expect(isRedacted(linkedin)).toBe(false);
    expect(isRedacted(instagram)).toBe(true);
  });
});
