import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SEED_PEOPLE as PEOPLE } from '../data/seed/people';
import { asTagId } from './ids';
import { TAGS, TAG_BY_ID, normaliseTag, tagAffinity } from './tags';

const t = asTagId;

describe('the vocabulary', () => {
  it('has unique ids and every `near` points at a real tag', () => {
    const ids = new Set(TAGS.map((x) => x.id));
    expect(ids.size).toBe(TAGS.length);
    for (const tag of TAGS) for (const n of tag.near ?? []) expect(TAG_BY_ID.has(n)).toBe(true);
  });

  it('is big enough to be a vocabulary and small enough to scan', () => {
    expect(TAGS.length).toBeGreaterThanOrEqual(80);
    expect(TAGS.length).toBeLessThanOrEqual(120);
  });

  it('resolves every topic and industry the seed cast already carries', () => {
    const misses: string[] = [];
    for (const p of PEOPLE) {
      for (const topic of p.intent.topics) if (!normaliseTag(topic)) misses.push(`topic:${topic}`);
      if (!normaliseTag(p.professional.industry)) misses.push(`industry:${p.professional.industry}`);
    }
    expect(misses).toEqual([]);
  });

  it('normalises case, spacing and aliases', () => {
    expect(normaliseTag('Energy trading')).toBe(t('energy-markets'));
    expect(normaliseTag('  ENERGY  ')).toBe(t('energy'));
    expect(normaliseTag('public health')).toBe(t('public-health'));
    expect(normaliseTag('oceans')).toBe(t('marine-science'));
    expect(normaliseTag('quantum knitting')).toBeUndefined();
  });

  it('joins the energy cluster by adjacency rather than collapsing it', () => {
    const cluster = ['energy', 'energy-markets', 'energy-finance', 'infrastructure-finance'].map(t);
    for (const id of cluster) expect(TAG_BY_ID.has(id)).toBe(true);
    expect(tagAffinity([t('energy-markets')], [t('energy-finance')])).toBeGreaterThan(0.3);
    expect(tagAffinity([t('energy-markets')], [t('energy-finance')])).toBeLessThan(1);
  });
});

describe('tagAffinity', () => {
  it('is 0 for empty lists and 1 for identical singletons', () => {
    expect(tagAffinity([], [])).toBe(0);
    expect(tagAffinity([t('cycling')], [])).toBe(0);
    expect(tagAffinity([t('cycling')], [t('cycling')])).toBe(1);
  });

  it('orders exact > near > same group > unrelated', () => {
    const exact = tagAffinity([t('cycling')], [t('cycling')]);
    const near = tagAffinity([t('cycling')], [t('running')]);
    const group = tagAffinity([t('cycling')], [t('tennis')]);
    const none = tagAffinity([t('cycling')], [t('law')]);
    expect(exact).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(group);
    expect(group).toBeGreaterThan(none);
    expect(none).toBe(0);
  });

  const arbTags = fc.uniqueArray(fc.constantFrom(...TAGS.map((x) => x.id)), { minLength: 0, maxLength: 6 });

  it('is symmetric and bounded, whatever the lists', () => {
    fc.assert(
      fc.property(arbTags, arbTags, (a, b) => {
        const ab = tagAffinity(a, b);
        expect(ab).toBe(tagAffinity(b, a));
        expect(ab).toBeGreaterThanOrEqual(0);
        expect(ab).toBeLessThanOrEqual(1);
      }),
      { numRuns: 300 },
    );
  });

  it('does not depend on the length of the shorter list alone', () => {
    // The old overlapRatio saturated at 1 when the shorter list was contained.
    // Adding an unrelated tag to one side must lower the score, not leave it.
    const full = tagAffinity([t('cycling'), t('coffee')], [t('cycling'), t('coffee')]);
    const diluted = tagAffinity([t('cycling'), t('coffee')], [t('cycling'), t('coffee'), t('law')]);
    expect(diluted).toBeLessThan(full);
  });
});
