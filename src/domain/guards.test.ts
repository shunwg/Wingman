import { describe, expect, it } from 'vitest';
import { looksLikeAddress, makeMeet, makePublicPlace } from './guards';
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

describe('pickup_point', () => {
  it('is public ground a car can collect people from on the way to the airport', () => {
    const p = makePublicPlace({ kind: 'pickup_point', label: 'Indre By', airportIata: asIata('CPH'), lat: 55.68, lon: 12.57 });
    expect(p.isPublicGround).toBe(true);
    expect(p.kind).toBe('pickup_point');
  });
});

describe('looksLikeAddress — an address is not a meeting point', () => {
  it.each([
    '12 Baker Street',
    '221b Baker St',
    'Storgata 12',
    'Kongensgade 3, 2nd floor',
    'Hauptstraße 7',
    'Rue de Rivoli 12',
    'Flat 4, Marchmont',
    'Near SW1A 1AA',
    // Round 2: the bad actor's and the privacy walk's real addresses.
    'Karl Johans gate 22',
    'Thorvald Meyers gate 49',
    '12 rue de Rivoli',
    'Marina Bay Sands, room 1412',
    '14 Cloudesley Square',
    '#05-12, Blk 123 Toa Payoh',
    'Prinsengracht 263',
    'Friedrichstr. 12',
    'Baker Street 12',
    '12\u200B Baker Street',
    '１２ Baker Street',
  ])('refuses %s', (text) => {
    expect(looksLikeAddress(text)).toBe(true);
  });

  it.each([
    'Gate 12',
    'Meet at gate 12',
    'Taxi queue at T3 arrivals, by door 5. Look for the INSEAD tote.',
    'The coffee bar by the departures board, LHR',
    'Departures board 5',
    'Hall B, Room 3',
    'Terminal 2E',
    'Marina Bay',
    'Rank door 12. White estate, plate ends 4R.',
    'Outside the bakery on Store Kongensgade',
    'Departures gate 12',
    'Platform 5, St Pancras',
    'Pier 1 Terrace bar',
  ])('lets %s through', (text) => {
    expect(looksLikeAddress(text)).toBe(false);
  });

  it('is enforced where a place is made, not only hinted', () => {
    expect(() => makePublicPlace({ kind: 'cafe', label: '12 Baker Street', airportIata: asIata('LHR') })).toThrow();
  });
});

describe('a stored label never takes a screen down', () => {
  it('builds a place from an address-shaped label when reading, and refuses it when writing', () => {
    expect(() => makePublicPlace({ kind: 'cafe', label: '12 Baker Street', airportIata: asIata('LHR') })).toThrow();
    const read = makePublicPlace({ kind: 'cafe', label: '12 Baker Street', airportIata: asIata('LHR') }, { vetLabel: false });
    expect(read.isPublicGround).toBe(true);
  });
});
