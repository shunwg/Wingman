import { describe, expect, it } from 'vitest';
import { asChannelId, asIata, asMeetRequestId, asMessageId, asPersonId, asRideId, asTripId } from './ids';
import type { ISODateTime } from './time';
import type { Message, MessageBody } from './channel';
import { makeRide, type Ride } from './ride';
import { anyAudience } from './privacy';
import {
  agreedPlan,
  canAgree,
  canCallOff,
  meetForRide,
  meetFromPlan,
  meetIdForChannel,
  meetIdForRequest,
  meetIdForRide,
  planPlace,
} from './plan';

const t = (s: string) => s as ISODateTime;
const room = asChannelId('meet:q1');
const you = asPersonId('you');
const priya = asPersonId('priya');

let n = 0;
const msg = (from: string, at: string, body: MessageBody, id?: string): Message => ({
  id: asMessageId(id ?? `m${++n}`),
  channelId: room,
  from: asPersonId(from),
  at: t(at),
  body,
});

const proposal = (from: string, startsAt: string, id: string, placeKind?: 'gate' | 'cafe') =>
  msg(
    from,
    '2026-09-02T12:00:00Z',
    {
      kind: 'proposal',
      meetKind: 'gate_coffee',
      window: { from: t(startsAt), to: t(startsAt.replace(':00:00', ':30:00')) },
      placeLabel: 'Gate B8',
      ...(placeKind ? { placeKind } : {}),
    },
    id,
  );
const agree = (from: string, proposalId: string, at = '2026-09-02T12:05:00Z') =>
  msg(from, at, { kind: 'agreed', proposalId: asMessageId(proposalId) });
const callOff = (from: string, proposalId: string) =>
  msg(from, '2026-09-02T12:10:00Z', { kind: 'plan_off', proposalId: asMessageId(proposalId) });

describe('canAgree — the one set of rules the write path and the read path share', () => {
  const p1 = proposal('priya', '2026-09-02T17:00:00Z', 'p1');

  it('lets the other person agree to a future suggestion', () => {
    expect(canAgree([p1], 'p1', you, t('2026-09-02T12:05:00Z'))).toBeNull();
  });

  it('refuses your own suggestion — proposing is already your half of the yes', () => {
    expect(canAgree([p1], 'p1', priya, t('2026-09-02T12:05:00Z'))).toBe('own');
  });

  it('refuses a time that has already started', () => {
    expect(canAgree([p1], 'p1', you, t('2026-09-02T17:00:00Z'))).toBe('past');
  });

  it('refuses something that is not a proposal, or not there at all', () => {
    const text = msg('priya', '2026-09-02T12:00:00Z', { kind: 'text', text: 'hi' }, 'x1');
    expect(canAgree([text], 'x1', you, t('2026-09-02T12:05:00Z'))).toBe('not_a_proposal');
    expect(canAgree([p1], 'nope', you, t('2026-09-02T12:05:00Z'))).toBe('not_a_proposal');
  });

  it('refuses an offer a newer suggestion has replaced, from either side', () => {
    const p2 = proposal('you', '2026-09-02T17:30:00Z', 'p2');
    expect(canAgree([p1, p2], 'p1', you, t('2026-09-02T12:05:00Z'))).toBe('superseded');
  });

  it('refuses agreeing twice to the plan that already stands', () => {
    expect(canAgree([p1, agree('you', 'p1')], 'p1', you, t('2026-09-02T12:06:00Z'))).toBe('already');
  });
});

