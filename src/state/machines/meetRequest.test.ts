import { describe, expect, it } from 'vitest';
import type { MeetRequest, MeetRequestStatus } from '@domain/index';
import { asMeetRequestId, asPersonId, asUtc } from '@domain/index';
import {
  IllegalTransitionError,
  TRANSITIONS,
  canTransition,
  expireIfDue,
  isTerminal,
  revokeByPolicy,
  senderView,
  transition,
} from './meetRequest';

const NOW = asUtc('2026-09-01T12:00:00Z');
const ALL = Object.keys(TRANSITIONS) as MeetRequestStatus[];

const req = (status: MeetRequestStatus = 'sent'): MeetRequest => ({
  id: asMeetRequestId('r1'),
  fromPersonId: asPersonId('a'),
  toPersonId: asPersonId('b'),
  overlapRef: { kind: 'same_flight' },
  proposal: {
    kind: 'gate_coffee',
    window: { from: NOW, to: asUtc('2026-09-01T13:00:00Z') },
  },
  message: 'Same flight — coffee before boarding?',
  status,
  history: [],
  createdAt: NOW,
  expiresAt: asUtc('2026-09-01T18:00:00Z'),
});

describe('the transition table', () => {
  it('allows a decline after a request has been sent', () => {
    // The requirement this machine exists for.
    expect(canTransition('sent', 'denied')).toBe(true);
    expect(canTransition('viewed', 'denied')).toBe(true);
    expect(canTransition('countered', 'denied')).toBe(true);
  });

  it('refuses to un-accept', () => {
    // Cancelling an agreed meet belongs to the Meet machine. Reopening the
    // request would let someone un-agree without the other side being told.
    expect(canTransition('accepted', 'denied')).toBe(false);
    expect(isTerminal('accepted')).toBe(true);
  });

  it('makes every refusal state terminal', () => {
    for (const s of ['denied', 'withdrawn', 'expired', 'revoked_by_policy'] as const) {
      expect(isTerminal(s), `${s} should be terminal`).toBe(true);
    }
  });

  it('never lets a status transition to itself', () => {
    for (const s of ALL) expect(canTransition(s, s)).toBe(false);
  });

  it('throws on an illegal move rather than writing a bad status', () => {
    expect(() => transition(req('accepted'), { to: 'denied', by: asPersonId('b'), at: NOW })).toThrow(
      IllegalTransitionError,
    );
    expect(() => transition(req('draft'), { to: 'accepted', by: asPersonId('b'), at: NOW })).toThrow();
  });
});

describe('applying a transition', () => {
  it('appends to history and never mutates', () => {
    const before = req('sent');
    const after = transition(before, { to: 'viewed', by: asPersonId('b'), at: NOW });

    expect(after.status).toBe('viewed');
    expect(after.history).toHaveLength(1);
    expect(after.history[0]).toMatchObject({ from: 'sent', to: 'viewed', by: 'b' });
    // The original is untouched.
    expect(before.status).toBe('sent');
    expect(before.history).toHaveLength(0);
  });

  it('records the denial alongside the transition', () => {
    const denied = transition(req('viewed'), {
      to: 'denied',
      by: asPersonId('b'),
      at: NOW,
      denial: { at: NOW, reason: 'uncomfortable', alsoBlock: true, alsoReport: false },
    });
    expect(denied.denial?.reason).toBe('uncomfortable');
    expect(denied.status).toBe('denied');
  });

  it('keeps history as the source of truth for a whole lifecycle', () => {
    let r = req('draft');
    r = transition(r, { to: 'sent', by: asPersonId('a'), at: NOW });
    r = transition(r, { to: 'viewed', by: asPersonId('b'), at: NOW });
    r = transition(r, { to: 'accepted', by: asPersonId('b'), at: NOW });

    expect(r.history.map((e) => e.to)).toEqual(['sent', 'viewed', 'accepted']);
    expect(r.history[r.history.length - 1]!.to).toBe(r.status);
  });
});

describe('expiry and revocation', () => {
  it('expires once the travel window has closed', () => {
    const late = asUtc('2026-09-02T00:00:00Z');
    expect(expireIfDue(req('sent'), late).status).toBe('expired');
  });

  it('leaves a live request alone, and is idempotent on a dead one', () => {
    expect(expireIfDue(req('sent'), NOW).status).toBe('sent');
    const dead = req('denied');
    expect(expireIfDue(dead, asUtc('2027-01-01T00:00:00Z'))).toBe(dead);
  });

  it('kills an open request when visibility changes underneath it', () => {
    // Someone turns on women-only, or a stamp lapses. An invitation created
    // under conditions that no longer hold must not stay open.
    expect(revokeByPolicy(req('sent'), NOW).status).toBe('revoked_by_policy');
    expect(revokeByPolicy(req('accepted'), NOW).status).toBe('accepted');
  });
});

describe('what the sender is allowed to learn', () => {
  it('collapses every refusal into one indistinguishable outcome', () => {
    // Denied, withdrawn, expired and revoked must look identical to the sender.
    // Anything else turns a decline into a negotiation.
    const closed = (['denied', 'withdrawn', 'expired', 'revoked_by_policy'] as const).map(senderView);
    expect(new Set(closed)).toEqual(new Set(['closed']));
  });

  it('does not reveal that a request was read', () => {
    expect(senderView('viewed')).toBe(senderView('sent'));
  });

  it('still tells the sender about a yes', () => {
    expect(senderView('accepted')).toBe('accepted');
  });

  it('covers every status', () => {
    for (const s of ALL) expect(senderView(s)).toBeDefined();
  });
});
