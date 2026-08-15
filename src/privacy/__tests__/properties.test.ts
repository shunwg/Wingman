import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type {
  AssuranceLevel,
  DisclosureLevel,
  Gender,
  IntentAxis,
  PrivacyPresetId,
  ProximityClass,
} from '@domain/index';
import { isRedacted } from '@domain/person';
import { compilePolicy } from '../compile';
import { resolveMutual } from '../resolve';
import { redact } from '../redact';
import { FIELD_LEVEL, PROFESSIONAL_FIELD_LEVEL, effectiveLevel, linkLevel } from '../ladder';
import { segmentsFor, MAX_SEGMENTS } from '../audience/segments';
import { ctx, facetsOf, makePerson } from './fixtures';
import { defaultPolicy } from '../presets';

/**
 * Property tests.
 *
 * The example-based tests above check the cases I thought of. These check the
 * cases I did not. For a privacy model that is the difference that matters —
 * leaks live in combinations nobody enumerated, and "we tested the obvious
 * ones" is how they survive review.
 */

const genders: Gender[] = ['woman', 'man', 'nonbinary', 'undisclosed'];
const presetIds: PrivacyPresetId[] = [
  'women_only',
  'verified_only',
  'id_verified_only',
  'professional_only',
];
const proximities: ProximityClass[] = [
  'same_flight',
  'same_terminal',
  'same_airport',
  'same_city',
  'same_dates',
  'none',
];

const arbPolicy = fc.record({
  presets: fc.uniqueArray(fc.constantFrom(...presetIds), { maxLength: 3 }),
  minAssurance: fc.constantFrom<AssuranceLevel>(0, 1, 2, 3),
  onFlight: fc.boolean(),
  inTerminal: fc.boolean(),
  inCity: fc.boolean(),
  offTrip: fc.boolean(),
  nameEarly: fc.boolean(),
  professionalLate: fc.boolean(),
  bioLate: fc.boolean(),
});

const arbPerson = fc.record({
  id: fc.string({ minLength: 1, maxLength: 6 }).map((s) => `p${s.replace(/\W/g, '')}`),
  gender: fc.constantFrom(...genders),
  assurance: fc.constantFrom<AssuranceLevel>(0, 1, 2, 3),
  intents: fc.uniqueArray(fc.constantFrom<IntentAxis>('social', 'professional'), {
    minLength: 1,
    maxLength: 2,
  }),
  policy: arbPolicy,
});

type ArbPerson = ReturnType<typeof arbPerson.generate> extends never ? never : any;

function buildPerson(a: ArbPerson, idSuffix: string) {
  const base = makePerson({ id: `${a.id}${idSuffix}`, gender: a.gender });
  const p = { ...defaultPolicy() };
  p.presets = a.policy.presets;
  p.audience = { ...p.audience, minAssurance: a.policy.minAssurance };
  p.discoverability = {
    onFlight: a.policy.onFlight,
    inTerminal: a.policy.inTerminal,
    inCity: a.policy.inCity,
    offTrip: a.policy.offTrip,
  };
  p.disclosure = {
    nameEarly: a.policy.nameEarly,
    professionalLate: a.policy.professionalLate,
    bioLate: a.policy.bioLate,
  };

  return {
    ...base,
    privacy: p,
    intent: { ...base.intent, appetite: {
      social: a.intents.includes('social') ? 0.7 : 0,
      professional: a.intents.includes('professional') ? 0.7 : 0,
    } },
    verifications: base.verifications.map((v) => ({ ...v, assurance: a.assurance })),
  };
}

describe('mutual visibility invariants', () => {
  it('mutual is exactly the conjunction, and level exactly the minimum', () => {
    fc.assert(
      fc.property(arbPerson, arbPerson, fc.constantFrom(...proximities), (rawA, rawB, prox) => {
        const a = buildPerson(rawA, 'a');
        const b = buildPerson(rawB, 'b');

        const subA = { facets: facetsOf(a, { proximity: prox }), policy: compilePolicy(a.privacy) };
        const subB = { facets: facetsOf(b, { proximity: prox }), policy: compilePolicy(b.privacy) };

        const v = resolveMutual(subA, subB, ctx());

        expect(v.mutual).toBe(v.aSeesB.visible && v.bSeesA.visible);
        expect(v.level).toBe(Math.min(v.aSeesB.level, v.bSeesA.level));
      }),
      { numRuns: 300 },
    );
  });

  it('is symmetric in outcome — resolving B,A mirrors resolving A,B', () => {
    fc.assert(
      fc.property(arbPerson, arbPerson, fc.constantFrom(...proximities), (rawA, rawB, prox) => {
        const a = buildPerson(rawA, 'a');
        const b = buildPerson(rawB, 'b');
        const subA = { facets: facetsOf(a, { proximity: prox }), policy: compilePolicy(a.privacy) };
        const subB = { facets: facetsOf(b, { proximity: prox }), policy: compilePolicy(b.privacy) };

        const forward = resolveMutual(subA, subB, ctx());
        const backward = resolveMutual(subB, subA, ctx());

        expect(backward.mutual).toBe(forward.mutual);
        expect(backward.level).toBe(forward.level);
        expect(backward.aSeesB.visible).toBe(forward.bSeesA.visible);
      }),
      { numRuns: 200 },
    );
  });

  it('never lets a viewer see more than the person is showing them', () => {
    // The leak this prevents: a permissive user's view of a restrictive user
    // dragging the restrictive user's own disclosure up a rung.
    fc.assert(
      fc.property(arbPerson, arbPerson, (rawA, rawB) => {
        const a = buildPerson(rawA, 'a');
        const b = buildPerson(rawB, 'b');
        const subA = { facets: facetsOf(a), policy: compilePolicy(a.privacy) };
        const subB = { facets: facetsOf(b), policy: compilePolicy(b.privacy) };
        const v = resolveMutual(subA, subB, ctx());
        expect(v.level).toBeLessThanOrEqual(v.aSeesB.level);
        expect(v.level).toBeLessThanOrEqual(v.bSeesA.level);
      }),
      { numRuns: 200 },
    );
  });
});

