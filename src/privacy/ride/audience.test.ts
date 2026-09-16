import { describe, expect, it } from 'vitest';
import { asCircleId, asPersonId } from '@domain/ids';
import { anyAudience, type RideAudience } from '@domain/index';
import type { ISODateTime } from '@domain/time';
import { compilePolicy } from '../compile';
import { defaultPolicy } from '../presets';
import type { PersonFacets } from '../types';
import { evaluateRideAudience } from './audience';

const now = '2026-09-16T10:00:00Z' as ISODateTime;
const hostPolicy = compilePolicy(defaultPolicy(), []);

function facets(patch: Partial<PersonFacets> = {}): PersonFacets {
  return {
    id: asPersonId('viewer'),
    gender: 'man',
    assurance: 0,
    stampKinds: [],
    circleIds: [],
    intents: ['social', 'professional'],
    blocked: [],
    proximity: 'same_city',
    channel: 'app',
    onTrip: true,
    ...patch,
  };
}

const host = facets({ id: asPersonId('you'), gender: 'woman' });

const verdict = (audience: RideAudience, viewer: PersonFacets, holdsInviteCode?: boolean) =>
  evaluateRideAudience({
    audience,
    viewer,
    host,
    hostPolicy,
    now,
    ...(holdsInviteCode === undefined ? {} : { holdsInviteCode }),
  });

describe('an open car', () => {
  const open: RideAudience = { kind: 'open', rules: anyAudience() };

  it('admits anyone when nothing is filtered', () => {
    expect(verdict(open, facets()).visible).toBe(true);
  });

  it('makes the host confirm the seat rather than seating a stranger', () => {
    expect(verdict(open, facets()).seatsAutomatically).toBe(false);
  });

  it('denies someone the host has blocked, and someone who blocked the host', () => {
    expect(verdict(open, facets({ blocked: [asPersonId('you')] })).visible).toBe(false);
    const blockedByHost: RideAudience = { kind: 'open', rules: anyAudience() };
    const v = evaluateRideAudience({
      audience: blockedByHost,
      viewer: facets(),
      host: { ...host, blocked: [asPersonId('viewer')] },
      hostPolicy,
      now,
    });
    expect(v.visible).toBe(false);
    expect(v.deniedBy).toContain('block.either');
  });
});

describe('a women-only car', () => {
  const womenOnly: RideAudience = { kind: 'open', rules: { ...anyAudience(), genders: ['woman'] } };

  it('denies a man, naming the gender rule', () => {
    const v = verdict(womenOnly, facets({ gender: 'man' }));
    expect(v.visible).toBe(false);
    expect(v.deniedBy).toContain('gender.audience');
  });

  it('admits a woman', () => {
    expect(verdict(womenOnly, facets({ gender: 'woman' })).visible).toBe(true);
  });

  it('still shows the car to its own host, whatever her filter says', () => {
    const maleHost = { ...host, gender: 'man' as const };
    const v = evaluateRideAudience({ audience: womenOnly, viewer: maleHost, host: maleHost, hostPolicy, now });
    expect(v.visible).toBe(true);
  });
});

describe('a verified-only car', () => {
  const verifiedOnly: RideAudience = { kind: 'open', rules: { ...anyAudience(), minAssurance: 2 } };

  it('denies an unverified viewer and admits a verified one', () => {
    expect(verdict(verifiedOnly, facets({ assurance: 0 })).visible).toBe(false);
    expect(verdict(verifiedOnly, facets({ assurance: 3 })).visible).toBe(true);
  });
});

describe('a circle car', () => {
  const insead = asCircleId('insead');
  const circleCar: RideAudience = { kind: 'circles', circleIds: [insead] };

  it('admits a member and seats them without asking the host', () => {
    const v = verdict(circleCar, facets({ circleIds: [insead] }));
    expect(v.visible).toBe(true);
    expect(v.seatsAutomatically).toBe(true);
  });

  it('denies a non-member', () => {
    const v = verdict(circleCar, facets({ circleIds: [asCircleId('other')] }));
    expect(v.visible).toBe(false);
    expect(v.deniedBy).toContain('circle.scope');
  });

  it('admits NOBODY when the circle list is empty — never everyone', () => {
    // makeRide() refuses to build this, so it can only arrive from persisted
    // state or a migration. f64b42d was exactly this bug at profile level:
    // circles-only with zero circles made someone visible to everyone.
    const empty: RideAudience = { kind: 'circles', circleIds: [] };
    expect(verdict(empty, facets()).visible).toBe(false);
    expect(verdict(empty, facets({ circleIds: [insead] })).visible).toBe(false);
  });

  it('can also be women-only, and then a man in the circle is still denied', () => {
    const womenInCircle: RideAudience = {
      kind: 'circles',
      circleIds: [insead],
      rules: { ...anyAudience(), genders: ['woman'] },
    };
    expect(verdict(womenInCircle, facets({ circleIds: [insead], gender: 'man' })).visible).toBe(false);
    expect(verdict(womenInCircle, facets({ circleIds: [insead], gender: 'woman' })).visible).toBe(true);
  });
});

describe('a link-only car', () => {
  const linkCar: RideAudience = { kind: 'invite' };

  it('is invisible without the link', () => {
    const v = verdict(linkCar, facets(), false);
    expect(v.visible).toBe(false);
    expect(v.deniedBy).toContain('ride.invite');
  });

  it('opens to whoever holds the link, and seats them', () => {
    const v = verdict(linkCar, facets(), true);
    expect(v.visible).toBe(true);
    expect(v.seatsAutomatically).toBe(true);
  });

  it('does not treat a missing flag as holding the link', () => {
    expect(verdict(linkCar, facets()).visible).toBe(false);
  });
});

describe('the reasons given', () => {
  it('never name another person', () => {
    const womenOnly: RideAudience = { kind: 'open', rules: { ...anyAudience(), genders: ['woman'] } };
    const v = verdict(womenOnly, facets({ gender: 'man' }));
    expect(v.reasons.length).toBeGreaterThan(0);
    for (const r of v.reasons) {
      expect(r.text).not.toContain('you');
      expect(r.text.toLowerCase()).not.toContain('amélie');
      expect(r.text).toMatch(/\S/);
    }
  });

  it('collects every reason rather than stopping at the first', () => {
    const strict: RideAudience = {
      kind: 'open',
      rules: { ...anyAudience(), genders: ['woman'], minAssurance: 3 },
    };
    const v = verdict(strict, facets({ gender: 'man', assurance: 0 }));
    expect(v.deniedBy).toEqual(expect.arrayContaining(['gender.audience', 'assurance.floor']));
  });
});
