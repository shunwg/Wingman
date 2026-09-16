import { describe, expect, it } from 'vitest';
import { asPersonId, asRideId, asTripId, asIata } from '@domain/ids';
import { ANYONE, makeRide, type Ride, type RideClaim } from '@domain/ride';
import type { ISODateTime } from '@domain/time';
import {
  CLAIM_TRANSITIONS,
  IllegalSeatTransitionError,
  RIDE_TRANSITIONS,
  claimantView,
  expireClaimIfDue,
  revokeClaimByPolicy,
  transitionClaim,
  transitionRide,
} from './rideSeat';

const t = (s: string) => s as ISODateTime;
const now = t('2026-09-16T10:00:00Z');

const ride = (): Ride =>
  makeRide({
    id: asRideId('r1'),
    hostPersonId: asPersonId('you'),
    tripId: asTripId('t1'),
    direction: 'from_airport',
    airportIata: asIata('CDG'),
    point: { lat: 48.4084, lon: 2.7019, label: 'Fontainebleau' },
    window: { from: t('2026-09-19T14:00:00Z'), to: t('2026-09-19T15:00:00Z') },
    seatsTotal: 4,
    audience: { kind: 'open', rules: ANYONE },
    createdAt: t('2026-09-16T09:00:00Z'),
  });

const claim = (): RideClaim => ({
  personId: asPersonId('amelie'),
  status: 'requested',
  askedAt: now,
  history: [],
});

describe('the seat machine', () => {
  it('confirms a requested seat and appends exactly one event', () => {
    const c = transitionClaim(claim(), { to: 'confirmed', by: asPersonId('you'), at: now });
    expect(c.status).toBe('confirmed');
    expect(c.history).toHaveLength(1);
    expect(c.history[0]).toMatchObject({ from: 'requested', to: 'confirmed', by: 'you', at: now });
  });

  it('throws rather than writing an illegal status', () => {
    const confirmed = transitionClaim(claim(), { to: 'confirmed', by: asPersonId('you'), at: now });
    expect(() => transitionClaim(confirmed, { to: 'requested', by: asPersonId('amelie'), at: now })).toThrow(
      IllegalSeatTransitionError,
    );
    const declined = transitionClaim(claim(), { to: 'declined', by: asPersonId('you'), at: now });
    expect(() => transitionClaim(declined, { to: 'confirmed', by: asPersonId('you'), at: now })).toThrow(
      /Illegal seat transition/,
    );
  });

  it('lets a confirmed passenger pull out, because a car is not a commitment device', () => {
    const confirmed = transitionClaim(claim(), { to: 'confirmed', by: asPersonId('you'), at: now });
    const out = transitionClaim(confirmed, { to: 'withdrawn', by: asPersonId('amelie'), at: now });
    expect(out.status).toBe('withdrawn');
    expect(out.history).toHaveLength(2);
  });

  it('treats declined, withdrawn, expired and revoked as terminal', () => {
    for (const s of ['declined', 'withdrawn', 'expired', 'revoked_by_policy'] as const) {
      expect(CLAIM_TRANSITIONS[s]).toEqual([]);
    }
  });

  it('expires a claim once the pickup window has closed, and is idempotent', () => {
    const c = claim();
    const first = expireClaimIfDue(c, ride(), t('2026-09-19T15:00:01Z'));
    expect(first.status).toBe('expired');
    expect(expireClaimIfDue(first, ride(), t('2026-09-20T00:00:00Z'))).toBe(first);
  });

  it('leaves a claim alone while the window is still open', () => {
    const c = claim();
    expect(expireClaimIfDue(c, ride(), now)).toBe(c);
  });

  it('revokes a live claim when visibility changes underneath it', () => {
    const c = revokeClaimByPolicy(claim(), now);
    expect(c.status).toBe('revoked_by_policy');
  });
});

describe('what the claimant is told', () => {
  it('collapses every closed outcome into one neutral word', () => {
    expect(claimantView('requested')).toBe('pending');
    expect(claimantView('confirmed')).toBe('confirmed');
    for (const s of ['declined', 'withdrawn', 'expired', 'revoked_by_policy'] as const) {
      expect(claimantView(s)).toBe('closed');
    }
  });
});

describe('the ride machine', () => {
  it('moves a ride through its life', () => {
    const r = transitionRide(ride(), { to: 'confirmed', by: asPersonId('you'), at: now });
    expect(r.status).toBe('confirmed');
    expect(r.history).toHaveLength(1);
    const gone = transitionRide(r, { to: 'departed', by: 'system', at: now });
    expect(transitionRide(gone, { to: 'completed', by: 'system', at: now }).status).toBe('completed');
  });

  it('can be cancelled from anywhere it has not already finished', () => {
    for (const s of ['open', 'confirmed', 'departed'] as const) {
      expect(RIDE_TRANSITIONS[s]).toContain('cancelled');
    }
    expect(RIDE_TRANSITIONS.completed).toEqual([]);
    expect(RIDE_TRANSITIONS.cancelled).toEqual([]);
  });

  it('refuses to un-cancel or un-complete a ride', () => {
    const cancelled = transitionRide(ride(), { to: 'cancelled', by: asPersonId('you'), at: now });
    expect(() => transitionRide(cancelled, { to: 'open', by: asPersonId('you'), at: now })).toThrow(
      /Illegal ride transition/,
    );
  });
});
