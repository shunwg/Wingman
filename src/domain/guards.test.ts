import { describe, expect, it } from 'vitest';
import { makeMeet, makePublicPlace } from './guards';
import { asIata, asMeetId, asMeetRequestId, asPersonId, asRideId } from './ids';
import type { ISODateTime } from './time';
import type { MeetKind } from './intent';
import { ALL_MEET_KINDS } from './intent';
import { GROUP_KINDS } from './guards';

const t = (s: string) => s as ISODateTime;
const window = { from: t('2026-09-19T14:00:00Z'), to: t('2026-09-19T15:00:00Z') };
const gate = makePublicPlace({ kind: 'gate', label: 'Gate C12', airportIata: asIata('CDG') });
const rank = makePublicPlace({ kind: 'taxi_rank', label: 'Taxi rank, Terminal 2E', airportIata: asIata('CDG') });

const pair = (kind: MeetKind, ids: string[], place = gate) => () =>
  makeMeet({
    id: asMeetId('m1'),
    participants: ids.map(asPersonId),
    kind,
    origin: { kind: 'request', requestId: asMeetRequestId('q1') },
    place,
    window,
  });

describe('makeMeet', () => {
  it('builds a two-person coffee', () => {
    const m = pair('gate_coffee', ['a', 'b'])();
    expect(m.participants).toHaveLength(2);
    expect(m.status).toBe('scheduled');
    expect(m.checkIns).toEqual({});
  });

  it('refuses a three-person gate coffee — the pair invariant moved here, it did not vanish', () => {
    expect(pair('gate_coffee', ['a', 'b', 'c'])).toThrow(/two people/i);
  });

  it('accepts a four-person shared car', () => {
    const m = makeMeet({
      id: asMeetId('m2'),
      participants: ['a', 'b', 'c', 'd'].map(asPersonId),
      kind: 'ride_share',
      origin: { kind: 'ride', rideId: asRideId('r1') },
      place: rank,
      window,
    });
    expect(m.participants).toHaveLength(4);
    expect(m.origin).toEqual({ kind: 'ride', rideId: asRideId('r1') });
  });

  it('refuses one person, and refuses none', () => {
    expect(pair('gate_coffee', ['a'])).toThrow(/two people/i);
    expect(pair('gate_coffee', [])).toThrow(/two people/i);
  });

  it('refuses the same person twice — a car of one person counted twice has a free seat', () => {
    expect(pair('ride_share', ['a', 'a'], rank)).toThrow(/twice/i);
  });

  it('classifies every meet kind explicitly, so a new kind forces the decision', () => {
    for (const kind of ALL_MEET_KINDS) {
      const grouped = GROUP_KINDS.has(kind);
      const three = pair(kind, ['a', 'b', 'c'], rank);
      if (grouped) expect(three).not.toThrow();
      else expect(three).toThrow(/two people/i);
    }
  });
});
