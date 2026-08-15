import { describe, expect, it } from 'vitest';
import { asGuardianSessionId, asMeetId, asPersonId, asUtc } from '@domain/index';
import { addMinutes } from '@domain/time';
import {
  addPing,
  armGuardian,
  declineGuardian,
  endGuardian,
  escalateGuardian,
  guardianView,
  isLive,
  tickGuardian,
  GRACE_MINUTES,
  PING_RETENTION_MINUTES,
  MAX_PINGS,
} from '../guardian/session';
import { GUARDIAN_PRESETS, describeScope } from '../guardian/scope';

const T = (s: string) => asUtc(s);
const START = T('2026-08-16T18:00:00Z');
const END = T('2026-08-16T20:00:00Z');

const arm = (presetId: 'full' | 'balanced' | 'minimal' = 'balanced') =>
  armGuardian({
    id: asGuardianSessionId('g1'),
    meetId: asMeetId('m1'),
    travellerId: asPersonId('p1'),
    guardian: { label: 'Mum', channel: 'link' },
    scope: GUARDIAN_PRESETS[presetId].build(END),
    meetWindow: { from: START, to: END },
    shareToken: 'tok_abc',
    now: T('2026-08-16T17:00:00Z'),
  });

const viewCtx = {
  travellerFirstName: 'Ada',
  counterpartFirstName: 'Jonas',
  counterpartAvatarSeed: 'jonas',
  placeLabel: 'Gate C12 — the window bench',
  meetWindow: { from: START, to: END },
};

describe('guardian session lifecycle', () => {
  it('arms with a hard expiry past the meet window', () => {
    const s = arm();
    expect(s.status).toBe('armed');
    expect(s.endsAt).toBe(addMinutes(END, GRACE_MINUTES));
  });

  it('goes active once the meet starts', () => {
    expect(tickGuardian(arm(), T('2026-08-16T18:01:00Z')).status).toBe('active');
  });

  it('stays armed before the start', () => {
    expect(tickGuardian(arm(), T('2026-08-16T17:30:00Z')).status).toBe('armed');
  });

  it('ends itself after the grace period when the traveller checked out', () => {
    const after = addMinutes(END, GRACE_MINUTES + 1);
    expect(tickGuardian(arm(), after, { checkedOut: true }).status).toBe('ended');
  });

  it('escalates when nobody checked out by the deadline', () => {
    const s = tickGuardian(arm(), addMinutes(END, 31), { checkedOut: false });
    expect(s.status).toBe('escalated');
    expect(s.escalation?.trigger).toBe('no_check_out');
  });

  it('does not escalate when the traveller checked out', () => {
    expect(tickGuardian(arm(), addMinutes(END, 31), { checkedOut: true }).status).not.toBe(
      'escalated',
    );
  });

  it('lets the traveller raise an alarm directly', () => {
    const s = escalateGuardian(tickGuardian(arm(), T('2026-08-16T18:30:00Z')), T('2026-08-16T18:31:00Z'));
    expect(s.status).toBe('escalated');
    expect(s.escalation?.trigger).toBe('manual');
  });
});

describe('the token dies with the session', () => {
  it('resolves while live', () => {
    const s = tickGuardian(arm(), T('2026-08-16T18:30:00Z'));
    expect(guardianView(s, 'tok_abc', T('2026-08-16T18:30:00Z'), viewCtx)).not.toBeNull();
  });

  it('refuses a wrong token', () => {
    const s = tickGuardian(arm(), T('2026-08-16T18:30:00Z'));
    expect(guardianView(s, 'tok_wrong', T('2026-08-16T18:30:00Z'), viewCtx)).toBeNull();
  });

  it('refuses after expiry — an old link cannot be replayed', () => {
    const s = tickGuardian(arm(), T('2026-08-16T18:30:00Z'));
    const later = addMinutes(END, GRACE_MINUTES + 5);
    expect(isLive(s, later)).toBe(false);
    expect(guardianView(s, 'tok_abc', later, viewCtx)).toBeNull();
  });

  it('refuses once declined', () => {
    const s = declineGuardian(arm());
    expect(guardianView(s, 'tok_abc', T('2026-08-16T18:30:00Z'), viewCtx)).toBeNull();
  });
});

describe('scope is actually enforced', () => {
  const at = T('2026-08-16T18:30:00Z');
  const live = (preset: 'full' | 'balanced' | 'minimal') => {
    let s = tickGuardian(arm(preset), at);
    s = addPing(s, { at, lat: 1.35, lon: 103.99, accuracyM: 12 }, at);
    return s;
  };

  it('"just check on me" shares no location, place, or counterpart', () => {
    const v = guardianView(live('minimal'), 'tok_abc', at, viewCtx)!;
    expect(v.lastPing).toBeUndefined();
    expect(v.placeLabel).toBeUndefined();
    expect(v.counterpart).toBeUndefined();
    expect(v.travellerFirstName).toBe('Ada');
  });

  it('"where and when" shares location and place but only a first name', () => {
    const v = guardianView(live('balanced'), 'tok_abc', at, viewCtx)!;
    expect(v.lastPing).toBeDefined();
    expect(v.placeLabel).toContain('Gate C12');
    expect(v.counterpart?.firstName).toBe('Jonas');
    expect(v.counterpart?.avatarSeed).toBeUndefined();
  });

  it('"everything" shares the counterpart photo too', () => {
    const v = guardianView(live('full'), 'tok_abc', at, viewCtx)!;
    expect(v.counterpart?.avatarSeed).toBe('jonas');
  });

  it('refuses pings when the scope excludes location', () => {
    const s = addPing(tickGuardian(arm('minimal'), at), { at, lat: 1, lon: 2, accuracyM: 5 }, at);
    expect(s.pings).toHaveLength(0);
  });

  it('refuses pings once the session is over', () => {
    const dead = addMinutes(END, GRACE_MINUTES + 10);
    const s = addPing(tickGuardian(arm(), at), { at: dead, lat: 1, lon: 2, accuracyM: 5 }, dead);
    expect(s.pings).toHaveLength(0);
  });

  it('keeps only a recent trail, not a history', () => {
    let s = tickGuardian(arm(), at);
    for (let i = 0; i < MAX_PINGS + 20; i++) {
      s = addPing(s, { at, lat: i, lon: 0, accuracyM: 5 }, at);
    }
    expect(s.pings).toHaveLength(MAX_PINGS);
  });
});

describe('location history is purged', () => {
  it('drops pings once retention has passed', () => {
    const at = T('2026-08-16T18:30:00Z');
    let s = addPing(tickGuardian(arm(), at), { at, lat: 1, lon: 2, accuracyM: 5 }, at);
    expect(s.pings).toHaveLength(1);

    const wayLater = addMinutes(END, GRACE_MINUTES + PING_RETENTION_MINUTES + 1);
    s = endGuardian(s, wayLater);
    expect(s.status).toBe('ended');
    expect(s.pings).toHaveLength(0);
  });
});

describe('scope descriptions', () => {
  it('tells the traveller exactly what is shared', () => {
    const lines = describeScope(GUARDIAN_PRESETS.minimal.build(END));
    expect(lines.join(' ')).toMatch(/not your location/i);
    expect(lines.join(' ')).toMatch(/nothing about the other person/i);
  });
});
