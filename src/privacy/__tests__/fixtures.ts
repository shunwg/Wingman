import type {
  AssuranceLevel,
  Gender,
  ISODateTime,
  Person,
  PersonId,
  PrivacyPolicy,
  ProximityClass,
  StampKind,
  VerificationRecord,
} from '@domain/index';
import { asPersonId, asVerificationId, asUtc } from '@domain/index';
import { compilePolicy } from '../compile';
import { defaultPolicy } from '../presets';
import type { PersonFacets, PolicySubject } from '../types';

export const NOW = asUtc('2026-08-16T12:00:00Z');

export function makeVerification(
  personId: PersonId,
  kind: StampKind,
  assurance: AssuranceLevel,
  providerId = 'test',
): VerificationRecord {
  return {
    id: asVerificationId(`v_${personId}_${kind}`),
    personId,
    providerId,
    kind,
    assurance,
    verifiedAt: asUtc('2026-01-01T00:00:00Z'),
  };
}

export function makePerson(overrides: Partial<Omit<Person, 'id'>> & { id: string }): Person {
  const id = asPersonId(overrides.id);
  return {
    displayName: 'Ada Lovelace',
    firstName: 'Ada',
    gender: 'woman',
    headline: 'Grid engineer, mostly airports lately',
    bio: 'Long-haul regular. Good coffee, better arguments.',
    avatar: {
      seed: overrides.id,
      variant: 'portrait',
      palette: {
        bgFrom: '#000',
        bgTo: '#111',
        bgAngle: 0,
        skin: '#c8a',
        hair: '#321',
        garment: '#123',
        rim: '#fff',
        onBg: '#fff',
      },
      features: { face: 0, hair: 0, garment: 0, background: 0, offsetX: 0, offsetY: 0, scale: 1 },
      initial: 'A',
      grain: 0.05,
    },
    professional: {
      title: 'Principal engineer',
      company: 'Northwind Grid',
      industry: 'Energy',
      workingOn: 'Interconnector capacity models',
      lookingFor: ['a plant engineer to hire'],
    },
    intent: {
      appetite: { social: 0.6, professional: 0.8 },
      openTo: ['gate_coffee', 'meal', 'business_intro'],
      topics: ['energy', 'cities'],
      languages: ['en', 'no'],
    },
    links: [
      {
        network: 'linkedin',
        handle: 'adalovelace',
        url: 'https://linkedin.com/in/adalovelace',
        verified: true,
        visibility: 'on_accept',
      },
      {
        network: 'instagram',
        handle: 'ada.jpg',
        url: 'https://instagram.com/ada.jpg',
        verified: true,
        visibility: 'on_meet',
      },
    ],
    verifications: [makeVerification(id, 'social_account', 1, 'linkedin')],
    memberships: [],
    privacy: defaultPolicy(),
    reputation: { reliability: 'reliable', meetsCompleted: 12, hasEnoughSignal: true },
    blocked: [],
    createdAt: asUtc('2026-01-01T00:00:00Z'),
    ...overrides,
    id,
  };
}

export function facetsOf(
  person: Person,
  opts: { proximity?: ProximityClass; onTrip?: boolean; circleIds?: string[] } = {},
): PersonFacets {
  const assurance = person.verifications
    .filter((v) => !v.revokedAt)
    .reduce<AssuranceLevel>((m, v) => (v.assurance > m ? v.assurance : m), 0);

  return {
    id: person.id,
    gender: person.gender,
    assurance,
    stampKinds: person.verifications.filter((v) => !v.revokedAt).map((v) => v.kind),
    circleIds: (opts.circleIds ?? []) as PersonFacets['circleIds'],
    intents: (Object.entries(person.intent.appetite) as ['social' | 'professional', number][])
      .filter(([, v]) => v > 0)
      .map(([k]) => k),
    blocked: person.blocked,
    proximity: opts.proximity ?? 'same_city',
    channel: 'app',
    onTrip: opts.onTrip ?? true,
  };
}

export function subjectOf(
  person: Person,
  opts: { proximity?: ProximityClass; onTrip?: boolean; circleIds?: string[] } = {},
): PolicySubject {
  return {
    facets: facetsOf(person, opts),
    policy: compilePolicy(person.privacy, opts.circleIds ?? []),
  };
}

export function withPolicy(person: Person, patch: Partial<PrivacyPolicy>): Person {
  return { ...person, privacy: { ...person.privacy, ...patch } };
}

export const ctx = (now: ISODateTime = NOW) => ({ now });

/** A woman, unverified, open to both axes. */
export const woman = () => makePerson({ id: 'w1', gender: 'woman', displayName: 'Ada Lovelace' });

/** A man, unverified. */
export const man = () =>
  makePerson({ id: 'm1', gender: 'man', displayName: 'Alan Turing', firstName: 'Alan' });

/** Someone with a government eID — the top of the assurance ladder. */
export function idVerified(id: string, gender: Gender = 'woman'): Person {
  const p = makePerson({ id, gender });
  return {
    ...p,
    verifications: [
      makeVerification(p.id, 'social_account', 1, 'linkedin'),
      makeVerification(p.id, 'government_eid', 3, 'bankid_no'),
    ],
  };
}