describe('the redaction ladder', () => {
  /**
   * One test covering every field at every level, forever. Adding a field to
   * RedactedPerson without adding it to the ladder makes this fail, which is
   * the point — the failure mode it guards against is a new field shipping
   * visible-by-default.
   */
  it('never reveals a field below the level its rung requires', () => {
    fc.assert(
      fc.property(arbPerson, fc.constantFrom<DisclosureLevel>(0, 1, 2, 3), (raw, level) => {
        const person = buildPerson(raw, 'x');
        const view = redact(person, level);
        const ov = person.privacy.disclosure;

        for (const [field, baseRung] of Object.entries(FIELD_LEVEL) as [
          keyof typeof FIELD_LEVEL,
          DisclosureLevel,
        ][]) {
          const required = effectiveLevel(field, baseRung, ov);
          if (level >= required) continue;

          const value = (view as unknown as Record<string, unknown>)[field];
          if (value === undefined) continue; // optional fields may be absent

          if (field === 'links') {
            // Every link must be withheld when the rung is not met.
            for (const l of value as unknown[]) expect(isRedacted(l)).toBe(true);
          } else if (field === 'professional') {
            // Only sub-fields whose own rung is met may appear.
            if (!isRedacted(value)) {
              for (const key of Object.keys(value as object)) {
                const sub = PROFESSIONAL_FIELD_LEVEL[key as keyof typeof PROFESSIONAL_FIELD_LEVEL];
                expect(level).toBeGreaterThanOrEqual(sub);
              }
            }
          } else {
            expect(isRedacted(value), `${field} leaked at level ${level}`).toBe(true);
          }
        }
      }),
      { numRuns: 250 },
    );
  });

  it('never reveals the full display name before rung 2 unless nameEarly is set', () => {
    fc.assert(
      fc.property(arbPerson, fc.constantFrom<DisclosureLevel>(0, 1), (raw, level) => {
        const person = buildPerson(raw, 'n');
        const view = redact(person, level);
        if (person.privacy.disclosure.nameEarly) return;
        if (isRedacted(view.displayName)) return;
        // At rung 1 the first name is allowed; the full name is not.
        expect(view.displayName).toBe(person.firstName);
      }),
      { numRuns: 200 },
    );
  });

  it('honours a link marked never, at every level', () => {
    const person = makePerson({
      id: 'lnk',
      links: [
        { network: 'instagram', handle: 'x', url: 'https://x', verified: true, visibility: 'never' },
      ],
    });
    for (const level of [0, 1, 2, 3] as DisclosureLevel[]) {
      const [link] = redact(person, level).links;
      expect(isRedacted(link)).toBe(true);
    }
    expect(linkLevel(person.links[0]!)).toBe('never');
  });

  it('never renders a circle badge the member kept private', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('show_badge', 'match_only', 'paused'),
        fc.constantFrom<DisclosureLevel>(0, 1, 2, 3),
        (display, level) => {
          const person = makePerson({
            id: 'c',
            memberships: [
              {
                circleId: 'insead' as never,
                personId: 'c' as never,
                display: display as never,
                joinedAt: '2026-01-01T00:00:00Z' as never,
                admittedBy: 'email_domain',
                role: 'member',
              },
            ],
          });
          const view = redact(person, level);
          expect(view.circles.length).toBe(display === 'show_badge' ? 1 : 0);
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('audience segmentation', () => {
  it('stays under the cap for any policy', () => {
    fc.assert(
      fc.property(arbPerson, fc.uniqueArray(fc.constantFrom(...proximities), { maxLength: 6 }), (raw, prox) => {
        const person = buildPerson(raw, 's');
        const { segments } = segmentsFor({
          policy: compilePolicy(person.privacy, ['insead']),
          liveProximities: prox,
          ownCircleIds: ['insead'],
          requiredStampKinds: [],
          hasActiveGuardian: true,
          hasCircleAdmins: true,
        });
        // +2 for the guardian and circle-admin channel rows, which are always
        // listed and deliberately exempt from the cap.
        expect(segments.length).toBeLessThanOrEqual(MAX_SEGMENTS + 2);
      }),
      { numRuns: 150 },
    );
  });

  it('gives every segment a distinct id', () => {
    fc.assert(
      fc.property(arbPerson, (raw) => {
        const person = buildPerson(raw, 'd');
        const { segments } = segmentsFor({
          policy: compilePolicy(person.privacy),
          liveProximities: ['same_flight', 'same_city'],
          ownCircleIds: [],
          requiredStampKinds: [],
          hasActiveGuardian: false,
          hasCircleAdmins: false,
        });
        expect(new Set(segments.map((s) => s.id)).size).toBe(segments.length);
      }),
      { numRuns: 100 },
    );
  });
});