describe('agreedPlan — the plan is the log', () => {
  it('has no plan until someone agrees', () => {
    expect(agreedPlan([proposal('priya', '2026-09-02T17:00:00Z', 'p1')])).toBeNull();
  });

  it('is the proposal the other person agreed to', () => {
    const plan = agreedPlan([proposal('priya', '2026-09-02T17:00:00Z', 'p1'), agree('you', 'p1')]);
    expect(String(plan?.proposal.id)).toBe('p1');
    expect(String(plan?.agreedBy)).toBe('you');
  });

  it('does not move when someone merely suggests another time', () => {
    const plan = agreedPlan([
      proposal('priya', '2026-09-02T17:00:00Z', 'p1'),
      agree('you', 'p1'),
      proposal('priya', '2026-09-02T17:30:00Z', 'p2'),
    ]);
    expect(String(plan?.proposal.id)).toBe('p1');
  });

  it('moves only once the new suggestion is agreed too', () => {
    const plan = agreedPlan([
      proposal('priya', '2026-09-02T17:00:00Z', 'p1'),
      agree('you', 'p1'),
      proposal('you', '2026-09-02T17:30:00Z', 'p2'),
      agree('priya', 'p2'),
    ]);
    expect(String(plan?.proposal.id)).toBe('p2');
    expect(String(plan?.agreedBy)).toBe('priya');
  });

  it('is cleared by calling it off, and can be agreed again afterwards', () => {
    const off = [proposal('priya', '2026-09-02T17:00:00Z', 'p1'), agree('you', 'p1'), callOff('priya', 'p1')];
    expect(agreedPlan(off)).toBeNull();
    const again = [...off, proposal('priya', '2026-09-02T18:00:00Z', 'p3'), agree('you', 'p3')];
    expect(String(agreedPlan(again)?.proposal.id)).toBe('p3');
  });

  it('ignores an agreement the write path would have refused — a replayed log cannot mint a plan', () => {
    expect(agreedPlan([proposal('priya', '2026-09-02T17:00:00Z', 'p1'), agree('priya', 'p1')])).toBeNull();
    expect(
      agreedPlan([proposal('priya', '2026-09-02T17:00:00Z', 'p1'), agree('you', 'p1', '2026-09-02T17:05:00Z')]),
    ).toBeNull();
  });

  it('ignores a call-off that names a different proposal', () => {
    const plan = agreedPlan([
      proposal('priya', '2026-09-02T17:00:00Z', 'p1'),
      agree('you', 'p1'),
      callOff('priya', 'p0'),
    ]);
    expect(String(plan?.proposal.id)).toBe('p1');
  });
});

describe('what the bad-actor round found', () => {
  it('a suggestion that was called off stays off — one person cannot put back what the other took down', () => {
    const log = [proposal('priya', '2026-09-02T17:00:00Z', 'p1'), agree('you', 'p1'), callOff('priya', 'p1')];
    expect(canAgree(log, 'p1', you, t('2026-09-02T12:20:00Z'))).toBe('called_off');
    expect(agreedPlan([...log, agree('you', 'p1', '2026-09-02T12:20:00Z')])).toBeNull();
  });

  it('only the people the room belongs to can agree or call off', () => {
    const members = [you, priya];
    const stranger = asPersonId('mallory');
    const log = [proposal('priya', '2026-09-02T17:00:00Z', 'p1'), agree('mallory', 'p1')];
    expect(agreedPlan(log, members)).toBeNull();
    expect(canAgree([proposal('priya', '2026-09-02T17:00:00Z', 'p1')], 'p1', stranger, t('2026-09-02T12:05:00Z'), members)).toBe('not_in_room');
    const agreed = [proposal('priya', '2026-09-02T17:00:00Z', 'p1'), agree('you', 'p1'), callOff('mallory', 'p1')];
    expect(String(agreedPlan(agreed, members)?.proposal.id)).toBe('p1');
  });
});

describe('what the second bad-actor round found', () => {
  it('ignores a yes dated before the suggestion it answers', () => {
    const p1 = { ...proposal('priya', '2026-09-02T17:00:00Z', 'p1'), at: t('2026-09-02T12:00:00Z') };
    expect(agreedPlan([p1, agree('you', 'p1', '2026-09-02T11:00:00Z')])).toBeNull();
  });

  it('only a call-off that ended the plan makes a suggestion dead', () => {
    // A plan_off naming a suggestion that was never the plan does nothing —
    // otherwise anyone could pre-emptively kill the other side's offer.
    const log = [proposal('priya', '2026-09-02T17:00:00Z', 'p1'), callOff('you', 'p1')];
    expect(canAgree(log, 'p1', you, t('2026-09-02T12:20:00Z'))).toBeNull();
  });

  it('a call-off from outside the room does not make a suggestion dead', () => {
    const log = [proposal('priya', '2026-09-02T17:00:00Z', 'p1'), agree('you', 'p1'), callOff('mallory', 'p1')];
    expect(canAgree(log, 'p1', you, t('2026-09-02T12:20:00Z'), [you, priya])).toBe('already');
  });
});

describe('canCallOff', () => {
  it('needs a standing plan, and the right one', () => {
    const log = [proposal('priya', '2026-09-02T17:00:00Z', 'p1'), agree('you', 'p1')];
    expect(canCallOff(log, 'p1')).toBeNull();
    expect(canCallOff(log, 'p9')).toBe('no_plan');
    expect(canCallOff([proposal('priya', '2026-09-02T17:00:00Z', 'p1')], 'p1')).toBe('no_plan');
  });
});

describe('meetFromPlan — makeMeet finally has a caller', () => {
  it('builds a scheduled meet on public ground from the agreed suggestion', () => {
    const plan = agreedPlan([proposal('priya', '2026-09-02T17:00:00Z', 'p1', 'gate'), agree('you', 'p1')])!;
    const meet = meetFromPlan(plan, {
      requestId: asMeetRequestId('q1'),
      participants: [you, priya],
      airportIata: asIata('SIN'),
    });
    expect(meet.status).toBe('scheduled');
    expect(meet.kind).toBe('gate_coffee');
    expect(meet.place.kind).toBe('gate');
    expect(meet.place.isPublicGround).toBe(true);
    expect(meet.window.from).toBe('2026-09-02T17:00:00Z');
    expect(meet.origin).toEqual({ kind: 'request', requestId: 'q1' });
  });

  it('reads a suggestion from before place kinds existed as a landmark, the vaguest public kind', () => {
    const plan = agreedPlan([proposal('priya', '2026-09-02T17:00:00Z', 'p1'), agree('you', 'p1')])!;
    expect(planPlace(plan, { airportIata: asIata('SIN') }).kind).toBe('terminal_landmark');
  });
});

describe('meet ids — derived, and equal to the room ids so existing ratings still resolve', () => {
  it('matches the room a request and a car already have', () => {
    expect(String(meetIdForRequest(asMeetRequestId('q1')))).toBe('meet:q1');
    expect(String(meetIdForRide(asRideId('r1')))).toBe('ride:r1');
  });

  it('knows which meet a room belongs to, and that a circle General has none', () => {
    expect(String(meetIdForChannel('meet:q1'))).toBe('meet:q1');
    expect(String(meetIdForChannel('ride:r1'))).toBe('ride:r1');
    expect(meetIdForChannel('circle:insead')).toBeUndefined();
  });
});

describe('meetForRide — a car has a plan the moment it has two people', () => {
  const car = (patch: Partial<Parameters<typeof makeRide>[0]> = {}): Ride =>
    makeRide({
      id: asRideId('r1'),
      hostPersonId: you,
      tripId: asTripId('t1'),
      direction: 'from_airport',
      airportIata: asIata('SIN'),
      point: { lat: 1.2834, lon: 103.8607, label: 'Marina Bay' },
      window: { from: t('2026-09-03T09:10:00Z'), to: t('2026-09-03T10:10:00Z') },
      seatsTotal: 3,
      audience: { kind: 'open', rules: anyAudience() },
      createdAt: t('2026-09-02T09:00:00Z'),
      ...patch,
    });
  const withRider = (r: Ride, status: 'confirmed' | 'requested' = 'confirmed'): Ride => ({
    ...r,
    claims: [{ personId: priya, status, askedAt: t('2026-09-02T10:00:00Z'), history: [] }],
  });

  it('has none while the host is alone, or only asked', () => {
    expect(meetForRide(car())).toBeNull();
    expect(meetForRide(withRider(car(), 'requested'))).toBeNull();
  });

  it('meets at the rank when it leaves the airport', () => {
    const meet = meetForRide(withRider(car()))!;
    expect(meet.kind).toBe('ride_share');
    expect(meet.place.kind).toBe('taxi_rank');
    expect(meet.participants.map(String)).toEqual(['you', 'priya']);
    expect(meet.window).toEqual(car().window);
    expect(meet.origin).toEqual({ kind: 'ride', rideId: 'r1' });
  });

  it('meets at the pickup point when it heads for the airport', () => {
    const meet = meetForRide(withRider(car({ direction: 'to_airport' })))!;
    expect(meet.place.kind).toBe('pickup_point');
    expect(meet.place.label).toBe('Marina Bay');
  });

  it('has none once the car is called off', () => {
    expect(meetForRide({ ...withRider(car()), status: 'cancelled' })).toBeNull();
  });
});
